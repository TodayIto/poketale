import { pinnedHash, PINNED_CHARS } from './pinned-assets.js';
import { sha256, base64 } from './sha256.js';
import { SHOWDOWN_HOST } from './picture-route.js';

const POST_HOSTS = new Set([SHOWDOWN_HOST]);

export const CLEAR_URL = `https://${SHOWDOWN_HOST}/sprites/gen5/pikachu.png`;

const REQUEST_TIMEOUT_MS = 20000;

const SOUND_TIMEOUT_MS = 60000;

const KEEP_LIMIT = Object.freeze({ bytes: 32 * 1024 * 1024, files: 800 });
const SEEN_LIMIT = 4096;

const httpError = (status, url) => Object.assign(new Error(`nativeFetch HTTP ${status}: ${url}`), { status });

export class FetchCheckError extends Error { name = 'FetchCheckError'; }

const pathOf = url => url.split(/[?#]/)[0];

export function kindOf(url) {
  const ext = pathOf(url).split('/').pop().split('.').pop().toLowerCase();
  return { png: 'png', gif: 'gif', json: 'json', ogg: 'ogg', mp3: 'mp3', wav: 'wav', m4a: 'mp4', mp4: 'mp4' }[ext] ?? null;
}
const SOUNDS = new Set(['ogg', 'mp3', 'wav', 'mp4']);

const ascii = (view, at, text) => [...text].every((char, i) => view[at + i] === char.charCodeAt(0));

export function magicOk(kind, bytes) {
  const view = new Uint8Array(bytes);
  switch (kind) {
    case 'png': return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, i) => view[i] === byte)
      || (ascii(view, 0, 'RIFF') && ascii(view, 8, 'WEBP'));
    case 'gif': return ascii(view, 0, 'GIF87a') || ascii(view, 0, 'GIF89a');
    case 'json': {
      let i = view[0] === 0xef && view[1] === 0xbb && view[2] === 0xbf ? 3 : 0;
      while ([0x20, 0x09, 0x0a, 0x0d].includes(view[i])) i++;
      return view[i] === 0x7b || view[i] === 0x5b;
    }
    case 'ogg': return ascii(view, 0, 'OggS');
    case 'mp3': return ascii(view, 0, 'ID3') || (view[0] === 0xff && (view[1] & 0xe0) === 0xe0);
    case 'wav': return ascii(view, 0, 'RIFF') && ascii(view, 8, 'WAVE');
    case 'mp4': return ascii(view, 4, 'ftyp');
    default: return true;
  }
}

const hex = digest => [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('');
const cloneFailure = error => error?.name === 'DataCloneError' || /clone/i.test(error?.message ?? '');

const states = new WeakMap();
function stateOf(risuai, keepLimit) {
  if (!states.has(risuai)) {
    states.set(risuai, {
      keepLimit,
      line: Promise.resolve(),
      seen: new Map(),
      kept: new Map(),
      keptBytes: 0,
      pending: new Map(),
      signal: true,
    });
  }
  return states.get(risuai);
}

export function createFetchBytes(risuai, { timeoutMs = REQUEST_TIMEOUT_MS, soundTimeoutMs = SOUND_TIMEOUT_MS, keepLimit = KEEP_LIMIT } = {}) {
  const state = stateOf(risuai, keepLimit);

  async function call(url, options, signal) {
    if (signal && state.signal) {
      try { return await risuai.nativeFetch(url, { ...options, signal }); }
      catch (error) {
        if (!cloneFailure(error)) throw error;
        state.signal = false;
      }
    }
    return risuai.nativeFetch(url, options);
  }

  async function request(url, init, accept = status => status === 200) {
    const ms = SOUNDS.has(kindOf(url)) ? soundTimeoutMs : timeoutMs;
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    let timer;
    const limit = new Promise((_, reject) => {
      timer = setTimeout(() => { controller?.abort(); reject(new Error(`nativeFetch ${init.method} ${ms / 1000}s: ${url}`)); }, ms);
    });
    const work = (async () => {
      const response = await call(url, { ...init, logFetch: false }, controller?.signal);
      if (!accept(response.status)) throw httpError(response.status, url);
      return response.arrayBuffer();
    })();
    work.catch(() => {});
    try { return await Promise.race([work, limit]); } finally { clearTimeout(timer); }
  }
  const nonEmpty = (bytes, url) => {
    if (!bytes?.byteLength) throw new Error(`nativeFetch 빈 응답: ${url}`);
    return bytes;
  };

  async function flush(url) {
    try { await request(CLEAR_URL, { method: 'POST', body: '' }, status => status >= 200 && status < 400); }
    catch (error) { throw new FetchCheckError(`비우는 POST 실패 — 받지 않음: ${url} (${error?.message ?? error})`); }
  }
  function remember(digest, url) {
    state.seen.delete(digest);
    state.seen.set(digest, url);
    if (state.seen.size > SEEN_LIMIT) state.seen.delete(state.seen.keys().next().value);
  }

  async function checkedGet(url) {
    const expected = pinnedHash(url), kind = kindOf(url);
    for (let attempt = 0; ; attempt++) {
      await flush(url);
      const bytes = nonEmpty(await request(url, { method: 'GET' }), url);
      const digest = await sha256(bytes), print = hex(digest);
      if (expected !== undefined) {
        if (base64(digest.subarray(0, (PINNED_CHARS * 6) / 8)) !== expected) throw new FetchCheckError(`nativeFetch GET 바이트가 고정 커밋의 파일과 다름 (그리지 않음): ${url}`);
      } else {
        if (kind && !magicOk(kind, bytes)) throw new FetchCheckError(`nativeFetch GET 바이트가 ${kind} 가 아님: ${url}`);
        const before = state.seen.get(print);
        if (before !== undefined && before !== url) {
          if (attempt === 0) continue;
          throw new FetchCheckError(`nativeFetch GET 이 다른 파일을 줌 (캐시): ${url} = ${before}`);
        }
      }
      remember(print, url);
      return bytes;
    }
  }
  function inLine(url) {
    const turn = state.line.then(() => checkedGet(url));
    state.line = turn.catch(() => {});
    return turn;
  }
  function keep(url, bytes) {
    const limit = state.keepLimit;
    if (SOUNDS.has(kindOf(url)) || bytes.byteLength > limit.bytes / 4) return;
    state.kept.set(url, bytes);
    state.keptBytes += bytes.byteLength;
    for (const [old, oldBytes] of state.kept) {
      if (state.keptBytes <= limit.bytes && state.kept.size <= limit.files) break;
      state.kept.delete(old);
      state.keptBytes -= oldBytes.byteLength;
    }
  }

  return async url => {
    const hit = state.kept.get(url);
    if (hit) {
      state.kept.delete(url); state.kept.set(url, hit);
      return hit.slice(0);
    }
    if (!state.pending.has(url)) {
      const work = (POST_HOSTS.has(new URL(url).host) ? request(url, { method: 'POST', body: '' }).then(bytes => nonEmpty(bytes, url)) : inLine(url))
        .then(bytes => { keep(url, bytes); return bytes; })
        .finally(() => state.pending.delete(url));
      state.pending.set(url, work);
    }
    return (await state.pending.get(url)).slice(0);
  };
}
