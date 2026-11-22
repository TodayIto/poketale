import { snapshot, restore, activeMaxMove } from '../ai/engine-copy.js';
import { moveCategory } from '../engine/later-moves.mjs';

export function moveMenuInfo(battle, moveId, user, target, { sim, abilityShown = () => false, z = false, max = false } = {}) {
  const base = battle.dex.moves.get(moveId);
  const zMove = z && user ? () => battle.actions.getActiveZMove(base, user) : null;

  const maxMove = max && user ? () => activeMaxMove(battle, base.id, user, target) : null;
  const make = zMove ?? maxMove;
  const move = make ? make() : base;
  if (make) moveId = move.id;
  const type = moveType(battle, moveId, user, target, make);
  const info = {
    ...(maxMove ? { id: move.id } : {}),
    type, category: moveCategory(battle, move),
    power: move.category !== 'Status' && move.basePower > 0 ? move.basePower : null,
    accuracy: move.accuracy === true ? null : move.accuracy,
  };
  if (!target || target.fainted || !target.hp) return info;
  const types = target.getTypes();
  const ignore = move.ignoreImmunity ?? move.category === 'Status';
  const ignored = ignore === true || (typeof ignore === 'object' && ignore?.[type]);
  if (!ignored && !battle.dex.getImmunity(type, types)) return { ...info, effectiveness: 0 };
  if (abilityShown(target.m.uid) && abilityStops(sim, battle, moveId, user, target)) return { ...info, effectiveness: 0 };
  if (move.category === 'Status') return info;
  return { ...info, effectiveness: 2 ** battle.dex.getEffectiveness(type, types) };
}

const COPY_SEED = [0, 0, 0, 1];

function abilityStops(sim, battle, moveId, user, target) {
  let copy;
  try { copy = restore(sim, snapshot(battle), COPY_SEED); } catch (error) { if (error?.stage) return false; throw error; }
  try {
    const self = copy.sides[user.side.n].active[user.position], foe = copy.sides[target.side.n].active[target.position];
    const move = copy.dex.getActiveMove(moveId);
    copy.singleEvent('ModifyType', move, null, self, foe, move, move);
    copy.runEvent('ModifyType', self, foe, move, move);
    move.ignoreImmunity ??= move.category === 'Status'; // as hitStepTypeImmunity
    const ignored = move.ignoreImmunity === true || move.ignoreImmunity?.[move.type];
    if (move.type === 'Ground' && !ignored && foe.isGrounded(!copy.runEvent('NegateImmunity', foe, 'Ground')) === null) return true;
    return !copy.singleEvent('TryHit', foe.getAbility(), foe.abilityState, foe, self, move);
  } finally { copy.destroy(); }
}

function moveType(battle, moveId, user, target, make) {
  const move = make ? make() : battle.dex.getActiveMove(moveId);
  if (!user) return move.type;
  battle.singleEvent('ModifyType', move, null, user, target, move, move);
  battle.runEvent('ModifyType', user, target, move, move);
  return move.type;
}
