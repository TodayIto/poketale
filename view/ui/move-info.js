// from pokerogue src/ui/containers/move-info-overlay.ts @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-11-05. See view/LICENSE-NOTE.md.
// Move details shown beside the move reminder list.

import { addWindow } from './window.js';
import { addTextObject, styledText } from './text.js';
import { fixed } from '../game-speed.js';

const EFF_HEIGHT = 48, EFF_WIDTH = 82, DESC_HEIGHT = 48, BORDER = 8, GLOBAL_SCALE = 6;

const SCREEN_HEIGHT = 180;

export class MoveInfoOverlay {

  constructor(scene, { x = 1, y = -(EFF_HEIGHT + DESC_HEIGHT) - 1, width = 320 / 2 - 30 } = {}) {
    const s = this.scene = scene;
    const c = this.container = s.add.container(x, y);
    this.box = { x, y, width, height: EFF_HEIGHT + DESC_HEIGHT };
    this.descY = EFF_HEIGHT + BORDER - 2;
    c.add(addWindow(s, 0, EFF_HEIGHT, width, DESC_HEIGHT));
    this.desc = addTextObject(s, BORDER, this.descY, '', 'info', { wordWrap: { width: (width - (BORDER - 2) * 2) * GLOBAL_SCALE } });
    this.maskShape = s.make.graphics({ add: false }).setScale(GLOBAL_SCALE).fillStyle(0xff0000)
      .fillRect(x + BORDER, SCREEN_HEIGHT + y + EFF_HEIGHT + BORDER - 2, width + BORDER * 2, DESC_HEIGHT - (BORDER - 2) * 2);
    this.desc.setMask(this.maskShape.createGeometryMask());
    c.add(this.desc);
    const val = s.add.container(0, 0);
    c.add(val);
    val.add(addWindow(s, 0, 0, EFF_WIDTH, EFF_HEIGHT));
    this.typ = s.add.sprite(25, EFF_HEIGHT - 35, 'types', 'unknown').setScale(0.8);
    this.cat = s.add.sprite(57, EFF_HEIGHT - 35, 'categories', 'physical');

    const row = (y, label) => {
      val.add(styledText(s, 12, y, label, 'MOVE_INFO_CONTENT').setOrigin(0, 0.5));
      const value = styledText(s, 70, y, '---', 'MOVE_INFO_CONTENT').setOrigin(1, 0.5);
      val.add(value);
      return value;
    };
    val.add([this.typ, this.cat]);
    this.pp = row(EFF_HEIGHT - 25, s.words('fight-ui-handler.pp'));
    this.pow = row(EFF_HEIGHT - 17, s.words('fight-ui-handler.power'));
    this.acc = row(EFF_HEIGHT - 9, s.words('fight-ui-handler.accuracy'));
    c.setVisible(false);
  }

  show(move) {
    this.pow.setText(move.power ? String(move.power) : '---');
    this.acc.setText(move.accuracy ? String(move.accuracy) : '---');
    this.pp.setText(String(move.maxpp));
    this.typ.setFrame(String(move.type).toLowerCase());
    this.cat.setFrame(String(move.category).toLowerCase());
    this.desc.setText(move.description ?? '');
    this.scroll?.remove(); this.scroll = null;
    this.desc.y = this.descY;

    const lines = Math.floor((this.desc.displayHeight * (96 / 72)) / 14.83);
    if (lines > 3) {
      this.scroll = this.scene.tweens.add({ targets: this.desc, delay: fixed(2000), loop: -1, hold: fixed(2000),
        duration: fixed((lines - 3) * 2000), y: `-=${14.83 * (72 / 96) * (lines - 3)}` });
    }
    this.container.setVisible(true);
  }

  clear() {
    this.scroll?.remove(); this.scroll = null;
    this.container.setVisible(false);
  }

  destroy() {
    this.clear();
    this.desc.clearMask(true); this.maskShape.destroy();
    this.container.destroy();
  }
}
