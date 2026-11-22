// from pokerogue src/ui/handlers/command-ui-handler.ts @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-11-22. See view/LICENSE-NOTE.md.
// from pokerogue src/ui/handlers/fight-ui-handler.ts @ 7d7da4a8 (AGPL-3.0-only)

import { zTextures } from './z-art.js';
import { playSelect } from './keys.js'; // the swap's select sound
import { themeColors } from './theme.js'; // the arrows take the prompt text's colours
import { DYNAMAX_RED } from '../dynamax.js'; // the Dynamax red (the button's glow is the grow's red)
export const GIMMICK = 4;

const BUTTON = { x: 185, y: -23.7, scale: 1.3 };

export const FIGHT_CURSOR = { tera: ['cursor_tera', 0.7], mega: ['cursor_mega', 0.7], ultra: ['cursor_ultra', 0.7], z: ['cursor_z', 0.7],
  dynamax: ['cursor_dmax', 0.7] };

const BUTTON_IMAGE = { mega: 'mega_button', ultra: 'ultra_button', z: 'z_button', dynamax: 'dmax_button' };
const PAINTED = new Set(['mega', 'ultra', 'z', 'dynamax']);

const BUTTON_X = { dynamax: BUTTON.x - 2 };
const BUTTON_SCALE = { dynamax: 1 };
const WRAP = 910;

const ARROW = { rows: ['..o..', '.ooo.', 'ooooo'], top: -42, bottom: -8 };
const SLOT_HIT = { left: 164, right: 201, top: -48, split: [-36, -12], bottom: 0 };
// The Dynamax button lights with the tera glow in this red
const DYNAMAX_RGB = [(DYNAMAX_RED >> 16) & 255, (DYNAMAX_RED >> 8) & 255, DYNAMAX_RED & 255];

const BUTTON_GLOW = { mega: 'stellar', ultra: 'stellar', z: 'stellar', dynamax: DYNAMAX_RGB };
function lightButton(scene, button, type) { scene.tera?.glow(button, type); }

export class GimmickButton {

  static create(menu, { mega = false, tera = '', ultra = false, z = null, dynamax = null } = {}) {
    const first = mega ? new GimmickButton(menu, 'mega', '') : ultra ? new GimmickButton(menu, 'ultra', '') : tera ? new GimmickButton(menu, 'tera', String(tera))
      : Array.isArray(z) && z.some(Boolean) ? new GimmickButton(menu, 'z', '') : null;
    const max = dynamax && Array.isArray(dynamax.moves) && dynamax.moves.some(Boolean) ? new GimmickButton(menu, 'dynamax', '') : null;
    const buttons = [first, max].filter(Boolean);
    return buttons.length ? new GimmickButtons(menu, buttons) : null;
  }
  constructor(menu, kind, type) { this.menu = menu; this.kind = kind; this.type = type; this.on = false; this.x = BUTTON_X[kind] ?? BUTTON.x; }
  get scene() { return this.menu.scene; }

  toggle(on) {
    this.on = on;
    if (this.kind === 'z') this.menu.showZ?.(on);
    if (this.kind === 'dynamax') this.menu.showMax?.(on);
  }
  /** Fields added to the Choice when a move is picked */
  choice() { return this.on ? { [this.kind]: true } : {}; }

  draw(container, visible = true) {
    const s = this.scene;
    this.button = this.kind === 'tera'
      ? s.add.sprite(this.x, BUTTON.y, 'button_tera', this.frame())
      : s.add.image(this.x, BUTTON.y, BUTTON_IMAGE[this.kind]);
    this.button.setScale(BUTTON_SCALE[this.kind] ?? BUTTON.scale).setVisible(visible);
    container.add(this.button);
  }
  frame() {
    const frame = this.type.toLowerCase();
    return this.scene.textures?.get?.('button_tera')?.has?.(frame) === false ? 'unknown' : frame;
  }
  /** Lit while the cursor is on it (toggleTeraButton) */
  light(selected) {
    if (!this.button || selected === this.selected) return;
    this.selected = selected;

    lightButton(this.scene, this.button, selected ? (this.kind === 'tera' ? this.type : BUTTON_GLOW[this.kind]) : '');
  }
  stop() { this.button = null; this.selected = undefined; }
}

class GimmickButtons {
  constructor(menu, buttons) { this.menu = menu; this.buttons = buttons; this.index = 0; }
  get scene() { return this.menu.scene; }
  /** The button the slot shows now */
  get shown() { return this.buttons[this.index]; }
  /** The button that is on (its move menu is open), or undefined */
  get lit() { return this.buttons.find(button => button.on); }

  swap(step) {
    const count = this.buttons.length;
    if (count < 2) return false;
    this.shown.light(false);
    this.index = (this.index + step + count) % count;
    this.buttons.forEach((button, i) => button.button?.setVisible(i === this.index));
    this.update();
    playSelect(this.scene);
    return true;
  }

