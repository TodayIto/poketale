import { BAG_ITEMS } from '../engine/bag.mjs';
import { BALLS } from '../engine/capture.mjs';
import { expForLevel, growthOf } from '../engine/exp.mjs';
import { STATS, displayName, heldItemForm, spriteIdOf } from '../engine/mon.mjs';
import { itemEvolution, tradeEvolution, tradePair, evolutionItems, spinEvolution, ABSENT_TRADE_EVOLUTION } from '../engine/evolution.mjs';
import { applyOps, emptyState, maxHp, movePp, toID, clone, healParty, rememberableMoves, friendshipOf, evolutionCheck, isEgg, hatched, hatchedParty, breedingOf, stateFormat,
  restsLeft, restHelps, SHORT_RESTS } from './state.mjs';
import { EGG_SPRITE, compatHearts } from '../engine/breeding.mjs';
import { FRIENDSHIP_MAX, FRIENDSHIP_STEPS } from '../engine/friendship.mjs';
import { PARTY_MAX, MAX_LEVEL, MAX_IV, EV_STAT_MAX, EV_TOTAL_MAX, BOX_SIZE, MAX_MOVES } from './rules.mjs';
import { ruleFormat, DEFAULT_FORMAT } from '../engine/rules.mjs';
import { MAX_PP_UPS } from '../engine/pp.mjs';
import { OUTSIDE_ITEMS, VITAMIN_EVS, HYPER_TRAIN_LEVEL, isTm } from './items.mjs';
import { itemText, tmMove, canLearnTm } from './item-info.mjs';
import { withParticle, statName, natureName, listOf, boxLabel } from './diary.mjs';
import { say } from './screen-text.mjs';
import { battleNamesIn } from '../plugin/battle/names.js';
import bagIcons from '../data/bag-icons.json' with { type: 'json' };
import { CUSTOM_PREFIX, isCustomItem, customInfo, itemId } from './custom-items.mjs';
import { hungBagOf, effortOn } from './training.mjs';
import { badgeCaseModel, badgePress } from './badge-case.mjs';
import { canPet, enjoymentOf, parsePuff, puffId, puffCount, puffFriendship, foodFriendship, feedHeals, FREE_GRADE, PUFF_FLAVORS, PUFF_GRADES } from './amie.mjs';

export { PARTY_MAX, BOX_SIZE };

export const SCREEN_PLACES = Object.freeze(['panel', 'window']);
export const DEFAULT_SCREEN_PLACE = 'panel';
export const BOX_COUNT = 32;
export const TABS = Object.freeze(['party', 'box', 'bag', 'amie', 'badges']);

const TRAVEL_TAB = 'travel';

const refOf = mon => ({ uid: mon.uid });

const namesCache = new WeakMap();

export function namesFor(lang, sim) {
  let byLang = namesCache.get(sim.Dex);
  if (!byLang) namesCache.set(sim.Dex, byLang = {});
  return byLang[lang] ??= battleNamesIn(lang, sim.Dex);
}

export const itemName = (id, names) => names.item(toID(id));

export function bagItemName(id, names) {
  const key = toID(id), move = tmMove(key);
  return move ? `${itemName(key, names)} ${names.move(move)}` : itemName(key, names);
}

export function itemLabel(state, id, names, { bag = false } = {}) {
  if (isCustomItem(id)) return customInfo(state, id)?.name ?? id.slice(CUSTOM_PREFIX.length);
  return bag ? bagItemName(id, names) : itemName(id, names);
}

const monName = (mon, sim, names) => displayName(sim.Dex, names, mon.set.species, mon.set.name);

export const LOCK_FREE = new Set(['nickname', 'boxname']);

const evolutionItemCache = new WeakMap();

function stoneItems(sim, trade) {
  let byMode = evolutionItemCache.get(sim.Dex);
  if (!byMode) evolutionItemCache.set(sim.Dex, byMode = {});
  return byMode[trade] ??= evolutionItems(sim.Dex, trade);
}

export function itemKind(id, sim, trade = ABSENT_TRADE_EVOLUTION) {
  if (isCustomItem(id)) return 'custom';
  const key = toID(id);
  if (Object.hasOwn(BALLS, key)) return 'ball';
  const bag = BAG_ITEMS[key];
  if (bag) return bag.heal || bag.cure || bag.revive || bag.pp ? 'medicine' : 'battle';
  if (isTm(key)) return 'tm';
  if (Object.hasOwn(OUTSIDE_ITEMS, key)) return OUTSIDE_ITEMS[key].kind;
  if (key === 'rarecandy') return 'candy';
  if (stoneItems(sim, trade).has(key)) return 'stone';
  return 'held';
}
const USABLE = new Set(['medicine', 'candy', 'stone', 'train', 'tm', 'evolve']);

const BAG_ONLY = new Set(['ball', 'battle', 'field', 'key']);

const NOT_HOLDABLE = new Set([...BAG_ONLY, 'tm']);
// Key items cannot be thrown away
const NOT_TOSSABLE = new Set(['key']);

const medicineOf = id => BAG_ITEMS[id] ?? (OUTSIDE_ITEMS[id]?.kind === 'medicine' ? OUTSIDE_ITEMS[id] : null);

export function stoneEvolution(ctx, mon, id, party = []) {
  const { mon: evolving, now } = evolutionCheck(ctx, mon, party);
  return itemEvolution(ctx.sim.Dex, evolving, id, now);
}

export function cordEvolutions(ctx, mon, party = []) {
  const { mon: evolving, now } = evolutionCheck(ctx, mon, party);
  const trade = tradeEvolution(ctx.sim.Dex, evolving, now);
  if (!trade) return null;
  const first = { uid: mon.uid, into: trade.into, ...(trade.consumeHeld ? { consumeHeld: true } : {}) };
  const other = trade.with && hatched(party).find(m => m.uid !== mon.uid && toID(ctx.sim.Dex.species.get(m.set.species).name) === toID(trade.with));
  const into = other && tradePair(ctx.sim.Dex, { species: mon.set.species, item: mon.set.item }, { species: other.set.species, item: other.set.item })?.[1];
  return into ? [first, { uid: other.uid, into }] : [first];
}

export function swapEvolutions(ctx, a, b) {
  if ((ctx.tradeEvolution ?? ABSENT_TRADE_EVOLUTION) !== 'level' || hatched([a, b]).length < 2) return null;
  const into = tradePair(ctx.sim.Dex, { species: a.set.species, item: a.set.item }, { species: b.set.species, item: b.set.item });
  return into && [[a, into[0]], [b, into[1]]].filter(([, to]) => to).map(([mon, to]) => ({ uid: mon.uid, into: to }));
}

export function abilityChange(sim, mon, id) {
  const how = OUTSIDE_ITEMS[toID(id)]?.ability;
  if (!how) return null;
  const abilities = sim.Dex.species.get(mon.set.species).abilities;
  const now = toID(mon.set.ability);
  const slot = ['0', '1', 'H'].find(k => abilities[k] && toID(abilities[k]) === now);
  const to = how === 'capsule' ? (slot === '0' ? abilities['1'] : slot === '1' ? abilities['0'] : null)
    : slot === 'H' ? abilities['0'] : slot ? abilities.H : null;
  return to && toID(to) !== now ? to : null;
}

const STATUSES = new Set(['par', 'brn', 'slp', 'frz', 'psn', 'tox']);

export const statusName = (status, lang) => (STATUSES.has(status) ? say(lang, `status.${status}`) : '');

export const statusShort = (status, lang) => (STATUSES.has(status) ? say(lang, `status.short.${status}`) : '');

