(function() {
function loadScript(src, onload, onerror) {
  var s = document.createElement('script');
  s.src = src; s.onload = onload; s.onerror = onerror;
  document.head.appendChild(s);
}
var CDN1_CORE = 'https://cdnjs.cloudflare.com/ajax/libs/skulpt/1.2.0/skulpt.min.js';
var CDN1_STDLIB = 'https://cdnjs.cloudflare.com/ajax/libs/skulpt/1.2.0/skulpt-stdlib.js';
var CDN2_CORE = 'https://unpkg.com/skulpt@1.2.0/dist/skulpt.min.js';
var CDN2_STDLIB = 'https://unpkg.com/skulpt@1.2.0/dist/skulpt-stdlib.js';

function loadStdlib(coreUrl, stdlibUrl, fallbackCore, fallbackStdlib) {
  loadScript(stdlibUrl, function() {
    window._skulptLoaded = true;
  }, function() {
    if (fallbackStdlib) {
      loadStdlib(fallbackCore, fallbackStdlib, null, null);
    } else {
      window._skulptLoadFailed = true;
    }
  });
}

loadScript(CDN1_CORE, function() {
  loadStdlib(CDN1_CORE, CDN1_STDLIB, CDN2_CORE, CDN2_STDLIB);
}, function() {
  loadScript(CDN2_CORE, function() {
    loadStdlib(CDN2_CORE, CDN2_STDLIB, null, null);
  }, function() {
    window._skulptLoadFailed = true;
  });
});
})();
const PY_KEYWORDS = [
  'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break',
  'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally',
  'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal',
  'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield'
];

const PY_BUILTINS = [
  'abs', 'all', 'any', 'ascii', 'bin', 'bool', 'breakpoint', 'bytearray', 'bytes',
  'callable', 'chr', 'classmethod', 'compile', 'complex', 'copyright', 'credits',
  'delattr', 'dict', 'dir', 'divmod', 'enumerate', 'eval', 'exec', 'exit', 'filter',
  'float', 'format', 'frozenset', 'getattr', 'globals', 'hasattr', 'hash', 'help',
  'hex', 'id', 'input', 'int', 'isinstance', 'issubclass', 'iter', 'len', 'license',
  'list', 'locals', 'map', 'max', 'memoryview', 'min', 'next', 'object', 'oct', 'open',
  'ord', 'pow', 'print', 'property', 'quit', 'range', 'repr', 'reversed', 'round',
  'set', 'setattr', 'slice', 'sorted', 'staticmethod', 'str', 'sum', 'super', 'tuple',
  'type', 'vars', 'zip'
];

const PY_SNIPPETS = [
  { name: 'for loop', code: 'for i in range(10):\n    print(i)', badge: 'sn' },
  { name: 'while loop', code: 'while True:\n    break', badge: 'sn' },
  { name: 'function def', code: 'def my_function(x):\n    return x * 2', badge: 'sn' },
  { name: 'class def', code: 'class MyClass:\n    def __init__(self):\n        pass', badge: 'sn' },
  { name: 'list comp', code: 'result = [x**2 for x in range(10)]\nprint(result)', badge: 'sn' },
  { name: 'try/except', code: 'try:\n    pass\nexcept Exception as e:\n    print(e)', badge: 'sn' },
  { name: 'dict demo', code: "d = {'a': 1, 'b': 2}\nfor k, v in d.items():\n    print(k, v)", badge: 'sn' },
  { name: 'fibonacci', code: 'def fib(n):\n    a, b = 0, 1\n    for _ in range(n):\n        print(a)\n        a, b = b, a+b\nfib(10)', badge: 'sn' },
  { name: 'HelloWorld("print")', code: 'def HelloWorld(y):\n    print("print")\nHelloWorld("print")', badge: 'sn' },
];

const ALL_COMPLETIONS = [
  ...PY_KEYWORDS.map(w => ({ name: w, badge: 'kw' })),
  ...PY_BUILTINS.map(w => ({ name: w, badge: 'bi' })),
];

