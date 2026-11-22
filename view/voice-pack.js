import CRIES from '../data/pokerogue-cries.json' with { type: 'json' };
import VOICES from '../data/pokepark2-voices.json' with { type: 'json' };

export const VOICE_MOMENTS = Object.freeze(['appear', 'faint', 'move', 'happy']);

const NAME_DEX = new Map();
for (const [id, key] of Object.entries(CRIES)) if (!id.includes('-') && /^\d+$/.test(key)) NAME_DEX.set(id, Number(key));
const KNOWN_DEX = new Set(NAME_DEX.values());
const CRY_DEX = new Map();
for (const [id, key] of Object.entries(CRIES)) {
  if (CRY_DEX.has(key)) continue;
  const dex = NAME_DEX.get(id.split('-')[0]) ?? Number.parseInt(key, 10);
  if (KNOWN_DEX.has(dex)) CRY_DEX.set(key, dex);
}
/** The National Dex number of a cry key ('25', '4079'), or null */
export const cryDex = key => CRY_DEX.get(key) ?? null;

const toId = text => text.normalize('NFKD').replace(/♀/g, 'f').replace(/♂/g, 'm').toLowerCase().replace(/[^a-z0-9]/g, '');
const NAMES = [...NAME_DEX].map(([id, dex]) => [toId(id), dex]);
const ID_DEX = new Map(NAMES);

const oneEditApart = (a, b) => {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  if (a.length > b.length) return a.slice(i + 1) === b.slice(i);
  if (a.length < b.length) return a.slice(i) === b.slice(i + 1);
  return a.slice(i + 1) === b.slice(i + 1) || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2));
};

export function folderDex(folder) {
  const id = toId(folder);
  if (!id) return null;
  const exact = ID_DEX.get(id) ?? ID_DEX.get(id.replace(/^\d+/, ''));
  if (exact) return { dex: exact, rank: 0 };
  const near = new Set(NAMES.filter(([name]) => oneEditApart(id, name)).map(([, dex]) => dex));
  return near.size === 1 ? { dex: [...near][0], rank: 200 } : null;
}

const AUDIO_FILE = /^(.*?)([^/]+)\.(wav|ogg|oga|opus|mp3|m4a|aac|flac)$/i;
const TYPES = { wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', flac: 'audio/flac' };

const CHARACTERS = { PIKA: 25, MIJU: 501, TUTA: 495, POKA: 498 };

const STREAM = /^S_(POKE|PIKA|MIJU|TUTA|POKA)_VOICE_streamfiles(?:_(\d+)| \[(\d+)\])$/i;

const TIERS = [VOICES.moments, VOICES.slots ?? {}].map(table => new Map(Object.entries(table).map(([bank, moments]) =>
  [bank, new Map(Object.entries(moments).map(([moment, streams]) => [moment, new Set(streams)]))])));

export function gameStream(file) {
  const found = STREAM.exec(file);
  if (!found) return null;
  const bank = found[1].toUpperCase();
  const bracket = found[2] === undefined ? Number(found[3]) : null;
  const stream = bracket === null ? Number(found[2]) : bracket - 1;
  const dex = bank === 'POKE' ? VOICES.dex[stream] : CHARACTERS[bank];
  return dex ? { bank, stream, bracket, dex } : null;
}

function locate(name, folderOf, besideSpecies) {
  const audio = AUDIO_FILE.exec(name);
  if (!audio) return null;
  const [, dir, file] = audio;
  const stream = gameStream(file);
  if (stream) return { dex: stream.dex, score: [-1, 0], home: `#${stream.bank}` };
  const folders = dir.split('/').slice(0, -1);
  const at = rank => {
    for (let i = folders.length - 1; i >= 0; i--) {
      const found = folderOf(folders[i]);
      if (found?.rank === rank && (rank === 0 || besideSpecies.has(folders.slice(0, i).join('/')))) return { found, i };
    }
    return null;
  };
  const named = at(0);
  if (named) return { dex: named.found.dex, score: [0, folders.length - named.i - 1], home: folders.slice(0, named.i + 1).join('/') };
  const character = CHARACTERS[/^S_([A-Z]+)_VOICE/i.exec(file)?.[1]?.toUpperCase()];
  if (character) return { dex: character, score: [1, 0], home: dir };
  const misspelt = at(200);
  return misspelt ? { dex: misspelt.found.dex, score: [2, folders.length - misspelt.i - 1], home: folders.slice(0, misspelt.i + 1).join('/') } : null;
}
const before = (a, b) => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
};

