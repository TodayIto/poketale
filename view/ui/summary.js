// from pokerogue src/ui/handlers/summary-ui-handler.ts (SummaryUiMode.DEFAULT, Page.PROFILE/STATS/MOVES) @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-11-22. See view/LICENSE-NOTE.md.
// from pokerogue src/ui/handlers/party-ui-handler.ts (processSummaryOption) @ 7d7da4a8 (AGPL-3.0-only)

import Phaser from 'phaser';
import { zTextures, dmaxLevelColor, DMAX_LEVEL_EMPTY } from './z-art.js'; // the G-Max mark, the Dynamax Level cells
import { placeSprite } from '../sprites/placement.js';
import { fixed } from '../game-speed.js'; // description scrolling ignores game speed (summary-ui-handler.ts fixedInt)
import { ballFrame } from './bag.js';
import { LEARN_MOVE_IMAGES, TEXT as SUMMARY_TEXT, fadeSwap, buildMoveEffect, buildMovesPage, MoveDetails } from './learn-move.js';
import { styledText, addGenderMark, fitName, FONT_FAMILY, STATUS_FRAMES, STAT_ROWS, GENDER_COLORS } from './text.js';
import { nameShowsGender } from '../gender-mark.js';
import { playSelect, playError } from './keys.js'; // menu sounds
import { openMenu } from './menu.js'; // menu frame (keys, closing)
import { RenameForm } from './rename-form.js'; // nickname change
import { LoadError } from '../retry.js'; // load-failure kind
import { artTexture } from '../amie-art.js'; // the friendship line's heart (the petting screen's pixel heart)

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

const LOCK_SHUT = ['.ooooo.', 'oo...oo', 'o.....o', 'ooooooo', 'owwwwwo', 'owwowwo', 'owwowwo', 'ooooooo'];
const LOCK_OPEN = ['.ooooo.', 'oo...oo', 'o......', 'ooooooo', 'owwwwwo', 'owwowwo', 'owwowwo', 'ooooooo'];
const LOCK_COLOR = { shut: { o: 0x484848, w: 0xf8c020 }, open: { o: 0x484848, w: 0xf8f8f8 } };
const LOCK_X = 85, LOCK_Y = -26;

const NAME_RIGHT = 104;
export const PAGES = ['profile', 'stats', 'moves'];

const MEMO_RIGHT = 7 + 1224 / 6, PAGE_BOTTOM = 159, BOND_HEART_W = 7, BOND_HEART_DY = 5, BOND_SIZES = [96, 80, 66];
const BOND_PADDING = { bottom: 6 }, BOND_LINE_SPACING = 5;
const [PROFILE, STATS_PAGE, MOVES] = [0, 1, 2];

const DMAX_CELLS = { width: 5, gap: 2, slant: 2, height: 5, count: 10, right: 122, top: 152 };
const DMAX_LABEL = { size: 44, gap: 3, left: 6, middle: 154.5 };

const GMAX_GAP = 2;
const SWIPE = 16 * 6; // swipe distance (16 units in screen coordinates)

