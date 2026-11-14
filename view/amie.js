// Modified for PokeTale on 2026-11-14. See THIRD-PARTY-NOTICES.md.
// Motions ported from PlayNav (https://github.com/poooooby/PlayNav) src/amie/play.lua - lifeMotion / stepLife (breathing, sway, hops, the wriggle while stroked,
// the flinch, dozing), reward (a double hop with notes), the wake ("!", a white flash, it turns round), the high five leap, feeding (a flash with stars, then
// the food held at its mouth shrinking bite by bite, crumbs, the hearts; a full Pokemon turns the food away).
// PlayNav is MIT License, Copyright (c) 2026 poooooby - THIRD-PARTY-NOTICES.md.

import { createPetting, cellAt, bodyPixel, spotsFor, strokable, spinOf, MIDDLE_CELL, TICK_HZ, ENJOY_MAX, FULL_MAX, FULL_PER_FOOD, bitesOf, biteSeconds, eatsFood } from '../story/amie.mjs';
import { GAME_SPEND, GAMES, LEVELS, DEFAULT_LEVEL, recordOf, recordScore, beatsRecord } from '../story/amie-games.mjs';
import { tween } from './lifetime.js';
import { keyAction, playSelect, playError } from './ui/keys.js';
import { loadItemIcons } from './ui/bag.js';
import { loadFont } from './fonts.js';
import { placeSprite } from './sprites/placement.js';
import { amieTextures, loadItemSheet, foodPicture, foodElement, HEARTS, emote } from './amie-art.js';
import { playGame } from './amie-games.js';
import { fieldFor, fitCanvas, restoreCanvas, frameFor, petScale, gameBarFor } from './amie-layout.js';
import { mountAmieFrame } from './amie-frame.js';
import { petScene, storyPlace } from './amie-scenes.js';
import { mountScene, stillPictures } from './scene-bake.js';
import { closeWindow } from './frame-parts.js';
import { closePress } from './reply-notice.js';
import { amieSound, PET_SOUNDS } from './amie-sound.js';
import { moodOf, moodMotion, moodHop } from './amie-mood.js';

const TICK_MS = 1000 / TICK_HZ;

const FRAME_FONT = 'PkbPixel';

let playLevel = DEFAULT_LEVEL;

const TOUCH_SLOP = 2;

function frameAlpha(frame) {
  const width = frame.realWidth, height = frame.realHeight;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const trim = frame.data?.spriteSourceSize ?? { x: 0, y: 0 };
  ctx.drawImage(frame.source.image, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight, frame.trimmed ? trim.x : 0, frame.trimmed ? trim.y : 0, frame.cutWidth, frame.cutHeight);
  const { data } = ctx.getImageData(0, 0, width, height);
  canvas.width = 0;
  return { data, width, height };
}

const level = (value, steps) => steps.filter(t => value >= t).length;

export class AmieScreen {
  constructor(scene) { this.scene = scene; this.isOpen = false; }

  async load(mon, party) {
    const s = this.scene;
    const [front, back, others] = await Promise.all([s.assets.mon(mon, false), s.assets.mon(mon, true).catch(() => null),
      Promise.all(party.map(other => s.assets.mon(other, false).catch(() => null))),
      loadItemIcons(s).catch(() => {}), loadItemSheet(s).catch(() => {})]);
    s.life.check();

    return { front, back, others: party.flatMap((other, i) => (others[i] ? [{ uid: other.uid, enjoy: other.enjoy, asset: others[i] }] : [])) };
  }

