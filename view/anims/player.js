// from pokerogue src/data/battle-anims.ts @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-10-30. See view/LICENSE-NOTE.md.

import Phaser from 'phaser';
import { animation, moveFile } from './data.js';
import { framePosition } from './geometry.js';
import { delay } from '../lifetime.js';
import { LoadError } from '../retry.js';
import { isPlayerSide, firstOnSide } from '../positions.js';

const PRIORITY = {
  0: ({ front }) => ['moveBelow', front],
  2: ({ bg, focus }) => (bg ? ['moveAbove', bg] : ['moveBelow', focus]),
  3: ({ focus }) => ['moveAbove', focus],
};
const FOCUS = { 1: 'target', 2: 'user' };

export class AnimationPlayer {

  constructor(scene, { enabled = true } = {}) { this.scene = scene; this.enabled = enabled; this.running = false; this.diagnostics = new Set(); this.prepared = new Map(); }

  prepare(files) {

    return Promise.all([...new Set(files)].sort().map(async file => {
      const source = animation(file);
      this.prepared.set(file, source);
      await Promise.all([await source].flat().filter(Boolean).map(anim => this.resources(anim).catch(error => {
        if (!(error instanceof LoadError)) throw error;
      })));
    }));
  }

  async playMove(id, side, targetSide, { onSubstitute = false } = {}) {
    return this.playFile(moveFile(id), side, targetSide, { onSubstitute });
  }
  playCommon(name, side, targetSide = side) {
    if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`Invalid common animation: ${name}`);
    return this.playFile(`common-${name}.json`, side, targetSide);
  }
  async resources(anim) {
    const { assets, audio } = this.scene;
    const work = [];
    if (anim.graphic) {
      const key = `anim:${anim.graphic}`;
      if (!assets.scene.textures.exists(key)) work.push(assets.loadImage(assets.url(`images/battle_anims/${encodeURIComponent(anim.graphic)}.png`)).then(img => {
        assets.life.check();
        if (!assets.scene.textures.exists(key)) assets.scene.textures.addSpriteSheet(key, img, { frameWidth: 96, frameHeight: 96 });
      }));
    }
    for (const event of Object.values(anim.frameTimedEvents ?? {}).flat()) {
      if (event.eventType === 'AnimTimedAddBgEvent' && event.resourceName) {
        work.push(assets.image(`anim-bg:${event.resourceName}`, `images/battle_anims/${encodeURIComponent(event.resourceName)}.png`, null));
      }
      if (event.eventType === 'AnimTimedSoundEvent' && event.resourceName) work.push(audio.load(`battle_anims/${event.resourceName}`).ready);
    }
    await Promise.all(work);
  }
  async playFile(file, side, targetSide, { variant, frameMs = 50, sound = true, onSubstitute = false } = {}) {
    if (!this.enabled) return;
    if (this.running) throw new Error('Animation already playing');

    const mark = (name, detail) => globalThis.performance?.mark?.(name, { detail: { file, side, ...detail } });
    mark('pb:anim-start');
    let framesAt = null;
    const scene = this.scene;
    let user = scene.requireMon(side), target = scene.requireMon(targetSide);

    const actors = { user: user.container, target: target.container };

    const shown = [user.container.visible, target.container.visible];

    if (onSubstitute && targetSide !== side) target = scene.effects.dollTarget(targetSide) ?? target;
    const source = await (this.prepared.get(file) ?? animation(file));
    if (!source) throw new Error(`Missing animation: ${file}`);
    const index = variant ?? (isPlayerSide(side) ? 0 : 1);
    const opposite = Array.isArray(source) && index === 1;
    const anim = Array.isArray(source) ? source[index] : source;
    if (!anim) throw new Error(`Missing variant ${index}: ${file}`);
    if (this.running) throw new Error('Animation already playing');
    this.running = true;
    const cache = [[], [], []], sounds = [], tweens = [];
    let bg, tail = 0;
    if (opposite) { [user, target] = [target, user]; shown.reverse(); }
    const originals = [...new Set([user.getSprite(), target.getSprite()])];
    const visible = originals.map(s => s.visible);
    const priorities = [];
    const setPriority = (sprite, frame) => {
      const front = (firstOnSide(scene, 'enemy') ?? firstOnSide(scene, 'player')).container;
      const [move, anchor] = PRIORITY[frame.priority]?.({ bg, front, focus: actors[FOCUS[frame.focus]] }) ?? [];
      if (anchor && scene.field.exists(anchor)) scene.field[move](sprite, anchor);
      else scene.field.bringToTop(sprite);
    };
    const eventAt = event => {
      if (event.eventType === 'AnimTimedSoundEvent') {
        if (!sound) return;
        const path = event.resourceName ? `battle_anims/${event.resourceName}` : scene.audio.cryPath(user.mon);
        sounds.push(scene.audio.play(path, Math.max(0.01, (event.pitch ?? 100) / 100), (event.volume ?? 100) / 100).then(()=>null,e=>e));
      } else if (event.eventType === 'AnimTimedAddBgEvent') {
        if (bg) { scene.tweens.killTweensOf(bg); bg.destroy(); }
        bg = event.resourceName
          ? scene.add.tileSprite((event.bgX ?? 0) - 320, (event.bgY ?? 0) - 284, 896, 576, `anim-bg:${event.resourceName}`)
          : scene.add.rectangle((event.bgX ?? 0) - 320, (event.bgY ?? 0) - 284, 896, 576, 0);
        bg.setOrigin(0).setScale(1.25).setAlpha((event.opacity ?? 0) / 255);
        scene.field.add(bg); scene.field.moveBelow(bg, (firstOnSide(scene, 'enemy') ?? user).container);
        tail = Math.max(tail, (event.duration ?? 0) * 2);
      } else if (event.eventType === 'AnimTimedUpdateBgEvent' && bg) {
        const config = { targets: bg, duration: (event.duration ?? 0) * frameMs };
        if (event.bgX !== undefined) config.x = event.bgX * 0.5 - 320;
        if (event.bgY !== undefined) config.y = event.bgY * 0.5 - 284;
        if (event.opacity !== undefined) config.alpha = event.opacity / 255;
        if (frameMs) tweens.push(scene.tweens.add(config));
        else { if ('x' in config) bg.x = config.x; if ('y' in config) bg.y = config.y; if ('alpha' in config) bg.alpha = config.alpha; }
        tail = Math.max(tail, (event.duration ?? 0) * 2);
      }
    };
    try {

      try { await this.resources(anim); } catch (error) {
        if (!(error instanceof LoadError)) throw error;
        this.diagnostics.add(`Skipped ${file}: ${error.message}`);
        return;
      }
      scene.life.check();
      if (!anim.frames.length) return;
      framesAt = globalThis.performance?.now?.() ?? null;
      originals.forEach(s => s.setVisible(false));
      for (let f = 0; f < anim.frames.length; f++) {
        scene.life.check();
        const counts = [0, 0, 0];
        for (const frame of anim.frames[f]) {
          const kind = frame.target;
          if (![0, 1, 2].includes(kind)) throw new Error(`Invalid frame target: ${kind}`);
          if (kind === 0 && user === target) continue;
          const i = counts[kind]++;
          let sprite = cache[kind][i];
          const mon = kind === 0 ? user : target, sourceSprite = mon.getSprite();
          if (!sprite) {
            sprite = kind === 2 ? scene.add.sprite(0, 0, `anim:${anim.graphic}`, frame.graphicFrame)
              : scene.add.sprite(0, 0, sourceSprite.texture.key, sourceSprite.frame.name);

            sprite.setOrigin(0.5); scene.field.add(sprite); cache[kind][i] = sprite;
            if (kind === 2) priorities[i] = 1;
          }
          if (kind !== 2) sprite.setTexture(sourceSprite.texture.key, sourceSprite.frame.name);
          else {
            const exists = sprite.texture.has(frame.graphicFrame);
            if (!exists) this.diagnostics.add(`Missing graphic frame ${frame.graphicFrame}: ${file} (using frame 0, as Phaser's missing-frame default)`);
            sprite.setFrame(exists ? frame.graphicFrame : 0);
          }
          const pos = framePosition(frame, user, target);
          const scale = kind === 2 ? 1 : mon.getSpriteScale();
          sprite.setPosition(pos.x + (kind === 2 ? 0 : (0.5 - sourceSprite.originX) * sourceSprite.width * scale),
            pos.y + (kind === 2 ? 0 : -sourceSprite.height / 2 * (scale - 1) + (1-sourceSprite.originY)*sourceSprite.height*scale));
          sprite.setScale(pos.scaleX * scale, pos.scaleY * scale).setAngle(pos.angle);
          sprite.setAlpha((frame.opacity ?? 0) / 255).setVisible(!!frame.visible && (kind === 2 || shown[kind]));
          sprite.setBlendMode(frame.blendType === 1 ? Phaser.BlendModes.ADD : frame.blendType === 2 ? Phaser.BlendModes.DIFFERENCE : Phaser.BlendModes.NORMAL);

          if (frame.tone?.some(Boolean)) {
            if (!sprite.toneFX) sprite.toneFX = sprite.preFX.addColorMatrix();
            const [r, g, b, gray] = frame.tone;
            const q = gray / 255, a = 1 - q;
            sprite.toneFX.set([a + .299*q,.587*q,.114*q,0,r, .299*q,a+.587*q,.114*q,0,g, .299*q,.587*q,a+.114*q,0,b, 0,0,0,1,0]);
          } else if (sprite.toneFX) { sprite.preFX.remove(sprite.toneFX); sprite.toneFX = null; }
          sprite.setData('locked', !!frame.locked);
          if (kind === 2 && priorities[i] !== frame.priority) { priorities[i] = frame.priority; setPriority(sprite, frame); }
        }
        for (let k = 0; k < 3; k++) for (let i = cache[k].length - 1; i >= counts[k]; i--) {
          if (!cache[k][i].getData('locked')) { cache[k][i].destroy(); cache[k].splice(i, 1); if (k === 2) priorities.splice(i, 1); }
        }
        for (const event of anim.frameTimedEvents?.[f] ?? []) eventAt(event);
        if (frameMs) await delay(scene, frameMs);
        tail = Math.max(0, tail - 1);
      }

      // Fast sweep still presents one rendered state per variant; all data frames used the same renderer path.
      await delay(scene, frameMs ? tail * frameMs : 17);
      for (const error of await Promise.all(sounds)) if (error) throw error;
    } finally {
      tweens.forEach(t => t.remove());
      if (bg) { scene.tweens.killTweensOf(bg); bg.destroy(); }
      cache.flat().forEach(s => s.destroy());
      originals.forEach((s, i) => { if (s.scene) s.setVisible(visible[i]); });
      this.running = false;
      mark('pb:anim-end', { framesAt });
    }
  }
}