const state = {
  theme: 'dark',
  fontSize: 13,
  showLineNumbers: true,
  autocompleteEnabled: true,
  autoIndentEnabled: true,
  autoPairEnabled: true,
  shellItalicEnabled: true,
  acIndex: -1,
  acItems: [],
  isRunning: false,
  skulptReady: false
};

const codeInput = document.getElementById('code-input');
const highlightLayer = document.getElementById('highlight-layer');
const lineNumbers = document.getElementById('line-numbers');
const outputEl = document.getElementById('output');
const acBox = document.getElementById('autocomplete-box');
const runFab = document.getElementById('run-fab');
const statusDot = document.getElementById('status-dot');
const snackbar = document.getElementById('snackbar');
const outputSection = document.getElementById('output-section');
const resizeHandle = document.getElementById('resize-handle');

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlightPython(code) {
  const lines = code.split('\n');
  return lines.map(line => {
    let html = '';
    let i = 0;
    const L = line.length;

    while (i < L) {
      if (line[i] === '#') {
        html += `<span class="syn-comment">${escapeHtml(line.slice(i))}</span>`;
        break;
      }
      if ((line[i] === "'" && line[i+1] === "'" && line[i+2] === "'") ||
          (line[i] === '"' && line[i+2] === '"' && line[i+1] === '"')) {
        const q = line[i].repeat(3);
        let end = line.indexOf(q, i+3);
        if (end === -1) end = L;
        else end += 3;
        html += `<span class="syn-string">${escapeHtml(line.slice(i, end))}</span>`;
        i = end; continue;
      }
      if (line[i] === "'" || line[i] === '"') {
        const q = line[i];
        let j = i+1;
        while (j < L && line[j] !== q) {
          if (line[j] === '\\') j++;
          j++;
        }
        j++;
        html += `<span class="syn-string">${escapeHtml(line.slice(i, j))}</span>`;
        i = j; continue;
      }
      if (line[i] === '@' && (i === 0 || /\s/.test(line[i-1]))) {
        let j = i+1;
        while (j < L && /[\w.]/.test(line[j])) j++;
        html += `<span class="syn-decorator">${escapeHtml(line.slice(i, j))}</span>`;
        i = j; continue;
      }
      if (/[0-9]/.test(line[i]) && (i === 0 || !/\w/.test(line[i-1]))) {
        let j = i;
        while (j < L && /[0-9._xXbBoOeEjJ]/.test(line[j])) j++;
        html += `<span class="syn-number">${escapeHtml(line.slice(i, j))}</span>`;
        i = j; continue;
      }
      if (/[a-zA-Z_]/.test(line[i])) {
        let j = i;
        while (j < L && /\w/.test(line[j])) j++;
        const word = line.slice(i, j);
        let peek = j;
        while (peek < L && line[peek] === ' ') peek++;
        const isCall = line[peek] === '(';

        if (word === 'self' || word === 'cls') {
          html += `<span class="syn-self">${word}</span>`;
        } else if (['True', 'False'].includes(word)) {
          html += `<span class="syn-bool">${word}</span>`;
        } else if (word === 'None') {
          html += `<span class="syn-none">${word}</span>`;
        } else if (PY_KEYWORDS.includes(word)) {
          html += `<span class="syn-keyword">${word}</span>`;
        } else if (PY_BUILTINS.includes(word)) {
          html += `<span class="syn-builtin">${word}</span>`;
        } else if (isCall) {
          const prefix = line.slice(0, i).trimEnd();
          if (/\bclass\s*$/.test(prefix) || /\bclass$/.test(prefix)) {
            html += `<span class="syn-class-name">${word}</span>`;
          } else {
            html += `<span class="syn-function">${word}</span>`;
          }
        } else if (/^[A-Z]/.test(word)) {
          html += `<span class="syn-class-name">${word}</span>`;
        } else {
          html += `<span class="syn-default">${escapeHtml(word)}</span>`;
        }
        i = j; continue;
      }
      if (/[+\-*\/%=<>!&|^~:,.(\)[\]{}]/.test(line[i])) {
        const isBracket = /[()\[\]{}]/.test(line[i]);
        const cls = isBracket ? 'syn-bracket' : 'syn-operator';
        html += `<span class="${cls}">${escapeHtml(line[i])}</span>`;
        i++; continue;
      }
      html += `<span class="syn-default">${escapeHtml(line[i])}</span>`;
      i++;
    }
    return html;
  }).join('\n');
}

