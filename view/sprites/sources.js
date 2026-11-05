// Ordered battle sprite sources and their fallbacks.
import POKEAPI_SPRITES from '../../data/pokeapi-sprite-map.json' with { type: 'json' };
import { showdownUrl, showdownSprite, imageSprite } from './showdown.js';
import { loadPokerogueStill } from './pokerogue.js';
import { LoadError, missingFile } from '../retry.js';

export const POKEAPI_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/1dd55c0436d2a5b6e324c0b780e1b1b416fbfb64/sprites/pokemon/';

export function spriteSources(mon, back) {
  const stem = POKEAPI_SPRITES[mon.spriteId];
  return [
    { kind: 'showdown', url: showdownUrl(mon, back, 'ani') },
    { kind: 'showdown', url: showdownUrl(mon, back, 'gen5ani') },
    ...(stem ? [{ kind: 'pokeapi', url: `${POKEAPI_BASE}${back ? 'back/' : ''}${mon.shiny ? 'shiny/' : ''}${stem}.png` }] : []),
    { kind: 'showdown', url: showdownUrl(mon, back, 'gen5') },
    { kind: 'pokerogue' },
  ];
}

const CACHE_SIZE = 24;
const cache = new Map();

export async function loadMonSprite(assets, mon, back, key, reference) {
  const sources = spriteSources(mon, back), id = sources[0].url;
  const hit = cache.get(id);
  if (hit) {
    cache.delete(id); cache.set(id, hit);
    return { ...await showdownSprite(assets, mon, back, key, hit.url, hit.bytes, [], true), pokerogue: reference };
  }
  const failures = [], down = new Set();
  for (const source of sources) {
    if (source.kind === 'pokerogue') {
      if (!reference) break;
      if (failures.length) assets.diagnostics.push({ sprite: mon.spriteId, back, fallback: failures });
      return loadPokerogueStill(assets, mon, back, key, reference);
    }
    const host = new URL(source.url).host;
    if (down.has(host)) continue;
    try {
      if (source.kind === 'pokeapi') return { ...await imageSprite(assets, mon, back, key, source.url, failures), pokerogue: reference };
      let bytes;
      try { bytes = await assets.fetchBytes(source.url); }
      catch (error) {
        if (!missingFile(error)) down.add(host);
        throw error;
      }
      assets.life.check();
      const result = await showdownSprite(assets, mon, back, key, source.url, bytes, failures, false);
      cache.set(id, { url: source.url, bytes });
      if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value);
      return { ...result, pokerogue: reference };
    } catch (error) {
      assets.life.check();
      failures.push({ url: source.url, error: String(error.message ?? error) });
    }
  }
  throw new LoadError(`No sprite for ${mon.spriteId}: ${JSON.stringify(failures)}`);
}
