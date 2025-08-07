// ===== Helpers =====
const inputEl = document.getElementById('line');
const historyEl = document.getElementById('history');
const statusEl = document.getElementById('status');
const enterBtn = document.getElementById('enter');

let lastResult = null;

// Insert text at cursor position
function insertAtCursor(text) {
  if (text === 'pi') text = 'π'; // display pretty, map later
  const start = inputEl.selectionStart ?? inputEl.value.length;
  const end = inputEl.selectionEnd ?? inputEl.value.length;
  inputEl.value = inputEl.value.slice(0, start) + text + inputEl.value.slice(end);
  const newPos = start + text.length;
  inputEl.setSelectionRange(newPos, newPos);
  inputEl.focus();
}

// Map display expression to JS-safe evaluation string
function mapForEval(expr) {
  return expr
    .replace(/π/g, 'Math.PI')
    .replace(/\^/g, '**')
    // percent: 50% -> (50/100)
    .replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');
}

// Basic sanitizer (digits, operators, parens, dot, spaces)
function sanitize(expr) {
  if (!/^[\d+\-*/.^()%\sπ]+$/.test(expr)) throw new Error('Invalid characters');
  return expr;
}

// Evaluate safely (no functions besides our mapped ones)
function evaluateExpression(expr) {
  const clean = sanitize(expr);
  const js = mapForEval(clean);
  // eslint-disable-next-line no-new-func
  const fn = new Function(`"use strict"; return (${js});`);
  const val = fn();
  if (!Number.isFinite(val)) throw new Error('Not a number');
  return val;
}

// Render a history line and bind click-to-insert on numbers
function addHistoryLine(expr, result) {
  const row = document.createElement('div');
  row.className = 'row';

  // Expression
  const exprSpan = document.createElement('div');
  exprSpan.className = 'expr';
  exprSpan.textContent = expr;
  row.appendChild(exprSpan);

  // Result (clickable number)
  const resSpan = document.createElement('div');
  resSpan.className = 'res';
  resSpan.textContent = result.toString();
  row.appendChild(resSpan);

  // Click any number token in either block to insert
  [exprSpan, resSpan].forEach(el => {
    el.addEventListener('click', (e) => {
      // If user taps anywhere, insert the nearest number token
      const text = e.target.textContent;
      // Try to find a number at click position; fallback to full number
      const m = text.match(/-?\d+(\.\d+)?/g);
      if (m && m.length) insertAtCursor(m[m.length - 1]); // last number
      else insertAtCursor(text);
      navigator.clipboard?.writeText(inputEl.value).catch(()=>{});
    });
  });

  historyEl.prepend(row);
}

// Handle = / Enter
function submitLine() {
  const expr = inputEl.value.trim();
  if (!expr) return;
  try {
    const val = evaluateExpression(expr);
    lastResult = val;
    addHistoryLine(expr, val);
    inputEl.value = ''; // move to next line
    statusEl.textContent = '';
  } catch (err) {
    statusEl.textContent = 'Error: ' + err.message;
  }
}

// ===== Bindings =====
enterBtn.addEventListener('click', submitLine);
inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    submitLine();
  }
});

document.querySelectorAll('.keypad button').forEach(btn => {
  btn.addEventListener('click', () => insertAtCursor(btn.dataset.key));
});

document.getElementById('btn-backspace').addEventListener('click', () => {
  const start = inputEl.selectionStart ?? inputEl.value.length;
  const end = inputEl.selectionEnd ?? inputEl.value.length;
  if (start === end && start > 0) {
    inputEl.value = inputEl.value.slice(0, start - 1) + inputEl.value.slice(end);
    inputEl.setSelectionRange(start - 1, start - 1);
  } else {
    inputEl.value = inputEl.value.slice(0, start) + inputEl.value.slice(end);
    inputEl.setSelectionRange(start, start);
  }
  inputEl.focus();
});

document.getElementById('btn-clear-line').addEventListener('click', () => {
  inputEl.value = '';
  inputEl.focus();
});

document.getElementById('btn-ans').addEventListener('click', () => {
  if (lastResult != null) insertAtCursor(String(lastResult));
  inputEl.focus();
});

// Clear history / Copy last result (if you already had these, keep them)
document.getElementById('btn-clear')?.addEventListener('click', () => {
  historyEl.innerHTML = '';
  lastResult = null;
});
document.getElementById('btn-copy-last')?.addEventListener('click', async () => {
  if (lastResult != null) {
    try { await navigator.clipboard.writeText(String(lastResult)); statusEl.textContent = 'Copied ✔'; }
    catch { statusEl.textContent = 'Copy failed'; }
  }
});

/*If you want to force users to only use the on-screen keypad on phones, you can make the input read‑only when a touch device is detected:
*/
if ('ontouchstart' in window) {
  inputEl.setAttribute('readonly', 'readonly'); // tap keypad to enter
}

