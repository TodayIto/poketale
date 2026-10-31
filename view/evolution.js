// from pokerogue src/phases/evolution-phase.ts @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/ui/handlers/evolution-scene-ui-handler.ts @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/phases/end-evolution-phase.ts @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/animations.ts (doSpiralUpward; doArcDownward; doCycle; doCircleInward; doSpray) @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-10-30. See view/LICENSE-NOTE.md.

import { placeSprite } from './sprites/placement.js';
import { tween, delay } from './lifetime.js';
import { fadeSwap } from './ui/learn-move.js';
import { keyAction } from './ui/keys.js';
import { frameMs } from './ui/message-codes.js';

export const EVOLUTION_IMAGES = { default_bg: 'images/arenas/default_bg.png', evo_sparkle: 'images/effects/evo_sparkle.png' };
export const EVOLUTION_SOUNDS = ['se/charge.wav', 'se/beam.wav', 'se/sparkle.wav', 'se/shine.wav'];
const BGM = 'bw/evolution', FANFARE = 'bw/evolution_fanfare';
const VIDEO = 'images/effects/evo_bg.mp4';
const sin = (index, amplitude) => amplitude * Math.sin(index * (Math.PI / 128));
const cos = (index, amplitude) => amplitude * Math.cos(index * (Math.PI / 128));
const randInt = range => (range <= 1 ? 0 : Math.floor(Math.random() * range));

// Center of default_bg 320x132 (evolutionBaseBg.displayWidth/2, displayHeight/2)
const CX = 160, CY = 66;

export class EvolutionScene {
  constructor(scene) { this.scene = scene; }

  // Evolution screen images and sounds (prefetched at the battle's ending text - scene.end)
  load() {
    const s = this.scene;
    return Promise.all([...Object.entries(EVOLUTION_IMAGES).map(([key, path]) => s.assets.image(key, path, null)),
      ...EVOLUTION_SOUNDS.map(path => s.audio.load(path).ready)]);
  }

  sprite(asset, tintFill) {
    const s = this.scene, place = placeSprite(asset, 'enemy'), body = asset.bounds;
    const holder = s.add.container(CX, CY);
    const sprite = s.add.sprite(0, 0, asset.key, asset.frame)
      .setOrigin(place.originX, (body.top + body.bottom) / 2 / asset.height).setScale(place.scale);
    if (s.anims.exists(asset.key)) sprite.play(asset.key);
    if (tintFill) sprite.setTintFill(0xffffff);
    holder.add(sprite);
    return holder;
  }

  async start(from) {
    const s = this.scene;
    if (this.container) throw new Error('Evolution scene already open');
    const asset = await s.assets.mon(from, false);
    await Promise.all(Object.entries(EVOLUTION_IMAGES).map(([key, path]) => s.assets.image(key, path, null)));
    s.life.check();
    this.from = from;
    await fadeSwap(s, () => {
      const c = this.container = s.add.container(0, -180);
      s.ui.addAt(c, 0);
      this.base = s.add.image(0, 0, 'default_bg').setOrigin(0);
      this.bgOverlay = s.add.rectangle(0, 0, 320, 180, 0x262626).setOrigin(0).setAlpha(0);
      c.add([this.base, this.bgOverlay]);
      this.video = this.makeVideo();
      if (this.video) c.add(this.video);
      this.pokemonSprite = this.sprite(asset, false);
      this.pokemonTintSprite = this.sprite(asset, true).setAlpha(0);
      c.add([this.pokemonSprite, this.pokemonTintSprite]);

      this.overlay = s.add.rectangle(0, -180, 320, 180 - 48, 0xffffff).setOrigin(0).setAlpha(0);
      s.ui.add(this.overlay);
      s.messages.bg.setVisible(true); s.messages.container.setVisible(true);
    });
  }

  makeVideo() {
    try {
      const v = this.scene.add.video(0, 0).setOrigin(0).setScale(0.4359673025).setVisible(false);
      v.loadURL(this.scene.assets.url(VIDEO), true, 'anonymous');

      v.on('playing', () => { if (this.videoWanted) v.setVisible(true); else v.pause(); });
      v.on('error', () => { this.videoFailed = true; });
      return v;
    } catch { return null; }
  }

