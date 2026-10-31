import ko from './text-summary-ko.json' with { type: 'json' };
import en from './text-summary-en.json' with { type: 'json' };
import { learnMoveOption } from './steps-exp.js';
import { ownText } from './text.js';
import { checkLang, DEFAULT_LANG } from './lang.js';

const PHRASES = { ko, en };
import { expForLevel } from '../engine/exp.mjs';
import { MAX_LEVEL, NON_HP_STATS } from '../engine/mon.mjs';

export function summaryView(battle, names, entry, pokemon, options = {}, lang = DEFAULT_LANG) {
  const phrases = PHRASES[checkLang(lang)];
  const species = pokemon.baseSpecies;
  const nature = battle.dex.natures.get(pokemon.set.nature ?? '');
  const ability = battle.dex.abilities.get(entry.baseAbility ?? pokemon.baseAbility);
  const summary = {
    dexNumber: species.num,
    types: [...species.types],
    ball: entry.pokeball || pokemon.pokeball || 'pokeball',
    trainer: pokemon.m?.ot || pokemon.side.name,
    ability: { name: names.ability(ability.id), description: phrases[`ability.${ability.id}`] ?? '' },

    item: pokemon.item ? names.item(pokemon.item) : pokemon.m?.heldCustom ?? null,

    stats: { hp: pokemon.hp, maxhp: pokemon.maxhp, ...Object.fromEntries(NON_HP_STATS.map(s => [s, entry.stats?.[s] ?? pokemon.baseStoredStats[s]])) },
    friendship: pokemon.happiness,
    moves: pokemon.baseMoveSlots.map(slot => learnMoveOption(battle, names, slot.id, slot.pp, slot.maxpp, lang)),
  };
  if (nature.exists) {

    const original = battle.dex.natures.get(pokemon.m?.natureOrig ?? '');
    const shown = original.exists && original.id !== nature.id ? original : nature;
    summary.nature = { name: phrases[`nature.${shown.id}`] ?? shown.name, text: phrases[`natureFragment.${shown.id}`] ?? '{{nature}}',
      ...(nature.plus ? { plus: nature.plus, minus: nature.minus } : {}) };

    if (shown !== nature) summary.nature.mint = ownText('own.mintNote', { itemName: names.item(`${nature.id}mint`) }, lang);
  }

  if (!battle.dex.currentMod.startsWith('champions')) summary.ivs = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31, ...pokemon.set.ivs };
  else if (battle.ruleTable.has('levelclausemod')) summary.ivs = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };

  if (entry.teraType) summary.teraType = entry.teraType;
  const exp = expInfo(battle, pokemon, options.exp);
  if (exp) summary.exp = exp;
  return summary;
}

function expInfo(battle, pokemon, table) {
  const row = table?.species?.[battle.dex.species.get(pokemon.set.species).num];
  const growth = row ? table.growthRates[row[1]] : null;
  if (!growth || pokemon.m?.exp === undefined) return null;

  const total = pokemon.m.exp, level = Math.min(pokemon.level, MAX_LEVEL);
  if (level >= MAX_LEVEL) return { total, next: 0, ratio: 0 };
  const low = expForLevel(growth, level), high = expForLevel(growth, level + 1);
  return { total, next: high - total, ratio: Math.max(0, Math.min(1, (total - low) / (high - low))) };
}
