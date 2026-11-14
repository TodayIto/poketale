export const DOT = 2;
export const q = v => Math.round(v / DOT) * DOT;

export const SCENE_FRAME = Object.freeze({ tall: { feet: 262, topRow: 58, bar: 68, ref: 390 / 180 }, wide: { feet: 236, topRow: 68, bar: 82, ref: 800 / 180 } });

export const HEAD_LAYOUT = Object.freeze({ slots: [0, -100, 100], justY: -12.5, justH: 50 });

export function sceneSize(width, height) {
  const tall = height > width;
  const w = tall ? 180 : Math.round(Math.min(400, Math.max(180, 180 * width / height)));
  const h = tall ? Math.round(Math.min(400, Math.max(240, 180 * height / width))) : 180;
  return { w, h, px: tall ? width / w : height / h };
}

export const TIMES = Object.freeze({
  morning: { sky: ['#9fd0ee', '#bfe0f2', '#dcecf2', '#fbe6c8'], cloud: '#ffffff', shade: '#f2dcd0', sun: '#fff1b8', land: '#fff4e4' },
  day: { sky: ['#7ec4ec', '#97d0f0', '#b2dcf4', '#cdeaf8'], cloud: '#ffffff', shade: '#d8e8f4', sun: '#fff6c8', land: '#ffffff' },
  dusk: { sky: ['#7a86c8', '#c99ab8', '#f0a89a', '#ffcf8e'], cloud: '#ffe4cc', shade: '#d8a0a8', sun: '#ffb070', land: '#ffdcc0' },
  night: { sky: ['#22305e', '#2c3e74', '#3a5088', '#4e68a0'], cloud: '#6a7cae', shade: '#4a5a8c', moon: '#fff6d8', star: '#fff6c8', land: '#a8b4dc' },
});

const HEAD_SKY = {
  morning: ['#a6d8f2', '#aedbf1', '#b7def0', '#c0e1ef'], day: ['#a8dcf4', '#b0dff5', '#b9e3f6', '#c2e6f7'],
  dusk: ['#a6a8d8', '#aeaad4', '#b8aed0', '#c2b2cc'], night: ['#566aa2', '#5a6ea6', '#5e72a9', '#6276ac'],
};
export const FIREFLY = '#e8ff9a', NIGHT_FLOOR = '#2a3450';

const BASE = { bands: ['dark', 'mid', 'light', 'mid'] };
const HOUSE = { wall: ['#fff4e0', '#f6d8b4'], roof: ['#e8765e', '#5a8ed8', '#f0b448'], win: '#a8dcf0' };
export const GREEN = '#7cc45a', LIT = '#ffe8a0';
export const PLACE_ART = Object.freeze({
  field: { ...BASE, kind: 'field', light: '#a6dc78', mid: '#86c862', dark: '#68ac50', acc: ['#fff4a0', '#ffb8cc'], path: '#e8d6a6', hill: '#9cc8a0', tree: '#4f9a52' },
  meadow: { ...BASE, kind: 'field', light: '#b0e080', mid: '#90cc6a', dark: '#70b058', acc: ['#f7a8c8', '#ffe27a', '#c8acf0'], path: '#e8d6a6', hill: '#a4cca0', tree: '#58a058', flowers: 1 },
  tallGrass: { ...BASE, kind: 'field', light: '#98d06a', mid: '#78b856', dark: '#5a9a44', acc: ['#e8f0a0'], path: '#e0d0a0', hill: '#94c49a', tree: '#4a8e48', front: '#4f8e3e', tall: 1 },
  wasteland: { ...BASE, kind: 'field', light: '#dcc890', mid: '#c4aa72', dark: '#a08654', acc: ['#b8704a'], path: '#e8d8b0', hill: '#ccbc96', tree: '#9a8a5a', front: '#c8b070' },
  forest: { ...BASE, kind: 'forest', light: '#94cc68', mid: '#72b052', dark: '#558e44', acc: ['#e8f5b0'], leafF: '#3e8a4a', leafB: '#2e6e42', trunk: '#8a5e3c', trunkD: '#6a4630' },
  jungle: { ...BASE, kind: 'forest', light: '#7cc46a', mid: '#5aa85a', dark: '#3e8a4c', acc: ['#f07a96', '#ffd84a'], leafF: '#2a9a62', leafB: '#1f7a50', trunk: '#8a5e3c', trunkD: '#6a4630' },
  swamp: { ...BASE, kind: 'forest', light: '#98b070', mid: '#7a9658', dark: '#5e7a48', acc: ['#f0b8cc'], leafF: '#4e7a4a', leafB: '#3e6440', trunk: '#7a5e44', trunkD: '#5e4836', pond: ['#7aa898', '#5e8c80'] },
  quietForest: { ...BASE, kind: 'forest', light: '#a4bca8', mid: '#86a090', dark: '#688478', acc: ['#e8eef4'], leafF: '#5a7e70', leafB: '#4a6c62', trunk: '#7e6a5a', trunkD: '#64544a', stone: '#b4b8bc', fog: 1 },
  beach: { ...BASE, kind: 'water', light: '#f6e6b6', mid: '#ead090', dark: '#d6b474', acc: ['#ffbca8'], far: '#56acd8', near: '#78c8ea', grass: '#9cc070', rock: '#b8b0a0' },
  sea: { ...BASE, kind: 'water', light: '#e2c08c', mid: '#c89e68', dark: '#a87c4c', acc: ['#ffffff'], far: '#4aa0d4', near: '#6cc0e8', grass: '#9cc070', rock: '#a8a49a', planks: 1 },
  island: { kind: 'water', bands: ['light', 'dark', 'mid', 'dark'], light: '#f2e2b0', mid: '#a8d878', dark: '#78b858', acc: ['#ff9a8a'], far: '#56acd8', near: '#78c8ea', grass: '#3e9a5a', rock: '#b8b0a0' },
  lake: { ...BASE, kind: 'water', light: '#a6d878', mid: '#84c262', dark: '#62a44e', acc: ['#ffffff'], far: '#68b8dc', near: '#92d2ee', grass: '#6a9040', reeds: 1 },
  mountain: { ...BASE, kind: 'mountain', light: '#c8bca4', mid: '#a89a82', dark: '#857864', acc: ['#9ac46a'], far: ['#a8b8d0', '#8ea2c0'], grass: '#7aa45a' },
  desert: { ...BASE, kind: 'mountain', light: '#f2d8a0', mid: '#e2bc78', dark: '#c89e58', acc: ['#d89a68'], far: ['#f0d8b8', '#e8c8a0'], grass: '#c4a868', dunes: 1 },
  badlands: { ...BASE, kind: 'mountain', light: '#e0a888', mid: '#c4866a', dark: '#9a644e', acc: ['#e8d0a0'], grass: '#b0946a', mesa: 1 },
  volcano: { ...BASE, kind: 'mountain', light: '#9a7a70', mid: '#7a5a54', dark: '#5a4040', acc: ['#ff9a5a'], grass: '#8a8060', smoke: '#dccec8', cone: 1 },
  ruins: { ...BASE, kind: 'mountain', light: '#dcd4bc', mid: '#bcb094', dark: '#908268', acc: ['#8eb85e'], far: ['#a8b8d0', '#8ea2c0'], grass: '#8eb85e', pillars: 1 },
  town: { ...BASE, ...HOUSE, kind: 'town', light: '#ece0cc', mid: '#d8c8ac', dark: '#bca88c', acc: [GREEN] },
  metropolis: { ...BASE, ...HOUSE, kind: 'town', light: '#e4e4e4', mid: '#c8ccd2', dark: '#a8aeb8', acc: [GREEN], win: '#e8f4ff', towers: ['#c8d4e0', '#aab8c8'] },
  slum: { ...BASE, kind: 'town', light: '#dcd0bc', mid: '#c0b098', dark: '#9e8c74', acc: ['#d88a5a'], wall: ['#c8866a', '#b0745a'], roof: ['#9a8a7a', '#8a96a0', '#b49a70'], win: '#a8c8d8', brick: 1 },
  construction: { ...BASE, ...HOUSE, kind: 'town', light: '#e0d4b8', mid: '#c8b490', dark: '#a89068', acc: ['#f08a3a'], board: '#d8b080' },
  room: { ...BASE, kind: 'indoor', light: '#dcb67e', mid: '#c8a06a', dark: '#ac8250', acc: ['#e89a9a'], wall: '#f8eedc', low: '#e8d4b0' },
  lab: { ...BASE, kind: 'indoor', light: '#e8eef2', mid: '#ccd8e0', dark: '#a8b8c6', acc: ['#5aa8e8'], wall: '#f6fafc', low: '#e2ecf2', stripe: '#9ac8ec', fur: '#c4d2de', pot: '#f6fafc' },
  factory: { ...BASE, kind: 'indoor', light: '#c8ccd0', mid: '#a8aeb4', dark: '#888e96', acc: ['#f0c040'], wall: '#d8dce0', low: '#c8ccd0', fur: '#9aa2aa', pot: '#a8aeb4', hazard: 1 },
  dojo: { ...BASE, kind: 'indoor', light: '#e2c48e', mid: '#c8a470', dark: '#a88454', acc: ['#d8434d'], wall: '#ecd6a8', low: '#dcc290', seams: 1 },
  temple: { ...BASE, kind: 'indoor', light: '#dcd6c8', mid: '#beb6a4', dark: '#9a9280', acc: ['#e0b45a'], wall: '#e8e2d4', low: '#dcd4c4', fur: '#b4aa94', pot: '#c8bea8', pillar: '#c8bea8' },
  cave: { ...BASE, kind: 'cave', light: '#b4a088', mid: '#94806a', dark: '#74624f', acc: ['#a8e4f4'], wall: ['#8a7a6a', '#6a5c50'], glow: '#fff4c8' },
  iceCave: { ...BASE, kind: 'cave', light: '#e4f2fa', mid: '#bcdaee', dark: '#8eb8d8', acc: ['#ffffff'], wall: ['#a8cce4', '#86b0d0'], glow: '#fff4c8', icicles: 1 },
  fairyCave: { ...BASE, kind: 'cave', light: '#f0d4ea', mid: '#d8b0d4', dark: '#b488b4', acc: ['#fff0a0'], wall: ['#c8a0c8', '#a880aa'], glow: '#fff4c8' },
  seabed: { ...BASE, kind: 'cave', light: '#c8d8b8', mid: '#88b8c0', dark: '#5a90a8', acc: ['#c8f0ff'], wall: ['#3a80b0', '#2a6494'], weed: '#4a9a6a', ray: '#a8e0f0' },
  odd: { ...BASE, kind: 'cave', light: '#5a5088', mid: '#40386c', dark: '#2c2650', acc: ['#fff6c8'], wall: ['#40386c', '#2c2650'], glow: '#a890f0', stars: 1 },
  snow: { ...BASE, kind: 'snow', light: '#ffffff', mid: '#e2eef8', dark: '#c2d6ea', acc: ['#a8d0f0'], tree: '#4a7e7c', treeD: '#3a6668' },
});