export function indexVoices(names) {
  const files = [...names].filter(name => !/(?:^|\/)__MACOSX\//i.test(name) && !name.split('/').at(-1).startsWith('._') && AUDIO_FILE.test(name));
  const seen = new Map();
  const folderOf = folder => { if (!seen.has(folder)) seen.set(folder, folderDex(folder)); return seen.get(folder); };
  const besideSpecies = new Set();
  for (const name of files) {
    const folders = name.split('/').slice(0, -1);
    folders.forEach((folder, i) => { if (folderOf(folder)?.rank === 0) besideSpecies.add(folders.slice(0, i).join('/')); });
  }
  const best = new Map();
  for (const name of files) {
    const place = locate(name, folderOf, besideSpecies);
    if (!place) continue;
    const key = [...place.score, place.home.length, place.home];
    const held = best.get(place.dex);
    if (held && held.home === place.home && place.score.every((value, i) => value === held.score[i])) held.names.push(name);
    else if (!held || before(key, held.key)) best.set(place.dex, { key, home: place.home, score: place.score, names: [name] });
  }
  return new Map([...best].map(([dex, { names: found }]) => [dex, found.sort()]));
}

export function momentLines(voices) {
  const found = new Map();
  for (const [dex, names] of voices) {
    const streams = names.map(name => gameStream(AUDIO_FILE.exec(name)[2]));
    const highest = new Map();
    for (const s of streams) if (s?.bracket != null) highest.set(s.bank, Math.max(highest.get(s.bank) ?? 0, s.bracket));
    const tiers = TIERS.map(() => new Map());
    streams.forEach((s, line) => {
      if (!s) return;
      let stream = s.stream;
      const gap = VOICES.bracketGaps?.[s.bank];
      if (s.bracket != null && gap && highest.get(s.bank) === gap.streams - gap.missing.length) {
        for (const missing of gap.missing) if (stream >= missing) stream++;
      }
      TIERS.forEach((tier, i) => {
        for (const [moment, wanted] of tier.get(s.bank) ?? []) {
          if (!wanted.has(stream)) continue;
          if (!tiers[i].has(moment)) tiers[i].set(moment, []);
          tiers[i].get(moment).push(line);
        }
      });
    });
    const lines = new Map();
    for (const tier of tiers) for (const [moment, list] of tier) if (!lines.has(moment)) lines.set(moment, list);
    if (lines.size) found.set(dex, lines);
  }
  return found;
}

const u16 = (b, o) => (b[o] | b[o + 1] << 8) >>> 0;
const u32 = (b, o) => (b[o] | b[o + 1] << 8 | b[o + 2] << 16 | b[o + 3] << 24) >>> 0;
const u64 = (b, o) => u32(b, o) + u32(b, o + 4) * 2 ** 32;
const MAX32 = 0xffffffff;
const bytesOf = async (blob, start, end) => new Uint8Array(await blob.slice(start, end).arrayBuffer());

function endRecord(tail, base, size) {
  const fits = i => base + i + 22 + u16(tail, i + 20) === size;
  const joins = i => {
    const length = u32(tail, i + 12), at = u32(tail, i + 16);
    return (i >= 20 && u32(tail, i - 20) === 0x07064b50) || (at !== MAX32 && length !== MAX32 && at + length === base + i);
  };
  let found = -1, fitting = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (u32(tail, i) !== 0x06054b50) continue;
    if (found < 0) found = i;
    if (!fits(i)) continue;
    if (joins(i)) return i;
    if (fitting < 0) fitting = i;
  }
  return fitting >= 0 ? fitting : found;
}

