import { DOT, q, ROOFED, KINDS, SCENE_FRAME, GREEN, mix, tintWith, P, run, rowsPath, blob, oval, ridge, edge, drift, context, wrap, bands, sideMarks, fireflies, pine, roomWindow, blades } from './amie-scenes.js';

export const GAME_LAYOUT = Object.freeze({
  berry: { crown: 0.16, ground: 0.72, spots: [0.5, 0.17, 0.83], spread: 0.86, gap: 28, zig: [-4, 6], tall: 48, tallH: 0.26, bubble: 16 },
  tile: { mons: [[0.2, 0.55], [0.8, 0.55], [0.5, 0.8]], feet: 3, side: 12, grids: { easy: { cols: 5, rows: 4 }, normal: { cols: 6, rows: 5 }, hard: { cols: 8, rows: 6 } } },
});

const BERRY = { light: '#a6dc78', mid: '#86c862', dark: '#68ac50', front: '#4ea04e', back: '#3a8644', rim: '#78c060', gap: '#e6f4b4', gapRim: '#c8e690',
  twig: '#7a5434', bark: '#a8784c', grass: '#5e9e48', hedge: '#6aa860', fleck: '#d6ec9a' };

export function berryMarks({ w = 180, h = 390, px, kinds = 3 } = {}) {
  const B = GAME_LAYOUT.berry, F = h > w ? SCENE_FRAME.tall : SCENE_FRAME.wide, top = F.bar / (px || F.ref);
  const crown = top + B.crown * h, gap = Math.min(B.gap, (w * B.spread) / kinds), tall = Math.min(B.tall, B.tallH * h), feet = h - 4;
  return { top, crown, gap, ground: B.ground * h, feet, tall, bubble: feet - tall - B.bubble, spots: B.spots.map(f => f * w), size: gap < 24 ? 18 : 20,
    hang: Array.from({ length: kinds }, (_, i) => ({ x: w / 2 + (i - (kinds - 1) / 2) * gap, y: crown + B.zig[i % 2] })) };
}

