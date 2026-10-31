// from pokerogue src/phases/exp-phase.ts @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/phases/show-party-exp-bar-phase.ts @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/phases/level-up-phase.ts @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-10-30. See view/LICENSE-NOTE.md.

import { EXP_IMAGES, EXP_SOUNDS, PartyExpBar, setLevelDisplay } from './ui/exp-bar.js';
import { MAX_LEVEL } from '../engine/mon.mjs';
import { LevelUpStats } from './ui/level-up.js';
import { ConfirmMenu, LearnMoveSummary, LEARN_MOVE_IMAGES } from './ui/learn-move.js';
import { EvolutionScene } from './evolution.js';
import { isPlayerSide } from './positions.js';

const FANFARE = 'se/level_up_fanfare.wav';

export class BattleLevel {
  constructor(scene) {
    this.scene = scene;
    this.stats = new LevelUpStats(scene);
    this.confirmMenu = new ConfirmMenu(scene);
    this.summary = new LearnMoveSummary(scene);
    this.evolution = new EvolutionScene(scene);
  }
  preload() {
    const { assets, audio } = this.scene;
    return Promise.all([
      ...Object.entries({ ...EXP_IMAGES, ...LEARN_MOVE_IMAGES }).map(([key, path]) => assets.image(key, path)),
      ...[...EXP_SOUNDS, FANFARE].map(path => audio.load(path).ready),
    ]);
  }
  playerInfo(side) {
    if (!isPlayerSide(side)) throw new Error(`Experience is shown on the player side only: ${side}`);
    this.scene.requireMon(side);
    return this.scene.info[side];
  }

  async gainExp(side, { level, ratio }) {
    const info = this.playerInfo(side);
    if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL || !(ratio >= 0 && ratio <= 1)) throw new Error('Invalid exp values');
    await info.exp.gain(level, ratio);
    info.mon.level = level;
    this.scene.pokemon[side].mon.level = level;
  }

  async partyExp(mon, exp) {
    this.scene.requireReady();
    const icon = await this.scene.assets.icon(mon);
    this.scene.life.check();
    this.partyBar ??= new PartyExpBar(this.scene);
    await this.partyBar.show(icon, exp);
  }

  playFanfare() {
    this.scene.requireReady();
    this.scene.audio.play(FANFARE).catch(() => {});
  }

  async updateLevel(side, { level, hp, maxhp }) {
    const info = this.playerInfo(side), p = this.scene.pokemon[side];
    setLevelDisplay(info, level, level >= MAX_LEVEL);
    if (info.exp) info.exp.levelShown = Math.max(info.exp.levelShown, level);
    info.mon.level = p.mon.level = level;
    await this.scene.hpChange(side, hp, maxhp);
  }

  showLevelUpStats({ prev, next }) { this.scene.requireReady(); return this.stats.show({ prev, next }); }

  confirm() { this.scene.requireReady(); return this.confirmMenu.choose(); }

  chooseForgetMove(options) { this.scene.requireReady(); return this.summary.choose(options); }
  startEvolution(from) { this.scene.requireReady(); return this.evolution.start(from); }
  evolve(to, options) { this.scene.requireReady(); return this.evolution.evolve(to, options); }
  endEvolution() { return this.evolution.end(); }
  destroy() {
    this.stats.destroy(); this.confirmMenu.destroy(); this.summary.destroy(); this.evolution.destroy(); this.partyBar?.destroy();
  }
}
