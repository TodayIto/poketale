// from pokerogue src/field/pokemon.ts, src/field/trainer.ts, src/data/arena-tag.ts @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-10-28. See view/LICENSE-NOTE.md.

import table from './pokerogue-moves.json' with { type: 'json' };

const LEGENDARY = new Set(table.legendary);

export const hpRatio = pokemon => Math.round(pokemon.hp / pokemon.maxhp * 100) / 100;

const linear = (from, to, t) => from + (to - from) * t;

export function typeEffectiveness(battle, type, target) {
  if (!target.runImmunity(type, false)) return 0;
  return 2 ** battle.dex.getEffectiveness(type, target);
}

export function getMatchupScore(battle, user, opponent) {
  const enemyTypes = opponent.getTypes();
  const outspeed = (user.isActive ? user.getStat('spe') : user.storedStats.spe) >= opponent.getStat('spe');
  let defScore = 1 / Math.max(typeEffectiveness(battle, enemyTypes[0], user), 0.25);
  if (enemyTypes.length > 1) defScore /= Math.max(typeEffectiveness(battle, enemyTypes[1], user), 0.25);

  let atkScore = 0, count = 0;
  for (const slot of user.moveSlots) {
    const move = battle.dex.moves.get(slot.id);
    if (move.category === 'Status' || slot.pp <= 0) continue;
    let score = typeEffectiveness(battle, move.type, opponent);

    if (user.hasType(move.type) && !move.onModifyType) score *= 1.5;
    atkScore += score;
    count++;
  }
  atkScore /= count || 1;

  const ratio = hpRatio(user);
  const isDying = ratio <= 0.2;
  let hpDiffRatio = ratio + (1 - hpRatio(opponent));
  if (isDying && user.isActive) {
    const badMatchup = atkScore < 1.5 && defScore < 1.5;
    if (!outspeed && badMatchup) hpDiffRatio *= 0.85;
    else hpDiffRatio = 1 - ratio + (outspeed ? 0.2 : 0.1);
  } else if (outspeed) {
    hpDiffRatio *= 1.25;
  } else if (ratio > 0.2 && ratio <= 0.4) {
    hpDiffRatio *= 0.5;
  }
  return (atkScore + defScore) * Math.min(hpDiffRatio, 1);
}

function entryHazardMultiplier(pokemon, layers) {
  return pokemon.isGrounded() ? 1 : linear(0, 1 / 2 ** layers, Math.min(hpRatio(pokemon), 0.5) * 2);
}

export function hazardMultiplier(battle, pokemon) {
  let result = 1;
  for (const [id, state] of Object.entries(pokemon.side.sideConditions)) {
    const layers = state.layers || 1;
    if (id === 'spikes' || id === 'stickyweb') {
      result *= entryHazardMultiplier(pokemon, layers);
    } else if (id === 'stealthrock') {
      const damageHpRatio = 0.125 * typeEffectiveness(battle, 'Rock', pokemon);
      result *= linear(entryHazardMultiplier(pokemon, layers), 1, 1 - damageHpRatio ** damageHpRatio);
    } else if (id === 'toxicspikes') {
      if (pokemon.isGrounded() || !canBePoisoned(pokemon)) continue;
      result *= pokemon.hasType('Poison') ? 1.25 : entryHazardMultiplier(pokemon, layers);
    }
  }
  return result;
}

// The part of canSetStatus(POISON, quiet) used for switch decisions: no status yet and not type-immune
function canBePoisoned(pokemon) {
  return !pokemon.status && pokemon.runStatusImmunity('psn');
}

export function partyMatchupScores(battle, side, forSwitch) {
  const opponents = side.foe.active.filter(p => p && !p.fainted && p.hp > 0);
  const scores = [];
  side.pokemon.forEach((pokemon, i) => {
    if (pokemon.isActive || pokemon.fainted || pokemon.hp <= 0) return;
    let score = 0;
    if (opponents.length) {
      for (const opponent of opponents) {
        score += getMatchupScore(battle, pokemon, opponent);
        if (LEGENDARY.has(battle.dex.species.get(opponent.species.baseSpecies).id)) score /= 2;
      }
      score /= opponents.length;
      if (forSwitch && !pokemon.isActive) score *= hazardMultiplier(battle, pokemon);
    }
    scores.push({ index: i + 1, score });
  });
  return scores;
}

export const sortScores = scores => scores.slice().sort((a, b) => (a.score < b.score ? 1 : a.score > b.score ? -1 : 0));

export function nextSummonIndex(scores, rng) {
  const best = sortScores(scores)[0].score;
  const tied = scores.filter(s => s.score === best);
  return tied.length > 1 ? tied[rng.int(tied.length)].index : tied[0].index;
}
