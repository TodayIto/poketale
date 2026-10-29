import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { BAG_ITEMS, FIELD_ITEMS } from '../engine/bag.mjs';
import { OUTSIDE_ITEMS, tmId } from '../story/items.mjs';
import { csv, englishID, gen9Tms, toID } from './sources.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const { Dex } = require(resolve(root, 'vendor/pokemon-showdown/dist/sim'));
const SimDex = Dex.mod('champions');
const read = path => readFileSync(resolve(root, path), 'utf8');
const json = path => JSON.parse(read(path));
const kinds = ['species', 'moves', 'abilities', 'items'];
const out = resolve(root, 'data/names');
mkdirSync(out, { recursive: true });

function apiNames(file, idColumn, nameColumn = 'name') {
  const byNumber = new Map();
  for (const r of csv(`${file}.csv`)) {
    if (!['3', '9'].includes(r.local_language_id)) continue;
    if (!byNumber.has(r[idColumn])) byNumber.set(r[idColumn], {});
    byNumber.get(r[idColumn])[r.local_language_id === '3' ? 'ko' : 'en'] = r[nameColumn];
  }
  const byEnglish = new Map();
  for (const entry of byNumber.values()) if (entry.en) byEnglish.set(englishID(entry.en), entry.ko || null);
  return { byNumber, byEnglish };
}

function rogueNames(file) {
  const en = json(`vendor/pokerogue/locales/en/${file}.json`);
  const ko = json(`vendor/pokerogue/locales/ko/${file}.json`);
  const entries = new Map();
  for (const [key, value] of Object.entries(en)) {
    const english = typeof value === 'string' ? value : value.name;
    const korean = typeof ko[key] === 'string' ? ko[key] : ko[key]?.name;
    if (!english || !korean) continue;
    const id = englishID(english);

    // Regional pokemon share the base English name. Never silently overwrite a different translation.
    if (entries.has(id) && entries.get(id) !== korean) throw new Error(`Ambiguous locale: ${file}/${id}`);
    entries.set(id, korean);
  }
  return entries;
}

const rogue = {
  species: rogueNames('pokemon'), moves: rogueNames('move'), abilities: rogueNames('ability'),
};
const api = {
  species: apiNames('pokemon_species_names', 'pokemon_species_id'),
  moves: apiNames('move_names', 'move_id'), abilities: apiNames('ability_names', 'ability_id'),
  items: apiNames('item_names', 'item_id'),
};
const formEn = json('vendor/pokerogue/locales/en/pokemon-form.json');
const formKo = json('vendor/pokerogue/locales/ko/pokemon-form.json');
const battleFormKo = json('vendor/pokerogue/locales/ko/pokemon-form-battle.json');
const typeKo = json('vendor/pokerogue/locales/ko/pokemon-info.json').type;
const formNames = apiNames('pokemon_form_names', 'pokemon_form_id', 'form_name').byNumber;
const pokemon = new Map(csv('pokemon.csv').map(r => [r.id, r]));
const apiForms = new Map(csv('pokemon_forms.csv').map(r => [toID(r.identifier), { ...r, names: formNames.get(r.id) }]));
const rogueForms = new Map(Object.keys(formEn).filter(k => typeof formEn[k] === 'string').map(k => [toID(k), formKo[k]]));

const apiFormAliases = {
  pikachuoriginal: 'pikachu-original-cap', pikachuhoenn: 'pikachu-hoenn-cap',
  pikachusinnoh: 'pikachu-sinnoh-cap', pikachuunova: 'pikachu-unova-cap',
  pikachukalos: 'pikachu-kalos-cap', pikachualola: 'pikachu-alola-cap',
  pikachupartner: 'pikachu-partner-cap', pikachuworld: 'pikachu-world-cap',
  miniormeteor: 'minior-red-meteor',
};
const rogueFormAliases = {
  urshifurapidstrike: 'kubfuRapidStrike', greninjabond: 'battleBondGreninja',
  ogerponwellspring: 'ogerponWellspringMask', ogerponhearthflame: 'ogerponHearthflameMask',
  ogerponcornerstone: 'ogerponCornerstoneMask', ogerpontealtera: 'ogerponTealMaskTera',
  ogerponwellspringtera: 'ogerponWellspringMaskTera',
  ogerponhearthflametera: 'ogerponHearthflameMaskTera', ogerponcornerstonetera: 'ogerponCornerstoneMaskTera',
  taurospaldeacombat: 'paldeaTaurosCombat', taurospaldeablaze: 'paldeaTaurosBlaze',
  taurospaldeaaqua: 'paldeaTaurosAqua', meowsticf: 'espurrFemale',
  indeedeef: 'indeedeeFemale', basculegionf: 'basculinFemale', oinkolognef: 'lechonkFemale',
  mausholdfour: 'tandemausFour', palafinhero: 'finizenHero',
  dudunsparcethreesegment: 'dunsparceThreeSegment', polteageistantique: 'sinisteaAntique',
  squawkabillyblue: 'squawkabillyBluePlumage', squawkabillyyellow: 'squawkabillyYellowPlumage',
  squawkabillywhite: 'squawkabillyWhitePlumage',
};

