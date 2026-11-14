import { FRAME } from './amie-layout.js';
import { DUST } from './training-art.js';
import { q } from './amie-scenes.js';

export const TRAIN_LAYOUT = Object.freeze({
  meter: { tall: { y: 84, r: 48 }, wide: { x: 66, y: 72, r: 40 } }, monX: { tall: 0.34, wide: 0.56 }, hookX: { tall: 0.76, wide: 0.8 },
  feet: { min: 28, pad: 6, under: 26 }, bag: { w: 30, h: 50, lift: 22, strap: 8 }, ropeTop: { tall: 26, wide: 10 }, post: { tall: 35, wide: 32 }, arm: 8,
  gauge: { gap: 6, w: 44, px: { tall: 12, wide: 14 } }, effect: 24,
});
const DEG = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function trainingMarks({ w = 180, h = 390, px } = {}) {
  const tall = h > w, k = tall ? 'tall' : 'wide', f = FRAME[k], L = TRAIN_LAYOUT;
  px = px || (tall ? 390 / 180 : 800 / 180);
  const bottom = Math.ceil((f.train.bottom + f.train.d + L.feet.under) / px);
  const feet = h - Math.max(L.feet.min, bottom + L.feet.pad);
  const meter = tall ? { x: w / 2, ...L.meter.tall } : { ...L.meter.wide };
  const hook = { x: w * L.hookX[k], y: feet - L.bag.lift - L.bag.h - L.bag.strap };
  const ropeTop = tall ? meter.y + meter.r + L.ropeTop.tall : L.ropeTop.wide;
  const bag = { x0: hook.x - L.bag.w / 2, y0: hook.y + L.bag.strap, x1: hook.x + L.bag.w / 2, y1: hook.y + L.bag.strap + L.bag.h };
  const gauge = { x: hook.x - L.gauge.w / 2, y: bag.y1 + L.gauge.gap, w: L.gauge.w, h: L.gauge.px[k] / px };
  const x0 = q(hook.x + L.post[k]);
  const post = { x0, x1: x0 + (tall ? 12 : 8), y0: tall ? ropeTop - 18 : -4, y1: q(feet + 5) };
  const arm = { x0: Math.ceil((hook.x - L.arm) / 2) * 2, x1: x0, y0: ropeTop - 8, y1: ropeTop };
  const effect = { x: meter.x, y: meter.y + meter.r + L.effect };
  const quiet = [{ x0: meter.x - meter.r - 28, y0: meter.y - meter.r - 18, x1: meter.x + meter.r + 28, y1: effect.y + 9 }];
  const m = { w, h, tall, px, feet, hook, ropeTop, hz: q(feet - 0.3 * h), bag, gauge, meter, effect, monX: w * L.monX[k], quiet, post, arm, dust: DUST };
  m.swing = swingParams(m);
  return m;
}

export function swingParams(m, bag = TRAIN_LAYOUT.bag) {
  const L = m.hook.y - m.ropeTop, T = clamp(0.85 + 0.003 * L, 0.9, 1.25), omega = 2 * Math.PI / T, Lb = m.hook.y + TRAIN_LAYOUT.bag.strap + bag.h - m.ropeTop, half = bag.w / 2;
  const right = Math.min(7 * DEG, Math.asin(clamp((m.post.x0 - 3 - m.hook.x) / Math.hypot(half, Lb), -1, 1)) - Math.atan(half / Lb));
  return { L, T, omega, zeta: 0.14, impulse: (m.tall ? 4.5 : 5.5) * DEG * omega, right, left: -right / 2 };
}

export const swingState = () => ({ a: 0, v: 0, t: 0, still: 9 });

export function stepSwing(s, dt, p) {
  for (let left = Math.max(0, dt); left > 1e-9; left -= 0.02) {
    const h = Math.min(0.02, left);
    s.v += (-p.omega * p.omega * s.a - 2 * p.zeta * p.omega * s.v) * h;
    s.a += s.v * h;

    const lim = 1.3 * (s.a > 0 ? p.right : -p.left);
    if (Math.abs(s.a) > lim) { s.a = Math.sign(s.a) * lim; if (s.v * s.a > 0) s.v = 0; }
    s.t += h; s.still += h;
  }
  return s;
}

