import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { csv, toID, englishID } from './sources.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
export const OUT = 'data/fishing.json';
const SRC = 'data/sources/fishing';
/** The same PokeAPI commit as data/sources/pokeapi (data/sources/README.md) */
const COMMIT = '2bf639e5572812a67d2b94903fdcb9d095f5aeb2';
const POKEAPI = `https://raw.githubusercontent.com/PokeAPI/pokeapi/${COMMIT}/data/v2/csv`;

const PKHEX_COMMIT = '6c9583883c7551ac74a4b74180cead249d4277b8';
const PKHEX = `https://raw.githubusercontent.com/kwsch/PKHeX/${PKHEX_COMMIT}/PKHeX.Core/Resources/text/locations`;
const PKHEX_FILES = ['gen2/text_gsc', 'gen3/text_rsefrlg', 'gen4/text_hgss', 'gen5/text_bw2', 'gen6/text_xy', 'gen7/text_sm', 'gen8/text_swsh', 'gen9/text_sv']
  .flatMap(f => ['en', 'ko'].map(lang => `${f}_00000_${lang}.txt`));
/** PokeAPI files stored whole */
const WHOLE = ['encounter_slots.csv', 'location_areas.csv', 'locations.csv', 'versions.csv', 'regions.csv', 'encounter_condition_values.csv'];

const METHOD_ROD = { 2: 0, 3: 1, 4: 2, 12: 3, 31: 3, 34: 3 };

const ONE_ROD_GROUPS = new Set(['11', '14', '17', '18', '20', '21', '22']);

const NO_BUBBLES = new Set(['17', '18']);

const KEPT_CONDITIONS = new Set(['2', '6', '9', '25']);
/** Our region ids (data/status-words.json regions) of PokeAPI's regions */
const REGION_IDS = { 1: 'kanto', 2: 'johto', 3: 'hoenn', 4: 'sinnoh', 5: 'unova', 6: 'kalos', 7: 'alola', 8: 'galar', 9: 'hisui', 10: 'paldea' };

const NO_FISHING = {
  hisui: { dexes: [['hisui', null]], extra: ['basculinwhitestriped', 'qwilfishhisui', 'overqwil'] },
  paldea: { dexes: [['paldea', null], ['paldea', 'blueberry']], extra: ['finizen', 'wiglett', 'veluza', 'tatsugiri'] },
  kitakami: { dexes: [['paldea', 'kitakami']], extra: [] },
};
/** An EXTRA species' row: any rod, levels and share as a middle row */
const EXTRA_ROW = { min: 20, max: 40, share: 10 };

const CURVE = { startTo: 2, topFrom: 10, topTo: 30, show: [-5, 0, 5, 10, 20, 30] };

const NOT_PLAIN = new Set(['palafin']);
const GRADE = { level: [5, 50], rod: [0, 0.5, 1, 0.5], spot: { level: 0.7, rod: 0.3 }, bst: [200, 600] };

const sha = text => createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');
/** Plain CSV (none of these files has quotes) -> row objects */
export function rows(text) {
  const [head, ...lines] = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').split('\n').filter(Boolean);
  const keys = head.split(',');
  return lines.map(line => { const cells = line.split(','); return Object.fromEntries(keys.map((k, i) => [k, (cells[i] ?? '').trim()])); });
}
const unrows = list => (list.length ? `${Object.keys(list[0]).join(',')}\n${list.map(r => Object.values(r).join(',')).join('\n')}\n` : '');

async function get(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return (await response.text()).replace(/\r\n/g, '\n');
}

