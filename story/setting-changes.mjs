import { readStored, isRecord, isUnreadable } from './stored.mjs';
import { failed } from './failure.mjs';
import { importPlace, anchorAtEnd } from './import.mjs';
import { isExpRate } from '../engine/exp.mjs';
import { TRADE_EVOLUTIONS, ABSENT_TRADE_EVOLUTION } from '../engine/evolution.mjs';
import { RULE_IDS, DEFAULT_RULE } from '../engine/rules.mjs';
import { ITEM_EFFECTS_READY } from './item-effects.mjs';

export const SETTING_CHANGES_VAR = '$pkb_setting_changes';

const FOLDED = Object.freeze({
  friendshipRate: { valid: isExpRate, none: 1 },
  hatchRate: { valid: isExpRate, none: 1 },

  tradeEvolution: { valid: value => TRADE_EVOLUTIONS.includes(value), none: ABSENT_TRADE_EVOLUTION },

  rule: { valid: value => RULE_IDS.includes(value), none: DEFAULT_RULE },
});
const FOLD_SETTINGS = Object.freeze(Object.keys(FOLDED));

const FROM_NOW = Object.freeze({ old: false, now: true });

export const RULES = Object.freeze({ startFull: FROM_NOW, officialKo: FROM_NOW, aiFormNames: FROM_NOW, ...(ITEM_EFFECTS_READY ? { itemTags: FROM_NOW } : {}),
  boxHeal: FROM_NOW, foeLooks: FROM_NOW, trainerColors: FROM_NOW, mobStyles: FROM_NOW, duskLycanroc: FROM_NOW, blockEdges: FROM_NOW, partnerTraits: FROM_NOW });
const RULE_NAMES = Object.freeze(Object.keys(RULES));

export const ruleValues = ctx => Object.fromEntries(RULE_NAMES.map(name => [name, ctx?.[name] ?? RULES[name].now]));

export const foldValues = ctx => ({ ...foldSettings(ctx), ...ruleValues(ctx) });

const SWITCHED_OFF = ITEM_EFFECTS_READY ? [] : ['itemTags'];
const KNOWN = Object.freeze([...RULE_NAMES, ...SWITCHED_OFF]);

const FIRST_RULES = Object.freeze(['startFull', 'officialKo']);

const ruleShape = rules => isRecord(rules) && Object.entries(rules).every(([name, mark]) => !KNOWN.includes(name) || (isRecord(mark) && typeof mark.time === 'number'
  && (mark.at === null || isRecord(mark.at))));

const unknownOf = rules => Object.fromEntries(Object.entries(rules ?? {}).filter(([name]) => !KNOWN.includes(name)));

const placeRules = (marks, value) => {
  const known = Object.entries(marks).filter(([name]) => KNOWN.includes(name));
  const more = { ...unknownOf(value?.rulesMore), ...Object.fromEntries(known.filter(([name]) => !FIRST_RULES.includes(name))) };
  return { rules: { ...unknownOf(value?.rules), ...Object.fromEntries(known.filter(([name]) => FIRST_RULES.includes(name))) }, ...(Object.keys(more).length ? { rulesMore: more } : {}) };
};

const valuesShape = values => isRecord(values) && Object.entries(values).every(([name, value]) => FOLDED[name]?.valid(value));
const changeShape = change => isRecord(change) && typeof change.time === 'number' && isRecord(change.at) && valuesShape(change.before);

export function readSettingChanges(chat) {
  const { status, value } = readRecord(chat);
  if (isUnreadable(status)) return { status, changes: [], values: null, rules: null };
  const kept = value?.values ?? (value?.rule === undefined ? {} : { rule: value.rule });
  return { status, changes: status === 'ok' ? value.changes : [], values: foldSettings(kept), rules: { ...value?.rulesMore, ...value?.rules } };
}

const readRecord = chat => readStored(chat?.scriptstate?.[SETTING_CHANGES_VAR], {
  shape: v => Array.isArray(v.changes) && v.changes.every(changeShape) && (v.values === undefined || valuesShape(v.values)) && (v.rule === undefined || FOLDED.rule.valid(v.rule))
    && (v.rules === undefined || ruleShape(v.rules)) && (v.rulesMore === undefined || ruleShape(v.rulesMore)),
});

