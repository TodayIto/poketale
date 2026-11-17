import data from '../data/items-outside.json' with { type: 'json' };
import { DEFAULT_STANDARD, MACHINE_STANDARDS, STANDARD_IDS, machineId, parseMachineId, regionGames } from './machine-standards.mjs';

export const itemText = id => (Object.hasOwn(data.text, id) ? data.text[id] : null);

const slotsOf = std => data.machines[std]?.slots ?? [];

const slotIndex = new Map();
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

// Move id taught by a TM, HM or TR (tm024 -> 'firespin', hm003rb -> 'surf'), null if not one
export function tmMove(id) {
  const slot = slotOf(id);
  return slot ? slotsOf(slot.std)[slot.i][2] : null;
}

const speciesIndex = new Map(data.learnSpecies.map((id, i) => [id, i]));
const bitsCache = new Map();
function bitsOf(std, i) {
  const key = `${std}:${i}`;
  let bits = bitsCache.get(key);
  if (!bits) {
    const code = data.machines[std].learn[i];
    const raw = atob(code.padEnd(Math.ceil(code.length / 4) * 4, '='));
    bits = Uint8Array.from(raw, c => c.charCodeAt(0));
    bitsCache.set(key, bits);
  }
  return bits;
}

const MAX_FORME_HOPS = 4;

export function canLearnTm(sim, species, id) {
  const slot = slotOf(id);
  if (!slot) return false;
  const learn = data.machines[slot.std].learn;
  let s = sim.Dex.species.get(species);
  for (let hop = 0; s?.exists && hop < MAX_FORME_HOPS; hop++) {
    const at = speciesIndex.get(s.id);
    if (at !== undefined && learn[at]) {
      const bits = bitsOf(slot.std, at);
      return !!((bits[slot.i >> 3] >> (slot.i & 7)) & 1);
    }
    const parent = sim.Dex.species.get(s.changesFrom || s.baseSpecies);
    if (!parent.exists || parent.id === s.id) break;
    s = parent;
  }
  return false;
}

export function learnableTms(sim, species, std = DEFAULT_STANDARD) {
  return slotsOf(std).map(([kind, number, move]) => ({ n: number, item: machineId(kind, number, std), move }))
    .filter(tm => canLearnTm(sim, species, tm.item));
}

// A standard's disc for a move, of the written kind when that standard has one (TM Surf in Kanto is HM03);
// exact: that kind only
export function machineByMove(std, move, kind = null, { exact = false } = {}) {
  const slots = slotsOf(std);
  const hit = (kind && slots.find(([k, , m]) => k === kind && m === move)) || (!exact && slots.find(([, , m]) => m === move));
  return hit ? machineId(hit[0], hit[1], std) : null;
}

export const machineByNumber = (std, kind, number) => (indexOf(std).has(`${kind}${number}`) ? machineId(kind, number, std) : null);

export const hasMachineKind = (std, kind) => slotsOf(std).some(([k]) => k === kind);

// Where a disc named with its move is looked for: its standard, the region's other games (nearest generation first),
// then every other standard by distance
export function lookupStandards(std, region) {
  const near = nearestStandards(std).filter(s => s !== std);
  const home = near.filter(s => regionGames(region).includes(s));
  return [std, ...home, ...near.filter(s => !home.includes(s))];
}

// The standard itself, then the others nearest to it in generation (later first on a tie; Ruby/Sapphire and
// FireRed/LeafGreen share generation 3, and either one still comes first for itself)
export function nearestStandards(std) {
  const gen = MACHINE_STANDARDS[std]?.gen ?? MACHINE_STANDARDS[DEFAULT_STANDARD].gen;
  const distance = s => (s === std ? -1 : Math.abs(MACHINE_STANDARDS[s].gen - gen));
  return [...STANDARD_IDS].sort((a, b) => distance(a) - distance(b) || MACHINE_STANDARDS[b].gen - MACHINE_STANDARDS[a].gen);
}
