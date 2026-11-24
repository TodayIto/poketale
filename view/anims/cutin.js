import TABLE from './cutin-table.json' with { type: 'json' };
import POKEAPI_SPRITES from '../../data/pokeapi-sprite-map.json' with { type: 'json' };
import { entry, toID } from '../../names/index.js';

export const ARTWORK_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/1dd55c0436d2a5b6e324c0b780e1b1b416fbfb64/sprites/pokemon/other/official-artwork/';
const ARTWORK_TIMEOUT_MS = 4000; // a slower art is not waited for: the Z-move plays without its cut-in

const CELL_W = 288, CELL_H = 96;
const REF_HEAD = [143.25, 48.0, 21.875];
const GAPE = 0.61, BIG_HEAD = [0.42, 3.66, 0.9], GROW_MAX = 2.47, FEAT_MAX = 30.1, KC_MAX = 0.905, FEAT_MIN = 8.8;
const FACE_ZOOM = [0.783, 0.90], EYE_W = 2, EYE_PAD = 2.0, FACE_OFF = 20.2;

let inner;

function boltInner() {
  if (!inner) {
    inner = new Uint8Array(CELL_W * CELL_H);
    TABLE.mask.forEach((runs, y) => { for (let i = 0; i < runs.length; i += 2) inner.fill(1, y * CELL_W + runs[i], y * CELL_W + runs[i + 1]); });
  }
  return inner;
}

export function cutInPoints(id) {
  const row = TABLE.pts[id];
  if (!row) return null;
  const eyes = [];
  for (let i = 8; i < row.length; i += 2) eyes.push([row[i], row[i + 1]]);
  return { facing: 'LRF'[row[0]], head: row.slice(1, 4), mouthTop: row.slice(4, 6), mouthBottom: row.slice(6, 8), eyes };
}

export function cutInId(mon) {
  const stem = POKEAPI_SPRITES[mon?.spriteId];
  if (stem && /^\d+$/.test(stem) && TABLE.pts[stem]) return stem;
  const num = entry('species', mon?.speciesId)?.num ?? (stem ? parseInt(stem, 10) : NaN);
  return num > 0 && TABLE.pts[num] ? String(num) : null;
}

export const mirrorsArt = (pts, playerSide) => playerSide !== (pts.facing === 'R');

