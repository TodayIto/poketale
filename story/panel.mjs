import { BAG_ITEMS } from '../engine/bag.mjs';
import { BALLS } from '../engine/capture.mjs';
import { expForLevel, growthOf } from '../engine/exp.mjs';
import { STATS, displayName, heldItemForm, spriteIdOf, fixedTeraType, gmaxOf, takesMaxSoup, DYNAMAX_LEVEL_MAX } from '../engine/mon.mjs';
import { itemEvolution, tradeEvolution, tradePair, evolutionItems, spinEvolution, evolutionHeld, willingMon, ABSENT_TRADE_EVOLUTION, lockMark, genMark } from '../engine/evolution.mjs';
import { evolveGenOf, oneSpecialAt, expShareHeldIn } from './battle-rule.mjs';
import { applyOps, emptyState, maxHp, movePp, toID, clone, healParty, rememberableMoves, levelUpMoves, friendshipOf, evolutionCheck, isEgg, hatched, hatchDue, hatchedParty, breedingOf, stateFormat,
  restsLeft, restHelps, SHORT_RESTS } from './state.mjs';
import { EGG_SPRITE, compatHearts } from '../engine/breeding.mjs';
import { FRIENDSHIP_MAX, FRIENDSHIP_STEPS, friendshipStep } from '../engine/friendship.mjs';
import { ruleValues } from './setting-changes.mjs';
import { PARTY_MAX, MAX_LEVEL, MAX_IV, EV_STAT_MAX, EV_TOTAL_MAX, BOX_SIZE, MAX_MOVES } from './rules.mjs';
import { ruleFormat, formatRules, DEFAULT_FORMAT } from '../engine/rules.mjs';
import { MAX_PP_UPS } from '../engine/pp.mjs';
import { OUTSIDE_ITEMS, VITAMIN_EVS, HYPER_TRAIN_LEVEL, isTm, isTr, isRod, MACHINE_IDS, isZCrystalId, Z_CRYSTALS, EXP_SHARE } from './items.mjs';
import { itemText, heldItemText, tmMove, canLearnTm } from './item-info.mjs';
import { parseMachineId, machineUsedUp, machineOrder, isMachineId, machineMark } from './machine-standards.mjs';
import { withParticle, statName, natureName, typeName, listOf, boxLabel } from './diary.mjs';
import { say } from './screen-text.mjs';
import { battleNamesIn } from '../plugin/battle/names.js';
import bagIcons from '../data/bag-icons.json' with { type: 'json' };
import { CUSTOM_PREFIX, isCustomItem, customInfo, itemId, isDexItem, ownerName, storyDisc, itemAs } from './custom-items.mjs';
import { ITEM_EFFECTS_READY } from './item-effects.mjs';
import { hungBagOf, effortOn, trainBlock, statExpVitaminWorks } from './training.mjs';
import { VITAMIN_STAT_EXP } from '../engine/stat-exp.mjs';
import { badgeCaseModel, badgePress } from './badge-case.mjs';
import { pokeapiItemUrl as pokeapiItemFile } from '../view/sprites/sources.js';
import { dexView, dexPress } from './dex.mjs';
import { beatsRecord, validRecord, recordScore } from './amie-games.mjs';
import { LAB_TIME, labOf, labFossils, bagFossils, isHalf, halvesFor, labName as labPlaceName } from './fossil.mjs';
import { fossilsLine } from './diary.mjs';
import { canPet, enjoymentOf, parsePuff, puffId, puffCount, puffFriendship, foodFriendship, feedHeals, FREE_GRADE, PUFF_FLAVORS, PUFF_GRADES } from './amie.mjs';

export { PARTY_MAX, BOX_SIZE };

export const SCREEN_PLACES = Object.freeze(['panel', 'window']);
export const DEFAULT_SCREEN_PLACE = 'panel';

export const PANEL_OPENS = Object.freeze(['hover', 'click', 'always']);
export const DEFAULT_PANEL_OPEN = 'hover';

export const panelOpenOf = stored => (PANEL_OPENS.includes(stored?.panelOpen) ? stored.panelOpen : undefined);

export function openWays(mode, mouse) {
  const m = PANEL_OPENS.includes(mode) ? mode : DEFAULT_PANEL_OPEN;
  return { always: m === 'always', hover: m === 'hover' && !!mouse };
}
export const BOX_COUNT = 32;

export const TABS = Object.freeze(['party', 'box', 'bag', 'travel', 'settings']);

export const PICKS = Object.freeze(['amie', 'train']);

export const SETTINGS_SUBS = Object.freeze(['bot', 'tale']);

export const TALE_ROWS = Object.freeze({ story: Object.freeze(['sendFormat', 'debug']), battle: Object.freeze(['battles', 'typeHints']),
  panel: Object.freeze(['panelStay', 'panelOpen', 'panelDrag']) });

const settingsSubs = ({ bot }) => SETTINGS_SUBS.filter(sub => sub !== 'bot' || bot);
const settingsSub = (ui, subs) => (subs.includes(ui.setsub) ? ui.setsub : subs[0]);

export const MAP_READY = false;

export const TRAVEL_SUBS = Object.freeze(['trip', 'map', 'dex', 'badge']);

const travelSubs = ({ trip, badges }) => TRAVEL_SUBS.filter(sub => (sub === 'trip' ? trip : sub === 'map' ? MAP_READY : sub === 'badge' ? badges : true));

const travelSub = (ui, subs) => (subs.includes(ui.sub) ? ui.sub : subs.includes('trip') ? 'trip' : 'dex');

const refOf = mon => ({ uid: mon.uid });

const namesCache = new WeakMap();
/** The name lookups of lang (one per engine Dex and language) */
export function namesFor(lang, sim) {
  let byLang = namesCache.get(sim.Dex);
  if (!byLang) namesCache.set(sim.Dex, byLang = {});
  return byLang[lang] ??= battleNamesIn(lang, sim.Dex);
}

export const itemName = (id, names) => names.item(toID(id));

export const bagItemName = (id, names) => itemName(id, names);

export function itemLabel(state, id, names, { bag = false } = {}) {
  const disc = storyDisc(state, id);
  if (disc) return itemName(disc, names);
  if (isCustomItem(id)) return customInfo(state, id)?.name ?? id.slice(CUSTOM_PREFIX.length);
  return bag ? bagItemName(id, names) : itemName(id, names);
}

const monName = (mon, sim, names) => displayName(sim.Dex, names, mon.set.species, mon.set.name);

export const LOCK_FREE = new Set(['nickname', 'boxname']);

// -- Items --------------------------------------------------

const evolutionItemCache = new WeakMap();

function stoneItems(sim, trade) {
  let byMode = evolutionItemCache.get(sim.Dex);
  if (!byMode) evolutionItemCache.set(sim.Dex, byMode = {});
  return byMode[trade] ??= evolutionItems(sim.Dex, trade);
}

export function itemKind(id, sim, trade = ABSENT_TRADE_EVOLUTION, gen = null) {
  if (isCustomItem(id)) return 'custom';
  const key = toID(id);
  if (key === EXP_SHARE && expShareHeldIn(gen)) return 'held';
  if (Object.hasOwn(BALLS, key)) return 'ball';

  const bag = itemChange(key) ? null : BAG_ITEMS[key];

  if (bag) return bag.key ? 'key' : !bag.reusable && (bag.heal || bag.cure || bag.revive || bag.pp) ? 'medicine' : 'battle';
  if (isTm(key) || isTr(key)) return 'tm'; // TRs (Sword/Shield) too: used, never held, used up once learned
  if (Object.hasOwn(OUTSIDE_ITEMS, key)) return OUTSIDE_ITEMS[key].kind;
  if (key === 'rarecandy') return 'candy';
  if (stoneItems(sim, trade).has(key)) return 'stone';
  return 'held';
}
const USABLE = new Set(['medicine', 'candy', 'stone', 'train', 'tm', 'evolve']);

export const fishLine = (result, lang, names) => (result?.item
  ? say(lang, 'panel.fish.item', { item: withParticle(lang, itemName(result.item, names), '을/를') }) : say(lang, 'panel.fish.bite'));

export const fishMessage = (result, lang, names) => ({ text: fishLine(result, lang, names), error: false,
  ...(result?.battle ? { then: { kind: 'fishBattle', key: result.battle } } : {}) });

// Neither used nor held from the panel's bag (key: key items - Tera Orb)
const BAG_ONLY = new Set(['ball', 'battle', 'field', 'key']);
// TMs cannot be held
const NOT_HOLDABLE = new Set([...BAG_ONLY, 'tm']);
// Key items cannot be thrown away
const NOT_TOSSABLE = new Set(['key']);

const medicineOf = id => BAG_ITEMS[id] ?? (OUTSIDE_ITEMS[id]?.kind === 'medicine' ? OUTSIDE_ITEMS[id] : null);

export function stoneEvolution(ctx, mon, id, party = []) {
  const { mon: evolving, now } = evolutionCheck(ctx, mon, party);
  return itemEvolution(ctx.sim.Dex, evolving, id, now);
}

const pairMon = (mon, ctx = null) => ({ species: mon.set.species, item: mon.set.item, gigantamax: mon.set.gigantamax === true, ...lockMark(mon.evolveLocked),
  ...genMark(evolveGenOf(ctx)) });

