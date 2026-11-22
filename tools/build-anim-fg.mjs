// Gen 8 / Gen 9 move animation project. Credits: view/LICENSE-NOTE.md.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { essentialsAnims } from './essentials-anim.mjs';

const ROOT = new URL('../', import.meta.url);
const VENDOR = new URL('vendor/pokerogue/assets/', ROOT);
const OUT = new URL('view/anims/foregrounds.js', ROOT);

export const LOST = ['aromatherapy', 'aromatic-mist', 'aurora-veil', 'blast-burn', 'blizzard', 'brutal-swing', 'catastropika', 'common-misty-terrain',
  'common-strong-winds', 'core-enforcer', 'dazzling-gleam', 'earthquake', 'explosion', 'feint', 'flash', 'haze', 'heat-wave', 'hurricane',
  'ion-deluge', 'jungle-healing', 'meteor-beam', 'mind-blown', 'mist', 'mist-ball', 'misty-explosion', 'misty-terrain', 'moonblast',
  'ominous-wind', 'origin-pulse', 'petal-blizzard', 'present', 'pulverizing-pancake', 'retaliate', 'searing-shot', 'seed-flare', 'seismic-toss',
  'shell-trap', 'sinister-arrow-raid', 'skitter-smack', 'solar-beam', 'steam-eruption', 'surf', 'thunder', 'thunderbolt', 'transform'];

export const TOP_LAYER_0_0_9 = ['light-that-burns-the-sky', 'blood-moon'];

const ALIGN = { 'light-that-burns-the-sky': { offset: 0, sameKinds: [54, 55] } };

const noPng = s => String(s ?? '').replace(/\.png$/i, '');
const cel = c => `${c[7] === -1 ? 'u' : c[7] === -2 ? 't' : `e${c[7]}/${c[8] ?? 0}`}`; // pack cel: user / target copy, or effect cell / opacity
const vcel = c => `${c.target === 0 ? 'u' : c.target === 1 ? 't' : `e${c.graphicFrame ?? 0}/${c.opacity ?? 0}`}`;
const packFrames = a => (a['@array'] ?? []).map(fr => (fr ?? []).filter(Boolean).map(cel).join(','));
const vendorFrames = v => v.frames.map(fr => fr.map(vcel).join(','));
const hasEffect = sig => /e/.test(sig);

function packIds(file) {
  if (file.startsWith('common-')) return [`Common:${file.slice(7).split('-').map(s => s[0].toUpperCase() + s.slice(1)).join('')}`];
  const id = file.replace(/-/g, '').toUpperCase();
  return [`Move:${id}`, `OppMove:${id}`];
}

/** One Essentials foreground timing -> our table entry (nil fields left out) */
function fgEntry(t) {
  const set = t['@timingType'] === 3, out = { f: t['@frame'] ?? 0 };
  if (set) out.set = noPng(t['@name']);
  for (const [from, to] of [['@bgX', 'x'], ['@bgY', 'y'], ['@opacity', 'o']]) if (t[from] != null) out[to] = t[from];
  if (!set) out.d = t['@duration'] ?? 0;
  const c = ['@colorRed', '@colorGreen', '@colorBlue', '@colorAlpha'].map(k => t[k] ?? null);
  if (c.some(v => v !== null)) out.c = c;
  if (t['@flashScope']) throw new Error(`flash on a foreground timing (frame ${out.f}) - not handled`);
  return out;
}

