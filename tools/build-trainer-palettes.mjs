import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { LOOK_PICTURES } from '../story/trainer-look.mjs';
import { SHARED_COLORS, level32, hexOf } from '../view/sprites/recolor.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const TRAINERS = resolve(root, 'vendor/pokerogue/assets/images/trainer');
/** The look pictures, in table order: [PokeRogue key, Showdown face] */
export const LOOK_SPRITES = Object.freeze(Object.values(LOOK_PICTURES).flat().map(([sprite, face]) => [sprite, face]));

export async function loadSprite(key) {
  const atlas = JSON.parse(readFileSync(resolve(TRAINERS, `${key}.json`), 'utf8'));
  const frames = atlas.textures ? atlas.textures.flatMap(t => t.frames) : Object.values(atlas.frames);
  const { data, info } = await sharp(resolve(TRAINERS, `${key}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const seen = new Set(), unique = [];
  for (const f of frames) {
    const id = JSON.stringify(f.frame);
    if (!seen.has(id)) { seen.add(id); unique.push(f); }
  }
  return { key, data, width: info.width, height: info.height, frames: unique };
}

export function colorStats({ data, width, frames }) {
  const stats = new Map();
  for (const f of frames) {
    const { x, y, w, h } = f.frame;
    for (let row = y; row < y + h; row++) for (let col = x; col < x + w; col++) {
      const i = (row * width + col) * 4;
      if (data[i + 3] !== 255) continue;
      const hex = hexOf(level32(data[i], data[i + 1], data[i + 2]));
      const s = stats.get(hex) ?? stats.set(hex, { count: 0, high: 0, ys: 0 }).get(hex);
      const at = (f.spriteSourceSize.y + row - y) / f.sourceSize.h;
      s.count++; s.ys += at; if (at < 0.35) s.high++;
    }
  }
  return new Map([...stats].map(([hex, s]) => [hex, { count: s.count, high: s.high / s.count, y: s.ys / s.count }]));
}

const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const luma = hex => { const [r, g, b] = rgb(hex); return 0.299 * r + 0.587 * g + 0.114 * b; };
function hue(hex) {
  const [r, g, b] = rgb(hex).map(v => v / 255), max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max - min < 0.12) return null; // grey
  const d = max - min;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}
const nearHue = (a, b) => (a === null || b === null ? a === b : Math.min(Math.abs(a - b), 360 - Math.abs(a - b)) <= 35);

function touching({ data, width, frames }, min = 3) {
  const pairs = new Map();
  const at = i => (data[i + 3] === 255 ? hexOf(level32(data[i], data[i + 1], data[i + 2])) : null);
  for (const f of frames) {
    const { x, y, w, h } = f.frame;
    for (let row = y; row < y + h; row++) for (let col = x; col < x + w; col++) {
      const a = at((row * width + col) * 4);
      if (!a) continue;
      for (const [dc, dr] of [[1, 0], [0, 1]]) {
        if (col + dc >= x + w || row + dr >= y + h) continue;
        const b = at(((row + dr) * width + col + dc) * 4);
        if (b && b !== a) { const id = [a, b].sort().join('|'); pairs.set(id, (pairs.get(id) ?? 0) + 1); }
      }
    }
  }
  return new Set([...pairs].filter(([, n]) => n >= min).map(([id]) => id));
}

export function draftEntry(sprite, face) {
  const stats = colorStats(sprite), touch = touching(sprite);
  const colors = [...stats.keys()].filter(hex => !SHARED_COLORS.includes(hex));
  const group = new Map(colors.map(c => [c, c]));
  const find = c => (group.get(c) === c ? c : find(group.get(c)));
  for (const a of colors) for (const b of colors) {
    if (a < b && touch.has(`${a}|${b}`) && nearHue(hue(a), hue(b))) group.set(find(a), find(b));
  }
  const ramps = new Map();
  for (const c of colors) (ramps.get(find(c)) ?? ramps.set(find(c), []).get(find(c))).push(c);
  const total = [...stats.values()].reduce((n, s) => n + s.count, 0);
  const parts = {}, split = [];
  for (const ramp of ramps.values()) {
    const count = ramp.reduce((n, c) => n + stats.get(c).count, 0);
    const y = ramp.reduce((n, c) => n + stats.get(c).y * stats.get(c).count, 0) / count;
    const part = count / total < 0.03 ? 'accent' : y < 0.3 ? 'hair' : y < 0.62 ? 'top' : 'bottom';
    (parts[part] ??= []).push(...ramp);
    for (const c of ramp) if (stats.get(c).high > 0.2 && stats.get(c).high < 0.8 && part !== 'accent') split.push(c);
  }
  for (const list of Object.values(parts)) list.sort((a, b) => luma(a) - luma(b));
  return { face, parts, ...(split.length ? { split: [{ colors: split, bands: [[0.35, 'hair'], [1, 'bottom']] }] } : {}) };
}

const PARTS = ['hair', 'hat', 'top', 'bottom', 'accent']; // hat: takes the hair colour (view/sprites/recolor.js)

export async function checkTable(table) {
  const problems = [];
  for (const [key, entry] of Object.entries(table.sprites)) {
    const stats = colorStats(await loadSprite(key));
    const split = entry.split ?? [];
    const listed = [...Object.values(entry.parts).flat(), ...split.flatMap(s => s.colors)];
    for (const hex of listed) {
      if (!stats.has(hex)) problems.push(`${key}: ${hex} not in the picture`);
      if (SHARED_COLORS.includes(hex)) problems.push(`${key}: ${hex} is a shared colour`);
    }
    for (const part of Object.keys(entry.parts)) if (!PARTS.includes(part)) problems.push(`${key}: unknown part ${part}`);
    const splitColors = new Set(split.flatMap(s => s.colors));
    const seen = new Set();
    for (const hex of Object.values(entry.parts).flat()) {
      if (seen.has(hex) && !splitColors.has(hex)) problems.push(`${key}: ${hex} in two parts without a split`);
      seen.add(hex);
    }
    for (const rule of split) {
      const limits = rule.bands.map(([until]) => until);
      if (limits.some((u, i) => i && u <= limits[i - 1]) || limits.at(-1) !== 1) problems.push(`${key}: split bands must rise to 1`);
      for (const [, part] of rule.bands) if (part !== 'none' && !entry.parts[part]) problems.push(`${key}: split names ${part}, which the entry has not`);
    }
  }
  return problems;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    const table = JSON.parse(readFileSync(resolve(root, 'data/trainer-palettes.json'), 'utf8'));
    const problems = await checkTable(table);
    if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
    console.log(`ok: ${Object.keys(table.sprites).length} pictures`);
  } else {
    const out = {};
    for (const [key, face] of LOOK_SPRITES) out[key] = draftEntry(await loadSprite(key), face);
    console.log(JSON.stringify(out, null, 1));
  }
}
