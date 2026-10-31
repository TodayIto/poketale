// from pokerogue src/phases/encounter-phase.ts (doEncounter, doEncounterCommon) @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/phases/battle-phase.ts (hideEnemyTrainer) @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/phases/summon-phase.ts (preSummon's player ball throw) @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/field/trainer.ts (sprites, tint/untint, playAnim) @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/data/trainers/trainer-config.ts (loadAssets anims) @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-10-30. See view/LICENSE-NOTE.md.

import { tween, delay } from './lifetime.js';
import { fieldAtlases, atlasJson, animFrames } from './field-atlases.js';
import { PokemonSprite } from './sprites/pokemon.js';
import { BattleInfo } from './ui/battle-info.js';
import { checkPosition, teamOf, infoLayout } from './positions.js';
import { SHOWDOWN_TRAINER } from '../story/named.mjs';

export const DEFAULT_TRAINER = 'ace_trainer_m';

export const PLAYER_TRAINERS = ['trainer_m_back', 'trainer_f_back'];

const ENTER_DISTANCE = 300, TRAINER_STEP = 16;

const BLACK_SHADOW = Object.freeze({ enemy: Object.freeze({ x: -1, y: 1 }), player: Object.freeze({ x: 1, y: 1 }), alpha: 0x55 / 0xff });

export { SHOWDOWN_TRAINER };
export const SHOWDOWN_TRAINER_URL = id => `https://play.pokemonshowdown.com/sprites/trainers/${id}.png`;

export const showdownTrainerId = name => (typeof name === 'string' && name.startsWith(SHOWDOWN_TRAINER) && /^[a-z0-9-]+$/.test(name.slice(SHOWDOWN_TRAINER.length))
  ? name.slice(SHOWDOWN_TRAINER.length) : null);

export const trainerKey = name => typeof name === 'string' ? name.trim().toLowerCase().replace(/\.(png|json)$/, '').replace(/[\s-]+/g, '_') : '';

// Whether a sprite can be used as an enemy: any images/trainer sprite (except the player back sprites)
export const isEnemyTrainer = (trainers, key) => !!trainers[key] && !/_back(_pb)?$/.test(key);

export class BattleEncounter {
  constructor(scene) {
    this.scene = scene; this.diagnostics = [];
    this.enemyKey = DEFAULT_TRAINER; this.playerKey = PLAYER_TRAINERS[0]; this.enemyBlack = false; this.playerBlack = false;
    this.enemyTrainer = null; this.playerTrainer = null;
  }

  async preload({ enemyTrainer, enemyBlack = false, playerTrainer, playerBlack = false } = {}) {
    this.enemyBlack = enemyBlack; this.playerBlack = playerBlack;
    const { trainers } = await fieldAtlases();
    const pick = (name, ok, fallback, what) => {
      if (name == null) return fallback;
      const key = trainerKey(name);
      if (ok(key)) return key;
      this.diagnostics.push(`unknown ${what}: ${name}`);
      return fallback;
    };

    this.enemyKey = showdownTrainerId(enemyTrainer) ? enemyTrainer
      : pick(enemyTrainer, key => isEnemyTrainer(trainers, key), DEFAULT_TRAINER, 'trainer');
    this.playerKey = pick(playerTrainer, key => PLAYER_TRAINERS.includes(key) || ['m', 'f'].includes(key), PLAYER_TRAINERS[0], 'player trainer');
    if (['m', 'f'].includes(this.playerKey)) this.playerKey = `trainer_${this.playerKey}_back`;
    const enemy = enemyTrainer != null || this.scene.options.wild === false;
    await Promise.all([this.load(this.playerKey), this.load(`${this.playerKey}_pb`), enemy ? this.loadEnemy() : null]);
  }

  async loadEnemy() {
    const id = showdownTrainerId(this.enemyKey);
    if (!id) return this.load(this.enemyKey);
    try {
      await this.loadShowdown(this.enemyKey, id);
    } catch (error) {
      this.scene.assets.life.check();
      this.diagnostics.push(`showdown trainer unavailable: ${id} (${error?.message ?? error})`);
      this.enemyKey = DEFAULT_TRAINER;
      await this.load(this.enemyKey);
    }
  }

