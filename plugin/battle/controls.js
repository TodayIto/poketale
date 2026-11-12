import { A1, PART_ICON } from '../../view/frame-parts.js';

const PREV = PART_ICON.prev, NEXT = PART_ICON.next;

const KNOB = 24, KNOB_PHONE = 30;
const SLIDER_GROOVE = 'linear-gradient(90deg,transparent calc(50% - 1px),#789db7 calc(50% - 1px) calc(50% + 1px),transparent calc(50% + 1px)),#dfeaf3';

export const controlsCss = scope => `
  ${scope} .sw { position:relative; flex:none; width:44px; height:26px; padding:0; border:2px solid #7d93a4; border-radius:13px; background:#c3cfd8; cursor:pointer; }
  ${scope} .sw::before { content:""; position:absolute; top:2px; left:2px; width:18px; height:18px; border-radius:50%; background:#fff; box-shadow:0 1.5px 0 rgba(0,0,0,.25); transition:left .15s; }
  ${scope} .sw::after { content:""; position:absolute; left:50%; top:50%; width:52px; height:40px; transform:translate(-50%,-50%); }
  ${scope} .sw[aria-checked="true"] { border-color:#1f6e4e; background:#2f9a6e; }
  ${scope} .sw[aria-checked="true"]::before { left:20px; }
  ${scope} .sw:disabled { opacity:.45; cursor:default; }
  ${scope} .step { display:flex; align-items:center; gap:4px; }
  ${scope} .step .arr { position:relative; flex:none; width:30px; height:30px; padding:0; display:flex; align-items:center; justify-content:center;
    border:${A1.border}px solid var(--navy-dark); border-radius:${A1.radius}px; background:${A1.paper}; color:var(--navy-dark); box-shadow:${A1.drop}; cursor:pointer; }
  ${scope} .step .arr::after { content:""; position:absolute; inset:-6px; }
  ${scope} .step .arr svg { width:6px; height:11px; display:block; }
  ${scope} .step .arr:not(:disabled):active { transform:translateY(2px); box-shadow:${A1.pressed}; }
  ${scope} .step .arr:disabled { opacity:.45; box-shadow:none; cursor:default; }
  ${scope} .step .val { min-width:76px; padding:0 2px; border:0; background:transparent; color:#14304a; font-size:14px; text-align:center; white-space:nowrap; }
  ${scope} button.val { cursor:pointer; text-decoration:underline dotted #789db7; text-underline-offset:4px; }
  ${scope} .step.off .val { color:#9aaab7; }
  ${scope} .seg { display:inline-flex; flex-wrap:nowrap; padding:2px; gap:2px; border:1.5px solid #789db7; border-radius:9px; background:#dfeaf3; box-shadow:inset 0 1.5px 0 rgba(0,0,0,.08); }
  ${scope} .seg button { position:relative; min-height:28px; padding:0 9px; border:0; border-radius:7px; background:transparent; color:var(--navy-dark); font-size:13px; white-space:nowrap; cursor:pointer; }
  ${scope} .seg button::after { content:""; position:absolute; left:0; right:0; top:50%; height:40px; transform:translateY(-50%); }
  ${scope} .seg button[aria-checked="false"]:not(:disabled):hover { background:#eef4f9; }
  ${scope} .seg button[aria-checked="true"] { background:linear-gradient(#ec5a64,#d8434d); color:#fff; box-shadow:0 1.5px 0 var(--red-dark); }
  ${scope} .seg button:disabled { color:#a9b5be; cursor:default; }
  ${scope} .seg button[aria-checked="true"]:disabled { background:#c3cfd8; color:#fff; box-shadow:none; }
  ${scope} .sld { display:flex; align-items:center; gap:5px; }
  ${scope} .sld .end { flex:none; font-size:12px; color:#5d7486; white-space:nowrap; }
  ${scope} .sld input { flex:none; width:118px; height:40px; margin:0; padding:0; background:transparent; -webkit-appearance:none; appearance:none; cursor:pointer; }
  ${scope} .sld input:focus { outline:none; }
  ${scope} .sld input::-webkit-slider-runnable-track { height:8px; border:1.5px solid #789db7; border-radius:5px; background:${SLIDER_GROOVE}; }
  ${scope} .sld input::-moz-range-track { height:8px; border:1.5px solid #789db7; border-radius:5px; background:${SLIDER_GROOVE}; }
  ${scope} .sld input::-webkit-slider-thumb { -webkit-appearance:none; appearance:none; width:${KNOB}px; height:${KNOB}px; margin-top:${(8 - KNOB) / 2 - 1.5}px;
    border:${A1.border}px solid var(--navy-dark); border-radius:${A1.radius}px; background:${A1.paper}; box-shadow:${A1.drop}; }
  ${scope} .sld input::-moz-range-thumb { box-sizing:border-box; width:${KNOB}px; height:${KNOB}px; border:${A1.border}px solid var(--navy-dark); border-radius:${A1.radius}px; background:${A1.paper}; box-shadow:${A1.drop}; }
  ${scope} .sld input:focus-visible::-webkit-slider-thumb { outline:2px solid #ffcf4a; }
  ${scope} .sld .fld { position:relative; flex:none; min-width:50px; height:30px; padding:0 6px; border:2px solid #789db7; border-radius:7px; background:#fff; color:#14304a;
    font-size:14px; text-align:center; box-shadow:inset 0 1.5px 0 rgba(0,0,0,.08); cursor:pointer; }
  ${scope} .sld .fld::after { content:""; position:absolute; left:0; right:0; top:50%; height:40px; transform:translateY(-50%); }
  ${scope} .sld.off { opacity:.45; }
  @media (max-width:640px) { ${scope} .sld input { width:104px; height:44px; }
    ${scope} .sld input::-webkit-slider-thumb { width:${KNOB_PHONE}px; height:${KNOB_PHONE}px; margin-top:${(8 - KNOB_PHONE) / 2 - 1.5}px; }
    ${scope} .sld input::-moz-range-thumb { width:${KNOB_PHONE}px; height:${KNOB_PHONE}px; } }
  @media (prefers-reduced-motion:reduce) { ${scope} .sw::before { transition:none; } }`;

