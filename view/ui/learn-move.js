// from pokerogue src/ui/handlers/base-option-select-ui-handler.ts @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/ui/handlers/confirm-ui-handler.ts @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/ui/handlers/summary-ui-handler.ts (SummaryUiMode.LEARN_MOVE, Page.MOVES) @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/ui/text.ts (SUMMARY*, WINDOW*, colours) @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/ui/ui.ts (fadeOut/fadeIn transition) @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-10-28. See view/LICENSE-NOTE.md.

import { addWindow } from './window.js';
import { placeSprite } from '../sprites/placement.js';
import { tween, delay } from '../lifetime.js';
import { fixed } from '../game-speed.js';
import { uiRect } from './tap-back.js';
import { playSelect, playError } from './keys.js';
import { openMenu } from './menu.js';
import { styledText, pad2, STATUS_FRAMES, GENDER_COLORS, genderSymbol } from './text.js';

export const LEARN_MOVE_IMAGES = {
  summary_bg: 'images/ui/summary_bg.png', summary_moves: 'images/ui/summary_moves.png',
  summary_moves_effect: 'images/ui/summary_moves_effect.png', summary_moves_overlay_row: 'images/ui/summary_moves_overlay_row.png',
  summary_moves_cursor: 'images/ui/summary_moves_cursor.png', summary_status: 'images/ui/summary_status.png',
  summary_tabs_3: 'images/ui/text_images/ko/summary/summary_tabs_3_ko.png',
  summary_dexnb_label: 'images/ui/text_images/ko/summary/summary_dexnb_label_ko.png',
  summary_moves_moves_title: 'images/ui/text_images/ko/summary/summary_moves_moves_title_ko.png',
  summary_moves_descriptions_title: 'images/ui/text_images/ko/summary/summary_moves_descriptions_title_ko.png',
  summary_moves_effect_title: 'images/ui/text_images/ko/summary/summary_moves_effect_title_ko.png',
  summary_moves_overlay_pp: 'images/ui/text_images/ko/summary/summary_moves_overlay_pp_ko.png',
};

export const TEXT = { yes: '예', no: '아니오', pokemonInfo: '스테이터스', status: '상태 이상', powerAccuracyCategory: '위력\n명중\n분류', lv: '',
  cancel: '그만둔다' };

export async function fadeSwap(scene, swap) {
  const overlay = scene.add.rectangle(0, -180, 320, 180, 0).setOrigin(0).setAlpha(0);
  scene.ui.add(overlay);
  try {
    await tween(scene, { targets: overlay, alpha: 1, duration: 250, ease: 'Sine.easeOut' });
    await delay(scene, 100);
    await swap();
    scene.ui.bringToTop(overlay);
    await tween(scene, { targets: overlay, alpha: 0, duration: 250, ease: 'Sine.easeIn' });
  } finally { overlay.destroy(); }
}

export class ConfirmMenu {
  constructor(scene) { this.scene = scene; }
  choose() {
    if (this.finish) throw new Error('Confirm menu already open');
    const s = this.scene;
    const options = [TEXT.yes, TEXT.no];

    const text = styledText(s, 0, 0, options.join('\n'), 'WINDOW', { lineSpacing: 12 }).setOrigin(0);
    const width = text.displayWidth + 23, height = (options.length + 1) * 16 - 2;
    const left = 319 - width, top = -48 - height;
    const c = this.container = s.add.container(0, 0);
    text.setPosition(left + 15, top + 7);
    this.cursorObj = s.add.image(0, 0, 'cursor');
    c.add([addWindow(s, left, top, width, height), text, this.cursorObj]);
    options.forEach((_, i) => {
      const hit = s.add.rectangle(left + 4, top + 7 + 16 * i, width - 8, 16, 0, 0).setOrigin(0).setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => this.setCursor(i));
      hit.on('pointerdown', () => { this.setCursor(i); this.input('ok'); });
      c.add(hit);
    });
    this.left = left; this.top = top; this.count = options.length;
    this.rect = uiRect(left, top, width, height);
    s.ui.add(c);
    this.setCursor(0);
    const menu = openMenu(s, { input: action => this.input(action), tapWindows: () => this.windows(),
      close: () => { c.destroy(); this.container = null; this.finish = null; } });
    this.finish = menu.finish;
    return menu.promise;
  }
  setCursor(i) { this.cursor = i; this.cursorObj.setPosition(this.left + 10, this.top + 17 + i * 16 - 2); }

  // Tapping inside this window is not back
  windows() { return this.rect ? [this.rect] : []; }

  input(action) {
    if (!this.finish) return;
    const before = this.cursor;
    if (action === 'up') this.setCursor(this.cursor ? this.cursor - 1 : this.count - 1);
    else if (action === 'down') this.setCursor(this.cursor < this.count - 1 ? this.cursor + 1 : 0);
    else if (action === 'ok') { playSelect(this.scene); this.finish(this.cursor === 0); }
    else if (action === 'back') { playSelect(this.scene); this.finish(false); }
    if (this.finish && this.cursor !== before) playSelect(this.scene);
  }
  destroy() { this.container?.destroy(); }
}