function updateHighlight() {
  const code = codeInput.value;
  highlightLayer.innerHTML = highlightPython(code) + '\n';
  updateLineNumbers(code);
}

function updateLineNumbers(code) {
  if (!state.showLineNumbers) { lineNumbers.style.display = 'none'; return; }
  lineNumbers.style.display = '';
  const count = (code.match(/\n/g) || []).length + 1;
  lineNumbers.textContent = Array.from({ length: count }, (_, i) => i + 1).join('\n');
}

function syncScroll() {
  highlightLayer.style.transform = `translateY(-${codeInput.scrollTop}px) translateX(-${codeInput.scrollLeft}px)`;
  lineNumbers.style.transform = `translateY(-${codeInput.scrollTop}px)`;
}
codeInput.addEventListener('scroll', syncScroll);

function getWordBeforeCursor() {
  const pos = codeInput.selectionStart;
  const text = codeInput.value.slice(0, pos);
  const m = text.match(/[\w]+$/);
  return m ? m[0] : '';
}

function showAutocomplete() {
  if (!state.autocompleteEnabled) return;
  const word = getWordBeforeCursor();
  if (word.length < 1) { hideAC(); return; }

  const matches = ALL_COMPLETIONS.filter(c =>
    c.name.startsWith(word) && c.name !== word
  ).slice(0, 8);

  if (!matches.length) { hideAC(); return; }
  state.acItems = matches;
  state.acIndex = -1;

  acBox.innerHTML = matches.map((m, i) => `
    <div class="ac-item" data-idx="${i}" data-name="${m.name}">
      <span class="ac-badge ${m.badge}">${m.badge.toUpperCase()}</span>
      <span class="ac-name">${m.name}</span>
    </div>
  `).join('');

  const coords = getCaretCoords();
  const boxW = 220;
  const vpW = window.innerWidth;
  const vpH = window.innerHeight;
  let left = Math.min(coords.x, vpW - boxW - 8);
  let top = coords.y + 20;
  if (top + 200 > vpH) top = coords.y - 210;

  acBox.style.left = left + 'px';
  acBox.style.top = top + 'px';
  acBox.style.display = 'block';

  acBox.querySelectorAll('.ac-item').forEach(el => {
    el.addEventListener('mousedown', e => {
      e.preventDefault();
      applyAC(el.dataset.name);
    });
    el.addEventListener('touchend', e => {
      e.preventDefault();
      applyAC(el.dataset.name);
    });
  });
}

function hideAC() {
  acBox.style.display = 'none';
  state.acItems = [];
  state.acIndex = -1;
}

function applyAC(name) {
  const pos = codeInput.selectionStart;
  const text = codeInput.value;
  const before = text.slice(0, pos);
  const after = text.slice(pos);
  const m = before.match(/[\w]+$/);
  const word = m ? m[0] : '';
  const newBefore = before.slice(0, before.length - word.length) + name;
  codeInput.value = newBefore + after;
  const newPos = newBefore.length;
  codeInput.setSelectionRange(newPos, newPos);
  updateHighlight();
  hideAC();
  codeInput.focus();
}

function getCaretCoords() {
  const rect = codeInput.getBoundingClientRect();
  const text = codeInput.value.slice(0, codeInput.selectionStart);
  const lines = text.split('\n');
  const lineNum = lines.length - 1;
  const colNum = lines[lines.length - 1].length;
  const lineH = parseFloat(getComputedStyle(codeInput).lineHeight) || 22;
  const charW = parseFloat(getComputedStyle(codeInput).fontSize) * 0.6;
  const padL = 8;
  const padT = 12;
  return {
    x: rect.left + padL + colNum * charW - codeInput.scrollLeft,
    y: rect.top + padT + lineNum * lineH - codeInput.scrollTop
  };
}

