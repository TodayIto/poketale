// Gen 8 / Gen 9 move animation project. Credits: view/LICENSE-NOTE.md.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { essentialsAnims, convertAnim } from './essentials-anim.mjs';
import { entry as bgEntry } from './build-anim-tints.mjs';

const ROOT = new URL('../', import.meta.url);
const VENDOR = new URL('vendor/pokerogue/assets/', ROOT);
const PACK = new URL('view/anims/pack/', ROOT);
export const OUT = new URL('view/anims/z/', ROOT);

export const Z_ANIMS = [
  // the 18 type Z-moves (0.1.0 Z step 2a)
  'breakneck-blitz', 'inferno-overdrive', 'hydro-vortex', 'gigavolt-havoc', 'bloom-doom', 'subzero-slammer', 'all-out-pummeling',
  'acid-downpour', 'tectonic-rage', 'supersonic-skystrike', 'shattered-psyche', 'savage-spin-out', 'continental-crush',
  'never-ending-nightmare', 'devastating-drake', 'black-hole-eclipse', 'corkscrew-crash', 'twinkle-tackle',

  'stoked-sparksurfer', 'malicious-moonsault', 'guardian-of-alola', 'soul-stealing-7-star-strike', 'clangorous-soulblaze',
  'splintered-stormshards', 'lets-snuggle-forever', 'genesis-supernova', 'searing-sunraze-smash', 'menacing-moonraze-maelstrom',

  'guardian-of-alola-lele', 'guardian-of-alola-bulu', 'guardian-of-alola-fini',
];
export const PACK_IDS = {};
/** Files made from a pack animation of another name (not Move:<ID>, one-way) */
export const PACK_NAMES = {
  'guardian-of-alola-lele': 'Guardian of Alola Lele', 'guardian-of-alola-bulu': 'Guardian of Alola Bulu', 'guardian-of-alola-fini': 'Guardian of Alola Fini',
};
const packId = file => PACK_IDS[file] ?? file.replace(/-/g, '').toUpperCase();

export const SOUND_SUBSTITUTES = {

  'PRSFX- Twinkle Tackle4': 'PRSFX- Moonblast2.wav',
  'PRSFX- Twinkle Tackle5': 'PRSFX- Moonblast2.wav',
};

const mapCels = (v, fn) => ({ ...v, frames: v.frames.map(frame => frame.flatMap(cel => fn(cel) ?? [])) });

export const FIXES = {

  'supersonic-skystrike': v => mapCels(v, cel => (cel.target === 2 && cel.graphicFrame === 1 ? null : cel)),

  'continental-crush': v => mapCels(v, cel => (cel.target === 2 && cel.graphicFrame === 25
    ? { ...cel, graphicFrame: 0, zoomX: cel.zoomX * 1.8, zoomY: cel.zoomY * 1.8 } : cel)),

  'stoked-sparksurfer': v => mapCels(v, cel => {
    if (cel.target !== 2 || (cel.graphicFrame ?? 0) < 65) return cel;
    const g = cel.graphicFrame;
    if ((g >= 75 && g <= 77) || (g >= 80 && g <= 82) || (g >= 85 && g <= 87) || (g >= 90 && g <= 92) || (g >= 95 && g <= 97) || g >= 100) return null;
    const to = { 93: 50, 94: 50, 98: 50, 99: 50, 71: 51, 72: 51, 79: 20, 83: 21, 84: 22, 88: 23, 73: 45, 74: 47, 78: 45 }[g];
    if (to === undefined) throw new Error(`stoked-sparksurfer: no stand-in for cell ${g}`);
    return g === 71 || g === 72 ? { ...cel, graphicFrame: to, zoomX: (cel.zoomX ?? 100) * 2, zoomY: (cel.zoomY ?? 100) * 2 } : { ...cel, graphicFrame: to };
  }),
};

const CELL = 96; // PokeRogue's battle_anims sheet cell (the pack's 192 at half size)
const SOUND_EXT = ['.wav', '.m4a', '.mp3', '.ogg', '.WAV'];
const noExt = s => String(s ?? '').replace(/\.(wav|ogg|mp3|m4a|png)$/i, '');
const exists = (base, rel) => existsSync(new URL(rel.split('/').map(encodeURIComponent).join('/'), base));
const fileUrl = (base, rel) => new URL(rel.split('/').map(encodeURIComponent).join('/'), base);

