// from pokerogue src/ui/handlers/ball-ui-handler.ts @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/ui/handlers/command-ui-handler.ts @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-10-30. See view/LICENSE-NOTE.md.

import { addWindow } from './window.js';
import BAG_ICONS from '../../data/bag-icons.json' with { type: 'json' };
import { playSelect, playError } from './keys.js';
import { openMenu } from './menu.js';
import { styledText } from './text.js';
import { uiRect } from './tap-back.js';
import { fixed } from '../game-speed.js';
import { LoadError } from '../retry.js';

const CANCEL_TEXT = 'command-ui-handler.ballCancel';
const ROWS = 6;

export const BALL_FRAMES = { pokeball: 'pb', greatball: 'gb', ultraball: 'ub', masterball: 'mb', luxuryball: 'lb' };
export const ballFrame = id => BALL_FRAMES[id] ?? 'pb';

const windowText = (scene, x, y, str, extra, style = 'WINDOW') => styledText(scene, x, y, str, style, extra);
const GREY = ['#a0a0a0', '#505050'];

export function openBag(menu) {
  if (menu.bag.blocked) { menu.notice = menu.bag.blocked; return menu.draw(); }
  const prompt = menu.promptText?.text ?? '';
  menu.mode = 'bag'; menu.notice = '';
  menu.detailsMask?.destroy(); menu.detailsMask = null;
  menu.container.removeAll(true); menu.drawnMode = null;
  const bagMenu = menu.scene.bagMenu ??= new BagMenu(menu.scene);
  bagMenu.choose({ bag: menu.bag, party: menu.party ?? [], prompt }).then(choice => {
    if (!menu.finish) return;
    if (choice) return menu.finish(choice);
    menu.mode = 'command'; menu.cursor = 1; menu.draw();
  }, error => {
    if (!menu.finish) return;
    if (!(error instanceof LoadError)) return menu.fail(error);
    menu.cursor = 1; menu.showBlocked(menu.scene.words('own.openFailed'), 'command');
  });
}

export const loadItemIcons = scene => scene.assets.image('bag_items', 'images/items.png', BAG_ICONS.items);

export class BagMenu {
  constructor(scene) { this.scene = scene; }

  async choose({ bag, party = [], prompt = '' }) {
    if (this.finish) throw new Error('Bag menu already open');
    if (!Array.isArray(bag?.pockets) || !bag.pockets.length) throw new Error('Expected bag pockets');
    const scene = this.scene;
    await loadItemIcons(scene);
    scene.life.check();
    if (this.finish) throw new Error('Bag menu already open');
    this.bag = bag; this.party = party; this.prompt = prompt;
    this.pocket = Math.max(0, bag.pockets.findIndex(p => p.items.length)); this.cursor = 0; this.scroll = 0; this.sub = false;
    const menu = openMenu(scene, { input: action => this.input(action), close: () => this.clear(),
      paused: () => this.sub,
      tapWindows: () => (this.sub ? null : this.windows()) });
    Object.assign(this, { finish: menu.finish, fail: menu.fail, abort: menu.abort });
    this.listenScroll();
    try { this.draw(); scene.options.parent.focus({ preventScroll: true }); }
    catch (error) { menu.fail(error); }
    return menu.promise;
  }
  get items() { return this.bag.pockets[this.pocket].items; }

  // Tapping empty space: inside the bag window is not back
  windows() { return this.rect ? [this.rect] : []; }

  get length() { return this.items.length + 1; }
  draw() {
    const s = this.scene;
    this.container?.destroy();
    const c = this.container = s.add.container(0, 0); s.ui.add(c);

    this.promptText = windowText(s, 12, -39, this.prompt, { wordWrap: { width: 1110 }, maxLines: 2 }, 'WINDOW_WHITE');
    c.add(this.promptText);

    const measure = str => { const t = windowText(s, 0, 0, str); const w = t.displayWidth; t.destroy(); return w; };
    const all = this.bag.pockets.flatMap(p => p.items);
    const namesWidth = Math.max(0, ...all.map(i => measure(i.name)));
    const countsWidth = Math.max(0, ...all.map(i => measure(`×${i.count}`)));
    const tabs = this.bag.pockets.map(p => measure(p.name));
    const tabsWidth = tabs.reduce((a, b) => a + b, 0) + 8 * (tabs.length - 1);
    const content = Math.max(64, namesWidth + 4 + countsWidth, measure(s.words(CANCEL_TEXT)), tabsWidth - 24);
    const width = 50 + content, height = 128, x = 320 - 51 - content, top = -49 - height;
    this.box = s.add.container(x, 0); c.add(this.box);
    this.box.add(addWindow(s, 0, top, width, height));
    this.rect = uiRect(x, top, width, height);
    const rowY = r => top + 9 + 16 * r;

    let tabX = 18;
    this.bag.pockets.forEach((pocket, i) => {
      const t = windowText(s, tabX, rowY(0), pocket.name);
      if (i !== this.pocket) t.setColor(GREY[0]).setShadow(3, 3, GREY[1]);
      const hit = s.add.rectangle(tabX - 2, rowY(0), tabs[i] + 4, 16, 0, 0).setOrigin(0).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => { if (i !== this.pocket) playSelect(s); this.setPocket(i); });
      this.box.add([t, hit]);
      tabX += tabs[i] + 8;
    });

