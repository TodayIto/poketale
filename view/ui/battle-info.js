// from pokerogue src/ui/battle-info/battle-info.ts @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-11-22. See view/LICENSE-NOTE.md.
// from pokerogue src/ui/battle-info/player-battle-info.ts @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/ui/battle-info/enemy-battle-info.ts @ 7d7da4a8 (AGPL-3.0-only)
import { addTextObject, addGenderMark, fitName, STATUS_FRAMES, GENDER_COLORS } from './text.js';
import { nameShowsGender } from '../gender-mark.js';
import { tween } from '../lifetime.js';
import { ExpBar, setLevelDisplay } from './exp-bar.js';
import { compactStyle } from '../dynamax-layout.js';
import { compactPicture } from './compact-box.js';
import { themeOf } from './theme.js';
const RED_TINT = 0xff8c9c; // the Dynamaxed Pokemon's compact box (setRed)

export class BattleInfo {

  constructor(scene, player, { mini = false, dx = 0, dy = 0 } = {}) {
    this.scene = scene; this.player = player; this.mini = mini;
    this.baseX = (player ? 310 : 140) + dx; this.baseY = (player ? -72 : -141) + dy;

    const rowY = mini ? -1.5 : 0;
    const p = player
      ? { nameX: -115, nameY: -15.2 + rowY, levelX: -41, levelY: -10 + rowY, hpX: -61, hpY: -1 }
      : { nameX: -124, nameY: -11.2, levelX: -50, levelY: -5, hpX: -71, hpY: 4.5 };
    const c = this.container = scene.add.container(this.baseX, this.baseY).setVisible(false);
    scene.fieldUI.add(c);
    this.box = scene.add.image(0, 0, mini ? 'pbinfo_player_mini' : player ? 'pbinfo_player' : 'pbinfo_enemy_mini').setOrigin(1, 0.5);
    this.nameText = addTextObject(scene, p.nameX, p.nameY, '', 'info');
    this.status = scene.add.image(p.nameX, p.nameY + 11.5, 'statuses', 'paralysis').setOrigin(0).setVisible(false);
    this.levelX = p.levelX;
    this.level = scene.add.container(p.levelX, p.levelY);
    this.hp = scene.add.image(p.hpX, p.hpY, 'overlay_hp', 'high').setOrigin(0);
    const hpLabel = this.hpLabel = scene.add.image(p.hpX - 1, p.hpY - 3, 'overlay_hp_label').setOrigin(1, 0);

    this.numbers = player && !mini ? scene.add.container(-15, 10) : null;
    this.gender = null; // the gender mark after the name (init - view/ui/text.js addGenderMark)
    c.add([this.box, this.nameText, this.status, this.level, this.hp, hpLabel]);
    if (this.numbers) c.add(this.numbers);
    if (player) this.exp = new ExpBar(scene, this); // exp bar (view/ui/exp-bar.js)
    if (mini) { this.exp.label.setVisible(false); this.exp.bar.setVisible(false); }

    this.compact = null;
    this.normalSpots = [this.nameText, this.status, this.level, this.hp, this.hpLabel].map(o => [o, o.x, o.y]);
    this.nameScale = this.nameText.scaleX; this.textScale = 1;
  }

