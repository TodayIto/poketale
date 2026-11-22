import { ANIM_PACK_FILES } from 'embedded:anim-pack';

const TYPES = { png: 'image/png', m4a: 'audio/mp4' };
const plain = path => { try { return decodeURIComponent(path); } catch { return path; } };

export const hasAnimPackFile = path => Object.hasOwn(ANIM_PACK_FILES, plain(path));

export function animPackUrls(signal) {
  const made = new Map();
  signal?.addEventListener('abort', () => { for (const url of made.values()) URL.revokeObjectURL(url); made.clear(); }, { once: true });
  return path => {
    const key = plain(path);
    if (!Object.hasOwn(ANIM_PACK_FILES, key) || signal?.aborted) return undefined;
    let url = made.get(key);
    if (!url) {
      const bytes = Uint8Array.from(atob(ANIM_PACK_FILES[key]), c => c.charCodeAt(0));
      url = URL.createObjectURL(new Blob([bytes], { type: TYPES[key.split('.').pop()] ?? 'application/octet-stream' }));
      made.set(key, url);
    }
    return url;
  };
}
