// Modified for PokeTale on 2026-11-14. See THIRD-PARTY-NOTICES.md.
// Ported from PlayNav (https://github.com/poooooby/PlayNav) src/training/core_app.lua and bags_app.lua (the punch, the bag's swing, the burst, the meter's two
// shapes, the bag list) - drawn here, no picture files. The hanging bag (pixel art, chain, straps), its swing from the clasp, the contact 70 ms after a tap
// and the burst's bits: view/training-art.js, view/training-motion.js - only pictures wait for the contact, never the rules. PlayNav is MIT License, Copyright (c) 2026 poooooby - THIRD-PARTY-NOTICES.md.

import { createCore, hangBlock, meterAxis, bagOf, BAG_IDS, BAG_SIZES, RESET_BAG, METER_MAX, METER_ORDER, statRoom } from '../story/training.mjs';
import { mountTrainingFrame } from './training-frame.js';
import { mountFingerHint } from './finger-hint.js';
import { closeWindow } from './frame-parts.js';
import { STATS } from '../engine/mon.mjs';
import { tween } from './lifetime.js';
import { addWindow } from './ui/window.js';
import { windowText } from './ui/text.js';
import { keyAction, playSelect, playError } from './ui/keys.js';
import { amieSound, TRAINING_SOUNDS } from './amie-sound.js';
import { amieTextures, HEARTS, emote, paint } from './amie-art.js';
import { trainingScene, yardDust } from './training-scene.js';
import { DOT } from './amie-scenes.js';
import { mountScene, stillPictures } from './scene-bake.js';
import { fieldFor, fitCanvas, restoreCanvas, frameFor } from './amie-layout.js';
import { STAT_COLORS, BAG_COLORS, BLANK_COLOR, colorOf, css, hangTextures, bagTexture, bagSize as sizeOf, bagDims, bagIcon, ICON_SCALE } from './training-art.js';
import {
  TRAIN_LAYOUT, trainingMarks, swingParams, swingState, stepSwing, hitSwing, swingAngle, squashAt, HIT_DELAY, sandHit, sandLeak, burstBits, feetDust, stepBit,
} from './training-motion.js';

const BAG = TRAIN_LAYOUT.bag;

let bagSize = 'm';

const LABEL_SIZE = 60;

const HIT_SEGMENTS = 5;

const FOUND_HOLD = 1.1;

export class TrainingScreen {
  constructor(scene) { this.scene = scene; this.isOpen = false; }

  async load(mon) {
    const s = this.scene;
    const front = await s.assets.mon(mon, false);
    s.life.check();
    return front;
  }

  async open({ mon, time = 'day', base, trainee, hung = null, energyMax, words, rng = () => Math.random(), notice = null, onChange = () => {}, onOpen = () => {} }) {
    const s = this.scene;
    if (this.isOpen) throw new Error('Training screen already open');
    const front = await this.load(mon);
    amieTextures(s);
    hangTextures(s);
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
    const c = this.container = s.add.container(0, -180);
    s.ui.addAt(c, 0);

    this.yard = mountScene(s, trainingScene({ time, w: W, h: H, px: unit, animate: !stillPictures(), bleed: true }), { prefix: 'train-scene' });
    c.add(this.yard.back);
    this.dustKey = `train-dust-${time}`;
    paint(s, this.dustKey, ['X'], { X: yardDust(time) });

    const marks = this.marks = trainingMarks({ w: W, h: H, px: unit });
    this.feetY = marks.feet;
    this.meterAt = marks.meter;
    this.monX = marks.monX;
    this.hook = marks.hook;
    this.ropeTop = marks.ropeTop;

    this.shown = this.core.bag;
    this.makeMeter();
    this.makePokemon(front);
    this.makeBag();
    this.say = this.makeSay();
    this.fx = s.add.container(0, 0);
    c.add([this.yard.front, this.fx, this.say]);
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
    this.life = { t: 0, lunge: 0, sink: 0, hitAt: -9, strength: 1 };
    this.swing = swingState();
    this.contacts = [];
    this.bits = [];
    this.zT = 0;

    this.sound = amieSound(s.audio);
    this.sound.preload(TRAINING_SOUNDS);
    this.sound.music('training');
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
    const s = this.scene, L = this.hook.y - this.ropeTop;
    this.swingRoot = s.add.container(this.hook.x, this.ropeTop);
    const links = [];
    for (let y = 0, i = 0; y < L - 4; y += 6, i++) links.push(s.add.image(0, y, `train-link-${i % 2}`).setOrigin(0.5, 0).setScale(DOT));
    this.bagHang = s.add.container(0, L);
    this.bagBody = s.add.container(0, BAG.strap);
    this.bagArt = s.add.image(0, 0, bagTexture(s, null)).setOrigin(0.5, 0).setScale(DOT);
    this.bagIcon = s.add.image(0, 0, 'amie-star').setScale(ICON_SCALE).setVisible(false);
    this.bagBody.add([this.bagArt, this.bagIcon]);
    this.strap = s.add.image(0, 0, 'train-strap-m').setOrigin(0.5, 0).setScale(DOT);
    this.bagHang.add([this.strap, s.add.image(0, 0, 'train-ring').setScale(DOT), this.bagBody]);
    this.swingRoot.add([...links, this.bagHang]);
    this.gauge = s.add.graphics();
    this.container.add([this.swingRoot, this.gauge]);
  }

