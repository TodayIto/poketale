import { readStored, isRecord, isUnreadable } from './stored.mjs';
import { failed } from './failure.mjs';
import { anchorAtEnd } from './import.mjs';
import { settingsAt, changedValuesAt, ruleValues, madeBy, changePlace } from './setting-changes.mjs';
import { worldAt } from './compat-world.mjs';
import { statusIn } from './compat.mjs';
import { regionGames, MACHINE_STANDARDS } from './machine-standards.mjs';
import { DEFAULT_RULE, DEFAULT_GEN, GENS, isGen, ruleFormat } from '../engine/rules.mjs';
import { ERA_GIMMICK_MODES, DEFAULT_ERA_GIMMICKS } from '../engine/era-gimmicks.mjs';
import { hasOneSpecial } from '../engine/mon.mjs';
import { ABILITIES_FROM } from '../engine/era.mjs';

export const BATTLE_RULE_VAR = '$pkb_battle_rule';

export const BATTLE_RULES = Object.freeze(['mainline', 'champions', 'auto', ...GENS]);
const isBattleRule = value => BATTLE_RULES.includes(value);

export const genRuleOn = value => value === 'auto' || isGen(value);

export const numbersRule = value => (value === 'champions' ? 'champions' : DEFAULT_RULE);

export const GEN_OPTIONS = Object.freeze({
  eraGimmicks: Object.freeze({ ids: ERA_GIMMICK_MODES, none: DEFAULT_ERA_GIMMICKS, grey: 'enable' }), // the engine's ids (engine/era-gimmicks.mjs - G1b)
  expShare: Object.freeze({ ids: Object.freeze(['always', 'gen']), none: 'always', grey: 'always' }),
  learnMoves: Object.freeze({ ids: Object.freeze(['base', 'origin', 'location']), none: 'base', grey: 'base' }),
  gameShop: Object.freeze({ ids: Object.freeze([false, true]), none: false, grey: false }),
});

export const genOption = (name, value, setting) => (genRuleOn(value) ? (GEN_OPTIONS[name].ids.includes(setting) ? setting : GEN_OPTIONS[name].none) : GEN_OPTIONS[name].grey);

export const evolveGenOf = ctx => (ruleValues(ctx).genEvolve010 && Number.isInteger(ctx?.formGen) ? ctx.formGen : null);

export const oneSpecialAt = ctx => !!ruleValues(ctx).genStats010 && hasOneSpecial(ctx?.formGen);

export const expShareHeldIn = gen => Number.isInteger(gen) && gen >= 2 && gen <= 5;

const OPTION_NAMES = Object.freeze(['learnMoves', 'gameShop']);
const optionValid = (name, value) => GEN_OPTIONS[name].ids.includes(value);
const optionsOf = settings => Object.fromEntries(OPTION_NAMES.map(name => [name, optionValid(name, settings?.[name]) ? settings[name] : GEN_OPTIONS[name].none]));

const optionValuesShape = values => isRecord(values) && Object.entries(values).every(([name, value]) => OPTION_NAMES.includes(name) && optionValid(name, value));
const changeShape = change => isRecord(change) && typeof change.time === 'number' && (change.at === null || isRecord(change.at)) && isBattleRule(change.value);
const optionChangeShape = change => isRecord(change) && typeof change.time === 'number' && isRecord(change.at) && optionValuesShape(change.before);
const optionsShape = options => isRecord(options) && Array.isArray(options.changes) && options.changes.every(optionChangeShape)
  && (options.values === undefined || optionValuesShape(options.values));

export function readBattleRule(chat) {
  const { status, value } = readStored(chat?.scriptstate?.[BATTLE_RULE_VAR], {
    shape: v => Array.isArray(v.changes) && v.changes.every(changeShape) && (v.options === undefined || optionsShape(v.options)),
  });
  if (isUnreadable(status)) return { status, changes: [], options: null };
  return { status, changes: value?.changes ?? [], options: { values: optionsOf(value?.options?.values), changes: value?.options?.changes ?? [], stored: value?.options !== undefined } };
}
const writeRecord = (chat, changes, options) => {
  const stored = Object.fromEntries(OPTION_NAMES.filter(name => options.values[name] !== GEN_OPTIONS[name].none).map(name => [name, options.values[name]]));
  const kept = options.changes.length || Object.keys(stored).length || options.stored ? { options: { ...(Object.keys(stored).length ? { values: stored } : {}), changes: options.changes } } : {};
  chat.scriptstate ??= {};
  chat.scriptstate[BATTLE_RULE_VAR] = JSON.stringify({ v: 1, changes, ...kept });
};

