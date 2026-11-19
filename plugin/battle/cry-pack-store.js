import { openCryPack, combineCryPacks, storedCryPack } from '../../view/cry-pack.js';
import { failed } from '../../story/failure.mjs';

// The pack list (JSON text, first pack first). Each pack keeps its layout under its own key and its voices in parts
// beside it, so a battle reads only the parts of the Pokémon in it rather than the whole zip.
export const CRY_PACKS_KEY = 'pkb_cry_packs';
// Earlier builds kept a single pack here; it is read as the whole list until a list is written.
export const CRY_PACK_KEY = 'pkb_cry_pack';
export const CRY_PACK_INFO_KEY = 'pkb_cry_pack_info';
// JSON text { id, cut?, voices }. Earlier builds kept the whole zip here as "<id>:<base64>"; such a pack still plays,
// and once it has been read it is cut into parts.
const packKey = id => `pkb_cry_pack_${id}`;
// One part as "<cut>:<base64>". The cut names the writing that made the parts: the pack's id when it is loaded in
// the settings, a fresh id each time a pack stored whole is cut, so two pages cutting one pack never write the same
// keys, and a layout always reads the parts written with it.
const partKey = (cut, n) => `pkb_cry_part_${cut}_${n}`;
const cutOf = info => info.cut || info.id;

// RisuAI keeps plugin storage values as JSON, so a zip is stored as base64 text.
export function toBase64(bytes) {
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(text);
}

