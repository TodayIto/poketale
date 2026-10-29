// from pokerogue src/ui/handlers/message-ui-handler.ts @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/ui/handlers/battle-message-ui-handler.ts @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/phases/message-phase.ts @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-10-28. See view/LICENSE-NOTE.md.
import { addTextObject } from './text.js';
import { keyAction, playSelect } from './keys.js';
import { delay } from '../lifetime.js';
import { parseCodes, typeWithCodes, visibleCount } from './message-codes.js';

export const DEFAULT_HOLD = 1500;

const checkMs = (name, value) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new TypeError(`Invalid message ${name}: ${value}`);
  return value;
};

// Moves focus to the battle view parent so it receives keys. Left as is if focus is already inside
export function focusStage(parent) {
  const active = parent?.ownerDocument?.activeElement;
  if (!parent?.focus || active === parent || parent.contains?.(active)) return;
  parent.focus({ preventScroll: true });
}

export class BattleMessage {
  constructor(scene, parent, life) {
    this.scene = scene; this.parent = parent; this.life = life;
    this.bg = scene.add.sprite(0, 0, 'bg', '1').setOrigin(0, 1);
    this.container = scene.add.container(12, -39);
    this.text = addTextObject(scene, 0, 0, '', 'message', { wordWrap: { width: 1776, useAdvancedWrap: true }, maxLines: 2 });

    this.prompt = scene.add.sprite(286, 25, 'prompt', '1').setOrigin(0).setVisible(false);
    if (scene.anims && !scene.anims.exists?.('prompt')) {
      scene.anims.create({ key: 'prompt', frames: ['1', '2', '3', '4'].map(frame => ({ key: 'prompt', frame })), frameRate: 6, repeat: -1 });
    }
    this.container.add([this.text, this.prompt]);
    scene.ui.add([this.bg, this.container]);

    this.keyHandler = e => {
      const action = keyAction(e);
      if ((action === 'ok' || action === 'back') && !e.repeat && this.advance) { e.preventDefault(); this.advance(); }
    };
    this.pointerHandler = () => this.advance?.();
    parent.addEventListener('keydown', this.keyHandler);
    scene.input.on('pointerdown', this.pointerHandler);
  }

  async message(text, { wait = false, hold, promptDelay } = {}) {
    hold = checkMs('hold', hold); promptDelay = checkMs('promptDelay', promptDelay) ?? 0;

    const coded = parseCodes(text), codes = coded.delays.size || coded.sounds.size ? coded : null;
    if (coded.plain !== String(text ?? '')) text = coded.plain;
    let shown = 0;

    // Split paragraphs and wrap into two-line pages, so long messages cannot disappear below the window.
    const lines = this.text.getWrappedText(text);
    for (let i = 0; i < Math.max(1, lines.length); i += 2) {
      const page = lines.slice(i, i + 2).join('\n');
      if (codes) { await typeWithCodes(this, page, codes, shown); shown += visibleCount(page); } else await this.type(page);
      if (i + 2 < lines.length) { await this.waitForInput(); continue; }
      if (wait) {
        if (promptDelay) await delay(this.scene, promptDelay);
        await this.waitForInput();
        if (hold) await delay(this.scene, hold);
      } else {
        const ms = hold ?? (String(text ?? '').trim() ? DEFAULT_HOLD : 0);
        if (ms) await delay(this.scene, ms);
      }
    }
  }
  type(text) {
    this.text.setText(''); this.prompt.setVisible(false);
    const characters = Array.from(text);
    if (!characters.length) return Promise.resolve();
    return new Promise(resolve => {
      let index = 0;

      const finish = () => { timer.remove(); this.text.setText(text); this.advance = null; resolve(); };
      const timer = this.scene.time.addEvent({ delay: 20, repeat: characters.length - 1, callback: () => {
        this.text.setText(characters.slice(0, ++index).join(''));
        if (index === characters.length) finish();
      } });
      this.advance = finish;
    });
  }

  placePrompt() {
    const lines = String(this.text.text ?? '').split('\n');
    const probe = addTextObject(this.scene, 0, 0, lines.at(-1) ?? '', 'message');
    const width = probe.displayWidth; probe.destroy();
    this.prompt.setPosition(this.text.x + width + 2, this.text.y + (lines.length - 1) * 18 + 2);
  }

  showPrompt() {
    this.placePrompt();
    this.prompt.setVisible(true); this.prompt.play?.('prompt');
  }

  waitForInput() {
    this.showPrompt();
    focusStage(this.parent);
    return new Promise(resolve => {
      this.advance = () => { this.advance = null; this.prompt.stop?.(); this.prompt.setVisible(false); playSelect(this.scene); resolve(); };
    });
  }
  destroy() {
    this.advance = null;
    this.parent.removeEventListener('keydown', this.keyHandler);
    this.scene.input.off('pointerdown', this.pointerHandler);
  }
}
