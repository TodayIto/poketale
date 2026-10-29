import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { csv, speciesIds, toID } from './sources.mjs';

const PR = new URL('../vendor/pokerogue/src/', import.meta.url);

const GROWTH_RATES = ['erratic', 'fast', 'mediumfast', 'mediumslow', 'slow', 'fluctuating'];
const PR_GROWTH = ['ERRATIC', 'FAST', 'MEDIUM_FAST', 'MEDIUM_SLOW', 'SLOW', 'FLUCTUATING'];

function buildExpTable() {
	const enumSrc = readFileSync(new URL('data/exp.ts', PR), 'utf8');
	const order = /export enum GrowthRate \{\s*([^}]*)\}/.exec(enumSrc)[1].split(',').map(s => s.replace(/=.*/, '').trim()).filter(Boolean);
	if (order.join() !== PR_GROWTH.join()) throw new Error(`PokeRogue GrowthRate 순서가 바뀜: ${order}`);
	const nums = speciesIds();
	const species = {};
	const dir = new URL('data/balance/species/', PR);
	for (const file of readdirSync(dir).sort()) {
		const src = readFileSync(new URL(file, dir), 'utf8');

		for (const block of src.split('new PokemonSpecies({').slice(1)) {
			const body = block.slice(0, block.indexOf('})'));
			const id = /\bid: SpeciesId\.(\w+),/.exec(body)?.[1];
			const baseExp = /\bbaseExp: (\d+),/.exec(body)?.[1];
			const growth = /\bgrowthRate: GrowthRate\.(\w+),/.exec(body)?.[1];
			if (!id || !baseExp || !growth) throw new Error(`${file}: 종 정의를 못 읽음: ${body.slice(0, 80)}`);
			const num = nums.get(id);
			if (num === undefined) throw new Error(`${file}: 모르는 SpeciesId.${id}`);

			if (num >= 2000) continue;
			if (species[num]) throw new Error(`${file}: 번호 ${num} 중복`);
			if (!PR_GROWTH.includes(growth)) throw new Error(`${file}: 모르는 GrowthRate.${growth}`);
			species[num] = [Number(baseExp), PR_GROWTH.indexOf(growth)];
		}
	}

	// Must run from 1 with no gaps (a gap = a species definition that was not read)
	const max = Math.max(...Object.keys(species).map(Number));
	const list = Array.from({ length: max + 1 }, (_, i) => species[i] || null);
	const gaps = list.map((s, i) => (i && !s ? i : 0)).filter(Boolean);
	if (gaps.length) throw new Error(`종 정의가 빈 번호: ${gaps.join(', ')}`);
	return { growthRates: GROWTH_RATES, species: list };
}

const require = createRequire(import.meta.url);
const { Dex } = require('../vendor/pokemon-showdown/dist/sim/index.js');

const EFFORT_STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

function buildEffortTable() {
	const stats = new Map();
	for (const r of csv('pokemon_stats.csv')) {
		const i = Number(r.stat_id) - 1;
		if (!(i >= 0 && i < 6)) throw new Error(`pokemon_stats.csv: 모르는 stat_id ${r.stat_id}`);
		const effort = Number(r.effort);
		if (!Number.isInteger(effort) || effort < 0 || effort > 3) throw new Error(`pokemon ${r.pokemon_id}: 노력치 ${r.effort}`);
		if (!stats.has(r.pokemon_id)) stats.set(r.pokemon_id, { base: [], effort: [] });
		const row = stats.get(r.pokemon_id);
		row.base[i] = Number(r.base_stat);
		row.effort[i] = effort;
	}
	const sameBase = (row, species) => EFFORT_STATS.every((s, i) => row.base[i] === species.baseStats[s]);
	const showdown = new Map();
	for (const s of Dex.species.all()) if (s.num > 0 && !s.forme && s.name === s.baseSpecies) showdown.set(s.num, s);
	const pokemon = csv('pokemon.csv');
	const effort = [null], forms = {};
	const skipped = { form: 0, baseStats: [] };
	for (const p of pokemon.filter(p => p.is_default === '1')) {
		const num = Number(p.species_id), row = stats.get(p.id), sd = showdown.get(num);
		if (!row || row.effort.filter(n => n !== undefined).length !== 6) throw new Error(`${p.identifier}: 능력치 여섯 줄이 없습니다`);
		if (!sd) throw new Error(`${p.identifier} (#${num}): Showdown 에 같은 번호 종이 없습니다`);

		// Some base form identifiers carry the form name (deoxys-normal etc.), so the name is matched by prefix
		if (!toID(p.identifier).startsWith(sd.id) && !toID(p.identifier).startsWith(toID(sd.baseSpecies))) throw new Error(`#${num}: 이름이 다릅니다 (PokeAPI ${p.identifier} / Showdown ${sd.id})`);
		if (!sameBase(row, sd)) skipped.baseStats.push(`${sd.id}`);

		if (!row.effort.some(Boolean)) throw new Error(`${p.identifier}: 노력치가 모두 0 입니다`);
		effort[num] = row.effort.join('');
	}
	for (const p of pokemon.filter(p => p.is_default !== '1')) {
		const num = Number(p.species_id), row = stats.get(p.id);
		const sd = Dex.species.get(toID(p.identifier));

		if (!row || !sd.exists || sd.num !== num || toID(p.identifier) !== sd.id || !sameBase(row, sd) || !row.effort.some(Boolean)) { skipped.form++; continue; }
		const digits = row.effort.join('');
		if (digits !== effort[num]) forms[sd.id] = digits;
	}
	for (let n = 1; n < effort.length; n++) if (!effort[n]) throw new Error(`#${n}: 노력치가 비었습니다`);
	return { effortStats: EFFORT_STATS, effort, effortForms: forms, skipped };
}

const { skipped, ...effortTable } = buildEffortTable();
const table = { ...buildExpTable(), ...effortTable };

const json = JSON.stringify(table) + '\n';
const out = new URL('../data/', import.meta.url);
mkdirSync(out, { recursive: true });
writeFileSync(new URL('exp.json', out), json);
console.log(`data/exp.json: ${table.species.filter(Boolean).length}종, 노력치 ${table.effort.filter(Boolean).length}종 + 다른 폼 ${Object.keys(table.effortForms).length}개, ${Buffer.byteLength(json)} bytes`,
	`(PokeAPI 폼 중 Showdown 짝이 없거나 종족값이 다르거나 값이 빈 것 ${skipped.form}개, 기본 폼 종족값이 Showdown 과 다른 종 ${skipped.baseStats.length}개${skipped.baseStats.length ? `: ${skipped.baseStats.join(', ')}` : ''})`);