// time: an import's, which under the rule editedImports sees a change made at its message before it (madeBy)
export function battleRuleAt(chat, settings) {
  const messages = chat?.message ?? [];
  const { changes } = readBattleRule(chat);
  const settingsOf = settingsAt(chat, settings);
  if (!changes.length) return (i, time) => settingsOf(i, time).rule;
  const places = changes.map(change => changePlace(messages, change));
  for (let k = places.length - 2; k >= 0; k--) places[k] = Math.min(places[k], places[k + 1]);
  return (i, time) => {
    const timed = typeof time === 'number' && !!settingsOf(i, time).editedImports;
    let k = places.length - 1;
    // A record's first change made in an empty chat is the rule the chat began with, unless it says it is not (start:
    // false, recordBattleRule): recordNewChatStart writes it at time 0, and 0.1.0 wrote it with its own time, so an
    // import made before that write also reads it. 0.1.0's own first change in an empty chat without a record has the
    // shape of a start and is read as one too
    const start = changes[0].at === null && changes[0].start !== false;
    while (k >= 0 && !madeBy(places[k], k === 0 && start ? 0 : changes[k].time, i, time, timed)) k--;
    return k < 0 ? settingsOf(i, time).rule : changes[k].value;
  };
}

export const regionGen = region => {
  const [first] = regionGames(region);
  return first ? MACHINE_STANDARDS[first].gen : null;
};

const startGenOf = world => (world?.anime === 'journeys' ? 8 : isGen(world?.startRegion) ? world.startRegion : null);

// known: the generation comes from the world's start or a Status Window's region, not the fallback to 9
function autoAt(chat, next = null) {
  const messages = chat?.message ?? [];
  const world = worldAt(chat);
  const seen = [];
  let first = null, top = null;
  messages.forEach((message, i) => {
    const gen = message?.role === 'char' ? regionGen(statusIn(message)?.region) : null;
    if (gen) { first ??= gen; top = Math.max(top ?? gen, gen); }
    seen[i] = { first, top };
  });
  return (i, time, timed) => {
    const upto = seen[Math.min(i, messages.length - 1)] ?? { first: null, top: null };
    const begun = startGenOf(world(i, time, timed)) ?? upto.first;
    const start = begun ?? DEFAULT_GEN, top = Math.max(start, upto.top ?? start);
    return { gen: i >= messages.length ? Math.max(top, regionGen(next?.region) ?? top) : top, known: begun !== null };
  };
}

export function autoGenAt(chat, next = null) {
  const at = autoAt(chat, next);
  return i => at(i).gen;
}

const genOf = (value, i, auto, time, timed) => (isGen(value) ? value : value === 'auto' ? auto()(i, time, timed).gen : null);

// The ability era of a message's ctx: false in generations 1-2, true from 3 (Mainline and Champions are 9), null while
// Battle Rules Auto only guesses (story/state.mjs crossEra)
export const abilityEraOf = ctx => (ctx?.autoGuess ? null : (ctx?.formGen ?? DEFAULT_GEN) >= ABILITIES_FROM);

export function foldCtxAt(chat, ctx, { next = null } = {}) {
  const settingsOf = settingsAt(chat, ctx);
  const ruleAt = battleRuleAt(chat, ctx);
  const optionAt = optionsAt(chat, ctx);
  const worldOf = worldAt(chat);
  let auto = null;
  const autoOf = () => (auto ??= autoAt(chat, next));
  return (i, time) => {
    const base = settingsOf(i, time), timed = typeof time === 'number' && !!base.editedImports;
    const value = ruleAt(i, time), gen = genOf(value, i, autoOf, time, timed), options = optionAt(i, time, timed);
    const learnFrom = genOption('learnMoves', value, options.learnMoves), gameShopOn = genOption('gameShop', value, options.gameShop);
    const at = { ...ctx, ...base, rule: numbersRule(value), battleRule: value, world: worldOf(i, time, timed), ...(gen ? { formGen: gen } : {}) };
    if (learnFrom === GEN_OPTIONS.learnMoves.none) delete at.learnFrom; else at.learnFrom = learnFrom;
    if (gameShopOn) at.gameShopOn = true; else delete at.gameShopOn;
    if (value === 'auto' && !autoOf()(i, time, timed).known) at.autoGuess = true; else delete at.autoGuess;
    return at;
  };
}

export const chatNowCtx = (chat, ctx) => foldCtxAt(chat, ctx)((chat?.message ?? []).length);

