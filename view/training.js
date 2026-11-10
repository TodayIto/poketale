// Draw and control the training screen.
// Modified for PokeTale on 2026-11-10. See THIRD-PARTY-NOTICES.md.
// Ported from PlayNav (https://github.com/poooooby/PlayNav) src/training/core_app.lua and bags_app.lua (the punch, the bag's swing, the burst, the meter's two
// shapes, the bag list) - drawn here with shapes, no picture files. PlayNav is MIT License, Copyright (c) 2026 poooooby - THIRD-PARTY-NOTICES.md.

import { createCore, hangBlock, meterAxis, bagOf, BAG_IDS, BAG_SIZES, RESET_BAG, METER_MAX, METER_ORDER, statRoom } from '../story/training.mjs';
import { mountTrainingFrame } from './training-frame.js';
import { mountFingerHint } from './finger-hint.js';
import { closeWindow } from './frame-parts.js';
import { STATS } from '../engine/mon.mjs';
import { tween } from './lifetime.js';
import { addWindow } from './ui/window.js';
import { windowText } from './ui/text.js';
import { keyAction, playSelect, playError } from './ui/keys.js';
import { amieTextures, HEARTS, emote } from './amie-art.js';
import { fieldFor, fitCanvas, restoreCanvas, frameFor } from './amie-layout.js';

const BAG = { w: 30, h: 50 };

let bagSize = 'm';

const LABEL_SIZE = 60;

const STAT_COLORS = Object.freeze({ hp: 0xe8505a, atk: 0xf08a30, def: 0xe8c838, spa: 0x4a8ef0, spd: 0x48b860, spe: 0xe060c8 });

const BAG_COLORS = Object.freeze({ reset: 0x9aa4b4, strength: 0xd84838, toughen_up: 0x8a6a48, swiftness: 0x40c0d8, big_shot: 0x6858d0, double_up: 0xf0c020, soothing: 0xf890b8 });
const BLANK_COLOR = 0x34343c;

const HIT_SEGMENTS = 5;

const FOUND_HOLD = 1.1;
const colorOf = id => { const bag = bagOf(id); return bag?.kind === 'stat' ? STAT_COLORS[bag.stat] : BAG_COLORS[id]; };
const css = color => `#${color.toString(16).padStart(6, '0')}`;

export class TrainingScreen {
  constructor(scene) { this.scene = scene; this.isOpen = false; }

  async load(mon, biome) {
    const s = this.scene;
    const [front] = await Promise.all([s.assets.mon(mon, false), s.assets.image(`${biome}_bg`, `images/arenas/${biome}_bg.png`, null)]);
    s.life.check();
    return front;
  }