export class LearnMoveSummary {
  constructor(scene) { this.scene = scene; }
  async choose({ mon, moves, newMove }) {
    if (this.finish) throw new Error('Learn move screen already open');
    const s = this.scene;
    const asset = await s.assets.mon(mon, false);
    s.life.check();
    this.moves = moves; this.newMove = newMove;
    await fadeSwap(s, () => this.build(mon, asset));
    s.audio.cry(mon).catch(() => {});
    const menu = openMenu(s, { input: action => this.input(action), close: () => { this.finish = null; } });
    this.finish = menu.finish;
    let slot;
    try { slot = await menu.promise; } catch (error) { this.clear(); throw error; }
    await fadeSwap(s, () => this.clear());
    return slot;
  }
  build(mon, asset) {
    const s = this.scene;
    const c = this.container = s.add.container(0, 0);
    s.ui.add(c);
    c.add(s.add.image(0, 0, 'summary_bg').setOrigin(0, 1));
    c.add(s.add.image(81, -180 + 16, 'summary_tabs_3').setOrigin(0, 1));
    c.add(styledText(s, 4, -165, TEXT.pokemonInfo, 'SUMMARY_HEADER').setOrigin(0, 1));
    c.add(s.add.image(6, -151, 'summary_dexnb_label').setOrigin(0, 1));
    c.add(styledText(s, 41, -149, String(mon.dexNumber ?? 0).padStart(4, '0'), 'SUMMARY_DEX_NUM').setOrigin(1, 1));

    const place = placeSprite(asset, 'enemy');
    const body = asset.bounds;
    const sprite = s.add.sprite(56, -106, asset.key, asset.frame)
      .setOrigin(place.originX, (body.top + body.bottom) / 2 / asset.height).setScale(place.scale);
    if (s.anims.exists(asset.key)) sprite.play(asset.key);
    c.add(sprite);
    const name = styledText(s, 6, -53, mon.name, 'SUMMARY').setOrigin(0, 0);
    c.add([name, s.add.sprite(6, -19, 'pb', 'pb').setOrigin(0, 1),
      styledText(s, 24, -17, `${TEXT.lv}${mon.level}`, 'SUMMARY_ALT').setOrigin(0, 1)]);
    if (GENDER_COLORS[mon.gender]) c.add(styledText(s, 96, -17, genderSymbol(mon.gender), mon.gender === 'M' ? 'SUMMARY_BLUE' : 'SUMMARY_PINK').setOrigin(0, 1));

    if (STATUS_FRAMES[mon.status]) {
      const status = s.add.container(-106, -16);
      status.add([s.add.image(0, 0, 'summary_status').setOrigin(0), styledText(s, 3, 0, TEXT.status, 'SUMMARY').setOrigin(0),
        s.add.sprite(91, 4, 'statuses', STATUS_FRAMES[mon.status]).setOrigin(0.5, 0)]);
      c.add(status);
      s.tweens.add({ targets: status, x: 0, duration: 250, ease: 'Sine.easeOut' });
    }

    const fx = buildMoveEffect(s, 6);
    c.add(fx.container);
    this.details = new MoveDetails(s, fx);

    const page = s.add.container(106, 0);
    page.add(s.add.image(0, 0, 'summary_moves').setOrigin(0, 1));
    c.add(page);
    const refs = buildMovesPage(s, page, { moves: this.moves, newMove: this.newMove });
    this.list = refs.list;
    this.details.attach(refs);
    for (let m = 0; m <= 4; m++) {
      const hit = s.add.rectangle(-2, 16 * m - 15, 211, 16, 0, 0).setOrigin(0).setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => this.setCursor(m));
      hit.on('pointerdown', () => { this.setCursor(m); this.input('ok'); });
      this.list.add(hit);
    }
    this.setCursor(4);
  }
  selected() { return this.cursor < 4 ? this.moves[this.cursor] : this.newMove; }
  setCursor(cursor) {
    if (!this.list) return;
    this.cursor = cursor;
    this.details.select(cursor, this.selected());
  }

  input(action) {
    if (!this.finish) return;
    if (action === 'up') { this.setCursor(this.cursor ? this.cursor - 1 : 4); playSelect(this.scene); }
    else if (action === 'down') { this.setCursor(this.cursor < 4 ? this.cursor + 1 : 0); playSelect(this.scene); }
    else if (action === 'ok') {
      if (this.cursor < this.moves.length) { playSelect(this.scene); this.finish(this.cursor); }
      else if (this.cursor === 4) { playSelect(this.scene); this.finish(null); }
      else playError(this.scene);
    } else if (action === 'back') { playSelect(this.scene); this.finish(null); }
  }
  clear() {
    this.details?.clear(); this.details = null;
    this.container?.destroy(); this.container = this.list = null;
  }
  destroy() { if (this.finish) this.finish = null; this.clear(); }
}