function handleEnter() {
  if (!state.autoIndentEnabled) return false;
  const pos = codeInput.selectionStart;
  const text = codeInput.value;
  const before = text.slice(0, pos);
  const after = text.slice(pos);

  const lines = before.split('\n');
  const currentLine = lines[lines.length - 1];
  const indent = currentLine.match(/^(\s*)/)[1];

  const extraIndent = /:\s*$/.test(currentLine.trimEnd()) ? '    ' : '';
  const insert = '\n' + indent + extraIndent;

  codeInput.value = before + insert + after;
  const newPos = pos + insert.length;
  codeInput.setSelectionRange(newPos, newPos);
  updateHighlight();
  return true;
}

const PAIR_OPEN = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'" };
const PAIR_CLOSE = { ')': '(', ']': '[', '}': '{', '"': '"', "'": "'" };
const QUOTE_CHARS = new Set(['"', "'"]);

function handleAutoPair(e, key) {
  if (!state.autoPairEnabled) return false;
  const start = codeInput.selectionStart;
  const end = codeInput.selectionEnd;
  const text = codeInput.value;

  // Wrap current selection when typing an opening pair char
  if ((PAIR_OPEN[key]) && start !== end) {
    e.preventDefault();
    const selected = text.slice(start, end);
    const closeChar = PAIR_OPEN[key];
    codeInput.value = text.slice(0, start) + key + selected + closeChar + text.slice(end);
    codeInput.setSelectionRange(start + 1, start + 1 + selected.length);
    updateHighlight();
    return true;
  }

  // Quote chars: skip-over if same quote already follows, else insert pair
  // (but don't auto-pair a quote right after a word char, e.g. it's -> it'|s)
  if (QUOTE_CHARS.has(key) && start === end) {
    const nextChar = text[start];
    const prevChar = text[start - 1];
    if (nextChar === key) {
      e.preventDefault();
      codeInput.setSelectionRange(start + 1, start + 1);
      return true;
    }
    if (/[\w'"]/.test(prevChar || '')) return false;
    e.preventDefault();
    codeInput.value = text.slice(0, start) + key + key + text.slice(start);
    codeInput.setSelectionRange(start + 1, start + 1);
    updateHighlight();
    return true;
  }

  // Bracket open chars: always insert the pair
  if (PAIR_OPEN[key] && start === end && !QUOTE_CHARS.has(key)) {
    e.preventDefault();
    const closeChar = PAIR_OPEN[key];
    codeInput.value = text.slice(0, start) + key + closeChar + text.slice(start);
    codeInput.setSelectionRange(start + 1, start + 1);
    updateHighlight();
    return true;
  }

  // Closing chars: skip over if the next char is already that closer
  if (PAIR_CLOSE[key] && start === end) {
    const nextChar = text[start];
    if (nextChar === key) {
      e.preventDefault();
      codeInput.setSelectionRange(start + 1, start + 1);
      return true;
    }
  }

  return false;
}

function handleAutoPairBackspace(e) {
  if (!state.autoPairEnabled) return false;
  const start = codeInput.selectionStart;
  const end = codeInput.selectionEnd;
  if (start !== end) return false;
  const text = codeInput.value;
  const prevChar = text[start - 1];
  const nextChar = text[start];
  if (PAIR_OPEN[prevChar] && nextChar === PAIR_OPEN[prevChar]) {
    e.preventDefault();
    codeInput.value = text.slice(0, start - 1) + text.slice(start + 1);
    codeInput.setSelectionRange(start - 1, start - 1);
    updateHighlight();
    return true;
  }
  return false;
}

codeInput.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    runCode();
    return;
  }

  if (acBox.style.display !== 'none' && state.acItems.length) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      state.acIndex = Math.min(state.acIndex + 1, state.acItems.length - 1);
      renderACSelection(); return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      state.acIndex = Math.max(state.acIndex - 1, 0);
      renderACSelection(); return;
    }
    if (e.key === 'Tab' || e.key === 'Enter') {
      if (state.acIndex >= 0) {
        e.preventDefault();
        applyAC(state.acItems[state.acIndex].name); return;
      }
      if (e.key === 'Tab') { e.preventDefault(); insertTab(); return; }
      if (e.key === 'Enter') { e.preventDefault(); if (handleEnter()) return; }
    }
    if (e.key === 'Escape') { hideAC(); return; }
  }

  if (e.key === 'Tab') {
    e.preventDefault();
    const start = codeInput.selectionStart;
    const end = codeInput.selectionEnd;
    if (start !== end) {
      blockIndent(e.shiftKey); return;
    }
    if (!state.acItems.length) insertTab(); return;
  }

  if (e.key === 'Enter') {
    e.preventDefault();
    hideAC();
    handleEnter();
    return;
  }

  if (e.key === 'Backspace') {
    hideAC();
    return;
  }
});

