import speciesTable from '../data/names/species.json' with { type: 'json' };
import movesTable from '../data/names/moves.json' with { type: 'json' };
import abilitiesTable from '../data/names/abilities.json' with { type: 'json' };
import itemsTable from '../data/names/items.json' with { type: 'json' };

// Static imports only: usable inside the plugin's connect-src 'none' iframe.
const tables = { species: speciesTable, moves: movesTable, abilities: abilitiesTable, items: itemsTable };

export const WARNING_LIMIT = 200;
const warnings = new Map();

export const toID = value => String(value ?? '').normalize('NFD').replace(/\p{M}/gu, '')
  .replace(/♀/g, '-F').replace(/♂/g, '-M').toLowerCase().replace(/[^a-z0-9]/g, '');

function input(value) {
  return typeof value === 'object' && value !== null
    ? { id: toID(value.id ?? value.name), fallback: String(value.name ?? value.id ?? '') }
    : { id: toID(value), fallback: String(value ?? '') };
}

export function entry(kind, value) {
  if (!Object.hasOwn(tables, kind)) throw new TypeError(`Unknown name table: ${kind}`);
  const id = input(value).id;
  const record = Object.hasOwn(tables[kind], id) ? tables[kind][id] : null;
  return record ? Object.freeze(record) : null;
}

function lookup(kind, value) {
  const { id, fallback } = input(value);
  const record = entry(kind, value);
  if (record?.ko) return record.ko;
  const en = record?.en ?? fallback;
  const key = `${kind}:${id}`;
  if (!warnings.has(key) && warnings.size < WARNING_LIMIT) warnings.set(key, Object.freeze({ kind, id, en, reason: record ? 'missing-ko' : 'unknown-id' }));
  return en;
}

export function getWarnings() { return [...warnings.values()]; }
export function clearWarnings() { warnings.clear(); }

export const names = Object.freeze({
  species: value => lookup('species', value),
  moves: value => lookup('moves', value),
  abilities: value => lookup('abilities', value),
  items: value => lookup('items', value),
  entry, getWarnings, clearWarnings,
});

export default names;
