import { q, P, run, blob, oval, ridge, bands, anim, twinkle, twoFrames, blades, context, wrap, mix } from './amie-scenes.js';
import { SAND } from './training-art.js';
import { trainingMarks } from './training-motion.js';

export const YARD = Object.freeze({
  soil: ['#c4a87a', '#dcc496', '#ecdcae'], worn: '#f4e6c0', sand: SAND[0], grain: SAND[1], grass: ['#68ac50', '#86c862'], hill: '#9cc8a0', tree: '#4f9a52', treeD: '#3e8448',
  fence: ['#d8a868', '#b88450', '#8a5e3c'], wood: ['#c8965a', '#a8784c', '#7a5434'], iron: ['#a8b2bc', '#6a7480'], stone: ['#b8b0a0', '#988e80'], flag: ['#d8434d', '#a83038'],
  lamp: '#5a4a3a', glass: '#8a7a64', lit: '#ffe8a0', glow: '#fff4c8', towel: '#fbf6ea', stripe: '#d8434d',
});

export function trainingScene(options = {}) {
  const { w = 180, h = 390 } = options, m = trainingMarks({ w, h, px: options.px });
  const c = context({ ...options, place: 'plains' });
  Object.assign(c, { feet: q(m.feet), hz: m.hz });
  const { T, tint, rnd } = c, tall = m.tall, hz = m.hz, Qz = m.quiet[0], night = c.time === 'night', Y = YARD, hx = q(m.hook.x);
  const t = list => list.map(tint);

  const inBox = (x0, y0, x1, y1) => x1 > Qz.x0 && x0 < Qz.x1 && y1 > Qz.y0 && y0 < Qz.y1;

  const top = tall ? 28 : 16, span = hz + 12;
  const L0 = bands(c, T.sky, -4, hz + 8, [top, hz * 0.55, hz * 0.82].map(y => (y + 4) / span));

  const r = 6, sx = tall ? 22 : q(m.hook.x - 27);
  let sy = tall ? (c.time === 'dusk' ? hz - 10 : Math.max(q((Qz.y1 + hz) / 2), Qz.y1 + r + 2)) : c.time === 'dusk' ? 56 : 34;

  if (inBox(sx - r - 3, sy - r - 3, sx + r + 3, sy + r + 3)) sy = Qz.y1 + r + 4;
  const body = night ? T.moon : T.sun;
  let L1 = P(mix(body, T.sky[2], night ? 0.7 : 0.55), oval(sx, sy, r + 3, r + 3)) + P(body, oval(sx, sy, r, r));
  if (night) L1 += P(mix(T.moon, '#c8bfa0', 0.45), oval(sx - 2, sy - 2, 2, 2) + oval(sx + 2, sy + 2, 1, 1));
  const clouds = tall ? [[40, q(Qz.y1 + 8), 8], [q(m.hook.x + 20), Math.min(hz - 16, q(Qz.y1 + 38)), 6]] : [[q(Qz.x1 + 26), 52, 9], [Math.max(q(Qz.x1 + 58), q(m.hook.x - 32)), 68, 7]];
  let shade = '', cloud = '';
  for (const [cx, cy, cs] of clouds) {
    if (cy > hz - 8 || inBox(cx - cs * 1.5, cy - cs * 0.6, cx + cs * 1.5 + 8, cy + cs * 0.6 + 2)) continue;
    const o = [[cx, cy, cs, cs * 0.55], [cx - cs * 0.85, cy + cs * 0.2, cs * 0.6, cs * 0.38], [cx + cs * 0.8, cy + cs * 0.15, cs * 0.62, cs * 0.42]], flat = q(cy + cs * 0.42);
    shade += blob(o.map(([x, y, a, b]) => [x, y + 2, a, b]), flat + 2);
    cloud += blob(o, flat);
  }
  L1 += anim(c, 'pkbS 12s steps(4) infinite alternate', P(T.shade, shade) + P(T.cloud, cloud), '--dx:8px;');
  if (night) {
    for (let i = 0; i < 8; i++) {
      const x = q(tall ? 4 + rnd() * (w - 8) : Qz.x1 + 6 + rnd() * (w - Qz.x1 - 10)), y = q(tall ? Qz.y1 + 3 + rnd() * (hz - Qz.y1 - 14) : 16 + rnd() * 62);
      if ((Math.abs(x - sx) < r + 6 && Math.abs(y - sy) < r + 6) || inBox(x, y, x + 2, y + 2)) continue;
      L1 += i % 3 === 1 ? twinkle(c, P(T.star, run(x, y, 2)), 1.6 + i * 0.3, i * 0.4) : P(T.star, run(x, y, 2));
    }
  }

  const lift = tall ? 12 : 8;
  const rise = x => (tall ? Math.min(1, ((x - w / 2) / (w / 2)) ** 2) : x < Qz.x1 ? 0 : ((x - Qz.x1) / (w - Qz.x1)) ** 2);
  const hill = x => hz - 2 - lift * rise(x) - (rise(x) > 0.05 ? 2 * Math.sin(x / 9) : 0);
  let L2 = P(tint(Y.hill), ridge(c, hill, hz + 8));
  for (const tx of tall ? [14, 160] : [q(w - 12)]) {
    if (inBox(tx - 11, hz - 15, tx + 11, hz)) continue;
    const o = [[tx, hz - 8, 8, 7], [tx - 6, hz - 3, 5, 4], [tx + 6, hz - 3, 5, 4]];
    L2 += P(tint(Y.treeD), blob(o, hz)) + P(tint(Y.tree), blob(o.map(([x, y, a, b]) => [x - 1, y - 1, a - 1, b - 1]), hz - 2));
  }

  const [fl, fm, fd] = t(Y.fence), fh = tall ? 12 : 10, fx0 = tall && !inBox(-4, hz - fh, w, hz) ? -4 : q(Qz.x1 + 4), fx1 = tall ? m.post.x0 : w + 4;
  const light = c.time === 'dusk' ? mix(fl, '#e8c070', 0.3) : fl;
  let rails = run(fx0, hz - fh + 2, fx1 - fx0) + run(fx0, hz - (tall ? 4 : 2), fx1 - fx0), pl = '', pd = '';
  for (let x = fx0 + (tall ? 6 : 0); x < fx1 - 4; x += 22) {
    if (!tall && Math.abs(x - m.hook.x) < 20) continue;
    pl += run(x, hz - fh, 2, fh + 2); pd += run(x + 2, hz - fh + 2, 2, fh);
  }
  let L3 = P(fm, rails) + P(light, pl) + P(fd, pd);

  let S = '';
  const [wl, wm, wd] = t(Y.wood), [il, id] = t(Y.iron), { x0, x1, y0, y1 } = m.post, A = m.arm, R = m.ropeTop;

  let grain = '';
  for (let i = 0; i < 4; i++) grain += run(x0 + 4 + (i % 2) * 2, q(y0 + 20 + i * (y1 - y0 - 40) / 4), 2, 4);
  S += P(wm, run(x0, y0, x1 - x0, y1 - y0)) + P(wl, run(x0, y0, 2, y1 - y0)) + P(wd, run(x1 - 2, y0, 2, y1 - y0) + grain);
  S += P(id, run(x0, q(y0 + 24), x1 - x0) + run(x0, q(y1 - 26), x1 - x0));
  if (tall) {
    const st = x0 + 4;
    S += P(wl, run(x0 + 2, y0 - 2, x1 - x0 - 4)) + P(id, run(st, y0 - 12, 2, 10));
    S += P(tint(Y.flag[0]), run(st - 6, y0 - 12, 6) + run(st - 6, y0 - 10, 6) + run(st - 4, y0 - 8, 4)) + P(tint(Y.flag[1]), run(st - 2, y0 - 6, 2));
  }

  S += P(wm, run(A.x0, A.y0, A.x1 - A.x0, 8)) + P(wl, run(A.x0, A.y0, A.x1 - A.x0, 2)) + P(wd, run(A.x0, A.y1 - 2, A.x1 - A.x0, 2) + run(A.x0, A.y0, 2, 8));
  const bx = tall ? 20 : 18, by = tall ? 26 : 20;
  let bl = '', bm = '';
  for (let y = R; y < R + by; y += 2) { const x = q(x0 - bx + bx * (y - R) / by); bl += run(x - 2, y, 2); bm += run(x, y, 2); }
  S += P(wl, bl) + P(wd, bm);
  S += P(il, run(hx - 4, R, 8, 2) + run(hx - 2, R + 2, 2, 2)) + P(id, run(hx, R + 2, 2, 2) + run(hx - 2, R + 4, 4, 2));

  const ly = tall ? R + 38 : R + 30, lx = x0 - 8;
  const lampBody = P(tint(Y.lamp), run(lx + 2, ly - 2, 6, 2) + run(lx, ly, 8, 10) + run(lx + 6, ly - 4, 2, 2));
  const glass = col => P(col, run(lx + 2, ly + 2, 4, 6));
  S += lampBody + (night ? twoFrames(c, P(Y.glow, oval(lx + 4, ly + 5, 8, 8), ' fill-opacity="0.3"') + glass(Y.lit),
    P(Y.glow, oval(lx + 4, ly + 5, 7, 7), ' fill-opacity="0.2"') + glass(mix(Y.lit, Y.lamp, 0.15)), 1.8) : glass(tint(Y.glass)));

  const soil = t(Y.soil), [gd, gm] = t(Y.grass), [sl, sd] = t(Y.stone);
  let L4 = P(gd, run(-4, hz, w + 8, 4)) + P(gm, run(-4, hz + 4, w + 8, 4)) + bands(c, soil, hz + 8, h + 4, [0.25, 0.6]);
  L4 += P(tint(Y.worn), oval(q(m.monX), q(m.feet), tall ? 40 : 34, tall ? 8 : 6));
  const sy0 = q(m.gauge.y + m.gauge.h + 7), sr = tall ? 22 : 18;
  let grains = '';
  for (let i = 0; i < 5; i++) grains += run(q(hx - sr + 4 + rnd() * (2 * sr - 8)), sy0 + q((rnd() - 0.5) * 4), 2);
  L4 += P(tint(Y.sand), oval(hx, sy0, sr, tall ? 5 : 4)) + P(tint(Y.grain), grains);

  S += P(soil[0], run(x0 - 4, y1 - 4, x1 - x0 + 8, 2)) + P(sd, oval(x0 - 4, y1 - 2, 4, 3)) + P(sl, oval(x0 + 4, y1, 5, 3) + oval(x0 - 5, y1 - 3, 2, 1));

  let stones = '', ticks = '';
  for (let i = 0; i < 3; i++) {
    const x = q(i === 1 ? w * (0.84 + rnd() * 0.1) : w * (0.03 + rnd() * 0.14));
    let y = q(i === 1 ? hz + 16 + rnd() * 10 : hz + 16 + rnd() * (m.feet - hz - 30));

    if (x < Qz.x1 + 4 && y < Qz.y1 + 4) y = q(Qz.y1 + 8 + rnd() * 6);
    if (y > h - 16 || (!tall && i === 2)) continue;
    stones += oval(x, y, 3, 2);
    ticks += run(x + 8, y - 2, 2, 4) + run(x + 12, y, 2, 2);
  }
  L4 += P(sd, stones) + P(gd, ticks);
  if (!tall) {

    const sx0 = 40, sb = 160;
    L4 += P(wm, run(sx0, sb - 10, 18, 10)) + P(wl, run(sx0, sb - 10, 4, 10)) + P(wd, run(sx0 + 14, sb - 10, 4, 10)) + P(wl, run(sx0 + 2, sb - 12, 14, 2)) + P(wd, run(sx0 + 8, sb - 12, 4, 2));
    L4 += P(tint(Y.towel), run(sx0 + 4, sb - 12, 8, 2) + run(sx0 - 4, sb - 12, 8, 12)) + P(tint(Y.stripe), run(sx0 - 4, sb - 8, 8, 2) + run(sx0 - 4, sb - 4, 8, 2));
  }
  if (c.time === 'morning') L4 += P('#ffffff', run(tall ? -4 : q(Qz.x1), hz - 2, tall ? w + 8 : w + 4 - q(Qz.x1), 4), ' fill-opacity="0.25"');

  const tb = q(h) + 2, th = tall ? 28 : 16, tx = tall ? 10 : 12;
  const tuft = f => P(gd, oval(tx, tb, 10, 4) + blades(c, tx, tb, th, 5, f, -1)) + P(gm, blades(c, tx + 2, tb, th * 0.7, 3, f, -1));
  const L5 = twoFrames(c, tuft(0), tuft(1), 2.6);

  let L6 = '';
  if (night) {
    for (let i = 0; i < 3; i++) {

      const x = tall ? q(i % 2 ? w * (0.82 + rnd() * 0.14) : w * (0.03 + rnd() * 0.15)) : q([m.bag.x1 + 8, m.post.x1 + 4, w - 6][i]), y = q(hz + 6 + rnd() * 24);
      if (inBox(x - 6, y - 6, x + 10, y + 6)) continue;
      L6 += anim(c, `pkbS ${3 + i}s steps(3) infinite alternate`, twinkle(c, P(mix('#e8ff9a', '#2a3450', 0.55), run(x - 2, y - 2, 6, 6)) + P('#e8ff9a', run(x, y, 2)), 1.2 + i * 0.4, i * 0.5), '--dx:4px;');
    }
  }
  return wrap(c, { L0, L1, L2, L3, L4, L3post: S, L5, L6 }, options);
}

export const yardDust = time => context({ time }).tint(YARD.soil[1]);
