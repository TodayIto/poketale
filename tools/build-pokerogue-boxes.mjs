import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import sharp from 'sharp';
import { median } from '../view/sprites/pixels.js';
import { speciesIds, toID } from './sources.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFileSync(resolve(root, path), 'utf8');
const require = createRequire(import.meta.url);
const { Dex } = require(resolve(root, 'vendor/pokemon-showdown/dist/sim'));

export function atlasBox(atlas) {
  const frames = atlas.textures ? atlas.textures.flatMap(t => t.frames) : Object.values(atlas.frames);
  assert.ok(frames.length, 'Empty atlas');
  const { w: width, h: height } = frames[0].sourceSize;
  let left = width, top = height, right = 0, bottom = 0;
  for (const f of frames) {
    assert.deepEqual(f.sourceSize, { w: width, h: height }, 'Changing sourceSize');
    const { x, y, w, h } = f.spriteSourceSize;
    assert.ok([width, height, x, y, w, h].every(Number.isInteger));

    assert.ok(width > 0 && height > 0 && x >= 0 && y >= 0 && w > 0 && h > 0);
    left = Math.min(left, x); top = Math.min(top, y);
    right = Math.max(right, x + w); bottom = Math.max(bottom, y + h);
  }
  return [width, height, left, top, right - left, bottom - top];
}

export function atlasFramePixels(data, width, height, frame) {
  const { x, y, w, h } = frame;
  assert.ok([x, y, w, h].every(Number.isInteger) && x >= 0 && y >= 0 && w > 0 && h > 0 &&
    x < width && y < height, `Frame outside PNG: ${JSON.stringify({ frame, width, height })}`);
  let count = 0;

  for (let row = y; row < Math.min(y + h, height); row++) for (let col = x; col < Math.min(x + w, width); col++) {
    if (data[(row * width + col) * 4 + 3]) count++;
  }
  return count;
}

export async function atlasBodyArea(atlas, folder, fallbackImage) {
  const counts = [];

  const textures = atlas.textures ?? [{ image: fallbackImage, frames: Object.values(atlas.frames) }];
  for (const texture of textures) {
    const { data, info } = await sharp(resolve(folder, texture.image)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.channels, 4);
    const overhangs = texture.frames.filter(({ frame: f }) => f.x + f.w > info.width || f.y + f.h > info.height);
    if (overhangs.length) console.warn(`PNG overhang: ${fallbackImage} (${folder}): ${overhangs.length} frames; count existing pixels only`);
    for (const f of texture.frames) {
      try { counts.push(atlasFramePixels(data, info.width, info.height, f.frame)); }
      catch (error) { throw new Error(`${resolve(folder, texture.image)}: ${error.message}`, { cause: error }); }
    }
  }
  const area = median(counts);
  assert.ok(area > 0, 'Atlas has no median body area');
  return area;
}

const formKeyConstants = () => Object.fromEntries([...read('vendor/pokerogue/src/enums/species-form-key.ts')
  .matchAll(/^\s+([A-Z_]+) = "([^"]+)",/gm)].map(m => [m[1], m[2]]));

function formDefinitions(ids) {
  const constants = formKeyConstants();
  const definitions = new Map();
  const folder = 'vendor/pokerogue/src/data/balance/species';
  for (const file of readdirSync(resolve(root, folder)).filter(f => /^generation-\d+\.ts$/.test(f)).sort()) {
    const blocks = read(`${folder}/${file}`).split(/\w+SpeciesData\[SpeciesId\.([A-Z0-9_]+)\] = \{/);
    for (let i = 1; i < blocks.length; i += 2) {
      const forms = [];
      for (const m of blocks[i + 1].matchAll(/new PokemonForm\(\{([\s\S]*?)\}\)/g)) {
        const key = /formKey:\s*(?:"([^"]*)"|SpeciesFormKey\.([A-Z_]+))/.exec(m[1]);
        assert.ok(key, `${file}/${blocks[i]} missing formKey`);
        const form = key[1] ?? constants[key[2]];
        assert.equal(typeof form, 'string', `Unknown SpeciesFormKey ${key[2]}`);
        const sprite = /formSpriteKey:\s*"([^"]*)"/.exec(m[1]);
        forms.push({ form, sprite: sprite ? sprite[1] : form });
      }
      assert.ok(ids.has(blocks[i]), `Unknown SpeciesId ${blocks[i]}`);
      definitions.set(blocks[i], forms);
    }
  }
  assert.ok(definitions.size >= 1025, 'Pinned species layout changed');
  return definitions;
}