export function fromBase64(text) {
  const raw = atob(text), bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export function normalizeCryPackInfo(value) {
  let info = value;
  if (typeof info === 'string') { try { info = JSON.parse(info); } catch { info = null; } }
  if (!info || typeof info !== 'object' || !Number.isInteger(info.count) || info.count < 1) return null;
  return { id: typeof info.id === 'string' ? info.id : '', name: typeof info.name === 'string' ? info.name : '',
    count: info.count, bytes: Number.isFinite(info.bytes) ? info.bytes : 0, key: typeof info.key === 'string' ? info.key : '',
    parts: Number.isInteger(info.parts) && info.parts > 0 ? info.parts : 0, cut: typeof info.cut === 'string' ? info.cut : '' };
}

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

let current = null; // what battles on this page play: Promise<combined pack | null>
let loaded = null; // [{ info, pack }] behind it, once this page has read or changed the packs
let missing = []; // listed packs that could not be read then: still shown, so they can be removed
let unlisted = false; // the list itself could not be read when this page first changed the packs
const dropped = new Set(); // ids removed on this page, even if storage refused to forget them
const reading = new Map(); // id → the read of that pack under way, so reads that overlap share it
const cutting = new Map(); // id → pack, while this page cuts a pack stored whole into parts
let queue = Promise.resolve();

// A pack counts only while the list names it and its key names the same id: its parts and key are written before
// the list, and it is dropped from the list before they are removed.
async function storedList(storage) {
  const read = async () => {
    let list = await storage?.getItem?.(CRY_PACKS_KEY);
    if (typeof list === 'string') { try { list = JSON.parse(list); } catch { list = null; } }
    return Array.isArray(list) ? list.map(normalizeCryPackInfo).filter(info => info?.id && info.key) : null;
  };
  const list = await read();
  if (list) return list;
  const single = normalizeCryPackInfo(await storage?.getItem?.(CRY_PACK_INFO_KEY));
  if (single?.id) return [{ ...single, key: CRY_PACK_KEY }];
  // Another page cutting the single pack writes the list before it removes the single pack's keys.
  return (await read()) ?? [];
}

async function readPart(storage, cut, n) {
  const text = await storage.getItem(partKey(cut, n));
  if (typeof text !== 'string' || !text.startsWith(`${cut}:`)) throw new Error(`Cry pack part ${n} is missing`);
  return fromBase64(text.slice(cut.length + 1));
}

// Made out here, so the part reader closes over nothing but these three: a reader made inside a function that holds
// a cut would keep the whole zip alive with it.
const fromParts = (storage, cut, voices) => storedCryPack(voices, n => readPart(storage, cut, n));

// The pack a layout describes, read from the parts written with it; null when the text is not this pack's layout.
function fromLayout(storage, id, text) {
  let layout = null;
  try { layout = JSON.parse(text); } catch { return null; }
  if (layout?.id !== id) return null;
  return fromParts(storage, typeof layout.cut === 'string' && layout.cut ? layout.cut : id, layout.voices);
}

// A pack read from a whole zip. Once its parts are stored it plays from them and lets the zip go, wherever this page
// holds it (the settings' list, the pack the next battle reads, a battle under way).
function settling(pack) {
  let inner = pack, zip = pack;
  return {
    get count() { return inner.count; },
    species: () => inner.species(),
    has: key => inner.has(key),
    variants: key => inner.variants(key),
    lines: (key, moment) => inner.lines(key, moment),
    url: (key, variant) => inner.url(key, variant),
    parts: size => zip.parts(size),
    settle(stored) { inner = stored; zip = null; },
  };
}

function readPack(storage, info) {
  if (cutting.has(info.id)) return Promise.resolve(cutting.get(info.id));
  if (!reading.has(info.id)) reading.set(info.id, readPackNow(storage, info).finally(() => reading.delete(info.id)));
  return reading.get(info.id);
}

// What the key holds decides how the pack is read, so a pack whose cutting stopped halfway still plays.
async function readPackNow(storage, info) {
  let text = await storage.getItem(info.key);
  // The single pack of earlier builds moves to a key of its own when it is cut; a read that began before follows it.
  if (text == null && info.key === CRY_PACK_KEY) text = await storage.getItem(packKey(info.id));
  if (typeof text !== 'string') return null;
  if (text.startsWith(`${info.id}:`)) {
    const pack = settling(openCryPack(fromBase64(text.slice(info.id.length + 1))));
    if (pack.count) { cutting.set(info.id, pack); cutStored(storage, info, pack); }
    return pack;
  }
  return fromLayout(storage, info.id, text);
}

// A pack removed or replaced on this page stops being written at the next part.
async function writeParts(storage, id, token, cut) {
  for (let n = 0; n < cut.count; n++) {
    if (dropped.has(id)) throw new Error('The cry pack was removed');
    await storage.setItem(partKey(token, n), `${token}:${toBase64(cut.part(n))}`);
  }
}

// Removes the parts an unfinished cut wrote, unless the list or the stored layout names them after all; when that
// cannot be read, they stay. Nothing else goes: storage has no way to change a key only if no other page changed it
// first, so a cut removes only what nobody but itself can name, and a rare race or interruption leaves parts behind.
async function dropUnlisted(storage, id, token, count, wroteLayout) {
  try {
    if ((await storedList(storage)).some(other => other.id === id && cutOf(other) === token)) return;
    // Only a cut that wrote its layout can be named there; any other cut would read a whole zip back for nothing.
    const text = wroteLayout ? await storage.getItem(packKey(id)) : null;
    if (typeof text === 'string' && text.startsWith('{') && JSON.parse(text)?.cut === token) return;
  } catch { return; }
  await forget(storage, { id, key: '', parts: count, cut: token });
}

// A pack an earlier build stored whole is cut into parts after it has been read. The parts are written outside the
// queue, so the settings never wait for them; only the list and the layout wait their turn. The list goes before the
// layout, so a pack the list says is cut while its key still holds the zip plays from the zip and is cut again.
async function cutStored(storage, info, pack) {
  let cut = null, listed = false, wroteLayout = false;
  const token = newId();
  try {
    // The battle that read the pack gets it first.
    await new Promise(resolve => setTimeout(resolve, 0));
    if (dropped.has(info.id)) return;
    cut = pack.parts();
    await writeParts(storage, info.id, token, cut);
    await enqueue(async () => {
      const list = await storedList(storage);
      const entry = list.find(other => other.id === info.id && other.key === info.key);
      if (dropped.has(info.id)) return;
      if (!entry) {
        // Another page cut it meanwhile: this page plays from what that page stored, and its own parts go.
        const other = list.find(each => each.id === info.id && each.parts > 0);
        const stored = other && fromLayout(storage, info.id, await storage.getItem(other.key));
        if (stored?.count) pack.settle(stored);
        return;
      }
      const key = packKey(info.id), layout = JSON.stringify({ id: info.id, cut: token, voices: cut.voices });
      const listText = JSON.stringify(list.map(other => (other === entry ? { ...entry, key, parts: cut.count, cut: token } : other)));
      if (entry.key === key) {
        await storage.setItem(CRY_PACKS_KEY, listText);
        listed = true;
        await storage.setItem(key, layout);
      } else {
        wroteLayout = true;
        await storage.setItem(key, layout);
        await storage.setItem(CRY_PACKS_KEY, listText);
        listed = true;
        await forget(storage, entry);
      }
      pack.settle(fromParts(storage, token, cut.voices));
    });
  } catch (error) {
    if (!dropped.has(info.id)) console.warn('[poke-battle] 울음소리 팩을 조각으로 나눠 저장하지 못함', info.name, error);
  } finally {
    const count = cut?.count ?? 0;
    cut = null;
    // Only once its leftovers are gone may a new read cut the pack again, or the cleanup would remove the new parts.
    if (count && !listed) await dropUnlisted(storage, info.id, token, count, wroteLayout);
    cutting.delete(info.id);
  }
}

// One pack that cannot be read is left out; the others still play. `broken` means a read failed and may work later.
async function readStored(storage) {
  const packs = [], lost = [];
  let broken = false;
  for (const info of await storedList(storage)) {
    // Checked as each pack comes up: a pack can be removed or replaced while the ones before it are read.
    if (dropped.has(info.id)) continue;
    try {
      const pack = await readPack(storage, info);
      if (pack?.count) packs.push({ info, pack }); else lost.push(info);
    } catch (error) {
      broken = true; lost.push(info);
      console.warn('[poke-battle] 울음소리 팩 하나를 읽지 못함', info.name, error);
    }
  }
  return { packs, lost, broken };
}

const playing = () => combineCryPacks(loaded.map(entry => entry.pack));
const shownInfo = ({ id, name, count, bytes }) => ({ id, name, count, bytes });
const infos = () => [...loaded.map(entry => shownInfo(entry.info)), ...missing.filter(info => !dropped.has(info.id)).map(shownInfo)];

// One read per page. A read that missed a pack is forgotten so the next battle tries again, unless the settings
// changed the packs meanwhile.
export const cryPackSource = storage => () => {
  if (current) return current;
  const reading = readStored(storage).then(({ packs, lost, broken }) => {
    if (current === reading) { if (broken) current = null; else { loaded = packs; missing = lost; } }
    return combineCryPacks(packs.map(entry => entry.pack));
  }, error => {
    console.warn('[poke-battle] 울음소리 팩을 읽지 못함', error);
    if (current === reading) current = null;
    return null;
  });
  return (current = reading);
};

async function shown(storage) {
  if (loaded && unlisted) {
    try {
      const have = new Set(loaded.map(entry => entry.info.id));
      missing = (await storedList(storage)).filter(info => !have.has(info.id));
      unlisted = false;
    } catch (error) { console.warn('[poke-battle] 울음소리 팩 목록을 읽지 못함', error); }
  }
  if (loaded) return infos();
  try {
    return (await storedList(storage)).filter(info => !dropped.has(info.id)).map(({ id, name, count, bytes }) => ({ id, name, count, bytes }));
  } catch (error) {
    console.warn('[poke-battle] 울음소리 팩 목록을 읽지 못함', error);
    return [];
  }
}

// The packs this page plays, first pack first: [{ id, name, count, bytes }].
export async function loadCryPacks(storage) {
  await queue;
  return shown(storage);
}

// Changes run one at a time for the whole page, even when the settings window is closed and opened again meanwhile.
function enqueue(work) {
  const run = queue.then(work);
  queue = run.then(() => {}, () => {});
  return run;
}

async function forget(storage, info) {
  const keys = info.key === CRY_PACK_KEY ? [CRY_PACK_KEY, CRY_PACK_INFO_KEY]
    : [info.key, ...Array.from({ length: info.parts ?? 0 }, (_, n) => partKey(cutOf(info), n))].filter(Boolean);
  for (const key of keys) {
    await Promise.resolve().then(() => storage.removeItem(key)).catch(error => console.warn('[poke-battle] 울음소리 팩 본문을 지우지 못함', error));
  }
}

// Adds each file as a pack on top of the others; loading the same file again moves it to the top.
// Returns { packs, results }: one result per file, { name, info, saved } or { name, error } when it is not a pack.
// `saved: false` means the pack plays only until the page closes.
export function addCryPacks(storage, files) {
  return enqueue(async () => {
    const results = [];
    for (const file of files) results.push(await addOne(storage, file).catch(error => ({ name: String(file?.name ?? ''), error })));
    return { packs: await shown(storage), results };
  });
}

async function addOne(storage, file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let pack;
  try { pack = openCryPack(bytes); } catch (error) {
    console.warn('[poke-battle] 울음소리 팩으로 읽을 수 없음', error);
    throw failed('notCryPack');
  }
  if (!pack.count) throw failed('notCryPack');
  const id = newId();
  const cut = pack.parts();
  const info = { id, name: String(file.name ?? ''), count: pack.count, bytes: bytes.length, key: packKey(id), parts: cut.count };
  const same = other => other.name === info.name && other.bytes === info.bytes;
  // Stored copies of the same file are replaced, so they are neither read nor cut below, and a cut of one already
  // under way stops.
  try { for (const other of (await storedList(storage)).filter(same)) dropped.add(other.id); } catch {}
  // The stored packs keep playing under the new one, so they are read once a file has proved to be a pack.
  if (!loaded) ({ packs: loaded, lost: missing, unlisted = false } = await readStored(storage).catch(() => ({ packs: [], lost: [], unlisted: true })));
  for (const other of [...loaded.map(entry => entry.info), ...missing].filter(same)) dropped.add(other.id);
  const playable = settling(pack);
  loaded = [{ info, pack: playable }, ...loaded.filter(entry => !same(entry.info))];
  missing = missing.filter(other => !same(other));
  current = Promise.resolve(playing());
  try {
    await writeParts(storage, id, id, cut);
    await storage.setItem(info.key, JSON.stringify({ id, voices: cut.voices }));
    const list = await storedList(storage);
    for (const other of list.filter(same)) dropped.add(other.id);
    await storage.setItem(CRY_PACKS_KEY, JSON.stringify([info, ...list.filter(other => !same(other))]));
    for (const other of list.filter(same)) await forget(storage, other);
    playable.settle(fromParts(storage, id, cut.voices));
    return { name: info.name, info: infos()[0], saved: true };
  } catch (error) {
    console.warn('[poke-battle] 울음소리 팩을 저장하지 못함', error);
    await forget(storage, info);
    return { name: info.name, info: infos()[0], saved: false, error };
  }
}

// Returns { packs, saved }. The pack stops playing on this page at once; `saved: false` means storage still lists
// it, so it may play again the next time the page opens. Stored copies of the same file go with it (a copy loaded
// again on this page whose save failed stands for the stored one).
export function removeCryPack(storage, id) {
  return enqueue(async () => {
    const target = loaded?.find(entry => entry.info.id === id)?.info;
    dropped.add(id);
    if (loaded) { loaded = loaded.filter(entry => entry.info.id !== id); current = Promise.resolve(playing()); } else current = null;
    let gone = [];
    try {
      const list = await storedList(storage);
      const same = target ?? list.find(info => info.id === id);
      gone = list.filter(info => info.id === id || (same && info.name === same.name && info.bytes === same.bytes));
      for (const info of gone) dropped.add(info.id);
      // The other stored copies go with it, so this page stops playing them too.
      if (loaded && gone.length) { loaded = loaded.filter(entry => !dropped.has(entry.info.id)); current = Promise.resolve(playing()); }
      if (gone.length) await storage.setItem(CRY_PACKS_KEY, JSON.stringify(list.filter(info => !gone.includes(info))));
    } catch (error) {
      console.warn('[poke-battle] 울음소리 팩을 지우지 못함', error);
      return { packs: await shown(storage), saved: false, error };
    }
    for (const info of gone) await forget(storage, info);
    return { packs: await shown(storage), saved: true };
  });
}
