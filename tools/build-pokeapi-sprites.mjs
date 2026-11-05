// Map Showdown sprite names to pinned PokeAPI sprite file names.
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { csv, toID } from './sources.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const { Dex } = createRequire(import.meta.url)(resolve(root, 'vendor/pokemon-showdown/dist/sim'));
export const POKEAPI_SPRITE_MAP = 'data/pokeapi-sprite-map.json';

export function buildMap() {
  const pokemon = new Map(csv('pokemon.csv').map(p => [p.id, p]));
  const species = new Map(csv('pokemon_species.csv').map(s => [s.id, s.identifier]));
  const byNum = new Map();
  for (const f of csv('pokemon_forms.csv')) {
    const p = pokemon.get(f.pokemon_id);
    const stem = f.is_default === '1' ? f.pokemon_id : `${f.pokemon_id}-${f.form_identifier}`;

    const form = f.is_default === '1' && p.is_default === '1' ? '' : toID(f.identifier.slice(species.get(p.species_id).length));
    const list = byNum.get(p.species_id) ?? byNum.set(p.species_id, []).get(p.species_id);
    list.push({ stem, form, mega: f.is_mega === '1' });
  }
  const map = {};
  for (const s of Dex.species.all()) {
    if (s.num <= 0 || map[s.spriteid]) continue;
    const sprite = Dex.species.get(s.spriteid);
    const forme = toID(sprite.forme), list = (byNum.get(String(sprite.num)) ?? []).filter(f => f.mega === !!sprite.isMega);
    const only = test => { const found = list.filter(test); return found.length === 1 ? found[0] : null; };
    const match = list.find(f => f.form === forme) ?? (forme ? only(f => f.form && (f.form.startsWith(forme) || forme.startsWith(f.form))) ?? only(f => f.form.includes(forme)) : null);
    if (match) map[sprite.spriteid] = match.stem;
  }
  return map;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const map = buildMap();
  const bytes = Buffer.from(JSON.stringify(map) + '\n');
  writeFileSync(resolve(root, POKEAPI_SPRITE_MAP), bytes);
  const missing = [...new Set(Dex.species.all().filter(s => s.num > 0 && !s.isNonstandard).map(s => s.spriteid))].filter(id => !map[id]);
  console.log(`${POKEAPI_SPRITE_MAP}: ${Object.keys(map).length} entries, ${bytes.length} bytes, gzip ${gzipSync(bytes, { level: 9 }).length} bytes`);
  console.log(`no PokeAPI match (standard sprites): ${missing.length}${missing.length ? ` - ${missing.join(' ')}` : ''}`);
}