export function itemDescription(id, sim, lang) {
  const t = (key, values) => say(lang, key, values);
  const key = toID(id), kind = itemKind(key, sim);
  let bag = BAG_ITEMS[key];
  if (kind === 'ball') return t('item.ball');
  if (kind === 'battle') {
    if (bag?.boost) return t('item.boost', { stat: statName(bag.boost, lang) });
    return t('item.crit');
  }
  const text = lang === 'ko' ? itemText(key) : null;
  if (text) return text;
  if (kind === 'tm') return t('item.tm', { move: withParticle(lang, namesFor(lang, sim).move(tmMove(key)), '을/를') });
  if (kind === 'medicine') {
    bag = medicineOf(key);
    if (bag.all) return t('item.reviveAll');
    if (bag.revive) return t(bag.revive === 'full' ? 'item.reviveFull' : 'item.reviveHalf');
    if (bag.pp) return bag.pp === 'full' ? t(bag.oneMove ? 'item.ppOneFull' : 'item.ppAllFull') : t(bag.oneMove ? 'item.ppOne' : 'item.ppAll', { n: bag.pp });
    if (bag.heal && bag.cure) return t('item.healCure');
    if (bag.heal) return bag.heal === 'full' ? t('item.healFull') : t('item.heal', { n: bag.heal });
    if (bag.cure === 'all') return t('item.cureAll');
    return t('item.cure', { statuses: listOf(bag.cure.map(s => statusName(s, lang)).filter((v, i, a) => v && a.indexOf(v) === i), lang) });
  }
  if (kind === 'candy') return t('item.candy');
  if (kind === 'stone' || kind === 'evolve') return t('item.stone');
  const outside = OUTSIDE_ITEMS[key] ?? {};
  if (outside.vitamin) return t('item.vitamin', { stat: statName(outside.vitamin, lang) });
  if (outside.evBerry) return t('item.evBerry', { stat: statName(outside.evBerry, lang) });
  if (outside.exp) return t('item.expCandy', { n: outside.exp.toLocaleString(lang) });
  if (outside.ability) return t(outside.ability === 'capsule' ? 'item.abilityCapsule' : 'item.abilityPatch');
  if (outside.mint) return t('item.mint', { nature: natureName(outside.mint, lang) });
  if (outside.hyper) return t(outside.hyper === 'all' ? 'item.goldBottleCap' : 'item.bottleCap', { n: HYPER_TRAIN_LEVEL });
  if (outside.ppUp) return t(outside.ppUp > 1 ? 'item.ppMax' : 'item.ppUp');
  if (kind === 'treasure' || kind === 'field' || kind === 'key') return t(`item.${kind}`);
  return t('item.held');
}

const noEffect = lang => say(lang, 'panel.noEffect');

const selectMove = lang => say(lang, 'panel.selectMove');

export function useCheck(mon, itemId, ctx, lang, party = [], format = DEFAULT_FORMAT) {
  const { sim, exp } = ctx;
  const id = toID(itemId), kind = itemKind(id, sim, ctx.tradeEvolution);
  const fainted = mon.hp === 0;
  const no = { ok: false, reason: noEffect(lang) };
  const names = namesFor(lang, sim);
  const p = (word, pair) => withParticle(lang, word, pair);
  if (kind === 'medicine') {
    const item = medicineOf(id);
    if (item.revive) return fainted ? { ok: true } : no;
    if (fainted) return no;
    if (item.pp) {

      const moves = mon.set.moves.map(m => { const { pp, maxpp } = movePp(sim, mon, m, format); return { id: m, pp, maxpp, disabled: pp >= maxpp }; });
      if (!moves.some(m => !m.disabled)) return no;
      return item.oneMove ? { ok: true, moves, prompt: selectMove(lang) } : { ok: true };
    }
    let useful = false;
    if (item.heal) useful ||= mon.hp !== null && mon.hp < maxHp(sim, mon.set, format);
    if (item.cure) useful ||= !!mon.status && mon.status !== 'fnt' && (item.cure === 'all' || item.cure.includes(mon.status));
    return useful ? { ok: true } : no;
  }
  if (kind === 'candy') return mon.set.level < MAX_LEVEL ? { ok: true } : no;
  if (kind === 'stone') { const into = stoneEvolution(ctx, mon, id, party); return into ? { ok: true, evolutions: [{ uid: mon.uid, into }] } : no; }
  if (kind === 'evolve') {

    const evolutions = (ctx.tradeEvolution ?? ABSENT_TRADE_EVOLUTION) === 'level' ? null : cordEvolutions(ctx, mon, party);
    return evolutions ? { ok: true, evolutions } : no;
  }
  if (kind === 'tm') {
    const move = tmMove(id);
    if (!move) return no;
    const values = { mon: p(monName(mon, sim, names), '은/는'), move: p(names.move(move), '을/를') };
    if (mon.set.moves.includes(move)) return { ok: false, reason: say(lang, 'panel.knows', values) };
    if (!canLearnTm(sim, mon.set.species, id)) return { ok: false, reason: say(lang, 'panel.cannotLearn', values) };
    return { ok: true, teach: move };
  }
  if (kind !== 'train') return no;
  const item = OUTSIDE_ITEMS[id];
  if (item.vitamin) {
    const evs = mon.set.evs ?? {};
    const total = STATS.reduce((sum, s) => sum + (evs[s] ?? 0), 0);
    return (evs[item.vitamin] ?? 0) < EV_STAT_MAX && total < EV_TOTAL_MAX ? { ok: true } : no;
  }

  if (item.evBerry) return (mon.set.evs?.[item.evBerry] ?? 0) > 0 || friendshipOf(ctx, mon) < FRIENDSHIP_MAX ? { ok: true } : no;

  if (item.ppUp) {
    const moves = mon.set.moves.map(m => {
      const { pp, maxpp, ppUps } = movePp(sim, mon, m, format);
      return { id: m, pp, maxpp, ppUps, disabled: ppUps >= MAX_PP_UPS || !!sim.Dex.moves.get(m).noPPBoosts };
    });
    return moves.some(m => !m.disabled) ? { ok: true, moves, prompt: selectMove(lang) } : no;
  }
  if (item.exp) return mon.set.level < MAX_LEVEL && growthOf(exp, sim.Dex.species.get(mon.set.species)) ? { ok: true } : no;
  if (item.ability) {
    const to = abilityChange(sim, mon, id);
    return to ? { ok: true, confirm: say(lang, 'panel.abilityAsk', { mon: monName(mon, sim, names), ability: p(names.ability(to), '으로/로') }) } : no;
  }
  if (item.mint) return item.mint !== mon.set.nature ? { ok: true } : no;
  if (item.hyper) {
    if (mon.set.level < HYPER_TRAIN_LEVEL) return no;
    const stats = STATS.map(s => ({ id: s, iv: mon.set.ivs?.[s] ?? MAX_IV }));
    if (!stats.some(s => s.iv < MAX_IV)) return no;
    return item.hyper === 'one' ? { ok: true, stats } : { ok: true };
  }
  return no;
}

export const partyWide = id => !!OUTSIDE_ITEMS[toID(id)]?.all;

export function useOps(mon, itemId, { sim }, { move, stat } = {}) {
  const id = toID(itemId), kind = itemKind(id, sim), ref = mon ? refOf(mon) : null;
  const ops = [];
  const outside = OUTSIDE_ITEMS[id];
  if (kind === 'medicine') {
    const item = medicineOf(id);
    if (item.all) ops.push({ op: 'heal', ref: 'all', revive: true });
    else if (item.revive) ops.push({ op: 'heal', ref, revive: true, ...(item.revive === 'half' ? { hpPercent: 50 } : {}) });
    else if (item.pp) ops.push({ op: 'pp', ref, amount: item.pp, ...(item.oneMove ? { move } : {}) });
    else {
      if (item.heal) ops.push(item.heal === 'full' ? { op: 'heal', ref, hpPercent: 100 } : { op: 'heal', ref, hpAdd: item.heal });
      if (item.cure) ops.push({ op: 'heal', ref, statusOnly: true });
    }
    if (ref && Object.hasOwn(FRIENDSHIP_STEPS, id)) ops.push({ op: 'friendship', ref, source: id });
  } else if (kind === 'candy') ops.push({ op: 'level', ref, delta: 1, candy: true });
  else if (kind === 'train' && outside.vitamin) ops.push({ op: 'evs', ref, stat: outside.vitamin, amount: VITAMIN_EVS }, { op: 'friendship', ref, source: 'vitamin' });
  else if (kind === 'train' && outside.evBerry) {
    if ((mon.set.evs?.[outside.evBerry] ?? 0) > 0) ops.push({ op: 'evs', ref, stat: outside.evBerry, amount: -VITAMIN_EVS });
    ops.push({ op: 'friendship', ref, source: 'berry' });
  }
  else if (kind === 'train' && outside.exp) ops.push({ op: 'exp', ref, amount: outside.exp });
  else if (kind === 'train' && outside.ability) ops.push({ op: 'ability', ref, ability: abilityChange(sim, mon, id) });
  else if (kind === 'train' && outside.mint) ops.push({ op: 'nature', ref, nature: outside.mint });
  else if (kind === 'train' && outside.hyper) ops.push({ op: 'hypertrain', ref, stats: outside.hyper === 'all' ? 'all' : [stat] });
  else if (kind === 'train' && outside.ppUp) ops.push({ op: 'ppup', ref, move, amount: outside.ppUp }, { op: 'friendship', ref, source: 'vitamin' });
  else throw new Error(`Not an item used outside battle: ${id}`);
  ops.push({ op: 'item', item: id, delta: -1, fromBag: true });
  return ops;
}