export function berryScene(options = {}) {
  const { w = 180, h = 390 } = options, m = berryMarks(options), c = context({ ...options, place: 'berry' }), { T, tint, rnd, tall } = c, B = BERRY;
  const gy = q(m.ground), crown = q(m.crown), cb = q(m.crown + 0.14 * h), band = y => Math.abs(y - crown) < 18;
  c.feet = h - 4;

  const sk = [cb - 10, cb + (gy - cb) * 0.35, cb + (gy - cb) * 0.7].map(y => (y + 4) / (gy + 8));
  const L0 = bands(c, T.sky, -4, gy + 4, sk);
  const hh = q(Math.max(8, Math.min(18, 0.045 * h))), cs = q(tall ? 10 : 7);
  let shade = '', cloud = '', L1 = '';
  [0.12, 0.88].slice(0, gy - hh - cb > 40 ? 2 : 1).forEach((f, i) => {
    const cx = q(w * f), cy = q(cb + (0.3 + i * 0.25) * (gy - hh - cb)), o = [[cx, cy, cs, cs * 0.5], [cx - cs * 0.8, cy + 2, cs * 0.6, cs * 0.36], [cx + cs * 0.8, cy + 2, cs * 0.6, cs * 0.4]];
    shade += blob(o.map(([x, y, a, b]) => [x, y + 2, a, b]), cy + cs * 0.4 + 2);
    cloud += blob(o, cy + cs * 0.4);
  });
  L1 += drift(c, P(T.shade, shade) + P(T.cloud, cloud), w + 64, 3);
  if (c.time === 'night') for (const f of [0.06, 0.3, 0.72, 0.94]) L1 += P(T.star, run(q(w * f), q(cb + 6 + (f * 37 % 1) * (gy - hh - cb - 16)), 2));

  const hedge = (k, ph) => x => gy - hh * k * (0.55 + 0.45 * Math.abs(Math.sin(x / 7 + ph + Math.sin(x / 17) * 2))) * (0.6 + 0.4 * Math.min(1, edge(c, x) * 6));
  const L2 = P(tint(B.hedge), ridge(c, hedge(1, 0), gy + 2)) + P(tint(mix(B.hedge, B.back, 0.4)), ridge(c, hedge(0.6, 2), gy + 2));

  const tw = q(Math.min(0.1 * w, 24)), b0 = q(m.bubble - 22), b1 = q(m.bubble + 18), by = cb + 14;
  let trunk = '', lit = '', bark = '';
  for (const [x0, s] of [[-q(tw / 3), 1], [w - tw + q(tw / 3), -1]]) {
    trunk += run(x0, crown, tw, gy + 6 - crown);
    for (let k = 0; k < 30; k += DOT) trunk += run(s > 0 ? x0 + tw - 2 + k : x0 - k - 2, q(by - k * 0.6), 4, 4);
    lit += run(x0, crown, 4, gy + 6 - crown) + run(x0, b0, tw, b1 - b0);
    [0.35, 0.6, 0.85].forEach((f, k) => { const y = q(crown + f * (gy - crown)); if (y < b0 - 4 || y > b1) bark += run(x0 + 6 + (k % 2) * 4, y, 2, 4); });
  }
  let L3 = P(tint(B.twig), trunk) + P(tint(B.bark), lit) + P(tint(mix(B.twig, '#3a2a1a', 0.35)), bark);

  const bottom = x => cb + (tall ? 6 : 5) * Math.sin(x / 11 + 1) - (tall ? 10 : 0) * Math.max(0, 1 - Math.abs(x - w / 2) / (0.2 * w));
  const back = [], body = [];
  for (let x = -8; x < w + 12; x += 12) back.push([x, bottom(x) - 8, 9 + rnd() * 4, 8 + rnd() * 2]);
  for (let x = -8; x < w + 12; x += 16) body.push([x, bottom(x) - 14, 12 + rnd() * 6, 10]);
  const rim = tint(c.time === 'dusk' ? mix(B.rim, '#e8c070', 0.3) : B.rim), front = tint(B.front), shadeC = tint(B.back), vein = tint(mix(B.front, B.back, 0.5));
  L3 += P(shadeC, run(-4, -4, w + 8, cb - 10) + blob(back)) + P(front, run(-4, -4, w + 8, cb - (tall ? 24 : 12)) + blob(body));
  const clump = (x, cy, rx, ry) => {
    const calm = band(cy);
    let d = '';
    if (!calm) for (let k = 2 + (rnd() * 2 | 0); k > 0; k--) d += run(q(x - rx / 2 + rnd() * rx), q(cy + rnd() * ry * 0.6), 4, 2);
    return calm ? P(front, oval(x, cy, rx, ry)) : P(shadeC, oval(x, cy + 2, rx, ry)) + P(rim, oval(x - 2, cy - 2, rx, ry)) + P(front, oval(x, cy, rx, ry)) + P(vein, d);
  };
  const big = tall ? [6, 16] : [5, 12];
  for (let x = -4 + rnd() * 6; x < w + 8;) { const rx = big[0] + rnd() * big[1], ry = rx * 0.6; L3 += clump(x, bottom(x) - ry - 2, rx, ry); x += rx * 1.4 + rnd() * 8; }
  for (const [x, s] of [[-2, 1], [w + 2, -1]]) L3 += clump(x, m.top + 6, big[0] + big[1] * 0.8, (big[0] + big[1] * 0.8) * 0.6) + clump(x + s * (big[0] + 14), m.top + 14, big[0] + 2, big[0]);

  let fleck = '';
  for (let i = 0, n = tall ? 5 : 6; i < n; i++) {
    const x = q(w * (i + 0.2 + rnd() * 0.6) / n), y = q(i === 0 || i === n - 1 ? m.top + 4 + rnd() * 8 : bottom(x) - 20 + rnd() * 8);
    if (band(y) || band(y + 6)) continue;
    fleck += i % 2 ? run(x, y, 2) + run(x - 2, y + 2, 6, 2) + run(x, y + 4, 2) : run(x, y, 2) + run(x + 2, y + 2, 2);
  }
  L3 += P(tint(B.fleck), fleck);

  const L4 = bands(c, [B.dark, B.mid, B.light].map(tint), gy, h + 4, [6 / (h + 4 - gy), 0.3]) + sideMarks(c, gy, tint(B.dark), 6)
    + sideMarks(c, gy, '#fff4a0', 2, (x, y) => run(x, y, 2)) + sideMarks(c, gy, '#ffb8cc', 2, (x, y) => run(x, y, 2));
  const L6 = c.time === 'night' ? fireflies({ ...c, hz: gy - 20, feet: gy + 20 }, 3) : '';
  return wrap(c, { L0, L1, L2, L3, L4, L6 }, options);
}

