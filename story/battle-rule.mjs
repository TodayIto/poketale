import { readStored, isRecord, isUnreadable } from './stored.mjs';
import { failed } from './failure.mjs';
import { importPlace, anchorAtEnd } from './import.mjs';
import { settingsAt, changedValuesAt, ruleValues } from './setting-changes.mjs';
import { worldAt } from './compat-world.mjs';
import { statusIn } from './compat.mjs';
import { regionGames, MACHINE_STANDARDS } from './machine-standards.mjs';
import { DEFAULT_RULE, DEFAULT_GEN, GENS, isGen, ruleFormat } from '../engine/rules.mjs';
import { ERA_GIMMICK_MODES, DEFAULT_ERA_GIMMICKS } from '../engine/era-gimmicks.mjs';
import { hasOneSpecial } from '../engine/mon.mjs';

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
  return { status, changes: value?.changes ?? [], options: { values: optionsOf(value?.options?.values), changes: value?.options?.changes ?? [] } };
}
const writeRecord = (chat, changes, options) => {
  const stored = Object.fromEntries(OPTION_NAMES.filter(name => options.values[name] !== GEN_OPTIONS[name].none).map(name => [name, options.values[name]]));
  const kept = options.changes.length || Object.keys(stored).length ? { options: { ...(Object.keys(stored).length ? { values: stored } : {}), changes: options.changes } } : {};
  chat.scriptstate ??= {};
  chat.scriptstate[BATTLE_RULE_VAR] = JSON.stringify({ v: 1, changes, ...kept });
};

export function battleRuleAt(chat, settings) {
  const messages = chat?.message ?? [];
  const { changes } = readBattleRule(chat);
  const settingsOf = settingsAt(chat, settings);
  if (!changes.length) return i => settingsOf(i).rule;
  const places = changes.map(change => (change.at === null ? -Infinity : importPlace(messages, change)));
  for (let k = places.length - 2; k >= 0; k--) places[k] = Math.min(places[k], places[k + 1]);
  return i => {
    let k = places.length - 1;
    while (k >= 0 && !(i > places[k])) k--;
    return k < 0 ? settingsOf(i).rule : changes[k].value;
  };
}

export const regionGen = region => {
  const [first] = regionGames(region);
  return first ? MACHINE_STANDARDS[first].gen : null;
};

const startGenOf = world => (world?.anime === 'journeys' ? 8 : isGen(world?.startRegion) ? world.startRegion : null);

export function autoGenAt(chat, next = null) {
  const messages = chat?.message ?? [];
  const world = worldAt(chat);
  const seen = [];
  let first = null, top = null;
  messages.forEach((message, i) => {
    const gen = message?.role === 'char' ? regionGen(statusIn(message)?.region) : null;
    if (gen) { first ??= gen; top = Math.max(top ?? gen, gen); }
    seen[i] = { first, top };
  });
  return i => {
    const upto = seen[Math.min(i, messages.length - 1)] ?? { first: null, top: null };
    const start = startGenOf(world(i)) ?? upto.first ?? DEFAULT_GEN, top = Math.max(start, upto.top ?? start);
    return i >= messages.length ? Math.max(top, regionGen(next?.region) ?? top) : top;
  };
}

const genOf = (value, i, auto) => (isGen(value) ? value : value === 'auto' ? auto()(i) : null);

export function foldCtxAt(chat, ctx, { next = null } = {}) {
  const settingsOf = settingsAt(chat, ctx);
  const ruleAt = battleRuleAt(chat, ctx);
  const optionAt = optionsAt(chat, ctx);
  const worldOf = worldAt(chat);
  let auto = null;
  const autoOf = () => (auto ??= autoGenAt(chat, next));
  return (i, time) => {
    const value = ruleAt(i), gen = genOf(value, i, autoOf);
    const learnFrom = genOption('learnMoves', value, optionAt(i).learnMoves), gameShopOn = genOption('gameShop', value, optionAt(i).gameShop);
    const at = { ...ctx, ...settingsOf(i, time), rule: numbersRule(value), battleRule: value, world: worldOf(i), ...(gen ? { formGen: gen } : {}) };
    if (learnFrom === GEN_OPTIONS.learnMoves.none) delete at.learnFrom; else at.learnFrom = learnFrom;
    if (gameShopOn) at.gameShopOn = true; else delete at.gameShopOn;
    return at;
  };
}

export const chatNowCtx = (chat, ctx) => foldCtxAt(chat, ctx)((chat?.message ?? []).length);

export function battleRuleNow(chat, settings) {
  const n = (chat?.message ?? []).length;
  const value = battleRuleAt(chat, settings)(n);
  const gen = genOf(value, n, () => autoGenAt(chat));
  return { value, gen, format: ruleFormat(value, gen) };
}

export function recordBattleRule(chat, value, settings, { now = Date.now() } = {}) {
  if (!isBattleRule(value)) throw new Error(`No battle rule ${value}`);
  const { status, changes, options } = readBattleRule(chat);
  if (isUnreadable(status)) throw failed('unreadable');
  const messages = chat?.message ?? [];
  if (battleRuleAt(chat, settings)(messages.length) === value) return false;
  writeRecord(chat, [...changes, { time: now, at: messages.length ? anchorAtEnd(messages) : null, value }], options);
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
  writeRecord(chat, [{ time: now, at: null, value: settings.battleRule }], options);
  return true;
}

const optionsBehindOf = (values, settings) => {
  const now = optionsOf(settings);
  return Object.fromEntries(OPTION_NAMES.filter(name => values[name] !== now[name]).map(name => [name, values[name]]));
};

export function optionsBehind(chat, settings) {
  const { options } = readBattleRule(chat);
  return options !== null && Object.keys(optionsBehindOf(options.values, settings)).length > 0;
}

export function recordOptions(chat, settings, { now = Date.now() } = {}) {
  const { status, changes, options } = readBattleRule(chat);
  if (isUnreadable(status)) throw failed('unreadable');
  const before = optionsBehindOf(options.values, settings);
  if (!Object.keys(before).length) return false;
  const messages = chat?.message ?? [];
  writeRecord(chat, changes, { values: optionsOf(settings),
    changes: [...options.changes, ...(messages.length ? [{ time: now, at: anchorAtEnd(messages), before }] : [])] });
  return true;
}

export function optionsAt(chat, settings) {
  const messages = chat?.message ?? [];
  const now = optionsOf(settings);
  const { options } = readBattleRule(chat);
  if (!options) return () => ({ ...now });
  const behind = messages.length ? optionsBehindOf(options.values, settings) : {};
  const changes = Object.keys(behind).length ? [...options.changes, { time: 0, at: anchorAtEnd(messages), before: behind }] : options.changes;
  return changedValuesAt(messages, changes, now);
}
