import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { LOOK_PICTURES } from '../story/trainer-look.mjs';

const norm = s => String(s ?? '').normalize('NFKC').replace(/♀/g, 'f').replace(/♂/g, 'm').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

const PR = new URL('../vendor/pokerogue/', import.meta.url);
const read = path => readFileSync(new URL(path, PR), 'utf8');
const json = path => JSON.parse(read(path));
const LANGS = ['ko', 'en'];
const trainerNames = Object.fromEntries(LANGS.map(lang => [lang, json(`locales/${lang}/trainer-names.json`)]));
const titleText = Object.fromEntries(LANGS.map(lang => [lang, json(`locales/${lang}/trainer-titles.json`)]));
const classText = Object.fromEntries(LANGS.map(lang => [lang, json(`locales/${lang}/trainer-classes.json`)]));
const sprites = new Set(readdirSync(new URL('assets/images/trainer/', PR)).filter(f => f.endsWith('.png')).map(f => f.slice(0, -4)));

const camel = text => text.toLowerCase().replace(/[^a-z0-9]+(.)/g, (_, c) => c.toUpperCase()).replace(/[^a-zA-Z0-9]/g, '');
const PERSON_INIT = /\.(initForGymLeader|initForEliteFour|initForChampion|initForEvilTeamLeader|initForEvilTeamAdmin|initForStatTrainer|setTitle)\(/;

const source = read('src/data/trainers/trainer-config.ts');
const starts = [...source.matchAll(/^ {2}\[TrainerType\.([A-Z0-9_]+)\]: new TrainerConfig/gm)];
if (starts.length < 200) throw new Error(`trainer-config.ts 설정을 ${starts.length}개만 찾음 — 원본 모양이 바뀌었나`);
const candidates = [];

function callArgs(body, method) {
	const at = body.indexOf(`.${method}(`);
	if (at < 0) return null;
	const args = [];
	let depth = 0, quote = null, from = at + method.length + 2;
	for (let i = from; i < body.length; i++) {
		const c = body[i];
		if (quote) { if (c === '\\') i++; else if (c === quote) quote = null; continue; }
		if (c === '"' || c === "'" || c === '`') quote = c;
		else if ('([{'.includes(c)) depth++;
		else if (')]}'.includes(c) && depth) depth--;
		else if ((c === ',' || c === ')') && !depth) {
			args.push(body.slice(from, i).trim());
			from = i + 1;
			if (c === ')') return args.filter(Boolean);
		}
	}
	throw new Error(`${method}( 인수를 못 읽음`);
}
const TITLE_KEYS = new Set(Object.keys(json('locales/en/trainer-titles.json')));

function configGender(body) {
	const flag = arg => (arg === 'true' ? 'M' : arg === 'false' ? 'F' : null);
	for (const [method, at, fallback] of [['initForGymLeader', 1], ['initForEliteFour', 1], ['initForChampion', 0], ['initForStatTrainer', 0, 'false']]) {
		const args = callArgs(body, method);
		if (args) return flag(args[at] ?? fallback);
	}
	const title = callArgs(body, 'initForEvilTeamAdmin')?.[0]?.match(/^"([^"]+)"$/)?.[1];
	if (!title) return null;
	const key = camel(title.replace(/_/g, ' '));
	if (key.endsWith('Female')) return 'F';
	return TITLE_KEYS.has(`${key}Female`) ? 'M' : null;
}
for (const [i, start] of starts.entries()) {
	const body = source.slice(start.index, starts[i + 1]?.index ?? source.length);
	if (!PERSON_INIT.test(body)) continue;
	const type = start[1].toLowerCase();
	const named = body.match(/\.setName\("([^"]+)"\)/)?.[1];
	const key = named === 'Finn' ? 'rival' : named ? camel(named) : camel(type.replace(/_/g, ' '));
	const genders = body.match(/\.setHasGenders\((?:"([^"]*)")?/);
	const own = !named || camel(named) === camel(type.replace(/_/g, ' '));

	const music = body.match(/\.setMixedBattleBgm\("([^"]+)"\)/)?.[1] ?? null;
	const gender = configGender(body);
	const list = genders
		? [{ sprite: `${type}_m`, key, gender: 'M' }, { sprite: `${type}_f`, key: genders[1] === 'Ivy' ? 'rivalFemale' : genders[1] ? camel(genders[1]) : key, gender: 'F' }]
		: [{ sprite: type, key, gender }];
	for (const item of list) if (sprites.has(item.sprite) && trainerNames.ko[item.key] && trainerNames.en[item.key]) candidates.push({ ...item, own, music });
}

// One sprite per name key: those whose type name is the character (own) first
const byKey = new Map();
for (const item of candidates.sort((a, b) => Number(b.own) - Number(a.own))) if (!byKey.has(item.key)) byKey.set(item.key, item);
const dropped = candidates.filter(item => byKey.get(item.key) !== item).map(item => `${item.sprite}(→${byKey.get(item.key).sprite})`);

const titles = new Set();
for (const lang of LANGS) for (const text of Object.values(titleText[lang])) for (const word of text.split(/\s+/)) if (norm(word)) titles.add(norm(word));
const classes = new Set();
for (const lang of LANGS) for (const text of Object.values(classText[lang])) for (const part of text.split('&')) if (norm(part)) classes.add(norm(part));

const avatarSource = readFileSync(new URL('../vendor/pokemon-showdown/server/chat-commands/avatars.tsx', import.meta.url), 'utf8');
const avatars = new Set();
for (const [, list] of avatarSource.matchAll(/^const OFFICIAL_AVATARS\w* = new Set\(\[([\s\S]*?)\]\);/gm)) for (const [, id] of list.matchAll(/'([^']+)'/g)) avatars.add(id);
if (avatars.size < 1000) throw new Error(`Showdown 공식 그림을 ${avatars.size}개만 찾음 — avatars.tsx 모양이 바뀌었나`);
const SHOWDOWN_PICK = {
	agatha: 'agatha-lgpe', lorelei: 'lorelei-lgpe', archie: 'archie-gen6', maxie: 'maxie-gen6', phoebe: 'phoebe-gen6', drake: 'drake-gen3', nemona: 'nemona-v',
	victor: null,
};
for (const id of Object.values(SHOWDOWN_PICK)) if (id && !avatars.has(id)) throw new Error(`SHOWDOWN_PICK 의 ${id} 가 Showdown 그림에 없음`);
const showdownOf = sprite => (Object.hasOwn(SHOWDOWN_PICK, sprite) ? SHOWDOWN_PICK[sprite] : avatars.has(sprite.replace(/_/g, '')) ? sprite.replace(/_/g, '') : null);

const bgmFiles = new Set(readdirSync(new URL('assets/audio/bgm/', PR), { recursive: true }).map(f => f.replaceAll('\\', '/').replace(/\.mp3$/, '')));

const people = {}, names = {}, showdown = {}, music = {}, gender = {}, sourceGender = {};
const put = (name, sprite) => {
	const k = norm(name);
	if (!k) return;
	if (names[k] && names[k] !== sprite) throw new Error(`"${name}" 이 ${names[k]} 와 ${sprite} 둘에 걸림`);
	names[k] = sprite;
};
for (const { sprite, key, music: song, gender: known } of [...byKey.values()].sort((a, b) => a.sprite.localeCompare(b.sprite))) {
	people[sprite] = LANGS.map(lang => trainerNames[lang][key]);
	if (known) sourceGender[sprite] = known;
	const face = showdownOf(sprite);
	if (face) showdown[sprite] = face;
	if (song && song !== 'battle_trainer') {
		if (!bgmFiles.has(song)) throw new Error(`${sprite} 의 곡 ${song} 이 audio/bgm 에 없음`);
		music[sprite] = song;
	}
	for (const name of people[sprite]) {
		put(name, sprite);

		// If the name includes a title (e.g. Professor Kukui), also the name without it
		const k = norm(name);
		for (const title of titles) {
			if (k.length > title.length && k.endsWith(title)) put(k.slice(0, -title.length), sprite);
			if (k.length > title.length && k.startsWith(title)) put(k.slice(title.length), sprite);
		}
	}
}

const SHOWDOWN_TRAINER = 'showdown:';
const HAND_PEOPLE = {
	dawn: ['빛나', 'Dawn'], sonia: ['소니아', 'Sonia'], hop: ['호브', 'Hop'], lillie: ['릴리에', 'Lillie'], gladion: ['글라디오', 'Gladion'], 'arven-v': ['페퍼', 'Arven'],
	silver: ['실버', 'Silver'],
};
for (const [id, pair] of Object.entries(HAND_PEOPLE)) {
	if (!avatars.has(id)) throw new Error(`손으로 적은 인물의 Showdown 그림 ${id} 이 없음`);
	const sprite = SHOWDOWN_TRAINER + id;
	people[sprite] = pair;
	showdown[sprite] = id;
	for (const name of pair) put(name, sprite);
}

async function imageBounds(bytes, region = null) {
  const image = sharp(bytes);
  if (region) image.extract(region);
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width, top = info.height, right = 0, bottom = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (!data[(y * info.width + x) * info.channels + info.channels - 1]) continue;
    left = Math.min(left, x); top = Math.min(top, y);
    right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
  }
  if (right <= left || bottom <= top) throw new Error('empty trainer image');
  return [left + (region?.left ?? 0), top + (region?.top ?? 0), right - left, bottom - top, info.width, info.height];
}

