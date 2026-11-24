// from pokerogue src/data/battle-anims.ts @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-11-22. See view/LICENSE-NOTE.md.

import Phaser from 'phaser';
import { animation, moveFile } from './data.js';
import { framePosition, copyPosition, screenCover, backgroundPhase } from './geometry.js';
import { fitBackground, rangeForX } from './bg-seam.js';
import { backgroundEnd, hasBackground } from './background.js';
import { tintState, tintMatrix } from './bg-engine.js';
import { foregroundFrames, foregroundPictures } from './foreground.js';
import { delay } from '../lifetime.js';
import { LoadError, timeLimit } from '../retry.js';
import { isPlayerSide, firstOnSide } from '../positions.js';
import { setColorMatrix } from '../color-matrix.js';
import { showsCutIn, playCutIn, prefetchCutIn, CUTIN_SOUND } from './cutin.js';
import { entry } from '../../names/index.js';

export function toneMatrix([r, g, b, gray]) {
  const q = gray / 255, a = 1 - q;
  return [a + .299*q,.587*q,.114*q,0,r, .299*q,a+.587*q,.114*q,0,g, .299*q,.587*q,a+.114*q,0,b, 0,0,0,1,0];
}

const PRIORITY = {
  0: ({ front }) => ['moveBelow', front],
  2: ({ bg, focus }) => (bg ? ['moveAbove', bg] : ['moveBelow', focus]),
  3: ({ focus }) => ['moveAbove', focus],
};
const FOCUS = { 1: 'target', 2: 'user' }; // AnimFocus TARGET/USER

export const AFTER_ANIM_MS = 500;
const CUTIN_PREFETCH_MOVES = new Set(['tectonicrage', 'breakneckblitz']);

const appliedTones = new WeakMap();

function applyTone(sprite, tone) {
  const active = !!tone?.some(Boolean), before = appliedTones.get(sprite);
  if (before && before.active === active && sprite.pipeline === before.pipeline && sprite.pipelineData === before.data
    && (!active || (tone.length === before.tone.length && tone.every((v, i) => v === before.tone[i])))) return;
  setColorMatrix(sprite, active ? toneMatrix(tone) : null);
  appliedTones.set(sprite, { active, pipeline: sprite.pipeline, data: sprite.pipelineData, tone: active ? [...tone] : null });
}

export class AnimationPlayer {

  constructor(scene, { enabled = true } = {}) {
    this.scene = scene; this.enabled = enabled; this.running = false; this.diagnostics = new Set(); this.prepared = new Map();

    this.resourcesReady = new WeakMap(); this.loadingGraphics = new Map();
  }

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

