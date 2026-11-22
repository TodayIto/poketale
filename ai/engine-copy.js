import { COPY_STRIP_KEYS, installOnCopy } from '../engine/extensions.mjs';
import { chooseEach, battleFromJSON } from '../engine/showdown-compat.mjs';
import { enemyItemOf } from '../engine/bag.mjs';

export const FAIL_CHECK_EXEMPT = new Set(['suckerpunch', 'upperhand', 'thunderclap']);

export function snapshot(battle) {
  const saved = COPY_STRIP_KEYS.filter(key => Object.hasOwn(battle, key)).map(key => [key, battle[key]]);
  for (const [key] of saved) battle[key] = undefined;
  try { return JSON.stringify(battle.toJSON()); } catch (error) { throw staged(error, 'snapshot'); } finally { for (const [key, value] of saved) battle[key] = value; }
}

export function restore(sim, json, seed) {
  let copy;
  try {

    copy = battleFromJSON(sim, json);

    installOnCopy(sim, copy);
    for (const side of copy.sides) side.clearChoice();
    copy.prng = new sim.PRNG(seed);
    return copy;
  } catch (error) {
    copy?.destroy();
    throw staged(error, 'restore');
  }
}

const staged = (error, stage) => Object.assign(error instanceof Error ? error : new Error(String(error)), { stage });

export function atSlot(battle, slot) {
  for (const side of battle.sides) for (const pokemon of side.active) if (pokemon?.getSlot() === slot) return pokemon;
  return null;
}

export function applyGimmick(copy, sideId, gimmick, position = 0) {
  const user = copy.getSide(sideId).active[position];
  if (gimmick === 'mega' || gimmick === 'ultra') copy.actions.runMegaEvo(user);
  else if (gimmick === 'terastallize') copy.actions.terastallize(user);
  else if (gimmick === 'dynamax') {
    user.addVolatile('dynamax');
    user.side.dynamaxUsed = true;
    if (user.side.allySide) user.side.allySide.dynamaxUsed = true;
    user.m.gimmick = 'dynamax';
    user.canTerastallize = null;
  }
}

export function activeMaxMove(battle, moveId, user, target) {
  const move = battle.dex.getActiveMove(moveId);
  if (move.category !== 'Status') {
    battle.singleEvent('ModifyType', move, null, user, target, move, move);
    battle.runEvent('ModifyType', user, target, move, move);
  }
  return battle.actions.getActiveMaxMove(move, user);
}

