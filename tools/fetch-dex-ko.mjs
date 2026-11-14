import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { LAST } from './build-dex.mjs';

const root = new URL('../', import.meta.url);
const SITE = 'https://pokemonkorea.co.kr';
const USER_AGENT = 'PokeTale-dex-fetch/1.0 (fan project data tool; one request per second)';
const DELAY_MS = 1200;

const VERSION_ORDER = [
	'Pokémon LEGENDS Z-A', '바이올렛', '스칼렛', 'Pokémon LEGENDS 아르세우스', 'SP', 'BD', '샤이닝펄', '브릴리언트다이아몬드', 'Pokémon HOME',
	'실드', '소드', '레츠고! 이브이', '레츠고! 피카츄', '울트라문', '울트라썬', '문', '썬',
	'알파사파이어', '오메가루비', 'Y', 'X',
];
const PREFERRED = ['Pokémon LEGENDS Z-A', '바이올렛'];

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const cleanText = html => html
	.replace(/<br\s*\/?>/gi, ' ')
	.replace(/<[^>]*>/g, '')
	.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => e[0] === '#'
		? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1)))
		: ENTITIES[e.toLowerCase()] ?? m)
	.replace(/\s+/g, ' ')
	.trim();

export function parseList(html) {
	const out = [];
	const re = /pokedex_detail\(\s*'?\d+'?\s*,\s*'(\d+)'\s*\)[\s\S]*?<h3>\s*<p>\s*No\.(\d+)\s*<\/p>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/g;
	for (const m of html.matchAll(re)) out.push({ buid: Number(m[1]), num: Number(m[2]), name: cleanText(m[3]), label: cleanText(m[4]) });
	return out;
}

export const listCount = text => {
	const m = /#\|#\s*(\d+)\s*#\|#\s*$/.exec(text);
	return m ? Number(m[1]) : null;
};

const field = (html, title) => {
	const m = new RegExp(`<h4[^>]*>\\s*${title}\\s*</h4>\\s*<p[^>]*>([\\s\\S]*?)</p>`).exec(html);
	return m ? cleanText(m[1]) : null;
};
const number = (text, unit) => {
	const m = text && new RegExp(`^([0-9]+(?:\\.[0-9]+)?)\\s*${unit}$`).exec(text.replace(/,/g, ''));
	return m ? Number(m[1]) : null;
};

export function parseDetail(html) {
	const start = html.indexOf('class="book-ct"');
	if (start < 0) throw new Error('도감 본문(book-ct)이 없습니다');
	const main = html.slice(start);
	const head = /<h3>\s*<p class="font-lato">\s*No\.\s*(\d+)\s*<\/p>([\s\S]*?)<p[^>]*>([\s\S]*?)<\/p>\s*<\/h3>/.exec(main);
	if (!head) throw new Error('번호·이름 줄이 없습니다');

	const descripts = [...main.matchAll(/<p class="[^"]*\bdescript\b[^"]*"[^>]*>([\s\S]*?)<\/p>/g)].map(m => cleanText(m[1]));
	const versions = [];
	for (const m of main.matchAll(/<input[^>]*name="series"[^>]*value="(\d+)"[^>]*>[\s\S]*?<span>([\s\S]*?)<\/span>/g)) {
		const i = Number(m[1]);
		if (i >= descripts.length) throw new Error(`탭 ${i}에 맞는 설명 칸이 없습니다`);
		versions.push({ version: cleanText(m[2]), text: descripts[i] });
	}
	const typeBlock = /<h4[^>]*>\s*타입\s*<\/h4>([\s\S]*?)<\/div>\s*<\/div>/.exec(main)?.[1] ?? '';
	const height = field(main, '키'), weight = field(main, '몸무게');
	return {
		num: Number(head[1]), name: cleanText(head[2]), label: cleanText(head[3]), versions,
		category: field(main, '분류') === '-' ? null : field(main, '분류'),
		height: number(height, 'm'), heightRaw: height,
		weight: number(weight, 'kg'), weightRaw: weight,
		types: [...typeBlock.matchAll(/<span class="img-type">[\s\S]*?<p>([\s\S]*?)<\/p>/g)].map(m => cleanText(m[1])),
	};
}

export function pickText(versions) {
	for (const v of versions) if (!VERSION_ORDER.includes(v.version)) throw new Error(`모르는 판 이름: ${v.version}`);
	const have = versions.filter(v => v.text);
	const order = [...PREFERRED, ...VERSION_ORDER.filter(v => !PREFERRED.includes(v))];
	for (const name of order) {
		const hit = have.find(v => v.version === name);
		if (hit) return hit;
	}
	return null;
}