  bagPoint(x, y) {
    const r = this.swingRoot.rotation, Y = y + this.hook.y - this.ropeTop;
    return { x: this.hook.x + x * Math.cos(r) - Y * Math.sin(r), y: this.ropeTop + x * Math.sin(r) + Y * Math.cos(r) };
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
    const bag = this.shown, id = bag?.id ?? null;
    this.gauge.clear();
    this.bagId = id;
    this.dims = bagDims(id);
    this.swingP = swingParams(this.marks, this.dims);
    this.strap.setTexture(`train-strap-${sizeOf(id)}`);
    this.bagWorn = !!bag && bag.hits / bag.needed >= 0.8;
    this.bagKey = null;
    this.bagLook(false);
    this.bagBody.setVisible(true);
    const icon = bagIcon(id);
    this.bagIcon.setVisible(!!icon).setPosition(0, this.dims.h / 2);
    if (icon) this.bagIcon.setTexture(`amie-${icon}`);
    if (bag) this.drawHits(colorOf(id), bag.hits / bag.needed);
  }

  bagLook(dent) {
    const state = dent ? (this.bagWorn ? 'wornHit' : 'hit') : this.bagWorn ? 'worn' : 'normal', key = `${this.bagId}/${state}`;
    if (key !== this.bagKey) { this.bagKey = key; this.bagArt.setTexture(bagTexture(this.scene, this.bagId, state)); }
  }

  drop(found) {
    const L = this.hook.y - this.ropeTop;
    this.bagHang.y = L - (found ? 60 : 30);
    tween(this.scene, { targets: this.bagHang, y: L, duration: found ? 520 : 260, ease: found ? 'Bounce.easeOut' : 'Back.easeOut' }).catch(() => {});
  }

  drawHits(color, share) {
    const px = 1 / this.unit, g = this.gauge, w = 44, h = (this.tall ? 12 : 14) * px, x = this.hook.x - w / 2, y = this.hook.y + BAG.strap + this.dims.h + 6;
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
    const bag = () => this.toScreen(this.hook.x, this.hook.y + BAG.strap + this.dims.h / 2);
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
    this.sound.stopMusic();
    this.sayTimer?.remove();
    this.hint.remove();
    this.hud.remove();
    this.container.destroy();
    this.yard.destroy();
    restoreCanvas(this.scene, this.restoreSize);
    this.restoreSize = null;
    this.resolve(this.result());
  }

  play(events) {
    this.flush();
    for (const e of events) if (e.type === 'found') this.holdUntil = performance.now() / 1000 + FOUND_HOLD;
    const at = events.findIndex(e => e.type === 'punch');
    if (at < 0) this.show(events);
    else {
      this.show(events.slice(0, at));
      this.lunge();
      this.contacts.push({ at: this.life.t + HIT_DELAY, events: events.slice(at) });
    }
    if (this.core.resting) this.front.anims.timeScale = 0.35;
    if (!events.length) return;
    this.drawEnergy();
    this.onChange(this.result());
  }

  flush() {
    while (this.contacts.length) this.show(this.contacts.shift().events);
  }

