import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { encodeMoveSet } from '../story/learnable.mjs';

const require = createRequire(import.meta.url);
const { Dex } = require('../vendor/pokemon-showdown/dist/sim/index.js');
const byId = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

const sketchable = Dex.moves.all()
	.filter(m => !m.flags.nosketch && !m.isZ && !m.isMax && [undefined, null, 'Past', 'Unobtainable'].includes(m.isNonstandard))
	.map(m => m.id);

const learnable = new Map();
for (const species of [...Dex.species.all()].sort((a, b) => byId(a.id, b.id))) {
	const moves = new Set();
	for (const { learnset } of Dex.species.getFullLearnset(species.id)) for (const move in learnset) moves.add(move);
	if (moves.has('sketch')) for (const move of sketchable) moves.add(move);
	if (moves.size) learnable.set(species.id, moves);
}

const moves = [...new Set([...learnable.values()].flatMap(set => [...set]))].sort(byId);
const index = new Map(moves.map((move, i) => [move, i]));
const sets = [], setOf = new Map(), species = {};
for (const [id, set] of learnable) {
	const code = encodeMoveSet([...set].map(move => index.get(move)));
	if (!setOf.has(code)) { setOf.set(code, sets.length); sets.push(code); }
	species[id] = setOf.get(code);
}

const json = JSON.stringify({
	source: 'Showdown learnsets, every generation and source, with pre-evolutions and base forms (Dex.species.getFullLearnset) (tools/build-learnable.mjs)',
	moves, sets, species,
}) + '\n';
writeFileSync(new URL('../data/learnable.json', import.meta.url), json);
console.log(`data/learnable.json: ${learnable.size}종 (기술 묶음 ${sets.length}개), 기술 ${moves.length}개, ${Buffer.byteLength(json)} bytes, gzip ${gzipSync(json, { level: 9 }).length} bytes`);