export function placeCutIn(pts, { width, opaque }, flip) {
  const mx = x => (flip ? width - x : x);
  const [hx0, fy, r] = pts.head, fx = mx(hx0);
  const eyes = pts.eyes.map(([x, y]) => [mx(x), y]), mt = [mx(pts.mouthTop[0]), pts.mouthTop[1]];
  const [rx, ry, rr] = REF_HEAD;
  const gap = pts.mouthBottom[1] - pts.mouthTop[1];
  const rEff = r + GAPE * Math.max(0, gap - r); // 1a
  const share = Math.PI * r * r / Math.max(1, opaque);
  const grow = Math.min(GROW_MAX, 1 + (share > BIG_HEAD[0] ? BIG_HEAD[1] * (share - BIG_HEAD[0]) ** BIG_HEAD[2] : 0)); // 1b, capped
  let kc = rr / rEff * grow;
  const ex = eyes.reduce((s, e) => s + e[0], 0) / eyes.length, ey = eyes.reduce((s, e) => s + e[1], 0) / eyes.length;
  const last = eyes[eyes.length - 1];
  const span = Math.max(Math.abs(eyes[0][0] - last[0]), Math.hypot(eyes[0][0] - last[0], eyes[0][1] - last[1]));
  const feat = Math.max(span, Math.hypot(mt[0] - ex, mt[1] - ey));
  kc = Math.min(kc, FEAT_MAX / feat, KC_MAX); // 1c, 1e
  kc = Math.max(kc, FEAT_MIN / feat); // 1f
  const w = Math.min(1, Math.max(0, (share - FACE_ZOOM[0]) / (FACE_ZOOM[1] - FACE_ZOOM[0]))); // 1d
  if (w > 0) kc = kc ** (1 - w) * (FEAT_MAX / feat) ** w;

  let ox = rx - fx * kc, oy = ry - fy * kc;
  const fcx = (EYE_W * ex + mt[0]) / (EYE_W + 1), fcy = (EYE_W * ey + mt[1]) / (EYE_W + 1);
  let cx = ox + fcx * kc, cy = oy + fcy * kc;
  const dx = cx - rx, dy = cy - ry, d = Math.hypot(dx, dy);
  if (d > FACE_OFF) { ox -= dx * (1 - FACE_OFF / d); oy -= dy * (1 - FACE_OFF / d); }

  const mask = boltInner();
  const eyesIn = (kc, ox, oy) => eyes.every(([x, y]) => {
    const px = ox + x * kc, py = oy + y * kc;
    const x0 = Math.floor(px - EYE_PAD), x1 = Math.ceil(px + EYE_PAD), y0 = Math.floor(py - EYE_PAD), y1 = Math.ceil(py + EYE_PAD);
    if (x0 < 0 || y0 < 0 || x1 >= CELL_W || y1 >= CELL_H) return false;
    for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) if (!mask[yy * CELL_W + xx]) return false;
    return true;
  });
  if (!eyesIn(kc, ox, oy)) {
    cx = ox + fcx * kc; cy = oy + fcy * kc;
    let found = false;
    for (let k = 1; k <= 20 && !found; k++) {
      const t = k === 20 ? 1 : k * (1 / 20); // np.linspace(0, 1, 21)[1:]
      const nox = ox + (rx - cx) * t, noy = oy + (ry - cy) * t;
      if (eyesIn(kc, nox, noy)) { ox = nox; oy = noy; found = true; }
    }
    if (!found) {
      ox += rx - cx; oy += ry - cy;
      while (!eyesIn(kc, ox, oy) && kc > 0.02) { kc *= 0.97; ox = rx - fcx * kc; oy = ry - fcy * kc; }
    }
  }
  return { kc, ox, oy };
}

const PALETTES = {
  Normal: [[70, 64, 52], [176, 168, 140], [250, 246, 226], [255, 250, 220]], Fire: [[90, 16, 8], [220, 90, 24], [255, 200, 120], [255, 244, 170]],
  Water: [[8, 34, 100], [36, 116, 216], [170, 226, 255], [224, 250, 255]], Electric: [[8, 70, 60], [30, 170, 130], [190, 255, 220], [255, 236, 110]],
  Grass: [[14, 60, 20], [60, 170, 60], [200, 255, 170], [250, 255, 190]], Ice: [[20, 70, 100], [110, 200, 230], [220, 250, 255], [240, 255, 255]],
  Fighting: [[80, 14, 10], [190, 50, 34], [255, 170, 130], [255, 220, 170]], Poison: [[50, 10, 60], [150, 60, 170], [230, 170, 250], [245, 210, 255]],
  Ground: [[70, 46, 16], [190, 150, 80], [250, 220, 150], [255, 240, 190]], Flying: [[40, 50, 110], [130, 150, 230], [220, 230, 255], [240, 245, 255]],
  Psychic: [[90, 10, 50], [230, 80, 140], [255, 190, 220], [255, 225, 240]], Bug: [[40, 60, 10], [150, 180, 30], [230, 250, 140], [250, 255, 190]],
  Rock: [[60, 50, 24], [170, 150, 90], [240, 225, 170], [255, 240, 200]], Ghost: [[26, 8, 48], [96, 56, 168], [204, 168, 255], [236, 210, 255]],
  Dragon: [[24, 10, 80], [100, 60, 220], [190, 170, 255], [230, 220, 255]], Dark: [[20, 16, 18], [80, 64, 60], [180, 160, 150], [230, 200, 160]],
  Steel: [[40, 50, 64], [150, 160, 180], [230, 236, 245], [250, 252, 255]], Fairy: [[90, 30, 70], [230, 120, 190], [255, 210, 240], [255, 235, 250]],
};
const METALS = {
  Normal: [[96, 86, 64], [240, 232, 200]], Fire: [[96, 34, 14], [255, 170, 110]], Water: [[30, 60, 96], [220, 236, 255]],
  Electric: [[110, 76, 14], [255, 226, 110]], Grass: [[44, 70, 18], [220, 240, 140]], Ice: [[50, 90, 110], [230, 250, 255]],
  Fighting: [[100, 30, 20], [250, 160, 120]], Poison: [[60, 24, 70], [230, 180, 245]], Ground: [[100, 66, 24], [250, 210, 140]],
  Flying: [[60, 70, 110], [230, 236, 255]], Psychic: [[100, 30, 60], [255, 190, 220]], Bug: [[70, 80, 16], [230, 240, 120]],
  Rock: [[90, 74, 40], [240, 220, 160]], Ghost: [[44, 28, 72], [214, 196, 255]], Dragon: [[40, 24, 90], [200, 190, 255]],
  Dark: [[30, 26, 26], [190, 180, 176]], Steel: [[60, 66, 76], [245, 248, 252]], Fairy: [[100, 50, 80], [255, 210, 235]],
};
const cutInType = type => (PALETTES[type] ? type : null);
const ROUGH = 0.40, GLOW_R = 2.8, FACE_LIGHT = 0.10;

