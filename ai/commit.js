const pending = new WeakMap();

// The AI hands over a decision. An earlier one for the same side is discarded (it was never accepted).
export function holdDecision(battle, sideId, apply) {
  let bySide = pending.get(battle);
  if (!bySide) pending.set(battle, bySide = new Map());
  bySide.set(sideId, apply);
}

export function commitChoice(battle, sideId, choice) {
  const bySide = pending.get(battle);
  const apply = bySide?.get(sideId);
  if (!apply) return false;
  bySide.delete(sideId);
  apply(choice);
  return true;
}
