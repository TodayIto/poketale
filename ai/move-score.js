// from pokerogue src/data/moves/move.ts, src/field/pokemon.ts @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-11-22. See view/LICENSE-NOTE.md.

import table from './pokerogue-moves.json' with { type: 'json' };
import { hpRatio, typeEffectiveness } from './matchup.js';
import { moveCategory } from '../engine/later-moves.mjs'; // a later move's own category in generations 1-3 (0.1.0 G1b)

export const MOVE_TABLE = table.moves;
const STATUS_EFFECT_CHANCE_EXCEPT = new Set(['orderup', 'electroshot']); // ab-attrs.ts 1291

/** AddBattlerTagAttr.getTagTargetBenefitScore (move.ts 6537-6585) */
function tagScore(tagType) {
  switch (tagType) {
    case 'RECHARGING': case 'PERISH_SONG':
      return -16;
    case 'FLINCHED': case 'CONFUSED': case 'INFATUATED': case 'NIGHTMARE': case 'DROWSY': case 'DISABLED':
    case 'HEAL_BLOCK': case 'RECEIVE_DOUBLE_DAMAGE':
      return -5;
    case 'SEEDED': case 'SALT_CURED': case 'CURSED': case 'FRENZY': case 'TRAPPED': case 'BIND': case 'WRAP':
    case 'FIRE_SPIN': case 'WHIRLPOOL': case 'CLAMP': case 'SAND_TOMB': case 'MAGMA_STORM': case 'SNAP_TRAP':
    case 'THUNDER_CAGE': case 'INFESTATION':
      return -3;
    case 'ENCORE':
      return -2;
    case 'MINIMIZED': case 'ALWAYS_GET_HIT':
      return 0;
    case 'INGRAIN': case 'IGNORE_ACCURACY': case 'AQUA_RING': case 'MAGIC_COAT':
      return 3;
    case 'PROTECTED': case 'FLYING': case 'CRIT_BOOST': case 'ALWAYS_CRIT':
      return 5;
    default:
      return 0; // source: warns "BattlerTag ... is missing a score!" and returns 0
  }
}

/** PokeRogue tags checked by HitsTagAttr <-> Showdown volatiles */
const HITS_TAG_VOLATILES = {
  FLYING: ['fly', 'bounce', 'skydrop'], UNDERGROUND: ['dig'], UNDERWATER: ['dive'], MINIMIZED: ['minimize'],
};

function getMoveChance(ctx, target, selfEffect) {
  const { user, move, entry } = ctx;
  let chance = entry.chance;
  if (chance > 0 && !STATUS_EFFECT_CHANCE_EXCEPT.has(move.id)) {
    if (user.hasAbility('serenegrace')) chance = Math.min(chance * 2, 100); // init-abilities.ts 366-368
    else if (user.hasAbility('sheerforce')) chance = 0; // init-abilities.ts 889-891 (x0)
  }
  if (!selfEffect && chance > 0 && target.hasAbility('shielddust')) chance = 0; // IgnoreMoveEffectsAbAttr
  return chance;
}

function canSetStatus(ctx, pokemon, status) {
  const { battle, user, activeMove } = ctx;
  if (!status || pokemon.status) return false;
  const corrosion = user.hasAbility('corrosion') && (status === 'psn' || status === 'tox');
  if (!corrosion && !pokemon.runStatusImmunity(status === 'tox' ? 'psn' : status)) return false;
  return !!battle.runEvent('SetStatus', pokemon, user, activeMove, battle.dex.conditions.get(status));
}

const anyPhysical = user => user.moveSlots.some(s => s.id !== 'struggle' && moveCategory(user.battle, s.id) === 'Physical');
const hasAliveBench = side => side.pokemon.some(p => !p.isActive && !p.fainted && p.hp > 0);
const sineEaseOut = v => Math.sin(v * Math.PI / 2);

/** ForceSwitchOutAttr.getUserBenefitScore (move.ts 7478-7492) */
function forceSwitchUserScore(ctx, selfSwitch, batonPass) {
  const { user } = ctx;
  if (!hasAliveBench(user.side)) return -20;
  let ret = selfSwitch ? Math.floor((1 - hpRatio(user)) * 20) : 0;
  if (selfSwitch && batonPass) {
    const total = Object.values(user.boosts).reduce((sum, v) => sum + v, 0);
    ret = ret / 2 + sineEaseOut(Math.min(Math.abs(total), 10) / 10) * (total >= 0 ? 10 : -10);
  }
  return ret;
}