const ECHO = [1.22, 0.45, 0.06, 0.85], EDGE = [0.30, 2.6], WASH = [0.35, 0.10, 0.22, 0.5], ECHO_WHITE = 0.6, WASH_TINT = 0.15;
const WHITE = [255, 255, 250];
// cutin-fx.py swirl's phases: numpy default_rng(3).uniform(0, 6.28, 16)
const PH = [0.537876769661961, 1.4871699814235062, 5.032003641496173, 3.6559775864842297, 0.591127873269707, 2.7200371846850557,
  3.008442152324438, 1.0031603839208534, 4.613144510849867, 0.7138602851064134, 2.456913036312758, 3.245128346862164];
const BEND = [152, 50, 42, 44, 1.0], BEND_WHITE = [255, 255, 250];
const BOLT_POLY = [[263, 8], [169.5, 28.5], [171, 12], [28, 81.5], [127.5, 70], [123.5, 89]];
const BAND = [1.3, 1.8, 0.8]; // outline, metal band, inner colour line widths (cell px)
const OUTLINE = [8, 4, 4];

const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);

function boxes(sigma) {
  const wIdeal = Math.sqrt(12 * sigma * sigma / 3 + 1);
  let wl = Math.floor(wIdeal); if (wl % 2 === 0) wl--;
  const wu = wl + 2, m = Math.round((12 * sigma * sigma - 3 * wl * wl - 12 * wl - 9) / (-4 * wl - 4));
  return [0, 1, 2].map(i => ((i < m ? wl : wu) - 1) / 2);
}
function boxPass(src, dst, w, h, r, horizontal) {
  const n = horizontal ? w : h, lines = horizontal ? h : w, step = horizontal ? 1 : w, size = 2 * r + 1;
  for (let l = 0; l < lines; l++) {
    const base = horizontal ? l * w : l;
    const at = i => src[base + Math.min(n - 1, Math.max(0, i)) * step];
    let sum = 0;
    for (let i = -r; i <= r; i++) sum += at(i);
    for (let i = 0; i < n; i++) { dst[base + i * step] = sum / size; sum += at(i + r + 1) - at(i - r); }
  }
}
function blur(field, w, h, sigma) {
  const tmp = new Float32Array(field.length);
  for (const r of boxes(sigma)) { boxPass(field, tmp, w, h, r, true); boxPass(tmp, field, w, h, r, false); }
  return field;
}

