import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { showdownBrowser } from './showdown.mjs';
import { fieldAtlasesModule } from './field-atlases.mjs';
import { expTextBase64 } from '../director/text-exp-source.js';
import { LANGS } from '../director/lang.js';
import { langPath, langAtlasKey } from '../view/lang-images.js';
export { showdownBrowser };

export const PR_ASSETS = 'vendor/pokerogue/assets';

export function packBoxes(boxes) {
	return Object.fromEntries(Object.entries(boxes).map(([id, entry]) => [id, Object.fromEntries(Object.entries(entry).map(([side, [w, h, x, y, bw, bh, area]]) =>
		[side, x === 0 && y === 0 && bw === w && bh === h ? [w, h, area] : [w, h, x, y, bw, bh, area]]))]));
}
export const embeddedPokerogueBoxes = {
	name: 'embedded-pokerogue-boxes',
	setup(b) {
		b.onResolve({ filter: /^embedded:pokerogue-boxes$/ }, () => ({ path: 'boxes', namespace: 'embedded-pokerogue-boxes' }));
		b.onLoad({ filter: /.*/, namespace: 'embedded-pokerogue-boxes' }, () => ({
			contents: `const boxes = ${JSON.stringify(packBoxes(JSON.parse(readFileSync(new URL('../data/pokerogue-boxes.json', import.meta.url), 'utf8'))))};
for (const entry of Object.values(boxes)) for (const side in entry) if (entry[side].length === 3) { const [w, h, area] = entry[side]; entry[side] = [w, h, 0, 0, w, h, area]; }
export const POKEROGUE_BOXES = boxes;`,
			loader: 'js',
		}));
	},
};

export function pokemonIcons() {
	const keys = new Set(Object.values(JSON.parse(readFileSync(new URL('../data/pokerogue-sprite-map.json', import.meta.url), 'utf8'))).flat().filter(Boolean));
	const icons = {};
	for (let n = 0; n <= 9; n++) {
		const atlas = JSON.parse(readFileSync(`${PR_ASSETS}/images/pokemon_icons_${n}.json`, 'utf8'));
		for (const f of atlas.textures[0].frames) {
			if (f.sourceSize.w !== 40 || f.sourceSize.h !== 30 || f.rotated) throw new Error(`Unexpected icon frame: ${f.filename}`);
			const base = f.filename.replace(/^(\d+)s/, '$1').replace(/-f$/, '');
			if (!keys.has(base) && f.filename !== 'unknown') continue;
			icons[f.filename] = [n, f.frame.x, f.frame.y, f.frame.w, f.frame.h, f.spriteSourceSize.x, f.spriteSourceSize.y];
		}
	}
	return icons;
}

export function packPokemonIcons(icons) {
	const atlases = Array.from({ length: 10 }, () => [[], []]);
	for (const [name, [n, ...rect]] of Object.entries(icons)) { atlases[n][0].push(name); atlases[n][1].push(rect.join(',')); }
	return atlases.map(([names, rects]) => [names.join(','), rects.join(';')]);
}
const pokemonIconsModule = () => `const ICON_ATLASES = ${JSON.stringify(packPokemonIcons(pokemonIcons()))};
export const POKEMON_ICONS = {};
for (const [n, [names, rects]] of ICON_ATLASES.entries()) {
	const list = rects.split(';');
	for (const [i, name] of names.split(',').entries()) POKEMON_ICONS[name] = [n, ...list[i].split(',').map(Number)];
}`;

const LEGACY_UI_DIR = `${PR_ASSETS}/images/ui/legacy`;
function legacyUi() {
	const out = [];
	const walk = rel => {
		for (const entry of readdirSync(`${LEGACY_UI_DIR}/${rel}`, { withFileTypes: true })) {
			const path = rel ? `${rel}/${entry.name}` : entry.name;
			if (entry.isDirectory()) { if (!/^text_images\/[^/]+$/.test(path) || LANGS.includes(entry.name)) walk(path); }
			else if (entry.name.endsWith('.png')) out.push(path);
		}
	};
	walk('');
	return out.sort();
}