export function holdableItems(state, sim) {
  return Object.entries(state.bag ?? {}).filter(([id, n]) => n > 0 && !NOT_HOLDABLE.has(itemKind(id, sim))).map(([id]) => id);
}

const bagText = (state, id, sim, lang) => (isCustomItem(id) ? itemLabel(state, id, namesFor(lang, sim))
  : `${bagItemName(id, namesFor(lang, sim))}\n${itemDescription(id, sim, lang)}`);

export const actions = {
  order: (a, b) => ({ type: 'order', ops: [{ op: 'swap', a: refOf(a), b: refOf(b) }] }),
  deposit: mon => ({ type: 'box', ops: [{ op: 'deposit', ref: refOf(mon) }] }),
  withdraw: mon => ({ type: 'box', ops: [{ op: 'withdraw', ref: refOf(mon) }] }),

  swapIn: (boxMon, partyMon) => ({ type: 'box', ops: [{ op: 'swap', a: refOf(boxMon), b: refOf(partyMon) }] }),
  release: mon => ({ type: 'release', ops: [{ op: 'release', ref: refOf(mon) }] }),
  nickname: (mon, name) => ({ type: 'nickname', ops: [{ op: 'nickname', ref: refOf(mon), name: String(name ?? '').trim() }] }),
  give: (mon, item) => ({ type: 'hold', ops: [{ op: 'hold', ref: refOf(mon), item: itemId(item), fromBag: true }] }),
  take: mon => ({ type: 'hold', ops: [{ op: 'hold', ref: refOf(mon), item: '', fromBag: true }] }),

  toss: (item, n) => ({ type: 'toss', ops: [{ op: 'item', item: itemId(item), delta: -n, fromBag: true }] }),
  boxName: (box, name) => ({ type: 'boxname', ops: [{ op: 'boxname', box, name: String(name ?? '').trim() }] }),
  use: (mon, item, ctx, options) => ({ type: 'use', item: toID(item), ops: useOps(mon, item, ctx, options) }),

  breed: (a, b) => ({ type: 'breed', ops: [{ op: 'breed', a: refOf(a), b: refOf(b) }] }),
  unbreed: () => ({ type: 'breed', ops: [{ op: 'breed', stop: true }] }),

  rest: () => ({ type: 'rest', ops: [{ op: 'rest' }] }),
};

export function restView(state, sim, locked) {
  const left = restsLeft(state);
  const why = locked ? 'battle' : !left ? 'none' : !restHelps(state, sim) ? 'full' : null;
  return { left, max: SHORT_RESTS, why };
}

export function restedSlots(before, after) {
  if (!after) return [];
  const was = new Map(before.party.map(mon => [mon.uid, mon]));
  const changed = (old, mon) => (old.hp ?? null) !== (mon.hp ?? null) || (old.status || '') !== (mon.status || '')
    || mon.set.moves.some(id => old.pp?.[id] !== mon.pp?.[id]);
  return after.party.filter(mon => was.has(mon.uid) && changed(was.get(mon.uid), mon)).map(mon => mon.uid);
}

export function breedingView(state, ctx, lang) {
  const now = breedingOf(state, ctx);
  if (!now) return null;
  const hearts = compatHearts(now.chance);
  return { a: now.a.uid, b: now.b.uid, chance: now.chance, ok: now.chance > 0, hearts, reason: now.reason,
    label: say(lang, now.chance > 0 ? `panel.breed.hearts${hearts}` : 'panel.breed.none'), why: now.chance > 0 ? '' : say(lang, `panel.breed.why.${now.reason}`) };
}

const learnOp = (mon, move, result) => (result?.learned
  ? { op: 'learn', ref: refOf(mon), move, ...(result.forgot ? { forget: result.forgot } : {}) }
  : { op: 'learn', ref: refOf(mon), move, skip: true });

export const pendingCount = mon => (mon?.pending?.hatched ? 1 : 0) + (mon?.pending?.moves?.length ?? 0) + (mon?.pending?.evolve ? 1 : 0);

export const levelBadge = mon => (pendingCount(mon) ? Math.max(1, mon.pending.levels || pendingCount(mon)) : 0);

export function levelUpPlan(mon) {
  return { hatch: !!mon?.pending?.hatched, moves: [...(mon?.pending?.moves ?? [])], evolve: mon?.pending?.evolve ?? null };
}

export function evolutionMoves(ctx, mon, into) {
  const probe = { ...emptyState(), party: [{ ...clone(mon), pending: { levels: 0, moves: [], evolve: null } }] };
  const { state, errors } = applyOps(probe, [{ op: 'evolve', ref: refOf(mon), species: into }], ctx, 'panel:evolve', null);
  return errors.length ? [] : state.party[0].pending.moves;
}

export function levelUpAction(mon, { hatched = false, moves = [], evolution = null } = {}) {
  const ops = [...(hatched ? [{ op: 'hatched', ref: refOf(mon) }] : []), ...moves.map(({ move, result }) => learnOp(mon, move, result))];
  if (evolution) {
    if (evolution.evolved) {
      ops.push({ op: 'evolve', ref: refOf(mon), species: evolution.into });
      for (const learned of evolution.learned ?? []) ops.push(learnOp(mon, learned.move, learned));
    } else ops.push({ op: 'noevolve', ref: refOf(mon) });
  }
  return ops.length ? { type: evolution?.evolved ? 'evolve' : moves.length || evolution ? 'learn' : 'hatch', ops } : null;
}

export function evolveAction({ item = null, before = [] }, done) {
  const evolved = done.filter(d => d.result?.evolved);
  const ops = [...before, ...evolved.flatMap(({ mon, step, result }) => [{ op: 'evolve', ref: refOf(mon), species: result.into ?? step.into },
    ...(step.consumeHeld ? [{ op: 'hold', ref: refOf(mon), item: '' }] : []), ...(result.learned ?? []).map(l => learnOp(mon, l.move, l))])];
  if (item && evolved.length) ops.push({ op: 'item', item: toID(item), delta: -1, fromBag: true });
  if (!ops.length) return null;
  return item && evolved.length ? { type: 'use', item: toID(item), ops } : { type: evolved.length ? 'evolve' : 'order', ops };
}

export function rememberAction(mon, result) {
  return result?.learned ? { type: 'learn', ops: [learnOp(mon, result.move, result)] } : null;
}

export function petAction(mon, result) {
  const ops = result?.spent > 0 ? [{ op: 'amie', ref: refOf(mon), gains: [...result.gains] }] : [];
  for (const friend of result?.friends ?? []) {
    if (friend?.uid && friend.uid !== mon.uid && friend.gains?.length) ops.push({ op: 'amie', ref: { uid: friend.uid }, gains: [...friend.gains] });
  }
  for (const step of result?.done ?? []) {
    if (step.fed) ops.push({ op: 'feed', ref: refOf(mon), ...step.fed, ...(feedHeals(step.fed) ? {} : { heal: false }) });
    const won = (step.won ?? []).filter(id => parsePuff(id)?.grade !== FREE_GRADE);
    for (const id of new Set(won)) ops.push({ op: 'puff', puff: id, delta: won.filter(w => w === id).length });
  }
  const evolution = result?.evolution;
  if (evolution?.evolved) {
    ops.push({ op: 'evolve', ref: refOf(mon), species: evolution.into, decoration: mon.set.item }, { op: 'hold', ref: refOf(mon), item: '' },
      ...(evolution.learned ?? []).map(l => learnOp(mon, l.move, l)));
  }
  return ops.length ? { type: evolution?.evolved ? 'evolve' : 'amie', ops } : null;
}

