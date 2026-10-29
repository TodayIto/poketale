export const PHONE_SIZES = Object.freeze({ tap: Object.freeze([44, 60]), tapShare: 0.1, bandRoom: 4, sideRoom: 20, pad: 210, minScreen: 160, bandSpan: 6,
  cell: Object.freeze([40, 80]), lift: Object.freeze([16, 56]), liftShare: 0.05, edge: Object.freeze([14, 64]), edgeShare: 0.06 });

export const PAD_CELLS = Object.freeze({ across: 7.2, down: 3.9 });

// Whether this is a phone (touch-only device). Devices with a mouse, or without matchMedia, are PC
export function isPhone(win = globalThis) {
  try { return !!win.matchMedia?.('(hover: none) and (pointer: coarse)').matches; } catch { return false; }
}

export const layoutOf = ({ phone = false } = {}) => (phone ? 'portrait' : 'desktop');

const clamp = (value, [min, max]) => Math.min(max, Math.max(min, value));

export function phoneLayout({ width, height, layout, band: hasBand = true, sizes = PHONE_SIZES }) {
  const w = Math.max(0, width || 0), h = Math.max(0, height || 0);
  const portrait = layout === 'portrait';
  const tap = clamp(Math.round(Math.min(w, h) * sizes.tapShare), sizes.tap);
  const band = portrait && hasBand ? tap + sizes.bandRoom : 0, side = tap + sizes.sideRoom;
  let screen = portrait ? Math.min(w, (h - band - sizes.pad) * 16 / 9) : Math.min(w - 2 * side, h * 16 / 9);
  screen = Math.max(Math.min(band ? Math.max(sizes.minScreen, sizes.bandSpan * tap) : sizes.minScreen, w), Math.floor(screen));
  const padHeight = portrait ? Math.floor(Math.max(0, h - band - screen * 9 / 16)) : 0;
  const lift = portrait ? clamp(Math.round(h * sizes.liftShare), sizes.lift) : 0;
  const edge = portrait ? clamp(Math.round(w * sizes.edgeShare), sizes.edge) : 0;
  const cell = portrait ? Math.floor(clamp(Math.min(w / PAD_CELLS.across, (padHeight - lift) / PAD_CELLS.down), sizes.cell)) : 0;
  return { tap, band, side, screen, padHeight, cell, lift, edge };
}

// CSS properties followPhoneLayout writes on the root (PHONE_CSS reads them)
const SIZE_VARS = Object.freeze({ tap: '--tap', band: '--band', side: '--side', screen: '--screen-w', cell: '--cell', lift: '--lift', edge: '--edge' });

function followPhoneLayout(root, layout, { band = true, sizes = PHONE_SIZES } = {}) {
  const apply = () => {
    const style = getComputedStyle(root), px = name => parseFloat(style[name]) || 0;
    const size = phoneLayout({ width: root.clientWidth - px('paddingLeft') - px('paddingRight'),
      height: root.clientHeight - px('paddingTop') - px('paddingBottom'), layout, band, sizes });
    for (const [key, name] of Object.entries(SIZE_VARS)) root.style.setProperty(name, `${size[key]}px`);
  };
  apply();
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(apply) : null;
  observer?.observe(root);
  addEventListener('resize', apply);
  return () => {
    observer?.disconnect();
    removeEventListener('resize', apply);
    for (const name of Object.values(SIZE_VARS)) root.style.removeProperty(name);
  };
}

export function mountPhoneLayout(root, layout, { press, band = true, left = [], right = [], screen = null, onScreen = [] }) {
  const undo = [];
  root.classList.add(`pkb-${layout}`);
  undo.push(() => root.classList.remove(`pkb-${layout}`));
  const move = (element, parent) => {
    const mark = document.createComment('');
    element.replaceWith(mark);
    parent.append(element);
    undo.push(() => mark.replaceWith(element));
  };
  if (layout === 'portrait') {
    const pad = mountPad(root, press);
    undo.push(() => pad.remove());
  }
  if (layout === 'landscape') {
    const column = where => Object.assign(document.createElement('div'), { className: `side ${where}` });
    const leftColumn = column('left'), rightColumn = column('right');
    root.prepend(leftColumn);
    root.append(rightColumn);
    undo.push(() => { leftColumn.remove(); rightColumn.remove(); });
    for (const item of left) move(item, leftColumn);
    const back = Object.assign(document.createElement('button'), { type: 'button', className: 'back', innerHTML: BACK_ICON, title: '뒤로', tabIndex: -1 });
    back.setAttribute('aria-label', '뒤로');
    bindPress(back, () => press('b'));
    leftColumn.append(Object.assign(document.createElement('span'), { className: 'grow' }), back);
    for (const item of right) move(item, rightColumn);
    for (const item of onScreen) move(item, screen);
  }
  if (layout !== 'desktop') {
    undo.push(followPhoneLayout(root, layout, { band }));

    const touch = () => {};
    root.addEventListener('touchstart', touch, { passive: true });
    undo.push(() => root.removeEventListener('touchstart', touch));
  }
  return () => { for (const step of undo.reverse()) step(); };
}

