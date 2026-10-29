import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const require = createRequire(import.meta.url);
const { Dex } = require('../vendor/pokemon-showdown/dist/sim/index.js');

function levelSources(learnset) {
	return Object.entries(learnset || {}).flatMap(([move, sources]) => sources.flatMap(source => {
		const match = /^(\d+)L(\d+)$/.exec(source);
		return match ? [{ gen: Number(match[1]), level: Number(match[2]), move }] : [];
	}));
}

function sourcesFor(species, seen = new Set()) {
	if (seen.has(species.id)) throw new Error(`레벨업 습득표 순환: ${species.id}`);
	seen.add(species.id);
	const learnset = Dex.species.getLearnsetData(species.id).learnset;
	const sources = levelSources(learnset);
	if (sources.length) return sources;
	const parent = learnset ? Dex.species.learnsetParent(species) : Dex.species.get(species.changesFrom || species.baseSpecies);
	if (parent && parent.id !== species.id && parent.id !== Dex.toID(species.prevo)) return sourcesFor(parent, seen);
	return [];
}

const levelUp = {};

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
}

const json = JSON.stringify(levelUp) + '\n';
const outputDir = new URL('../data/', import.meta.url);
mkdirSync(outputDir, { recursive: true });
writeFileSync(new URL('levelup.json', outputDir), json);
console.log(`data/levelup.json: ${Object.keys(levelUp).length}종, ${Buffer.byteLength(json)} bytes, gzip ${gzipSync(json, { level: 9 }).length} bytes`);