export function trainAction(mon, result) {
  const bags = result?.bags ?? [], before = hungBagOf(mon), hung = result?.hung ?? null;
  const same = (before?.id ?? null) === (hung?.id ?? null) && (before?.hits ?? 0) === (hung?.hits ?? 0);
  if (!bags.length && (same || result?.hung === undefined)) return null;
  return { type: 'train', ops: [{ op: 'train', ref: refOf(mon), bags: [...bags], ...(same ? {} : { hung: hung && { id: hung.id, hits: hung.hits } }) }] };
}

export function spinInto(ctx, mon, spin) {
  const { mon: evolving, now } = evolutionCheck(ctx, mon);
  return spinEvolution(ctx.sim.Dex, evolving, spin, now);
}

export function teachAction(mon, item, move, result) {
  if (!result?.learned) return null;
  return { type: 'use', item: toID(item), ops: [learnOp(mon, move, result), { op: 'item', item: toID(item), delta: -1, fromBag: true }] };
}

const canRemember = (ctx, mon) => rememberableMoves(ctx, mon).length > 0;

const opt = (id, label, disabled = false, extra = {}) => ({ id, label, disabled: !!disabled, ...extra });

const row = lang => (id, word, disabled = false, values = {}) => opt(id, say(lang, `panel.menu.${word}`, values), disabled);

const debugRows = (debug, locked, lang) => (debug ? [row(lang)('debugEdit', 'debugEdit', locked)] : []);

export function partyMenu(mon, { state, ctx, locked = false, debug = false }, lang) {
  const r = row(lang);

  if (isEgg(mon)) return [r('order', 'order', locked || state.party.length < 2), r('deposit', 'deposit', locked), ...debugRows(debug, locked, lang), r('cancel', 'cancel')];
  const list = [r('summary', 'summary')];
  if (pendingCount(mon)) list.push(r('levelup', mon.pending.hatched ? 'hatch' : 'levelUp', locked, { n: levelBadge(mon) }));
  list.push(r('remember', 'remember', locked || !canRemember(ctx, mon)));
  list.push(r('order', 'order', locked || state.party.length < 2));
  list.push(r('give', 'give', locked || !holdableItems(state, ctx.sim).length));
  if (mon.set.item) list.push(r('take', 'take', locked));
  list.push(r('pet', 'pet', locked || !canPet(mon)));

  list.push(r('deposit', 'deposit', locked || hatchedParty(state).length <= 1));
  list.push(...debugRows(debug, locked, lang), r('cancel', 'cancel'));
  return list;
}

export function boxMenu(mon, { locked = false, debug = false }, lang) {
  const r = row(lang);

  if (isEgg(mon)) return [r('withdraw', 'withdraw', locked), ...debugRows(debug, locked, lang), r('cancel', 'cancel')];
  return [r('withdraw', 'withdraw', locked), r('summary', 'summary'), r('release', 'release', locked), ...debugRows(debug, locked, lang), r('cancel', 'cancel')];
}

export function bagMenu(id, { locked = false, sim, state, trade }, lang) {
  const kind = itemKind(id, sim, trade);
  if (NOT_TOSSABLE.has(kind)) return null;
  const r = row(lang);
  const list = [];
  if (USABLE.has(kind)) list.push(r('use', 'use', locked || !state.party.length));
  if (!NOT_HOLDABLE.has(kind)) list.push(r('give', 'hold', locked || !state.party.length));
  list.push(r('toss', 'toss', locked));
  list.push(r('cancel', 'cancel'));
  return list;
}

export const boxCount = state => Math.max(BOX_COUNT, Math.ceil((state.box?.length ?? 0) / BOX_SIZE));

export const boxName = (state, index, lang) => state.boxNames?.[index] || boxLabel(index + 1, lang);

function expRatio(ctx, mon) {
  const { sim, exp } = ctx;
  const growth = growthOf(exp, sim.Dex.species.get(mon.set.species));
  if (!growth) return null;
  const level = mon.set.level;
  if (level >= MAX_LEVEL) return 1;
  const low = expForLevel(growth, level), high = expForLevel(growth, level + 1);
  return Math.max(0, Math.min(1, ((mon.exp ?? low) - low) / (high - low)));
}

export function slotView(mon, ctx, state, lang) {
  const { sim } = ctx;

  if (isEgg(mon)) {
    return { uid: mon.uid, egg: true, name: say(lang, 'panel.egg'), speciesId: EGG_SPRITE, spriteId: EGG_SPRITE, shiny: false, gender: '', level: null, hp: 0, maxhp: 0,
      hpClass: 'high', status: '', fainted: false, exp: null, item: '', badge: 0, pet: false, enjoy: 0, held: null };
  }
  const names = namesFor(lang, sim);
  const species = sim.Dex.species.get(heldItemForm(sim.Dex, mon.set).species);
  const max = maxHp(sim, mon.set, stateFormat(state));
  const hp = mon.hp === null || mon.hp === undefined ? max : Math.max(0, mon.hp);
  const ratio = max ? hp / max : 0;
  return {
    uid: mon.uid, name: monName(mon, sim, names), speciesId: species.id, spriteId: spriteIdOf(species) || species.id, shiny: !!mon.set.shiny,
    gender: mon.set.gender || '', level: mon.set.level, hp, maxhp: max, hpClass: ratio > 0.5 ? 'high' : ratio > 0.2 ? 'mid' : 'low',
    status: hp === 0 ? '' : mon.status && mon.status !== 'fnt' ? mon.status : '', fainted: hp === 0,
    exp: expRatio(ctx, mon), item: mon.set.item || '', badge: levelBadge(mon), pet: canPet(mon), enjoy: enjoymentOf(mon),
    held: mon.set.item ? { name: itemLabel(state, mon.set.item, names), emoji: customInfo(state, mon.set.item)?.emoji ?? '' } : null,
  };
}

const BAG_FRAMES = new Map(bagIcons.items.textures[0].frames.map(f => [f.filename, f]));
export function itemIcon(id, sim) {
  const key = toID(id);
  const move = tmMove(key);
  const frame = BAG_FRAMES.get(move ? `tm_${toID(sim.Dex.moves.get(move).type)}` : key);
  if (frame) return { sheet: 'pokerogue', x: frame.frame.x, y: frame.frame.y, w: frame.frame.w, h: frame.frame.h, ox: frame.spriteSourceSize.x, oy: frame.spriteSourceSize.y };
  const item = sim.Dex.items.get(key);
  return item?.exists && Number.isInteger(item.spritenum) ? { sheet: 'showdown', num: item.spritenum } : null;
}

const GROUPS = ['medicine', 'ball', 'battle', 'train', 'tm', 'evolve', 'other', 'treasure', 'field', 'key'];
const GROUP_OF = { candy: 'train', stone: 'evolve', held: 'other', custom: 'other' };
const ORDER = [...Object.keys(BAG_ITEMS), ...Object.keys(BALLS), 'rarecandy', ...Object.keys(OUTSIDE_ITEMS)];
export function bagView(state, sim, lang, trade) {
  const names = namesFor(lang, sim);
  const rank = id => (ORDER.includes(id) ? ORDER.indexOf(id) : ORDER.length);
  const rows = Object.entries(state.bag ?? {}).filter(([, n]) => n > 0).map(([id, count]) => {
    const kind = itemKind(id, sim, trade);

    return { id, count, name: itemLabel(state, id, names, { bag: true }), kind, icon: kind === 'custom' ? { emoji: customInfo(state, id)?.emoji ?? '' } : itemIcon(id, sim),
      group: GROUP_OF[kind] ?? kind };
  }).sort((a, b) => rank(a.id) - rank(b.id) || (a.kind === 'tm' && b.kind === 'tm' ? a.id.localeCompare(b.id) : a.name.localeCompare(b.name, lang)));
  return GROUPS.map(group => ({ group, label: say(lang, `panel.group.${group}`), items: rows.filter(r => r.group === group) })).filter(g => g.items.length);
}

export function puffFood(id, lang) {
  const { flavor, grade } = parsePuff(id);
  return { key: `puff:${id}`, fed: { puff: id }, name: say(lang, `amie.puff.${grade}`, { flavor: say(lang, `amie.flavor.${flavor}`) }), icon: null,
    count: grade === FREE_GRADE ? null : 1, friendship: puffFriendship(grade), grade, flavor };
}

