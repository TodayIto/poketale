// from pokerogue src/ui/handlers/summary-ui-handler.ts (SummaryUiMode.DEFAULT, Page.PROFILE/STATS/MOVES) @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/ui/handlers/party-ui-handler.ts (processSummaryOption) @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-10-30. See view/LICENSE-NOTE.md.

import { placeSprite } from '../sprites/placement.js';
import { fixed } from '../game-speed.js';
import { ballFrame } from './bag.js';
import { LEARN_MOVE_IMAGES, TEXT as SUMMARY_TEXT, fadeSwap, buildMoveEffect, buildMovesPage, MoveDetails } from './learn-move.js';
import { styledText, STATUS_FRAMES, STAT_ROWS, GENDER_COLORS, genderSymbol } from './text.js';
import { playSelect, playError } from './keys.js';
import { openMenu } from './menu.js';
import { RenameForm } from './rename-form.js';
import { LoadError } from '../retry.js';

const KO = 'images/ui/text_images/ko/summary/';

export const SUMMARY_IMAGES = {
  summary_profile: 'images/ui/summary_profile.png', summary_stats: 'images/ui/summary_stats.png',
  summary_stats_overlay_exp: 'images/ui/summary_stats_overlay_exp.png', summary_profile_prompt_z: 'images/ui/summary_profile_prompt_z.png',
  summary_tabs_1: `${KO}summary_tabs_1_ko.png`, summary_tabs_2: `${KO}summary_tabs_2_ko.png`,
  summary_dexnb_label_overlay_shiny: `${KO}summary_dexnb_label_overlay_shiny_ko.png`,
  summary_profile_profile_title: `${KO}summary_profile_profile_title_ko.png`, summary_profile_ability: `${KO}summary_profile_ability_ko.png`,
  summary_profile_memo_title: `${KO}summary_profile_memo_title_ko.png`, summary_stats_item_title: `${KO}summary_stats_item_title_ko.png`,
  summary_stats_stats_title: `${KO}summary_stats_stats_title_ko.png`, summary_stats_exp_title: `${KO}summary_stats_exp_title_ko.png`,
  summary_stats_expbar_title: `${KO}summary_stats_expbar_title_ko.png`,
  shiny_star: 'images/ui/shiny.png', button_tera: 'images/ui/button_tera.png',
};

// Phrases by name (view/words.js): pokemon-summary.json ot, type, expPoints, nextLv. idNo is not shown
const TEXT = Object.freeze({ ...SUMMARY_TEXT, ot: 'pokemon-summary.ot', type: 'pokemon-summary.type', expPoints: 'pokemon-summary.expPoints',
  nextLv: 'pokemon-summary.nextLv', noItem: 'own.noItem' });

const QUILL = ['......oo', '.....owo', '....owwo', '...owwo.', '..owwo..', '..owo...', '.oo.....', 'o.......'];
const QUILL_COLOR = { o: 0x484848, w: 0xf8f8f8 };
const QUILL_HIT = 14;
export const PAGES = ['profile', 'stats', 'moves'];
const [PROFILE, STATS_PAGE, MOVES] = [0, 1, 2];
const SWIPE = 16 * 6;

export function openSummary(menu) {
  const scene = menu.scene;
  menu.sub = true;
  const screen = scene.summaryScreen ??= new SummaryScreen(scene);
  screen.show({ party: menu.party, index: menu.cursor, onOpen: () => { if (menu.finish) menu.clearOptions(); } })
    .catch(error => {
      if (scene.life.signal.aborted) return;
      if (!(error instanceof LoadError)) console.error(error);
      if (!menu.finish) return;
      menu.clearOptions(); menu.showPrompt(scene.words('own.openFailed'));
    })
    .finally(() => { menu.sub = false; });
}

export class SummaryScreen {
  constructor(scene) { this.scene = scene; }