    this.rows = [];
    for (let r = 0; r < ROWS; r++) {
      const index = this.scroll + r;
      if (index >= this.length) break;
      const y = rowY(r + 1);
      const item = this.items[index];
      const hit = s.add.rectangle(4, y, width - 8, 16, 0, 0).setOrigin(0).setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => { if (!this.drag?.moved) this.setCursor(index); });

      hit.on('pointerdown', () => this.setCursor(index));
      hit.on('pointerup', () => { if (!this.drag?.moved && this.cursor === index) this.input('ok'); });
      if (!item) {

        this.box.add([windowText(s, 18, y, s.words(CANCEL_TEXT)), hit]);
        this.rows.push({ index });
        continue;
      }

      const icon = item.target === 'enemy'
        ? s.add.image(24, top + 15 + 16 * (r + 1), 'pb', ballFrame(item.id))
        : s.add.image(24, top + 15 + 16 * (r + 1), 'bag_items', item.id).setScale(0.5);
      const name = windowText(s, 36, y, item.name);
      const count = windowText(s, 36 + namesWidth + 4 + countsWidth, y, `×${item.count}`).setOrigin(1, 0);
      if (item.blocked) for (const t of [name, count]) t.setColor(GREY[0]).setShadow(3, 3, GREY[1]);
      this.box.add([icon, name, count, hit]);
      this.rows.push({ index, icon });
    }

    const arrow = (y, label, rows) => {
      const hit = s.add.rectangle(width - 18, y, 16, 16, 0, 0).setOrigin(0).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => this.scrollBy(rows));
      this.box.add([windowText(s, width - 14, y, label), hit]);
    };
    if (this.scroll > 0) arrow(rowY(1), '↑', -(ROWS - 1));
    if (this.scroll + ROWS < this.length) arrow(rowY(ROWS), '↓', ROWS - 1);
    this.top = top; this.listTop = top + 25; this.listBottom = top + 25 + 16 * ROWS; this.boxX = [x, x + width];
    this.cursorObj = s.add.image(0, 0, 'cursor'); this.box.add(this.cursorObj);
    this.setCursor(this.cursor, true);
  }

  // Scrolls the list by rows (the cursor follows into the visible rows). ui/select if it scrolled
  scrollBy(rows) {
    if (this.sub) return false;
    const max = Math.max(0, this.length - ROWS), scroll = Math.min(max, Math.max(0, this.scroll + rows));
    if (scroll === this.scroll) return false;
    this.scroll = scroll;
    this.cursor = Math.min(scroll + ROWS - 1, Math.max(scroll, this.cursor));
    this.draw(); playSelect(this.scene);
    return true;
  }

  listenScroll() {
    const input = this.scene.input;
    if (!input?.on) return;
    const inList = p => { const x = p.worldX / 6, y = p.worldY / 6 - 180;
      return x >= this.boxX?.[0] && x <= this.boxX?.[1] && y >= this.listTop && y <= this.listBottom; };
    this.onWheel = (pointer, over, dx, dy) => { if (!this.sub && dy && inList(pointer)) this.scrollBy(Math.sign(dy)); };
    this.onDown = pointer => { this.drag = inList(pointer) ? { y: pointer.worldY, scroll: this.scroll, moved: false } : null; };
    this.onMove = pointer => {
      const drag = this.drag;
      if (!drag || !pointer.isDown || this.sub) return;
      const rows = Math.trunc((drag.y - pointer.worldY) / 6 / 16);
      if (rows) drag.moved = true;
      if (drag.moved) this.scrollBy(drag.scroll + rows - this.scroll);
    };

    this.onUp = () => { this.drag = null; };
    input.on('wheel', this.onWheel); input.on('pointerdown', this.onDown); input.on('pointermove', this.onMove);
    input.on('pointerup', this.onUp); input.on('pointerupoutside', this.onUp);
  }
  setPocket(i) {
    if (i === this.pocket || i < 0 || i >= this.bag.pockets.length) return;
    this.pocket = i; this.cursor = 0; this.scroll = 0; this.promptText.setText(this.prompt);
    this.draw();
  }
  setCursor(index, force = false) {
    if (index === this.cursor && !force) return;
    this.cursor = index;

    const scroll = Math.min(Math.max(this.scroll, index - ROWS + 1), index);
    if (scroll !== this.scroll) { this.scroll = scroll; return this.draw(); }

    this.cursorObj.setPosition(12, this.top + 16 + 16 * (index - this.scroll + 1));
    this.wiggle(this.rows.find(row => row.index === index)?.icon);
  }

  wiggle(icon) {
    this.wiggleTween?.stop(); this.wiggleTween?.destroy?.(); this.wiggleTween = null;

    if (this.wiggled?.icon.scene) this.wiggled.icon.setX(this.wiggled.x).setAngle(0);
    this.wiggled = null;
    if (!icon || !this.scene.tweens?.chain) return;
    this.wiggled = { icon, x: icon.x };
    this.wiggleTween = this.scene.tweens.chain({ targets: icon, loop: -1, loopDelay: fixed(1000), tweens: [
      { x: icon.x + 4, angle: 27.5, duration: fixed(150), ease: 'Cubic.easeOut', yoyo: true },
      { x: icon.x - 4, angle: -27.5, duration: fixed(150), delay: fixed(250), ease: 'Cubic.easeOut', yoyo: true },
    ] });
  }

  input(action) {
    if (this.sub) return;
    if (this.promptText.text !== this.prompt) this.promptText.setText(this.prompt);
    const { cursor, pocket } = this;
    const moved = () => { if (this.cursor !== cursor || this.pocket !== pocket) playSelect(this.scene); };
    switch (action) {
    case 'back': playSelect(this.scene); return this.finish(null);
    case 'up': this.setCursor(this.cursor ? this.cursor - 1 : this.length - 1); return moved();
    case 'down': this.setCursor(this.cursor < this.length - 1 ? this.cursor + 1 : 0); return moved();
    case 'left': this.setPocket((this.pocket + this.bag.pockets.length - 1) % this.bag.pockets.length); return moved();
    case 'right': this.setPocket((this.pocket + 1) % this.bag.pockets.length); return moved();
    case 'ok': {
      const item = this.items[this.cursor];
      if (item?.blocked) { playError(this.scene); return this.promptText.setText(item.blocked); }
      playSelect(this.scene);
      if (!item) return this.finish(null);
      if (item.target !== 'party') return this.finish({ kind: 'item', item: item.id });
      return this.chooseTarget(item);
    }
    }
  }

  chooseTarget(item) {
    const party = this.party.map((slot, i) => ({ ...slot, blocked: item.slots?.[i]?.blocked, moves: item.slots?.[i]?.moves }));
    this.sub = true;

    const onOpen = () => { this.container?.setVisible(false); this.wiggle(null); };
    this.scene.party.choose({ party, forced: false, use: { item: item.id }, onOpen }).then(target => {
      if (!this.finish) return;
      if (target) return this.finish({ kind: 'item', item: item.id, slot: target.slot, ...(target.move !== undefined ? { move: target.move } : {}) });
      this.sub = false; this.container.setVisible(true); this.setCursor(this.cursor, true);
    }, error => { if (this.finish) this.fail(error); });
  }
  clear() {
    this.finish = this.fail = null;
    const input = this.scene.input;
    if (input?.off) { input.off('wheel', this.onWheel); input.off('pointerdown', this.onDown); input.off('pointermove', this.onMove); input.off('pointerup', this.onUp); input.off('pointerupoutside', this.onUp); }
    this.drag = null;
    this.wiggle(null);
    this.container?.destroy(); this.container = null; this.rows = []; this.sub = false;
  }
  destroy() { if (this.finish) this.abort(); }
}