export function foodList(state, sim, lang) {
  const free = PUFF_FLAVORS.map(flavor => puffFood(puffId(flavor, FREE_GRADE), lang));
  const prizes = PUFF_GRADES.filter(g => g !== FREE_GRADE).flatMap(grade => PUFF_FLAVORS.map(f => puffId(f, grade)).filter(id => puffCount(state, id))
    .map(id => ({ ...puffFood(id, lang), count: puffCount(state, id) })));
  const items = bagView(state, sim, lang).flatMap(g => g.items).flatMap(row => {
    const friendship = foodFriendship(row.id, sim, state);
    return friendship ? [{ key: `item:${row.id}`, fed: { item: row.id }, name: row.name, icon: row.icon, count: row.count, friendship }] : [];
  });
  return [...free, ...prizes, ...items];
}

export function panelModel({ state, ctx, lang, locked = false, resume = false, debug = false, offer = null, travel = null, ui, screen = null, money = state.money === null ? null : state.money ?? 0 }) {
  const { sim } = ctx;
  const party = Array.from({ length: PARTY_MAX }, (_, i) => (state.party[i] ? slotView(state.party[i], ctx, state, lang) : null));
  const count = boxCount(state);
  const index = Math.max(0, Math.min(count - 1, ui.box ?? 0));
  const cells = Array.from({ length: BOX_SIZE }, (_, i) => {
    const mon = state.box[index * BOX_SIZE + i];
    return mon ? slotView(mon, ctx, state, lang) : null;
  });
  const tabs = travel ? [...TABS, TRAVEL_TAB] : TABS;
  return {
    lang, open: !!ui.open, tab: tabs.includes(ui.tab) ? ui.tab : 'party', tabs, travel, locked, resume: !!resume, screen,
    alerts: { party: state.party.some(m => pendingCount(m) > 0), box: false, bag: false },
    party, box: { index, count, name: boxName(state, index, lang), cells },
    bag: { money, groups: bagView(state, sim, lang, ctx.tradeEvolution) },
    add: debug ? addable(state, locked) : null, debug: !!debug,
    heal: debug ? !locked : null,
    rest: restView(state, sim, locked),
    offer: offer && !locked ? { note: !!offer.note, button: !!offer.button } : null,
    breeding: breedingView(state, ctx, lang),

    breedPick: ui.select?.mode === 'breed', breedable: !locked && hatchedParty(state).length >= 2,

    breedPill: (!locked && hatchedParty(state).length >= 2) || !!state.breeding,
    pairShown: !ui.pairHidden || ui.select?.mode === 'breed',
    badges: badgeCaseModel(state, lang, { gym: ui.gym, debug, locked, icon: id => itemIcon(id, sim), monLabel: mon => displayName(sim.Dex, namesFor(lang, sim), mon.species, mon.name) }),
    picked: ui.ask?.uid ?? ui.menu?.uid ?? ui.select?.uid ?? ui.menu?.item ?? ui.select?.item ?? ui.count?.item ?? null,

    window: (screen && !ui.message ? screen.window : null) ?? windowOf(ui, lang, sim),
  };
}

const addable = (state, locked) => ({ party: !locked && state.party.length < PARTY_MAX, box: !locked, bag: !locked });

function healChanges(state, ctx) {
  const { sim } = ctx, format = stateFormat(state);
  const look = mon => JSON.stringify([mon.hp ?? maxHp(sim, mon.set, format), mon.status || '', mon.set.moves.map(m => movePp(sim, mon, m, format).pp)]);
  const healed = clone(state);
  healParty(healed, ctx);
  return state.party.some((mon, i) => look(mon) !== look(healed.party[i]));
}

function windowOf(ui, lang, sim) {
  const t = key => say(lang, key);
  const cancel = { hit: { t: 'opt', id: 'cancel' }, label: t('panel.menu.cancel') };
  if (ui.ask) return { text: ui.ask.text, options: [{ hit: { t: 'yes' }, label: t('panel.yes') }, { hit: { t: 'no' }, label: t('panel.no') }] };
  if (ui.moves) {
        // PP restore greys out full moves, PP Up greys out moves that cannot be raised (useCheck's disabled)
    const names = namesFor(lang, sim);
    return { text: ui.moves.prompt ?? selectMove(lang), options: [...ui.moves.list.map(m => ({ hit: { t: 'move', move: m.id }, label: `${names.move(m.id)} ${m.pp}/${m.maxpp}`, disabled: !!m.disabled })),
      cancel] };
  }
  if (ui.stats) {

    return { text: t('panel.pickStat'), options: [...ui.stats.list.map(s => ({ hit: { t: 'stat', stat: s.id }, label: `${statName(s.id, lang)} ${s.iv}`, disabled: s.iv >= MAX_IV })),
      cancel] };
  }
  if (ui.count) {
    return { text: ui.count.text, count: { n: ui.count.n, max: ui.count.max },
      options: [{ hit: { t: 'toss' }, label: t('panel.menu.toss') }, cancel] };
  }
  if (ui.menu) return { text: ui.menu.text, options: ui.menu.options.map(o => ({ hit: { t: 'opt', id: o.id, ...(o.item ? { item: o.item } : {}) }, label: o.label, disabled: o.disabled })) };
  if (ui.message) return { text: ui.message.text, error: !!ui.message.error, options: [{ hit: { t: 'msg' }, label: t('panel.ok') }] };
  if (ui.select) return { text: ui.select.text, options: [cancel] };
  return null;
}

export const initialUi = () => ({ open: false, tab: 'party', box: 0, menu: null, select: null, ask: null, moves: null, stats: null, count: null, message: null, gym: null, screen: null, pairHidden: false });

const calm = ui => ({ ...ui, menu: null, select: null, ask: null, moves: null, stats: null, count: null, message: null, gym: null });
const findIn = (list, uid) => list.find(m => m.uid === uid) ?? null;

const fold = ui => ({ ui: { ...ui, open: false }, effect: null });

export function backStep(ui) {
  if (!ui.open) return null;
  if (ui.message) return { t: 'msg' };
  if (ui.ask) return { t: 'no' };
  if (ui.moves || ui.stats || ui.count || ui.menu || ui.select) return { t: 'opt', id: 'cancel' };
  if (ui.gym) return { t: 'gymClose' };
  if (ui.screen) return { t: 'scBack' };
  return { t: 'fold' };
}

export function menuCloses(ui, hit) {
  const menu = ui.menu;
  if (!menu || ui.select || ui.ask || ui.screen || ui.moves || ui.stats || ui.count || ui.message) return false;
  switch (hit?.t) {
    case 'blank': return true;
    case 'opt': return hit.id === 'cancel';
    case 'item': return menu.where === 'bag' && menu.item === hit.item;
    case 'slot': return !!menu.uid && menu.uid === hit.uid && (hit.where === 'box' ? menu.where === 'box' : ['party', 'give'].includes(menu.where));
    default: return false;
  }
}

const breedPick = (uid, w) => ({ mode: 'breed', uid, text: w.t('panel.breed.pick', { n: uid ? 1 : 0 }) });

export function reduce(ui, hit, { state, ctx, lang, locked = false, debug = false, place = DEFAULT_SCREEN_PLACE }) {
  if (hit?.t === 'back') {
    const step = backStep(ui);
    return step ? reduce(ui, step, { state, ctx, lang, locked, debug, place }) : { ui, effect: null };
  }
  const env = { state, ctx, locked, debug, panel: place === 'panel', w: wordsOf(lang, ctx.sim, state) };
  const out = hit?.t?.startsWith('gym') ? badgePress(ui, hit, { state, lang, debug, locked })
    : hit?.t?.startsWith('sc') ? screenPress(ui, hit, env) : reduceRaw(ui, hit, env);

  if (locked && out.effect && !LOCK_FREE_EFFECTS.has(out.effect.kind)) return { ui: out.ui, effect: null };
  return out;
}

const LOCK_FREE_EFFECTS = new Set(['summary', 'rename', 'renameBox', 'resume']);

function wordsOf(lang, sim, state) {
  const names = namesFor(lang, sim);
  return {
    lang, names, t: (key, values) => say(lang, key, values), p: (word, pair) => withParticle(lang, word, pair),
    mon: mon => monName(mon, sim, names), label: id => itemLabel(state, id, names),
  };
}

