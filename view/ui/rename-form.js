// from pokerogue src/ui/handlers/rename-form-ui-handler.ts @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/ui/handlers/form-modal-ui-handler.ts @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/ui/handlers/modal-ui-handler.ts @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/ui/text.ts (TOOLTIP_CONTENT, SETTINGS_LABEL, addTextInputObject) @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-10-28. See view/LICENSE-NOTE.md.

import { addWindow, WINDOW_VARIANT_IMAGES } from './window.js';
import { themeColors } from './theme.js';
import { styledText, FONT_FAMILY } from './text.js';
import { playSelect } from './keys.js';

const TEXT = { title: '포켓몬의 닉네임은?', label: '닉네임', rename: '닉네임 바꾸기', cancel: '취소' };
const MAX_LENGTH = 20;

const WIDTH = 160, HEIGHT = 20 + 26 + 28, MARGIN = [0, 0, 48, 0];

// TOOLTIP_CONTENT (64px, window text colour), SETTINGS_LABEL (92px, orange) - view/ui/text.js
const formText = (scene, x, y, str, style) => styledText(scene, x, y, str, style);

export class RenameForm {
  constructor(scene) { this.scene = scene; }

  async open(name) {
    if (this.finish) throw new Error('Rename form already open');
    const s = this.scene;
    await Promise.all(Object.entries(WINDOW_VARIANT_IMAGES).map(([key, path]) => s.assets.image(key, path)));
    s.life.check();
    this.build(String(name ?? ''));
    return new Promise((resolve, reject) => {
      const abort = () => { this.clear(); reject(s.life.signal.reason); };
      s.life.signal.addEventListener('abort', abort, { once: true });
      this.finish = value => { s.life.signal.removeEventListener('abort', abort); this.clear(); resolve(value); };
    });
  }

  build(name) {
    const s = this.scene;

    const [top, right, bottom, left] = MARGIN;
    const c = this.container = s.add.container((320 - (WIDTH + (right - left))) / 2, (-180 - (HEIGHT + (bottom - top))) / 2);

    c.add(s.add.rectangle(-c.x, -180 - c.y, 320, 180, 0, 0).setOrigin(0).setInteractive());
    c.add([addWindow(s, 0, 0, WIDTH, HEIGHT), formText(s, WIDTH / 2, 4, TEXT.title, 'SETTINGS_LABEL').setOrigin(0.5, 0)]);

    const label = formText(s, 10, 31, TEXT.label, 'TOOLTIP_CONTENT');
    const labelWidth = label.width ?? label.displayWidth * 6;
    const inputWidth = labelWidth < 320 ? 80 : 80 - (labelWidth - 320) / 5.5;
    this.field = { x: 70 + (80 - inputWidth) + 4, y: 28 - 2, width: (inputWidth * 5.5) / 6, height: 116 / 6 };
    c.add([label, addWindow(s, 70 + (80 - inputWidth), 28, inputWidth, 16, 'xthin')]);

    const buttons = [TEXT.rename, TEXT.cancel].map((str, i) => {
      const text = formText(s, 0, 8, str, 'TOOLTIP_CONTENT').setOrigin(0.5, 0.5);
      const bg = addWindow(s, 0, 0, text.displayWidth + 8, 16, 'thin').setOrigin(0.5, 0);
      bg.setInteractive({ useHandCursor: true });

      bg.on('pointerover', () => bg.setTint?.(0xbbbbbb));
      bg.on('pointerout', () => bg.clearTint?.());
      bg.on('pointerdown', () => { if (!this.showing) (i ? this.cancel() : this.submit()); });
      const holder = s.add.container(0, 0);
      holder.add([bg, text]);
      return { holder, width: text.displayWidth + 8 };
    });
    const total = buttons.reduce((sum, b) => sum + b.width, 0) + 12 * (buttons.length - 1);
    let x = (WIDTH - total) / 2;
    for (const b of buttons) { b.holder.setPosition(x + b.width / 2, HEIGHT - (16 + 8)); x += b.width + 12; c.add(b.holder); }
    s.ui.add(c);
    this.input_ = this.makeInput(name);

    this.baseY = c.y;
    c.setAlpha(0); c.y += 24;
    this.showing = true;

    this.sync = () => this.place();

    s.tweens.add({ targets: c, y: this.baseY, alpha: 1, duration: 1000, ease: 'Sine.easeInOut', onUpdate: this.sync,
      onComplete: () => { this.showing = false; this.place(); } });
    s.scale.on('resize', this.sync);
    this.place();

    this.focusTimer = setTimeout(() => { this.input_?.focus?.({ preventScroll: true }); this.input_?.select?.(); }, 50);
  }

  makeInput(name) {
    const s = this.scene, parent = s.options.parent, doc = parent?.ownerDocument;
    if (!doc?.createElement) return null;
    const input = doc.createElement('input');
    input.type = 'text'; input.maxLength = MAX_LENGTH; input.value = name; input.spellcheck = false;
    input.setAttribute('autocomplete', 'off'); input.setAttribute('aria-label', TEXT.label);
    const [color] = themeColors(s, 'WINDOW') ?? ['#f8f8f8'];
    Object.assign(input.style, { position: 'fixed', margin: '0', padding: '0', border: '0', outline: 'none', background: 'transparent',
      color, fontFamily: FONT_FAMILY, zIndex: '1', boxSizing: 'border-box' });

    input.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === 'Enter') { e.preventDefault(); this.submit(); }
      else if (e.key === 'Escape') { e.preventDefault(); this.cancel(); }
    });
    input.addEventListener('pointerdown', e => e.stopPropagation());
    parent.appendChild(input);
    return input;
  }

  place() {
    const input = this.input_, canvas = this.scene.game?.canvas;
    if (!input || !this.container || !canvas?.getBoundingClientRect) return;
    const rect = canvas.getBoundingClientRect(), k = (rect.width / 1920) * 6;
    const c = this.container;
    Object.assign(input.style, {
      left: `${rect.left + (c.x + this.field.x) * k}px`, top: `${rect.top + (180 + c.y + this.field.y) * k}px`,
      width: `${this.field.width * k}px`, height: `${this.field.height * k}px`,
      fontSize: `${(64 / 6) * k}px`, lineHeight: `${this.field.height * k}px`, opacity: String(c.alpha ?? 1),
    });
  }

  // Pad/keys (outside the input field): confirm = rename, back = cancel
  input(action) {
    if (!this.finish) return;
    if (action === 'ok') this.submit();
    else if (action === 'back') this.cancel();
  }

  submit() {
    if (!this.finish) return;
    const value = String(this.input_?.value ?? this.value ?? '').trim().slice(0, MAX_LENGTH);
    playSelect(this.scene);
    this.finish(value);
  }

  cancel() { this.finish?.(null); }

  clear() {
    clearTimeout(this.focusTimer);
    if (this.sync) this.scene.scale.off('resize', this.sync);
    this.sync = null;
    this.input_?.remove?.(); this.input_ = null;
    this.container?.destroy(); this.container = null;
    this.finish = null; this.showing = false;
    this.scene.options?.parent?.focus?.({ preventScroll: true });
  }
  destroy() { this.clear(); }
}
