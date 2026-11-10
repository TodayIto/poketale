// Load images through direct and host transports.
import { LoadError, withRetry, transientError } from './retry.js';
import { imageKind } from './sprites/showdown.js';

export const DIRECT_ONLY = () => ['direct'];
const here = url => !/^https?:/i.test(url);
const originOf = url => { try { return new URL(url).origin; } catch { return url; } };

export function audioType(url) {
  const ext = url.split(/[?#]/)[0].split('.').pop().toLowerCase();
  return { wav: 'audio/wav', mp3: 'audio/mpeg', m4a: 'audio/mp4', ogg: 'audio/ogg', mp4: 'video/mp4' }[ext] ?? 'application/octet-stream';
}

export function createImageRoute({ ways = DIRECT_ONLY, fetchBytes, signal } = {}) {
  const down = new Map();
  const made = new Set();
  signal?.addEventListener('abort', () => { for (const url of made) URL.revokeObjectURL(url); made.clear(); }, { once: true });

  function downEntry(url) {
    const origin = originOf(url);
    if (!down.has(origin)) {
      let fail;
      const promise = new Promise((_, reject) => { fail = reject; });
      promise.catch(() => {});
      down.set(origin, { promise, fail, failed: false });
    }
    return down.get(origin);
  }
  const isDown = url => !!down.get(originOf(url))?.failed;
  function markDown(url) {
    const entry = downEntry(url);
    if (entry.failed) return;
    entry.failed = true;
    entry.fail(new LoadError(`direct failed on this origin: ${originOf(url)}`));
  }

  function order(url) {
    if (here(url)) return ['direct'];
    const list = [...(ways(url) ?? ['direct'])];
    if (isDown(url) && list.includes('host') && list.includes('direct')) return ['host', ...list.filter(way => way !== 'host')];
    return list.length ? list : ['direct'];
  }

  async function objectUrl(url, check) {
    if (typeof fetchBytes !== 'function') throw new LoadError(`no host fetch: ${url}`);
    const bytes = await fetchBytes(url);
    const type = check(bytes);
    const address = URL.createObjectURL(new Blob([bytes], { type }));
    if (signal?.aborted) URL.revokeObjectURL(address); else made.add(address);
    return address;
  }
  const imageCheck = bytes => {
    const type = imageKind(bytes);
    if (!type) throw new LoadError('not a PNG or GIF (an error page?)');
    return type;
  };

  async function run(url, { direct, host }) {
    const list = order(url), failures = [];
    const stop = isDown(url) || here(url) ? new Promise(() => {}) : downEntry(url).promise;
    for (const way of list) {
      try {
        const result = await (way === 'direct' ? direct(stop) : host());
        if (way === 'host' && failures.some(failure => failure.way === 'direct')) markDown(url);
        return result;
      } catch (error) {
        if (signal?.aborted) throw error;
        if (list.length === 1) throw error;
        if (way === 'direct' && !(error instanceof LoadError)) throw error;
        failures.push({ way, error });
      }
    }
    throw new LoadError(`${url}: ${failures.map(({ way, error }) => `${way}: ${error?.message ?? error}`).join('; ')}`);
  }

  function image(url, loadOnce) {
    return run(url, {
      direct: stop => withRetry(() => Promise.race([loadOnce(url), stop]), { signal, retryable: error => !isDown(url) && transientError(error) }),
      host: async () => loadOnce(await objectUrl(url, imageCheck)),
    });
  }

  return { order, isDown, markDown, objectUrl, run, image, imageCheck };
}
