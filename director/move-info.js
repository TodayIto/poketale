export function moveMenuInfo(battle, moveId, user, target) {
  const move = battle.dex.moves.get(moveId);
  const type = moveType(battle, moveId, user, target);
  const info = {
    type, category: move.category,
    power: move.category !== 'Status' && move.basePower > 0 ? move.basePower : null,
    accuracy: move.accuracy === true ? null : move.accuracy,
  };
  if (!target || target.fainted || !target.hp) return info;
  const types = target.getTypes();
  const ignore = move.ignoreImmunity ?? move.category === 'Status';
  const ignored = ignore === true || (typeof ignore === 'object' && ignore?.[type]);
  if (!ignored && !battle.dex.getImmunity(type, types)) return { ...info, effectiveness: 0 };
  if (move.category === 'Status') return info;
  return { ...info, effectiveness: 2 ** battle.dex.getEffectiveness(type, types) };
}

function moveType(battle, moveId, user, target) {
  const move = battle.dex.getActiveMove(moveId);
  if (!user) return move.type;
  battle.singleEvent('ModifyType', move, null, user, target, move, move);
  battle.runEvent('ModifyType', user, target, move, move);
  return move.type;
}
