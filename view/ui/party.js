// from pokerogue src/ui/handlers/party-ui-handler.ts @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-11-12. See view/LICENSE-NOTE.md.
// from pokerogue src/ui/utils/pokemon-icon-anim-helper.ts @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/ui/handlers/message-ui-handler.ts (showPrompt) @ 7d7da4a8 (AGPL-3.0-only)

import { addWindow } from './window.js';
import { uiRect } from './tap-back.js';
import { openSummary } from './summary.js';
import { playSelect, playError } from './keys.js';
import { openMenu } from './menu.js';
import { styledText, windowText, addGenderMark, STATUS_FRAMES, GENDER_COLORS } from './text.js';
import { nameShowsGender } from '../gender-mark.js';
import { tween, delay } from '../lifetime.js';
import { fixed } from '../game-speed.js';
import { fadeSwap } from './learn-move.js';
import { MoveInfoOverlay } from './move-info.js';

export async function partyFade(scene, swap) {
  const overlay = scene.add.rectangle(0, 0, 1920, 1080, 0).setOrigin(0).setDepth(10).setAlpha(0);
  try {
    await tween(scene, { targets: overlay, alpha: 1, duration: 250, ease: 'Sine.easeOut' });
    await delay(scene, 100);
    swap();
  } catch (error) { overlay.destroy(); throw error; }

  scene.tweens.add({ targets: overlay, alpha: 0, duration: 250, ease: 'Sine.easeIn', onComplete: () => overlay.destroy() });
}

const TEXT = Object.freeze(Object.fromEntries(Object.entries({ choose: 'choosePokemon', doWhat: 'doWhatWithThisPokemon', sendOut: 'sendOut', cancel: 'cancel',
  apply: 'apply', selectAMove: 'selectAMove', revive: 'revive', summary: 'summary' }).map(([name, key]) => [name, `party-ui-handler.${key}`])));
const CANCEL = 6;

const MAIN = { key: 'party_slot_main', pb: [4, 4], name: [24, 10], maxName: 76, lv: [32, 22], gender: [68, -9], status: [55, 0], hp: [8, 31] };
const BENCH = { key: 'party_slot', pb: [2, 12], name: [21, 2], maxName: 52, lv: [29, 14], gender: [36, 0], status: [43, 0], hp: [72, 6] };

const partyText = (scene, x, y, str, extra) => styledText(scene, x, y, str, 'PARTY', extra);
const CANCEL_STYLE = { fontSize: 44, padding: { top: 6, bottom: 12, left: 4 } };

const battlerCount = scene => (scene.double ? 2 : 1);

export function slotPosition(double, index) {
  if (index < (double ? 2 : 1)) return [9, -148.5 + (double ? -8 : 0) + 64 * index];
  return [143, -196 + (double ? -40 : 0) + (28 + (double ? 8 : 0)) * index];
}

export const PARTNER_ALPHA = 0.8;

const PARTNER_TEXT = { party_slot_main: [56, 22], party_slot: [96, 14] };

