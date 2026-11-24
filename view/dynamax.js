import { tween, delay } from './lifetime.js';
import { fieldPositions, isPlayerSide } from './positions.js';
import { fieldLayout, mapPoint, compactSpots, HORIZON } from './dynamax-layout.js';
import { BASE_HOME } from './arena.js';
import { zTextures } from './ui/z-art.js'; // the Dynamax emblem pictures (button, cursor, G-Max mark)

export const DYNAMAX_RED = 0xe8283c;

const TIMES = { boxes: 1000, flash: 500, swap: 500, still: 250, grow: 1500, settle: 1000, shrink: 650 };

const GROW_STEPS = [[0, 0], [1 / 3, 0.5], [1 / 2, 0.5], [5 / 6, 1], [1, 1]];
const inOut = u => (u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2); // Cubic.easeInOut
export function steppedGrow(v) {
  for (let i = 1; i < GROW_STEPS.length; i++) {
    const [t0, p0] = GROW_STEPS[i - 1], [t1, p1] = GROW_STEPS[i];
    if (v <= t1) return p0 + (p1 - p0) * inOut((v - t0) / (t1 - t0 || 1));
  }
  return 1;
}

const AURA_FADE = 400;
const AURA = { rings: [[1.2, 0.9], [2.6, 0.45]], period: 900 };

const SHADOW = { width: 0.8, height: 0.16, color: 0x1e0a14, rings: [[1, 0.16], [0.82, 0.16], [0.62, 0.16]] };

const SKY = { wash: 0.16, washColor: 0x961428 };

const CLOUD_SHEETS = {
  cloud: { file: 'PRAS- Defog', frames: [0, 1, 2, 3, 4, 5, 6], opaque: true },
  puff: { file: 'PRAS- Smokescreen', frames: [0, 1, 2, 3, 4, 5, 6, 7, 8] }, // smoke puffs (Smokescreen): the burst at the feet while it grows
};

const CLOUD_RAMP = [[40, 0, 12], [112, 4, 26], [170, 24, 44]];

const HALO = { count: 5, lift: 0.06, rx: 0.36, ry: 0.09, size: 0.25, speed: 0.8, alpha: 0.95 };
const PUFFS = { count: 7, duration: 900, spread: 0.7 };

const SOUND = { grow: 'se/charge.wav', shrink: 'se/pb_rel.wav' };

const lerp = (a, b, t) => a + (b - a) * t;

const wallStep = fn => { let last = null; return () => { const now = performance.now(); fn(last === null ? 0 : Math.min(0.25, (now - last) / 1000)); last = now; }; };

function bodyLocal(pokemon) {
  const h = pokemon.home ?? pokemon.placement, k = h.scale || 1, b = h.box;
  return { left: (b.left - h.x) / k, right: (b.right - h.x) / k, top: (b.top - h.y) / k, bottom: (b.bottom - h.y) / k };
}

function mapPlacement(home, t) {
  if (t.zoom === 1 && !t.move[0] && !t.move[1]) return home;
  const [x, y] = mapPoint(t, [home.x, home.y]), [left, top] = mapPoint(t, [home.box.left, home.box.top]), [right, bottom] = mapPoint(t, [home.box.right, home.box.bottom]);
  return { ...home, x, y, box: { left, top, right, bottom }, anchor: home.anchor && [home.anchor[0] * t.zoom, home.anchor[1] * t.zoom] };
}