const make = (tag, className, props = {}) => Object.assign(document.createElement(tag), { className, ...props });
const name = (el, label) => { el.setAttribute('aria-label', label); el.title = label; };

export function switchControl({ value, label, change, words }) {
  const el = make('button', 'sw', { type: 'button' });
  el.setAttribute('role', 'switch'); el.setAttribute('aria-label', label);
  let now = !!value;
  const set = v => { now = !!v; el.setAttribute('aria-checked', String(now)); el.title = now ? words.on : words.off; };
  el.onclick = () => { set(!now); change(now); };
  set(now);
  return { el, set, disable: off => { el.disabled = off; } };
}

export function segmentControl({ list, value, label, change, disabled = new Map() }) {
  const el = make('span', 'seg');
  el.setAttribute('role', 'radiogroup'); el.setAttribute('aria-label', label);
  let off = false;
  const buttons = list.map(([v, text]) => {
    const b = make('button', '', { type: 'button', textContent: text });
    b.setAttribute('role', 'radio'); b.dataset.id = String(v);
    if (disabled.has(v)) b.title = disabled.get(v);
    b.onclick = () => { if (now !== v) { set(v); change(v); } };
    el.append(b);
    return [v, b];
  });
  let now = value;
  const set = v => { now = v; for (const [id, b] of buttons) b.setAttribute('aria-checked', String(id === v)); };
  const draw = () => { for (const [id, b] of buttons) b.disabled = off || disabled.has(id); };
  set(value); draw();
  return { el, set, disable: on => { off = on; draw(); } };
}

export function stepperControl({ list, value, label, change, words, typed = null }) {
  const el = make('span', 'step');
  el.setAttribute('role', 'group'); el.setAttribute('aria-label', label);
  const prev = make('button', 'arr', { type: 'button', innerHTML: PREV }), next = make('button', 'arr', { type: 'button', innerHTML: NEXT });
  name(prev, words.prev); name(next, words.next);
  const shown = make('span', 'val'), edit = make('button', 'val', { type: 'button' });
  el.setAttribute('aria-live', 'polite');
  el.append(prev, shown, edit, next);
  let now = value, off = false;
  const place = v => list.findIndex(([id]) => id === v);
  const last = typed ? list.length : list.length - 1;
  const at = () => { const i = place(now); return i < 0 ? list.length : i; };
  const set = v => {
    now = v;
    const i = at(), isTyped = i === list.length;
    shown.textContent = isTyped ? '' : list[i][1];
    edit.textContent = isTyped ? `${typed.unset} ${typed.label(v)}` : '';
    shown.hidden = isTyped; edit.hidden = !isTyped;
    if (isTyped) name(edit, `${label}: ${typed.unset}`);
    prev.disabled = off || i === 0; next.disabled = off || i >= last;
    el.classList.toggle('off', off);
  };
  const pick = v => { set(v); change(v); };
  const ask = () => typed.ask(at() === list.length ? now : null, v => { if (v !== null && v !== undefined) pick(v); });
  prev.onclick = () => { const i = at(); if (i > 0) pick(list[i - 1][0]); };
  next.onclick = () => { const i = at(); if (i + 1 < list.length) pick(list[i + 1][0]); else if (typed && i + 1 === list.length) ask(); };
  edit.onclick = () => { if (!off) ask(); };
  set(value);
  return { el, set, disable: on => { off = on; edit.disabled = on; set(now); } };
}

export const signed = n => (n > 0 ? `+${n}` : n < 0 ? `\u2212${-n}` : '0');

export function sliderControl({ min, max, value, label, change, words, ask }) {
  const el = make('span', 'sld');
  el.setAttribute('role', 'group'); el.setAttribute('aria-label', label);
  const low = make('span', 'end', { textContent: words.low }), high = make('span', 'end', { textContent: words.high });
  const range = make('input', '', { type: 'range' });
  Object.assign(range, { min: String(min), max: String(max), step: '1' });
  range.setAttribute('aria-label', label);
  const box = make('button', 'fld', { type: 'button' });
  name(box, `${label}: ${words.type}`);
  el.append(low, range, high, box);
  const within = v => Math.min(max, Math.max(min, Math.round(v)));
  let now = within(value), off = false;
  const show = v => { range.value = String(v); box.textContent = signed(v); range.setAttribute('aria-valuetext', signed(v)); };
  const set = v => { now = within(v); show(now); };
  const pick = v => { const next = within(v); if (next === now) return show(now); set(next); change(next); };
  range.oninput = () => show(within(Number(range.value)));
  range.onchange = () => pick(Number(range.value));
  box.onclick = () => { if (!off) ask(now, v => { if (Number.isFinite(v)) pick(v); }); };
  set(now);
  return { el, set, disable: on => { off = on; range.disabled = on; box.disabled = on; el.classList.toggle('off', on); } };
}