class PartySlot {
  constructor(menu, index, mon, icon) {
    const s = menu.scene, benched = index >= battlerCount(s), p = benched ? BENCH : MAIN;
    this.mon = mon; this.p = p; this.selected = false;
    const c = this.container = s.add.container(...slotPosition(!!s.double, index));
    this.bg = s.add.sprite(0, 0, p.key, this.frame()).setOrigin(0);
    this.pb = s.add.sprite(p.pb[0], p.pb[1], 'party_pb', 'party_pb');

    this.restY = p.pb[1] - 15;
    this.icon = s.add.sprite(p.pb[0], this.restY, icon.key, icon.frame).setOrigin(0.5, 0);
    let name = mon.name;
    const name0 = partyText(s, p.name[0], p.name[1], name).setOrigin(0);
    while (name0.displayWidth > p.maxName && name.length > 1) {
      name = `${name.slice(0, name.endsWith('.') ? -2 : -1).trimEnd()}.`;
      name0.setText(name);
    }
    this.name = name0;
    const [lx, ly] = p.lv;
    const objects = [this.bg, this.pb, this.icon, this.name,
      s.add.image(lx, ly, 'party_slot_overlay_lv').setOrigin(0),
      partyText(s, lx + 9, ly, String(mon.level)).setOrigin(0, 0.25)];

    if (GENDER_COLORS[mon.gender] && !nameShowsGender(name)) {
      const [color, shadow] = GENDER_COLORS[mon.gender];

      objects.push(addGenderMark(s, lx + p.gender[0], ly + p.gender[1], mon.gender, 'PARTY', { originY: 0.25, color, shadow }));
    }
    if (STATUS_FRAMES[mon.status]) objects.push(s.add.sprite(lx + p.status[0], ly + p.status[1], 'statuses', STATUS_FRAMES[mon.status]).setOrigin(0));

    if (mon.shiny) objects.push(s.add.image(this.name.x - 9, this.name.y + 3, 'shiny_star_small').setOrigin(0).setTint(0xf8c020));
    const [hx, hy] = p.hp;
    const ratio = mon.maxhp > 0 ? Math.max(0, Math.min(1, mon.hp / mon.maxhp)) : 0;
    objects.push(
      s.add.image(hx + 15, hy, 'party_slot_overlay_hp').setOrigin(1, 0),
      s.add.image(hx, hy, 'party_slot_hp_bar').setOrigin(0),
      s.add.sprite(hx + 16, hy + 2, 'party_slot_hp_overlay', ratio > 0.5 ? 'high' : ratio > 0.25 ? 'medium' : 'low').setOrigin(0).setScale(ratio, 1),

      partyText(s, hx + 100 - 3, hy + 7 - 2, `${mon.hp}/${mon.maxhp}`).setOrigin(1, 0),
    );
    if (mon.partner) {

      objects.forEach(o => o.setAlpha(PARTNER_ALPHA));
      const [tx, ty] = PARTNER_TEXT[p.key];
      objects.push(partyText(s, tx, ty, s.words('own.partnerMon', { trainerName: mon.partner }), { color: '#f8d030' }).setShadow(4, 5, '#806000').setOrigin(0, 0.25));
    }
    this.hit = s.add.rectangle(0, 0, benched ? 175 : 110, benched ? 24 : 49, 0, 0).setOrigin(0).setInteractive({ useHandCursor: true });
    this.hit.on('pointerover', () => menu.hover(index));
    this.hit.on('pointerdown', () => menu.tap(index));
    c.add([...objects, this.hit]);
  }
  frame() { return `${this.p.key}${this.mon.hp ? '' : '_fnt'}${this.selected ? '_sel' : ''}`; }
  select(selected) {
    if (this.selected === selected) return;
    this.selected = selected;
    this.bg.setFrame(this.frame()); this.pb.setFrame(selected ? 'party_pb_sel' : 'party_pb');
  }

  bob(toggled) { this.icon.y = this.restY + (toggled ? (this.selected ? -2 : -1) : 0); }
}

export class PartyMenu {
  constructor(scene) { this.scene = scene; }

