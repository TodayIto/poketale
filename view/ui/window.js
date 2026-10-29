// from pokerogue src/ui/ui-theme.ts @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-10-28. See view/LICENSE-NOTE.md.
import { windowBorder } from './theme.js';

export const WINDOW_VARIANT_IMAGES = {
  window_1_thin: 'images/ui/windows/window_1_thin.png', window_1_xthin: 'images/ui/windows/window_1_xthin.png',
};
export function addWindow(scene, x, y, width, height, variant) {
  const border = windowBorder(scene);
  const key = variant ? `window_1_${variant}` : 'window_1';
  return scene.add.nineslice(x, y, key, undefined, width, height, border, border, border, border).setOrigin(0);
}
