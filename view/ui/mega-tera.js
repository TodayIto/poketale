// from pokerogue src/ui/handlers/command-ui-handler.ts @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/ui/handlers/fight-ui-handler.ts @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-10-28. See view/LICENSE-NOTE.md.

export const GIMMICK = 4;

const BUTTON = { x: 185, y: -23.7, scale: 1.3 };

const FIGHT_CURSOR = { tera: ['cursor_tera', 0.7], mega: ['mega_bracelet', 0.5] };

export class GimmickButton {

  static create(menu, { mega = false, tera = '' } = {}) {
    if (mega) return new GimmickButton(menu, 'mega', '');
    if (tera) return new GimmickButton(menu, 'tera', String(tera));
    return null;
  }
  constructor(menu, kind, type) { this.menu = menu; this.kind = kind; this.type = type; this.on = false; }
  get scene() { return this.menu.scene; }

  input(action) {
    const m = this.menu;
    const move = cursor => { m.cursor = cursor; m.notice = ''; m.draw(); return true; };
    if (m.mode === 'command') {
      if (m.cursor === GIMMICK) {
        if (action === 'ok') { this.on = true; m.mode = 'fight'; m.cursor = m.rememberedMove?.() ?? Math.max(0, m.moves.findIndex(usable)); m.notice = ''; m.draw(); return true; }
        if (action === 'right') return move(0);
        return action !== 'back';
      }
      if (action === 'left' && (m.cursor === 0 || m.cursor === 2)) return move(GIMMICK);
      if (action === 'ok' && m.cursor === 0) this.on = false;
      return false;
    }
    if (m.mode === 'fight' && action === 'back' && this.on) { m.rememberMove?.(); this.on = false; m.mode = 'command'; return move(GIMMICK); }
    return false;
  }

  // Fields added to the Choice when a move is picked
  choice() { return this.on ? { [this.kind]: true } : {}; }

  draw(container, fight) {
    const m = this.menu, s = this.scene;
    this.stop();
    if (fight) {
      if (this.on) { const [key, scale] = FIGHT_CURSOR[this.kind]; m.cursorObj.setTexture(key).setScale(scale); }
      return;
    }

    m.promptText?.setWordWrapWidth?.(910);
    this.button = this.kind === 'tera'
      ? s.add.sprite(BUTTON.x, BUTTON.y, 'button_tera', this.frame())
      : s.add.image(BUTTON.x, BUTTON.y, 'mega_bracelet');
    this.button.setScale(BUTTON.scale);
    container.add(this.button);
    const hit = s.add.rectangle(BUTTON.x - 13, BUTTON.y - 15, 26, 30, 0, 0).setOrigin(0).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => m.hover(GIMMICK));
    hit.on('pointerdown', () => { m.cursor = GIMMICK; m.input('ok'); });
    container.add(hit);
  }
  frame() {
    const frame = this.type.toLowerCase();
    return this.scene.textures?.get?.('button_tera')?.has?.(frame) === false ? 'unknown' : frame;
  }

  update() {
    const m = this.menu;
    if (m.mode !== 'command' || !this.button) return;
    const selected = m.cursor === GIMMICK;
    m.cursorObj.setVisible(!selected);
    if (selected === this.selected) return;
    this.selected = selected;

    this.scene.tera?.glow(this.button, selected ? (this.kind === 'tera' ? this.type : 'stellar') : '');
  }

  stop() { this.button = null; this.selected = undefined; }
}

const usable = move => !!move && !move.disabled && (move.pp === undefined || move.pp > 0);
