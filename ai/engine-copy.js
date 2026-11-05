import { COPY_STRIP_KEYS, installOnCopy } from '../engine/extensions.mjs';
import { chooseEach } from '../engine/showdown-compat.mjs';
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
    copy = sim.Battle.fromJSON(json);

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
  if (gimmick === 'mega') copy.actions.runMegaEvo(user);
  else if (gimmick === 'terastallize') copy.actions.terastallize(user);
}

export function rolloutMove(sim, json, seed, sideId, { position, move: moveId, target: targetSlot, gimmick = '' }) {
  const copy = restore(sim, json, seed);
  try {
    applyGimmick(copy, sideId, gimmick, position);
    const user = copy.getSide(sideId).active[position];
    const target = atSlot(copy, targetSlot);
    if (!user || !target || target.fainted) return { failed: false, hits: {} };
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
    user.activeMoveActions++;
    const result = copy.actions.useMove(move, user, { target });
    return { failed: result === false, basePower, hits };
  } catch (error) {
    return { error: String(error?.message || error) };
  } finally {
    copy.destroy();
  }
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
