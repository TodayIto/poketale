import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { OUTSIDE_ITEMS } from '../story/items.mjs';
import { FIELD_ITEMS, BAG_ITEMS, onNoPokemon } from '../engine/bag.mjs';
import { learnGens, learnKey } from '../story/machine-standards.mjs';
import { csv, englishID, machineTables } from './sources.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const { Dex } = require(resolve(root, 'vendor/pokemon-showdown/dist/sim'));

const COMPOSED = {
  linkingcord: '통신교환으로 진화하는 포켓몬에게 쓰면 진화하게 하는 신기한 끈.',
  gimmighoulcoin: '모으령이 모으는 금색 코인. 많이 모으면 좋은 일이 생길지도 모른다.',

  teraorb: '포켓몬을 테라스탈시킬 수 있는 신비한 오브. 가지고 있으면 배틀에서 내 포켓몬을 테라스탈시킬 수 있다.',

  healthmochi: '포켓몬에게 사용하는 떡. 포켓몬 1마리의 HP 기초 포인트를 올린다.',
  musclemochi: '포켓몬에게 사용하는 떡. 포켓몬 1마리의 공격 기초 포인트를 올린다.',
  resistmochi: '포켓몬에게 사용하는 떡. 포켓몬 1마리의 방어 기초 포인트를 올린다.',
  geniusmochi: '포켓몬에게 사용하는 떡. 포켓몬 1마리의 특수공격 기초 포인트를 올린다.',
  clevermochi: '포켓몬에게 사용하는 떡. 포켓몬 1마리의 특수방어 기초 포인트를 올린다.',
  swiftmochi: '포켓몬에게 사용하는 떡. 포켓몬 1마리의 스피드 기초 포인트를 올린다.',
  freshstartmochi: '포켓몬에게 사용하는 떡. 포켓몬 1마리의 기초 포인트를 모두 0으로 되돌린다.',

  ...Object.fromEntries(Object.entries({ normal: '노말', fire: '불꽃', water: '물', electric: '전기', grass: '풀', ice: '얼음', fighting: '격투', poison: '독',
    ground: '땅', flying: '비행', psychic: '에스퍼', bug: '벌레', rock: '바위', ghost: '고스트', dragon: '드래곤', dark: '악', steel: '강철', fairy: '페어리',
    stellar: '스텔라' }).map(([type, ko]) => [`${type}terashard`, `테라스탈 에너지가 굳은 결정 조각. 50개를 모으면 포켓몬의 테라 타입을 ${ko} 타입으로 바꿀 수 있다.`])),
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

const officialBag = Object.fromEntries(Object.entries(BAG_ITEMS).filter(([, item]) => onNoPokemon(item) || item.reusable));
const items = { ...FIELD_ITEMS, ...OUTSIDE_ITEMS, ...officialBag };

const ROW_OF = { meteorite: '537',

  dnasplicers: '671', nsolarizer: '989', nlunarizer: '990', reinsofunity: '1641' };
for (const [id, item] of Object.entries(items)) {
  const row = flavor.get(ROW_OF[id] ?? english.get(englishID(item.name)));
  const line = row ? clean(row.flavor_text) : COMPOSED[id];
  if (!line) throw new Error(`설명이 없습니다: ${id} (${item.name}) — COMPOSED 에 더하세요`);
  if (row && COMPOSED[id]) throw new Error(`본가 문구가 생겼습니다: ${id} — COMPOSED 에서 빼세요`);
  text[id] = line;
}

const flavorEn = new Map();
for (const r of csv('item_flavor_text.en.csv')) {
  const old = flavorEn.get(r.item_id);
  if (!old || Number(r.version_group_id) > Number(old.version_group_id)) flavorEn.set(r.item_id, r);
}
const textEn = {};
const noEnglish = [];
for (const [id, item] of Object.entries(items)) {
  const row = flavorEn.get(ROW_OF[id] ?? english.get(englishID(item.name)));
  if (row) { textEn[id] = clean(row.flavor_text); continue; }
  if (Object.hasOwn(officialBag, id)) throw new Error(`영어 설명이 없습니다: ${id} (${item.name})`);
  noEnglish.push(id);
}

const HELD_ROWS = { expshare: '193' };

const COMPOSED_HELD = { ko: { expshare: '지니게 하면 배틀에 나가지 않아도 배틀에서 얻은 경험치를 나눠 받는다.' } };
const textHeld = { ko: {}, en: {} };
for (const r of csv('item_flavor_text.gen2-5.csv')) {
  const id = Object.keys(HELD_ROWS).find(key => HELD_ROWS[key] === r.item_id);
  const lang = { 3: 'ko', 9: 'en' }[r.language_id];
  if (!id || !lang) throw new Error(`2~5세대 설명 표에 모르는 줄: ${r.item_id} ${r.language_id}`);
  const old = textHeld[lang][id];
  if (!old || Number(r.version_group_id) > old.vg) textHeld[lang][id] = { vg: Number(r.version_group_id), text: clean(r.flavor_text) };
}
for (const lang of Object.keys(textHeld)) textHeld[lang] = Object.fromEntries(Object.entries(textHeld[lang]).map(([id, { text }]) => [id, text]));
for (const [lang, table] of Object.entries(COMPOSED_HELD)) for (const [id, text] of Object.entries(table)) {
  if (textHeld[lang][id]) throw new Error(`2~5세대 원작 설명이 있는데 지은 글이 있습니다: ${lang} ${id}`);
  textHeld[lang][id] = text;
}
if (!textHeld.en.expshare || !textHeld.ko.expshare) throw new Error('학습장치의 2~5세대 설명이 없습니다');

const OldDex = Dex.mod('gen2');
function learnsetOf(species) {
  const base = Dex.species.getLearnsetData(species.id).learnset, old = OldDex.species.getLearnsetData(species.id)?.learnset;
  if (!base && !old) return null;
  const merged = {};
  for (const [move, sources] of Object.entries(base ?? {})) merged[move] = sources.filter(s => Number(s[0]) >= 3);
  for (const [move, sources] of Object.entries(old ?? {})) (merged[move] ??= []).push(...sources.filter(s => Number(s[0]) <= 2));
  return merged;
}
/** Generation of a machine source ('8M' -> 8), else null */
const machineGen = source => { const m = /^(\d)M/.exec(source); return m ? Number(m[1]) : null; };
/** Moves a learnset has from a machine of one of these generations */
const machineMoves = (learnset, gens) => Object.entries(learnset).filter(([, sources]) => sources.some(s => gens.includes(machineGen(s)))).map(([move]) => move);

const otherGens = gens => Array.from({ length: 9 }, (_, i) => i + 1).filter(g => !gens.includes(g)).sort((a, b) => Math.abs(a - gens[0]) - Math.abs(b - gens[0]) || b - a);

function formeChain(species) {
  const chain = [], seen = new Set();
  for (let s = species; s.exists && !seen.has(s.id); s = Dex.species.get(s.changesFrom || s.baseSpecies)) seen.add(s.id), chain.push(s);
  return chain;
}

const sameBattler = (s, parent) => !!parent && s.types.join('/') === parent.types.join('/') && STAT_IDS.every(stat => s.baseStats[stat] === parent.baseStats[stat]);
const STAT_IDS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

function machineMovesOf(species, gens) {
  const chain = formeChain(species);
  const hasData = learnset => !!learnset && Object.values(learnset).some(sources => sources.some(src => machineGen(src) !== null));
  const nearest = (learnset, from) => {
    for (const g of otherGens(gens)) { const other = machineMoves(learnset, [g]); if (other.length) return { moves: other, own: false, from }; }
    return null;
  };
  let first = null;
  for (const [from, s] of chain.entries()) {
    const learnset = learnsetOf(s);
    if (!hasData(learnset)) continue;
    first ??= { learnset, from };
    const moves = machineMoves(learnset, gens);
    if (moves.length) return { moves, own: true, from };
    if (!sameBattler(s, chain[from + 1])) return nearest(learnset, from);
  }
  return first && nearest(first.learnset, first.from);
}

const allSpecies = [...Dex.species.all()].filter(s => s.isNonstandard !== 'CAP' && s.isNonstandard !== 'Custom').sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
const tables = machineTables();

const groups = new Map();
for (const [std, list] of Object.entries(tables)) for (const { kind, move } of list) {
  const key = learnKey(kind, std);
  if (!groups.has(key)) groups.set(key, { gens: learnGens(kind, std), moves: [], stds: new Set() });
  const group = groups.get(key);
  group.stds.add(std);
  if (!group.moves.includes(move)) group.moves.push(move);
}
const learn = {}, report = [];
for (const [key, { gens, moves, stds }] of groups) {
  const bits = new Map();
  let other = 0;
  for (const species of allSpecies) {
    const got = machineMovesOf(species, gens);
    if (!got || got.from > 0) continue;
    if (!got.own) other++;
    const learned = new Set(got.moves), row = new Uint8Array(Math.ceil(moves.length / 8));
    moves.forEach((move, i) => { if (learned.has(move)) row[i >> 3] |= 1 << (i & 7); });

    bits.set(species.id, Buffer.from(row).toString('base64').replace(/=+$/, ''));
  }
  let dropped = 0;
  for (const [id, code] of bits) {
    const species = Dex.species.get(id);
    const parent = Dex.toID(species.changesFrom || species.baseSpecies);
    if (parent !== id && bits.get(parent) === code) { bits.delete(id); dropped++; }
  }
  learn[key] = { moves, bits };
  report.push(`${key}세대(${[...stds].join('·')}) 기술 ${moves.length}개·호환 ${bits.size}종(다른 세대 표 ${other}, 뺀 폼 ${dropped})`);
}

const learnSpecies = [...new Set(Object.values(learn).flatMap(m => [...m.bits.keys()]))].sort();
const out = {
  _source: 'PokeAPI item_flavor_text(한국어·영어)·machines(규격마다 한 게임 - story/machine-standards.mjs) @ 2bf639e5, Showdown learnsets (tools/build-items-outside.mjs). '
    + 'machines.<규격>.slots = [종류, 번호, 기술], learn.<세대>.rows[i] = learnSpecies[i] 가 배울 수 있는 learn.<세대>.moves 순서 비트(base64, 빈 값 = 바뀌기 전 폼을 따름)',
  text, textEn, textHeld, learnSpecies,
  machines: Object.fromEntries(Object.entries(tables).map(([std, list]) => [std, { slots: list.map(({ kind, number, move }) => [kind, number, move]) }])),
  learn: Object.fromEntries(Object.entries(learn).map(([key, m]) => [key, { moves: m.moves, rows: learnSpecies.map(id => m.bits.get(id) ?? '') }])),
};
const json = JSON.stringify(out) + '\n';
writeFileSync(resolve(root, 'data/items-outside.json'), json);
console.log(`data/items-outside.json: 설명 ${Object.keys(text).length}개(지은 문구 ${Object.keys(COMPOSED).length}), 영어 공식 설명 ${Object.keys(textEn).length}개(없음 ${noEnglish.length}: ${noEnglish.join(' ')}), 2~5세대 설명 영어 ${Object.keys(textHeld.en).length}·한국어 ${Object.keys(textHeld.ko).length}, 디스크 ${report.join(', ')}, `
  + `${Buffer.byteLength(json)} bytes, gzip ${gzipSync(json, { level: 9 }).length} bytes`);
