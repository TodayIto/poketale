// from pokerogue src/battle-scene.ts @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/field/arena.ts @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/field/arena-base.ts @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/phases/summon-phase.ts @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/phases/switch-summon-phase.ts @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/phases/faint-phase.ts @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/phases/damage-anim-phase.ts @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-10-28. See view/LICENSE-NOTE.md.
import Phaser from 'phaser';
import { Assets, prefetchImages } from './assets.js';
import { BattleAudio } from './audio.js';
import { PokemonSprite } from './sprites/pokemon.js';
import { BattleInfo } from './ui/battle-info.js';
import { BattleMessage } from './ui/message.js';
import { loadFont } from './ui/text.js';
import { installTapBack } from './ui/tap-back.js';
import { tween, delay } from './lifetime.js';
import { AnimationPlayer } from './anims/player.js';
import { statStage } from './anims/stat-stage.js';
import { ActionMenu } from './ui/action-menu.js';
import { PartyMenu } from './ui/party.js';
import { BattleEffects } from './effects.js';
import { TeraView } from './tera.js';
import { BattleLevel } from './level.js';
import { createArena, biomeKey, DEFAULT_BIOME } from './arena.js';
import { BattleEncounter } from './encounter.js';
import { openParticles, ballTint, loadBallThrow } from './ball-throw.js';
import { ballFrame, loadItemIcons } from './ui/bag.js';
import { moveFile, chargeFile, hasAnimation } from './anims/data.js';
import { loadStatStage } from './anims/stat-stage.js';
import { LoadError } from './retry.js';
import { installGameSpeed } from './game-speed.js';
import { fitCamera } from './quality.js';
import BAG_ICONS from '../data/bag-icons.json' with { type: 'json' };

const COMMON_ANIMS = ['burn', 'confusion', 'frozen', 'health-up', 'paralysis', 'poison', 'sleep', 'use-item'];

const later = error => { if (!(error instanceof LoadError)) throw error; };

export class BattleScene extends Phaser.Scene {

  constructor(options, life, ready, fail = error => { throw error; }) {
    super('BattleView'); this.options = options; this.life = life; this.ready = ready; this.fail = fail;
    this.pokemon = {}; this.info = {}; this.biomeObjects = [];
    this.summonCount = { player: 0, enemy: 0 };
    this.prefetched = prefetchImages(options);
  }
  create() {
    if (this.life.signal.aborted) return;
    try { this.build(); } catch (error) { return this.fail(error); }
    this.ready(this);
  }
  build() {

    Phaser.Display.Canvas.CanvasPool.enableSmoothing();

    this.gameSpeed = installGameSpeed(this, this.options.speed);

    fitCamera(this.cameras.main, this.options.quality);
    this.field = this.add.container(0, 0).setScale(6);
    this.fieldUI = this.add.container(0, 1080).setScale(6).setDepth(1);
    this.ui = this.add.container(0, 1080).setScale(6).setDepth(2);
    this.assets = new Assets(this, this.life, this.options);
    this.audio = new BattleAudio(this.assets, this.options.parent, this.options);
    this.animations = new AnimationPlayer(this, { enabled: this.options.moveAnims !== false });
    this.party = new PartyMenu(this);
    this.actions = new ActionMenu(this);
    this.effects = new BattleEffects(this);
    this.tera = new TeraView(this);
    this.levels = new BattleLevel(this);
    this.encounter = new BattleEncounter(this);
    this.stopTapBack = installTapBack(this);
  }
  async prepare({ mons, moves = [], biome, biomeProps, enemyTrainer, enemyBlack, playerTrainer, playerBlack }) {

    const arena = biomeKey(biome) ?? DEFAULT_BIOME;
    if (biome != null && !biomeKey(biome)) this.assets.diagnostics.push({ unknownBiome: String(biome) });
    await Promise.all([this.assets.preload(mons, arena), loadFont(this.assets.base), this.audio.preload(mons), this.effects.preload(), this.tera.preload(), this.levels.preload(),
      this.encounter.preload({ enemyTrainer, enemyBlack, playerTrainer, playerBlack }),
      this.assets.image('pb_particles', 'images/effects/pb_particles.png', BAG_ICONS.pb_particles)]);
    this.life.check();
    this.prefetched = null;
    this.audio.preloadMusic();
    this.mons = mons; this.moves = moves;
    this.biomeObjects.forEach(object => object.destroy());
    this.biomeObjects = createArena(this, arena, biomeProps);
    if (!this.messages) this.messages = new BattleMessage(this, this.options.parent, this.life);
  }

