import { findBlocks, findTags, parseChange, parseBattle, battlesIn, hashKey, seededIndex, speciesName, sharedForms, pickForm, messageId, norm, stripBlocksRead, lookupId } from './blocks.mjs';
import { expForLevel, calcExpGain, growthOf as growthOfSpecies, DEFAULT_EXP_RATE, storyExpRate, STORY_EXP_PACE } from '../engine/exp.mjs';
import { STATS, STATUS_IDS, battleOnlyBase, completeSet, fixedTeraType, autoTeraType, formGimmickMissing, formItemMissing, learnsetOf, toID, gmaxOf, takesMaxSoup, DYNAMAX_LEVEL_MAX } from '../engine/mon.mjs';
import { levelEvolution, usesHeldItem, extraEvolutions, countOf, evolutionStops, ABSENT_TRADE_EVOLUTION, EVOLVE_FRIENDSHIP, lockMark, genMark } from '../engine/evolution.mjs';
import { engineMember } from '../engine/input.mjs';
import { escapeRe } from './norm.mjs';
import { BAG_ITEMS, isBall, foodHeal } from '../engine/bag.mjs';
import { ppUpCount } from '../engine/pp.mjs';
import { DEFAULT_FORMAT, DEFAULT_RULE, formatRules, ruleFormat, formatRule } from '../engine/rules.mjs';
import { waitingTrainer } from '../engine/core.mjs';
import { HYPER_TRAIN_LEVEL, OUTSIDE_ITEMS, Z_RING_NAMES, DYNAMAX_BAND_NAMES, isZCrystalId, steedBase, formMoveOwners, EXP_SHARE } from './items.mjs';
import { say } from './screen-text.mjs';
import { isCustomItem, itemId, customInfo, addCustomItem, tidyCustomItems, storyDisc, itemAs } from './custom-items.mjs';
import { TOOL_EFFECTS, ownerMonOf } from './tools.mjs';
import { ITEM_EFFECTS_READY } from './item-effects.mjs';
import { PARTY_MAX, MAX_LEVEL, MAX_MOVES, MAX_IV, EV_STAT_MAX, EV_TOTAL_MAX, OT_NAME_MAX, BOX_NAME_MAX, PLAYER_NAME } from './rules.mjs';
import { bossBgm, personalName } from './named.mjs';
import { foeGimmicks as foeGimmicksOf, dynamaxHere } from './gimmicks.mjs';
import { outcomeOf } from './outcome.mjs';
import { opponentPicture, foePartnerPicture } from './trainer-look.mjs';
import { readStored, isRecord } from './stored.mjs';
import { ruleError, ruleNote } from './failure.mjs';
import { surveyBattles, dropOocs } from './chat.mjs';
import { statusIn, latestStatus, battleScene, battleRegion, COMPAT_LINE_RE, FIELD_WEATHERS, compatPartnerStart, COMPAT_PARTNER_VARS } from './compat.mjs';
import { badgeCount, earnedBadges, readLeague, leaguePlaces, leagueAt, leagueDate, keepRecords, LEAGUE_VAR, UNOVA_ERA_VAR } from './badges.mjs';
import { changeFriendship, moveFriendship, friendshipStep, baseFriendship, friendshipLocked, FRIEND_BALL_FRIENDSHIP, FRIENDSHIP_STEPS, FRIENDSHIP_STEPS_SV, FOND_FRIENDSHIP } from '../engine/friendship.mjs';
import { entry as nameEntry, koSpellings } from '../names/index.js';
import { SAVE_VAR } from './save.mjs';
import { boxOf } from './diary.mjs';
import { QUEUE_VAR, runAction } from './acts.mjs';
import { IMPORT_VAR, readImports, applyImport, importPlace, inForce } from './import.mjs';
import { SETTING_CHANGES_VAR, foldValues, ruleValues, rulesAt } from './setting-changes.mjs';
import { BATTLE_RULE_VAR, foldCtxAt, genOption, genRuleOn, evolveGenOf, oneSpecialAt, abilityEraOf } from './battle-rule.mjs';
import { learnGenOf, metGenAt } from './learning.mjs';
import { levelUpAt, evolutionLevelMoves } from '../engine/levelup.mjs';
import { withMachineStandard, machineUsedUp, isMachineId } from './machine-standards.mjs';
import { tmMove } from './item-info.mjs';
import { worldAt, worldKey, discWorld, WORLD_VAR, COMPAT_WORLD_VARS } from './compat-world.mjs';
import { enjoymentOf, setEnjoyment, friendshipFor, afterMessage, ENJOY_STEP, canEat, fullnessOf, setFullness, FULL_PER_FOOD, foodFriendship, parsePuff, puffFriendship,
  FREE_GRADE, puffCount, addPuffs, eatsFood, FULL_MAX } from './amie.mjs';
import { eggChance, breedEgg, giftEgg, eggCycles, hatchSpeed, HATCH_FRIENDSHIP } from '../engine/breeding.mjs';
import { evGain, clearBags, bagOf, traineeOf, setTrainee, isHungBag, setHungBag, refillEnergy, effortFollows, addStatExp, statExpVitamin } from './training.mjs';
import { beatsRecord, recordOf, validRecord } from './amie-games.mjs';
import { LAB_TIME, revivalOf, labOf, isLabId } from './fossil.mjs';

export const TABLE_VAR = '$pkb_states';

export { DEFAULT_FORMAT };
// Fallback when the player's name is unknown (story/rules.mjs - engine p1 name, summary-screen OT, AI text)
export { PLAYER_NAME };

const TYPICAL_BASE_EXP = 60;

const TYPICAL_EV_YIELD = 1, RARE_EV_YIELD = 2, RARE_EV_ODDS = 10;

const BOX_NAME_SLOTS = 100;
const WATER_BIOMES = new Set(['sea', 'seabed', 'lake', 'beach', 'swamp']);
const CAVE_BIOMES = new Set(['cave', 'ice_cave']);

export { toID };
/** Deep copy of state (only JSON-stored values) */
export const clone = value => (value === undefined ? undefined : JSON.parse(JSON.stringify(value))); // undefined stays undefined (JSON has no undefined)

const fail = (rule, values) => { throw ruleError(`state.${rule}`, values); };

// -- Table (chat variable) -----------------------------------------

export function emptyState() {
  return { v: 1, party: [], box: [], bag: {}, money: 0, dex: { seen: [], caught: [] }, trainers: {} };
}

export const trainersOf = state => state?.trainers ?? {};

const trainerKey = battle => norm(personalName(battle));

const emptyTable = () => ({ v: 1, snaps: {}, fills: {}, meta: {}, acts: {} });

export function readTable(chat) {
  const { status, value } = readTableRaw(chat);
  if (status !== 'ok') return emptyTable();
  return { v: 1, snaps: value.snaps ?? {}, fills: value.fills ?? {}, meta: value.meta ?? {}, acts: value.acts ?? {} };
}
const TABLE_PARTS = ['snaps', 'fills', 'meta', 'acts'];
const readTableRaw = chat => readStored(chat?.scriptstate?.[TABLE_VAR], { shape: t => TABLE_PARTS.every(k => t[k] === undefined || isRecord(t[k])) });

export const tableStatus = chat => readTableRaw(chat).status;

export function writeTable(chat, table) {
  chat.scriptstate ??= {};
  chat.scriptstate[TABLE_VAR] = JSON.stringify(table);
}

export function pruneTable(chat, keep = []) {
  if (tableStatus(chat) !== 'ok') return false;
  const table = readTable(chat);
  const tags = new Set(keep), blocks = new Set();
  const readAt = rulesAt(chat);
  (chat.message ?? []).forEach((message, i) => {
    const text = String(message?.data ?? '');
    for (const tag of findTags(text)) tags.add(tag.key);
    for (const block of findBlocks(text, readAt(i))) if (block.kind === 'change') blocks.add(`${messageId(message, i)}:${block.key}`);
  });
  const stale = {
    snaps: key => !tags.has(key), meta: key => !tags.has(key), acts: key => !tags.has(key),
    fills: key => !blocks.has(key.slice(0, key.lastIndexOf(':'))),
  };
  let dropped = false;
  for (const [part, isStale] of Object.entries(stale)) {
    for (const key of Object.keys(table[part])) if (isStale(key)) { delete table[part][key]; dropped = true; }
  }
  if (dropped) writeTable(chat, table);
  return dropped;
}

// -- Current state ----------------------------------------

export const createFolds = () => new Map();
const FOLD_CHATS = 4;
function foldList(folds, chat) {
  const id = chat?.id ?? '';
  let list = folds.get(id);
  if (!list) {
    if (folds.size >= FOLD_CHATS) folds.delete(folds.keys().next().value);
    folds.set(id, list = []);
  }
  return list;
}

export const changeAt = (index, n) => `${index}:${n}`;

export function heldChanges(chat, table = readTable(chat)) {
  return surveyBattles(chat, table).held;
}

export const stateVars = () => [TABLE_VAR, SAVE_VAR, QUEUE_VAR, IMPORT_VAR, SETTING_CHANGES_VAR, BATTLE_RULE_VAR, `$${LEAGUE_VAR}`, `$${UNOVA_ERA_VAR}`, WORLD_VAR, ...new Set([...COMPAT_PARTNER_VARS, ...Object.values(COMPAT_WORLD_VARS)])];

const BOOK_FIELDS = ['badges', 'league', 'gyms'];

const tagUse = (table, survey) => key => {
  const meta = table.meta?.[key];
  const committed = () => survey.battles.get(meta.blockKey)?.committed;
  if (meta?.storyEnd) return committed() === 'story' ? `${key}=${survey.battles.get(meta.blockKey).ended.outcome}` : null;
  if (meta && ![undefined, 'done'].includes(committed())) return null;
  return Object.hasOwn(table.snaps, key) ? key : null;
};

export function liveActions(chat, { uptoIndex, survey } = {}) {
  const table = readTable(chat);
  const messages = chat?.message ?? [];
  const last = Math.min(uptoIndex ?? messages.length - 1, messages.length - 1);
  const used = tagUse(table, survey ?? surveyBattles(chat, table));
  const live = new Map();
  const take = (id, action, at, told = null) => {
    if (typeof id !== 'string') return;
    const was = live.get(id);
    if (!was) { live.set(id, { action: action ?? null, told, at }); return; }
    was.action ??= action ?? null;
    was.told ??= told;
  };
  const imports = new Map();
  for (const imp of readImports(chat).imports.filter(inForce)) {
    const place = importPlace(messages, imp);
    if (place <= last) imports.set(place, [...imports.get(place) ?? [], imp]);
  }
  const fromImports = place => { for (const imp of imports.get(place) ?? []) for (const action of heldActions(imp)) take(action.id, action, 2 * place + 1); };
  fromImports(-1);
  for (let i = 0; i <= last; i++) {
    for (const { key } of findTags(String(messages[i]?.data ?? ''))) {
      if (!used(key)) continue;
      const acted = table.acts?.[key];
      if (acted?.v === 2) { for (const action of acted.actions ?? []) take(action?.id, action, 2 * i, i); continue; }
      const storyEnd = table.meta?.[key]?.storyEnd;
      if (storyEnd) for (const action of storyEnd.actions ?? []) take(action?.id, action, 2 * i);
      else for (const id of reflectedBy(table, key)) take(id, null, 2 * i);
    }
    fromImports(i);
  }
  return live;
}