/** png size without decoding */
function pngSize(url) {
  const b = readFileSync(url);
  if (b.toString('latin1', 1, 4) !== 'PNG') throw new Error(`not a PNG: ${url.pathname}`);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

function picture(name) {
  if (exists(VENDOR, `images/battle_anims/${name}.png`)) return { name, source: 'pokerogue', size: pngSize(fileUrl(VENDOR, `images/battle_anims/${name}.png`)) };
  if (exists(PACK, `images/${name}.png`)) {
    const { width, height } = pngSize(fileUrl(PACK, `images/${name}.png`));
    return { name, source: 'pack', size: { width: Math.floor(width / 2), height: Math.floor(height / 2) } };
  }
  throw new Error(`picture in neither PokeRogue nor the pack: ${name}`);
}

function sound(name) {
  if (!name) return { file: '', source: 'cry' };
  const base = noExt(name);
  const pr = SOUND_EXT.map(ext => base + ext).find(f => exists(VENDOR, `audio/battle_anims/${f}`));
  if (pr) return { file: pr, source: 'pokerogue' };
  if (exists(PACK, `audio/${base}.ogg`)) return { file: `${base}.m4a`, source: 'pack', from: `${base}.ogg` };
  const sub = SOUND_SUBSTITUTES[base];
  if (sub && exists(VENDOR, `audio/battle_anims/${sub}`)) return { file: sub, source: 'pokerogue', substitute: base };
  throw new Error(`sound in neither PokeRogue nor the pack, and no substitute: ${name}`);
}

function withOriginalBackground(a) {
  const v = convertAnim(a);
  const bg = (a['@timing'] ?? []).filter(t => t['@timingType'] === 1 || t['@timingType'] === 2).map(bgEntry);
  const frameTimedEvents = {};
  for (const [f, list] of Object.entries(v.frameTimedEvents)) {
    const kept = list.filter(e => e.eventType !== 'AnimTimedAddBgEvent' && e.eventType !== 'AnimTimedUpdateBgEvent');
    if (kept.length) frameTimedEvents[f] = kept;
  }
  return bg.length ? { ...v, frameTimedEvents, bg } : { ...v, frameTimedEvents };
}

function resolve(file, v, uses) {
  const out = { ...v, frameTimedEvents: {} };
  for (const e of v.bg ?? []) if (e.set) uses.pictures.set(e.set, picture(e.set));
  if (v.graphic) {
    const pic = picture(v.graphic);
    uses.pictures.set(pic.name, pic);
    const cells = Math.floor(pic.size.width / CELL) * Math.floor(pic.size.height / CELL);
    const past = new Map(); // cell -> frames
    v.frames.forEach((frame, f) => frame.forEach(c => { if (c.target === 2 && (c.graphicFrame ?? 0) >= cells) past.set(c.graphicFrame, [...(past.get(c.graphicFrame) ?? []), f]); }));
    for (const [cell, frames] of past) uses.problems.push(`${file}: cell ${cell} past the ${cells} cells of ${pic.name} (${pic.source}), frames ${frames[0]}-${frames.at(-1)} (${frames.length} cels)`);
  }
  for (const [f, list] of Object.entries(v.frameTimedEvents)) {
    out.frameTimedEvents[f] = list.map(e => {
      if (e.eventType === 'AnimTimedSoundEvent') {
        const s = sound(e.resourceName);
        if (s.source !== 'cry') uses.sounds.set(s.file, s);
        if (s.substitute) uses.substitutes.add(`${s.substitute} -> ${s.file}`);
        return { ...e, resourceName: s.file };
      }
      if (e.flashScope) throw new Error(`${file}: screen flash on a background timing (frame ${f}) - not handled by the player`);
      if (e.resourceName) uses.pictures.set(e.resourceName, picture(e.resourceName));
      return e;
    });
  }
  return out;
}

export function buildZAnims(packBuffer, files = Z_ANIMS) {
  const all = essentialsAnims(packBuffer);
  const byName = new Map(all.map(a => [a['@name'], a]));
  const uses = { pictures: new Map(), sounds: new Map(), substitutes: new Set(), problems: [] };
  const anims = {}, notes = [];
  for (const file of files) {
    const id = packId(file), own = byName.get(PACK_NAMES[file] ?? `Move:${id}`), opp = PACK_NAMES[file] ? undefined : byName.get(`OppMove:${id}`);
    if (!own) throw new Error(`no ${PACK_NAMES[file] ?? `Move:${id}`} in the pack`);
    const variants = (opp ? [own, opp] : [own]).map(withOriginalBackground)
      .map((v, index) => (FIXES[file] ? FIXES[file](v, index) : v)).map(v => resolve(file, v, uses));
    anims[file] = opp ? variants : variants[0];
    notes.push(`${file}: ${variants.map(v => `${v.graphic} ${v.frames.length}f`).join(' / ')}${opp ? '' : ' (one-way)'}`);
  }
  if (uses.problems.length) throw new Error(`cells the pictures do not have (add a FIXES entry):\n${uses.problems.join('\n')}`);
  return { anims, ...uses, notes };
}

export function renderAnim(anim) {
  const one = v => {
    const { frames, frameTimedEvents, bg, ...rest } = v;
    const head = Object.entries(rest).map(([k, x]) => `${JSON.stringify(k)}:${JSON.stringify(x)}`).join(',');
    const events = Object.entries(frameTimedEvents).map(([f, list]) => `  ${JSON.stringify(f)}:${JSON.stringify(list)}`).join(',\n');
    const background = bg ? `,\n"bg":[\n${bg.map(e => `  ${JSON.stringify(e)}`).join(',\n')}\n]` : '';
    return `{${head},\n"frames":[\n${frames.map(fr => `  ${JSON.stringify(fr)}`).join(',\n')}\n],\n"frameTimedEvents":{\n${events}\n}${background}}`;
  };
  return `${Array.isArray(anim) ? `[${anim.map(one).join(',\n')}]` : one(anim)}\n`;
}

async function halve(src, dst) {
  const { default: sharp } = await import('sharp');
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = Math.floor(info.width / 2), h = Math.floor(info.height / 2), out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const i = ((2 * y + dy) * info.width + 2 * x + dx) * 4, al = data[i + 3];
      r += data[i] * al; g += data[i + 1] * al; b += data[i + 2] * al; a += al;
    }
    const o = (y * w + x) * 4;
    if (a) { out[o] = Math.round(r / a); out[o + 1] = Math.round(g / a); out[o + 2] = Math.round(b / a); out[o + 3] = Math.round(a / 4); }
  }

  const raw = { raw: { width: w, height: h, channels: 4 } };
  const palette = await sharp(out, raw).png({ palette: true, quality: 100, colours: 256, dither: 0, effort: 10, compressionLevel: 9 }).toBuffer();
  const back = await sharp(palette).ensureAlpha().raw().toBuffer();
  let worst = 0;
  for (let i = 0; i < out.length; i += 4) for (let k = 0; k < 4; k++) {
    const a = k < 3 ? (out[i + k] * out[i + 3]) / 255 : out[i + 3], b = k < 3 ? (back[i + k] * back[i + 3]) / 255 : back[i + 3];
    worst = Math.max(worst, Math.abs(a - b));
  }
  if (worst <= PALETTE_MAX_STEP) writeFileSync(dst, palette);
  else await sharp(out, raw).png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(dst);
}
const PALETTE_MAX_STEP = 8; // largest change of a visible (alpha-weighted) channel a palette may make

