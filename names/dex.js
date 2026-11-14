import table from '../data/dex-entries.json' with { type: 'json' };
import { names, baseKo } from './index.js';

export const DEX_LAST = table.species.length;

let byId = null;

function decode(num, row, first) {
  const [category, height, weight, text, version, id, form = '', name] = row;
  return Object.freeze({
    num, id, form,

    name: name ?? baseKo(names.species(first[5])),
    category, height, weight, text, version: table.versions[version],
  });
}

export function dexEntries(num) {
  const list = Number.isInteger(num) ? table.species[num - 1] : undefined;
  return list ? list.map(row => decode(num, row, list[0])) : [];
}

export function dexEntry(id) {
  if (!byId) {
    byId = new Map();
    table.species.forEach((list, i) => list.forEach(row => { if (row[5]) byId.set(row[5], [i + 1, row, list[0]]); }));
  }
  const hit = byId.get(String(id ?? ''));
  return hit ? decode(...hit) : null;
}