function reduceRaw(ui, hit, env) {
  const { state, ctx, locked, debug, panel, w } = env;
  const { sim } = ctx;
  const same = { ui, effect: null };
  const party = state.party, box = state.box;
  if (menuCloses(ui, hit)) return { ui: { ...ui, menu: null }, effect: null };
  switch (hit?.t) {
    case 'tab':

      if (ui.open && ui.tab === hit.tab) return ui.screen ? { ui: { ...calm(ui), screen: null }, effect: null } : fold(ui);

      if (ui.tab === hit.tab) return { ui: { ...ui, open: true }, effect: null };
      return { ui: { ...calm(ui), open: true, tab: hit.tab, screen: null }, effect: null };
    case 'fold': return fold(ui);
    case 'lvnext': {
      const mon = findIn(party, hit.uid);
      return mon && !locked ? levelUpNext(ui, mon) : same;
    }
    case 'resume': return { ui: { ...calm(ui), open: false }, effect: { kind: 'resume' } };
    case 'msg': return { ui: { ...ui, message: null }, effect: null };
    case 'no': return { ui: { ...ui, ask: null }, effect: null };
    case 'boxnav': {
      const count = boxCount(state);
      return { ui: { ...calm(ui), box: ((ui.box ?? 0) + hit.d + count) % count }, effect: null };
    }
    case 'boxname':
      return { ui: calm(ui), effect: { kind: 'renameBox', box: Math.max(0, Math.min(boxCount(state) - 1, ui.box ?? 0)) } };
    case 'badge': {
      const mon = findIn(party, hit.uid);
      if (locked || !mon || !pendingCount(mon)) return same;
      return panel ? levelUpNext(calm(ui), mon) : { ui: calm(ui), effect: { kind: 'levelup', uid: mon.uid } };
    }
    case 'yes': {
      const ask = ui.ask;
      if (!ask) return same;
      const mon = findIn(box, ask.uid) ?? findIn(party, ask.uid);
      if (!mon) return { ui: { ...ui, ask: null }, effect: null };

      if (ask.kind === 'use') return { ui: calm(ui), effect: useEffect(mon, ask.item, ctx, w) };
      if (ask.kind !== 'release') return { ui: { ...ui, ask: null }, effect: null };
      return { ui: { ...ui, ask: null }, effect: { kind: 'queue', action: actions.release(mon), after: w.t('panel.bye', { mon: w.mon(mon) }) } };
    }
    case 'stat': {
      const pick = ui.stats;
      const mon = pick && findIn(party, pick.uid);
      if (!mon) return { ui: { ...ui, stats: null }, effect: null };
      const stat = pick.list.find(s => s.id === hit.stat);
      if (!stat || stat.iv >= MAX_IV) return same;
      return { ui: calm(ui), effect: useEffect(mon, pick.item, ctx, w, { stat: stat.id }) };
    }
    case 'move': {
      const pick = ui.moves;
      const mon = pick && findIn(party, pick.uid);
      if (!mon) return { ui: { ...ui, moves: null }, effect: null };
      const move = pick.list.find(m => m.id === hit.move);
      if (!move || move.disabled) return same;
      return { ui: calm(ui), effect: useEffect(mon, pick.item, ctx, w, { move: move.id }) };
    }
    case 'add': {
      if (!debug || !addable(state, locked)[hit.where]) return same;
      return { ui: calm(ui), effect: { kind: 'debugAdd', where: hit.where } };
    }
    case 'offer': return locked ? same : { ui: calm(ui), effect: { kind: 'quickImport', asked: !!hit.asked } };
    case 'pet': {
      const mon = findIn(party, hit.uid);
      if (locked || !mon || !canPet(mon)) return same;
      return { ui: calm(ui), effect: { kind: 'pet', uid: mon.uid } };
    }

    case 'breed': {

      if (state.breeding && ui.select?.mode !== 'breed') return { ui: { ...calm(ui), pairHidden: !ui.pairHidden }, effect: null };
      if (locked || hatchedParty(state).length < 2) return same;
      if (ui.select?.mode === 'breed') return { ui: calm(ui), effect: null };
      return { ui: { ...calm(ui), pairHidden: false, select: breedPick(null, w) }, effect: null };
    }
    case 'rebreed': return locked || !state.breeding || hatchedParty(state).length < 2 ? same : { ui: { ...calm(ui), pairHidden: false, select: breedPick(null, w) }, effect: null };
    case 'unbreed': return locked || !state.breeding ? same : { ui: { ...calm(ui), pairHidden: false }, effect: { kind: 'queue', action: actions.unbreed() } };
    case 'later': return locked ? same : { ui: calm(ui), effect: { kind: 'importLater' } };
    case 'botSet': return locked ? same : { ui: calm(ui), effect: { kind: 'botTravel', change: { key: hit.key, on: !!hit.on } } };
    case 'guideClear': return locked ? same : { ui: calm(ui), effect: { kind: 'botTravel', change: { clear: 'guide' } } };

    case 'rest': {
      const { why } = restView(state, sim, locked);
      if (why === 'none') return same;
      if (why) return { ui: { ...calm(ui), message: { text: why === 'full' ? noEffect(w.lang) : w.t('panel.rest.battle') } }, effect: null };
      return { ui: calm(ui), effect: { kind: 'queue', action: actions.rest() } };
    }
    case 'heal': {
      if (!debug || locked) return same;
      if (!healChanges(state, ctx)) return { ui: { ...calm(ui), message: { text: noEffect(w.lang) } }, effect: null };
      return { ui: calm(ui), effect: { kind: 'debugHeal', after: w.t('diary.healAll') } };
    }
    case 'count': {
      const pick = ui.count;
      if (!pick) return same;
      return { ui: { ...ui, count: { ...pick, n: (((pick.n - 1 + hit.d) % pick.max) + pick.max) % pick.max + 1 } }, effect: null };
    }
    case 'toss': {
      const pick = ui.count;
      const owned = pick ? state.bag?.[pick.item] ?? 0 : 0;
      if (!owned) return { ui: calm(ui), effect: null };
      const n = Math.min(pick.n, owned);
      return { ui: calm(ui), effect: { kind: 'queue', action: actions.toss(pick.item, n), after: w.t('panel.tossed', { item: w.p(w.label(pick.item), '을/를'), n }) } };
    }
    case 'item': {
      const menu = bagMenu(hit.item, { locked, sim, state, trade: ctx.tradeEvolution }, w.lang);
      const text = bagText(state, hit.item, sim, w.lang);
      if (!menu) return { ui: { ...calm(ui), message: { text } }, effect: null };
      return { ui: { ...calm(ui), menu: { where: 'bag', item: hit.item, text, options: menu } }, effect: null };
    }
    case 'slot': return slotPress(ui, hit, env);
    case 'opt': return optionPress(ui, hit, env);
    default: return same;
  }
}

function useEffect(mon, item, ctx, w, options = {}) {
  const id = toID(item), outside = OUTSIDE_ITEMS[id] ?? {};

  const levels = itemKind(id, ctx.sim) === 'candy' || !!outside.exp;
  return { kind: 'queue', action: actions.use(mon, id, ctx, options), after: useAfter(mon, id, ctx, w, options), followLevelUp: levels ? mon.uid : undefined };
}

function useAfter(mon, id, { sim }, w, { stat, move } = {}) {
  const { t, p, lang } = w;
  const outside = OUTSIDE_ITEMS[id] ?? {}, who = mon ? w.mon(mon) : '';
  if (outside.all) return t('panel.usedAll');
  if (outside.vitamin) return t('panel.usedVitamin', { mon: who, stat: statName(outside.vitamin, lang) });
  if (outside.evBerry && (mon.set.evs?.[outside.evBerry] ?? 0) > 0) return t('panel.usedEvBerry', { mon: who, stat: statName(outside.evBerry, lang) });
  if (outside.exp) return t('panel.usedExp', { mon: p(who, '은/는'), n: outside.exp.toLocaleString(lang) });
  if (outside.ability) return t('panel.usedAbility', { mon: who, ability: p(w.names.ability(abilityChange(sim, mon, id)), '으로/로') });
  if (outside.mint) return t('panel.usedMint', { mon: who, nature: natureName(outside.mint, lang) });
  if (outside.hyper) return t('panel.usedHyper', { mon: p(who, '은/는'), stats: outside.hyper === 'all' ? t('diary.allStats') : statName(stat, lang) });
    // Same text for PP Max
  if (outside.ppUp) return t('panel.usedPpUp', { move: w.names.move(move) });
  return t('panel.used', { mon: who, item: p(itemName(id, w.names), '을/를') });
}