  async show({ party, index, onOpen, rename }) {
    if (this.finish || this.opening) throw new Error('Summary screen already open');
    const s = this.scene;
    if (!party?.[index]?.summary) throw new Error('No summary for this party slot');
    this.opening = true;
    try {
      await Promise.all(Object.entries({ ...LEARN_MOVE_IMAGES, ...SUMMARY_IMAGES }).map(([key, path]) => s.assets.image(key, path)));
      const asset = await s.assets.mon(party[index], false);
      s.life.check();
      this.party = party; this.index = index; this.page = PROFILE;
      this.moveSelect = false; this.moveCursor = 0; this.statusShown = false; this.transitioning = false;
      this.rename = typeof rename === 'function' ? rename : null; this.renaming = false;
      await fadeSwap(s, () => { this.build(); this.showMon(asset, true); });
    } catch (error) { this.clear(); throw error; } finally { this.opening = false; }
    onOpen?.();
    const menu = openMenu(s, { input: action => this.input(action), close: () => this.release() });
    this.finish = menu.finish;
    this.pointerDown = () => { if (this.finish && !this.renaming && !this.noticing) this.armed = true; };

    this.pointerUp = pointer => {
      const armed = this.armed;
      queueMicrotask(() => { this.armed = false; });
      if (!armed || this.renaming) return;
      const dx = pointer.upX - pointer.downX, dy = pointer.upY - pointer.downY;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE) return;
      if (Math.abs(dx) > Math.abs(dy)) this.input(dx < 0 ? 'right' : 'left');
      else this.input(dy < 0 ? 'down' : 'up');
    };
    s.input.on('pointerdown', this.pointerDown); s.input.on('pointerup', this.pointerUp);
    try { await menu.promise; } catch (error) { this.clear(); throw error; }
    await fadeSwap(s, () => this.clear());
    return null;
  }

  // Stop input (nothing is accepted during the closing transition). Keys are released by the menu frame
  release() {
    const s = this.scene;
    this.finish = null;
    if (this.pointerDown) { s.input.off('pointerdown', this.pointerDown); s.input.off('pointerup', this.pointerUp); this.pointerDown = this.pointerUp = null; }
  }

  pages() {
    if (!this.finish || this.renaming) return null;
    return { prev: this.page > PROFILE, next: this.page < MOVES && !this.moveSelect };
  }

  // Only when the same press was not a swipe (object pointerup)
  tap(fn) {
    return (pointer, localX) => {
      if (!this.armed || !this.finish) return;
      if (pointer && Math.max(Math.abs(pointer.upX - pointer.downX), Math.abs(pointer.upY - pointer.downY)) >= SWIPE) return;
      fn(localX);
    };
  }

  build() {
    const s = this.scene;
    const c = this.container = s.add.container(0, 0);
    s.ui.add(c);

    c.add(s.add.rectangle(0, -180, 320, 180, 0, 0).setOrigin(0).setInteractive());
    c.add(s.add.image(0, 0, 'summary_bg').setOrigin(0, 1));

    this.tab = s.add.image(81, -180 + 16, 'summary_tabs_1').setOrigin(0, 1);
    c.add([this.tab, styledText(s, 4, -165, s.words(TEXT.pokemonInfo), 'SUMMARY_HEADER').setOrigin(0, 1),
      s.add.image(6, -151, 'summary_dexnb_label').setOrigin(0, 1)]);

    this.monLayer = s.add.container(0, 0);
    c.add(this.monLayer);

    this.status = s.add.sprite(91, 4, 'statuses', 'burn').setOrigin(0.5, 0);
    this.statusContainer = s.add.container(-106, -16);
    this.statusContainer.add([s.add.image(0, 0, 'summary_status').setOrigin(0), styledText(s, 3, 0, s.words(TEXT.status), 'SUMMARY').setOrigin(0), this.status]);
    c.add(this.statusContainer);
    const fx = buildMoveEffect(s, 106);
    c.add(fx.container);
    this.details = new MoveDetails(s, fx);

    const pageContainer = () => {
      const p = s.add.container(106, 0).setVisible(false);
      p.add(s.add.sprite(0, 0, 'summary_profile').setOrigin(0, 1));
      return p;
    };
    this.pageC = pageContainer(); this.transC = pageContainer();
    c.add([this.pageC, this.transC]);

    const tabHit = s.add.rectangle(81, -180, 62, 16, 0, 0).setOrigin(0).setInteractive({ useHandCursor: true });
    tabHit.on('pointerup', this.tap(localX => {
      const x = localX ?? 0, width = this.tab.width ?? 38;
      if (x <= width) this.input(x < width / 2 ? 'left' : 'right');
    }));
    const headerHit = s.add.rectangle(0, -180, 81, 16, 0, 0).setOrigin(0).setInteractive({ useHandCursor: true });
    headerHit.on('pointerup', this.tap(() => this.input('back')));
    c.add([tabHit, headerHit]);
  }

  showMon(asset, first) {
    const s = this.scene, mon = this.party[this.index], summary = mon.summary, layer = this.monLayer;
    layer.removeAll(true);

    if (mon.shiny) layer.add(s.add.image(6, -54, 'summary_dexnb_label_overlay_shiny').setOrigin(0, 1));

    layer.add(styledText(s, 41, -149, String(summary.dexNumber ?? 0).padStart(4, '0'), mon.shiny ? 'SUMMARY_DEX_NUM_GOLD' : 'SUMMARY_DEX_NUM').setOrigin(1, 1));

    const place = placeSprite(asset, 'enemy');
    const body = asset.bounds;
    const sprite = s.add.sprite(56, -106, asset.key, asset.frame)
      .setOrigin(place.originX, (body.top + body.bottom) / 2 / asset.height).setScale(place.scale);
    if (s.anims.exists(asset.key)) sprite.play(asset.key);
    const name = styledText(s, 6, -53, mon.name, 'SUMMARY').setOrigin(0, 0);
    layer.add([sprite, name]);

    if (this.rename) name.setInteractive({ useHandCursor: true }).on('pointerup', this.tap(() => this.startRename()));

    const shiny = mon.shiny ? s.add.image(name.x + name.displayWidth + 1, name.y + 3, 'shiny_star').setOrigin(0, 0).setScale(0.75).setTint(0xf8c020) : null;
    if (shiny) layer.add(shiny);

    const quill = this.rename ? this.drawQuill(layer) : null;
    this.nameRefs = { name, shiny, quill };
    this.placeQuill();
    layer.add(s.add.sprite(6, -19, 'pb', ballFrame(summary.ball)).setOrigin(0, 1));

    layer.add(styledText(s, 24, -17, String(mon.level), 'SUMMARY_ALT').setOrigin(0, 1));
    if (GENDER_COLORS[mon.gender]) layer.add(styledText(s, 96, -17, genderSymbol(mon.gender), `GENDER_${mon.gender}`).setOrigin(0, 1));

    const status = STATUS_FRAMES[mon.status];
    if (status) this.status.setFrame(status);
    if (!!status !== this.statusShown) {
      this.statusShown = !!status;
      s.tweens.add({ targets: this.statusContainer, x: status ? 0 : -106, duration: first ? 0 : 250, ease: status ? 'Sine.easeOut' : 'Sine.easeIn' });
    }
    this.details.hideEffect(true);
    this.moveSelect = false;
    this.tab.setTexture(`summary_tabs_${this.page + 1}`);
    this.populate(this.pageC, this.page);
    this.pageC.setVisible(true);
    if (!first) s.audio.cry(mon).catch(() => {});
  }

  populate(container, page) {
    const s = this.scene, mon = this.party[this.index], summary = mon.summary;
    if (container === this.pageC) { this.details.clear(); this.statsRefs = null; this.movesRefs = null; }
    container.cleanup?.forEach(fn => fn()); container.cleanup = [];
    container.content?.destroy();
    this.descriptionScroll?.remove(); this.descriptionScroll = null;
    container.list[0].setTexture(`summary_${PAGES[page]}`);
    const content = container.content = s.add.container(0, 0);
    container.add(content);
    if (page === PROFILE) this.profilePage(container, content, mon, summary);
    else if (page === STATS_PAGE) {
      const refs = this.statsPage(container, content, mon, summary);
      if (container === this.pageC) this.statsRefs = refs;
    } else {
      const refs = buildMovesPage(s, content, { moves: summary.moves });
      container.cleanup.push(() => refs.maskShape.destroy());
      if (container === this.pageC) {
        container.cleanup.pop();
        this.movesRefs = refs;
        this.details.attach(refs);
        this.moveHits(refs.list);
      }
    }
  }
  profilePage(container, content, mon, summary) {
    const s = this.scene, p = s.add.container(0, -159);
    content.add(p);
    p.add(s.add.image(7, 4, 'summary_profile_profile_title').setOrigin(0, 0.5));

    const ot = styledText(s, 7, 10, `${s.words(TEXT.ot)}/`, 'SUMMARY_ALT').setOrigin(0);

    p.add([ot, styledText(s, 7 + ot.displayWidth, 10, summary.trainer ?? '', 'SUMMARY_BLUE').setOrigin(0)]);

    const typeLabel = styledText(s, 7, 27, `${s.words(TEXT.type)}/`, 'WINDOW_ALT').setOrigin(0, 0);
    p.add(typeLabel);
    (summary.types ?? []).slice(0, 2).forEach((type, i) =>
      p.add(s.add.sprite(typeLabel.displayWidth + 9 + 34 * i, 41, 'types', type.toLowerCase()).setOrigin(0, 1)));

    if (summary.teraType) {
      const frame = summary.teraType.toLowerCase();
      p.add(s.add.sprite(128, 26, 'button_tera', s.textures?.get?.('button_tera')?.has?.(frame) === false ? 'unknown' : frame));
    }

    p.add([s.add.image(17, 47, 'summary_profile_ability').setOrigin(0, 0.5),
      styledText(s, 7, 68, summary.ability?.name ?? '', 'SUMMARY_ALT').setOrigin(0, 1)]);
    const description = styledText(s, 7, 71, summary.ability?.description ?? '', 'WINDOW_ALT', { wordWrap: { width: 1224 } }).setOrigin(0, 0);
    const mask = s.make.graphics({ add: false }).setScale(6).fillStyle(0xffffff).fillRect(110, 90, 206, 31);
    description.setMask(mask.createGeometryMask());
    container.cleanup.push(() => { description.clearMask(true); mask.destroy(); });
    p.add(description);
    const lines = Math.floor(description.displayHeight / 14.83);
    if (lines > 2) {
      description.setY(69);
      this.descriptionScroll = s.tweens.add({ targets: description, delay: fixed(2000), loop: -1, hold: fixed(2000), duration: fixed((lines - 2) * 2000), y: `-=${14.83 * (lines - 2)}` });
    }

    p.add(s.add.image(7, 107, 'summary_profile_memo_title').setOrigin(0, 0.5));
    if (summary.nature) {
      const [before, after = ''] = String(summary.nature.text ?? '{{nature}}').split('{{nature}}');
      let x = 7;
      for (const [str, style] of [[before, 'WINDOW_ALT'], [summary.nature.name, 'SUMMARY_RED'], [`${after}.`, 'WINDOW_ALT']]) {
        if (!str) continue;
        const t = styledText(s, x, 113, str, style).setOrigin(0, 0);
        p.add(t); x += t.displayWidth;
      }

      if (summary.nature.mint) p.add(styledText(s, 7, 113 + 14.83, summary.nature.mint, 'WINDOW_ALT').setOrigin(0, 0));
    }
  }
  statsPage(container, content, mon, summary) {
    const s = this.scene, p = s.add.container(0, -159);
    content.add(p);
    const perm = s.add.container(27, 64), ivs = s.add.container(27, 64).setVisible(false);
    p.add([s.add.container(0, 0)                                                        , perm, ivs]);

    // Held item as one text line under the item title (in place of the icons)
    p.add(styledText(s, 8, 14, summary.item ?? s.words(TEXT.noItem), 'WINDOW_ALT').setOrigin(0, 0));
    p.add([s.add.image(7, 4, 'summary_stats_item_title').setOrigin(0, 0.5), s.add.image(16, 59, 'summary_stats_stats_title').setOrigin(0, 0.5),
      s.add.image(7, 115, 'summary_stats_exp_title').setOrigin(0, 0.5), s.add.image(126, 152, 'summary_stats_expbar_title').setOrigin(0, 0)]);
    const stats = summary.stats ?? {};
    STAT_ROWS.forEach(([key, name], i) => {
      const row = i % 3, col = Math.floor(i / 3), x = 116 * col + (col === 1 ? 5 : 0);

      const style = summary.nature?.plus === key ? 'SUMMARY_STATS_PINK' : summary.nature?.minus === key ? 'SUMMARY_STATS_BLUE' : 'SUMMARY_STATS';
      const iv = summary.ivs?.[key], label = s.words(name);
      perm.add([styledText(s, x, 16 * row, label, style).setOrigin(0.5, 0),
        styledText(s, 93 + 93 * col, 16 * row, key === 'hp' ? `${stats.hp ?? mon.hp}/${stats.maxhp ?? mon.maxhp}` : String(stats[key] ?? ''), 'WINDOW_ALT').setOrigin(1, 0)]);
      ivs.add([styledText(s, x, 16 * row, label, iv === 31 ? 'SUMMARY_STATS_GOLD' : 'SUMMARY_STATS').setOrigin(0.5, 0),
        styledText(s, 93 + 93 * col, 16 * row, iv === undefined ? '' : `${iv}/31`, 'WINDOW_ALT').setOrigin(1, 0)]);
    });

    const exp = summary.exp;
    p.add([styledText(s, 6, 120, s.words(TEXT.expPoints), 'SUMMARY').setOrigin(0, 0), styledText(s, 6, 136, s.words(TEXT.nextLv), 'SUMMARY').setOrigin(0, 0),
      styledText(s, 213, 120, exp ? String(exp.total) : '', 'WINDOW_ALT').setOrigin(1, 0),
      styledText(s, 213, 136, exp ? String(exp.next) : '', 'WINDOW_ALT').setOrigin(1, 0)]);
    const bar = s.add.image(140, 153, 'summary_stats_overlay_exp').setOrigin(0, 0);
    const mask = s.make.graphics({ add: false }).setScale(6).fillStyle(0xffffff)
      .fillRect(140 + container.x, 152 + container.y + 22, Math.floor((exp?.ratio ?? 0) * 64), 3);
    bar.setMask(mask.createGeometryMask());
    container.cleanup.push(() => { bar.clearMask(true); mask.destroy(); });

    p.add([bar, s.add.image(8, 55, 'summary_profile_prompt_z').setOrigin(0, 0).setVisible(!!summary.ivs)]);

    const hit = s.add.rectangle(0, 51, 214, 56, 0, 0).setOrigin(0).setInteractive({ useHandCursor: true });
    hit.on('pointerup', this.tap(() => { if (this.page === STATS_PAGE && !this.moveSelect) this.input('ok'); }));
    p.add(hit);
    return { perm, ivs };
  }

  moveHits(list) {
    const s = this.scene;
    for (let m = 0; m <= 4; m++) {
      const hit = s.add.rectangle(-2, 16 * m - 15, 211, 16, 0, 0).setOrigin(0).setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => { if (this.moveSelect && !this.transitioning) this.setMoveCursor(m); });
      hit.on('pointerup', this.tap(() => {
        if (this.transitioning || this.page !== MOVES) return;
        if (!this.moveSelect) { if (m < 4) { playSelect(s); this.showMoveSelect(); this.setMoveCursor(m); } return; }
        this.setMoveCursor(m); this.input('ok');
      }));
      list.add(hit);
    }
  }

  setPage(page) {
    const s = this.scene, forward = this.page < page, old = this.page;
    this.page = page;
    this.tab.setTexture(`summary_tabs_${page + 1}`);
    this.transitioning = true;
    this.populate(this.transC, forward ? page : old);
    if (forward) this.transC.x += 214;
    else this.populate(this.pageC, page);
    this.transC.setVisible(true);
    s.tweens.add({ targets: this.transC, x: forward ? '-=214' : '+=214', duration: 250, onComplete: () => {
      if (!this.container) return;
      if (forward) {
        this.populate(this.pageC, page);
        if (page === MOVES) this.showMoveSelect();
      } else this.transC.x -= 214;
      this.transC.setVisible(false);
      this.transitioning = false;
    } });
  }

  showMoveSelect() {
    if (!this.movesRefs) return;
    this.moveSelect = true;
    this.movesRefs.extra.setVisible(true);
    this.setMoveCursor(0);
    this.details.showEffect();
  }
  setMoveCursor(cursor) {
    const moves = this.party[this.index].summary.moves ?? [];
    this.moveCursor = cursor;
    this.details.select(cursor, cursor < 4 ? moves[cursor] ?? null : null);
  }
  hideMoveSelect() {
    this.moveSelect = false;
    this.movesRefs?.extra.setVisible(false);
    this.details.hide();
  }
  async switchMember(step) {
    const next = this.index + step;
    if (!this.party[next]?.summary) return;
    this.transitioning = true;
    try {
      const asset = await this.scene.assets.mon(this.party[next], false);
      if (!this.container) return;
      this.index = next;
      this.showMon(asset, false);
    } catch (error) {

      if (this.scene.life.signal.aborted || !this.container) return;
      if (!(error instanceof LoadError)) throw error;
      await this.notice(this.scene.words('own.loadFailed'));
    } finally { this.transitioning = false; }
  }

  async notice(text) {
    const s = this.scene, m = s.messages, ui = s.ui;
    const at = [ui.getIndex(m.bg), ui.getIndex(m.container)], shown = [m.bg.visible, m.container.visible];
    this.noticing = true;
    ui.bringToTop(m.bg); ui.bringToTop(m.container);
    m.bg.setVisible(true); m.container.setVisible(true);
    try { await m.message(text, { wait: true }); }
    finally {
      this.noticing = false;
      m.text.setText('');
      m.bg.setVisible(shown[0]); m.container.setVisible(shown[1]);
      ui.moveTo(m.bg, at[0]); ui.moveTo(m.container, at[1]);
    }
  }

  input(action) {
    if (this.noticing) { if (action === 'ok' || action === 'back') this.scene.messages.advance?.(); return; }
    if (this.renaming) return this.renameForm?.input(action);
    if (!this.finish || this.transitioning) return;
    const s = this.scene;
    if (this.moveSelect) {
      const moves = this.party[this.index].summary.moves ?? [], c = this.moveCursor;
      if (action === 'ok') {
        if (c === 4) { playSelect(s); this.hideMoveSelect(); } else if (c >= moves.length) playError(s);
        return;
      }
      if (action === 'back') { playSelect(s); return this.hideMoveSelect(); }
      if (action === 'up') { playSelect(s); return this.setMoveCursor(c ? c - 1 : 4); }
      if (action === 'down') { playSelect(s); return this.setMoveCursor(c < 4 ? c + 1 : 0); }
      if (action === 'left') { playSelect(s); this.hideMoveSelect(); return this.setPage(STATS_PAGE); }
      return;
    }
    if (action === 'ok') {
      if (this.page === PROFILE && this.rename) return void this.startRename();
      if (this.page === MOVES) { playSelect(s); this.showMoveSelect(); }
      else if (this.page === STATS_PAGE && this.statsRefs && this.party[this.index].summary.ivs) {
        this.statsRefs.perm.setVisible(!this.statsRefs.perm.visible);
        this.statsRefs.ivs.setVisible(!this.statsRefs.ivs.visible);
      }
      return;
    }
    if (action === 'back') { playSelect(s); return this.finish(null); }
    if (action === 'up' || action === 'down') return void this.switchMember(action === 'down' ? 1 : -1);
    if (action === 'left' && this.page > PROFILE) { playSelect(s); return this.setPage(this.page - 1); }
    if (action === 'right' && this.page < MOVES) { playSelect(s); return this.setPage(this.page + 1); }
  }

  async startRename() {
    if (!this.rename || this.renaming || !this.finish || this.transitioning) return;
    const s = this.scene, mon = this.party[this.index];
    playSelect(s);
    this.renaming = true;
    try {
      const form = this.renameForm ??= new RenameForm(s);
      const value = await form.open(mon.name);
      if (value === null || !this.container) return;
      const shown = await this.rename(value);
      if (typeof shown === 'string' && this.container && this.party[this.index] === mon) { mon.name = shown; this.showName(shown); }
    } catch (error) {

      if (s.life.signal.aborted || !this.container) return;
      if (!(error instanceof LoadError)) console.error(error);
      await this.notice(this.scene.words('own.renameFailed'));
    } finally { this.renaming = false; }
  }

  // Replace only the name text and move the shiny star / quill to the end of the name
  showName(name) {
    const { name: text, shiny } = this.nameRefs ?? {};
    if (!text) return;
    text.setText(name);
    shiny?.setPosition(text.x + text.displayWidth + 1, text.y + 3);
    this.placeQuill();
  }

  // Quill: pixel drawing (Graphics) + generous hit area. Positioned by placeQuill
  drawQuill(layer) {
    const s = this.scene, icon = s.add.graphics();
    QUILL.forEach((row, y) => [...row].forEach((cell, x) => { if (QUILL_COLOR[cell] !== undefined) icon.fillStyle(QUILL_COLOR[cell]).fillRect(x, y, 1, 1); }));
    const hit = s.add.rectangle(0, 0, QUILL_HIT, QUILL_HIT, 0, 0).setOrigin(0.5).setInteractive({ useHandCursor: true });
    hit.on('pointerup', this.tap(() => this.startRename()));
    layer.add([icon, hit]);
    return { icon, hit };
  }

  placeQuill() {
    const { name, shiny, quill } = this.nameRefs ?? {};
    if (!quill) return;
    const x = (shiny ? shiny.x + shiny.width * shiny.scaleX : name.x + name.displayWidth) + 3, y = name.y + 3;
    quill.icon.setPosition(x, y);
    quill.hit.setPosition(x + QUILL[0].length / 2, y + QUILL.length / 2);
  }

  clear() {
    this.renameForm?.clear(); this.renaming = false;
    this.release();
    this.descriptionScroll?.remove(); this.descriptionScroll = null;
    this.details?.clear(); this.details = null;
    for (const p of [this.pageC, this.transC]) p?.cleanup?.forEach(fn => fn());
    this.container?.destroy();
    this.container = this.pageC = this.transC = this.monLayer = this.tab = this.statsRefs = this.movesRefs = null;
  }
  destroy() { this.clear(); }
}
