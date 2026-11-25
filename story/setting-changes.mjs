import { readStored, isRecord, isUnreadable } from './stored.mjs';
import { failed } from './failure.mjs';
import { importPlace, anchorAtEnd } from './import.mjs';
import { isExpRate } from '../engine/exp.mjs';
import { TRADE_EVOLUTIONS, ABSENT_TRADE_EVOLUTION } from '../engine/evolution.mjs';
import { RULE_IDS, DEFAULT_RULE } from '../engine/rules.mjs';
import { ITEM_EFFECTS_READY } from './item-effects.mjs';
import { ITEM_NAMES_SINCE } from './items.mjs';

export const SETTING_CHANGES_VAR = '$pkb_setting_changes';

const FOLDED = Object.freeze({
  friendshipRate: { valid: isExpRate, none: 1 },
  hatchRate: { valid: isExpRate, none: 1 },

  tradeEvolution: { valid: value => TRADE_EVOLUTIONS.includes(value), none: ABSENT_TRADE_EVOLUTION },

  rule: { valid: value => RULE_IDS.includes(value), none: DEFAULT_RULE },
});
const FOLD_SETTINGS = Object.freeze(Object.keys(FOLDED));
/** A rule's values (RULES): off before its point, on from it */
const FROM_NOW = Object.freeze({ old: false, now: true });

export const RULES = Object.freeze({ startFull: FROM_NOW, officialKo: FROM_NOW, aiFormNames: FROM_NOW, ...(ITEM_EFFECTS_READY ? { itemTags: FROM_NOW } : {}),
  boxHeal: FROM_NOW, foeLooks: FROM_NOW, trainerColors: FROM_NOW, mobStyles: FROM_NOW, duskLycanroc: FROM_NOW, blockEdges: FROM_NOW,
  levelSpellings: FROM_NOW, friendshipSv: FROM_NOW, battleRegion: FROM_NOW, wildHiddenAbility: FROM_NOW, fishChain: FROM_NOW, formNames009: FROM_NOW, partnerLock: FROM_NOW, everstoneWaiting: FROM_NOW,
  keyStoneMega: FROM_NOW, zCrystalShare: FROM_NOW, zMoveWord: FROM_NOW, ultraBurstWord: FROM_NOW, namedTitles: FROM_NOW, namedJapanese: FROM_NOW, gmaxFactor: FROM_NOW, dynamaxWord: FROM_NOW, ...Object.fromEntries(Object.keys(ITEM_NAMES_SINCE).map(name => [name, FROM_NOW])),
  regionMachines: FROM_NOW, genEvolve010: FROM_NOW, genStats010: FROM_NOW, metGen010: FROM_NOW, catchTera010: FROM_NOW, discTeach010: FROM_NOW, discStoryItem010: FROM_NOW, shopTown010: FROM_NOW, hatchOnScreen010: FROM_NOW,
  eraAbilities: FROM_NOW, editedImports: FROM_NOW });
const RULE_NAMES = Object.freeze(Object.keys(RULES));

export const ruleValues = ctx => Object.fromEntries(RULE_NAMES.map(name => [name, ctx?.[name] ?? RULES[name].now]));

export const foldValues = ctx => ({ ...foldSettings(ctx), ...ruleValues(ctx) });

const SWITCHED_OFF = ITEM_EFFECTS_READY ? [] : ['itemTags'];
const KNOWN = Object.freeze([...RULE_NAMES, ...SWITCHED_OFF]);

const FIRST_RULES = Object.freeze(['startFull', 'officialKo']);

const ruleShape = rules => isRecord(rules) && Object.entries(rules).every(([name, mark]) => !KNOWN.includes(name) || (isRecord(mark) && typeof mark.time === 'number'
  && (mark.at === null || isRecord(mark.at))));
/** The names of a rules field this plugin does not know, as they are */
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

/** A change placed after the chat's last message now */
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
  // In an empty chat too, once it has a record (an import made there earlier reads the settings of its time); its first
  // record holds the settings it began with, no change from the defaults (as in 0.1.0)
  const change = Object.keys(before).length && (messages.length || status === 'ok');
  chat.scriptstate[SETTING_CHANGES_VAR] = JSON.stringify({ v: 1, changes: [...changes, ...(change ? [changeAtEnd(messages, before, now)] : [])],
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
  const { status, changes: kept, values, rules } = readSettingChanges(chat);

  // A change found only by the settings being ahead of the record counts after every import at the last message
  const behind = values && (messages.length || status === 'ok') ? behindOf(values, ctx) : {};
  const changes = Object.keys(behind).length ? [...kept, changeAtEnd(messages, behind, Infinity)] : kept;
  const ruleAt = rulesIn(messages, rules);
  const valueAt = changedValuesAt(messages, changes, now);
  return (i, time) => { const marks = ruleAt(i, time); return { ...valueAt(i, time, !!marks.editedImports), ...marks }; };
}

// A change made in an empty chat (no anchor, or one taken with no message) is placed before every message; any other
// keeps importPlace's: a surviving earlier anchor or its index (at most the last message) when its message is gone, and
// -1 once no message is left (then, as in 0.1.0, not yet made before the first message)
export const changePlace = (messages, change) => (change.at === null || (change.at?.index === -1 && change.at.chatId == null) ? -Infinity : importPlace(messages, change));

// The places of a record's changes, each no later than the next one placed at a message. A change made in an emptied
// chat (-Infinity) is left out of that ordering: 0.1.0's settings, world and options records have no such change, so
// the earlier ones keep 0.1.0's places, -1 while the chat stays empty and their own once messages are written again
export function orderedPlaces(messages, changes) {
  const places = changes.map(change => changePlace(messages, change));
  let later = Infinity;
  for (let k = places.length - 1; k >= 0; k--) if (places[k] > -Infinity) later = places[k] = Math.min(places[k], later);
  return places;
}

// Whether a change placed at message `place` (at the end of it) has been made by message i: a change counts from the
// message after its own; under the rule editedImports (timed), also for an import at its own message made after it.
// One made in an empty chat (-Infinity) counts for every message, and for an import before the first message only if
// made before it.
export function madeBy(place, changeTime, i, time, timed) {
  const timing = timed && typeof time === 'number' && typeof changeTime === 'number';
  if (place === -Infinity) return timing && i === -1 ? time >= changeTime : true;
  return timing && i === place ? time >= changeTime : i > place;
}

export function changedValuesAt(messages, changes, now) {
  const names = Object.keys(now);
  if (!changes.length) return () => ({ ...now });
  const places = orderedPlaces(messages, changes);
  return (i, time, timed = false) => Object.fromEntries(names.map(name => {
    const k = changes.findIndex((change, n) => !madeBy(places[n], change.time, i, time, timed) && Object.hasOwn(change.before, name));
    return [name, k < 0 ? now[name] : changes[k].before[name]];
  }));
}
