// pyodide-worker.js — runs Python off the main thread so Stop can kill infinite loops
importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js");

let py, ia, ib;
const post = (m) => postMessage(m);

const SETUP = `
import builtins, io, base64, js
from pyodide.ffi import to_js
builtins.input = lambda prompt="": js.__input(str(prompt))
try:
    import matplotlib
    matplotlib.use("agg")
    import matplotlib.pyplot as plt
    def _show(*a, **k):
        for n in plt.get_fignums():
            buf = io.BytesIO()
            plt.figure(n).savefig(buf, format="png", dpi=110, bbox_inches="tight")
            js.__plot(base64.b64encode(buf.getvalue()).decode())
        plt.close("all")
    plt.show = _show
except ImportError:
    pass
`;

globalThis.__plot = (b64) => post({ type: "plot", png: b64 });
globalThis.__input = (prompt) => {
  if (!ia) throw new Error("input() needs SharedArrayBuffer (check COOP/COEP headers)");
  Atomics.store(ia, 0, 0);
  post({ type: "input", prompt });
  Atomics.wait(ia, 0, 0);
  const len = ia[1];
  return new TextDecoder().decode(ib.slice(8, 8 + len));
};

const ready = (async () => {
  py = await loadPyodide();
  py.setStdout({ batched: (s) => post({ type: "stdout", text: s }) });
  py.setStderr({ batched: (s) => post({ type: "stderr", text: s }) });
  post({ type: "ready" });
})();

onmessage = async (e) => {
  const m = e.data;
  if (m.type === "init-input") {
    ia = new Int32Array(m.buffer);
    ib = new Uint8Array(m.buffer);
    return;
  }
  if (m.type !== "run") return;
  await ready;
  try {
    post({ type: "status", text: "loading packages…" });
    await py.loadPackagesFromImports(m.code); // auto-fetches numpy, matplotlib, pandas...
    await py.runPythonAsync(SETUP);
    post({ type: "status", text: "running" });
    await py.runPythonAsync(m.code);
    post({ type: "done" });
  } catch (err) {
    post({ type: "error", text: String(err.message || err) });
  }
};
