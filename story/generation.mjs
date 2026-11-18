// The generation a story's battles follow. Automatic: the compatible bot's start region sets it (Pokémon Journeys
// starts at generation 8) and reaching a region of a newer generation raises it, never lowers it. A chat can also set it
// by hand from a message on. story/state.mjs folds it per message.
import { readStored, isRecord, isUnreadable } from './stored.mjs';
import { failed } from './failure.mjs';
import { anchorAtEnd, importPlace } from './import.mjs';
import { statusIn, compatWorld } from './compat.mjs';
import { DEFAULT_GEN, GENS, isGen } from '../engine/rules.mjs';
import { regionStandard } from './machine-standards.mjs';

export const GENERATION_VAR = '$pkb_generation';

// What a chat can choose; 'legacy' is only the first value of a chat that was already under way (generation 9)
export const GENERATION_SETTINGS = Object.freeze(['auto', ...GENS]);
const FIRSTS = Object.freeze(['auto', 'legacy']);

// The generation of a region's own games. Hisui is the past and raises nothing
const REGION_GENS = Object.freeze({ kanto: 1, johto: 2, hoenn: 3, sinnoh: 4, unova: 5, kalos: 6, alola: 7, galar: 8, paldea: 9, kitakami: 9 });
export const regionGen = region => REGION_GENS[region] ?? null;

// The automatic generation before any region: { gen, by } says why ('journeys', 'start' with the region number, 'none')
export function startGen(world) {
  if (world?.journeys) return { gen: 8, by: { kind: 'journeys' } };
  if (isGen(world?.startRegion)) return { gen: world.startRegion, by: { kind: 'start', region: world.startRegion } };
  return { gen: DEFAULT_GEN, by: { kind: 'none' } };
}

export function raiseGen(auto, region) {
  const gen = regionGen(region);
  return gen && gen > auto.gen ? { gen, by: { kind: 'region', region } } : auto;
}

// What disc standards are read with (story/machine-standards.mjs regionStandard): the world generation — a hand-set one,
// else the automatic one, also in chats kept on generation 9 — and Pokémon Journeys' single standard unless set by hand
export const discWorld = (world, setting, auto) => (isGen(setting) ? { journeys: false, gen: setting } : { journeys: !!world?.journeys, gen: auto.gen });

// The automatic generation after message upto, without a fold
export function autoGenAt(chat, upto) {
  const messages = chat?.message ?? [];
  let auto = startGen(compatWorld(chat));
  for (let i = 0; i <= Math.min(upto, messages.length - 1); i++) {
    const window = messages[i]?.role === 'char' ? statusIn(messages[i]) : null;
    if (window) auto = raiseGen(auto, window.region);
  }
  return auto;
}

// The battle generation a setting gives
export const battleGen = (setting, auto) => (setting === 'auto' ? auto.gen : setting === 'legacy' ? DEFAULT_GEN : setting);

const changeShape = change => isRecord(change) && typeof change.time === 'number' && (change.at === null || isRecord(change.at))
  && (change.value === 'auto' || isGen(change.value));
const recordShape = value => FIRSTS.includes(value.first) && Array.isArray(value.changes) && value.changes.every(changeShape);

export function readGeneration(chat) {
  const { status, value } = readStored(chat?.scriptstate?.[GENERATION_VAR], { shape: recordShape });
  return { status, first: value?.first ?? null, changes: value?.changes ?? [] };
}

// A journey has started once a bot reply after the greeting carries a Status Window
export const journeyStarted = messages => messages.some((message, i) => i > 0 && message?.role === 'char' && !!statusIn(message));
const firstOf = (first, messages) => first ?? (journeyStarted(messages) ? 'legacy' : 'auto');

// The setting at message i: the first value, then each change from the message after the one it was made at (an
// import at that message counts from its own time, as the rule records of story/setting-changes.mjs do)
export function generationsAt(chat) {
  const messages = chat?.message ?? [];
  const { first, changes } = readGeneration(chat);
  const start = firstOf(first, messages);
  const placed = changes.map(change => ({ ...change, place: change.at === null ? -1 : importPlace(messages, change) }));
  return (i, time) => placed.reduce((value, change) => (i > change.place || (i === change.place && typeof time === 'number' && time >= change.time) ? change.value : value), start);
}

// Written the first time the plugin sees a chat: a chat whose journey has not started yet follows the story's
// generation; one already under way stays on generation 9
export function recordGenerationStart(chat) {
  if (readGeneration(chat).status !== 'none') return false;
  chat.scriptstate ??= {};
  chat.scriptstate[GENERATION_VAR] = JSON.stringify({ v: 1, first: firstOf(null, chat?.message ?? []), changes: [] });
  return true;
}

export const generationUnrecorded = chat => readGeneration(chat).status === 'none';

export function recordGenerationChange(chat, value, { now = Date.now() } = {}) {
  if (!GENERATION_SETTINGS.includes(value)) throw new Error(`Unknown generation setting: ${value}`);
  const { status, first, changes } = readGeneration(chat);
  if (isUnreadable(status)) throw failed('unreadable');
  const messages = chat?.message ?? [];
  if (generationsAt(chat)(messages.length, now) === value) return false;
  chat.scriptstate ??= {};
  chat.scriptstate[GENERATION_VAR] = JSON.stringify({ v: 1, first: firstOf(first, messages),
    changes: [...changes, { time: now, at: messages.length ? anchorAtEnd(messages) : null, value }] });
  return true;
}

// The game a place at that message belongs to, by the disc standards' rule (story/machine-standards.mjs regionStandard),
// and the story's world generation there, for what its shops sell and charge: null in chats kept on generation 9; game
// null where no region with games is known (a Pokémon Journeys story is Sword/Shield everywhere). index -1: now, after
// the last message.
export function placeEraAt(chat, index, region) {
  const last = (chat?.message?.length ?? 0) - 1;
  const setting = generationsAt(chat)(index >= 0 ? index : last + 1);
  if (setting === 'legacy') return null;
  const world = discWorld(compatWorld(chat), setting, raiseGen(autoGenAt(chat, index >= 0 ? index : last), region));
  return { game: regionStandard(region, world) ?? null, gen: Number.isInteger(world.gen) ? world.gen : null };
}

export const placeGameAt = (chat, index, region) => placeEraAt(chat, index, region)?.game ?? null;