  get cancelable() { return !!this.canCancel && !this.cancelled; }
  async evolve(to, { canCancel = true } = {}) {
    const s = this.scene;
    if (!this.container) throw new Error('Call startEvolution first');
    const asset = await s.assets.mon(to, false);
    await Promise.all(EVOLUTION_SOUNDS.map(path => s.audio.load(path).ready));
    s.life.check();
    this.pokemonEvoSprite = this.sprite(asset, false).setVisible(false);
    this.pokemonEvoTintSprite = this.sprite(asset, true).setVisible(false);
    this.container.add([this.pokemonEvoSprite, this.pokemonEvoTintSprite]);
    this.cancelled = false; this.canCancel = false;
    const parent = s.options.parent;
    const key = e => {

      if (!this.canCancel || this.cancelled || e.repeat || keyAction(e) !== 'back') return;
      e.preventDefault(); e.stopImmediatePropagation(); this.cancelled = true;
    };
    const unlisten = s.life.listen(parent, 'keydown', key, true);
    try {
      await delay(s, 1000);
      s.audio.cry(this.from).catch(() => {});

      await delay(s, 1000);
      this.playBgm(BGM);
      await tween(s, { targets: this.bgOverlay, alpha: 1, delay: 500, duration: 1500, ease: 'Sine.easeOut' });
      s.time.delayedCall(1000, () => {
        this.videoWanted = true;
        if (!this.video || this.videoFailed || !this.container) return;
        try { this.video.setCurrentTime(0); this.video.play(); } catch {                                 }
      });
      s.audio.play('se/charge.wav').catch(() => {});
      this.doSpiralUpward();

      await tween(s, { targets: this.pokemonTintSprite, alpha: 1, duration: 2000 });
      this.pokemonSprite.setVisible(false);
      await delay(s, 1100);
      s.audio.play('se/beam.wav').catch(() => {});
      this.doArcDownward();

      await delay(s, 1500);
      this.pokemonEvoTintSprite.setScale(0.25).setVisible(true);
      this.canCancel = canCancel;
      await this.doCycle(1, 15);
      this.canCancel = false;
      if (this.cancelled) {

        this.pokemonSprite.setVisible(true);
        this.pokemonTintSprite.setScale(1);
        this.stopBgm();
        await tween(s, { targets: [this.video, this.pokemonTintSprite, this.pokemonEvoSprite, this.pokemonEvoTintSprite].filter(Boolean), alpha: 0, duration: 250 });
        this.video?.setVisible(false); this.videoWanted = false;
        return false;
      }

      s.audio.play('se/sparkle.wav').catch(() => {});
      this.pokemonEvoSprite.setVisible(true);
      this.doCircleInward();
      await delay(s, 900);
      s.audio.play('se/shine.wav').catch(() => {});
      this.doSpray();
      await tween(s, { targets: this.overlay, alpha: 1, duration: 250, ease: 'Sine.easeIn' });
      this.bgOverlay.setAlpha(1); this.video?.setVisible(false); this.videoWanted = false;
      await tween(s, { targets: [this.overlay, this.pokemonEvoTintSprite], alpha: 0, duration: 2000, delay: 150, ease: 'Sine.easeIn' });
      await tween(s, { targets: this.bgOverlay, alpha: 0, duration: 250 });

      this.stopBgm();
      await delay(s, 250);
      s.audio.cry(to).catch(() => {});
      await delay(s, 1250);
      this.playBgm(FANFARE);
      return true;
    } finally {
      unlisten();
    }
  }

  async end() {
    const s = this.scene;
    if (!this.container) return;
    await fadeSwap(s, () => this.clear(false));
  }

  playBgm(key) { this.bgm = this.scene.audio.replaceBgmUntilEnd(key); }

  stopBgm() { this.bgm?.fadeOut(100); this.bgm = null; }

  particle(x, y) { const p = this.scene.add.image(x, y, 'evo_sparkle'); this.container.add(p); return p; }