codeInput.addEventListener('beforeinput', e => {
  if (!state.autoPairEnabled) return;

  if (e.inputType === 'insertText' && e.data && (PAIR_OPEN[e.data] || PAIR_CLOSE[e.data])) {
    if (handleAutoPair(e, e.data)) return;
  }

  if (e.inputType === 'deleteContentBackward') {
    handleAutoPairBackspace(e);
  }
});

function insertTab() {
  const pos = codeInput.selectionStart;
  const text = codeInput.value;
  codeInput.value = text.slice(0, pos) + '    ' + text.slice(pos);
  codeInput.setSelectionRange(pos+4, pos+4);
  updateHighlight();
}

function blockIndent(unindent) {
  const start = codeInput.selectionStart;
  const end = codeInput.selectionEnd;
  const text = codeInput.value;

  const lineStart = text.lastIndexOf('\n', start-1) + 1;
  const lineEnd = text.indexOf('\n', end);
  const block = text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd);

  const newBlock = block.split('\n').map(l =>
    unindent ? l.replace(/^    /, '') : '    ' + l
  ).join('\n');

  codeInput.value = text.slice(0, lineStart) + newBlock + (lineEnd === -1 ? '' : text.slice(lineEnd));
  updateHighlight();
}

function renderACSelection() {
  acBox.querySelectorAll('.ac-item').forEach((el, i) => {
    el.classList.toggle('selected', i === state.acIndex);
  });
  const sel = acBox.querySelector('.selected');
  if (sel) sel.scrollIntoView({ block: 'nearest' });
}

codeInput.addEventListener('input', () => {
  updateHighlight();
  showAutocomplete();
});

function setStatus(s) {
  statusDot.className = 'status-dot ' + s;
}

function appendOutput(text, cls = '') {
  const span = document.createElement('span');
  span.className = 'out-line' + (cls ? ' ' + cls : '');
  span.textContent = text;
  outputEl.appendChild(span);
  outputEl.appendChild(document.createTextNode('\n'));
  outputEl.scrollTop = outputEl.scrollHeight;
  if (cls !== 'info') markOutputBadge();
}

function runCode() {
  if (state.isRunning) return;
  const code = codeInput.value.trim();
  if (!code) { showSnack('Nothing to run'); return; }

  state.isRunning = true;
  runFab.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="24" width="24" viewBox="0 -960 960 960" fill="currentColor"><path d="M240-320v-320q0-33 23.5-56.5T320-720h320q33 0 56.5 23.5T720-640v320q0 33-23.5 56.5T640-240H320q-33 0-56.5-23.5T240-320Z"/></svg>';
  runFab.classList.add('running');
  setStatus('running');

  outputEl.innerHTML = '';
  appendOutput('Running...', 'system');

  const ripple = document.createElement('div');
  ripple.className = 'fab-ripple';
  ripple.style.cssText = 'width:56px;height:56px;left:0;top:0;';
  runFab.appendChild(ripple);
  setTimeout(() => ripple.remove(), 500);

  if (typeof Sk === 'undefined') {
    appendOutput('Loading Python engine...', 'info');
    let attempts = 0;
    const wait = setInterval(() => {
      attempts++;
      if (typeof Sk !== 'undefined') {
        clearInterval(wait);
        outputEl.innerHTML = '';
        appendOutput('Running...', 'system');
        execWithSkulpt(code);
      } else if (attempts > 25) {
        clearInterval(wait);
        outputEl.innerHTML = '';
        appendOutput('Python engine failed to load.', 'error');
        appendOutput('Check your internet connection.', 'error');
        appendOutput('Try refreshing the page.', 'error');
        resetFab();
      }
    }, 200);
    return;
  }

  execWithSkulpt(code);
}