function toM4a(src, dst) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-map_metadata', '-1', '-ac', '1', '-c:a', 'aac', '-b:a', '40k', '-movflags', '+faststart', dst]);
}

const folderFiles = dir => (existsSync(dir) ? readdirSync(dir) : []);

if (import.meta.url === `file://${process.argv[1]}`) {
  const [pack, flag] = process.argv.slice(2);
  if (!pack) { console.error('usage: node tools/build-anim-z.mjs <PkmnAnimations.rxdata> [--check]'); process.exit(1); }
  const result = buildZAnims(readFileSync(pack));
  for (const n of result.notes) console.log(n);
  const packPictures = [...result.pictures.values()].filter(p => p.source === 'pack').map(p => `${p.name}.png`).sort();
  const packSounds = [...result.sounds.values()].filter(s => s.source === 'pack').sort((a, b) => a.file.localeCompare(b.file));
  console.log(`pictures: ${result.pictures.size} (${packPictures.length} from the pack: ${packPictures.join(', ')})`);
  console.log(`sounds: ${result.sounds.size} (${packSounds.length} from the pack)`);
  for (const s of result.substitutes) console.log(`substitute sound: ${s}`);
  const images = new URL('images/', OUT), audio = new URL('audio/', OUT);
  if (flag === '--check') {
    let bad = 0;
    for (const [file, anim] of Object.entries(result.anims)) {
      const path = new URL(`${file}.json`, OUT);
      if (!existsSync(path) || readFileSync(path, 'utf8') !== renderAnim(anim)) { console.log(`differs: view/anims/z/${file}.json`); bad++; }
    }
    const want = new Set([...packPictures.map(f => `images/${f}`), ...packSounds.map(s => `audio/${s.file}`)]);
    const have = new Set([...folderFiles(images).map(f => `images/${f}`), ...folderFiles(audio).map(f => `audio/${f}`)]);
    for (const f of want) if (!have.has(f)) { console.log(`missing: view/anims/z/${f}`); bad++; }
    for (const f of have) if (!want.has(f)) { console.log(`not used: view/anims/z/${f}`); bad++; }

    const extra = folderFiles(OUT).filter(f => f.endsWith('.json') && !f.startsWith('g-max-') && !Object.hasOwn(result.anims, f.slice(0, -5)));
    for (const f of extra) { console.log(`not made by the tool: view/anims/z/${f}`); bad++; }
    console.log(bad ? `${bad} problem(s)` : 'view/anims/z is up to date');
    process.exitCode = bad ? 1 : 0;
  } else {
    mkdirSync(images, { recursive: true }); mkdirSync(audio, { recursive: true });
    for (const [file, anim] of Object.entries(result.anims)) writeFileSync(new URL(`${file}.json`, OUT), renderAnim(anim));
    // only what the anims use (a picture or sound no longer used is removed)
    for (const f of folderFiles(images)) if (!packPictures.includes(f)) rmSync(fileUrl(images, f));
    for (const f of folderFiles(audio)) if (!packSounds.some(s => s.file === f)) rmSync(fileUrl(audio, f));
    for (const f of packPictures) await halve(fileURLToPath(fileUrl(PACK, `images/${f}`)), fileURLToPath(fileUrl(images, f)));
    for (const s of packSounds) toM4a(fileURLToPath(fileUrl(PACK, `audio/${s.from}`)), fileURLToPath(fileUrl(audio, s.file)));
  }
}
