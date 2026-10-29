import { readFileSync, writeFileSync } from 'node:fs';

const norm = s => String(s ?? '').normalize('NFKC').replace(/♀/g, 'f').replace(/♂/g, 'm').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

const LOC = new URL('../vendor/pokerogue/locales/', import.meta.url);
const read = (lang, file) => JSON.parse(readFileSync(new URL(`${lang}/${file}`, LOC), 'utf8'));
const cap = s => s[0].toUpperCase() + s.slice(1);

const snake = s => s.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
const { BIOMES } = await import('../view/arena.js');

function put(table, name, value, why) {
	const k = norm(name);
	if (!k) return;
	if (table[k] && table[k] !== value) throw new Error(`${why}: "${name}" 이 ${table[k]} 와 ${value} 둘에 걸림`);
	table[k] = value;
}

const natures = {};
for (const lang of ['ko', 'en']) for (const [id, name] of Object.entries(read(lang, 'nature.json'))) {
	put(natures, name, cap(id), 'nature');
	put(natures, id, cap(id), 'nature');
}

const biomes = {};
for (const lang of ['ko', 'en']) for (const [id, name] of Object.entries(read(lang, 'biomes.json'))) {
	const key = snake(id);
	if (!BIOMES.includes(key)) continue;
	if (name !== '???') put(biomes, name, key, 'biome');
	put(biomes, key, key, 'biome');
}

const BIOME_ALIASES = { 초원: 'plains', 평원: 'plains', 들판: 'plains', 풀밭: 'grass', 유적: 'ruins', 도시: 'metropolis', 해안: 'beach',
	바닷가: 'beach', 설원: 'snowy_forest', 눈숲: 'snowy_forest', 실험실: 'laboratory', 체육관: 'dojo', 동네: 'town', 길: 'plains', road: 'plains', route: 'plains' };
for (const [name, key] of Object.entries(BIOME_ALIASES)) if (!biomes[norm(name)]) biomes[norm(name)] = key;

const types = {};
for (const lang of ['ko', 'en']) for (const [id, name] of Object.entries(read(lang, 'pokemon-info.json').type)) {
	if (id === 'unknown') continue;
	put(types, name, cap(id), 'type');
	put(types, id, cap(id), 'type');
}

const table = { natures, biomes, types };
const json = JSON.stringify(table) + '\n';
writeFileSync(new URL('../data/story-names.json', import.meta.url), json);
console.log(`data/story-names.json: 성격 ${Object.keys(natures).length}, 바이옴 ${Object.keys(biomes).length}, 타입 ${Object.keys(types).length} 이름, ${Buffer.byteLength(json)} bytes`);
