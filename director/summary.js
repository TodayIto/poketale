import ko from './text-summary-ko.json' with { type: 'json' };
import en from './text-summary-en.json' with { type: 'json' };
import koGens from './text-ability-gens-ko.json' with { type: 'json' };
import enGens from './text-ability-gens-en.json' with { type: 'json' };
import { rangedText, championsBattle } from './move-text.js';
import { learnMoveOption } from './steps-exp.js';
import { ownText } from './text.js';
import { checkLang, DEFAULT_LANG } from './lang.js';
import { genHas, battleRuleGen } from '../engine/generation.mjs';
import { dvIvs } from '../engine/rules.mjs';
import { say as screenSay } from '../story/screen-text.mjs';

const PHRASES = { ko, en };
const GENS = { ko: koGens, en: enGens };
import { expForLevel } from '../engine/exp.mjs';
import { MAX_LEVEL, NON_HP_STATS, hasOneSpecial } from '../engine/mon.mjs';

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

    ability: hasOneSpecial(battle.gen) ? null : { name: names.ability(ability.id), description: rangedText(GENS[checkLang(lang)][ability.id], battle.gen, championsBattle(battle)) ?? phrases[`ability.${ability.id}`] ?? '' },

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

  if (summary.ivs && hasOneSpecial(battle.gen)) summary.ivs = dvIvs(summary.ivs);
  if (battle.gen === 1) summary.oneSpecial = { label: screenSay(checkLang(lang), 'stat.special') };

  if (entry.teraType) summary.teraType = entry.teraType;

  const shown = genHas(battleRuleGen(battle), 'dynamax') && options.dynamaxShown === true;
  if (shown && !species.cannotDynamax && Number.isInteger(pokemon.dynamaxLevel)) {
    summary.dynamaxLevel = Math.max(0, Math.min(10, pokemon.dynamaxLevel));
  }

  if (shown && pokemon.set.gigantamax === true && pokemon.baseSpecies.canGigantamax) summary.gigantamax = true;
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