async function fetchSources() {
  mkdirSync(resolve(root, SRC), { recursive: true });
  const files = {}, derived = {};
  for (const file of WHOLE) files[file] = await get(`${POKEAPI}/${file}`);
  const methodOf = new Map(rows(files['encounter_slots.csv']).map(r => [r.id, r.encounter_method_id]));
  const encounters = await get(`${POKEAPI}/encounters.csv`);
  const fishing = rows(encounters).filter(r => Object.hasOwn(METHOD_ROD, methodOf.get(r.encounter_slot_id)));
  files['encounters.fishing.csv'] = unrows(fishing);
  derived['encounters.fishing.csv'] = { from: 'encounters.csv', sha256_of_source: sha(encounters),
    rule: 'encounter_slot 의 방법이 낚시(old-rod 2, good-rod 3, super-rod 4, super-rod-spots 12, feebas-tile-fishing 31, bubbling-spots 34)인 줄만. 줄 내용은 그대로 (원본 3.2MB 를 저장소에 넣지 않으려고)' };
  const ids = new Set(fishing.map(r => r.id));
  const conditions = await get(`${POKEAPI}/encounter_condition_value_map.csv`);
  files['encounter_condition_value_map.fishing.csv'] = unrows(rows(conditions).filter(r => ids.has(r.encounter_id)));
  derived['encounter_condition_value_map.fishing.csv'] = { from: 'encounter_condition_value_map.csv', sha256_of_source: sha(conditions),
    rule: 'encounters.fishing.csv 에 있는 encounter_id 의 줄만. 줄 내용은 그대로' };
  const names = await get(`${POKEAPI}/location_names.csv`);
  files['location_names.en.csv'] = unrows(rows(names).filter(r => r.local_language_id === '9'));
  derived['location_names.en.csv'] = { from: 'location_names.csv', sha256_of_source: sha(names), rule: 'local_language_id=9 (영어) 줄만. 줄 내용은 그대로' };
  for (const file of PKHEX_FILES) files[`pkhex/${file.split('/').pop()}`] = await get(`${PKHEX}/${file}`);
  mkdirSync(resolve(root, SRC, 'pkhex'), { recursive: true });
  for (const [file, text] of Object.entries(files)) writeFileSync(resolve(root, SRC, file), text);
  const source = {
    pokeapi: { repository: 'https://github.com/PokeAPI/pokeapi', commit: COMMIT, path: 'data/v2/csv', license: 'BSD-3-Clause - data/sources/pokeapi/LICENSE.md' },
    pkhex: { repository: 'https://github.com/kwsch/PKHeX', commit: PKHEX_COMMIT, path: 'PKHeX.Core/Resources/text/locations',
      note: '게임 장소 이름 글(영어·한국어, 같은 줄 번호)만 받는다 - 이름표로만 쓰고 코드는 가져오지 않는다 (data/badges.json 과 같은 출처)' },
    files: Object.keys(files),
    sha256: Object.fromEntries(Object.entries(files).map(([file, text]) => [file, sha(text)])),
    derived,
    normalization: 'UTF-8, CRLF normalized to LF before hashing',
  };
  writeFileSync(resolve(root, SRC, 'source.json'), `${JSON.stringify(source, null, 2)}\n`);
}

/** The stored sources, each checked against source.json */
export function readSources() {
  const source = JSON.parse(readFileSync(resolve(root, SRC, 'source.json'), 'utf8'));
  return Object.fromEntries(source.files.map(file => {
    const text = readFileSync(resolve(root, SRC, file), 'utf8');
    if (sha(text) !== source.sha256[file]) throw new Error(`낚시 원본 체크섬 불일치: ${file}`);
    return [file, text];
  }));
}

export function koreanNames(files) {
  const out = new Map();
  for (const file of Object.keys(files).filter(f => f.startsWith('pkhex/') && f.endsWith('_en.txt'))) {
    const en = files[file].replace(/^﻿/, '').split('\n'), ko = files[file.replace('_en.txt', '_ko.txt')].replace(/^﻿/, '').split('\n');
    en.forEach((name, i) => {
      const k = (ko[i] ?? '').trim();
      if (!name.trim() || !k || k.startsWith('(')) return;
      const id = englishID(name);
      if (!out.has(id)) out.set(id, new Set());
      out.get(id).add(k);
    });
  }
  return out;
}