export function computeState(chat, ctx, { uptoIndex, survey: given, open = false } = {}) {
  const table = readTable(chat);
  const messages = chat?.message ?? [];
  const last = Math.min(uptoIndex ?? messages.length - 1, messages.length - 1);
  const keep = !!ctx?.folds;
  const folds = keep ? foldList(ctx.folds, chat) : [];
  const parts = messages.map(m => String(m?.data ?? ''));
  const survey = given ?? surveyBattles(chat, table);
  const { held } = survey;
  const used = tagUse(table, survey);

  const heldIn = i => (held.size ? findBlocks(parts[i], ctxAt(i)).filter(b => b.kind === 'change').map((_, n) => n).filter(n => held.has(changeAt(i, n))).join(',') : '');

  const imports = new Map();
  for (const imp of readImports(chat).imports.filter(inForce)) {
    const at = importPlace(messages, imp);
    imports.set(at, [...imports.get(at) ?? [], imp]);
  }
  const importsAt = i => imports.get(i) ?? [];

  const ctxAt = foldCtxAt(chat, ctx);

  const settingsOf = (i, time) => { const at = ctxAt(i, time); return { ...foldValues(at), formGen: at.formGen ?? null, ...(at.learnFrom ? { learnFrom: at.learnFrom } : {}), era: String(abilityEraOf(at)) }; };
  // The message where a battle the story ends at message i would have its result saved, at the latest moment possible:
  // i itself (before the next message) if its block is in that message, else i - 1 (below)
  const savedAtFor = (i, blockKey) => (survey.battles.get(blockKey)?.index === i ? i : i - 1);
  // That latest moment of message j (its ctx, numbers rule and ability era), matching the state pendingState reaches
  // through this function's tail before running queued actions
  const toLatest = j => { const at = ctxAt(j, Infinity); return { ctx: at, rule: settingsOf(j, Infinity).rule, to: abilityEraOf(at), give: !!ruleValues(at).eraAbilities }; };
  // The ctx a battle ran with: its record's generation and Battle Rules over a ctx of the time its result is saved
  const battleOf = (engine, ctxThen) => ({ ...(({ formGen: _now, ...rest }) => rest)(ctxThen),
    ...(Number.isInteger(engine.formGen) ? { formGen: engine.formGen } : {}), ...(engine.battleRule != null ? { battleRule: engine.battleRule } : {}) });
  // Runs a story-ended battle's queued actions before its record is applied, as a saved result's tag folds its snapshot.
  // The fold brought to end.latest runs the record's queued actions (pendingState), crosses into the battle's ability era
  // (end.to), and is merged by keepOrigins onto the fold crossed into that era (`before`), with the abilityRecord of the
  // fold at end.latest before the actions, crossed into that era, so Pokémon keep their own marks and what the actions
  // did not change. The
  // result then takes the battle's numbers rule (end.format), as in resultChange, until the message moves it on (an
  // unlisted format keeps end.latest's rule). An action that fails here because a target Pokémon is not in the fold yet
  // waits for the battle's tag, and the later actions of the record wait in order behind it, since they were queued after
  // that Pokémon joined (`done` lists the earlier actions, which ran or failed as in that saved result). When no action
  // runs (none to run, or the first one waits), the fold just crosses into the battle's era
  const virtualTag = (start, end, actions, status) => {
    const before = crossTo(ctx?.sim, start, end.to, end.give);
    const tail = crossTo(ctx?.sim, inRule(ctx?.sim, start, end.latest.rule), end.latest.to, end.latest.give);
    const done = [];
    let acted = tail;
    for (const action of actions) {
      const run = runAction(acted, action, { ...end.latest.ctx, status });
      if (run.errors?.length && !hasTargets(acted, action)) break;
      done.push(action);
      acted = run.state;
    }
    if (!done.length) return { state: before, done };
    const snap = clone(crossTo(ctx?.sim, acted, end.to, end.give));
    const state = keepOrigins(before, snap, { ...end.met, status },
      { baseline: abilityRecord(crossTo(ctx?.sim, tail, end.to, end.give)), dex: ctx?.sim?.Dex, carry: true, slots: end.give });
    return { state: inRule(ctx?.sim, state, numbersOf(end.format ?? DEFAULT_FORMAT, state)), done };
  };
  // The settings a battle's tag folds with, from the time its result was saved (below). For a battle the story ends whose
  // record has the generation it ran with, these are the Battle Rules, settings and world of the latest moment its result
  // could be saved (as for a saved result's time), plus this message's world (read when the record is applied as in
  // 0.1.0, without editedImports at that moment)
  const tagKey = i => findTags(parts[i]).filter(t => used(t.key)).map(t => {
    const meta = table.meta?.[t.key];
    if (typeof meta?.time === 'number') { const at = ctxAt(i, meta.time); return [t.key, at.battleRule, worldKey(discWorld(at.world, at.formGen, at.battleRule)), worldKey(at.world ?? {}), ...Object.values(settingsOf(i, meta.time))].join(':'); }
    const engine = meta?.storyEnd?.engine;
    if (!engine || !Object.hasOwn(engine, 'formGen')) return null;
    const j = savedAtFor(i, meta.blockKey), then = ctxAt(j, Infinity);
    return [t.key, worldKey(ctxAt(i).world ?? {}), then.battleRule, worldKey(discWorld(then.world, then.formGen, then.battleRule)), worldKey(then.world ?? {}),
      ...Object.values(settingsOf(j, Infinity))].join(':');
  }).filter(Boolean).join(',');

  const worldOf = worldAt(chat);

  const discOf = i => { const at = ctxAt(i); return discWorld(worldOf(i), at.formGen, at.battleRule); };

  const partner = compatPartnerStart(chat);
  const firstInfo = partner ? [...survey.battles.values()].filter(b => !b.discarded).sort((a, b) => a.at - b.at)[0] ?? null : null;
  const firstBattle = firstInfo && { index: firstInfo.index,
    start: battlesIn(messages[firstInfo.index], firstInfo.index, ctxAt(firstInfo.index)).find(b => b.key === firstInfo.key)?.start ?? 0 };
  const beforeBattle = (i, start) => !firstBattle || i < firstBattle.index || (i === firstBattle.index && start < firstBattle.start);
  const partnerAt = (i, start, time) => !!partner && beforeBattle(i, start) && ruleValues(ctxAt(i, time)).partnerLock;

  const partnerKey = i => (partner ? `${partner}:${!firstBattle || i < firstBattle.index ? 'b' : i === firstBattle.index ? firstBattle.start : 'a'}` : '');

  // Imports a battle's snapshot holds already, folded at its tag (below) and not again with their message's others
  const absorbed = new Set();
  const listedImports = key => (Array.isArray(table.meta?.[key]?.imports) ? table.meta[key].imports : []);
  // (before: called on the fold as each import begins, after its crossing and in its ctx, like its held actions; used
  // by computeState to run the waiting actions that come before the import)
  const applyImportsAt = (i, start, at, reflected, seen, list = importsAt(i).filter(imp => !absorbed.has(imp.id)), crossings = null, before = null) => list.reduce((cur, imp) => {
    const timed = ctxAt(i, imp.time);
    // Under the rule editedImports an import made after a change of a setting at the same message joins under the new one
    const fixed = !!ruleValues(timed).editedImports;
    const here = fixed ? { ...timed, ...(at.status !== undefined ? { status: at.status } : {}) } : { ...at, ...ruleValues(timed) };
    if (fixed) crossings?.push({ to: abilityEraOf(here), give: !!ruleValues(here).eraAbilities });
    let next = fixed ? crossEra(ctx?.sim, inRule(ctx?.sim, cur, here.rule), here) : cur;
    if (before) next = before(next, imp, here);
    for (const action of heldActions(imp)) {
      if (!isReflected(action, reflected, seen)) next = runAction(next, action, here).state;
      reflected.add(action.id);
    }
    return partnerLock(next, applyImport(next, imp, here), partnerAt(i, Infinity, imp.time), here, importOrder(imp));
  }, start);
  const importKeysAt = i => importsAt(i).map(imp => {
    const timed = ctxAt(i, imp.time), rules = ruleValues(timed);
    const more = rules.editedImports ? [...Object.values(foldValues(timed)), timed.battleRule, timed.formGen ?? '', timed.learnFrom ?? '', worldKey(discWorld(timed.world, timed.formGen, timed.battleRule)), String(abilityEraOf(timed))] : [];
    return `${hashKey(JSON.stringify(imp))}:${[...Object.values(rules), ...more].join(':')}`;
  });
  const importKey = i => [...(i === 0 ? importKeysAt(-1) : []), ...importKeysAt(i)].join(',');

  const league = readLeague(chat);
  const places = league && leaguePlaces(league, chat);
  const leagueKey = i => (league ? [league.era, ...leagueAt(league, places, i).map(id => `${id}=${leagueDate(league, id)}`)].join(',') : '-');

  const since = [];
  messages.forEach((message, i) => { since[i + 1] = message?.role === 'char' ? i : since[i] ?? 0; });

  const book = (next, i) => {
    const own = league ? { ...next, badges: leagueAt(league, places, i), league: { era: league.era } } : next;
    const gyms = keepRecords(own.gyms, earnedBadges(own), { league, win, since: i < 0 ? Infinity : since[i] ?? 0 });
    if (Object.keys(gyms).length) return { ...own, gyms };
    const { gyms: _, ...rest } = own;
    return rest;
  };

  const withBook = (next, now) => {
    const out = { ...next };
    for (const field of BOOK_FIELDS) if (Object.hasOwn(now, field)) out[field] = now[field]; else delete out[field];
    return out;
  };

  const wonAt = (key, i, now) => {
    const meta = table.meta?.[key];
    const info = meta?.blockKey && survey.battles.get(meta.blockKey);
    if (!info || (meta.storyEnd ? info.ended?.outcome : meta.outcome) !== 'win') return null;
    const block = battlesIn(messages[info.index], info.index, ctxAt(info.index)).find(b => b.key === meta.blockKey);
    const spec = block && parseBattle(block.body, ctxAt(info.index)).spec;
    if (!spec?.boss) return null;
    return { index: i, date: status?.date ?? null, party: hatchedParty(now).map(mon => ({ species: mon.set.species, ...(mon.set.name ? { name: mon.set.name } : {}) })),
      opponents: [spec.name, spec.foePartner?.name].filter(Boolean) };
  };
  const keyOf = i => `${messageId(messages[i], i)}\u0001${messages[i]?.role}\u0001${parts[i]}\u0001${findTags(parts[i]).map(t => used(t.key)).filter(Boolean).join(',')}\u0001${heldIn(i)}\u0001${importKey(i)}\u0001${Object.values(settingsOf(i)).join('\u0001')}\u0001${leagueKey(i)}\u0001${partnerKey(i)}\u0001${worldKey(discOf(i))}\u0001${tagKey(i)}`;
  let from = 0;
  while (from <= last && from < folds.length && folds[from].key === keyOf(from)) from++;
  if (from <= last) folds.length = from; // later ones are stale
  let changed = false;
  for (const fold of folds.slice(0, from)) {
    for (const [key, set] of Object.entries(fold.fills)) if (!Object.hasOwn(table.fills, key)) { table.fills[key] = set; changed = true; }
  }

  let status = from ? folds[from - 1].status : null;
  let win = from ? folds[from - 1].win : null;

  const seen = new Set(parts.slice(0, from).flatMap(text => findTags(text).map(t => t.key)).filter(used));
  const reflected = new Set([...seen].flatMap(key => reflectedBy(table, key)));
  const importedUpto = n => [...imports].filter(([at]) => at <= n).flatMap(([, list]) => list.flatMap(imp => heldActions(imp).map(action => action.id)));
  if (from) for (const id of importedUpto(from - 1)) reflected.add(id);
  let state = from ? folds[from - 1].after : applyImportsAt(-1, crossEra(ctx?.sim, inRule(ctx?.sim, emptyState(), settingsOf(-1).rule), ctxAt(-1)), ctxAt(-1), reflected, seen);
  if (!from) state = book(state, -1);

  const tagsAt = i => findTags(parts[i]).filter(t => used(t.key)).map(t => {
    const { storyEnd, blockKey } = table.meta[t.key] ?? {}, ended = storyEnd && survey.battles.get(blockKey)?.ended;
    return { ...t, type: 'tag', start: ended?.index === i ? ended.start : t.start, written: t.start };
  });
  // A battle from an earlier block that the story ends at message i counts as having its result saved just before message
  // i, at the latest moment it could be (savedAtFor). In the order the story ends these battles, virtualTag crosses the fold into
  // each battle's ability era (for one begun while Auto only guessed, the era of that moment; in the loop below, its catch
  // joins in that crossed era), and the first of them runs the queued actions its record holds (and those of an acts tag
  // at this message). These results count as saved before anything at message i, so an action counts as reflected only by
  // tags and imports before message i; once run here (`early`, by id), every tag at message i that holds
  // it skips it. An action on a Pokémon this message brings (from a change block, an import or a battle) waits
  // for its record's tag, along with the later actions of that record. Every action of a later story end's record (after
  // any earlier story end here, a 0.1.0 record included) waits for its tag too: no earlier end's record holds it, so it
  // was queued after those battles, which apply at their tags
  const opening = (i, start) => {
    let state = start;
    const ends = [], early = new Set(), joinedAt = new Map();
    if (ruleValues(ctxAt(i)).editedImports) {
      const counted = new Set(seen), held = new Set(reflected);
      let after = false;
      for (const t of tagsAt(i).sort((a, b) => a.start - b.start)) {
        const meta = table.meta?.[t.key], engine = meta?.storyEnd?.engine;
        const ended = !!engine && table.acts?.[t.key]?.v !== 2 && savedAtFor(i, meta.blockKey) !== i;
        if (!ended || !Object.hasOwn(engine, 'formGen') || !Object.hasOwn(engine, 'abilityEra')) { after ||= ended; continue; }
        counted.add(t.key);
        const latest = toLatest(i - 1);
        ends.push({ key: t.key, to: typeof engine.abilityEra === 'boolean' ? engine.abilityEra : latest.to, give: latest.give, latest, first: !after,
          met: battleOf(engine, latest.ctx), format: engine.format, actions: meta.storyEnd.actions ?? [], counted: new Set(counted), held: new Set(held) });
        for (const id of reflectedBy(table, t.key)) held.add(id);
        after = true;
      }
    }
    // (an acts tag at this message holds actions queued before this message, so the first of these battles takes them too,
    // except those queued after its result would have been saved: actions held by another story end's record here and not
    // by the first's, or actions in an acts tag after a result saved at this message that are not listed by that result's
    // record, since that record lists what was pending then)
    const queued = [];
    if (ends[0]?.first) {
      const first = new Set(ends[0].actions.map(action => action.id)), saved = [];
      const later = new Set(tagsAt(i).filter(t => t.key !== ends[0].key && table.acts?.[t.key]?.v !== 2)
        .flatMap(t => (table.meta?.[t.key]?.storyEnd?.actions ?? []).map(action => action.id)).filter(id => !first.has(id)));
      for (const t of tagsAt(i).sort((a, b) => a.start - b.start)) {
        const acts = table.acts?.[t.key];
        if (acts?.v === 2) queued.push(...(acts.actions ?? []).filter(action => !later.has(action.id) && saved.every(held => held.has(action.id))));
        else if (table.snaps?.[t.key] && !table.meta?.[t.key]?.storyEnd) saved.push(new Set(table.meta?.[t.key]?.held ?? []));
      }
    }
    ends.forEach((end, k) => {
      const ids = new Set(), actions = end.first ? [...queued, ...end.actions] : end.actions;
      const runs = actions.filter(action => !ids.has(action.id) && !!ids.add(action.id) && !early.has(action.id) && !isReflected(action, end.held, end.counted));
      const tagged = virtualTag(state, end, end.first ? runs : [], status);
      for (const action of tagged.done) early.add(action.id);
      state = tagged.state;
      joinedAt.set(end.key, { era: state.abilityEra, then: ends.slice(k + 1) });
    });
    return { state, early, joinedAt };
  };

  for (let i = from; i <= last; i++) {
    const name = messageId(messages[i], i);
    const here = ctxAt(i);
    const tags = tagsAt(i);
    const { state: opened, early, joinedAt } = opening(i, state);
    state = opened;

    // (the Status Window before this message and the era crossings this message makes: used for a battle the story ends,
    // below)
    const statusBefore = status;
    state = crossEra(ctx?.sim, inRule(ctx?.sim, state, here.rule), here);
    const crossings = [{ to: abilityEraOf(here), give: !!ruleValues(here).eraAbilities }];

    state = teraKept(state, { ...here, sim: ctx?.sim });
    if (league) state = { ...state, badges: leagueAt(league, places, i) };

    if (messages[i]?.role === 'char') {
      status = statusIn(messages[i]) ?? status;
      state = storyMention(state, parts[i], here);
      state = storyTick(state, name, { ...here, status }).state;
      state = refillEnergy(afterMessage(state));
    }
    const at = { ...here, status };

    const changes = findBlocks(parts[i], here).filter(b => b.kind === 'change').map((b, n) => ({ ...b, type: 'change', n }));
    const fills = {};
    // (a story end's queued action that fails at its tag because its target Pokémon has not joined yet waits through the
    // rest of the message for anything that brings that Pokémon, another waiting action included. The later actions of
    // its record wait behind it in order: the panel offers only Pokémon that are there, so they were queued after that
    // Pokémon joined, and they run once it is there, as they would after that battle's result was saved. They do not run
    // before a result saved at this message before they were queued, nor before an import here that does not come after
    // them (queuedBefore, below), which would fold over them. At the last try, an action still missing its Pokémon fails,
    // and those behind it run)
    let waiting = [];
    const retry = (last = false, only = null, now = at) => {
      for (let moved = true; moved;) {
        moved = false;
        const stuck = new Set();
        waiting = waiting.filter(entry => {
          if (stuck.has(entry.key)) return true;
          if ((only && !only(entry)) || !hasTargets(state, entry.action)) { stuck.add(entry.key); return true; }
          state = runAction(state, entry.action, now).state;
          moved = true;
          return false;
        });
        if (moved || !last) continue;
        // (a record's first action is the one still without its Pokémon, unless `only` leaves the record for later)
        const first = new Set();
        waiting = waiting.filter(entry => {
          if (first.has(entry.key)) return true;
          first.add(entry.key);
          if (only && !only(entry)) return true;
          moved = true;
          return false;
        });
      }
    };
    const savedAhead = new Map(tags.filter(t => table.snaps?.[t.key] && !table.meta?.[t.key]?.storyEnd && table.acts?.[t.key]?.v !== 2)
      .map(t => [t.key, table.meta?.[t.key]?.time]));
    // (an import comes after the actions it holds, which were pending when it was made, and after an action queued before
    // it, which a story end's record had taken by then and so ran in the fold the import's draft came from; Debug Heal and
    // Badges records hold no pending actions, so an action they do not hold runs after them, as pendingState runs the
    // queue after the fold's imports)
    const queuedBefore = imp => entry => heldActions(imp).some(action => action.id === entry.action.id)
      || (imp.heal === undefined && imp.badges === undefined && typeof imp.time === 'number' && typeof entry.action.at === 'number' && entry.action.at < imp.time);
    const ready = entry => (typeof entry.action.at !== 'number' || ![...savedAhead.values()].some(time => typeof time === 'number' && time < entry.action.at))
      && importsAt(i).every(imp => absorbed.has(imp.id) || queuedBefore(imp)(entry));
    for (const event of [...tags, ...changes].sort((a, b) => a.start - b.start)) {
      retry(false, ready);
      if (event.type === 'tag') {
        const meta = table.meta?.[event.key] ?? {};
        const { storyEnd, blockKey } = meta;
        const acted = table.acts?.[event.key];
        seen.add(event.key);
        // The settings and rules of the time the battle's result was saved (story-link resultChange), which may have
        // changed at this message before it
        const tagAt = typeof meta.time === 'number' ? { ...ctxAt(i, meta.time), status } : at;
        const fixed = !!ruleValues(tagAt).editedImports;
        // A battle the story ends in its own block's message runs its record's queued actions here (virtualTag), as one
        // from an earlier block does at the start of its end message; the story-end branch below then finds the fold in its
        // era
        const inBlock = !!storyEnd?.engine && acted?.v !== 2 && survey.battles.get(blockKey)?.index === i && Object.hasOwn(storyEnd.engine, 'formGen')
          && Object.hasOwn(storyEnd.engine, 'abilityEra') && !!ruleValues(ctxAt(i, Infinity)).editedImports;
        const runs = inBlock ? (storyEnd.actions ?? []).filter(action => !early.has(action.id) && !isReflected(action, reflected, seen)) : [];
        let done = [];
        if (runs.length) {
          const latest = toLatest(i), engine = storyEnd.engine;
          const tagged = virtualTag(state, { to: typeof engine.abilityEra === 'boolean' ? engine.abilityEra : latest.to, give: latest.give, latest,
            met: battleOf(engine, latest.ctx), format: engine.format }, runs, status);
          state = tagged.state;
          done = tagged.done;
        }

        // (a record without the battle's generation and era, as 0.1.0 wrote it, runs its actions as in 0.1.0)
        const parks = !!storyEnd?.engine && Object.hasOwn(storyEnd.engine, 'formGen') && Object.hasOwn(storyEnd.engine, 'abilityEra')
          && !!ruleValues(ctxAt(savedAtFor(i, blockKey), Infinity)).editedImports;
        let parked = false;
        for (const action of (acted?.v === 2 ? acted.actions : storyEnd?.actions) ?? []) {
          if (done.includes(action) || early.has(action.id) || isReflected(action, reflected, seen)) continue;
          if (parked) { waiting.push({ action, key: event.key, written: event.written }); continue; }
          const run = runAction(state, action, at);
          if (run.errors?.length && parks && !hasTargets(state, action)) { waiting.push({ action, key: event.key, written: event.written }); parked = true; }
          else state = run.state;
        }
        // Imports made at this message before its result was saved are in the snapshot: the fold takes them here, as the battle saw
        // them, rather than over its result (one a result moved back by restoreResult left at a later message is applied
        // there as before: the snapshot takes its badges and other book fields from the fold, withBook)
        const holds = fixed && acted?.v !== 2 && !storyEnd ? listedImports(event.key) : [];
        const prior = importsAt(i).filter(imp => holds.includes(imp.id) && !absorbed.has(imp.id));
        const holding = new Set(reflectedBy(table, event.key));
        // A waiting action queued before this result was saved and not held by it (meta.held: what was pending then) had
        // already been taken by a story end's record, so the fold this result was saved from settled it before the battle
        // (if either has no time, or both have the same: the story end's tag comes before this result's)
        const settled = entry => !holding.has(entry.action.id) && (typeof meta.time === 'number' && typeof entry.action.at === 'number' && entry.action.at !== meta.time
          ? entry.action.at < meta.time : entry.written < event.written);
        if (prior.length) {
          for (const imp of prior) absorbed.add(imp.id);
          state = applyImportsAt(i, state, at, reflected, seen, prior, crossings, (was, imp, there) => {
            state = was;
            retry(false, entry => settled(entry) && queuedBefore(imp)(entry), there);
            return state;
          });
        }
        for (const id of holding) reflected.add(id);
        if (acted?.v === 2) continue;

        if (!storyEnd) {
          savedAhead.delete(event.key);
          // A waiting action is already in the snapshot when this result's record lists it; one settled in the fold the
          // result was saved from (above) is settled here, after the imports the result absorbs, as at that fold's last try
          // (one still without its Pokémon fails, and those behind it run)
          waiting = waiting.filter(entry => !holding.has(entry.action.id));
          retry(true, settled);
          // The snapshot stays in the ability era and, under editedImports, the rules its battle ran with until the next
          // message moves it on; the fold is held up to it in that era, as its record was made there
          // (a snapshot saved with a record but no era was saved while Auto only guessed: the era of the battle's time)
          const snap = withBook(clone(table.snaps[event.key]), state), sim = ctx?.sim, eras = !!ruleValues(tagAt).eraAbilities;
          const target = snap.abilityEra !== undefined ? snap.abilityEra : meta.abilities ? abilityEraOf(tagAt) : state.abilityEra;
          const before = crossTo(sim, state, target, eras);
          if (snap.abilityEra !== undefined || meta.abilities) crossings.push({ to: target, give: eras });
          // A Pokémon the fold lacks (one the battle caught) and that its result left without a met generation (resultChange
          // gives one unless the battle had no generation of its own, no Status Window region has a game, and no anime
          // world counts under its Battle Rules) was met under the generation and Battle Rules the battle ran with, even
          // when they changed while it was played (a record without them: the result's time)
          const { formGen: _now, ...ranIn } = tagAt;
          const met = Object.hasOwn(meta, 'formGen')
            ? { ...ranIn, ...(Number.isInteger(meta.formGen) ? { formGen: meta.formGen } : {}), ...(meta.battleRule != null ? { battleRule: meta.battleRule } : {}) }
            : tagAt;
          const kept = keepStoryDiscs(state, keepOrigins(before, snap, fixed ? met : at, { baseline: meta.abilities, dex: sim?.Dex, carry: fixed, slots: fixed && eras }));
          state = teraKept(fixed ? kept : inRule(sim, kept, here.rule), { ...at, sim }, state);
        }
        else {
          // A battle the story ends counts as having its result saved at the latest moment it could be (savedAtFor). It is
          // applied with that moment's settings, rules and world, the generation and Battle Rules it ran with, and its
          // block's Status Window, as resultChange applies a saved result. A Pokémon it brought without a met generation gets
          // one from that moment and the battle's generation and Battle Rules, as a saved result's tag fills one via
          // keepOrigins (a record without them uses the end message's ctx)
          const { engine } = storyEnd, block = survey.battles.get(blockKey)?.index;
          const j = savedAtFor(i, blockKey), latest = engine && Object.hasOwn(engine, 'formGen') ? ctxAt(j, Infinity) : null;
          const own = !!latest && !!ruleValues(latest).editedImports;
          const ran = own ? battleOf(engine, { ...latest, status: Number.isInteger(block) ? latestStatus(chat, block) : status }) : at;
          const metAt = own && battleOf(engine, { ...latest, status: j === i ? status : statusBefore });
          const eraKnown = own && Object.hasOwn(engine, 'abilityEra');
          if (engine && eraKnown && block === i) {
            // ...ended in its own block's message: like a result saved there, the fold moves into the battle's ability era
            // here (one begun while Auto only guessed: the era of that moment) and stays in it until the next message
            const to = typeof engine.abilityEra === 'boolean' ? engine.abilityEra : abilityEraOf(latest), give = !!ruleValues(latest).eraAbilities;
            const crossed = crossTo(ctx?.sim, state, to, give);
            state = metNewcomers(crossed, applyBattles(crossed, [...engine.before ?? [], engine], ran), metAt);
            crossings.push({ to, give });
          } else if (engine) {
            const caught = new Set();
            const applied = applyBattles(state, [...engine.before ?? [], engine], ran, { caught });
            state = metAt ? metNewcomers(state, applied, metAt) : applied;
            // ...and a Pokémon it caught joins in the era the fold was crossed into for it at the start of this message
            // (above), then follows the crossings since: those for the battles the story ends after it here, and every
            // one this message has made so far, each under its own eraAbilities
            const joined = eraKnown && caught.size ? joinedAt.get(event.key) : null;
            if (joined) {
              let era = joined.era;
              for (const step of [...joined.then, ...crossings]) ({ state, era } = joinedIn(ctx?.sim, state, caught, era, step.to, step.give));
            }
          }
          if (storyEnd.who) {
            const outcome = survey.battles.get(blockKey).ended.outcome;
            state = { ...state, trainers: { ...trainersOf(state), [storyEnd.who]: { ...clone(storyEnd.trainer), outcome } } };
          }
        }
        win = wonAt(event.key, i, state) ?? win;
        continue;
      }
      if (held.has(changeAt(i, event.n))) continue;
      const { ops } = parseChange(event.body, withMachineStandard(here, status?.region, discOf(i)));
      const before = Object.keys(table.fills).length;
      const was = state, prefix = `${name}:${event.key}`;
      state = applyOps(state, ops, at, prefix, table).state;
      state = partnerLock(was, state, partnerAt(i, event.start), at, ops.flatMap((op, j) => (op.op === 'add' ? [{ base: `m${hashKey(`${prefix}:${j}`)}`, species: op.set?.species }] : [])));
      if (Object.keys(table.fills).length !== before) changed = true;
      ops.forEach((_, j) => { const key = `${name}:${event.key}:${j}`; if (Object.hasOwn(table.fills, key)) fills[key] = table.fills[key]; });
    }
    retry(false, ready);
    state = applyImportsAt(i, state, at, reflected, seen, undefined, null, (was, imp, there) => {
      state = was;
      retry(false, queuedBefore(imp), there);
      return state;
    });
    retry(true);
    state = book(state, i);

    state = storyDiscs(state, withMachineStandard({ ...here, ...ruleValues(null) }, status?.region, discOf(i)));
    if (keep) folds.push({ key: keyOf(i), after: state, fills, status, win });
  }

  // (open: the state as message last + 1 opens, with the battles the story ends there taken as saved just before it, for
  // the previews of that message's own changes and passing time, acts.changesIn and passingIn)
  const opened = open && last + 1 < messages.length ? opening(last + 1, state).state : state;
  const after = teraKept(crossEra(ctx?.sim, inRule(ctx?.sim, opened, settingsOf(last + 1).rule), ctxAt(last + 1)), { ...ctxAt(last + 1), sim: ctx?.sim });
  const counted = new Set(parts.slice(0, last + 1).flatMap(text => findTags(text).map(t => t.key)).filter(used));
  return { state: keep && after === state ? clone(state) : after, table, changed, counted, reflected: new Set([...counted].flatMap(key => reflectedBy(table, key))),
    imported: new Set(importedUpto(last)), status };
}

