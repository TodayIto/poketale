import { rgbaBounds, unionBounds } from './placement.js';
import { opaquePixels, median } from './pixels.js';
import { FEMALE_SPRITES } from './showdown-female.js';

const ROOT = 'https://play.pokemonshowdown.com/sprites/';
const FEMALE = Object.fromEntries(Object.entries(FEMALE_SPRITES).map(([set, sides]) =>
  [set, Object.fromEntries(Object.entries(sides).map(([side, ids]) => [side, new Set(ids.split(' '))]))]));

export const femaleSprite = (mon, back, set) => mon.gender === 'F' && FEMALE[set][back ? 'back' : 'front'].has(mon.spriteId.replaceAll('-', ''));

export const hasFemaleSprite = (mon, back) => femaleSprite(mon, back, 'ani') || femaleSprite(mon, back, 'gen5');

export function showdownUrl(mon, back, set) {
  if (!/^[a-z0-9-]+$/.test(mon.spriteId)) throw new Error(`Invalid spriteId: ${mon.spriteId}`);
  const suffix = `${back ? '-back' : ''}${mon.shiny ? '-shiny' : ''}`;
  const name = `${mon.spriteId}${femaleSprite(mon, back, set === 'ani' ? 'ani' : 'gen5') ? '-f' : ''}`;
  return `${ROOT}${set}${suffix}/${name}.${set === 'gen5' ? 'png' : 'gif'}`;
}