  async open({ mon, num = 0, scene: story = {}, species = [], enjoy = ENJOY_MAX, full = 0, friendship, party = [], foods = [], puffFood, words, debug = false, spins = false,
    awake = false, trainWhy = null, lock = null, notice = null, records = {}, onChange = () => {}, onOpen = () => {} }) {
    const s = this.scene;
    if (this.isOpen) throw new Error('Petting screen already open');
    const { front, back, others } = await this.load(mon, party);
    amieTextures(s);
    loadFont(FRAME_FONT).catch(error => console.warn('[poke-battle] 쓰다듬기 글꼴을 올리지 못함 — 대체 글꼴로', error));
    this.isOpen = true;
    Object.assign(this, { mon, num, words, onChange, gained: 0, spins, spun: null, train: false, trainWhy, full, done: [], foods: foods.map(f => ({ ...f })), puffFood,
      friendship, debug, records: structuredClone(records ?? {}), place: storyPlace(story), time: story.time || 'day', still: stillPictures(), lock: debug && lock ? { on: !!lock.on, set: lock.set, writing: false } : null });
    const parent = s.options.parent, size = { width: parent.clientWidth, height: parent.clientHeight };
    this.shape(fieldFor(size.width, size.height), size);
    const W = this.W, H = this.H, f = frameFor(size.width, size.height);
    const c = this.container = s.add.container(0, -180);
    s.ui.addAt(c, 0);

    this.backdrop = mountScene(s, petScene({ place: this.place, time: this.time, w: W, h: H, px: this.unit, animate: !this.still, bleed: true }), { prefix: 'amie-scene' });
    c.add(this.backdrop.back);

    const box = front.bounds, bw = box.right - box.left, bh = box.bottom - box.top;
    this.feetY = this.toField(0, size.height - f.feet).y;
    this.scale = petScale({ ...size, battle: placeSprite(front, 'enemy').scale, body: { w: bw, h: bh } }).scale / this.unit;
    this.shadow = s.add.image(W / 2, this.feetY, 'amie-shadow').setDisplaySize(Math.min(150, bw * this.scale * 0.8), 9);
    this.shadowScale = this.shadow.scaleX;
    this.holder = s.add.container(W / 2, this.feetY);
    const picture = asset => {
      const sprite = s.add.sprite(0, 0, asset.key, asset.frame)
        .setOrigin((asset.bounds.left + asset.bounds.right) / 2 / asset.width, asset.bounds.bottom / asset.height);
      if (s.anims.exists(asset.key)) sprite.play(asset.key);
      return sprite;
    };
    this.front = picture(front);
    this.back = back ? picture(back) : null;
    this.holder.add([this.front, ...(this.back ? [this.back] : [])]);
    this.flash = s.add.rectangle(0, 0, W, H, 0xffffff).setOrigin(0).setAlpha(0);
    this.fx = s.add.container(0, 0);
    this.pet = s.add.container(0, 0, [this.shadow, this.holder, this.fx]);
    c.add([this.pet, this.backdrop.front]);
    this.asset = front;
    this.mates = others;
    this.players = [front, ...others.slice(0, 2).map(one => one.asset)];
    this.backAsset = back;
    this.alphas = new Map();

    const turned = !!this.back && !awake;
    this.petting = createPetting({ spots: spotsFor(species), enjoy, friendship, back: turned, stroke: strokable(num), friends: others });
    this.faceBack(turned);
    this.life = { calm: 0, hop: null, nextHop: 1.5, excite: 0, lean: 0, stroke: 0, flinch: 0, phase: 0, t: 0, jump: null, sink: 0, turn: 0, moodK: 0 };
    this.lively = 0.25 + 0.75 * Math.min(1, (level(friendship, [1, 50, 100, 150, 255]) + 2 * level(enjoy, [1, 20, 40, 60, 100])) / 12);
    c.add(this.flash);

    this.hud = mountAmieFrame(parent, { size, f, words, mon: { name: mon.name, gender: mon.gender, level: mon.level }, games: GAMES, levels: LEVELS, level: playLevel,
      picture: icon => foodElement(s, icon, parent.ownerDocument), busy: () => !!this.eating || !!this.playing, select: () => playSelect(s), notice,
      on: { food: (food, element) => this.offer(food, element), name: food => this.talk(food.name), game: (game, lv) => this.startGame(game, lv), level: lv => { playLevel = lv; },
        train: () => this.toTraining(), lock: () => this.toggleLock(), back: () => this.goBack(), close: () => this.pressClose() } });

    this.pressClose = closePress({
      round: () => !!this.playing?.inRound(),
      ask: () => this.hud.ask(this.words.quitAsk),

      stop: () => { this.afterGame = () => this.closeAll(); this.playing?.stop(); },
      close: () => {
        if (this.afterGame) return;
        if (this.playing) { this.afterGame = () => this.closeAll(); this.playing.stop(); } else this.closeAll();
      },
    });
    s.life.signal.addEventListener('abort', () => this.hud.remove(), { once: true });

    this.top = Math.ceil(gameBarFor(f) / this.unit);
    this.hud.setFoods(this.foods);
    this.showValues();
    this.finger = null;
    this.hover = null;
    this.eating = null;
    this.playing = null;
    this.acc = 0; this.strokeT = 0; this.zT = 0; this.cryAt = -Infinity; this.tiredAt = -Infinity;

    this.sound = amieSound(s.audio);
    this.sound.preload(PET_SOUNDS);
    this.sound.music('room');
    return new Promise(resolve => {
      this.resolve = resolve;
      this.listen();
      onOpen();
    });
  }

