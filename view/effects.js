// from pokerogue src/phases/quiet-form-change-phase.ts @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/phases/pokemon-transform-phase.ts @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/phases/pokemon-anim-phase.ts @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/field/pokemon.ts @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/ui-inputs.ts @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-10-28. See view/LICENSE-NOTE.md.

import { AbilityBar } from './ui/ability-bar.js';
import { BattleStats } from './ui/battle-stats.js';
import { PokemonSprite } from './sprites/pokemon.js';
import { SPRITE_SLOTS, INFO_RECTS } from './sprites/placement.js';
import { hasAnimation, chargeFile } from './anims/data.js';
import { tween, delay } from './lifetime.js';

export const EFFECT_IMAGES = {
  ability_bar_left: 'images/ui/ability_bar_left.png', ability_bar_right: 'images/ui/ability_bar_right.png',
  pbinfo_player_stats: 'images/ui/pbinfo_player_stats.png', pbinfo_enemy_mini_stats: 'images/ui/pbinfo_enemy_mini_stats.png',
  pbinfo_stat_numbers: 'images/ui/pbinfo_stat_numbers.png', pbinfo_stat: 'images/ui/text_images/ko/battle_ui/pbinfo_stat_ko.png',

  sub: 'images/pokemon/sub.png', sub_back: 'images/pokemon/back/sub.png',
};
export const EFFECT_SOUNDS = ['battle_anims/PRSFX- Transform.wav', 'battle_anims/PRSFX- Substitute2.wav'];

const SUB_OFFSET = { player: [-30, 10], enemy: [30, -10] };
const STAT_KEYS = new Set(['c', 'C', 'Shift']);

export class BattleEffects {
  constructor(scene) {
    this.scene = scene; this.subs = {}; this.stages = { player: {}, enemy: {} }; this.statsHeld = new Set();

    const keyId = e => `key:${e.code || e.key}`;
    this.keyDown = e => { if (STAT_KEYS.has(e.key) && !e.repeat) this.holdStats(keyId(e), true); };
    this.keyUp = e => { if (STAT_KEYS.has(e.key)) this.holdStats(keyId(e), false); };
    this.pointerDown = pointer => {
      const x = pointer.worldX / 6, y = pointer.worldY / 6;
      if (Object.entries(INFO_RECTS).some(([side, r]) => this.scene.info[side]?.container.visible && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom)) {
        this.holdStats(`pointer:${pointer.id}`, true);
      }
    };
    this.pointerUp = pointer => this.holdStats(`pointer:${pointer.id}`, false);

    this.blur = () => this.releaseStats();
    const parent = scene.options.parent;
    parent.addEventListener('keydown', this.keyDown); parent.addEventListener('keyup', this.keyUp);
    parent.ownerDocument.defaultView.addEventListener('blur', this.blur);
    scene.input.on('pointerdown', this.pointerDown); scene.input.on('pointerup', this.pointerUp); scene.input.on('pointerupoutside', this.pointerUp);
  }
  preload() {
    const { assets, audio } = this.scene;
    return Promise.all([
      ...Object.entries(EFFECT_IMAGES).map(([key, path]) => assets.image(key, path)),
      ...EFFECT_SOUNDS.map(path => audio.load(path).ready),
    ]);
  }
  get abilityBar() { return this._abilityBar ??= new AbilityBar(this.scene); }

  showAbility(side, pokemonName, abilityName) {
    this.scene.requireReady();
    if (!['player', 'enemy'].includes(side)) throw new Error(`Invalid side: ${side}`);
    return this.abilityBar.show(side === 'player', String(pokemonName), String(abilityName));
  }
  hideAbility() { return this._abilityBar?.hide(); }

  setStatStages(side, stages) {
    this.scene.requireMon(side);
    this.stages[side] = { ...stages };
    this.statsFor(side)?.update(this.stages[side]);
  }
  statsFor(side) {
    const info = this.scene.info[side];
    if (!info) return null;
    if (!info.stats) { info.stats = new BattleStats(this.scene, info, side === 'player'); info.stats.update(this.stages[side]); }
    return info.stats;
  }
  holdStats(source, pressed) {
    if (pressed) this.statsHeld.add(source); else this.statsHeld.delete(source);
    this.showStats();
  }

