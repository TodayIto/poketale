import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { OUTSIDE_ITEMS } from '../story/items.mjs';
import { FIELD_ITEMS } from '../engine/bag.mjs';
import { csv, englishID, machineTables } from './sources.mjs';
import { MACHINE_STANDARDS } from '../story/machine-standards.mjs';

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

// Gen 1-2 machine sources live in the gen2 mod's learnsets; the base learnsets hold gens 3-9
const OldDex = Dex.mod('gen2');
function learnsetOf(species) {
  const base = Dex.species.getLearnsetData(species.id).learnset, old = OldDex.species.getLearnsetData(species.id).learnset;
  if (!base && !old) return null;
  const merged = {};
  for (const [move, sources] of Object.entries(base ?? {})) merged[move] = sources.filter(s => Number(s[0]) >= 3);
  for (const [move, sources] of Object.entries(old ?? {})) (merged[move] ??= []).push(...sources.filter(s => Number(s[0]) <= 2));
  return merged;
}

const machineMoves = (learnset, gen) => Object.entries(learnset).filter(([, sources]) => sources.some(s => s.startsWith(`${gen}M`))).map(([move]) => move);

// Other generations, nearest to the disc's own first and later first on a tie: a Pokémon that did not exist yet
// when the disc was made (or was left out of that game) is judged by the closest generation it has machine data for
const otherGens = gen => Array.from({ length: 9 }, (_, i) => i + 1).filter(g => g !== gen).sort((a, b) => Math.abs(a - gen) - Math.abs(b - gen) || b - a);

function formeChain(species) {
  const chain = [], seen = new Set();
  for (let s = species; s.exists; s = Dex.species.get(s.changesFrom || s.baseSpecies)) {
    if (seen.has(s.id)) break;
    seen.add(s.id);
    chain.push(s);
  }
  return chain;
}

// The disc's own generation is looked up through the parent formes first (a Totem or cosplay forme uses its base
// species' list), and only then the nearest other generation
function machineMovesOf(species, gen) {
  const learnsets = formeChain(species).map(learnsetOf).filter(Boolean);
  for (const learnset of learnsets) { const moves = machineMoves(learnset, gen); if (moves.length) return { moves, own: true }; }
  for (const learnset of learnsets) for (const g of otherGens(gen)) { const moves = machineMoves(learnset, g); if (moves.length) return { moves, own: false }; }
  return { moves: [], own: false };
}

const allSpecies = [...Dex.species.all()].filter(s => s.isNonstandard !== 'CAP' && s.isNonstandard !== 'Custom').sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
const machines = {};
const report = [];
for (const [std, list] of Object.entries(machineTables())) {
  const { gen } = MACHINE_STANDARDS[std];
  const index = new Map(list.map((slot, i) => [slot.move, i]));
  const learn = {};
  let fallback = 0;
  for (const species of allSpecies) {
    const { moves, own } = machineMovesOf(species, gen);
    const bits = new Uint8Array(Math.ceil(list.length / 8));
    let any = false;
    for (const move of moves) {
      const i = index.get(move);
      if (i === undefined) continue;
      bits[i >> 3] |= 1 << (i & 7);
      any = true;
    }
    if (any) { learn[species.id] = Buffer.from(bits).toString('base64').replace(/=+$/, ''); if (!own) fallback++; }
  }
  let dropped = 0;
  for (const [id, bits] of Object.entries(learn)) {
    const species = Dex.species.get(id);
    const parent = Dex.toID(species.changesFrom || species.baseSpecies);
    if (parent !== id && learn[parent] === bits) { delete learn[id]; dropped++; }
  }
  machines[std] = { slots: list.map(({ kind, number, move }) => [kind, number, move]), learn };
  report.push(`${std} ${list.length}개·호환 ${Object.keys(learn).length}종(다른 세대 표 ${fallback}, 뺀 폼 ${dropped})`);
}

// One shared species list; each standard's learn is an array in that order ('' = use the parent forme's)
const learnSpecies = [...new Set(Object.values(machines).flatMap(m => Object.keys(m.learn)))].sort();
for (const m of Object.values(machines)) m.learn = learnSpecies.map(id => m.learn[id] ?? '');

const out = {
  _source: 'PokeAPI item_flavor_text(한국어)·machines(규격마다 한 게임, story/machine-standards.mjs) @ 2bf639e5, Showdown learnsets (tools/build-items-outside.mjs). '
    + 'machines.<규격>.slots = [종류, 번호, 기술], machines.<규격>.learn[i] = learnSpecies[i] 가 배울 수 있는 slots 순서 비트(base64, 빈 값 = 부모 폼을 따름)',
  text, learnSpecies, machines,
};
const json = JSON.stringify(out) + '\n';
writeFileSync(resolve(root, 'data/items-outside.json'), json);
console.log(`data/items-outside.json: 설명 ${Object.keys(text).length}개(지은 문구 ${Object.keys(COMPOSED).length}), 기술머신 ${report.join(', ')}, `
  + `${Buffer.byteLength(json)} bytes, gzip ${gzipSync(json, { level: 9 }).length} bytes`);