const isBlock = (status, body) => [403, 429, 503].includes(status) || /Just a moment|cf-chl|challenge-platform|Attention Required/i.test(body);
let lastRequest = 0;
async function politeFetch(url, init = {}) {
	const wait = lastRequest + DELAY_MS - Date.now();
	if (wait > 0) await new Promise(r => setTimeout(r, wait));
	lastRequest = Date.now();
	const res = await fetch(url, { ...init, headers: { 'User-Agent': USER_AGENT, ...init.headers } });
	const body = await res.text();
	lastRequest = Date.now();
	if (isBlock(res.status, body)) throw new Error(`막힘(${res.status}) ${url} — 멈춥니다. 우회하지 않습니다.`);
	if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
	return body;
}
async function cached(name, offline, get) {
	const file = new URL(`cache/pokemonkorea/${name}`, root);
	if (existsSync(file)) return readFileSync(file, 'utf8');
	if (offline) throw new Error(`--offline 인데 캐시에 없습니다: cache/pokemonkorea/${name}`);
	const body = await get();
	mkdirSync(new URL('cache/pokemonkorea/', root), { recursive: true });
	writeFileSync(file, body);
	return body;
}
const listPage = (pn, offline) => cached(`list-1-${LAST}-p${pn}.txt`, offline, () => {
	const form = new FormData();
	for (const [k, v] of Object.entries({ mode: 'load_more', word: '', characters: '', pn: String(pn), area: '', snumber: '1', snumber2: String(LAST), sortselval: 'number asc', typestr: '' })) form.append(k, v);
	return politeFetch(`${SITE}/ajax/pokedex`, { method: 'POST', body: form });
});
const viewPage = (buid, offline) => cached(`view-${buid}.html`, offline, () => politeFetch(`${SITE}/pokedex/view/${buid}`));

function matcher() {
	const species = JSON.parse(readFileSync(new URL('data/names/species.json', root), 'utf8'));
	const byNum = new Map();
	for (const [id, s] of Object.entries(species)) if (s.num > 0) {
		const list = byNum.get(s.num) ?? byNum.set(s.num, []).get(s.num);
		const form = s.ko && /\((.*)\)$/.exec(s.ko)?.[1];
		list.push({ id, forme: s.forme, ko: s.ko, form });
	}
	const baseNames = new Map([...byNum].map(([n, list]) => [n, list.find(s => s.forme === '')?.ko]));
	const REGION = { 가라르: 'Galar', 알로라: 'Alola', 히스이: 'Hisui', 팔데아: 'Paldea' };

	const match = (e, used) => {

		const list = [...(byNum.get(e.num) ?? [])].sort((a, b) => a.forme.length - b.forme.length);
		const base = list.find(s => s.forme === '');
		const free = s => s && !used.has(s.id) ? s : null;
		const parts = e.label ? e.label.split(' / ') : [];
		const gmax = parts.includes('거다이맥스의 모습');
		const rest = parts.filter(p => p !== '거다이맥스의 모습');
		const region = rest.map(p => REGION[/^(.+)의 모습$/.exec(p)?.[1]]).find(Boolean);
		const named = rest.filter(p => !REGION[/^(.+)의 모습$/.exec(p)?.[1]]);
		let hit = null;
		if (!rest.length) hit = e.name === base?.ko ? base : list.find(s => s.form === e.name);
		else if (region && !named.length) hit = list.find(s => s.forme === region && s.form === rest[0]) ?? list.find(s => s.forme === region);
		else if (named.length === 1) hit = list.find(s => s.form === named[0] && (!region || s.forme.startsWith(`${region}-`)));
		if (gmax) hit = list.find(s => s.id === `${(hit ?? base)?.id}gmax`) ?? null;

		if (!hit && !gmax && e.name === base?.ko) hit = base;
		return free(hit);
	};
	return { match, baseNames };
}