  async open({ mon, biome = 'dojo', base, trainee, hung = null, energyMax, words, rng = () => Math.random(), notice = null, onChange = () => {}, onOpen = () => {} }) {
    const s = this.scene;
    if (this.isOpen) throw new Error('Training screen already open');
    const front = await this.load(mon, biome);
    amieTextures(s);
    this.isOpen = true;
    Object.assign(this, { mon, base, words, energyMax, onChange, core: createCore({ trainee, hung, rng }), asset: front, hud: null });
    this.holdUntil = 0;
    const parent = s.options.parent, size = { width: parent.clientWidth, height: parent.clientHeight };
    const { w: W, h: H } = fieldFor(size.width, size.height), f = frameFor(size.width, size.height);
    this.W = W; this.H = H; this.tall = H > W;
    this.restoreSize = fitCanvas(s, { w: W, h: H });

    const unit = Math.min(size.width / W, size.height / H);
    this.unit = unit;
    this.at = { x: (size.width - W * unit) / 2, y: (size.height - H * unit) / 2 };
    const bottom = Math.ceil((f.train.bottom + f.train.d + 26) / unit);
    const c = this.container = s.add.container(0, -180);
    s.ui.addAt(c, 0);
    const bg = s.add.image(W / 2, H, `${biome}_bg`).setOrigin(0.5, 1);
    bg.setScale(Math.max(W / bg.width, H / bg.height));
    c.add(bg);

    this.feetY = H - Math.max(28, bottom + 6);
    this.meterAt = this.tall ? { x: W / 2, y: 84, r: 48 } : { x: 66, y: 72, r: 40 };
    this.monX = this.tall ? W * 0.34 : W * 0.56;

    this.hook = { x: W * (this.tall ? 0.76 : 0.8), y: this.feetY - 22 - BAG.h - 8 };
    this.makeMeter();
    this.makePokemon(front);
    this.makeBag();
    this.say = this.makeSay();
    this.fx = s.add.container(0, 0);
    c.add([this.fx, this.say]);
    this.drawMeter();
    this.drawBag();

    const shown = this.core.bag && bagOf(this.core.bag.id)?.kind === 'stat' ? bagOf(this.core.bag.id).size : bagSize;
    this.hud = mountTrainingFrame(parent, { f, words, stats: STATS, sizes: BAG_SIZES, size: shown, resetId: RESET_BAG,
      colors: { ...Object.fromEntries(STATS.map(stat => [stat, css(STAT_COLORS[stat])])), reset: css(BAG_COLORS.reset) }, select: () => playSelect(s), notice,
      on: { back: () => this.back(), close: () => this.closeAll(), size: picked => { bagSize = picked; }, bag: id => this.pick(id), open: () => this.pickerState(),
        shut: () => this.guide() } });
    s.life.signal.addEventListener('abort', () => { this.hint?.remove(); this.hud.remove(); }, { once: true });
    this.drawEnergy();

    this.hint = mountFingerHint(this.hud.root, { scale: this.tall ? 3 : 5 });
    this.hit = false;
    this.life = { t: 0, lunge: 0, swing: 0, swingV: 0, squash: 0, sink: 0 };
    this.zT = 0;
    this.listen();
    this.guide();
    return new Promise(resolve => {
      this.resolve = resolve;
      onOpen();
    });
  }

  makePokemon(front) {
    const s = this.scene, box = front.bounds, bw = box.right - box.left, bh = box.bottom - box.top;
    const room = this.tall ? Math.min(this.H * 0.26, 90) : 70;
    this.scale = Math.max(1, Math.round(Math.min(room / bh, (this.W * 0.4) / bw) * 8) / 8);
    this.shadow = s.add.image(this.monX, this.feetY, 'amie-shadow').setDisplaySize(Math.min(120, bw * this.scale * 0.8), 8);
    this.holder = s.add.container(this.monX, this.feetY);
    this.front = s.add.sprite(0, 0, front.key, front.frame).setOrigin((box.left + box.right) / 2 / front.width, box.bottom / front.height);
    if (s.anims.exists(front.key)) this.front.play(front.key);
    this.holder.add(this.front).setScale(this.scale);
    this.container.add([this.shadow, this.holder]);
    this.reach = bw * this.scale / 2;
  }

  makeBag() {
    const s = this.scene;
    this.rope = s.add.graphics();
    this.bagArt = s.add.graphics();
    this.bagSwing = s.add.container(this.hook.x, this.hook.y, [this.rope, this.bagArt]);
    this.bagLabel = windowText(s, 0, 0, '', { fontSize: 64 }).setOrigin(0.5);

    this.bagIcon = s.add.image(0, 0, 'amie-star').setScale(1.3);
    this.bagSwing.add([this.bagLabel, this.bagIcon]);
    this.gauge = s.add.graphics();
    this.container.add([this.bagSwing, this.gauge]);
  }

  makeMeter() {
    const s = this.scene, m = this.meterAt;
    this.meter = s.add.graphics();
    this.meterLabels = METER_ORDER.map(stat => {
      const { x, y } = this.axisPoint(stat, m.r + 8);
      const label = windowText(s, x, y, this.words.stat[stat], { fontSize: LABEL_SIZE, align: 'center' }).setOrigin(0.5);
      return [stat, label];
    });

    this.effectAt = { x: m.x, y: m.y + m.r + 24 };
    this.effectMark = s.add.graphics();
    this.effectStar = s.add.image(this.effectAt.x, this.effectAt.y + 1, 'amie-star').setScale(0.6).setVisible(false);
    this.container.add([this.meter, ...this.meterLabels.map(([, label]) => label), this.effectMark, this.effectStar]);
  }

