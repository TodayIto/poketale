// Values that belong to this device only (where the panel was dragged to), unlike plugin settings, which a user's
// devices share. Kept in the host's browser storage. If the host has none, values simply are not kept per device.
// Same host calls as Risu-Phone-Kit's browserStorage (safeLocalStorage, or the older _get/_set/_removeSafeLocalStorage).
export function deviceStore(host, key) {
  const ls = host?.safeLocalStorage, has = typeof ls?.getItem === 'function';
  const old = typeof host?._getSafeLocalStorage === 'function';
  const usable = has || old;
  const get = () => (has ? ls.getItem(key) : host._getSafeLocalStorage(key));
  const set = text => (has ? ls.setItem(key, text) : host._setSafeLocalStorage(key, text));
  const drop = () => (has ? ls.removeItem(key) : host._removeSafeLocalStorage(key));
  let cache = {};
  return {
    usable,
    async load() {
      if (!usable) return cache;
      try { const raw = await get(); const read = raw ? JSON.parse(raw) : null; cache = read && typeof read === 'object' ? read : {}; } catch { cache = {}; }
      return cache;
    },
    get: name => cache[name],
    async set(name, value) {
      if (value === undefined || value === null) delete cache[name]; else cache[name] = value;
      if (!usable) return;
      if (Object.keys(cache).length) await set(JSON.stringify(cache)); else await drop();
    },
  };
}
