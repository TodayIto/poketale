// from pokerogue src/data/pokemon-species.ts (getIconAtlasKey/getIconId) @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/battle-scene.ts (addPokemonIcon) @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-10-28. See view/LICENSE-NOTE.md.

import spriteMap from '../../data/pokerogue-sprite-map.json' with { type: 'json' };

export function iconFrame(mon, icons) {
  for (const key of (spriteMap[mon.spriteId] ?? []).filter(Boolean)) {
    const [, number, form = ''] = /^(\d+)(.*)$/.exec(key) ?? [];
    if (!number) continue;
    const candidates = [];
    for (const shiny of mon.shiny ? ['s', ''] : ['']) {
      if (mon.gender === 'F' && !form) candidates.push(`${number}${shiny}-f`);
      candidates.push(`${number}${shiny}${form}`);
    }
    const found = candidates.find(frame => icons[frame]);
    if (found) return found;
  }
  return 'unknown';
}

export function iconAtlas(index, icons) {
  const frames = {};
  for (const [name, [n, x, y, w, h, sx, sy]] of Object.entries(icons)) {
    if (n !== index) continue;
    frames[name] = { frame: { x, y, w, h }, rotated: false, trimmed: true,
      spriteSourceSize: { x: sx, y: sy, w, h }, sourceSize: { w: 40, h: 30 } };
  }
  return { frames };
}