function recolour(img, opaque = false) {
  const canvas = document.createElement('canvas');
  canvas.width = img.width; canvas.height = img.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height), px = data.data;
  let top = 1;
  for (let i = 0; i < px.length; i += 4) if (px[i + 3]) top = Math.max(top, 0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2]);
  for (let i = 0; i < px.length; i += 4) {
    if (!px[i + 3]) continue;
    const v = Math.min(1, (0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2]) / top);
    const [a, b, t] = v < 0.6 ? [CLOUD_RAMP[0], CLOUD_RAMP[1], v / 0.6] : [CLOUD_RAMP[1], CLOUD_RAMP[2], (v - 0.6) / 0.4];
    for (let c = 0; c < 3; c++) px[i + c] = Math.round(a[c] + (b[c] - a[c]) * t);
    if (opaque && px[i + 3] > 40) px[i + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

const opaqueBoxes = new Map();
function opaqueBox(scene, key) {
  if (opaqueBoxes.has(key)) return opaqueBoxes.get(key);
  let box = null;
  try {
    const frame = scene.textures.getFrame(key), img = frame.source.image;
    const canvas = document.createElement('canvas');
    canvas.width = frame.cutWidth; canvas.height = frame.cutHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight, 0, 0, frame.cutWidth, frame.cutHeight);
    const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let l = canvas.width, t = canvas.height, r = 0, b = 0;
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
      if (!px[(y * canvas.width + x) * 4 + 3]) continue;
      l = Math.min(l, x); t = Math.min(t, y); r = Math.max(r, x + 1); b = Math.max(b, y + 1);
    }
    if (r > l) box = { x: l, y: t, w: r - l, h: b - t };
  } catch { box = null; }
  opaqueBoxes.set(key, box);
  return box;
}

class Sky {
  constructor(scene) { this.scene = scene; this.state = { tilt: 0, level: 0 }; }
  get bg() { return this.scene.biomeObjects?.[0]; }

  parts() {
    const s = this.scene, bg = this.bg;
    if (!bg?.setCrop || !s.add?.sprite) return null;
    if (this.for !== bg) {
      this.destroy();
      this.for = bg;
      this.ground = s.add.sprite(0, 0, bg.texture.key, bg.frame?.name).setOrigin(0).setDepth(bg.depth).setVisible(false);
      this.wash = s.add.graphics().setDepth(bg.depth + 0.01);
      bg.once?.('destroy', () => this.destroy());
    }
    return this;
  }
  /** Draws state: the split background, the wash */
  set(tilt, level) {
    this.state = { tilt, level };
    const p = this.parts(), bg = this.bg;
    if (!p) return;
    const height = bg.height, width = bg.width, h = HORIZON + tilt;
    if (!tilt) { bg.setCrop?.(); bg.setScale(6).setPosition(0, 0); this.ground.setVisible(false); }
    else {
      bg.setCrop(0, 0, width, HORIZON).setScale(6, 6 * h / HORIZON).setPosition(0, 0);
      const k = (height - h) / (height - HORIZON);
      this.ground.setCrop(0, HORIZON, width, height - HORIZON).setScale(6, 6 * k).setPosition(0, (h - HORIZON * k) * 6).setVisible(true);
    }
    this.wash.clear();
    if (level > 0) {
      const a = SKY.wash * level, c = SKY.washColor;
      this.wash.fillGradientStyle(c, c, c, c, a, a, 0, 0).fillRect(0, 0, width * 6, (h + 20) * 6);
    }
  }
  destroy() {
    this.ground?.destroy(); this.wash?.destroy();
    this.ground = this.wash = null; this.for = null;
  }
}