function boltDistance(S) {
  const W = CELL_W * S, H = CELL_H * S, out = new Float32Array(W * H), n = BOLT_POLY.length;
  const edges = BOLT_POLY.map(([bx, by], i) => {
    const [ax, ay] = BOLT_POLY[(i + n - 1) % n], vx = bx - ax, vy = by - ay;
    return { ax, ay, bx, by, vx, vy, len2: vx * vx + vy * vy };
  });
  const crossings = [];
  for (let py = 0; py < H; py++) {
    const y = (py + 0.5) / S;
    crossings.length = 0;
    for (const { ax, ay, bx, by } of edges) {
      if ((by > y) !== (ay > y)) crossings.push((ax - bx) * (y - by) / (ay - by) + bx);
    }
    for (let px = 0; px < W; px++) {
      const x = (px + 0.5) / S;
      let best = Infinity, inside = false;
      for (const crossing of crossings) if (x < crossing) inside = !inside;
      for (const { ax, ay, vx, vy, len2 } of edges) {
        const tx = x - ax, ty = y - ay, t = clamp01((tx * vx + ty * vy) / len2);
        const dx = tx - vx * t, dy = ty - vy * t;
        // Either component alone is a lower bound on the distance.
        if (Math.abs(dx) > best || Math.abs(dy) > best) continue;
        best = Math.min(best, Math.hypot(dx, dy));
      }
      out[py * W + px] = inside ? best : -best;
    }
  }
  return out;
}

const fields = new Map();

function baseFields(S) {
  let f = fields.get(S);
  if (f) return f;
  const W = CELL_W * S, H = CELL_H * S, streak = new Float32Array(W * H), cloud = new Float32Array(W * H);
  const LAYERS = [[9, 7, 1.0], [19, 13, 0.7], [37, 29, 0.45]];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = y / H;
    let t = 0;
    LAYERS.forEach(([f1, f2, wgt], i) => {
      t += Math.sin(u * f1 + Math.sin(v * f2 + PH[2 * i]) * 2.4 + Math.sin(u * f2 * 1.7 + v * f1 * 0.6 + PH[2 * i + 1]) * 1.3) * wgt;
    });
    const bands = Math.abs(Math.sin(u * 14 + v * 5 + t * 1.9 + PH[10]));
    streak[y * W + x] = clamp01(1 - bands / ROUGH) ** 1.6;
    cloud[y * W + x] = clamp01(t * 0.18 + 0.5);
  }
  const soft = blur(streak.map(v => Math.trunc(v * 255) / 255), W, H, H * 0.09);
  for (let i = 0; i < streak.length; i++) streak[i] = clamp01(streak[i] * 0.55 + soft[i] * 2.2);
  f = { dist: boltDistance(S), streak, cloud };
  fields.set(S, f);
  return f;
}

const frames = new Map();

function typeFrame(S, type) {
  const key = `${S}:${type}`;
  let frame = frames.get(key);
  if (frame) return frame;
  const W = CELL_W * S, H = CELL_H * S, { dist } = baseFields(S), rgba = new Float32Array(W * H * 4), inside = new Float32Array(W * H);
  const [dk, lt] = METALS[type], line = PALETTES[type][2];
  const cover = (d, r) => clamp01((d - r) * S + 0.5);
  const r1 = BAND[0], r2 = r1 + BAND[1], r3 = r2 + BAND[2];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, d = dist[i];
    const c0 = cover(d, 0);
    if (!c0) continue;
    const c1 = cover(d, r1), c2 = cover(d, r2);
    inside[i] = cover(d, r3);
    const t = clamp01((d - r1) / BAND[1]);
    let lit = clamp01(Math.sin(Math.PI * clamp01(t / 0.8))) ** 0.6;
    lit *= 0.85 + 0.15 * Math.cos(x / W * Math.PI * 3);
    const spec = clamp01((lit - 0.82) / 0.18) ** 2;
    const zone = Math.exp(-(((x - BEND[0] * S) / (BEND[2] * S)) ** 2 + ((y - BEND[1] * S) / (BEND[3] * S)) ** 2));
    const shine = clamp01(zone * 1.8) * (0.7 + 0.3 * lit);
    for (let c = 0; c < 3; c++) {
      let metal = dk[c] + (lt[c] - dk[c]) * lit;
      metal += (255 - metal) * spec * 0.7;
      metal += (BEND_WHITE[c] - metal) * shine * BEND[4];
      const inner = line[c] * (1 - zone) + BEND_WHITE[c] * zone;

      let v = OUTLINE[c] * c0;
      v += (metal - v) * c1;
      v += (inner - v) * c2;
      rgba[i * 4 + c] = v;
    }
    rgba[i * 4 + 3] = 255 * c0;
  }
  frame = { rgba, inside };
  frames.set(key, frame);
  while (frames.size > 4) frames.delete(frames.keys().next().value);
  return frame;
}

