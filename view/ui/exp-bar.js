// from pokerogue src/ui/battle-info/player-battle-info.ts @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-11-22. See view/LICENSE-NOTE.md.
// from pokerogue src/ui/battle-info/battle-info.ts (setLevelDisplay) @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/ui/containers/party-exp-bar.ts @ 7d7da4a8 (AGPL-3.0-only)

import Phaser from 'phaser';
import { addTextObject } from './text.js';
import { MAX_LEVEL } from '../../engine/mon.mjs'; // level cap (single source) instead of battle-scene.ts getMaxExpLevel
import { tween, delay } from '../lifetime.js';

export const EXP_IMAGES = {
  overlay_exp: 'images/ui/overlay_exp.png', overlay_exp_label: 'images/ui/text_images/ko/battle_ui/overlay_exp_label_ko.png',
  numbers_red: 'images/ui/numbers_red.png', party_exp_bar: 'images/ui/party_exp_bar.png',
};
export const EXP_SOUNDS = ['se/exp.wav', 'se/level_up.wav'];
const EXP_BAR_WIDTH = 510;
const EXP_GAINS_DURATION_BASE = 1650; // BattleInfo.EXP_GAINS_DURATION_BASE
const ease = name => Phaser.Tweens.Builders.GetEaseFunction(name);

export function startSound(scene, path) {
  const { audio, ready } = scene.audio.load(path);
  let voice, stopped = false;
  const start = () => {
    if (stopped || audio.error || audio.readyState < 2 || scene.life.signal.aborted) return;
    voice = scene.audio.adopt(audio.cloneNode(), 0.6, path); // 0.6 x the sound effects' level (view/audio.js)
    scene.audio.active.add(voice);
    voice.onended = () => scene.audio.active.delete(voice);
    voice.play().catch(() => scene.audio.active.delete(voice));
  };
  ready.then(() => (scene.audio.suspended ? scene.audio.awake().then(start) : start())); // if collapsed while loading, start on expand (view/audio.js)
  return { stop() { stopped = true; if (voice) { voice.pause(); scene.audio.active.delete(voice); } } };
}

export function setLevelDisplay(info, level, red = false, reuse = false) {
  const scene = info.scene, digits = String(level);
  const key = red ? 'numbers_red' : 'numbers';
  const x = info.levelX - 8 * Math.max(digits.length - 3, 0);
  if (reuse && info.level.x === x) {
    const [label, numbers] = info.level.list;
    if (label?.texture?.key === 'overlay_lv' && numbers?.list?.length === digits.length &&
        numbers.list.every((glyph, i) => glyph.texture.key === key && glyph.frame.name === digits[i])) return;
  }
  info.level.removeAll(true);
  info.level.add(scene.add.image(5.5, 0, 'overlay_lv').setOrigin(1, 0.5));
  const numbers = scene.add.container(9.5, -0.5);
  [...digits].forEach((char, i) => numbers.add(scene.add.image(i * 8, 0, key, char)));
  info.level.add(numbers);
  info.level.setX(x);
}

export class ExpBar {
  constructor(scene, info) {
    this.scene = scene; this.info = info; this.levelShown = 0; this.ratio = 0;
    this.label = scene.add.image(-91, 20, 'overlay_exp_label').setOrigin(1, 1);
    this.bar = scene.add.image(-98, 18, 'overlay_exp').setOrigin(0);

    this.maskRect = scene.make.graphics({ add: false }).setScale(6).fillStyle(0xffffff).fillRect(127, 126, 85, 2);
    this.mask = this.maskRect.createGeometryMask();
    this.bar.setMask(this.mask);
    if (!info.mini && this.bar.width === 85 && this.bar.height === 2) {
      const { bar } = this, willRender = bar.willRender;
      // Phaser's Container reads the child's mask after willRender, including during position tweens.
      bar.willRender = camera => willRender.call(bar, camera) && this.prepareBar(camera);
    }
    info.container.add([this.label, this.bar]);
  }

