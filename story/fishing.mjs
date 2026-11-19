import FISHING from '../data/fishing.json' with { type: 'json' };
import { seededIndex, messageId } from './blocks.mjs';
import { latestStatus, earlierRegion } from './compat.mjs';
import { placeMatcher, routeOf } from './shop.mjs';
import { norm } from './norm.mjs';
import { OUTSIDE_ITEMS, isRod, rodGrade } from './items.mjs';
import { SHINY_ODDS } from '../engine/mon.mjs';
import { forgeAt, appendBlock } from './forge.mjs';
import { battlesOff } from './battles-off.mjs';
import { rulesAt } from './setting-changes.mjs';

export const RODS = Object.freeze(Object.keys(OUTSIDE_ITEMS).filter(id => isRod(id)).sort((a, b) => rodGrade(a) - rodGrade(b)));

export const FISH_ITEM_PERCENT = 40;

export const JUNK_PERCENT = Object.freeze([70, 50, 30]);

export const FISH_ITEMS = Object.freeze({
  junk: Object.freeze([['prettyfeather', 45], ['stardust', 30], ['pearl', 25]]),
  good: Object.freeze([['bigpearl', 20], ['starpiece', 15], ['mysticwater', 15], ['waterstone', 12], ['deepseatooth', 8], ['deepseascale', 8], ['prismscale', 8],
    ['pearlstring', 6], ['bottlecap', 5], ['cometshard', 3]]),
});

export const CHAIN_MAX = 10;

const SHINY_ROLLS = 4;

export const LEVEL_BELOW = 5;

const ROD_MATCH = [[1, 0.5, 0.25], [0.5, 1, 0.5], [0.25, 0.5, 1]];

const ROD_BIAS = [0, 1.5, 3];

const LEVEL_SPAN = 10;

const CURVE = FISHING.evolveCurve;
export const evolvedShare = offset => (offset < 0 ? 0 : offset >= CURVE.topFrom ? CURVE.top : CURVE.start + ((CURVE.top - CURVE.start) * offset) / CURVE.topFrom) / 100;

const PLACES = Object.entries(FISHING.regions).flatMap(([region, r]) => r.places.map(place => ({
  region, place, match: [...place.ko, ...place.en].filter(name => routeOf(name) === null).map(placeMatcher), length: Math.max(0, ...[...place.ko, ...place.en].map(n => norm(n).length)),
})));

export function fishPlace(chat, at) {
  const status = latestStatus(chat, at);
  const region = status?.region ?? earlierRegion(chat, at + 1) ?? null;
  const names = [status?.site, status?.location].filter(name => norm(name));
  const here = PLACES.filter(p => !region || p.region === region);
  for (const name of names) {
    const route = routeOf(name);
    if (route !== null && region) {
      const hit = here.find(p => p.place.route === route);
      if (hit) return { region, place: hit.place };
    }
    const hits = here.filter(p => p.match.some(m => m(name))).sort((a, b) => b.length - a.length);
    if (hits.length) return { region: hits[0].region, place: hits[0].place };
  }
  return { region: region && FISHING.regions[region] ? region : null, place: null };
}

export function fishRows({ region, place }) {
  const rows = place?.rows ?? FISHING.regions[region]?.fallback ?? FISHING.everywhere;
  return rows.map(([i, ...rest]) => [FISHING.species[i], ...rest]);
}
const GRADES = new Map(FISHING.species.map((s, i) => [s, FISHING.grades[i]]));
const EVOLVES = new Map(Object.entries(FISHING.evolves).map(([from, list]) => [FISHING.species[from], list.map(([to, level]) => [FISHING.species[to], level])]));

export const levelEvolutions = species => EVOLVES.get(species) ?? [];
const EVOLVE_INTO = new Map(Object.entries(FISHING.regions).map(([region, r]) => [region, new Set(r.evolveInto.map(i => FISHING.species[i]))]));

const evolvesHere = (region, species) => !region || !EVOLVE_INTO.has(region) || EVOLVE_INTO.get(region).has(species);

export const fishGrade = species => GRADES.get(species) ?? 50;

export const levelFit = (min, max, level) => 1 / (1 + Math.max(0, min - level, level - max) / LEVEL_SPAN) ** 2;

export function fishWeights(rows, grade, level) {
  const sums = new Map();
  for (const [species, rod, min, max, share] of rows) {
    const match = rod === 3 ? 1 : ROD_MATCH[grade][rod];
    sums.set(species, (sums.get(species) ?? 0) + share * match * levelFit(min, max, level));
  }
  return [...sums].map(([species, sum]) => [species, sum * Math.exp(ROD_BIAS[grade] * (fishGrade(species) / 100 - 0.5))]).filter(([, w]) => w > 0);
}

const UNIT = 1e6;

const roll = seed => seededIndex(seed, UNIT) / UNIT;

function pick(list, seed) {
  const total = list.reduce((sum, [, w]) => sum + w, 0);
  let r = roll(seed) * total;
  for (const [value, w] of list) { if (r < w) return value; r -= w; }
  return list.at(-1)[0];
}