export function rolloutMove(sim, json, seed, sideId, { position, move: moveId, target: targetSlot, gimmick = '', zmove = false }) {
  const copy = restore(sim, json, seed);
  try {
    applyGimmick(copy, sideId, gimmick, position);
    const user = copy.getSide(sideId).active[position];
    const target = atSlot(copy, targetSlot);
    if (!user || !target || target.fainted) return { failed: false, hits: {} }; // no target to hit (actually 0)
    copy.onEvent('Accuracy', copy.format, (accuracy, hit, source) => (source === user ? true : accuracy));
    copy.onEvent('CriticalHit', copy.format, (crit, hit, source, move) =>
      move?.willCrit === true || !!user.volatiles['laserfocus']);
    copy.randomizer = baseDamage => baseDamage;
    let basePower;

    copy.onEvent('BasePower', copy.format, { priority: 10000 }, (power, attacker) => {
      if (attacker === user && basePower === undefined) basePower = power;
    });
    const hits = {};
    const spreadDamage = copy.spreadDamage;
    copy.spreadDamage = function (amounts, targets, source, effect, instafaint) {
      const dealt = spreadDamage.call(this, amounts, targets, source, effect, instafaint);
      if (source === user && effect?.effectType === 'Move' && targets) {
        targets.forEach((pokemon, i) => {
          if (!pokemon || typeof dealt[i] !== 'number') return;
          const slot = pokemon.getSlot(), hit = hits[slot] ??= { damage: 0, ko: false };
          hit.damage += dealt[i];
          hit.typeMod ??= effect.moveHitData?.[slot]?.typeMod;
          if (pokemon.hp <= 0) hit.ko = true;
        });
      }
      return dealt;
    };
    const move = copy.dex.getActiveMove(moveId);
    if (FAIL_CHECK_EXEMPT.has(move.id)) move.onTry = undefined;

    const zMove = zmove ? copy.actions.getZMove(move, user, true) : undefined;
    if (zmove && !zMove) return { error: `${moveId}: no Z-Move` };
    let zPower;
    if (zMove) {
      const runZPower = copy.actions.runZPower;
      copy.actions.runZPower = function (active, pokemon) {
        const before = { boosts: { ...pokemon.boosts }, hp: pokemon.hp, crit: !!pokemon.volatiles['focusenergy'] };
        const out = runZPower.call(this, active, pokemon);
        zPower = zPowerDone(before, pokemon);
        return out;
      };
    }

    const maxMove = !zMove && user.volatiles['dynamax'] ? copy.actions.getMaxMove(move, user)?.id : undefined;
    const field = maxMove ? fieldNow(copy) : null;
    user.activeMoveActions++; // what runMove does before useMove (for first-turn move checks)
    const result = copy.actions.useMove(move, user, { target, ...(zMove ? { zMove } : {}), ...(maxMove ? { maxMove } : {}) });
    const maxEffect = field ? maxEffectDone(field, copy, user) : null;
    return { failed: result === false, basePower, hits, ...(zPower ? { zPower } : {}), ...(maxEffect ? { maxEffect } : {}) };
  } catch (error) {
    return { error: String(error?.message || error) };
  } finally {
    copy.destroy();
  }
}

function zPowerDone(before, pokemon) {
  const boosts = Object.fromEntries(Object.entries(pokemon.boosts).map(([stat, stage]) => [stat, stage - before.boosts[stat]]).filter(([, d]) => d));
  return {
    ...(Object.keys(boosts).length ? { boosts } : {}),
    ...(pokemon.hp > before.hp ? { heal: { from: before.hp / pokemon.maxhp, to: pokemon.hp / pokemon.maxhp } } : {}),
    ...(!before.crit && pokemon.volatiles['focusenergy'] ? { crit: true } : {}),
  };
}

function fieldNow(battle) {
  const boosts = new Map();
  for (const side of battle.sides) for (const pokemon of side.active) if (pokemon && !pokemon.fainted) boosts.set(pokemon, { ...pokemon.boosts });
  return { boosts, weather: battle.field.weather, terrain: battle.field.terrain };
}

function maxEffectDone(before, battle, user) {
  const boosts = [];
  for (const [pokemon, stages] of before.boosts) {
    const changed = Object.entries(pokemon.boosts).map(([stat, stage]) => [stat, stage - stages[stat]]).filter(([, d]) => d);
    if (changed.length) boosts.push({ slot: pokemon.getSlot(), ally: pokemon.isAlly(user), boosts: Object.fromEntries(changed) });
  }
  const effect = {
    ...(boosts.length ? { boosts } : {}),
    ...(battle.field.weather !== before.weather ? { weather: { from: before.weather, to: battle.field.weather } } : {}),
    ...(battle.field.terrain !== before.terrain ? { terrain: { from: before.terrain, to: battle.field.terrain } } : {}),
  };
  return Object.keys(effect).length ? effect : null;
}

export function tryChoice(sim, json, seed, sideId, parts) {
  const copy = restore(sim, json, seed);
  try {
    const side = copy.getSide(sideId);
    if (!side.requestState || side.choice.cantUndo) return { accepted: false };
    return { accepted: chooseEach(side, parts.map(part => (enemyItemOf(part) ? { event: 'StoryEnemyItem' } : part))) };
  } catch (error) {
    return { accepted: false, error: String(error?.message || error) };
  } finally {
    copy.destroy();
  }
}