function execWithSkulpt(code) {
  Sk.configure({
    output: txt => {
      const lines = txt.split('\n');
      lines.forEach((l, i) => {
        if (i < lines.length - 1 || l !== '') appendOutput(l);
      });
    },
    read: file => {
      if (Sk.builtinFiles && Sk.builtinFiles.files[file] !== undefined)
        return Sk.builtinFiles.files[file];
      throw new Error(`File not found: '${file}'`);
    },
    __future__: Sk.python3,
    inputfun: prompt => window.prompt(prompt || 'Input:') || '',
    inputfunTakesPrompt: true,
    execLimit: 10000
  });

  const promise = Sk.misceval.asyncToPromise(() =>
    Sk.importMainWithBody('<stdin>', false, code, true)
  );

  promise.then(() => {
    setStatus('success');
    appendOutput('Done', 'success');
    resetFab();
  }).catch(err => {
    setStatus('error');
    const msg = err.toString().replace('Traceback (most recent call last):\n', '');
    appendOutput(msg, 'error');
    resetFab();
  });
}

function resetFab() {
  state.isRunning = false;
  runFab.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="24" width="24" viewBox="0 -960 960 960" fill="currentColor"><path d="M360-272q-17 0-28.5-11.5T320-312v-336q0-17 11.5-28.5T360-688q6 0 11 1.5t10 4.5l336 168q14 7 14 22.5T717-469L381-301q-5 3-10 4.5t-11 1.5Z"/></svg>';
  runFab.classList.remove('running');
  setTimeout(() => setStatus(''), 3000);
}

runFab.addEventListener('click', runCode);

document.getElementById('bottom-nav').querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const panel = document.getElementById('panel-' + btn.dataset.panel);
    if (panel) panel.classList.add('active');
    runFab.style.display = btn.dataset.panel === 'editor' ? '' : 'none';
  });
});

let resizing = false, resizeStartY = 0, resizeStartH = 0, resizeStartX = 0, resizeStartW = 0;
const isDesktop = () => window.matchMedia('(min-width: 900px)').matches;

resizeHandle.addEventListener('mousedown', startResize);
resizeHandle.addEventListener('touchstart', e => startResize(e.touches[0]), { passive: true });

function startResize(e) {
  resizing = true;
  if (isDesktop()) {
    resizeStartX = e.clientX;
    resizeStartW = outputSection.offsetWidth;
  } else {
    resizeStartY = e.clientY;
    resizeStartH = outputSection.offsetHeight;
  }
  resizeHandle.classList.add('dragging');
  document.addEventListener('mousemove', doResize);
  document.addEventListener('mouseup', endResize);
  document.addEventListener('touchmove', e => doResize(e.touches[0]), { passive: true });
  document.addEventListener('touchend', endResize);
}

function doResize(e) {
  if (!resizing) return;
  if (isDesktop()) {
    const delta = resizeStartX - e.clientX;
    const editorWrapper = document.getElementById('panel-editor');
    const maxW = editorWrapper.offsetWidth - 220;
    const newW = Math.max(220, Math.min(resizeStartW + delta, maxW));
    outputSection.style.width = newW + 'px';
    outputSection.style.flex = '0 0 ' + newW + 'px';
  } else {
    const delta = resizeStartY - e.clientY;
    const newH = Math.max(80, Math.min(resizeStartH + delta, window.innerHeight * 0.65));
    outputSection.style.height = newH + 'px';
    checkCollapsed();
  }
}

function endResize() {
  resizing = false;
  resizeHandle.classList.remove('dragging');
  document.removeEventListener('mousemove', doResize);
  document.removeEventListener('mouseup', endResize);
  checkCollapsed();
}

