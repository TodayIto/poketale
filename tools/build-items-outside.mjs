import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { OUTSIDE_ITEMS } from '../story/items.mjs';
import { FIELD_ITEMS } from '../engine/bag.mjs';
import { csv, englishID, gen9Tms } from './sources.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const { Dex } = require(resolve(root, 'vendor/pokemon-showdown/dist/sim'));

const COMPOSED = {
  linkingcord: '통신교환으로 진화하는 포켓몬에게 쓰면 진화하게 하는 신기한 끈.',
  gimmighoulcoin: '모으령이 모으는 금색 코인. 많이 모으면 좋은 일이 생길지도 모른다.',

  teraorb: '포켓몬을 테라스탈시킬 수 있는 신비한 오브. 가지고 있으면 배틀에서 내 포켓몬을 테라스탈시킬 수 있다.',
};
const english = new Map(csv('item_names.csv').filter(r => r.local_language_id === '9').map(r => [englishID(r.name), r.item_id]));
const flavor = new Map();
for (const r of csv('item_flavor_text.ko.csv')) {
  const old = flavor.get(r.item_id);
  if (!old || Number(r.version_group_id) > Number(old.version_group_id)) flavor.set(r.item_id, r);
}

// Line breaks stand for spaces between words (wrapped to the game window width)
const clean = text => text.replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
const text = {};
const items = { ...FIELD_ITEMS, ...OUTSIDE_ITEMS };
for (const [id, item] of Object.entries(items)) {
  const row = flavor.get(english.get(englishID(item.name)));
  const line = row ? clean(row.flavor_text) : COMPOSED[id];
  if (!line) throw new Error(`설명이 없습니다: ${id} (${item.name}) — COMPOSED 에 더하세요`);
  if (row && COMPOSED[id]) throw new Error(`본가 문구가 생겼습니다: ${id} — COMPOSED 에서 빼세요`);
  text[id] = line;
}

const tms = gen9Tms();
const index = new Map(tms.map((tm, i) => [tm.move, i]));
const machineMoves = (learnset, gen) => Object.entries(learnset ?? {})
  .filter(([, sources]) => sources.some(s => (gen ? s.startsWith(`${gen}M`) : /^\dM$/.test(s.slice(0, 2)))))
  .map(([move]) => move);

function machineMovesOf(species, gen, seen = new Set()) {
  if (seen.has(species.id)) throw new Error(`습득표 순환: ${species.id}`);
  seen.add(species.id);
  const learnset = Dex.species.getLearnsetData(species.id).learnset;
  if (learnset) {
    if (gen) { const moves = machineMoves(learnset, gen); if (moves.length) return moves; }
    else for (let g = 8; g >= 1; g--) { const moves = machineMoves(learnset, g); if (moves.length) return moves; }
  }
  const parent = Dex.species.get(species.changesFrom || species.baseSpecies);
  if (parent.exists && parent.id !== species.id) return machineMovesOf(parent, gen, seen);
  return [];
}
const learn = {};
let fallback = 0;
for (const species of [...Dex.species.all()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
  if (species.isNonstandard === 'CAP' || species.isNonstandard === 'Custom') continue;
  let moves = machineMovesOf(species, 9);
  if (!moves.length) {

    // No gen 9 learnset: use the latest generation's TM entries
    moves = machineMovesOf(species, null);
    if (moves.length) fallback++;
  }
  const bits = new Uint8Array(Math.ceil(tms.length / 8));
  let any = false;
  for (const move of moves) {
    const i = index.get(move);
    if (i === undefined) continue;
    bits[i >> 3] |= 1 << (i & 7);
    any = true;
  }
  if (any) learn[species.id] = Buffer.from(bits).toString('base64').replace(/=+$/, '');
}

let dropped = 0;
for (const [id, bits] of Object.entries(learn)) {
  const species = Dex.species.get(id);
  const parent = Dex.toID(species.changesFrom || species.baseSpecies);
  if (parent !== id && learn[parent] === bits) { delete learn[id]; dropped++; }
}

const out = {
  _source: 'PokeAPI item_flavor_text(한국어)·machines(스칼렛·바이올렛) @ 2bf639e5, Showdown learnsets (tools/build-items-outside.mjs)',
  text, tms: tms.map(tm => tm.move), learn,
};
const json = JSON.stringify(out) + '\n';
writeFileSync(resolve(root, 'data/items-outside.json'), json);
console.log(`data/items-outside.json: 설명 ${Object.keys(text).length}개(지은 문구 ${Object.keys(COMPOSED).length}), 기술머신 ${tms.length}개, `
  + `호환 ${Object.keys(learn).length}종(부모 폼과 같아 뺀 폼 ${dropped}, 9세대 표 없어 이전 세대로 ${fallback}종), ${Buffer.byteLength(json)} bytes, gzip ${gzipSync(json, { level: 9 }).length} bytes`);
