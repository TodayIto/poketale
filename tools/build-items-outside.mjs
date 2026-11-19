import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { OUTSIDE_ITEMS } from '../story/items.mjs';
import { FIELD_ITEMS, BAG_ITEMS, onNoPokemon } from '../engine/bag.mjs';
import { csv, englishID, gen9Tms, swshTrs } from './sources.mjs';

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

const tms = gen9Tms(), trs = swshTrs();

const machineMoves = (learnset, from, to = from) => Object.entries(learnset ?? {})
  .filter(([, sources]) => sources.some(s => { const gen = Number(/^(\d+)M/.exec(s)?.[1]); return gen >= from && gen <= to; }))
  .map(([move]) => move);

const latestMachineMoves = learnset => { for (let g = 8; g >= 1; g--) { const moves = machineMoves(learnset, g); if (moves.length) return moves; } return []; };

function machineMovesOf(species, pick, seen = new Set()) {
  if (seen.has(species.id)) throw new Error(`습득표 순환: ${species.id}`);
  seen.add(species.id);
  const learnset = Dex.species.getLearnsetData(species.id).learnset;
  if (learnset) { const moves = pick(learnset); if (moves.length) return moves; }
  const parent = Dex.species.get(species.changesFrom || species.baseSpecies);
  if (parent.exists && parent.id !== species.id) return machineMovesOf(parent, pick, seen);
  return [];
}

function compatibility(machines, rule) {
  const index = new Map(machines.map((move, i) => [move, i]));
  const learn = {};
  let fallback = 0, dropped = 0;
  for (const species of [...Dex.species.all()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    if (species.isNonstandard === 'CAP' || species.isNonstandard === 'Custom') continue;
    let moves = machineMovesOf(species, rule);
    if (!moves.length) {
      moves = machineMovesOf(species, latestMachineMoves);
      if (moves.length) fallback++;
    }
    const bits = new Uint8Array(Math.ceil(machines.length / 8));
    let any = false;
    for (const move of moves) {
      const i = index.get(move);
      if (i === undefined) continue;
      bits[i >> 3] |= 1 << (i & 7);
      any = true;
    }
    if (any) learn[species.id] = Buffer.from(bits).toString('base64').replace(/=+$/, '');
  }
  for (const [id, bits] of Object.entries(learn)) {
    const species = Dex.species.get(id);
    const parent = Dex.toID(species.changesFrom || species.baseSpecies);
    if (parent !== id && learn[parent] === bits) { delete learn[id]; dropped++; }
  }
  return { learn, fallback, dropped };
}

const tmCompat = compatibility(tms.map(tm => tm.move), learnset => machineMoves(learnset, 9));
const trCompat = compatibility(trs.map(tr => tr.move), learnset => machineMoves(learnset, 8, Infinity));

const out = {
  _source: 'PokeAPI item_flavor_text(한국어·영어)·machines(스칼렛·바이올렛 기술머신, 소드실드 기술레코드) @ 2bf639e5, Showdown learnsets (tools/build-items-outside.mjs)',
  text, textEn, tms: tms.map(tm => tm.move), learn: tmCompat.learn, trs: trs.map(tr => tr.move), trLearn: trCompat.learn,
};
const json = JSON.stringify(out) + '\n';
writeFileSync(resolve(root, 'data/items-outside.json'), json);
console.log(`data/items-outside.json: 설명 ${Object.keys(text).length}개(지은 문구 ${Object.keys(COMPOSED).length}), 영어 공식 설명 ${Object.keys(textEn).length}개(없음 ${noEnglish.length}: ${noEnglish.join(' ')}), 기술머신 ${tms.length}개, `
  + `호환 ${Object.keys(tmCompat.learn).length}종(부모 폼과 같아 뺀 폼 ${tmCompat.dropped}, 9세대 표 없어 이전 세대로 ${tmCompat.fallback}종), `
  + `기술레코드 ${trs.length}개, 호환 ${Object.keys(trCompat.learn).length}종(뺀 폼 ${trCompat.dropped}, 8·9세대 표 없어 이전 세대로 ${trCompat.fallback}종), ${Buffer.byteLength(json)} bytes, gzip ${gzipSync(json, { level: 9 }).length} bytes`);