const consoleFab = document.getElementById('console-fab');
const COLLAPSE_THRESHOLD = 82;
const EXPANDED_H = 200;

function checkCollapsed() {
  const h = outputSection.offsetHeight;
  const isCollapsed = h <= COLLAPSE_THRESHOLD;
  consoleFab.classList.toggle('visible', isCollapsed);
}

consoleFab.addEventListener('click', () => {
  outputSection.style.transition = 'height var(--motion-duration-long) var(--motion-emphasized)';
  outputSection.style.height = EXPANDED_H + 'px';
  consoleFab.classList.remove('visible');
  setTimeout(() => {
    outputSection.style.transition = '';
  }, 500);
});

function markOutputBadge() {
  consoleFab.classList.add('has-output');
}

resizeHandle.addEventListener('dblclick', () => {
  const h = outputSection.offsetHeight;
  if (h > COLLAPSE_THRESHOLD) {
    outputSection.style.transition = 'height var(--motion-duration-medium) var(--motion-emphasized)';
    outputSection.style.height = '80px';
    setTimeout(() => { outputSection.style.transition = ''; checkCollapsed(); }, 400);
  } else {
    outputSection.style.transition = 'height var(--motion-duration-long) var(--motion-emphasized)';
    outputSection.style.height = EXPANDED_H + 'px';
    consoleFab.classList.remove('visible');
    setTimeout(() => { outputSection.style.transition = ''; }, 500);
  }
});

function setTheme(t) {
  state.theme = t;
  document.body.classList.toggle('light-theme', t === 'light');
  const sun = document.getElementById('icon-sun');
  const moon = document.getElementById('icon-moon');
  if (t === 'dark') {
    sun.style.display = 'block';
    sun.style.color = '#C8C5D0';
    moon.style.display = 'none';
  } else {
    moon.style.display = 'block';
    moon.style.color = '#47464F';
    sun.style.display = 'none';
  }
  document.querySelectorAll('.theme-pill').forEach(p => {
    p.classList.toggle('active', p.dataset.theme === t);
  });
  const clearFill = t === 'dark' ? '#C8C5D0' : '#47464F';
  document.querySelectorAll('#clear-code-btn span, #clear-output-btn svg').forEach(s => { if (s.tagName === 'svg') s.setAttribute('fill', clearFill); else s.style.color = clearFill; });
  const iconExportNav = document.getElementById('icon-export-nav');
  if (iconExportNav) iconExportNav.style.color = clearFill;
  const iconEditorNav = document.getElementById('icon-editor-nav');
  if (iconEditorNav) iconEditorNav.style.color = clearFill;
  localStorage.setItem('pypad-theme', t);
}

document.getElementById('theme-toggle-btn').addEventListener('click', () => {
  setTheme(state.theme === 'dark' ? 'light' : 'dark');
});

document.querySelectorAll('.theme-pill').forEach(p => {
  p.addEventListener('click', () => setTheme(p.dataset.theme));
});

function initSwitch(id, stateKey, callback) {
  const sw = document.getElementById(id);
  sw.addEventListener('click', () => {
    state[stateKey] = !state[stateKey];
    const isOn = state[stateKey];
    sw.classList.toggle('on', isOn);
    sw.setAttribute('aria-checked', String(isOn));
    if (callback) callback(isOn);
  });
}

initSwitch('toggle-line-numbers', 'showLineNumbers', v => {
  lineNumbers.style.display = v ? '' : 'none';
  updateLineNumbers(codeInput.value);
});
initSwitch('toggle-autocomplete', 'autocompleteEnabled', v => {
  if (!v) hideAC();
});
initSwitch('toggle-indent', 'autoIndentEnabled');
initSwitch('toggle-autopair', 'autoPairEnabled');
initSwitch('toggle-shell-italic', 'shellItalicEnabled', v => {
  document.body.classList.toggle('shell-italic-off', !v);
});