// The ctx a battle's result is applied with (plugin/battle/story-link.js resultChange): the world now, and the generation
// and Battle Rules of the battle's spec, so that a Pokémon it catches is met in that generation's game of the Status
// Window's region (Kanto under generation 3: FireRed/LeafGreen), where 0.1.0 gave the region's newest game. A spec from
// 0.1.0 has no Battle Rules: the chat's current ones decide whether an anime world counts, as at the tag in the fold
export function ranCtx(chat, ctx, spec) {
  const { formGen: _now, ...rest } = ctx;
  const n = (chat?.message ?? []).length;
  return { ...rest, world: worldAt(chat)(n), battleRule: spec?.battleRule ?? battleRuleAt(chat, ctx)(n),
    ...(Number.isInteger(spec?.formGen) ? { formGen: spec.formGen } : {}) };
}

export function battleRuleNow(chat, settings) {
  const n = (chat?.message ?? []).length;
  const value = battleRuleAt(chat, settings)(n);
  const gen = genOf(value, n, () => autoAt(chat));
  return { value, gen, format: ruleFormat(value, gen) };
}

export function recordBattleRule(chat, value, settings, { now = Date.now() } = {}) {
  if (!isBattleRule(value)) throw new Error(`No battle rule ${value}`);
  const { status, changes, options } = readBattleRule(chat);
  if (isUnreadable(status)) throw failed('unreadable');
  const messages = chat?.message ?? [];
  if (battleRuleAt(chat, settings)(messages.length) === value) return false;
  // A change made in an empty chat says it is not the chat's start (battleRuleAt), so an import made before it keeps the
  // rule of its own time (recordNewChatStart writes no start when the chat began with the default)
  writeRecord(chat, [...changes, { time: now, at: messages.length ? anchorAtEnd(messages) : null, value, ...(messages.length ? {} : { start: false }) }], options);
  return true;
}

export function chatSettings(chat, settings) {
  const { changes } = readBattleRule(chat);
  return changes.length ? { ...settings, rule: numbersRule(changes.at(-1).value) } : settings;
}

const isNewChat = (chat, changes) => !changes.length && !(chat?.message ?? []).some(message => message?.role === 'char');

export function newChatStart(chat, settings) {
  const { status, changes } = readBattleRule(chat);
  const last = settings?.battleRule;
  return !isUnreadable(status) && isBattleRule(last) && isNewChat(chat, changes) && battleRuleAt(chat, settings)(Infinity) !== last;
}

export function recordNewChatStart(chat, settings, { now = Date.now() } = {}) {
  if (!newChatStart(chat, settings)) return false;
  const { options } = readBattleRule(chat);
  // time 0: the rule the chat began with, which an import made before this record was written already joined under
  writeRecord(chat, [{ time: 0, at: null, value: settings.battleRule }], options);
  return true;
}

const optionsBehindOf = (values, settings) => {
  const now = optionsOf(settings);
  return Object.fromEntries(OPTION_NAMES.filter(name => values[name] !== now[name]).map(name => [name, values[name]]));
};

// An empty chat without stored options is behind too (worldBehind)
export function optionsBehind(chat, settings) {
  const { options } = readBattleRule(chat);
  return options !== null && (Object.keys(optionsBehindOf(options.values, settings)).length > 0 || (!options.stored && !(chat?.message ?? []).length));
}

export function recordOptions(chat, settings, { now = Date.now() } = {}) {
  const { status, changes, options } = readBattleRule(chat);
  if (isUnreadable(status)) throw failed('unreadable');
  const before = optionsBehindOf(options.values, settings), messages = chat?.message ?? [];
  if (!Object.keys(before).length && (options.stored || messages.length)) return false;
  // an empty chat's too once it has options stored (setting-changes.mjs recordSettingChange)
  const change = messages.length || options.stored;
  writeRecord(chat, changes, { values: optionsOf(settings), stored: true,
    changes: [...options.changes, ...(change && Object.keys(before).length ? [{ time: now, at: anchorAtEnd(messages), before }] : [])] });
  return true;
}

export function optionsAt(chat, settings) {
  const messages = chat?.message ?? [];
  const now = optionsOf(settings);
  const { options } = readBattleRule(chat);
  if (!options) return () => ({ ...now });
  const behind = messages.length || options.stored ? optionsBehindOf(options.values, settings) : {};
  // A change found only by the settings being ahead of the record counts after every import at the last message
  const changes = Object.keys(behind).length ? [...options.changes, { time: Infinity, at: anchorAtEnd(messages), before: behind }] : options.changes;
  return changedValuesAt(messages, changes, now);
}
