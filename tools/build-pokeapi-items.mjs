import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { csv, toID } from './sources.mjs';
import { POKEAPI_ROOT } from '../view/sprites/sources.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const json = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
export const POKEAPI_ITEM_MAP = 'data/pokeapi-item-map.json';
const FILES = 'data/sources/pokeapi-item-files.json';
const BASE = `${POKEAPI_ROOT}items/`;

export function itemsWithoutFrame() {
  const frames = new Set(json('data/bag-icons.json').items.textures[0].frames.map(f => f.filename));
  return Object.keys(json('data/names/items.json')).filter(id => !/^t[mr]\d/.test(id) && !frames.has(id)).sort();
}

export function candidates(ids) {
  const english = new Map();
  const identifier = new Map(csv('items.csv').map(row => [row.id, row.identifier]));
  for (const row of csv('item_names.csv')) {
    if (row.local_language_id !== '9' || !identifier.has(row.item_id)) continue;
    const key = toID(row.name);
    (english.get(key) ?? english.set(key, []).get(key)).push(identifier.get(row.item_id));
  }
  const byId = new Map([...identifier.values()].map(name => [toID(name), name]));
  const names = json('data/names/items.json');
  return new Map(ids.map(id => {
    const found = [...new Set([byId.get(id), ...(english.get(id) ?? []), ...(english.get(toID(names[id]?.en)) ?? [])].filter(Boolean))];

    return [id, [...new Set(found.flatMap(name => (name.endsWith('--held') ? [`${name.slice(0, -6)}--bag`, name] : [name, `${name}--bag`])))]];
  }));
}

async function check(stems) {
  const found = [], missing = [];
  const queue = [...stems];
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (queue.length) {
      const stem = queue.shift();
      const response = await fetch(`${BASE}${stem}.png`, { method: 'HEAD' });
      if (response.status === 200) found.push(stem);
      else if (response.status === 404) missing.push(stem);
      else throw new Error(`${stem}.png: HTTP ${response.status}`);
    }
  }));
  return { found: found.sort(), missing: missing.sort() };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const ids = itemsWithoutFrame();
  const tries = candidates(ids);
  const stems = [...new Set([...tries.values()].flat())].sort();
  if (process.argv.includes('--fetch')) {
    const { found, missing } = await check(stems);
    writeFileSync(resolve(root, FILES), `${JSON.stringify({ source: BASE, note: `${POKEAPI_ITEM_MAP} 의 후보 파일이 이 고정 커밋에 있는지 (tools/build-pokeapi-items.mjs --fetch, HEAD)`, found, missing }, null, 1)}\n`);
  }
  const files = json(FILES);
  const found = new Set(files.found), known = new Set([...files.found, ...files.missing]);
  const unknown = stems.filter(stem => !known.has(stem));
  if (unknown.length) throw new Error(`${FILES} 에 없는 후보 (--fetch 로 다시 확인): ${unknown.join(' ')}`);
  const map = {}, none = [];
  for (const id of ids) {
    const stem = tries.get(id).find(s => found.has(s));
    if (stem) map[id] = stem;
    else none.push(id);
  }
  writeFileSync(resolve(root, POKEAPI_ITEM_MAP), `${JSON.stringify(map)}\n`);
  console.log(`${POKEAPI_ITEM_MAP}: PokeRogue 그림이 없는 도구 ${ids.length}개 중 ${Object.keys(map).length}개`);
  console.log(`PokeAPI 그림도 없음 (점): ${none.length}${none.length ? ` - ${none.join(' ')}` : ''}`);
}