  setCompact(spot) {
    const c = this.container;
    this.compact = spot ? { ...spot } : null;
    if (!spot) {
      this.frame?.setVisible(false);
      if (this.hpHolder) { c.addAt(this.hp, c.getIndex(this.hpHolder)); this.hpHolder.destroy(); this.hpHolder = null; }
      for (const [o, x, y] of this.normalSpots) o.setPosition(x, y);
      this.textScale = 1; this.nameText.setScale(this.nameScale); this.level.setScale(1);
      this.box.setVisible(true); this.numbers?.setVisible(true); this.hpLabel.setVisible(true);
      if (this.exp && !this.mini) { this.exp.label.setVisible(true); this.exp.bar.setVisible(true); }
      if (this.mon) this.layoutName();
      c.setPosition(this.baseX, this.baseY);
      return;
    }

    const s = this.scene, key = this.player ? (s.textures.exists('pbinfo_player_mini') ? 'pbinfo_player_mini' : this.box.texture.key) : this.box.texture.key;
    const L = this.player ? { name: [15, 4.3], level: [89, 9.5], hp: [69, 20] } : { name: [6, 4.3], level: [80, 10.5], hp: [59, 20] };

    const LIFT = 1;
    const style = compactStyle(), k = style.text;
    const pic = compactPicture(s, key, { width: style.width, rowsCut: style.rowsCut, slotX: L.hp[0] + 24 });
    const mx = pic?.mapX ?? (v => v), my = pic?.mapY ?? (v => v);
    if (pic && this.frame?.texture?.key !== pic.key) { this.frame?.destroy(); this.frame = null; }
    if (!this.frame && pic) { this.frame = s.add.image(0, 0, pic.key).setOrigin(0); c.addAt(this.frame, 0); }
    this.frame?.setVisible(true);
    this.setRed(this.red);
    this.box.setVisible(false); this.numbers?.setVisible(false);
    if (this.exp) { this.exp.label.setVisible(false); this.exp.bar.setVisible(false); }

    const [hx, hy] = L.hp, barWidth = mx(hx + this.hp.width) - mx(hx);
    if (!this.hpHolder) { this.hpHolder = s.add.container(0, 0); c.addAt(this.hpHolder, c.getIndex(this.hp)); this.hpHolder.add(this.hp); }
    this.hpHolder.setPosition(mx(hx), my(hy)).setScale(barWidth / this.hp.width, 1);
    this.hp.setPosition(0, 0);
    this.hpLabel.setPosition(mx(hx) - 1, my(hy) - 3).setVisible(!this.mon?.status);

    const digits = String(this.mon?.level ?? 100).length, levelRight = mx(L.level[0] + 5.5 + 24);
    const centre = style.lineCentre ?? my(L.level[1]) - LIFT;
    this.textScale = k; this.nameText.setScale(this.nameScale * k); this.level.setScale(k);
    this.nameText.setPosition(mx(L.name[0]), centre - (L.level[1] - L.name[1]) * k);
    this.level.setPosition(levelRight - (5.5 + 8 * digits) * k, centre);
    this.status.setPosition(mx(L.name[0]), my(L.name[1] + 11.5)); // under the name, as the normal box (the HP label hides for it)
    if (this.mon) this.layoutName();
    c.setPosition(spot.x, spot.y - 180);
  }

  setRed(on) {
    this.red = !!on;
    if (!this.frame) return;
    if (this.red) this.frame.setTint(RED_TINT); else this.frame.clearTint();
  }

  async slideTo(spot, duration, red) {
    const same = (a, b) => (!a && !b) || (a && b && a.x === b.x && a.y === b.y);
    const recolour = () => { if (red !== undefined) this.setRed(red); };
    if (same(spot, this.compact)) { recolour(); return; }
    await this.slideAround(() => { this.setCompact(spot); recolour(); }, duration); // (red changes out of sight, with the size)
  }

  async slideAround(change, duration = 1000) {
    if (!this.container.visible || !duration) { change(); return; }
    const out = this.player ? 150 : -150;
    await tween(this.scene, { targets: this.container, x: this.container.x + out, duration: duration * 0.4, ease: 'Cubic.easeIn' });
    change();
    const x = this.restX;
    this.container.setX(x + out);
    await tween(this.scene, { targets: this.container, x, duration: duration * 0.6, ease: 'Cubic.easeOut' });
  }

  get compactBox() {
    if (!this.compact) return null;
    const { width, height } = this.frame ?? compactStyle();
    return { x: this.compact.x, y: this.compact.y, width, height };
  }
  /** Where the box rests (x): its normal spot or the compact corner */
  get restX() { return this.compact ? this.compact.x : this.baseX; }

  get restY() { return this.compact ? this.compact.y - 180 : this.baseY; }
  init(mon) {
    this.mon = { ...mon };
    const compact = this.compact;
    // The EXP bar sets the player's final level display, including the level-cap color.
    if (this.exp) this.exp.set(mon.level, mon.exp ?? 0);
    else setLevelDisplay(this, mon.level);
    this.hp.scaleX = this.hpScale(mon.hp, mon.maxhp);
    this.updateHpFrame(); this.setHpNumbers(mon.hp, mon.maxhp); this.setStatus(mon.status);
    this.scene.tera?.applyInfo(this, mon.tera); // tera icon (view/tera.js)
    this.layoutName();
    if (compact) this.setCompact(compact); // the level's width may have changed
  }

