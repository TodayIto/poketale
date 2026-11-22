import { openVoicePack, combineVoicePacks } from '../../view/voice-pack.js';

export const CRY_PACK_SOURCE = 'https://sounds.spriters-resource.com/wii/pokepark2wondersbeyond';

export const VOICE_LIST_KEY = 'pkb:voices';
export const VOICE_ZIP_PREFIX = 'pkb:voice:';
const packKey = id => `${VOICE_ZIP_PREFIX}${id}`;

export const isQuotaError = error => /quota|full disk|disk is full|storage (?:is )?full|exceeded the/i.test(`${error?.name ?? ''} ${error?.message ?? error ?? ''}`);

const asBlob = value => (value && typeof value.slice === 'function' && typeof value.arrayBuffer === 'function' ? value
  : value instanceof ArrayBuffer || ArrayBuffer.isView(value) ? new Blob([value]) : null);

function asRecord(id, value) {
  const info = value && typeof value === 'object' && !asBlob(value) ? value.info : null;
  if (!info || typeof info !== 'object' || !Number.isInteger(info.count) || info.count <= 0) return null;
  return {
    info: { id, name: typeof info.name === 'string' ? info.name : '', count: info.count, bytes: Number.isFinite(info.bytes) ? info.bytes : 0, added: Number.isFinite(info.added) ? info.added : 0 },
    zip: asBlob(value.zip),
  };
}
const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const shown = ({ info, saved }) => ({ id: info.id, name: info.name, count: info.count, bytes: info.bytes, saved });
const same = (a, b) => a.name === b.name && a.bytes === b.bytes;
const newestFirst = (a, b) => b.info.added - a.info.added || (a.info.id < b.info.id ? -1 : a.info.id > b.info.id ? 1 : 0);

async function readDevice(s) {
  const all = await s.keys();
  const keys = all.filter(key => typeof key === 'string' && key.startsWith(VOICE_ZIP_PREFIX));
  const records = [], old = [];
  for (const key of keys) {
    const value = await s.getItem(key);
    if (value === null || value === undefined) continue; // removed meanwhile
    const record = asRecord(key.slice(VOICE_ZIP_PREFIX.length), value);
    if (record) records.push(record); else old.push(key);
  }
  for (const key of [...old, ...(all.includes(VOICE_LIST_KEY) ? [VOICE_LIST_KEY] : [])]) {
    await Promise.resolve().then(() => s.removeItem(key)).catch(error => console.warn('[poke-battle] 옛 목소리 팩을 지우지 못함', key, error));
  }
  return records;
}

