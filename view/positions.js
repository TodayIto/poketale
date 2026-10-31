// from pokerogue src/field/pokemon.ts (getFieldPositionOffset) @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/ui/battle-info/battle-info.ts (setOffset) @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/ui/battle-info/player-battle-info.ts (setMini) @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-10-30. See view/LICENSE-NOTE.md.

export const POSITIONS = Object.freeze(['player', 'player2', 'enemy', 'enemy2']);
const SINGLE = Object.freeze(['player', 'enemy']);

// Front-to-back drawing order in a double battle: later entries are drawn on top
export const DRAW_ORDER = Object.freeze(['enemy', 'enemy2', 'player', 'player2']);

export const teamOf = position => (position === 'player' || position === 'player2' ? 'player' : 'enemy');
export const isPlayerSide = position => teamOf(position) === 'player';

export const allyOf = position => ({ player: 'player2', player2: 'player', enemy: 'enemy2', enemy2: 'enemy' })[position];

export const fieldPositions = double => (double ? POSITIONS : SINGLE);
export function checkPosition(double, position) {
  if (!fieldPositions(double).includes(position)) throw new Error(`Invalid side: ${position}`);
  return position;
}

const LEFT = Object.freeze([-32, -8]), RIGHT = Object.freeze([32, 0]), CENTER = Object.freeze([0, 0]);

export function fieldOffset(double, position) {
  if (!double) return CENTER;
  return position === 'player2' || position === 'enemy2' ? RIGHT : LEFT;
}

export function infoLayout(double, position) {
  if (!double) return { mini: false, dx: 0, dy: 0 };
  const player = isPlayerSide(position), right = position === 'player2' || position === 'enemy2';
  return { mini: player, dx: right ? (player ? 10 : -10) : 0, dy: (player ? -12 : 0) + (right ? 27 : 0) };
}

export function firstOnSide(scene, team) {
  for (const position of POSITIONS) if (teamOf(position) === team && scene.pokemon[position]) return scene.pokemon[position];
  return null;
}
