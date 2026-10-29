import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFileSync(resolve(root, path), 'utf8');
const require = createRequire(import.meta.url);

export const toID = text => String(text ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

export const englishID = text => toID(String(text).normalize('NFD').replace(/\p{M}/gu, '').replace(/♀/g, '-F').replace(/♂/g, '-M'));

let pokeapiSource;

export function csv(file) {
  pokeapiSource ??= JSON.parse(read('data/sources/pokeapi/source.json'));
  const raw = read(`data/sources/pokeapi/${file}`);
  if (createHash('sha256').update(raw.replace(/\r\n/g, '\n')).digest('hex') !== pokeapiSource.sha256[file]) throw new Error(`PokeAPI 원본 체크섬 불일치: ${file}`);
  const text = raw.replace(/^﻿/, '');
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (c === ',' || c === '\n')) {
      row.push(field.replace(/\r$/, '')); field = '';
      if (c === '\n') { rows.push(row); row = []; }
    } else field += c;
  }
  if (quoted) throw new Error(`Unclosed CSV quote: ${file}`);
  if (field || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  const headers = rows.shift();
  return rows.filter(r => r.some(Boolean)).map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
}

export function speciesIds() {
  const ids = new Map();
  let n = -1;
  for (const m of read('vendor/pokerogue/src/enums/species-id.ts').matchAll(/^\s*([A-Z][A-Z0-9_]*)(?:\s*=\s*(\d+))?,/gm)) {
    n = m[2] ? Number(m[2]) : n + 1;
    ids.set(m[1], n);
  }
  if (ids.get('PIKACHU') !== 25 || ids.get('ALOLA_NINETALES') !== 2038) throw new Error('PokeRogue species-id.ts 형식이 바뀜');
  return ids;
}

export const TM_VERSION_GROUP = '25';
export function gen9Tms() {

  const { Dex } = require(resolve(root, 'vendor/pokemon-showdown/dist/sim'));
  const english = new Map(csv('move_names.csv').filter(r => r.local_language_id === '9').map(r => [r.move_id, r.name]));
  const list = csv('machines.csv').filter(r => r.version_group_id === TM_VERSION_GROUP).map(r => {
    const move = Dex.moves.get(englishID(english.get(r.move_id) ?? ''));
    if (!move.exists) throw new Error(`기술머신 ${r.machine_number}: Showdown 에 없는 기술 (PokeAPI move ${r.move_id})`);
    return { number: Number(r.machine_number), move: move.id };
  }).sort((a, b) => a.number - b.number);
  list.forEach((tm, i) => { if (tm.number !== i + 1) throw new Error(`기술머신 번호가 비었습니다: ${i + 1}`); });
  return list;
}
