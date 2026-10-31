import { BAG_ITEMS } from '../engine/bag.mjs';
import { BALLS } from '../engine/capture.mjs';
import { expForLevel, growthOf } from '../engine/exp.mjs';
import { STATS, evolutionTargets, holdsEverstone, displayName } from '../engine/mon.mjs';
import { applyOps, emptyState, maxHp, movePp, toID, clone, healParty } from './state.mjs';
import { PARTY_MAX, MAX_LEVEL, MAX_IV, EV_STAT_MAX, EV_TOTAL_MAX, BOX_SIZE } from './rules.mjs';
import { MAX_PP_UPS } from '../engine/pp.mjs';
import { OUTSIDE_ITEMS, VITAMIN_EVS, HYPER_TRAIN_LEVEL, isTm } from './items.mjs';
import { itemText, tmMove, canLearnTm } from './item-info.mjs';
import { withParticle, statName, natureName, listOf, boxLabel } from './diary.mjs';
import { say } from './screen-text.mjs';
import { battleNamesIn } from '../plugin/battle/names.js';
import bagIcons from '../data/bag-icons.json' with { type: 'json' };
import { CUSTOM_PREFIX, isCustomItem, customInfo, itemId } from './custom-items.mjs';

export { PARTY_MAX, BOX_SIZE };
export const BOX_COLS = 6;
export const BOX_COUNT = 32;
export const TABS = Object.freeze(['party', 'box', 'bag']);

const refOf = mon => ({ uid: mon.uid });

const namesCache = new WeakMap();

// The name lookups of lang (one per engine Dex and language)
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

function evolutionItems(sim) {
  let set = evolutionItemCache.get(sim.Dex);
  if (!set) {
    set = new Set(sim.Dex.species.all().filter(s => s.evoType === 'useItem' && s.evoItem).map(s => toID(s.evoItem)));
    evolutionItemCache.set(sim.Dex, set);
  }
  return set;
}

export function itemKind(id, sim) {
  if (isCustomItem(id)) return 'custom';
  const key = toID(id);
  if (Object.hasOwn(BALLS, key)) return 'ball';
  const bag = BAG_ITEMS[key];
  if (bag) return bag.heal || bag.cure || bag.revive || bag.pp ? 'medicine' : 'battle';
  if (isTm(key)) return 'tm';
  if (Object.hasOwn(OUTSIDE_ITEMS, key)) return OUTSIDE_ITEMS[key].kind;
  if (key === 'rarecandy') return 'candy';
  if (evolutionItems(sim).has(key)) return 'stone';
  return 'held';
}
const USABLE = new Set(['medicine', 'candy', 'stone', 'train', 'tm', 'evolve']);

const BAG_ONLY = new Set(['ball', 'battle', 'field', 'key']);

const NOT_HOLDABLE = new Set([...BAG_ONLY, 'tm']);

// Key items cannot be thrown away
const NOT_TOSSABLE = new Set(['key']);

const medicineOf = id => BAG_ITEMS[id] ?? (OUTSIDE_ITEMS[id]?.kind === 'medicine' ? OUTSIDE_ITEMS[id] : null);

export function stoneEvolution(sim, mon, id) {
  const key = toID(id);
  const ready = evolutionTargets(sim.Dex, mon.set, t => t.evoType === 'useItem' && toID(t.evoItem) === key);
  return ready.length >= 1 ? ready[0].name : null;
}