for (const [key, value] of Object.entries(formEn)) {
  if (key.startsWith('milcery') && typeof value === 'string') {
    rogueFormAliases[`alcremie${toID(value)}`] = key;
  }
}
const abilityAliases = {
  asoneglastrier: 'As One', asonespectrier: 'As One',
  embodyaspectcornerstone: 'Embody Aspect', embodyaspecthearthflame: 'Embody Aspect',
  embodyaspectteal: 'Embody Aspect', embodyaspectwellspring: 'Embody Aspect',
};

function translate(kind, english) {
  const id = englishID(kind === 'abilities' ? abilityAliases[toID(english)] || english : english);
  if (rogue[kind]?.has(id)) return { ko: rogue[kind].get(id), src: 'pokerogue' };
  const ko = api[kind].byEnglish.get(id);
  return { ko: ko || null, src: ko ? 'pokeapi' : null };
}

function translateSpecies(s) {
  const base = translate('species', s.baseSpecies);
  if (!s.forme || !base.ko) return base;
  const direct = rogueForms.get(s.id) || formKo[rogueFormAliases[s.id]];
  if (direct) {

    const label = direct.replace(/^(벽록|우물|화덕|주춧돌)의가면/, '$1의 가면');
    return { ko: `${base.ko} (${label})`, src: 'pokerogue' };
  }
  const battleKey = { Mega: 'mega', 'Mega-X': 'megaX', 'Mega-Y': 'megaY', 'Mega-Z': 'megaZ',
    Primal: 'primal', Gmax: 'gigantamax', Eternamax: 'eternamax' }[s.forme];
  if (battleKey) return { ko: `${base.ko} (${battleFormKo[battleKey].replace('{{pokemonName}}', base.ko)})`, src: 'pokerogue' };
  if (s.baseSpecies === 'Arceus' && typeKo[s.forme.toLowerCase()] && s.forme !== '???') {

    return { ko: `${base.ko} (${typeKo[s.forme.toLowerCase()]})`, src: 'pokerogue' };
  }
  const regional = !apiFormAliases[s.id] && /^(Alola|Galar|Hisui|Paldea)$/.exec(s.forme);
  if (regional) {
    return { ko: `${base.ko} (${formKo.regionalForm[regional[1].toLowerCase()]})`, src: 'pokerogue' };
  }
  const form = apiForms.get(toID(apiFormAliases[s.id] || s.id));

  // Confirm the species too: a similar-looking form key must never cross species boundaries.
  if (form && Number(pokemon.get(form.pokemon_id)?.species_id) === s.num && form.names?.ko) {
    return { ko: `${base.ko} (${form.names.ko})`, src: 'pokeapi' };
  }
  return { ko: null, src: null };
}

const animations = new Map();
for (const file of readdirSync(resolve(root, 'vendor/pokerogue/assets/battle-anims')).sort()) {
  if (!file.endsWith('.json') || file.startsWith('common-')) continue;
  const id = toID(file.slice(0, -5));
  if (animations.has(id)) throw new Error(`Ambiguous animation: ${file}`);
  animations.set(id, file);
}

const missing = {}, noAnims = [], unavailable = {};
const sizes = [];