export const ROOFED = new Set(['indoor', 'cave']);

const PLACE_OF = {
  plains: 'field', grass: 'field', tall_grass: 'tallGrass', meadow: 'meadow', wasteland: 'wasteland',
  forest: 'forest', jungle: 'jungle', swamp: 'swamp', graveyard: 'quietForest',
  beach: 'beach', sea: 'sea', island: 'island', lake: 'lake', snowy_forest: 'snow',
  mountain: 'mountain', desert: 'desert', badlands: 'badlands', volcano: 'volcano', ruins: 'ruins',
  town: 'town', metropolis: 'metropolis', slum: 'slum', construction_site: 'construction',
  laboratory: 'lab', factory: 'factory', power_plant: 'factory', dojo: 'dojo', temple: 'temple',
  cave: 'cave', ice_cave: 'iceCave', fairy_cave: 'fairyCave', seabed: 'seabed', abyss: 'odd', space: 'odd', end: 'odd',
};

export const placeArt = name => (PLACE_OF[name] ? { art: PLACE_OF[name], drawn: true } : PLACE_ART[name] ? { art: name, drawn: true } : { art: 'field', drawn: false });

export const storyPlace = ({ place, indoors = false } = {}) => (indoors && PLACE_ART[placeArt(place).art].kind !== 'indoor' ? 'room' : place || 'plains');

const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const hex = c => `#${c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
export const mix = (a, b, t) => { const B = rgb(b); return hex(rgb(a).map((v, i) => v + (B[i] - v) * t)); };

export const tintWith = land => { const T = rgb(land), F = rgb(NIGHT_FLOOR); return c => hex(rgb(c).map((v, i) => Math.max(F[i], v * T[i] / 255))); };

export function seeded(text) {
  let a = 2166136261;
  for (const ch of text) a = Math.imul(a ^ ch.charCodeAt(0), 16777619);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const P = (fill, d, more = '') => (d ? `<path fill="${fill}"${more} d="${d}"/>` : '');
export const run = (x, y, w, h = DOT) => (w > 0 ? `M${x} ${y}h${w}v${h}h${-w}z` : '');

const dotRow = (x0, y, x1) => `M${x0} ${y}${'h2v2h-2zm4 0'.repeat(Math.max(0, Math.ceil((x1 - x0) / 4)))}`;

export function rowsPath(rows) {
  const out = [];
  for (const [y, a, b] of rows) {
    if (b <= a) continue;
    const m = out.find(o => o[1] === a && o[2] === b && o[0] + o[3] === y);
    if (m) m[3] += DOT; else out.push([y, a, b, DOT]);
  }
  return out.map(([y, a, b, h]) => `M${a} ${y}h${b - a}v${h}h${a - b}z`).join('');
}

export function blob(ovals, yMax = Infinity) {
  const rows = [];
  let top = Infinity, bottom = -Infinity;
  for (const [, cy, , ry] of ovals) { top = Math.min(top, q(cy - ry)); bottom = Math.max(bottom, cy + ry); }
  for (let y = top; y < Math.min(bottom, yMax); y += DOT) {
    const spans = [];
    for (const [cx, cy, rx, ry] of ovals) {
      const t = (y + 1 - cy) / ry;
      const hw = Math.abs(t) < 1 ? q(rx * Math.sqrt(1 - t * t)) : 0;
      if (hw > 0) spans.push([q(cx) - hw, q(cx) + hw]);
    }
    spans.sort((s, t) => s[0] - t[0]);
    let cur = null;
    for (const s of spans) {
      if (cur && s[0] <= cur[2]) cur[2] = Math.max(cur[2], s[1]);
      else { cur = [y, s[0], s[1]]; rows.push(cur); }
    }
  }
  return rowsPath(rows);
}
export const oval = (cx, cy, rx, ry) => blob([[cx, cy, rx, ry]]);

export function ridge(c, fn, bottom) {
  let d = `M-4 ${bottom}`, prev;
  for (let x = -4; x < c.w + 4; x += DOT) {
    const y = Math.min(bottom, q(fn(x + 1)));
    if (y !== prev) { d += `H${x}V${y}`; prev = y; }
  }
  return `${d}H${c.w + 4}V${bottom}Z`;
}

export const edge = (c, x) => Math.min(1.3, ((x - c.w / 2) / (c.w / 2)) ** 2);

const STYLE = '<style>@keyframes pkbX{to{transform:translateX(var(--dx))}}@keyframes pkbY{from{transform:translateY(var(--a))}to{transform:translateY(var(--b))}}'
  + '@keyframes pkbA{50%{opacity:0}}@keyframes pkbB{0%{opacity:0}50%{opacity:1}}@keyframes pkbT{50%{opacity:.35}}@keyframes pkbS{to{transform:translateX(var(--dx))}}'
  + '@keyframes pkbF{from{opacity:.3}to{opacity:.85}}@media (prefers-reduced-motion:reduce){.pkbM *{animation:none!important}}</style>';
export const anim = (c, style, inner, base = '') => (c.animate ? `<g style="${base}animation:${style}">${inner}</g>` : base ? `<g style="${base}">${inner}</g>` : inner);

export const drift = (c, inner, span, secs) => (c.animate
  ? `<g style="animation:pkbX ${(span / DOT) * secs}s steps(${span / DOT}) infinite;--dx:${-span}px">${inner}<g transform="translate(${span} 0)">${inner}</g></g>` : inner);

export const twoFrames = (c, a, b, t) => (c.animate ? anim(c, `pkbA ${t}s steps(1) infinite`, a) + anim(c, `pkbB ${t}s steps(1) infinite`, b, 'opacity:0;') : a);
export const twinkle = (c, inner, t, at = 0) => anim(c, `pkbT ${t}s steps(1) ${-at}s infinite`, inner);

export function fall(c, inner, y0, t, sway, up = false) {
  if (!c.animate) return inner;
  const a = up ? c.h + 10 - y0 : -(y0 + 10), b = up ? -(y0 + 10) : c.h + 10 - y0, n = Math.abs(b - a) / DOT;
  return `<g style="animation:pkbY ${t}s steps(${n}) ${(-t * -a / (b - a)).toFixed(2)}s infinite;--a:${a}px;--b:${b}px">`
    + `<g style="animation:pkbS ${(t / 4).toFixed(2)}s steps(2) infinite alternate;--dx:${sway}px">${inner}</g></g>`;
}

export function context({ place = 'plains', time = 'day', w = 180, h = 390, px, animate = false } = {}) {
  const tall = h > w, F = tall ? SCENE_FRAME.tall : SCENE_FRAME.wide;
  px = px || F.ref;
  const T = TIMES[time] || TIMES.day, { art, drawn } = placeArt(place), A = PLACE_ART[art];
  const feet = q(h - F.feet / px), hz = q(feet - 0.3 * h);
  const tint = ROOFED.has(A.kind) ? col => col : tintWith(T.land);
  return { w, h, tall, px, feet, hz, top: q(F.topRow / px), T, A, art, drawn, time: TIMES[time] ? time : 'day', tint, animate, rnd: seeded(`${art}/${w}x${h}`), place };
}

export function wrap(c, groups, { layers, bleed } = {}) {
  const keep = layers && new Set(layers);
  const body = Object.entries(groups).filter(([k, v]) => v && (!keep || keep.has(k))).map(([k, v]) => `<g data-layer="${k}">${v}</g>`).join('');
  const [x, y, w, h] = bleed ? [-4, -4, c.w + 8, c.h + 8] : [0, 0, c.w, c.h];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${w / DOT}" height="${h / DOT}" preserveAspectRatio="xMidYMid slice"`
    + ` shape-rendering="crispEdges"${c.animate ? ' class="pkbM"' : ''}>${c.animate ? STYLE : ''}${body}</svg>`;
}

