// from pokerogue src/ui/battle-info/battle-info.ts @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/ui/battle-info/player-battle-info.ts @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/ui/battle-info/enemy-battle-info.ts @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-10-28. See view/LICENSE-NOTE.md.
import { addTextObject, STATUS_FRAMES, GENDER_COLORS, genderSymbol } from './text.js';
import { tween } from '../lifetime.js';
import { ExpBar } from './exp-bar.js';

export class BattleInfo {
  constructor(scene, player) {
    this.scene = scene; this.player = player;
    this.baseX = player ? 310 : 140;
    const p = player
      ? { nameX: -115, nameY: -15.2, levelX: -41, levelY: -10, hpX: -61, hpY: -1 }
      : { nameX: -124, nameY: -11.2, levelX: -50, levelY: -5, hpX: -71, hpY: 4.5 };
    const c = this.container = scene.add.container(this.baseX, player ? -72 : -141).setVisible(false);
    scene.fieldUI.add(c);
    this.box = scene.add.sprite(0, 0, player ? 'pbinfo_player' : 'pbinfo_enemy_mini').setOrigin(1, 0.5);
    this.nameText = addTextObject(scene, p.nameX, p.nameY, '', 'info');
    this.genderText = addTextObject(scene, 0, p.nameY + 2, '', 'info');
    this.status = scene.add.sprite(p.nameX, p.nameY + 11.5, 'statuses', 'paralysis').setOrigin(0).setVisible(false);
    this.levelX = p.levelX;
    this.level = scene.add.container(p.levelX, p.levelY);
    this.hp = scene.add.image(p.hpX, p.hpY, 'overlay_hp', 'high').setOrigin(0);
    const hpLabel = scene.add.image(p.hpX - 1, p.hpY - 3, 'overlay_hp_label').setOrigin(1, 0);
    this.numbers = scene.add.container(-15, 10).setVisible(player);
    c.add([this.box, this.nameText, this.genderText, this.status, this.level, this.hp, hpLabel, this.numbers]);
    if (player) this.exp = new ExpBar(scene, this);

  }
  init(mon) {
    this.mon = { ...mon };
    this.nameText.setScale(1 / 6).setText(mon.name);

    if (this.nameText.displayWidth > 74) this.nameText.setScale((1 / 6) * 74 / this.nameText.displayWidth);
    this.genderText.setPosition(this.nameText.x + this.nameText.displayWidth + 1, this.nameText.y + 2)
      .setText(genderSymbol(mon.gender))
      .setColor((GENDER_COLORS[mon.gender] ?? GENDER_COLORS.F)[0]);
    this.level.removeAll(true);
    this.level.add(this.scene.add.image(5.5, 0, 'overlay_lv').setOrigin(1, 0.5));

    const digits = String(mon.level);
    const numbers = this.scene.add.container(9.5, -0.5);
    [...digits].forEach((char, i) => numbers.add(this.scene.add.image(i * 8, 0, 'numbers', char)));
    this.level.add(numbers);
    this.level.setX(this.levelX - 8 * Math.max(digits.length - 3, 0));
    this.hp.scaleX = Math.max(0, Math.min(1, mon.hp / mon.maxhp));
    this.updateHpFrame(); this.setHpNumbers(mon.hp, mon.maxhp); this.setStatus(mon.status);
    this.scene.tera?.applyInfo(this, mon.tera);
    this.exp?.set(mon.level, mon.exp ?? 0);
  }
  setHpNumbers(hp, maxhp) {
    this.numbers.removeAll(true);
    [...`${hp}/${maxhp}`].reverse().forEach((char, i) => this.numbers.add(this.scene.add.image(-i * 8, 0, 'numbers', char)));
  }
  updateHpFrame() { this.hp.setFrame(this.hp.scaleX > 0.5 ? 'high' : this.hp.scaleX > 0.25 ? 'medium' : 'low'); }
  async hpChange(hp, maxhp) {
    const duration = Math.max(250, Math.min(5000, Math.abs(this.mon.hp - hp) * 5));
    await tween(this.scene, { targets: this.hp, scaleX: Math.max(0, Math.min(1, hp / maxhp)), duration, ease: 'Sine.easeOut',
      onUpdate: () => { this.updateHpFrame(); if (this.player) this.setHpNumbers(Math.ceil(this.hp.scaleX * maxhp), maxhp); } });
    this.mon.hp = hp; this.mon.maxhp = maxhp;
    this.setHpNumbers(hp, maxhp); this.updateHpFrame();
  }
  setStatus(status) {
    this.mon.status = status;
    this.status.setVisible(!!status);
    if (status) this.status.setFrame(STATUS_FRAMES[status]);
  }
  async show() {
    const c = this.container;
    c.setX(this.baseX + (this.player ? 150 : -150)).setVisible(true);
    await tween(this.scene, { targets: c, x: this.baseX, duration: 1000, ease: 'Cubic.easeOut' });
  }
  async hide() {
    if (!this.container.visible) return;
    await tween(this.scene, { targets: this.container, x: this.baseX + (this.player ? 150 : -150), duration: 500, ease: 'Cubic.easeIn' });
    this.container.setVisible(false).setX(this.baseX);
  }
  destroy() { this.exp?.destroy(); this.container.destroy(); }
}