const aliases = {
  pikachurockstar: 'cool-cosplay', pikachubelle: 'beauty-cosplay', pikachupopstar: 'cute-cosplay',
  pikachuphd: 'smart-cosplay', pikachulibre: 'tough-cosplay', pichuspikyeared: 'spiky',
  unown: 'a', wormadam: 'plant', burmy: 'plant', cherrim: 'overcast',
  shellos: 'west', gastrodon: 'west', giratina: 'altered', shaymin: 'land', arceus: 'normal',
  basculin: 'red-striped', basculinbluestriped: 'blue-striped', deerling: 'spring', sawsbuck: 'spring',
  tornadus: 'incarnate', thundurus: 'incarnate', landorus: 'incarnate', enamorus: 'incarnate',
  keldeo: 'ordinary', meloetta: 'aria', vivillon: 'meadow', vivillonpokeball: 'poke-ball',
  flabebe: 'red', floette: 'red', florges: 'red', meowsticf: 'female',
  pumpkaboosuper: 'jumbo', gourgeistsuper: 'jumbo', xerneas: 'active',
  zygarde10powerconstruct: '10', zygardepowerconstruct: '',
  oricoriopompom: 'pompom', mimikyu: 'disguised', mimikyubustedtotem: 'busted', mimikyutotem: 'disguised',
  necrozmadawnwings: 'dawn-wings', necrozmaduskmane: 'dusk-mane',
  toxtricitylowkeygmax: 'gigantamax', eiscuenoice: 'no-ice',
  indeedeef: 'female', zacian: 'hero-of-many-battles', zamazenta: 'hero-of-many-battles',
  urshifurapidstrike: 'rapid-strike', urshifugmax: 'gigantamax-single', urshifurapidstrikegmax: 'gigantamax-rapid',
  calyrexice: 'ice', calyrexshadow: 'shadow', basculegionf: 'female',
  oinkolognef: 'female', maushold: 'three', mausholdfour: 'four',
  squawkabilly: 'green-plumage', squawkabillyblue: 'blue-plumage',
  squawkabillyyellow: 'yellow-plumage', squawkabillywhite: 'white-plumage',
  palafin: 'zero', tatsugiri: 'curly', dudunsparce: 'two-segment', dudunsparcethreesegment: 'three-segment',
  koraidon: 'apex-build', miraidon: 'ultimate-mode', poltchageist: 'counterfeit',
  sinistcha: 'unremarkable', ogerpon: 'teal-mask', ogerpontealtera: 'teal-mask-tera',
  minior: 'red', miniormeteor: 'red-meteor', rockruffdusk: 'own-tempo',
  ogerponwellspring: 'wellspring-mask', ogerponwellspringtera: 'wellspring-mask-tera',
  ogerponhearthflame: 'hearthflame-mask', ogerponhearthflametera: 'hearthflame-mask-tera',
  ogerponcornerstone: 'cornerstone-mask', ogerponcornerstonetera: 'cornerstone-mask-tera',
};
const specialSpecies = { greninjabond: 'BATTLE_BOND_GRENINJA', greninjaash: 'BATTLE_BOND_GRENINJA',
  floetteeternal: 'ETERNAL_FLOETTE', floetteeternalmega: 'ETERNAL_FLOETTE', ursalunabloodmoon: 'BLOODMOON_URSALUNA',
  basculinwhitestriped: 'HISUI_BASCULIN' };