function attrUserScore(ctx, attr, target) {
  const { user, entry, options } = ctx;
  switch (attr[0]) {
    case 'HighCrit': return 3; // move.ts 1960
    case 'CritOnly': return 5; // move.ts 1972
    case 'SurviveDamage': return target.hp > 1 ? 0 : -20; // move.ts 2182
    case 'Recoil': return Math.floor(entry.power / 5 / -4); // move.ts 2267
    case 'Sacrificial': // move.ts 2295, 2333
      if (options.bossPokemon) return -20;
      return Math.ceil(((1 - hpRatio(user)) * 10 - 10) * (typeEffectiveness(ctx.battle, ctx.move.type, target) - 0.5));
    case 'HalfSacrificial': // move.ts 2377
      if (options.bossPokemon) return -10;
      return Math.ceil(((1 - hpRatio(user) / 2) * 10 - 10) * (typeEffectiveness(ctx.battle, ctx.move.type, target) - 0.5));
    case 'Substitute': return options.bossPokemon ? -10 : 5; // move.ts 2433
    case 'SacrificialFullRestore': return -20; // move.ts 2756
    case 'HitHeal': { // move.ts 2858-2864
      const healStat = attr[1];
      if (healStat) {
        const healAmount = target.getStat(healStat, false, true); // same value as the engine's Strength Sap
        return Math.floor(Math.max(0, Math.min(1, (healAmount + user.hp) / user.maxhp - 0.33)) / hpRatio(user));
      }
      return Math.floor(Math.max(1 - hpRatio(user) - 0.33, 0) * (entry.power / 4));
    }
    case 'StealItem': case 'RemoveItem': return target.item ? 5 : 0; // move.ts 3230, 3326
    case 'HealStatus': return user.status ? 10 : 0; // move.ts 3516
    case 'BypassSleep': return user.status === 'slp' ? 200 : -10; // move.ts 3543
    case 'Terrain': return ctx.battle.field.terrain ? 0 : 6; // move.ts 3623
    case 'GulpMissile': // move.ts 6677
      return user.baseSpecies.baseSpecies === 'Cramorant' && user.hasAbility('gulpmissile') && user.species.name === 'Cramorant' ? 10 : 0;
    case 'RevivalBlessing': // move.ts 7221
      return options.trainer && user.side.pokemon.some(p => p.fainted) ? 20 : -20;
    case 'ForceSwitch': return forceSwitchUserScore(ctx, attr[1], attr[2]);
    case 'Stat': {
      if (attr[4] !== 'partingshot' || !hasAliveBench(user.side)) return 0;
      const switchScore = forceSwitchUserScore(ctx, true, false);
      return switchScore > 0 ? switchScore : 0;
    }
    case 'ShiftStat': return user.storedStats[attr[2]] > user.storedStats[attr[1]] ? 10 : 0; // move.ts 8789
    default: return 0;
  }
}

function attrTargetScore(ctx, attr, pokemon, target) {
  const { user } = ctx;
  switch (attr[0]) {
    case 'TargetHalfHp': // move.ts 2052
      return hpRatio(pokemon) > 0.5 ? Math.floor((hpRatio(pokemon) - 0.5) * -24 + 4) : -20;
    case 'Heal': { // move.ts 2514-2517
      const ratio = attr[1];
      const score = (1 - hpRatio(pokemon)) * 20 - ratio * 10;
      return Math.round(score / (1 - ratio / 2));
    }
    case 'FlameBurst': return pokemon.allies().length ? -5 : 0; // move.ts 2722: the target has an ally on the field
    case 'MultiHit': return -5; // move.ts 2952
    case 'Status': case 'MultiStatus': { // move.ts 3088-3094, 3115-3121
      const effect = attr[0] === 'Status' ? attr[1] : attr[1][0];
      const chance = getMoveChance(ctx, pokemon, attr[2]);
      const score = chance < 0 ? -10 : Math.floor(chance * -0.1);
      return canSetStatus(ctx, pokemon, effect) ? score : 0;
    }
    case 'PsychoShift': { // move.ts 3167-3172
      const status = user.status || (user.hasAbility('comatose') ? 'slp' : '');
      return !pokemon.status && status && canSetStatus(ctx, pokemon, status) ? -10 : 0;
    }
    case 'StealItem': case 'RemoveItem': return pokemon.item ? -5 : 0; // move.ts 3235, 3331
    case 'Stat': {
      const selfTarget = attr[3];
      let moveLevels = attr[2];
      if (attr[4] === 'growth' && ['sunnyday', 'desolateland'].includes(ctx.battle.field.effectiveWeather())) moveLevels++;
      let ret = 0;
      for (const stat of attr[1]) {
        const stage = pokemon.boosts[stat];
        const levels = moveLevels > 0 ? Math.min(stage + moveLevels, 6) - stage : Math.max(stage + moveLevels, -6) - stage;

        let noEffect = false;
        if ((stat === 'atk' || stat === 'spa') && selfTarget) noEffect = !anyPhysical(user);
        if ((stat === 'def' || stat === 'spd') && !selfTarget) noEffect = !anyPhysical(user);
        if (noEffect) continue;
        ret += levels * 4 + (levels > 0 ? -2 : 2);
      }
      return ret;
    }
    case 'Tag': { // AddBattlerTagAttr.getTargetBenefitScore (move.ts 6588-6594)
      let chance = getMoveChance(ctx, pokemon, attr[2]);
      if (chance < 0) chance = 100;
      return Math.floor(tagScore(attr[1]) * (chance / 100));
    }
    case 'HitsTag': // move.ts 6890: when the target (unchanged) has that status
      return (HITS_TAG_VOLATILES[attr[1]] || []).some(v => target.volatiles[v]) ? (attr[2] ? 10 : 5) : 0;
    case 'RepeatMove': return 2; // move.ts 8238-8246
    case 'ReducePp': { // move.ts 8297-8310
      const last = pokemon.lastMove;
      const slot = last && pokemon.moveSlots.find(s => s.id === last.id);
      if (!slot) return 0;
      const value = -(8 - Math.ceil(Math.min(slot.maxpp, 30) / 5));
      return slot.pp < 4 ? value / 4 * slot.pp : value;
    }
    default: return 0;
  }
}