function legacyAtlases(files) {
	const out = {};
	for (const [key, path] of Object.entries(files)) {
		if (!path.startsWith('images/ui/')) continue;
		const legacy = `${PR_ASSETS}/images/ui/legacy/${path.slice('images/ui/'.length)}`;
		if (!existsSync(legacy)) continue;
		const atlas = JSON.parse(readFileSync(legacy, 'utf8'));
		if (key === 'bg') for (const texture of atlas.textures ?? []) for (const frame of texture.frames) if (frame.filename === 'bg') frame.filename = '1';
		out[key] = atlas;
	}
	return out;
}

export const FONT_FILES = {
	BattleViewEmerald: 'data/fonts/emerald-ko.woff2',
	PkbPixel: 'data/fonts/galmuri11.woff2',
};
export const embeddedFonts = {
	name: 'embedded-fonts',
	setup(b) {
		b.onResolve({ filter: /^embedded:fonts$/ }, () => ({ path: 'fonts', namespace: 'embedded-fonts' }));
		b.onLoad({ filter: /.*/, namespace: 'embedded-fonts' }, () => {
			const fonts = {}, watchFiles = [];
			for (const [name, file] of Object.entries(FONT_FILES)) {
				const path = fileURLToPath(new URL(`../${file}`, import.meta.url));
				fonts[name] = readFileSync(path).toString('base64');
				watchFiles.push(path);
			}
			return { contents: `export const FONTS = ${JSON.stringify(fonts)};`, loader: 'js', watchFiles };
		});
	},
};

function viewPlugin({ pokemonAtlases }) {
	return {
	name: 'embedded-view',
	setup(b) {
		embeddedFonts.setup(b);
		b.onResolve({ filter: /^embedded:view$/ }, () => ({ path: 'view', namespace: 'embedded-view' }));
		b.onLoad({ filter: /.*/, namespace: 'embedded-view' }, () => {
			const files = {
				overlay_hp: 'images/ui/overlay_hp.json', numbers: 'images/ui/numbers.json',
				statuses: 'images/statuses_ko.json', bg: 'images/ui/bg.json', pb: 'images/pb.json',
				types: 'images/types_ko.json', categories: 'images/categories.json',
				battle_stats: 'images/effects/battle_stats.json',

				party_slot_main: 'images/ui/party_slot_main.json', party_slot: 'images/ui/party_slot.json',
				party_pb: 'images/ui/party_pb.json', party_cancel: 'images/ui/party_cancel.json',
				party_slot_hp_overlay: 'images/ui/party_slot_hp_overlay.json', prompt: 'images/ui/prompt.json',

				// Stat stage panel (view/ui/battle-stats.js)
				pbinfo_stat_numbers: 'images/ui/pbinfo_stat_numbers.json', pbinfo_stat: 'images/ui/text_images/ko/battle_ui/pbinfo_stat_ko.json',

				button_tera: 'images/ui/button_tera.json',

				numbers_red: 'images/ui/numbers_red.json', summary_moves_cursor: 'images/ui/summary_moves_cursor.json',
			};
			if (pokemonAtlases) for (const id of ['25', '130']) {
				for (const direction of ['', 'back/']) for (const shiny of ['', 'shiny/']) {
					const path = `images/pokemon/${direction}${shiny}${id}`;
					files[path] = path + '.json';
				}
			}

			// Text image atlases of the other languages (view/lang-images.js)
			for (const [key, path] of Object.entries(files)) for (const lang of LANGS) if (langPath(path, lang) !== path) files[langAtlasKey(key, lang)] = langPath(path, lang);
			const atlases = Object.fromEntries(Object.entries(files).map(([key, path]) => [key, JSON.parse(readFileSync(`${PR_ASSETS}/${path}`, 'utf8'))]));

			return { contents: `export const VIEW_ATLASES = ${JSON.stringify(atlases)};\n${pokemonIconsModule()}`
				+ `\nexport const VIEW_LEGACY_ATLASES = ${JSON.stringify(legacyAtlases(files))};\nexport const LEGACY_UI = ${JSON.stringify(legacyUi())};`
				+ `\n${fieldAtlasesModule(PR_ASSETS)}`, loader: 'js' };
		});
	},
	};
}
export const embeddedView = viewPlugin({ pokemonAtlases: true });
const embeddedViewBattle = viewPlugin({ pokemonAtlases: false });

