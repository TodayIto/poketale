// from pokerogue src/ui/handlers/battle-message-ui-handler.ts (levelUpStatsContainer, promptLevelUpStats) @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-11-16. See view/LICENSE-NOTE.md.

import { addWindow } from './window.js';
import { windowText as baseWindowText, STAT_ROWS } from './text.js';
import { playSelect } from './keys.js';
import { focusStage } from './message.js';

// TextStyle.WINDOW (theme colours), up to six lines
const windowText = (scene, x, y, str, extra = {}) => baseWindowText(scene, x, y, str, { maxLines: 6, ...extra });

export function waitForAction(scene) {
  focusStage(scene.options?.parent);
  return new Promise(resolve => {
    scene.messages.advance = () => { scene.messages.advance = null; playSelect(scene); resolve(); };
  });
}

export class LevelUpStats {
  constructor(scene) { this.scene = scene; }
  build(rows) {
    const s = this.scene;
    const c = this.container = s.add.container(0, 0).setVisible(false);

    const labels = windowText(s, 320 - 73, -94, rows.map(([, label]) => label).join('\n'));
    labels.x -= labels.displayWidth;
    const width = 80 + labels.displayWidth;
    this.bg = addWindow(s, 320 - width, -100, width, 100);
    this.incr = windowText(s, 320 - 50, -94, rows.map(() => '+').join('\n'));

    this.values = windowText(s, 320 - 7, -94, '', { align: 'right' }).setOrigin(1, 0);
    c.add([this.bg, labels, this.incr, this.values]);
    s.ui.add(c);
  }

  // special: generation 1's Special label; that generation shows one Special row in place of the two (director/summary.js)
  async show({ prev, next, special = null }) {
    const rows = (special ? STAT_ROWS.filter(([stat]) => stat !== 'spd') : STAT_ROWS).map(([stat, name]) => [stat, special && stat === 'spa' ? special : this.scene.words(name)]);
    const key = rows.map(([, label]) => label).join('|');
    if (this.container && this.key !== key) { this.container.destroy(); this.container = null; }
    if (!this.container) { this.build(rows); this.key = key; this.rows = rows; }
    this.scene.ui.bringToTop(this.container);
    for (const totals of [false, true]) {
      this.values.setText(this.rows.map(([stat]) => String(totals ? next[stat] : next[stat] - (prev?.[stat] ?? next[stat]))).join('\n'));
      this.incr.setVisible(!totals);
      this.container.setVisible(true);
      await waitForAction(this.scene);
    }
    this.container.setVisible(false);
  }
  destroy() { this.container?.destroy(); this.container = null; }
}
