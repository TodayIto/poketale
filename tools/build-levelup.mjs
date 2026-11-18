import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const require = createRequire(import.meta.url);
const { Dex } = require('../vendor/pokemon-showdown/dist/sim/index.js');
// Showdown's main learnsets start at generation 3; the generation 2 mod still has the 1L/2L sources.
const GEN2 = Dex.mod('gen2');

function levelSources(learnset) {
	return Object.entries(learnset || {}).flatMap(([move, sources]) => sources.flatMap(source => {
		const match = /^(\d+)L(\d+)$/.exec(source);
		return match ? [{ gen: Number(match[1]), level: Number(match[2]), move }] : [];
	}));
}

function sourcesFor(species, dex = Dex, seen = new Set()) {
	if (seen.has(species.id)) throw new Error(`레벨업 습득표 순환: ${species.id}`);
	seen.add(species.id);
	const learnset = dex.species.getLearnsetData(species.id).learnset;
	const sources = levelSources(learnset);
	if (sources.length) return sources;
	const parent = learnset ? dex.species.learnsetParent(species) : dex.species.get(species.changesFrom || species.baseSpecies);
	if (parent && parent.id !== species.id && parent.id !== dex.toID(species.prevo)) return sourcesFor(parent, dex, seen);
	return [];
}

const byLevel = (a, b) => a.level - b.level || (a.move < b.move ? -1 : a.move > b.move ? 1 : 0);

// An older generation's list keeps every level a move is learned at, as the newest one does: a starting move can come
// again later (generation 1 Gyarados's Hydro Pump at 1 and 41), and one generation can hold several games' levels
// (Red/Blue's and Yellow's Pikachu); a Pokémon that knows the move already does not learn it twice.
function pastList(sources) {
	const seen = new Set();
	return sources.slice().sort(byLevel).flatMap(({ level, move }) => (seen.has(`${level}:${move}`) ? [] : (seen.add(`${level}:${move}`), [[level, move]])));
}

const levelUp = {}, past = {};

for (const species of [...Dex.species.all()].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) {
	const sources = sourcesFor(species);
	const gen = Math.max(0, ...sources.map(source => source.gen));
	const seen = new Set();
	levelUp[species.id] = sources.filter(source => source.gen === gen).sort((a, b) => a.level - b.level).flatMap(({ level, move }) => {

		const key = `${level}:${move}`;
		if (seen.has(key)) return [];
		seen.add(key);
		return [[level, move]];
	});

	// Older generations from the species' own debut on, where the list changes; 0 stands for the levelup.json list (an
	// older generation that already had it, and the last entry). A species whose lists never differed from it is left out.
	if (!gen) continue;
	const newest = JSON.stringify(levelUp[species.id]);
	const older = species.gen <= 2 ? sourcesFor(GEN2.species.get(species.id), GEN2).filter(source => source.gen <= 2) : [];
	const all = [...older, ...sources.filter(source => source.gen < gen)];
	const entries = [];
	let last = null;
	for (let g = Math.max(1, species.gen); g < gen; g++) {
		const list = all.filter(source => source.gen === g);
		if (!list.length) continue;
		const made = pastList(list), key = JSON.stringify(made);
		if (key === last) continue;
		entries.push([g, key === newest ? 0 : made]);
		last = key;
	}
	if (entries.some(([, list]) => list !== 0)) past[species.id] = [...entries, ...(last === newest ? [] : [[gen, 0]])];
}

const outputDir = new URL('../data/', import.meta.url);
mkdirSync(outputDir, { recursive: true });
const json = JSON.stringify(levelUp) + '\n';
writeFileSync(new URL('levelup.json', outputDir), json);
console.log(`data/levelup.json: ${Object.keys(levelUp).length}종, ${Buffer.byteLength(json)} bytes, gzip ${gzipSync(json, { level: 9 }).length} bytes`);
const pastJson = JSON.stringify(past) + '\n';
writeFileSync(new URL('levelup-past.json', outputDir), pastJson);
console.log(`data/levelup-past.json: ${Object.keys(past).length}종, ${Buffer.byteLength(pastJson)} bytes, gzip ${gzipSync(pastJson, { level: 9 }).length} bytes`);