  shape({ w, h }, size) {
    this.W = w; this.H = h;
    this.unit = Math.min(size.width / w, size.height / h);
    this.at = { x: (size.width - w * this.unit) / 2, y: (size.height - h * this.unit) / 2 };
    const before = fitCanvas(this.scene, { w, h });
    this.restoreSize ??= before;
  }

  toField(x, y) { return { x: (x - this.at.x) / this.unit, y: (y - this.at.y) / this.unit }; }
  toScreen(x, y) { return { x: this.at.x + x * this.unit, y: this.at.y + y * this.unit }; }

  unshape() {
    restoreCanvas(this.scene, this.restoreSize);
    this.restoreSize = null;
  }

  result() { return { spent: this.petting.spent, gains: [...this.petting.gains], friends: this.petting.friendsSpent(), done: [...this.done], friendship: this.gained }; }
  changed() { this.onChange(this.result()); this.showValues(); }

  toTraining() {
    if (this.trainWhy) { this.talk(this.trainWhy, 1.8); playError(this.scene); return; }
    this.train = true;
    this.close();
  }

  talk(text, secs = 1.4) { this.hud.talk(text, secs); }

  emote(kind) {
    const h = this.head();
    emote(this.scene, this.fx, kind, h.x + 14, h.y - 2);
  }

  get gameBar() { return this.hud.game; }

  recordOf(game, lv) { return recordOf(this.records, game, lv); }

  noteRecord(game, lv, value) {
    const score = recordScore(value);
    if (!beatsRecord(game, score, this.recordOf(game, lv))) return;
    this.records = { ...this.records, [game]: { ...this.records[game], [lv]: score } };
    this.done.push({ record: { game, level: lv, score } });
  }

  puffName(id) { return this.puffFood(id).name; }
  puffPicture(id) { return foodElement(this.scene, { puff: id }, this.scene.options.parent.ownerDocument); }

  showValues() {
    this.hud.gauges({ enjoy: this.petting.enjoy / ENJOY_MAX, full: this.full / FULL_MAX });
    const lock = this.lock;
    const text = this.debug && this.words.debug ? this.words.debug({ enjoy: this.petting.enjoy, max: ENJOY_MAX, full: this.full, friendship: this.gained, now: this.friendship, locked: !!lock?.on }) : null;
    this.hud.debug(text, lock ? { on: lock.on, label: lock.on ? this.words.unlock : this.words.lock } : null);
  }

  async toggleLock() {
    const lock = this.lock;
    if (!lock || lock.writing) return;
    const next = !lock.on;
    lock.writing = true;
    lock.on = next;
    this.showValues();
    try {
      await lock.set(next);
    } catch (error) {
      console.warn('[poke-battle] 친밀도 고정을 쓰지 못함', error);
      lock.on = !next;
      if (this.isOpen) { this.showValues(); playError(this.scene); }
    } finally { lock.writing = false; }
  }

  canBack() { return this.isOpen; }

  faceBack(back) {
    this.front.setVisible(!back);
    this.back?.setVisible(back);
  }