  async loadShowdown(key, id) {
    const s = this.scene;
    if (s.textures.exists(key)) return;
    const bytes = await s.assets.fetchBytes(SHOWDOWN_TRAINER_URL(id));
    s.assets.life.check();
    const head = new Uint8Array(bytes, 0, Math.min(8, bytes.byteLength));
    if (![137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => head[i] === v)) throw new Error('not a PNG (404?)');
    const objectUrl = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
    try {
      const img = await s.assets.loadImage(objectUrl);
      s.assets.life.check();
      const canvas = document.createElement('canvas');
      canvas.width = 80; canvas.height = 80;
      canvas.getContext('2d').drawImage(img, Math.round((80 - img.width) / 2), 80 - img.height);
      if (!s.textures.exists(key)) s.textures.addCanvas(key, canvas);
    } finally { URL.revokeObjectURL(objectUrl); }
  }

  async load(key) {
    const { trainers } = await fieldAtlases();
    const json = atlasJson(trainers[key]);
    await this.scene.assets.image(key, `images/trainer/${key}.png`, json);
    const frames = animFrames(json);
    if (frames.length && !this.scene.anims.exists(key)) {
      this.scene.anims.create({ key, frames: frames.map(frame => ({ key, frame })), frameRate: 24, repeat: -1 });
    }
  }

  picture(who) {
    const s = this.scene, key = who === 'player' ? this.playerKey : this.enemyKey;
    if (!s.textures.exists(key)) return null;
    const texture = s.textures.get(key);
    const frame = texture.get(s.anims.get(key)?.frames[0]?.textureFrame ?? texture.getFrameNames()[0]);
    const canvas = document.createElement('canvas');
    canvas.width = frame.realWidth; canvas.height = frame.realHeight;
    canvas.getContext('2d').drawImage(frame.source.image, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight,
      frame.x, frame.y, frame.cutWidth, frame.cutHeight);
    return canvas;
  }

  makeFigure(key, x, y, shadow = null) {
    const s = this.scene;
    const container = s.add.container(x, y);
    const sprite = s.add.sprite(0, 0, key).setOrigin(0.5, 1);
    const back = shadow ? s.add.sprite(shadow.x, shadow.y, key).setOrigin(0.5, 1).setTintFill(0).setAlpha(BLACK_SHADOW.alpha) : null;
    if (back) sprite.preFX.addColorMatrix().brightness(0);
    const figures = back ? [back, sprite] : [sprite];
    container.add(figures);
    return { container, sprite, figures };
  }

  makeEnemyTrainer() {
    const s = this.scene, key = this.enemyKey;
    const trainer = this.makeFigure(key, -72, 80, this.enemyBlack ? BLACK_SHADOW.enemy : null);
    const tintSprite = s.add.sprite(0, 0, key).setOrigin(0.5, 1).setVisible(false);
    trainer.container.add(tintSprite); trainer.figures.push(tintSprite);
    return { ...trainer, tintSprite };
  }