  axisPoint(stat, r) {
    const m = this.meterAt, a = -Math.PI / 2 + METER_ORDER.indexOf(stat) * Math.PI / 3;
    return { x: m.x + Math.cos(a) * r, y: m.y + Math.sin(a) * r };
  }

  drawMeter() {
    const g = this.meter, m = this.meterAt, evs = this.core.evs;
    const shape = lengthOf => METER_ORDER.map(stat => this.axisPoint(stat, m.r * lengthOf(stat) / METER_MAX));
    const poly = (points, fill, alpha, line) => {
      g.fillStyle(fill, alpha).fillPoints(points, true);
      if (line) g.lineStyle(0.6, line, 1).strokePoints(points, true);
    };
    g.clear();
    poly(shape(() => METER_MAX), 0x16304a, 0.78, 0xf4f8ff);
    g.lineStyle(0.4, 0x8fb0cc, 0.7);
    for (const k of [0.25, 0.5, 0.75]) g.strokePoints(shape(() => METER_MAX * k), true);
    for (const stat of METER_ORDER) { const p = this.axisPoint(stat, m.r); g.lineBetween(m.x, m.y, p.x, p.y); }
    const axis = stat => meterAxis(this.base?.[stat] ?? 0, evs[stat]);
    poly(shape(stat => axis(stat).base + axis(stat).effort), 0xffb84a, 0.85, 0xfff2c0);
    poly(shape(stat => axis(stat).base), 0x9ad8ff, 0.9, null);

    for (const [stat, label] of this.meterLabels) label.setColor(statRoom(evs, stat) ? '#f8f8f8' : '#ffd84a');
    this.drawEnergy();
    this.drawEffect();
  }

  drawEffect() {
    const effect = this.core.trainee.effect, g = this.effectMark.clear(), { x, y } = this.effectAt;
    this.effectStar.setVisible(!!effect);
    if (!effect) return;
    g.lineStyle(0.6, 0x6a5038, 1).lineBetween(x, y - 9, x, y - 6);
    g.fillStyle(0x3a2a20, 1).fillRoundedRect(x - 5, y - 6.5, 10, 14, 3);
    g.fillStyle(colorOf(effect) ?? BLANK_COLOR, 1).fillRoundedRect(x - 4.5, y - 6, 9, 13, 2.5);
  }

  drawEnergy() { this.hud?.energy(this.core.energy / this.energyMax); }

  drawBag() {
    const bag = this.core.bag, top = BAG.h / 2;

    const ropeTop = this.tall ? this.meterAt.y + this.meterAt.r + 26 : 0;
    this.rope.clear().lineStyle(1, 0x6a5038, 1).lineBetween(0, ropeTop - this.hook.y, 0, 8);
    if (this.tall) this.rope.fillStyle(0x6a5038, 1).fillRoundedRect(-6, ropeTop - this.hook.y - 2, 12, 3, 1);
    this.bagArt.clear();
    this.gauge.clear();
    this.bagLabel.setVisible(false);
    this.bagIcon.setVisible(false);
    const g = this.bagArt, x = -BAG.w / 2, y = 8;
    const sack = color => {
      g.fillStyle(0x3a2a20, 1).fillRoundedRect(x - 1, y - 1, BAG.w + 2, BAG.h + 2, 7);
      g.fillStyle(color, 1).fillRoundedRect(x, y, BAG.w, BAG.h, 6);
      g.fillStyle(0xffffff, 0.22).fillRoundedRect(x + 3, y + 3, 6, BAG.h - 6, 3);
      g.fillStyle(0x000000, 0.18).fillRect(x, y + 9, BAG.w, 3).fillRect(x, y + BAG.h - 12, BAG.w, 3);
    };
    if (!bag) {

      sack(BLANK_COLOR);
      return;
    }
    const color = colorOf(bag.id), def = bagOf(bag.id);
    sack(color);
    if (def.kind === 'stat' || def.kind === 'reset') this.bagLabel.setText(def.kind === 'reset' ? 'R' : def.size.toUpperCase()).setPosition(0, y + top).setVisible(true);
    else this.bagIcon.setTexture(def.kind === 'soothing' ? 'amie-heart' : 'amie-star').setPosition(0, y + top).setVisible(true);
    this.drawHits(color, bag.hits / bag.needed);
  }