  onBody(x, y) {
    const back = this.back?.visible, sprite = back ? this.back : this.front;
    const m = sprite.getWorldTransformMatrix();

    const slop = TOUCH_SLOP * 6 * this.W / this.scene.scale.displaySize.width;
    const at = m.applyInverse(x * 6, y * 6), side = m.applyInverse(x * 6 + slop, y * 6);
    const ox = sprite.originX * sprite.width, oy = sprite.originY * sprite.height;
    let alpha = this.alphas.get(sprite.frame);
    if (!alpha) this.alphas.set(sprite.frame, alpha = frameAlpha(sprite.frame));
    const pixel = bodyPixel(alpha.data, alpha.width, alpha.height, at.x + ox, at.y + oy, Math.hypot(side.x - at.x, side.y - at.y));
    return pixel && { pixel, bounds: (back ? this.backAsset : this.asset).bounds };
  }

  cellAtPoint(x, y) {
    const body = this.onBody(x, y);
    if (!body) return -1;
    const { pixel: p, bounds: b } = body;
    return cellAt((p.x + 0.5 - b.left) / (b.right - b.left), (p.y + 0.5 - b.top) / (b.bottom - b.top));
  }

  head() {
    const b = this.asset.bounds, h = (b.bottom - b.top) * this.scale;
    return { x: this.holder.x, y: this.holder.y - h * 0.85 };
  }

  mouth() {
    const b = this.asset.bounds, h = (b.bottom - b.top) * this.scale;
    return { x: this.holder.x, y: this.holder.y - h * 0.55 };
  }

  listen() {
    const s = this.scene, input = s.input;

    const field = p => { const w = s.cameras.main.getWorldPoint(p.x, p.y); return { x: w.x / 6, y: w.y / 6 }; };
    const down = p => {
      if (!this.isOpen || this.finger) return;
      const at = field(p);
      if (this.playing) { this.finger = { id: p.id, ...at, moved: 0 }; this.playing.down(at); return; }

      if (this.hud.menuOpen) { this.hud.back(); return; }
      if (this.eating) return;
      this.finger = { id: p.id, ...at, moved: 0 };
      this.path = [{ ...at, t: s.time.now }];
      this.play(this.petting.press(this.cellAtPoint(at.x, at.y)), at);
    };
    const move = p => {
      if (!this.isOpen) return;
      const at = field(p);
      this.hover = at;
      if (this.finger?.id !== p.id) return;
      if (this.playing) { Object.assign(this.finger, at); this.playing.move(at); return; }
      this.finger.moved += Math.hypot(at.x - this.finger.x, at.y - this.finger.y);
      Object.assign(this.finger, at);
      this.path?.push({ ...at, t: s.time.now });
    };
    const up = p => {
      if (!this.isOpen || this.finger?.id !== p.id) return;
      const at = field(p);
      this.finger = null;
      if (this.playing) { this.playing.up(at); return; }
      this.petting.release();
      this.reach = null;
      const spin = this.spins && this.path ? spinOf(this.path) : null;
      this.path = null;
      if (spin) { this.spun = spin; this.close(); }
    };
    const out = () => { this.hover = null; };
    const update = (_, delta) => this.frame(delta);
    input.on('pointerdown', down); input.on('pointermove', move); input.on('pointerup', up); input.on('pointerupoutside', up); input.on('gameout', out);
    s.events.on('update', update);

    const key = e => {
      if (e.repeat || keyAction(e) !== 'back') return;
      e.preventDefault(); e.stopImmediatePropagation();
      this.goBack();
    };
    const unlisten = s.life.listen(s.options.parent, 'keydown', key, true);
    this.unhook = () => {
      input.off('pointerdown', down); input.off('pointermove', move); input.off('pointerup', up); input.off('pointerupoutside', up); input.off('gameout', out);
      s.events.off('update', update);
      unlisten();
    };
  }

  goBack() {
    if (!this.isOpen) return;
    if (this.hud.answer(false)) return;
    if (this.playing) { if (!this.hud.game.back()) this.playing.stop(); }
    else if (!this.hud.back() && !this.eating) this.close();
  }