function mismatch(vendor, a, { offset = 1, sameKinds = [] } = {}) {
  if (noPng(a['@graphic']) !== (vendor.graphic ?? '')) return `effect graphic ${vendor.graphic || '(none)'} vs pack ${noPng(a['@graphic']) || '(none)'}`;
  const p = packFrames(a).slice(offset), v = vendorFrames(vendor);
  const kinds = sig => sig.replace(/e\d+\//g, 'e/');
  for (let f = 0; f < Math.max(p.length, v.length); f++) {
    if (f >= p.length || f >= v.length) {
      if (hasEffect(p[f] ?? v[f])) return `frame ${f}: only in the ${f < v.length ? 'vendor' : 'pack'}, with effect cels`;
    } else if (p[f] !== v[f] && !(sameKinds.includes(f) && kinds(p[f]) === kinds(v[f]))) return `frame ${f}: cels differ`;
  }
  const timings = a['@timing'] ?? [];
  const sounds = list => list.sort((x, y) => x - y).join(',');
  const vEvents = Object.values(vendor.frameTimedEvents ?? {}).flat();
  const vs = sounds(vEvents.filter(e => e.eventType === 'AnimTimedSoundEvent').map(e => e.frameIndex));
  const ps = sounds(timings.filter(t => (t['@timingType'] ?? 0) === 0).map(t => t['@frame'] ?? 0));
  if (vs !== ps) return `sound frames ${vs} vs pack ${ps}`;
  const vSets = vEvents.filter(e => e.eventType === 'AnimTimedAddBgEvent');
  const pSets = timings.filter(t => t['@timingType'] === 1);
  if (vSets.length !== pSets.length || vSets.some(e => !pSets.some(t => t['@frame'] === e.frameIndex && (!e.resourceName || noPng(t['@name']) === e.resourceName)))) {
    return `background sets ${vSets.map(e => `${e.frameIndex}:${e.resourceName}`).join(' ')} vs pack ${pSets.map(t => `${t['@frame']}:${noPng(t['@name'])}`).join(' ')}`;
  }
  return null;
}

function bgNotes(vendor, a) {
  const pm = (a['@timing'] ?? []).filter(t => t['@timingType'] === 2).map(t => `${t['@frame']}+${t['@duration']}`).sort().join(' ');
  const vm = Object.values(vendor.frameTimedEvents ?? {}).flat().filter(e => e.eventType === 'AnimTimedUpdateBgEvent').map(e => `${e.frameIndex}+${e.duration}`).sort().join(' ');
  return pm === vm ? null : `background move timings differ: vendor ${vm} / pack ${pm}`;
}

export function buildForegrounds(packBuffer) {
  const anims = essentialsAnims(packBuffer);
  const byName = new Map(anims.map(a => [a['@name'], a]));
  const table = {}, skipped = [], notes = [];
  for (const file of [...LOST, ...TOP_LAYER_0_0_9]) {
    const vendor = JSON.parse(readFileSync(new URL(`battle-anims/${file}.json`, VENDOR), 'utf8'));
    const variants = [vendor].flat();
    const [own, opp] = packIds(file).map(id => byName.get(id));
    const out = variants.map((v, index) => {
      const a = index === 1 ? (opp ?? own) : own;
      const skip = reason => { skipped.push({ file: `${file}.json`, variant: index, reason }); return null; };
      if (!a) return skip('no pack animation');
      const fg = (a['@timing'] ?? []).filter(t => t['@timingType'] === 3 || t['@timingType'] === 4);
      if (!fg.length) return skip(`${a['@name']} has no foreground`);
      const why = mismatch(v, a, ALIGN[file]);
      if (why) return skip(`${a['@name']}: ${why}`);
      const entries = fg.map(fgEntry);
      const missing = [...new Set(entries.filter(e => e.set).map(e => e.set))].filter(name => !existsSync(new URL(`images/battle_anims/${name}.png`, VENDOR)));
      if (missing.length) return skip(`${a['@name']}: picture not in PokeRogue: ${missing.join(', ')}`);
      const note = bgNotes(v, a);
      if (note) notes.push({ file: `${file}.json`, variant: index, note });
      return entries;
    });
    if (out.some(Boolean)) table[`${file}.json`] = out;
  }
  return { table, skipped, notes };
}

const HEAD = `// Credits: view/LICENSE-NOTE.md.

`;

export function render({ table }) {
  const lines = Object.entries(table).map(([file, variants]) => `  '${file}': [\n${variants.map(v => (v ? `    [\n${v.map(e => `      ${JSON.stringify(e)},`).join('\n')}\n    ],` : '    null,')).join('\n')}\n  ],`);
  return `${HEAD}export const FOREGROUNDS = {\n${lines.join('\n')}\n};\n`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [pack, flag] = process.argv.slice(2);
  if (!pack) { console.error('usage: node tools/build-anim-fg.mjs <PkmnAnimations.rxdata> [--check]'); process.exit(1); }
  const result = buildForegrounds(readFileSync(pack));
  const text = render(result);
  const variants = Object.values(result.table).flat().filter(Boolean).length;
  console.log(`${Object.keys(result.table).length} files, ${variants} variants with a foreground`);
  for (const s of result.skipped) console.log(`skipped ${s.file}[${s.variant}]: ${s.reason}`);
  for (const n of result.notes) console.log(`note ${n.file}[${n.variant}]: ${n.note}`);
  if (flag === '--check') {
    const same = existsSync(OUT) && readFileSync(OUT, 'utf8') === text;
    console.log(same ? 'view/anims/foregrounds.js is up to date' : 'view/anims/foregrounds.js differs');
    process.exitCode = same ? 0 : 1;
  } else writeFileSync(OUT, text);
}
