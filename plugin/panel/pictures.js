import { panelSpriteUrl } from '../../story/panel-html.mjs';
import { POKEAPI_ROOT } from '../../view/sprites/sources.js';
import { imageKind } from '../../view/sprites/showdown.js';
import { timeLimit, LoadError } from '../../view/retry.js';
import { pictureWays, PICTURE_ROUTES, DEFAULT_PICTURE_ROUTE } from '../battle/picture-route.js';

export { PICTURE_ROUTES, DEFAULT_PICTURE_ROUTE };

export function panelPlan(route, url) {
  const ways = pictureWays(route, url, { read: false, page: true });
  const viaHost = ways.includes('host');
  const steps = ways.length === 1 && !viaHost ? [] : ways.map(way => (way === 'direct' ? 'probe' : 'host'));
  return { meanwhile: ways[0] === 'direct' ? 'direct' : null, steps: viaHost ? [...steps, 'pokerogue'] : steps, viaHost };
}

const KEEP = 400;

const STEP_TIMEOUT_MS = 10000;

export const isBadgePicture = url => url.startsWith(`${POKEAPI_ROOT}badges/`);

export function dataUrl(bytes) {
  const type = imageKind(bytes);
  if (!type) throw new LoadError('그림이 아님');
  const view = new Uint8Array(bytes);
  let text = '';
  for (let i = 0; i < view.length; i += 0x8000) text += String.fromCharCode(...view.subarray(i, i + 0x8000));
  return `data:${type};base64,${btoa(text)}`;
}

export function createPanelPictures({ route, probe, fetchBytes, still, clean = null }) {
  const STEPS = {
    probe: (slot, url) => probe(url).then(() => url),
    host: (slot, url) => fetchBytes(url).then(dataUrl),
    pokerogue: slot => still(slot),
  };
  const kept = new Map();
  const pending = new Set();
  const listeners = new Set();
  const cleaned = new Map();
  const cleaning = new Set(), unclean = new Set();
  const changed = () => { for (const listener of listeners) listener(); };

  function startClean(id, url, drawn) {
    const key = `${id} ${url}`;
    if (!clean || drawn === null || !isBadgePicture(url) || cleaned.has(url) || cleaning.has(url) || unclean.has(key)) return;
    cleaning.add(url);
    timeLimit(Promise.resolve().then(() => clean(drawn, panelPlan(id, url).viaHost)), STEP_TIMEOUT_MS, `clean ${STEP_TIMEOUT_MS / 1000}s: ${url}`).then(
      done => { cleaned.set(url, done); changed(); },
      () => unclean.add(key),
    ).finally(() => cleaning.delete(url));
  }

  async function answer(steps, slot, url) {
    const failures = [];
    for (const step of steps) {
      try { return await timeLimit(STEPS[step](slot, url), STEP_TIMEOUT_MS, `${step} ${STEP_TIMEOUT_MS / 1000}s: ${url}`); }
      catch (error) { failures.push(`${step}: ${error?.message ?? error}`); }
    }
    console.warn('[poke-battle] 패널 그림', url, failures);
    return null;
  }

  function src(slot) {
    const id = route(), url = slot.url ?? panelSpriteUrl(slot.spriteId, slot.shiny), key = `${id} ${url}`;
    const { meanwhile, steps } = panelPlan(id, url);
    const before = meanwhile === 'direct' ? url : null;
    if (cleaned.has(url)) return cleaned.get(url);
    if (kept.has(key)) {
      const hit = kept.get(key);
      kept.delete(key); kept.set(key, hit);
      startClean(id, url, hit);
      return hit;
    }
    if (!steps.length) startClean(id, url, before);
    if (steps.length && !pending.has(key)) {
      pending.add(key);
      answer(slot.url ? steps.filter(step => step !== 'pokerogue') : steps, slot, url).then(found => {
        pending.delete(key);
        if (found === null) return;
        kept.set(key, found);
        if (kept.size > KEEP) kept.delete(kept.keys().next().value);
        startClean(id, url, found);
        if (found !== before) changed();
      });
    }
    return before;
  }

  return {
    route,
    src,
    onChange(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  };
}
