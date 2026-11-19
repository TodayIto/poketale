import data from '../data/items-outside.json' with { type: 'json' };
import { tmNumber, trNumber } from './items.mjs';

export const itemText = (id, lang = 'ko') => {
  const table = lang === 'ko' ? data.text : lang === 'en' ? data.textEn : null;
  return table && Object.hasOwn(table, id) ? table[id] : null;
};

function machineOf(id) {
  const tm = tmNumber(id);
  if (tm) return { moves: data.tms, learn: data.learn, i: tm - 1 };
  const tr = trNumber(id);
  return tr === null ? null : { moves: data.trs, learn: data.trLearn, i: tr };
}

export function tmMove(id) {
  const machine = machineOf(id);
  return machine?.moves[machine.i] ?? null;
}

const bitsCache = new WeakMap();
function bitsOf(learn, key) {
  let table = bitsCache.get(learn);
  if (!table) bitsCache.set(learn, table = new Map());
  let bits = table.get(key);
  if (!bits) {
    const raw = atob(learn[key].padEnd(Math.ceil(learn[key].length / 4) * 4, '='));
    bits = Uint8Array.from(raw, c => c.charCodeAt(0));
    table.set(key, bits);
  }
  return bits;
}

const MAX_FORME_HOPS = 4;

export function canLearnTm(sim, species, id) {
  const machine = machineOf(id);
  if (!machine || machine.i >= machine.moves.length) return false;
  const { learn, i } = machine;
  let s = sim.Dex.species.get(species);
  for (let hop = 0; s?.exists && hop < MAX_FORME_HOPS; hop++) {
    if (Object.hasOwn(learn, s.id)) {
      const bits = bitsOf(learn, s.id);
      return !!((bits[i >> 3] >> (i & 7)) & 1);
    }
    const parent = sim.Dex.species.get(s.changesFrom || s.baseSpecies);
    if (!parent.exists || parent.id === s.id) break;
    s = parent;
  }
  return false;
}

export function learnableTms(sim, species) {
  return data.tms.map((move, i) => ({ n: i + 1, item: `tm${String(i + 1).padStart(3, '0')}`, move }))
    .filter(tm => tm.move && canLearnTm(sim, species, tm.item));
}