  input(action) {
    const m = this.menu;
    const move = cursor => { m.cursor = cursor; m.notice = ''; m.draw(); return true; };
    if (m.mode === 'command') {
      if (m.cursor === GIMMICK) {
        if (action === 'ok') {
          const at = this.shown;
          this.buttons.forEach(button => { if (button !== at && button.on) button.toggle(false); });
          at.toggle(true); m.mode = 'fight'; m.cursor = m.rememberedMove?.() ?? Math.max(0, m.moves.findIndex(usable)); m.notice = ''; m.draw(); return true; // cursor memory
        }
        if (action === 'right') return move(0);
        if (action === 'up' || action === 'down') { this.swap(action === 'up' ? -1 : 1); return true; } // one button: nothing (same in the source)
        return action !== 'back'; // left does nothing. Back is handled by ActionMenu (to Fight)
      }
      if (action === 'left' && (m.cursor === 0 || m.cursor === 2)) return move(GIMMICK);
      if (action === 'ok' && m.cursor === 0) this.buttons.forEach(button => { if (button.on) button.toggle(false); }); // plain Fight
      return false;
    }
    const lit = this.lit;
    if (m.mode === 'fight' && action === 'back' && lit) { m.rememberMove?.(); lit.toggle(false); m.mode = 'command'; return move(GIMMICK); }
    return false;
  }
  /** Fields added to the Choice when a move is picked */
  choice() { return this.lit?.choice() ?? {}; }
  /** At the end of ActionMenu.draw (the container is emptied on every redraw) */
  draw(container, fight) {
    const m = this.menu, s = this.scene;
    this.stop();
    if (this.buttons.some(button => PAINTED.has(button.kind))) zTextures(s); // our pictures, painted once (z-art.js)
    if (fight) {
      const lit = this.lit;
      if (lit) { const [key, scale] = FIGHT_CURSOR[lit.kind]; m.cursorObj.setTexture(key).setScale(scale); }
      return;
    }

    m.promptWrap = WRAP;
    this.buttons.forEach((button, i) => button.draw(container, i === this.index));
    const area = (left, top, width, height, press) => {
      const hit = s.add.rectangle(left, top, width, height, 0, 0).setOrigin(0).setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => m.hover(GIMMICK));
      hit.on('pointerdown', m.tapped(press));
      container.add(hit);
      return hit;
    };
    const confirm = () => { m.cursor = GIMMICK; m.input('ok'); };
    // one button: its touch area as before (26x30 at the picture)
    if (this.buttons.length < 2) { area(this.shown.x - 13, BUTTON.y - 15, 26, 30, confirm); return; }

    const [upEnd, downStart] = SLOT_HIT.split, width = SLOT_HIT.right - SLOT_HIT.left;
    const swapAt = step => () => { m.hover(GIMMICK); this.swap(step); };
    area(SLOT_HIT.left, SLOT_HIT.top, width, upEnd - SLOT_HIT.top, swapAt(-1)).arrow = 'up';
    area(SLOT_HIT.left, upEnd, width, downStart - upEnd, confirm);
    area(SLOT_HIT.left, downStart, width, SLOT_HIT.bottom - downStart, swapAt(1)).arrow = 'down';
    drawArrow(s, container, BUTTON.x, ARROW.top, false);
    drawArrow(s, container, BUTTON.x, ARROW.bottom, true);
  }

  update() {
    const m = this.menu;
    if (m.mode !== 'command' || !this.shown.button) return;
    m.cursorObj.setVisible(m.cursor !== GIMMICK);
    this.buttons.forEach((button, i) => button.light(i === this.index && m.cursor === GIMMICK));
  }

  stop() { this.buttons.forEach(button => button.stop()); }
}

function drawArrow(scene, container, x, y, down) {
  const [ink, shade] = (themeColors(scene, 'MESSAGE') ?? ['#f8f8f8', '#6b5a73']).map(hex => parseInt(hex.slice(1), 16));
  const rows = down ? [...ARROW.rows].reverse() : ARROW.rows, left = x - rows[0].length / 2;
  for (const [colour, offset] of [[shade, 0.5], [ink, 0]]) {
    rows.forEach((row, r) => [...row].forEach((c, col) => {
      if (c !== 'o') return;
      const pixel = scene.add.rectangle(left + col + offset, y + r + offset, 1, 1, colour).setOrigin(0);
      pixel.arrowPixel = down ? 'down' : 'up';
      container.add(pixel);
    }));
  }
}

// same as action-menu.js moveEnabled (avoids a circular import)
const usable = move => !!move && !move.disabled && !move.zOff && !move.maxOff && (move.pp === undefined || move.pp > 0);