  async choose({ party, forced = false, use = null, revive = false, remember = null, onOpen } = {}) {
    this.use = use; this.revive = !!revive && !use; this.remember = remember; this.scrollCursor = 0;
    if (this.finish) throw new Error('Party menu already open');
    if (!Array.isArray(party) || !party.length || party.length > 6) throw new Error('Expected 1–6 party slots');
    const scene = this.scene;
    const icons = await Promise.all(party.map(mon => scene.assets.icon(mon)));
    scene.life.check();
    if (this.finish) throw new Error('Party menu already open');
    this.party = party.map(m => ({ ...m })); this.forced = !!forced || this.revive;
    this.cursor = 0; this.lastRight = 0; this.lastLeft = 0; this.mode = 'party'; this.toggled = false;
    const menu = openMenu(scene, { input: action => this.input(action), close: () => this.clear(),
      paused: () => this.busy(),

      tapWindows: () => (this.busy() || !['party', 'options'].includes(this.mode) || (this.forced && this.mode === 'party') ? null : this.windows()) });

    this.finish = choice => {
      if (this.fading) return;
      this.fading = true;
      partyFade(scene, () => menu.finish(choice)).catch(menu.fail);
    };
    this.abort = menu.abort;

    Object.assign(this, { shown: menu.shown, tapped: menu.tapped, tapReady: menu.tapReady });
    this.fading = true;
    partyFade(scene, () => {
      this.fading = false; onOpen?.(); this.draw(icons);
      if (remember) { this.setCursor(remember.cursor ?? 0); this.showOptions(); }
      scene.options.parent.focus({ preventScroll: true });
    })
      .catch(menu.fail);
    return menu.promise;
  }
  draw(icons) {
    const s = this.scene;
    const c = this.container = s.add.container(0, 0); s.ui.add(c);
    c.add(s.add.image(0, 0, s.double ? 'party_bg_double' : 'party_bg').setOrigin(0, 1));
    this.slots = this.party.map((mon, i) => new PartySlot(this, i, mon, icons[i]));
    c.add(this.slots.map(slot => slot.container));

    const cancel = this.cancelButton = s.add.container(291, -16);
    this.cancelBg = s.add.sprite(0, 0, 'party_cancel', 'party_cancel');
    this.cancelPb = s.add.sprite(-17, 0, 'party_pb', 'party_pb');
    const cancelHit = s.add.rectangle(-26, -8, 52, 16, 0, 0).setOrigin(0).setInteractive({ useHandCursor: true });
    cancelHit.on('pointerover', () => this.hover(CANCEL));
    cancelHit.on('pointerdown', () => this.tap(CANCEL));
    cancel.add([this.cancelBg, this.cancelPb,
      partyText(s, -10, -7, s.words(TEXT.cancel), CANCEL_STYLE), cancelHit]);
    if (s.double && this.forced) cancel.setAlpha(0.5);
    c.add(cancel);

    this.messageBox = addWindow(s, 1, -31, 262, 30);
    this.messageText = windowText(s, 10, -22, '', { maxLines: 2 }).setOrigin(0);
    this.prompt = s.add.image(0, 0, 'prompt', '2').setOrigin(0).setVisible(false);
    this.optionBox = s.add.container(0, 0);

    this.promptHit = s.add.rectangle(0, -180, 320, 180, 0, 0).setOrigin(0).setInteractive().setVisible(false);
    this.promptHit.on('pointerdown', this.tapped(() => this.input('ok')));
    c.add([this.messageBox, this.messageText, this.prompt, this.optionBox, this.promptHit]);
    if (this.remember) { this.moveInfo = new MoveInfoOverlay(s); c.add(this.moveInfo.container); }
    this.timer = s.time.addEvent({ delay: fixed(200), loop: true, callback: () => {
      this.toggled = !this.toggled; this.slots.forEach(slot => slot.bob(this.toggled));
    } });
    this.setCursor(0, true);
    this.shown();
  }
  showText(text) {

    const two = text.includes('\n');
    const width = this.optionsWidth ? 262 - Math.max(this.optionsWidth - 56, 0) : 262;
    this.messageBox.setVisible(true).setSize(width, two ? 42 : 30).setY(two ? -43 : -31);
    this.messageText.setVisible(true).setText(text).setY(two ? -37 : -22);
    this.prompt.setVisible(false);
  }
  hideText() { this.messageBox.setVisible(false); this.messageText.setVisible(false); this.prompt.setVisible(false); }
  showPrompt(text) {
    this.mode = 'prompt'; this.shown();
    this.showText(text);

    const lines = text.split('\n');
    const probe = windowText(this.scene, 0, 0, lines.at(-1));
    const width = probe.displayWidth; probe.destroy();
    this.prompt.setPosition(this.messageText.x + width + 2, this.messageText.y + (lines.length - 1) * 18 + 2).setVisible(true);
    this.promptHit.setVisible(true);
  }
  setCursor(cursor, force = false) {
    if (cursor === this.cursor && !force) return;
    this.cursor = cursor;
    this.slots.forEach((slot, i) => slot.select(i === cursor));
    const onCancel = cursor === CANCEL;
    this.cancelBg.setFrame(onCancel ? 'party_cancel_sel' : 'party_cancel');
    this.cancelPb.setFrame(onCancel ? 'party_pb_sel' : 'party_pb');
    if (onCancel) this.hideText(); else this.showText(this.scene.words(TEXT.choose));
  }
  hover(index) {
    if (this.fading || this.mode !== 'party' || index === this.cursor) return;
    if (index >= battlerCount(this.scene) && index < CANCEL) this.lastRight = index;
    this.setCursor(index);
  }

