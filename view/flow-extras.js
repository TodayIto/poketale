// from pokerogue src/phases/battle-phase.ts (showEnemyTrainer) @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/phases/attempt-capture-phase.ts (hideInfo after the catch is confirmed) @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-10-30. See view/LICENSE-NOTE.md.

import { tween, delay } from './lifetime.js';
import { checkPosition } from './positions.js';

export async function showTrainer(scene) {
  const trainer = scene.encounter?.enemyTrainer;
  if (!trainer || trainer.container.visible) return;
  const { container, sprite, tintSprite } = trainer;
  sprite.setVisible(true).clearTint(); tintSprite.setVisible(false).clearTint();
  container.setVisible(true).setAlpha(0);
  await tween(scene, { targets: container, x: '-=16', y: '+=16', alpha: 1, ease: 'Sine.easeInOut', duration: 750 });
}

export async function hideInfo(scene, side) {
  checkPosition(scene.double, side);
  await scene.info[side]?.hide();
}

export async function pause(scene, ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) throw new TypeError(`Invalid pause: ${ms}`);
  if (ms) await delay(scene, ms);
}