export const foldSettings = settings => Object.fromEntries(FOLD_SETTINGS.map(name => [name, settings?.[name] ?? FOLDED[name].none]));

const changeAtEnd = (messages, before, time) => ({ time, at: anchorAtEnd(messages), before });

const behindOf = (values, settings) => {
  const now = foldSettings(settings);
  return Object.fromEntries(FOLD_SETTINGS.filter(name => values[name] !== now[name]).map(name => [name, values[name]]));
};

export function recordSettingChange(chat, settings, { now = Date.now() } = {}) {
  const { status, changes, values, rules } = readSettingChanges(chat);
  if (isUnreadable(status)) throw failed('unreadable');
  const before = behindOf(values, settings), missing = RULE_NAMES.filter(name => !Object.hasOwn(rules, name));
  if (!Object.keys(before).length && !missing.length) return false;
  const messages = chat?.message ?? [];
  const { value } = readRecord(chat);
  const next = foldSettings(settings);
  const stored = Object.fromEntries(FOLD_SETTINGS.filter(name => next[name] !== FOLDED[name].none).map(name => [name, next[name]]));

  const marks = { ...rules, ...Object.fromEntries(missing.map(name => [name, { time: now, at: messages.length ? anchorAtEnd(messages) : null }])) };
  chat.scriptstate ??= {};
  chat.scriptstate[SETTING_CHANGES_VAR] = JSON.stringify({ v: 1, changes: [...changes, ...(messages.length && Object.keys(before).length ? [changeAtEnd(messages, before, now)] : [])],
    ...(Object.keys(stored).length ? { values: stored } : {}), ...placeRules(marks, value) });
  return true;
}

export function settingsBehind(chat, settings) {
  const { values, rules } = readSettingChanges(chat);
  return values !== null && (Object.keys(behindOf(values, settings)).length > 0 || RULE_NAMES.some(name => !Object.hasOwn(rules, name)));
}

export const rulesAt = chat => rulesIn(chat?.message ?? [], readSettingChanges(chat).rules);
function rulesIn(messages, rules) {

  const starts = Object.fromEntries(RULE_NAMES.map(name => {
    const mark = rules?.[name];
    return [name, mark?.at === null || (!mark && !messages.length) ? -Infinity : !mark ? messages.length - 1 : importPlace(messages, mark)];
  }));

  const after = (name, i, time) => i > starts[name] || (i === starts[name] && typeof time === 'number' && typeof rules?.[name]?.time === 'number' && time >= rules[name].time);
  return (i, time) => Object.fromEntries(RULE_NAMES.map(name => [name, after(name, i, time) ? RULES[name].now : RULES[name].old]));
}

export function settingsAt(chat, ctx) {
  const messages = chat?.message ?? [];
  const now = foldSettings(ctx);
  const { changes: kept, values, rules } = readSettingChanges(chat);

  const behind = values && messages.length ? behindOf(values, ctx) : {};
  const changes = Object.keys(behind).length ? [...kept, changeAtEnd(messages, behind, 0)] : kept;
  const places = changes.map(change => importPlace(messages, change));
  for (let k = places.length - 2; k >= 0; k--) places[k] = Math.min(places[k], places[k + 1]);
  const ruleAt = rulesIn(messages, rules);
  if (!changes.length) return (i, time) => ({ ...now, ...ruleAt(i, time) });
  return (i, time) => ({ ...Object.fromEntries(FOLD_SETTINGS.map(name => {
    const k = changes.findIndex((change, n) => places[n] >= i && Object.hasOwn(change.before, name));
    return [name, k < 0 ? now[name] : changes[k].before[name]];
  })), ...ruleAt(i, time) });
}

export function foldCtxAt(chat, ctx) {
  const settingsOf = settingsAt(chat, ctx);
  return (i, time) => ({ ...ctx, ...settingsOf(i, time) });
}
