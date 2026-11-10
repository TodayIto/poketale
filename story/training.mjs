// Training bags, energy and effort values.
// Modified for PokeTale on 2026-11-10. See THIRD-PARTY-NOTICES.md.
// Ported from PlayNav (https://github.com/poooooby/PlayNav): data/training_rules.lua (LIMITS, BAGS, METER, CORE: REFRESHED_HITS_DIV, SECOND_WIND_AFTER_BAG,
// ROUTINE_REST_BAGS, BLANK_BAG_DROP, BLANK_BAG_DROP_FULLY), src/training/rules.lua (the bag catalogue, GAME_ORDER, addEv, resetEvs, statRoom, rollBlankBag,
// pickBlackBag, isRareBag), src/training/session.lua (punch, finishBag, blankBagPunch, lieDown, wake, attachBag, HIT_LOCK).
// PlayNav is MIT License, Copyright (c) 2026 poooooby - THIRD-PARTY-NOTICES.md.

import { STATS } from '../engine/mon.mjs';
import { DEFAULT_FORMAT, formatRules, ruleFormat } from '../engine/rules.mjs';
import { EV_STAT_MAX, EV_TOTAL_MAX } from './rules.mjs';
import { canPet, enjoymentOf, setEnjoyment, friendshipFor, ENJOY_STEP, FRIENDSHIP_PER_STEP } from './amie.mjs';

export const BAG_SIZES = Object.freeze(['s', 'm', 'l']);

export const STAT_BAG = Object.freeze({ s: { hits: 10, ev: 1 }, m: { hits: 25, ev: 4 }, l: { hits: 50, ev: 12 } });

export const RESET_HITS = 100;
export const RESET_BAG = 'reset';

export const EFFECT_BAGS = Object.freeze(['strength', 'toughen_up', 'swiftness', 'big_shot', 'double_up']);
export const EFFECT_HITS = 10;

export const SOOTHING_BAG = 'soothing';
export const SOOTHING_HITS = 250;
export const SOOTHING_FRIENDSHIP = 20;

export const BAG_IDS = Object.freeze([...STATS.flatMap(stat => BAG_SIZES.map(size => `${stat}_${size}`)), RESET_BAG]);

export function bagOf(id) {
  if (id === RESET_BAG) return { id, kind: 'reset', hits: RESET_HITS };
  if (id === SOOTHING_BAG) return { id, kind: 'soothing', hits: SOOTHING_HITS };
  if (EFFECT_BAGS.includes(id)) return { id, kind: 'effect', hits: EFFECT_HITS };
  const [stat, size, ...rest] = String(id ?? '').split('_');
  if (rest.length || !STATS.includes(stat) || !Object.hasOwn(STAT_BAG, size)) return null;
  return { id, kind: 'stat', stat, size, ...STAT_BAG[size] };
}

const evOf = (evs, stat) => Math.max(0, Math.trunc(evs?.[stat] ?? 0));
export const evTotal = evs => STATS.reduce((sum, stat) => sum + evOf(evs, stat), 0);

export const statRoom = (evs, stat) => Math.max(0, Math.min(EV_STAT_MAX - evOf(evs, stat), EV_TOTAL_MAX - evTotal(evs)));

export const evGain = (evs, stat, amount) => (amount < 0 ? Math.max(amount, -evOf(evs, stat)) : Math.min(amount, statRoom(evs, stat)));

export const FIND_ORDER = Object.freeze([...STATS.flatMap(stat => BAG_SIZES.map(size => `${stat}_${size}`)), ...EFFECT_BAGS, null, RESET_BAG, SOOTHING_BAG]);

export const FIND_CHANCE = 5;
export const FIND_FULL = 10;

export function findBag(evs, rng) {
  if (rng() * 100 >= (evTotal(evs) >= EV_TOTAL_MAX ? FIND_FULL : FIND_CHANCE)) return null;
  return FIND_ORDER[Math.floor(rng() * FIND_ORDER.length)];
}

