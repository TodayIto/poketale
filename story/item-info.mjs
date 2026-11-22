import data from '../data/items-outside.json' with { type: 'json' };
import { DEFAULT_STANDARD, machineId, parseMachineId, learnKey } from './machine-standards.mjs';

export const itemText = (id, lang = 'ko') => {
  const table = lang === 'ko' ? data.text : lang === 'en' ? data.textEn : null;
  return table && Object.hasOwn(table, id) ? table[id] : null;
};

export const heldItemText = (id, lang = 'ko') => {
  const table = data.textHeld?.[lang];
  return table && Object.hasOwn(table, id) ? table[id] : null;
};

const slotsOf = std => data.machines[std]?.slots ?? [];
const slotIndex = new Map();
/** kind + number -> place in slotsOf(std) */
function indexOf(std) {
  let index = slotIndex.get(std);
  if (!index) slotIndex.set(std, index = new Map(slotsOf(std).map(([kind, number], i) => [`${kind}${number}`, i])));
  return index;
}

function slotOf(id) {
  const m = parseMachineId(id);
  const i = m && indexOf(m.std).get(`${m.kind}${m.number}`);
  return i === undefined || i === null ? null : { std: m.std, i };
}

export function tmMove(id) {
  const slot = slotOf(id);
  return slot ? slotsOf(slot.std)[slot.i][2] : null;
}

const speciesIndex = new Map(data.learnSpecies.map((id, i) => [id, i]));

const moveBits = new Map();
function moveBit(key, move) {
  if (!moveBits.has(key)) moveBits.set(key, new Map((data.learn[key]?.moves ?? []).map((m, i) => [m, i])));
  return moveBits.get(key).get(move);
}
const bitsCache = new Map();
function bitsOf(key, at) {
  const cached = `${key}:${at}`;
  let bits = bitsCache.get(cached);
  if (!bits) {
    const code = data.learn[key].rows[at];
    const raw = atob(code.padEnd(Math.ceil(code.length / 4) * 4, '='));
    bits = Uint8Array.from(raw, c => c.charCodeAt(0));
    bitsCache.set(cached, bits);
  }
  return bits;
}

const MAX_FORME_HOPS = 4;

export function canLearnTm(sim, species, id) {
  const slot = slotOf(id);
  if (!slot) return false;
  const [kind, , move] = slotsOf(slot.std)[slot.i], key = learnKey(kind, slot.std), bit = moveBit(key, move);
  if (bit === undefined) return false;
  const rows = data.learn[key].rows;
  let s = sim.Dex.species.get(species);
  for (let hop = 0; s?.exists && hop < MAX_FORME_HOPS; hop++) {
    const at = speciesIndex.get(s.id);
    if (at !== undefined && rows[at]) {
      const bits = bitsOf(key, at);
      return !!((bits[bit >> 3] >> (bit & 7)) & 1);
    }
    const parent = sim.Dex.species.get(s.changesFrom || s.baseSpecies);
    if (!parent.exists || parent.id === s.id) break;
    s = parent;
  }
  return false;
}

export function learnableTms(sim, species, std = DEFAULT_STANDARD) {
  return slotsOf(std).filter(([kind]) => kind === 'tm').map(([kind, number, move]) => ({ n: number, item: machineId(kind, number, std), move }))
    .filter(tm => canLearnTm(sim, species, tm.item));
}

export function machineByMove(std, move, kind = null, { exact = false } = {}) {
  const slots = slotsOf(std);
  const hit = (kind && slots.find(([k, , m]) => k === kind && m === move)) || (!exact && slots.find(([, , m]) => m === move));
  return hit ? machineId(hit[0], hit[1], std) : null;
}
/** A standard's disc by kind and number, null for none */
export const machineByNumber = (std, kind, number) => (indexOf(std).has(`${kind}${number}`) ? machineId(kind, number, std) : null);

export const hasMachineKind = (std, kind) => slotsOf(std).some(([k]) => k === kind);

export const machinesOf = std => slotsOf(std).map(([kind, number, move]) => ({ id: machineId(kind, number, std), kind, number, move }));