  busy() { return this.fading || this.sub; }
  tap(index) {
    if (this.busy() || !this.tapReady()) return;
    if (this.mode === 'prompt') return this.input('ok');
    if (this.mode !== 'party') return;
    this.setCursor(index); this.input('ok');
  }

  input(action) {
    if (this.busy()) return;
    if (this.mode === 'prompt') {
      if (action === 'ok' || action === 'back') { playSelect(this.scene); this.mode = 'party'; this.shown(); this.promptHit.setVisible(false); this.showText(this.scene.words(TEXT.choose)); }
      return;
    }
    if (this.mode === 'options') return this.optionInput(action);
    const n = this.party.length, c = this.cursor, field = battlerCount(this.scene);
    if (c < field) this.lastLeft = c;
    if (c >= field && c < CANCEL) this.lastRight = c;
    switch (action) {
    case 'ok':
      if (c !== CANCEL && this.party[c].partner) { playError(this.scene); return this.showPrompt(this.party[c].blocked ?? ''); }
      if (c !== CANCEL) { playSelect(this.scene); return this.showOptions(); }
      if (this.forced) return playError(this.scene);
      return this.cancel();
    case 'back': return this.cancel();
    }

    if (action === 'up') this.setCursor(c ? (c < CANCEL ? c - 1 : n - 1) : CANCEL);
    if (action === 'down') this.setCursor(c < CANCEL ? (c < n - 1 ? c + 1 : CANCEL) : 0);
    if (action === 'left' && (c === CANCEL || c >= field)) this.setCursor(this.lastLeft);
    if (action === 'right') { if (n <= field) this.setCursor(CANCEL); else if (c < field) this.setCursor(this.lastRight || field); }
    if (this.cursor !== c) playSelect(this.scene);
  }