class Mist {
  constructor(scene, pokemon) {
    this.scene = scene; this.pokemon = pokemon; this.level = { value: 0 }; this.time = 0; this.puffs = [];
    const b = this.body = bodyLocal(pokemon);
    this.w = b.right - b.left; this.h = b.bottom - b.top; this.cx = (b.left + b.right) / 2;
    const frames = CLOUD_SHEETS.cloud.frames;
    this.parts = Array.from({ length: HALO.count }, (_, i) => {
      const sprite = scene.add.sprite(0, 0, 'dmax-cloud:cloud', frames[(i * 3) % frames.length]).setAlpha(0);
      pokemon.container.addAt(sprite, 0);
      return { sprite, angle: (i / HALO.count) * Math.PI * 2, flip: i % 2 ? -1 : 1, front: null };
    });
    this.update = wallStep(dt => this.step(dt));
    scene.events?.on?.('postupdate', this.update);
    pokemon.container.once?.('destroy', () => this.destroy());
    this.step(0);
  }
  step(dt) {
    if (!this.parts) return;
    this.time += dt;
    const c = this.pokemon.container, k = (this.w * HALO.size) / 64, cy = this.body.top + this.h * HALO.lift;
    this.parts.forEach((p, i) => {
      const angle = p.angle + this.time * HALO.speed, sin = Math.sin(angle), front = sin > 0;
      if (p.front !== front) { if (front) c.bringToTop(p.sprite); else c.sendToBack(p.sprite); p.front = front; }

      const near = 0.85 + 0.15 * sin;
      p.sprite.setPosition(this.cx + Math.cos(angle) * this.w * HALO.rx, cy + sin * this.w * HALO.ry + Math.sin(this.time * 1.7 + i) * this.h * 0.01)
        .setScale(k * near * p.flip, k * near).setAlpha(this.level.value * HALO.alpha * (0.75 + 0.25 * near));
    });
    for (const puff of this.puffs) {
      puff.t += dt * 1000;
      const f = Math.min(1, Math.max(0, puff.t) / PUFFS.duration), frames = CLOUD_SHEETS.puff.frames;
      puff.sprite.setFrame(frames[Math.min(frames.length - 1, Math.floor(f * frames.length))])
        .setPosition(this.cx + puff.dx * f * this.w * PUFFS.spread, this.body.bottom - this.h * 0.05 + puff.dy * f * this.h * 0.2)
        .setAlpha(puff.t < 0 ? 0 : 0.85 * (1 - f * f)).setScale(puff.scale * (0.8 + 0.6 * f));
    }
    const done = this.puffs.filter(puff => puff.t >= PUFFS.duration);
    done.forEach(puff => puff.sprite.destroy());
    if (done.length) this.puffs = this.puffs.filter(puff => puff.t < PUFFS.duration);
  }
  /** The burst of smoke puffs rolling out from the feet as it starts to grow */
  billow() {
    const c = this.pokemon.container;
    for (let i = 0; i < PUFFS.count; i++) {
      const a = (i / PUFFS.count) * Math.PI * 2;
      const sprite = this.scene.add.sprite(0, 0, 'dmax-cloud:puff', 0).setAlpha(0);
      if (Math.sin(a) > 0) c.add(sprite); else c.addAt(sprite, 0);
      this.puffs.push({ sprite, t: -i * 40, dx: Math.cos(a), dy: Math.sin(a), scale: (this.w * 0.55) / 64 });
    }
  }
  async to(value, duration) {
    if (!duration) { this.level.value = value; return; }
    await tween(this.scene, { targets: this.level, value, duration, ease: 'Sine.easeInOut' });
  }
  destroy() {
    if (!this.parts) return;
    this.scene.events?.off?.('postupdate', this.update);
    this.parts.forEach(p => p.sprite.destroy()); this.puffs.forEach(p => p.sprite.destroy());
    this.parts = null; this.puffs = [];
  }
}

class FieldLayout {
  constructor(scene) { this.scene = scene; this.sky = new Sky(scene); this.middles = {}; this.motion = null; this.who = null; }
  homeOf(pokemon) { return (pokemon.home ??= pokemon.placement); }

  field(extra) {
    const s = this.scene, out = {};
    for (const position of fieldPositions(s.double)) {
      const p = extra?.side === position ? extra : s.pokemon?.[position];
      if (p && (p === extra || p.container.visible)) out[position] = p;
    }
    return out;
  }