  drawHits(color, share) {
    const px = 1 / this.unit, g = this.gauge, w = 44, h = (this.tall ? 12 : 14) * px, x = this.hook.x - w / 2, y = this.hook.y + 8 + BAG.h + 6;
    const line = 2 * px, pad = 2 * px, gap = 2 * px, lit = Math.min(HIT_SEGMENTS - 1, Math.ceil(HIT_SEGMENTS * share));

    g.fillStyle(0x1a3247, 0.6).fillRect(x, y + 2 * px, w, h);
    g.fillStyle(0x23435f, 1).fillRect(x, y, w, h);
    g.fillStyle(0xf8fbfd, 1).fillRect(x + line, y + line, w - 2 * line, h - 2 * line);
    const cell = (w - 2 * (line + pad) - (HIT_SEGMENTS - 1) * gap) / HIT_SEGMENTS, top = y + line + pad, ch = h - 2 * (line + pad);
    for (let i = 0; i < HIT_SEGMENTS; i++) {
      const cx = x + line + pad + i * (cell + gap);
      if (i < lit) {
        g.fillStyle(color, 1).fillRect(cx, top, cell, ch);
        g.fillStyle(0xffffff, 0.45).fillRect(cx, top, cell, Math.min(2 * px, ch / 3));
        g.fillStyle(0x000000, 0.15).fillRect(cx, top + ch - Math.min(2 * px, ch / 3), cell, Math.min(2 * px, ch / 3));
      } else g.fillStyle(0xd6dee5, 1).fillRect(cx, top, cell, ch);
    }
  }

  makeSay() {
    const s = this.scene, box = s.add.container(this.W / 2, this.tall ? this.meterAt.y + this.meterAt.r + 40 : 8).setVisible(false);
    box.window = addWindow(s, 0, 0, 10, 16);
    box.text = windowText(s, 0, 2, '', { fontSize: 64 });
    box.add([box.window, box.text]);
    return box;
  }

  guide() {
    if (!this.isOpen || this.hit || this.hud.pickerOpen) { this.hint?.hide(); return; }
    const bag = () => this.toScreen(this.hook.x, this.hook.y + 8 + BAG.h / 2);
    this.hint.show(this.core.bag ? [bag] : [() => this.hud.bagsAt(), bag]);
  }

  toScreen(x, y) { return { x: this.at.x + x * this.unit, y: this.at.y + y * this.unit }; }

  talk(text, secs = 1.8) {
    const s = this.scene, box = this.say;
    box.text.setText(text);
    const w = Math.min(this.W - 8, Math.ceil(box.text.displayWidth) + 14);
    box.window.setSize(w, 16).setPosition(-w / 2, 0);
    box.text.setPosition(-w / 2 + 7, 2);
    box.setVisible(true);
    this.container.bringToTop(box);
    this.sayTimer?.remove();
    this.sayTimer = s.time.delayedCall(secs * 1000, () => box.setVisible(false));
  }

  pickerState() {
    const w = this.words, hung = this.core.bag, effect = this.core.trainee.effect;
    const about = (label, id) => (w.effect[id] ? { label, name: w.bag[id], text: w.effect[id], color: css(colorOf(id)), mark: bagOf(id).kind === 'soothing' ? 'heart' : 'star' } : null);
    this.hud.state({
      blocked: id => !!hangBlock(this.core.evs, id),
      replaced: hung && !BAG_IDS.includes(hung.id) ? w.replace({ bag: w.bag[hung.id] }) : null,
      about: [hung && about(w.hung, hung.id), effect && about(w.next, effect)].filter(Boolean),
    });
    this.hint.hide();
  }

  pick(id) {
    if (hangBlock(this.core.evs, id)) { playError(this.scene); return; }
    this.play(this.core.hang(id));
    this.guide();
  }

