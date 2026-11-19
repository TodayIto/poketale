import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { essentialsAnims } from './essentials-anim.mjs';

const ROOT = new URL('../', import.meta.url);
const VENDOR = new URL('vendor/pokerogue/assets/', ROOT);
const OUT = new URL('view/anims/tints.js', ROOT);

export const FILES = ['mega-drain', 'energy-ball', 'overheat', 'light-that-burns-the-sky', 'petal-dance', 'blood-moon', 'aurora-veil', 'natures-madness',
  'detect', 'disable', 'final-gambit', 'hypnosis', 'night-daze', 'nightmare', 'scary-face', 'shadow-sneak', 'hurricane', 'common-strong-winds'];

const noPng = s => String(s ?? '').replace(/\.png$/i, '');

function packIds(file) {
  if (file.startsWith('common-')) return [`Common:${file.slice(7).split('-').map(s => s[0].toUpperCase() + s.slice(1)).join('')}`];
  const id = file.replace(/-/g, '').toUpperCase();
  return [`Move:${id}`, `OppMove:${id}`];
}

function entry(t) {
  const set = t['@timingType'] === 1, out = { f: t['@frame'] ?? 0 };
  if (set) out.set = noPng(t['@name']);
  else out.d = t['@duration'] ?? 0;
  for (const [from, to] of [['@bgX', 'x'], ['@bgY', 'y'], ['@opacity', 'o']]) if (t[from] != null) out[to] = t[from];
  const c = ['@colorRed', '@colorGreen', '@colorBlue', '@colorAlpha'].map(k => t[k] ?? null);
  if (c.some(v => v !== null)) out.c = c;
  if (t['@flashScope']) throw new Error(`flash on a background timing (frame ${out.f}) - not handled`);
  return out;
}

function mismatch(vendor, a) {
  if (noPng(a['@graphic']) !== (vendor.graphic ?? '')) return `effect graphic ${vendor.graphic || '(none)'} vs pack ${noPng(a['@graphic']) || '(none)'}`;
  const n = (a['@array'] ?? []).length;
  if (n !== vendor.frames.length && n !== vendor.frames.length + 1) return `${vendor.frames.length} frames vs pack ${n}`;
  const timings = a['@timing'] ?? [];
  const events = Object.values(vendor.frameTimedEvents ?? {}).flat();
  const list = xs => xs.sort((x, y) => x - y).join(',');
  const vs = list(events.filter(e => e.eventType === 'AnimTimedSoundEvent').map(e => e.frameIndex));
  const ps = list(timings.filter(t => (t['@timingType'] ?? 0) === 0).map(t => t['@frame'] ?? 0));
  if (vs !== ps) return `sound frames ${vs} vs pack ${ps}`;
  const vSets = events.filter(e => e.eventType === 'AnimTimedAddBgEvent');
  const pSets = timings.filter(t => t['@timingType'] === 1);
  if (vSets.length !== pSets.length || vSets.some(e => !pSets.some(t => t['@frame'] === e.frameIndex && (!e.resourceName || noPng(t['@name']) === e.resourceName)))) {
    return `background sets ${vSets.map(e => `${e.frameIndex}:${e.resourceName}`).join(' ')} vs pack ${pSets.map(t => `${t['@frame']}:${noPng(t['@name'])}`).join(' ')}`;
  }
  return null;
}

export function buildTints(packBuffer) {
  const anims = essentialsAnims(packBuffer);
  const byName = new Map(anims.map(a => [a['@name'], a]));
  const table = {};
  for (const file of FILES) {
    const vendor = JSON.parse(readFileSync(new URL(`battle-anims/${file}.json`, VENDOR), 'utf8'));
    const [own, opp] = packIds(file).map(id => byName.get(id));
    table[`${file}.json`] = [vendor].flat().map((v, index) => {
      const a = index === 1 ? (opp ?? own) : own;
      if (!a) throw new Error(`${file}[${index}]: no pack animation`);
      const why = mismatch(v, a);
      if (why) throw new Error(`${file}[${index}] vs ${a['@name']}: ${why}`);
      const bg = (a['@timing'] ?? []).filter(t => t['@timingType'] === 1 || t['@timingType'] === 2).map(entry);
      const missing = bg.filter(e => e.set && !existsSync(new URL(`images/battle_anims/${e.set}.png`, VENDOR))).map(e => e.set);
      if (missing.length) throw new Error(`${file}[${index}]: picture not in PokeRogue: ${missing.join(', ')}`);
      return { n: a['@array'].length, bg };
    });
  }
  return table;
}

const HEAD = "// Generated background timings from the Gen 8 / Gen 9 move animation project.\n// Credits: view/LICENSE-NOTE.md.\n";

export function render(table) {
  const lines = Object.entries(table).map(([file, variants]) => `  '${file}': [\n${variants.map(v => `    { n: ${v.n}, bg: [\n${v.bg.map(e => `      ${JSON.stringify(e)},`).join('\n')}\n    ] },`).join('\n')}\n  ],`);
  return `${HEAD}export const BG_TIMINGS = {\n${lines.join('\n')}\n};\n`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [pack, flag] = process.argv.slice(2);
  if (!pack) { console.error('usage: node tools/build-anim-tints.mjs <PkmnAnimations.rxdata> [--check]'); process.exit(1); }
  const table = buildTints(readFileSync(pack));
  const text = render(table);
  console.log(`${Object.keys(table).length} files, ${Object.values(table).flat().length} variants`);
  if (flag === '--check') {
    const same = existsSync(OUT) && readFileSync(OUT, 'utf8') === text;
    console.log(same ? 'view/anims/tints.js is up to date' : 'view/anims/tints.js differs');
    process.exitCode = same ? 0 : 1;
  } else writeFileSync(OUT, text);
}
