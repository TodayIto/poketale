import { ANIMS_GZ_B64, ANIM_FILES, ANIM_ENDS } from 'embedded:anims';
import { decodeAnim } from './codec.js';
import { entry } from '../../names/index.js';

const INDEX = new Map();
{
  let i = 0;
  ANIM_FILES.split(';').forEach((names, chunk) => {
    let start = 0;
    for (const name of names.split(',')) {
      const end = ANIM_ENDS[i++];
      INDEX.set(`${name}.json`, [chunk, start, end]);
      start = end;
    }
  });
}
const KEEP = 8;
const chunks = new Map();
const decoder = new TextDecoder();
let all;

function inflate(chunk) {
  const packed = Uint8Array.from(atob(ANIMS_GZ_B64[chunk]), c => c.charCodeAt(0));
  return new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer().then(buffer => new Uint8Array(buffer));
}

function inflated(chunk) {
  let bytes = chunks.get(chunk);
  if (bytes) chunks.delete(chunk);
  else {
    bytes = inflate(chunk);
    bytes.catch(() => { if (chunks.get(chunk) === bytes) chunks.delete(chunk); });
  }
  chunks.set(chunk, bytes);
  while (chunks.size > KEEP) chunks.delete(chunks.keys().next().value);
  return bytes;
}

const decode = (bytes, start, end) => decodeAnim(JSON.parse(decoder.decode(bytes.subarray(start, end))));

export function hasAnimation(file) { return INDEX.has(file); }

export function animation(file) {
  if (all) return all.then(data => data[file]);
  const at = INDEX.get(file);
  if (!at) return Promise.resolve(undefined);
  const [chunk, start, end] = at;
  const t0 = globalThis.performance?.now?.();
  return inflated(chunk).then(bytes => {
    const anim = decode(bytes, start, end);
    globalThis.performance?.measure?.(`pb:anim:${file}`, { start: t0 });
    return anim;
  });
}

export function animationData() {
  return all ??= Promise.all(ANIMS_GZ_B64.map((_, chunk) => inflate(chunk))).then(bytes => {
    const data = {};
    for (const [file, [chunk, start, end]] of INDEX) data[file] = decode(bytes[chunk], start, end);
    return data;
  }).catch(error => { all = undefined; throw error; });
}

export const TYPE_FALLBACK = Object.freeze({
  Normal: 'tackle', Fire: 'ember', Water: 'water-gun', Electric: 'thunderbolt',
  Grass: 'vine-whip', Ice: 'ice-beam', Fighting: 'mach-punch', Poison: 'sludge',
  Ground: 'mud-slap', Flying: 'gust', Psychic: 'confusion', Bug: 'bug-bite',
  Rock: 'rock-throw', Ghost: 'shadow-ball', Dragon: 'dragon-breath', Dark: 'bite',
  Steel: 'metal-claw', Fairy: 'fairy-wind', Stellar: 'tackle',
});

// With data, checks that table; otherwise checks the embedded bundle list for the file.
export function moveFile(id, data) {
  const record = entry('moves', id);
  if (record?.anim && (data ? data[record.anim] : hasAnimation(record.anim))) return record.anim;
  return `${TYPE_FALLBACK[record?.type] ?? TYPE_FALLBACK.Normal}.json`;
}

export const chargeFile = id => moveFile(id).replace(/\.json$/, '-charging.json');
