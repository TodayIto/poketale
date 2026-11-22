import TABLE from '../../data/trainer-palettes.json' with { type: 'json' };

export const SHARED_COLORS = Object.freeze(['#000000', '#f8f8f8', '#d8a078', '#f8d0b8', '#784858', '#b87860']);

export const TARGETS = TABLE.targets;

export const PALETTES = TABLE.sprites;

export const STYLE_POLICY = TABLE.policy;

export const STYLE_SNAP = TABLE.snap;

export const level32 = (r, g, b) => (((r >> 3) << 3) << 16) | (((g >> 3) << 3) << 8) | ((b >> 3) << 3);
export const hexOf = n => `#${n.toString(16).padStart(6, '0')}`;
const numOf = hex => parseInt(hex.slice(1), 16);

export const hasHair = sprite => !!(PALETTES[sprite]?.parts.hair?.length || PALETTES[sprite]?.parts.hat?.length);

const RECOLOR_RE = /^(.+)~(\d+)-(\d+)-(\d+)$/;

function usable(sprite, combo) {
  const entry = PALETTES[sprite];
  if (!entry || !combo) return null;
  const pick = (part, list) => {
    const n = combo[part];
    return Number.isInteger(n) && n >= 1 && n <= TARGETS[list].length && entry.parts[part]?.length ? n : 0;
  };

  const hair = Number.isInteger(combo.hair) && combo.hair >= 1 && combo.hair <= TARGETS.hair.length && hasHair(sprite) ? combo.hair : 0;
  return { hair, hat: entry.parts.hat?.length ? hair : 0, top: pick('top', 'outfit'), bottom: pick('bottom', 'outfit') };
}

export function recolorKey(sprite, combo) {
  const c = usable(sprite, combo);
  if (!c || !(c.hair || c.top || c.bottom)) return sprite;
  return `${sprite}~${c.hair}-${c.top}-${c.bottom}`;
}

export function parseRecolorKey(key) {
  const m = typeof key === 'string' ? RECOLOR_RE.exec(key) : null;
  return m ? { sprite: m[1], combo: { hair: +m[2], top: +m[3], bottom: +m[4] } } : { sprite: key, combo: null };
}

export function rampIndexes(n, m) {
  if (n === 1) return [Math.round((m - 1) / 2)];
  const a = Math.max(0, (m - 1) / 2 - (n - 1)), span = m - 1 - 2 * a;
  return Array.from({ length: n }, (_, i) => Math.round(a + (i * span) / (n - 1)));
}

export function colorMap(sprite, combo) {
  const entry = PALETTES[sprite], c = usable(sprite, combo);
  const direct = new Map(), byPart = {};
  if (!entry || !c) return { direct, split: [] };
  for (const [part, list] of [['hair', 'hair'], ['hat', 'hair'], ['top', 'outfit'], ['bottom', 'outfit']]) {
    const colors = entry.parts[part];
    if (!c[part] || !colors?.length) continue;
    const target = TARGETS[list][c[part] - 1].ramp; // a hat: its own ramp onto the hair colour's (c.hat = c.hair)
    const at = rampIndexes(colors.length, target.length);
    byPart[part] = new Map(colors.map((hex, i) => [numOf(hex), numOf(target[at[i]])]));
    for (const [from, to] of byPart[part]) direct.set(from, to);
  }
  // a split colour's new colour comes from the ramp of the part its band names
  const split = (entry.split ?? []).map(rule => ({ colors: new Set(rule.colors.map(numOf)), bands: rule.bands.map(([until, part]) => [until, byPart[part]]) }));
  for (const rule of split) for (const n of rule.colors) direct.delete(n);
  return { direct, split: split.filter(rule => rule.bands.some(([, map]) => map)) };
}