export function cordEvolutions(ctx, mon, party = []) {
  const { mon: evolving, now } = evolutionCheck(ctx, mon, party);
  const trade = tradeEvolution(ctx.sim.Dex, evolving, now);
  if (!trade) return null;
  const first = { uid: mon.uid, into: trade.into, ...(trade.consumeHeld ? { consumeHeld: true } : {}) };
  const other = trade.with && hatched(party).find(m => m.uid !== mon.uid && toID(ctx.sim.Dex.species.get(m.set.species).name) === toID(trade.with));
  const into = other && tradePair(ctx.sim.Dex, pairMon(mon, ctx), pairMon(other, ctx))?.[1];
  return into ? [first, { uid: other.uid, into }] : [first];
}

export function swapEvolutions(ctx, a, b) {
  if ((ctx.tradeEvolution ?? ABSENT_TRADE_EVOLUTION) !== 'level' || hatched([a, b]).length < 2) return null;
  const into = tradePair(ctx.sim.Dex, pairMon(a, ctx), pairMon(b, ctx));
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

function formStep(ctx, mon, item) {
  const now = ctx.sim.Dex.species.get(mon.set.species).name;
  const [, to, when = {}] = item.form.find(([from]) => from === now) ?? [];
  if (!to || (when.day && (mon.status === 'frz' || ctx.status?.timeOfDay === 'night'))) return null;
  const moves = (when.moves ?? []).filter(([old]) => mon.set.moves.includes(old));
  return { to, ...(moves.length ? { moves } : {}) };
}

let machinesOf = null;
const machinesFor = move => {
  if (!machinesOf) {
    machinesOf = new Map();
    for (const id of MACHINE_IDS) { const taught = tmMove(id); if (taught) machinesOf.set(taught, [...(machinesOf.get(taught) ?? []), id]); }
  }
  return machinesOf.get(move) ?? [];
};

const baseLearns = (ctx, species, move) => levelUpMoves(ctx, species).some(([, m]) => m === move) || machinesFor(move).some(id => canLearnTm(ctx.sim, species, id));

function formLabel(dex, names, lang, form) {
  const species = dex.species.get(form);
  if (lang !== 'ko') return species.forme ? `${species.forme} ${species.baseSpecies}` : species.baseSpecies;
  const full = names.speciesFull(form);
  return /\((.+)\)$/.exec(full)?.[1] ?? full;
}

// -- Items that change one value of a Pokemon -------------------------------

const statExpItem = (item, ctx) => item.evs === undefined && item.friendship === undefined && oneSpecialAt(ctx);

const otherAbility = (mon, item) => item.cube.abilities.find(a => toID(a) !== toID(mon.set.ability));

export const ITEM_CHANGES = Object.freeze({

  vitamin: {
    check: (mon, item, c) => {
      if (statExpItem(item, c.ctx)) return statExpVitaminWorks(mon, item.vitamin) ? { ok: true } : c.no;
      const evs = mon.set.evs ?? {};
      const total = STATS.reduce((sum, s) => sum + (evs[s] ?? 0), 0);
      return (evs[item.vitamin] ?? 0) < EV_STAT_MAX && total < EV_TOTAL_MAX ? { ok: true } : c.no;
    },
    ops: (mon, item, c) => [{ op: 'evs', ref: c.ref, stat: item.vitamin, amount: item.evs ?? VITAMIN_EVS, ...(statExpItem(item, c.ctx) ? { statExp: VITAMIN_STAT_EXP } : {}) },
      ...evItemFriendship(mon, item, c.ctx)],
    after: (mon, item, w) => w.t('panel.usedVitamin', { mon: w.mon(mon), stat: statName(item.vitamin, w.lang) }),
    text: (item, t, lang) => t('item.vitamin', { stat: statName(item.vitamin, lang) }),
  },

  evReset: {
    check: (mon, item, c) => (STATS.some(s => (mon.set.evs?.[s] ?? 0) > 0) ? { ok: true } : c.no),
    ops: (mon, item, c) => STATS.filter(s => (mon.set.evs?.[s] ?? 0) > 0).map(s => ({ op: 'evs', ref: c.ref, stat: s, amount: -mon.set.evs[s] })),
    after: (mon, item, w) => w.t('panel.usedEvReset', { mon: w.mon(mon) }),
    text: (item, t) => t('item.evReset'),
  },
  // EV-lowering berries: while the EVs can go down or friendship up
  evBerry: {
    check: (mon, item, c) => ((mon.set.evs?.[item.evBerry] ?? 0) > 0 || friendshipOf(c.ctx, mon) < FRIENDSHIP_MAX ? { ok: true } : c.no),
    ops: (mon, item, c) => [...((mon.set.evs?.[item.evBerry] ?? 0) > 0 ? [{ op: 'evs', ref: c.ref, stat: item.evBerry, amount: -VITAMIN_EVS }] : []),
      { op: 'friendship', ref: c.ref, source: 'berry' }],
    after: (mon, item, w) => ((mon.set.evs?.[item.evBerry] ?? 0) > 0 ? w.t('panel.usedEvBerry', { mon: w.mon(mon), stat: statName(item.evBerry, w.lang) }) : null),
    text: (item, t, lang) => t('item.evBerry', { stat: statName(item.evBerry, lang) }),
  },
  // Exp. Candy: below Lv100, a species with a growth rate
  exp: {
    check: (mon, item, c) => (mon.set.level < MAX_LEVEL && growthOf(c.ctx.exp, c.ctx.sim.Dex.species.get(mon.set.species)) ? { ok: true } : c.no),
    ops: (mon, item, c) => [{ op: 'exp', ref: c.ref, amount: item.exp }],
    after: (mon, item, w) => w.t('panel.usedExp', { mon: w.p(w.mon(mon), '은/는'), n: item.exp.toLocaleString(w.lang) }),
    text: (item, t, lang) => t('item.expCandy', { n: item.exp.toLocaleString(lang) }),
  },
  // Ability Capsule / Patch: "change it?" asked once (abilityChange)
  ability: {
    check: (mon, item, c) => {
      const to = abilityChange(c.ctx.sim, mon, c.id);
      return to ? { ok: true, confirm: say(c.lang, 'panel.abilityAsk', { mon: monName(mon, c.ctx.sim, c.names), ability: c.p(c.names.ability(to), '으로/로') }) } : c.no;
    },
    ops: (mon, item, c) => [{ op: 'ability', ref: c.ref, ability: abilityChange(c.ctx.sim, mon, c.id) }],
    after: (mon, item, w, o) => w.t('panel.usedAbility', { mon: w.mon(mon), ability: w.p(w.names.ability(abilityChange(o.ctx.sim, mon, o.id)), '으로/로') }),
    text: (item, t) => t(item.ability === 'capsule' ? 'item.abilityCapsule' : 'item.abilityPatch'),
  },
  // Mints: another nature's stats
  mint: {
    check: (mon, item, c) => (item.mint !== mon.set.nature ? { ok: true } : c.no),
    ops: (mon, item, c) => [{ op: 'nature', ref: c.ref, nature: item.mint }],
    after: (mon, item, w) => w.t('panel.usedMint', { mon: w.mon(mon), nature: natureName(item.mint, w.lang) }),
    text: (item, t, lang) => t('item.mint', { nature: natureName(item.mint, lang) }),
  },

  hyper: {
    check: (mon, item, c) => {
      if (mon.set.level < HYPER_TRAIN_LEVEL) return c.no;
      const stats = STATS.map(s => ({ id: s, iv: mon.set.ivs?.[s] ?? MAX_IV }));
      if (!stats.some(s => s.iv < MAX_IV)) return c.no;
      return item.hyper === 'one' ? { ok: true, stats } : { ok: true };
    },
    ops: (mon, item, c, { stat }) => [{ op: 'hypertrain', ref: c.ref, stats: item.hyper === 'all' ? 'all' : [stat] }],
    after: (mon, item, w, o) => w.t('panel.usedHyper', { mon: w.p(w.mon(mon), '은/는'), stats: item.hyper === 'all' ? w.t('diary.allStats') : statName(o.stat, w.lang) }),
    text: (item, t) => t(item.hyper === 'all' ? 'item.goldBottleCap' : 'item.bottleCap', { n: HYPER_TRAIN_LEVEL }),
  },

  ppUp: {
    check: (mon, item, c) => {
      const moves = mon.set.moves.map(m => {
        const { pp, maxpp, ppUps } = movePp(c.ctx.sim, mon, m, c.format);
        return { id: m, pp, maxpp, ppUps, disabled: ppUps >= MAX_PP_UPS || !!c.ctx.sim.Dex.moves.get(m).noPPBoosts };
      });
      return moves.some(m => !m.disabled) ? { ok: true, moves, prompt: selectMove(c.lang) } : c.no;
    },
    ops: (mon, item, c, { move }) => [{ op: 'ppup', ref: c.ref, move, amount: item.ppUp }, { op: 'friendship', ref: c.ref, source: 'vitamin' }],
    after: (mon, item, w, o) => w.t('panel.usedPpUp', { move: w.names.move(o.move) }),
    text: (item, t) => t(item.ppUp > 1 ? 'item.ppMax' : 'item.ppUp'),
  },

  teraShard: {
    check: (mon, item, c) => (formatRules(c.ctx.sim, ruleFormat(c.ctx.rule)).champions
      || fixedTeraType(c.ctx.sim.Dex, mon.set.species) || mon.set.teraType === item.teraShard ? c.no
      : { ok: true, confirm: say(c.lang, 'panel.teraAsk', { mon: monName(mon, c.ctx.sim, c.names), type: typeName(item.teraShard, c.lang) }) }),
    ops: (mon, item, c) => [{ op: 'tera', ref: c.ref, type: item.teraShard }],
    after: (mon, item, w) => w.t('panel.usedTera', { mon: w.mon(mon), type: typeName(item.teraShard, w.lang) }),
    text: (item, t, lang) => t('item.teraShard', { n: item.cost, type: typeName(item.teraShard, lang) }),
  },

  form: {
    check: (mon, item, c) => (formStep(c.ctx, mon, item) ? { ok: true } : c.no),
    ops: (mon, item, c) => { const { to, moves } = formStep(c.ctx, mon, item); return [{ op: 'form', ref: c.ref, species: to, ...(moves ? { moves } : {}) }]; },
    after: (mon, item, w) => w.t('panel.usedForm', { mon: w.mon(mon) }),
    text: (item, t) => t('item.form'),
  },

  fuse: {
    check: (mon, item, c) => {
      const { base, partners } = item.fuse, dex = c.ctx.sim.Dex;
      const species = dex.species.get(mon.set.species);
      if (species.baseSpecies !== base) return c.no;
      if (species.name !== base) {
        if (!mon.fused) return c.no;
        if (c.party.length >= PARTY_MAX) return { ok: false, reason: say(c.lang, 'panel.fuse.full') };
        return { ok: true, confirm: say(c.lang, 'panel.fuse.splitAsk', { a: c.p(monName(mon, c.ctx.sim, c.names), '과/와'), b: c.p(monName(mon.fused, c.ctx.sim, c.names), '을/를') }) };
      }
      const fusedBy = m => !!m.fused && Object.values(partners).some(p => p.into === dex.species.get(m.set.species).name);
      if ([...c.party, ...c.box].some(fusedBy)) return { ok: false, reason: say(c.lang, 'panel.fuse.busy', { item: c.p(c.names.item(c.id), '은/는') }) };
      const list = hatched(c.party).filter(m => m.uid !== mon.uid && Object.hasOwn(partners, dex.species.get(m.set.species).name)).map(m => m.uid);
      return list.length ? { ok: true, partners: list, prompt: say(c.lang, 'panel.fuse.pick', { mon: c.p(monName(mon, c.ctx.sim, c.names), '과/와') }) } : c.no;
    },
    ops: (mon, item, c, { partner }) => {
      const { base, partners } = item.fuse, dex = c.ctx.sim.Dex;
      const known = pairs => pairs.filter(([old]) => mon.set.moves.includes(old));
      if (mon.fused) {
        const { moves = [], steed, fallback } = partners[dex.species.get(mon.fused.set.species).name] ?? {};
        const back = known(moves.map(([old, now]) => [now, old]));

        const forget = steed ? mon.set.moves.filter(move => !baseLearns(c.ctx, base, move)) : [];
        const learn = fallback && forget.length >= mon.set.moves.length ? fallback : null;
        return [{ op: 'unfuse', ref: c.ref, species: base, ...(back.length ? { moves: back } : {}), ...(forget.length ? { forget } : {}), ...(learn ? { learn } : {}) }];
      }
      const { into, moves = [], learn } = partners[dex.species.get(partner.set.species).name];
      const pairs = known(moves);
      return [{ op: 'fuse', ref: c.ref, with: refOf(partner), species: into, ...(pairs.length ? { moves: pairs } : learn ? { learn } : {}) }];
    },
    after: (mon, item, w, o) => (mon.fused
      ? w.t('panel.fuse.splitDone', { a: w.p(w.mon(mon), '과/와'), b: w.p(w.mon(mon.fused), '이/가') })
      : w.t('panel.fuse.done', { a: w.p(w.mon(mon), '과/와'), b: w.p(w.mon(o.partner), '이/가') })),
    text: (item, t) => t('item.fuse'),
  },

  pick: {
    check: (mon, item, c) => {
      const species = c.ctx.sim.Dex.species.get(mon.set.species);
      if (species.baseSpecies !== item.pick.base) return c.no;
      const choices = Object.keys(item.pick.forms).map(form => ({ id: form, label: formLabel(c.ctx.sim.Dex, c.names, c.lang, form), disabled: form === species.name }));
      return { ok: true, choices, prompt: say(c.lang, 'panel.formPick') };
    },
    ops: (mon, item, c, { choice }) => {
      const { forms, fallback } = item.pick;
      const known = Object.values(forms).filter(move => move && mon.set.moves.includes(move));
      const move = forms[choice];
      if (move) return [{ op: 'form', ref: c.ref, species: choice, ...(known.length ? { moves: [[known[0], move]] } : { learn: move }) }];
      const none = known.length >= mon.set.moves.length;
      return [{ op: 'form', ref: c.ref, species: choice, ...(known.length ? { forget: known } : {}), ...(none ? { learn: fallback } : {}) }];
    },
    after: (mon, item, w) => w.t('panel.usedForm', { mon: w.mon(mon) }),
    text: (item, t) => t('item.form'),
  },

  cube: {
    check: (mon, item, c) => {
      const species = c.ctx.sim.Dex.species.get(mon.set.species);
      if (species.baseSpecies !== 'Zygarde' || !item.cube.forms.includes(species.name)) return c.no;
      const construct = toID(mon.set.ability) === toID(item.cube.abilities[1]);
      return { ok: true, prompt: say(c.lang, 'panel.cube.ask'), choices: [
        { id: 'form', label: say(c.lang, 'panel.cube.form'), disabled: !construct }, { id: 'ability', label: say(c.lang, 'panel.cube.ability'), disabled: false },
        { id: 'moves', label: say(c.lang, 'panel.cube.moves'), disabled: false }] };
    },
    choose: (mon, item, c, choice) => {
      if (choice === 'moves') {
        return { prompt: say(c.lang, 'panel.cube.movePick'),
          choices: item.cube.moves.map(move => ({ id: `teach:${move}`, label: c.names.move(move), disabled: mon.set.moves.includes(move) })) };
      }
      return choice?.startsWith('teach:') ? { teach: choice.slice('teach:'.length) } : null;
    },
    ops: (mon, item, c, { choice }) => {
      const { forms } = item.cube;
      if (choice === 'form') return [{ op: 'form', ref: c.ref, species: forms.find(f => f !== c.ctx.sim.Dex.species.get(mon.set.species).name) }];
      return [{ op: 'ability', ref: c.ref, ability: otherAbility(mon, item) }];
    },
    after: (mon, item, w, o) => (o.choice === 'form' ? w.t('panel.usedForm', { mon: w.mon(mon) })
      : w.t('panel.usedAbility', { mon: w.mon(mon), ability: w.p(w.names.ability(otherAbility(mon, item)), '으로/로') })),
    text: (item, t) => t('item.form'),
  },

  gmax: {
    check: (mon, item, c) => {
      const { species, has } = gmaxOf(c.ctx.sim.Dex, mon.set);
      if (noDynamax(c.ctx) || !takesMaxSoup(species)) return c.no;
      if (species.baseSpecies === 'Urshifu' && c.bag && !(c.bag.maxhoney > 0)) return { ok: false, reason: say(c.lang, 'panel.needMore', { item: c.p(c.names.item('maxhoney'), '이/가'), n: 1 }) };
      return { ok: true, confirm: say(c.lang, has ? 'panel.gmaxOffAsk' : 'panel.gmaxAsk', { mon: c.p(monName(mon, c.ctx.sim, c.names), '이/가') }) };
    },
    ops: (mon, item, c) => {
      const { species, has } = gmaxOf(c.ctx.sim.Dex, mon.set);
      return [{ op: 'gmax', ref: c.ref, on: !has }, ...(species.baseSpecies === 'Urshifu' ? [{ op: 'item', item: 'maxhoney', delta: -1, fromBag: true }] : [])];
    },
    // the line after reads the Pokemon as it was before (on: it had none)
    after: (mon, item, w, o) => w.t(gmaxOf(o.ctx.sim.Dex, mon.set).has ? 'panel.usedGmaxOff' : 'panel.usedGmax', { mon: w.p(w.mon(mon), '은/는') }),
    text: (item, t) => t('item.gmax'),
  },

  dmaxLevel: {
    check: (mon, item, c) => (noDynamax(c.ctx) || gmaxOf(c.ctx.sim.Dex, mon.set).species.cannotDynamax || (mon.set.dynamaxLevel ?? 0) >= DYNAMAX_LEVEL_MAX ? c.no : { ok: true }),
    ops: (mon, item, c) => [{ op: 'dmaxLevel', ref: c.ref, delta: item.dmaxLevel }],
    after: (mon, item, w) => w.t('panel.usedDmaxLevel', { mon: w.mon(mon) }),
    text: (item, t) => t('item.dmaxCandy'),
  },
});

const noDynamax = ctx => formatRules(ctx.sim, ruleFormat(ctx.rule)).champions;
/** The ITEM_CHANGES row of an item (its field name), or null */
export function itemChange(id) {
  const item = OUTSIDE_ITEMS[toID(id)];
  return (item && Object.keys(ITEM_CHANGES).find(field => item[field] !== undefined)) ?? null;
}

const STATUSES = new Set(['par', 'brn', 'slp', 'frz', 'psn', 'tox']);
/** Status condition name in lang ('' for none) */
export const statusName = (status, lang) => (STATUSES.has(status) ? say(lang, `status.${status}`) : '');
/** Short status mark of a party slot in lang ('' for none) */
export const statusShort = (status, lang) => (STATUSES.has(status) ? say(lang, `status.short.${status}`) : '');

export function itemDescription(id, sim, lang, gen = null) {
  const t = (key, values) => say(lang, key, values);
  const key = toID(id), kind = itemKind(key, sim, ABSENT_TRADE_EVOLUTION, gen);
  let bag = BAG_ITEMS[key];
  if (kind === 'ball') return t('item.ball');
  if (kind === 'battle') {
    if (bag?.boost) return t('item.boost', { stat: statName(bag.boost, lang) });
    if (bag?.crit) return t('item.crit');
  }

  const text = (kind === 'held' && heldItemText(key, lang)) || itemText(key, lang);
  if (text) return text;
  if (kind === 'tm') {

    const disc = parseMachineId(key)?.kind;
    const line = disc === 'tr' ? 'item.tr' : disc === 'hm' ? 'item.hm' : machineUsedUp(key) ? 'item.tm' : 'item.tmKeep';
    return t(line, { move: withParticle(lang, namesFor(lang, sim).move(tmMove(key)), '을/를') });
  }
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
  const change = itemChange(key);
  if (change) return ITEM_CHANGES[change].text(OUTSIDE_ITEMS[key], t, lang);
  if (kind === 'treasure' || kind === 'field' || kind === 'key') return t(`item.${kind}`);
  return t('item.held');
}

const noEffect = lang => say(lang, 'panel.noEffect');

const selectMove = lang => say(lang, 'panel.selectMove');

export function useCheck(mon, itemId, ctx, lang, party = [], format = DEFAULT_FORMAT, bag = null, box = []) {
  const { sim } = ctx;
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

  const refused = { ok: false, reason: say(lang, 'panel.refusesEvolution', { mon: p(monName(mon, sim, names), '은/는') }) };
  const evolving = (evolutions, retry) => (evolutions ? { ok: true, evolutions } : retry(willingMon(mon)) ? refused : no);
  if (kind === 'stone') {
    const into = m => stoneEvolution(ctx, m, id, party);
    return evolving(into(mon) && [{ uid: mon.uid, into: into(mon) }], into);
  }
  if (kind === 'evolve') {

    if ((ctx.tradeEvolution ?? ABSENT_TRADE_EVOLUTION) === 'level') return no;
    return evolving(cordEvolutions(ctx, mon, party), m => cordEvolutions(ctx, m, party));
  }
  if (kind === 'tm') {
    const move = tmMove(id);
    if (!move) return no;
    const values = { mon: p(monName(mon, sim, names), '은/는'), move: p(names.move(move), '을/를') };
    if (mon.set.moves.includes(move)) return { ok: false, reason: say(lang, 'panel.knows', values) };
    if (!canLearnTm(sim, mon.set.species, id)) return { ok: false, reason: say(lang, 'panel.cannotLearn', values) };
    return { ok: true, teach: move };
  }

  const change = (kind === 'train' || kind === 'key') && itemChange(id);
  if (!change) return no;
  const item = OUTSIDE_ITEMS[id], cost = item.cost ?? 1;
  const result = ITEM_CHANGES[change].check(mon, item, { id, ctx, lang, names, p, no, format, party, box, bag });
  if (result.ok && bag && (bag[id] ?? 0) < cost) return { ok: false, reason: say(lang, 'panel.needMore', { item: p(names.item(id), '이/가'), n: cost }) };
  return result;
}

/** Items used on the whole party, like Sacred Ash: no Pokemon to pick */
export const partyWide = id => !!OUTSIDE_ITEMS[toID(id)]?.all;

export function useOps(mon, itemId, ctx, { move, stat, partner, choice } = {}) {
  const { sim } = ctx;
  const id = toID(itemId), kind = itemKind(id, sim), ref = mon ? refOf(mon) : null;
  const ops = [];
  const outside = OUTSIDE_ITEMS[id];
  if (kind === 'medicine') {
    const item = medicineOf(id);
    if (item.all) ops.push({ op: 'heal', ref: 'all', revive: true }); // Sacred Ash: all fainted party members to full HP
    else if (item.revive) ops.push({ op: 'heal', ref, revive: true, ...(item.revive === 'half' ? { hpPercent: 50 } : {}) });
    else if (item.pp) ops.push({ op: 'pp', ref, amount: item.pp, ...(item.oneMove ? { move } : {}) });
    else {
      if (item.heal) ops.push(item.heal === 'full' ? { op: 'heal', ref, hpPercent: 100 } : { op: 'heal', ref, hpAdd: item.heal });
      if (item.cure) ops.push({ op: 'heal', ref, statusOnly: true });
    }
    if (ref && Object.hasOwn(FRIENDSHIP_STEPS, id)) ops.push({ op: 'friendship', ref, source: id }); // herbal medicine is bitter
  } else if (kind === 'candy') ops.push({ op: 'level', ref, delta: 1, candy: true }); // Rare Candy: no EVs
  else if ((kind === 'train' || kind === 'key') && itemChange(id)) ops.push(...ITEM_CHANGES[itemChange(id)].ops(mon, outside, { id, ctx, ref }, { move, stat, partner, choice }));
  else throw new Error(`Not an item used outside battle: ${id}`);
  return [...ops, ...bagOps(id)];
}

const staysWhenUsed = id => OUTSIDE_ITEMS[id]?.kind === 'key' || (isMachineId(id) && !machineUsedUp(id));

function bagOps(id) {
  const cost = OUTSIDE_ITEMS[id]?.cost ?? 1;
  return [{ op: 'item', item: id, delta: -cost, fromBag: true }, ...(staysWhenUsed(id) ? [{ op: 'item', item: id, delta: cost }] : [])];
}

function evItemFriendship(mon, item, ctx) {
  const source = item.friendship ?? 'vitamin', ref = refOf(mon);
  if (source === 'vitamin') return [{ op: 'friendship', ref, source }];
  const amount = friendshipStep(friendshipOf(ctx, mon), source, ruleValues(ctx).friendshipSv);
  return amount ? [{ op: 'friendship', ref, source, amount }] : [];
}

export const canHold = (id, sim, holder = null, gen = null) => !NOT_HOLDABLE.has(itemKind(itemAs(holder, id), sim, ABSENT_TRADE_EVOLUTION, gen)) && !isDexItem(holder, id);

export function holdableItems(state, sim, gen = null) {
  return Object.entries(state.bag ?? {}).filter(([id, n]) => n > 0 && canHold(id, sim, state, gen)).map(([id]) => id);
}

const bagText = (state, id, sim, lang, gen = null) => {
  const as = itemAs(state, id);
  return isCustomItem(as) ? itemLabel(state, id, namesFor(lang, sim)) : `${bagItemName(as, namesFor(lang, sim))}\n${itemDescription(as, sim, lang, gen)}`;
};

export const actions = {
  order: (a, b) => ({ type: 'order', ops: [{ op: 'swap', a: refOf(a), b: refOf(b) }] }),
  deposit: mon => ({ type: 'box', ops: [{ op: 'deposit', ref: refOf(mon) }] }),
  withdraw: mon => ({ type: 'box', ops: [{ op: 'withdraw', ref: refOf(mon) }] }),

  swapIn: (boxMon, partyMon) => ({ type: 'box', ops: [{ op: 'swap', a: refOf(boxMon), b: refOf(partyMon) }] }),
  release: mon => ({ type: 'release', ops: [{ op: 'release', ref: refOf(mon) }] }),
  nickname: (mon, name) => ({ type: 'nickname', ops: [{ op: 'nickname', ref: refOf(mon), name: String(name ?? '').trim() }] }),

  evolveLock: (mon, locked) => ({ type: 'evolvelock', ops: [{ op: 'evolvelock', ref: refOf(mon), locked: locked === true }] }),
  give: (mon, item) => ({ type: 'hold', ops: [{ op: 'hold', ref: refOf(mon), item: itemId(item), fromBag: true }] }),
  take: mon => ({ type: 'hold', ops: [{ op: 'hold', ref: refOf(mon), item: '', fromBag: true }] }),
  /** Throwing away n of an item from the bag */
  toss: (item, n) => ({ type: 'toss', ops: [{ op: 'item', item: itemId(item), delta: -n, fromBag: true }] }),
  boxName: (box, name) => ({ type: 'boxname', ops: [{ op: 'boxname', box, name: String(name ?? '').trim() }] }),
  use: (mon, item, ctx, options) => ({ type: 'use', item: toID(item), ops: useOps(mon, item, ctx, options) }),

  breed: (a, b) => ({ type: 'breed', ops: [{ op: 'breed', a: refOf(a), b: refOf(b) }] }),
  unbreed: () => ({ type: 'breed', ops: [{ op: 'breed', stop: true }] }),

  rest: () => ({ type: 'rest', ops: [{ op: 'rest' }] }),

  lab: (items, place = null) => ({ type: 'lab', ops: [{ op: 'lab', items: items.map(itemId), ...(place ? { place } : {}) }] }),
};

const labWhere = here => (here && typeof here === 'object' ? { open: !!here.open, lab: here.lab ?? null } : { open: !!here, lab: null });

export function labView(state, sim, lang, { here = false, locked = false, open = false } = {}) {
  const at = labWhere(here);
  const names = namesFor(lang, sim);
  const mon = labOf(state)[0] ?? null;
  const research = mon ? { items: mon.lab.items, name: fossilsLine(mon.lab.items, lang, id => itemName(id, names)), icon: itemIcon(mon.lab.items[0], sim),
    done: Math.max(0, LAB_TIME - mon.lab.left), total: LAB_TIME } : null;
  const pill = at.open || !!research;
  const can = new Set(at.open && !locked && !research ? labFossils(state.bag) : []);
  const fossils = at.open ? bagFossils(state.bag).map(id => ({ id, name: itemName(id, names), icon: itemIcon(id, sim), count: state.bag[id], ok: can.has(id) })) : [];
  return { pill, open: pill && !!open, here: at.open, send: can.size > 0, research, fossils, place: labPlaceName(mon ? mon.lab.place : at.lab?.id, lang) };
}

const freshIn = (mon, ui) => !!mon && (ui.fresh ?? []).includes(mon.uid) && !(ui.seen ?? []).includes(mon.uid);

export const heldUids = state => [...new Set([...(state?.party ?? []), ...(state?.box ?? []), ...labOf(state)].flatMap(m => [m?.uid, m?.fused?.uid]).filter(Boolean))];

export function arrivalBase(chat) {
  const at = (chat?.message ?? []).findLastIndex(m => m?.role === 'user');
  return at < 0 ? null : at - 1;
}

export function boxArrivals(state, { before = null, known = null, arrived = [] } = {}) {
  const box = (state?.box ?? []).map(m => m.uid);
  const had = before && new Set(before), drawn = known && new Set(known);
  const kept = arrived.filter(uid => box.includes(uid));
  const late = drawn ? box.filter(uid => !drawn.has(uid)) : [];
  const recent = had ? box.filter(uid => !had.has(uid)) : [];

  const next = [...new Set([...kept, ...late, ...recent])];
  return { fresh: next, known: [...new Set([...(known ?? []), ...heldUids(state)])], arrived: next };
}

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

export const pendingCount = mon => (hatchDue(mon) ? 1 : 0) + (mon?.pending?.moves?.length ?? 0) + (mon?.pending?.evolve ? 1 : 0);

export const levelBadge = mon => (pendingCount(mon) ? Math.max(1, mon.pending?.levels || pendingCount(mon)) : 0);

export function levelUpPlan(mon) {
  return { hatch: hatchDue(mon), moves: [...(mon?.pending?.moves ?? [])], evolve: mon?.pending?.evolve ?? null };
}

export function hatchLook(mon) {
  const { egg: _, ...out } = clone(mon);
  return out;
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

export function recordAction(result) {
  const best = new Map();
  for (const step of result?.done ?? []) {
    const r = step?.record;
    if (!r) continue;
    const one = { game: r.game, level: r.level, score: recordScore(r.score) }, key = `${one.game}:${one.level}`;
    if (validRecord(one) && beatsRecord(one.game, one.score, best.get(key)?.score)) best.set(key, one);
  }
  return best.size ? { type: 'record', ops: [...best.values()].map(r => ({ op: 'amieRecord', ...r })) } : null;
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

export function teachAction(mon, item, move, result, disc = null) {
  if (!result?.learned) return null;

  const id = itemId(item), as = toID(disc ?? item);
  const learnOnly = isMachineId(as) && !machineUsedUp(as);
  return { type: 'use', item: id, ops: [learnOp(mon, move, result), ...(learnOnly ? [] : bagOps(id))] };
}

const chooseMenu = (ui, mon, item, { prompt, choices }, t) => ({ ...ui, menu: { where: 'choose', uid: mon.uid, use: item, text: prompt,
  options: [...choices.map(o => opt('choose', o.label, o.disabled, { item: o.id })), opt('cancel', t('panel.menu.cancel'))] } });

// -- Menus ----------------------------------------

const canRemember = (ctx, mon, state) => rememberableMoves(ctx, mon, state).length > 0;

const opt = (id, label, disabled = false, extra = {}) => ({ id, label, disabled: !!disabled, ...extra });
/** A menu row whose label is screen text panel.menu.<word> in lang */
const row = lang => (id, word, disabled = false, values = {}) => opt(id, say(lang, `panel.menu.${word}`, values), disabled);

const debugRows = (debug, locked, lang) => (debug ? [row(lang)('debugEdit', 'debugEdit', locked)] : []);

export function partyMenu(mon, { state, ctx, locked = false, debug = false }, lang) {
  const r = row(lang);

  if (isEgg(mon)) {
    return [...(hatchDue(mon) ? [r('levelup', 'hatch', locked, { n: levelBadge(mon) })] : []), r('order', 'order', locked || state.party.length < 2),
      r('deposit', 'deposit', locked), ...debugRows(debug, locked, lang), r('cancel', 'cancel')];
  }
  const list = [r('summary', 'summary')];

  if (pendingCount(mon)) list.push(r('levelup', hatchDue(mon) ? 'hatch' : 'levelUp', locked, { n: levelBadge(mon) }));
  list.push(r('remember', 'remember', locked || !canRemember(ctx, mon, state)));
  list.push(r('order', 'order', locked || state.party.length < 2));
  list.push(r('give', 'give', locked || !holdableItems(state, ctx.sim, ctx.formGen ?? null).length));
  if (mon.set.item) list.push(r('take', 'take', locked));
  list.push(r('pet', 'pet', locked || !canPet(mon)));

  list.push(r('deposit', 'deposit', locked || hatchedParty(state).length <= 1));
  list.push(...debugRows(debug, locked, lang), r('cancel', 'cancel'));
  return list;
}

export function boxMenu(mon, { locked = false, debug = false }, lang) {
  const r = row(lang);
  // An egg: to the party only (an egg cannot be released)
  if (isEgg(mon)) return [r('withdraw', 'withdraw', locked), ...debugRows(debug, locked, lang), r('cancel', 'cancel')];
  return [r('withdraw', 'withdraw', locked), r('summary', 'summary'), r('release', 'release', locked || !!mon.fused), ...debugRows(debug, locked, lang), r('cancel', 'cancel')];
}

export function bagMenu(id, { locked = false, sim, state, trade, gen = null }, lang) {
  const kind = itemKind(itemAs(state, id), sim, trade, gen);
  const r = row(lang);

  if (isRod(toID(id))) return [r('use', 'use', locked || !hatchedParty(state).length), r('cancel', 'cancel')];

  if (kind === 'key' && itemChange(id)) return [r('use', 'use', locked || !state.party.length), r('cancel', 'cancel')];
  if (NOT_TOSSABLE.has(kind)) return null;
  if (isDexItem(state, id)) return [r('use', 'use'), r('cancel', 'cancel')];
  const list = [];

  const item = OUTSIDE_ITEMS[toID(id)];
  if (USABLE.has(kind) && item?.gmax) list.push(r('use', 'soup', locked || !state.party.length || (state.bag?.[toID(id)] ?? 0) < item.cost, { n: item.cost }));
  else if (USABLE.has(kind)) list.push(r('use', 'use', locked || !state.party.length));
  if (!NOT_HOLDABLE.has(kind)) list.push(r('give', 'hold', locked || !state.party.length));

  if (!isZCrystalId(toID(id))) list.push(r('toss', 'toss', locked));
  list.push(r('cancel', 'cancel'));
  return list;
}

// -- Values to draw -----------------------------------------------

export const boxCount = state => Math.max(BOX_COUNT, Math.ceil((state.box?.length ?? 0) / BOX_SIZE));
/** Name of box index (from 0): its given name, else the default name in lang */
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
      hpClass: 'high', status: '', fainted: false, exp: null, item: '', badge: levelBadge(mon), pet: false, enjoy: 0, held: null };
  }
  const names = namesFor(lang, sim);
  const species = sim.Dex.species.get(heldItemForm(sim.Dex, mon.set).species);
  const max = maxHp(sim, mon.set, stateFormat(state)); // in the rule the state's HP is in (ruleOf)
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

export const pokeapiItemUrl = id => pokeapiItemFile(toID(id));

const BAG_FRAMES = new Map(bagIcons.items.textures[0].frames.map(f => [f.filename, f]));
export function itemIcon(id, sim) {
  const key = toID(id);
  const move = tmMove(key);
  const frame = BAG_FRAMES.get(move ? `tm_${toID(sim.Dex.moves.get(move).type)}` : key);

  const mark = machineMark(key);
  if (frame) return { sheet: 'pokerogue', x: frame.frame.x, y: frame.frame.y, w: frame.frame.w, h: frame.frame.h, ox: frame.spriteSourceSize.x, oy: frame.spriteSourceSize.y, ...(mark ? { mark } : {}) };
  const url = pokeapiItemUrl(key);
  return url ? { url } : null;
}

export const BAG_GROUPS = Object.freeze(['medicine', 'ball', 'battle', 'tm', 'other', 'treasure', 'key']); // labels: screen text panel.group.<group>
const GROUP_OF = { candy: 'other', train: 'other', stone: 'other', evolve: 'other', held: 'other', field: 'other', custom: 'other' };

const OTHER_RANK = { train: 0, candy: 0, stone: 1, evolve: 1, held: 2, field: 3, custom: 4 };

export const bagGroup = (id, sim, trade, gen = null) => { if (isZCrystalId(toID(id))) return 'key'; const kind = itemKind(id, sim, trade, gen); return GROUP_OF[kind] ?? kind; };

const ORDER = [...Object.keys(BAG_ITEMS), ...Object.keys(BALLS), 'rarecandy', ...Object.keys(OUTSIDE_ITEMS), ...Z_CRYSTALS];
export function bagView(state, sim, lang, trade, gen = null) {
  const names = namesFor(lang, sim);
  const rank = id => (ORDER.includes(id) ? ORDER.indexOf(id) : ORDER.length);
  const rows = Object.entries(state.bag ?? {}).filter(([, n]) => n > 0).map(([id, count]) => {

    const as = itemAs(state, id);
    const kind = itemKind(as, sim, trade, gen);

    const info = kind === 'custom' ? customInfo(state, id) : null;
    const owner = ITEM_EFFECTS_READY && info?.owner ? ownerName(state, id, species => displayName(sim.Dex, names, species, '')) : '';
    const tag = ITEM_EFFECTS_READY ? [info?.effect && say(lang, `panel.tag.${info.effect}`), owner].filter(Boolean).join(' · ') : '';
    return { id, count, name: itemLabel(state, id, names, { bag: true }), kind, icon: kind === 'custom' ? { emoji: info?.emoji ?? '' } : itemIcon(as, sim),
      group: bagGroup(as, sim, trade, gen), ...(tag ? { tag } : {}), as };
  }).sort((a, b) => (a.group === 'other' && b.group === 'other' ? (OTHER_RANK[a.kind] ?? 9) - (OTHER_RANK[b.kind] ?? 9) : 0) || rank(a.as) - rank(b.as) || (a.kind === 'tm' && b.kind === 'tm' ? machineOrder(a.as, b.as) : a.name.localeCompare(b.name, lang)))
    .map(({ as, ...row }) => row);
  return BAG_GROUPS.map(group => ({ group, label: say(lang, `panel.group.${group}`), items: rows.filter(r => r.group === group) })).filter(g => g.items.length);
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

export function panelModel({ state, ctx, lang, locked = false, resume = false, debug = false, offer = null, travel = null, compat = !!travel, dexHome = null,
  dexRegions = [], dexMentions = [], ui, screen = null, money = state.money === null ? null : state.money ?? 0, labHere = false }) {
  const { sim } = ctx;
  const party = Array.from({ length: PARTY_MAX }, (_, i) => (state.party[i] ? slotView(state.party[i], ctx, state, lang) : null));
  const count = boxCount(state);
  const index = Math.max(0, Math.min(count - 1, ui.box ?? 0));
  const cells = Array.from({ length: BOX_SIZE }, (_, i) => {
    const mon = state.box[index * BOX_SIZE + i];
    return mon ? { ...slotView(mon, ctx, state, lang), fresh: freshIn(mon, ui) } : null;
  });
  const tabs = TABS;
  const tab = tabs.includes(ui.tab) ? ui.tab : 'party';
  const subs = travelSubs({ trip: !!(compat && travel), badges: !!(compat || debug) }), sub = travelSub(ui, subs);
  const setSubs = settingsSubs({ bot: !!(compat && travel) }), setSub = settingsSub(ui, setSubs);
  // the box: a Pokemon new in the box not seen yet (freshIn)
  const alerts = { party: state.party.some(m => pendingCount(m) > 0), box: state.box.some(m => freshIn(m, ui)), bag: false };
  return {
    lang, open: !!ui.open, tab, tabs, travel: compat ? travel : null, compat: !!compat, subs, sub, setSubs, setSub, locked, resume: !!resume, screen,
    pick: tab === 'party' && PICKS.includes(ui.pick) ? pickView(ui.pick, state, ctx, lang, locked) : null,
    dex: tab === 'travel' && sub === 'dex' && !screen ? dexView({ state, sim, lang, names: namesFor(lang, sim), ui, home: dexHome, regions: dexRegions, mentions: dexMentions, gen: ctx.formGen ?? null }) : null,
    alerts,
    party, box: { index, count, name: boxName(state, index, lang), cells },
    lab: labView(state, sim, lang, { here: labHere, locked, open: ui.lab }),
    bag: { money, groups: bagView(state, sim, lang, ctx.tradeEvolution, ctx.formGen ?? null) },
    add: debug ? addable(state, locked) : null, debug: !!debug,
    heal: debug ? !locked : null,
    rest: restView(state, sim, locked),
    offer: offer && !locked ? { note: !!offer.note, button: !!offer.button } : null,
    breeding: breedingView(state, ctx, lang),

    breedPick: ui.select?.mode === 'breed', fusePick: ui.select?.mode === 'fuse' ? ui.select.list : null, // the partners a fusion can take (the rest greyed)
    breedable: !locked && hatched(state.party).length >= 2,

    breedPill: (!locked && hatched(state.party).length >= 2) || !!state.breeding,
    pairShown: !ui.pairHidden || ui.select?.mode === 'breed',
    badges: badgeCaseModel(state, lang, { gym: ui.gym, debug, locked, icon: id => itemIcon(id, sim), monLabel: mon => displayName(sim.Dex, namesFor(lang, sim), mon.species, mon.name) }),
    picked: ui.ask?.uid ?? ui.menu?.uid ?? ui.select?.uid ?? ui.menu?.item ?? ui.select?.item ?? ui.count?.item ?? null,

    window: (screen && !ui.message ? screen.window : null) ?? windowOf(ui, lang, sim),
    bar: { on: !!ui.gathered && !ui.open, alert: !!resume || Object.values(alerts).some(Boolean) },
  };
}

function pickView(kind, state, ctx, lang, locked) {
  const mons = hatched(state.party);
  const why = kind === 'train' ? mon => trainBlock(mon, ctx, locked) : mon => (locked ? 'battle' : canPet(mon) ? null : 'fainted');
  const blocks = mons.map(why);

  const all = locked ? 'battle' : kind === 'train' && !effortOn(ctx.sim, ruleFormat(ctx.rule)) ? 'noEffort' : null;
  const hint = kind === 'train' ? (all ? `panel.trainWhy.${all}` : 'panel.trainHint') : (all === 'battle' ? 'panel.amieLocked' : 'panel.amieHint');
  return { kind, hint, slots: mons.map((mon, i) => ({ ...slotView(mon, ctx, state, lang), off: !!blocks[i] })) };
}

const addable = (state, locked) => ({ party: !locked && state.party.length < PARTY_MAX, box: !locked, bag: !locked });

function healChanges(state, ctx) {
  const { sim } = ctx, format = stateFormat(state);
  const look = mon => JSON.stringify([mon.hp ?? maxHp(sim, mon.set, format), mon.status || '', mon.set.moves.map(m => movePp(sim, mon, m, format).pp)]);
  const healed = clone(state);
  healParty(healed, ctx);

  return (state.restsUsed ?? 0) > 0 || state.party.some((mon, i) => look(mon) !== look(healed.party[i]));
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
        // Silver Bottle Cap: stat to train (greyed out when the IV is already 31)
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

// -- Press handling ---------------------------------------------

export const initialUi = () => ({ open: false, gathered: true, tab: 'party', box: 0, lab: false, fresh: [], seen: [], menu: null, select: null, ask: null, moves: null, stats: null, count: null, message: null, gym: null, screen: null, pairHidden: false,
  sub: null, dex: null, dexOpen: null, pick: null, setsub: null });
// (also closes the badge sub-tab's enlarged view and the Pokedex's detail)
const calm = ui => ({ ...ui, menu: null, select: null, ask: null, moves: null, stats: null, count: null, message: null, gym: null, dexOpen: null });
const findIn = (list, uid) => list.find(m => m.uid === uid) ?? null;

const folded = ui => ({ ...ui, open: false, pick: null });
const fold = ui => ({ ui: folded(ui), effect: null });

const outside = (ui, always, stay = false) => (ui.open ? (stay ? { ui, effect: null } : fold(ui)) : always ? { ui, effect: null } : { ui: { ...ui, gathered: true }, effect: null });

export function openUi(ui, mode, was = mode) {
  if (openWays(mode).always) return ui.gathered ? { ...ui, gathered: false } : ui;
  return openWays(was).always && !ui.open && !ui.gathered ? { ...ui, gathered: true } : ui;
}

export function backStep(ui) {
  if (!ui.open) return null;
  if (ui.message) return { t: 'msg' };
  if (ui.ask) return { t: 'no' };
  if (ui.moves || ui.stats || ui.count || ui.menu || ui.select) return { t: 'opt', id: 'cancel' };
  if (ui.gym) return { t: 'gymClose' };
  if (ui.dexOpen) return { t: 'dexClose' };
  if (ui.screen) return { t: 'scBack' };
  if (ui.pick && ui.tab === 'party') return { t: 'pickBack' };
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
/** Picking the breeding pair: uid = the first one picked (null = none yet) */
const breedPick = (uid, w) => ({ mode: 'breed', uid, text: w.t('panel.breed.pick', { n: uid ? 1 : 0 }) });

export function reduce(ui, hit, { state, ctx, lang, locked = false, debug = false, place = DEFAULT_SCREEN_PLACE, open = DEFAULT_PANEL_OPEN, stay = false, labHere = false }) {
  if (hit?.t === 'back') {
    const step = backStep(ui);
    return step ? reduce(ui, step, { state, ctx, lang, locked, debug, place, open, stay, labHere }) : { ui, effect: null };
  }
  const env = { state, ctx, locked, debug, always: openWays(open).always, stay: !!stay, labHere, panel: place === 'panel', w: wordsOf(lang, ctx.sim, state) };
  const out = hit?.t?.startsWith('gym') ? badgePress(ui, hit, { state, lang, debug, locked })
    : hit?.t?.startsWith('dex') ? dexPress(ui, hit, { state, sim: ctx.sim, lang })
    : hit?.t?.startsWith('sc') ? screenPress(ui, hit, env) : reduceRaw(ui, hit, env);

  if (locked && out.effect && !LOCK_FREE_EFFECTS.has(out.effect.kind)) return { ui: out.ui, effect: null };
  return out;
}

const LOCK_FREE_EFFECTS = new Set(['summary', 'rename', 'renameBox', 'resume', 'tale', 'settings']);

function wordsOf(lang, sim, state) {
  const names = namesFor(lang, sim);
  return {
    lang, names, t: (key, values) => say(lang, key, values), p: (word, pair) => withParticle(lang, word, pair),
    // an egg is "the egg" in every window line, never what hatches from it
    mon: mon => (isEgg(mon) ? say(lang, 'panel.egg') : monName(mon, sim, names)), label: id => itemLabel(state, id, names),
  };
}

function reduceRaw(ui, hit, env) {
  const { state, ctx, locked, debug, panel, w, always, stay, labHere } = env;
  const { sim } = ctx;
  const same = { ui, effect: null };
  const party = state.party, box = state.box;
  if (menuCloses(ui, hit)) return { ui: { ...ui, menu: null }, effect: null };
  switch (hit?.t) {
    case 'tab':

      if (ui.open && ui.tab === hit.tab) return ui.screen ? { ui: { ...calm(ui), screen: null }, effect: null } : ui.pick ? { ui: { ...calm(ui), pick: null }, effect: null } : fold(ui);

      if (ui.tab === hit.tab) return { ui: { ...ui, open: true }, effect: null };
      return { ui: { ...calm(ui), open: true, tab: hit.tab, screen: null, pick: null }, effect: null };
    case 'fold': return fold(ui);
    case 'bar': return { ui: { ...ui, gathered: false }, effect: null };
    case 'outside': return outside(ui, always, stay);
    case 'sub': return { ui: { ...calm(ui), ...(SETTINGS_SUBS.includes(hit.sub) ? { setsub: hit.sub } : { sub: hit.sub }) }, effect: null };

    case 'pick': return PICKS.includes(hit.pick) ? { ui: { ...calm(ui), tab: 'party', screen: null, pick: hit.pick }, effect: null } : same;
    case 'pickBack': return { ui: { ...calm(ui), pick: null }, effect: null };
    case 'lvnext': {
      const mon = findIn(party, hit.uid);
      return mon && !locked ? levelUpNext(ui, mon) : same;
    }
    case 'resume': return { ui: folded(calm(ui)), effect: { kind: 'resume' } };

    case 'msg': return ui.message?.then ? { ui: folded(calm(ui)), effect: ui.message.then } : { ui: { ...ui, message: null }, effect: null };
    case 'no': return { ui: { ...ui, ask: null }, effect: null };

    case 'lab': return labView(state, sim, w.lang, { here: labHere }).pill || ui.lab ? { ui: { ...calm(ui), lab: !ui.lab }, effect: null } : same;

    case 'labFossil': return labView(state, sim, w.lang, { here: labHere, locked }).fossils.some(f => f.id === hit.item && f.ok) ? labPick(calm(ui), hit.item, null, env) : same;

    case 'seen': return freshIn(findIn(box, hit.uid), ui) ? { ui: { ...ui, seen: [...ui.seen ?? [], hit.uid] }, effect: null } : same;
    case 'labSend': {
      if (!labView(state, sim, w.lang, { here: labHere, locked }).send) return same;
      const options = [...labFossils(state.bag).map(id => opt('fossil', `${w.label(id)} ×${state.bag[id]}`, false, { item: id })), opt('cancel', w.t('panel.menu.cancel'))];
      return { ui: { ...calm(ui), menu: { where: 'lab', text: w.t('panel.lab.pick'), options } }, effect: null };
    }
    case 'boxnav': {
      const count = boxCount(state);
      return { ui: { ...calm(ui), box: ((ui.box ?? 0) + hit.d + count) % count }, effect: null };
    }
    case 'boxname': // also works during battle
      return { ui: calm(ui), effect: { kind: 'renameBox', box: Math.max(0, Math.min(boxCount(state) - 1, ui.box ?? 0)) } };
    case 'badge': {
      const mon = findIn(party, hit.uid);
      if (locked || !mon || !pendingCount(mon)) return same;
      return panel ? levelUpNext(calm(ui), mon) : { ui: calm(ui), effect: { kind: 'levelup', uid: mon.uid } };
    }
    case 'yes': {
      const ask = ui.ask;
      if (!ask) return same;
      if (ask.kind === 'lab') {
        if (locked || !ask.items.every(id => state.bag?.[id] > 0)) return { ui: calm(ui), effect: null };
        return { ui: calm(ui), effect: { kind: 'queue', action: actions.lab(ask.items, labWhere(labHere).lab?.id), after: w.t('panel.lab.sent', { item: w.p(labName(ask.items, w), '을/를') }) } };
      }
      const mon = findIn(box, ask.uid) ?? findIn(party, ask.uid);
      if (!mon) return { ui: { ...ui, ask: null }, effect: null };
            // Ability Capsule / Patch: "change it?" -> yes
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
    case 'train': {
      const mon = findIn(party, hit.uid);
      if (!mon || trainBlock(mon, ctx, locked)) return same;
      return { ui: calm(ui), effect: { kind: 'train', uid: mon.uid } };
    }

    case 'breed': {
      // a pair's band is only the view: hidden / shown also during battle
      if (state.breeding && ui.select?.mode !== 'breed') return { ui: { ...calm(ui), pairHidden: !ui.pairHidden }, effect: null };
      if (locked || hatched(state.party).length < 2) return same;
      if (ui.select?.mode === 'breed') return { ui: calm(ui), effect: null };
      return { ui: { ...calm(ui), pairHidden: false, select: breedPick(null, w) }, effect: null };
    }
    case 'rebreed': return locked || !state.breeding || hatched(state.party).length < 2 ? same : { ui: { ...calm(ui), pairHidden: false, select: breedPick(null, w) }, effect: null };
    case 'unbreed': return locked || !state.breeding ? same : { ui: { ...calm(ui), pairHidden: false }, effect: { kind: 'queue', action: actions.unbreed() } };
    case 'later': return locked ? same : { ui: calm(ui), effect: { kind: 'importLater' } };
    case 'botSet': return locked ? same : { ui: calm(ui), effect: { kind: 'botTravel', change: { key: hit.key, on: !!hit.on } } };

    case 'tale': return Object.values(TALE_ROWS).flat().includes(hit.key) && !(locked && hit.key === 'battles') ? { ui: calm(ui), effect: { kind: 'tale', key: hit.key, value: hit.value } } : same;
    case 'allSettings': return { ui: calm(ui), effect: { kind: 'settings' } };
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
      const menu = bagMenu(hit.item, { locked, sim, state, trade: ctx.tradeEvolution, gen: ctx.formGen ?? null }, w.lang);
      const text = bagText(state, hit.item, sim, w.lang, ctx.formGen ?? null);
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

function useAfter(mon, id, ctx, w, { stat, move, partner, choice } = {}) {
  const { t, p } = w;
  const outside = OUTSIDE_ITEMS[id] ?? {}, change = itemChange(id);
  if (outside.all) return t('panel.usedAll');
  return (mon && change && ITEM_CHANGES[change].after(mon, outside, w, { id, ctx, stat, move, partner, choice }))
    || t('panel.used', { mon: mon ? w.mon(mon) : '', item: p(itemName(id, w.names), '을/를') });
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
    // picked: a new Pokemon's "!" goes too (freshIn)
    const seen = freshIn(mon, ui) ? { seen: [...ui.seen ?? [], mon.uid] } : {};
    return { ui: { ...calm(ui), ...seen, menu: { where: 'box', uid: mon.uid, text, options: boxMenu(mon, { locked, debug }, w.lang) } }, effect: null };
  }
  const mon = findIn(state.party, hit.uid);
  if (!mon) return { ui, effect: null };
  const select = ui.select;
  if (select) {
    if (locked) return { ui: calm(ui), effect: null };
    // Nothing is used on or given to an egg: say so and keep picking
    if (isEgg(mon) && ['give', 'use', 'fuse'].includes(select.mode)) return { ui: { ...ui, message: { text: t('panel.eggNo') } }, effect: null };
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
        // Shelmet and Karrablast swapping places evolve (the trade by level)
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

        const disc = storyDisc(state, select.item);
        const check = useCheck(mon, disc ?? select.item, ctx, w.lang, state.party, stateFormat(state), state.bag, state.box);
                // No effect: show the text and keep picking
        if (!check.ok) return { ui: { ...ui, message: { text: check.reason } }, effect: null };
        if (check.evolutions) return { ui: calm(ui), effect: { kind: 'evolve', item: select.item, evolutions: check.evolutions } };
        if (check.teach) return panel ? learnOpen(calm(ui), mon, check.teach, { kind: 'tm', item: select.item, ...(disc ? { disc } : {}) })
          : { ui: calm(ui), effect: { kind: 'teachTm', uid: mon.uid, item: select.item, ...(disc ? { disc } : {}), move: check.teach } };
        if (check.moves) return { ui: { ...calm(ui), moves: { uid: mon.uid, item: select.item, list: check.moves, prompt: check.prompt } }, effect: null };
        if (check.stats) return { ui: { ...calm(ui), stats: { uid: mon.uid, item: select.item, list: check.stats } }, effect: null };
        // a fusion item: the second pick (its partner in the party)
        if (check.partners) return { ui: { ...calm(ui), select: { mode: 'fuse', uid: mon.uid, item: select.item, list: check.partners, text: check.prompt } }, effect: null };

        if (check.choices) return { ui: chooseMenu(calm(ui), mon, select.item, check, t), effect: null };
        if (check.confirm) return { ui: { ...calm(ui), ask: { kind: 'use', uid: mon.uid, item: select.item, text: check.confirm } }, effect: null };
        return { ui: calm(ui), effect: useEffect(mon, select.item, ctx, w) };
      }

      case 'fuse': {
        const first = findIn(state.party, select.uid);
        if (!first || first.uid === mon.uid || !(state.bag?.[select.item] > 0)) return { ui: calm(ui), effect: null };
        if (!select.list.includes(mon.uid)) return { ui: { ...ui, message: { text: noEffect(w.lang) } }, effect: null };
        return { ui: calm(ui), effect: useEffect(first, select.item, ctx, w, { partner: mon }) };
      }
      default: return { ui: calm(ui), effect: null };
    }
  }
  const text = isEgg(mon) ? eggText(mon, w, debug) : t('panel.partyAsk');
  return { ui: { ...calm(ui), menu: { where: 'party', uid: mon.uid, text, options: partyMenu(mon, { state, ctx, locked, debug }, w.lang) } }, effect: null };
}

const labName = (items, w) => fossilsLine(items, w.lang, id => w.label(id));

function labPick(ui, id, first, { state, w }) {
  const { t, p } = w;
  if (!first && isHalf(id)) {
    const options = [...halvesFor(id).filter(other => state.bag?.[other] > 0).map(other => opt('fossil', `${w.label(other)} ×${state.bag[other]}`, false, { item: other })),
      opt('cancel', t('panel.menu.cancel'))];
    return { ui: { ...ui, menu: { where: 'labPair', item: id, text: t('panel.lab.pair', { item: p(w.label(id), '을/를') }), options } }, effect: null };
  }
  const items = first ? [first, id] : [id];
  return { ui: { ...ui, ask: { kind: 'lab', items, text: t('panel.lab.ask', { item: p(labName(items, w), '을/를') }) } }, effect: null };
}

function optionPress(ui, hit, { state, ctx, panel, w }) {
  const { sim } = ctx;
  const { t, p } = w;
  if (hit.id === 'cancel') {
        // Cancelling the pick of a Pokemon to swap returns to the box
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
        const options = [...holdableItems(state, sim, ctx.formGen ?? null).map(id => opt('pick', `${w.label(id)} ×${state.bag[id]}`, false, { item: id })), opt('cancel', t('panel.menu.cancel'))];
        return { ui: { ...calm(ui), menu: { where: 'give', uid: mon.uid, text: t('panel.giveAsk', { mon: w.mon(mon) }), options } }, effect: null };
      }
      case 'take': return { ui: calm(ui), effect: { kind: 'queue', action: actions.take(mon), after: t('panel.took', { mon: w.mon(mon), item: p(w.label(mon.set.item), '을/를') }) } };
      case 'deposit': return { ui: calm(ui), effect: { kind: 'queue', action: actions.deposit(mon), after: t('panel.deposited', { mon: p(w.mon(mon), '을/를') }) } };
      default: return { ui: calm(ui), effect: null };
    }
  }
  if (menu.where === 'lab' || menu.where === 'labPair') {
    const id = hit.item;
    if (hit.id !== 'fossil' || !(state.bag?.[id] > 0)) return { ui: calm(ui), effect: null };
    return labPick(calm(ui), id, menu.where === 'labPair' ? menu.item : null, { state, w });
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
                // Full party: "choose the Pokemon to swap"
        return { ui: { ...calm(ui), tab: 'party', select: { mode: 'swapin', uid: mon.uid, text: t('panel.swapAsk', { mon: p(w.mon(mon), '과/와') }) } }, effect: null };
      case 'release': return { ui: { ...calm(ui), ask: { kind: 'release', uid: mon.uid, text: t('panel.releaseAsk', { mon: p(w.mon(mon), '을/를') }) } }, effect: null };
      default: return { ui: calm(ui), effect: null };
    }
  }

  if (menu.where === 'choose') {
    const mon = findIn(state.party, menu.uid);
    if (!mon || hit.id !== 'choose' || !(state.bag?.[menu.use] > 0)) return { ui: calm(ui), effect: null };
    const next = ITEM_CHANGES[itemChange(menu.use)]?.choose?.(mon, OUTSIDE_ITEMS[menu.use], { id: menu.use, ctx, lang: w.lang, names: w.names }, hit.item);
    if (next?.choices) return { ui: chooseMenu(calm(ui), mon, menu.use, next, t), effect: null };
    if (next?.teach) return panel ? learnOpen(calm(ui), mon, next.teach, { kind: 'tm', item: menu.use })
      : { ui: calm(ui), effect: { kind: 'teachTm', uid: mon.uid, item: menu.use, move: next.teach } };
    return { ui: calm(ui), effect: useEffect(mon, menu.use, ctx, w, { choice: hit.item }) };
  }
  if (menu.where === 'bag') {
    const item = menu.item;

    if (hit.id === 'use' && isDexItem(state, item)) return { ui: { ...calm(ui), tab: 'travel', sub: 'dex', screen: null }, effect: null };

    if (hit.id === 'use' && isRod(toID(item))) return hatchedParty(state).length ? { ui: calm(ui), effect: { kind: 'fish', rod: toID(item) } } : { ui: calm(ui), effect: null };
    if (hit.id === 'use' && partyWide(item)) {

      if (!state.party.some(m => m.hp === 0)) return { ui: { ...calm(ui), message: { text: noEffect(w.lang) } }, effect: null };
      return { ui: calm(ui), effect: { kind: 'queue', action: { type: 'use', item: toID(item), ops: useOps(null, item, ctx) }, after: useAfter(null, toID(item), ctx, w) } };
    }
    if (hit.id === 'use') return { ui: { ...calm(ui), tab: 'party', select: { mode: 'use', item, text: t('panel.useAsk', { item: p(w.label(item), '을/를') }) } }, effect: null };
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

export const ASKING = new Set(['ask', 'pick', 'forget', 'giveup']);

export function liveScreen(screen, { state, ctx, locked = false }) {
  if (!screen) return null;
  const party = findIn(state.party, screen.uid), mon = party ?? findIn(state.box, screen.uid);
  if (!mon || isEgg(mon)) return null;
  if (screen.kind === 'summary') return screen;
  if (locked || !party) return null;
  if (screen.kind === 'remember') return canRemember(ctx, mon, state) ? screen : null;
  if (screen.kind !== 'learn' || !ASKING.has(screen.step)) return screen;
  if (screen.source.kind === 'levelup') return mon.pending?.moves?.includes(screen.move) ? screen : null;
  if (mon.set.moves.includes(screen.move)) return null;
  return screen.source.kind !== 'tm' || state.bag?.[screen.source.item] > 0 ? screen : null;
}

function learnAction(mon, move, source, result) {
  if (source.kind === 'remember') return rememberAction(mon, { move, ...result });
  if (source.kind === 'tm') return teachAction(mon, source.item, move, result, source.disc);
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
      const at = rememberableMoves(ctx, mon, state).findIndex(m => m.move === screen.move);
      return { ui: { ...calm(ui), screen: { ...rememberScreen(mon), move: Math.max(0, at) } }, effect: null };
    }
    return { ui: { ...calm(ui), screen: null }, effect: null };
  }
  if (screen.kind === 'summary') {
    if (hit.t === 'scPage' && SUMMARY_PAGES.includes(hit.page)) return set({ page: hit.page });
    if (hit.t === 'scStat' && statModes(ctx).includes(hit.mode)) return set({ stat: hit.mode });
    if (hit.t === 'scMove' && mon.set.moves[hit.i]) return set({ move: hit.i });
    if (hit.t === 'scLock' && !isEgg(mon) && !evolutionHeld(ctx.sim.Dex, pairMon(mon))) return { ui, effect: { kind: 'queue', action: actions.evolveLock(mon, mon.evolveLocked !== true) } };
    if (hit.t === 'scNav') {
      const list = hatched(state.party), at = list.findIndex(m => m.uid === mon.uid);
      if (at < 0 || list.length < 2) return same;
      return set({ uid: list[(at + hit.d + list.length) % list.length].uid, move: 0 });
    }

    if (hit.t === 'scMon') {
      const list = hatched(state.party);
      return list.some(m => m.uid === mon.uid) && list.some(m => m.uid === hit.uid) && hit.uid !== mon.uid ? set({ uid: hit.uid, move: 0 }) : same;
    }
    return same;
  }
  if (screen.kind === 'remember') {
    const list = rememberableMoves(ctx, mon, state);
    if (hit.t === 'scMove' && list[hit.i]) return set({ move: hit.i });
    if (hit.t === 'scRemember' && list[screen.move]) return learnOpen(ui, mon, list[screen.move].move, { kind: 'remember' });
    return same;
  }
  // the learn screen
  switch (`${screen.step} ${hit.t}`) {
    case 'ask scYes': return set({ step: 'pick', show: 0 }); // nothing picked yet (the new move's description)
    case 'ask scNo': case 'pick scNo': return set({ step: 'giveup' });
    case 'giveup scNo': return set({ step: 'ask' });
    case 'giveup scYes': return decide(ui, mon, { ...screen, step: 'skipped' }, { learned: false });
    case 'pick scForget': return mon.set.moves[screen.show - 1] ? set({ step: 'forget' }) : same;
    case 'forget scNo': return set({ step: 'pick' }); // back to choosing, on the same move
    case 'forget scYes': {
      const forgot = mon.set.moves[screen.show - 1];
      return forgot ? decide(ui, mon, { ...screen, step: 'done', forgot }, { learned: true, forgot }) : same;
    }
    case 'done scOk': case 'learned scOk': case 'skipped scOk': {
      if (screen.source.kind === 'levelup') return levelUpNext(ui, mon);
      // a reminder move not learned: back to the list, on that move
      if (screen.source.kind === 'remember' && screen.step === 'skipped') {
        const at = rememberableMoves(ctx, mon, state).findIndex(m => m.move === screen.move);
        return { ui: { ...ui, screen: { ...rememberScreen(mon), move: Math.max(0, at) } }, effect: null };
      }
      return { ui: { ...ui, screen: null }, effect: null };
    }
    default:

      if (hit.t === 'scMove' && Number.isInteger(hit.i) && hit.i >= 0 && hit.i <= mon.set.moves.length) {
        if (screen.step === 'pick' && hit.i > 0 && hit.i === screen.show) return set({ step: 'forget' });
        if (screen.step === 'forget') return hit.i === screen.show ? same : set({ step: 'pick', show: hit.i });
        return set({ show: hit.i });
      }
      return same;
  }
}