/** The attribute's selfTarget (constructor argument, per source class) */
function attrSelfTarget(attr) {
  switch (attr[0]) {
    case 'Tag': return attr[2];
    case 'Heal': return attr[2];
    case 'Stat': return attr[3];
    case 'Status': case 'MultiStatus': return attr[2];

    default: return false;
  }
}

function userBenefitScore(ctx, target) {
  let score = 0;
  for (const attr of ctx.entry.attrs) score += attrUserScore(ctx, attr, target);
  if (ctx.entry.firstMove) score += ctx.user.activeMoveActions === 0 ? 10 : -20;
  return score;
}

function targetBenefitScore(ctx, target) {
  const { user, move } = ctx;
  let score = 0;
  for (const attr of ctx.entry.attrs) {
    const self = attrSelfTarget(attr);
    score += attrTargetScore(ctx, attr, self ? user : target, target) * (target !== user && self ? -1 : 1);
  }
  if (move.category === 'Status') return score;

  const effectiveness = moveTypeEffectiveness(ctx, target, false);
  let attackScore = (effectiveness - 1) ** 2 * (effectiveness < 1 ? -2 : 2);
  const [thisStat, offStat] = moveCategory(ctx.battle, move) === 'Physical' ? ['atk', 'spa'] : ['spa', 'atk'];

  const holder = move.overrideOffensivePokemon === 'target' ? target : user;
  const statValue = holder.getStat(move.overrideOffensiveStat || thisStat, false, true);
  const statRatio = user.getStat(offStat, false, true) / statValue;
  if (statRatio <= 0.75) attackScore *= 2;
  else if (statRatio <= 0.875) attackScore *= 1.5;
  const power = ctx.roll?.basePower ?? move.basePower;
  attackScore += Math.floor(power / 5);
  return score - attackScore;
}

function moveTypeEffectiveness(ctx, target, useRoll) {
  const { move, roll } = ctx;
  if (useRoll && roll && target !== ctx.user && roll.typeMod !== undefined) return 2 ** roll.typeMod;
  if (!target.runImmunity(move.type, false)) return 0;

  if (useRoll && (move.damage || move.damageCallback)) return 1;
  return 2 ** target.runEffectiveness(ctx.activeMove);
}

export function targetScore(ctx, target) {
  const { user, move, roll } = ctx;
  const ours = user.isAlly(target);
  let score = userBenefitScore(ctx, target) + targetBenefitScore(ctx, target) * (ours ? 1 : -1);
  if (Number.isNaN(score)) score = 0;
  if (roll?.failed) return -20;
  if (move.category === 'Status') return score;
  const effectiveness = moveTypeEffectiveness(ctx, target, true);
  const stab = user.hasType(move.type);
  if (ours && target !== user) return score * effectiveness * (stab ? 1.5 : 1);
  if (!ours) {
    score *= effectiveness;
    if (stab) score *= 1.5;
  } else if (effectiveness) {
    score /= effectiveness;
    if (stab) score /= 1.5;
  }
  return score || -20;
}

export const targetWeight = (ctx, target) => targetBenefitScore(ctx, target) * (ctx.user.isAlly(target) ? 1 : -1);

export const combineScores = (scores, spread) => (spread ? scores.reduce((sum, score) => sum + score, 0) : Math.max(...scores));

export function zPowerScore(zPower) {
  if (!zPower) return 0;
  let score = 0;
  for (const levels of Object.values(zPower.boosts ?? {})) score += levels * 4 + (levels > 0 ? -2 : 2);
  if (zPower.heal) score += Math.round(((1 - zPower.heal.from) * 20 - 10) / 0.5);
  if (zPower.crit) score += tagScore('CRIT_BOOST');
  return score;
}

export function maxEffectScore(effect) {
  if (!effect) return 0;
  let score = 0;
  for (const { ally, boosts } of effect.boosts ?? []) {
    for (const levels of Object.values(boosts)) score += (levels * 4 + (levels > 0 ? -2 : 2)) * (ally ? 1 : -1);
  }
  if (effect.terrain) score += effect.terrain.from ? 0 : 6;
  if (effect.weather) score += effect.weather.from ? 0 : 6;
  return score;
}

export const maxEntry = move => (move.id === 'maxguard' ? MOVE_TABLE.maxguard : { chance: -1, power: move.basePower || -1, attrs: [] });

/** Moves absent from PokeRogue get no attributes (base attack score only) */
export const tableEntry = (moveId, dexMove) => MOVE_TABLE[moveId] ||
  { chance: dexMove.secondary?.chance ?? -1, power: dexMove.basePower || -1, attrs: [] };
