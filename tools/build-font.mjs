//   Battle font - CC BY-SA 3.0 per the font's own name table (crystalwalrein, FontStruct) (view/LICENSE-NOTE.md)
//   Galmuri11 - SIL Open Font License 1.1, Copyright (c) 2019-2025 Lee Minseo (data/fonts/OFL-Galmuri11.txt). Source is vendor/galmuri (pinned version fetched by tools/fetch-vendor.sh)
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { transformSync } from 'esbuild';
import { LANGS } from '../director/lang.js';

export const SOURCE = 'vendor/pokerogue/assets/fonts/pokemon-emerald-pro.ttf';
export const OUT = 'data/fonts/emerald-ko.woff2';
export const MANIFEST = 'data/fonts/emerald-ko.json';

export const GALMURI = Object.freeze({ family: 'PkbPixel', source: 'vendor/galmuri/Galmuri11.ttf', out: 'data/fonts/galmuri11.woff2', manifest: 'data/fonts/galmuri11.json' });

const NAME_JSON = [
	'data/names/species.json', 'data/names/moves.json', 'data/names/abilities.json', 'data/names/items.json',
	'data/items-outside.json', 'data/named-trainers.json', 'data/story-names.json',
];

const TEXT_JSON = [
	...LANGS.flatMap(lang => ['text', 'text-bag', 'text-effects', 'text-exp', 'text-summary'].map(name => `director/${name}-${lang}.json`)),
	...LANGS.map(lang => `view/text-${lang}.json`),
	...NAME_JSON,
];

const files = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(`${dir}/${e.name}`) : [`${dir}/${e.name}`]);
const isTextCode = f => /\.m?js$/.test(f) && !/\/test[-/]|\/mock\/|card-preview/.test(f);
const textCode = () => [...files('view'), ...files('director'), 'names/index.js', ...files('plugin/battle'), ...files('story')].filter(isTextCode);

const galmuriCode = () => [...files('story'), ...files('plugin/battle'), ...files('plugin/panel')].filter(isTextCode);

const strings = v => typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : [];
const isHangul = cp => cp >= 0xac00 && cp <= 0xd7a3;
const isAscii = cp => cp >= 0x20 && cp <= 0x7e;

function collect(json, code, extra = '') {
	const cps = new Set();
	for (let cp = 0x20; cp <= 0x7e; cp++) cps.add(cp);
	for (let cp = 0xac00; cp <= 0xd7a3; cp++) cps.add(cp);
	const add = text => { for (const c of text) { const cp = c.codePointAt(0); if (cp > 0x20) cps.add(cp); } };
	for (const file of json) strings(JSON.parse(readFileSync(file, 'utf8'))).forEach(add);
	for (const file of code) add(transformSync(readFileSync(file, 'utf8'), { loader: 'js', minifyWhitespace: true, legalComments: 'none', charset: 'utf8' }).code);
	add(extra);
	return [...cps].sort((a, b) => a - b);
}

// Characters the battle font subset must contain (code points, ascending)
export const fontText = () => collect(TEXT_JSON, textCode(), phaserTestString());

// Characters the Galmuri11 subset must contain (code points, ascending)
export const galmuriText = () => collect(NAME_JSON, galmuriCode());

function phaserTestString() {
	const source = readFileSync('node_modules/phaser/src/gameobjects/text/TextStyle.js', 'utf8');
	return /testString: \[ 'testString', '([^']+)' \]/.exec(source)[1];
}

export function toRanges(cps) {
	const out = [];
	for (let i = 0; i < cps.length; i++) {
		let j = i;
		while (cps[j + 1] === cps[j] + 1) j++;
		out.push(i === j ? cps[i].toString(16) : `${cps[i].toString(16)}-${cps[j].toString(16)}`);
		i = j;
	}
	return out.join(',');
}
export const fromRanges = text => text.split(',').flatMap(part => {
	const [a, b = a] = part.split('-').map(h => parseInt(h, 16));
	return Array.from({ length: b - a + 1 }, (_, i) => a + i);
});
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export function fontCodePoints(bytes) {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const u16 = at => view.getUint16(at), u32 = at => view.getUint32(at);
	const cmap = Array.from({ length: u16(4) }, (_, i) => 12 + 16 * i).find(at => u32(at) === 0x636d6170);
	if (cmap === undefined) throw new Error('글꼴에 cmap 표가 없다');
	const base = u32(cmap + 8), cps = new Set();
	for (let i = 0; i < u16(base + 2); i++) {
		const platform = u16(base + 4 + 8 * i), encoding = u16(base + 6 + 8 * i), at = base + u32(base + 8 + 8 * i);
		if (!(platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10)))) continue;
		if (u16(at) === 4) {
			const segs = u16(at + 6) / 2, ends = at + 14, starts = ends + 2 * segs + 2, deltas = starts + 2 * segs, ranges = deltas + 2 * segs;
			for (let s = 0; s < segs; s++) {
				const start = u16(starts + 2 * s), end = u16(ends + 2 * s), delta = u16(deltas + 2 * s), range = u16(ranges + 2 * s);
				for (let cp = start; cp <= end && cp !== 0xffff; cp++) {

					const raw = range ? u16(ranges + 2 * s + range + 2 * (cp - start)) : cp;
					if (raw && (raw + delta) & 0xffff) cps.add(cp);
				}
			}
		} else if (u16(at) === 12) {
			for (let g = 0; g < u32(at + 12); g++) {
				const start = u32(at + 16 + 12 * g), end = u32(at + 20 + 12 * g), glyph = u32(at + 24 + 12 * g);
				for (let cp = start; cp <= end; cp++) if (glyph + cp - start) cps.add(cp);
			}
		}
	}
	return cps;
}

