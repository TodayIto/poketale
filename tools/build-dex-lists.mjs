import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
export const OUT = 'data/dex-lists.json';
const SRC = 'data/sources/pokeapi-dex';
const REPO = 'https://raw.githubusercontent.com/PokeAPI/pokeapi';

export const COMMIT = '8a92bfa7dab2f12b84b5d151562f9857c133ff30';
const FILES = ['pokedexes.csv', 'pokemon_dex_numbers.csv'];
const NATIONAL_LAST = 1025;

export const DEXES = [
  ['kanto', 'kanto'], ['johto', 'updated-johto'], ['hoenn', 'updated-hoenn'], ['sinnoh', 'extended-sinnoh'], ['unova', 'updated-unova'],
  ['kalos', ['central', 'kalos-central'], [['coastal', 'kalos-coastal'], ['mountain', 'kalos-mountain']]], ['alola', 'updated-alola'], ['galar', 'galar', [['armor', 'isle-of-armor'], ['crown', 'crown-tundra']]],
  ['hisui', 'hisui'], ['paldea', 'paldea', [['kitakami', 'kitakami'], ['blueberry', 'blueberry']]],
  ['lumiose', 'lumiose-city'],
];

const SEEN_ONLY = [['unovaBW', 'original-unova']];

const sha = text => createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');

function rows(text) {
  const [head, ...lines] = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').split('\n').filter(Boolean);
  const keys = head.split(',');
  return lines.map(line => { const cells = line.split(','); return Object.fromEntries(keys.map((k, i) => [k, cells[i] ?? ''])); });
}

export function buildLists(pokedexesCsv, numbersCsv) {
  const ids = new Map(rows(pokedexesCsv).map(r => [r.identifier, r.id]));
  const byDex = new Map();
  for (const r of rows(numbersCsv)) {
    if (!byDex.has(r.pokedex_id)) byDex.set(r.pokedex_id, []);
    byDex.get(r.pokedex_id).push([Number(r.pokedex_number), Number(r.species_id)]);
  }
  const national = byDex.get(ids.get('national')) ?? [];
  if (national.length !== NATIONAL_LAST || national.some(([n, s]) => n !== s)) throw new Error(`전국 도감이 1..${NATIONAL_LAST} 가 아니다`);

  const one = identifier => {
    const list = (byDex.get(ids.get(identifier)) ?? []).sort((a, b) => a[0] - b[0]);
    if (!list.length) throw new Error(`PokeAPI 에 없는 도감: ${identifier}`);
    const first = list[0][0];
    list.forEach(([n, s], i) => {
      if (n !== first + i) throw new Error(`${identifier}: ${first + i} 번이 비거나 겹친다`);
      if (!(s >= 1 && s <= NATIONAL_LAST)) throw new Error(`${identifier}: 전국 번호 밖 ${s}`);
    });
    if (new Set(list.map(([, s]) => s)).size !== list.length) throw new Error(`${identifier}: 같은 포켓몬이 두 번`);
    return list;
  };

  const entry = (key, identifier, section = null) => {
    const list = one(identifier);
    return { key, pokeapi: identifier, ...(section ? { section } : {}), first: list[0][0], list: list.map(([, s]) => s) };
  };
  const dexes = DEXES.map(([key, source, sections]) => {
    const [section, identifier] = Array.isArray(source) ? source : [null, source];
    const dex = entry(key, identifier, section);
    if (sections) dex.sections = sections.map(([key, identifier]) => entry(key, identifier));
    return dex;
  });
  const seenOnly = SEEN_ONLY.map(([key, identifier]) => entry(key, identifier));
  return {
    source: `PokeAPI ${REPO.replace('raw.githubusercontent.com', 'github.com')}/tree/${COMMIT}/data/v2/csv (pokedexes.csv, pokemon_dex_numbers.csv)`,
    note: '지방 도감마다 [그 도감 번호 순서의 전국 번호]. 지방마다 하나 (11개). sections = 그 도감 안에 이어지는 칸 (칼로스: 코스트·마운틴, 가라르: 갑옷섬·왕관설원, 팔데아: 북신·블루베리 - 번호는 그 도감 것). section = 그 도감 자기 목록의 머리 줄 이름 (칼로스: 센트럴). first = 첫 줄의 지방 번호 (하나 도감 0, 그 밖 1). 전국 도감은 1..national. seenOnly = 도감으로 보이지 않고 본 것 규칙에만 쓰는 목록 (unovaBW: 블랙·화이트 하나 도감 - 블랙·화이트 시대에 이전에 정복한 하나). tools/build-dex-lists.mjs 로 만든다 (손으로 고치지 않는다). 읽기: story/dex.mjs',
    national: NATIONAL_LAST,
    dexes,
    seenOnly,
  };
}

export const serialize = table => `{"source":${JSON.stringify(table.source)},"note":${JSON.stringify(table.note)},"national":${table.national},"dexes":[\n`
  + table.dexes.map(d => JSON.stringify(d)).join(',\n') + '\n],"seenOnly":[\n' + table.seenOnly.map(d => JSON.stringify(d)).join(',\n') + '\n]}\n';

async function fetchSources() {
  mkdirSync(resolve(root, SRC), { recursive: true });
  const sums = {};
  for (const file of FILES) {
    const response = await fetch(`${REPO}/${COMMIT}/data/v2/csv/${file}`);
    if (!response.ok) throw new Error(`${file}: ${response.status}`);
    const text = (await response.text()).replace(/\r\n/g, '\n');
    writeFileSync(resolve(root, SRC, file), text);
    sums[file] = sha(text);
  }
  const source = { repository: 'https://github.com/PokeAPI/pokeapi', commit: COMMIT, files: FILES, sha256: sums, normalization: 'UTF-8, CRLF normalized to LF before hashing',
    license: 'PokeAPI data - see data/sources/pokeapi/LICENSE.md' };
  writeFileSync(resolve(root, SRC, 'source.json'), `${JSON.stringify(source, null, 2)}\n`);
}

function readSources() {
  const source = JSON.parse(readFileSync(resolve(root, SRC, 'source.json'), 'utf8'));
  return FILES.map(file => {
    const text = readFileSync(resolve(root, SRC, file), 'utf8');
    if (sha(text) !== source.sha256[file]) throw new Error(`PokeAPI 원본 체크섬 불일치: ${file}`);
    return text;
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  if (process.argv.includes('--fetch')) await fetchSources();
  const table = buildLists(...readSources());
  writeFileSync(resolve(root, OUT), serialize(table));
  const sizes = table.dexes.map(d => `${d.key} ${[d, ...d.sections ?? []].map(p => p.list.length).join("+")}`).join(', ');
  console.log(`${OUT}: ${table.dexes.length} dexes (${sizes})`);
}
