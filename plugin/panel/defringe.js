// Remove unwanted edge colors from panel sprites.
import { LoadError } from '../../view/retry.js';

export const DEFRINGE = Object.freeze({
  SOLID: 128,
  GLOW_ALPHA: 240,
  LIGHT: 80,
  GREY: 48,
  DARK: 72,
  REACH: 2,
  DEPTH: 2,
  NEAR: 2,
});

const luma = (r, g, b) => (r * 299 + g * 587 + b * 114) / 1000;

const ringAlpha = (pixel, outline) => Math.round(255 * Math.min(1, Math.max(0, (255 - pixel) / Math.max(1, 255 - outline))));

const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

export function defringe(data, width, height, options = {}) {
  const { SOLID, GLOW_ALPHA, LIGHT, GREY, DARK, REACH, DEPTH, NEAR } = { ...DEFRINGE, ...options };
  const size = width * height;
  const alpha = i => data[i * 4 + 3];
  const light = i => {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    return luma(r, g, b) >= LIGHT && Math.max(r, g, b) - Math.min(r, g, b) <= GREY;
  };
  const neighbours = (i, count = 8) => {
    const x = i % width, y = (i - x) / width, out = [];
    for (let s = 0; s < count; s++) {
      const nx = x + STEPS[s][0], ny = y + STEPS[s][1];
      out.push(nx < 0 || ny < 0 || nx >= width || ny >= height ? -1 : ny * width + nx);
    }
    return out;
  };
  const outside = j => j < 0 || alpha(j) === 0;
  const glowLike = i => alpha(i) > 0 && alpha(i) < GLOW_ALPHA && light(i);

  const halo = new Uint8Array(size);
  const queue = [];
  for (let i = 0; i < size; i++) if (glowLike(i) && neighbours(i, 4).some(outside)) { halo[i] = 1; queue.push(i); }
  for (let q = 0; q < queue.length; q++) {
    for (const j of neighbours(queue[q], 4)) if (j >= 0 && !halo[j] && glowLike(j)) { halo[j] = 1; queue.push(j); }
  }

  const solid = j => j >= 0 && !halo[j] && alpha(j) >= SOLID;
  const outline = j => solid(j) && !light(j) && luma(data[j * 4], data[j * 4 + 1], data[j * 4 + 2]) <= DARK;
  const outlineNear = i => {
    const x = i % width, y = (i - x) / width;
    for (let dy = -REACH; dy <= REACH; dy++) {
      for (let dx = -REACH; dx <= REACH; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < width && ny < height && outline(ny * width + nx)) return true;
      }
    }
    return false;
  };
  const ringLike = i => !halo[i] && alpha(i) >= GLOW_ALPHA && light(i) && outlineNear(i);
  let layer = [];
  for (let i = 0; i < size; i++) if (ringLike(i) && neighbours(i, 4).some(j => outside(j) || halo[j] === 1)) layer.push(i);
  for (let depth = 1; depth <= DEPTH && layer.length; depth++) {
    for (const i of layer) halo[i] = 2;
    const next = new Set();
    for (const i of layer) for (const j of neighbours(i, 4)) if (j >= 0 && ringLike(j)) next.add(j);
    layer = [...next];
  }

  const from = new Int32Array(size).fill(-1), dist = new Int32Array(size).fill(-1);
  const front = [];
  for (let i = 0; i < size; i++) {
    if (!halo[i]) continue;
    const source = neighbours(i).find(solid);
    if (source !== undefined) { from[i] = source; dist[i] = 1; front.push(i); }
  }
  for (let q = 0; q < front.length; q++) {
    const i = front[q];
    for (const j of neighbours(i)) if (j >= 0 && halo[j] && dist[j] < 0) { from[j] = from[i]; dist[j] = dist[i] + 1; front.push(j); }
  }
  let changed = 0;
  for (let i = 0; i < size; i++) {
    if (!halo[i]) continue;
    const at = i * 4;
    if (from[i] < 0 || dist[i] > (halo[i] === 1 ? NEAR : 1)) {
      if (data[at + 3] !== 0) { data[at + 3] = 0; changed++; }
      continue;
    }
    const src = from[i] * 4;

    const alphaNow = halo[i] === 2 ? ringAlpha(luma(data[at], data[at + 1], data[at + 2]), luma(data[src], data[src + 1], data[src + 2])) : data[at + 3];
    if (data[at] !== data[src] || data[at + 1] !== data[src + 1] || data[at + 2] !== data[src + 2] || data[at + 3] !== alphaNow) changed++;
    data[at] = data[src]; data[at + 1] = data[src + 1]; data[at + 2] = data[src + 2]; data[at + 3] = alphaNow;
  }
  return changed;
}

function image(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new LoadError(`그림을 받지 못함: ${src}`));
    img.src = src;
  });
}

function cleaned(img) {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(img, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  defringe(pixels.data, canvas.width, canvas.height);
  context.putImageData(pixels, 0, 0);
  return canvas.toDataURL('image/png');
}

export async function defringeAddress(address, fetchBytes = null) {
  if (address.startsWith('data:')) return cleaned(await image(address));
  try {
    return cleaned(await image(address));
  } catch (error) {
    if (!fetchBytes) throw error;
  }
  const blob = URL.createObjectURL(new Blob([await fetchBytes(address)]));
  try { return cleaned(await image(blob)); } finally { URL.revokeObjectURL(blob); }
}