export function tradeEvolution(sim, mon) {
  const held = toID(mon.set.item);
  if (holdsEverstone(held)) return null;
  const ready = evolutionTargets(sim.Dex, mon.set, t => t.evoType === 'trade' && !t.evoCondition && t.isNonstandard !== 'CAP' && (!t.evoItem || toID(t.evoItem) === held));
  return ready.length ? { into: ready[0].name, consumeHeld: !!ready[0].evoItem } : null;
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

export function useCheck(mon, itemId, { sim, exp }, lang) {
  const id = toID(itemId), kind = itemKind(id, sim);
  const fainted = mon.hp === 0;
  const no = { ok: false, reason: noEffect(lang) };
  const names = namesFor(lang, sim);
  const p = (word, pair) => withParticle(lang, word, pair);
  if (kind === 'medicine') {
    const item = medicineOf(id);
    if (item.revive) return fainted ? { ok: true } : no;
    if (fainted) return no;
    if (item.pp) {

      const moves = mon.set.moves.map(m => { const { pp, maxpp } = movePp(sim, mon, m); return { id: m, pp, maxpp, disabled: pp >= maxpp }; });
      if (!moves.some(m => !m.disabled)) return no;
      return item.oneMove ? { ok: true, moves, prompt: selectMove(lang) } : { ok: true };
    }
    let useful = false;
    if (item.heal) useful ||= mon.hp !== null && mon.hp < maxHp(sim, mon.set);
    if (item.cure) useful ||= !!mon.status && mon.status !== 'fnt' && (item.cure === 'all' || item.cure.includes(mon.status));
    return useful ? { ok: true } : no;
  }
  if (kind === 'candy') return mon.set.level < MAX_LEVEL ? { ok: true } : no;
  if (kind === 'stone') { const into = stoneEvolution(sim, mon, id); return into ? { ok: true, evolve: into } : no; }
  if (kind === 'evolve') { const trade = tradeEvolution(sim, mon); return trade ? { ok: true, evolve: trade.into, consumeHeld: trade.consumeHeld } : no; }
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

  if (item.ppUp) {
    const moves = mon.set.moves.map(m => {
      const { pp, maxpp, ppUps } = movePp(sim, mon, m);
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
  } else if (kind === 'candy') ops.push({ op: 'level', ref, delta: 1, candy: true });
  else if (kind === 'train' && outside.vitamin) ops.push({ op: 'evs', ref, stat: outside.vitamin, amount: VITAMIN_EVS });
  else if (kind === 'train' && outside.exp) ops.push({ op: 'exp', ref, amount: outside.exp });
  else if (kind === 'train' && outside.ability) ops.push({ op: 'ability', ref, ability: abilityChange(sim, mon, id) });
  else if (kind === 'train' && outside.mint) ops.push({ op: 'nature', ref, nature: outside.mint });
  else if (kind === 'train' && outside.hyper) ops.push({ op: 'hypertrain', ref, stats: outside.hyper === 'all' ? 'all' : [stat] });
  else if (kind === 'train' && outside.ppUp) ops.push({ op: 'ppup', ref, move, amount: outside.ppUp });
  else throw new Error(`Not an item used outside battle: ${id}`);
  ops.push({ op: 'item', item: id, delta: -1, fromBag: true });
  return ops;
}

// Bag items that can be held (balls, battle and field items only show a description; TMs cannot be held)
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
};

const learnOp = (mon, move, result) => (result?.learned
  ? { op: 'learn', ref: refOf(mon), move, ...(result.forgot ? { forget: result.forgot } : {}) }
  : { op: 'learn', ref: refOf(mon), move, skip: true });

export const pendingCount = mon => (mon?.pending?.moves?.length ?? 0) + (mon?.pending?.evolve ? 1 : 0);

export const levelBadge = mon => (pendingCount(mon) ? Math.max(1, mon.pending.levels || pendingCount(mon)) : 0);

export function levelUpPlan(mon) {
  return { moves: [...(mon?.pending?.moves ?? [])], evolve: mon?.pending?.evolve ?? null };
}

export function evolutionMoves(ctx, mon, into) {
  const probe = { ...emptyState(), party: [{ ...clone(mon), pending: { levels: 0, moves: [], evolve: null } }] };
  const { state, errors } = applyOps(probe, [{ op: 'evolve', ref: refOf(mon), species: into }], ctx, 'panel:evolve', null);
  return errors.length ? [] : state.party[0].pending.moves;
}

export function levelUpAction(mon, { moves = [], evolution = null } = {}) {
  const ops = moves.map(({ move, result }) => learnOp(mon, move, result));
  if (evolution) {
    if (evolution.evolved) {
      ops.push({ op: 'evolve', ref: refOf(mon), species: evolution.into });
      for (const learned of evolution.learned ?? []) ops.push(learnOp(mon, learned.move, learned));
    } else ops.push({ op: 'noevolve', ref: refOf(mon) });
  }
  return ops.length ? { type: evolution?.evolved ? 'evolve' : 'learn', ops } : null;
}

export function stoneAction(mon, item, { into, evolved, learned = [] }, { consumeHeld = false } = {}) {
  if (!evolved) return null;
  const ops = [{ op: 'evolve', ref: refOf(mon), species: into }, ...(consumeHeld ? [{ op: 'hold', ref: refOf(mon), item: '' }] : []),
    ...learned.map(l => learnOp(mon, l.move, l)), { op: 'item', item: toID(item), delta: -1, fromBag: true }];
  return { type: 'use', item: toID(item), ops };
}

export function teachAction(mon, item, move, result) {
  if (!result?.learned) return null;
  return { type: 'use', item: toID(item), ops: [learnOp(mon, move, result), { op: 'item', item: toID(item), delta: -1, fromBag: true }] };
}

const opt = (id, label, disabled = false, extra = {}) => ({ id, label, disabled: !!disabled, ...extra });

// A menu row whose label is screen text panel.menu.<word> in lang
const row = lang => (id, word, disabled = false, values = {}) => opt(id, say(lang, `panel.menu.${word}`, values), disabled);

const debugRows = (debug, locked, lang) => (debug ? [row(lang)('debugEdit', 'debugEdit', locked)] : []);

export function partyMenu(mon, { state, locked = false, sim, debug = false }, lang) {
  const r = row(lang);
  const list = [r('summary', 'summary')];
  if (pendingCount(mon)) list.push(r('levelup', 'levelUp', locked, { n: levelBadge(mon) }));
  list.push(r('order', 'order', locked || state.party.length < 2));
  list.push(r('give', 'give', locked || !holdableItems(state, sim).length));
  if (mon.set.item) list.push(r('take', 'take', locked));

  list.push(r('deposit', 'deposit', locked || state.party.length <= 1));
  list.push(...debugRows(debug, locked, lang), r('cancel', 'cancel'));
  return list;
}

export function boxMenu(mon, { locked = false, debug = false }, lang) {
  const r = row(lang);
  return [r('withdraw', 'withdraw', locked), r('summary', 'summary'), r('release', 'release', locked), ...debugRows(debug, locked, lang), r('cancel', 'cancel')];
}

export function bagMenu(id, { locked = false, sim, state }, lang) {
  const kind = itemKind(id, sim);
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
  const names = namesFor(lang, sim);
  const species = sim.Dex.species.get(mon.set.species);
  const max = maxHp(sim, mon.set);
  const hp = mon.hp === null || mon.hp === undefined ? max : Math.max(0, mon.hp);
  const ratio = max ? hp / max : 0;
  return {
    uid: mon.uid, name: monName(mon, sim, names), speciesId: species.id, spriteId: species.spriteid || species.id, shiny: !!mon.set.shiny,
    gender: mon.set.gender || '', level: mon.set.level, hp, maxhp: max, hpClass: ratio > 0.5 ? 'high' : ratio > 0.2 ? 'mid' : 'low',
    status: hp === 0 ? '' : mon.status && mon.status !== 'fnt' ? mon.status : '', fainted: hp === 0,
    exp: expRatio(ctx, mon), item: mon.set.item || '', badge: levelBadge(mon),
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
export function bagView(state, sim, lang) {
  const names = namesFor(lang, sim);
  const rank = id => (ORDER.includes(id) ? ORDER.indexOf(id) : ORDER.length);
  const rows = Object.entries(state.bag ?? {}).filter(([, n]) => n > 0).map(([id, count]) => {
    const kind = itemKind(id, sim);

    return { id, count, name: itemLabel(state, id, names, { bag: true }), kind, icon: kind === 'custom' ? { emoji: customInfo(state, id)?.emoji ?? '' } : itemIcon(id, sim),
      group: GROUP_OF[kind] ?? kind };
  }).sort((a, b) => rank(a.id) - rank(b.id) || (a.kind === 'tm' && b.kind === 'tm' ? a.id.localeCompare(b.id) : a.name.localeCompare(b.name, lang)));
  return GROUPS.map(group => ({ group, label: say(lang, `panel.group.${group}`), items: rows.filter(r => r.group === group) })).filter(g => g.items.length);
}

export function panelModel({ state, ctx, lang, locked = false, resume = false, debug = false, offer = null, ui, money = state.money === null ? null : state.money ?? 0 }) {
  const { sim } = ctx;
  const party = Array.from({ length: PARTY_MAX }, (_, i) => (state.party[i] ? slotView(state.party[i], ctx, state, lang) : null));
  const count = boxCount(state);
  const index = Math.max(0, Math.min(count - 1, ui.box ?? 0));
  const cells = Array.from({ length: BOX_SIZE }, (_, i) => {
    const mon = state.box[index * BOX_SIZE + i];
    return mon ? slotView(mon, ctx, state, lang) : null;
  });
  return {
    lang, open: !!ui.open, tab: TABS.includes(ui.tab) ? ui.tab : 'party', locked, resume: !!resume,
    alerts: { party: state.party.some(m => pendingCount(m) > 0), box: false, bag: false },
    party, box: { index, count, name: boxName(state, index, lang), cells },
    bag: { money, groups: bagView(state, sim, lang) },
    add: debug ? addable(state, locked) : null,
    heal: debug ? !locked : null,
    offer: offer && !locked ? { note: !!offer.note, button: !!offer.button } : null,
    picked: ui.ask?.uid ?? ui.menu?.uid ?? ui.select?.uid ?? ui.menu?.item ?? ui.select?.item ?? ui.count?.item ?? null,
    window: windowOf(ui, lang, sim),
  };
}

const addable = (state, locked) => ({ party: !locked && state.party.length < PARTY_MAX, box: !locked, bag: !locked });

function healChanges(state, ctx) {
  const { sim, formatid } = ctx;
  const look = mon => JSON.stringify([mon.hp ?? maxHp(sim, mon.set, formatid), mon.status || '', mon.set.moves.map(m => movePp(sim, mon, m, formatid).pp)]);
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

export const initialUi = () => ({ open: false, tab: 'party', box: 0, menu: null, select: null, ask: null, moves: null, stats: null, count: null, message: null });
const calm = ui => ({ ...ui, menu: null, select: null, ask: null, moves: null, stats: null, count: null, message: null });
const findIn = (list, uid) => list.find(m => m.uid === uid) ?? null;

export function reduce(ui, hit, { state, ctx, lang, locked = false, debug = false }) {
  const out = reduceRaw(ui, hit, { state, ctx, locked, debug, w: wordsOf(lang, ctx.sim, state) });

  if (locked && out.effect && !['summary', 'renameBox', 'resume'].includes(out.effect.kind)) return { ui: out.ui, effect: null };
  return out;
}

function wordsOf(lang, sim, state) {
  const names = namesFor(lang, sim);
  return {
    lang, names, t: (key, values) => say(lang, key, values), p: (word, pair) => withParticle(lang, word, pair),
    mon: mon => monName(mon, sim, names), label: id => itemLabel(state, id, names),
  };
}

function reduceRaw(ui, hit, { state, ctx, locked, debug, w }) {
  const { sim } = ctx;
  const same = { ui, effect: null };
  const party = state.party, box = state.box;
  switch (hit?.t) {
    case 'tab':
      if (ui.open && ui.tab === hit.tab) return { ui: { ...calm(ui), open: false }, effect: null };
      return { ui: { ...calm(ui), open: true, tab: hit.tab }, effect: null };
    case 'fold': return { ui: { ...calm(ui), open: false }, effect: null };
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
      return { ui: calm(ui), effect: { kind: 'levelup', uid: mon.uid } };
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
    case 'later': return locked ? same : { ui: calm(ui), effect: { kind: 'importLater' } };
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
      const menu = bagMenu(hit.item, { locked, sim, state }, w.lang);
      const text = bagText(state, hit.item, sim, w.lang);
      if (!menu) return { ui: { ...calm(ui), message: { text } }, effect: null };
      return { ui: { ...calm(ui), menu: { where: 'bag', item: hit.item, text, options: menu } }, effect: null };
    }
    case 'slot': return slotPress(ui, hit, { state, ctx, locked, debug, w });
    case 'opt': return optionPress(ui, hit, { state, ctx, w });
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
  if (outside.exp) return t('panel.usedExp', { mon: p(who, '은/는'), n: outside.exp.toLocaleString(lang) });
  if (outside.ability) return t('panel.usedAbility', { mon: who, ability: p(w.names.ability(abilityChange(sim, mon, id)), '으로/로') });
  if (outside.mint) return t('panel.usedMint', { mon: who, nature: natureName(outside.mint, lang) });
  if (outside.hyper) return t('panel.usedHyper', { mon: p(who, '은/는'), stats: outside.hyper === 'all' ? t('diary.allStats') : statName(stat, lang) });

  // Same text for PP Max
  if (outside.ppUp) return t('panel.usedPpUp', { move: w.names.move(move) });
  return t('panel.used', { mon: who, item: p(itemName(id, w.names), '을/를') });
}

function slotPress(ui, hit, { state, ctx, locked, debug, w }) {
  const { sim } = ctx;
  const { t, p } = w;
  if (hit.where === 'box') {
    const mon = findIn(state.box, hit.uid);
    if (!mon) return { ui, effect: null };
    return { ui: { ...calm(ui), menu: { where: 'box', uid: mon.uid, text: t('panel.boxAsk', { mon: p(w.mon(mon), '을/를') }), options: boxMenu(mon, { locked, debug }, w.lang) } }, effect: null };
  }
  const mon = findIn(state.party, hit.uid);
  if (!mon) return { ui, effect: null };
  const select = ui.select;
  if (select) {
    if (locked) return { ui: calm(ui), effect: null };
    switch (select.mode) {
      case 'order': {
        const from = findIn(state.party, select.uid);
        if (!from || from.uid === mon.uid) return { ui: calm(ui), effect: null };
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
        const check = useCheck(mon, select.item, ctx, w.lang);

        if (!check.ok) return { ui: { ...ui, message: { text: check.reason } }, effect: null };
        if (check.evolve) {
          return { ui: calm(ui), effect: { kind: 'evolveItem', uid: mon.uid, item: select.item, into: check.evolve, ...(check.consumeHeld ? { consumeHeld: true } : {}) } };
        }
        if (check.teach) return { ui: calm(ui), effect: { kind: 'teachTm', uid: mon.uid, item: select.item, move: check.teach } };
        if (check.moves) return { ui: { ...calm(ui), moves: { uid: mon.uid, item: select.item, list: check.moves, prompt: check.prompt } }, effect: null };
        if (check.stats) return { ui: { ...calm(ui), stats: { uid: mon.uid, item: select.item, list: check.stats } }, effect: null };
        if (check.confirm) return { ui: { ...calm(ui), ask: { kind: 'use', uid: mon.uid, item: select.item, text: check.confirm } }, effect: null };
        return { ui: calm(ui), effect: useEffect(mon, select.item, ctx, w) };
      }
      default: return { ui: calm(ui), effect: null };
    }
  }
  return { ui: { ...calm(ui), menu: { where: 'party', uid: mon.uid, text: t('panel.partyAsk'), options: partyMenu(mon, { state, locked, sim, debug }, w.lang) } }, effect: null };
}

function optionPress(ui, hit, { state, ctx, w }) {
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
      case 'summary': return { ui: calm(ui), effect: { kind: 'summary', uid: mon.uid } };
      case 'levelup': return { ui: calm(ui), effect: { kind: 'levelup', uid: mon.uid } };
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
      case 'summary': return { ui: calm(ui), effect: { kind: 'summary', uid: mon.uid } };
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
