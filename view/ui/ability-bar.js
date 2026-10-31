// from pokerogue src/ui/containers/ability-bar.ts @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/phases/show-ability-phase.ts @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/phases/hide-ability-phase.ts @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-10-30. See view/LICENSE-NOTE.md.

import { addTextObject, styledText } from './text.js';
import { applyTheme, themeOf, usesLegacyArt } from './theme.js';
import { tween } from '../lifetime.js';

const BAR_WIDTH = 118;
const BASE_Y = -116;
const TEXT_PADDING = 15;
const SCREEN_RIGHT = 320;

export const abilityFlyInText = (words, pokemonName, abilityName) => words('fight-ui-handler.abilityFlyInText', { pokemonName, passive: '', abilityName });

export class AbilityBar {
  constructor(scene) {
    this.scene = scene; this.player = true; this.shown = false;
    const c = this.container = scene.add.container(BAR_WIDTH, BASE_Y);

    this.bars = ['ability_bar_right', 'ability_bar_left'].map(key => scene.add.image(0, 0, key).setOrigin(0).setVisible(false));
    this.text = applyTheme(addTextObject(scene, TEXT_PADDING, 3, '', 'message', { fontSize: 72, wordWrap: { width: 600, useAdvancedWrap: true } }), scene, 'ABILITY_BAR')
      .setOrigin(0).setLineSpacing(5);
    this.abilityText = usesLegacyArt(themeOf(scene)) ? styledText(scene, TEXT_PADDING, 16, '', 'WINDOW', { fontSize: 72 }).setOrigin(0) : null;
    c.add([...this.bars, this.text, ...(this.abilityText ? [this.abilityText] : [])]);
    scene.fieldUI.add(c);
    this.setVisible(false);
    c.setX(-BAR_WIDTH);
  }
  setVisible(value) {
    this.bars[+this.player].setVisible(value);
    this.container.setVisible(value);
    this.shown = value;
  }
  isVisible() { return this.shown; }

  async show(player, pokemonName, abilityName) {
    if (this.shown) await this.hide();
    if (player !== this.player) {
      this.bars[+this.player].setVisible(false);
      this.container.setX(player ? -BAR_WIDTH : SCREEN_RIGHT);
      this.player = player;
    }
    this.scene.fieldUI.bringToTop(this.container);
    const double = !!this.scene.double;
    this.container.setY(player ? BASE_Y + (double ? 14 : 0) : BASE_Y - (double ? 28 : 14));
    this.setVisible(true);
    const text = abilityFlyInText(this.scene.words, pokemonName, abilityName);
    if (this.abilityText) {
      const [name, ability] = text.split('\n');
      this.text.setText(name.trimStart()); this.abilityText.setText(ability.trimStart());
    } else this.text.setText(text);
    await tween(this.scene, { targets: this.container, x: player ? 0 : SCREEN_RIGHT - BAR_WIDTH, duration: 500, ease: 'Sine.easeOut', hold: 1000 });
  }
  async hide() {
    if (!this.shown) return;
    await tween(this.scene, { targets: this.container, x: this.player ? -BAR_WIDTH : SCREEN_RIGHT, duration: 200, ease: 'Sine.easeIn' });
    this.setVisible(false);
  }
  destroy() { this.container.destroy(); }
}