export function bands(c, cols, y0, y1, cuts, dither = true) {
  const ys = [y0, ...cuts.map(f => q(y0 + (y1 - y0) * f)), y1];
  if (c.wave) return waveBands(c, cols, ys);
  let s = cols.map((col, i) => P(col, run(-4, ys[i], c.w + 8, ys[i + 1] - ys[i]))).join('');
  if (dither) for (let i = 1; i < cols.length; i++) if (cols[i] !== cols[i - 1]) s += P(cols[i], dotRow(-4 + (i % 2) * 2, ys[i] - DOT, c.w + 4));
  return s;
}

function waveBands(c, cols, ys) {
  const ph = c.rnd() * 6, y1 = ys[ys.length - 1];
  let s = '';
  cols.forEach((col, i) => {
    const top = x => (i ? q(ys[i] + c.wave * (0.75 * Math.sin(x / 23 + ph + i * 2.1) + 0.25 * Math.sin(x / 9 + ph * 0.7 + i * 1.3))) : ys[0]);
    let d = `M-4 ${y1}`;
    for (let x = -4; x < c.w + 4; x += 4) d += `V${top(x)}h4`;
    s += P(col, `${d}V${y1}z`);
  });
  return s;
}
const SKY_CUTS = [0.34, 0.6, 0.82];
const skyAt = (c, y) => c.T.sky[Math.min(3, SKY_CUTS.filter(f => y > c.hz * f).length)];

function sky(c) { return bands(c, c.T.sky, -4, c.hz + 8, SKY_CUTS.map(f => (f * c.hz + 4) / (c.hz + 12))); }

function skyThings(c) {
  const { T, w, top, hz, px, rnd } = c;
  let s = '';

  const r = q(Math.min(w, c.h) / 20), night = c.time === 'night';
  const left = c.time === 'morning' || c.time === 'dusk';
  const sx = q(left ? w * 0.25 : w * 0.75), sy = q(Math.min(hz - r - 6, (c.time === 'dusk' ? 236 : 150) / px));
  const body = night ? T.moon : T.sun, glow = mix(body, skyAt(c, sy), night ? 0.7 : 0.55);
  s += P(glow, oval(sx, sy, r + 3, r + 3)) + P(body, oval(sx, sy, r, r));
  if (night) s += P(mix(T.moon, '#c8bfa0', 0.45), oval(sx - r * 0.35, sy - r * 0.2, r * 0.28, r * 0.28) + oval(sx + r * 0.3, sy + r * 0.35, r * 0.2, r * 0.2));

  if (night) {
    const n = c.tall ? 10 : 12;
    for (let i = 0; i < n; i++) {
      const side = i < n - 2;
      const x = q(side ? (i % 2 ? w * (0.82 + rnd() * 0.16) : w * (0.02 + rnd() * 0.16)) : w * (0.3 + rnd() * 0.4));
      const y = q(top + 4 + rnd() * (hz * 0.62 - top));
      if (Math.abs(x - sx) < r + 8 && Math.abs(y - sy) < r + 8) continue;
      const big = side && rnd() < 0.3, col = side ? T.star : mix(T.star, skyAt(c, y), 0.45);
      const dots = big ? run(x - 2, y, 6) + run(x, y - 2, 2) + run(x, y + 2, 2) : run(x, y, 2);
      s += i % 4 === 1 ? twinkle(c, P(col, dots), 1.5 + (i % 3) * 0.7, i * 0.4) : P(col, dots);
    }
  }

  const count = c.tall ? 3 : 4, span = w + 64;
  let shade = '', cloud = '';
  for (let i = 0; i < count; i++) {

    const cs = q((c.tall ? 12 : 14) + rnd() * 8), cx = q(w * [0.1, 0.88, 0.24, 0.99][i] + (rnd() - 0.5) * 10);
    let cy = q(top + 6 + cs * 0.5 + rnd() * Math.max(4, hz * 0.42 - top));
    if (Math.abs(cx - sx) < cs * 1.6 + r && Math.abs(cy - sy) < cs + r) cy = q(sy + r + cs * 0.9);
    if (cy > hz * 0.7) continue;
    const o = [[cx, cy, cs, cs * 0.55], [cx - cs * 0.85, cy + cs * 0.2, cs * 0.6, cs * 0.38], [cx + cs * 0.8, cy + cs * 0.15, cs * 0.62, cs * 0.42]];
    const flat = q(cy + cs * 0.42);
    shade += blob(o.map(([x, y, a, b]) => [x, y + 2, a, b]), flat + 2);
    cloud += blob(o, flat);
  }
  s += drift(c, P(T.shade, shade) + P(T.cloud, cloud), span, 3);
  return s;
}

export function ground(c, y0, A = c.A) {
  const [far, midd, stage, near] = A.bands.map(k => c.tint(A[k]));
  const { feet, h } = c, f = q(y0 + (feet - y0) * 0.2);

  if (c.wave) return bands(c, [far, mix(far, midd, 0.5), midd, mix(midd, stage, 0.5), stage, near], y0, h + 4, [0.14, 0.32, 0.52, 0.72, 0.9]);
  return bands(c, [far, midd, stage, near], y0, h + 4, [(f - y0) / (h + 4 - y0), (feet - 14 - y0) / (h + 4 - y0), (feet + 12 - y0) / (h + 4 - y0)]);
}

export function sideMarks(c, y0, color, n, mark = (x, y) => run(x, y, 2, 4)) {
  let d = '';
  if (c.photo) return d;
  for (let i = 0; i < n; i++) {
    const x = q(i % 2 ? c.w * (0.8 + c.rnd() * 0.18) : c.w * (0.02 + c.rnd() * 0.18));
    let y = q(y0 + 6 + c.rnd() * (c.h - y0 - 10));
    if (Math.abs(y - c.feet) < 18) y = q(c.feet + (y > c.feet ? 20 : -20));
    d += mark(x, y);
  }
  return P(color, d);
}

export function blades(c, x, base, hgt, n, frame, lean = 1) {
  const rows = [];
  for (let i = 0; i < n; i++) {
    const bx = q(x + (i - (n - 1) / 2) * 4), bh = q(hgt * (0.5 + 0.5 * Math.sin(i * 2.3 + x) ** 2)), bend = (i - (n - 1) / 2) * lean * 2 + frame * 3;
    for (let k = 0; k < bh; k += DOT) { const t = k / bh, dx = q(bend * t * t); rows.push([base - k - DOT, bx + dx, bx + dx + (t < 0.45 ? 4 : 2)]); }
  }
  return rowsPath(rows);
}

export function corners(c, dark, light, extra = () => '') {
  const room = c.h - c.feet, hgt = q(Math.min(room * 0.5, c.tall ? 64 : 28));
  const spots = c.tall ? [[c.w * 0.07, 9], [c.w * 0.93, 9]] : [[c.w * 0.14, 8], [c.w * 0.8, 7]], B = q(c.h) + 2;
  return spots.map(([x, n], i) => {

    const pic = f => P(dark, oval(q(x), B, n * 2 + 2, q(hgt * 0.22)) + blades(c, q(x), B, hgt, n, f, i ? 1 : -1)) + P(light, blades(c, q(x) + 2, B, hgt * 0.7, n - 3, f, i ? 1 : -1)) + extra(q(x), hgt, f, B);
    return twoFrames(c, pic(0), pic(1), i ? 3.4 : 2.6);
  }).join('');
}

export function floaters(c, colors, n, size = DOT) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = q(c.w * (0.06 + (i + c.rnd() * 0.8) * 0.88 / n)), y = q(c.top + c.rnd() * (c.feet - c.top));
    s += fall(c, P(colors[i % colors.length], run(x, y, size, DOT)), y, 8 + c.rnd() * 7, 2 + q(c.rnd() * 2));
  }
  return s;
}

export function fireflies(c, n) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = q(i % 2 ? c.w * (0.78 + c.rnd() * 0.18) : c.w * (0.04 + c.rnd() * 0.18)), y = q(c.hz + c.rnd() * (c.feet - c.hz - 20));
    s += anim(c, `pkbS ${3 + i}s steps(3) infinite alternate`, twinkle(c, P(mix(FIREFLY, '#2a3450', 0.55), run(x - 2, y - 2, 6, 6)) + P(FIREFLY, run(x, y, 2)), 1.2 + i * 0.4, i * 0.5), '--dx:4px;');
  }
  return s;
}

