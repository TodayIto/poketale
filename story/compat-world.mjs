import { readStored, isRecord, isUnreadable } from './stored.mjs';
import { failed } from './failure.mjs';
import { anchorAtEnd } from './import.mjs';
import { rulesAt, madeBy, orderedPlaces } from './setting-changes.mjs';
import { readsRegionMachines } from './blocks.mjs';
import { regionStandard, DEFAULT_STANDARD } from './machine-standards.mjs';
import { isGen } from '../engine/rules.mjs';

export const WORLD_VAR = '$pkb_compat_world';

export const COMPAT_WORLD_VARS = Object.freeze({ startRegion: '$yp_StartRegion', adventure: '$yp_Adventure' });
const FIELDS = Object.freeze(Object.keys(COMPAT_WORLD_VARS));
const NONE = Object.freeze({ startRegion: null, adventure: null });

const text = value => (value === undefined || value === null ? null : String(value).trim() || null);

const liveWorld = chat => Object.fromEntries(FIELDS.map(field => [field, text(chat?.scriptstate?.[COMPAT_WORLD_VARS[field]])]));

const valuesShape = values => isRecord(values) && FIELDS.every(field => values[field] === undefined || values[field] === null || typeof values[field] === 'string');
const changeShape = change => isRecord(change) && typeof change.time === 'number' && isRecord(change.at) && valuesShape(change.before);
const valuesOf = values => Object.fromEntries(FIELDS.map(field => [field, values?.[field] ?? null]));
const same = (a, b) => FIELDS.every(field => (a[field] ?? null) === (b[field] ?? null));

function readWorld(chat) {
  const { status, value } = readStored(chat?.scriptstate?.[WORLD_VAR], {
    shape: v => Array.isArray(v.changes) && v.changes.every(changeShape) && (v.values === undefined || valuesShape(v.values)),
  });
  if (isUnreadable(status)) return { status, values: null, changes: [] };
  return { status, values: valuesOf(value?.values), changes: status === 'ok' ? value.changes.map(c => ({ ...c, before: valuesOf(c.before) })) : [] };
}

// An empty chat without a record is behind too: its start is recorded as soon as the chat is caught up (an import may
// come first), so that a later change keeps its time (recordWorldChange)
export function worldBehind(chat) {
  const { status, values } = readWorld(chat);
  return values !== null && (!same(values, liveWorld(chat)) || (status === 'none' && !(chat?.message ?? []).length));
}

export function recordWorldChange(chat, { now = Date.now() } = {}) {
  const { status, values, changes } = readWorld(chat);
  if (isUnreadable(status)) throw failed('unreadable');
  const live = liveWorld(chat), messages = chat?.message ?? [];
  if (same(values, live) && !(status === 'none' && !messages.length)) return false;
  chat.scriptstate ??= {};
  // an empty chat's too once it has a record (setting-changes.mjs recordSettingChange)
  chat.scriptstate[WORLD_VAR] = JSON.stringify({ v: 1, values: live,
    changes: [...changes, ...(messages.length || status === 'ok' ? [{ time: now, at: anchorAtEnd(messages), before: values }] : [])] });
  return true;
}

export function worldAt(chat) {
  const messages = chat?.message ?? [];
  const live = liveWorld(chat);
  const { status, values, changes: kept } = readWorld(chat);
  if (values === null) return () => worldOf(NONE);
  // A change found only by the variables being ahead of the record counts after every import at the last message
  const changes = !same(values, live) && (messages.length || status === 'ok') ? [...kept, { time: Infinity, at: anchorAtEnd(messages), before: values }] : kept;
  const now = worldOf(live);
  if (!changes.length) return () => now;
  const places = orderedPlaces(messages, changes);
  const worlds = changes.map(change => worldOf(change.before));
  // time, timed: an import's, under the rule editedImports (setting-changes.mjs madeBy)
  return (i, time, timed = false) => { const k = places.findIndex((place, n) => !madeBy(place, changes[n].time, i, time, timed)); return k < 0 ? now : worlds[k]; };
}

const START_REGIONS = new Map(Array.from({ length: 9 }, (_, i) => [String(i + 1), i + 1]));
const ANIME_ADVENTURES = Object.freeze({ 1: Object.freeze({ 4: 'journeys' }), 9: Object.freeze({ 2: 'horizons' }) });

export function worldOf(values) {
  const startRegion = START_REGIONS.get(values?.startRegion ?? '') ?? null;
  return { startRegion, anime: ANIME_ADVENTURES[startRegion]?.[values?.adventure ?? ''] ?? null };
}

export const worldKey = world => `${world.startRegion ?? '-'}:${world.anime ?? '-'}`;

export const discWorld = (world, gen, rule = null) => (Number.isInteger(gen) ? { ...world, ...(isGen(rule) && world?.anime ? { anime: null } : {}), gen } : world);

export const shopMachinesAt = (chat, i, region, gen = null, rule = null) => (readsRegionMachines(rulesAt(chat)(i))
  ? regionStandard(region, discWorld(worldAt(chat)(i), gen, rule)) ?? DEFAULT_STANDARD : null);

export const shopGameAt = (chat, i, region, gen = null, rule = null) => regionStandard(region, discWorld(worldAt(chat)(i), gen, rule));