export function berryGapSvg({ size = 20 } = {}) {
  const r = size / 2, B = BERRY;
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-14 -16 28 32" width="14" height="16" shape-rendering="crispEdges">'
    + P(B.front, oval(0, 0, r, r)) + P(B.gapRim, oval(0, 0, r - 2, r - 2)) + P(B.gap, oval(0, 0, r - 4, r - 4)) + P(B.twig, run(0, -14, 2, 6)) + P(B.front, run(2, -16, 4, 2)) + '</svg>';
}

export function berryFrontGrass({ time } = {}) {
  const tint = tintWith(context({ time }).T.land);
  return [0, 1].map(f => {
    let body = run(0, 4, 28, 2), tip = '';
    for (let x = 0; x < 28; x += 4) { const hgt = [6, 4, 6, 2, 4, 6, 4][x / 4]; body += run(x, 8 - hgt, 2, hgt - 4 + 2); tip += run(x + (hgt > 2 ? f * 2 : 0), 6 - hgt, 2, 2); }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 6" width="14" height="3" shape-rendering="crispEdges">${P(tint(BERRY.grass), body)}${P(tint(BERRY.mid), tip)}</svg>`;
  });
}

export const hardCell = (w, h) => { const g = GAME_LAYOUT.tile.grids.hard, tall = h > w; return { cols: tall ? g.rows : g.cols, rows: tall ? g.cols : g.rows, cw: w / (tall ? g.rows : g.cols), ch: h / (tall ? g.cols : g.rows) }; };

function prop(c, x, base, s) {
  const { A, tint } = c, r = q(6 * s) + 2;
  switch (A.kind) {
    case 'forest': return P(tint(A.trunk), run(x - 2, base - 2 * r, 4, 2 * r)) + P(tint(A.leafB), oval(x, base - 2 * r, r + 2, r)) + P(tint(A.leafF), oval(x - 2, base - 2 * r - 2, r, r - 2));
    case 'snow': return pine(c, x, base, q(4 * r));
    case 'water': return P(tint(A.rock || A.grass), blob([[x, base, r, r * 0.6], [x + r, base, r * 0.6, r * 0.4]], base)) + P(tint(mix(A.rock || A.grass, '#ffffff', 0.35)), run(x - 2, base - q(r * 0.6), 4, 2));
    case 'mountain': return P(tint(mix(A.mid, A.light, 0.3)), blob([[x, base, r + 2, r], [x + r, base, r * 0.7, r * 0.6]], base)) + P(tint(A.dark), run(x + 2, base - q(r / 2), 2, q(r / 2)));
    case 'town': { const hw = 2 * r, y = base - r; let roof = ''; for (let k = 0; k < r; k += DOT) roof += run(x - q(k * hw / r / 2) - 2, y - r + k, 2 * q(k * hw / r / 2) + 4); return P(tint(A.wall[0]), run(x - r, y, hw, r)) + P(tint(A.roof[Math.abs(x / 2) % 3 | 0]), roof) + P(tint(A.win), run(x - 2, y + 2, 4, 4)); }
    default: return P(tint(mix('#8a6a4a', A.hill, 0.3)), run(x, base - r, 2, r)) + P(tint(A.tree), oval(x + 1, base - r - 4, r, r * 0.9)) + P(tint(mix(A.tree, A.light, 0.4)), oval(x - 1, base - r - 6, 2, 2));
  }
}

function cloudAt(c, x, y, cs, n) {
  const o = [];
  for (let i = 0; i < n; i++) o.push([x + (i - (n - 1) / 2) * cs * 0.6, y - (i % 2) * cs * 0.14, cs * (0.42 + c.rnd() * 0.2), cs * (0.28 + c.rnd() * 0.14)]);
  const flat = q(y + cs * 0.3);
  return P(c.T.shade, blob(o.map(([a, b, rx, ry]) => [a, b + 2, rx, ry]), flat + 2)) + P(c.T.cloud, blob(o, flat));
}