export function buildFishing(files, Dex, dexLists) {
  const slots = new Map(rows(files['encounter_slots.csv']).map(r => [r.id, r]));
  const areas = new Map(rows(files['location_areas.csv']).map(r => [r.id, r]));
  const locations = new Map(rows(files['locations.csv']).map(r => [r.id, r]));
  const groupOf = new Map(rows(files['versions.csv']).map(r => [r.id, r.version_group_id]));
  const defaults = new Map(rows(files['encounter_condition_values.csv']).map(r => [r.id, r]));
  const english = new Map(rows(files['location_names.en.csv']).map(r => [r.location_id, r.name]));
  const conditionsOf = new Map();
  for (const r of rows(files['encounter_condition_value_map.fishing.csv'])) {
    if (!conditionsOf.has(r.encounter_id)) conditionsOf.set(r.encounter_id, []);
    conditionsOf.get(r.encounter_id).push(defaults.get(r.encounter_condition_value_id));
  }

  const pokemon = new Map(csv('pokemon.csv').map(r => [r.id, r]));
  const speciesName = new Map(csv('pokemon_species.csv').map(r => [r.id, r]));
  const showdown = id => {
    const row = pokemon.get(id);
    const parts = row.identifier.split('-');
    for (let n = parts.length; n > 0; n--) { const s = Dex.species.get(toID(parts.slice(0, n).join('-'))); if (s.exists) return s.id; }
    const s = Dex.species.get(toID(speciesName.get(row.species_id)?.identifier ?? ''));
    if (!s.exists) throw new Error(`PokeAPI pokemon ${id} (${row.identifier}): Showdown 에 없는 종`);
    return s.id;
  };

  const tables = new Map();
  for (const r of rows(files['encounters.fishing.csv'])) {
    const slot = slots.get(r.encounter_slot_id), group = groupOf.get(r.version_id);
    const method = slot.encounter_method_id;
    if (method === '34' && NO_BUBBLES.has(group)) continue;
    if ((conditionsOf.get(r.id) ?? []).some(v => v.is_default !== '1' && !KEPT_CONDITIONS.has(v.encounter_condition_id))) continue;
    const area = areas.get(r.location_area_id), location = locations.get(area.location_id);
    const region = REGION_IDS[location?.region_id];
    if (!region) continue;
    const rod = ONE_ROD_GROUPS.has(group) ? 3 : METHOD_ROD[method];
    const key = `${r.version_id}|${area.id}|${method}`;
    if (!tables.has(key)) tables.set(key, { place: location.id, region, rod, total: 0, species: new Map() });
    const table = tables.get(key), rarity = Number(slot.rarity), species = showdown(r.pokemon_id);
    table.total += rarity;
    const one = table.species.get(species) ?? { rarity: 0, min: Infinity, max: -Infinity };
    one.rarity += rarity; one.min = Math.min(one.min, Number(r.min_level)); one.max = Math.max(one.max, Number(r.max_level));
    table.species.set(species, one);
  }

  const rowsOf = list => {
    const byRod = new Map();
    for (const t of list) {
      if (!byRod.has(t.rod)) byRod.set(t.rod, { n: 0, species: new Map() });
      const r = byRod.get(t.rod); r.n++;
      for (const [species, one] of t.species) {
        const s = r.species.get(species) ?? { share: 0, min: Infinity, max: -Infinity };
        s.share += (100 * one.rarity) / t.total; s.min = Math.min(s.min, one.min); s.max = Math.max(s.max, one.max);
        r.species.set(species, s);
      }
    }
    return [...byRod].sort(([a], [b]) => a - b).flatMap(([rod, r]) => [...r.species].map(([species, s]) => [species, rod, s.min, s.max, Math.round((10 * s.share) / r.n) / 10]))
      .filter(row => row[4] > 0).sort((a, b) => a[1] - b[1] || b[4] - a[4] || a[0].localeCompare(b[0]));
  };

  const ko = koreanNames(files);
  const byPlace = new Map();
  for (const t of tables.values()) {
    if (!byPlace.has(t.place)) byPlace.set(t.place, []);
    byPlace.get(t.place).push(t);
  }
  const regions = {}, unnamed = [];
  for (const [place, list] of [...byPlace].sort(([a], [b]) => Number(a) - Number(b))) {
    const location = locations.get(place), region = list[0].region;
    const en = english.get(place) ?? location.identifier;
    const plain = en.replace(/^Sea Route/, 'Route').replace(/^Johto Safari Zone$/, 'Safari Zone');
    const names = [...(ko.get(englishID(plain)) ?? [])];
    const route = /^Route (\d+)$/.exec(plain)?.[1];
    if (!names.length && !route) { unnamed.push(location.identifier); continue; }
    regions[region] ??= { places: [], fallback: [] };
    regions[region].places.push({ id: location.identifier, ko: names, en: [...new Set([en, plain])], ...(route ? { route: Number(route) } : {}), rows: rowsOf(list) });
  }
  for (const [region, r] of Object.entries(regions)) r.fallback = rowsOf([...tables.values()].filter(t => t.region === region));
  const everywhere = rowsOf([...tables.values()]);
  const fished = new Map();
  for (const row of everywhere) { if (!fished.has(row[0])) fished.set(row[0], []); fished.get(row[0]).push(row); }

  for (const [region, { dexes, extra }] of Object.entries(NO_FISHING)) {
    const nums = new Set(dexes.flatMap(([key, section]) => {
      const dex = dexLists.dexes.find(d => d.key === key);
      const list = section ? dex?.sections?.find(s => s.key === section)?.list : dex?.list;
      if (!list) throw new Error(`${key}${section ? `/${section}` : ''}: data/dex-lists.json 에 없는 도감`);
      return list;
    }));
    const own = [...fished].filter(([species]) => nums.has(Dex.species.get(species).num)).flatMap(([, list]) => list);
    for (const id of extra) {
      const s = Dex.species.get(id);
      if (!s.exists || s.id !== id) throw new Error(`${id}: Showdown 종 id 가 아님`);
      if (fished.has(id)) throw new Error(`${id}: 이미 낚인 적이 있는 종 - EXTRA 에 넣지 않음`);
    }
    regions[region] = { places: [], fallback: [...own, ...extra.map(id => [id, 3, EXTRA_ROW.min, EXTRA_ROW.max, EXTRA_ROW.share])] };
    if (!regions[region].fallback.length) throw new Error(`${region}: 낚을 포켓몬이 없다`);
  }

  const pooled = new Set([...everywhere, ...Object.values(regions).flatMap(r => [...r.fallback, ...r.places.flatMap(p => p.rows)])].map(row => row[0]));
  const evolves = {};
  const levelEvos = id => (Dex.species.get(id).evos ?? []).map(name => Dex.species.get(name))
    .filter(t => t.exists && t.isNonstandard !== 'CAP' && !NOT_PLAIN.has(t.id) && !t.evoType && Number.isInteger(t.evoLevel) && !t.evoCondition && !t.evoItem && !t.evoMove)
    .map(t => [t.id, t.evoLevel]);
  const all = new Set(pooled);
  for (const id of [...pooled]) {
    for (let todo = [id]; todo.length;) {
      const from = todo.pop(), evos = levelEvos(from);
      if (!evos.length || evolves[from]) continue;
      evolves[from] = evos;
      for (const [to] of evos) { all.add(to); todo.push(to); }
    }
  }

  const dexNums = (key, section) => {
    const dex = dexLists.dexes.find(d => d.key === key);
    const list = section ? dex?.sections?.find(s => s.key === section)?.list : [dex?.list, ...(dex?.sections ?? []).map(s => s.list)].flat();
    if (!list?.length) throw new Error(`${key}${section ? `/${section}` : ''}: data/dex-lists.json 에 없는 도감`);
    return list;
  };
  const dexOf = region => new Set(NO_FISHING[region] ? NO_FISHING[region].dexes.flatMap(([key, section]) => dexNums(key, section)) : dexNums(region));
  // species index and grades
  const species = [...all].sort();
  const index = new Map(species.map((s, i) => [s, i]));
  const clamp = x => Math.min(1, Math.max(0, x));
  const rowsBySpecies = new Map();
  for (const row of [...everywhere, ...Object.values(regions).flatMap(r => r.fallback)]) {
    if (!rowsBySpecies.has(row[0])) rowsBySpecies.set(row[0], []);
    rowsBySpecies.get(row[0]).push(row);
  }
  const spotOf = id => {
    const rows = rowsBySpecies.get(id);
    if (!rows?.length) { const prevo = Dex.species.get(id).prevo; return prevo ? spotOf(Dex.species.get(prevo).id) : 0.5; }
    const total = rows.reduce((sum, r) => sum + r[4], 0);
    const mean = f => rows.reduce((sum, r) => sum + f(r) * r[4], 0) / total;
    const [lo, hi] = GRADE.level;
    return GRADE.spot.level * mean(r => clamp((r[2] - lo) / (hi - lo))) + GRADE.spot.rod * mean(r => GRADE.rod[r[1]]);
  };

  const byFamily = new Map();
  for (const place of Object.values(regions).flatMap(r => r.places)) {
    for (const [pre, list] of Object.entries(evolves)) for (const [evo, at] of list) {
      const rows = s => place.rows.filter(r => r[0] === s);
      if (!rows(pre).length || !rows(evo).length) continue;
      const rate = (s, L) => rows(s).filter(r => r[2] <= L && L <= r[3]).reduce((sum, r) => sum + r[4] / (r[3] - r[2] + 1), 0);
      const lo = Math.min(...[...rows(pre), ...rows(evo)].map(r => r[2])), hi = Math.max(...[...rows(pre), ...rows(evo)].map(r => r[3]));
      const family = byFamily.get(`${pre}>${evo}`) ?? new Map();
      byFamily.set(`${pre}>${evo}`, family);
      for (let L = lo; L <= hi; L++) {
        const a = rate(pre, L), b = rate(evo, L);
        if (a + b <= 0) continue;
        const m = family.get(L - at) ?? { evolved: 0, all: 0 };
        m.evolved += b; m.all += a + b; family.set(L - at, m);
      }
    }
  }

  const meanOf = (from, to) => {
    const shares = [...byFamily.values()].map(family => {
      let evolved = 0, all = 0;
      for (let k = from; k <= to; k++) { const m = family.get(k); if (m) { evolved += m.evolved; all += m.all; } }
      return all > 0 ? evolved / all : null;
    }).filter(x => x !== null);
    return Math.round((100 * shares.reduce((a, b) => a + b, 0)) / shares.length);
  };
  const curve = { start: meanOf(0, CURVE.startTo), top: meanOf(CURVE.topFrom, CURVE.topTo), topFrom: CURVE.topFrom, families: byFamily.size,
    measured: CURVE.show.map(k => [k, meanOf(k, k)]) };
  const grades = species.map(id => {
    const s = Dex.species.get(id);
    const bst = Object.values(s.baseStats).reduce((a, b) => a + b, 0);
    const stage = !s.evos?.length ? 1 : s.prevo ? 0.5 : 0;
    return Math.round((100 * (spotOf(id) + clamp((bst - GRADE.bst[0]) / (GRADE.bst[1] - GRADE.bst[0])) + stage)) / 3);
  });
  const packed = list => list.map(([s, ...rest]) => [index.get(s), ...rest]);
  const order = ['kanto', 'johto', 'hoenn', 'sinnoh', 'unova', 'kalos', 'alola', 'galar', 'hisui', 'paldea', 'kitakami'];
  return {
    source: `PokeAPI ${COMMIT.slice(0, 12)} data/v2/csv encounters (낚시 줄) + PKHeX ${PKHEX_COMMIT.slice(0, 12)} 장소 이름 글 (tools/build-fishing.mjs)`,
    note: '낚시 표. row = [species 번호, 낚싯대(0 낡은·1 좋은·2 대단한·3 아무거나), 최저 레벨, 최고 레벨, 그 판 낚시 표에서 차지한 몫 %]. places = 낚시 만남이 있는 장소(ko·en 이름, route 도로 번호), fallback = 장소를 모를 때 그 지방 전체, everywhere = 지방도 모를 때. grades = 우리 등급 0-100 (원작 낚시 자리의 레벨·낚싯대, 종족값, 진화 단계). evolves = species 번호 → [[진화한 종 번호, 레벨]] (레벨만으로 하는 진화). tools/build-fishing.mjs 로 만든다 (손으로 고치지 않는다). 읽기: story/fishing.mjs',
    species,
    grades,
    evolveCurve: curve,
    evolves: Object.fromEntries(Object.entries(evolves).sort(([a], [b]) => a.localeCompare(b)).map(([from, list]) => [index.get(from), list.map(([to, level]) => [index.get(to), level])])),
    regions: Object.fromEntries(order.filter(r => regions[r]).map(r => [r, {
      places: regions[r].places.map(p => ({ ...p, rows: packed(p.rows) })),
      fallback: packed(regions[r].fallback),

      evolveInto: species.filter(id => Object.values(evolves).some(list => list.some(([to]) => to === id)))
        .filter(id => dexOf(r).has(Dex.species.get(id).num)).map(id => index.get(id)),
    }])),
    everywhere: packed(everywhere),
    unnamed,
  };
}