export function buildMoveEffect(s, x = 106) {
  const container = s.add.container(x, -62);
  const power = styledText(s, 99, 27, '0', 'WINDOW_ALT').setOrigin(1, 1);
  const accuracy = styledText(s, 99, 43, '0', 'WINDOW_ALT').setOrigin(1, 1);
  const category = s.add.sprite(99, 57, 'categories', 'physical').setOrigin(1, 1);
  container.add([s.add.image(0, 0, 'summary_moves_effect').setOrigin(0), s.add.image(7, 7, 'summary_moves_effect_title').setOrigin(0, 0.5),
    styledText(s, 8, 13, TEXT.powerAccuracyCategory, 'SUMMARY', { lineSpacing: 9 }).setOrigin(0), power, accuracy, category]);
  return { container, power, accuracy, category };
}

export function buildMovesPage(s, page, { moves, newMove = null }) {
  const list = s.add.container(5, -159 + 26);
  page.add(list);
  list.add([s.add.image(2, -22, 'summary_moves_moves_title').setOrigin(0, 0.5), s.add.image(2, 69, 'summary_moves_descriptions_title').setOrigin(0, 0.5)]);
  const row = (y, move, style) => {
    const r = s.add.container(0, y);
    if (move) r.add(s.add.sprite(0, 0, 'types', move.type.toLowerCase()).setOrigin(0, 1));
    r.add([styledText(s, 35, 0, move ? move.name : '-', style).setOrigin(0, 1),
      s.add.image(177, -5, 'summary_moves_overlay_pp').setOrigin(1, 0.5),
      styledText(s, 178, 1, move ? `${pad2(move.pp)}/${pad2(move.maxpp)}` : '--/--', 'WINDOW').setOrigin(0, 1)]);
    return r;
  };
  const extra = s.add.container(0, 64).setVisible(!!newMove);
  extra.add(s.add.image(-2, 1, 'summary_moves_overlay_row').setOrigin(0, 1));
  if (newMove) extra.add(row(0, newMove, 'SUMMARY_PINK'));
  else extra.add(styledText(s, 35, 0, TEXT.cancel, 'SUMMARY').setOrigin(0, 1));
  list.add(extra);
  for (let m = 0; m < 4; m++) list.add(row(16 * m, moves[m], 'SUMMARY'));
  const description = styledText(s, 1, 84, '', 'WINDOW_ALT', { wordWrap: { width: 1224 } });
  const maskShape = s.make.graphics({ add: false }).setScale(6).fillStyle(0xffffff).fillRect(112, 121, 205, 59);
  description.setMask(maskShape.createGeometryMask());
  list.add(description);
  return { list, extra, description, maskShape };
}

export class MoveDetails {
  constructor(scene, fx) { this.scene = scene; this.fx = fx; this.effectShown = fx.container.x === 6; }
  attach(refs) { this.clear(); this.refs = refs; }
  select(cursor, move) {
    const s = this.scene, { list, description } = this.refs;
    if (move) {
      description.setY(74);
      this.fx.power.setText(move.power ? String(move.power) : '---');
      this.fx.accuracy.setText(move.accuracy ? String(move.accuracy) : '---');
      this.fx.category.setFrame(String(move.category).toLowerCase());
      this.showEffect();
    } else this.hideEffect();
    description.setText(move?.description ?? '');

    this.scroll?.remove(); this.scroll = null;
    const lines = Math.floor(description.displayHeight / 14.83);
    if (lines > 4) {
      this.scroll = s.tweens.add({ targets: description, delay: fixed(2000), loop: -1, hold: fixed(2000), duration: fixed((lines - 4) * 2000), y: `-=${14.83 * (lines - 4)}` });
    }
    if (!this.cursorObj) { this.cursorObj = s.add.sprite(-2, 0, 'summary_moves_cursor', 'highlight').setOrigin(0, 1); list.add(this.cursorObj); }
    this.cursorObj.setY(16 * cursor + 1).setVisible(true);

    this.blink?.remove();
    this.blink = s.time.addEvent({ loop: true, delay: fixed(600), callback: () => {
      this.cursorObj?.setVisible(false);
      s.time.delayedCall(fixed(100), () => this.cursorObj?.setVisible(true));
    } });
  }

  hide() {
    this.refs?.description.setText('');
    this.blink?.remove(); this.blink = null;
    this.cursorObj?.destroy(); this.cursorObj = null;
    this.scroll?.remove(); this.scroll = null;
    this.hideEffect();
  }

  showEffect(instant = false) {
    if (this.effectShown) return;
    this.effectShown = true;
    this.scene.tweens.add({ targets: this.fx.container, x: 6, duration: instant ? 0 : 250, ease: 'Sine.easeOut' });
  }
  hideEffect(instant = false) {
    if (!this.effectShown) return;
    this.effectShown = false;
    this.scene.tweens.add({ targets: this.fx.container, x: 106, duration: instant ? 0 : 250, ease: 'Sine.easeIn' });
  }

  clear() {
    this.scroll?.remove(); this.blink?.remove(); this.scroll = this.blink = null;
    if (this.refs) { this.refs.description.clearMask(true); this.refs.maskShape.destroy(); }
    this.refs = null; this.cursorObj = null;
  }
}
