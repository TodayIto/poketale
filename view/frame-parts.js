import { FONT } from '../story/card.mjs';
import { pixelSvg } from './amie-art.js';
import { ringSvg, ringDash, RING_COLOR, RING_ICON } from '../story/gauge-ring.mjs';

export const NAVY = '#23435f';

export const TAP = 44;

export const CLOSE_EVENT = 'pkb-close-window';

export const esc = text => String(text).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

const svg = (body, box = 16) => `<svg viewBox="0 0 ${box} ${box}" aria-hidden="true">${body}</svg>`;

const pixIcon = rows => pixelSvg(rows, { o: 'currentColor' }).replace('<svg ', `<svg width="${2 * Math.max(...rows.map(row => row.length))}" height="${2 * rows.length}" `);

const PAPER = 'linear-gradient(135deg,#ffffff 0%,#f3f8fc 55%,#e2eef7 100%)';

export const A1 = Object.freeze({ border: 2.5, radius: 10, paper: PAPER, drop: '0 2.5px 0 #1a3247', pressed: '0 .5px 0 #1a3247' });

export const FAB_PAD = 4, FAB_BAND = 20;
export const PART_ICON = Object.freeze({
  prev: pixIcon(['.....o', '....oo', '...ooo', '..oooo', '.ooooo', 'oooooo', '.ooooo', '..oooo', '...ooo', '....oo', '.....o']),
  next: pixIcon(['o.....', 'oo....', 'ooo...', 'oooo..', 'ooooo.', 'oooooo', 'ooooo.', 'oooo..', 'ooo...', 'oo....', 'o.....']),
  back: pixIcon(['....ooo', '...ooo.', '..ooo..', '.ooo...', 'ooo....', 'ooo....', '.ooo...', '..ooo..', '...ooo.', '....ooo']),
  close: pixIcon(['oo....oo', 'ooo..ooo', '.oooooo.', '..oooo..', '..oooo..', '.oooooo.', 'ooo..ooo', 'oo....oo']),
  chevron: svg('<path d="M6 3.2 10.8 8 6 12.8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'),
});

export function partsCss(root) {
  const ink = `var(--navy-dark, ${NAVY})`, R = root;
  return `
  ${R}{font-family:${FONT};color:${ink};user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;}
  ${R} [hidden]{display:none !important;}
  ${R} svg{display:block;}
  ${R} button{font:inherit;color:inherit;margin:0;padding:0;border:0;background:none;cursor:pointer;touch-action:manipulation;pointer-events:auto;}
  ${R} button:focus{outline:none;} ${R} button:focus-visible{outline:2px solid #ffcf4a;outline-offset:2px;}
  ${R} .round{flex:none;width:${TAP}px;height:${TAP}px;border:${A1.border}px solid ${ink};border-radius:${A1.radius}px;background:${A1.paper};box-shadow:${A1.drop};
    display:flex;align-items:center;justify-content:center;}
  ${R} .round svg{flex:none;}
  ${R} .round:active:not(:disabled){transform:translateY(2px);box-shadow:${A1.pressed};}
  ${R} .round:disabled{opacity:.45;box-shadow:none;cursor:default;}
  ${R} .exit{position:absolute;z-index:3;}
  ${R} .exit.close{color:var(--red, #d8434d);}
  ${R} .sheet{pointer-events:auto;padding:10px 12px 12px;border:2.5px solid ${ink};border-radius:12px;background:${PAPER};
    box-shadow:0 4px 0 #1a3247;}
  ${R} .sheet .hd{margin:0 0 8px;font-size:14px;}
  ${R} .seg{display:flex;gap:3px;padding:3px;border:2px solid #9fb6c8;border-radius:11px;background:#dfe9f1;}
  ${R} .seg button{flex:1;min-width:0;min-height:40px;border-radius:8px;font-size:14px;color:#4a6378;white-space:nowrap;}
  ${R} .seg button.on{background:linear-gradient(#ec5a64,#d8434d);color:#fff;box-shadow:0 2px 0 var(--red-dark, #8e2835);text-shadow:0 1px 0 #0004;}
  ${R} .row{display:flex;align-items:center;gap:10px;width:100%;min-height:50px;margin-top:8px;padding:5px 8px 5px 6px;border:2.5px solid ${ink};border-radius:11px;
    background:#fff;box-shadow:0 3px 0 #1a3247;text-align:left;font-size:14px;}
  ${R} .row:active:not(:disabled){transform:translateY(2px);box-shadow:0 1px 0 #1a3247;}
  ${R} .row:disabled{opacity:.45;cursor:default;}
  ${R} .row .ic{flex:none;width:34px;height:34px;display:flex;align-items:center;justify-content:center;border:2px solid #9fb6c8;border-radius:50%;background:#eef4f9;}
  ${R} .row .ic svg{width:70%;height:70%;}
  ${R} .row .nm{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  ${R} .row .go{flex:none;width:16px;height:16px;color:#5d7486;}
  ${R} .stepper{display:flex;align-items:center;gap:10px;}
  ${R} .stepper .val{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:4px;}
  ${R} .stepper .val b{font-weight:400;font-size:16px;white-space:nowrap;} ${R} .stepper .val b small{font-size:12px;color:#5d7486;margin-left:6px;}
  ${R} .stepper .dots{display:flex;gap:5px;}
  ${R} .stepper .dots i{width:7px;height:7px;border-radius:50%;border:1.5px solid ${ink};background:#fff;}
  ${R} .stepper .dots i.on{background:var(--red, #d8434d);}
  ${R} .btn{flex:1;min-height:${TAP}px;padding:4px 10px;border:2.5px solid ${ink};border-radius:11px;background:#fff;box-shadow:0 3px 0 #1a3247;font-size:14px;}
  ${R} .btn.main{border-color:var(--red-dark, #8e2835);background:linear-gradient(#ec5a64,#d8434d);color:#fff;box-shadow:0 3px 0 var(--red-dark, #8e2835);text-shadow:0 1px 0 #0004;}
  ${R} .btn:active{transform:translateY(2px);box-shadow:none;}
  ${R} .fab{position:absolute;box-sizing:border-box;display:flex;flex-direction:column;width:calc(var(--d) + ${2 * FAB_PAD}px);height:calc(var(--d) + ${FAB_BAND}px);padding-top:6px;
    border:2.5px solid ${ink};border-radius:12px;background:${PAPER};box-shadow:0 4px 0 #1a3247;overflow:hidden;}
  ${R} .fab .o{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;}
  ${R} .fab .o svg{width:52%;height:auto;max-height:100%;}
  ${R} .fab:active{transform:translateY(2px);box-shadow:0 2px 0 #1a3247;}
  ${R} .fab.on{border-color:var(--red-dark, #8e2835);background:linear-gradient(135deg,#fff7f8,#ffdfe2);box-shadow:0 4px 0 var(--red-dark, #8e2835);}
  ${R} .fab.on:active{box-shadow:0 2px 0 var(--red-dark, #8e2835);}
  ${R} .fab b{flex:none;font-weight:400;font-size:12px;line-height:15px;padding:2px 0 3px;background:${ink};color:#fff;text-align:center;white-space:nowrap;}
  ${R} .fab.on b{background:var(--red, #d8434d);}
`;
}