export async function readZip(blob) {
  const size = blob.size, base = Math.max(0, size - 22 - 0xffff - 20);
  const tail = await bytesOf(blob, base, size);
  const end = endRecord(tail, base, size);
  if (end < 0) throw new Error('Not a zip file');
  let count = u16(tail, end + 10), length = u32(tail, end + 12), at = u32(tail, end + 16);
  if (end >= 20 && u32(tail, end - 20) === 0x07064b50) {
    const record = u64(tail, end - 20 + 8);
    const zip64 = await bytesOf(blob, record, record + 56);
    if (zip64.length === 56 && u32(zip64, 0) === 0x06064b50) { count = u64(zip64, 32); length = u64(zip64, 40); at = u64(zip64, 48); }
  }
  if (at + length > size) throw new Error('Broken zip directory');
  const dir = await bytesOf(blob, at, at + length);
  const entries = new Map(), text = new TextDecoder();
  for (let i = 0, p = 0; i < count && p + 46 <= dir.length && u32(dir, p) === 0x02014b50; i++) {
    const flags = u16(dir, p + 8), method = u16(dir, p + 10);
    let packed = u32(dir, p + 20), local = u32(dir, p + 42);
    const nameLength = u16(dir, p + 28), extraLength = u16(dir, p + 30), commentLength = u16(dir, p + 32);
    // Windows PowerShell 5.1 Compress-Archive writes backslash separators
    const name = text.decode(dir.subarray(p + 46, p + 46 + nameLength)).replaceAll('\\', '/');
    for (let e = p + 46 + nameLength, stop = e + extraLength; e + 4 <= stop; e += 4 + u16(dir, e + 2)) {
      if (u16(dir, e) !== 1) continue;
      const blockEnd = Math.min(stop, e + 4 + u16(dir, e + 2));
      let q = e + 4;
      const take = held => { const value = q + 8 <= blockEnd ? u64(dir, q) : held; q += 8; return value; };
      if (u32(dir, p + 24) === MAX32) take(0);
      if (packed === MAX32) packed = take(packed);
      if (local === MAX32) local = take(local);
    }
    if (!(flags & 1) && !name.endsWith('/')) entries.set(name, { method, size: packed, local });
    p += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

export async function entryBytes(blob, entry) {
  const head = await bytesOf(blob, entry.local, entry.local + 30);
  if (head.length < 30 || u32(head, 0) !== 0x04034b50) throw new Error('Broken zip entry');
  const start = entry.local + 30 + u16(head, 26) + u16(head, 28);
  if (start + entry.size > blob.size) throw new Error('Broken zip entry');
  const data = blob.slice(start, start + entry.size);
  if (entry.method === 0) return new Uint8Array(await data.arrayBuffer());
  if (entry.method !== 8) throw new Error(`Zip compression method ${entry.method}`);
  return new Uint8Array(await new Response(data.stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
}

export async function openVoicePack(blob) {
  const entries = await readZip(blob), urls = new Map();
  const voices = indexVoices([...entries].filter(([, entry]) => entry.method === 0 || entry.method === 8).map(([name]) => name));
  const moments = momentLines(voices);
  return {
    count: voices.size,
    species: () => voices.keys(),
    has: key => voices.has(cryDex(key)),
    variants: key => voices.get(cryDex(key))?.length ?? 0,
    lines: (key, moment) => moments.get(cryDex(key))?.get(moment) ?? [],

    url(key, line = 0) {
      const names = voices.get(cryDex(key));
      if (!names) return Promise.resolve(null);
      const n = Number.isFinite(line) ? Math.trunc(line) : 0;
      const name = names[((n % names.length) + names.length) % names.length];
      if (!urls.has(name)) {
        const type = TYPES[name.split('.').at(-1).toLowerCase()] ?? '';
        urls.set(name, entryBytes(blob, entries.get(name)).then(data => URL.createObjectURL(new Blob([data], { type })),
          error => { urls.delete(name); throw error; }));
      }
      return urls.get(name);
    },
  };
}

export function combineVoicePacks(packs) {
  const list = packs.filter(pack => pack?.count);
  if (!list.length) return null;
  const owners = key => list.filter(pack => pack.has(key));
  const all = () => new Set(list.flatMap(pack => [...pack.species()]));
  return {
    count: all().size,
    species: () => all().values(),
    has: key => owners(key).length > 0,
    variants: key => owners(key)[0]?.variants(key) ?? 0,
    lines: (key, moment) => owners(key)[0]?.lines?.(key, moment) ?? [],
    async url(key, line = 0) {
      let failure = null;
      for (const pack of owners(key)) {
        try {
          const url = await pack.url(key, line);
          if (url) return url;
        } catch (error) { failure ??= error; }
      }
      if (failure) throw failure;
      return null;
    },
  };
}