  show(events) {
    const w = this.words;
    let burst = false;
    for (const e of events) {
      switch (e.type) {
        case 'hang':
          burst = false;
          this.shown = { id: e.id, hits: e.hits, needed: e.needed };
          this.drawBag();
          this.drop(e.found);
          break;
        case 'found':
          this.talk(w.found({ bag: w.bag[e.id] }), 2.4);
          this.later(() => this.burstAt('star', 5, this.hook.x, this.hook.y + BAG.strap + this.dims.h / 2, { rise: 1.2, scale: 1 }), 0.45);
          this.sound.play('found');
          break;
        case 'refuse':
          playError(this.scene);

          if (e.why === 'resting') this.emote('zzz');
          else this.talk(e.why === 'empty' ? w.empty : w.noEffect);
          break;
        case 'punch': this.punch(e); break;
        case 'cleared':
          burst = true;
          this.burstBag();

          this.meterPulse();
          break;
        case 'reset':
          burst = true;
          this.burstBag();
          this.sound.play('reset');
          this.talk(w.reset, 2.2);
          this.meterPulse();
          break;
        case 'effect':

          burst = true;
          this.burstBag();
          this.flyEffect();
          break;
        case 'soothing':
          burst = true;
          this.burstBag();
          this.emote(e.friendship ? 'heart' : 'dots');
          if (e.friendship) this.burstAt('heart', HEARTS, this.monX, this.feetY - this.reach * 1.6);
          break;

        case 'wind': this.later(() => this.emote('sparkle'), 2.3); this.sparkle(); this.sound.play('wind'); break;
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

    if (burst) { this.drawBag(); this.drop(false); }
  }

  emote(kind) { emote(this.scene, this.fx, kind, this.monX + 14, this.feetY - this.reach * 1.7); }

  later(fn, secs) { this.scene.time.delayedCall(secs * 1000, () => { if (this.isOpen) fn(); }); }

  lunge() {
    this.life.lunge = 1;
    this.fly(feetDust(this.monX, this.feetY, this.reach, Math.random));
  }

  punch(e) {
    const life = this.life;
    life.hitAt = life.t;
    life.strength = e.strength;
    hitSwing(this.swing, e.strength, this.swingP);
    this.sound.play(e.strength > 1 ? 'punch2' : 'punch1');
    if (!e.blank && this.shown) this.shown = { ...this.shown, hits: e.hits, needed: e.needed };
    this.drawBag();
    const at = this.bagPoint(-this.dims.w / 2, BAG.strap + this.dims.h * 0.55);
    this.burstAt('spark', e.strength, at.x, at.y, { rise: 0, scale: 1.2 });
    this.fly(sandHit(at.x, at.y, e.strength, Math.random));
    if (this.bagWorn) { const seam = this.bagPoint(this.dims.w / 2 - 6, BAG.strap + this.dims.h - 6); this.fly(sandLeak(seam.x, seam.y, this.feetY)); }
  }

  fly(bits) {
    for (const b of bits) {
      b.img = this.scene.add.image(b.x, b.y, b.tex === 'train-dust' ? this.dustKey : b.tex).setScale(2).setAlpha(b.delay ? 0 : 1);
      this.fx.add(b.img);
      this.bits.push(b);
    }
  }

  burstBag() {
    const s = this.scene, id = this.shown?.id ?? null, top = this.bagPoint(0, BAG.strap), mid = this.bagPoint(0, BAG.strap + this.dims.h / 2);
    const flash = s.add.image(top.x, top.y, `train-flash-${sizeOf(id)}`).setOrigin(0.5, 0).setScale(2).setRotation(this.swingRoot.rotation);
    this.fx.add(flash);
    tween(s, { targets: flash, alpha: 0, delay: 16, duration: 300 }).then(() => flash.destroy(), () => {});
    this.bagBody.setVisible(false);
    this.gauge.clear();
    this.fly(burstBits(id, mid.x, mid.y, this.feetY, Math.random));
    this.sound.play('burst');
    this.shown = null;
    this.burstAt('star', 6, mid.x, mid.y, { rise: 1.4, scale: 1 });
    this.burstAt('note', 2, this.monX, this.feetY - this.reach * 1.6);
    s.audio?.cry(this.mon).catch(() => {});
  }

  flyEffect() {
    const s = this.scene, star = s.add.image(this.hook.x, this.hook.y + BAG.strap + this.dims.h / 2, 'amie-star').setScale(1.2);
    this.fx.add(star);
    tween(s, { targets: star, x: this.effectAt.x, y: this.effectAt.y, scale: 0.6, duration: 650, ease: 'Sine.easeInOut' })
      .then(() => { star.destroy(); this.drawEffect(); this.sound.play('effect'); this.burstAt('spark', 2, this.effectAt.x, this.effectAt.y, { rise: 0.5, scale: 0.8 }); }, () => {});
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
    this.yard.update();

    while (this.contacts.length && this.contacts[0].at <= life.t) this.show(this.contacts.shift().events);
    life.lunge = Math.max(0, life.lunge - dt / 0.22);
    life.sink += ((this.core.resting ? 1 : 0) - life.sink) * (1 - Math.exp(-3 * dt));

    const toward = Math.max(0, this.hook.x - this.dims.w / 2 - this.reach - this.monX - 4);
    const lunge = Math.sin(life.lunge * Math.PI) * Math.min(26, toward);
    const breath = Math.sin(life.t * 3) * 0.015;
    this.holder.setPosition(this.monX + lunge, this.feetY);
    this.holder.setRotation(0.12 * Math.sin(life.lunge * Math.PI) + Math.sin(life.t * 1.6) * 0.03 * life.sink);

    this.holder.setScale(-this.scale * (1 + 0.04 * life.sink), this.scale * (1 + breath - 0.07 * life.sink));

    stepSwing(this.swing, dt, this.swingP);
    const { a, lag } = swingAngle(this.swing, this.swingP), sq = squashAt(life.t - life.hitAt, life.strength);
    this.swingRoot.setRotation(-a);
    this.bagHang.setRotation(-lag);
    this.bagBody.setScale(sq.sx, sq.sy);
    this.bagLook(sq.dent);
    this.bits = this.bits.filter(b => {
      const on = stepBit(b, dt);
      if (on) b.img.setPosition(b.x, b.y).setAlpha(b.alpha).setRotation(b.turn || 0);
      else b.img.destroy();
      return on;
    });
    if (this.core.resting && (this.zT -= dt) <= 0) {
      this.zT = 1.4;
      this.burstAt('zee', 1, this.monX + 16, this.feetY - this.reach * 1.5, { rise: 0.8, scale: 1.3 });
    }
  }
}

