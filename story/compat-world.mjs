import { readStored, isRecord, isUnreadable } from './stored.mjs';
import { failed } from './failure.mjs';
import { importPlace, anchorAtEnd } from './import.mjs';
import { rulesAt } from './setting-changes.mjs';
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

export function worldBehind(chat) {
  const { values } = readWorld(chat);
  return values !== null && !same(values, liveWorld(chat));
}

export function recordWorldChange(chat, { now = Date.now() } = {}) {
  const { status, values, changes } = readWorld(chat);
  if (isUnreadable(status)) throw failed('unreadable');
  const live = liveWorld(chat);
  if (same(values, live)) return false;
  const messages = chat?.message ?? [];
  chat.scriptstate ??= {};
  chat.scriptstate[WORLD_VAR] = JSON.stringify({ v: 1, values: live,
    changes: [...changes, ...(messages.length ? [{ time: now, at: anchorAtEnd(messages), before: values }] : [])] });
  return true;
}

export function worldAt(chat) {
  const messages = chat?.message ?? [];
  const live = liveWorld(chat);
  const { values, changes: kept } = readWorld(chat);
  if (values === null) return () => worldOf(NONE);
  const changes = !same(values, live) && messages.length ? [...kept, { time: 0, at: anchorAtEnd(messages), before: values }] : kept;
  const now = worldOf(live);
  if (!changes.length) return () => now;
  const places = changes.map(change => importPlace(messages, change));
  for (let k = places.length - 2; k >= 0; k--) places[k] = Math.min(places[k], places[k + 1]);
  const worlds = changes.map(change => worldOf(change.before));
  return i => { const k = places.findIndex(place => place >= i); return k < 0 ? now : worlds[k]; };
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