export const isRareBag = id => { const bag = bagOf(id); return !!bag && !(bag.kind === 'stat' && bag.size === 's'); };

export const WILD_EV_YIELD = 1.75;
export const ENERGY_PER_MESSAGE = WILD_EV_YIELD / 2;

export const ENERGY_MESSAGES = 10;
export const ENERGY_MAX = ENERGY_PER_MESSAGE * ENERGY_MESSAGES;

export const energyOf = mon => mon?.energy ?? ENERGY_MAX;

export function setEnergy(mon, value) {
  if (value >= ENERGY_MAX) delete mon.energy;
  else mon.energy = Math.max(0, value);
}

export function refillEnergy(state) {
  if (!state.party.some(mon => mon.energy !== undefined)) return state;
  return { ...state, party: state.party.map(mon => {
    if (mon.energy === undefined) return mon;
    const next = { ...mon };
    setEnergy(next, mon.energy + ENERGY_PER_MESSAGE);
    return next;
  }) };
}

export const SOOTHING_ENJOY = SOOTHING_FRIENDSHIP / FRIENDSHIP_PER_STEP * ENJOY_STEP;

export const traineeOf = mon => ({
  evs: Object.fromEntries(STATS.map(stat => [stat, evOf(mon.set?.evs, stat)])), energy: energyOf(mon), enjoy: enjoymentOf(mon), effect: mon.trainEffect ?? null,
});

export function setTrainee(mon, { evs, energy, enjoy, effect }) {
  mon.set.evs = { ...evs };
  setEnergy(mon, energy);
  setEnjoyment(mon, enjoy);
  if (effect) mon.trainEffect = effect; else delete mon.trainEffect;
}

export const hungBagOf = mon => mon?.trainBag ?? null;

export const isHungBag = hung => {
  const bag = bagOf(hung?.id);
  return !!bag && Number.isInteger(hung.hits) && hung.hits >= 0 && hung.hits < bag.hits;
};

export function setHungBag(mon, hung) {
  if (hung) mon.trainBag = { id: hung.id, hits: hung.hits };
  else delete mon.trainBag;
}

export function hangBlock(evs, id) {
  const bag = bagOf(id);
  if (!bag) return 'unknown';
  if (bag.kind === 'reset') return evTotal(evs) > 0 ? null : 'empty';
  if (bag.kind === 'stat') return statRoom(evs, bag.stat) > 0 ? null : 'capped';
  return null;
}

export function clearBag(trainee, id) {
  const bag = bagOf(id);
  if (!bag) throw new Error(`Unknown training bag: ${id}`);
  const next = { ...trainee, evs: Object.fromEntries(STATS.map(stat => [stat, evOf(trainee.evs, stat)])) };
  if (bag.kind === 'reset') {
    const cleared = evTotal(next.evs);
    for (const stat of STATS) next.evs[stat] = 0;
    return { trainee: next, event: { type: 'reset', id, cleared } };
  }
  if (bag.kind === 'effect') {
    next.effect = id;
    return { trainee: next, event: { type: 'effect', id } };
  }
  if (bag.kind === 'soothing') {
    const spent = Math.min(SOOTHING_ENJOY, Math.floor(next.enjoy / ENJOY_STEP) * ENJOY_STEP);
    next.enjoy -= spent;
    return { trainee: next, event: { type: 'soothing', id, spent, friendship: friendshipFor(spent) } };
  }
  const room = evGain(next.evs, bag.stat, bag.ev);
  const added = Math.min(room, Math.floor(next.energy));
  next.evs[bag.stat] += added;
  next.energy -= added;
  const short = added < room ? 'energy' : room < bag.ev ? 'capped' : null;
  return { trainee: next, event: { type: 'cleared', id, stat: bag.stat, added, short } };
}

export function clearBags(trainee, ids) {
  let friendship = 0;
  for (const id of ids) {
    const out = clearBag(trainee, id);
    trainee = out.trainee;
    if (out.event.type === 'soothing') friendship += out.event.friendship;
  }
  return { trainee, friendship };
}

