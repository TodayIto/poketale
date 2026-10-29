import data from '../data/items-outside.json' with { type: 'json' };
import { tmNumber } from './items.mjs';

export const itemText = id => (Object.hasOwn(data.text, id) ? data.text[id] : null);

// Move id taught by a TM (tm024 -> 'firespin'), null if not a TM
export function tmMove(id) {
  const n = tmNumber(id);
  return n ? data.tms[n - 1] ?? null : null;
}

const bitsCache = new Map();
function bitsOf(key) {
  let bits = bitsCache.get(key);
  if (!bits) {
    const raw = atob(data.learn[key].padEnd(Math.ceil(data.learn[key].length / 4) * 4, '='));
    bits = Uint8Array.from(raw, c => c.charCodeAt(0));
    bitsCache.set(key, bits);
  }
  return bits;
}

const MAX_FORME_HOPS = 4;
export function canLearnTm(sim, species, id) {
  const n = tmNumber(id);
  if (!n || n > data.tms.length) return false;
  let s = sim.Dex.species.get(species);
  for (let hop = 0; s?.exists && hop < MAX_FORME_HOPS; hop++) {
    if (Object.hasOwn(data.learn, s.id)) {
      const bits = bitsOf(s.id);
      return !!((bits[(n - 1) >> 3] >> ((n - 1) & 7)) & 1);
    }
    const parent = sim.Dex.species.get(s.changesFrom || s.baseSpecies);
    if (!parent.exists || parent.id === s.id) break;
    s = parent;
  }
  return false;
}