const sheet = {}, SCENE = 80;
for (const sprite of Object.keys(people).filter(sprite => !showdown[sprite])) {
	const atlas = json(`assets/images/trainer/${sprite}.json`);
	const texture = atlas.textures?.[0] ?? atlas;
	const frames = Array.isArray(texture.frames) ? texture.frames : Object.entries(texture.frames).map(([filename, f]) => ({ filename, ...f }));
	const first = frames.filter(f => /^\d{4}\.png$/.test(f.filename)).sort((a, b) => a.filename.localeCompare(b.filename))[0];
	if (!first || first.rotated) throw new Error(`${sprite} 아틀라스 첫 장면을 못 읽음`);
	const size = texture.size ?? atlas.meta?.size;

	const W = Math.max(SCENE, first.sourceSize.w), H = Math.max(SCENE, first.sourceSize.h);
	const at = [first.spriteSourceSize.x + Math.floor((W - first.sourceSize.w) / 2), first.spriteSourceSize.y + (H - first.sourceSize.h)];
	const [x, y, w, h] = await imageBounds(readFileSync(new URL('assets/images/trainer/' + sprite + '.png', PR)),
    { left: first.frame.x, top: first.frame.y, width: first.frame.w, height: first.frame.h });
  sheet[sprite] = [x, y, w, h, size.w, size.h, at[0] + x - first.frame.x, at[1] + y - first.frame.y, W, H];
}

