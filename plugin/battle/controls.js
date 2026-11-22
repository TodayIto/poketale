import { A1, PART_ICON } from '../../view/frame-parts.js';
import { pixelSvg } from '../../view/amie-art.js'; // pixels as an SVG (the bar's bigger triangles)

const PREV = PART_ICON.prev, NEXT = PART_ICON.next;

const CELL = 12, CELL_GAP = 2;
const CELL_ON = 'background:#4aa3e8; box-shadow:inset 0 2px 0 #9fd2f6;', CELL_EMPTY = '#cfd8df';

const BIG_ROWS = ['....o', '...oo', '..ooo', '.oooo', 'ooooo', '.oooo', '..ooo', '...oo', '....o'];
const BIG_PREV = pixelSvg(BIG_ROWS, { o: 'currentColor' }), BIG_NEXT = pixelSvg(BIG_ROWS.map(row => [...row].reverse().join('')), { o: 'currentColor' });
const ARROW_SPOT = 44;

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
  ${scope} .stb { display:flex; align-items:center; gap:2px; }
  ${scope} .stb .arr { position:relative; flex:none; width:22px; height:30px; padding:0; display:flex; align-items:center; justify-content:center; border:0; background:transparent;
    color:var(--navy); cursor:pointer; }
  ${scope} .stb .arr::after { content:""; position:absolute; left:50%; top:50%; width:${ARROW_SPOT}px; height:${ARROW_SPOT}px; transform:translate(-50%,-50%); }
  ${scope} .stb .arr svg { width:10px; height:18px; display:block; }
  ${scope} .stb .arr:disabled { opacity:.3; cursor:default; }
  ${scope} .stb .cells { flex:none; display:flex; gap:${CELL_GAP}px; padding:8px 1px; touch-action:pan-y; cursor:pointer; }
  ${scope} .stb .cells:focus { outline:none; }
  ${scope} .stb .cells:focus-visible { outline:2px solid #ffcf4a; outline-offset:-3px; }
  ${scope} .stb .cel { position:relative; flex:none; width:${CELL}px; height:${CELL}px; border:2px solid var(--navy); border-radius:0; background:${CELL_EMPTY}; }
  ${scope} .stb .cel.on { ${CELL_ON} }
  ${scope} .stb.off { opacity:.45; }
  ${scope} .stb.off .cells { cursor:default; }
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
  const place = v => list.findIndex(([id]) => id === v); // -1 = the typed place (after the list)
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

function steer(target, { min, max, step, pressed, dragged, control }) {
  let drag = null;
  const keys = { ArrowLeft: -step, ArrowDown: -step, ArrowRight: step, ArrowUp: step };
  target.addEventListener('keydown', e => {
    if (control.off()) return;
    const to = e.key === 'Home' ? min : e.key === 'End' ? max : e.key in keys ? control.now() + keys[e.key] : null;
    if (to === null) return;
    e.preventDefault();
    control.pick(to);
  });
  /** x on the target's box: 0..1, or null off it (then the end it is past) */
  const at = (x, read) => {
    const box = target.getBoundingClientRect();
    if (x < box.left) return min;
    if (x >= box.right) return max;
    return read((x - box.left) / box.width);
  };
  target.addEventListener('pointerdown', e => {
    if (control.off() || e.button !== 0) return;
    drag = e.pointerId;
    try { target.setPointerCapture?.(e.pointerId); } catch { /* the pointer is gone */ }
    control.show(at(e.clientX, pressed));
  });
  target.addEventListener('pointermove', e => { if (drag !== null && e.pointerId === drag) control.show(at(e.clientX, dragged)); });
  target.addEventListener('pointerup', e => { if (drag === null || e.pointerId !== drag) return; drag = null; control.pick(control.shown()); });
  target.addEventListener('pointercancel', () => { if (drag === null) return; drag = null; control.show(control.now()); });
  return { stop: () => { drag = null; } };
}
/** A value brought within min..max at the nearest step from min */
const stepWithin = (min, max, step) => v => Math.min(max, Math.max(min, min + Math.round((v - min) / step) * step));

export function stepBarControl({ min, max, step, value, label, change, words }) {
  const count = Math.round((max - min) / step);
  const el = make('span', 'stb');
  el.setAttribute('role', 'group'); el.setAttribute('aria-label', label);
  const prev = make('button', 'arr', { type: 'button', innerHTML: BIG_PREV }), next = make('button', 'arr', { type: 'button', innerHTML: BIG_NEXT });
  name(prev, words.prev); name(next, words.next);
  prev.setAttribute('tabindex', '-1'); next.setAttribute('tabindex', '-1'); // the keyboard steps the bar itself
  const bar = make('span', 'cells');
  bar.setAttribute('role', 'slider'); bar.setAttribute('aria-label', label); bar.setAttribute('aria-orientation', 'horizontal');
  bar.setAttribute('aria-valuemin', String(min)); bar.setAttribute('aria-valuemax', String(max));
  const cellValue = i => min + (i + 1) * step;
  const cells = Array.from({ length: count }, (_, i) => {
    const cell = make('span', 'cel');
    cell.onclick = () => { if (!off) pick(cellValue(i)); };
    bar.append(cell);
    return cell;
  });
  el.append(prev, bar, next);
  const within = stepWithin(min, max, step);
  let now = within(value), shown = now, off = false;
  const show = v => {
    shown = v;
    const k = (v - min) / step;
    cells.forEach((cell, i) => cell.classList.toggle('on', i < k));
    bar.setAttribute('aria-valuenow', String(v)); bar.setAttribute('aria-valuetext', String(v));
    prev.disabled = off || v <= min; next.disabled = off || v >= max;
  };
  const set = v => { now = within(v); show(now); };
  const pick = v => { const to = within(v); if (to === now) return show(now); set(to); change(to); };
  prev.onclick = () => pick(now - step);
  next.onclick = () => pick(now + step);
  const steering = steer(bar, { min, max, step, pressed: f => cellValue(Math.min(count - 1, Math.floor(f * count))), dragged: f => min + Math.round(f * count) * step,
    control: { now: () => now, shown: () => shown, off: () => off, show, pick } });
  const disable = on => {
    off = on; steering.stop();
    el.classList.toggle('off', on);
    bar.setAttribute('tabindex', on ? '-1' : '0'); bar.setAttribute('aria-disabled', String(on));
    show(now);
  };
  disable(false);
  return { el, set, disable };
}

const GEN_UP_ROWS = ['...o...', '..ooo..', '.ooooo.', 'ooooooo'];
const GEN_UP = pixelSvg(GEN_UP_ROWS, { o: 'currentColor' }), GEN_DOWN = pixelSvg([...GEN_UP_ROWS].reverse(), { o: 'currentColor' });

export const genSegmentCss = scope => `
  ${scope} .seg.gen-seg { align-items:center; }
  ${scope} .seg.gen-seg > button { padding:0 7px; }
  ${scope} .seg .gen { position:relative; flex:none; display:flex; flex-direction:column; align-items:stretch; min-width:48px; border-radius:7px; color:var(--navy-dark); }
  ${scope} .seg .gen .num { display:block; padding:0 6px; font-size:13px; line-height:15px; text-align:center; white-space:nowrap; pointer-events:none; }
  ${scope} .seg .gen .ga { position:relative; display:flex; align-items:center; justify-content:center; height:13px; min-height:0; padding:0; border:0; border-radius:0;
    background:transparent; color:inherit; cursor:pointer; }
  ${scope} .seg .gen .ga svg { display:block; width:10.5px; height:6px; }
  /* Wide spots to press: each arrow takes its half of the cell and more round it (the number between them is no button) */
  ${scope} .seg .gen .ga::after { content:""; position:absolute; left:-6px; right:-6px; top:-8px; bottom:-8px; height:auto; transform:none; }
  ${scope} .seg .gen[aria-checked="false"] .num, ${scope} .seg .gen[aria-checked="false"] .ga { opacity:.38; }
  ${scope} .seg .gen[aria-checked="false"]:not(.off):hover { background:#eef4f9; }
  ${scope} .seg .gen[aria-checked="false"]:not(.off):hover .ga { opacity:.7; }
  ${scope} .seg .gen[aria-checked="true"] { background:linear-gradient(#ec5a64,#d8434d); color:#fff; box-shadow:0 1.5px 0 var(--red-dark); }
  ${scope} .seg .gen[aria-checked="true"].off { background:#c3cfd8; box-shadow:none; }
  ${scope} .seg .gen .ga:not(:disabled):active svg { transform:translateY(1px); }
  ${scope} .seg .gen.off { color:#a9b5be; }
  ${scope} .seg .gen[aria-checked="true"].off { color:#fff; }
  ${scope} .seg .gen .ga:disabled { cursor:default; }`;

export function genSegmentControl({ list, gens, value, label, change, words }) {
  const el = make('span', 'seg gen-seg');
  el.setAttribute('role', 'radiogroup'); el.setAttribute('aria-label', label);
  const isGen = v => gens.includes(v);
  let now = value, number = isGen(value) ? value : gens[0], off = false;
  const buttons = list.map(([v, text]) => {
    const b = make('button', '', { type: 'button', textContent: text });
    b.setAttribute('role', 'radio'); b.dataset.id = String(v);
    b.onclick = () => { if (now !== v) { set(v); change(v); } };
    el.append(b);
    return [v, b];
  });
  const cell = make('span', 'gen');
  cell.setAttribute('role', 'radio'); cell.dataset.id = 'gen';
  const up = make('button', 'ga up', { type: 'button', innerHTML: GEN_UP }), down = make('button', 'ga down', { type: 'button', innerHTML: GEN_DOWN });
  const num = make('span', 'num');
  name(up, words.up); name(down, words.down);
  cell.append(up, num, down);
  el.append(cell);
  const step = by => gens[(gens.indexOf(number) + by + gens.length) % gens.length];

  const press = by => { if (off) return; set(isGen(now) ? step(by) : number); change(now); };
  up.onclick = () => press(1);
  down.onclick = () => press(-1);
  function set(v) {
    now = v;
    if (isGen(v)) number = v;
    for (const [id, b] of buttons) b.setAttribute('aria-checked', String(id === v));
    cell.setAttribute('aria-checked', String(isGen(v)));
    num.textContent = words.gen(number);
    cell.setAttribute('aria-label', `${label}: ${words.gen(number)}`);
  }
  const disable = on => { off = on; for (const [, b] of buttons) b.disabled = on; up.disabled = down.disabled = on; cell.classList.toggle('off', on); };
  set(value);
  return { el, set, disable };
}
