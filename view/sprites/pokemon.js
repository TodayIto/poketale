// from pokerogue src/field/pokemon.ts @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-10-28. See view/LICENSE-NOTE.md.

// Single field position, sprite+tint sprite, animation and tint tweens only.
import { tween } from '../lifetime.js';
import { placeSprite } from './placement.js';

export class PokemonSprite {
  constructor(scene, side, mon, asset) {
    this.scene = scene; this.side = side; this.mon = { ...mon }; this.asset = asset;
    const player = side === 'player';
    this.placement = placeSprite(asset, side);
    this.container = scene.add.container(this.placement.x, this.placement.y).setDepth(player ? 2 : 1).setVisible(false);
    scene.field.add(this.container);
    const makeSprite = () => scene.add.sprite(0, 0, asset.key, asset.frame)
      .setOrigin(this.placement.originX, this.placement.originY);
    this.sprite = makeSprite(); this.tintSprite = makeSprite().setVisible(false);
    this.container.add([this.sprite, this.tintSprite]);
    this.container.setScale(this.getSpriteScale());
    scene.tera?.applySprite(this);

  }
  getSprite() { return this.sprite; }
  getTintSprite() { return this.tintSprite; }
  getSpriteScale() { return this.placement.scale; }
  getFieldPositionOffset() { return [0, 0]; }
  playAnim() { this.sprite.play(this.asset.key); this.tintSprite.play(this.asset.key); }
  tint(color, alpha = 1) { this.tintSprite.setTintFill(color).setVisible(true).setAlpha(alpha); }
  async untint(duration, ease = 'Linear') {
    await tween(this.scene, { targets: this.tintSprite, alpha: 0, duration, ease });
    this.tintSprite.setVisible(false).setAlpha(1);
  }
  async tintIn(color, duration) {
    this.tint(color, 0);
    await tween(this.scene, { targets: this.tintSprite, alpha: 1, duration, ease: 'Sine.easeIn' });
  }
  destroy() { this.container.destroy(); }
}