const EGG_LOOKS = [[40, 'long'], [10, 'far'], [5, 'near'], [0, 'soon']];

function eggText(mon, w, debug) {
  const look = EGG_LOOKS.find(([above]) => mon.egg.cycles > above)?.[1] ?? 'soon';
  return `${w.t(`panel.egg.${look}`)}${debug ? `\n${w.t('panel.eggLeft', { n: Math.ceil(mon.egg.cycles) })}` : ''}`;
}

function slotPress(ui, hit, { state, ctx, locked, debug, panel, w }) {
  const { sim } = ctx;
  const { t, p } = w;
  if (hit.where === 'box') {
    const mon = findIn(state.box, hit.uid);
    if (!mon) return { ui, effect: null };
    const text = isEgg(mon) ? eggText(mon, w, debug) : t('panel.boxAsk', { mon: p(w.mon(mon), '을/를') });
    return { ui: { ...calm(ui), menu: { where: 'box', uid: mon.uid, text, options: boxMenu(mon, { locked, debug }, w.lang) } }, effect: null };
  }
  const mon = findIn(state.party, hit.uid);
  if (!mon) return { ui, effect: null };
  const select = ui.select;
  if (select) {
    if (locked) return { ui: calm(ui), effect: null };

    if (isEgg(mon) && ['give', 'use'].includes(select.mode)) return { ui: { ...ui, message: { text: t('panel.eggNo') } }, effect: null };
    switch (select.mode) {
      case 'breed': {

        if (isEgg(mon)) return { ui, effect: null };
        const first = select.uid && findIn(state.party, select.uid);
        if (!first || first.uid === mon.uid) return { ui: { ...ui, select: breedPick(first ? null : mon.uid, w) }, effect: null };
        if ([first.uid, mon.uid].every(uid => state.breeding?.includes(uid))) return { ui: calm(ui), effect: null };
        return { ui: calm(ui), effect: { kind: 'queue', action: actions.breed(first, mon) } };
      }
      case 'order': {
        const from = findIn(state.party, select.uid);
        if (!from || from.uid === mon.uid) return { ui: calm(ui), effect: null };

        const evolutions = swapEvolutions(ctx, from, mon);
        if (evolutions) return { ui: calm(ui), effect: { kind: 'evolve', evolutions, before: actions.order(from, mon).ops } };
        return { ui: calm(ui), effect: { kind: 'queue', action: actions.order(from, mon) } };
      }
      case 'swapin': {
        const incoming = findIn(state.box, select.uid);
        if (!incoming) return { ui: calm(ui), effect: null };
        return { ui: { ...calm(ui), tab: 'box' }, effect: { kind: 'queue', action: actions.swapIn(incoming, mon) } };
      }
      case 'give': {
        if (!(state.bag?.[select.item] > 0)) return { ui: calm(ui), effect: null };
        return { ui: calm(ui), effect: { kind: 'queue', action: actions.give(mon, select.item), after: t('panel.gave', { mon: w.mon(mon), item: p(w.label(select.item), '을/를') }) } };
      }
      case 'use': {
        if (!(state.bag?.[select.item] > 0)) return { ui: calm(ui), effect: null };
        const check = useCheck(mon, select.item, ctx, w.lang, state.party, stateFormat(state));

        if (!check.ok) return { ui: { ...ui, message: { text: check.reason } }, effect: null };
        if (check.evolutions) return { ui: calm(ui), effect: { kind: 'evolve', item: select.item, evolutions: check.evolutions } };
        if (check.teach) return panel ? learnOpen(calm(ui), mon, check.teach, { kind: 'tm', item: select.item })
          : { ui: calm(ui), effect: { kind: 'teachTm', uid: mon.uid, item: select.item, move: check.teach } };
        if (check.moves) return { ui: { ...calm(ui), moves: { uid: mon.uid, item: select.item, list: check.moves, prompt: check.prompt } }, effect: null };
        if (check.stats) return { ui: { ...calm(ui), stats: { uid: mon.uid, item: select.item, list: check.stats } }, effect: null };
        if (check.confirm) return { ui: { ...calm(ui), ask: { kind: 'use', uid: mon.uid, item: select.item, text: check.confirm } }, effect: null };
        return { ui: calm(ui), effect: useEffect(mon, select.item, ctx, w) };
      }
      default: return { ui: calm(ui), effect: null };
    }
  }
  const text = isEgg(mon) ? eggText(mon, w, debug) : t('panel.partyAsk');
  return { ui: { ...calm(ui), menu: { where: 'party', uid: mon.uid, text, options: partyMenu(mon, { state, ctx, locked, debug }, w.lang) } }, effect: null };
}

function optionPress(ui, hit, { state, ctx, panel, w }) {
  const { sim } = ctx;
  const { t, p } = w;
  if (hit.id === 'cancel') {

    return { ui: { ...calm(ui), tab: ui.select?.mode === 'swapin' ? 'box' : ui.tab }, effect: null };
  }
  const menu = ui.menu;
  if (!menu) return { ui, effect: null };
  const chosen = menu.options.find(o => o.id === hit.id && (o.item ?? null) === (hit.item ?? null));
  if (!chosen || chosen.disabled) return { ui, effect: null };
  if (hit.id === 'debugEdit') return { ui: calm(ui), effect: { kind: 'debugEdit', uid: menu.uid } };
  if (menu.where === 'party') {
    const mon = findIn(state.party, menu.uid);
    if (!mon) return { ui: calm(ui), effect: null };
    switch (hit.id) {
      case 'summary': return panel ? { ui: { ...calm(ui), screen: summaryScreen(mon, 'party') }, effect: null } : { ui: calm(ui), effect: { kind: 'summary', uid: mon.uid } };
      case 'pet': return { ui: calm(ui), effect: { kind: 'pet', uid: mon.uid } };
      case 'levelup': return panel ? levelUpNext(calm(ui), mon) : { ui: calm(ui), effect: { kind: 'levelup', uid: mon.uid } };
      case 'remember': return panel ? { ui: { ...calm(ui), screen: rememberScreen(mon) }, effect: null } : { ui: calm(ui), effect: { kind: 'remember', uid: mon.uid } };
      case 'order': return { ui: { ...calm(ui), select: { mode: 'order', uid: mon.uid, text: t('panel.orderAsk') } }, effect: null };
      case 'give': {
        const options = [...holdableItems(state, sim).map(id => opt('pick', `${w.label(id)} ×${state.bag[id]}`, false, { item: id })), opt('cancel', t('panel.menu.cancel'))];
        return { ui: { ...calm(ui), menu: { where: 'give', uid: mon.uid, text: t('panel.giveAsk', { mon: w.mon(mon) }), options } }, effect: null };
      }
      case 'take': return { ui: calm(ui), effect: { kind: 'queue', action: actions.take(mon), after: t('panel.took', { mon: w.mon(mon), item: p(w.label(mon.set.item), '을/를') }) } };
      case 'deposit': return { ui: calm(ui), effect: { kind: 'queue', action: actions.deposit(mon), after: t('panel.deposited', { mon: p(w.mon(mon), '을/를') }) } };
      default: return { ui: calm(ui), effect: null };
    }
  }
  if (menu.where === 'give') {
    const mon = findIn(state.party, menu.uid);
    if (!mon || hit.id !== 'pick') return { ui: calm(ui), effect: null };
    return { ui: calm(ui), effect: { kind: 'queue', action: actions.give(mon, hit.item), after: t('panel.gave', { mon: w.mon(mon), item: p(w.label(hit.item), '을/를') }) } };
  }
  if (menu.where === 'box') {
    const mon = findIn(state.box, menu.uid);
    if (!mon) return { ui: calm(ui), effect: null };
    switch (hit.id) {
      case 'summary': return panel ? { ui: { ...calm(ui), screen: summaryScreen(mon, 'box') }, effect: null } : { ui: calm(ui), effect: { kind: 'summary', uid: mon.uid } };
      case 'withdraw':
        if (state.party.length < PARTY_MAX) return { ui: calm(ui), effect: { kind: 'queue', action: actions.withdraw(mon), after: t('panel.withdrew', { mon: p(w.mon(mon), '을/를') }) } };

        return { ui: { ...calm(ui), tab: 'party', select: { mode: 'swapin', uid: mon.uid, text: t('panel.swapAsk', { mon: p(w.mon(mon), '과/와') }) } }, effect: null };
      case 'release': return { ui: { ...calm(ui), ask: { kind: 'release', uid: mon.uid, text: t('panel.releaseAsk', { mon: p(w.mon(mon), '을/를') }) } }, effect: null };
      default: return { ui: calm(ui), effect: null };
    }
  }
  if (menu.where === 'bag') {
    const item = menu.item;
    if (hit.id === 'use' && partyWide(item)) {

      if (!state.party.some(m => m.hp === 0)) return { ui: { ...calm(ui), message: { text: noEffect(w.lang) } }, effect: null };
      return { ui: calm(ui), effect: { kind: 'queue', action: { type: 'use', item: toID(item), ops: useOps(null, item, ctx) }, after: useAfter(null, toID(item), ctx, w) } };
    }
    if (hit.id === 'use') return { ui: { ...calm(ui), tab: 'party', select: { mode: 'use', item, text: t('panel.useAsk', { item: p(itemName(item, w.names), '을/를') }) } }, effect: null };
    if (hit.id === 'give') return { ui: { ...calm(ui), tab: 'party', select: { mode: 'give', item, text: t('panel.holdAsk', { item: p(w.label(item), '을/를') }) } }, effect: null };
    if (hit.id === 'toss') {
      const max = state.bag?.[item] ?? 0;
      if (!max) return { ui: calm(ui), effect: null };
      return { ui: { ...calm(ui), count: { item, n: 1, max, text: t('panel.tossAsk', { item: p(w.label(item), '을/를') }) } }, effect: null };
    }
  }
  return { ui: calm(ui), effect: null };
}