/** A canvas (DOM or offscreen) */
const makeCanvas = (w, h) => {
  const canvas = globalThis.document?.createElement('canvas') ?? new OffscreenCanvas(w, h);
  canvas.width = w; canvas.height = h;
  return canvas;
};

/** The art's width and opaque count (alpha > 127), read once per picture */
function artInfo(img) {
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  const ctx = makeCanvas(w, h).getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h).data;
  let opaque = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 127) opaque++;
  return { width: w, opaque };
}

function artLayer(art, info, flip, x0, y0, k, W, H) {
  const ctx = makeCanvas(W, H).getContext('2d', { willReadFrequently: true }), h = art.naturalHeight || art.height;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  if (flip) { ctx.translate(x0 + info.width * k, y0); ctx.scale(-1, 1); } else ctx.translate(x0, y0);
  ctx.drawImage(art, 0, 0, info.width, h, 0, 0, info.width * k, h * k);
  return ctx.getImageData(0, 0, W, H);
}
/** Square max filter of radius r (Pillow MaxFilter(2r + 1)) on a W x H field */
function dilate(field, W, H, r) {
  if (r < 1) return field;
  const tmp = new Float32Array(field.length), out = new Float32Array(field.length), queue = new Int32Array(Math.max(W, H));
  const pass = (src, dst, lines, length, lineStep, step) => {
    for (let line = 0, base = 0; line < lines; line++, base += lineStep) {
      let head = 0, tail = 0, next = 0;
      for (let i = 0, at = base; i < length; i++, at += step) {
        const left = i - r, right = Math.min(length - 1, i + r);
        while (head < tail && queue[head] < left) head++;
        for (; next <= right; next++) {
          const value = src[base + next * step];
          // A newer pixel at least as bright outlasts the older one in the window.
          while (head < tail && value >= src[base + queue[tail - 1] * step]) tail--;
          queue[tail++] = next;
        }
        dst[at] = Math.max(0, src[base + queue[head] * step]);
      }
    }
  };
  // Each pixel enters and leaves the queue at most once per pass.
  pass(field, tmp, H, W, W, 1);
  pass(tmp, out, W, H, 1, W);
  return out;
}

function artPlace(info, pts, playerSide, S) {
  const flip = mirrorsArt(pts, playerSide), { kc, ox, oy } = placeCutIn(pts, info, flip);
  const k = kc * S, hx = flip ? info.width - pts.head[0] : pts.head[0];
  return { flip, k, x0: Math.round(ox * S), y0: Math.round(oy * S), fx: ox * S + hx * k, fy: oy * S + pts.head[1] * k, hr: pts.head[2] * k };
}