export function imageKind(bytes) {
  const h = new Uint8Array(bytes);
  if (h.length >= 6 && String.fromCharCode(...h.subarray(0, 6)).match(/^GIF8[79]a$/)) return 'image/gif';
  if (h.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => h[i] === v)) return 'image/png';
  if (h.length >= 12 && String.fromCharCode(...h.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...h.subarray(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}

function frameGrid(width, height, count) {
  const columns = Math.ceil(Math.sqrt(count));
  const canvas = document.createElement('canvas');
  canvas.width = columns * width; canvas.height = Math.ceil(count / columns) * height;
  return { canvas, context: canvas.getContext('2d'), width, height, count,
    cell: i => [(i % columns) * width, Math.floor(i / columns) * height] };
}

export async function decodeGif(bytes) {
  if (typeof ImageDecoder === 'undefined') throw new Error('ImageDecoder is required for animated Showdown sprites');
  const decoder = new ImageDecoder({ data: bytes, type: 'image/gif' });
  try {
    await decoder.tracks.ready;
    const count = decoder.tracks.selectedTrack.frameCount, durations = [];
    let grid;
    for (let i = 0; i < count; i++) {
      const { image } = await decoder.decode({ frameIndex: i });
      try {
        grid ??= frameGrid(image.displayWidth, image.displayHeight, count);
        grid.context.drawImage(image, ...grid.cell(i));
        durations.push(Math.max(1, (image.duration ?? 100000) / 1000));
      } finally { image.close(); }
    }
    if (!grid) throw new Error('Empty GIF');
    return { ...grid, durations };
  } finally { decoder.close(); }
}

function frameMetrics(grid) {
  const { canvas, width: w, height: h } = grid, stride = canvas.width * 4;
  const data = grid.context.getImageData(0, 0, canvas.width, canvas.height).data;
  return Array.from({ length: grid.count }, (_, i) => {
    const [x0, y0] = grid.cell(i);
    let left = w, top = h, right = 0, bottom = 0, opaque = 0;
    for (let y = 0; y < h; y++) {
      let first = -1, last = -1;
      for (let x = 0, a = (y0 + y) * stride + x0 * 4 + 3; x < w; x++, a += 4) {
        if (!data[a]) continue;
        if (first < 0) first = x;
        last = x; opaque++;
      }
      if (first < 0) continue;
      if (first < left) left = first;
      if (last + 1 > right) right = last + 1;
      if (y < top) top = y;
      bottom = y + 1;
    }
    return { bounds: right > left ? { left, top, right, bottom } : null, opaquePixels: opaque };
  });
}

function packFrames(grid, frameBounds, limit) {
  const cuts = frameBounds.map(b => ({ w: b?.right ?? 1, h: b?.bottom ?? 1 }));
  const tall = [...cuts].sort((a, b) => b.h - a.h);
  const shelve = (width, place) => {
    let x = 0, y = 0, rowHeight = 0, used = 0;
    for (const c of tall) {
      if (x + c.w > width) { x = 0; y += rowHeight; rowHeight = 0; }
      if (place) { c.x = x; c.y = y; }
      x += c.w; used = Math.max(used, x); rowHeight = Math.max(rowHeight, c.h);
    }
    return [used, y + rowHeight];
  };
  let best;
  for (let width = Math.max(...cuts.map(c => c.w)); width <= limit; width++) {
    const [w, h] = shelve(width);
    if (h <= limit && !(best?.area <= w * h)) best = { width, area: w * h };
    if (h === tall[0].h) break;
  }
  if (!best) throw new Error('GIF atlas exceeds GPU texture size');
  const canvas = document.createElement('canvas');
  [canvas.width, canvas.height] = shelve(best.width, true);
  const context = canvas.getContext('2d');
  cuts.forEach((c, i) => {
    const [x0, y0] = grid.cell(i);
    context.drawImage(grid.canvas, x0, y0, c.w, c.h, c.x, c.y, c.w, c.h);
  });
  return { canvas, cuts };
}

export function canvasBounds(canvas) {
  return canvasMetrics(canvas).bounds;
}

export function canvasMetrics(canvas) {
  const { width, height } = canvas;
  const data = canvas.getContext('2d').getImageData(0, 0, width, height).data;
  return { bounds: rgbaBounds(data, width, height), opaquePixels: opaquePixels(data) };
}

async function imageGrid(assets, src) {
  const img = await assets.loadImage(src);
  const grid = { ...frameGrid(img.width, img.height, 1), durations: [100] };
  grid.context.drawImage(img, 0, 0);
  return grid;
}

const textureLimit = assets => {
  const gl = assets.scene.game.renderer.gl;
  return Math.min(gl ? gl.getParameter(gl.MAX_TEXTURE_SIZE) : 4096, 4096);
};

function copyCanvas(source) {
  const canvas = document.createElement('canvas');
  canvas.width = source.width; canvas.height = source.height;
  canvas.getContext('2d').drawImage(source, 0, 0);
  return canvas;
}

const copySheet = sheet => ({ ...sheet, canvas: copyCanvas(sheet.canvas), cuts: sheet.cuts.map(c => ({ ...c })),
  bounds: { ...sheet.bounds }, durations: [...sheet.durations] });

export async function showdownSprite(assets, mon, back, key, url, bytes, failures, cached, entry = null) {
  const kind = imageKind(bytes);
  const png = url.endsWith('.png');
  if (kind !== (png ? 'image/png' : 'image/gif')) throw new Error('Unexpected image signature (404 or non-image response)');
  if (!png) {
    const stored = entry?.sheet;
    if (stored && stored.url === url && stored.limit === textureLimit(assets)) {
      assets.life.check();
      return installSheet(assets, mon, back, key, url, copySheet(stored), failures, cached);
    }
  }
  let grid;
  if (png) {
    const objectUrl = URL.createObjectURL(new Blob([bytes], { type: kind }));
    try { grid = await imageGrid(assets, objectUrl); } finally { URL.revokeObjectURL(objectUrl); }
  } else grid = await decodeGif(bytes);
  return sheetSprite(assets, mon, back, key, url, grid, failures, cached, png ? null : entry);
}

export async function imageSprite(assets, mon, back, key, url, failures) {
  return sheetSprite(assets, mon, back, key, url, await imageGrid(assets, url), failures, false);
}

function sheetSprite(assets, mon, back, key, url, grid, failures, cached, entry = null) {
  assets.life.check();
  const { width, height, durations } = grid;
  const metrics = frameMetrics(grid);
  const bounds = unionBounds(metrics.map(f => f.bounds));
  const medianOpaquePixels = median(metrics.map(f => f.opaquePixels));
  if (!(medianOpaquePixels > 0)) throw new Error('Sprite has no median body area');
  const limit = textureLimit(assets);
  const { canvas, cuts } = packFrames(grid, metrics.map(f => f.bounds), limit);
  grid.canvas.width = 0;
  const sheet = { canvas, cuts, width, height, bounds, medianOpaquePixels, durations };
  if (entry) entry.sheet = { ...copySheet(sheet), url, limit, size: canvas.width * canvas.height * 4 };
  return installSheet(assets, mon, back, key, url, sheet, failures, cached);
}

function installSheet(assets, mon, back, key, url, sheet, failures, cached) {
  const { canvas, cuts, width: w, height: h, bounds, medianOpaquePixels, durations } = sheet;
  const texture = assets.scene.textures.addCanvas(key, canvas);
  cuts.forEach((c, i) => texture.add(i, 0, c.x, c.y, c.w, c.h).setTrim(w, h, 0, 0, c.w, c.h));

  assets.scene.anims.create({ key, frameRate: 1000, repeat: -1,
    frames: durations.map((ms, i) => ({ key, frame: i, duration: ms - 1 })) });
  const result = { key, frame: 0, bounds, width: w, height: h, medianOpaquePixels, url, durations, fallback: failures };
  assets.diagnostics.push({ sprite: mon.spriteId, back, url, frames: durations.length, cached, bounds, width: w, height: h,
    sheet: [canvas.width, canvas.height], medianOpaquePixels, durations, fallback: failures });
  return result;
}
