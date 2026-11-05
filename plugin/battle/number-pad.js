// Touch number pad for numeric settings.
const KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', 'delete'];

export function padText(text, key, { ints, decimals }) {
  if (key === 'delete') return text.slice(0, -1);
  if (key === '.') return decimals && !text.includes('.') ? `${text || '0'}.` : text;
  if (!/^\d$/.test(key)) return text;
  if (text === '0') return key;
  const [int, decimal] = text.split('.');
  return (decimal === undefined ? int.length < ints : decimal.length < decimals) ? text + key : text;
}

const keyOf = key => (/^\d$/.test(key) || key === '.' ? key : key === 'Backspace' || key === 'Delete' ? 'delete' : null);

export const numberPadCss = scope => `
  ${scope} .npad { position:absolute; inset:0; z-index:5; display:flex; flex-direction:column; justify-content:flex-end; background:rgba(15,24,34,.45); border-radius:inherit; }
  ${scope} .npad .sheet { display:flex; flex-direction:column; gap:8px; padding:10px 12px 12px; border-top:2.5px solid var(--navy); border-radius:12px 12px 0 0; background:var(--paper);
    box-shadow:0 -3px 0 rgba(35,67,95,.25); }
  ${scope} .npad .top { display:flex; align-items:baseline; justify-content:space-between; gap:8px; font-size:13px; color:#23435f; }
  ${scope} .npad .range { font-size:12px; color:#7d93a5; }
  ${scope} .npad .shown { display:flex; align-items:center; justify-content:flex-end; height:46px; padding:0 12px; border:2px solid var(--navy); border-radius:9px; background:#fff;
    box-shadow:inset 0 0 0 2px #dbe8f2; font-size:24px; color:var(--ink); }
  ${scope} .npad .shown .caret { width:2px; height:26px; margin-left:2px; background:var(--red); animation:pkb-npad-blink 1s steps(2) infinite; }
  ${scope} .npad .shown .empty { color:#b3c3cf; }
  ${scope} .npad .keys { display:grid; grid-template-columns:repeat(3, 1fr); gap:6px; }
  ${scope} .npad button { height:46px; padding:0; display:flex; align-items:center; justify-content:center; font-size:20px; border:2px solid var(--navy); border-radius:9px;
    background:#fff; color:var(--navy-dark); box-shadow:0 3px 0 var(--navy-dark); cursor:pointer; touch-action:manipulation; -webkit-tap-highlight-color:transparent; user-select:none; }
  ${scope} .npad button:not(:disabled):active { transform:translateY(2px); box-shadow:0 1px 0 var(--navy-dark); }
  ${scope} .npad button svg { width:22px; height:22px; display:block; }
  ${scope} .npad .row2 { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:2px; }
  ${scope} .npad .row2 button { font-size:15px; }
  ${scope} .npad .row2 .ok { border-color:var(--red-dark); background:var(--red-fill); color:#fff; box-shadow:0 3px 0 var(--red-dark); text-shadow:0 1px 0 #0004; }
  ${scope} .npad .row2 .ok:disabled { opacity:.45; cursor:default; }
  @keyframes pkb-npad-blink { 50% { opacity:0; } }
  @media (prefers-reduced-motion:reduce) { ${scope} .npad .shown .caret { animation:none; } }
  @media (max-width:640px) { ${scope} .npad button { height:52px; } }`;

const DELETE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5h11v14H9l-6-7z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>'
  + '<path d="M12 9.5l5 5M17 9.5l-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

export function openNumberPad({ parent, title, range = '', format = text => text, text = '', digits, accepts, words, onConfirm = () => {}, onCancel = () => {} }) {
  const pad = document.createElement('div'); pad.className = 'npad'; pad.setAttribute('role', 'dialog'); pad.setAttribute('aria-label', title); pad.tabIndex = -1;
  const sheet = document.createElement('div'); sheet.className = 'sheet';
  const top = document.createElement('div'); top.className = 'top';
  const name = document.createElement('span'); name.textContent = title;
  const hint = document.createElement('span'); hint.className = 'range'; hint.textContent = range;
  top.append(name, hint);
  const shown = document.createElement('div'); shown.className = 'shown'; shown.setAttribute('aria-live', 'polite');
  const keys = document.createElement('div'); keys.className = 'keys';
  const button = (label, press, className = '') => {
    const b = document.createElement('button'); b.type = 'button'; b.className = className; b.textContent = label; b.onclick = press; return b;
  };
  for (const key of KEYS) {
    const b = button(key === 'delete' ? '' : key, () => type(key));
    if (key === 'delete') { b.innerHTML = DELETE_ICON; b.setAttribute('aria-label', words.delete); b.title = words.delete; }
    keys.append(b);
  }
  const ok = button(words.ok, () => confirm(), 'ok');
  const row = document.createElement('div'); row.className = 'row2';
  row.append(button(words.cancel, () => finish(onCancel)), ok);
  sheet.append(top, shown, keys, row);
  pad.append(sheet);

  const draw = () => {
    const typed = document.createElement('span'); typed.textContent = format(text);
    if (!text) typed.className = 'empty';
    const caret = document.createElement('span'); caret.className = 'caret';
    shown.replaceChildren(typed, caret);
    ok.disabled = !accepts(text);
  };
  const type = key => { text = padText(text, key, digits); draw(); };
  const confirm = () => { if (accepts(text)) finish(() => onConfirm(text)); };

  const covered = [...parent.children];
  const before = covered.map(el => el.inert);
  let done = false;
  function finish(then) {
    if (done) return;
    done = true;
    pad.remove();
    covered.forEach((el, i) => { el.inert = before[i]; });
    then();
  }
  pad.addEventListener('keydown', e => {
    const key = keyOf(e.key);
    if (key) type(key);
    else if (e.key === 'Enter') confirm();
    else if (e.key === 'Escape') finish(onCancel);
    else return;
    e.preventDefault(); e.stopPropagation();
  });
  pad.addEventListener('pointerdown', e => { if (e.target === pad) finish(onCancel); });
  for (const el of covered) el.inert = true;
  parent.append(pad);
  draw();
  pad.focus();
  return { close: () => finish(onCancel) };
}