  listen() {
    const s = this.scene, input = s.input;

    const down = () => { if (this.isOpen && !this.hud.pickerOpen) this.tap(); };
    const update = (_, delta) => this.frame(delta);
    input.on('pointerdown', down);
    s.events.on('update', update);

    const key = e => {
      const action = e.repeat ? null : keyAction(e);
      if (action !== 'back' && action !== 'ok') return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (action === 'ok') { if (!this.hud.pickerOpen) this.tap(); return; }
      this.back();
    };
    const unlisten = s.life.listen(s.options.parent, 'keydown', key, true);
    this.unhook = () => {
      input.off('pointerdown', down);
      s.events.off('update', update);
      unlisten();
    };
  }

  back() {
    if (this.isOpen && !this.hud.back()) this.close();
  }

  closeAll() {
    if (this.isOpen && !closeWindow(this.hud.root)) this.close();
  }

  tap() {

    const at = performance.now() / 1000;
    if (at < this.holdUntil) return;

    if (!this.hit) { this.hit = true; this.hint.remove(); }
    this.play(this.core.tap(at));
  }

  result() {
    const bag = this.core.bag;
    return { bags: [...this.core.cleared], hung: bag && { id: bag.id, hits: bag.hits } };
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.unhook?.();
    this.sayTimer?.remove();
    this.hint.remove();
    this.hud.remove();
    this.container.destroy();
    restoreCanvas(this.scene, this.restoreSize);
    this.restoreSize = null;
    this.resolve(this.result());
  }

  play(events) {
    const w = this.words;
    for (const e of events) {
      switch (e.type) {
        case 'hang':
          this.drawBag();
          this.bagSwing.y = this.hook.y - (e.found ? 60 : 30);
          tween(this.scene, { targets: this.bagSwing, y: this.hook.y, duration: e.found ? 520 : 260, ease: e.found ? 'Bounce.easeOut' : 'Back.easeOut' }).catch(() => {});
          break;
        case 'found':
          this.holdUntil = performance.now() / 1000 + FOUND_HOLD;
          this.talk(w.found({ bag: w.bag[e.id] }), 2.4);
          this.later(() => this.burstAt('star', 5, this.hook.x, this.hook.y + 8 + BAG.h / 2, { rise: 1.2, scale: 1 }), 0.45);
          playSelect(this.scene);
          break;
        case 'refuse':
          playError(this.scene);

          if (e.why === 'resting') this.emote('zzz');
          else this.talk(e.why === 'empty' ? w.empty : w.noEffect);
          break;
        case 'punch': this.punch(e); break;
        case 'cleared':
          this.burstBag();

          this.meterPulse();
          break;
        case 'reset':
          this.burstBag();
          this.talk(w.reset, 2.2);
          this.meterPulse();
          break;
        case 'effect':

          this.burstBag();
          this.flyEffect();
          break;
        case 'soothing':
          this.burstBag();
          this.emote(e.friendship ? 'heart' : 'dots');
          if (e.friendship) this.burstAt('heart', HEARTS, this.monX, this.feetY - this.reach * 1.6);
          break;

        case 'wind': this.later(() => this.emote('sparkle'), 2.3); this.sparkle(); break;
        case 'rest': this.later(() => this.emote('zzz'), 4.6); break;
        case 'wake':
          this.life.sink = 0;
          this.front.anims.timeScale = 1;
          this.emote('bang');
          this.burstAt('note', 3, this.monX, this.feetY - this.reach * 1.6);
          this.scene.audio?.cry(this.mon).catch(() => {});
          break;
        default: break;
      }
    }
    if (this.core.resting) this.front.anims.timeScale = 0.35;
    if (!events.length) return;
    this.drawEnergy();
    this.onChange(this.result());
  }

  emote(kind) { emote(this.scene, this.fx, kind, this.monX + 14, this.feetY - this.reach * 1.7); }

  later(fn, secs) { this.scene.time.delayedCall(secs * 1000, () => { if (this.isOpen) fn(); }); }

  punch(e) {
    const life = this.life;
    life.lunge = 1;
    life.swingV += 0.5 * e.strength;
    life.squash = 1;
    this.drawBag();
    const x = this.hook.x - BAG.w / 2, y = this.hook.y + 8 + BAG.h * 0.55;
    this.burstAt('spark', e.strength, x, y, { rise: 0, scale: 1.2 });
  }

