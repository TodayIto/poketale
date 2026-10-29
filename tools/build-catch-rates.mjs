import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { csv, toID } from './sources.mjs';

const require = createRequire(import.meta.url);
const { Dex } = require('../vendor/pokemon-showdown/dist/sim/index.js');
const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');

const SV_OVERRIDES = {
	384: 3,
	550: 190,
	789: 3, 790: 3, 791: 3, 792: 3,
	800: 3,
	899: 45, 900: 15, 901: 20, 902: 45, 903: 20, 904: 45,
};

const FILE = 'pokemon_species.csv';
const source = JSON.parse(read('data/sources/pokeapi/source.json'));

const showdown = new Map();
for (const s of Dex.species.all()) if (s.num > 0 && !s.forme && s.name === s.baseSpecies) showdown.set(s.num, s.id);

const byNum = [null];
for (const row of csv(FILE)) {
	const num = Number(row.id);
	const rate = Number(row.capture_rate);
	if (!Number.isInteger(rate) || rate < 1 || rate > 255) throw new Error(`${row.identifier}: 포획률 ${row.capture_rate}`);
	const sd = showdown.get(num);
	if (!sd) throw new Error(`${row.identifier} (#${num}): Showdown 에 같은 번호 종이 없습니다`);
	if (sd !== toID(row.identifier)) throw new Error(`#${num}: 이름이 다릅니다 (PokeAPI ${row.identifier} / Showdown ${sd})`);
	byNum[num] = SV_OVERRIDES[num] ?? rate;
	if (SV_OVERRIDES[num] === rate) throw new Error(`#${num}: 덮어쓸 필요가 없어졌습니다 (PokeAPI 가 고쳐짐) — SV_OVERRIDES 에서 빼세요`);
}
for (let n = 1; n < byNum.length; n++) if (!byNum[n]) throw new Error(`#${n}: 포획률이 비었습니다`);
const missing = [...showdown.keys()].filter(n => !byNum[n]);

writeFileSync(new URL('data/catch-rates.json', root), JSON.stringify({
	source: `PokeAPI ${source.commit.slice(0, 12)} data/v2/csv/${FILE} capture_rate + 9세대 보정 ${Object.keys(SV_OVERRIDES).length}종 (tools/build-catch-rates.mjs)`,
	note: '전국도감 번호 → 9세대 포획률 (종 단위). byNum[0] 은 비워 둔다',
	byNum,
}) + '\n');
console.log(`포획률 ${byNum.length - 1}종 → data/catch-rates.json`, missing.length ? `(Showdown 에만 있는 번호 ${missing.length}개: ${missing.join(', ')})` : '');