  prepareBar(camera) {
    const { bar, mask, maskRect, info } = this, { x, y } = info.container;
    const zoom = camera.zoom, width = maskRect.x;
    // The old mask is in world space: a sliding/bobbing box does not carry it along.
    if (x === 310 && y === -72 && camera === this.scene.cameras.main && (zoom === 1 || zoom === 0.5)) {
      if (width !== this.lastBarWidth || zoom !== this.lastBarZoom) {
        this.lastBarWidth = width; this.lastBarZoom = zoom;
        const edge = width * zoom, pixels = Math.round(edge);
        // Away from a half pixel, snapping the cut keeps the same covered screen pixels.
        // Leave ambiguous rasterization edges and out-of-range values to the original stencil.
        this.barCrop = width >= 0 && width <= EXP_BAR_WIDTH && Math.abs(edge - pixels) <= 0.375 ? pixels / (6 * zoom) : null;
      }
      if (this.barCrop !== null) {
        if (bar.mask) bar.clearMask();
        if (this.appliedBarCrop !== this.barCrop) {
          bar.setCrop(0, 0, this.barCrop, 2);
          this.appliedBarCrop = this.barCrop;
        }
        return this.barCrop > 0;
      }
    }
    if (!bar.mask) { bar.setCrop().setMask(mask); this.appliedBarCrop = undefined; }
    return true;
  }
  /** Set instantly (updatePokemonExpDisplay skip) */
  set(level, ratio = 0) {
    this.scene.tweens.killTweensOf(this.maskRect);
    this.levelShown = level; this.ratio = ratio;
    setLevelDisplay(this.info, level, level >= MAX_LEVEL);
    this.maskRect.x = EXP_BAR_WIDTH * ratio;
  }

  async gain(level, ratio) {
    const final = Math.max(level, this.levelShown);
    for (let next = this.levelShown + 1; next <= final; next++) await this.animate(next, true, final, 1);
    await this.animate(final, false, final, ratio);
  }
  async animate(level, levelUp, finalLevel, ratio) {
    const lastLevel = levelUp ? level - 1 : level;
    const durationMultiplier = ease('Sine.easeIn')(1 - Math.max(lastLevel - 100, 0) / 150);
    const levelDurationMultiplier = Math.max(ease('Cubic.easeIn')(1 - Math.min(finalLevel - lastLevel, 10) / 10), 0.1);
    const duration = this.info.container.visible ? ratio * EXP_GAINS_DURATION_BASE * durationMultiplier * levelDurationMultiplier : 0;
    let sound;
    if (duration) sound = startSound(this.scene, 'se/exp.wav');
    await tween(this.scene, { targets: this.maskRect, ease: 'Sine.easeIn', x: ratio * EXP_BAR_WIDTH, duration });
    sound?.stop();
    this.ratio = ratio;
    if (!levelUp) return;
    this.scene.audio.play('se/level_up.wav').catch(() => {});
    this.levelShown = level;
    setLevelDisplay(this.info, level, level >= MAX_LEVEL);
    await delay(this.scene, 500 * levelDurationMultiplier);
    this.maskRect.x = 0; this.ratio = 0;
  }
  destroy() { this.scene.tweens.killTweensOf(this.maskRect); this.bar.clearMask(); this.mask.destroy(); this.maskRect.destroy(); }
}

export class PartyExpBar {
  constructor(scene) {
    this.scene = scene;
    const c = this.container = scene.add.container(320, -148).setVisible(false);

    this.bg = scene.add.nineslice(0, 0, 'party_exp_bar', undefined, 8, 18, 21, 5, 6, 4).setOrigin(0);
    this.text = addTextObject(scene, 22, 4, '', 'info').setOrigin(0);
    c.add([this.bg, this.text]);
    scene.fieldUI.add(c);
  }
  async show(icon, exp) {
    const s = this.scene;

    this.icon?.destroy();
    this.icon = s.add.container(-8 + 40 * 0.5, 15 - 30 * 0.5).setScale(0.5);
    this.icon.add(s.add.sprite(0, 0, icon.key, icon.frame).setOrigin(0.5, 0));
    this.container.add(this.icon);
    this.text.setText(`+${exp}`);
    this.bg.setSize(this.text.displayWidth + 28, 18);
    s.fieldUI.bringToTop(this.container);
    this.container.setX(320).setVisible(true);
    await tween(s, { targets: this.container, x: 320 - (this.bg.width - 5), duration: 500, ease: 'Sine.easeOut' });
    await delay(s, 500);
    await tween(s, { targets: this.container, x: 320, duration: 500, ease: 'Sine.easeIn' });
    this.container.setVisible(false);
    this.icon.destroy(); this.icon = null;
  }
  destroy() { this.container.destroy(); }
}
