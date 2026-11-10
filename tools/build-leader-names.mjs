import { readFileSync, writeFileSync } from 'node:fs';

const LOC = new URL('../vendor/pokerogue/locales/', import.meta.url);
const OUT = new URL('../data/leader-names.json', import.meta.url);
const read = (lang, file) => JSON.parse(readFileSync(new URL(`${lang}/${file}`, LOC), 'utf8'));
const badges = JSON.parse(readFileSync(new URL('../data/badges.json', import.meta.url), 'utf8')).badges;
const en = read('en', 'trainer-names.json'), ja = read('ja', 'trainer-names.json');

const HAND_JA = {
	Ilima: 'イリマ',
	Lana: 'スイレン',
	Kiawe: 'カキ',
	Mallow: 'マオ',
	Sophocles: 'マーマネ',
	Mina: 'マツリカ',
	Nanu: 'クチナシ',
	Hapu: 'ハプウ',
	N: 'N',
};

const CHAMPIONS = {
	'kanto-champion': [['그린', 'Blue']],
	'johto-champion': [['목호', 'Lance']],
	'hoenn-champion': [['성호', 'Steven'], ['윤진', 'Wallace']],
	'sinnoh-champion': [['난천', 'Cynthia']],
	'unova-champion': [['노간주', 'Alder'], ['N', 'N', '엔']],
	'unova2-champion': [['아이리스', 'Iris']],
	'kalos-champion': [['카르네', 'Diantha']],
	'alola-champion': [['쿠쿠이', 'Kukui'], ['하우', 'Hau']],
	'galar-champion': [['단델', 'Leon']],
	'paldea-champion': [['테사', 'Geeta'], ['네모', 'Nemona']],
};

const plain = name => name.replace(/\s+/gu, ' ').trim().toLowerCase();
const keyOf = new Map(Object.entries(en).filter(([, name]) => typeof name === 'string').map(([key, name]) => [plain(name), key]));
const HAND = new Map(Object.entries(HAND_JA).map(([english, name]) => [plain(english), name]));

const japanese = english => {
	const key = keyOf.get(plain(english));
	return (key && typeof ja[key] === 'string' ? ja[key].trim() : '') || HAND.get(plain(english)) || '';
};

const out = {}, missing = [];
for (const badge of badges) {
	const names = [];
	for (const [, english] of badge.leaders ?? []) {
		const name = japanese(english);
		if (name) names.push(name); else missing.push(`${badge.id} ${english}`);
	}
	if (names.length) out[badge.id] = names;
}
const champions = {};
for (const badge of badges.filter(b => b.kind === 'champion')) {
	const list = CHAMPIONS[badge.id];
	if (!list) { missing.push(`${badge.id} (no champion)`); continue; }
	champions[badge.id] = list.map(([ko, english, ...more]) => {
		const name = japanese(english);
		if (!name) missing.push(`${badge.id} ${english}`);
		return [ko, english, name, ...more];
	});
}
for (const id of Object.keys(CHAMPIONS)) if (!badges.some(b => b.id === id && b.kind === 'champion')) missing.push(`${id} (not a champion entry of data/badges.json)`);

const table = {
	_source: 'tools/build-leader-names.mjs from vendor/pokerogue/locales/{en,ja}/trainer-names.json and its hand-written lists (HAND_JA - Japanese names PokeRogue does not have, with sources; CHAMPIONS) - ja: badge id -> the Japanese names of its leaders (data/badges.json order); champions: champion entry id -> [[Korean, English, Japanese, ...other spellings]] who is fought for the title',
	ja: out,
	champions,
};
const text = `${JSON.stringify(table, null, '\t')}\n`;
const summary = `${Object.keys(out).length} entries, ${Object.keys(champions).length} champion titles; no Japanese name: ${missing.join(', ') || 'none'}`;
if (process.argv.includes('--check')) {
	const same = readFileSync(OUT, 'utf8') === text;
	console.log(`data/leader-names.json ${same ? 'up to date' : 'differs from the tool - run node tools/build-leader-names.mjs'}: ${summary}`);
	if (!same || missing.length) process.exit(1);
} else {
	writeFileSync(OUT, text);
	console.log(`data/leader-names.json: ${summary}`);
}