function partnerLock(before, after, on, ctx, order = null) {
  const dex = ctx?.sim?.Dex;
  if (!on || !dex || before === after) return after;
  const pikachu = species => !!species && dex.species.get(species).baseSpecies === 'Pikachu';
  const had = [...before.party, ...before.box];
  if (had.some(m => !isEgg(m) && pikachu(m.set.species)) || (before.dex?.caught ?? []).some(pikachu)) return after;
  const known = new Set(had.map(m => m.uid));
  const fresh = [...after.party, ...after.box].filter(m => !known.has(m.uid) && !isEgg(m) && pikachu(m.set.species));
  const first = order?.find(entry => pikachu(entry.species));
  const joined = order ? first && fresh.find(m => m.uid === first.base || m.uid.startsWith(`${first.base}-`)) : fresh[0];
  if (!joined) return after;
  const next = clone(after);
  [...next.party, ...next.box].find(m => m.uid === joined.uid).evolveLocked = true;
  return next;
}

const importOrder = imp => {
  if (!Array.isArray(imp?.mons)) return null;
  const added = imp.mons.filter(entry => entry?.action === 'add');
  return added.every(entry => typeof entry.uid === 'string') ? added.map(entry => ({ base: entry.uid, species: entry.set?.species })) : null;
};

const heldActions = imp => (Array.isArray(imp.held) ? imp.held.filter(action => isRecord(action) && typeof action.id === 'string' && Array.isArray(action.ops)) : []);

export const friendshipOf = (ctx, mon) => mon.friendship ?? baseFriendship(ctx.exp, ctx.sim.Dex.species.get(mon.set.species));

export const FRIENDSHIP_TOP = FOND_FRIENDSHIP;
export const FRIENDSHIP_HIGH = EVOLVE_FRIENDSHIP;
export const FRIENDSHIP_LOW = 20;

export const friendshipBand = (value, base) => (value >= FRIENDSHIP_TOP ? 'top' : value >= FRIENDSHIP_HIGH ? 'high'
  : value < FRIENDSHIP_LOW && value < base ? 'lowest' : null);

export function friendshipLine(mon, ctx, lang) {
  if (isEgg(mon)) return null;
  const band = friendshipBand(friendshipOf(ctx, mon), baseFriendship(ctx.exp, ctx.sim.Dex.species.get(mon.set.species)));
  return band && { band, text: say(lang, `panel.sc.friendship.${band}`) };
}

export function addFriendship(mon, amount, source, ctx) {
  if (friendshipLocked(mon)) return 0; // locked (debug mode): the number and its carry stay
  const now = friendshipOf(ctx, mon);
  const step = amount ?? friendshipStep(now, source, ruleValues(ctx).friendshipSv);
  const { value, carry } = changeFriendship(now, step, { item: mon.set.item, ball: mon.ball, rate: ctx.friendshipRate ?? 1, carry: mon.friendshipCarry ?? 0 });
  if (value !== now) mon.friendship = value;
  setCarry(mon, carry);
  return value - now;
}

function setCarry(mon, carry) {
  if (carry) mon.friendshipCarry = carry;
  else delete mon.friendshipCarry;
}

const storyText = (text, reading) => dropOocs(stripBlocksRead(text, reading)).replace(COMPAT_LINE_RE, ' ').normalize('NFKC');

const PARTICLES = '이|가|은|는|을|를|의|에|에게|에겐|에서|께|한테|한텐|와|과|랑|이랑|하고|도|만|로|으로|야|아|여|이여|처럼|보다|까지|부터|나|이나';