  async encounter({ kind = 'trainer', enemy, others = [] } = {}) {
    const s = this.scene;
    s.requireReady();
    if (!['trainer', 'wild'].includes(kind)) throw new Error(`Invalid encounter kind: ${kind}`);
    if (kind === 'wild' && !enemy) throw new Error('Wild encounter needs the enemy MonView');
    const wild = kind === 'wild' ? [{ position: 'enemy', mon: enemy }, ...others] : [];
    for (const { position } of wild) if (teamOf(checkPosition(s.double, position)) !== 'enemy') throw new Error(`Wild mon on the player side: ${position}`);
    await Promise.all([kind === 'trainer' ? this.loadEnemy() : null, this.load(this.playerKey), this.load(`${this.playerKey}_pb`)]);
    const assets = await Promise.all(wild.map(({ mon }) => s.assets.mon(mon, false)));
    s.life.check();
    const [, arenaPlayer, arenaEnemy] = s.biomeObjects;

    this.playerTrainer?.container.destroy(); this.enemyTrainer?.container.destroy();
    const player = this.playerTrainer = this.makeFigure(this.playerKey, 406, 186, this.playerBlack ? BLACK_SHADOW.player : null);
    arenaPlayer.x = 300; arenaEnemy.x = -280;
    s.field.addAt(player.container, s.field.getIndex(arenaEnemy) + 1);
    const enemyTargets = [arenaEnemy];
    if (kind === 'trainer') {
      const trainer = this.enemyTrainer = this.makeEnemyTrainer();
      s.field.addAt(trainer.container, s.field.getIndex(player.container) + 1);
      trainer.tintSprite.setTintFill(0).setVisible(true).setAlpha(0.5);
      enemyTargets.push(trainer.container);
    } else {

      wild.forEach(({ position, mon }, i) => {
        s.pokemon[position]?.destroy(); s.info[position]?.destroy();
        const pokemon = s.pokemon[position] = new PokemonSprite(s, position, mon, assets[i]);
        (s.info[position] = new BattleInfo(s, false, infoLayout(s.double, position))).init(mon);
        pokemon.container.setVisible(true); pokemon.container.x -= ENTER_DISTANCE;
        pokemon.playAnim(); pokemon.tint(0, 0.5);
        enemyTargets.push(pokemon.container);
      });
    }
    s.audio.startBattleMusic();
    await Promise.all([
      tween(s, { targets: enemyTargets, x: `+=${ENTER_DISTANCE}`, duration: 2000 }),
      tween(s, { targets: [arenaPlayer, player.container], x: `-=${ENTER_DISTANCE}`, duration: 2000 }),
    ]);
    if (kind === 'trainer') {
      const { tintSprite, figures } = this.enemyTrainer;

      for (const target of figures) if (this.scene.anims.exists(this.enemyKey)) target.play({ key: this.enemyKey, repeat: 0, startFrame: 0 });
      await tween(s, { targets: tintSprite, alpha: 0, duration: 100, ease: 'Sine.easeOut' });
      tintSprite.setVisible(false).setAlpha(1);
    } else {

      for (const { position, mon } of wild) { s.audio.cry(mon).catch(() => {}); s.info[position].show().catch(() => {}); }
      await Promise.all(wild.map(({ position }) => s.pokemon[position].untint(100, 'Sine.easeOut')));
    }
  }

  async hideTrainer() {
    const trainer = this.enemyTrainer;
    if (!trainer?.container.visible) return;
    await tween(this.scene, { targets: trainer.container, x: `+=${TRAINER_STEP}`, y: `-=${TRAINER_STEP}`, alpha: 0, ease: 'Sine.easeInOut', duration: 750 });
    trainer.container.setVisible(false);
  }

  async restoreTrainer() {
    const s = this.scene;
    await this.loadEnemy();
    s.life.check();
    this.enemyTrainer?.container.destroy();
    const trainer = this.enemyTrainer = this.makeEnemyTrainer();
    const last = s.anims.get(this.enemyKey)?.frames.at(-1)?.textureFrame;
    if (last !== undefined) for (const target of trainer.figures) target.setFrame(last);
    trainer.tintSprite.setVisible(false);
    const { container } = trainer;
    container.setPosition(container.x + ENTER_DISTANCE + TRAINER_STEP, container.y - TRAINER_STEP).setAlpha(0).setVisible(false);
    s.field.addAt(container, s.field.getIndex(s.biomeObjects[2]) + 1);
  }

  async throwFromPlayer() {
    const s = this.scene, trainer = this.playerTrainer?.container, figures = this.playerTrainer?.figures;
    if (!trainer?.visible) return;
    const key = `${this.playerKey}_pb`;
    const frame = name => { if (trainer.active) for (const figure of figures) figure.setFrame(name); };
    for (const figure of figures) figure.setTexture(key);
    s.time.delayedCall(562, () => { frame('2'); s.time.delayedCall(64, () => frame('3')); });
    s.tweens.add({ targets: trainer, x: -36, duration: 1000, onComplete: () => trainer.setVisible(false) });
    await delay(s, 750);
  }
}