  // Calls update() every frame and removes the particle when it returns false (tweens.addCounter repeat -1)
  run(particle, update) {
    if (update() === false) { particle.destroy(); return; }
    const timer = this.scene.tweens.addCounter({ repeat: -1, duration: frameMs(1), onRepeat: () => {
      if (!particle.scene || update() === false) { particle.destroy(); timer.remove(); }
    } });
  }
  every(frames, repeat, callback, onStart) {
    this.scene.tweens.addCounter({ repeat, duration: frameMs(frames), onRepeat: callback, onStart });
  }
  doSpiralUpward() {
    let cycle = 0;
    this.every(8, 8, () => { for (let i = 0; i < 4; i++) this.spiralParticle(16 * cycle + i * 64); cycle++; });
  }
  spiralParticle(trigIndex) {
    const p = this.particle(CX, 0);
    let f = 0, amp = 48;
    this.run(p, () => {
      if (f && p.y <= 8) return false;
      p.setPosition(CX, 88 - (f * f) / 80);
      p.y += sin(trigIndex, amp) / 4; p.x += cos(trigIndex, amp);
      p.setScale(1 - f / 80);
      trigIndex += 4;
      if (f % 2 === 1) amp--;
      f++;
    });
  }
  doArcDownward() {
    this.every(1, 6, () => { for (let i = 0; i < 9; i++) this.arcParticle(i * 16); });
  }
  arcParticle(trigIndex) {
    const p = this.particle(CX, 0).setScale(0.5);
    let f = 0, amp = 8;
    this.run(p, () => {
      if (f && p.y >= 88) return false;
      p.setPosition(CX, 8 + (f * f) / 5);
      p.y += sin(trigIndex, amp) / 4; p.x += cos(trigIndex, amp);
      amp = 8 + sin(f * 4, 40);
      f++;
    });
  }

  async doCycle(currentCycle, finalCycle) {
    const s = this.scene, isFinal = currentCycle === finalCycle, duration = 500 / currentCycle;
    s.tweens.add({ targets: this.pokemonTintSprite, scale: 0.25, ease: 'Cubic.easeInOut', duration, yoyo: !isFinal });
    await tween(s, { targets: this.pokemonEvoTintSprite, scale: 1, ease: 'Cubic.easeInOut', duration, yoyo: !isFinal });
    if (isFinal) { this.pokemonTintSprite.setVisible(false); return; }
    return this.doCycle(currentCycle + 0.5, finalCycle);
  }
  doCircleInward() {
    const batch = speed => { for (let i = 0; i < 16; i++) this.circleParticle(i * 16, speed); };
    this.scene.tweens.addCounter({ duration: frameMs(32), onStart: () => batch(4), onComplete: () => batch(8) });
  }
  circleParticle(trigIndex, speed) {
    const p = this.particle(CX, CY);
    let amp = 120;
    this.run(p, () => {
      if (amp <= 8) return false;
      p.setPosition(CX + cos(trigIndex, amp), CY + sin(trigIndex, amp));
      amp -= speed; trigIndex += 4;
    });
  }
  doSpray() {
    let f = 0;
    this.every(1, 48, () => {
      if (!f) for (let i = 0; i < 8; i++) this.sprayParticle(i);
      else if (f < 50) this.sprayParticle(randInt(8));
      f++;
    });
  }
  sprayParticle(trigIndex) {
    const p = this.particle(CX, CY);
    let f = 0, yOffset = 0;
    const speed = 3 - randInt(8), amp = 48 + randInt(64);
    this.run(p, () => {
      if (!(f & 3)) yOffset++;
      if (trigIndex >= 128) return false;
      p.setPosition(CX + (speed * f) / 3, CY + yOffset);
      p.y += -sin(trigIndex, amp);
      if (f > 108) p.setScale(1 - (f - 108) / 20);
      trigIndex++; f++;
    });
  }

  suspend() {
    if (!this.video?.isPlaying()) return;
    this.video.pause(); this.videoHeld = true;
  }
  resume() {
    if (!this.videoHeld) return;
    this.videoHeld = false;
    if (this.video && this.videoWanted) this.video.resume();
  }

  clear(stopFanfare = true) {
    this.canCancel = false; this.videoHeld = false;
    if (stopFanfare) this.stopBgm();
    this.video?.stop?.();
    this.container?.destroy(); this.overlay?.destroy();
    this.container = this.overlay = this.video = null;
  }
  destroy() { this.clear(true); }
}