export const ANIM_CHUNKS = 16;
let animsCache;
function animFiles() {
	return readdirSync(`${PR_ASSETS}/battle-anims`).filter(f => f.endsWith('.json')).sort();
}
export const embeddedAnims = {
	name: 'embedded-anims',
	setup(b) {
		b.onResolve({ filter: /^embedded:anims$/ }, () => ({ path: 'anims', namespace: 'embedded-anims' }));
		b.onLoad({ filter: /.*/, namespace: 'embedded-anims' }, async () => {
			if (!animsCache) {
				const { encodeAnim } = await import('../view/anims/codec.js');
				const files = animFiles();
				const parts = files.map(f => Buffer.from(JSON.stringify(encodeAnim(JSON.parse(readFileSync(`${PR_ASSETS}/battle-anims/${f}`, 'utf8'))))));
				const total = parts.reduce((n, part) => n + part.length, 0);
				const chunks = [[]], ends = [];
				let size = 0, end = 0;
				parts.forEach((part, i) => {
					if (size >= total * chunks.length / ANIM_CHUNKS) { chunks.push([]); end = 0; }
					chunks.at(-1).push(i);
					size += part.length;
					ends.push(end += part.length);
				});
				animsCache = `export const ANIMS_GZ_B64 = ${JSON.stringify(chunks.map(c => gzipSync(Buffer.concat(c.map(i => parts[i])), { level: 9 }).toString('base64')))};
export const ANIM_FILES = ${JSON.stringify(chunks.map(c => c.map(i => files[i].slice(0, -5)).join(',')).join(';'))};
export const ANIM_ENDS = ${JSON.stringify(ends)};`;
			}
			return { contents: animsCache, loader: 'js' };
		});
	},
};

let animsJsonCache;
export const embeddedAnimsJson = {
	name: 'embedded-anims-json',
	setup(b) {
		b.onResolve({ filter: /^embedded:anims$/ }, () => ({ path: 'anims', namespace: 'embedded-anims-json' }));
		b.onLoad({ filter: /.*/, namespace: 'embedded-anims-json' }, () => {
			if (!animsJsonCache) {
				const anims = {};
				for (const f of animFiles()) anims[f] = JSON.parse(readFileSync(`${PR_ASSETS}/battle-anims/${f}`, 'utf8'));
				animsJsonCache = gzipSync(JSON.stringify(anims), { level: 9 }).toString('base64');
			}
			return { contents: `export const ANIMS_GZ_B64 = ${JSON.stringify(animsJsonCache)};`, loader: 'js' };
		});
	},
};

export const embeddedLevelUp = {
	name: 'embedded-levelup',
	setup(b) {
		b.onResolve({ filter: /^embedded:levelup$/ }, () => ({ path: 'levelup', namespace: 'embedded-levelup' }));
		b.onLoad({ filter: /.*/, namespace: 'embedded-levelup' }, () => ({
			contents: `export const LEVELUP_GZ_B64 = ${JSON.stringify(gzipSync(readFileSync(new URL('../data/levelup.json', import.meta.url)), { level: 9 }).toString('base64'))};`,
			loader: 'js',
		}));
	},
};

export const embeddedExpText = {
	name: 'embedded-exp-text',
	setup(b) {
		b.onResolve({ filter: /^\.\/text-exp-source\.js$/ }, () => ({ path: 'text-exp', namespace: 'embedded-exp-text' }));
		b.onLoad({ filter: /.*/, namespace: 'embedded-exp-text' }, () => ({
			contents: `const TEXT = ${JSON.stringify(Object.fromEntries(LANGS.map(lang => [lang, expTextBase64(lang)])))};\n`
				+ 'export function expTextBase64(lang) { return TEXT[lang]; }',
			loader: 'js',
			watchFiles: LANGS.map(lang => fileURLToPath(new URL(`../director/text-exp-${lang}.json`, import.meta.url))),
		}));
	},
};

