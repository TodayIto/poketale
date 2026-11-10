import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { csv, toID } from './sources.mjs';

const require = createRequire(import.meta.url);
const { Dex } = require('../vendor/pokemon-showdown/dist/sim/index.js');
const root = new URL('../', import.meta.url);
const FILE = 'pokemon_species.csv';
const source = JSON.parse(readFileSync(new URL('data/sources/pokeapi/source.json', root), 'utf8'));

const GAME_DATA = Object.freeze({

	cycles: { 1012: 20, 1013: 20, 1014: 120, 1015: 120, 1016: 120, 1017: 10 },

	eggGroups: { toedscool: ['Grass'], toedscruel: ['Grass'] },
});

const showdown = new Map();
for (const s of Dex.species.all()) if (s.num > 0 && !s.forme && s.name === s.baseSpecies) showdown.set(s.num, s.id);

const cycles = [null];
for (const row of csv(FILE)) {
	const num = Number(row.id), n = Number(row.hatch_counter);
	if (!Number.isInteger(n) || n < 1 || n > 255) throw new Error(`${row.identifier}: 알 사이클 ${row.hatch_counter}`);
	const sd = showdown.get(num);
	if (!sd) throw new Error(`${row.identifier} (#${num}): Showdown 에 같은 번호 종이 없습니다`);
	if (sd !== toID(row.identifier)) throw new Error(`#${num}: 이름이 다릅니다 (PokeAPI ${row.identifier} / Showdown ${sd})`);
	const game = GAME_DATA.cycles[num];
	if (game === n) throw new Error(`#${num}: PokeAPI 알 사이클이 게임 값(${n})과 같아졌습니다 - GAME_DATA.cycles 에서 빼세요`);
	cycles[num] = game ?? n;
}
for (let n = 1; n < cycles.length; n++) if (!cycles[n]) throw new Error(`#${n}: 알 사이클이 비었습니다`);

const eggGroups = {};
for (const [id, groups] of Object.entries(GAME_DATA.eggGroups)) {
	const species = Dex.species.get(id);
	if (!species.exists) throw new Error(`GAME_DATA.eggGroups: Showdown 에 ${id} 가 없습니다`);
	if (species.eggGroups.join() === groups.join()) throw new Error(`${id}: Showdown 알 그룹이 게임 값과 같아졌습니다 - GAME_DATA.eggGroups 에서 빼세요`);
	eggGroups[id] = groups;
}

const eggMoves = {};
for (const species of [...Dex.species.all()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
	const learnset = Dex.species.getLearnsetData(species.id).learnset;
	if (!learnset) continue;
	const byGen = new Map();
	for (const [move, sources] of Object.entries(learnset)) {
		for (const s of sources) {
			const m = /^(\d+)E/.exec(s);
			if (m) byGen.set(Number(m[1]), [...byGen.get(Number(m[1])) ?? [], move]);
		}
	}
	if (!byGen.size) continue;
	eggMoves[species.id] = [...new Set(byGen.get(Math.max(...byGen.keys())))].sort();
}

const json = JSON.stringify({
	source: `PokeAPI ${source.commit.slice(0, 12)} data/v2/csv/${FILE} hatch_counter · Showdown learnsets <gen>E · game data corrections (PKHeX personal_sv) (tools/build-breeding.mjs)`,
	note: 'cycles: 전국도감 번호 → 알 사이클 (byNum[0] 은 비움) · eggMoves: Showdown 종 id → 알 기술 (기록이 있는 가장 최근 세대) · eggGroups: Showdown 과 게임이 다른 종만 → 게임의 알 그룹',
	cycles, eggMoves, eggGroups,
}) + '\n';
writeFileSync(new URL('data/breeding.json', root), json);
console.log(`data/breeding.json: 알 사이클 ${cycles.length - 1}종, 알 기술 ${Object.keys(eggMoves).length}종, ${Buffer.byteLength(json)} bytes, gzip ${gzipSync(json, { level: 9 }).length} bytes`);