  closeAll() {

    if (this.isOpen && this.hud.root.isConnected && !closeWindow(this.hud.root)) this.close();
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.unhook?.();
    this.playing?.stop();
    this.sound.stopMusic();
    this.scene.game.canvas.style.cursor = '';
    this.hud.remove();
    this.container.destroy();
    this.backdrop.destroy();
    this.unshape();
    this.resolve({ ...this.result(), spin: this.spun, train: this.train });
  }

  frame(delta) {
    if (!this.isOpen) return;
    const dt = Math.min(250, delta) / 1000;
    if (!this.playing) this.backdrop.update();
    if (this.playing) { if (!this.hud.asking) this.playing.frame(dt); return; }
    this.acc += dt * 1000;

    const ticks = Math.floor(this.acc / TICK_MS);
    const f = this.eating ? null : this.finger;
    const perTick = f && ticks ? f.moved * (this.scene.scale.displaySize.width / this.W) / ticks : 0;
    for (let i = 0; i < ticks; i++) {
      this.acc -= TICK_MS;
      const cell = f ? this.cellAtPoint(f.x, f.y) : -1;
      this.play(this.petting.step({ down: !!f || !!this.eating, cell, moved: perTick }), f);
    }
    if (f && ticks) f.moved = 0;
    this.eat(dt);
    this.animate(dt);

    const over = this.hover && this.onBody(this.hover.x, this.hover.y);
    this.scene.game.canvas.style.cursor = over ? 'pointer' : '';
  }

  play(events, at) {
    const life = this.life;
    for (const e of events) {
      switch (e.type) {
        case 'wake': this.wake(); break;
        case 'awake': this.turnRound(); break;
        case 'stroke':
          if (e.spot === 'disliked') { life.flinch = 1; break; }
          life.stroke = 1;
          if ((this.strokeT += 1) >= TICK_HZ / 2) {
            this.strokeT = 0;
            this.burst(e.spot === 'liked' ? 'heart' : 'note', 1, at.x, at.y - 6, { scale: 1.3 });
          }
          break;
        case 'reward': this.reward(e); break;
        case 'dislike':
          life.flinch = 1.4; this.bump(-0.08);
          this.sound.play('dislike');
          this.mark('anger');
          break;

        case 'hit':
          this.bump(0.1);
          this.sound.play('tap');
          this.burst('spark', 1, at.x, at.y, { rise: 0, scale: 1.3 });
          if (e.angry) this.mark('anger');
          break;
        case 'pose': this.reach = { x: at.x, y: at.y }; this.burst('spark', 1, at.x, at.y, { rise: 0 }); break;
        case 'highFive': this.highFive(e, at); break;

        case 'doze': this.zT = 0; this.front.anims.timeScale = 0.35; break;
        case 'wakeUp': this.front.anims.timeScale = 1; this.burst('note', 2, this.head().x, this.head().y); break;
        default: break;
      }
      if (e.spent > 0) {
        this.gained += e.friendship;
        this.changed();
      }
    }
  }

  wake() {
    const h = this.head();
    const bang = this.scene.add.image(h.x + 14, h.y - 8, 'amie-bang').setOrigin(0.5, 1).setScale(2.2);
    this.fx.add(bang);
    this.scene.time.delayedCall(700, () => bang.destroy());
    this.bump(0.1);
  }

  turnRound() {
    const s = this.scene;
    this.flash.setAlpha(1);
    tween(s, { targets: this.flash, alpha: 0, duration: 500 }).catch(() => {});
    this.faceBack(false);
    const h = this.head();
    this.burst('note', 2, h.x - 24, h.y);
    this.burst('note', 1, h.x + 24, h.y);
    this.cry(true);
  }

  reward(e) {
    const h = this.head(), life = this.life;
    if (e.spent > 0) {
      this.burst('heart', HEARTS, h.x, h.y - 6);
      this.sound.play('reward');
      this.cry();
    } else this.tired();
    life.hop = { t: 0, dur: 0.32, h: 14, again: true };
    life.excite = 1;
    this.burst('note', 2, h.x - 22, h.y);
    this.burst('note', 2, h.x + 22, h.y);
  }