export const cspGlobal = {
 name: 'csp-global',
 setup(b) {
  b.onLoad({ filter: /[/\\]phaser[/\\]dist[/\\]phaser\.js$/ }, a => {
   const source = readFileSync(a.path, 'utf8');
   const needle = "new Function('return this')()";
   if (source.split(needle).length !== 2) throw new Error('Phaser global fallback changed');
   return { contents: source.replace(needle, 'globalThis'), loader: 'js' };
  });
 },
};

export const embeddedExp = {
	name: 'embedded-exp',
	setup(b) {
		b.onResolve({ filter: /^embedded:exp$/ }, () => ({ path: 'exp', namespace: 'embedded-exp' }));
		b.onLoad({ filter: /.*/, namespace: 'embedded-exp' }, () => ({
			contents: `export const EXP_TABLE = ${readFileSync(new URL('../data/exp.json', import.meta.url), 'utf8')};`,
			loader: 'js',
		}));
	},
};

export function slimNameTable(path) {
	const table = JSON.parse(readFileSync(path, 'utf8'));

	const keepEn = /species\.json$/.test(path);
	const keepItemEn = /items\.json$/.test(path);
	return Object.fromEntries(Object.entries(table).map(([id, r]) => [id, Object.fromEntries(Object.entries({
		ko: r.ko || undefined, en: r.ko && !keepEn && !(keepItemEn && r.sim === false) ? undefined : r.en, type: r.type, anim: r.anim || undefined,
		move: r.move,
	}).filter(([, v]) => v !== undefined))]));
}

export function packMoveAnims(moves) {
	return Object.fromEntries(Object.entries(moves).map(([id, r]) => {
		if (r.anim === undefined) return [id, r];
		const stem = r.anim.replace(/\.json$/, ''), at = [];
		if (stem === r.anim || stem.replaceAll('-', '') !== id) throw new Error(`Move anim is not id with '-': ${id} ${r.anim}`);
		for (let i = 0, letters = 0; i < stem.length; i++) if (stem[i] === '-') at.push(letters); else letters++;
		return [id, { ...r, anim: at.join(',') }];
	}));
}
const unpackMoveAnims = `for (const [id, r] of Object.entries(moves)) if (r.anim !== undefined) {
	let name = id;
	for (const at of r.anim ? r.anim.split(',').map(Number).reverse() : []) name = name.slice(0, at) + '-' + name.slice(at);
	r.anim = name + '.json';
}`;
export const slimNames = {
	name: 'slim-names',
	setup(b) {
		b.onLoad({ filter: /[/\\]data[/\\]names[/\\](species|moves|abilities|items)\.json$/ }, a => {
			const slim = slimNameTable(a.path);
			if (!/moves\.json$/.test(a.path)) return { contents: JSON.stringify(slim), loader: 'json' };
			return { contents: `const moves = ${JSON.stringify(packMoveAnims(slim))};\n${unpackMoveAnims}\nexport default moves;`, loader: 'js' };
		});
	},
};

export function slimAiMoves(path) {
	const { source, moves, ...rest } = JSON.parse(readFileSync(path, 'utf8'));
	return { moves: Object.fromEntries(Object.entries(moves).map(([id, { line, ...entry }]) => [id, entry])), ...rest };
}
export const slimAiMoveTable = {
	name: 'slim-ai-moves',
	setup(b) {
		b.onLoad({ filter: /[/\\]ai[/\\]pokerogue-moves\.json$/ }, a => ({ contents: JSON.stringify(slimAiMoves(a.path)), loader: 'json' }));
	},
};

const PHASER_FLAGS = { CANVAS_RENDERER: false, WEBGL_RENDERER: true, WEBGL_DEBUG: false, EXPERIMENTAL: false,
	PLUGIN_3D: false, PLUGIN_CAMERA3D: false, PLUGIN_FBINSTANT: false, FEATURE_SOUND: false };

const PHASER_DROP = ['Physics', 'Tilemaps', 'Loader', 'Actions', 'Curves', 'Create'];

const PHASER_UNUSED_OBJECTS = /require\('\.\/(bitmaptext|blitter|domelement|extern|group|layer|particles|pathfollower|rendertexture|rope|zone|shader|mesh|pointlight|plane|shape\/(arc|curve|ellipse|grid|isobox|isotriangle|line|polygon|star|triangle))['/]/;
const PHASER_UNUSED_LINES = 67;

