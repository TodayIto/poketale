import { entry, koSpellings, baseKo } from '../names/index.js';
import { say } from './screen-text.mjs';
import { norm, foldNorm } from './norm.mjs';
import { personalName, namedTrainer } from './named.mjs';

export const TOOL_EFFECTS = Object.freeze(['cheer', 'distract', 'taunt']);
/** Opponent's choices a taunt or distraction lasts */
export const TOOL_TURNS = 3;
/** The stats cheer may raise, and how many of them */
export const CHEER_STATS = Object.freeze(['atk', 'def', 'spa', 'spd', 'spe']);
export const CHEER_COUNT = 3;

const monKey = foldNorm;

const trainerKey = (name, reading) => norm(personalName({ name, ...reading })) || norm(name);

function speciesNames(dex, species) {
  const found = dex.species.get(species);
  if (!found?.exists) return [String(species ?? '')];
  const ids = [found.id, dex.species.get(found.baseSpecies).id];
  return ids.flatMap(id => {
    const record = entry('species', id);
    return [dex.species.get(id).name, ...koSpellings(record).map(baseKo)];
  });
}

export function pokemonNames(pokemon) {
  const dex = pokemon.battle.dex;
  const species = [pokemon.species.name, pokemon.m?.start?.species].filter(Boolean);
  return [...new Set([pokemon.set?.name, pokemon.name, ...species.flatMap(s => speciesNames(dex, s))].filter(Boolean))];
}

export const ownsPokemon = (owner, pokemon) => !!monKey(owner) && pokemonNames(pokemon).some(name => monKey(name) === monKey(owner));

const monNames = (dex, mon) => [...new Set([mon.set?.name, ...speciesNames(dex, mon.set?.species)].filter(Boolean))];

export function ownerMonOf(state, dex, owner) {
  const key = monKey(owner);
  if (!key) return null;
  const found = [...state?.party ?? [], ...state?.box ?? []].filter(mon => !mon.egg && monNames(dex, mon).some(name => monKey(name) === key));
  return found.length === 1 ? found[0].uid : null;
}

export const cheerOwns = (tool, pokemon) => (tool?.ownerMon ? pokemon.m?.uid === tool.ownerMon : ownsPokemon(tool?.owner ?? '', pokemon));

const GENERIC = new Set(['ko', 'en'].flatMap(lang => ['spec.foe', 'spec.foePartner', 'spec.wild', 'spec.partner'].map(k => norm(say(lang, k)))));

/** Whether a trainer name binds: a name of its own, not a nameless side's */
export const realTrainer = name => !!norm(name) && !GENERIC.has(norm(name));

export function ownsTrainer(owner, name, { titles = false, japanese = false } = {}) {
  const reading = { oldTitles: !titles, oldJapanese: !japanese };
  if (!realTrainer(name) || !trainerKey(owner, reading)) return false;
  if (trainerKey(owner, reading) === trainerKey(name, reading)) return true;
  const person = namedTrainer({ name, ...reading });
  return !!person && namedTrainer({ name: owner, ...reading }) === person;
}

export function offToolReasons(spec, turns, results) {
  const off = spec?.bag?.offTools;
  if (!off?.length) return results;
  const offItem = (result, i) => {
    const command = turns[i]?.[result.part ?? 'me'];
    return result.state === 'rejected' && result.reason === 'noItem' && command?.kind === 'item' && off.includes(command.item);
  };
  return results.some(offItem) ? results.map((result, i) => (offItem(result, i) ? { ...result, reason: 'cantUse' } : result)) : results;
}