export const ringCss = (R, d) => `
  ${R} .ring{position:relative;flex:none;width:${d}px;height:${d}px;pointer-events:auto;}
  ${R} .ring > svg{width:100%;height:100%;}
  ${R} .ring .arc{transition:stroke-dasharray .3s ease-out;}
  ${R} .ring .ic{position:absolute;left:50%;top:50%;width:${Math.round(d * 0.45)}px;height:${Math.round(d * 0.45)}px;transform:translate(-50%,-50%);border-radius:50%;
    display:flex;align-items:center;justify-content:center;}
  ${R} .ring .ic svg{width:58%;height:58%;}`;

export const ringHtml = (kind, label) => `<div class="ring ${kind}" role="img" title="${esc(label)}" aria-label="${esc(label)}">${ringSvg(kind, 0)}`
  + `<span class="ic" style="background:${RING_COLOR[kind]}">${RING_ICON[kind]}</span></div>`;

export const drawRing = (ring, share) => ring.querySelector('.arc').setAttribute('stroke-dasharray', ringDash(share));

export const roundHtml = (name, icon, label) =>
  `<button type="button" class="round ${name}" aria-label="${esc(label)}" title="${esc(label)}">${PART_ICON[icon] ?? icon}</button>`;

export const exitsHtml = words => roundHtml('exit back', 'back', words.back) + roundHtml('exit close', 'close', words.close);

export const fabHtml = (kind, word, icon) => `<button type="button" class="fab ${kind}" aria-label="${esc(word)}"><span class="o">${icon}</span><b>${esc(word)}</b></button>`;

export const rowHtml = (data, icon, name) => `<button type="button" class="row"${Object.entries(data).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('')}>`
  + `<span class="ic">${icon}</span><span class="nm">${esc(name)}</span><span class="go">${PART_ICON.chevron}</span></button>`;

export const segHtml = (label, options, chosen) => `<div class="seg" role="radiogroup" aria-label="${esc(label)}">`
  + options.map(([id, word]) => `<button type="button" role="radio" data-value="${esc(id)}" class="${id === chosen ? 'on' : ''}" aria-checked="${id === chosen}">${esc(word)}</button>`).join('')
  + '</div>';

export function pickSeg(seg, value) {
  for (const button of seg.querySelectorAll('button')) {
    const on = button.getAttribute('data-value') === value;
    button.classList.toggle('on', on);
    button.setAttribute('aria-checked', String(on));
  }
}

export const stepperHtml = (label, words) => `<div class="stepper" role="group" aria-label="${esc(label)}">${roundHtml('l', 'prev', words.prev)}`
  + `<div class="val"><b></b><span class="dots"></span></div>${roundHtml('r', 'next', words.next)}</div>`;

export function drawStepper(el, { at, count, main, small = '' }) {
  el.querySelector('.val b').innerHTML = `${esc(main)}${small ? `<small>${esc(small)}</small>` : ''}`;
  el.querySelector('.dots').innerHTML = Array.from({ length: count }, (_, i) => `<i${i === at ? ' class="on"' : ''}></i>`).join('');
  el.querySelector('.round.l').disabled = at <= 0;
  el.querySelector('.round.r').disabled = at >= count - 1;
}

export function closeWindow(from) {
  const view = from.ownerDocument.defaultView;
  const event = new view.CustomEvent(CLOSE_EVENT, { bubbles: true, cancelable: true });
  return !from.dispatchEvent(event);
}

export const LONG_PRESS = 450;

export function bindLongPress(element, { tap, long }) {
  let timer = null, held = false;
  const stop = () => { clearTimeout(timer); timer = null; };
  element.addEventListener('pointerdown', () => {
    held = false;
    stop();
    timer = setTimeout(() => { timer = null; held = true; long(); }, LONG_PRESS);
  });
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) element.addEventListener(type, stop);
  element.addEventListener('contextmenu', event => event.preventDefault());
  element.addEventListener('click', event => {
    if (held) { held = false; event.preventDefault(); return; }
    tap();
  });
}
