// from pokerogue src/field/pokemon.ts @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-10-30. See view/LICENSE-NOTE.md.

// Field position (single centre or double left/right), sprite+tint sprite, animation and tint tweens only.
import { tween } from '../lifetime.js';
import { placeSprite } from './placement.js';
import { teamOf, fieldOffset, DRAW_ORDER } from '../positions.js';

const shifted = (placement, dx, dy) => (dx || dy ? { ...placement, x: placement.x + dx, y: placement.y + dy,
  box: { left: placement.box.left + dx, top: placement.box.top + dy, right: placement.box.right + dx, bottom: placement.box.bottom + dy } } : placement);

export class PokemonSprite {
  constructor(scene, side, mon, asset) {
    this.scene = scene; this.side = side; this.mon = { ...mon }; this.asset = asset;
    const player = teamOf(side) === 'player';
    this.placement = shifted(placeSprite(asset, teamOf(side)), ...fieldOffset(scene.double, side));
    this.container = scene.add.container(this.placement.x, this.placement.y).setDepth(player ? 2 : 1).setVisible(false);
    scene.field.add(this.container);
    if (scene.double) this.keepDrawOrder();
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
  getFieldPositionOffset() { return fieldOffset(this.scene.double, this.side); }

  keepDrawOrder() {
    const field = this.scene.field;
    const above = DRAW_ORDER.slice(DRAW_ORDER.indexOf(this.side) + 1)
      .map(position => this.scene.pokemon[position]?.container).filter(c => c && c !== this.container && field.exists(c));
    if (above.length) field.moveBelow(this.container, above.reduce((a, b) => (field.getIndex(a) < field.getIndex(b) ? a : b)));
  }

  moveTo(position) {
    const [ax, ay] = this.getFieldPositionOffset(), [bx, by] = fieldOffset(this.scene.double, position);
    this.side = position;
    this.placement = shifted(this.placement, bx - ax, by - ay);
    return [bx - ax, by - ay];
  }
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