  tired() {
    if (this.scene.time.now - this.tiredAt <= 4000) return;
    this.tiredAt = this.scene.time.now;
    this.emote('dots');
  }

  highFive(e, at) {
    const target = this.reach ?? at;
    this.reach = null;
    this.life.jump = { t: 0, dur: 0.7, x: target.x, y: target.y, slapped: false };
    this.talk(this.words.highFive);
    this.cry(true);
    if (e.spent > 0) this.burst('heart', HEARTS, this.head().x, this.head().y - 6);
  }

  cry(now = false) {
    const s = this.scene;
    if (!now && s.time.now - this.cryAt < 4000) return;
    this.cryAt = s.time.now;
    s.audio?.cry(this.mon).catch(() => {});
  }

  bump(squash) { this.life.squash = squash; this.life.squashT = 0.35; }

  mark(name) {
    const h = this.head();
    const icon = this.scene.add.image(h.x + 18, h.y - 4, `amie-${name}`).setScale(1.3);
    this.fx.add(icon);
    tween(this.scene, { targets: icon, scale: 1.7, duration: 160, yoyo: true, repeat: 1 }).then(() => icon.destroy(), () => {});
  }

  burst(name, n, x, y, { rise = 1, scale = 1, into = this.fx, tweens = this.scene.tweens } = {}) {
    const s = this.scene;
    for (let i = 0; i < n; i++) {
      const icon = s.add.image(x + (Math.random() - 0.5) * 14, y, `amie-${name}`).setScale(scale * 0.7).setAlpha(0);
      into.add(icon);
      tweens.add({ targets: icon, alpha: { from: 0, to: 1 }, scale: scale, duration: 160, delay: i * 90 });
      tweens.add({
        targets: icon, x: icon.x + (Math.random() - 0.5) * 36 * rise, y: y - (22 + Math.random() * 14) * rise, alpha: 0,
        duration: rise ? 1000 + i * 90 : 450, delay: i * 90 + 160, ease: 'Sine.easeOut', onComplete: () => icon.destroy(),
      });
    }
  }

  offer(food, element) {
    const s = this.scene;

    this.talk(food.name);

    if (this.petting.stage === 'back' || this.petting.stage === 'dozing') { this.play(this.petting.press(MIDDLE_CELL), this.head()); this.petting.release(); }
    const m = this.mouth();
    const box = element.getBoundingClientRect(), screen = s.options.parent.getBoundingClientRect();
    const from = this.toField(box.left + box.width / 2 - screen.left, box.top + box.height / 2 - screen.top);
    const picture = foodPicture(s, food.icon, from.x, from.y, box.width * 0.7 / this.unit);
    this.fx.add(picture);

    const refuse = !eatsFood(this.num) ? 'cross' : this.full >= FULL_MAX ? 'drop' : null;
    this.eating = { food, picture, stage: 'fly', t: 0, bites: bitesOf(this.num), taken: 0, refuse };

    tween(s, { targets: picture, x: m.x + (refuse ? 18 : 0), y: m.y + 6, scale: picture.scale * 1.7, duration: 420, ease: 'Sine.easeOut' }).then(() => {
      if (!this.eating) return;
      if (refuse) {

        this.eating.stage = 'refuse'; this.life.turn = 1;
        this.emote(refuse);
        playError(s);
        tween(s, { targets: picture, y: from.y + 10, alpha: 0, delay: 500, duration: 400 }).then(() => { picture.destroy(); this.eating = null; }, () => {});
        return;
      }
      this.eating.stage = 'flash';
      this.burst('spark', 3, m.x, m.y, { rise: 0.4, scale: 1.2 });
      this.sound.play('serve');
    }, () => {});
  }