document.getElementById('font-size-select').addEventListener('change', e => {
  const sz = e.target.value + 'px';
  codeInput.style.fontSize = sz;
  highlightLayer.style.fontSize = sz;
  lineNumbers.style.fontSize = (parseInt(e.target.value)-1) + 'px';
  document.getElementById('output').style.fontSize = sz;
  state.fontSize = parseInt(e.target.value);
});

document.getElementById('export-py-btn').addEventListener('click', () => {
  const code = codeInput.value;
  if (!code.trim()) { showSnack('Editor is empty'); return; }
  const blob = new Blob([code], { type: 'text/x-python' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'main.py';
  a.click();
  URL.revokeObjectURL(url);
  showSnack('Downloaded main.py');
});

document.getElementById('copy-btn').addEventListener('click', async () => {
  const code = codeInput.value;
  if (!code.trim()) { showSnack('Nothing to copy'); return; }
  try {
    await navigator.clipboard.writeText(code);
    showSnack('Copied to clipboard');
  } catch {
    codeInput.select();
    document.execCommand('copy');
    showSnack('Copied');
  }
});

document.getElementById('clear-all-btn').addEventListener('click', () => {
  if (!codeInput.value.trim()) { showSnack('Already empty'); return; }
  codeInput.value = '';
  updateHighlight();
  outputEl.innerHTML = '<span class="out-line info">Cleared. Ready.</span>';
  setStatus('');
  showSnack('Cleared');
});

document.getElementById('clear-code-btn').addEventListener('click', () => {
  codeInput.value = '';
  updateHighlight();
  showSnack('Editor cleared');
});

document.getElementById('clear-output-btn').addEventListener('click', () => {
  outputEl.innerHTML = '<span class="out-line info">Output cleared.</span>';
  setStatus('');
  consoleFab.classList.remove('has-output');
});

const snippetsList = document.getElementById('snippets-list');
PY_SNIPPETS.forEach(sn => {
  const row = document.createElement('div');
  row.className = 'setting-row';
  row.style.cursor = 'pointer';
  row.innerHTML = `
    <div class="setting-info">
      <div class="setting-label">${sn.name}</div>
      <div class="setting-sub" style="font-family:'JetBrains Mono',monospace;font-size:11px;">${sn.code.split('\n')[0]}...</div>
    </div>
    <span style="display:flex;align-items:center;"><svg xmlns="http://www.w3.org/2000/svg" height="20" width="20" viewBox="0 -960 960 960" fill="#C8C5D0"><path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h167q11-35 43-57.5t70-22.5q40 0 71.5 22.5T594-840h166q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560h-80v80q0 17-11.5 28.5T640-640H320q-17 0-28.5-11.5T280-680v-80h-80v560Zm308.5-571.5Q520-783 520-800t-11.5-28.5Q497-840 480-840t-28.5 11.5Q440-817 440-800t11.5 28.5Q463-760 480-760t28.5-11.5Z" /></svg></span>
  `;
  row.addEventListener('click', () => {
    const cur = codeInput.value;
    codeInput.value = cur + (cur && !cur.endsWith('\n') ? '\n' : '') + sn.code + '\n';
    updateHighlight();
    showSnack(`Inserted: ${sn.name}`);
    document.querySelector('[data-panel="editor"]').click();
  });
  snippetsList.appendChild(row);
});

let snackTimer;
function showSnack(msg) {
  snackbar.textContent = msg;
  snackbar.classList.add('show');
  clearTimeout(snackTimer);
  snackTimer = setTimeout(() => snackbar.classList.remove('show'), 2500);
}

document.addEventListener('mousedown', e => {
  if (!acBox.contains(e.target) && e.target !== codeInput) hideAC();
});
document.addEventListener('touchstart', e => {
  if (!acBox.contains(e.target) && e.target !== codeInput) hideAC();
}, { passive: true });

codeInput.value = '';
updateHighlight();

const savedTheme = localStorage.getItem('pypad-theme') || 'dark';
setTheme(savedTheme);

document.body.addEventListener('touchmove', e => {
  if (!codeInput.contains(e.target) && !outputEl.contains(e.target) && !e.target.closest('.settings-panel')) {
    e.preventDefault();
  }
}, { passive: false });