  async warmUp() {
    this.requireReady();

    // With move animations off, anim files are not decoded (they never play - view/anims/player.js playFile)
    const files = !this.animations.enabled ? []
      : [...this.moves.flatMap(id => [moveFile(id), chargeFile(id)]), ...COMMON_ANIMS.map(name => `common-${name}.json`)].filter(hasAnimation);
    await Promise.all([this.animations.prepare(files),
      ...[loadBallThrow(this), loadStatStage(this), loadItemIcons(this)].map(work => work.catch(later))]);
    this.life.check();
  }

  warmUpAfter() {
    Promise.all([this.levels.evolution.load(),
      ...this.mons.filter(mon => mon.side !== 'enemy').map(mon => this.assets.mon(mon, false))]).catch(() => {});
  }
  async summon(side, mon, { fromBall = true, ball } = {}) {
    this.requireReady();
    const asset = await this.assets.mon(mon, side === 'player');
    this.life.check();
    this.pokemon[side]?.destroy(); this.info[side]?.destroy();
    const pokemon = this.pokemon[side] = new PokemonSprite(this, side, mon, asset);
    this.summonCount[side]++;
    const info = this.info[side] = new BattleInfo(this, side === 'player');
    info.init(mon);
    this.audio.startBattleMusic();
    const player = side === 'player';
    if (fromBall && player) await this.encounter?.throwFromPlayer();

    const key = ballFrame(ball);
    if (fromBall) {
      const ball = this.add.sprite(player ? 36 : 248, player ? 80 : 44, 'pb', key).setOrigin(0.5, 0.625);
      this.field.add(ball);
      await Promise.all([
        tween(this, { targets: ball, duration: 650, x: pokemon.placement.x }),
        (async () => {
          await tween(this, { targets: ball, duration: 150, ease: 'Cubic.easeOut', y: player ? 70 : 34 });
          await tween(this, { targets: ball, duration: 500, ease: 'Cubic.easeIn', angle: 1440, y: pokemon.placement.y });
        })(),
      ]);
      ball.destroy();

      openParticles(this, pokemon.placement.x, pokemon.placement.y - 16, key);
    }
    pokemon.container.setVisible(true).setScale(pokemon.getSpriteScale() * (fromBall ? 0.5 : 0.75));
    pokemon.playAnim(); pokemon.tint(ballTint(key));

    await Promise.all([info.show(), (async () => {
      await Promise.all([
        tween(this, { targets: pokemon.container, duration: 250, ease: 'Sine.easeIn', scale: pokemon.getSpriteScale() }),
        pokemon.untint(250, 'Sine.easeIn'),
        fromBall ? this.audio.play('se/pb_rel.wav') : Promise.resolve(),
      ]);

      await Promise.all([this.audio.cry(mon, mon.maxhp > 0 && mon.hp / mon.maxhp <= 0.25), delay(this, 1000)]);
    })()]);
  }

