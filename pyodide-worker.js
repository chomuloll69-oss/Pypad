// pyodide-worker.js — classic worker, runs Python off the main thread
const T0 = performance.now();
importScripts('https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js');
const tScript = performance.now() - T0;
let py, ia, ib, mplPatched = false, ibuf = null, runSeq = 0, cancelledUpTo = 0;
// an interrupted top-level-await run re-throws KeyboardInterrupt out of asyncio's loop; the run's own catch reports it
addEventListener('error', e => {
  const s = String(e.message || '') + ' ' + String((e.error && (e.error.type || e.error.message)) || '');
  if (s.includes('KeyboardInterrupt')) e.preventDefault();
});
const post = m => postMessage(m);

globalThis.__plot = b64 => post({ type: 'plot', png: b64 });
globalThis.__input = prompt => {
  if (!ia) throw new Error('input() needs the COOP/COEP headers (works on Vercel, not on a plain local server)');
  Atomics.store(ia, 0, 0);
  post({ type: 'input', prompt });
  Atomics.wait(ia, 0, 0);
  return new TextDecoder().decode(ib.slice(8, 8 + ia[1]));
};

const MPL = `
import matplotlib, io, base64, js
matplotlib.use("agg")
import matplotlib.pyplot as plt
def _show(*a, **k):
    for n in plt.get_fignums():
        buf = io.BytesIO()
        plt.figure(n).savefig(buf, format="png", dpi=110, bbox_inches="tight")
        js.__plot(base64.b64encode(buf.getvalue()).decode())
    plt.close("all")
plt.show = _show
`;

const ready = (async () => {
  const t1 = performance.now();
  py = await loadPyodide();
  const tInit = performance.now() - t1;
  // write handler: chunks go out as-is (no added newline), so print(..., end='') isn't swallowed
  const stream = type => {
    const dec = new TextDecoder();
    return { write: buf => { const text = dec.decode(buf, { stream: true }); if (text) post({ type, text }); return buf.length; } };
  };
  py.setStdout(stream('stdout'));
  py.setStderr(stream('stderr'));
  if (ibuf) py.setInterruptBuffer(ibuf);
  py.runPython('import builtins, js, sys\ndef _input(p=""):\n    sys.stdout.flush()\n    return js.__input(str(p))\nbuiltins.input = _input');
  post({ type: 'ready', boot: { script: tScript, init: tInit } });
})();

onmessage = async e => {
  const m = e.data;
  if (m.type === 'init-input') { ia = new Int32Array(m.buffer); ib = new Uint8Array(m.buffer); return; }
  if (m.type === 'init-interrupt') { ibuf = new Uint8Array(m.buffer); if (py) py.setInterruptBuffer(ibuf); return; }
  if (m.type === 'cancel') { cancelledUpTo = runSeq; return; } // Stop pressed while the engine was still booting
  if (m.type !== 'run') return;
  const my = ++runSeq;
  await ready;
  if (cancelledUpTo >= my) return;
  if (ibuf) ibuf[0] = 0;
  post({ type: 'phase', v: 'loading' });
  try {
    const needsPkgs = /^\s*(import|from)\s+(numpy|matplotlib|pandas|scipy|sympy)/m.test(m.code);
    if (needsPkgs) post({ type: 'status', text: 'Loading packages (first time only)...' });
    await py.loadPackagesFromImports(m.code);
    if (!mplPatched && /matplotlib/.test(m.code)) { await py.runPythonAsync(MPL); mplPatched = true; }
    if (ibuf && ibuf[0] === 2) { ibuf[0] = 0; throw new Error('KeyboardInterrupt'); } // Stop pressed while loading
    post({ type: 'phase', v: 'running' });
    try {
      // plain runPython: KeyboardInterrupt comes back as a normal catchable error. Top-level await needs the async runner.
      if (/\bawait\b/.test(m.code)) await py.runPythonAsync(m.code); else py.runPython(m.code);
    }
    finally { py.runPython('import sys\nsys.stdout.flush()\nsys.stderr.flush()'); }
    post({ type: 'done' });
  } catch (err) { post({ type: 'error', text: String(err.message || err) }); }
};