function cryRules() {
  const constants = formKeyConstants();
  const src = read('vendor/pokerogue/src/data/pokemon-species.ts');
  const body = src.slice(src.indexOf('getCryKey(formIndex'), src.indexOf('return `cry/${ret}`;'));
  assert.ok(body.length > 100, 'getCryKey not found');
  const between = (from, to) => {
    const a = body.indexOf(from), b = body.indexOf(to, a);
    assert.ok(a >= 0 && b > a, `getCryKey layout changed: ${from} … ${to}`);
    return body.slice(a, b);
  };
  const cases = text => new Set([...text.matchAll(/case (?:SpeciesFormKey\.([A-Z_]+)|"([^"]*)"):/g)].map(m => {
    const key = m[2] ?? constants[m[1]];
    assert.equal(typeof key, 'string', `Unknown SpeciesFormKey ${m[1]}`);
    return key;
  }));
  const keep = new Set([...between('speciesId >= 2000', 'speciesId %= 2000').matchAll(/case SpeciesId\.([A-Z0-9_]+):/g)].map(m => m[1]));
  const suffix = cases(between('switch (formKey)', 'ret += `-${formKey}`'));
  const mega = cases(between('ret += `-${formKey}`', 'ret += `-${SpeciesFormKey.MEGA}`'));
  const species = body.slice(body.indexOf('switch (this.speciesId)')).split('break;').map(block => ({
    names: [...block.matchAll(/case SpeciesId\.([A-Z0-9_]+):/g)].map(m => m[1]),
    keys: [...block.matchAll(/formKey === "([^"]+)"/g)].map(m => m[1]),
  })).filter(rule => rule.names.length && rule.keys.length);
  for (const name of ['GALAR_SLOWPOKE', 'ETERNAL_FLOETTE', 'BLOODMOON_URSALUNA']) assert.ok(keep.has(name), `cry keep ${name}`);
  for (const key of ['mega', 'mega-x', 'primal', 'gigantamax', 'therian', 'ultra']) assert.ok(suffix.has(key), `cry suffix ${key}`);
  assert.ok(mega.has('mega-original'), 'cry mega alias');
  assert.deepEqual(species.map(rule => rule.names.join('|')), ['INDEEDEE|OINKOLOGNE', 'CALYREX']);
  return { keep, suffix, mega, species, megaKey: constants.MEGA };
}

export async function buildTables() {
  const boxes = {};
  for (const [direction, folder] of [['f', ''], ['b', 'back/']]) {
    const path = `vendor/pokerogue/assets/images/pokemon/${folder}`;
    for (const file of readdirSync(resolve(root, path)).filter(f => f.endsWith('.json')).sort()) {
      const key = file.slice(0, -5);
      const atlas = JSON.parse(read(path + file));
      (boxes[key] ??= {})[direction] = [...atlasBox(atlas), await atlasBodyArea(atlas, resolve(root, path), key + '.png')];
    }
  }
  const ids = speciesIds(), forms = formDefinitions(ids);
  const enumByID = new Map([...ids.keys()].map(name => [toID(name), name]));
  const ordinaryByNum = new Map([...ids].filter(([, num]) => num <= 1025).map(([name, num]) => [num, name]));
  const mapping = {}, diagnostics = [];

  const rules = cryRules(), nameByNum = new Map([...ids].map(([name, n]) => [n, name]));
  const cryFiles = new Set(readdirSync(resolve(root, 'vendor/pokerogue/assets/audio/cry')).map(f => f.replace(/\.m4a$/, '')));
  const cries = {};
  const cryKey = (enumName, formIndex) => {
    let id = ids.get(enumName);
    if (id >= 2000 && !rules.keep.has(enumName)) id %= 2000;
    let key = String(id);
    const list = forms.get(nameByNum.get(id)) ?? [];
    if (list.length) {
      const form = list[Math.min(formIndex, list.length - 1)].form;
      if (rules.suffix.has(form)) key += `-${form}`;
      else if (rules.mega.has(form)) key += `-${rules.megaKey}`;
      if (rules.species.some(rule => rule.names.includes(enumName) && rule.keys.includes(form))) key += `-${form}`;
    }
    return key;
  };
  for (const entry of [...Dex.species.all()].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) {
    if (entry.num <= 0) continue;

    const s = Dex.species.get(entry.spriteid);
    assert.ok(s.exists, `Unrecognized spriteid ${entry.spriteid}`);
    let enumName = specialSpecies[s.id] ?? ordinaryByNum.get(s.num);
    let form = s.forme;
    const regional = /^(Alola|Galar|Hisui|Paldea)(?:-(.*))?$/.exec(form);
    if (regional) {
      const regionName = enumByID.get(toID(regional[1] + s.baseSpecies));
      if (regionName) { enumName = regionName; form = regional[2] ?? ''; }
    }
    if (s.id === 'greninjaash') form = 'ash';
    if (s.id === 'greninjabond' || s.id === 'floetteeternal' || s.id === 'ursalunabloodmoon') form = '';
    if (s.id === 'basculinwhitestriped') form = '';
    const definitions = forms.get(enumName) ?? [];
    let wanted = Object.hasOwn(aliases, s.id) ? aliases[s.id] : form;
    if (wanted === 'Gmax') wanted = 'gigantamax';

    // Names differ in punctuation only: Mega-X/megax, Rapid-Strike/rapidstrike.
    const match = definitions.find(f => toID(f.form) === toID(wanted)) ?? (!wanted ? definitions[0] : null);
    const num = ids.get(enumName);
    const candidate = match ? `${num}${match.sprite ? '-' + match.sprite : ''}`
      : !wanted && !definitions.length && num ? String(num) : null;
    const exact = candidate && boxes[candidate] ? candidate : null;

    const base = boxes[String(s.num)] ? String(s.num) : null;
    const value = [exact, base];
    if (mapping[s.spriteid]) assert.deepEqual(mapping[s.spriteid], value, `Conflicting spriteid ${s.spriteid}`);
    mapping[s.spriteid] = value;

    let cry = enumName && ids.has(enumName) ? cryKey(enumName, match ? definitions.indexOf(match) : 0) : String(s.num);
    if (!cryFiles.has(cry)) { console.warn(`cry/${cry} missing for ${s.spriteid} → cry/${s.num}`); cry = String(s.num); }
    assert.ok(cryFiles.has(cry), `No cry for ${s.spriteid}`);
    if (cries[s.spriteid]) assert.equal(cries[s.spriteid], cry, `Conflicting cry ${s.spriteid}`);
    cries[s.spriteid] = cry;
    diagnostics.push({ id: entry.id, spriteId: entry.spriteid, practical: entry.isNonstandard === null, exact, base });
  }
  return { boxes, mapping, cries, diagnostics };
}