function skyPhoto(c, g) {
  const { w, h, hz, T, rnd } = c, night = c.time === 'night', left = c.time === 'morning' || c.time === 'dusk';
  const sx = q(w * (left ? 0.25 : 0.75)), sy = q(h * 0.15), r = q(Math.min(w, h) / 18), side = f => (left ? 1 - f : f);
  let s = P(mix(T.sun || T.moon, T.sky[1], 0.6), oval(sx, sy, r + 3, r + 3)) + P(night ? T.moon : T.sun, oval(sx, sy, r, r));
  const size = Math.min(w, 2.2 * hz), spots = c.tall
    ? [[0.2, 0.12, 0.26, 3], [0.42, 0.42, 0.3, 4], [0.1, 0.62, 0.22, 3], [0.86, 0.66, 0.2, 2], [0.56, 0.84, 0.18, 3], [0.84, 0.06, 0.16, 2]]
    : [[0.12, 0.34, 0.15, 3], [0.4, 0.2, 0.17, 4], [0.6, 0.64, 0.14, 3], [0.92, 0.66, 0.12, 2], [0.26, 0.78, 0.11, 2], [0.94, 0.1, 0.1, 2]];
  for (const [fx, fy, fs, n] of spots.slice(0, night ? 3 : 6)) s += cloudAt(c, q(w * side(fx)), q(hz * fy), size * fs * 0.8, n);
  if (!night && c.A.kind !== 'town') {
    const bx = q(w * side(0.12)), by = q(hz * (c.tall ? 0.3 : 0.12)), col = mix(T.sky[1], '#3a4a5a', 0.5);
    s += P(col, [[0, 0], [8, 4], [14, -2]].map(([dx, dy]) => run(bx + dx, by + dy, 2) + run(bx + dx + 2, by + dy + 2, 2) + run(bx + dx + 4, by + dy, 2)).join(''));
  }
  if (night) for (let j = 0; (j + 0.5) * g.ch < 0.6 * h; j++) for (let i = 0; i < g.cols; i++) {
    const x = q((i + 0.15 + rnd() * 0.7) * g.cw), y = q((j + 0.15 + rnd() * 0.7) * g.ch);
    if (Math.abs(x - sx) < r + 8 && Math.abs(y - sy) < r + 8) continue;
    s += P(T.star, (i + j) % 3 === 0 ? run(x - 2, y, 6, 2) + run(x, y - 2, 2, 6) : (i + j) % 3 === 1 ? run(x, y, 2) : run(x, y, 2) + run(x + 8, y + 6, 2));
  }
  return s;
}

function clumps(c, g0) {
  const { A, w, tint, feet, tall } = c, stony = A.kind === 'mountain' || A.kind === 'snow' || A.kind === 'cave' || (A.kind === 'water' && !A.reeds);
  const spots = tall ? [[0.34, 0.3, 1], [0.78, 0.48, 0.8], [0.14, 0.62, 1.2], [0.58, 0.8, 0.9]] : [[0.3, 0.3, 1], [0.66, 0.42, 0.8], [0.1, 0.6, 1.1], [0.86, 0.72, 1], [0.48, 0.84, 0.8]];
  return spots.map(([fx, fy, s]) => {
    const x = q(w * fx), y = q(g0 + fy * (feet - g0)), r = 8 * s + 4;
    return stony ? P(tint(mix(A.dark, '#8a8680', 0.4)), blob([[x, y, r, r * 0.6], [x + r * 0.7, y + 1, r * 0.6, r * 0.4]], y + 2)) + P(tint(mix(A.light, '#ffffff', 0.3)), oval(x - 2, y - r * 0.35, r * 0.4, 2))
      : P(tint(mix(A.front || A.dark, '#3a6a3a', 0.3)), oval(x, y, r, r * 0.35) + blades(c, x, y, r * 1.4, 5, 0)) + P(tint(A.light), blades(c, x + 2, y, r, 3, 0));
  }).join('');
}

