// from pokerogue src/audio/audio-manager.ts, src/battle.ts @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-10-28. See view/LICENSE-NOTE.md.

import { createRequire } from 'node:module';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { speciesIds } from './sources.mjs';

const require = createRequire(import.meta.url);
const { Dex } = require('../vendor/pokemon-showdown/dist/sim/index.js');
const root = new URL('../', import.meta.url);
const PR = new URL('vendor/pokerogue/src/', root);
const read = path => readFileSync(new URL(path, PR), 'utf8');

const manager = read('audio/audio-manager.ts');
const method = manager.slice(manager.indexOf('private getBgmLoopPoint('));
const loopPoints = {};

for (const [, key, seconds] of method.matchAll(/case "([^"]+)":[^\n]*\n\s*return ([\d.]+);/g)) loopPoints[key] = Number(seconds);
assert.equal((method.match(/\bcase "/g) ?? []).length, Object.keys(loopPoints).length, 'getBgmLoopPoint 에 이어지는 case 가 생김');
assert.equal(loopPoints.battle_wild, 12.703);
assert.equal(loopPoints.battle_trainer, 13.686);
const biomes = JSON.parse(readFileSync(new URL('vendor/pokerogue/assets/biome-bgm-loop-points.json', root), 'utf8'));
const files = readdirSync(new URL('vendor/pokerogue/assets/audio/bgm/', root), { recursive: true })
  .filter(f => f.endsWith('.mp3')).map(f => f.replaceAll('\\', '/').slice(0, -4)).sort();

const numbers = Object.fromEntries(speciesIds());
const enumByNum = Object.fromEntries(Object.entries(numbers).filter(([, n]) => n < 2000).map(([k, n]) => [n, k]));

const special = {};
for (const file of readdirSync(new URL('data/balance/species/', PR)).sort()) {
  for (const block of read(`data/balance/species/${file}`).split('new PokemonSpecies({').slice(1)) {
    const body = block.slice(0, block.indexOf('})'));
    const id = /\bid: SpeciesId\.(\w+),/.exec(body)?.[1];
    assert.ok(id && numbers[id] !== undefined, `${file}: 종 정의를 못 읽음`);
    const flag = name => new RegExp(`\\b${name}: true`).test(body);
    const category = /\bcategory: "([^"]*)"/.exec(body)?.[1] ?? '';
    if (flag('legendary') || flag('subLegendary') || flag('mythical') || category.startsWith('Paradox')) special[id] = { legendary: flag('legendary') };
  }
}

const battle = read('battle.ts').split('\n');
const start = battle.findIndex(l => l.includes('if (settings.musicPreferenceAllGens) {'));
const stop = battle.findIndex((l, i) => i > start && /^ {12}default:/.test(l));
assert.ok(start > 0 && stop > start, 'battle.ts getBgmOverride 모양이 바뀜');
const bySpecies = {}, nested = new Set();
let pending = [], body = false;
for (const line of battle.slice(start, stop)) {
  const kase = /^ {12}case SpeciesId\.(\w+):/.exec(line), ret = /^ {14}return "(\w+)";/.exec(line), deep = /^ {16,}return "(\w+)";/.exec(line);
  if (kase) { if (body) { pending = []; body = false; } pending.push(kase[1]); }
  else if (ret) { for (const id of pending) bySpecies[id] = ret[1]; pending = []; body = false; }
  else if (deep) nested.add(deep[1]);
  else if (/^ {14}\S/.test(line)) body = true;
}

const FORMS = {
  groudonprimal: 'battle_legendary_gro_kyo', kyogreprimal: 'battle_legendary_gro_kyo',
  dialgaorigin: 'battle_legendary_origin_forme', palkiaorigin: 'battle_legendary_origin_forme',
  necrozma: 'battle_legendary_sol_lun', necrozmaduskmane: 'battle_legendary_dusk_dawn', necrozmadawnwings: 'battle_legendary_dusk_dawn',
  necrozmaultra: 'battle_legendary_ultra_nec',
  eternatuseternamax: 'battle_legendary_eternatus_p2',
  calyrexice: 'battle_legendary_riders', calyrexshadow: 'battle_legendary_riders',
};
assert.deepEqual([...nested].sort(), [...new Set(Object.values(FORMS))].sort(), 'battle.ts 폼 조건 곡이 바뀜 — FORMS 를 다시 맞출 것');

const fallback = id => (special[id].legendary ? 'battle_legendary_res_zek' : 'battle_legendary_unova');
const REGIONS = { Alola: 'ALOLA', Galar: 'GALAR', Hisui: 'HISUI', Paldea: 'PALDEA' };
const legendary = {};
for (const species of [...Dex.species.all()].sort((a, b) => (a.id < b.id ? -1 : 1))) {
  if (species.num <= 0 || species.isNonstandard === 'CAP' || species.isNonstandard === 'Custom') continue;

  const region = Object.keys(REGIONS).find(r => species.forme.startsWith(r));
  const base = enumByNum[species.num];
  const id = region && numbers[`${REGIONS[region]}_${base}`] !== undefined ? `${REGIONS[region]}_${base}` : base;
  if (!id || !special[id]) continue;
  legendary[species.id] = FORMS[species.id] ?? bySpecies[id] ?? fallback(id);
}

assert.equal(legendary.rayquaza, 'battle_legendary_rayquaza');
assert.equal(legendary.groudon, 'battle_legendary_rayquaza');
assert.equal(legendary.mewtwo, 'battle_legendary_kanto');
assert.equal(legendary.articunogalar, 'battle_legendary_birds_galar');
assert.equal(legendary.necrozma, 'battle_legendary_sol_lun');
assert.equal(legendary.greattusk, 'battle_legendary_kor_mir');
assert.equal(legendary.gyarados, undefined);
for (const name of new Set(Object.values(legendary))) assert.ok(files.includes(name), `없는 곡: ${name}`);
for (const key of ['battle_wild', 'battle_trainer', 'bw/victory_trainer', 'bw/evolution', 'bw/evolution_fanfare']) assert.ok(files.includes(key), key);

const data = { source: 'pokerogue 7d7da4a8 / assets 37789817 — tools/build-bgm.mjs', files, loopPoints: { ...biomes, ...loopPoints }, legendary };
writeFileSync(new URL('data/bgm.json', root), JSON.stringify(data) + '\n');
console.log(`data/bgm.json: 곡 ${files.length}, 반복 시작점 ${Object.keys(data.loopPoints).length}, 전설 곡 종 ${Object.keys(legendary).length}`);