  cancel() { if (!this.forced) { playSelect(this.scene); this.finish(null); } }
  showOptions() {
    this.shown();
    if (this.remember) return this.showRememberOptions();
    const s = this.scene, slot = this.party[this.cursor];

    this.optionList = slot.active ? ['cancel'] : ['sendOut', 'cancel'];
    // REVIVAL_BLESSING: "Revive" regardless of slot position (updateOptions case PartyUiMode.REVIVAL_BLESSING)
    if (this.revive) this.optionList = ['revive', 'cancel'];
    // MOVE_MODIFIER: move indices (showMovePp: "name PP/max") / MODIFIER: "Use"
    if (this.use) this.optionList = [...(slot.moves ? slot.moves.map((_, i) => i) : ['apply']), 'cancel'];

    if (slot.summary && !(this.use && slot.moves)) this.optionList.splice(this.optionList.length - 1, 0, 'summary');
    const label = o => typeof o === 'number' ? `${slot.moves[o].name} ${slot.moves[o].pp}/${slot.moves[o].maxpp}` : s.words(TEXT[o]);
    this.mode = 'options'; this.optionCursor = 0;
    const count = this.optionList.length;
    const texts = this.optionList.map(o => windowText(s, 0, 0, label(o), { maxLines: 1 }).setOrigin(0));

    const width = this.optionsWidth = Math.max(Math.max(...texts.map(t => t.displayWidth)) + 24, 94);
    const height = 16 * count + 13;
    this.optionBox.add(addWindow(s, 319 - width, -1 - height, width, height));
    this.optionRect = uiRect(319 - width, -1 - height, width, height);
    texts.forEach((t, i) => {
      const o = count - 1 - i;
      t.setPosition(319 + 19 - width, -1 - 6 - 16 * o - 16);
      const hit = s.add.rectangle(319 - width + 4, -1 - 6 - 16 * o - 16, width - 8, 16, 0, 0).setOrigin(0).setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => this.setOptionCursor(i));
      hit.on('pointerdown', this.tapped(() => { this.setOptionCursor(i); this.optionInput('ok'); }));
      this.optionBox.add([t, hit]);
    });
    this.optionCursorObj = s.add.image(0, 0, 'cursor').setOrigin(0);
    this.optionBox.add(this.optionCursorObj);
    this.showText(s.words(this.use && slot.moves ? TEXT.selectAMove : TEXT.doWhat));
    this.setOptionCursor(0);
  }
  setOptionCursor(i) {
    if (this.mode !== 'options') return;
    this.optionCursor = i;

    this.optionCursorObj.setPosition(319 + 8 - this.optionsWidth, -1 - 19 - 16 * (this.optionList.length - 1 - i));

    if (this.moveInfo) {
      const option = this.optionList[i];
      if (typeof option === 'number') this.moveInfo.show(this.remember.moves[option]); else this.moveInfo.clear();
    }
  }

  showRememberOptions(cursor = 0) {
    const s = this.scene, moves = this.remember.moves, total = moves.length, start = this.scrollCursor;
    let list = moves.map((_, i) => i);
    if (total > 9) {
      const end = Math.min(total, start + (!start || start + 8 >= total ? 8 : 7));
      list = [...(start ? ['up'] : []), ...list.slice(start, end), ...(end < total ? ['down'] : [])];
    }
    this.optionBox.removeAll(true); this.optionCursorObj = null;
    this.optionList = [...list, 'cancel'];
    this.mode = 'options';
    const count = this.optionList.length;
    const label = o => (o === 'up' ? '↑' : o === 'down' ? '↓' : o === 'cancel' ? s.words(TEXT.cancel) : moves[o].name);
    const texts = this.optionList.map(o => windowText(s, 0, 0, label(o), { maxLines: 1 }).setOrigin(0));
    const width = this.optionsWidth = Math.max(Math.max(...texts.map(t => t.displayWidth)) + 24, 94);
    const height = 16 * count + 13;
    this.optionBox.add(addWindow(s, 319 - width, -1 - height, width, height));
    this.optionRect = uiRect(319 - width, -1 - height, width, height);
    texts.forEach((t, i) => {
      const o = count - 1 - i, y = -1 - 6 - 16 * o, option = this.optionList[i];
      t.setPosition(319 + 19 - width, y - 16);
      const hit = s.add.rectangle(319 - width + 4, y - 16, width - 8, 16, 0, 0).setOrigin(0).setInteractive({ useHandCursor: true });
      const scroll = option === 'up' || option === 'down';
      if (!scroll) hit.on('pointerover', () => this.setOptionCursor(i));
      hit.on('pointerdown', this.tapped(() => {
        if (this.busy()) return;
        if (scroll) { playSelect(s); return this.scrollRemember(option === 'down'); }
        this.setOptionCursor(i); this.optionInput('ok');
      }));
      this.optionBox.add([t, hit]);
    });
    this.optionCursorObj = s.add.image(0, 0, 'cursor').setOrigin(0);
    this.optionBox.add(this.optionCursorObj);
    this.hideText();
    this.setOptionCursor(cursor);
  }

  scrollRemember(down) {
    this.scrollCursor += down ? 1 : -1;
    if (this.scrollCursor === 1) this.scrollCursor += down ? 1 : -1;
    const keep = this.optionCursor;
    this.showRememberOptions(0);
    const list = this.optionList;
    this.setOptionCursor(list[keep] === 'up' ? 1 : list[keep] === 'down' ? keep - 1 : Math.min(keep, list.length - 1));
  }

  moveRememberCursor(cursor) {
    const before = this.optionCursor, list = this.optionList, total = this.remember.moves.length;
    if (cursor === before) return false;
    if (total > 9) {
      if (Math.abs(cursor - before) === list.length - 1) {
        this.scrollCursor = cursor ? total - 8 : 0;
        this.showRememberOptions(cursor);
        return true;
      }
      const down = cursor > before;
      let scroll = false;
      if (down && list[cursor] === 'down') { scroll = true; this.scrollCursor++; }
      else if (!down && !cursor && this.scrollCursor) { scroll = true; this.scrollCursor--; }
      if (scroll && this.scrollCursor === 1) this.scrollCursor += down ? 1 : -1;
      if (scroll) { this.showRememberOptions(before); return true; }
    }
    this.setOptionCursor(cursor);
    return true;
  }

  rememberInput(action) {
    const count = this.optionList.length, before = this.optionCursor;
    if (action === 'back') { playSelect(this.scene); return this.finish(null); }
    if (action === 'up' || action === 'down') {
      if (this.moveRememberCursor(action === 'up' ? (before ? before - 1 : count - 1) : (before < count - 1 ? before + 1 : 0))) playSelect(this.scene);
      return;
    }
    if (action !== 'ok') return;
    playSelect(this.scene);
    const option = this.optionList[before];
    if (option === 'cancel') return this.finish(null);
    if (typeof option === 'number') this.finish({ kind: 'remember', move: option });
  }

  optionInput(action) {

    if (this.busy()) return;
    if (this.remember) return this.rememberInput(action);
    const count = this.optionList.length, before = this.optionCursor;
    if (action === 'back') { playSelect(this.scene); return this.clearOptions(); }
    if (action === 'up' || action === 'down') {
      this.setOptionCursor(action === 'up' ? (before ? before - 1 : count - 1) : (before < count - 1 ? before + 1 : 0));
      if (this.optionCursor !== before) playSelect(this.scene);
      return;
    }
    if (action !== 'ok') return;
    playSelect(this.scene);
    if (this.optionList[this.optionCursor] === 'cancel') return this.clearOptions();
    const slot = this.party[this.cursor], option = this.optionList[this.optionCursor];
    if (option === 'summary') return openSummary(this);

    const blocked = typeof option === 'number' ? slot.moves[option].blocked : slot.blocked;
    if (blocked) { this.clearOptions(); return this.showPrompt(blocked); }
    if (this.use) return this.finish({ kind: 'target', slot: this.cursor, ...(typeof option === 'number' ? { move: option } : {}) });
    this.finish({ kind: 'switch', slot: this.cursor });
  }

  windows() {
    const box = this.messageBox, out = [];
    if (box?.visible) out.push(uiRect(box.x, box.y, box.width, box.height));
    if (this.mode === 'options' && this.optionRect) out.push(this.optionRect);
    if (this.moveInfo?.container.visible) { const b = this.moveInfo.box; out.push(uiRect(b.x, b.y, b.width, b.height)); }
    return out;
  }
  clearOptions() {
    this.optionRect = null;
    this.optionBox.removeAll(true); this.optionCursorObj = null; this.optionsWidth = 0;
    this.mode = 'party'; this.shown(); this.showText(this.scene.words(TEXT.choose));
    this.promptHit.setVisible(false);
  }
  clear() {
    this.moveInfo?.destroy(); this.moveInfo = null;
    this.timer?.remove(); this.timer = null;
    this.container?.destroy(); this.container = null; this.finish = null; this.slots = []; this.fading = false;
  }
  destroy() { if (this.finish) this.abort(); }
}