function roomPhoto(c, A) {
  const { w, hz, top, tall, rnd } = c, fy = q(hz + 0.35 * (c.feet - hz)), lowY = q(fy - Math.max(10, 0.22 * (fy - top))), H = lowY - top, wd = A.wall;
  const line = t => mix(wd, A.dark, t), wood = A.fur || mix(A.dark, '#6a4630', 0.35), rail = q(top + 0.3 * H), low = q(top + 0.66 * H);
  const own = !A.hazard && !A.pillar;
  let wall = P(line(0.12), own ? run(-4, top, w + 8, q(0.12 * H)) + run(-4, low, w + 8, lowY - low) : '') + P(line(0.35), run(-4, rail, w + 8, 2)) + P(mix(wd, '#ffffff', 0.5), run(-4, rail + 2, w + 8, 2));

  let panel = '';
  for (let x = q(rnd() * 22) - 22; x < w; x += 22) panel += run(x, lowY + 4, 2, fy - lowY - 8);
  wall += P(mix(A.low, A.dark, 0.3), panel);

  if (A.hazard) wall += P(A.fur, run(-4, low, w + 8, 6)) + P(mix(A.fur, '#ffffff', 0.4), run(-4, low, w + 8, 2)) + P(mix(A.fur, A.dark, 0.5), run(-4, low + 6, w + 8, 2));
  let up = '';
  if (own) for (let x = q(4 + rnd() * 8); x < w; x = q(x + (A.stripe || A.seams ? 12 : 18) + rnd() * 14)) up += A.stripe ? run(x, rail + 4, 2, lowY - rail - 4) : A.seams ? run(x, top, 2, lowY - top) : run(x, rail + 4, 6 + 2 * (rnd() * 4 | 0), lowY - rail - 4);
  wall += P(A.stripe || A.seams ? line(0.25) : mix(wd, A.acc[0], 0.2), up);
  const win = tall ? [[0.07, 0.12, 0.34, 0.6], [0.58, 0.06, 0.3, 0.24]] : [[0.05, 0.18, 0.2, 0.5], [0.5, 0.12, 0.17, 0.44]];
  const L2 = win.map(([fx, fy0, fw, fh]) => roomWindow(c, q(w * fx), q(top + H * fy0), q(w * fw), q(H * fh))).join('');

  const sx = q(w * (tall ? 0.68 : 0.78)), sy = q(fy - (tall ? 0.5 : 0.8) * (fy - top)), sw = w + 4 - sx, n = tall ? 4 : 3, rh = q((fy - sy - 4) / n);
  const books = ['#7aa8d0', A.acc[0], '#a8c890', '#e8c070'];
  let L3 = P(wood, run(sx, sy, sw, fy - sy)) + P(mix(wood, '#ffffff', 0.3), run(sx, sy, sw, 2)) + P(mix(wood, '#3a2a2a', 0.25), Array.from({ length: n }, (_, i) => run(sx + 4, sy + 4 + i * rh, sw - 4, rh - 4)).join(''));
  for (let i = 0; i < n - 1; i++) for (let k = 0, x = sx + 6; x < sx + sw * 0.75; k++, x += 4) L3 += P(books[(k + i) % 4], run(x, sy + (i + 1) * rh - (k % 3 ? 8 : 10), 4, k % 3 ? 8 : 10));
  L3 += P(mix(wood, A.acc[0], 0.5), run(sx + 8, sy + n * rh - 8, 14, 8)) + P(A.pot || '#c8805a', run(sx + 8, sy - 8, 10, 8)) + P(mix(GREEN, '#3a6a3a', 0.3), blob([[sx + 13, sy - 10, 7, 4]]));
  if (A.pillar) { const pw = q(w * 0.05); for (const x of [-4, w - pw]) L3 += P(A.pillar, run(x, top, pw + 4, fy - top)) + P(mix(A.pillar, A.dark, 0.3), run(x - 2, top, pw + 8, 4) + run(x - 2, fy - 4, pw + 8, 4)); }

  let joints = '', ends = '';
  for (let y = fy + 4, gap = 4; y < c.h + 4; y += gap, gap += 2) if (Math.abs(y - c.feet) > 14) for (let L = q(28 + rnd() * 18), x = q(rnd() * L) - L; x < w; x += L) { joints += run(x, y + 2, 2, gap - 2); ends += run(x + 2, y + 2, 2, gap - 2); }
  return { wall, L2, L3, floor: P(A.dark, joints, ' fill-opacity=".35"') + P(mix(A.light, '#ffffff', 0.35), ends) };
}