function python(args) {
	for (const py of ['python3', 'python']) {
		const r = spawnSync(py, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
		if (r.error) continue;
		if (r.status !== 0) throw new Error(`${py} ${args[0]} ${args[1]} 실패: ${(r.stderr || r.stdout).trim().split('\n').at(-1)} (pip install fonttools brotli)`);
		return r.stdout;
	}
	throw new Error('python 이 없어 글꼴 조각을 다시 만들 수 없다 (python + pip install fonttools brotli)');
}

const JOBS = [
	{
		source: SOURCE, out: OUT, manifest: MANIFEST, text: fontText,

		options: ['--layout-features='],
		about: 'PokeRogue 에셋, 글꼴 라이선스 CC BY-SA 3.0 crystalwalrein',
	},
	{
		...GALMURI, text: galmuriText,

		options: [],
		about: 'Galmuri11 2.40.3, Copyright (c) 2019–2025 Lee Minseo (quiple@quiple.dev), SIL Open Font License 1.1 — data/fonts/OFL-Galmuri11.txt, https://github.com/quiple/galmuri',
	},
];

function subset({ source, out, manifest: file, text, options, about, family = null }) {
	if (!existsSync(source)) throw new Error(`${source} 가 없다 → tools/fetch-vendor.sh (윈도우 tools/fetch-vendor.ps1)`);
	const font = readFileSync(source), have = fontCodePoints(font);
	const needed = text();

	const kept = needed.filter(cp => have.has(cp)), cmap = toRanges(kept);
	const missing = String.fromCodePoint(...needed.filter(cp => !have.has(cp)));
	const sourceSha256 = sha256(font);
	const old = existsSync(file) && JSON.parse(readFileSync(file, 'utf8'));
	if (old && old.sourceSha256 === sourceSha256 && old.cmap === cmap && (old.family ?? null) === family && existsSync(out) && sha256(readFileSync(out)) === old.woff2Sha256) {
		console.log(`글꼴 조각 그대로: ${out} ${old.bytes} B, 글리프 ${old.glyphs}. 원본에 없는 글자 ${[...missing].length}: ${missing}`);
		return;
	}
	mkdirSync('data/fonts', { recursive: true });

	const noMirror = python(['-c', 'from fontTools.subset import Options; print(hasattr(Options(), "bidi_closure"))']).trim() === 'True' ? ['--no-bidi-closure'] : [];
	python(['-m', 'fontTools.subset', source, `--unicodes=${cmap}`, '--flavor=woff2', `--output-file=${out}`,
		...options, ...noMirror, '--name-IDs=*', '--name-languages=*']);

	if (family) python(['-c', 'import sys; from fontTools.ttLib import TTFont; f = TTFont(sys.argv[1]); fam = sys.argv[2]; '
		+ 'new = {1: fam, 3: fam + "-Regular", 4: fam, 6: fam + "-Regular", 16: fam, 21: fam}; '
		+ '[setattr(r, "string", new[r.nameID]) for r in f["name"].names if r.nameID in new]; f.save(sys.argv[1])', out, family]);
	const read = JSON.parse(python(['-c', 'import sys, json; from fontTools.ttLib import TTFont; f = TTFont(sys.argv[1]); '
		+ 'print(json.dumps({"glyphs": len(f.getGlyphOrder()), "cmap": sorted(f.getBestCmap())}))', out]));

	if (toRanges(read.cmap) !== cmap) throw new Error(`${out}: fontTools 가 남긴 글자(${toRanges(read.cmap)})가 원본 cmap 으로 센 글자(${cmap})와 다르다`);
	const bytes = readFileSync(out);
	const manifest = {
		_source: `tools/build-font.mjs: ${source} (${about}) 의 조각. 다시 만들기: node tools/build-font.mjs (python fontTools 필요)`,
		...(family && { family }), sourceSha256, woff2Sha256: sha256(bytes), bytes: bytes.length, glyphs: read.glyphs,
		cmap,
	};
	writeFileSync(file, `${JSON.stringify(manifest, null, '\t')}\n`);
	const other = read.cmap.filter(cp => !isHangul(cp) && !isAscii(cp));
	console.log(`글꼴 조각 ${out}: 글자 ${read.cmap.length} (한글 ${read.cmap.filter(isHangul).length} · ASCII ${read.cmap.filter(isAscii).length} · 그 밖 ${other.length}: ${String.fromCodePoint(...other)}), `
		+ `글리프 ${read.glyphs}, ${bytes.length} B. 원본에 없는 글자 ${[...missing].length} (대체 글꼴로 그려진다): ${missing}`);
}

if (import.meta.main) JOBS.forEach(subset);