  async apply(duration, { extra, ease: easing } = {}) {
    const s = this.scene;
    this.finish();
    const mons = this.field(extra);
    const layout = fieldLayout(s.double, Object.fromEntries(Object.entries(mons).map(([position, p]) => [position, { box: this.homeOf(p).box, giant: !!p.mon?.dynamax }])));
    this.who = layout.who;
    const moves = [];
    const move = (object, to, now = false) => {
      if (!object) return;
      if (now || !duration) { for (const [k, v] of Object.entries(to)) object[k] = v; return; }
      moves.push([object, Object.fromEntries(Object.entries(to).map(([k, v]) => [k, [object[k], v]]))]);
    };
    // the Pokemon
    for (const [position, p] of Object.entries(mons)) {
      const t = layout.mons[position], home = this.homeOf(p), placement = mapPlacement(home, t);
      const off = [p.container.x - p.placement.x, p.container.y - p.placement.y]; // the substitute's step aside stays
      p.placement = placement; p.grow = t.zoom;
      const now = p === extra;
      move(p.container, { x: placement.x + off[0], y: placement.y + off[1], scaleX: home.scale * t.zoom, scaleY: home.scale * t.zoom }, now);
      const shadow = t.kind === 'giant' ? this.shadow(p) : p.dmaxShadow;
      move(shadow, { alpha: t.kind === 'giant' ? 1 : 0 }, now);
    }

    const [, playerBase, enemyBase] = s.biomeObjects ?? [];
    for (const [side, base] of [['player', playerBase], ['enemy', enemyBase]]) {
      if (!base) continue;
      const b = layout.bases[side], [x, y] = mapPoint(b, BASE_HOME[side]);
      move(base, { x, y, scaleX: b.zoom, scaleY: b.zoom, alpha: b.show ? 1 : 0 });
    }
    // the small bases of the middle ones (rule 4)
    const wanted = new Set(layout.middles.map(m => m.position));
    for (const m of layout.middles) {
      const base = this.middleBase(m), now = !base.visible;
      if (now) base.setPosition(m.x, m.y).setAlpha(0).setVisible(true);
      move(base, { x: m.x, y: m.y, alpha: 1 }, now && !duration);
    }
    for (const [position, base] of Object.entries(this.middles)) if (!wanted.has(position)) move(base, { alpha: 0 });
    // the sky
    const sky = { ...this.sky.state }, to = { tilt: layout.camera.tilt, level: layout.who ? 1 : 0 };
    // the info boxes (rule 6)
    const shown = Object.keys(mons).filter(position => s.info?.[position]);
    const spots = layout.who ? compactSpots(shown) : {};

    const reds = Object.fromEntries(shown.map(position => [position, !!mons[position]?.mon?.dynamax && !!layout.who]));

    const boxTime = easing ? TIMES.boxes : duration;
    const boxes = shown.map(position => s.info[position].slideTo(spots[position] ?? null, boxTime, reds[position]));
    this.order(mons, layout);
    if (!duration) { this.sky.set(to.tilt, to.level); this.cleanMiddles(wanted); await Promise.all(boxes); return; }
    const progress = { t: 0 };
    const step = () => {
      for (const [object, props] of moves) for (const [k, [a, b]] of Object.entries(props)) object[k] = lerp(a, b, progress.t);
      this.sky.set(lerp(sky.tilt, to.tilt, progress.t), lerp(sky.level, to.level, progress.t));
    };
    this.motion = { finish: () => { progress.t = 1; step(); this.cleanMiddles(wanted); this.motion = null; } };
    const ease = easing ?? (layout.who ? 'Sine.easeInOut' : 'Cubic.easeInOut');
    const motion = this.motion;
    await Promise.all([tween(s, { targets: progress, t: 1, duration, ease, onUpdate: step }), ...boxes]);
    if (this.motion === motion) this.motion.finish();
  }
  /** Jumps a running move to its end */
  finish() { this.motion?.finish(); }

  order(mons, layout) {
    const field = this.scene.field;
    if (!field?.getIndex) return;
    const items = Object.entries(mons).sort(([a], [b]) => layout.mons[a].depth - layout.mons[b].depth)
      .flatMap(([position, p]) => [this.middles[position], p.container]).filter(o => o && field.exists(o));
    if (!items.length) return;
    let at = Math.min(...items.map(o => field.getIndex(o)));
    for (const o of items) field.moveTo(o, at++);
  }

  shadow(pokemon) {
    if (pokemon.dmaxShadow || !this.scene.add?.graphics) return pokemon.dmaxShadow;
    const b = bodyLocal(pokemon), w = (b.right - b.left) * SHADOW.width, h = w * SHADOW.height, g = this.scene.add.graphics().setAlpha(0);
    for (const [k, a] of SHADOW.rings) g.fillStyle(SHADOW.color, a).fillEllipse((b.left + b.right) / 2, b.bottom + h * 0.1, w * k, h * k);
    pokemon.container.addAt(g, 0);
    pokemon.dmaxShadow = g;
    return g;
  }