function cavePhoto(c) {
  const { A, w, hz, top } = c, [w1, w2] = A.wall, cx = w / 2, rx = 0.4 * w, cy = hz + 8, ry = cy - top * 0.3;
  const half = y => { const t = (y + 1 - cy) / ry; return Math.abs(t) < 1 ? rx * Math.sqrt(1 - t * t) + 6 : 0; };
  let seam = '';
  for (const [f, ph] of [[0.28, 0], [0.62, 2]]) for (let x = -4; x < w + 4; x += 4) {
    const y = q(hz * f + 6 * Math.sin(x / 23 + ph) + 3 * Math.sin(x / 9));
    if (Math.abs(x + 2 - cx) > half(y)) seam += run(x, y, 4, 2);
  }
  const rock = (x, y, r, k) => P(mix(w2, A.dark, 0.35), blob([[x, y + 2, r, r * 0.7], [x + k * r * 0.7, y + 4, r * 0.6, r * 0.5]])) + P(mix(w1, w2, 0.3), blob([[x, y, r, r * 0.66], [x + k * r * 0.7, y + 2, r * 0.6, r * 0.46]]))
    + P(mix(w1, A.light, 0.3), blob([[x - k * r * 0.2, y - r * 0.4, r * 0.5, r * 0.18]]));
  const r = Math.min(w, 2 * hz) * 0.1;
  const s = P(mix(w1, w2, 0.5), seam) + rock(q(w * 0.04), q(hz * 0.16), r * 1.2, 1) + rock(q(w * 0.97), q(hz * 0.42), r, -1) + rock(q(w * 0.34), hz, r * 0.9, 1);
  if (A.ray) return s + P(A.acc[0], blob([[w * 0.62, hz * 0.86, r * 0.5, r * 0.3]]));
  const glow = A.stars ? A.glow : A.acc[0], crystal = (x, base, hgt) => {
    let l = '', d = '';
    for (let k = 0; k < hgt; k += DOT) { const s2 = Math.min(4, k + 2); l += run(x - s2, base - hgt + k, s2); d += run(x, base - hgt + k, s2); }
    return P(glow, l) + P(mix(glow, w2, 0.45), d);
  };
  const bx = q(w * 0.62), by = hz + 4;
  return s + crystal(bx, by, 16) + crystal(bx + 8, by + 2, 10) + crystal(bx - 6, by + 2, 8);
}

