import { positionOfMon } from './read.js';

const CHOSEN = new Set(['normal', 'any', 'adjacentAlly', 'adjacentAllyOrSelf', 'adjacentFoe']);

// Target types that hit several Pokemon at once (the target screen shows them all to confirm)
const SPREAD = new Set(['allAdjacentFoes', 'allAdjacent', 'all', 'allySide', 'foeSide', 'allies', 'allyTeam']);

export function moveTargets(battle, user, targetType) {
  const standing = loc => { const p = user.getAtLoc(loc); return p && !p.fainted ? p : null; };
  const locs = [];
  for (let i = 1; i <= battle.activePerHalf; i++) locs.push(i, -i);
  const target = loc => ({ loc, position: positionOfMon(user.getAtLoc(loc)), ally: loc < 0 });
  if (CHOSEN.has(targetType)) {

    const valid = locs.filter(loc => user.getAtLoc(loc) && battle.validTargetLoc(loc, user, targetType));
    const live = valid.filter(standing);
    return { choose: true, spread: false, targets: (live.length ? live : valid).map(target) };
  }
  if (SPREAD.has(targetType)) {

    const hit = loc => (targetType === 'allAdjacentFoes' ? loc > 0 && battle.validTargetLoc(loc, user, 'adjacentFoe')
      : targetType === 'allAdjacent' ? battle.validTargetLoc(loc, user, loc > 0 ? 'adjacentFoe' : 'adjacentAlly')
        : targetType === 'foeSide' ? loc > 0
          : targetType === 'all' ? true
            : loc < 0);
    return { choose: false, spread: true, targets: locs.filter(loc => standing(loc) && hit(loc)).map(target) };
  }
  return { choose: false, spread: false, targets: [{ loc: user.getLocOf(user), position: positionOfMon(user), ally: true }] };
}
