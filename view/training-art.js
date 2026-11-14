import { bagOf } from '../story/training.mjs';
import { pixelSvg, paint } from './amie-art.js';
import { mix } from './amie-scenes.js';

export const STAT_COLORS = Object.freeze({ hp: 0xe8505a, atk: 0xf08a30, def: 0xe8c838, spa: 0x4a8ef0, spd: 0x48b860, spe: 0xe060c8 });
export const BAG_COLORS = Object.freeze({ reset: 0x9aa4b4, strength: 0xd84838, toughen_up: 0x8a6a48, swiftness: 0x40c0d8, big_shot: 0x6858d0, double_up: 0xf0c020, soothing: 0xf890b8 });
export const BLANK_COLOR = 0x34343c;

export const colorOf = id => { if (!id) return BLANK_COLOR; const bag = bagOf(id); return (bag?.kind === 'stat' ? STAT_COLORS[bag.stat] : BAG_COLORS[id]) ?? BLANK_COLOR; };
export const css = color => `#${color.toString(16).padStart(6, '0')}`;

export const DUST = '#dcc496';
export const SAND = ['#e8d6a6', '#c8ac78'];

export function bagColors(base) {
  const dark = base === css(BLANK_COLOR) ? mix(base, '#000000', 0.25) : mix(base, '#3a2a20', 0.38), outline = mix(base, '#2a1a14', 0.72), light = mix(base, '#ffffff', 0.4);
  return { base, light, dark, outline, O: outline, B: base, L: light, D: dark, Y: SAND[0] };
}

export const BAG_DOTS = Object.freeze({ s: { w: 13, h: 21 }, m: { w: 15, h: 25 }, l: { w: 17, h: 29 } });
export const bagSize = id => { const b = id && bagOf(id); return b?.kind === 'stat' ? b.size : 'm'; };

export const bagDims = id => { const d = BAG_DOTS[bagSize(id)]; return { w: d.w * 2, h: d.h * 2 }; };

export const bagIcon = id => { const b = id && bagOf(id); return !b || b.kind === 'stat' || b.kind === 'reset' ? null : b.kind === 'soothing' ? 'heart' : 'star'; };
export const BAG_STATES = Object.freeze(['normal', 'hit', 'worn', 'wornHit']);

export const ICON_SCALE = 1.1;

export function bagRows(size = 'm', state = 'normal', flash = false) {
  const { w: BW, h: BH } = BAG_DOTS[size], mid = (BW - 1) / 2;
  const span = y => (y === 0 || y === BH - 1 ? BW - 4 : y === 1 || y === BH - 2 ? BW - 2 : BW);
  const inside = (b, y) => y >= 0 && y < BH && Math.abs(b - mid) <= (span(y) - 1) / 2;
  const g = Array.from({ length: BH }, (_, y) => Array.from({ length: BW + 2 }, (_, c) => (inside(c - 1, y) ? 'B' : '.')));
  const set = (b, y, ch) => { if (g[y]?.[b + 1] === 'B') g[y][b + 1] = ch; };
  const put = (b, y, ch) => { g[y][b + 1] = ch; };
  for (let y = 0; y < BH; y++) for (let b = 0; b < BW; b++) if (inside(b, y) && !(inside(b - 1, y) && inside(b + 1, y) && inside(b, y - 1) && inside(b, y + 1))) put(b, y, 'O');
  if (flash) return g.map(r => r.join('').replace(/[^.]/g, 'F'));

  for (let b = 1; b < BW - 1; b++) { set(b, 1, 'D'); set(b, BH - 2, 'D'); set(b, 4, 'D'); set(b, BH - 5, 'D'); }
  for (let y = 2; y < BH - 2; y++) { set(1, y, 'L'); set(2, y, 'L'); set(BW - 3, y, 'D'); set(BW - 2, y, 'D'); }
  if (state === 'worn' || state === 'wornHit') { put(BW - 4, BH - 3, 'O'); put(BW - 3, BH - 4, 'O'); put(BW - 3, BH - 3, 'Y'); }
  if (state === 'hit' || state === 'wornHit') {

    const c = Math.round(BH * 0.55);
    for (let y = c - 2; y <= c + 1; y++) {
      const k = y === c - 2 || y === c + 1 ? 1 : 2;
      for (let b = 0; b < k; b++) put(b, y, '.');
      put(k, y, 'O');
    }
    put(3, c - 1, 'D'); put(3, c, 'D');
    for (const y of [c - 1, c]) { put(BW - 1, y, 'D'); put(BW, y, 'O'); }
  }
  return g.map(r => r.join(''));
}

export function strapRows(size = 'm') {
  const { w: BW } = BAG_DOTS[size], mid = (BW - 1) / 2;
  return [0, 1, 2, 3].map(r => { const x = Math.round(mid - 1 - (mid - 4) * r / 3), row = Array(BW).fill('.'); row[x] = 'U'; row[BW - 1 - x] = 'T'; return row.join(''); });
}

const CHAIN = { L: '#dfe5ea', M: '#a9b4be', D: '#6e7a86', O: '#3e4650', T: '#6a4630', U: '#8a5e3c' };
export const HANG = Object.freeze({
  link: [['LM', 'L.', 'MD'], ['M', 'M', 'D']],
  ring: ['.LM.', 'L..D', 'M..D', '.DO.'],
  clasp: ['OLMMDO', '..MD..'],
});

const PIECES = [['.OO.', 'OLBO', 'OBBO', 'OBO.', '.O..'], ['.OOO.', 'OLBBO', 'OBBBO', '.OBBO', 'OBBO.', '.OO..'], ['OO.', 'OBO', 'OBO', '.OO']];

export const bagSvg = (id, state = 'normal', flash = false) => pixelSvg(bagRows(bagSize(id), state, flash), { ...bagColors(css(colorOf(id))), F: '#ffffff' });
export const hangSvg = name => pixelSvg(name === 'link0' ? HANG.link[0] : name === 'link1' ? HANG.link[1] : name.startsWith('strap') ? strapRows(name.slice(6) || 'm') : HANG[name], CHAIN);
export const pieceSvg = (id, i) => pixelSvg(PIECES[i], bagColors(css(colorOf(id))));

export function hangTextures(scene) {
  HANG.link.forEach((rows, i) => paint(scene, `train-link-${i}`, rows, CHAIN));
  for (const k of ['ring', 'clasp']) paint(scene, `train-${k}`, HANG[k], CHAIN);
  SAND.forEach((c, i) => paint(scene, `train-sand-${i}`, ['X'], { X: c }));
  paint(scene, 'train-dust', ['X'], { X: DUST });
  for (const size of Object.keys(BAG_DOTS)) {
    paint(scene, `train-strap-${size}`, strapRows(size), CHAIN);
    paint(scene, `train-flash-${size}`, bagRows(size, 'normal', true), { F: '#ffffff' });
  }
}

export function bagTexture(scene, id, state = 'normal') {
  const key = `train-bag-${id || 'blank'}-${state}`, colors = bagColors(css(colorOf(id)));
  paint(scene, key, bagRows(bagSize(id), state), colors);
  PIECES.forEach((rows, i) => paint(scene, `train-piece-${id || 'blank'}-${i}`, rows, colors));
  return key;
}
