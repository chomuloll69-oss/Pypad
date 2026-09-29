import { PyRunner } from "./pyodide-runner.js";

const $ = (s) => document.querySelector(s);
const ed = $("#editor"), out = $("#out"), st = $("#status"), runBtn = $("#run"), stopBtn = $("#stop");
const KEY = "pypad.code";
const DEMO = `import numpy as np
import matplotlib.pyplot as plt

x = np.linspace(0, 2 * np.pi, 200)
plt.plot(x, np.sin(x), label="sin")
plt.plot(x, np.cos(x), label="cos")
plt.legend()
plt.title("Trig, but make it real")
plt.show()
`;
try { ed.value = localStorage.getItem(KEY) ?? DEMO; } catch { ed.value = DEMO; }
ed.addEventListener("input", () => { try { localStorage.setItem(KEY, ed.value); } catch {} });

// Tab key = 4 spaces, Ctrl/Cmd+Enter = run
ed.addEventListener("keydown", (e) => {
  if (e.key === "Tab") {
    e.preventDefault();
    ed.setRangeText("    ", ed.selectionStart, ed.selectionEnd, "end");
    ed.dispatchEvent(new Event("input"));
  } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); runCode(); }
});

// Tabs (mobile)
const tab = (id) => {
  document.querySelectorAll(".pane").forEach((p) => p.classList.toggle("on", p.id === id));
  document.querySelectorAll(".nav button").forEach((b) => b.classList.toggle("on", b.dataset.tab === id));
};
document.querySelectorAll(".nav button").forEach((b) => (b.onclick = () => tab(b.dataset.tab)));

const add = (text, cls) => {
  out.querySelector(".empty")?.remove();
  const p = document.createElement("pre");
  p.className = cls;
  p.textContent = text;
  out.append(p);
  out.scrollTop = out.scrollHeight;
};
const setRunning = (v) => { runBtn.hidden = v; stopBtn.hidden = !v; };

const ask = (prompt) => new Promise((res) => {
  const d = $("#dlg"), i = $("#dlgInput");
  $("#dlgPrompt").textContent = prompt || "Input";
  i.value = "";
  d.onclose = () => { add((prompt || "") + i.value + "\n", "in"); res(i.value); };
  d.showModal();
  i.focus();
});

const py = new PyRunner({
  onStdout: (t) => add(t, "o"),
  onStderr: (t) => add(t, "e"),
  onPlot: (src) => { const im = new Image(); im.src = src; im.className = "plot"; out.append(im); out.scrollTop = out.scrollHeight; },
  onInput: ask,
  onStatus: (s) => (st.textContent = s.charAt(0).toUpperCase() + s.slice(1)),
  onDone: (ok) => { setRunning(false); if (ok) st.textContent = "Ready"; },
});

function runCode() {
  out.replaceChildren();
  setRunning(true);
  if (matchMedia("(max-width:799px)").matches) tab("outPane");
  py.run(ed.value);
}
runBtn.onclick = runCode;
stopBtn.onclick = () => py.stop();
$("#clear").onclick = () => out.replaceChildren();