export function hitSwing(s, strength, p) {
  if (s.v < 0) s.v = 0;
  s.v += p.impulse * strength * Math.max(0, 1 - Math.max(0, s.a) / p.right);
  s.still = 0;
  return s;
}

export function swingAngle(s, p) {
  const lim = s.a > 0 ? p.right : p.left, a = lim ? lim * Math.tanh(s.a / lim) : 0;
  const idle = clamp(s.still - 2, 0, 1) * 0.3 * DEG * Math.sin(2 * Math.PI * s.t / 3.2);
  return { a: a + idle, lag: clamp(-0.12 * s.v / p.omega, -2 * DEG, 2 * DEG) };
}

export const HIT_DELAY = 0.07;

export function squashAt(t, strength = 1) {
  if (t < 0 || t >= 0.26) return { sx: 1, sy: 1, dent: false };
  if (t < 0.07) return strength > 1 ? { sx: 0.84, sy: 1.08, dent: true } : { sx: 0.88, sy: 1.06, dent: true };
  if (t < 0.15) return { sx: 1.05, sy: 0.97, dent: false };
  const k = Math.sin((t - 0.15) / 0.11 * Math.PI / 2);
  return { sx: 1.05 - 0.05 * k, sy: 0.97 + 0.03 * k, dent: false };
}

export function sandHit(x, y, strength, rnd, fewer = false) {
  const n = Math.ceil((strength > 1 ? 6 : 3 + Math.round(rnd())) / (fewer ? 2 : 1));
  return Array.from({ length: n }, (_, i) => ({ tex: `train-sand-${i % 2}`, x, y, vx: -(20 + rnd() * 20), vy: -(10 + rnd() * 20), g: 120, life: 0.3 + rnd() * 0.15, fade: 0.12 }));
}

export const sandLeak = (x, y, feet) => [0, 0.12].map((delay, i) => ({ tex: `train-sand-${i}`, x, y, vx: 0, vy: 6, g: 120, life: 2, fade: 0, delay, floor: feet, stay: 0 }));

export const feetDust = (x, feet, half, rnd) => [-1, -1, 1, 1].map((side, i) => ({ tex: 'train-dust', x: x + side * (half * 0.5 + (i % 2) * 4), y: feet - 1, vx: side * (8 + rnd() * 10), vy: -(14 + rnd() * 10), g: 160, life: 0.2, fade: 0.08 }));

export function burstBits(id, x, y, feet, rnd, fewer = false) {
  const pieces = [[-55, -60], [60, -50], [50, 25]].map(([vx, vy], i) => ({ tex: `train-piece-${id || 'blank'}-${i}`, x: x + Math.sign(vx) * 6, y: y + (i - 1) * 10,
    vx: vx * (0.75 + rnd() * 0.3), vy: vy * (0.75 + rnd() * 0.3), g: 200, spin: (i % 2 ? -1 : 1) * (1 + rnd()), life: 0.6 + rnd() * 0.1, fade: 0.25 }));
  const n = Math.round((10 + rnd() * 4) / (fewer ? 2 : 1));
  const sand = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * 2 * Math.PI + rnd() * 0.5, sp = 30 + rnd() * 30;
    return { tex: `train-sand-${i % 2}`, x: x + Math.cos(a) * 4, y: y + Math.sin(a) * 8, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 10, g: 150, life: 0.4 + rnd() * 0.2, fade: 0.15,
      delay: rnd() * 0.15, floor: i % 3 ? null : feet + (rnd() - 0.5) * 8, stay: 0.2 };
  });
  return [...(fewer ? pieces.slice(0, 2) : pieces), ...sand];
}

export function stepBit(b, dt) {
  b.age = (b.age ?? -(b.delay || 0)) + dt;
  if (b.age < 0) { b.alpha = 0; return true; }
  if (b.landed != null) { b.alpha = 1; return b.age - b.landed < b.stay; }
  b.vy += b.g * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.turn = (b.turn || 0) + (b.spin || 0) * 2 * Math.PI * dt;
  if (b.floor != null && b.vy > 0 && b.y >= b.floor) { b.y = b.floor; b.landed = b.age; b.alpha = 1; return b.stay > 0; }
  b.alpha = b.fade ? clamp((b.life - b.age) / b.fade, 0, 1) : 1;
  return b.age < b.life;
}