  middleBase({ position, side, width }) {
    const s = this.scene;
    if (this.middles[position]) return this.middles[position];
    const c = s.add.container(0, 0).setVisible(false);
    const base = s.biomeObjects?.[side === 'player' ? 1 : 2]?.list?.[0], key = base?.texture?.key;
    const box = key ? opaqueBox(s, key) : null;
    const k = box ? width / box.w : 1, bh = box ? box.h * k : width * 0.25;
    const shadow = s.add.graphics().fillStyle(0x142814, 0.25).fillEllipse(0, 0, width * 1.1, bh * 0.9 + 4).fillStyle(0x142814, 0.2).fillEllipse(0, 0, width * 0.9, bh * 0.7 + 2);
    c.add(shadow);
    if (box) c.add(s.add.sprite(0, 0, key, base.frame?.name).setCrop(box.x, box.y, box.w, box.h).setOrigin(0).setScale(k).setPosition(-(box.x + box.w / 2) * k, -(box.y + box.h / 2) * k));
    s.field.add(c);
    this.middles[position] = c;
    return c;
  }
  cleanMiddles(wanted) {
    for (const [position, base] of Object.entries(this.middles)) if (!wanted.has(position)) { base.destroy(); delete this.middles[position]; }
  }
}

export class DynamaxView {
  constructor(scene) { this.scene = scene; this.layout = new FieldLayout(scene); this.cloudsReady = null; }

  preload() { zTextures(this.scene); return this.scene.assets?.image?.('pbinfo_player_mini', 'images/ui/pbinfo_player_mini.png') ?? Promise.resolve(); }

  loadClouds() {
    const s = this.scene;
    if (!this.cloudsReady) {
      this.cloudsReady = (typeof document === 'undefined' || !s.textures?.addCanvas || !s.assets?.loadImage) ? Promise.resolve(false)
        : Promise.all(Object.entries(CLOUD_SHEETS).map(async ([name, { file, opaque }]) => {
          const key = `dmax-cloud:${name}`;
          if (s.textures.exists(key)) return;
          const img = await s.assets.loadImage(s.assets.url(`images/battle_anims/${encodeURIComponent(file)}.png`));
          if (s.textures.exists(key)) return;
          const canvas = recolour(img, opaque), texture = s.textures.addCanvas(key, canvas);
          const cols = Math.floor(canvas.width / 96), rows = Math.floor(canvas.height / 96);
          for (let i = 0; i < cols * rows; i++) texture.add(i, 0, (i % cols) * 96, Math.floor(i / cols) * 96, 96, 96);
        })).then(() => true, error => { s.assets?.diagnostics?.push?.({ dynamaxClouds: String(error?.message ?? error) }); return false; });
    }
    return this.cloudsReady;
  }

  applySprite(pokemon) {
    pokemon.home = pokemon.placement;
    if (pokemon.mon?.dynamax) {
      this.addAura(pokemon);
      this.loadClouds().then(ok => { if (ok && pokemon.mon?.dynamax && pokemon.container.scene) this.addMist(pokemon)?.to(1, 0); });
    }
    if (pokemon.mon?.dynamax || this.layout.who) this.layout.apply(0, { extra: pokemon });
  }

  applyInfo(info, side) {
    if (!this.layout.who) return;
    const s = this.scene, shown = fieldPositions(s.double).filter(p => p === side || s.info?.[p]?.container?.visible);
    info.setCompact(compactSpots(shown)[side] ?? null);
  }

