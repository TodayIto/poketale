// from pokerogue src/field/arena-base.ts @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/field/arena.ts (getBiomeKey, getBiomeHasProps) @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/battle-scene.ts (launchBattle arenaBg, loadBiomeAssets, base positions in reset) @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/enums/biome-id.ts @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-10-28. See view/LICENSE-NOTE.md.

export const BIOMES = ['town', 'plains', 'grass', 'tall_grass', 'metropolis', 'forest', 'sea', 'swamp', 'beach', 'lake', 'seabed',
  'mountain', 'badlands', 'cave', 'desert', 'ice_cave', 'meadow', 'power_plant', 'volcano', 'graveyard', 'dojo', 'factory', 'ruins',
  'wasteland', 'abyss', 'space', 'construction_site', 'jungle', 'fairy_cave', 'temple', 'slum', 'snowy_forest', 'island', 'laboratory', 'end'];

const HAS_PROPS = new Set(['plains', 'metropolis', 'beach', 'lake', 'seabed', 'mountain', 'badlands', 'cave', 'desert', 'ice_cave', 'meadow',
  'power_plant', 'volcano', 'graveyard', 'factory', 'ruins', 'wasteland', 'abyss', 'construction_site', 'jungle', 'fairy_cave', 'temple',
  'snowy_forest', 'island', 'laboratory', 'end']);
export const DEFAULT_BIOME = 'plains';

export function biomeKey(name) {
  if (typeof name !== 'string') return null;
  const key = name.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return BIOMES.includes(key) ? key : null;
}
export const biomeHasProps = biome => HAS_PROPS.has(biome);

export function biomeImages(biome) {
  const animatedBase = biome === 'end';
  const images = [[`${biome}_bg`, false], [`${biome}_a`, animatedBase], [`${biome}_b`, animatedBase]];
  if (biomeHasProps(biome)) for (let p = 1; p <= 3; p++) images.push([`${biome}_b_${p}`, p === 3 && ['power_plant', 'end'].includes(biome)]);
  return images;
}

function playIfAnimated(scene, sprite, key) {
  const frames = scene.textures.get(key).getFrameNames().filter(n => /^\d{4}\.png$/.test(n)).sort();
  if (frames.length < 2) return;
  if (!scene.anims.exists(key)) scene.anims.create({ key, frames: frames.map(frame => ({ key, frame })), frameRate: 12, repeat: -1 });
  sprite.play(key);
}

export function createArena(scene, biome, props) {

  const bg = scene.add.sprite(0, 0, `${biome}_bg`).setOrigin(0).setScale(6).setDepth(-1);
  const base = (player) => {
    const container = scene.add.container(player ? 0 : 20, 0);
    const key = `${biome}_${player ? 'a' : 'b'}`;
    const sprite = scene.add.sprite(0, 0, key).setOrigin(0);
    playIfAnimated(scene, sprite, key);
    container.add(sprite);
    if (!player && biomeHasProps(biome)) {
      const value = Number.isInteger(props) ? props & 7 : Math.floor(Math.random() * 8);
      for (let p = 0; p < 3; p++) {
        const propKey = `${biome}_b_${p + 1}`;
        const prop = scene.add.sprite(0, 0, propKey).setOrigin(0).setVisible(!!(value & (1 << p)));
        playIfAnimated(scene, prop, propKey);
        container.add(prop);
      }
      container.propValue = value;
    }
    return container;
  };
  const playerBase = base(true), enemyBase = base(false);
  scene.field.addAt([playerBase, enemyBase], 0);
  return [bg, playerBase, enemyBase];
}