export function recolorPixels(data, width, frames, { direct, split }) {
  if (!direct.size && !split.length) return data;
  const done = new Set();
  const lookup = (n, at) => {
    for (const rule of split) if (rule.colors.has(n)) return rule.bands.find(([until]) => at < until)?.[1]?.get(n);
    return direct.get(n);
  };
  for (const f of frames) {
    const { x, y, w, h } = f.frame, id = `${x},${y},${w},${h}`;
    if (done.has(id)) continue;
    done.add(id);
    const top = f.spriteSourceSize?.y ?? 0, cell = f.sourceSize?.h ?? h;
    for (let row = y; row < y + h; row++) {
      const at = (top + row - y) / cell;
      for (let col = x; col < x + w; col++) {
        const i = (row * width + col) * 4;
        if (data[i + 3] !== 255) continue;
        const to = lookup(level32(data[i], data[i + 1], data[i + 2]), at);
        if (to === undefined) continue;
        data[i] = to >> 16; data[i + 1] = (to >> 8) & 255; data[i + 2] = to & 255;
      }
    }
  }
  return data;
}

export const wholeFrame = (w, h) => [{ frame: { x: 0, y: 0, w, h }, spriteSourceSize: { y: 0 }, sourceSize: { h } }];

function faceFrame(sprite, w, h) {
  const at = PALETTES[sprite]?.faceAt;
  return at ? [{ frame: { x: 0, y: 0, w, h }, spriteSourceSize: { y: -at[0] }, sourceSize: { h: at[1] } }] : wholeFrame(w, h);
}

export function recoloredCanvas(image, sprite, combo, frames = null) {
  const w = image.naturalWidth ?? image.width, h = image.naturalHeight ?? image.height;
  const canvas = Object.assign(document.createElement('canvas'), { width: w, height: h });
  const g = canvas.getContext('2d', { willReadFrequently: true });
  g.drawImage(image, 0, 0);
  const pixels = g.getImageData(0, 0, w, h);
  recolorPixels(pixels.data, w, frames ?? wholeFrame(w, h), colorMap(sprite, combo));
  g.putImageData(pixels, 0, 0);
  return canvas;
}

const KEEP = 6;
const kept = new Map();
function keep(key, canvas) {
  kept.delete(key); kept.set(key, canvas);
  while (kept.size > KEEP) {
    const [oldest, old] = kept.entries().next().value;
    kept.delete(oldest);
    old.width = 0;
  }
}
const copyOf = source => {
  const canvas = Object.assign(document.createElement('canvas'), { width: source.width, height: source.height });
  canvas.getContext('2d').drawImage(source, 0, 0);
  return canvas;
};

export function loadRecoloredAtlas(assets, key, path, json) {
  const textures = assets.scene.textures;
  if (textures.exists(key)) return Promise.resolve();
  if (!assets.pending.has(key)) {
    const promise = (async () => {
      let source = kept.get(key);
      if (!source) {
        const img = await assets.loadImage(assets.url(path));
        assets.life.check();
        const { sprite, combo } = parseRecolorKey(key);
        source = recoloredCanvas(img, sprite, combo, json.frames);
      }
      keep(key, source);
      if (!textures.exists(key)) textures.addAtlas(key, copyOf(source), json);
    })().catch(e => { assets.pending.delete(key); throw e; });
    assets.pending.set(key, promise);
  }
  return assets.pending.get(key);
}

const FACE_KEEP = 32;
const faces = new Map(); // key -> Promise<string | null>

export function recoloredFace(key, bytes) {
  if (faces.has(key)) { const hit = faces.get(key); faces.delete(key); faces.set(key, hit); return hit; }
  const promise = (async () => {
    const { sprite, combo } = parseRecolorKey(key);
    const url = URL.createObjectURL(new Blob([await bytes()], { type: 'image/png' }));
    try {
      const img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image); image.onerror = () => reject(new Error('not a picture'));
        image.src = url;
      });
      const canvas = Object.assign(document.createElement('canvas'), { width: img.naturalWidth, height: img.naturalHeight });
      canvas.getContext('2d').drawImage(img, 0, 0);
      return recoloredCanvas(canvas, sprite, combo, faceFrame(sprite, canvas.width, canvas.height)).toDataURL('image/png');
    } finally { URL.revokeObjectURL(url); }
  })().catch(() => null);
  faces.set(key, promise);
  while (faces.size > FACE_KEEP) faces.delete(faces.keys().next().value);
  return promise;
}
