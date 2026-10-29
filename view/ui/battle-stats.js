// from pokerogue src/ui/battle-info/battle-info.ts @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/ui/battle-info/player-battle-info.ts @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/ui/battle-info/enemy-battle-info.ts @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-10-28. See view/LICENSE-NOTE.md.

import { fixed } from '../game-speed.js';

const PLAYER_ORDER = ['atk', 'def', 'spa', 'spd', 'accuracy', 'evasion', 'spe'];
const ENEMY_ORDER = ['hp', ...PLAYER_ORDER];
const LABEL = { hp: 'HP', atk: 'ATK', def: 'DEF', spa: 'SPATK', spd: 'SPDEF', accuracy: 'ACC', evasion: 'EVA', spe: 'SPD' };

export class BattleStats {
  constructor(scene, info, player) {
    this.scene = scene; this.player = player;
    const { xOffset, paddingX, statOverflow } = player ? { xOffset: 8, paddingX: 4, statOverflow: 1 } : { xOffset: 5, paddingX: 2, statOverflow: 0 };
    this.order = player ? PLAYER_ORDER : ENEMY_ORDER;
    const c = this.container = scene.add.container(0, 0).setAlpha(0);
    this.box = scene.add.sprite(0, 0, player ? 'pbinfo_player_stats' : 'pbinfo_enemy_mini_stats').setOrigin(1, 0.5);
    this.values = scene.add.container();
    c.add([this.box, this.values]);
    this.numbers = [];
    const startingX = -this.box.width + xOffset;
    this.order.forEach((stat, i) => {
      const isHp = stat === 'hp';
      const x = i > statOverflow ? this.numbers[Math.max(i - 2, 0)].x + this.numbers[Math.max(i - 2, 0)].width + paddingX : startingX;
      let y = -this.box.height / 2 + 4;
      if (isHp || stat === 'spe') y += 5;
      else if (player === !!(i % 2)) y += 10;
      const label = scene.add.sprite(x, y, 'pbinfo_stat', LABEL[stat]).setOrigin(0);
      const number = scene.add.sprite(x + label.width, y, 'pbinfo_stat_numbers', isHp ? 'empty' : '0').setOrigin(0);
      if (isHp) { label.setVisible(false); number.setVisible(false); }
      this.values.add([label, number]);
      this.numbers.push(number);
    });

    if (player) this.values.setPosition(8, 7);
    info.container.add(c);
  }

  update(stages = {}) {
    this.order.forEach((stat, i) => {
      if (stat !== 'hp') this.numbers[i].setFrame(String(Math.max(-6, Math.min(6, stages[stat] || 0))));
    });
  }

  toggle(visible) {
    this.scene.tweens.add({ targets: this.container, duration: fixed(125), ease: 'Sine.easeInOut', alpha: visible ? 1 : 0 });
  }
}