export const KINDS = {
  field(c) {
    const { A, w, hz, tint } = c, night = c.time === 'night';
    const lift = q(0.08 * c.h + 6);
    const far = x => hz - 4 - edge(c, x) * lift - 2 * Math.sin(x / 13 + 1);
    const near = x => hz + 2 - edge(c, x) * lift * 0.45 - 2 * Math.sin(x / 9);
    let L2 = P(tint(A.hill), ridge(c, far, hz + 8)) + P(tint(mix(A.dark, A.hill, 0.4)), ridge(c, near, hz + 8));

    let L3 = '';
    for (const fx of [0.05, 0.15, 0.88, 0.96]) {
      const x = q(w * fx), y = q(far(x)) + 2;
      L3 += P(tint(mix('#8a6a4a', A.hill, 0.3)), run(x, y - 6, 2, 6)) + P(tint(A.tree), oval(x + 1, y - 9, 5, 6)) + P(tint(mix(A.tree, A.light, 0.4)), oval(x - 1, y - 11, 2, 2));
    }
    let L4 = ground(c, hz + 6);

    const y1 = q(hz + 0.5 * (c.feet - hz)), rows = [];
    for (let y = hz + 6; y < y1; y += DOT) { const t = (y - hz) / (y1 - hz), xc = w * (0.84 + 0.22 * t) + 3 * Math.sin(t * 5); const hw = q(2 + t * 8); rows.push([y, q(xc) - hw, q(xc) + hw]); }
    L4 += P(tint(A.path), rowsPath(rows)) + sideMarks(c, hz + 10, tint(A.dark), c.tall ? 14 : 18) + sideMarks(c, hz + 14, A.acc[0], 4, (x, y) => run(x, y, 2));
    if (A.acc[1]) L4 += sideMarks(c, hz + 14, A.acc[1], 4 + (A.flowers ? 6 : 0), (x, y) => run(x, y, 2));
    const flower = A.flowers || A.acc.length > 1;
    const L5 = corners(c, tint(A.front || A.dark), tint(A.mid), (x, hgt, f, B) => (flower ? P(A.acc[1] || A.acc[0], run(x - 6 + f * 2, B - q(hgt * 0.8), 4, 4)) + P(A.acc[0], run(x + 8 + f * 2, B - q(hgt * 0.6), 2, 2)) : ''));
    const L6 = night ? fireflies(c, 4) : floaters(c, A.acc, 4);
    return { L2, L3, L4, L5, L6 };
  },

  forest(c) {
    const { A, w, hz, tint, rnd } = c, s = Math.min(w, c.h), night = c.time === 'night';
    const haze = mix(c.T.sky[3], c.T.sky[2], 0.5);
    const wall = (k, lift) => x => hz - k - Math.abs(Math.sin(x / 7 + k)) * 5 - edge(c, x) * lift;
    let L2 = P(mix(tint(A.leafB), haze, 0.45), ridge(c, wall(8, 0.16 * c.h), hz + 8)) + P(mix(tint(A.leafF), haze, 0.25), ridge(c, wall(2, 0.08 * c.h), hz + 8));
    if (A.fog) L2 += P('#ffffff', run(-4, hz - 6, w + 8, 8), ' fill-opacity=".35"');
    let L4 = ground(c, hz + 4);

    if (!night) L4 += P(tint(A.acc[0]), [0.1, 0.86, 0.2, 0.74, 0.04].map((f, i) => { const y = q(hz + 10 + ((i * 37) % 60) / 60 * (c.feet - hz - 30)); return oval(w * f, y, 5 + (i % 2) * 3, 2); }).join(''), ' fill-opacity=".7"');
    if (A.pond) L4 += P(tint(A.pond[1]), oval(w * 0.82, hz + 12, 0.16 * w, 5)) + P(tint(A.pond[0]), oval(w * 0.82, hz + 11, 0.14 * w, 3)) + P(A.acc[0], run(q(w * 0.78), hz + 10, 2));
    if (A.stone) L4 += P(tint(A.stone), oval(w * 0.12, hz + 14, 4, 4) + oval(w * 0.9, hz + 18, 5, 4) + oval(w * 0.8, hz + 10, 3, 3));
    L4 += sideMarks(c, hz + 8, tint(A.dark), c.tall ? 12 : 16);

    const tw = q(Math.max(12, w * 0.07)), gy = q(hz + 0.3 * (c.feet - hz));
    let trunk = '', bark = '', back = '', front = '', hi = '';
    for (const side of [0, 1]) {
      const tx = side ? w - q(w * 0.03) - tw : q(w * 0.03), mirror = x => (side ? w - x : x);
      trunk += run(tx, -4, tw, gy + 4) + run(tx - 2, gy - 4, tw + 4, 4) + run(tx - 4, gy - 2, tw + 8, 2);
      bark += run(side ? tx : tx + tw - 4, -4, 4, gy + 4) + [0.3, 0.5, 0.72].map(f => run(tx + 4 + (side ? 2 : 0), q(gy * f), 2, 4)).join('');

      const reach = Math.min(0.34 * s, 0.24 * w + 4), drop = c.tall ? c.h * 0.11 : 0.16 * s;
      const o = [[mirror(-4), 4, reach, drop], [mirror(0.12 * s), -6, reach * 0.8, drop * 0.75], [mirror(-4), drop * 1.7, 0.2 * s, drop * 0.6]];
      back += blob(o);
      front += blob(o.map(([x, y, a, b]) => [x + (side ? 2 : -2), y - 4, a * 0.86, b * 0.8]));
      for (let i = 0; i < 6; i++) hi += run(q(mirror(4 + rnd() * reach * 0.8)), q(2 + rnd() * drop * 1.1), 4, 2);
    }
    const L3 = P(tint(A.trunk), trunk) + P(tint(A.trunkD), bark) + P(tint(A.leafB), back) + P(tint(A.leafF), front) + P(tint(mix(A.leafF, A.light, 0.45)), hi);
    const L5 = corners(c, tint(A.leafB), tint(A.leafF));
    const L6 = night ? fireflies(c, 5) : floaters(c, [tint(A.leafF), tint(mix(A.leafF, '#c8a040', 0.5))], 3, 4);
    return { L2, L3, L4, L5, L6 };
  },

  water(c) {
    const { A, w, hz, tint, T, rnd } = c, night = c.time === 'night';
    const shore = q(hz + 0.42 * (c.feet - hz)), mid = q(hz + 0.45 * (shore - hz));
    let L2 = bands(c, [tint(A.far), tint(A.near)], hz, shore + 4, [(mid - hz) / (shore + 4 - hz)]) + P(mix(tint(A.far), '#ffffff', 0.3), run(-4, hz, w + 8, 2));

    L2 += P(tint(mix(A.grass, A.far, 0.45)), blob([[w * 0.86, hz, 0.07 * w, 5], [w * 0.9, hz, 0.05 * w, 7]], hz + 1));

    const shine = f => { let d = ''; for (let i = 0; i < 10; i++) { const x = q(i % 2 ? w * (0.74 + rnd() * 0.22) : w * (0.02 + rnd() * 0.22)), y = q(hz + 4 + ((i * 7 + f * 3) % 10) / 10 * (shore - hz - 8)); d += run(x, y, 4 + (i % 2) * 2); } return d; };
    const glint = mix(tint(A.near), '#ffffff', 0.6);
    let path = '';
    if (night || c.time === 'dusk') {
      const lx = q(c.time === 'dusk' ? w * 0.25 : w * 0.75), col = mix(night ? T.moon : T.sun, tint(A.near), 0.35);
      for (let y = hz + 2; y < shore - 2; y += 4) { const hw = q(2 + (y - hz) * 0.12); path += run(lx - hw + q(Math.sin(y) * 2), y, 2 * hw); }
      path = P(col, path);
    }
    L2 += path + twoFrames(c, P(glint, shine(0)), P(glint, shine(1)), 1);

    let foam = '';
    for (let x = -4; x < w + 4; x += 6) foam += run(x, shore - 2 - (Math.sin(x / 9) > 0.3 ? 2 : 0), 6 - (x % 12 ? 2 : 0));
    let L4 = ground(c, shore + 2) + P(mix(tint(A.near), '#ffffff', 0.75), foam);
    if (A.planks) { let d = ''; for (let y = shore + 8; y < c.h + 4; y += 10) if (Math.abs(y - c.feet) > 12) d += run(-4, y, w + 8); L4 += P(tint(A.dark), d, ' fill-opacity=".5"'); }
    L4 += sideMarks(c, shore + 4, tint(A.acc[0]), 5, (x, y) => run(x, y, 4, 2) + run(x + 2, y - 2, 2));
    if (!A.reeds) L4 += sideMarks(c, shore + 4, tint(mix(A.dark, '#8a8a8a', 0.3)), 6, (x, y) => run(x, y, 2));
    let L3 = '';
    if (A.rock) { const rx = q(w * 0.1); L3 = P(tint(A.rock), blob([[rx, shore + 2, 9, 6], [rx + 8, shore + 4, 6, 4]], shore + 6)) + P(tint(mix(A.rock, '#ffffff', 0.35)), oval(rx - 2, shore - 2, 4, 2)); }
    if (A.reeds) for (const x of [w * 0.06, w * 0.94]) L3 += P(tint(A.grass), blades(c, q(x), shore + 6, 20, 5, 0)) + P(tint('#8a6a40'), run(q(x) - 2, shore - 14, 2, 6) + run(q(x) + 4, shore - 10, 2, 6));
    const L5 = corners(c, tint(A.grass), tint(mix(A.grass, A.light, 0.35)));

    let L6 = '';
    if (night && A.reeds) L6 = fireflies(c, 4);
    else for (let i = 0; i < 4; i++) L6 += twinkle(c, P('#ffffff', run(q(i % 2 ? w * (0.78 + rnd() * 0.18) : w * (0.04 + rnd() * 0.18)), shore - 6 - q(rnd() * 6), 2)), 1.1 + i * 0.3, i * 0.6);
    return { L2, L3, L4, L5, L6 };
  },

  snow(c) {
    const { A, w, hz, tint } = c, haze = c.T.sky[3];
    const lift = q(0.08 * c.h + 6);
    const far = x => hz - 6 - edge(c, x) * lift - 3 * Math.sin(x / 15 + 2);
    const near = x => hz + 2 - edge(c, x) * lift * 0.4 - 2 * Math.sin(x / 10);
    let L2 = P(mix(tint(A.dark), haze, 0.35), ridge(c, far, hz + 8));

    let pines = '';
    for (const f of [0.04, 0.1, 0.9, 0.97]) { const x = q(w * f), y = q(far(x)) + 2; for (let k = 0; k < 8; k += 2) pines += run(x - q(k / 2), y - 10 + k, 2 + 2 * q(k / 2)); }
    L2 += P(mix(tint(A.tree), haze, 0.5), pines) + P(tint(A.mid), ridge(c, near, hz + 8));

    const gy = q(hz + 0.28 * (c.feet - hz)), big = q(Math.min(0.24 * c.h, 0.42 * w));
    let L3 = '';
    for (const [f, sc] of [[0.06, 1], [0.17, 0.7], [0.94, 1], [0.83, 0.72]]) L3 += pine(c, q(w * f), q(gy + (1 - sc) * 10), q(big * sc));
    let L4 = ground(c, hz + 6) + sideMarks(c, hz + 10, '#ffffff', c.tall ? 10 : 14, (x, y) => run(x, y, 4, 2)) + sideMarks(c, hz + 10, tint(A.acc[0]), 6, (x, y) => run(x, y, 2));
    const L5 = corners(c, tint(A.treeD), tint(A.tree), (x, hgt, f, B) => P(tint(A.light), oval(x, B, 14, q(hgt * 0.3)) + oval(x + 10, B + 2, 10, q(hgt * 0.22))));
    const L6 = floaters(c, ['#ffffff'], 6);
    return { L2, L3, L4, L5, L6 };
  },

  mountain(c) {
    const { A, w, hz, tint, rnd } = c, haze = c.T.sky[3], night = c.time === 'night', e = x => edge(c, x);
    const lift = q(0.1 * c.h + 8), far = A.far || [mix(A.mid, haze, 0.35), mix(A.dark, haze, 0.2)];

    const tri = x => Math.abs(x - Math.floor(x) - 0.5) * 2;
    const peak = (x, per, ph) => (A.dunes ? (1 + Math.sin(x / per * 2.4 + ph)) / 2 : tri(x / per + ph) ** 1.4);
    const flat = y => (A.mesa ? Math.round(y / 10) * 10 : y);
    const cx = q(w * 0.8), coneH = q(Math.min(0.16 * c.h, 0.3 * w)), coneTop = hz - 6 - coneH;
    const cone = x => (A.cone ? Math.max(coneTop, hz - 6 - coneH + Math.max(0, Math.abs(x - cx) - 6) * 1.1) : Infinity);
    const back = x => Math.min(cone(x), flat(hz - 6 - e(x) * lift * 1.3 - (0.3 + e(x)) * 16 * peak(x, 34, 0.2)));
    const front = x => flat(hz + 2 - e(x) * lift * 0.5 - (0.3 + e(x)) * 8 * peak(x, 21, 0.6));
    let L2 = P(tint(mix(far[0], haze, 0.3)), ridge(c, back, hz + 8)) + P(tint(mix(A.dark, far[1], 0.5)), ridge(c, front, hz + 8));
    if (A.cone) {

      const puff = k => blob([[cx, coneTop - 6 - k, 6, 4], [cx + 5, coneTop - 13 - k, 7, 5], [cx + 1, coneTop - 22 - k, 8, 5]]);
      L2 += P(A.acc[0], run(cx - 6, q(coneTop), 12, 2)) + twoFrames(c, P(tint(mix(A.smoke, haze, 0.3)), puff(0)), P(tint(mix(A.smoke, haze, 0.3)), puff(2)), 2.6);
    }

    const gy = q(hz + 0.3 * (c.feet - hz));
    const crag = (x, base, rw, rh, s) => P(tint(mix(A.mid, A.light, 0.25)), blob([[x, base, rw, rh], [x + s * rw * 0.7, base, rw * 0.6, rh * 0.62]], base))
      + P(tint(A.light), blob([[x - s * 2, base - rh * 0.8, rw * 0.55, rh * 0.22]])) + P(tint(A.dark), run(q(x + s * rw * 0.3), q(base - rh * 0.5), 2, q(rh * 0.4)) + run(q(x - rw * 0.8), base - 2, q(rw * 1.6), 2));
    let L3 = P(tint(A.dark), run(-4, hz + 6, w + 8, gy - hz)) + crag(q(w * 0.02), gy, q(0.16 * w), q(0.08 * c.h + 6), 1) + crag(q(w * 0.98), gy + 4, q(0.14 * w), q(0.07 * c.h + 6), -1);
    if (A.pillars) {
      const x = q(w * 0.14), y = hz + 12, sx = q(w * 0.84), sh = q(0.05 * c.h + 10);
      L3 += P(tint(A.light), run(x, y - 8, 22, 8) + run(sx, gy - sh, 10, sh) + run(sx - 2, gy - sh - 2, 6, 2)) + P(tint(A.dark), run(x + 20, y - 8, 4, 8) + run(x + 6, y - 6, 12, 2) + run(sx + 8, gy - sh, 2, sh) + run(sx + 2, gy - sh + 4, 2, sh - 8));
    } else L3 += crag(q(w * 0.18), hz + 10, 8, 6, 1);
    for (const f of [0.1, 0.28, 0.88]) L3 += P(tint(A.grass), blades(c, q(w * f), gy + 2, 8, 3, 0));
    let L4 = ground(c, gy) + sideMarks(c, gy + 4, tint(A.dark), c.tall ? 12 : 16, (x, y) => run(x, y, 2)) + sideMarks(c, gy + 4, tint(A.light), 6, (x, y) => run(x, y, 4, 2));
    if (A.dunes) L4 += sideMarks(c, gy + 6, tint(A.mid), 8, (x, y) => run(x, y, 6, 2) + run(x + 6, y - 2, 4, 2));
    L4 += sideMarks(c, gy + 8, tint(A.acc[0]), 4, (x, y) => run(x, y, 2));
    const L5 = corners(c, tint(mix(A.grass, A.dark, 0.45)), tint(A.grass), (x, hgt, f, B) => P(tint(A.mid), oval(x + 10, B, 8, q(hgt * 0.18))));

    let L6 = floaters(c, [tint(mix(A.light, '#ffffff', 0.3))], 3);
    if (!night) { const x = q(w * 0.84), y = q(c.top + 0.3 * (hz - c.top)); L6 += anim(c, 'pkbS 6s steps(3) infinite alternate', P(tint(mix(far[1], '#3a4a5a', 0.45)), run(x, y, 2) + run(x + 2, y + 2, 2) + run(x + 4, y, 2)), '--dx:6px;'); }
    if (A.cone) for (let i = 0; i < 3; i++) { const y = q(coneTop - 4 - rnd() * 30); L6 += fall(c, P(A.acc[0], run(cx - 4 + i * 4, y, 2)), y, 7 + i * 2, 2, true); }
    return { L2, L3, L4, L5, L6 };
  },

  town(c) {
    const { A, w, hz, tint, rnd } = c, haze = c.T.sky[3], night = c.time === 'night';
    const gy = q(hz + 0.24 * (c.feet - hz)), lit = [];
    let L2 = '';
    if (A.towers) {

      const d = ['', ''];
      let win = '';
      for (let x = -4, i = 0; x < w + 4; i++) {
        const bw = q(14 + rnd() * 12), bh = q(10 + edge(c, x + bw / 2) * 0.24 * c.h + rnd() * 10);
        d[i % 2] += run(x, hz - bh, bw, bh + 8);
        if (edge(c, x + bw / 2) > 0.4) for (let y = hz - bh + 4; y < hz - 4; y += 6) for (let k = x + 2; k < x + bw - 2; k += 4) win += run(k, y, 2);
        x += bw;
      }
      L2 = P(tint(mix(A.towers[0], haze, 0.3)), d[0]) + P(tint(mix(A.towers[1], haze, 0.3)), d[1]) + P(night ? LIT : tint(mix(A.win, haze, 0.2)), win, night ? ' fill-opacity=".7"' : '');
    } else L2 = P(tint(mix(A.roof[1], haze, 0.6)), ridge(c, x => hz - 2 - edge(c, x) * 12 - 4 * (Math.floor((x + 40) / 18) % 3), hz + 8));
    L2 += P(tint(mix(GREEN, haze, 0.35)), ridge(c, x => hz + 2 - 2 * (Math.sin(x / 5) > 0 ? 1 : 0), hz + 8)) + P(tint(mix(A.dark, haze, 0.2)), run(-4, hz + 8, w + 8, gy - hz));

    const house = (x0, x1, base, hh, i) => {
      const hw = x1 - x0, rh = q(hh * 0.62), mid = q((x0 + x1) / 2), roof = tint(A.roof[i % 3]);
      let r = '';
      for (let k = 0; k < rh; k += DOT) { const s = q(((k + 2) / rh) * (hw / 2 + 2)); r += run(mid - s, base - hh - rh + k, 2 * s); }
      const ws = q(Math.max(4, hw * 0.16)), wy = base - hh + q(hh * 0.25), wx = [x0 + q(hw * 0.14), x1 - q(hw * 0.14) - ws - 4];
      const dw = q(Math.max(4, hw * 0.14)), dh = q(hh * 0.45);
      wx.forEach(x => lit.push([x, wy, ws]));
      let s = P(tint(A.wall[0]), run(x0, base - hh, hw, hh)) + P(tint(A.wall[1]), run(x1 - 6, base - hh, 6, hh));
      if (A.brick) { let b = ''; for (let y = base - hh + 4; y < base - 2; y += 6) for (let x = x0 + (y % 4) * 2; x < x1 - 2; x += 8) b += run(x, y, 4, 2); s += P(tint(mix(A.wall[0], A.dark, 0.35)), b); }
      return s + P(roof, r) + P(tint(mix(roof, '#5a3a3a', 0.3)), run(mid - q(hw / 2 + 2), base - hh - 2, 2 * q(hw / 2 + 2), 2))
        + P(night ? LIT : tint(A.win), wx.map(x => run(x, wy, ws, ws)).join('')) + P(tint('#ffffff'), wx.map(x => run(x - 2, wy + ws, ws + 4, 2)).join(''))
        + P(tint(mix(roof, '#6a4630', 0.5)), run(mid - q(dw / 2), base - dh, dw, dh));
    };
    const hh = q(Math.min(0.12 * c.h, 0.2 * w)), sm = q(hh * 0.62);
    let L3 = house(-8, q(w * 0.22), gy, hh, 0) + house(q(w * 0.78), w + 8, gy + 2, hh, 1);
    if (A.board) {
      const bx = q(w * 0.64), cones = [0.3, 0.7].map(f => { const x = q(w * f); let d = ''; for (let k = 0; k < 10; k += DOT) d += run(x - q(k / 3) - 2, gy - 10 + k, 4 + 2 * q(k / 3)); return d; }).join('');
      L3 += P(tint(A.board), run(bx, gy - 4, 26, 4) + run(bx + 2, gy - 8, 22, 4) + run(bx + 4, gy - 12, 18, 4)) + P(tint(mix(A.board, A.dark, 0.5)), run(bx, gy - 6, 26, 2) + run(bx + 2, gy - 10, 22, 2))
        + P(tint(A.acc[0]), cones) + P(tint('#ffffff'), [0.3, 0.7].map(f => run(q(w * f) - 4, gy - 6, 8, 2)).join(''));
    } else L3 = house(q(w * 0.6), q(w * 0.74), gy - 4, sm, 2) + L3;
    let posts = '';
    for (const [a, b] of [[q(w * 0.22), q(w * 0.36)], [q(w * 0.64), q(w * 0.78)]]) { posts += run(a, gy - 6, b - a, 2); for (let x = a; x < b; x += 6) posts += run(x, gy - 8, 2, 8); }
    L3 += P(tint(mix(A.wall[1], '#a87850', 0.35)), posts);

    const beds = [[0, q(w * 0.2)], [q(w * 0.8), w]];
    let L4 = ground(c, gy) + P(tint(GREEN), beds.map(([a, b]) => run(a, gy + 2, b - a, 4)).join('')) + P('#ffb8cc', beds.map(([a, b]) => run(a + 4, gy + 2, 2) + run(b - 10, gy + 2, 2)).join(''));
    L4 += sideMarks(c, gy + 10, tint(mix(A.mid, A.dark, 0.5)), c.tall ? 10 : 14, (x, y) => run(x, y, 6, 2));
    const L5 = corners(c, tint(mix(GREEN, '#3a6a3a', 0.4)), tint(GREEN), (x, hgt, f, B) => P('#fff4a0', run(x - 6 + f * 2, B - q(hgt * 0.7), 4, 4)));

    let L6 = '';
    if (night) lit.slice(0, 4).forEach(([x, y, s], i) => { if (i % 2 === 0) L6 += twinkle(c, P('#fff8d8', run(x, y, s, s)), 2.2 + i * 0.6, i); });
    else for (let i = 0; i < 3; i++) { const x = q(i % 2 ? w * (0.8 + rnd() * 0.12) : w * (0.06 + rnd() * 0.12)), y = q(gy + 12 + rnd() * 20); L6 += anim(c, `pkbS ${2 + i * 0.7}s steps(2) infinite alternate`, P(tint('#a0a8b4'), run(x, y, 4, 2) + run(x + 4, y - 2, 2, 2)), '--dx:2px;'); }
    return { L2, L3, L4, L5, L6 };
  },

  indoor(c) {

    const { A, w, hz, top, T } = c, night = c.time === 'night';
    const fy = q(hz + 0.35 * (c.feet - hz)), lowY = q(fy - Math.max(10, 0.22 * (fy - top))), wd = A.wall;
    const line = t => mix(wd, A.dark, t);
    let L0 = P(line(0.3), run(-4, -4, w + 8, top + 2)) + P(line(0.5), run(-4, top - 2, w + 8, 2)) + P(wd, run(-4, top, w + 8, lowY - top)) + P(A.low, run(-4, lowY, w + 8, fy - lowY))
      + P(mix(A.low, A.dark, 0.35), run(-4, lowY, w + 8, 2) + run(-4, fy - 2, w + 8, 2));

    let seam = '';
    if (A.stripe) L0 += P(A.stripe, run(-4, q(top + 0.55 * (lowY - top)), w + 8, 4));
    if (A.seams || A.hazard) for (let x = 10; x < w; x += A.hazard ? 24 : 14) seam += run(x, top, 2, lowY - top);
    if (A.pillar) for (let y = top + 12, k = 0; y < lowY; y += 12, k++) { seam += run(-4, y, w + 8, 2); for (let x = (k % 2) * 10; x < w; x += 20) seam += run(x, y - 10, 2, 10); }
    L0 += P(line(0.12), seam);
    if (A.hazard) {
      let st = '';
      for (const [a, b] of [[-4, q(w * 0.22)], [q(w * 0.78), w + 4]]) for (let y = lowY + 2; y < fy - 2; y += DOT) for (let x = a - 8 + ((y - lowY) % 8); x < b; x += 8) { const s = Math.max(a, x), t = Math.min(b, x + 4); if (t > s) st += run(s, y, t - s); }
      L0 += P(A.acc[0], run(-4, lowY + 2, q(w * 0.22) + 4, fy - lowY - 4) + run(q(w * 0.78), lowY + 2, q(w * 0.22) + 4, fy - lowY - 4)) + P(line(0.4), st);
    }

    const wx = q(w * (A.pillar ? 0.1 : 0.06)), wy = q(top + 0.22 * (lowY - top)), wh = q(0.5 * (lowY - top)), ww = q(Math.min(0.2 * w, wh * 1.4));
    const wood = A.fur || mix(A.dark, '#6a4630', 0.35);
    const L2 = roomWindow(c, wx, wy, ww, wh);

    const shx = q(w * 0.78), shy = q(fy - Math.max(16, 0.3 * (fy - top))), shh = fy - shy, lx = q(w * 0.88);
    const books = ['#7aa8d0', A.acc[0], '#a8c890', '#e8c070'];
    let L3 = P(mix(A.lamp || '#fff0c0', wd, 0.5), oval(lx, top + 14, 9, 7)) + P(wood, run(lx, top, 2, 8) + run(shx, shy, w + 4 - shx, shh)) + P(A.lamp || '#fff0c0', run(lx - 4, top + 12, 10, 4)) + P(mix(wood, '#3a2a2a', 0.2), run(lx - 6, top + 8, 14, 4));
    L3 += P(mix(wood, '#3a2a2a', 0.25), run(shx + 2, shy + 2, w - shx, q(shh / 2) - 4) + run(shx + 2, shy + q(shh / 2), w - shx, q(shh / 2) - 2));
    for (let k = 0, x = shx + 4; x < w - 2; k++, x += 4) L3 += P(books[k % 4], run(x, shy + q(shh / 2) - 2 - (k % 3 ? 8 : 6), 2, k % 3 ? 8 : 6));
    L3 += P(A.pot || '#c8805a', run(shx + 6, shy - 6, 8, 6)) + P(mix(GREEN, '#3a6a3a', 0.3), blob([[shx + 10, shy - 8, 6, 4]]));
    if (A.pillar) for (const x of [-4, w - q(w * 0.05)]) L3 += P(A.pillar, run(x, top, q(w * 0.05) + 4, fy - top)) + P(mix(A.pillar, A.dark, 0.3), run(x - 2, top, q(w * 0.05) + 8, 4) + run(x - 2, fy - 4, q(w * 0.05) + 8, 4));

    let lines = '';
    for (let y = fy + 4, gap = 4; y < c.h + 4; y += gap, gap += 2) if (Math.abs(y - c.feet) > 14) lines += run(-4, y, w + 8);
    const L4 = ground(c, fy) + P(A.dark, lines, ' fill-opacity=".35"') + P(mix(A.acc[0], A.light, 0.2), oval(w / 2, c.feet + 4, 0.34 * w, 16)) + P(mix(A.acc[0], A.light, 0.55), oval(w / 2, c.feet + 4, 0.34 * w - 4, 14));

    const L5 = corners(c, '#4f8e3e', '#78b856', (x, hgt, f, B) => P(A.pot || '#c8805a', run(x - 8, B - 14, 16, 16)) + P(mix(A.pot || '#c8805a', '#ffffff', 0.25), run(x - 10, B - 16, 20, 4)));

    let L6 = '';
    if (!night) {
      const rows = [], end = Math.min(c.feet - 16, fy + 0.6 * (c.feet - fy));
      for (let y = fy + 2; y < end; y += DOT) { const s = q((y - fy) * 0.6); rows.push([y, wx + s, wx + ww + s]); }
      L6 = P(T.sun, rowsPath(rows), ' fill-opacity=".28"');
      for (let i = 0; i < 3; i++) L6 += twinkle(c, P('#ffffff', run(q(wx + ww * (0.3 + i * 0.3) + i * 4), q(wy + wh + 8 + i * 10), 2)), 1.6 + i * 0.5, i * 0.7);
    }
    return { L0, L2, L3, L4, L5, L6 };
  },

  cave(c) {

    const { A, w, hz, rnd } = c, [w1, w2] = A.wall, sea = !!A.ray;
    const back = A.stars ? w1 : mix(w1, sea ? A.ray : A.light, 0.55);
    const L0 = bands(c, [mix(w2, back, 0.4), mix(w1, back, 0.6), back], -4, hz + 8, [0.3, 0.62]);

    const cx = q(w / 2), rx = 0.4 * w, cy = hz + 8, ry = cy - c.top * 0.3;
    const half = y => { const t = (y + 1 - cy) / ry; return Math.abs(t) < 1 ? q(rx * Math.sqrt(1 - t * t) + 3 * Math.sin(y / 6)) : 0; };
    const outer = [], rim = [];
    for (let y = -4; y < hz + 8; y += DOT) {
      const hw = half(y);
      if (hw <= 0) { outer.push([y, -4, w + 4]); continue; }
      outer.push([y, -4, cx - hw - 4], [y, cx + hw + 4, w + 4]);
      rim.push([y, cx - hw - 4, cx - hw], [y, cx + hw, cx + hw + 4]);
    }
    let drips = '';
    for (const f of A.icicles ? [0.16, 0.22, 0.3, 0.7, 0.78, 0.84] : [0.18, 0.28, 0.74, 0.84]) {
      const x = q(w * f), t = (x + 1 - cx) / rx, y0 = q(cy - ry * Math.sqrt(Math.max(0, 1 - t * t))), len = A.icicles ? 10 + (x % 3) * 2 : 6;
      for (let k = 0; k < len; k += DOT) drips += run(x - (k < len / 2 ? 2 : 0), y0 + k, k < len / 2 ? 6 : 2);
    }
    let L2 = P(w2, rowsPath(outer)) + P(w1, rowsPath(rim)) + P(A.icicles ? '#ffffff' : w1, drips);

    for (let i = 0; i < (c.photo ? 0 : 6); i++) L2 += P(mix(w1, w2, 0.5), oval(q(i % 2 ? w * (0.9 + rnd() * 0.08) : w * (0.02 + rnd() * 0.08)), q(c.top + rnd() * (hz - c.top)), 4, 3));

    if (sea) {
      let d = '';
      for (const x0 of [0.04, 0.16, 0.8]) for (let y = -4; y < hz; y += DOT) d += run(q(w * x0 + y * 0.2), y, 8);
      L2 += P(A.ray, d, ' fill-opacity=".3"');
    } else {
      const glow = c.time === 'morning' ? mix(A.glow, c.T.sky[3], 0.5) : c.time === 'dusk' ? mix(A.glow, c.T.sun, 0.45) : A.glow, ex = q(w * (c.photo ? 0.7 : 0.76));

      const ey = c.photo ? q(hz * 0.4) : hz + 4, cut = c.photo ? Infinity : hz + 4;
      L2 += P(mix(glow, back, 0.55), blob([[ex, ey, 13, 12]], cut)) + P(glow, blob([[ex, ey, 8, 9]], cut));
    }

    const crystal = (x, base, hgt) => { let l = '', r = ''; for (let k = 0; k < hgt; k += DOT) { const s = Math.min(4, k + 2); l += run(x - s, base - hgt + k, s); r += run(x, base - hgt + k, s); } return P(A.stars ? A.glow : A.acc[0], l) + P(mix(A.stars ? A.glow : A.acc[0], w2, 0.45), r); };
    const spots = [[q(w * 0.08), hz + 4, 14], [q(w * 0.08) + 6, hz + 6, 8], [q(w * 0.92), hz + 2, 12], [q(w * 0.92) - 6, hz + 6, 6]];
    const L3 = sea ? [0.06, 0.18, 0.86].map(f => P(A.weed, blades(c, q(w * f), hz + 10, 26, 4, 0)) + P(mix(A.weed, A.light, 0.3), blades(c, q(w * f) + 2, hz + 10, 16, 2, 0))).join('')
      : spots.map(([x, y, hgt]) => crystal(x, y, hgt)).join('');
    const L4 = ground(c, hz + 4) + sideMarks(c, hz + 8, A.dark, c.tall ? 10 : 14, (x, y) => run(x, y, 6, 4) + run(x + 2, y - 2, 2)) + sideMarks(c, hz + 8, A.light, 6, (x, y) => run(x, y, 4, 2));

    const B = q(c.h) + 2, hgt = q(Math.min((c.h - c.feet) * 0.45, c.tall ? 40 : 22));
    const L5 = sea ? corners(c, mix(A.weed, w2, 0.3), A.weed) : (c.tall ? [0.07, 0.93] : [0.14, 0.8]).map((f, i) => {
      const x = q(w * f), s = i ? -1 : 1;
      return P(w2, blob([[x, B, 16, hgt * 0.5], [x + s * 12, B, 10, hgt * 0.8]], B)) + P(w1, oval(x + s * 10, B - hgt * 0.62, 4, 2)) + crystal(x - s * 6, B - q(hgt * 0.3), q(hgt * 0.5));
    }).join('');

    let L6 = '';
    const drop = mix(A.acc[0], '#ffffff', 0.4);
    if (sea) for (let i = 0; i < 5; i++) { const x = q(i % 2 ? w * (0.8 + rnd() * 0.16) : w * (0.04 + rnd() * 0.16)), y = q(c.top + rnd() * (c.feet - c.top)); L6 += fall(c, P(A.acc[0], run(x, y - 2, 2) + run(x - 2, y, 2) + run(x + 2, y, 2) + run(x, y + 2, 2)), y, 9 + i * 2, 2, true); }
    else {
      spots.forEach(([x, y, k], i) => { if (i % 2 === 0) L6 += twinkle(c, P('#ffffff', run(x - 2, y - k + 2, 2) + run(x - 4, y - k + 4, 6, 2) + run(x - 2, y - k + 6, 2)), 1.4 + i * 0.4, i * 0.5); });
      for (const f of [0.18, 0.84]) { const x = q(w * f), y = q(hz * 0.5); L6 += fall(c, P(drop, run(x, y, 2, 4)), y, 10 + f * 4, 0); }
    }
    if (A.stars) for (let i = 0; i < 10; i++) {
      const x = q(i % 2 ? w * (0.82 + rnd() * 0.16) : w * (0.02 + rnd() * 0.16)), y = q(c.top + rnd() * (hz - c.top)), big = i % 3 === 0;
      const dots = big ? run(x - 2, y, 6) + run(x, y - 2, 2) + run(x, y + 2, 2) : run(x, y, 2);
      L6 += i % 3 === 1 ? twinkle(c, P(A.acc[0], dots), 1.5 + (i % 3) * 0.7, i * 0.4) : P(A.acc[0], dots);
    }
    return { L0, L2, L3, L4, L5, L6 };
  },
};