export function voicePackStore({ open = async () => null } = {}) {
  let device; // Promise of the store or null
  const store = () => (device ??= Promise.resolve().then(open).then(s => {
    if (!s || typeof s.getItem !== 'function' || typeof s.setItem !== 'function') return null;
    if (typeof s.removeItem !== 'function' || typeof s.keys !== 'function') { console.warn('[poke-battle] 이 기기 저장 공간에서 목록을 읽을 수 없음 — 목소리 팩은 이 페이지에서만'); return null; }
    return s;
  }, error => { console.warn('[poke-battle] 이 기기 저장 공간을 열지 못함 — 목소리 팩은 이 페이지에서만', error); return null; }));
  let saved = null;
  let local = [];
  const hidden = new Set(); // ids this page removed but could not delete from the device: not played here
  const opened = new Map(); // id -> Promise<pack | null> (a record never changes under its id)
  let reading = null, combined = null, queue = Promise.resolve(), lastAdded = 0, edits = 0; // edits: this page's own changes (a read begun before one is not used)

  const changed = () => { combined = null; };
  const enqueue = work => { const run = queue.then(work); queue = run.then(() => {}, () => {}); return run; };
  const view = () => [...local, ...(saved ? [...saved.values()].filter(entry => !hidden.has(entry.info.id)) : [])].sort(newestFirst);
  const openPack = ({ info, zip }) => {
    if (!opened.has(info.id)) {
      opened.set(info.id, (zip ? openVoicePack(zip) : Promise.resolve(null)).then(pack => (pack?.count ? pack : null), error => {
        console.warn('[poke-battle] 목소리 팩 하나를 읽지 못함', info.name, error);
        return null;
      }));
    }
    return opened.get(info.id);
  };

  async function read() {
    const at = edits;
    const s = await store();
    const records = s ? await readDevice(s) : [];
    if (edits !== at) return s;
    const next = new Map();
    for (const record of records) next.set(record.info.id, { info: record.info, pack: await openPack(record), saved: true });
    for (const id of [...opened.keys()]) if (!next.has(id)) opened.delete(id);
    for (const id of [...hidden]) if (!next.has(id)) hidden.delete(id);
    const before = saved ? [...saved.keys()].join() : null;
    saved = next;
    if (before !== [...next.keys()].join()) changed();
    return s;
  }

  const refresh = () => (reading ??= read().then(() => true, error => { console.warn('[poke-battle] 목소리 팩 목록을 읽지 못함', error); return false; })
    .finally(() => { reading = null; }));

  async function addOne(file) {
    const name = String(file?.name ?? '');
    let pack = null;
    try { pack = await openVoicePack(file); } catch (error) { console.warn('[poke-battle] 목소리 팩으로 읽을 수 없음', name, error); }
    if (!pack?.count) return { name, why: 'notPack' };
    let s = null;
    try { s = await read(); } catch (error) { console.warn('[poke-battle] 목소리 팩 목록을 읽지 못함 — 새 팩은 이 페이지에서만', error); }
    lastAdded = Math.max(Date.now(), lastAdded + 1, ...view().map(entry => entry.info.added + 1)); // on top of every pack seen (a clock that is behind too)
    const info = { id: newId(), name, count: pack.count, bytes: file.size, added: lastAdded };
    const entry = { info, pack, saved: false };
    const older = view().filter(other => same(other.info, info));
    const pageOnly = why => {

      if (!older.some(other => other.saved)) local = [entry, ...local.filter(other => !older.includes(other))];
      changed();
      return { name, saved: false, why };
    };
    if (!s) return pageOnly('unsaved');
    try {
      await s.setItem(packKey(info.id), { info, zip: file }); // the whole pack in one write
    } catch (error) {
      console.warn('[poke-battle] 목소리 팩을 저장하지 못함', name, error);
      return pageOnly(isQuotaError(error) ? 'full' : 'unsaved');
    }
    entry.saved = true;
    edits++;
    saved.set(info.id, entry);
    opened.set(info.id, Promise.resolve(pack));
    local = local.filter(other => !older.includes(other));
    // only now that the new one is saved: the older copies of the same file
    for (const old of older.filter(other => other.saved)) {
      saved.delete(old.info.id);
      await Promise.resolve().then(() => s.removeItem(packKey(old.info.id))).catch(error => console.warn('[poke-battle] 옛 사본을 지우지 못함', name, error));
    }
    changed();
    return { name, saved: true };
  }

  return {
    source() {
      return (combined ??= (saved ? Promise.resolve() : refresh()).then(() => {
        const pack = combineVoicePacks(view().map(entry => entry.pack));
        if (!saved) combined = null; // not read: tried again by the next view
        return pack;
      }, () => { combined = null; return null; }));
    },
    list: () => enqueue(async () => { await refresh(); return view().map(shown); }),
    add: files => enqueue(async () => {
      const results = [];
      for (const file of files) results.push(await addOne(file).catch(error => ({ name: String(file?.name ?? ''), saved: false, why: 'unsaved', error })));
      return { packs: view().map(shown), results };
    }),
    remove: id => enqueue(async () => {
      if (!saved) await refresh();
      const target = view().find(entry => entry.info.id === id);
      if (!target) return { packs: view().map(shown), removed: true };
      changed();
      if (!target.saved) {
        local = local.filter(entry => entry !== target);
        return { packs: view().map(shown), removed: true };
      }
      hidden.add(id); // stops playing here at once
      edits++;
      try {
        const s = await store();
        if (!s) throw new Error('No device store');
        await s.removeItem(packKey(id)); // that pack's key only
        saved.delete(id); hidden.delete(id); opened.delete(id);
        return { packs: view().map(shown), removed: true };
      } catch (error) {
        console.warn('[poke-battle] 목소리 팩을 지우지 못함', target.info.name, error);
        return { packs: view().map(shown), removed: false };
      }
    }),
  };
}