  // Treats everything pressed as released (window focus lost, collapse)
  releaseStats() { this.statsHeld.clear(); this.showStats(); }
  showStats() {
    const visible = this.statsHeld.size > 0;
    if (visible === this.statsVisible) return;
    this.statsVisible = visible;
    for (const side of ['player', 'enemy']) if (this.scene.pokemon[side]) this.statsFor(side)?.toggle(visible);
  }

  async changeForm(side, mon, { instant = false, sound = true } = {}) {
    const scene = this.scene, old = scene.requireMon(side);
    const next = { ...old.mon, speciesId: mon.speciesId, spriteId: mon.spriteId, shiny: !!mon.shiny, gender: mon.gender ?? old.mon.gender,
      ...(mon.name !== undefined ? { name: mon.name } : {}), ...(mon.level !== undefined ? { level: mon.level } : {}) };
    const asset = await scene.assets.mon(next, side === 'player');
    scene.life.check();
    const sprite = new PokemonSprite(scene, side, next, asset);
    const offset = this.subs[side] ? SUB_OFFSET[side] : [0, 0];
    sprite.container.setPosition(sprite.placement.x + offset[0], sprite.placement.y + offset[1]).setAlpha(old.container.alpha);
    scene.field.moveAbove(sprite.container, old.container);
    const info = scene.info[side], relabel = info && (mon.name !== undefined || mon.level !== undefined);
    const swap = () => {
      old.destroy(); scene.pokemon[side] = sprite;
      if (relabel) info.init({ ...info.mon, name: next.name, level: next.level, gender: next.gender, ...(mon.exp !== undefined ? { exp: mon.exp } : {}) });
    };
    if (instant) {
      swap(); sprite.container.setVisible(true); sprite.playAnim();
      if (sound) await scene.audio.play('battle_anims/PRSFX- Transform.wav');
      return;
    }
    const played = scene.audio.play('battle_anims/PRSFX- Transform.wav');
    old.tint(0xffffff, 0);
    await tween(scene, { targets: old.getTintSprite(), alpha: 1, duration: 1000, ease: 'Cubic.easeIn' });
    old.getSprite().setVisible(false);
    sprite.playAnim(); sprite.getSprite().setVisible(false); sprite.tint(0xffffff);
    sprite.container.setScale(0.01).setVisible(true);
    await Promise.all([
      tween(scene, { targets: old.container, delay: 250, scale: 0.01, ease: 'Cubic.easeInOut', duration: 500 }),
      tween(scene, { targets: sprite.container, delay: 250, scale: sprite.getSpriteScale(), ease: 'Cubic.easeInOut', duration: 500 }),
    ]);
    swap(); sprite.getSprite().setVisible(true);
    await delay(scene, 250);
    await Promise.all([sprite.untint(1000, 'Cubic.easeOut'), played]);
  }

