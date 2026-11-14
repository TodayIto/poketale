import POKEAPI_SPRITES from '../../data/pokeapi-sprite-map.json' with { type: 'json' };
import { showdownUrl, showdownSprite, imageSprite } from './showdown.js';
import { loadPokerogueStill } from './pokerogue.js';
import { LoadError, missingFile } from '../retry.js';

export const POKEAPI_ROOT = 'https://raw.githubusercontent.com/PokeAPI/sprites/1dd55c0436d2a5b6e324c0b780e1b1b416fbfb64/sprites/';
export const POKEAPI_BASE = `${POKEAPI_ROOT}pokemon/`;

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

const CACHE_SIZE = 24, SHEET_BUDGET = 8 * 1024 * 1024, SHEET_KEEP = 12;
const cache = new Map();

function dropSheet(entry) {
  if (!entry.sheet) return;
  entry.sheet.canvas.width = 0;
  delete entry.sheet;
}

function remember(id, entry) {
  cache.delete(id); cache.set(id, entry);
  if (cache.size > CACHE_SIZE) {
    const oldest = cache.keys().next().value;
    dropSheet(cache.get(oldest)); cache.delete(oldest);
  }
  let bytes = 0, count = 0, full = false;
  for (const kept of [...cache.values()].reverse()) {
    if (!kept.sheet) continue;
    if (kept.sheet.size > SHEET_BUDGET) { dropSheet(kept); continue; }
    full ||= count === SHEET_KEEP || bytes + kept.sheet.size > SHEET_BUDGET;
    if (full) dropSheet(kept);
    else { count++; bytes += kept.sheet.size; }
  }
}

export async function loadMonSprite(assets, mon, back, key, reference) {
  const sources = spriteSources(mon, back), id = sources[0].url;
  const hit = cache.get(id);
  if (hit) {
    const result = await showdownSprite(assets, mon, back, key, hit.url, hit.bytes, [], true, hit);
    remember(id, hit);
    return { ...result, pokerogue: reference };
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
      const entry = { url: source.url, bytes };
      const result = await showdownSprite(assets, mon, back, key, source.url, bytes, failures, false, entry);
      remember(id, entry);
      return { ...result, pokerogue: reference };
    } catch (error) {
      assets.life.check();
      failures.push({ url: source.url, error: String(error.message ?? error) });
    }
  }
  throw new LoadError(`No sprite for ${mon.spriteId}: ${JSON.stringify(failures)}`);
}