const dexEntries = Object.fromEntries(kinds.map(kind => [kind,
  [...new Set(Dex[kind].all().map(e => e.id))].sort().map(id => Dex[kind].get(id)),
]));
for (const kind of kinds) {
  const table = {};
  missing[kind] = []; unavailable[kind] = [];
  for (const entry of dexEntries[kind]) {
    const name = kind === 'species' ? translateSpecies(entry) : translate(kind, entry.name);
    const sim = SimDex[kind].get(entry.id).exists;
    table[entry.id] = { ko: name.ko, en: entry.name };
    if (kind === 'species') Object.assign(table[entry.id], { num: entry.num, forme: entry.forme });
    if (kind === 'moves') {
      table[entry.id].type = entry.type;
      table[entry.id].anim = animations.get(toID(entry.name)) || null;
      if (!table[entry.id].anim) noAnims.push(entry);
    }
    Object.assign(table[entry.id], { src: name.src, sim });
    if (!name.ko) missing[kind].push(entry);
    if (!sim) unavailable[kind].push(entry);
  }

  if (kind === 'items') for (const [id, item] of [...Object.entries(BAG_ITEMS), ...Object.entries(FIELD_ITEMS), ...Object.entries(OUTSIDE_ITEMS)]) {
    if (table[id]) continue;
    const name = translate(kind, item.name);
    table[id] = { ko: name.ko, en: item.name, src: name.src, sim: false, bag: true };
    if (!name.ko) missing[kind].push({ id, name: item.name, isNonstandard: null });
  }

  if (kind === 'items') {
    const prefix = /^(\D+)01$/.exec(api.items.byEnglish.get('tm01') ?? '')?.[1];
    if (!prefix) throw new Error('PokeAPI 에 기술머신 한국어 이름(tm01)이 없습니다');
    for (const { number, move } of gen9Tms()) {
      const id = tmId(number), digits = String(number).padStart(3, '0');
      if (table[id]) throw new Error(`기술머신 id 가 Showdown 도구와 겹칩니다: ${id}`);
      table[id] = { ko: `${prefix}${digits}`, en: `TM${digits}`, src: 'pokeapi', sim: false, bag: true, move };
    }
  }
  const bytes = Buffer.from(JSON.stringify(table) + '\n');
  writeFileSync(resolve(out, `${kind}.json`), bytes);
  sizes.push(`| ${kind}.json | ${Object.keys(table).length} | ${bytes.length} | ${gzipSync(bytes, { level: 9 }).length} |`);
}

const lines = [
  '# 이름·기술 애니메이션 누락', '',
  '`node tools/build-names.mjs`로 생성. 실전 대상은 고정 Showdown Dex의 `isNonstandard === null`이다.',
  '한국어 누락은 `ko: null, src: null`이며 조회 시 영어로 표시한다. 폼 이름을 못 찾은 경우도 누락에 포함한다.', '',
  '| 분류 | 전체 | 실전 대상 | 한국어 누락(전체) | 한국어 누락(실전) | 플러그인 엔진에 없음 |',
  '|---|---:|---:|---:|---:|---:|',
];
for (const kind of kinds) {
  const all = dexEntries[kind];
  lines.push(`| ${kind} | ${all.length} | ${all.filter(e => e.isNonstandard === null).length} | ${missing[kind].length} | ${missing[kind].filter(e => e.isNonstandard === null).length} | ${unavailable[kind].length} |`);
}
for (const kind of kinds) {
  lines.push('', `## ${kind}: 한국어 누락 ${missing[kind].length}개`, '');
  for (const entry of missing[kind]) lines.push(`- \`${entry.id}\` — ${entry.name} (${entry.isNonstandard ?? '실전'})`);
  if (!missing[kind].length) lines.push('없음.');
}
lines.push('', `## 애니메이션 없는 기술 ${noAnims.length}개 (실전 ${noAnims.filter(e => e.isNonstandard === null).length}개)`, '',
  '아래 기술의 `anim: null`은 공통 대체 연출로 처리한다.', '');
for (const entry of noAnims) lines.push(`- \`${entry.id}\` — ${entry.name} (${entry.isNonstandard ?? '실전'})`);
lines.push('', '## 플러그인 엔진에 없는 ID', '', '`sim: false`는 Showdown 원본 champions 모드에서 같은 ID를 찾지 못했다는 뜻이다. 효과·세대별 사용 가능성까지 비교하지 않는다.', '');
for (const kind of kinds) {
  lines.push(`### ${kind}: ${unavailable[kind].length}개`, '');
  for (const entry of unavailable[kind]) lines.push(`- \`${entry.id}\` — ${entry.name}`);
  if (!unavailable[kind].length) lines.push('없음.');
  lines.push('');
}
lines.push('## JSON 크기', '', '| 파일 | 항목 수 | UTF-8 바이트 | gzip(level 9) 바이트 |', '|---|---:|---:|---:|', ...sizes, '');
writeFileSync(resolve(out, 'MISSING.md'), lines.join('\n'));
console.log('이름표 생성 완료');
console.log(sizes.join('\n'));
for (const kind of kinds) console.log(`${kind}: 한국어 누락 ${missing[kind].length}, 실전 ${missing[kind].filter(e => e.isNonstandard === null).length}`);
console.log(`애니메이션 누락 ${noAnims.length}`);