async function main() {
	const offline = process.argv.includes('--offline');
	const entries = [];
	for (let pn = 1; ; pn++) {
		const text = await listPage(pn, offline);
		const page = parseList(text);
		const count = listCount(text);
		if (count !== page.length) throw new Error(`목록 ${pn}쪽: 개수 ${count} 인데 읽은 줄 ${page.length}`);
		if (!page.length) break;
		entries.push(...page);
		if (!offline) process.stdout.write(`\r목록 ${pn}쪽, ${entries.length}개`);
	}
	console.log(`\n목록 ${entries.length}개`);
	const seenBuid = new Set();
	for (const e of entries) {
		if (seenBuid.has(e.buid)) throw new Error(`buid ${e.buid} 가 목록에 두 번 나옵니다`);
		seenBuid.add(e.buid);
	}
	const nums = new Set(entries.map(e => e.num));
	const missingNums = [];
	for (let n = 1; n <= LAST; n++) if (!nums.has(n)) missingNums.push(n);

	if (!offline) for (const [i, e] of entries.entries()) {
		await viewPage(e.buid, false);
		if (i % 25 === 0) process.stdout.write(`\r상세 ${i + 1}/${entries.length}`);
	}
	const { match, baseNames } = matcher();
	const used = new Set();
	const rows = [], problems = [];
	for (const e of entries) {
		const d = parseDetail(await viewPage(e.buid, true));
		if (d.num !== e.num || d.name !== e.name || d.label !== e.label) problems.push(`buid ${e.buid}: 목록 No.${e.num} ${e.name} (${e.label}) / 상세 No.${d.num} ${d.name} (${d.label})`);
		const pick = pickText(d.versions);
		const sd = match(e, used);
		if (sd) used.add(sd.id);
		rows.push({
			num: d.num, id: sd?.id ?? null, name: d.name, form: d.label || undefined, buid: e.buid,
			category: d.category, height: d.height, weight: d.weight,
			text: pick?.text ?? null, version: pick?.version ?? null,

			...(d.height == null ? { heightText: d.heightRaw } : {}), ...(d.weight == null ? { weightText: d.weightRaw } : {}),
			versions: d.versions.map(v => v.version + (v.text ? '' : '(빈칸)')),
		});
	}
	console.log('');
	const versionsSeen = {};
	for (const r of rows) for (const v of r.versions) versionsSeen[v] = (versionsSeen[v] ?? 0) + 1;
	const table = rows.map(({ versions, ...r }) => r);
	writeFileSync(new URL('data/dex-ko.json', root), JSON.stringify({
		source: `포켓몬코리아 공식 도감 ${SITE}/pokedex (tools/fetch-dex-ko.mjs)`,
		note: '설명 글은 레전드 Z-A > 바이올렛 > 그 밖의 가장 최근 판 순으로 하나. id 는 data/names/species.json 의 Showdown id (맞는 것이 없으면 null). height m, weight kg',
		entries: table,
	}, null, '\t').replace(/\n\t\t\t/g, ' ').replace(/\n\t\t\}/g, ' }') + '\n');

	const byVersion = {};
	for (const r of table) byVersion[r.version ?? '(없음)'] = (byVersion[r.version ?? '(없음)'] ?? 0) + 1;
	const summary = {
		entries: table.length, species: nums.size, missingNums,
		byVersion, versionsSeen,
		noText: table.filter(r => !r.text).map(r => `${r.num} ${r.name}${r.form ? ` (${r.form})` : ''}`),
		noCategory: table.filter(r => !r.category).map(r => `${r.num} ${r.name}${r.form ? ` (${r.form})` : ""}`),
		badSize: table.filter(r => r.heightText || r.weightText).map(r => `${r.num} ${r.name}${r.form ? ` (${r.form})` : ""} ${r.heightText ?? ""} ${r.weightText ?? ""}`),
		listDetailMismatch: problems,
		unmatched: table.filter(r => !r.id).map(r => `${r.num} ${r.name}${r.form ? ` (${r.form})` : ''}`),

		nameMismatch: [...nums].flatMap(n => {
			const site = table.find(r => r.num === n);
			const ours = baseNames.get(n);
			return site.name === ours ? [] : [`${n}: 사이트 ${site.name}${site.form ? ` (${site.form})` : ''} / 이름표 ${ours ?? '(없음)'}`];
		}),
	};
	writeFileSync(new URL('cache/pokemonkorea/summary.json', root), JSON.stringify(summary, null, 1) + '\n');
	console.log(`data/dex-ko.json ${table.length}개 (종 ${nums.size}), 판:`, byVersion);
	console.log(`설명 없음 ${summary.noText.length}, 목록·상세 다름 ${problems.length}, 이름표와 못 맞춤 ${summary.unmatched.length}, 빠진 번호 ${missingNums.length} → cache/pokemonkorea/summary.json`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