const GENDER_BY_HAND = {
	archie: 'M', atticus: 'M', colress: 'M', cyrus: 'M', eri: 'F', faba: 'M', ghetsis: 'M', giacomo: 'M', guzma: 'M', lusamine: 'F', lysandre: 'M',
	maxie: 'M', mela: 'F', oleana: 'F', ortega: 'M', penny: 'F', plumeria: 'F', rose: 'M', vicky: 'F', victor: 'M', victoria: 'F', vito: 'M', vivi: 'F',
	zinzolin: 'M', 'showdown:dawn': 'F', 'showdown:sonia': 'F', 'showdown:hop': 'M', 'showdown:lillie': 'F', 'showdown:gladion': 'M',
	'showdown:arven-v': 'M', 'showdown:silver': 'M',
};
for (const [sprite, value] of Object.entries(GENDER_BY_HAND)) {
	if (!people[sprite]) throw new Error(`손으로 적은 성별의 ${sprite} 가 인물 표에 없음`);
	if (sourceGender[sprite]) throw new Error(`${sprite} 성별은 원본에 있음 — 손 목록에서 뺄 것`);
	if (!['M', 'F'].includes(value)) throw new Error(`${sprite} 성별 ${value}`);
}
for (const sprite of Object.keys(people)) {
	const value = sourceGender[sprite] ?? GENDER_BY_HAND[sprite];
	if (value) gender[sprite] = value;
}

