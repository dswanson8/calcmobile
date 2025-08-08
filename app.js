  /* Multi‑Line Calculator logic (history + click‑to‑insert + offline cache) */
  const $ = (sel) => document.querySelector(sel);
  const historyEl = $('#history');
  const inputEl = $('#line');
  const statusEl = $('#status');
  
  let history = JSON.parse(localStorage.getItem('mlc_history') || '[]');
  render();
  
  // Suppress mobile soft keyboard on touch devices (use our virtual keypad)
  // On touch devices, suppress the mobile keyboard (use our keypad)
  if ('ontouchstart' in window) {
  document.getElementById('line').setAttribute('readonly', 'readonly');
  }
  
  document.querySelectorAll('.numpad .key').forEach(btn => {
  btn.addEventListener('click', () => {
    const k = btn.dataset.key;
    const inputEl = document.getElementById('line');
  
    if (k === 'Enter') {
      document.getElementById('enter').click();
      return;
    }
    if (k === 'CE') { // Clear the current input line
      inputEl.value = '';
      inputEl.focus();
      return;
    }
    if (k === 'BACK') { // Backspace
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
      return;
    }
  
    // Default: insert the key text
    insertAtCursor(k);
  });
  });
  
  
  
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
  
  
