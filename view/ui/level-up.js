// from pokerogue src/ui/handlers/battle-message-ui-handler.ts (levelUpStatsContainer, promptLevelUpStats) @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-10-30. See view/LICENSE-NOTE.md.

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
  build() {
    const s = this.scene;
    const c = this.container = s.add.container(0, 0).setVisible(false);

    const labels = windowText(s, 320 - 73, -94, STAT_ROWS.map(([, name]) => s.words(name)).join('\n'));
    labels.x -= labels.displayWidth;
    const width = 80 + labels.displayWidth;
    this.bg = addWindow(s, 320 - width, -100, width, 100);
    this.incr = windowText(s, 320 - 50, -94, '+\n+\n+\n+\n+\n+');

    this.values = windowText(s, 320 - 7, -94, '', { align: 'right' }).setOrigin(1, 0);
    c.add([this.bg, labels, this.incr, this.values]);
    s.ui.add(c);
  }

  async show({ prev, next }) {
    if (!this.container) this.build();
    this.scene.ui.bringToTop(this.container);
    for (const totals of [false, true]) {
      this.values.setText(STAT_ROWS.map(([stat]) => String(totals ? next[stat] : next[stat] - (prev?.[stat] ?? next[stat]))).join('\n'));
      this.incr.setVisible(!totals);
      this.container.setVisible(true);
      await waitForAction(this.scene);
    }
    this.container.setVisible(false);
  }
  destroy() { this.container?.destroy(); this.container = null; }
}
