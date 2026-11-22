// Cut-in mask from PokeRogue assets. Credits: view/LICENSE-NOTE.md.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const OUT = 'view/anims/cutin-table.json';
const SRC = 'vendor/pokerogue/assets/images/battle_anims/PRAS- Catastropika.png';
const CELL = { left: 0, top: 192, width: 288, height: 96 }; // cells 10, 11, 12 (tools/cutin-preview.py CELL)
const ERODE = Math.ceil(1.5 + 1.0 + 0.5); // cutin-preview.py bolt_inner: BLACK + WHITE + 0.5, rounded up
const FACING = { L: 0, R: 1, F: 2 };

export function mergePoints(files) {
  const merged = {};
  for (const [file, table] of files) {
    for (const [id, value] of Object.entries(table)) {
      if (!/^\d+$/.test(id)) throw new Error(`${file}: key ${id} is not a PokeAPI id`);
      if (merged[id] && JSON.stringify(merged[id][1]) !== JSON.stringify(value)) throw new Error(`${id}: ${merged[id][0]} and ${file} differ`);
      merged[id] ??= [file, value];
    }
  }
  const pts = {};
  for (const id of Object.keys(merged).sort((a, b) => a - b)) {
    const p = merged[id][1];
    if (!(p.facing in FACING) || !p.eyes?.length || p.head?.length !== 3) throw new Error(`${id}: incomplete points`);
    pts[id] = [FACING[p.facing], ...p.head, ...p.mouthTop, ...p.mouthBottom, ...p.eyes.flat()];
  }
  return pts;
}

export function innerMask(alpha, width, height) {
  const a = (x, y) => alpha[((y + height) % height) * width + ((x + width) % width)] > 0;
  const mirrored = (x, y) => a(width - 1 - ((x + width) % width), y);
  const rows = [];
  for (let y = 0; y < height; y++) {
    const runs = [];
    let start = -1;
    for (let x = 0; x <= width; x++) {
      let inside = x < width;
      for (let dy = -ERODE; inside && dy <= ERODE; dy++) for (let dx = -ERODE; inside && dx <= ERODE; dx++) {
        if (dx * dx + dy * dy <= ERODE * ERODE && !mirrored(x - dx, y - dy)) inside = false;
      }
      if (inside && start < 0) start = x;
      if (!inside && start >= 0) { runs.push(start, x); start = -1; }
    }
    rows.push(runs);
  }
  return rows;
}

export function sourceFiles(dir = new URL('view/anims/', root)) {
  return readdirSync(dir).filter(f => /^cutin-points(-[\w-]+)?\.json$/.test(f)).sort()
    .map(f => [f, JSON.parse(readFileSync(new URL(f, dir), 'utf8'))]);
}

export function format({ mask, pts }) {
  return `{"mask":[\n${mask.map(r => JSON.stringify(r)).join(',\n')}\n],\n"pts":{\n${Object.entries(pts).map(([k, v]) => `${JSON.stringify(k)}:${JSON.stringify(v)}`).join(',\n')}\n}}\n`;
}

async function main() {
  const sharp = createRequire(import.meta.url)('sharp');
  const { data, info } = await sharp(fileURLToPath(new URL(SRC, root))).extract(CELL).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alpha = new Uint8Array(info.width * info.height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * info.channels + 3];
  const text = format({ mask: innerMask(alpha, info.width, info.height), pts: mergePoints(sourceFiles()) });
  if (process.argv.includes('--check')) {
    if (readFileSync(new URL(OUT, root), 'utf8') !== text) { console.error(`${OUT} is out of date: run node tools/build-cutin-table.mjs`); process.exit(1); }
    console.log(`${OUT} up to date`);
  } else {
    writeFileSync(new URL(OUT, root), text);
    console.log(`${OUT}: ${Object.keys(JSON.parse(text).pts).length} entries, ${text.length} bytes`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
