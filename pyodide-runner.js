// pyodide-runner.js — drop-in replacement for the Skulpt runner
export class PyRunner {
  constructor({ onStdout, onStderr, onPlot, onInput, onStatus, onDone }) {
    this.h = { onStdout, onStderr, onPlot, onInput, onStatus, onDone };
    this.ready = false;
    this.#spawn();
  }

  #spawn() {
    this.worker?.terminate();
    this.ready = false;
    this.worker = new Worker("./pyodide-worker.js");
    // SharedArrayBuffer only exists when COOP/COEP headers are sent; without it input() is disabled but everything else works
    this.sab = typeof SharedArrayBuffer !== "undefined" && self.crossOriginIsolated ? new SharedArrayBuffer(8 + 4096) : null;
    if (this.sab) {
      this.ia = new Int32Array(this.sab);
      this.worker.postMessage({ type: "init-input", buffer: this.sab });
    }
    this.worker.onerror = (e) => { this.h.onStderr?.("Worker failed: " + (e.message || "could not load pyodide-worker.js")); this.h.onStatus?.("error"); };
    this.worker.onmessage = ({ data: m }) => {
      const h = this.h;
      if (m.type === "ready") { this.ready = true; h.onStatus?.("ready"); }
      else if (m.type === "stdout") h.onStdout?.(m.text);
      else if (m.type === "stderr") h.onStderr?.(m.text);
      else if (m.type === "plot") h.onPlot?.("data:image/png;base64," + m.png);
      else if (m.type === "status") h.onStatus?.(m.text);
      else if (m.type === "error") { h.onStderr?.(m.text); h.onDone?.(false); }
      else if (m.type === "done") h.onDone?.(true);
      else if (m.type === "input") {
        // onInput(prompt) must return a Promise<string> (your M3E dialog/field)
        Promise.resolve(h.onInput?.(m.prompt) ?? "").then((v) => this.#reply(v));
      }
    };
  }

  #reply(text) {
    if (!this.sab) return;
    const bytes = new TextEncoder().encode(text).slice(0, 4096);
    new Uint8Array(this.sab).set(bytes, 8);
    this.ia[1] = bytes.length;
    Atomics.store(this.ia, 0, 1);
    Atomics.notify(this.ia, 0);
  }

  run(code) { this.worker.postMessage({ type: "run", code }); }

  // Kills infinite loops for real, then boots a fresh worker
  stop() { this.#spawn(); this.h.onStatus?.("stopped"); this.h.onDone?.(false); }
}