  burstBag() {
    const s = this.scene, x = this.hook.x, y = this.hook.y + 8 + BAG.h / 2;
    const flash = s.add.graphics().fillStyle(0xffffff, 1).fillRoundedRect(x - BAG.w / 2 - 2, y - BAG.h / 2 - 2, BAG.w + 4, BAG.h + 4, 7);
    this.fx.add(flash);
    tween(s, { targets: flash, alpha: 0, duration: 450 }).then(() => flash.destroy(), () => {});
    this.burstAt('star', 6, x, y, { rise: 1.4, scale: 1 });
    this.burstAt('note', 2, this.monX, this.feetY - this.reach * 1.6);
    s.audio?.cry(this.mon).catch(() => {});
    if (!this.core.bag) this.drawBag();
  }

  flyEffect() {
    const s = this.scene, star = s.add.image(this.hook.x, this.hook.y + 8 + BAG.h / 2, 'amie-star').setScale(1.2);
    this.fx.add(star);
    tween(s, { targets: star, x: this.effectAt.x, y: this.effectAt.y, scale: 0.6, duration: 650, ease: 'Sine.easeInOut' })
      .then(() => { star.destroy(); this.drawEffect(); this.burstAt('spark', 2, this.effectAt.x, this.effectAt.y, { rise: 0.5, scale: 0.8 }); }, () => {});
  }

  meterPulse() {
    this.drawMeter();
    const m = this.meterAt;
    this.burstAt('spark', 3, m.x, m.y, { rise: 0.6, scale: 1 });
  }

  sparkle() {
    this.burstAt('spark', 3, this.monX, this.feetY - this.reach * 1.4, { rise: 0.8, scale: 1.1 });
  }

  burstAt(name, n, x, y, { rise = 1, scale = 1 } = {}) {
    const s = this.scene;
    for (let i = 0; i < n; i++) {
      const icon = s.add.image(x + (Math.random() - 0.5) * 14, y, `amie-${name}`).setScale(scale * 0.7).setAlpha(0);
      this.fx.add(icon);
      s.tweens.add({ targets: icon, alpha: { from: 0, to: 1 }, scale, duration: 140, delay: i * 70 });
      s.tweens.add({
        targets: icon, x: icon.x + (Math.random() - 0.5) * 40 * Math.max(0.4, rise), y: y - (18 + Math.random() * 14) * rise, alpha: 0,
        duration: rise ? 900 + i * 70 : 420, delay: i * 70 + 140, ease: 'Sine.easeOut', onComplete: () => icon.destroy(),
      });
    }
  }

  frame(delta) {
    if (!this.isOpen) return;
    const dt = Math.min(250, delta) / 1000, life = this.life;
    life.t += dt;
    life.lunge = Math.max(0, life.lunge - dt / 0.22);
    life.squash = Math.max(0, life.squash - dt / 0.2);

    life.swingV += -life.swing * 12 * dt;
    life.swingV *= Math.exp(-3 * dt);
    life.swing += life.swingV * dt * 6;
    life.sink += ((this.core.resting ? 1 : 0) - life.sink) * (1 - Math.exp(-3 * dt));

    const toward = Math.max(0, this.hook.x - BAG.w / 2 - this.reach - this.monX - 4);
    const lunge = Math.sin(life.lunge * Math.PI) * Math.min(26, toward);
    const breath = Math.sin(life.t * 3) * 0.015;
    this.holder.setPosition(this.monX + lunge, this.feetY);
    this.holder.setRotation(0.12 * Math.sin(life.lunge * Math.PI) + Math.sin(life.t * 1.6) * 0.03 * life.sink);

    this.holder.setScale(-this.scale * (1 + 0.04 * life.sink), this.scale * (1 + breath - 0.07 * life.sink));
    this.bagSwing.setRotation(-Math.max(-0.6, Math.min(0.6, life.swing)) * 0.5);
    this.bagArt.setScale(1 - 0.08 * life.squash, 1 + 0.04 * life.squash);
    if (this.core.resting && (this.zT -= dt) <= 0) {
      this.zT = 1.4;
      this.burstAt('zee', 1, this.monX + 16, this.feetY - this.reach * 1.5, { rise: 0.8, scale: 1.3 });
    }
  }
}

