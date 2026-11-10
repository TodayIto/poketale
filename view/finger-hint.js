import { pixelSvg } from './amie-art.js';

export const FINGER = Object.freeze({
  rows: [
    '...XXXXXXX..',
    '...XCCCCCX..',
    '...XWWWSSX..',
    '..XWWWWWSSX.',
    '..XWWWWWWSX.',
    '.XWWWWWWWWSX',
    '.XWWWWWWWWWX',
    'XWWWWWWWWWWX',
    'XWWXWWXWWXWX',
    '.XXXWWXWWXWX',
    '...XWWXWWXX.',
    '...XWWXXX...',
    '...XWWX.....',
    '...XWWX.....',
    '...XWWX.....',
    '....XX......',
  ],
  colors: { X: '#23435f', W: '#ffffff', S: '#c8d6e2', C: '#4a8ef0' },

  tip: { x: 5, y: 16 },
});

export const FINGER_TAP = 1000;

export const FINGER_TAPS = 2;

const css = `
  .pkb-finger{position:absolute;left:0;top:0;width:0;height:0;z-index:5;pointer-events:none;transition:left .32s ease-in-out,top .32s ease-in-out;}
  .pkb-finger[hidden]{display:none;}
  .pkb-finger .hand{position:absolute;display:block;animation:pkb-finger-tap ${FINGER_TAP}ms ease-in-out infinite;filter:drop-shadow(0 2px 0 rgba(15,24,34,.35));}
  .pkb-finger .hand svg{display:block;width:100%;height:100%;}
  .pkb-finger .ring{position:absolute;left:-14px;top:-14px;width:28px;height:28px;box-sizing:border-box;border:3px solid #fff;border-radius:50%;
    box-shadow:0 0 0 1.5px #23435f;opacity:0;animation:pkb-finger-ring ${FINGER_TAP}ms ease-out infinite;}
  @keyframes pkb-finger-tap{0%,100%{transform:translateY(-12px);}40%,58%{transform:translateY(0);}}
  @keyframes pkb-finger-ring{0%,40%{opacity:0;transform:scale(.3);}46%{opacity:.95;transform:scale(.4);}90%,100%{opacity:0;transform:scale(1.15);}}
`;

export function mountFingerHint(parent, { scale = 3 } = {}) {
  const doc = parent.ownerDocument ?? globalThis.document, win = doc.defaultView ?? globalThis;
  const w = FINGER.rows[0].length * scale, h = FINGER.rows.length * scale;
  const element = doc.createElement('div');
  element.className = 'pkb-finger';
  element.hidden = true;
  element.innerHTML = `<style>${css}</style><span class="ring"></span>`
    + `<span class="hand" style="left:${-FINGER.tip.x * scale}px;top:${-FINGER.tip.y * scale}px;width:${w}px;height:${h}px">${pixelSvg(FINGER.rows, FINGER.colors)}</span>`;
  parent.append(element);
  let spots = [], at = 0, timer = null;
  const stop = () => { if (timer !== null) win.clearInterval(timer); timer = null; };
  const place = () => {
    const where = spots.length ? spots[at % spots.length]() : null;
    element.hidden = !where;
    if (where) { element.style.left = `${where.x}px`; element.style.top = `${where.y}px`; }
  };
  return {
    element,
    show(next) {
      stop();
      spots = next.filter(Boolean);
      at = 0;
      place();
      if (spots.length > 1) timer = win.setInterval(() => { at++; place(); }, FINGER_TAP * FINGER_TAPS);
    },
    hide() { stop(); spots = []; element.hidden = true; },
    remove() { stop(); element.remove(); },
  };
}