export const SUMMARY_PAGES = Object.freeze(['profile', 'stats', 'moves']);
export const STAT_MODES = Object.freeze(['stats', 'ivs', 'evs']);
export const statModes = ctx => STAT_MODES.filter(mode => mode !== 'evs' || effortOn(ctx.sim, ruleFormat(ctx.rule)));

export const summaryScreen = (mon, where) => ({ kind: 'summary', uid: mon.uid, where, page: SUMMARY_PAGES[0], stat: STAT_MODES[0], move: 0 });
export const rememberScreen = mon => ({ kind: 'remember', uid: mon.uid, move: 0 });

export const screenTab = screen => (screen?.kind === 'summary' && screen.where === 'box' ? 'box' : 'party');

export const ASKING = new Set(['ask', 'pick', 'giveup']);

export function liveScreen(screen, { state, ctx, locked = false }) {
  if (!screen) return null;
  const party = findIn(state.party, screen.uid), mon = party ?? findIn(state.box, screen.uid);
  if (!mon || isEgg(mon)) return null;
  if (screen.kind === 'summary') return screen;
  if (locked || !party) return null;
  if (screen.kind === 'remember') return canRemember(ctx, mon) ? screen : null;
  if (screen.kind !== 'learn' || !ASKING.has(screen.step)) return screen;
  if (screen.source.kind === 'levelup') return mon.pending?.moves?.includes(screen.move) ? screen : null;
  if (mon.set.moves.includes(screen.move)) return null;
  return screen.source.kind !== 'tm' || state.bag?.[screen.source.item] > 0 ? screen : null;
}

function learnAction(mon, move, source, result) {
  if (source.kind === 'remember') return rememberAction(mon, { move, ...result });
  if (source.kind === 'tm') return teachAction(mon, source.item, move, result);
  return levelUpAction(mon, { moves: [{ move, result }] });
}

const decide = (ui, mon, screen, result) => {
  const action = learnAction(mon, screen.move, screen.source, result);
  return action ? { ui, effect: { kind: 'queue', action, screen } } : { ui: { ...ui, screen }, effect: null };
};

export function learnOpen(ui, mon, move, source) {
  const screen = { kind: 'learn', uid: mon.uid, move, source, step: 'ask', show: 0 };
  const open = { ...ui, open: true, tab: 'party' };
  if (mon.set.moves.includes(move)) {
    const action = source.kind === 'levelup' ? learnAction(mon, move, source, { learned: false }) : null;
    return { ui: { ...open, screen: null }, effect: action && { kind: 'queue', action, followLevelUp: mon.uid } };
  }
  if (mon.set.moves.length < MAX_MOVES) return decide(open, mon, { ...screen, step: 'learned' }, { learned: true });
  return { ui: { ...open, screen }, effect: null };
}

export function levelUpNext(ui, mon) {
  const plan = levelUpPlan(mon);
  if (plan.hatch || (!plan.moves.length && plan.evolve)) return { ui: { ...ui, screen: null }, effect: { kind: 'levelup', uid: mon.uid } };
  if (plan.moves.length) return learnOpen(ui, mon, plan.moves[0], { kind: 'levelup' });
  return { ui: { ...ui, screen: null }, effect: null };
}

function screenPress(ui, hit, { state, ctx }) {
  const screen = ui.screen;
  const same = { ui, effect: null };
  if (!screen) return same;
  const mon = findIn(state.party, screen.uid) ?? findIn(state.box, screen.uid);
  if (!mon) return { ui: { ...ui, screen: null }, effect: null };
  const set = patch => ({ ui: { ...ui, screen: { ...screen, ...patch } }, effect: null });
  if (hit.t === 'scRename') return screen.kind === 'summary' ? { ui, effect: { kind: 'rename', uid: mon.uid } } : same;

  if (hit.t === 'scBack') {
    if (screen.kind === 'learn' && screen.source.kind === 'remember') {
      const at = rememberableMoves(ctx, mon).findIndex(m => m.move === screen.move);
      return { ui: { ...calm(ui), screen: { ...rememberScreen(mon), move: Math.max(0, at) } }, effect: null };
    }
    return { ui: { ...calm(ui), screen: null }, effect: null };
  }
  if (screen.kind === 'summary') {
    if (hit.t === 'scPage' && SUMMARY_PAGES.includes(hit.page)) return set({ page: hit.page });
    if (hit.t === 'scStat' && statModes(ctx).includes(hit.mode)) return set({ stat: hit.mode });
    if (hit.t === 'scMove' && mon.set.moves[hit.i]) return set({ move: hit.i });
    if (hit.t === 'scNav') {
      const list = hatchedParty(state), at = list.findIndex(m => m.uid === mon.uid);
      if (at < 0 || list.length < 2) return same;
      return set({ uid: list[(at + hit.d + list.length) % list.length].uid, move: 0 });
    }

    if (hit.t === 'scMon') {
      const list = hatchedParty(state);
      return list.some(m => m.uid === mon.uid) && list.some(m => m.uid === hit.uid) && hit.uid !== mon.uid ? set({ uid: hit.uid, move: 0 }) : same;
    }
    return same;
  }
  if (screen.kind === 'remember') {
    const list = rememberableMoves(ctx, mon);
    if (hit.t === 'scMove' && list[hit.i]) return set({ move: hit.i });
    if (hit.t === 'scRemember' && list[screen.move]) return learnOpen(ui, mon, list[screen.move].move, { kind: 'remember' });
    return same;
  }

  switch (`${screen.step} ${hit.t}`) {
    case 'ask scYes': return set({ step: 'pick', show: 0 });
    case 'ask scNo': case 'pick scNo': return set({ step: 'giveup' });
    case 'giveup scNo': return set({ step: 'ask' });
    case 'giveup scYes': return decide(ui, mon, { ...screen, step: 'skipped' }, { learned: false });
    case 'pick scForget': {
      const forgot = mon.set.moves[screen.show - 1];
      return forgot ? decide(ui, mon, { ...screen, step: 'done', forgot }, { learned: true, forgot }) : same;
    }
    case 'done scOk': case 'learned scOk': case 'skipped scOk': {
      if (screen.source.kind === 'levelup') return levelUpNext(ui, mon);

      if (screen.source.kind === 'remember' && screen.step === 'skipped') {
        const at = rememberableMoves(ctx, mon).findIndex(m => m.move === screen.move);
        return { ui: { ...ui, screen: { ...rememberScreen(mon), move: Math.max(0, at) } }, effect: null };
      }
      return { ui: { ...ui, screen: null }, effect: null };
    }
    default:

      if (hit.t === 'scMove' && Number.isInteger(hit.i) && hit.i >= 0 && hit.i <= mon.set.moves.length) return set({ show: hit.i });
      return same;
  }
}
