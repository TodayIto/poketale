import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MACHINE_STANDARDS, MACHINE_KINDS } from '../story/machine-standards.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFileSync(resolve(root, path), 'utf8');
const require = createRequire(import.meta.url);

export const toID = text => String(text ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function speciesWithCosmeticFormes(Dex) {
  const all = Dex.species.all(), have = new Set(all.map(s => s.id));
  return [...all, ...all.flatMap(s => (s.cosmeticFormes ?? []).map(name => Dex.species.get(name)).filter(c => c.exists && !have.has(c.id)))];
}
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

// Machine table of every disc standard (story/machine-standards.mjs): [{ kind, number, move, item }] by kind and number.
// The kind and the printed number come from the item's English name (TM11, HM03, TR04): PokeAPI machine_number
// puts HMs at 101+ in some games and TRs at 100+ in Sword/Shield, so it cannot tell them apart.
export function machineTables() {
  const { Dex } = require(resolve(root, 'vendor/pokemon-showdown/dist/sim'));
  const groups = new Map(csv('version_groups.csv').map(r => [r.id, r.identifier]));
  const moveEnglish = new Map(csv('move_names.csv').filter(r => r.local_language_id === '9').map(r => [r.move_id, r.name]));
  const itemEnglish = new Map(csv('item_names.csv').filter(r => r.local_language_id === '9').map(r => [r.item_id, r.name]));
  const rows = csv('machines.csv');
  const tables = {};
  for (const [std, { vg, versionGroup }] of Object.entries(MACHINE_STANDARDS)) {
    if (groups.get(vg) !== versionGroup) throw new Error(`기술머신 규격 ${std}: PokeAPI version group ${vg} 은 ${groups.get(vg)} (${versionGroup} 이어야 함)`);
    const list = rows.filter(r => r.version_group_id === vg).map(r => {
      const name = itemEnglish.get(r.item_id) ?? '';
      const m = /^(TM|HM|TR)(\d+)$/.exec(name);
      if (!m || !MACHINE_KINDS.includes(m[1].toLowerCase())) throw new Error(`기술머신 규격 ${std}: 이름을 읽을 수 없는 도구 ${r.item_id} (${name})`);
      const move = Dex.moves.get(englishID(moveEnglish.get(r.move_id) ?? ''));
      if (!move.exists) throw new Error(`기술머신 규격 ${std} ${name}: Showdown 에 없는 기술 (PokeAPI move ${r.move_id})`);
      return { kind: m[1].toLowerCase(), number: Number(m[2]), move: move.id, item: r.item_id };
    }).sort((a, b) => MACHINE_KINDS.indexOf(a.kind) - MACHINE_KINDS.indexOf(b.kind) || a.number - b.number);
    const seen = new Set();
    for (const { kind, number } of list) {
      if (seen.has(`${kind}${number}`)) throw new Error(`기술머신 규격 ${std}: ${kind}${number} 가 둘입니다`);
      seen.add(`${kind}${number}`);
    }
    tables[std] = list;
  }
  return tables;
}
