import spriteMap from '../../data/pokerogue-sprite-map.json' with { type: 'json' };

export function pokerogueReference(mon, side, boxes) {
  const pair = spriteMap[mon.spriteId];
  if (!pair) return null;
  const direction = side === 'player' ? 'b' : 'f';
  for (const [index, key] of pair.entries()) {
    if (key && boxes[key]?.[direction]) return { key, values: boxes[key][direction], fallback: index === 1 };
  }
  return null;
}
