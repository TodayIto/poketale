export const isReviving = request => !!request?.forceSwitch && !!request.side?.pokemon?.some(p => p.active && p.reviving);

export function simpleAI(battle, sideId) {
  const side = battle.getSide(sideId);
  const request = side.activeRequest;

  if (request?.forceSwitch) {
    const reviving = isReviving(request);
    const index = request.side.pokemon.findIndex(p => !p.active && / fnt$/.test(p.condition) === reviving);
    if (index < 0) throw new Error(`${sideId}: no Pokemon to switch in`);
    return `switch ${index + 1}`;
  }
  const pokemon = side.active[0];
  const target = side.foe.active[0];
  const moves = request?.active?.[0]?.moves;
  if (!moves?.length) throw new Error(`${sideId}: no move request`);
  let best = -1, bestScore = -Infinity;
  moves.forEach((option, index) => {
    if (option.disabled || option.pp === 0) return;
    const move = battle.dex.moves.get(option.id);
    const matchup = battle.dex.getImmunity(move.type, target) ? 2 ** battle.dex.getEffectiveness(move.type, target) : 0;
    const score = move.basePower * matchup * (pokemon.hasType(move.type) ? 1.5 : 1);
    if (score > bestScore) { best = index; bestScore = score; }
  });
  if (best < 0) throw new Error(`${sideId}: no usable move in request`);
  return `move ${best + 1}`;
}