  async restore({ player, enemy, stages = {}, substitute = {}, hidden = {}, trainer = false } = {}) {
    this.requireReady();
    const sides = Object.entries({ player, enemy }).filter(([, mon]) => mon);
    const [assets] = await Promise.all([Promise.all(sides.map(([side, mon]) => this.assets.mon(mon, side === 'player'))),
      trainer ? this.encounter.restoreTrainer() : null]);
    this.life.check();
    sides.forEach(([side, mon], i) => {
      this.pokemon[side]?.destroy(); this.info[side]?.destroy();
      const pokemon = this.pokemon[side] = new PokemonSprite(this, side, mon, assets[i]);
      this.summonCount[side]++;
      pokemon.container.setVisible(true).setScale(pokemon.getSpriteScale());
      pokemon.playAnim();
      const info = this.info[side] = new BattleInfo(this, side === 'player');
      info.init(mon); info.container.setVisible(true);
      if (stages[side]) this.effects.setStatStages(side, stages[side]);
      if (substitute[side]) this.effects.placeSubstitute(side);
      if (hidden[side]) this.effects.setHidden(side, true);
    });
    this.audio.startBattleMusic();
  }
  async recall(side) {
    const p = this.requireMon(side);
    await Promise.all([
      this.info[side].hide(), this.audio.play('se/pb_rel.wav'), p.tintIn(0xd52929, 250),
      tween(this, { targets: p.container, duration: 250, ease: 'Sine.easeIn', scale: p.getSpriteScale() * 0.5 }),
    ]);
    p.container.setVisible(false);
    await delay(this, 750);
  }
  async hpChange(side, hp, maxhp, { cause = 'other', effectiveness = 'normal' } = {}) {
    const p = this.requireMon(side);
    if (!Number.isFinite(hp) || !Number.isFinite(maxhp) || maxhp <= 0 || hp < 0 || hp > maxhp) throw new Error('Invalid HP values');
    if (cause === 'move' && hp < p.mon.hp) {
      const sound = this.audio.play(`se/${effectiveness === 'super' ? 'hit_strong' : effectiveness === 'resisted' ? 'hit_weak' : 'hit'}.wav`);

      for (let i = 0; i < 6; i++) { p.sprite.setVisible(i % 2 === 1); await delay(this, 100); }
      p.sprite.setVisible(true);
      await Promise.all([sound, this.info[side].hpChange(hp, maxhp)]);
    } else await this.info[side].hpChange(hp, maxhp);
    p.mon.hp = hp; p.mon.maxhp = maxhp;
  }
  async setStatus(side, status) {
    if (!['', 'brn', 'par', 'slp', 'frz', 'psn', 'tox'].includes(status)) throw new Error(`Invalid status: ${status}`);
    this.requireMon(side).mon.status = status;
    this.info[side].setStatus(status);
  }
  async faint(side) {
    const p = this.requireMon(side);

    const anims = [p.sprite?.anims, p.tintSprite?.anims].filter(Boolean);
    anims.forEach(a => { a.timeScale = 0.85; });
    try { await this.audio.faintCry(p.mon); }
    finally { anims.forEach(a => { a.timeScale = 1; }); }

    const y0 = p.container.y, box = p.placement?.box;
    const foot = box?.bottom ?? y0, sink = box ? Math.ceil(box.bottom - box.top) + 1 : 150;
    const mask = footMask(this, foot);
    if (mask) p.container.setMask(mask.mask);
    try {
      await Promise.all([
        this.info[side].hide(), this.audio.play('se/faint.wav'),
        tween(this, { targets: p.container, duration: 500, y: y0 + sink, ease: 'Sine.easeIn' }),
      ]);
    } finally {
      if (mask) { p.container.clearMask?.(); mask.destroy(); }
    }
    p.container.setVisible(false); p.container.y = y0;
  }
  async message(text, options) { this.requireReady(); await this.messages.message(text, options); }
  playMove(id, side, targetSide, options) { this.requireReady(); return this.animations.playMove(id, side, targetSide, options); }
  playCommon(name, side, targetSide = side) { this.requireReady(); return this.animations.playCommon(name, side, targetSide); }
  statStage(side, stat, delta) { this.requireReady(); return statStage(this, side, stat, delta); }
  chooseAction(options) { this.requireReady(); return this.actions.choose(options); }
  chooseSwitch(options) { this.requireReady(); return this.party.choose(options); }
  async end({ outcome, caught = false, text: said }) {

    const label = said ?? { win: '배틀에서 이겼다!', lose: '배틀에서 졌다…', tie: '무승부!' }[outcome];
    if (said !== undefined && !['win', 'lose', 'tie', 'run'].includes(outcome)) throw new Error(`Invalid outcome: ${outcome}`);
    if (!label && outcome !== 'run') throw new Error(`Invalid outcome: ${outcome}`);
    this.warmUpAfter();
    this.audio.finishBattle({ outcome, caught });

    if (!caught && label) await this.message(label, { hold: 0 });

    this.ending = { text: String(this.messages.text.text ?? '') };
    this.messages.showPrompt();
  }

  waitEnd() {
    if (!this.ending) throw new Error('Call end before waitEnd');
    return this.messages.waitForInput();
  }

  showEnd() {
    if (!this.ending) throw new Error('Call end before showEnd');
    this.messages.bg.setVisible(true); this.messages.container.setVisible(true);
    this.messages.text.setText(this.ending.text);
    this.messages.showPrompt();
  }
  requireReady() { if (!this.messages) throw new Error('Call preload before rendering'); }
  requireMon(side) {
    if (!['player', 'enemy'].includes(side)) throw new Error(`Invalid side: ${side}`);
    const p = this.pokemon[side];
    if (!p) throw new Error(`No Pokemon on ${side}`);
    return p;
  }

  suspend() { this.audio?.suspend(); this.levels?.evolution.suspend(); this.effects?.releaseStats(); }
  resume() { this.audio?.resume(); this.levels?.evolution.resume(); }
  cleanup() { this.stopTapBack?.(); this.levels?.destroy(); this.effects?.destroy(); this.party?.destroy(); this.actions?.destroy(); this.messages?.destroy(); this.audio?.destroy(); }
}

export function footMask(scene, y) {
  const shape = scene.make?.graphics?.({ x: 0, y: 0, add: false });
  if (!shape) return null;
  shape.fillStyle(0xffffff).fillRect(-1920, -1080, 1920 * 3, 1080 + y * 6);
  const mask = shape.createGeometryMask();
  return { mask, shape, destroy() { mask.destroy(); shape.destroy(); } };
}