export function openSummary(menu) {
  const scene = menu.scene;
  const screen = scene.summaryScreen ??= new SummaryScreen(scene);

  if (screen.opening || screen.finish) return;
  menu.sub = true;
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

  async show({ party, index, onOpen, rename, lock }) {
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
      this.lock = typeof lock === 'function' ? lock : null; this.locking = false;
      await fadeSwap(s, () => { this.build(); this.showMon(asset, true); });
    } catch (error) { this.clear(); throw error; } finally { this.opening = false; }

    let menu;
    try {
      onOpen?.();
      menu = openMenu(s, { input: action => this.input(action), close: () => this.release() });
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
    } catch (error) { menu?.finish(null); this.clear(); throw error; }
    try { await menu.promise; } catch (error) { this.clear(); throw error; }
    await fadeSwap(s, () => this.clear());
    return null;
  }

  release() {
    const s = this.scene;
    this.finish = null;
    if (this.pointerDown) { s.input.off('pointerdown', this.pointerDown); s.input.off('pointerup', this.pointerUp); this.pointerDown = this.pointerUp = null; }
  }

  pages() {
    if (!this.finish || this.renaming) return null;
    return { prev: this.page > PROFILE, next: this.page < MOVES && !this.moveSelect };
  }
  /** Only when the same press was not a swipe (object pointerup) */
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
    // shinyOverlay (6, -54) origin (0,1): gold "No" + left strip when shiny
    if (mon.shiny) layer.add(s.add.image(6, -54, 'summary_dexnb_label_overlay_shiny').setOrigin(0, 1));

    layer.add(styledText(s, 41, -149, String(summary.dexNumber ?? 0).padStart(4, '0'), mon.shiny ? 'SUMMARY_DEX_NUM_GOLD' : 'SUMMARY_DEX_NUM').setOrigin(1, 1));

    const place = placeSprite(asset, 'enemy');
    const body = asset.bounds;
    const sprite = s.add.sprite(56, -106, asset.key, asset.frame)
      .setOrigin(place.originX, (body.top + body.bottom) / 2 / asset.height).setScale(place.scale);
    if (s.anims.exists(asset.key)) sprite.play(asset.key);

    const gmax = summary?.gigantamax ? this.drawGmaxMark(layer, 6, -53) : null;
    const name = styledText(s, 6 + (gmax ? gmax.width + GMAX_GAP : 0), -53, '', 'SUMMARY').setOrigin(0, 0);
    layer.add([sprite, name]);
    // tapping the name changes the nickname (outside battle, only with rename)
    if (this.rename) name.setInteractive({ useHandCursor: true }).on('pointerup', this.tap(() => this.startRename()));
    // shinyIcon: name right +1, y +3, scale 0.75, getVariantTint(0)
    const shiny = mon.shiny ? s.add.image(0, name.y + 3, 'shiny_star').setOrigin(0, 0).setScale(0.75).setTint(0xf8c020) : null;
    if (shiny) layer.add(shiny);

    const quill = this.rename ? this.drawQuill(layer) : null;

    const gender = GENDER_COLORS[mon.gender] ? addGenderMark(s, 96, -17, mon.gender, `GENDER_${mon.gender}`, { originY: 1 }) : null;

    const evolveLock = this.lock && summary.lock && !summary.lock.held ? this.drawLock(layer, summary.lock.locked) : null;
    this.nameRefs = { name, shiny, quill, gender, evolveLock, gmax };
    this.showName(mon.name);
    layer.add(s.add.sprite(6, -19, 'pb', ballFrame(summary.ball)).setOrigin(0, 1));
    // friendship (source (13, -60) heart + n/255) is not drawn
    layer.add(styledText(s, 24, -17, String(mon.level), 'SUMMARY_ALT').setOrigin(0, 1));
    if (gender) layer.add(gender);
    // showStatus / hideStatus: x 0 <-> -106, 250ms (instant on first open)
    const status = STATUS_FRAMES[mon.status];
    if (status) this.status.setFrame(status);
    if (!!status !== this.statusShown) {
      this.statusShown = !!status;
      s.tweens.add({ targets: this.statusContainer, x: status ? 0 : -106, duration: first ? 0 : 250, ease: status ? 'Sine.easeOut' : 'Sine.easeIn' }); // not awaited
    }
    this.details.hideEffect(true);
    this.moveSelect = false;
    this.tab.setTexture(`summary_tabs_${this.page + 1}`);
    this.populate(this.pageC, this.page);
    this.pageC.setVisible(true);
    if (!first) s.audio.cry(mon, false, 'appear').catch(() => {});
  }

  // -- populatePageContainer --
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
        container.cleanup.pop(); // the moves page mask is destroyed by MoveDetails.clear
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

    const trainer = styledText(s, 7 + ot.displayWidth, 10, '', 'SUMMARY_BLUE').setOrigin(0);
    p.add([ot, trainer]);

    const typeLabel = styledText(s, 7, 27, `${s.words(TEXT.type)}/`, 'WINDOW_ALT').setOrigin(0, 0);
    p.add(typeLabel);
    (summary.types ?? []).slice(0, 2).forEach((type, i) =>
      p.add(s.add.sprite(typeLabel.displayWidth + 9 + 34 * i, 41, 'types', type.toLowerCase()).setOrigin(0, 1)));

    const tera = summary.teraType ? s.add.sprite(128, 26, 'button_tera', s.textures?.get?.('button_tera')?.has?.(summary.teraType.toLowerCase()) === false ? 'unknown' : summary.teraType.toLowerCase()) : null;
    if (tera) p.add(tera);

    fitName(trainer, summary.trainer ?? '', (tera ? tera.x - tera.displayWidth * tera.originX - 1 : MEMO_RIGHT) - trainer.x);

    if (summary.ability) p.add([s.add.image(17, 47, 'summary_profile_ability').setOrigin(0, 0.5),
      styledText(s, 7, 68, summary.ability.name ?? '', 'SUMMARY_ALT').setOrigin(0, 1)]);
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

    const lockText = summary.lock?.text;
    if (summary.bond || lockText) this.bondLine(p, 113 + 14.83 * (summary.nature ? (summary.nature.mint ? 2 : 1) : 0), summary.bond, lockText, description);
  }

  bondLine(p, y, bond, lockText, description) {
    const s = this.scene, x = 7 + BOND_HEART_W + 3, { canvas, context } = description;
    const texts = [[x, bond?.text], [7, lockText]].filter(([, value]) => value);
    let layout = [], fontSize, metrics;
    if (texts.length) {
      // Use Phaser's own font metrics and basic wrapping without creating a Text texture.
      context.save();
      try {
        for (const size of bond && lockText ? [...BOND_SIZES, 56, 48] : BOND_SIZES) {
          fontSize = size;
          const style = new Phaser.GameObjects.TextStyle(null, { fontFamily: FONT_FAMILY, fontSize });
          metrics = style.metrics;
          style.syncFont(canvas, context);
          let bottom = y;
          layout = texts.map(([left, value]) => {
            const width = (MEMO_RIGHT - left) * 6;
            const text = Array.isArray(value) ? value.join('\n') : String(value);
            const wrapped = description.basicWordWrap(text, context, width);
            const count = wrapped.split(description.splitRegExp).length;
            const top = bottom;
            bottom += (metrics.fontSize * count + BOND_LINE_SPACING * (count - 1) + BOND_PADDING.bottom) * (1 / 6);
            return { left, top, value, width, wrapped };
          });
          if (bottom <= PAGE_BOTTOM) break;
        }
      } finally {
        context.restore();
      }
    }
    const lines = layout.map(({ left, top, value, width, wrapped }) => {
      const line = styledText(s, left, top, value, 'WINDOW_ALT', {
        fontSize, metrics, padding: BOND_PADDING, lineSpacing: BOND_LINE_SPACING,
        wordWrap: { width, callback: () => wrapped },
      }).setOrigin(0, 0);
      line.style.wordWrapCallback = null; // the pre-wrapped value is only for the initial draws
      return line;
    });
    if (bond) {

      const heart = s.add.image(7, y, artTexture(s, bond.band === 'lowest' ? 'heartCold' : 'heart')).setOrigin(0, 0);
      heart.setY(y + (lockText ? Math.min(BOND_HEART_DY, Math.max(0, lines[0].displayHeight - heart.displayHeight)) : BOND_HEART_DY));
      p.add(heart);
    }
    p.add(lines);
  }
  statsPage(container, content, mon, summary) {
    const s = this.scene, p = s.add.container(0, -159);
    content.add(p);
    const perm = s.add.container(27, 64), ivs = s.add.container(27, 64).setVisible(false);
    p.add([s.add.container(0, 0) /* itemIconsContainer: held item icons are not added */, perm, ivs]);
    // Held item as one text line under the item title (in place of the icons)
    p.add(styledText(s, 8, 14, summary.item ?? s.words(TEXT.noItem), 'WINDOW_ALT').setOrigin(0, 0));
    p.add([s.add.image(7, 4, 'summary_stats_item_title').setOrigin(0, 0.5), s.add.image(16, 59, 'summary_stats_stats_title').setOrigin(0, 0.5),
      s.add.image(7, 115, 'summary_stats_exp_title').setOrigin(0, 0.5), s.add.image(126, 152, 'summary_stats_expbar_title').setOrigin(0, 0)]);
    const stats = summary.stats ?? {};

    const rows = summary.oneSpecial ? STAT_ROWS.filter(([key]) => key !== 'spd') : STAT_ROWS;
    rows.forEach(([key, name], i) => { // PERMANENT_STATS order (HP, Atk, Def | SpA, SpD, Spe)
      const row = i % 3, col = Math.floor(i / 3), x = 116 * col + (col === 1 ? 5 : 0);

      const style = summary.nature?.plus === key ? 'SUMMARY_STATS_PINK' : summary.nature?.minus === key ? 'SUMMARY_STATS_BLUE' : 'SUMMARY_STATS';
      const iv = summary.ivs?.[key], label = summary.oneSpecial && key === 'spa' ? summary.oneSpecial.label : s.words(name);
      perm.add([styledText(s, x, 16 * row, label, style).setOrigin(0.5, 0),
        styledText(s, 93 + 93 * col, 16 * row, key === 'hp' ? `${stats.hp ?? mon.hp}/${stats.maxhp ?? mon.maxhp}` : String(stats[key] ?? ''), 'WINDOW_ALT').setOrigin(1, 0)]);
      ivs.add([styledText(s, x, 16 * row, label, iv >= 31 ? 'SUMMARY_STATS_GOLD' : 'SUMMARY_STATS').setOrigin(0.5, 0),
        styledText(s, 93 + 93 * col, 16 * row, iv === undefined ? '' : `${iv}/31`, 'WINDOW_ALT').setOrigin(1, 0)]);
    });

    if (Number.isInteger(summary.dynamaxLevel)) this.dynamaxLine(p, summary.dynamaxLevel);

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
    // Touch: tapping the stats area shows IVs like Z
    const hit = s.add.rectangle(0, 51, 214, 56, 0, 0).setOrigin(0).setInteractive({ useHandCursor: true });
    hit.on('pointerup', this.tap(() => { if (this.page === STATS_PAGE && !this.moveSelect) this.input('ok'); }));
    p.add(hit);
    return { perm, ivs };
  }

  dynamaxLine(p, level) {
    const s = this.scene;
    const { width, gap, slant, height, count, right, top } = DMAX_CELLS, left = right - (count * width + (count - 1) * gap + slant);
    const label = styledText(s, left - DMAX_LABEL.gap, DMAX_LABEL.middle, s.words('own.dynamaxLevel'), 'SUMMARY', { fontSize: DMAX_LABEL.size, padding: {} })
      .setOrigin(1, 0.5).setShadow(2, 2, '#636363');
    // a longer label (another language) is narrowed to the room left of the cells
    const room = left - DMAX_LABEL.gap - DMAX_LABEL.left;
    if (label.displayWidth > room) label.setScale(label.scaleX * room / label.displayWidth, label.scaleY);
    p.add(label);
    const g = s.add.graphics?.();
    if (!g) return;

    for (let i = 0; i < count; i++) {
      const x = left + i * (width + gap), colour = i < level ? dmaxLevelColor(i, count) : DMAX_LEVEL_EMPTY;
      g.fillStyle(parseInt(colour.slice(1), 16)).fillPoints([{ x: x + slant, y: top }, { x: x + slant + width, y: top }, { x: x + width, y: top + height }, { x, y: top + height }], true);
    }
    p.add(g);
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

  // -- setCursor (page) --
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
  // -- Move selection (DEFAULT): cursor 0, fifth row (cancel) shown --
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
    if (this.noticing) { if (action === 'ok' || action === 'back') this.scene.messages.advance?.(); return; } // notice message
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
      if (this.page === PROFILE && this.rename) return void this.startRename(); // also via keys / pad
      if (this.page === MOVES) { playSelect(s); this.showMoveSelect(); }
      else if (this.page === STATS_PAGE && this.statsRefs && this.party[this.index].summary.ivs) {
        this.statsRefs.perm.setVisible(!this.statsRefs.perm.visible);
        this.statsRefs.ivs.setVisible(!this.statsRefs.ivs.visible);
      }
      return;
    }
    if (action === 'back') { playSelect(s); return this.finish(null); } // the menu frame stops input (no input during the closing transition)
    if (action === 'up' || action === 'down') return void this.switchMember(action === 'down' ? 1 : -1);
    if (action === 'left' && this.page > PROFILE) { playSelect(s); return this.setPage(this.page - 1); }
    if (action === 'right' && this.page < MOVES) { playSelect(s); return this.setPage(this.page + 1); }
  }

  async startRename() {
    if (!this.rename || this.renaming || this.locking || !this.finish || this.transitioning) return;
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

  showName(name) {
    const { name: text, shiny, quill, gender } = this.nameRefs ?? {};
    if (!text) return;
    const icons = (shiny ? 1 + shiny.width * shiny.scaleX : 0) + (quill ? 3 + QUILL[0].length : 0);
    const shown = fitName(text, name, NAME_RIGHT - text.x - icons);
    gender?.setVisible(!nameShowsGender(shown));
    shiny?.setPosition(text.x + text.displayWidth + 1, text.y + 3);
    this.placeQuill();
  }

  drawQuill(layer) {
    const s = this.scene, icon = s.add.graphics();
    QUILL.forEach((row, y) => [...row].forEach((cell, x) => { if (QUILL_COLOR[cell] !== undefined) icon.fillStyle(QUILL_COLOR[cell]).fillRect(x, y, 1, 1); }));
    const hit = s.add.rectangle(0, 0, QUILL_HIT, QUILL_HIT, 0, 0).setOrigin(0.5).setInteractive({ useHandCursor: true });
    hit.on('pointerup', this.tap(() => this.startRename()));
    layer.add([icon, hit]);
    return { icon, hit };
  }

  drawGmaxMark(layer, x, y) {
    zTextures(this.scene);
    const icon = this.scene.add.image(x, y + 4, 'gmax_mark').setOrigin(0, 0);
    layer.add(icon);
    return icon;
  }

  placeQuill() {
    const { name, shiny, quill } = this.nameRefs ?? {};
    if (!quill) return;
    const x = (shiny ? shiny.x + shiny.width * shiny.scaleX : name.x + name.displayWidth) + 3, y = name.y + 3;
    quill.icon.setPosition(x, y);
    quill.hit.setPosition(x + QUILL[0].length / 2, y + QUILL.length / 2);
  }

  drawLock(layer, shut) {
    const s = this.scene, icon = s.add.graphics().setPosition(LOCK_X, LOCK_Y);
    this.paintLock(icon, shut);
    const hit = s.add.rectangle(LOCK_X + LOCK_SHUT[0].length / 2, LOCK_Y + LOCK_SHUT.length / 2, QUILL_HIT, QUILL_HIT, 0, 0).setOrigin(0.5).setInteractive({ useHandCursor: true });
    hit.on('pointerup', this.tap(() => this.toggleLock()));
    layer.add([icon, hit]);
    return { icon, hit };
  }
  paintLock(icon, shut) {
    if (!icon) return;
    const colors = LOCK_COLOR[shut ? 'shut' : 'open'];
    icon.clear();
    (shut ? LOCK_SHUT : LOCK_OPEN).forEach((row, y) => [...row].forEach((cell, x) => { if (colors[cell] !== undefined) icon.fillStyle(colors[cell]).fillRect(x, y, 1, 1); }));
  }

  async toggleLock() {
    if (!this.lock || this.locking || this.renaming || !this.finish || this.transitioning) return;
    const s = this.scene, mon = this.party[this.index];
    playSelect(s);
    this.locking = true;
    try {
      const view = await this.lock();
      if (!this.container || !this.finish || this.party[this.index] !== mon) return;
      if (!view) { await this.notice(s.words('own.evolveLockFailed')); return; }
      mon.summary.lock = view;
      this.paintLock(this.nameRefs?.evolveLock?.icon, view.locked);
      if (this.page === PROFILE) this.populate(this.pageC, PROFILE);
    } catch (error) {
      if (s.life.signal.aborted || !this.container) return;
      if (!(error instanceof LoadError)) console.error(error);
      await this.notice(s.words('own.evolveLockFailed'));
    } finally { this.locking = false; }
  }

  clear() {
    this.renameForm?.clear(); this.renaming = false; this.locking = false;
    this.release();
    this.descriptionScroll?.remove(); this.descriptionScroll = null;
    this.details?.clear(); this.details = null;
    for (const p of [this.pageC, this.transC]) p?.cleanup?.forEach(fn => fn());
    this.container?.destroy();
    this.container = this.pageC = this.transC = this.monLayer = this.tab = this.statsRefs = this.movesRefs = null;
  }
  destroy() { this.clear(); }
}