/** One line per place (a short diff when the sources change) */
export const serialize = table => `{"source":${JSON.stringify(table.source)},"note":${JSON.stringify(table.note)},\n"species":${JSON.stringify(table.species)},\n"grades":${JSON.stringify(table.grades)},\n"evolveCurve":${JSON.stringify(table.evolveCurve)},\n"evolves":${JSON.stringify(table.evolves)},\n"regions":{\n`
  + Object.entries(table.regions).map(([r, { places, fallback, evolveInto }]) => `${JSON.stringify(r)}:{"places":[\n${places.map(p => JSON.stringify(p)).join(',\n')}\n],\n"fallback":${JSON.stringify(fallback)},\n"evolveInto":${JSON.stringify(evolveInto)}}`).join(',\n')
  + `\n},\n"everywhere":${JSON.stringify(table.everywhere)},\n"unnamed":${JSON.stringify(table.unnamed)}}\n`;

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  if (process.argv.includes('--fetch')) await fetchSources();
  const { Dex } = require(resolve(root, 'vendor/pokemon-showdown/dist/sim/index.js'));
  const dexLists = JSON.parse(readFileSync(resolve(root, 'data/dex-lists.json'), 'utf8'));
  const table = buildFishing(readSources(), Dex, dexLists);
  const text = serialize(table);
  writeFileSync(resolve(root, OUT), text);
  const counts = Object.entries(table.regions).map(([r, { places, fallback }]) => `${r} ${places.length}곳/${new Set(fallback.map(row => row[0])).size}종`).join(', ');
  console.log(`${OUT}: ${(text.length / 1024).toFixed(1)}KB, 종 ${table.species.length} — ${counts}${table.unnamed.length ? ` (이름 없어 뺀 곳: ${table.unnamed.join(', ')})` : ''}`);
}