function names(text, name) {
  const written = String(name ?? '').normalize('NFKC').trim();
  if (!written) return false;
  if (/^[\p{Script=Latin}\p{N}\s.'’:-]+$/u.test(written)) return new RegExp(`(?<![\\p{Script=Latin}\\p{N}])${escapeRe(written)}(?![\\p{Script=Latin}\\p{N}])`, 'u').test(text);
  const want = written.toLowerCase();
  const after = [...want].length === 1 ? `(?:${PARTICLES})*(?!\\p{Script=Hangul})` : '';
  return new RegExp(`(?<!\\p{Script=Hangul})${escapeRe(want)}${after}`, 'u').test(text.toLowerCase());
}

function callNames(ctx, mon) {
  const base = nameEntry('species', ctx.sim.Dex.species.get(mon.set.species).baseSpecies);
  return [mon.set.name, ...koSpellings(base, ctx), base?.en].filter(Boolean);
}

export function storyMention(state, text, ctx) {
  const plain = storyText(text, ctx);
  const named = state.party.filter(mon => !isEgg(mon) && callNames(ctx, mon).some(name => names(plain, name)));
  if (!named.length) return state;
  const next = clone(state);
  for (const mon of next.party) {
    if (!named.some(m => m.uid === mon.uid)) continue;
    addFriendship(mon, null, 'mention', ctx);
    countUp(ctx, mon, 'mentions');
  }
  return next;
}

/** Whether a Pokemon of the state is an egg */
export const isEgg = mon => !!mon?.egg;

export const hatched = mons => mons.filter(mon => !isEgg(mon));

export const hatchedParty = state => hatched(state.party);

export const hatchDue = mon => !!mon?.egg?.ready || !!mon?.pending?.hatched;

export function newEgg(ctx, set, uid, ball) {
  const { full: _, ...mon } = newMon(ctx, { ...set, item: '', name: '' }, uid);
  return { ...mon, egg: { cycles: eggCycles(ctx.sim.Dex, set.species) }, ...(ball && ball !== 'pokeball' ? { ball } : {}) };
}

function hatch(state, ctx, mon) {
  delete mon.egg;
  keepTera(mon, ctx);
  if (ruleValues(ctx).startFull) mon.full = FULL_MAX;
  mon.friendship = HATCH_FRIENDSHIP;
  markDex(state, ctx.sim, mon.set.species, true);
}

const teraOf = (dex, mon) => (dex && !isEgg(mon) && !mon?.set?.teraType ? autoTeraType(dex.species.get(mon.set.species), mon.uid) : '');

const teraHolders = state => {
  const out = [];
  const visit = mon => { if (!mon?.set) return; out.push(mon); visit(mon.fused); };
  for (const mon of [...state.party ?? [], ...state.box ?? [], ...labOf(state)]) visit(mon);
  return out;
};

function keepTera(mon, ctx, had = null) {
  if (!ruleValues(ctx).catchTera010) return;
  const type = had?.get(mon.uid) || teraOf(ctx.sim?.Dex, mon);
  if (type && !mon.set.teraType) mon.set.teraType = type;
}
function teraKept(state, ctx, before = null) {
  if (!ruleValues(ctx).catchTera010 || !ctx.sim) return state;
  if (!teraHolders(state).some(mon => teraOf(ctx.sim.Dex, mon))) return state;
  const had = before && new Map(teraHolders(before).filter(mon => mon.set.teraType && !isEgg(mon)).map(mon => [mon.uid, mon.set.teraType]));
  const next = clone(state);
  for (const mon of teraHolders(next)) if (!isEgg(mon)) keepTera(mon, ctx, had);
  return next;
}

/** What eggChance reads of a Pokemon */
const parentOf = mon => ({ species: mon.set.species, gender: mon.set.gender || '', ot: mon.ot ?? '' });

/** The pair's two Pokemon in the party, or null when either is not there */
const pairIn = (state, pair) => {
  const mons = (pair ?? []).map(uid => state.party.find(m => m.uid === uid));
  return mons.length && mons.every(Boolean) ? mons : null;
};

export function tidyBreeding(state) {
  if (state.breeding && !pairIn(state, state.breeding)) delete state.breeding;
}

export function breedingOf(state, ctx) {
  const pair = pairIn(state, state.breeding);
  if (!pair) return null;
  const [a, b] = pair;
  return { a, b, ...eggChance(ctx.sim.Dex, parentOf(a), parentOf(b)) };
}

export function storyTick(state, name, ctx) {
  const breeding = breedingOf(state, ctx);
  if (!state.party.some(isEgg) && !breeding?.chance && !labOf(state).length) return { state, events: [] };
  const { sim } = ctx;
  const next = clone(state), events = [];
  const abilities = ruleValues(ctx).eraAbilities && abilityEraOf(ctx) === false ? [] : hatchedParty(next).map(m => m.set.ability);
  const speed = hatchSpeed(abilities) * (ctx.hatchRate ?? 1);
  for (const [i, mon] of next.party.entries()) {
    if (!isEgg(mon) || mon.egg.ready) continue;
    mon.egg.cycles = Math.max(0, Math.round((mon.egg.cycles - speed) * 1000) / 1000);
    if (mon.egg.cycles > 0) continue;
    if (ruleValues(ctx).hatchOnScreen010) {
      mon.egg.ready = true;
      events.push({ kind: 'eggReady', who: { uid: mon.uid, egg: true, species: '', name: '' }, slot: i + 1 });
      continue;
    }
    hatch(next, ctx, mon);
    mon.pending.hatched = true;
    events.push({ kind: 'hatch', who: { uid: mon.uid, species: mon.set.species, name: '' }, slot: i + 1 });
  }
  const rng = rngFor(sim, `${name}:egg`);
  if (breeding?.chance && rng.random(100) < breeding.chance) {
    // A parent's kept ability slot (evolve keepSlot) passes on only under the rule eraAbilities
    const slotted = !!ruleValues(ctx).eraAbilities;
    const parents = [breeding.a, breeding.b].map(m => next.party.find(p => p.uid === m.uid));
    const [a, b] = parents.map(p => (slotted || !p?.abilitySlot ? p : (({ abilitySlot: _, ...rest }) => rest)(p)));
    const { set, ball } = breedEgg(sim.Dex, a, b, rng, { levelUp: joiningLevelUp(ctx), oneSpecial: oneSpecialAt(ctx) }); // one Special IV in generations 1-2 (0.1.0 G4b)
    const egg = newEgg(ctx, set, uniqueUid(next, `e${hashKey(name)}`), ball);
    const list = next.party.length < PARTY_MAX ? next.party : next.box;
    list.push(egg);
    const inBox = list === next.box;
    events.push({ kind: 'egg', box: inBox ? boxOf(next, next.box.length - 1) : false, slot: inBox ? null : next.party.length,
      parents: parents.map(m => next.party.indexOf(m) + 1).sort((x, y) => x - y) });
  }
  events.push(...labTick(next, ctx));
  return { state: next, events };
}

function labTick(state, ctx) {
  const events = [], left = [];
  for (const mon of labOf(state)) {
    const lab = mon.lab;
    lab.left = Math.max(0, (Number.isInteger(lab.left) ? lab.left : LAB_TIME) - 1);
    if (lab.left > 0) { left.push(mon); continue; }
    delete mon.lab;
    mon.revived = true;
    state.box.push(mon);
    markDex(state, ctx.sim, mon.set.species, true);
    events.push({ kind: 'revive', who: { uid: mon.uid, species: mon.set.species, name: '' }, items: lab.items, box: boxOf(state, state.box.length - 1) });
  }
  if (left.length) state.lab = left; else delete state.lab;
  return events;
}

export function countUp(ctx, mon, kind, n = 1) {
  if (countOf(ctx.sim.Dex, mon.set.species)?.kind !== kind) return;
  mon.counts = { ...mon.counts, [kind]: (mon.counts?.[kind] ?? 0) + n };
}

function addCounts(now, end, start) {
  const out = { ...now };
  for (const [kind, value] of Object.entries(end)) out[kind] = Math.max(0, (now?.[kind] ?? 0) + value - (start?.[kind] ?? 0));
  return out;
}

export function evolutionCheck(ctx, mon, party = [], badges = 0) {
  const { sim } = ctx;
  const species = sim.Dex.species.get(mon.set.species);
  const rules = formatRules(sim, ruleFormat(ctx.rule));
  const stat = name => rules.stat(species.baseStats, mon.set, name);
  const status = ctx.status ?? null;
  return {
    mon: { species: species.name, gender: mon.set.gender, item: mon.set.item, uid: mon.uid, moves: mon.set.moves, nature: mon.natureOrig ?? mon.set.nature,
      ability: mon.set.ability, stats: { atk: stat('atk'), def: stat('def') }, counts: mon.counts, gigantamax: mon.set.gigantamax === true, ...lockMark(mon.evolveLocked),
      ...genMark(evolveGenOf(ctx)) },
    now: { level: mon.set.level, friendship: friendshipOf(ctx, mon), timeOfDay: status?.timeOfDay ?? 'day', ...duskClock(ctx, status?.hour), weather: FIELD_WEATHERS[status?.weather] ?? null,
      region: status?.region ?? null, money: status?.money ?? null, badges, trade: ctx.tradeEvolution ?? ABSENT_TRADE_EVOLUTION,
      party: hatched(party).filter(m => m.uid !== mon.uid).map(m => m.set.species) },
  };
}

const duskClock = (ctx, hour) => (ruleValues(ctx).duskLycanroc && Number.isInteger(hour) ? { clockHour: hour } : {});

export function reflectedBy(table, key) {
  const acted = table.acts?.[key];
  if (acted?.v === 2) return (acted.actions ?? []).map(action => action.id);
  const meta = table.meta?.[key];
  return (meta?.storyEnd ? (meta.storyEnd.actions ?? []).map(action => action.id) : meta?.held) ?? [];
}

export const isReflected = (action, reflected, counted) => reflected.has(action.id) || (!!action.in && counted.has(action.in));

// -- Operations --------------------------------------------------

export function applyOps(state, ops, ctx, fillKeyPrefix, table, { trace = false } = {}) {
  let next = clone(state);
  const errors = [], notes = [];
  const steps = [];
  const taught = taughtIn(ops, ctx);
  (ops ?? []).forEach((op, i) => {
    if (keptDisc(next, op, taught, ctx)) return;
    const fillKey = `${fillKeyPrefix ?? 'local'}:${i}`;
    const attempt = clone(next);
    const fill = { known: table?.fills?.[fillKey] ?? null, made: null, notes: [] };
    let error = null, errorNotes = [];
    try {
      applyOp(attempt, op, ctx, fillKey, fill);
      tidyCustomItems(attempt);
      tidyBreeding(attempt);
    } catch (e) {
      error = e.message;
      errorNotes = e.notes ?? [];
      errors.push(error);
      notes.push(...errorNotes);
    }
    const before = next;
    if (!error) {
      next = attempt;
      if (fill.made && table) (table.fills ??= {})[fillKey] = fill.made;
    }
    if (!error) notes.push(...fill.notes);
    if (trace) steps.push({ op, before, after: next, error, notes: error ? errorNotes : fill.notes });
  });
  return trace ? { state: next, errors, notes, steps } : { state: next, errors, notes };
}

const taughtIn = (ops, ctx) => (ruleValues(ctx).discTeach010 ? new Set((ops ?? []).filter(op => op?.op === 'teach').map(op => toID(op.move))) : null);

const takenItem = (state, op, ctx) => {
  const read = itemId(op.item);
  if (!read || !(op.delta < 0) || state.bag[read] > 0) return read;
  const discs = [read, ...op.alts ?? []];
  const alt = discs.slice(1).find(alt => state.bag[alt] > 0);
  if (alt || op.fromBag || !isMachineId(read) || !ruleValues(ctx).discStoryItem010) return alt ?? read;
  const story = Object.keys(state.bag).filter(id => state.bag[id] > 0 && storyDisc(state, id));
  return discs.map(disc => story.find(id => storyDisc(state, id) === disc)).find(Boolean) ?? read;
};

const keptDisc = (state, op, taught, ctx) => {
  if (!taught?.size || op?.op !== 'item' || !(op.delta < 0) || op.fromBag) return false;
  const id = takenItem(state, op, ctx), disc = id && itemAs(state, id);
  return !!disc && taught.has(tmMove(disc)) && !machineUsedUp(disc);
};

const storyDiscReads = new Map();

function storyDiscs(state, reading) {
  let items = null;
  for (const [id, info] of Object.entries(state.customItems ?? {})) {
    if (info?.disc || typeof info?.name !== 'string') continue;
    const key = [info.name, reading.machineStd, reading.machineRegion, reading.machineGen].join('\u0001');
    if (!storyDiscReads.has(key)) { const read = lookupId('items', info.name, { reading }); storyDiscReads.set(key, read && isMachineId(read) ? read : null); }
    const disc = storyDiscReads.get(key);
    if (disc) (items ??= { ...state.customItems })[id] = { ...info, disc };
  }
  return items ? { ...state, customItems: items } : state;
}

function keepStoryDiscs(before, after) {
  for (const [id, info] of Object.entries(after.customItems ?? {})) {
    const disc = storyDisc(before, id);
    if (disc && info && !info.disc) after.customItems[id] = { ...info, disc };
  }
  return after;
}

function takeCustom(state, id, op, ctx, named = true) {
  if (op.custom) {
    const ownerMon = op.custom.owner ? ownerMonOf(state, ctx.sim.Dex, op.custom.owner) : null;
    addCustomItem(state, id, { ...op.custom, ...(ownerMon ? { ownerMon } : {}) }, { story: true });
  }
  if (named && isCustomItem(id) && !customInfo(state, id)) fail('itemNoName');
}

function applyOp(state, op, ctx, fillKey, fill) {
  const { sim } = ctx;
  const format = stateFormat(state); // the rule this state's HP and PP are in
  switch (op?.op) {
    case 'add': {

      const gimmick = formGimmickMissing(sim.Dex, op.set.species, ctx.formGen);
      if (gimmick) {
        const written = sim.Dex.species.get(op.set.species);
        fill.notes.push(ruleNote('state.formGimmickGen', { species: written.name, gimmick: ruleNote(`state.gimmick.${gimmick}`) }));
        op = { ...op, set: { ...op.set, species: battleOnlyBase(sim.Dex, written).name } };
      }
      const missing = formItemMissing(sim.Dex, op.set.species, ctx.formGen);
      if (missing) {
        const written = sim.Dex.species.get(op.set.species);
        fill.notes.push(ruleNote('state.formItemGen', { species: written.name, item: missing }));
        op = { ...op, set: { ...op.set, species: written.baseSpecies } };
      }
      let set = fill.known;
      if (!set || toID(set.species) !== toID(op.set.species)) set = fill.made = fillSet(ctx, op.set, rngFor(sim, fillKey));
      const mon = newMon(ctx, clone(set), uniqueUid(state, `m${hashKey(fillKey)}`));
      if (op.set.hpPercent !== undefined) mon.hp = hpFromPercent(sim, mon.set, op.set.hpPercent, false, format);
      if (op.set.status) mon.status = op.set.status;
      if (mon.hp === 0) mon.status = 'fnt';

      if (op.ot) mon.ot = String(op.ot).trim().slice(0, OT_NAME_MAX);
            // A full party sends it to the box
      (op.to === 'box' || state.party.length >= PARTY_MAX ? state.box : state.party).push(mon);
      takeCustom(state, mon.set.item, op, ctx, false);
      markDex(state, sim, mon.set.species, true);
      return;
    }
    case 'egg': {

      const species = sim.Dex.species.get(op.species);
      if (!species.exists) fail('unknownSpecies', { species: op.species });
      let set = fill.known;
      if (!set || toID(set.species) !== species.id) set = fill.made = giftEgg(sim.Dex, species.name, rngFor(sim, fillKey), { levelUp: joiningLevelUp(ctx), oneSpecial: oneSpecialAt(ctx) });
      const egg = newEgg(ctx, clone(set), uniqueUid(state, `e${hashKey(fillKey)}`));
      (op.to === 'box' || state.party.length >= PARTY_MAX ? state.box : state.party).push(egg);
      return;
    }
    case 'level': {
      const { list, index, mon } = findMon(state, op.ref, ctx);
      const delta = op.to !== undefined ? op.to - mon.set.level : op.delta;
      if (!Number.isInteger(delta) || delta <= 0) fail('levelUpOnly', { mon: monLabel(mon), level: mon.set.level });
      if (mon.set.level >= MAX_LEVEL) fail('maxLevel', { mon: monLabel(mon), max: MAX_LEVEL });

      list[index] = op.candy ? levelUpOutside(mon, delta, ctx, null, outsideOf(state, { effort: false, levelFriendship: !candyFriendship(mon, 'vitamin', ctx) }))
        : levelUpOutside(mon, delta, ctx, rngFor(sim, fillKey), outsideOf(state));
      return;
    }
    case 'heal': {
      if (op.ref === 'all') {
        healParty(state, ctx, op);

        if (fullHeal(op) && ruleValues(ctx).boxHeal) healBox(state, ctx);
        return;
      }
      heal(sim, findMon(state, op.ref, ctx).mon, op, format);
      return;
    }
    case 'rest': return shortRest(state, sim);
    case 'swap': {
            // Swap two Pokemon's places - reordering the party, party<->box swaps (panel)
      const a = findMon(state, op.a, ctx, { egg: true }), b = findMon(state, op.b, ctx, { egg: true });
      if (a.mon.uid === b.mon.uid) fail('swapSame', { mon: monLabel(a.mon) });
      a.list[a.index] = b.mon;
      b.list[b.index] = a.mon;
      for (const { list, mon } of [a, b]) if (list === state.box) delete mon.revived; // the box one goes into the party: a revived fossil is received
      return;
    }
    case 'item': {

      const id = takenItem(state, op, ctx);
      if (!id) fail('itemNoName');
      takeCustom(state, id, op, ctx, op.delta > 0);

      if (op.fromBag && (state.bag[id] ?? 0) + op.delta < 0) fail('notInBag');
      const count = Math.max(0, (state.bag[id] ?? 0) + op.delta);
      if (count) state.bag[id] = count; else delete state.bag[id];
      return;
    }
    case 'release': {

      const { list, index, mon } = findMon(state, op.ref, ctx, { egg: true });
      if (mon.fused) fail('releaseFused', { mon: monLabel(mon) });
      list.splice(index, 1);
      return;
    }
    case 'deposit': {
      const { list, index, mon } = findMon(state, op.ref, ctx, { egg: true });
      if (list !== state.party) fail('inBox', { mon: monLabel(mon) });
      state.box.push(...list.splice(index, 1));
      return;
    }
    case 'withdraw': {
      const { list, index, mon } = findMon(state, op.ref, ctx, { boxFirst: true, egg: true });
      if (list !== state.box) fail('inParty', { mon: monLabel(mon) });
      if (state.party.length >= PARTY_MAX) fail('partyFull', { max: PARTY_MAX, mon: monLabel(mon) });
      state.party.push(...list.splice(index, 1));
      delete mon.revived;
      return;
    }
    case 'lab': {

      const items = Array.isArray(op.items) ? op.items.map(itemId) : [];
      const revival = revivalOf(items);
      if (!revival) fail('labFossil', { item: items.join(' + ') });
      if (labOf(state).length) fail('labBusy');
      for (const id of items) {
        if (!(state.bag[id] > 0)) fail('itemNotInBag', { item: id });
        if (state.bag[id] > 1) state.bag[id]--; else delete state.bag[id];
      }
      const set = op.set ? fillSet(ctx, op.set, rngFor(sim, fillKey)) : labSet(ctx, revival, rngFor(sim, fillKey));
      if (toID(set.species) !== toID(revival.species) || set.level !== revival.level) fail('labFossil', { item: items.join(' + ') });
      const mon = newMon(ctx, { ...set, item: '', name: '' }, uniqueUid(state, `f${hashKey(fillKey)}`));
      mon.lab = { items, left: LAB_TIME, ...(isLabId(op.place) ? { place: op.place } : {}) };
      state.lab = [...labOf(state), mon];
      return;
    }
    case 'nickname': {
      findMon(state, op.ref, ctx).mon.set.name = String(op.name ?? '').trim();
      return;
    }
    case 'hold': {
      const { mon } = findMon(state, op.ref, ctx);
      const item = op.item ? itemId(op.item) : '';
      takeCustom(state, item, op, ctx);
      if (op.fromBag) {

        const shared = ruleValues(ctx).zCrystalShare ? id => isZCrystal(sim, id) : () => false;
        if (item && !(state.bag[item] > 0)) fail('itemNotInBag', { item });
        if (item && !shared(item)) { state.bag[item] -= 1; if (!state.bag[item]) delete state.bag[item]; }
        const old = mon.set.item;
        if (old) state.bag[old] = shared(old) ? Math.max(state.bag[old] ?? 0, 1) : (state.bag[old] ?? 0) + 1;
      }
      mon.set.item = item;
      dropStoppedEvolution(sim.Dex, mon, ctx);
      return;
    }
    case 'evolve': {

      const { mon } = findMon(state, op.ref, ctx);

      const to = (op.forms && pickForm(op.forms, { species: toID(mon.set.species), gender: mon.set.gender })) || op.species;
      evolve(state, ctx, mon, to, { decoration: op.decoration });

      if (op.gigantamax === true && takesMaxSoup(sim.Dex.species.get(mon.set.species))) mon.set.gigantamax = true;
      return;
    }
    case 'teach': {
      const { mon } = findMon(state, op.ref, ctx);
      const move = sim.Dex.moves.get(op.move);
      if (!move.exists) fail('unknownMove', { move: op.move });
      if (mon.set.moves.includes(move.id)) fail('knowsMove', { mon: monLabel(mon), move: move.name });
      if (!op.forget) {
        if (mon.set.moves.length < MAX_MOVES) {
          mon.set.moves.push(move.id);
          mon.pending.moves = mon.pending.moves.filter(m => m !== move.id);
          settlePending(mon);
        } else if (!mon.pending.moves.includes(move.id)) mon.pending.moves.push(move.id);
        return;
      }
      const at = mon.set.moves.indexOf(toID(op.forget));
      if (at < 0) fail('forgetUnknown', { mon: monLabel(mon), move: op.forget });
      forgetMove(mon, mon.set.moves[at]);
      mon.set.moves[at] = move.id;
      mon.pending.moves = mon.pending.moves.filter(m => m !== move.id);
      return;
    }
    case 'money': {
      if (state.money === null) return; // a chat whose money is tracked by a compatible bot
      state.money = Math.max(0, state.money + op.delta);
      return;
    }

    case 'learn': {

      const { mon } = findMon(state, op.ref, ctx);
      const move = sim.Dex.moves.get(op.move);
      if (!move.exists) fail('unknownMove', { move: op.move });
      mon.pending.moves = mon.pending.moves.filter(m => m !== move.id);
      if (!op.skip) {
        if (mon.set.moves.includes(move.id)) fail('knowsMove', { mon: monLabel(mon), move: move.name });
        if (op.forget) {
          const at = mon.set.moves.indexOf(toID(op.forget));
          if (at < 0) fail('forgetUnknown', { mon: monLabel(mon), move: op.forget });
          forgetMove(mon, mon.set.moves[at]);
          mon.set.moves[at] = move.id;
        } else {
          if (mon.set.moves.length >= MAX_MOVES) fail('movesFull', { mon: monLabel(mon), max: MAX_MOVES });
          mon.set.moves.push(move.id);
        }
      }
      settlePending(mon);
      return;
    }
    case 'evolvelock': {

      const { mon } = findMon(state, op.ref, ctx);
      if (op.locked === true) mon.evolveLocked = true; else delete mon.evolveLocked;
      dropStoppedEvolution(sim.Dex, mon, ctx);
      return;
    }
    case 'noevolve': {

      const { mon } = findMon(state, op.ref, ctx);
      mon.pending.evolve = null;
      settlePending(mon);
      return;
    }
    case 'pp': {

      const { mon } = findMon(state, op.ref, ctx);
      const ids = op.move ? [toID(op.move)] : [...mon.set.moves];
      if (op.move && !mon.set.moves.includes(ids[0])) fail('moveNotKnown', { mon: monLabel(mon), move: op.move });
      for (const id of ids) {
        const { pp: now, maxpp: max } = movePp(sim, mon, id, format);
        const next = op.amount === 'full' ? max : Math.min(max, now + Math.max(0, Number(op.amount) || 0));
        if (next >= max) delete mon.pp[id]; else mon.pp[id] = next;
      }
      return;
    }
    case 'ppup': {

      const { mon } = findMon(state, op.ref, ctx);
      const id = toID(op.move);
      if (!mon.set.moves.includes(id)) fail('moveNotKnown', { mon: monLabel(mon), move: op.move });
      const move = sim.Dex.moves.get(id);
      const from = ppUpsOf(mon, id);
      const to = ppUpCount(move, from + Math.max(0, Math.trunc(Number(op.amount) || 0)));
      if (to <= from) fail('ppMax', { mon: monLabel(mon), move: move.name });
      const { pp: now, maxpp: oldMax } = movePp(sim, mon, id, format);
      (mon.ppUps ??= {})[id] = to;
      const max = maxPp(sim, id, to, format);
      if (Object.hasOwn(mon.pp, id) && now + max - oldMax < max) mon.pp[id] = now + max - oldMax; else delete mon.pp[id];
      return;
    }

    case 'evs': {

      const { mon } = findMon(state, op.ref, ctx);
      const stat = String(op.stat ?? '');
      if (!STATS.includes(stat)) fail('unknownStat', { stat: op.stat });

      if (op.statExp && oneSpecialAt(ctx)) {
        const oldMax = maxHp(sim, mon.set, format);
        if (!statExpVitamin(mon, stat)) fail('evsMax', { mon: monLabel(mon) });
        keepHpGain(sim, mon, oldMax, format);
        return;
      }
      const evs = mon.set.evs ??= {};
      for (const s of STATS) evs[s] ??= 0;
      const amount = Math.trunc(Number(op.amount) || 0);
      const gain = evGain(evs, stat, amount);
      if (!gain) fail(amount < 0 ? 'evsZero' : 'evsMax', { mon: monLabel(mon) });
      const oldMax = maxHp(sim, mon.set, format);
      evs[stat] += gain;
      keepHpGain(sim, mon, oldMax, format);
      return;
    }
    case 'exp': {

      const { list, index, mon } = findMon(state, op.ref, ctx);
      const growth = growthOf(ctx, mon.set.species);
      if (!growth) fail('noGrowth', { mon: monLabel(mon) });
      if (mon.set.level >= MAX_LEVEL) fail('maxLevel', { mon: monLabel(mon), max: MAX_LEVEL });
      const amount = Math.trunc(Number(op.amount) || 0);
      if (amount <= 0) fail('expUpOnly', { mon: monLabel(mon) });
      const low = expForLevel(growth, mon.set.level);
      const exp = Math.min(expForLevel(growth, MAX_LEVEL), Math.max(low, mon.exp ?? low) + amount);
      let to = mon.set.level;
      while (to < MAX_LEVEL && expForLevel(growth, to + 1) <= exp) to++;
      const candied = candyFriendship(mon, expCandyOf(amount), ctx); // the rule friendshipSv: the candy's own row, before its level-ups
      if (to > mon.set.level) list[index] = levelUpOutside({ ...mon, exp }, to - mon.set.level, ctx, null, outsideOf(state, { effort: false, levelFriendship: !candied }));
      else mon.exp = exp;
      return;
    }
    case 'ability': {

      const { mon } = findMon(state, op.ref, ctx);
      const species = sim.Dex.species.get(mon.set.species);
      const ability = Object.values(species.abilities).find(a => toID(a) === toID(op.ability));
      if (!ability) fail('abilityNot', { mon: monLabel(mon), ability: op.ability });
      if (toID(ability) === toID(mon.set.ability)) fail('abilitySame', { mon: monLabel(mon), ability });
      mon.set.ability = ability;
      delete mon.abilitySlot;
      // An ability given by hand (Ability Capsule, Patch, Zygarde Cube) stays through the generation rule (crossEra, keepOrigins)
      mon.chosenAbility = true;
      return;
    }
    case 'nature': {

      const { mon } = findMon(state, op.ref, ctx);
      const nature = sim.Dex.natures.get(op.nature);
      if (!nature.exists) fail('unknownNature', { nature: op.nature });
      if (nature.name === mon.set.nature) fail('natureSame', { mon: monLabel(mon), nature: nature.name });
      const original = mon.natureOrig ?? mon.set.nature;
      mon.set.nature = nature.name;
      if (nature.name === original) delete mon.natureOrig; else mon.natureOrig = original;
      return;
    }
    case 'hypertrain': {

      const { mon } = findMon(state, op.ref, ctx);
      if (mon.set.level < HYPER_TRAIN_LEVEL) fail('hyperLevel', { mon: monLabel(mon), level: HYPER_TRAIN_LEVEL });
      const stats = op.stats === 'all' ? STATS : [].concat(op.stats ?? []);
      if (!stats.length || stats.some(s => !STATS.includes(s))) fail('unknownStat', { stat: op.stats });
      const ivs = mon.set.ivs ??= {};
      const raise = stats.filter(s => (ivs[s] ?? MAX_IV) < MAX_IV);
      if (!raise.length) fail('ivsMax', { mon: monLabel(mon) });
      const oldMax = maxHp(sim, mon.set, format);
      mon.hyper ??= {};
      for (const s of raise) { mon.hyper[s] = ivs[s]; ivs[s] = MAX_IV; }
      keepHpGain(sim, mon, oldMax, format);
      return;
    }
    case 'tera': {

      const { mon } = findMon(state, op.ref, ctx);
      const type = sim.Dex.types.get(String(op.type ?? ''));
      if (!type.exists) fail('unknownType', { type: op.type });
      if (fixedTeraType(sim.Dex, mon.set.species)) fail('teraFixed', { mon: monLabel(mon) });
      if (mon.set.teraType === type.name) fail('teraSame', { mon: monLabel(mon), type: type.name });
      mon.set.teraType = type.name;
      return;
    }
    case 'gmax': {

      const { mon } = findMon(state, op.ref, ctx);
      if (typeof op.on !== 'boolean') fail('unknownOp', { op: 'gmax' });
      const { species, has } = gmaxOf(sim.Dex, mon.set);
      if (!takesMaxSoup(species)) fail('gmaxNot', { mon: monLabel(mon) });
      if (has === op.on) fail('gmaxSame', { mon: monLabel(mon) });
      mon.set.species = species.name;
      if (op.on) mon.set.gigantamax = true; else delete mon.set.gigantamax;
      return;
    }
    case 'dmaxLevel': {

      const { mon } = findMon(state, op.ref, ctx);
      const level = mon.set.dynamaxLevel ?? 0;
      if (gmaxOf(sim.Dex, mon.set).species.cannotDynamax) fail('dmaxNot', { mon: monLabel(mon) });
      if (op.delta !== 1 || level >= DYNAMAX_LEVEL_MAX) fail('dmaxLevel', { mon: monLabel(mon), max: DYNAMAX_LEVEL_MAX });
      mon.set.dynamaxLevel = level + 1;
      return;
    }
    case 'form': {

      const { mon } = findMon(state, op.ref, ctx);
      changeForm(state, ctx, mon, op, format);
      return;
    }
    case 'fuse': {

      const { mon } = findMon(state, op.ref, ctx);
      if (mon.fused) fail('fuseAlready', { mon: monLabel(mon) });
      const at = state.party.findIndex(m => m.uid === op.with?.uid);
      if (at < 0 || state.party[at] === mon || isEgg(state.party[at])) fail('fuseNot', { mon: monLabel(mon) });
      changeForm(state, ctx, mon, op, format);
      mon.fused = state.party.splice(at, 1)[0];
      return;
    }
    case 'unfuse': {

      const { mon } = findMon(state, op.ref, ctx);
      if (!mon.fused) fail('fuseNot', { mon: monLabel(mon) });
      if (state.party.length >= PARTY_MAX) fail('partyFull', { mon: monLabel(mon.fused), max: PARTY_MAX });
      changeForm(state, ctx, mon, op, format);
      state.party.push(mon.fused);
      delete mon.fused;
      return;
    }
    case 'friendship': {

      const { mon } = findMon(state, op.ref, ctx);
      const source = String(op.source ?? '');
      const amount = op.amount === undefined || op.amount === null ? null : Number(op.amount);
      if (!/^[a-z]{1,16}$/.test(source) || (amount === null ? !Object.hasOwn(FRIENDSHIP_STEPS, source) : !Number.isInteger(amount) || !amount)) {
        fail('friendshipAmount', { amount: `${op.source} ${op.amount ?? ''}`.trim() });
      }
      addFriendship(mon, amount, source, ctx);
      return;
    }
    case 'boxname': {
            // Box name (tapping the "Box 1" label renames it). Empty name = default name
      const index = Number(op.box);
      if (!Number.isInteger(index) || index < 0 || index >= BOX_NAME_SLOTS) fail('boxNumber', { box: op.box });
      const names = [...(state.boxNames ?? [])];
      while (names.length <= index) names.push('');
      names[index] = String(op.name ?? '').trim().slice(0, BOX_NAME_MAX);
      while (names.length && !names.at(-1)) names.pop();
      if (names.length) state.boxNames = names; else delete state.boxNames;
      return;
    }
    case 'breed': {

      if (op.stop) { delete state.breeding; return; }
      const a = findMon(state, op.a, ctx), b = findMon(state, op.b, ctx);
      if (a.mon.uid === b.mon.uid) fail('breedSame', { mon: monLabel(a.mon) });
      for (const { list, mon } of [a, b]) if (list !== state.party) fail('breedBox', { mon: monLabel(mon) });
      state.breeding = [a.mon.uid, b.mon.uid];
      return;
    }
    case 'hatched': {

      const { mon } = findMon(state, op.ref, ctx, { egg: true });
      if (isEgg(mon)) {
        if (!mon.egg.ready) fail('isEgg');
        hatch(state, ctx, mon);
      }
      delete mon.pending.hatched;
      return;
    }
    case 'amie': {

      const { mon } = findMon(state, op.ref, ctx);
      const have = enjoymentOf(mon);
      const gains = op.gains ?? [op.spend];
      const ok = Array.isArray(gains) && gains.length > 0 && gains.every(g => Number.isInteger(g) && g > 0 && g % ENJOY_STEP === 0);
      const spend = ok ? gains.reduce((sum, g) => sum + g, 0) : 0;
      if (!ok || spend > have) fail('amieSpend', { mon: monLabel(mon), have });
      setEnjoyment(mon, have - spend);
      for (const g of gains) addFriendship(mon, friendshipFor(g), 'amie', ctx);
      return;
    }
    case 'train': {

      const { mon } = findMon(state, op.ref, ctx);
      const bags = Array.isArray(op.bags) ? op.bags : [];
      const bad = bags.find(id => !bagOf(id)) ?? (op.hung && !isHungBag(op.hung) ? op.hung.id ?? '' : undefined);
      if (bad !== undefined || (!bags.length && op.hung === undefined)) fail('trainBag', { bag: bad ?? '' });
      const oldMax = maxHp(sim, mon.set, format);
      const { trainee, friendship } = clearBags(traineeOf(mon), bags);
      setTrainee(mon, trainee);
      if (op.hung !== undefined) setHungBag(mon, op.hung);
      if (friendship) addFriendship(mon, friendship, 'soothing', ctx);
      keepHpGain(sim, mon, oldMax, format);
      return;
    }
    case 'feed': {

      const { mon } = findMon(state, op.ref, ctx);
      const species = sim.Dex.species.get(mon.set.species);
      if (!eatsFood(species.num)) fail('feedNever', { mon: monLabel(mon) });
      if (!canEat(mon)) fail('feedFull', { mon: monLabel(mon) });
      let friendship;
      if (op.puff !== undefined) {
        const puff = parsePuff(op.puff) ?? fail('unknownPuff', { puff: op.puff });
        if (puff.grade !== FREE_GRADE) {
          if (!puffCount(state, op.puff)) fail('puffNone', { puff: op.puff });
          addPuffs(state, op.puff, -1);
        }
        friendship = puffFriendship(puff.grade);
      } else {
        const id = itemId(op.item ?? '');
        friendship = foodFriendship(id, sim, state);
        if (!friendship) fail('notFood', { item: op.item });
        if (!(state.bag[id] > 0)) fail('notInBag');
        if (state.bag[id] > 1) state.bag[id]--; else delete state.bag[id];
      }
      setFullness(mon, fullnessOf(mon) + FULL_PER_FOOD);
      addFriendship(mon, friendship, 'food', ctx);
      if (mon.hp !== 0 && op.heal !== false) heal(sim, mon, { hpAdd: foodHeal(maxHp(sim, mon.set, format)) }, format);
      return;
    }
    case 'puff': {

      const puff = parsePuff(op.puff) ?? fail('unknownPuff', { puff: op.puff });
      if (puff.grade === FREE_GRADE || !Number.isInteger(op.delta) || !op.delta) fail('unknownPuff', { puff: op.puff });
      if (puffCount(state, op.puff) + op.delta < 0) fail('puffNone', { puff: op.puff });
      addPuffs(state, op.puff, op.delta);
      return;
    }
    case 'amieRecord': {

      if (!validRecord(op)) fail('unknownOp', { op: 'amieRecord' });
      if (!beatsRecord(op.game, op.score, recordOf(state.amieRecords, op.game, op.level))) return;
      state.amieRecords = { ...state.amieRecords, [op.game]: { ...state.amieRecords?.[op.game], [op.level]: op.score } };
      return;
    }
  }
  fail('unknownOp', { op: op?.op });
}

function keepHpGain(sim, mon, oldMax, formatid) {
  if (mon.hp === null || mon.hp === undefined || mon.hp <= 0) return;
  const max = maxHp(sim, mon.set, formatid);
  mon.hp = Math.min(max, mon.hp + Math.max(0, max - oldMax));
  if (mon.hp >= max) mon.hp = null;
}

function settlePending(mon) {
  if (!mon.pending.moves.length && !mon.pending.evolve) mon.pending.levels = 0;
}

export function dropStoppedEvolution(dex, mon, ctx) {
  const held = ruleValues(ctx).everstoneWaiting ? mon.set.item : '';
  if (!mon.pending?.evolve || !evolutionStops(dex, { species: mon.set.species, item: held, gigantamax: mon.set.gigantamax === true, ...lockMark(mon.evolveLocked) }, 'level')) return;
  mon.pending.evolve = null;
  settlePending(mon);
}

export function maxPp(sim, moveId, ppUps = 0, formatid) {
  return formatRules(sim, formatid || DEFAULT_FORMAT).maxPp(moveId, ppUps);
}

/** PP Up count of one move of this Pokemon (0 if none) */
export const ppUpsOf = (mon, moveId) => mon?.ppUps?.[toID(moveId)] ?? 0;

export function movePp(sim, mon, moveId, formatid) {
  const id = toID(moveId), ppUps = ppUpsOf(mon, id), maxpp = maxPp(sim, id, ppUps, formatid);
  return { pp: Math.min(maxpp, mon?.pp?.[id] ?? maxpp), maxpp, ppUps };
}

function forgetMove(mon, moveId) {
  delete mon.pp[moveId];
  if (mon.ppUps) {
    delete mon.ppUps[moveId];
    if (!Object.keys(mon.ppUps).length) delete mon.ppUps;
  }
}

function ppUpsFromSlots(moves, previous) {
  const entries = moves.map(m => [m.id, Number.isInteger(m.ppUps) ? m.ppUps : previous?.[m.id] ?? 0]).filter(([, n]) => n > 0);
  return entries.length ? Object.fromEntries(entries) : null;
}

export function healParty(state, ctx, op = {}) {
  const format = stateFormat(state);
  for (const mon of state.party) heal(ctx.sim, mon, op, format);
  if (fullHeal(op)) delete state.restsUsed;
}

function healBox(state, ctx) {
  const format = stateFormat(state);
  for (const mon of state.box) if (!isEgg(mon)) heal(ctx.sim, mon, {}, format);
}

export const SHORT_RESTS = 2;
const SHORT_REST_SHARE = 0.5;
/** Short rests left in this state (0 - SHORT_RESTS) */
export const restsLeft = state => Math.max(0, SHORT_RESTS - (state?.restsUsed ?? 0));
/** What a short rest gives back of a max value: whole points, at least 1 */
const restShare = max => Math.max(1, Math.floor(max * SHORT_REST_SHARE));

function shortRest(state, sim) {
  if (!restsLeft(state)) fail('noRest', { max: SHORT_RESTS });
  if (!restHelps(state, sim)) fail('restNoEffect');
  const format = stateFormat(state);
  for (const mon of state.party) {
    if (isEgg(mon) || mon.hp === 0) continue;
    const max = maxHp(sim, mon.set, format);
    const hp = Math.min(max, (mon.hp ?? max) + restShare(max));
    mon.hp = hp >= max ? null : hp;
    mon.status = '';
    for (const id of mon.set.moves) {
      const { pp, maxpp } = movePp(sim, mon, id, format);
      const next = Math.min(maxpp, pp + restShare(maxpp));
      if (next >= maxpp) delete mon.pp[id]; else mon.pp[id] = next;
    }
  }
  state.restsUsed = (state.restsUsed ?? 0) + 1;
}

export function restHelps(state, sim) {
  const format = stateFormat(state);
  const missing = mon => (mon.hp ?? Infinity) < maxHp(sim, mon.set, format) || mon.set.moves.some(id => { const { pp, maxpp } = movePp(sim, mon, id, format); return pp < maxpp; });
  return state.party.some(mon => !isEgg(mon) && mon.hp !== 0 && (!!mon.status || missing(mon)));
}

const fullHeal = ({ hpPercent, hpAdd, statusOnly, revive }) => hpPercent === undefined && hpAdd === undefined && !statusOnly && !revive;
function heal(sim, mon, { hpPercent, hpAdd, statusOnly, revive }, formatid) {
  const fainted = mon.hp === 0;
  if (hpAdd !== undefined) {

    if (fainted) fail('fainted', { mon: monLabel(mon) });
    const max = maxHp(sim, mon.set, formatid);
    const hp = Math.min(max, (mon.hp ?? max) + Math.max(0, Number(hpAdd) || 0));
    mon.hp = hp >= max ? null : hp;
    return;
  }
  if (statusOnly) {
    if (!fainted) mon.status = '';
    return;
  }
  if (revive) {
    if (!fainted) return;
    mon.hp = hpPercent === undefined ? null : hpFromPercent(sim, mon.set, hpPercent, true, formatid);
    mon.status = '';
    return;
  }
  if (hpPercent !== undefined) {
        // A fainted Pokemon only gets up with "revive"
    if (!fainted) mon.hp = hpFromPercent(sim, mon.set, hpPercent, true, formatid);
    return;
  }

  mon.hp = null;
  mon.status = '';
  mon.pp = {};
}

// -- Making Pokemon -----------------------------------------

export function fillSet(ctx, teamSet, rng) {
  const { sim } = ctx, levelUp = joiningLevelUp(ctx);
  const { hpPercent, status, ...set } = clone(teamSet);
  const species = sim.Dex.species.get(set.species);
  if (!species.exists) fail('unknownSpecies', { species: set.species });
  set.species = species.name;
  if (!Number.isInteger(set.level) || set.level < 1 || set.level > MAX_LEVEL) fail('levelRange', { species: species.name, max: MAX_LEVEL, level: set.level });
  if (status !== undefined && !STATUS_IDS.has(status)) fail('unknownStatus', { species: species.name, status });
  if (set.moves?.length) {
    set.moves = set.moves.map(m => {
      const move = sim.Dex.moves.get(m);
      if (!move.exists) fail('speciesUnknownMove', { species: species.name, move: m });
      return move.id;
    });
  }

  const full = completeSet(sim.Dex, set, rng, { levelUp, label: species.name, ...(oneSpecialAt(ctx) ? { oneSpecial: true } : {}) });
  full.item = full.item ? itemId(full.item) : '';
  full.name = full.name ?? '';
  return full;
}

export function labSet(ctx, revival, rng) {
  const set = fillSet(ctx, { species: revival.species, level: revival.level }, rng);
  const left = STATS.filter(stat => set.ivs[stat] < MAX_IV);
  for (let n = STATS.filter(stat => set.ivs[stat] >= MAX_IV).length; n < (revival.perfectIvs ?? 0) && left.length; n++) {
    set.ivs[left.splice(rng.random(left.length), 1)[0]] = MAX_IV;
  }
  return set;
}

export function newMon(ctx, set, uid) {
  const growth = growthOf(ctx, set.species);
  return {
    uid, set, hp: null, status: '', pp: {},
    exp: growth ? expForLevel(growth, set.level) : 0,
    pending: { levels: 0, moves: [], evolve: null },
    ...(ruleValues(ctx).startFull ? { full: FULL_MAX } : {}),
    ...metGenField(ctx),
  };
}

const metGenField = ctx => { const met = metGenAt(ctx); return met === null ? {} : { metGen: met }; };

// -- Level-up outside battle ----------------------------------------

export const levelUpMoves = (ctx, species, mon = null, state = null) =>
  learnsetOf(mon ? levelUpAt(ctx.levelUp, learnGenOf(ctx, mon, state)) : ctx.levelUp, ctx.sim.Dex.species.get(species)) ?? [];

const joiningLevelUp = ctx => levelUpAt(ctx.levelUp, learnGenOf(ctx));

export function rememberableMoves(ctx, mon, state = null) {
  const known = new Set(mon.set.moves.map(toID));
  const lowest = new Map();
  for (const [level, move] of levelUpMoves(ctx, steedBase(ctx.sim.Dex.species.get(mon.set.species).name) ?? mon.set.species, mon, state)) {
    if (level > mon.set.level || known.has(move)) continue;
    if (!lowest.has(move) || level < lowest.get(move)) lowest.set(move, level);
  }
  return [...lowest].map(([move, level]) => ({ move, level })).sort((a, b) => a.level - b.level);
}

const outsideOf = (state, extra) => ({ party: state.party, badges: badgeCount(state), format: stateFormat(state), state, ...extra });

function candyFriendship(mon, source, ctx) {
  if (!source || !ruleValues(ctx).friendshipSv) return false;
  addFriendship(mon, null, source, ctx);
  return true;
}

const expCandyOf = amount => Object.keys(OUTSIDE_ITEMS).find(id => OUTSIDE_ITEMS[id].exp === amount && Object.hasOwn(FRIENDSHIP_STEPS_SV, id)) ?? null;

export function levelUpOutside(mon, delta, ctx, rng, { effort, party = [], badges = 0, format = DEFAULT_FORMAT, levelFriendship = true, state = null } = {}) {
  const { sim } = ctx;
  effort ??= formatRules(sim, format).effort;
  const next = clone(mon);
  const set = next.set;
  const from = set.level;
  const to = Math.min(MAX_LEVEL, from + Math.trunc(delta));
  if (to <= from) return next;
  const growth = growthOf(ctx, set.species);

    // Exp: kept as is within the new level, clamped into its range
  if (growth) {
    const low = expForLevel(growth, to);
    const high = to < MAX_LEVEL ? expForLevel(growth, to + 1) - 1 : low;
    next.exp = Math.max(low, Math.min(high, mon.exp ?? 0));
  }

  if (effort) set.evs = gainEffort({ ...set.evs }, outsideDefeats(growth ?? 'mediumfast', from, to), rng);

  const oldMax = maxHp(sim, { ...mon.set }, format);
  set.level = to;
  const newMax = maxHp(sim, set, format);
  if (next.hp !== null && next.hp > 0) next.hp = Math.min(newMax, next.hp + newMax - oldMax);

  next.pending.levels += to - from;
  for (const [level, moveid] of levelUpMoves(ctx, set.species, next, state)) {
    if (level <= from || level > to) continue;
    if (set.moves.includes(moveid) || next.pending.moves.includes(moveid)) continue;
    next.pending.moves.push(moveid);
  }

  if (levelFriendship) for (let level = from; level < to; level++) addFriendship(next, null, 'level', ctx);

  const { mon: evolving, now } = evolutionCheck(ctx, next, party, badges);
  const evolution = levelEvolution(sim.Dex, evolving, now); // engine/evolution.mjs - the same check as in battle
  if (evolution) next.pending.evolve = evolution;
  return next;
}

export function outsideDefeats(curve, from, to) {
  let defeats = 0;
  for (let level = from; level < to; level++) {
    const need = expForLevel(curve, level + 1) - expForLevel(curve, level);
    defeats += need / calcExpGain({ baseExp: TYPICAL_BASE_EXP, level, victorLevel: level, rate: STORY_EXP_PACE });
  }
  return Math.max(1, Math.round(defeats));
}

function gainEffort(evs, defeats, rng) {
  for (const s of STATS) evs[s] ??= 0;
  let total = STATS.reduce((sum, s) => sum + evs[s], 0);
  for (let i = 0; i < defeats && total < EV_TOTAL_MAX; i++) {
    const open = STATS.filter(s => evs[s] < EV_STAT_MAX);
    if (!open.length) break;
    const stat = open[rng.random(open.length)];
    const gain = Math.min(rng.random(RARE_EV_ODDS) === 0 ? RARE_EV_YIELD : TYPICAL_EV_YIELD, EV_STAT_MAX - evs[stat], EV_TOTAL_MAX - total);
    evs[stat] += gain;
    total += gain;
  }
  return evs;
}

function changeForm(state, ctx, mon, op, format) {
  const { sim } = ctx;
  const from = sim.Dex.species.get(mon.set.species), to = sim.Dex.species.get(String(op.species ?? ''));
  if (!to.exists || to.battleOnly || to.baseSpecies !== from.baseSpecies || to.name === from.name) fail('formNot', { mon: monLabel(mon), species: op.species });
  const oldMax = maxHp(sim, mon.set, format);
  const kept = mon.formAbility && Object.values(to.abilities).find(a => toID(a) === toID(mon.formAbility));
  const slot = Object.keys(from.abilities).find(k => toID(from.abilities[k]) === toID(mon.set.ability));
  if (kept) delete mon.formAbility;
  else if (slot && !to.abilities[slot]) mon.formAbility = mon.set.ability;
  // A slot kept on a form without it (by the generation rule, crossEra, as on Tornadus-Therian, or by an evolution,
  // keepSlot) is taken where the form has it
  const carried = !kept && ruleValues(ctx).eraAbilities && mon.abilitySlot ? to.abilities[mon.abilitySlot] : null;
  mon.set.ability = kept || carried || sameSlotAbility(from, mon.set.ability, to);
  if (carried) delete mon.abilitySlot;
  mon.set.species = to.name;
  for (const [old, now] of op.moves ?? []) {
    const at = mon.set.moves.indexOf(toID(old));
    const move = sim.Dex.moves.get(now);
    if (at < 0 || !move.exists || mon.set.moves.includes(move.id)) continue;
    forgetMove(mon, mon.set.moves[at]);
    mon.set.moves[at] = move.id;
  }

  for (const old of op.forget ?? []) {
    const at = mon.set.moves.indexOf(toID(old));
    if (at < 0) continue;
    forgetMove(mon, mon.set.moves[at]);
    mon.set.moves.splice(at, 1);
  }
  const learn = op.learn ? sim.Dex.moves.get(op.learn) : null;
  if (learn?.exists && !mon.set.moves.includes(learn.id)) {
    if (mon.set.moves.length < MAX_MOVES) mon.set.moves.push(learn.id);
    else if (!mon.pending.moves.includes(learn.id)) mon.pending.moves.push(learn.id);
  }

  const otherForms = move => (formMoveOwners(move) ?? []).filter(form => sim.Dex.species.get(form).baseSpecies === to.baseSpecies);
  mon.pending.moves = mon.pending.moves.filter(move => { const owners = otherForms(move); return !owners.length || owners.includes(to.name); });
  settlePending(mon);
  keepHpGain(sim, mon, oldMax, format);
  markDex(state, sim, to.name, true);
}

// The ability slot a Pokémon holds: `kept` (abilitySlot) while its species lacks that slot, else its ability's
const heldSlot = (species, ability, kept = null) => (kept && !species.abilities[kept] ? kept : Object.keys(species.abilities).find(k => toID(species.abilities[k]) === toID(ability)) ?? '0');

function sameSlotAbility(from, ability, to, kept = null) {
  const slot = heldSlot(from, ability, kept);
  return to.abilities[slot] ?? to.abilities['0'];
}

// After an evolution the slot is kept while the species lacks it (a Hidden Ability through Metapod), under the rule eraAbilities
function keepSlot(from, mon, to) {
  const slot = heldSlot(from, mon.set.ability, mon.abilitySlot);
  if (to.abilities[slot]) delete mon.abilitySlot; else if (slot !== '0') mon.abilitySlot = slot;
}

function evolve(state, ctx, mon, target, { decoration, taught = false } = {}) {
  const { sim } = ctx;
  const from = sim.Dex.species.get(mon.set.species);
  const to = sim.Dex.species.get(target);
  if (!to.exists) fail('unknownSpecies', { species: target });
  const before = clone(mon);
  const slotted = !!ruleValues(ctx).eraAbilities;
  const ability = sameSlotAbility(from, mon.set.ability, to, slotted ? mon.abilitySlot : null);
  if (slotted) keepSlot(from, mon, to);
  mon.set.ability = ability;
  mon.set.species = to.name;
  if (usesHeldItem(sim.Dex, to.name, mon.set.item)) mon.set.item = '';
  if (decoration) mon.decoration = itemId(decoration);
  delete mon.counts;
  mon.pending.evolve = null;

  for (const moveid of taught ? [] : evolutionLevelMoves(levelUpMoves(ctx, to.name, mon, state), mon.set.level, learnGenOf(ctx, mon, state))) {
    if (mon.set.moves.includes(moveid) || mon.pending.moves.includes(moveid)) continue;
    mon.pending.moves.push(moveid);
  }
  settlePending(mon);
  markDex(state, sim, to.name, true);
  for (const name of extraEvolutions(sim.Dex, from.name, to.name)) {
    if (state.party.length >= PARTY_MAX || !(state.bag.pokeball > 0)) break;
    const extra = sim.Dex.species.get(name);
    // and the slot of the Pokémon it comes from, kept when the new species lacks that slot, as an evolution keeps it (a
    // Shedinja from a Nincada that took its Hidden Ability keeps slot H, as the Ninjask keeps its Hidden Ability)
    const slot = slotted ? heldSlot(from, before.set.ability, before.abilitySlot) : '0', has = !!extra.abilities[slot];
    const set = { ...clone(before.set), species: extra.name, ability: has ? extra.abilities[slot] : extra.abilities['0'], item: '', name: '', gender: extra.gender === 'N' ? '' : before.set.gender };
    const { metGen: _, ...made } = newMon(ctx, set, uniqueUid(state, `${mon.uid}-${extra.id}`)); // met where the Pokemon it comes from was
    const born = { ...made, ball: 'pokeball', ...(!has && slot !== '0' ? { abilitySlot: slot } : {}), ...(before.exp === undefined ? {} : { exp: before.exp }), ...(before.ot ? { ot: before.ot } : {}),
      ...(Number.isInteger(before.metGen) ? { metGen: before.metGen } : {}), ...(before.hadAbility ? { hadAbility: true } : {}), ...(before.tookHidden ? { tookHidden: true } : {}),
      ...(before.chosenAbility ? { chosenAbility: true } : {}) };
    state.bag.pokeball -= 1;
    if (!state.bag.pokeball) delete state.bag.pokeball;
    state.party.push(born);
    markDex(state, sim, extra.name, true);
  }
}

// -- Battle result ---------------------------------------------

// caught: a Set that receives the uid of any Pokémon the battle caught (computeState's story-end branch)
export function applyBattleResult(before, result, ctx, { battle = null, outcome = outcomeOf(result), start = null, format = null, caught: catches = null } = {}) {
  const { sim } = ctx;
  const state = clone(before);

  const own = stateFormat(state);
  const hpIn = (member, set) => {
    if (member.hp <= 0) return 0;
    if (format && format !== own) return shareOf(member.hp, member.maxhp, maxHp(sim, set, own));
    return member.hp >= member.maxhp ? null : member.hp;
  };
  const mine = result.sides.find(s => s.id === 'p1');
  const theirs = result.sides.find(s => s.id === 'p2');
  const evolutions = new Map((result.evolutions ?? []).filter(e => !e.unsupported).map(e => [e.uid, e]));
  const started = new Map((start ?? []).map(m => [m.uid, m]));

  for (const used of result.itemsUsed ?? []) {
    const id = itemId(used.item);
    const count = Math.max(0, (state.bag[id] ?? 0) - 1);
    if (count) state.bag[id] = count; else delete state.bag[id];
  }
  tidyCustomItems(state);

  for (const member of mine?.team ?? []) {
    const mon = [...state.party, ...state.box].find(m => m.uid === member.uid);
    if (!mon) continue;
    const from = started.get(member.uid) ?? { set: mon.set, exp: mon.exp, friendship: mon.friendship, friendshipCarry: mon.friendshipCarry, counts: mon.counts, statExp: mon.statExp };
    const sameSpecies = toID(mon.set.species) === toID(from.set.species);
    gainLevel(ctx, mon, member, from);

    const gained = member.friendship === undefined ? 0 : member.friendship + (member.friendshipCarry ?? 0) - friendshipOf(ctx, from) - (from.friendshipCarry ?? 0);
    if (gained && !friendshipLocked(mon)) {
      const { value, carry } = moveFriendship(friendshipOf(ctx, mon), mon.friendshipCarry ?? 0, gained);
      mon.friendship = value;
      setCarry(mon, carry);
    }

    if (member.counts) mon.counts = addCounts(mon.counts, member.counts, from.counts);
    if (member.cloak && sameSpecies && sim.Dex.species.get(mon.set.species).baseSpecies === 'Burmy') mon.set.species = member.cloak;

    if (member.statExp && ruleValues(ctx).genStats010) mon.statExp = addStatExp(mon, member.statExp, from);
    if (member.evs) mon.set.evs = effortFollows(mon.set.evs, member.evs, from.set.evs);
    learnFromBattle(mon, member.moves.map(m => m.id), (from.set.moves ?? []).map(toID));
    const slots = new Map(member.moves.map(m => [m.id, m]));
    mon.pp = Object.fromEntries(mon.set.moves.flatMap(id => {
      const slot = slots.get(id);
      if (!slot) return Object.hasOwn(mon.pp ?? {}, id) ? [[id, mon.pp[id]]] : [];
      return slot.pp < slot.maxpp ? [[id, slot.pp]] : [];
    }));

    const ppUps = ppUpsFromSlots(mon.set.moves.map(id => slots.get(id) ?? { id }), mon.ppUps);
    if (ppUps) mon.ppUps = ppUps; else delete mon.ppUps;
    mon.hp = member.fainted ? 0 : hpIn(member, mon.set);
    mon.status = mon.hp === 0 ? 'fnt' : member.status || '';
    mon.pending.moves = mon.pending.moves.filter(id => !mon.set.moves.includes(id));

    const evolution = sameSpecies ? evolutions.get(member.uid) : null;
    if (evolution?.evolved === true) {

      evolve(state, ctx, mon, evolution.to, ruleValues(ctx).metGen010 ? { taught: true } : {});
      mon.pending.moves = mon.pending.moves.filter(id => !mon.set.moves.includes(id)); // if the director already taught the L0 move
    } else if (evolution && evolution.evolved === undefined) {
      mon.pending.evolve = evolution.to; // result that never showed the evolution screen (engine result only)
      dropStoppedEvolution(sim.Dex, mon, ctx); // locked since the battle started (a battle's spec from before the lock)
    }
  }
  for (const { uid, move } of result.learnQueue ?? []) {
    const mon = [...state.party, ...state.box].find(m => m.uid === uid);
    if (mon && !mon.set.moves.includes(move) && !mon.pending.moves.includes(move)) mon.pending.moves.push(move);
  }

  for (const foe of theirs?.team ?? []) if (foe.appeared !== false) markDex(state, sim, foe.species, false);

  const who = battle && trainerKey(battle);
  if (who) {
    const team = [...theirs?.team ?? []].sort((a, b) => a.uid.localeCompare(b.uid, 'en', { numeric: true }))
      .map(foe => rosterMon({ ...foe, moves: foe.moves.map(m => m.id) }));
    state.trainers = { ...trainersOf(state), [who]: { name: battle.name, personal: personalName(battle), outcome, team } };
  }

  const caught = result.captured;
  const foe = caught && theirs?.team.find(m => m.uid === caught.uid);
  if (foe) {
    const set = {
      species: sim.Dex.species.get(caught.species).name, level: foe.level, ability: foe.ability, nature: foe.nature,
      ivs: { ...foe.ivs }, evs: { ...foe.evs }, gender: foe.gender || '', shiny: !!foe.shiny,
      teraType: foe.teraType, moves: foe.moves.map(m => m.id), item: foe.originalItem || '', name: '',

      ...(foe.gigantamax === true ? { gigantamax: true } : {}), ...(Number.isInteger(foe.dynamaxLevel) ? { dynamaxLevel: foe.dynamaxLevel } : {}),
    };
    const uid = uniqueUid(state, `c${hashKey(JSON.stringify([set, caught.turn, result.turn]))}`);
    catches?.add(uid);

    if (!set.teraType && ruleValues(ctx).catchTera010) set.teraType = autoTeraType(sim.Dex.species.get(set.species), uid) || undefined;
    const mon = newMon(ctx, set, uid);
    mon.hp = hpIn(foe, mon.set);
    mon.status = foe.status || '';
    mon.pp = Object.fromEntries(foe.moves.filter(m => m.pp < m.maxpp).map(m => [m.id, m.pp]));
    const ppUps = ppUpsFromSlots(foe.moves, null); // opponents without it in the spec have 0
    if (ppUps) mon.ppUps = ppUps;
    if (caught.ball) mon.ball = caught.ball;
    if (caught.ball === 'friendball') mon.friendship = FRIEND_BALL_FRIENDSHIP;
        // The actual box slot is decided here: last
    (caught.toBox || state.party.length >= PARTY_MAX ? state.box : state.party).push(mon);
    markDex(state, sim, set.species, true);
  }
  return state;
}

export function applyBattles(before, battles, ctx, { battle = null, caught = null } = {}) {
  return battles.reduce((state, { start, result, outcome, format }, i) => applyBattleResult(state, result, ctx, { battle: i ? null : battle, outcome, start, format, caught }), before);
}

function gainLevel(ctx, mon, end, from) {
  const level = Math.min(MAX_LEVEL, mon.set.level + Math.max(0, end.level - from.set.level));
  const growth = growthOf(ctx, mon.set.species);
  if (growth) {
    const gained = Number.isFinite(end.exp) && Number.isFinite(from.exp) ? end.exp - from.exp : 0;
    const low = expForLevel(growth, level), high = level < MAX_LEVEL ? expForLevel(growth, level + 1) - 1 : low;
    mon.exp = Math.max(low, Math.min(high, (mon.exp ?? low) + gained));
  }
  mon.set.level = level;
}

function learnFromBattle(mon, end, from) {
  const moves = [...mon.set.moves];
  end.forEach((id, i) => {
    if (from.includes(id) || moves.includes(id)) return;
    const slot = from[i] ? moves.indexOf(from[i]) : -1;
    if (slot >= 0) moves[slot] = id;
    else if (moves.length < MAX_MOVES) moves.push(id);
    else if (!mon.pending.moves.includes(id)) mon.pending.moves.push(id);
  });
  mon.set.moves = moves;
}

export const rosterMon = set => ({ species: set.species, level: set.level, nature: set.nature, ivs: { ...set.ivs }, evs: { ...set.evs },
  ability: set.ability, gender: set.gender || '', shiny: !!set.shiny, teraType: set.teraType, moves: (set.moves ?? []).map(toID) });

export function storyEndTrainer(battle, outcome, team = null) {
  const who = battle && trainerKey(battle);
  if (!who) return null;
  return { who, trainer: { name: battle.name, personal: personalName(battle), outcome, team: team ?? battle.team.map(({ species, level }) => ({ species, level })) } };
}

export const battleRecord = (spec, result, outcome) => ({ start: spec.p1.team.map(({ uid, set, exp, friendship, friendshipCarry, counts }) => ({ uid, set, exp,
  ...(friendship === undefined ? {} : { friendship }), ...(friendshipCarry ? { friendshipCarry } : {}), ...(counts ? { counts } : {}) })), result,
  ...(outcome === undefined ? {} : { outcome }), ...(spec.formatid ? { format: spec.formatid } : {}) });

export const battlesBefore = spec => spec?.before ?? [];
/** Which battle of its encounter this spec makes, from 1 */
export const stageOf = spec => battlesBefore(spec).length + 1;

export const backToBack = spec => battlesBefore(spec).length > 0 || !!waitingTrainer(spec);

// The numbers rule of a battle's format; one the rules do not list keeps the state's own (story-link.js battleNumbers)
const numbersOf = (format, state) => { try { return formatRule(format); } catch { return ruleOf(state); } };

export function nextStageSpec(spec, result, state, ctx, { seed }) {
  const waiting = waitingTrainer(spec);
  if (!waiting || outcomeOf(result) !== 'win') return null;
  const { log, screen, ...ended } = result;
  const before = [...battlesBefore(spec), battleRecord(spec, ended)];
  const applied = applyBattles(state, before, ctx);
  const now = inRule(ctx.sim, applied, numbersOf(spec.formatid, applied));
  const { foePartner, double, partner, ...same } = spec;

  const learned = new Map(spec.p1.team.map(member => [member.uid, member.learnGen]));
  const team = playerTeam(now, ctx).map(({ learnGen: own, ...member }) => {
    const gen = learned.has(member.uid) ? learned.get(member.uid) : own;
    return Number.isInteger(gen) ? { ...member, learnGen: gen } : member;
  });
  return { ...same, seed: [...seed], p1: { ...spec.p1, team }, p2: waiting,
    ...(spec.bag ? { bag: { ...otherBag(spec.bag), ...battleBag(now, toolsIn(spec)), caughtSpecies: [...now.dex.caught] } } : {}), teraOrb: hasTeraOrb(now),
    ...(Object.hasOwn(spec, 'keyStone') ? { keyStone: hasKeyStone(now) } : {}), // the Key Stone field as the first battle had it (keyStoneMega)
    ...(Object.hasOwn(spec, 'zRing') ? { zRing: hasZRing(now) } : {}),

    ...(Object.hasOwn(spec, 'dynamaxBand') ? { dynamaxBand: hasDynamaxBand(now) } : {}),
    ...(Object.hasOwn(spec, 'dynamaxShown') ? { dynamaxShown: spec.dynamaxShown || dynamaxLevelShown(now, null) } : {}), before };
}

const playerTeam = (state, ctx) => hatchedParty(state).map(mon => {
  const member = engineMember(mon, state.customItems), gen = learnGenOf(ctx, mon, state);
  return gen === null ? member : { ...member, learnGen: gen };
});

function battleBag(state, setting = true) {
  const tools = setting && ITEM_EFFECTS_READY;
  const effectOf = id => customInfo(state, id)?.effect;
  const isTool = id => TOOL_EFFECTS.includes(effectOf(id));
  const held = Object.entries(state.bag).filter(([id]) => BAG_ITEMS[id] || isBall(id) || effectOf(id));
  const items = Object.fromEntries(tools ? held : held.filter(([id]) => !isTool(id)));
  const story = Object.keys(items).filter(isCustomItem).map(id => [id, customInfo(state, id)]);
  const foods = Object.fromEntries(story.filter(([, info]) => info.effect === 'food').map(([id, { name, emoji }]) => [id, { name, emoji }]));
  const toolMap = Object.fromEntries(story.filter(([, info]) => TOOL_EFFECTS.includes(info.effect))
    .map(([id, { name, emoji, effect, owner, ownerMon }]) => [id, { name, emoji, tag: effect, ...(owner ? { owner } : {}), ...(effect === 'cheer' && ownerMon ? { ownerMon } : {}) }]));
  return { items, ...(Object.keys(foods).length ? { foods } : {}), ...(Object.keys(toolMap).length ? { tools: toolMap } : {}),
    ...(tools ? {} : { offTools: held.map(([id]) => id).filter(isTool) }) };
}

export const toolsIn = spec => !Array.isArray(spec?.bag?.offTools);

const otherBag = ({ items, foods, tools, offTools, ...rest }) => rest;
const hasTeraOrb = state => (state.bag.teraorb ?? 0) > 0;

const hasKeyStone = state => Object.entries(state.bag).some(([id, count]) => count > 0
  && (id === 'keystone' || (isCustomItem(id) && lookupId('items', customInfo(state, id)?.name ?? '') === 'keystone')));

const isZCrystal = (sim, id) => !!id && !isCustomItem(id) && !!sim.Dex.items.get(id).zMove;
const Z_RING_KEYS = new Set(Z_RING_NAMES.map(norm));

const hasZRing = state => Object.entries(state.bag).some(([id, count]) => count > 0
  && (id === 'zring' || (isCustomItem(id) && Z_RING_KEYS.has(norm(customInfo(state, id)?.name ?? '')))));
const DYNAMAX_BAND_KEYS = new Set(DYNAMAX_BAND_NAMES.map(norm));

const hasDynamaxBand = state => Object.entries(state.bag).some(([id, count]) => count > 0
  && (id === 'dynamaxband' || (isCustomItem(id) && DYNAMAX_BAND_KEYS.has(norm(customInfo(state, id)?.name ?? '')))));

export const dynamaxLevelShown = (state, region) => region === 'galar' || hasDynamaxBand({ bag: {}, ...state })
  || [...(state?.party ?? []), ...(state?.box ?? [])].some(mon => (mon?.set?.dynamaxLevel ?? 0) >= 1);

/** The items the party and box Pokemon hold (ids, '' for none) */
const heldIds = state => [...(state?.party ?? []), ...(state?.box ?? [])].map(mon => toID(mon?.set?.item ?? ''));

export const oneOfsOwned = state => {
  const keys = [['teraorb', hasTeraOrb], ['keystone', hasKeyStone], ['zring', hasZRing], ['dynamaxband', hasDynamaxBand]]
    .filter(([, has]) => has({ bag: {}, ...state })).map(([id]) => id);
  const held = heldIds(state).filter(id => isZCrystalId(id) || id === EXP_SHARE);
  return [...new Set([...keys, ...held])];
};

export const ownsExpShare = state => (state.bag?.[EXP_SHARE] ?? 0) > 0 || heldIds(state).includes(EXP_SHARE);

export function toEngineSpec(state, battle, ctx, { seed, formatid, picture, player, expShare, eraGimmicks, expRate = DEFAULT_EXP_RATE, status = null, effectItems = true, foeGimmicks = 'pokerogue',
  earlierRegion = null, blockFirst = false } = {}) {
  if (!hatchedParty(state).length) fail('noParty');
  if (!hatchedParty(state).some(m => m.hp !== 0)) fail('allFainted');
  const { sim } = ctx;
  const { place, time, timeOfDay, hour, weather, terrain } = battleScene(battle, status);
  const friendshipRate = ctx.friendshipRate ?? 1;
  const { sprite, silhouette } = opponentPicture(battle, picture);
  const bgm = bossBgm({ wild: battle.wild, boss: battle.boss, sprite, name: battle.name, trainerClass: battle.trainerClass });

  const p1 = playerTeam(state, ctx);

  const past = pairPast(sim, battle.team, trainersOf(state)[trainerKey(battle)]?.team ?? []);
  const p2 = battle.team.map((teamSet, i) => blockMember(sim, teamSet, `foe-${i + 1}`, past[i]));

  if (battle.wild && ruleValues(ctx).wildHiddenAbility) {
    for (const member of p2) {
      const hidden = wildHiddenAbility(sim.Dex, member.set, seed, member.uid);
      if (hidden) member.set.ability = hidden;
    }
  }

  const partner = battle.partner && { name: battle.partner.name || say(ctx.lang, 'spec.partner'),
    team: battle.partner.team.map((teamSet, i) => blockMember(sim, teamSet, `ally-${i + 1}`, null)) };

  const second = battle.foePartner && foePartnerPicture(battle, picture);
  const foePartner = battle.foePartner && { name: battle.foePartner.name || say(ctx.lang, 'spec.foePartner'),
    team: battle.foePartner.team.map((teamSet, i) => blockMember(sim, teamSet, `foe2-${i + 1}`, null)),
    ...(second.sprite ? { trainerSprite: second.sprite } : {}), ...(second.silhouette ? { trainerSilhouette: true } : {}) };

  const regionRule = !!ruleValues(ctx).battleRegion;
  const region = regionRule ? battleRegion({ block: battle.region ?? null, status: status?.region ?? null, earlier: earlierRegion, blockFirst }) : status?.region ?? null;

  const gimmicks = foeGimmicksOf(sim.Dex, foeGimmicks, { battle, region, seed, levelUp: ctx.levelUp, p2, partner: partner?.team, foePartner: foePartner?.team, unknownRogue: regionRule,
    gen: ctx.formGen ?? null });
  if (gimmicks.p2) p2.splice(0, p2.length, ...gimmicks.p2);
  if (gimmicks.partner) partner.team = gimmicks.partner;
  if (gimmicks.foePartner) foePartner.team = gimmicks.foePartner;
  return {
    ...(seed ? { seed: [...seed] } : {}),
    formatid: formatid || stateFormat(state),
    p1: { name: ctx.playerName || PLAYER_NAME, team: p1,

      ...(player ? { trainerSprite: player.gender } : {}), ...(player?.silhouette ? { trainerSilhouette: true } : {}) },
    p2: { name: battle.name || say(ctx.lang, battle.wild ? 'spec.wild' : 'spec.foe'), team: p2,

      ...(sprite ? { trainerSprite: sprite } : {}), ...(silhouette ? { trainerSilhouette: true } : {}) },

    ...(bgm ? { bgm } : {}),
    bag: {
      ...battleBag(state, effectItems), wild: !!battle.wild, caughtSpecies: [...state.dex.caught],

      ...(battle.oldTitles ? {} : { namedTitles: true }),

      ...(battle.oldJapanese ? {} : { namedJapanese: true }),
      env: { night: time === 'night', cave: CAVE_BIOMES.has(place), water: WATER_BIOMES.has(place) },
    },
    wild: !!battle.wild,
    boss: !battle.wild && !!battle.boss,

    ...(genOption('expShare', ctx.battleRule, expShare) === 'gen' ? { expShare: 'gen', ...(ownsExpShare(state) ? { expShareOwned: true } : {}) } : {}),
    ...(genRuleOn(ctx.battleRule) ? { eraGimmicks: genOption('eraGimmicks', ctx.battleRule, eraGimmicks) } : {}),
    expRate: storyExpRate(expRate),
    ...(friendshipRate === 1 ? {} : { friendshipRate }), // engine/friendship.mjs - the last multiplier of every friendship rise
    ...(ruleValues(ctx).friendshipSv ? { friendshipSv: true } : {}),
    ...(timeOfDay === 'day' ? {} : { timeOfDay }), // engine/exp.mjs - day / night evolutions
    ...duskClock(ctx, hour), // Dusk Form Lycanroc's hours - a battle started from the rule duskLycanroc on
    ...evolutionWorld(ctx, { ...status, region }, state), // engine/evolution.mjs - region (the battle's), money, badges, trade setting
    ...(evolveGenOf(ctx) ? { genEvolve: true } : {}),
    ...(weather ? { weather } : {}), ...(terrain ? { terrain } : {}), // engine/field.mjs - the place's weather at battle start
    teraOrb: hasTeraOrb(state),

    ...(ruleValues(ctx).keyStoneMega ? { keyStone: hasKeyStone(state) } : {}),

    zRing: hasZRing(state),

    dynamaxBand: hasDynamaxBand(state),
    dynamaxHere: dynamaxHere(battle, region),
    writtenForms: true,
    ...(ctx.formGen ? { formGen: ctx.formGen } : {}),
    // the Battle Rules it began under, for the met game of any Pokémon it catches (battle-rule.mjs ranCtx, story-link.js
    // playedAt, computeState's tag)
    ...(ctx.battleRule != null ? { battleRule: ctx.battleRule } : {}),
    // the ability era the battle began in, null while Battle Rules Auto only guessed (plugin/battle/story-link.js inBattleEra)
    abilityEra: abilityEraOf(ctx),

    dynamaxShown: dynamaxLevelShown(state, region),
    ...(gimmicks.foeGimmick ? { foeGimmick: gimmicks.foeGimmick } : {}), // the foes' gimmick by region (ai/index.js gimmickRules) - none: as before
    biome: place,
    ...(battle.double ? { double: true } : {}), ...(partner ? { partner } : {}), ...(foePartner ? { foePartner } : {}), // double / tag battle (engine/core.mjs)
  };
}

/** A wild Pokemon has its hidden ability one time in this many (2%) */
export const WILD_HIDDEN_ABILITY_ODDS = 50;

export function wildHiddenAbility(dex, set, seed, uid) {
  if (set.ability || !seed) return null;
  const hidden = dex.species.get(set.species).abilities?.H;
  return hidden && seededIndex(`${seed}|${uid}|hiddenAbility`, WILD_HIDDEN_ABILITY_ODDS) === 0 ? hidden : null;
}

function evolutionWorld(ctx, status, state) {
  const badges = badgeCount(state), trade = ctx.tradeEvolution ?? ABSENT_TRADE_EVOLUTION; // missing = cord on both sides (engine/exp.mjs)
  return { ...(status?.region ? { region: status.region } : {}), ...(Number.isInteger(status?.money) ? { money: status.money } : {}), ...(badges ? { badges } : {}),
    ...(trade === ABSENT_TRADE_EVOLUTION ? {} : { tradeEvolution: trade }) };
}

function blockMember(sim, teamSet, uid, past) {
  const { hpPercent, status, ppUps, ...blockSet } = clone(teamSet);
  const set = past ? continuePast(sim, blockSet, past) : blockSet;

  if (isCustomItem(set.item)) set.item = '';
  const member = { uid, set };
  if (ppUps) member.ppUps = ppUps; // block Pokemon: only what is written, otherwise 0
  if (hpPercent !== undefined) member.hpPercent = hpPercent;
  if (status) member.status = status;
  return member;
}

function pairPast(sim, team, pastTeam) {
  const left = [...pastTeam];
  return team.map(({ species }) => {
    const target = sim.Dex.species.get(species);
    const at = [left.findIndex(m => toID(m.species) === target.id), left.findIndex(m => evolvedFrom(sim, target, m.species))].find(j => j >= 0);
    return at === undefined ? null : left.splice(at, 1)[0];
  });
}

function evolvedFrom(sim, target, past) {
  for (let s = sim.Dex.species.get(target.prevo); s.exists; s = sim.Dex.species.get(s.prevo)) if (s.id === toID(past)) return true;
  return false;
}

function continuePast(sim, set, past) {
  const from = sim.Dex.species.get(past.species), to = sim.Dex.species.get(set.species);
  const same = from.id === to.id;
  const carry = { nature: past.nature, ivs: past.ivs, evs: past.evs, ability: same || past.ability === undefined ? past.ability : sameSlotAbility(from, past.ability, to),
    gender: past.gender, shiny: past.shiny, teraType: past.teraType, ...(same && set.level === past.level ? { moves: past.moves } : {}) };
  const out = { ...set };

  for (const [k, v] of Object.entries(carry)) if (out[k] === undefined && v !== undefined) out[k] = clone(v);
  return out;
}

// -- Pointing at a Pokemon ---------------------------------------

export function findMon(state, ref, ctx, { boxFirst = false, egg = false } = {}) {

  const found = (list, index) => {
    if (isEgg(list[index]) && !egg) fail('isEgg');
    return { list, index, mon: list[index] };
  };
  if (ref && typeof ref.uid === 'string') {
        // Pointed at by the panel: unique id (same Pokemon even if the order changes)
    for (const list of [state.party, state.box]) {
      const index = list.findIndex(m => m.uid === ref.uid);
      if (index >= 0) return found(list, index);
    }
    fail('monGone');
  }
  if (ref && Number.isInteger(ref.box)) {

    if (!state.box[ref.box - 1]) fail('noBoxMon', { n: ref.box });
    return found(state.box, ref.box - 1);
  }
  if (ref && Number.isInteger(ref.slot)) {
    if (!state.party[ref.slot - 1]) fail('noPartyMon', { n: ref.slot });
    return found(state.party, ref.slot - 1);
  }
  const name = String(ref?.name ?? '').trim();
  if (!name) fail('noWho');
  const lists = (boxFirst ? [state.box, state.party] : [state.party, state.box]).map(list => list.filter(m => !isEgg(m)));
  const at = mon => { const list = [state.party, state.box].find(l => l.includes(mon)); return { list, index: list.indexOf(mon), mon }; };
  const key = name.normalize('NFKC').toLowerCase().replace(/\s+/g, '');
  for (const list of lists) {
    const mon = list.find(m => m.set.name && m.set.name.normalize('NFKC').toLowerCase().replace(/\s+/g, '') === key);
    if (mon) return at(mon);
  }
  // a name two forms share (blocks.mjs sharedForms): whichever of them we have
  const species = speciesName(name, ctx);
  const ids = sharedForms(name, ctx) ?? (species ? [toID(species)] : []);
  for (const list of lists) {
    const mon = list.find(m => ids.includes(toID(m.set.species))) ?? list.find(m => ids.includes(toID(ctx.sim.Dex.species.get(m.set.species).baseSpecies)));
    if (mon) return at(mon);
  }
  fail('notFound', { name });
}

// -- Small helpers -------------------------------------------

export function rngFor(sim, text) {
  const a = parseInt(hashKey(text), 36), b = parseInt(hashKey(`${text}#`), 36);
  const seed = [a % 65536, Math.floor(a / 65536) % 65536, b % 65536, Math.floor(b / 65536) % 65536];
  if (seed.every(n => n === 0)) seed[0] = 1;
  return new sim.PRNG(seed);
}

export function uniqueUid(state, base) {
  const all = [...state.party, ...state.box, ...labOf(state)];
  const used = new Set([...all, ...all.map(m => m.fused).filter(Boolean)].map(m => m.uid)); // a partner inside a fused Pokemon too
  let uid = base;
  for (let n = 2; used.has(uid); n++) uid = `${base}-${n}`;
  return uid;
}

/** Exp group (engine/exp.mjs growthOf - same table lookup as in battle) */
const growthOf = ({ sim, exp }, species) => growthOfSpecies(exp, sim.Dex.species.get(species));

export function maxHp(sim, set, formatid) {
  return formatRules(sim, formatid || DEFAULT_FORMAT).maxHp(set);
}

/** HP percentage (0-100, rounded). Full = 100, fainted = 0 */
export function hpPercentOf(sim, mon, formatid) {
  if (mon.hp === null || mon.hp === undefined) return 100;
  if (mon.hp <= 0) return 0;
  return Math.max(1, Math.min(100, Math.round(mon.hp / maxHp(sim, mon.set, formatid) * 100)));
}

/** HP percentage -> current HP (null = full). keepAlive: never 0 */
export function hpFromPercent(sim, set, percent, keepAlive = false, formatid) {
  if (percent >= 100) return null;
  const hp = Math.round(maxHp(sim, set, formatid) * percent / 100);
  return percent > 0 || keepAlive ? Math.max(1, hp) : hp;
}

export const ruleOf = state => state?.rule ?? DEFAULT_RULE;
/** The rules format a state's HP and PP are computed with */
export const stateFormat = state => ruleFormat(ruleOf(state));

function shareOf(hp, was, max) {
  if (hp >= was) return null;
  if (was === max) return hp;
  return Math.max(1, Math.min(max - 1, Math.round(hp * max / was)));
}

// Generations 1-2 have no abilities: Pokémon that lived only there take their Hidden Ability when the story's battles
// reach generation 3 or later, as Pokémon moved up from the Virtual Console games do (owner's decision, 2026-11-22; rule
// eraAbilities). The state keeps the era its Pokémon were last brought to (abilityEra: true from generation 3, Mainline
// and Champions included, false in 1-2, absent while unknown). Every Pokémon present when it changes, either way, is
// marked hadAbility, so one that knew abilities (a chat taken from 9 down to 1 and back) keeps its own; one whose
// ability was chosen by hand (chosenAbility) keeps it too. Eggs and fossils in the lab are not born yet.
const presentMons = state => {
  const out = [];
  const visit = mon => { if (!mon?.set) return; if (!isEgg(mon)) out.push(mon); visit(mon.fused); };
  for (const mon of [...state?.party ?? [], ...state?.box ?? []]) visit(mon);
  return out;
};

function takeHiddenAbility(sim, mon) {
  const abilities = sim.Dex.species.get(mon.set.species).abilities ?? {};
  // A special one given by name (Own Tempo Rockruff, Battle Bond Greninja) is kept
  if (abilities.S && toID(abilities.S) === toID(mon.set.ability)) return;
  if (abilities.H) { mon.set.ability = abilities.H; delete mon.abilitySlot; } else mon.abilitySlot = 'H';
  delete mon.formAbility;
  mon.tookHidden = true;
}

export const crossEra = (sim, state, ctx) => crossTo(sim, state, abilityEraOf(ctx), !!ruleValues(ctx).eraAbilities);

function crossTo(sim, state, era, give) {
  const had = state?.abilityEra;
  if (era === null) {
    // Battle Rules Auto guessing generation 9 before any region: not an era. After one with abilities the Pokémon
    // there knew them, and the ones that join now take their origin from the first known era.
    if (had !== true) return state;
    const next = clone(state);
    for (const mon of presentMons(next)) mon.hadAbility = true;
    delete next.abilityEra;
    return next;
  }
  if (had === era) return state;
  const next = clone(state);
  if (had !== undefined) {
    for (const mon of presentMons(next)) {
      if (era && give && !mon.hadAbility && !mon.chosenAbility) takeHiddenAbility(sim, mon);
      mon.hadAbility = true;
    }
  }
  next.abilityEra = era;
  return next;
}

// The era a state starting in `from` ends up in after crossTo brings it to `to`
const crossedEra = (from, to) => (to === null ? (from === true ? undefined : from) : to);

// Gives a met generation under `ctx` to the Pokémon of `after` that `before` lacks and that have none, as keepOrigins
// does at a saved result's tag (a battle the story ends, computeState)
function metNewcomers(before, after, ctx) {
  const met = metGenAt(ctx);
  const known = new Set([...before.party, ...before.box].map(mon => mon.uid));
  const lacks = mon => !known.has(mon.uid) && !Number.isInteger(mon.metGen);
  if (!Number.isInteger(met) || ![...after.party, ...after.box].some(lacks)) return after;
  const next = clone(after);
  for (const mon of [...next.party, ...next.box]) if (lacks(mon)) mon.metGen = met;
  return next;
}

// Brings the Pokémon of `state` whose uids are in `uids` from ability era `from` (undefined: none) to era `to`, as crossTo
// brings a state's Pokémon (for Pokémon caught in a battle the story ends, computeState); `era` is the era a state in
// `from` would be in after crossTo
function joinedIn(sim, state, uids, from, to, give) {
  const era = crossedEra(from, to);
  const step = from === undefined || from === to || (to === null && from !== true) ? null : to ? 'hidden' : 'mark';
  if (!step) return { state, era };
  const next = clone(state);
  for (const mon of presentMons(next)) {
    if (!uids.has(mon.uid)) continue;
    if (step === 'hidden' && give && !mon.hadAbility && !mon.chosenAbility) takeHiddenAbility(sim, mon);
    mon.hadAbility = true;
  }
  return { state: next, era };
}

// Each Pokémon's ability, kept slot, species, whether the generation rule gave it its Hidden Ability (tookHidden) and
// whether its ability was chosen by hand (chosenAbility), saved with a battle's snapshot (table.meta[tag].abilities: the
// fold before the battle, moved to the battle's ability era; records saved before the last field have four)
export const abilityRecord = state => Object.fromEntries(presentMons(state).map(mon => [mon.uid, [mon.set.ability, mon.abilitySlot ?? null, mon.set.species, mon.tookHidden ? 1 : 0, mon.chosenAbility ? 1 : 0]]));

// The ability and kept slot that species `from` with this ability and slot has as species `to`, as an evolution carries it
export function abilityAs(dex, from, ability, slot, to) {
  if (toID(from) === toID(to)) return { ability, slot: slot ?? null };
  const target = dex.species.get(to), held = heldSlot(dex.species.get(from), ability, slot);
  return { ability: target.abilities?.[held] ?? target.abilities?.['0'], slot: !target.abilities?.[held] && held !== '0' ? held : null };
}

// Whether every Pokémon an action points at by uid (a fusion's partner included) is in the party or box
const hasTargets = (state, action) => {
  const here = new Set([...state?.party ?? [], ...state?.box ?? []].map(mon => mon.uid));
  return (action?.ops ?? []).every(op => ['ref', 'a', 'b', 'with'].every(field => typeof op?.[field]?.uid !== 'string' || here.has(op[field].uid)));
};

// Every Pokémon of a state, eggs and fused partners included
const allMons = state => {
  const out = [];
  const visit = mon => { if (!mon?.set) return; out.push(mon); visit(mon.fused); };
  for (const mon of [...state?.party ?? [], ...state?.box ?? []]) visit(mon);
  return out;
};

// A battle snapshot keeps everything as its battle left it. The fold up to it (`before`, moved to the snapshot's ability
// era) gives the origins it lacks, and the abilities' marks. baseline: abilityRecord of the fold as the snapshot was made
// (story-link resultChange); dex: for the slots; carry: the rule editedImports at the battle.
// An edit made later behind the battle (a Status Window moved between Kanto and Hoenn, a deleted message, a cancelled
// import) reaches its abilities only through the generation rule: where the fold now takes a Pokémon's Hidden Ability on
// entering generation 3, or no longer does, against the record (tookHidden), and the battle left the record's ability as
// it was (carried to the species it evolved into there, as an evolution carries it), the fold's ability is carried over,
// unless it was chosen by hand (chosenAbility). The rule's marks, tookHidden and hadAbility (crossEra), are the history's,
// so with a record that knows the decision they follow the fold: a Pokémon the fold still has as an egg knew no
// abilities. A hand choice the fold has is added where the snapshot has that ability. One the fold lacks (joined in the
// battle, or its uid changed behind it) comes as the snapshot has it. A snapshot saved without such a record keeps its
// abilities and takes the fold's hadAbility.
function keepOrigins(before, after, ctx, { baseline = null, dex = null, carry = false, slots = false } = {}) {
  const had = new Map([...before.party, ...before.box].map(mon => [mon.uid, mon.metGen]));
  const met = metGenAt(ctx);
  for (const mon of [...after.party ?? [], ...after.box ?? []]) {
    if (Number.isInteger(mon.metGen)) continue;
    const gen = had.has(mon.uid) ? had.get(mon.uid) : met;
    if (Number.isInteger(gen)) mon.metGen = gen;
  }
  if (after.abilityEra === undefined && before.abilityEra !== undefined) after.abilityEra = before.abilityEra;
  const marks = new Map(allMons(before).map(mon => [mon.uid, mon]));
  const differs = (x, mon) => toID(x.ability) !== toID(mon.set.ability) || x.slot !== (mon.abilitySlot ?? null);
  for (const mon of allMons(after)) {
    const was = marks.get(mon.uid);
    if (!was || isEgg(mon)) continue;
    const base = Array.isArray(baseline?.[mon.uid]) ? baseline[mon.uid] : null;
    const knows = !!dex && base?.length > 3, pokemon = !isEgg(was);
    // A snapshot saved before Pokémon kept the slot takes the fold's
    if (slots && !base && was.abilitySlot && !mon.abilitySlot && toID(was.set?.species) === toID(mon.set?.species) && toID(was.set?.ability) === toID(mon.set?.ability)) mon.abilitySlot = was.abilitySlot;
    // own: the battle changed the ability itself (an ability op it held)
    const own = knows && differs(abilityAs(dex, base[2] ?? mon.set.species, base[0], base[1], mon.set.species), mon);
    // A hand choice the snapshot has from before its battle came from the fold, and one cancelled or moved behind the
    // battle goes with it: one the record has (a record without that field: any), unless the battle changed the ability
    // itself, which makes the choice the battle's (one it changed and changed back counts as the record's)
    const inherited = !own && (base?.length > 4 ? !!base[4] : true);
    if (knows && inherited && mon.chosenAbility && !was.chosenAbility) delete mon.chosenAbility;
    if (carry && knows && !own && !mon.chosenAbility && !!was.tookHidden !== !!base[3]) {
      const now = abilityAs(dex, was.set.species, was.set.ability, was.abilitySlot, mon.set.species);
      if (now.ability) {
        mon.set.ability = now.ability;
        if (now.slot && slots) mon.abilitySlot = now.slot; else delete mon.abilitySlot;
      }
      // and a form's kept ability (taking the Hidden Ability ends it, changeForm keeps one)
      if (toID(was.set.species) === toID(mon.set.species)) { if (was.formAbility) mon.formAbility = was.formAbility; else delete mon.formAbility; }
    }
    if (knows) {
      if (pokemon && was.tookHidden) mon.tookHidden = true; else delete mon.tookHidden;
      if (pokemon && was.hadAbility) mon.hadAbility = true; else delete mon.hadAbility;
    } else if (pokemon && was.hadAbility) mon.hadAbility = true; // (not tookHidden: the snapshot's ability may not be that Hidden Ability)
    if (was.chosenAbility && (!dex || !differs(abilityAs(dex, was.set.species, was.set.ability, was.abilitySlot, mon.set.species), mon))) mon.chosenAbility = true;
  }
  return after;
}

export function inRule(sim, state, rule = DEFAULT_RULE) {
  if (ruleOf(state) === rule) return state;
  const from = stateFormat(state), to = ruleFormat(rule);
  const next = clone(state);
  for (const mon of [...next.party, ...next.box]) {
    if (isEgg(mon)) continue;
    if (mon.hp) mon.hp = shareOf(mon.hp, maxHp(sim, mon.set, from), maxHp(sim, mon.set, to));
    for (const id of Object.keys(mon.pp ?? {})) if (mon.pp[id] >= maxPp(sim, id, ppUpsOf(mon, id), to)) delete mon.pp[id];
  }
  if (rule === DEFAULT_RULE) delete next.rule; else next.rule = rule;
  return next;
}

/** Marks a species seen (and caught) in the Pokedex (mutates state) */
export function markDex(state, sim, species, caught) {
  const id = sim.Dex.species.get(species).id;
  if (!id) return;
  if (!state.dex.seen.includes(id)) state.dex.seen.push(id);
  if (caught && !state.dex.caught.includes(id)) state.dex.caught.push(id);
}

function monLabel(mon) {
  return mon.set.name || mon.set.species;
}