export function roomWindow(c, wx, wy, ww, wh) {
  const { A, T } = c, wood = A.fur || mix(A.dark, '#6a4630', 0.35), half = q(wh / 2);
  const sx = q(wx + ww * 0.68), sy = q(wy + wh * (c.time === 'dusk' ? 0.55 : 0.28));
  return P(T.sky[1], run(wx, wy, ww, half)) + P(T.sky[3], run(wx, wy + half, ww, wh - half))
    + (c.time === 'night' ? P(T.moon, oval(sx, sy, 3, 3)) + P(T.star, run(wx + 4, wy + 4, 2) + run(q(wx + ww * 0.4), wy + 8, 2))
      : c.time === 'dusk' ? P(T.sun, oval(sx, sy, 3, 3)) : P(T.cloud, blob([[sx, sy, 5, 2], [sx - 4, sy + 2, 3, 2]])))
    + P(tintWith(T.land)('#9cc8a0'), blob([[wx + ww * 0.3, wy + wh, ww * 0.3, 8], [wx + ww * 0.72, wy + wh, ww * 0.28, 6]], wy + wh))
    + P(wood, run(wx - 2, wy - 2, ww + 4, 2) + run(wx - 2, wy + wh, ww + 4, 2) + run(wx - 2, wy, 2, wh) + run(wx + ww, wy, 2, wh) + run(q(wx + ww / 2 - 1), wy, 2, wh) + run(wx, wy + half - 2, ww, 2) + run(wx - 8, wy - 6, ww + 16, 2))
    + P(mix(wood, '#ffffff', 0.35), run(wx - 4, wy + wh + 2, ww + 8, 2)) + P(mix(A.acc[0], A.wall, 0.45), run(wx - 6, wy - 4, 6, wh + 6) + run(wx + ww, wy - 4, 6, wh + 6));
}