export function fishLevel(levels, seed) {
  const list = (levels ?? []).filter(Number.isFinite);
  const average = list.length ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : 5;
  return Math.max(1, Math.min(100, average - seededIndex(`${seed}:level`, LEVEL_BELOW + 1)));
}

export function evolvedWeights(weights, level, region = null) {
  const w = new Map(weights);
  const line = s => [s, ...levelEvolutions(s).filter(([into]) => evolvesHere(region, into)).flatMap(([into]) => line(into))];
  const pairs = [], seen = new Set();
  for (const todo = [...w.keys()]; todo.length;) {
    const from = todo.pop();
    if (seen.has(from)) continue;
    seen.add(from);
    for (const [into, at] of levelEvolutions(from)) {
      if (level < at || !evolvesHere(region, into)) continue;
      pairs.push([from, into, at]);
      todo.push(into);
    }
  }
  for (const [from, into, at] of pairs.sort((x, y) => x[2] - y[2])) {
    const pre = w.get(from) ?? 0;
    if (pre <= 0) continue;
    const evolved = line(into).reduce((sum, s) => sum + (w.get(s) ?? 0), 0);
    const share = evolved / (pre + evolved), target = evolvedShare(level - at);
    if (share >= target) continue;
    const moved = (pre * (target - share)) / (1 - share);
    w.set(from, pre - moved);
    w.set(into, (w.get(into) ?? 0) + moved);
  }
  return [...w].filter(([, x]) => x > 0);
}

export function chainShiny(chain, seed) {
  const rolls = SHINY_ROLLS * Math.min(Math.max(0, chain), CHAIN_MAX);
  return rolls > 0 && roll(`${seed}:shiny`) < 1 - (1 - 1 / SHINY_ODDS) ** rolls;
}

export function castResult({ seed, rod, where, levels, chain = 1 }) {
  const grade = rodGrade(rod) ?? 0;
  if (roll(`${seed}:item`) * 100 < FISH_ITEM_PERCENT) {
    const kind = roll(`${seed}:junk`) * 100 < JUNK_PERCENT[grade] ? 'junk' : 'good';
    return { item: pick(FISH_ITEMS[kind], `${seed}:${kind}`) };
  }
  const level = fishLevel(levels, seed);
  const weights = evolvedWeights(fishWeights(fishRows(where), grade, level), level, where?.region ?? null);
  return { species: pick(weights, `${seed}:species`), level, shiny: chainShiny(chain, seed) };
}

export const fishSeed = (id, n) => `fish|${id}|${n}`;

const WATER = new Set(['sea', 'beach', 'lake', 'swamp', 'seabed', 'island']);

export function fishBlock({ name, level, shiny }, place) {
  return `<pkb-battle>\nopponent: wild\nplace: ${WATER.has(place) ? place : 'lake'}\npokemon: ${name} Lv${level}${shiny ? ' | shiny' : ''}\n</pkb-battle>`;
}

export const fishAction = (rod, at, item = null) => ({ type: 'fish', item: rod, ops: [
  { op: 'item', item: rod, delta: 0, fish: { at, rod } }, ...(item ? [{ op: 'item', item, delta: 1 }] : []),
] });

const castAt = action => (action?.type === 'fish' ? action.ops?.[0]?.fish?.at ?? null : null);

export function castCounts(chat, actions, { counts = () => true } = {}) {
  const index = new Map((chat?.message ?? []).map((m, i) => [messageId(m, i), i]));
  const out = new Map();
  for (const action of actions) {
    const id = castAt(action);
    if (id === null || !index.has(id) || !counts(index.get(id), action)) continue;
    out.set(id, (out.get(id) ?? 0) + 1);
  }
  return out;
}

export const chainCounts = chat => { const at = rulesAt(chat); return (index, action) => at(index, action?.at).fishChain; };

export function fishChain(chat, at, casts) {
  const messages = chat?.message ?? [];
  let chain = 1;
  for (let i = at - 1; i >= 0 && chain < CHAIN_MAX; i--) {
    if (messages[i]?.role !== 'char') continue;
    if (!casts.has(messageId(messages[i], i))) break;
    chain++;
  }
  return chain;
}

export function fishCast(chat, { rod, bag = {}, quiet = true, levels = [], actions = [], speciesName = id => id }) {
  if (!isRod(rod)) return { why: 'unknown' };
  if (!(bag?.[rod] > 0)) return { rule: 'state.notInBag' };
  if (!quiet) return { why: 'replying' };
  if (battlesOff(chat)) return { why: 'battlesOff' };
  const at = forgeAt(chat);
  if (at < 0) return { why: 'noScene' };
  const id = messageId(chat.message[at], at);
  const n = castCounts(chat, actions).get(id) ?? 0;
  const where = fishPlace(chat, at);
  const chain = fishChain(chat, at, castCounts(chat, actions, { counts: chainCounts(chat) }));
  const seed = fishSeed(id, n);
  const result = castResult({ seed, rod, where, levels, chain });
  const block = result.species ? fishBlock({ name: speciesName(result.species), level: result.level, shiny: result.shiny }, latestStatus(chat, at)?.place) : null;
  return { at, id, where, chain, result, action: fishAction(rod, id, result.item ?? null), block };
}

export function appendCast(chat, cast) {
  appendBlock(chat.message[cast.at], cast.block);
}