export const STILL_TABLE = 'view/sprites/pokerogue-still.json';
function firstFrame(path) {
  const atlas = JSON.parse(read(path));
  const frames = (atlas.textures ?? [{ frames: Object.values(atlas.frames) }]).flatMap(t => t.frames);
  const f = frames.sort((a, b) => (a.filename < b.filename ? -1 : 1))[0];
  return [f.frame.x, f.frame.y, f.frame.w, f.frame.h, f.spriteSourceSize.x, f.spriteSourceSize.y];
}
export function stillTable(boxes, mapping) {
  const table = {};
  for (const key of [...new Set(Object.values(mapping).flat().filter(Boolean))].sort()) for (const [d, folder] of [['f', ''], ['b', 'back/']]) {
    if (!boxes[key]?.[d]) continue;
    const path = `vendor/pokerogue/assets/images/pokemon/${folder}`;
    const normal = firstFrame(`${path}${key}.json`);
    (table[key] ??= {})[d] = normal;
    const shiny = firstFrame(`${path}shiny/${key}.json`);
    if (shiny.join() !== normal.join()) table[key][`s${d}`] = shiny;
  }
  return table;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const start = performance.now();
  const { boxes, mapping, cries, diagnostics } = await buildTables();
  for (const [path, data] of [['data/pokerogue-boxes.json', boxes], ['data/pokerogue-sprite-map.json', mapping], ['data/pokerogue-cries.json', cries],
    [STILL_TABLE, stillTable(boxes, mapping)]]) {
    const bytes = Buffer.from(JSON.stringify(data) + '\n');
    writeFileSync(resolve(root, path), bytes);
    console.log(`${path}: ${Object.keys(data).length} entries, ${bytes.length} bytes, gzip ${gzipSync(bytes, { level: 9 }).length} bytes`);
  }
  mkdirSync(resolve(root, 'cache/sprite-placement'), { recursive: true });
  writeFileSync(resolve(root, 'cache/sprite-placement/mapping.json'), JSON.stringify(diagnostics, null, 2) + '\n');
  for (const [label, filter] of [
    ['exact match missing', d => !d.exact], ['base-form fallback', d => !d.exact && !d.base],
  ]) {
    const missing = diagnostics.filter(d => d.practical && filter(d));
    console.log(`${label} (isNonstandard === null): ${missing.length}: ${missing.map(d => d.id).join(', ') || '(none)'}`);
  }
  console.log(`Build time: ${((performance.now() - start) / 1000).toFixed(3)}s`);
}