const definePhaserFlags = source => source.replace(/typeof (CANVAS_RENDERER|WEBGL_RENDERER|WEBGL_DEBUG|EXPERIMENTAL|PLUGIN_3D|PLUGIN_CAMERA3D|PLUGIN_FBINSTANT|FEATURE_SOUND)\b/g,
	(_, flag) => String(PHASER_FLAGS[flag]));
export const phaserSlim = {
	name: 'phaser-slim',
	setup(b) {
		const src = dirname(createRequire(import.meta.url).resolve('phaser/src/phaser.js'));
		b.onResolve({ filter: /^phaser$/ }, () => ({ path: 'phaser', namespace: 'phaser-slim' }));
		b.onLoad({ filter: /.*/, namespace: 'phaser-slim' }, () => {
			let entry = definePhaserFlags(readFileSync(`${src}/phaser.js`, 'utf8'));
			for (const name of PHASER_DROP) {
				const line = new RegExp(`\\n\\s*${name}: require\\('[^']+'\\),?`);
				if (!line.test(entry)) throw new Error(`Phaser entry changed: ${name}`);
				entry = entry.replace(line, '');
			}
			if (entry.split('global.Phaser = Phaser;').length !== 2) throw new Error('Phaser entry changed: global');
			return { contents: entry.replace('global.Phaser = Phaser;', 'globalThis.Phaser = Phaser;'), loader: 'js', resolveDir: src };
		});
		b.onLoad({ filter: /[/\\]phaser[/\\](src|plugins)[/\\].*\.js$/ }, a => {
			let source = definePhaserFlags(readFileSync(a.path, 'utf8'));
			if (/[/\\]src[/\\]gameobjects[/\\]index\.js$/.test(a.path)) {
				const before = source.split('\n').length;
				source = source.split('\n').filter(line => !PHASER_UNUSED_OBJECTS.test(line)).join('\n');
				if (before - source.split('\n').length !== PHASER_UNUSED_LINES) throw new Error(`Phaser gameobjects index changed: ${before - source.split('\n').length}`);
			}
			return { contents: source, loader: 'js' };
		});
	},
};

const PHASER_VAR = '__pokeBattlePhaser';
const phaserFromPrelude = {
	name: 'phaser-prelude',
	setup(b) {
		b.onResolve({ filter: /^phaser$/ }, () => ({ path: 'phaser', namespace: 'phaser-prelude' }));
		b.onLoad({ filter: /.*/, namespace: 'phaser-prelude' }, () => ({ contents: `module.exports = ${PHASER_VAR}();`, loader: 'js' }));
	},
};
export function phaserBuildOptions(extra = {}) {
	return {
		stdin: { contents: "module.exports = () => require('phaser');", resolveDir: process.cwd(), sourcefile: 'phaser-prelude.js' },
		bundle: true, minify: true, keepNames: false, format: 'iife', globalName: PHASER_VAR,
		platform: 'browser', target: 'es2022', charset: 'utf8', write: false, plugins: [phaserSlim], ...extra,
	};
}

export function battleBuildOptions(extra = {}) {
	return {

		entryPoints: ['plugin/battle/main.js'], bundle: true, minify: true, keepNames: true, format: 'iife',
		platform: 'browser', target: 'es2022', write: false,

		charset: 'utf8',
		plugins: [showdownBrowser, phaserFromPrelude, embeddedAnims, embeddedLevelUp, embeddedViewBattle, embeddedPokerogueBoxes, embeddedExp, embeddedExpText, slimNames, slimAiMoveTable],
		...extra,
	};
}

export const LICENSE_HEADER = `// SPDX-License-Identifier: AGPL-3.0-only
// License: GNU Affero General Public License v3.0 only (LICENSE in the source)
// Third-party notices: THIRD-PARTY-NOTICES.md in the source
`;

export async function buildBattle(extra = {}) {
	const [phaser, main] = await Promise.all([build(phaserBuildOptions(extra)), build(battleBuildOptions(extra))]);
	return { code: `${LICENSE_HEADER}${phaser.outputFiles[0].text}\n${main.outputFiles[0].text}`, phaser, main };
}