export function pine(c, x, base, hgt) {
  const { A, tint } = c, th = q(hgt * 0.42);
  let dark = run(x - 2, base - 6, 4, 6), light = '', snow = '';
  for (let k = 0; k < 3; k++) {
    const top = q(base - hgt + k * hgt * 0.27), wmax = hgt * (0.17 + k * 0.06);
    for (let r = 0; r < th; r += DOT) {
      const hw = q(Math.max(2, wmax * (r + 2) / th)), y = top + r;
      if (r < th * 0.3) snow += run(x - hw, y, 2 * hw);
      else { light += run(x - hw, y, hw); dark += run(x, y, hw); if (r >= th - 2) snow += run(x - hw, y, 4) + run(x + hw - 6, y, 2); }
    }
  }
  return P(tint(A.treeD), dark) + P(tint(A.tree), light) + P(tint('#ffffff'), snow);
}

export function petScene(options = {}) {
  const c = context(options), roof = ROOFED.has(c.A.kind);
  return wrap(c, { L0: roof ? '' : sky(c), L1: roof ? '' : skyThings(c), ...KINDS[c.A.kind](c) }, options);
}

export const petMarks = options => { const c = context(options); return { feet: c.feet, horizon: c.hz, top: c.top, art: c.art, drawn: c.drawn }; };