const BASE_STEPS = [[140, 20], [120, 16], [100, 14], [80, 12], [60, 10], [40, 8], [20, 6], [1, 4], [0, 1]];
const EV_STEPS = [[252, 32], [216, 28], [180, 24], [144, 20], [108, 16], [72, 12], [36, 8], [1, 4], [0, 1]];
export const METER_MAX = 52;
const stepOf = (value, steps) => steps.find(([least]) => value >= least)[1];

export const meterAxis = (base, ev) => ({ base: stepOf(base, BASE_STEPS), effort: stepOf(ev, EV_STEPS) });

export const METER_ORDER = Object.freeze(['hp', 'atk', 'def', 'spe', 'spd', 'spa']);

export const HIT_LOCK = 13 / 30;

export const SECOND_WIND = 2;

const SECOND_WIND_AFTER_BAG = 0.5;

export const REST_BAGS = Object.freeze([3, 5]);

export function createCore({ trainee, hung = null, rng = Math.random }) {
  let now = trainee;
  let bag = isHungBag(hung) ? { id: hung.id, hits: hung.hits, needed: bagOf(hung.id).hits } : null;
  let wind = false, resting = false, lastTap = -Infinity;
  let toRest = null;
  const cleared = [];
  const roll = ([lo, hi]) => lo + Math.floor(rng() * (hi - lo + 1));
  const put = (id, extra = {}) => {
    bag = { id, hits: 0, needed: bagOf(id).hits };
    return { type: 'hang', id, needed: bag.needed, hits: 0, ...extra };
  };
  const hangNow = (id, extra) => {
    const why = hangBlock(now.evs, id);
    return why ? { type: 'refuse', id, why } : put(id, extra);
  };
  const burst = () => {
    const id = bag.id, out = clearBag(now, id);
    now = out.trainee;
    cleared.push(id);
    bag = null;
    const events = [{ ...out.event, evs: { ...now.evs }, energy: now.energy }];
    wind = rng() < SECOND_WIND_AFTER_BAG;
    if (bagOf(id).kind === 'stat' && !hangBlock(now.evs, id)) events.push(hangNow(id, { again: true }));
    if (wind) events.push({ type: 'wind' });
    toRest ??= roll(REST_BAGS);
    if (--toRest <= 0) {
      toRest = null;
      resting = true;
      events.push({ type: 'rest' });
    }
    return events;
  };

  const blank = strength => {
    const events = [{ type: 'punch', blank: true, strength }];
    const id = findBag(now.evs, rng);
    if (!id) return events;
    events.push({ type: 'found', id }, put(id, { found: true }));
    if (isRareBag(id)) { wind = true; events.push({ type: 'wind' }); }
    return events;
  };
  return {
    get bag() { return bag && { ...bag }; },
    get trainee() { return { ...now, evs: { ...now.evs } }; },
    get evs() { return { ...now.evs }; },
    get energy() { return now.energy; },
    get wind() { return wind; },
    get resting() { return resting; },
    cleared,
    hang(id) {
      if (resting) return [{ type: 'refuse', id, why: 'resting' }];
      return [hangNow(id)];
    },
    tap(at) {
      if (at - lastTap < HIT_LOCK) return [];
      lastTap = at;
      if (resting) {
        resting = false;
        wind = true;
        return [{ type: 'wake' }, { type: 'wind' }];
      }
      const strength = wind ? SECOND_WIND : 1;
      if (!bag) return blank(strength);
      bag.hits = Math.min(bag.needed, bag.hits + strength);
      const events = [{ type: 'punch', hits: bag.hits, needed: bag.needed, strength }];
      if (bag.hits >= bag.needed) events.push(...burst());
      return events;
    },
  };
}

export const effortOn = (sim, format = DEFAULT_FORMAT) => formatRules(sim, format).effort;

export function trainBlock(mon, ctx, locked = false) {
  if (locked) return 'battle';
  if (!canPet(mon)) return 'fainted';
  if (!effortOn(ctx.sim, ruleFormat(ctx.rule))) return 'noEffort';
  return null;
}