  eat(dt) {
    const e = this.eating;
    if (!e || (e.stage !== 'flash' && e.stage !== 'bite')) return;
    e.t += dt;
    if (e.stage === 'flash') {
      if (e.t >= 0.6) { e.stage = 'bite'; e.t = 0; }
      return;
    }
    if (e.t < biteSeconds(this.full, e.bites)) return;
    e.t = 0;
    e.taken++;
    const m = this.mouth();
    this.bump(0.08);
    this.sound.play(e.taken < e.bites ? 'bite' : 'eaten');
    this.burst('crumb', 3, m.x, m.y + 6, { rise: -0.4, scale: 1 });

    e.picture.setScale(e.picture.scaleX * (1 - 1 / (e.bites - e.taken + 1)) || 0.001);
    if (e.taken < e.bites) return;
    e.picture.destroy();
    this.eating = null;
    this.full = Math.min(FULL_MAX, this.full + FULL_PER_FOOD);
    this.gained += e.food.friendship;
    this.done.push({ fed: e.food.fed });
    if (e.food.count !== null) e.food.count--;
    this.hud.setFoods(this.foods);
    const h = this.head();
    this.burst('heart', HEARTS, h.x, h.y - 6);
    this.life.hop = { t: 0, dur: 0.32, h: 12, again: true };
    this.life.excite = 1;
    this.cry(true);
    this.changed();
  }

  async startGame(game, lv) {
    if (this.playing || this.eating) return;
    this.pet.setVisible(false); this.hud.show(false); this.backdrop.setVisible(false);
    const joined = this.petting.pickFriends();
    this.sound.music('game');
    this.players = [this.asset, ...joined.map(uid => this.mates.find(one => one.uid === uid).asset)];
    let again = false;
    try {
      const result = await playGame(this, game, lv);
      if (this.isOpen && result) {
        this.petting.spendFriends(joined, GAME_SPEND);
        const paid = this.petting.spend(GAME_SPEND);
        this.done.push({ won: result.prizes });
        this.noteRecord(game, lv, result.value);
        for (const id of result.prizes) this.winPuff(id);
        this.hud.setFoods(this.foods);
        this.gained += paid.friendship;
        this.changed();
        if (!paid.spent) this.tired();
        again = !!result.again;
      }
    } finally {
      this.playing = null;
      if (this.isOpen) { this.pet.setVisible(true); this.hud.show(true); this.backdrop.setVisible(true); this.sound.music('room'); }
    }

    const after = this.afterGame;
    this.afterGame = null;
    if (after) { after(); return; }

    if (again && this.isOpen) await this.startGame(game, lv);
  }

  winPuff(id) {
    const food = this.foods.find(f => f.fed.puff === id);
    if (food) { if (food.count !== null) food.count++; return; }
    const after = this.foods.findIndex(f => !f.fed.puff);
    this.foods.splice(after < 0 ? this.foods.length : after, 0, { ...this.puffFood(id), count: 1 });
  }

