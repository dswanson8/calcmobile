/* Multi‑Line Calculator logic (history + click‑to‑insert + offline cache) */
const $ = (sel) => document.querySelector(sel);
const historyEl = $('#history');
const inputEl = $('#line');
const statusEl = $('#status');

let history = JSON.parse(localStorage.getItem('mlc_history') || '[]');
render();

$('#enter').addEventListener('click', evaluateLine);
inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); evaluateLine(); }
});

$('#btn-clear').addEventListener('click', () => {
  history = [];
  localStorage.removeItem('mlc_history');
  render();
});

$('#btn-copy-last').addEventListener('click', async () => {
  if (!history.length) return;
  const last = history[history.length - 1].result;
  insertAtCursor(String(last));
  try { await navigator.clipboard.writeText(String(last)); flashStatus('Copied last result'); } catch {}
});

function evaluateLine(){
  const raw = inputEl.value.trim();
  if (!raw) return;
  try {
    const prepared = prepare(raw);
    const value = Function(`"use strict"; return (${prepared})`)();
    const result = fixFloat(value);
    history.push({ expr: raw, result });
    localStorage.setItem('mlc_history', JSON.stringify(history));
    inputEl.value = '';
    render(true);
  } catch (err) {
    flashStatus('Invalid expression');
  }
}

function render(scroll = false){
  if (!history.length) { historyEl.innerHTML = `<div class="empty">No calculations yet.</div>`; return; }
  historyEl.innerHTML = history.map((row, i) => `
    <div class="row" data-idx="${i}">
      <div class="expr">${highlightNumbers(escapeHtml(row.expr))}</div>
      <div class="result">= <span class="clickable" data-val="${row.result}">${row.result}</span></div>
    </div>
  `).join('');
  // Delegate clicks on any .clickable number
  historyEl.querySelectorAll('.clickable').forEach(el => {
    el.addEventListener('click', (e) => {
      const val = e.currentTarget.getAttribute('data-val');
      insertAtCursor(val);
      navigator.clipboard?.writeText(String(val)).catch(()=>{});
      flashStatus(`Inserted ${val}`);
    });
  });
  if (scroll) historyEl.scrollTop = historyEl.scrollHeight;
}

function insertAtCursor(text){
  const start = inputEl.selectionStart ?? inputEl.value.length;
  const end = inputEl.selectionEnd ?? inputEl.value.length;
  inputEl.setRangeText(text, start, end, 'end');
  inputEl.focus();
}

function fixFloat(n){
  const rounded = Math.round((n + Number.EPSILON) * 1e12) / 1e12; // up to 12 dp for display
  return Number(rounded.toString());
}

// Replace user input with safe JS using Math.* and operators
function prepare(s){
  // Basic allow‑list: digits, operators, dots, commas, spaces, parentheses, letters for allowed fn/const
  if (/[^0-9+\-*/%^().,\sA-Za-z]/.test(s)) throw new Error('bad');
  // Normalize: unicode minus, multiply, divide → ASCII
  s = s.replace(/[−–]/g,'-').replace(/[×x]/gi,'*').replace(/[÷]/g,'/');
  // Percent: 50% → (50/100)
  s = s.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');
  // Power: a^b → (a**b)
  s = s.replace(/\^/g, '**');
  // Constants and functions mapping
  const map = {
    '\\bpi\\b':'Math.PI', '\\be\\b':'Math.E',
    '\\bsqrt\\b':'Math.sqrt', '\\bsin\\b':'Math.sin', '\\bcos\\b':'Math.cos', '\\btan\\b':'Math.tan',
    '\\blog10\\b':'Math.log10', '\\blog\\b':'Math.log10', '\\bln\\b':'Math.log'
  };
  for (const [k,v] of Object.entries(map)) s = s.replace(new RegExp(k,'g'), v);
  // Disallow any other identifiers
  const leftoverId = s.match(/[A-Za-z_]\w*/g);
  if (leftoverId && leftoverId.some(id => !/^Math$/.test(id))) throw new Error('id');
  return s;
}

function highlightNumbers(html){
  // Wrap standalone numbers with clickable spans
  return html.replace(/(?<![A-Za-z_])(\d+(?:\.\d+)?)(?![A-Za-z_])/g, '<span class="clickable" data-val="$1">$1<\/span>');
}

function escapeHtml(s){
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
}

function flashStatus(msg){
  statusEl.textContent = msg;
  clearTimeout(flashStatus._t);
  flashStatus._t = setTimeout(()=> statusEl.textContent = '', 1600);
}

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

