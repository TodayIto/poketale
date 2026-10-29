import { entry, names, toID } from '../names/index.js';

export const KINDS = ['species', 'moves', 'items', 'abilities'];
const tableEn = (kind, value) => entry(kind, value)?.en ?? null;
const tableKo = (kind, value) => (entry(kind, value)?.ko ? names[kind](value) : null);

export function createNamer({ korean = true, en = null, ko = tableKo } = {}) {
  const seenKeys = new Set();
  const seen = (kind, key) => {
    const k = `${kind}:${toID(key) || key}`;
    if (seenKeys.has(k)) return true;
    seenKeys.add(k);
    return false;
  };
  const name = kind => value => {
    const english = (en && en(kind, value)) || tableEn(kind, value) || String(value ?? '');
    if (seen(kind, value)) return english;
    if (!korean) return english;
    const local = ko(kind, value);
    return local && /[가-힣]/.test(local) && local !== english ? `${english}(${local})` : english;
  };
  return { species: name('species'), moves: name('moves'), items: name('items'), abilities: name('abilities'), seen };
}