  addAura(pokemon, fade = AURA_FADE) {
    const s = this.scene;
    if (pokemon.aura || !s.add?.sprite) return;
    const { sprite, asset } = pokemon, c = pokemon.container;

    const rings = AURA.rings.flatMap(([width, alpha], ring) => [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]
      .map(([dx, dy]) => ({ dx: dx * width, dy: dy * width, alpha, ring })));
    const level = { value: 0, pulse: 0 };
    const copies = rings.map(r => {
      const copy = s.add.sprite(0, 0, asset.key, sprite.frame?.name ?? asset.frame).setOrigin(sprite.originX, sprite.originY).setTintFill(DYNAMAX_RED).setAlpha(0);
      c.addAt(copy, c.getIndex(sprite));
      return { copy, ...r };
    });
    const follow = () => {
      const name = sprite.frame?.name, k = Math.abs(c.scaleX) || 1;

      const copy = sprite.visible === false && pokemon.animCopy?.scene ? pokemon.animCopy : null;
      const shown = sprite.visible !== false || (copy?.visible ?? false);
      const ky = Math.abs(c.scaleY) || 1;
      const at = copy ? { x: (copy.x - c.x) / k, y: (copy.y - c.y) / ky, sx: copy.scaleX / k, sy: copy.scaleY / ky, ox: 0.5, oy: 0.5, a: copy.alpha }
        : { x: sprite.x, y: sprite.y, sx: sprite.scaleX, sy: sprite.scaleY, ox: sprite.originX, oy: sprite.originY, a: 1 };
      const frame = copy ? copy.frame?.name : name;
      for (const r of copies) {
        if (frame !== undefined && r.copy.frame?.name !== frame) r.copy.setFrame(frame);
        if (r.copy.originX !== at.ox || r.copy.originY !== at.oy) r.copy.setOrigin(at.ox, at.oy);
        if (r.copy.scaleX !== at.sx || r.copy.scaleY !== at.sy) r.copy.setScale(at.sx, at.sy);
        const w = r.ring ? 1 + 0.35 * level.pulse : 1;
        r.copy.setPosition(at.x + r.dx * w / k, at.y + r.dy * w / ky).setAlpha(shown ? at.a * level.value * r.alpha * (r.ring ? 0.6 + 0.4 * level.pulse : 1) : 0);
      }
    };
    s.events?.on?.('postupdate', follow);
    follow();
    const fadeIn = s.tweens.add({ targets: level, value: 1, duration: fade });
    const pulse = s.tweens.add({ targets: level, pulse: 1, duration: AURA.period, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    pokemon.aura = { copies, level, stop: () => { fadeIn.remove?.(); pulse?.remove?.(); s.events?.off?.('postupdate', follow); copies.forEach(r => r.copy.destroy()); } };
    c.once?.('destroy', () => pokemon.aura?.stop());
  }

  removeAura(pokemon, fade = 0) {
    const aura = pokemon.aura;
    pokemon.aura = null;
    if (!aura) return;
    if (!fade || !aura.level) { aura.stop(); return; }
    this.scene.tweens.add({ targets: aura.level, value: 0, duration: fade, onComplete: () => aura.stop() });
  }
  addMist(pokemon) {
    if (!pokemon.mist && this.scene.add?.sprite && this.scene.textures?.exists?.('dmax-cloud:puff')) pokemon.mist = new Mist(this.scene, pokemon);
    return pokemon.mist;
  }
  removeMist(pokemon) { pokemon.mist?.destroy(); pokemon.mist = null; }

  async dynamax(side, { gmax = false, form } = {}) {
    const s = this.scene;
    let pokemon = s.requireMon(side);
    if (pokemon.mon.dynamax) return;
    const base = { speciesId: pokemon.mon.speciesId, spriteId: pokemon.mon.spriteId };
    const clouded = await this.loadClouds();
    const sound = s.audio.play(SOUND.grow);
    const tint = pokemon.tintIn(DYNAMAX_RED, TIMES.flash, 'Sine.easeIn');
    if (gmax && form?.spriteId) {
      // Prepare the confirmed form after the red tint is on screen, without creating its actor.
      const overlay = pokemon.getTintSprite(), events = s.game.events;
      let early;
      const prepare = () => {
        if (!overlay.visible || overlay.alpha <= 0) return;
        events.off('postrender', prepare);
        if (s.life.signal.aborted) return;
        const next = { ...pokemon.mon, speciesId: form.speciesId, spriteId: form.spriteId };
        early = s.assets.mon(next, isPlayerSide(side)).catch(() => {});
      };
      events.on('postrender', prepare);
      try { await tint; } finally { events.off('postrender', prepare); }
      // The normal swap still owns actor creation and retries if the early request failed.
      if (early) await early;
      s.life.check();
      pokemon = await this.crossChange(side, form);
    } else await tint;
    pokemon.mon.dynamax = { kind: gmax ? 'gmax' : 'dynamax', base };
    await delay(s, TIMES.still);
    this.addAura(pokemon, TIMES.grow * GROW_STEPS[1][0]);
    const mist = clouded ? this.addMist(pokemon) : null;
    mist?.billow();
    await Promise.all([this.layout.apply(TIMES.grow, { ease: steppedGrow }), mist?.to(1, TIMES.grow)]);
    await Promise.all([pokemon.untint(TIMES.settle, 'Cubic.easeOut'), sound, gmax ? s.audio.cry(pokemon.mon) : null]);
  }

  async undynamax(side, { fainted = false, stay = false } = {}) {
    const s = this.scene;
    let pokemon = s.requireMon(side);
    const state = pokemon.mon.dynamax;
    if (!state) return;
    if (fainted) {

      this.removeAura(pokemon);
      pokemon.mon.dynamax = undefined;
      if (!stay) await Promise.all([this.layout.apply(TIMES.shrink), pokemon.mist?.to(0, TIMES.shrink * 0.6)]);
      this.removeMist(pokemon);
      return;
    }

    const sound = s.audio.play(SOUND.shrink);
    await pokemon.tintIn(DYNAMAX_RED, TIMES.flash, 'Sine.easeIn');
    this.removeAura(pokemon, AURA_FADE);
    pokemon.mon.dynamax = undefined;
    await Promise.all([this.layout.apply(TIMES.grow, { ease: steppedGrow }), pokemon.mist?.to(0, TIMES.grow * 0.6)]);
    this.removeMist(pokemon);
    await delay(s, TIMES.still);
    if (state.kind === 'gmax') pokemon = await this.crossChange(side, state.base);
    await Promise.all([pokemon.untint(TIMES.settle, 'Cubic.easeOut'), sound]);
    await delay(s, 150);
  }

  async crossChange(side, form) {
    const s = this.scene, before = s.requireMon(side);
    const { old, sprite, swap } = await s.effects.formSprite(side, { speciesId: form.speciesId, spriteId: form.spriteId, shiny: before.mon.shiny });
    old.getSprite().setVisible(false);
    sprite.playAnim(); sprite.getSprite().setVisible(false); sprite.tint(DYNAMAX_RED);
    sprite.container.setScale(0.01).setVisible(true);
    await Promise.all([
      tween(s, { targets: old.container, scale: 0.01, ease: 'Cubic.easeInOut', duration: TIMES.swap }),
      tween(s, { targets: sprite.container, scale: sprite.getSpriteScale(), ease: 'Cubic.easeInOut', duration: TIMES.swap }),
    ]);
    swap(); sprite.getSprite().setVisible(true);
    return s.requireMon(side);
  }

  async leave() {
    const giants = Object.entries(this.scene.pokemon ?? {}).filter(([, p]) => p?.mon?.dynamax && p.container?.visible).map(([side]) => side);
    for (const side of giants) await this.undynamax(side);
    if (!giants.length && this.layout.who) await this.layout.apply(TIMES.grow, { ease: steppedGrow });
  }

  settleCamera() { return this.layout.apply(0); }

  restoreMon(mon, value) {
    const kind = value?.kind;
    if (kind !== 'dynamax' && kind !== 'gmax') return mon;
    const base = { speciesId: mon.speciesId, spriteId: mon.spriteId };
    const form = kind === 'gmax' && value.form?.spriteId ? value.form : null;
    return { ...mon, ...(form ? { speciesId: form.speciesId, spriteId: form.spriteId } : {}), dynamax: { kind, base } };
  }
}
