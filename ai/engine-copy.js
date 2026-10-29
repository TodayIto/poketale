import { COPY_STRIP_KEYS, installOnCopy } from '../engine/extensions.mjs';

export const SELF_TARGETS = new Set(['self', 'allySide', 'allyTeam', 'adjacentAllyOrSelf', 'allies', 'adjacentAlly']);

export const FAIL_CHECK_EXEMPT = new Set(['suckerpunch', 'upperhand', 'thunderclap']);

export function snapshot(battle) {
  const saved = COPY_STRIP_KEYS.filter(key => Object.hasOwn(battle, key)).map(key => [key, battle[key]]);
  for (const [key] of saved) battle[key] = undefined;
  try { return JSON.stringify(battle.toJSON()); } catch (error) { throw staged(error, 'snapshot'); } finally { for (const [key, value] of saved) battle[key] = value; }
}

// One copy. Choices already made are cleared: the AI must not see what the opponent (the player) chose.
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

export function applyGimmick(copy, sideId, gimmick) {
  const user = copy.getSide(sideId).active[0];
  if (gimmick === 'mega') copy.actions.runMegaEvo(user);
  else if (gimmick === 'terastallize') copy.actions.terastallize(user);
}

export function rolloutMove(sim, json, seed, sideId, moveId, gimmick = '') {
  const copy = restore(sim, json, seed);
  try {
    applyGimmick(copy, sideId, gimmick);
    const side = copy.getSide(sideId);
    const user = side.active[0];
    const foe = side.foe.active[0];
    if (!user || !foe || foe.fainted) return { failed: false, damage: 0, ko: false };
    copy.onEvent('Accuracy', copy.format, (accuracy, target, source) => (source === user ? true : accuracy));
    copy.onEvent('CriticalHit', copy.format, (crit, target, source, move) =>
      move?.willCrit === true || !!user.volatiles['laserfocus']);
    copy.randomizer = baseDamage => baseDamage;
    let basePower;

    copy.onEvent('BasePower', copy.format, { priority: 10000 }, (power, attacker) => {
      if (attacker === user && basePower === undefined) basePower = power;
    });
    let damage = 0, ko = false, typeMod;
    const spreadDamage = copy.spreadDamage;
    copy.spreadDamage = function (amounts, targets, source, effect, instafaint) {
      const dealt = spreadDamage.call(this, amounts, targets, source, effect, instafaint);
      if (source === user && effect?.effectType === 'Move' && targets) {
        targets.forEach((target, i) => {
          if (target !== foe || typeof dealt[i] !== 'number') return;
          damage += dealt[i];
          typeMod ??= effect.moveHitData?.[foe.getSlot()]?.typeMod;
          if (foe.hp <= 0) ko = true;
        });
      }
      return dealt;
    };
    const move = copy.dex.getActiveMove(moveId);
    if (FAIL_CHECK_EXEMPT.has(move.id)) move.onTry = undefined;
    user.activeMoveActions++;
    const result = copy.actions.useMove(move, user, { target: SELF_TARGETS.has(move.target) ? user : foe });
    return { failed: result === false, damage, ko, typeMod, basePower };
  } catch (error) {
    return { error: String(error?.message || error) };
  } finally {
    copy.destroy();
  }
}

export function tryChoice(sim, json, seed, sideId, choice) {
  const copy = restore(sim, json, seed);
  try {
    return { accepted: copy.choose(sideId, choice) !== false };
  } catch (error) {
    return { accepted: false, error: String(error?.message || error) };
  } finally {
    copy.destroy();
  }
}
