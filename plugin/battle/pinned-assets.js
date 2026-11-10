// Check received assets against the pinned file hashes.
import TABLE from './pinned-assets.json' with { type: 'json' };

export const PINNED_BASE = TABLE.base;

export const PINNED_CHARS = TABLE.bits / 6;

let byPath = null;

function paths(table = TABLE) {
  const map = new Map(), names = [];
  table.groups.forEach(([dir, ext, list, hashes], index) => {
    names[index] = typeof list === 'number' ? names[list] : list.split('/');
    names[index].forEach((name, i) => map.set(dir + name + ext, hashes.slice(i * PINNED_CHARS, (i + 1) * PINNED_CHARS)));
  });
  return map;
}

export function pinnedPath(url, base = PINNED_BASE) {
  if (typeof url !== 'string' || !url.startsWith(base)) return null;
  const rest = url.slice(base.length).split(/[?#]/)[0];
  try { return rest.split('/').map(decodeURIComponent).join('/'); } catch { return rest; }
}

export function pinnedHash(url) {
  const path = pinnedPath(url);
  if (path === null) return undefined;
  byPath ??= paths();
  return byPath.get(path);
}

export const pinnedCount = () => (byPath ??= paths()).size;