function waterNet(c, y0, y1, line) {
  const pts = [];
  for (let y = y0, row = 0; y < y1; row++) { const s = 6 + 8 * (y - y0) / (y1 - y0); for (let x = -8 + (row % 2) * s * 0.8; x < c.w + 8; x += s * 1.6) pts.push([x + (c.rnd() - 0.5) * s, y + c.rnd() * s * 0.3]); y += s * 0.6; }
  const rows = [];
  for (let y = y0 + 2; y < y1 - 2; y += DOT) {
    let start = null;
    for (let x = -4; x <= c.w + 4; x += DOT) {
      let d1 = 1e9, d2 = 1e9;
      for (const [px, py] of pts) { const d = Math.hypot(px - x - 1, (py - y - 1) * 2); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
      const on = x <= c.w + 2 && d2 - d1 < 1.8;
      if (on && start === null) start = x; else if (!on && start !== null) { rows.push([y, start, x]); start = null; }
    }
  }
  return P(line, rowsPath(rows));
}

export function tilePicture({ place, time, w = 168, h = 344 } = {}) {
  const c = context({ place, time, w, h, px: 1 }), A0 = c.A, roof = ROOFED.has(A0.kind), g = hardCell(w, h);
  Object.assign(c, { photo: true, top: q(h * 0.04), hz: q(h * 0.58), feet: q(h - 3), wave: A0.kind === 'indoor' ? 0 : 8 });
  if (c.time === 'night' && A0.kind === 'water') c.A = { ...A0, far: '#4f7192', near: '#6188b2' };
  if (A0.seams) c.A = { ...A0, seams: 0 };
  const { A, tint, hz, rnd } = c, S = c.T.sky, [w1, w2] = A.kind === 'cave' ? A.wall : [], back = A.stars ? w1 : w1 && mix(w1, A.ray || A.light, 0.55);

  const cave = A.kind === 'cave' && bands(c, [...[0.25, 0.5, 0.75].map(t => mix(w2, back, t)), back, mix(back, A.light, 0.5), A.light], -4, hz + 8, [0.16, 0.36, 0.56, 0.74, 0.88]);
  const k = KINDS[A.kind](c), room = A.kind === 'indoor' && roomPhoto(c, A0);
  const L0 = room ? k.L0 + room.wall : cave || bands(c, [S[0], mix(S[0], S[1], 0.5), S[1], S[2], mix(S[2], S[3], 0.5), S[3]], -4, hz + 8, [0.17, 0.34, 0.5, 0.66, 0.82]);

  const base = A.kind === 'water' ? q(hz + 0.42 * (c.feet - hz)) : hz + 6, count = w > h ? 6 : 4;
  let mid = '';
  if (!roof) for (let i = 0; i <= count + 1; i++) { const end = i === 0 || i === count + 1, x = q(end ? (i ? w + 2 : -2) : (i - 0.5 + rnd() * 0.6) * w / count); mid += prop(c, x, q(base + (end ? 8 : rnd() * 10)), end ? 1.6 : 0.6 + rnd() * 0.6); }

  const fy = h - 2, fh = q(0.15 * h * 0.6);
  let L5 = P(tint(mix(A.dark, '#3a6a3a', 0.4)), run(4, fy - fh, 2, fh) + run(12, fy - fh + 4, 2, fh - 4) + run(20, fy - fh + 2, 2, fh - 2));
  L5 += P('#f7a8c8', run(2, fy - fh - 2, 6, 4) + run(18, fy - fh, 6, 4)) + P('#ffe27a', run(10, fy - fh + 2, 6, 4));
  L5 += P(tint(mix(A.mid, '#9a9690', 0.5)), oval(w - 10, fy - 2, 7, 5) + oval(w - 22, fy, 5, 3) + oval(w - 4, fy - 8, 4, 3)) + P(tint(mix(A.light, '#ffffff', 0.3)), run(w - 14, fy - 6, 4, 2));
  const water = A.kind === 'water' ? waterNet(c, hz + 2, q(hz + 0.42 * (c.feet - hz)) - 2, c.time === 'night' ? '#8fb4d8' : mix(tint(A.near), '#ffffff', 0.35)) : '';
  return wrap(c, { L0, L1: roof ? '' : skyPhoto(c, g), L2: (room ? room.L2 : k.L2 || '') + water + (A.kind === 'cave' ? cavePhoto(c) : ''),
    L3: room ? room.L3 : (k.L3 || '') + mid, L4: (k.L4 || '') + (room ? room.floor : clumps(c, A.kind === 'water' ? base + 4 : hz + 6)), L5: (k.L5 || '') + L5, L6: k.L6 });
}

export function tileFrameSvg({ bw = 168, bh = 344, level = 'easy' } = {}) {
  const ring = (o, t) => run(-o - t, -o - t, bw + 2 * (o + t), t) + run(-o - t, bh + o, bw + 2 * (o + t), t) + run(-o - t, -o, t, bh + 2 * o) + run(bw + o, -o, t, bh + 2 * o);
  const mark = { easy: ['.XX', 'XXX', 'XX.'], normal: ['.X.', 'X.X', '.X.'], hard: ['.X.', 'XXX', '.X.'] }[level] || [];
  const color = { easy: '#9ad04a', normal: '#f7a8c8', hard: '#ffd84a' }[level];
  let d = '';
  for (const [cx, cy] of [[-6, -6], [bw, -6], [-6, bh], [bw, bh]]) mark.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'X') d += run(cx + 2 * x, cy + 2 * y, 2); }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -6 ${bw + 12} ${bh + 12}" width="${bw / 2 + 6}" height="${bh / 2 + 6}" shape-rendering="crispEdges">`
    + P('#23435f', ring(4, 2)) + P('#9fc4dc', ring(2, 2)) + P('#1a3247', ring(0, 2)) + P(color, d) + '</svg>';
}