  async substitute(side, action) {
    const scene = this.scene, p = scene.requireMon(side), sub = this.subs[side];
    const [dx, dy] = SUB_OFFSET[side], home = p.placement, player = side === 'player';
    const doll = (x, y) => {
      const s = scene.add.sprite(x, y, player ? 'sub_back' : 'sub').setOrigin(0.5, 1);
      scene.field.add(s); return s;
    };
    const subScale = player ? 0.5 : 1;
    if (action === 'add') {
      if (sub) return;
      const slot = SPRITE_SLOTS[side];
      const [sprite, tint] = [doll(slot.x, slot.bottom), doll(slot.x, slot.bottom)];
      sprite.setVisible(false).setScale(subScale);
      tint.setTintFill(0xffffff).setScale(0.01);
      if (player) scene.field.bringToTop(p.container);
      this.subs[side] = { sprite };

      // Sound, mon move and doll flash in parallel. This Promise.all awaits all three
      await Promise.all([
        scene.audio.play('battle_anims/PRSFX- Transform.wav'),
        tween(scene, { targets: p.container, duration: 500, x: home.x + dx, y: home.y + dy, alpha: 0.5, ease: 'Sine.easeIn' }),
        (async () => {
          await tween(scene, { targets: tint, delay: 250, scale: subScale, ease: 'Cubic.easeInOut', duration: 500 });
          sprite.setVisible(true);
          await tween(scene, { targets: tint, delay: 250, alpha: 0, ease: 'Cubic.easeOut', duration: 1000 });
          tint.destroy();
        })(),
      ]);
    } else if (action === 'pre') {
      if (!sub) return;
      await Promise.all([
        tween(scene, { targets: sub.sprite, alpha: 0, ease: 'Sine.easeInOut', duration: 500 }),
        tween(scene, { targets: p.container, x: home.x, y: home.y, alpha: 1, ease: 'Sine.easeInOut', delay: 250, duration: 500 }),
      ]);
    } else if (action === 'post') {
      if (!sub) return;
      await Promise.all([
        tween(scene, { targets: p.container, x: home.x + dx, y: home.y + dy, alpha: 0.5, ease: 'Sine.easeInOut', duration: 500 }),
        tween(scene, { targets: sub.sprite, alpha: 1, ease: 'Sine.easeInOut', delay: 250, duration: 500 }),
      ]);
    } else if (action === 'remove') {
      if (!sub) return;
      delete this.subs[side];
      const tint = doll(sub.sprite.x, sub.sprite.y).setAlpha(0).setTintFill(0xffffff).setScale(subScale);
      await tween(scene, { targets: tint, alpha: 1, ease: 'Sine.easeInOut', duration: 500 });
      sub.sprite.destroy();

      for (let repeatCount = 7; repeatCount >= 0; repeatCount--) {
        scene.audio.play('battle_anims/PRSFX- Substitute2.wav');
        tint.setVisible(repeatCount % 2 === 0);
        if (repeatCount) await delay(scene, 100);
      }
      await Promise.all([
        tween(scene, { targets: tint, scale: 0.01, ease: 'Sine.easeIn', duration: 500 }),
        tween(scene, { targets: p.container, x: home.x, y: home.y, alpha: 1, ease: 'Sine.easeInOut', delay: 250, duration: 500 }),
      ]);
      tint.destroy();
    } else if (action === 'clear') {
      if (sub) sub.sprite.destroy();
      delete this.subs[side];
      scene.tweens.killTweensOf(p.container);
      p.container.setPosition(home.x, home.y).setAlpha(1);
    } else throw new Error(`Invalid substitute action: ${action}`);
  }

  placeSubstitute(side) {
    const scene = this.scene, p = scene.requireMon(side);
    if (this.subs[side]) return;
    const [dx, dy] = SUB_OFFSET[side], home = p.placement, player = side === 'player', slot = SPRITE_SLOTS[side];
    const sprite = scene.add.sprite(slot.x, slot.bottom, player ? 'sub_back' : 'sub').setOrigin(0.5, 1).setScale(player ? 0.5 : 1);
    scene.field.add(sprite);
    if (player) scene.field.bringToTop(p.container);
    this.subs[side] = { sprite };
    p.container.setPosition(home.x + dx, home.y + dy).setAlpha(0.5);
  }

  setHidden(side, hidden) {
    this.scene.requireMon(side).container.setVisible(!hidden);
  }

  dollTarget(side) {
    const sprite = this.subs[side]?.sprite, p = this.scene.requireMon(side);
    return sprite ? { container: sprite, getSprite: () => sprite, getSpriteScale: () => sprite.scale, mon: p.mon } : null;
  }

  showDoll(side, visible) {
    this.subs[side]?.sprite.setVisible(visible);
  }

  // MoveChargeAnim: battle-anims/<move>-charging.json. Moves without a charging file play nothing.
  async playCharge(moveId, side, targetSide = side) {
    this.scene.requireReady();
    const file = chargeFile(moveId);
    if (!hasAnimation(file)) return false;
    await this.scene.animations.playFile(file, side, targetSide);
    return true;
  }

  destroy() {
    const parent = this.scene.options.parent;
    parent.removeEventListener('keydown', this.keyDown); parent.removeEventListener('keyup', this.keyUp);
    parent.ownerDocument.defaultView.removeEventListener('blur', this.blur);
    this.scene.input?.off('pointerdown', this.pointerDown); this.scene.input?.off('pointerup', this.pointerUp); this.scene.input?.off('pointerupoutside', this.pointerUp);
  }
}
