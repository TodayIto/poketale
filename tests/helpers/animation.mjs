import { createRequire } from 'node:module';
import { framePosition } from '../../view/anims/geometry.js';
import { firstOnSide, isPlayerSide } from '../../view/positions.js';
const require = createRequire(import.meta.url);
const Transform = require('phaser/src/gameobjects/components/Transform.js');
const Alpha = require('phaser/src/gameobjects/components/Alpha.js');
const Visible = require('phaser/src/gameobjects/components/Visible.js');

export function animationFixture(source, options = {}) {
  const scene = { objects: new Set(), pokemon: {}, frames: [], waits: [], sounds: [], life: { check() {} },
    metrics: { effects: 0, actors: 0, destroyed: 0, peak: 0 }, runningTweens: [], clock: 0 };
  const list = [];
  scene.field = {
    list, add(object) { if (!list.includes(object)) list.push(object); return this; },
    exists: object => list.includes(object),
    bringToTop(object) { const i = list.indexOf(object); if (i >= 0) { list.splice(i, 1); list.push(object); } return this; },
    moveBelow(object, anchor) { list.splice(list.indexOf(object), 1); list.splice(list.indexOf(anchor), 0, object); return this; },
    moveAbove(object, anchor) { list.splice(list.indexOf(object), 1); list.splice(list.indexOf(anchor) + 1, 0, object); return this; },
  };
  function sprite(x, y, key, frame = 0, kind = 'sprite') {
    const effect = key.startsWith('anim:');
    if (kind === 'sprite') scene.metrics[effect ? 'effects' : 'actors']++;
    const s = { scene, kind, x, y, z: 0, w: 0, scaleX: 1, scaleY: 1, _rotation: 0,
      _visible: true, _alpha: 1, _alphaTL: 1, _alphaTR: 1, _alphaBL: 1, _alphaBR: 1,
      _scaleX: 1, _scaleY: 1, active: true, renderFlags: 15, originX: .5, originY: .5, width: effect ? 96 : 64, height: effect ? 96 : 80,
      blendMode: 0, pipeline: 'default', pipelineData: {}, data: new Map(),
      setTexture(key, frame = 0) {
        this.texture = { key, has: n => !options.missingFrames?.includes(n) };
        return this.setFrame(frame);
      },
      setFrame(name) { this.frame = { name: this.texture.has(name) ? name : 0 }; return this; },
      setOrigin(x, y = x) { this.originX = x; this.originY = y; return this; },
      setPosition: Transform.setPosition, setAngle: Transform.setAngle,
      setScale: Transform.setScale, setAlpha: Alpha.setAlpha, setVisible: Visible.setVisible,
      setBlendMode(value) { this.blendMode = value; return this; },
      setActive(value) { this.active = value; return this; },
      setData(key, value) { this.data.set(key, value); return this; },
      getData(key) { return this.data.get(key); },
      resetPipeline() { this.pipeline = 'default'; this.pipelineData = {}; return this; },
      setPipeline(key, data) { this.pipeline = key; this.pipelineData = data; return this; },
      destroy() {
        if (!this.scene) throw new Error('double destroy');
        this.scene = null; scene.objects.delete(this); scene.metrics.destroyed++;
        const i = list.indexOf(this); if (i >= 0) list.splice(i, 1);
      },
      get displayHeight() { return this.height * Math.abs(this.scaleY); },
    };
    for (const [key, value] of Object.entries({ scaleX: Transform.scaleX, scaleY: Transform.scaleY, angle: Transform.angle, rotation: Transform.rotation, alpha: Alpha.alpha, visible: Visible.visible })) Object.defineProperty(s, key, value);
    s.setTexture(key, frame);
    scene.objects.add(s);
    scene.metrics.peak = Math.max(scene.metrics.peak, scene.objects.size);
    return s;
  }
  scene.add = {
    sprite: (x, y, key, frame) => sprite(x, y, key, frame),
    tileSprite: (x, y, w, h, key) => Object.assign(sprite(x, y, key, 0, 'bg'), { width: w, height: h }),
    rectangle: (x, y, w, h, color) => Object.assign(sprite(x, y, `rect:${color}`, 0, 'bg'), { width: w, height: h }),
  };
  for (const [side, x, y] of [['enemy', 234, 52], ['enemy2', 266, 60], ['player', 106, 116], ['player2', 138, 124]]) {
    if (!options.double && side.endsWith('2')) continue;
    const original = sprite(0, 0, side, 0);
    const container = { name: side, x, y, visible: !(options.hidden ?? []).includes(side), original };
    const mon = { mon: { name: side }, container, getSprite: () => original, getSpriteScale: () => side.startsWith('player') ? 1.25 : .75 };
    scene.pokemon[side] = mon; list.push(container);
  }
  scene.effects = { dollTarget: side => scene.pokemon[side] };
  if (options.substitute) {
    const target = scene.pokemon.enemy;
    const original = sprite(0, 0, 'doll', 0);
    const container = { name: 'doll', x: target.container.x + 5, y: target.container.y + 3, visible: true, original };
    const doll = { mon: { name: 'doll' }, container, getSprite: () => original, getSpriteScale: () => .8 };
    list.push(container); scene.effects.dollTarget = () => doll;
  }
  scene.requireMon = side => scene.pokemon[side];
  scene.audio = { cryPath: mon => `cry:${mon.name}`, play: async (...args) => { scene.sounds.push(args); } };
  scene.tweens = {
    add(config) {
      const entry = { config, start: scene.clock, from: Object.fromEntries(['x','y','alpha'].filter(k => k in config).map(k => [k, config.targets[k]])), removed: false };
      scene.runningTweens.push(entry);
      return { remove() { entry.removed = true; } };
    },
    killTweensOf(target) { for (const t of scene.runningTweens) if (t.config.targets === target) t.removed = true; },
  };
  const state = object => object.name ? { actor: object.name, x: object.x, y: object.y, visible: object.visible,
    originalVisible: object.original.visible } : { kind: object.kind, key: object.texture.key, frame: object.frame.name,
    x: object.x, y: object.y, scaleX: object.scaleX, scaleY: object.scaleY, angle: object.angle, alpha: object.alpha,
    originX: object.originX, originY: object.originY, width: object.width, height: object.height,
    visible: object.visible, blend: object.blendMode, locked: object.getData('locked'), renderFlags: object.renderFlags,
    pipeline: object.pipeline, matrix: object.pipelineData.colorMatrix ? [...object.pipelineData.colorMatrix] : null };
  scene.snapshot = () => list.filter(o => o.active !== false).map(state);
  const delay = async (_, ms) => {
    scene.frames.push(scene.snapshot()); scene.waits.push(ms);
    if (options.abortAt === scene.frames.length) throw new Error('test abort');
    scene.clock += ms;
    for (const t of scene.runningTweens) if (!t.removed && t.config.targets.scene) {
      const p = t.config.duration ? Math.min(1, (scene.clock - t.start) / t.config.duration) : 1;
      for (const [key, start] of Object.entries(t.from)) t.config.targets[key] = start + (t.config[key] - start) * p;
    }
  };
  const code = source.replace(/^import .*;\r?\n/gm, '').replace(/export (function|class) /g, '$1 ');
  const Class = new Function('Phaser','animation','moveFile','framePosition','delay','LoadError','isPlayerSide','firstOnSide','setColorMatrix', code + '\nreturn AnimationPlayer;')(
    { BlendModes: { NORMAL: 0, ADD: 1, DIFFERENCE: 23 } }, async () => null, id => id,
    framePosition, delay, class extends Error {}, isPlayerSide, firstOnSide,
    (sprite, matrix) => matrix ? sprite.setPipeline('matrix', { colorMatrix: Float32Array.from(matrix, (v,i) => i % 5 === 4 ? v / 255 : v) }) : sprite.resetPipeline(true));
  const player = new Class(scene);
  player.resources = async () => {};
  scene.metrics = { effects: 0, actors: 0, destroyed: 0, peak: scene.objects.size };
  async function run(anim, args = {}) {
    const initial = new Set(scene.objects);
    scene.frames.length = scene.waits.length = scene.sounds.length = 0;
    player.prepared.set('test.json', anim);
    let error;
    try { await player.playFile('test.json', args.side ?? 'player', args.self ? args.side ?? 'player' : args.target ?? 'enemy', args); }
    catch (e) { error = e.message; }
    return { frames: scene.frames, waits: scene.waits, sounds: scene.sounds, diagnostics: [...player.diagnostics],
      final: scene.snapshot(), running: player.running, error, metrics: { ...scene.metrics },
      leaks: [...scene.objects].filter(object => !initial.has(object)).length };
  }
  return { scene, player, run };
}
