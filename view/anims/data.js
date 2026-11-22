import { ANIMS_GZ_B64, ANIM_FILES, ANIM_ENDS, ANIM_OWN } from 'embedded:anims';
import { decodeAnim } from './codec.js';
import { normalizeAnim } from './background.js';
import { withBgNames } from './bg-names.js';
import { withForegrounds, withFrontBackgrounds } from './foreground.js';
import { engineFrames } from './bg-engine.js';
import { entry, toID } from '../../names/index.js';

const INDEX = new Map(); // file name -> [chunk, start, end]
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

const OWN = new Set(ANIM_OWN ? ANIM_OWN.split(',').map(name => `${name}.json`) : []);
const OWN_BY_MOVE = new Map([...OWN].map(file => [toID(file.slice(0, -5)), file]));
export const isOwnAnimation = file => OWN.has(file);

const ownBackground = anim => {
  const one = v => (v?.bg ? { ...v, bgFrames: engineFrames({ n: v.frames.length, bg: v.bg }) } : v);
  return Array.isArray(anim) ? anim.map(one) : one(anim);
};
const KEEP = 8;
const chunks = new Map();

const DECODED_KEEP = 64;
const decoded = new Map(); // file name -> Promise<anim>
const decoder = new TextDecoder();
let all;

function inflate(chunk) {

  const binary = atob(ANIMS_GZ_B64[chunk]);
  const packed = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) packed[index] = binary.charCodeAt(index);
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

const decode = (file, bytes, start, end) => {
  const anim = decodeAnim(JSON.parse(decoder.decode(bytes.subarray(start, end))));
  return OWN.has(file) ? ownBackground(anim) : withFrontBackgrounds(file, withForegrounds(file, withBgNames(file, normalizeAnim(anim, file))));
};

export function hasAnimation(file) { return INDEX.has(file); }

export function animation(file) {
  if (all) return all.then(data => data[file]);
  const at = INDEX.get(file);
  if (!at) return Promise.resolve(undefined);
  const hit = decoded.get(file);
  if (hit) { decoded.delete(file); decoded.set(file, hit); return hit; }
  const [chunk, start, end] = at;
  const t0 = globalThis.performance?.now?.();
  const work = inflated(chunk).then(bytes => {
    const anim = decode(file, bytes, start, end);
    globalThis.performance?.measure?.(`pb:anim:${file}`, { start: t0 }); // tools/measure-plugin.mjs
    return anim;
  });
  decoded.set(file, work);
  while (decoded.size > DECODED_KEEP) decoded.delete(decoded.keys().next().value);
  work.catch(() => { if (decoded.get(file) === work) decoded.delete(file); });
  return work;
}

export function animationData() {
  return all ??= Promise.all(ANIMS_GZ_B64.map((_, chunk) => inflate(chunk))).then(bytes => {
    const data = {};
    for (const [file, [chunk, start, end]] of INDEX) data[file] = decode(file, bytes[chunk], start, end);
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

const BY_USER = {
  guardianofalola: { tapulele: 'guardian-of-alola-lele.json', tapubulu: 'guardian-of-alola-bulu.json', tapufini: 'guardian-of-alola-fini.json' },
};

const BORROWED = Object.freeze({
  '10000000voltthunderbolt': 'gigavolt-havoc.json',

  maxflutterby: 'savage-spin-out.json',
  maxdarkness: 'black-hole-eclipse.json',
  maxwyrmwind: 'devastating-drake.json',
  maxlightning: 'gigavolt-havoc.json',
  maxstarfall: 'twinkle-tackle.json',
  maxknuckle: 'all-out-pummeling.json',
  maxflare: 'inferno-overdrive.json',
  maxairstream: 'supersonic-skystrike.json',
  maxphantasm: 'never-ending-nightmare.json',
  maxovergrowth: 'bloom-doom.json',
  maxquake: 'tectonic-rage.json',
  maxhailstorm: 'subzero-slammer.json',
  maxguard: 'protect.json',
  maxstrike: 'breakneck-blitz.json',
  maxooze: 'acid-downpour.json',
  maxmindstorm: 'shattered-psyche.json',
  maxrockfall: 'continental-crush.json',
  maxsteelspike: 'corkscrew-crash.json',
  maxgeyser: 'hydro-vortex.json',

  gmaxvoltcrash: 'catastropika.json', gmaxcuddle: 'extreme-evoboost.json', gmaxreplenish: 'pulverizing-pancake.json',

  gmaxterror: 'soul-stealing-7-star-strike.json', gmaxgravitas: 'genesis-supernova.json', gmaxfinale: 'lets-snuggle-forever.json',
  gmaxsmite: 'guardian-of-alola.json', gmaxvolcalith: 'splintered-stormshards.json', gmaxstunshock: 'gigavolt-havoc.json',

  gmaxstonesurge: 'g-max-foam-burst.json',
});

export function moveFile(id, data, user) {
  const record = entry('moves', id);
  const has = file => (data ? !!data[file] : hasAnimation(file));
  const mine = user && BY_USER[toID(id)]?.[toID(user)];
  if (mine && has(mine)) return mine;
  if (record?.anim && has(record.anim)) return record.anim;
  const own = OWN_BY_MOVE.get(toID(id));
  if (own && has(own)) return own;
  const borrowed = BORROWED[toID(id)];
  if (borrowed && has(borrowed)) return borrowed;
  return `${TYPE_FALLBACK[record?.type] ?? TYPE_FALLBACK.Normal}.json`;
}

/** Every anim file a move can play, whoever uses it (warm-up) */
export const userMoveFiles = id => [moveFile(id), ...Object.values(BY_USER[toID(id)] ?? {})];

export const chargeFile = id => moveFile(id).replace(/\.json$/, '-charging.json');
