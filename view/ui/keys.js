// from pokerogue src/configs/inputs/cfg-keyboard-qwerty.ts @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/ui/ui.ts (playSelect / playError) @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-10-28. See view/LICENSE-NOTE.md.

const KEYS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', W: 'up', s: 'down', S: 'down', a: 'left', A: 'left', d: 'right', D: 'right',
  ' ': 'ok', Spacebar: 'ok', Enter: 'ok', z: 'ok', Z: 'ok',
  Backspace: 'back', Escape: 'back', x: 'back', X: 'back',
};
const CODES = {
  KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right', Space: 'ok', KeyZ: 'ok', KeyX: 'back',
};

// Key event -> 'up' | 'down' | 'left' | 'right' | 'ok' | 'back' | null
export function keyAction(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  return KEYS[e.key] ?? CODES[e.code] ?? null;
}

export function playSelect(scene) { scene?.audio?.playUi?.('select'); }
export function playError(scene) { scene?.audio?.playUi?.('error'); }
