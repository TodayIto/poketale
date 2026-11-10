// Record setting changes at their story position.
import { readStored, isRecord, isUnreadable } from './stored.mjs';
import { failed } from './failure.mjs';
import { importPlace, anchorAtEnd } from './import.mjs';
import { isExpRate } from '../engine/exp.mjs';
import { TRADE_EVOLUTIONS, ABSENT_TRADE_EVOLUTION } from '../engine/evolution.mjs';
import { RULE_IDS, DEFAULT_RULE } from '../engine/rules.mjs';

export const SETTING_CHANGES_VAR = '$pkb_setting_changes';

const FOLDED = Object.freeze({
  friendshipRate: { valid: isExpRate, none: 1 },
  hatchRate: { valid: isExpRate, none: 1 },

  tradeEvolution: { valid: value => TRADE_EVOLUTIONS.includes(value), none: ABSENT_TRADE_EVOLUTION },

  rule: { valid: value => RULE_IDS.includes(value), none: DEFAULT_RULE },
});
const FOLD_SETTINGS = Object.freeze(Object.keys(FOLDED));

const valuesShape = values => isRecord(values) && Object.entries(values).every(([name, value]) => FOLDED[name]?.valid(value));
const changeShape = change => isRecord(change) && typeof change.time === 'number' && isRecord(change.at) && valuesShape(change.before);

export function readSettingChanges(chat) {
  const { status, value } = readStored(chat?.scriptstate?.[SETTING_CHANGES_VAR], {
    shape: v => Array.isArray(v.changes) && v.changes.every(changeShape) && (v.values === undefined || valuesShape(v.values)) && (v.rule === undefined || FOLDED.rule.valid(v.rule)),
  });
  if (isUnreadable(status)) return { status, changes: [], values: null };
  const kept = value?.values ?? (value?.rule === undefined ? {} : { rule: value.rule });
  return { status, changes: status === 'ok' ? value.changes : [], values: foldSettings(kept) };
}

export const foldSettings = settings => Object.fromEntries(FOLD_SETTINGS.map(name => [name, settings?.[name] ?? FOLDED[name].none]));

const changeAtEnd = (messages, before, time) => ({ time, at: anchorAtEnd(messages), before });

const behindOf = (values, settings) => {
  const now = foldSettings(settings);
  return Object.fromEntries(FOLD_SETTINGS.filter(name => values[name] !== now[name]).map(name => [name, values[name]]));
};

export function recordSettingChange(chat, settings, { now = Date.now() } = {}) {
  const { status, changes, values } = readSettingChanges(chat);
  if (isUnreadable(status)) throw failed('unreadable');
  const before = behindOf(values, settings);
  if (!Object.keys(before).length) return false;
  const messages = chat?.message ?? [];
  const next = foldSettings(settings);
  const stored = Object.fromEntries(FOLD_SETTINGS.filter(name => next[name] !== FOLDED[name].none).map(name => [name, next[name]]));
  chat.scriptstate ??= {};
  chat.scriptstate[SETTING_CHANGES_VAR] = JSON.stringify({ v: 1, changes: [...changes, ...(messages.length ? [changeAtEnd(messages, before, now)] : [])],
    ...(Object.keys(stored).length ? { values: stored } : {}) });
  return true;
}

export function settingsBehind(chat, settings) {
  const { values } = readSettingChanges(chat);
  return values !== null && Object.keys(behindOf(values, settings)).length > 0;
}

export function settingsAt(chat, ctx) {
  const messages = chat?.message ?? [];
  const now = foldSettings(ctx);
  const { changes: kept, values } = readSettingChanges(chat);

  const behind = values && messages.length ? behindOf(values, ctx) : {};
  const changes = Object.keys(behind).length ? [...kept, changeAtEnd(messages, behind, 0)] : kept;
  const places = changes.map(change => importPlace(messages, change));
  for (let k = places.length - 2; k >= 0; k--) places[k] = Math.min(places[k], places[k + 1]);
  if (!changes.length) return () => now;
  return i => Object.fromEntries(FOLD_SETTINGS.map(name => {
    const k = changes.findIndex((change, n) => places[n] >= i && Object.hasOwn(change.before, name));
    return [name, k < 0 ? now[name] : changes[k].before[name]];
  }));
}

export function foldCtxAt(chat, ctx) {
  const settingsOf = settingsAt(chat, ctx);
  return i => ({ ...ctx, ...settingsOf(i) });
}
