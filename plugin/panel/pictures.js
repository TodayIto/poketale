// Load and cache panel pictures with the selected transport.
import { panelSpriteUrl } from '../../story/panel-html.mjs';
import { imageKind } from '../../view/sprites/showdown.js';
import { timeLimit, LoadError } from '../../view/retry.js';

export const PICTURE_ROUTES = Object.freeze(['auto', 'direct', 'risu']);
export const DEFAULT_PICTURE_ROUTE = 'auto';

const ROUTES = Object.freeze({
  auto: { meanwhile: 'direct', steps: ['probe', 'host', 'pokerogue'] },
  direct: { meanwhile: 'direct', steps: [] },
  risu: { meanwhile: null, steps: ['host', 'pokerogue'] },
});

const KEEP = 400;

const STEP_TIMEOUT_MS = 10000;

export function dataUrl(bytes) {
  const type = imageKind(bytes);
  if (!type) throw new LoadError('그림이 아님');
  const view = new Uint8Array(bytes);
  let text = '';
  for (let i = 0; i < view.length; i += 0x8000) text += String.fromCharCode(...view.subarray(i, i + 0x8000));
  return `data:${type};base64,${btoa(text)}`;
}

export function createPanelPictures({ route, probe, fetchBytes, still }) {
  const STEPS = {
    probe: (slot, url) => probe(url).then(() => url),
    host: (slot, url) => fetchBytes(url).then(dataUrl),
    pokerogue: slot => still(slot),
  };
  const kept = new Map();
  const pending = new Set();
  const listeners = new Set();

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
    const id = route(), { meanwhile, steps } = ROUTES[id];
    const url = panelSpriteUrl(slot.spriteId, slot.shiny), key = `${id} ${url}`;
    const before = meanwhile === 'direct' ? url : null;
    if (kept.has(key)) {
      const hit = kept.get(key);
      kept.delete(key); kept.set(key, hit);
      return hit;
    }
    if (steps.length && !pending.has(key)) {
      pending.add(key);
      answer(steps, slot, url).then(found => {
        pending.delete(key);
        if (found === null) return;
        kept.set(key, found);
        if (kept.size > KEEP) kept.delete(kept.keys().next().value);
        if (found !== before) for (const listener of listeners) listener();
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