export function headMarks({ w = 180, h = 390, px } = {}) {
  const F = h > w ? SCENE_FRAME.tall : SCENE_FRAME.wide, top = F.bar / (px || F.ref);
  const kx = Math.min(0.85, (w * 0.34) / 100), ky = (h - top - 4) / 600, feet = h - 4;
  const fy = ly => feet - (ly + 120) * ky;
  return { top, feet, kx, ky, slots: HEAD_LAYOUT.slots.map(lx => w / 2 + lx * kx), head: fy(-10), just: fy(HEAD_LAYOUT.justY), justH: HEAD_LAYOUT.justH * ky, ball: Math.max(10, 90 * ky * 0.75) };
}

export function headItScene(options = {}) {
  const c = context(ROOFED.has(PLACE_ART[placeArt(options.place).art].kind) ? { ...options, place: 'plains' } : options), m = headMarks(options), { w, h, rnd } = c;
  const skyCols = HEAD_SKY[c.time], gy = q(h - 22), A = c.A;
  const L0 = bands(c, skyCols, -4, gy + 4, [0.3, 0.56, 0.8], false)
    + P(mix(skyCols[3], '#ffffff', 0.16), run(-4, q(m.just - Math.max(20, Math.min(30, m.justH)) / 2), w + 8, q(Math.max(20, Math.min(30, m.justH)))));

  const soft = mix(skyCols[2], c.T.cloud, c.time === 'night' ? 0.3 : 0.5);
  const sides = [[0, 0.3], [w, 0.48], [0, 0.66]].map(([x, f]) => { const y = q(m.top + f * (gy - m.top)), r = q(c.tall ? 16 : 12); return blob([[x, y, r, r * 0.55], [x + (x ? -r : r) * 0.6, y + 4, r * 0.6, r * 0.35]]); }).join('');
  const low = blob([[w * 0.2, gy, 0.16 * w, 7], [w * 0.5, gy + 2, 0.18 * w, 6], [w * 0.82, gy, 0.15 * w, 8]], gy + 2);
  const L1 = anim(c, 'pkbS 40s steps(4) infinite alternate', P(soft, sides), '--dx:4px;') + P(mix(skyCols[3], c.T.cloud, 0.35), low);

  const top = x => gy - (Math.sin(x * 0.9) > 0.55 ? 2 : 0);
  const kind = A.kind;
  let L4 = P(c.tint(A[A.bands[2]]), ridge(c, top, h + 4)) + P(c.tint(A[A.bands[1]]), run(-4, gy + 8, w + 8, 6)) + P(c.tint(A[A.bands[0]]), run(-4, gy + 14, w + 8, 12));
  const gaps = [], spots = m.slots.slice().sort((a, b) => a - b), clear = q(Math.max(22, 0.12 * w));
  [-8, ...spots, w + 8].reduce((a, b) => { if (b - a > 2 * clear + 6) gaps.push(q((a + b) / 2)); return b; });
  let props = '';
  for (const x of gaps) {
    if (kind === 'water') props += P(c.tint(A.rock || '#b8b0a0'), oval(x, gy + 2, 5, 3)) + P(c.tint(A.acc[0]), run(x + 8, gy + 6, 4, 2));
    else if (kind === 'snow') props += P(c.tint(A.light), oval(x, gy + 2, 7, 4)) + P(c.tint(A.tree), blades(c, x + 6, gy + 2, 6, 3, 0));
    else props += P(c.tint(A.dark), blades(c, x, gy + 4, 8 + q(rnd() * 4), 4, 0)) + P(c.tint(mix('#a8a49a', A.light, 0.3)), oval(x + 9, gy + 4, 3, 2));
  }
  const fever = options.fever
    ? anim(c, 'pkbF 1s steps(4) infinite alternate', P('#ffd27a', run(-4, -4, 10, h + 8) + run(w - 6, -4, 10, h + 8)), 'opacity:.8;') : '';
  return wrap(c, { L0, L1, L4: L4 + props, fever }, options);
}

