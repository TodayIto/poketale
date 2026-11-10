import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const ASSETS = resolve(root, 'vendor/pokerogue/assets');
const OUT = resolve(root, 'plugin/battle/pinned-assets.json');
export const HASH_BYTES = 6;

const base = /DEFAULT_ASSET_BASE = '([^']+)'/.exec(readFileSync(resolve(root, 'view/assets.js'), 'utf8'))?.[1];
const commit = /\/([0-9a-f]{40})\/$/.exec(base ?? '')?.[1];
if (!commit) throw new Error(`view/assets.js DEFAULT_ASSET_BASE 에서 커밋을 못 찾음: ${base}`);

const git = (...args) => execFileSync('git', ['-C', ASSETS, ...args], { maxBuffer: 1 << 28 });
const head = git('rev-parse', 'HEAD').toString().trim();
if (head !== commit) throw new Error(`vendor/pokerogue/assets 가 고정 커밋이 아님: HEAD ${head} ≠ ${commit} (view/assets.js)`);

const WANTED = [
  /^images\/[^/]+\.png$/,
  /^images\/ui\/.+\.png$/,
  /^images\/(arenas|battle_anims|trainer|effects|items)\/[^/]+\.png$/,
  /^images\/pokemon\/(back\/)?(shiny\/)?[^/]+\.png$/,
  /^audio\/(se|ui|cry|battle_anims)\/[^/]+\.(wav|mp3|m4a|ogg)$/i,
  /^audio\/bgm\/.+\.(wav|mp3|m4a|ogg)$/i,
];

const tree = git('ls-tree', '-r', '-z', commit).toString().split('\0').filter(Boolean).map(line => {
  const [meta, path] = line.split('\t');
  const [, type, id] = meta.split(' ');
  return { type, id, path };
}).filter(entry => entry.type === 'blob' && WANTED.some(rule => rule.test(entry.path))).sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

const groups = new Map();
let total = 0;
for (const { id, path } of tree) {
  const bytes = readFileSync(resolve(ASSETS, path));
  const blob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  if (blob !== id) throw new Error(`vendor/pokerogue/assets/${path} 가 커밋 ${commit.slice(0, 8)} 의 파일과 다름`);
  const slash = path.lastIndexOf('/'), dot = path.lastIndexOf('.');
  const dir = path.slice(0, slash + 1), name = path.slice(slash + 1, dot), ext = path.slice(dot);
  if (name.includes('/')) throw new Error(`이름에 / : ${path}`);
  const key = `${dir}\0${ext}`;
  if (!groups.has(key)) groups.set(key, { dir, ext, names: [], hashes: [] });
  const group = groups.get(key);
  group.names.push(name);
  group.hashes.push(createHash('sha256').update(bytes).digest().subarray(0, HASH_BYTES).toString('base64'));
  total++;
}

const rows = [], seenNames = new Map();
for (const { dir, ext, names, hashes } of groups.values()) {
  const joined = names.join('/');
  const same = seenNames.get(joined);
  if (same === undefined) seenNames.set(joined, rows.length);
  rows.push([dir, ext, same ?? joined, hashes.join('')]);
}
const table = { _source: `tools/build-pinned-assets.mjs from vendor/pokerogue/assets @ ${commit} (git blob ids checked) - SHA-256 first ${HASH_BYTES * 8} bits, base64`, base, bits: HASH_BYTES * 8, groups: rows };
const text = JSON.stringify(table);
writeFileSync(OUT, text + '\n');
console.log(`plugin/battle/pinned-assets.json: ${total} files in ${rows.length} groups, ${text.length} bytes`);