  animate(dt) {
    const life = this.life, stage = this.petting.stage, W = this.W;
    life.t += dt;
    const still = !!this.finger || !!this.eating || stage === 'dozing';
    const energy = Math.min(1.4, this.lively + 0.6 * life.excite);
    life.phase = (life.phase + (0.8 + 0.85 * energy) * Math.PI * dt * (stage === 'dozing' ? 0.4 : 1)) % (8 * Math.PI);
    life.calm += ((still ? 1 : 0) - life.calm) * (1 - Math.exp(-6 * dt));
    life.excite = Math.max(0, life.excite - dt / 1.6);
    life.stroke = Math.max(0, life.stroke - dt * 3);
    life.flinch = Math.max(0, life.flinch - dt * 2.5);
    life.turn = Math.max(0, life.turn - dt / 1.2);
    life.sink += ((stage === 'dozing' ? 1 : 0) - life.sink) * (1 - Math.exp(-3 * dt));

    const target = this.finger ? Math.max(-1, Math.min(1, (this.finger.x - W / 2) / 60)) : 0;
    life.lean += (target - life.lean) * (1 - Math.exp(-5 * dt));

    const mood = this.mood = moodOf({ status: this.mon.status, enjoy: this.petting.enjoy, full: this.full });
    const hopK = moodHop(mood);

    if (life.hop && (life.hop.t += dt) >= life.hop.dur) life.hop = life.hop.again ? { t: 0, dur: life.hop.dur, h: life.hop.h * 0.7 } : null;
    life.nextHop -= dt;
    if (!life.hop && life.nextHop <= 0) {
      if (!still && energy > 0.55 && stage === 'awake' && hopK > 0) life.hop = { t: 0, dur: 0.32, h: (6 + 14 * Math.min(1, energy)) * hopK, again: energy > 0.95 && hopK === 1 };
      life.nextHop = (energy > 0.9 ? 1.4 : 2.6) + Math.random() * 1.6;
    }
    const free = 1 - life.calm, t = life.t, ph = life.phase;
    const breath = Math.sin(ph) * (0.012 + 0.018 * energy) * (stage === 'dozing' ? 1.6 : 1);
    let tilt = Math.sin(ph * 0.5 + 0.7) * (0.015 + 0.05 * energy) * free;
    let dx = Math.sin(ph * 0.25) * (2 + 6 * energy) * free;
    let lift = (0.5 + 0.5 * Math.sin(ph)) * (1 + 2.5 * energy) * free;
    let sx = 1 - breath * 0.6, sy = 1 + breath;
    if (life.hop) {
      const f = life.hop.t / life.hop.dur;
      lift += Math.sin(f * Math.PI) * life.hop.h;
      if (f > 0.85) { sx += 0.06; sy -= 0.06; }
    }

    sy -= 0.05 * life.sink; sx += 0.03 * life.sink;
    tilt += Math.sin(t * 1.6) * 0.03 * life.sink;

    tilt += life.lean * 0.05 * life.calm;
    if (life.stroke > 0) {
      const k = life.stroke;
      tilt += Math.sin(t * 9) * 0.03 * k;
      sy += Math.sin(t * 9 + 1) * 0.025 * k; sx -= Math.sin(t * 9 + 1) * 0.015 * k;
      lift += (0.5 + 0.5 * Math.sin(t * 9)) * 1.5 * k;
    }

    if (life.flinch > 0) dx += Math.sin(t * 40) * 2.5 * life.flinch - life.lean * 4 * life.flinch;

    if (life.turn > 0) sx *= Math.sin(life.turn * Math.PI * 2) > 0 ? -1 : 1;

    if (life.squashT > 0) {
      life.squashT -= dt;
      const k = Math.max(0, life.squashT / 0.35) * life.squash;
      sy -= k; sx += k * 0.6;
    }

    life.moodK += ((stage === 'awake' && !still && !life.jump ? 1 : 0) - life.moodK) * (1 - Math.exp(-4 * dt));
    if (life.moodK > 0.01) {
      const g = moodMotion(mood, t, { still: this.still });
      dx += g.dx * life.moodK; lift += g.lift * life.moodK; tilt += g.tilt * life.moodK;
      sx += g.sx * life.moodK; sy += g.sy * life.moodK;
    }

    let jx = 0, jy = 0;
    if (life.jump) {
      const j = life.jump;
      j.t += dt;
      const f = Math.min(1, j.t / j.dur), up = Math.sin(f * Math.PI);
      const h = this.head();
      jx = (j.x - W / 2) * 0.6 * up;
      jy = Math.min(0, (j.y - h.y) * 0.75 + lift) * up - 18 * up;
      if (!j.slapped && f >= 0.4) {
        j.slapped = true;
        this.sound.play('highFive');
        this.burst('spark', 2, j.x, j.y, { rise: 0, scale: 1.4 });
      }
      if (f >= 1) life.jump = null;
    }
    this.holder.setPosition(W / 2 + dx + jx, this.feetY - lift + jy);
    this.holder.setRotation(tilt);
    this.holder.setScale(this.scale * sx, this.scale * sy);
    this.shadow.scaleX = this.shadowScale * Math.max(0.6, 1 - (lift - jy) / 120);

    if (stage === 'dozing' && (this.zT -= dt) <= 0) {
      this.zT = 1.4;
      const h = this.head();
      this.burst('zee', 1, h.x + 20, h.y, { rise: 0.8, scale: 1.4 });
    }
  }
}
