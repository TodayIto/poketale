import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { baseKo } from '../names/index.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const json = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
export const LAST = 1025;
export const OUT = 'data/dex-entries.json';

export function buildDex(source, speciesNames) {
	const versions = [...new Set(source.entries.map(r => r.version))];
	if (versions.includes(null)) throw new Error('판(version) 없는 줄이 있다');
	const byNum = Array.from({ length: LAST }, () => []);
	for (const r of source.entries) {
		if (!Number.isInteger(r.num) || r.num < 1 || r.num > LAST) throw new Error(`번호 밖: ${r.num}`);
		byNum[r.num - 1].push(r);
	}
	const species = byNum.map((list, i) => {
		if (!list.length) throw new Error(`빠진 번호: ${i + 1}`);
		const first = list[0];
		const base = Object.values(speciesNames).find(r => r.num === i + 1 && r.forme === '');

		const shown = first.id && speciesNames[first.id].ko && baseKo(speciesNames[first.id].ko);
		if (!shown || base?.ko !== first.name || shown !== first.name) {
			throw new Error(`${i + 1}: 첫 줄 이름 "${first.name}" 이 이름표의 종 이름 "${base?.ko}" / "${shown}" 와 다르다`);
		}
		return list.map(r => {
			if (!r.text) throw new Error(`${r.num} ${r.name}: 설명 글 없음`);
			if (r.id !== null && !Object.hasOwn(speciesNames, r.id)) throw new Error(`${r.num}: 이름표에 없는 id ${r.id}`);

			const text = r.text.replace(/\s*※[^※]*$/, '');
			if (!text) throw new Error(`${r.num} ${r.name}: 안내 문장을 떼니 설명 글이 비었다`);
			const row = [r.category ?? null, r.heightText ?? r.height, r.weightText ?? r.weight, text, versions.indexOf(r.version), r.id, r.form ?? '', r.name];
			if (row[7] === first.name) row.length = 7;
			if (row.length === 7 && row[6] === '') row.length = 6;
			return row;
		});
	});
	return {
		source: source.source,
		note: '도감 번호 n 의 줄들 = species[n-1] (첫 줄 = 기본 모습). 줄 = [분류, 키 m, 몸무게 kg, 설명 글, versions 번호, 이름표 id(없으면 null), 모습 이름(없으면 뺌), 이름(첫 줄과 같으면 뺌)]. 거다이맥스는 키·몸무게가 사이트 글 그대로. tools/build-dex.mjs 로 만든다 (손으로 고치지 않는다). 읽기: names/dex.js',
		versions,
		species,
	};
}

export const serialize = table => JSON.stringify(table) + '\n';

async function main() {
	const table = buildDex(json('data/dex-ko.json'), json('data/names/species.json'));
	const bytes = Buffer.from(serialize(table));
	writeFileSync(resolve(root, OUT), bytes);
	const rows = table.species.reduce((n, list) => n + list.length, 0);
	console.log(`${OUT}: 종 ${table.species.length}, 줄 ${rows}, ${bytes.length} B, gzip -9 ${gzipSync(bytes, { level: 9 }).length} B`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