    if (!this.enabled) return; // move animations off: no sprite touched (playFile)
    return this.playFile(moveFile(id, undefined, this.scene.requireMon(side)?.mon?.speciesId), side, targetSide, { onSubstitute });
  }

  async zCutIn(side, id) {
    if (!this.enabled || !showsCutIn(id)) return;
    const prefetch = CUTIN_PREFETCH_MOVES.has(id) ? () => this.prefetchMove(side, id) : undefined;
    await this.cutIn(entry('moves', id).type, side, prefetch);
  }

  async prefetchMove(side, id) {
    if (!this.enabled) return;
    try {
      const { life, audio } = this.scene;
      life.check();
      if (audio.level('sfx') === 0) return;
      const source = await animation(moveFile(id));
      life.check();
      const anim = Array.isArray(source) ? source[isPlayerSide(side) ? 0 : 1] : source;
      if (anim && audio.level('sfx') > 0) await this.resources(anim, { early: true });
    } catch {
      // Best effort: playFile still owns loading, errors and cleanup.
    }
  }

  async cutIn(type, side, prefetch) {
    const scene = this.scene;

    const S = scene.options?.quality === 'low' ? 3 : 6;

    const sound = () => scene.audio.play(CUTIN_SOUND, 1, 1).catch(error => {
      if (error?.name !== 'AbortError') this.diagnostics.add(`Sound failed: ${CUTIN_SOUND}: ${error?.message ?? error}`);
    });
    const wait = ms => {
      const frame = delay(scene, ms);
      if (prefetch) {
        // Let the first cut-in frame show before preparing the confirmed move.
        const start = prefetch;
        prefetch = undefined;
        void frame.then(start, () => {});
      }
      return frame;
    };
    try {
      await playCutIn(scene, side, type, isPlayerSide(side), { S, sound, delay: wait,
        timeLimit: (promise, ms) => timeLimit(promise, ms, `Cut-in art timeout ${ms / 1000}s`, scene.life.signal) });
    } catch (error) {
      if (scene.life.signal.aborted) throw error; // the battle closed
      this.diagnostics.add(`Skipped cut-in: ${error?.message ?? error}`);
    }
    // If there was no picture, the concurrent battle message can still overlap loading.
    void prefetch?.();
  }

  prefetchCutIn(side) {
    if (!this.enabled) return false;
    try {
      if (!prefetchCutIn(this.scene, side)) return false;
      this.scene.audio?.load?.(CUTIN_SOUND)?.ready?.catch?.(() => {});
      return true;
    } catch { return false; } // e.g. nobody at that position yet
  }
  playCommon(name, side, targetSide = side) {
    if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`Invalid common animation: ${name}`);
    return this.playFile(`common-${name}.json`, side, targetSide);
  }
  async resources(anim, { early = false } = {}) {
    const { assets, audio } = this.scene;

    if (this.resourcesReady.get(anim)?.every(key => assets.scene.textures.exists(key))) return;
    const work = [], textures = [];
    if (anim.graphic) {
      const key = `anim:${anim.graphic}`;
      textures.push(key);
      if (!assets.scene.textures.exists(key)) {
        let loading = this.loadingGraphics.get(key);
        if (!loading) {
          loading = assets.loadImage(assets.url(`images/battle_anims/${encodeURIComponent(anim.graphic)}.png`)).then(img => {
            assets.life.check();
            if (!assets.scene.textures.exists(key)) assets.scene.textures.addSpriteSheet(key, img, { frameWidth: 96, frameHeight: 96 });
          });
          this.loadingGraphics.set(key, loading);
          const done = () => { if (this.loadingGraphics.get(key) === loading) this.loadingGraphics.delete(key); };
          loading.then(done, done);
        }
        work.push(loading);
      }
    }

    if (anim.bgFrames?.length) {
      const names = new Set();
      for (const state of anim.bgFrames) if (state?.pic) names.add(state.pic);
      for (const name of names) {
        textures.push(`anim-bg:${name}`);
        work.push(assets.image(`anim-bg:${name}`, `images/battle_anims/${encodeURIComponent(name)}.png`, null));
      }
    }
    let earlySoundFailed = false;
    if (anim.frameTimedEvents) {
      let previousSound;
      for (const events of Object.values(anim.frameTimedEvents)) {
        for (const event of events) {
          if (event.eventType === 'AnimTimedAddBgEvent' && event.resourceName) {
            textures.push(`anim-bg:${event.resourceName}`);
            work.push(assets.image(`anim-bg:${event.resourceName}`, `images/battle_anims/${encodeURIComponent(event.resourceName)}.png`, null));
          }
          if (event.eventType === 'AnimTimedSoundEvent' && event.resourceName && event.resourceName !== previousSound) {
            previousSound = event.resourceName;
            const path = `battle_anims/${event.resourceName}`;
            const cached = early && audio.sounds.has(path);
            const sound = audio.load(path);
            work.push(early ? sound.ready.then(media => {
              if (media.readyState >= 2 && !media.error) return;
              earlySoundFailed = true;
              // A terminal failure from an early request should get the usual on-use attempt.
              if (!cached && !media.onerror && !audio.destroyed && audio.sounds.get(path)?.audio === media) {
                audio.sounds.delete(path);
              }
            }) : sound.ready);
          }
        }
      }
    }

    for (const name of foregroundPictures(anim.frameTimedEvents)) {
      textures.push(`anim-bg:${name}`);
      work.push(assets.image(`anim-bg:${name}`, `images/battle_anims/${encodeURIComponent(name)}.png`, null));
    }
    await Promise.all(work);
    if (!earlySoundFailed) this.resourcesReady.set(anim, textures);
  }
  async playFile(file, side, targetSide, { variant, frameMs = 50, sound = true, onSubstitute = false } = {}) {
    if (!this.enabled) return; // move animations off
    if (this.running) throw new Error('Animation already playing');

    const mark = (name, detail) => globalThis.performance?.mark?.(name, { detail: { file, side, ...detail } });
    mark('pb:anim-start');
    let framesAt = null;
    const scene = this.scene;
    let user = scene.requireMon(side), target = scene.requireMon(targetSide);

    const mover = user.mon;

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

    const cache = [[], [], []], spareEffects = [], tweens = [];

    let bg, bgTint, bgPlane, bgFit = null;

    const bgEventX = Object.values(anim.frameTimedEvents ?? {}).flat().filter(e => e.eventType === 'AnimTimedUpdateBgEvent' && e.bgX !== undefined).map(e => e.bgX * 0.5);
    const bgScroll = new Map();
    for (const st of anim.bgFrames ?? []) if (st?.pic) { const r = bgScroll.get(st.pic) ?? [Infinity, -Infinity], v = -st.sx * 0.5; bgScroll.set(st.pic, [Math.min(r[0], v), Math.max(r[1], v)]); }
    const paint = () => {
      if (bgPlane) bg.setFillStyle(((Math.round(bgTint.r) << 16) | (Math.round(bgTint.g) << 8) | Math.round(bgTint.b)) >>> 0); // the plane: black + hue x strength
      else setColorMatrix(bg, bgTint.s > 0 ? tintMatrix(bgTint) : null);
    };
    const putBackground = (event, plane) => {
      if (bg) { scene.tweens.killTweensOf(bg); bg.destroy(); }
      bgPlane = plane || !event.resourceName;
      bg = !bgPlane
        ? scene.add.tileSprite((event.bgX ?? 0) - 320, (event.bgY ?? 0) - 284, 896, 576, `anim-bg:${event.resourceName}`)
        : scene.add.rectangle(plane ? -320 : (event.bgX ?? 0) - 320, plane ? -284 : (event.bgY ?? 0) - 284, 896, 576, 0);
      bg.setOrigin(0).setScale(1.25).setAlpha(plane ? 0 : (event.opacity ?? 0) / 255);
      if (!bgPlane) fitBackground(scene, bg, `anim-bg:${event.resourceName}`, ...rangeForX([event.bgX ?? 0, ...bgEventX]));
    };

    let bgKey;
    const showOriginal = state => {
      const key = state ? state.pic : undefined;
      if (key !== bgKey) {
        if (bg) { bg.destroy(); bg = undefined; }
        bgFit = null;
        bgKey = key;
        if (state) {
          const [x, y] = state.at;
          bgPlane = !key;
          bg = bgPlane ? scene.add.rectangle(-320, -284, 896, 576, 0) : scene.add.tileSprite(x - 320, y - 284, 896, 576, `anim-bg:${key}`);
          bg.setOrigin(0).setScale(1.25);
          if (!bgPlane) { const [lo, hi] = bgScroll.get(key) ?? [0, 0]; bgFit = fitBackground(scene, bg, `anim-bg:${key}`, (320 - x) / 1.25 + lo, (640 - x) / 1.25 + hi); }
          scene.field.add(bg); scene.field.moveBelow(bg, (firstOnSide(scene, 'enemy') ?? user).container);
        }
      }
      if (!state) return;
      bg.setAlpha(state.o / 255);
      bgTint = tintState(state.c);
      paint();
      if (!bgPlane) {

        bg.tilePositionX = bgFit ? bgFit.base + (-state.sx * 0.5) / bgFit.k : -state.sx * 0.5;
        bg.tilePositionY = backgroundPhase(scene.textures.get?.(`anim-bg:${key}`)?.getSourceImage?.()?.height, state.at[1]) - state.sy * 0.5;
      }
    };

    const fgStates = foregroundFrames(anim.frameTimedEvents, anim.frames.length);
    let fgPicture = null, fgPlane = null, fgTint = null;
    const fgObject = object => { object.setOrigin(0).setScale(1.25).setData('foreground', true); scene.field.add(object); return object; };
    const clearForeground = () => { fgPicture?.destroy(); fgPlane?.destroy(); fgPicture = fgPlane = fgTint = null; };
    const drawForeground = state => {
      if (state.planeOpacity > 0 && !fgPlane) fgPlane = fgObject(scene.add.rectangle(-320, -284, 896, 576, 0));
      if (fgPlane) {
        const [r, g, b] = state.planeColor.slice(0, 3).map(v => Math.round((v * state.planeColor[3]) / 255));
        fgPlane.setFillStyle(((r << 16) | (g << 8) | b) >>> 0).setAlpha(state.planeOpacity / 255).setVisible(state.planeOpacity > 0);
        scene.field.bringToTop(fgPlane);
      }
      const key = state.picture && `anim-bg:${state.picture}`;
      if (fgPicture && (!key || fgPicture.texture.key !== key)) { fgPicture.destroy(); fgPicture = fgTint = null; }
      if (key) {
        fgPicture ??= fgObject(scene.add.tileSprite(-320, -284, 896, 576, key));
        const phase = backgroundPhase(scene.textures.get?.(key)?.getSourceImage?.()?.height, 0);
        fgPicture.tilePositionX = state.ox / 2;
        fgPicture.tilePositionY = phase + state.oy / 2;
        fgPicture.setAlpha(state.opacity / 255).setVisible(state.opacity > 0);
        const tint = state.color[3] > 0 ? state.color.join() : null;
        if (tint !== fgTint) {
          setColorMatrix(fgPicture, tint && tintMatrix(tintState(state.color)));
          fgTint = tint;
        }
        scene.field.bringToTop(fgPicture);
      }
    };
    if (opposite) { [user, target] = [target, user]; shown.reverse(); }
    const originals = [...new Set([user.getSprite(), target.getSprite()])];
    const visible = originals.map(s => s.visible);
    const priorities = []; // current priority per graphic slot (source spritePriorities)
    const setPriority = (sprite, frame) => {
      const front = (firstOnSide(scene, 'enemy') ?? firstOnSide(scene, 'player')).container;
      const [move, anchor] = PRIORITY[frame.priority]?.({ bg, front, focus: actors[FOCUS[frame.focus]] }) ?? [];

      const field = scene.field;
      if (anchor && (field.exclusive ? anchor.parentContainer === field : field.exists(anchor))) field[move](sprite, anchor);
      else field.bringToTop(sprite);
    };
    const eventAt = event => {
      if (event.eventType === 'AnimTimedSoundEvent') {
        if (!sound) return;
        const path = event.resourceName ? `battle_anims/${event.resourceName}` : scene.audio.cryVoice?.(mover, 'move') ?? scene.audio.cryPath(mover);

        scene.audio.play(path, Math.max(0.01, (event.pitch ?? 100) / 100), (event.volume ?? 100) / 100).catch(error => {
          if (error?.name !== 'AbortError') this.diagnostics.add(`Sound failed: ${path}: ${error?.message ?? error}`);
        });
      } else if (event.eventType === 'AnimTimedAddBgEvent' || (event.eventType === 'AnimTimedUpdateBgEvent' && !bg && event.plane)) {

        const plane = event.eventType === 'AnimTimedUpdateBgEvent';
        putBackground(event, plane);

        if (event.resourceName && !plane) bg.tilePositionY = backgroundPhase(scene.textures.get?.(`anim-bg:${event.resourceName}`)?.getSourceImage?.()?.height, event.bgY ?? 0);
        scene.field.add(bg);

        if (anim.bgFront) scene.field.bringToTop(bg);
        else scene.field.moveBelow(bg, (firstOnSide(scene, 'enemy') ?? user).container);
        if (plane) eventAt(event);
      } else if (event.eventType === 'AnimTimedUpdateBgEvent' && bg) {
        const config = { targets: bg, duration: (event.duration ?? 0) * frameMs };
        if (event.bgX !== undefined) config.x = event.bgX * 0.5 - 320;
        if (event.bgY !== undefined) config.y = event.bgY * 0.5 - 284;
        if (event.opacity !== undefined) config.alpha = event.opacity / 255;
        if (frameMs) tweens.push(scene.tweens.add(config));
        else { if ('x' in config) bg.x = config.x; if ('y' in config) bg.y = config.y; if ('alpha' in config) bg.alpha = config.alpha; }
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
        const counts = [0, 0, 0], cover = screenCover(anim.frames[f]);
        for (const frame of anim.frames[f]) {
          const kind = frame.target;
          if (![0, 1, 2].includes(kind)) throw new Error(`Invalid frame target: ${kind}`);
          if (kind === 0 && user === target) continue;
          const i = counts[kind]++;
          let sprite = cache[kind][i];
          const mon = kind === 0 ? user : target;
          const sourceSprite = kind === 2 ? null : mon.getSprite(); // only Pokemon copies (0, 1) draw the mon's picture
          if (!sprite) {
            sprite = kind === 2 ? spareEffects.pop() : null;
            if (sprite) {
              sprite.setActive(true);

              scene.field.bringToTop(sprite);
            } else {

              sprite = kind === 2 ? scene.add.image(0, 0, `anim:${anim.graphic}`, frame.graphicFrame)
                : scene.add.image(0, 0, sourceSprite.texture.key, sourceSprite.frame.name);

              sprite.setOrigin(0.5); scene.field.add(sprite);
            }
            cache[kind][i] = sprite;

            if (kind !== 2 && i === 0) mon.animCopy = sprite;
            if (kind === 2) priorities[i] = 1;
          }

          if (kind !== 2) {
            const key = sourceSprite.texture.key, name = sourceSprite.frame.name;
            if (sprite.texture.key !== key || sprite.frame.name !== name) sprite.setTexture(key, name);
          } else {
            const exists = sprite.texture.has(frame.graphicFrame);
            if (!exists) this.diagnostics.add(`Missing graphic frame ${frame.graphicFrame}: ${file} (using frame 0, as Phaser's missing-frame default)`);
            const name = exists ? frame.graphicFrame : 0;
            if (sprite.frame.name !== name) sprite.setFrame(name);
          }
          const pos = framePosition(frame, user, target, cover.has(frame));
          const scale = kind === 2 ? 1 : mon.getSpriteScale();
          const { x, y } = kind === 2 ? pos : copyPosition(pos, mon, sourceSprite);
          const scaleX = pos.scaleX * scale, scaleY = pos.scaleY * scale, alpha = (frame.opacity ?? 0) / 255;
          const visible = !!frame.visible && (kind === 2 || shown[kind]);
          const blend = frame.blendType === 1 ? Phaser.BlendModes.ADD : frame.blendType === 2 ? Phaser.BlendModes.DIFFERENCE : Phaser.BlendModes.NORMAL;
          if (sprite.x !== x || sprite.y !== y) sprite.setPosition(x, y);
          if (sprite.scaleX !== scaleX || sprite.scaleY !== scaleY) sprite.setScale(scaleX, scaleY);
          if (sprite.angle !== pos.angle) sprite.setAngle(pos.angle);
          if (sprite.alpha !== alpha) sprite.setAlpha(alpha);
          if (sprite.visible !== visible) sprite.setVisible(visible);
          if (sprite.blendMode !== blend) sprite.setBlendMode(blend);

          applyTone(sprite, frame.tone);
          if (sprite.getData('locked') !== !!frame.locked) sprite.setData('locked', !!frame.locked);
          if (kind === 2 && priorities[i] !== frame.priority) { priorities[i] = frame.priority; setPriority(sprite, frame); }
        }

        for (let k = 0; k < 3; k++) for (let i = cache[k].length - 1; i >= counts[k]; i--) {
          const sprite = cache[k][i];
          if (!sprite.getData('locked')) {
            if (k === 2) { sprite.setVisible(false).setActive(false); spareEffects.push(sprite); }
            else sprite.destroy();
            cache[k].splice(i, 1); if (k === 2) priorities.splice(i, 1);
          }
        }
        const events = anim.frameTimedEvents?.[f]; // most frames have none
        if (events != null) for (const event of events) eventAt(event);
        if (anim.bgFront && bg) scene.field.bringToTop(bg);
        if (fgStates) drawForeground(fgStates[f]);
        if (anim.bgFrames) showOriginal(anim.bgFrames[f]);
        if (frameMs) await delay(scene, frameMs);
      }
      clearForeground(); // the original's foreground ends with the last frame
      if (anim.bgFrames) {

        for (let f = anim.frames.length; f < anim.bgFrames.length; f++) {
          showOriginal(anim.bgFrames[f]);
          if (frameMs) await delay(scene, frameMs);
        }
        showOriginal(null);
        await delay(scene, frameMs && anim.bgFrames.some(Boolean) ? AFTER_ANIM_MS : 17);
        return;
      }
      // Fast sweep still presents one rendered state per variant; all data frames used the same renderer path.
      await delay(scene, frameMs && hasBackground(anim.frameTimedEvents) ? Math.max(0, backgroundEnd(anim.frameTimedEvents) - anim.frames.length) * frameMs + AFTER_ANIM_MS : 17);
    } finally {
      tweens.forEach(t => t.remove());
      if (bg) { scene.tweens.killTweensOf(bg); bg.destroy(); }
      clearForeground();
      for (const sprites of cache) for (const s of sprites) s.destroy();
      for (const s of spareEffects) s.destroy();
      originals.forEach((s, i) => { if (s.scene) s.setVisible(visible[i]); });
      user.animCopy = null; target.animCopy = null;
      this.running = false;
      mark('pb:anim-end', { framesAt });
    }
  }
}