export const PAD_BUTTONS = Object.freeze([['up', '위'], ['left', '왼쪽'], ['right', '오른쪽'], ['down', '아래'], ['b', 'B'], ['a', 'A']]);

const ARROW = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 3.2 13.4 11H2.6z"/></svg>';
const BACK_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6.2 3.6 2.6 7.2l3.6 3.6M3 7.2h6.4a3.6 3.6 0 0 1 0 7.2H7.6" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export function choiceCursor(buttons, onBack = () => {}) {
  let picked = 0;
  function select(index, focus = true) {
    picked = Math.max(0, Math.min(buttons.length - 1, index));
    buttons.forEach((button, i) => {
      if (i === picked) button.classList.add('pkb-picked'); else button.classList.remove('pkb-picked');
    });
    if (focus) buttons[picked]?.focus({ preventScroll: true });
  }
  buttons.forEach((button, i) => button.addEventListener('focus', () => select(i, false)));
  return { select, press(key) {
    if (key === 'b') return onBack();
    if (key === 'a') return buttons[picked]?.click();
    if (key === 'left' || key === 'up') select(picked - 1);
    else if (key === 'right' || key === 'down') select(picked + 1);
  } };
}

export function bindPress(button, fire) {
  const release = () => button.classList.remove('held');
  button.addEventListener('pointerdown', event => {
    if (event.button > 0) return;
    event.preventDefault();
    try { button.setPointerCapture?.(event.pointerId); } catch {                        }
    button.classList.add('held');
    fire();
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, release);
  button.addEventListener('click', event => { if (event.detail === 0) fire(); });
  button.addEventListener('contextmenu', event => event.preventDefault());
}

function mountPad(parent, press) {
  const pad = document.createElement('div');
  pad.className = 'pad';
  pad.innerHTML = `<div class="dpad">${PAD_BUTTONS.slice(0, 4).map(([key, label]) =>
    `<button type="button" tabindex="-1" class="${key}" data-key="${key}" aria-label="${label}">${ARROW}</button>`).join('')}<span class="hub"></span></div>
    <div class="ab">${PAD_BUTTONS.slice(4).map(([key, label]) =>
    `<button type="button" tabindex="-1" class="${key}" data-key="${key}" aria-label="${label}">${label}</button>`).join('')}</div>`;
  for (const button of pad.querySelectorAll('button')) bindPress(button, () => press(button.dataset.key));
  parent.append(pad);
  return pad;
}

export const PHONE_CSS = `
  .poke-battle.pkb-portrait, .poke-battle.pkb-landscape { touch-action:manipulation; -webkit-tap-highlight-color:transparent; user-select:none; -webkit-user-select:none;
    padding:env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px); }
  .poke-battle.pkb-portrait button, .poke-battle.pkb-landscape button { touch-action:manipulation; }
  .poke-battle.pkb-portrait { flex-direction:column; align-items:center; }
  .poke-battle.pkb-portrait .frame, .poke-battle.pkb-landscape .frame { width:var(--screen-w); }
  /* Band and side buttons: tap wide, tap - 6 tall; the hit area (::before) reaches tap tall */
  .poke-battle.pkb-portrait .band button, .poke-battle.pkb-landscape .side button { position:relative; width:var(--tap); height:calc(var(--tap) - 6px); border-radius:9px; }
  .poke-battle.pkb-portrait .band button::before, .poke-battle.pkb-landscape .side button::before { content:''; position:absolute; inset:-5px -2px; }
  .poke-battle.pkb-portrait .band button svg, .poke-battle.pkb-landscape .side button svg { width:calc(var(--tap) * .41); height:calc(var(--tap) * .41); }
  .poke-battle.pkb-portrait .band .leave svg, .poke-battle.pkb-landscape .side .leave svg { width:calc(var(--tap) * .34); height:calc(var(--tap) * .34); }
  /* End screen: buttons at least a finger tall; result line, buttons and hint stacked with even space between (never overlapping on a small view) */
  .poke-battle.pkb-portrait .end button, .poke-battle.pkb-landscape .end button { min-height:clamp(var(--tap), 6.2cqw, 58px); }
  .poke-battle.pkb-portrait .end:not([hidden]), .poke-battle.pkb-landscape .end:not([hidden]) { display:flex; flex-direction:column; align-items:center; justify-content:space-evenly; }
  .poke-battle.pkb-portrait .end .word, .poke-battle.pkb-landscape .end .word, .poke-battle.pkb-portrait .end .hint, .poke-battle.pkb-landscape .end .hint,
  .poke-battle.pkb-portrait .end .btns, .poke-battle.pkb-landscape .end .btns { position:static; transform:none; }
  .poke-battle.pkb-portrait .end .word, .poke-battle.pkb-landscape .end .word { align-self:stretch; }
  /* Portrait pad: at the bottom, --lift above the window bottom (the space up to the battle screen stays empty).
     Spans the window width: D-pad --edge from the left side, A/B --edge from the right side */
  .poke-battle .pad { flex:none; margin:auto 0 var(--lift); width:100%; display:flex; align-items:center; justify-content:space-between;
    padding:0 var(--edge); touch-action:none; }
  .poke-battle[data-mode="preparing"] .pad, .poke-battle[data-mode="error"] .pad { opacity:.45; }
  .poke-battle .pad button { touch-action:none; -webkit-touch-callout:none; padding:0; font:inherit; cursor:pointer; }
  .poke-battle .pad .dpad { display:grid; grid-template-columns:repeat(3, var(--cell)); grid-template-rows:repeat(3, var(--cell)); gap:3px; }
  .poke-battle .pad .dpad button { display:flex; align-items:center; justify-content:center; border:2.5px solid var(--navy); border-radius:10px;
    background:var(--paper); color:var(--navy); box-shadow:0 4px 0 var(--navy-dark); }
  .poke-battle .pad .dpad svg { width:44%; height:44%; display:block; }
  .poke-battle .pad .up { grid-area:1 / 2; }
  .poke-battle .pad .left { grid-area:2 / 1; } .poke-battle .pad .left svg { transform:rotate(-90deg); }
  .poke-battle .pad .right { grid-area:2 / 3; } .poke-battle .pad .right svg { transform:rotate(90deg); }
  .poke-battle .pad .down { grid-area:3 / 2; } .poke-battle .pad .down svg { transform:rotate(180deg); }
  .poke-battle .pad .hub { grid-area:2 / 2; place-self:center; width:34%; height:34%; border-radius:50%; background:var(--navy); opacity:.35; }
  .poke-battle .pad .ab { position:relative; width:calc(var(--cell) * 2.7); height:calc(var(--cell) * 2.2); }
  .poke-battle .pad .ab button { position:absolute; width:calc(var(--cell) * 1.25); height:calc(var(--cell) * 1.25); border-radius:50%;
    font-weight:900; font-size:calc(var(--cell) * .42); letter-spacing:0; }
  .poke-battle .pad .ab .a { right:0; top:0; border:2.5px solid var(--red-dark); background:var(--red-fill); color:#fff;
    box-shadow:0 4px 0 var(--red-dark); text-shadow:0 1px 0 #0004; }
  .poke-battle .pad .ab .b { left:0; bottom:4px; border:2.5px solid var(--navy); background:var(--paper);
    color:var(--navy); box-shadow:0 4px 0 var(--navy-dark); }
  .poke-battle .pad button.held { transform:translateY(3px); box-shadow:0 1px 0 var(--navy-dark); }
  .poke-battle .pad .ab .a.held { box-shadow:0 1px 0 var(--red-dark); }
  /* Shows which leave-confirmation button the pad picked (arrows = move, A = press, B = keep playing) */
  .poke-battle.pkb-portrait .confirm .row button.pkb-picked, .poke-battle.pkb-landscape .confirm .row button.pkb-picked { outline:3px solid #ffd35c; outline-offset:2px; }
  /* Landscape: no strip, buttons in the empty space at both sides */
  .poke-battle.pkb-landscape { align-items:center; }
  .poke-battle.pkb-landscape .band { display:none; }
  .poke-battle.pkb-landscape .side { flex:1 1 0; min-width:var(--side); align-self:stretch; display:flex; flex-direction:column; align-items:center;
    gap:calc(var(--tap) * .27); padding:10px 0; }
  .poke-battle.pkb-landscape .side .grow { flex:1; }
  .poke-battle.pkb-landscape .side button { flex:none; padding:0; display:flex; align-items:center; justify-content:center; border:2px solid var(--navy);
    background:#fff; color:var(--navy); box-shadow:0 2.5px 0 var(--navy-dark); cursor:pointer; }
  .poke-battle.pkb-landscape .side button[hidden] { display:none; }
  /* Back = B: only while the battle view takes input (battle and end screen) */
  .poke-battle[data-mode="preparing"] .side .back, .poke-battle[data-mode="error"] .side .back { display:none; }
  .poke-battle.pkb-landscape .side button:active, .poke-battle.pkb-landscape .side button.held { transform:translateY(2px); box-shadow:0 .5px 0 var(--navy-dark); }
  .poke-battle.pkb-landscape .side button:focus-visible { outline:2px solid #ffd35c; outline-offset:2px; }
  .poke-battle.pkb-landscape .side .leave { color:var(--red); }
`;
