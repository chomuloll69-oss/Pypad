// pyodide-worker.js — classic worker, runs Python off the main thread
importScripts('https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js');
let py, ia, ib, mplPatched = false;
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
  py = await loadPyodide();
  py.setStdout({ batched: s => post({ type: 'stdout', text: s }) });
  py.setStderr({ batched: s => post({ type: 'stderr', text: s }) });
  py.runPython('import builtins, js\nbuiltins.input = lambda p="": js.__input(str(p))');
  post({ type: 'ready' });
})();

onmessage = async e => {
  const m = e.data;
  if (m.type === 'init-input') { ia = new Int32Array(m.buffer); ib = new Uint8Array(m.buffer); return; }
  if (m.type !== 'run') return;
  await ready;
  try {
    const needsPkgs = /^\s*(import|from)\s+(numpy|matplotlib|pandas|scipy|sympy)/m.test(m.code);
    if (needsPkgs) post({ type: 'status', text: 'Loading packages (first time only)...' });
    await py.loadPackagesFromImports(m.code);
    if (!mplPatched && /matplotlib/.test(m.code)) { await py.runPythonAsync(MPL); mplPatched = true; }
    await py.runPythonAsync(m.code);
    post({ type: 'done' });
  } catch (err) { post({ type: 'error', text: String(err.message || err) }); }
};