  layoutName() {
    const { scene, nameText, mon } = this;
    const lv = this.level.list[0];
    const room = lv.x + this.level.x - lv.displayWidth * lv.originX - nameText.x; // name start -> "Lv" label
    const tera = this.teraIcon?.visible ? this.teraIcon.displayWidth : 0;
    const theme = themeOf(scene), previous = this.gender;
    const reuse = previous?.scene && this.genderType === mon.gender && this.genderTheme === theme ? previous : null;
    if (!reuse) previous?.destroy();
    const mark = addGenderMark(scene, 0, nameText.y + 2, mon.gender, 'info', { color: GENDER_COLORS[mon.gender]?.[0], reuse });

    const k = this.textScale ?? 1;
    if (mark && k !== 1) { const bottom = mark.y + mark.height - nameText.y; mark.setScale(k); mark.y = nameText.y + bottom * k - mark.height * k; }
    else if (reuse) reuse.setScale(1);
    const markWidth = (mark?.width ?? 0) * k;
    const fit = width => fitName(nameText, mon.name, room - tera - width - (width || tera ? 1 : 0));

    let shown = nameShowsGender(mon.name) ? fit(0) : '';
    if (!nameShowsGender(shown)) shown = fit(markWidth);
    this.gender = mark && !nameShowsGender(shown) ? mark : null;
    if (mark && !this.gender) mark.destroy();
    const right = nameText.x + nameText.displayWidth;
    if (this.gender) {
      mark.setX(Math.floor(right + 1));
      this.genderType = mon.gender; this.genderTheme = theme;
      if (!reuse) this.container.add(mark);
      // The old layout appended a new mark even when Tera had just added its icon.
      else if (this.container.list.at(-1) !== mark) this.container.bringToTop(mark);
    }
    this.teraIcon?.setPosition(right + (this.gender ? markWidth : 0) + 1, nameText.y + 2);
  }

  hpScale(hp, maxhp) {
    const ratio = Math.max(0, Math.min(1, hp / maxhp));
    return hp > 0 ? Math.max(ratio, 1 / this.hp.width) : ratio;
  }

  setHpNumbers(hp, maxhp) {
    const numbers = this.numbers;
    // The bar can keep moving between changes to the displayed integer HP.
    if (!numbers || (this.shownHp === hp && this.shownMaxHp === maxhp)) return;
    const text = `${hp}/${maxhp}`, list = numbers.list;
    for (let i = 0; i < text.length; i++) {
      const char = text[text.length - 1 - i], digit = list[i];
      if (!digit) { numbers.add(this.scene.add.image(-i * 8, 0, 'numbers', char)); continue; }
      if (digit.texture.key !== 'numbers' || digit.frame.name !== char) digit.setTexture('numbers', char);
      if (digit.x !== -i * 8 || digit.y !== 0) digit.setPosition(-i * 8, 0);
    }
    while (list.length > text.length) numbers.remove(list[list.length - 1], true);
    this.shownHp = hp;
    this.shownMaxHp = maxhp;
  }
  updateHpFrame() {
    const frame = this.hp.scaleX > 0.5 ? 'high' : this.hp.scaleX > 0.25 ? 'medium' : 'low';
    if (this.hp.frame.name !== frame) this.hp.setFrame(frame);
  }
  async hpChange(hp, maxhp) {
    const duration = Math.max(250, Math.min(5000, Math.abs(this.mon.hp - hp) * 5));

    const [from, to, start] = [this.hp.scaleX, this.hpScale(hp, maxhp), this.mon.hp];
    await tween(this.scene, { targets: this.hp, scaleX: to, duration, ease: 'Sine.easeOut',
      onUpdate: () => { this.updateHpFrame(); if (this.numbers) this.setHpNumbers(to === from ? hp : Math.ceil(start + (hp - start) * (this.hp.scaleX - from) / (to - from)), maxhp); } });
    this.mon.hp = hp; this.mon.maxhp = maxhp;
    this.setHpNumbers(hp, maxhp); this.updateHpFrame();
  }
  setStatus(status) {
    this.mon.status = status;
    this.status.setVisible(!!status);
    if (status) this.status.setFrame(STATUS_FRAMES[status]);
    if (this.compact) this.hpLabel.setVisible(!status); // compact: the status sits where the HP label was
  }

  place({ dx = 0, dy = 0, mini = this.mini } = {}) {
    if (mini !== this.mini) throw new Error('An info box keeps its size when it moves');
    const x = (this.player ? 310 : 140) + dx, y = (this.player ? -72 : -141) + dy;
    if (this.compact) { this.baseX = x; this.baseY = y; return; } // the Dynamax layout places compact boxes (view/dynamax.js)
    this.container.setPosition(this.container.x + x - this.baseX, this.container.y + y - this.baseY);
    this.baseX = x; this.baseY = y;
  }
  async show() {
    const c = this.container;
    c.setX(this.restX + (this.player ? 150 : -150)).setVisible(true);
    await tween(this.scene, { targets: c, x: this.restX, duration: 1000, ease: 'Cubic.easeOut' });
  }
  async hide() {
    if (!this.container.visible) return;
    await tween(this.scene, { targets: this.container, x: this.restX + (this.player ? 150 : -150), duration: 500, ease: 'Cubic.easeIn' });
    this.container.setVisible(false).setX(this.restX);
  }
  destroy() { this.exp?.destroy(); this.container.destroy(); }
}