function drawCutIn(art, info, pts, type, playerSide, S) {
  const W = CELL_W * S, H = CELL_H * S, pal = PALETTES[type], N = W * H;
  const { flip, k, x0, y0, fx, fy, hr } = artPlace(info, pts, playerSide, S), dir = playerSide ? 1 : -1;
  const canvas = makeCanvas(W, H), ctx = canvas.getContext('2d', { willReadFrequently: true });
  const pixels = artLayer(art, info, flip, x0, y0, k, W, H), px = pixels.data;

  const es = ECHO[0], echo = artLayer(art, info, flip, Math.round(fx - (fx - x0) * es - ECHO[1] * hr * dir), Math.round(fy - (fy - y0) * es),
    k * es, W, H).data;
  const echoA = new Float32Array(N), artA = new Float32Array(N);
  for (let i = 0; i < N; i++) { echoA[i] = echo[i * 4 + 3] / 255; artA[i] = px[i * 4 + 3] / 255; }
  blur(echoA, W, H, hr * ECHO[2]);
  // the edge light: the silhouette spread outward and blurred
  const spread = blur(dilate(artA, W, H, Math.trunc(hr * 0.12)), W, H, hr * EDGE[0]);
  const { streak, cloud } = baseFields(S), { rgba, inside } = typeFrame(S, type);
  const [dark, mid, light, glowColour] = pal, gx = fx - hr * 0.9 * dir, gr = hr * GLOW_R; // the glow a little behind the head
  const washc = WHITE.map((w, c) => w + (glowColour[c] - w) * WASH_TINT);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, p = i * 4, m3 = inside[i];
    if (!rgba[p + 3]) { px[p + 3] = 0; continue; }
    const out = [rgba[p], rgba[p + 1], rgba[p + 2]];
    if (m3 > 0) {

      const near = clamp01(1 - Math.sqrt(((x - fx) / W) ** 2 + ((y - fy) / H) ** 2 * 0.15) / 0.45);
      const mix = clamp01(near * 0.8 + cloud[i] * 0.5 - 0.15), ga = clamp01(1 - Math.hypot(x - gx, y - fy) / gr) ** 1.8;
      const back = clamp01(((playerSide ? fx - x : x - fx)) / (hr * 2.2) + 0.35); // 0 in front of the face .. 1 well behind it
      const ea = echoA[i] * ECHO[3] * (0.4 + 0.6 * back), sp = clamp01(spread[i] * EDGE[1]) * (0.75 + 0.25 * back);

      const al = artA[i], light2 = clamp01(1 - Math.hypot(x - fx, y - fy) / (hr * 1.3)) * FACE_LIGHT;
      const lift = (80 - Math.min((px[p] + px[p + 1] + px[p + 2]) / 3, 80)) * WASH[0];
      const wash = WASH[1] + WASH[2] * back, white2 = clamp01(back - 0.55) * WASH[3];
      for (let c = 0; c < 3; c++) {
        const base = dark[c] + (mid[c] - dark[c]) * mix;
        let col = base + (light[c] - base) * streak[i];
        col += (glowColour[c] - col) * ga * 0.95;
        col += (glowColour[c] + (WHITE[c] - glowColour[c]) * (ECHO_WHITE + (1 - ECHO_WHITE) * back) - col) * ea;
        col += (glowColour[c] + (WHITE[c] - glowColour[c]) * back ** 0.7 - col) * sp;
        let rgb = px[p + c] + lift;
        rgb += (washc[c] - rgb) * wash;
        rgb += (255 - rgb) * light2;
        rgb += (WHITE[c] - rgb) * white2;
        col = col * (1 - al) + rgb * al;
        out[c] += (col - out[c]) * m3;
      }
    }
    px[p] = out[0]; px[p + 1] = out[1]; px[p + 2] = out[2];
    px[p + 3] = rgba[p + 3] + (255 - rgba[p + 3]) * m3;
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

function drawShout(art, info, pts, type, playerSide, S, size) {
  const W = CELL_W * S, H = CELL_H * S;
  const { flip, k, x0, y0, fx, fy } = artPlace(info, pts, playerSide, S);
  const canvas = makeCanvas(W, H), ctx = canvas.getContext('2d', { willReadFrequently: true });
  const pixels = artLayer(art, info, flip, Math.round(fx - (fx - x0) * size), Math.round(fy - (fy - y0) * size), k * size, W, H), px = pixels.data;
  const { inside } = typeFrame(S, type);
  for (let i = 0, p = 0; i < W * H; i++, p += 4) {
    for (let c = 0; c < 3; c++) px[p + c] += (WHITE[c] - px[p + c]) * 0.35;
    px[p + 3] *= inside[i];
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

export const FRAME_MS = 75;
export const TIMELINE = Object.freeze([[0.2, 1, null], [1, 1, [1.2, 0.4]], [1, 1, [1.4, 0.16]], [1, 1, null], [1, 1, null], [1, 1, null], [1, 1, null],
  [1, 1, null], [1, 0.7, null], [1, 0.4, null]]);

export const SHOUT = Object.freeze({ 3: [1.12, 0.45], 4: [1.24, 0.28], 5: [1.36, 0.12] });

export const FIELD_CENTRE = Object.freeze([175, 72.5]);

/** Moves that bring their own cut-in in their anim */
const OWN_CUTIN = new Set(['catastropika']);

export const showsCutIn = moveId => !OWN_CUTIN.has(toID(moveId)) && !!cutInType(entry('moves', moveId)?.type);

const arts = new Map();

function loadArt(assets, id, { timeLimit, timeoutMs = ARTWORK_TIMEOUT_MS } = {}) {
  const url = `${ARTWORK_BASE}${id}.png`;
  let work = arts.get(url);
  if (!work) {
    work = assets.loadImage(url).then(img => ({ img, info: artInfo(img) }));
    work.catch(() => { if (arts.get(url) === work) arts.delete(url); });
    arts.set(url, work);
    while (arts.size > 6) arts.delete(arts.keys().next().value);
  }
  return timeLimit ? timeLimit(work, timeoutMs) : work;
}

export const CUTIN_SOUND = 'battle_anims/PRSFX- Catastropika1.wav';

export function prefetchCutIn(scene, side) {
  const id = cutInId(scene.requireMon(side)?.mon);
  if (!id) return false;
  loadArt(scene.assets, id).catch(() => {});
  return true;
}

export async function playCutIn(scene, side, type, playerSide, { delay, timeLimit, S = 6, sound }) {
  const mon = scene.requireMon(side)?.mon, id = cutInId(mon);
  if (!id || !cutInType(type)) return false;
  const { img, info } = await loadArt(scene.assets, id, { timeLimit });
  scene.life.check();
  const pts = cutInPoints(id);
  const key = `cutin:${side}:${id}:${type}`;
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, drawCutIn(img, info, pts, type, playerSide, S));
  const shoutKeys = {};
  for (const [f, [size]] of Object.entries(SHOUT)) {
    shoutKeys[f] = `${key}:shout${f}`;
    if (!scene.textures.exists(shoutKeys[f])) scene.textures.addCanvas(shoutKeys[f], drawShout(img, info, pts, type, playerSide, S, size));
  }
  const [cx, cy] = FIELD_CENTRE, sprites = [];
  const add = (k = key) => {
    const sprite = scene.add.image(cx, cy, k).setOrigin(0.5).setScale(1 / S);
    scene.field.add(sprite); scene.field.bringToTop(sprite); sprites.push(sprite);
    return sprite;
  };
  try {
    const main = add();
    let ghost = null, shout = null;
    for (const [f, [scaleY, alpha, after]] of TIMELINE.entries()) {
      scene.life.check();
      if (f === 0) sound?.();
      main.setScale(1 / S, scaleY / S).setAlpha(alpha);
      if (after) { ghost ??= add(); ghost.setScale(after[0] / S).setAlpha(after[1]).setVisible(true); scene.field.bringToTop(ghost); }
      else ghost?.setVisible(false);
      const sh = SHOUT[f];
      if (sh) { if (shout) shout.setTexture(shoutKeys[f]); else shout = add(shoutKeys[f]); shout.setScale(1 / S).setAlpha(sh[1]).setVisible(true); }
      else shout?.setVisible(false);
      await delay(FRAME_MS);
    }
  } finally {
    for (const sprite of sprites) sprite.destroy();
    for (const k of [key, ...Object.values(shoutKeys)]) if (scene.textures.exists(k)) scene.textures.remove(k);
  }
  return true;
}