export const BANNERS = Object.freeze({ ready: '#23435f', go: '#5cc85a', timeUp: '#f08a3a', done: '#4aa8e8', record: '#ffd84a' });

export function bannerSvg({ kind = 'go', width = 370, height = 60 } = {}) {
  const base = BANNERS[kind] || BANNERS.go, dot = Math.max(3, Math.round(height / 15));
  const W = Math.floor(width / dot), H = Math.floor(height / dot) - 1, n = Math.round(H * 0.32), mid = (H - 1) / 2;
  const cut = r => Math.round(n * (1 - Math.abs(r - mid) / mid));
  const shape = (inset, from = 0, to = H) => { let d = ''; for (let r = from + inset; r < to - inset; r++) { const x = cut(r) + inset; d += `M${x} ${r}h${W - 2 * x}v1h${2 * x - W}z`; } return d; };
  const line = r => `M${cut(r) + 1} ${r}h${W - 2 * cut(r) - 2}v1h${2 * cut(r) + 2 - W}z`;
  const ink = mix(base, '#0e1a26', 0.55), light = mix(base, '#ffffff', 0.35), dark = mix(base, '#0e1a26', 0.22);
  const gem = x => `M${x} ${Math.floor(mid) - 1}h1v1h1v1h-1v1h-1v-1h-1v-1h1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H + 1}" width="${W * dot}" height="${(H + 1) * dot}" shape-rendering="crispEdges">`
    + P('#1a3247', shape(0).replace(/M(\d+) (\d+)/g, (_, x, y) => `M${x} ${+y + 1}`), ' fill-opacity=".45"') + P(ink, shape(0)) + P(base, shape(1))
    + P(light, line(1)) + P(dark, line(H - 2)) + P(light, gem(n + 3) + gem(W - n - 4)) + '</svg>';
}
