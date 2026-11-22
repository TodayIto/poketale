import { panelLift } from '../../story/panel-html.mjs'; // the widest a dragged height may go is the panel's
import { panelOpenOf } from '../../story/panel.mjs';

/** The browser storage key */
export const DEVICE_KEY = 'pkb:device';

const onOff = key => get => (typeof get(key) === 'boolean' ? get(key) : undefined);
const DEVICE_READS = Object.freeze({
  panelStay: onOff('panelStay'),
  panelOpen: get => panelOpenOf({ panelOpen: get('panelOpen') }),
  panelDrag: onOff('panelDrag'),
});
export const DEVICE_SETTINGS = Object.freeze(Object.keys(DEVICE_READS));

export const deviceValue = (key, value) => DEVICE_READS[key]?.(name => (name === key ? value : undefined));

export function deviceStore(host, key = DEVICE_KEY) {
  const ls = host?.safeLocalStorage;
  const has = typeof ls?.getItem === 'function' && typeof ls?.setItem === 'function';
  const old = !has && typeof host?._getSafeLocalStorage === 'function' && typeof host?._setSafeLocalStorage === 'function';
  const read = () => (has ? ls.getItem(key) : host._getSafeLocalStorage(key));
  const write = text => (has ? ls.setItem(key, text) : host._setSafeLocalStorage(key, text));
  const drop = () => (has ? (typeof ls.removeItem === 'function' ? ls.removeItem(key) : ls.setItem(key, ''))
    : typeof host._removeSafeLocalStorage === 'function' ? host._removeSafeLocalStorage(key) : host._setSafeLocalStorage(key, ''));
  let cache = {};
  const store = {
    usable: has || old,
    async load() {
      if (!store.usable) return cache;
      let raw;
      try { raw = await read(); } catch (error) { console.warn('[poke-battle] 이 기기 설정을 읽지 못함 — 공유 설정을 씀', error); store.usable = false; return cache = {}; }
      try {
        const value = typeof raw === 'string' && raw ? JSON.parse(raw) : null;
        cache = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
      } catch { cache = {}; }
      return cache;
    },
    get: name => (Object.hasOwn(cache, name) ? cache[name] : undefined),
    async set(name, value) {
      if (value === undefined || value === null) delete cache[name]; else cache[name] = value;
      if (!store.usable) return;
      if (Object.keys(cache).length) await write(JSON.stringify(cache)); else await drop();
    },
  };
  return store;
}

export function withDevice(shared, store) {
  if (!store?.usable) return shared;
  const own = DEVICE_SETTINGS.map(key => [key, DEVICE_READS[key](store.get)]).filter(([, value]) => value !== undefined);
  return own.length ? { ...shared, ...Object.fromEntries(own) } : shared;
}

export function sharedPart(next, shared, store) {
  if (!store?.usable || !shared) return next;
  return { ...next, ...Object.fromEntries(DEVICE_SETTINGS.map(key => [key, shared[key]])) };
}

export const deviceSettings = settings => Object.fromEntries(DEVICE_SETTINGS.map(key => [key, settings[key]]));

export function deviceShift(store) {
  const value = store?.usable ? store.get('panelShift') : undefined;
  return typeof value === 'number' && Number.isFinite(value) ? panelLift(value) : null;
}