export async function showPartyBackdrop(scene, { party, cursor = 0 }) {
  if (!Array.isArray(party) || !party.length || party.length > 6) throw new Error('Expected 1–6 party slots');
  const s = scene;
  const icons = await Promise.all(party.map(mon => s.assets.icon(mon)));
  s.life.check();
  const menu = { scene: s, hover() {}, tap() {} };
  let container = null, timer = null, slots = [];
  await fadeSwap(s, () => {
    container = s.add.container(0, 0);
    s.ui.addAt(container, 0);
    container.add(s.add.image(0, 0, 'party_bg').setOrigin(0, 1));
    slots = party.map((mon, i) => new PartySlot(menu, i, { ...mon, name: mon.name }, icons[i]));
    for (const [i, slot] of slots.entries()) { slot.hit.disableInteractive?.(); slot.select(i === cursor); }
    container.add(slots.map(slot => slot.container));
    const cancel = s.add.container(291, -16);
    cancel.add([s.add.sprite(0, 0, 'party_cancel', 'party_cancel'), s.add.sprite(-17, 0, 'party_pb', 'party_pb'),
      partyText(s, -10, -7, s.words(TEXT.cancel), CANCEL_STYLE)]);
    container.add(cancel);
    let toggled = false;
    timer = s.time.addEvent({ delay: fixed(200), loop: true, callback: () => { toggled = !toggled; slots.forEach(slot => slot.bob(toggled)); } });
    s.messages.bg.setVisible(true); s.messages.container.setVisible(true);
  });
  const clear = () => { timer?.remove(); timer = null; container?.destroy(); container = null; };
  return {
    async close() {
      if (!container) return;
      await fadeSwap(s, () => { clear(); s.messages.bg.setVisible(false); s.messages.container.setVisible(false); }).catch(() => clear());
    },
    destroy: clear,
  };
}