const rocketBgm = candidates.find(item => item.sprite === 'rocket_boss_giovanni_1')?.music;
if (!rocketBgm || !bgmFiles.has(rocketBgm)) throw new Error(`로켓단 보스 곡을 못 찾음: ${rocketBgm}`);

// A class name equal to a character name would make stripping erase that name - stop if they overlap
for (const k of classes) if (names[k]) throw new Error(`직업 이름 "${k}" 이 인물 ${names[k]} 이름과 같음`);

const output = new URL('../data/named-trainers.json', import.meta.url);
const previousBounds = JSON.parse(readFileSync(output, 'utf8')).faceBounds ?? {};
const faceBounds = {};
const faceIds = [...new Set([...Object.values(showdown), ...Object.values(LOOK_PICTURES).flat().map(row => row[1])])].sort();
const cache = new URL('../cache/trainer-faces/', import.meta.url);
mkdirSync(cache, { recursive: true });
let nextFace = 0;
await Promise.all(Array.from({ length: 8 }, async () => {
  while (nextFace < faceIds.length) {
    const id = faceIds[nextFace++];
    const cached = new URL(id + '.png', cache);
    if (!existsSync(cached) && previousBounds[id]) {
      faceBounds[id] = previousBounds[id];
      continue;
    }
    let bytes;
    if (existsSync(cached)) bytes = readFileSync(cached);
    else {
      const response = await fetch('https://play.pokemonshowdown.com/sprites/trainers/' + id + '.png', { signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error(id + ': HTTP ' + response.status);
      bytes = Buffer.from(await response.arrayBuffer());
    }
    faceBounds[id] = await imageBounds(bytes);
    if (!existsSync(cached)) writeFileSync(cached, bytes);
  }
}));
const orderedBounds = Object.fromEntries(faceIds.map(id => [id, faceBounds[id]]));
const table = { faceBounds: orderedBounds, people, names, titles: [...titles].sort(), showdown, music, sheet, gender, rocketBgm, classes: [...classes].sort() };
const text = JSON.stringify(table) + '\n';
writeFileSync(new URL('../data/named-trainers.json', import.meta.url), text);
console.log(`data/named-trainers.json: 인물 ${Object.keys(people).length}명, 이름 ${Object.keys(names).length}, 직함 낱말 ${titles.size}, ` +
	`Showdown 그림 ${Object.keys(showdown).length}, 인물 곡 ${Object.keys(music).length}, 직업 이름 ${classes.size}, ${Buffer.byteLength(text)} bytes`);
if (dropped.length) console.log(`  같은 이름이라 뺀 그림: ${dropped.join(', ')}`);
const noFace = Object.keys(people).filter(sprite => !showdown[sprite]), noSong = Object.keys(people).filter(sprite => !music[sprite]);
console.log(`  Showdown 그림 없음 (카드는 PokeRogue 첫 장면): ${noFace.join(', ')} · 로켓단 보스 곡 ${rocketBgm}`);
console.log(`  인물 곡 없음 (공통 보스 곡): ${noSong.join(', ')}`);
const noGender = Object.keys(people).filter(sprite => !gender[sprite]);
console.log(`  성별: 원본 ${Object.keys(sourceGender).length}, 손 목록 ${Object.keys(GENDER_BY_HAND).length}, 모름 ${noGender.length}${noGender.length ? ` (${noGender.join(', ')})` : ''}`);
