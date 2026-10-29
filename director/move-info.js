export function moveMenuInfo(battle, moveId, target) {
  const move = battle.dex.moves.get(moveId);
  const info = {
    power: move.category !== 'Status' && move.basePower > 0 ? move.basePower : null,
    accuracy: move.accuracy === true ? null : move.accuracy,
  };
  if (!target || target.fainted || !target.hp) return info;
  const types = target.getTypes();
  const ignore = move.ignoreImmunity ?? move.category === 'Status';
  const ignored = ignore === true || (typeof ignore === 'object' && ignore?.[move.type]);
  if (!ignored && !battle.dex.getImmunity(move.type, types)) return { ...info, effectiveness: 0 };
  if (move.category === 'Status') return info;
  return { ...info, effectiveness: 2 ** battle.dex.getEffectiveness(move.type, types) };
}
