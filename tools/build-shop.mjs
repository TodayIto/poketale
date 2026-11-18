import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { csv, toID } from './sources.mjs';
import { OUTSIDE_ITEMS } from '../story/items.mjs';
import { tmMove } from '../story/item-info.mjs';
import { MACHINE_STANDARDS } from '../story/machine-standards.mjs';

const require = createRequire(import.meta.url);
const { Dex } = require('../vendor/pokemon-showdown/dist/sim/index.js');
const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const NAMES = JSON.parse(read('data/names/items.json'));
const source = JSON.parse(read('data/sources/pokeapi/source.json'));

const FIXED_PRICE = 10000;

const MART_BADGES = [
	[0, ['pokeball', 'potion', 'antidote', 'paralyzeheal', 'awakening', 'burnheal', 'iceheal', 'escaperope', 'repel']],
	[1, ['greatball', 'superpotion', 'superrepel']],
	[3, ['fullheal', 'revive']],
	[5, ['ultraball', 'hyperpotion', 'maxrepel']],
	[7, ['maxpotion']],
	[8, ['fullrestore']],
];

const MART_POOL = ['xattack', 'xdefense', 'xspeed', 'xaccuracy', 'xspatk', 'xspdef', 'direhit',
	'netball', 'nestball', 'repeatball', 'timerball', 'diveball', 'duskball', 'quickball', 'healball', 'luxuryball'];

const HERBS = ['energypowder', 'energyroot', 'healpowder', 'revivalherb'];
const SPECIALTIES = [
	{ item: 'pewtercrunchies', region: 'kanto', towns: ['회색시티', 'Pewter City'], price: 250 },
	{ item: 'ragecandybar', region: 'johto', towns: ['황토마을', 'Mahogany Town'], price: 300 },
	{ item: 'lavacookie', region: 'hoenn', towns: ['굴뚝산', 'Mt. Chimney', 'Mount Chimney'], price: 200 },
	{ item: 'casteliacone', region: 'unova', towns: ['구름시티', 'Castelia City'], price: 100 },
	{ item: 'lumiosegalette', region: 'kalos', towns: ['미르시티', 'Lumiose City'], price: 200 },
	{ item: 'bigmalasada', region: 'alola', towns: ['하우올리시티', "Hau'oli City", '말리에시티', 'Malie City', '로열애비뉴', 'Royal Avenue'], price: 350 },
	...HERBS.map(item => ({ item, region: 'johto', towns: ['금빛시티', 'Goldenrod City'] })),
	...HERBS.map(item => ({ item, region: 'sinnoh', towns: ['영원시티', 'Eterna City'] })),
];

const SALE = { shareMin: 10, shareMax: 20, offMin: 10, offMax: 30, round: 10 };
const MART_PICKS = { min: 4, max: 6 };

const HELD_CHEAP = ['quickclaw', 'kingsrock', 'scopelens', 'widelens', 'brightpowder', 'shellbell', 'blacksludge', 'focusband', 'luckyegg', 'amuletcoin', 'soothebell',
	'charcoal', 'mysticwater', 'miracleseed', 'magnet', 'airballoon', 'lightclay'];
const HELD_STRONG = ['leftovers', 'choiceband', 'choicescarf', 'choicespecs', 'lifeorb', 'focussash', 'assaultvest', 'rockyhelmet', 'expertbelt', 'eviolite',
	'weaknesspolicy', 'heavydutyboots'];
const VITAMINS = ['hpup', 'protein', 'iron', 'calcium', 'zinc', 'carbos'];

const DEPARTMENT = [
	{ pool: 'vitamins', items: VITAMINS },
	{ pool: 'battle', items: ['xattack', 'xdefense', 'xspatk', 'xspdef', 'xspeed', 'xaccuracy', 'direhit'] },
	{ pool: 'stones', items: ['firestone', 'waterstone', 'thunderstone', 'leafstone', 'moonstone', 'sunstone', 'shinystone', 'duskstone', 'dawnstone', 'icestone'] },
	{ pool: 'balls', items: ['healball', 'netball', 'diveball', 'nestball', 'duskball', 'quickball', 'timerball', 'repeatball', 'luxuryball'] },
	{ pool: 'goods', items: ['freshwater', 'sodapop', 'lemonade', 'pokedoll'] },
	{ pool: 'held', items: HELD_CHEAP },
];
const DEPARTMENT_PICKS = { min: 10, max: 14 };

const tmPrice = id => { const power = Dex.moves.get(tmMove(id) ?? '').basePower || 0; return power >= 90 ? 5000 : power >= 70 ? 4000 : 3000; };

const MEGA_STEP = { 100000: 30000, 70000: 20000, 50000: 15000, 30000: 10000 };
const MEGA_TIER = {

	venusaurite: 100000, charizarditex: 100000, charizarditey: 100000, blastoisinite: 100000, sceptilite: 100000, blazikenite: 100000, swampertite: 100000,
	mewtwonitex: 100000, mewtwonitey: 100000, latiasite: 100000, latiosite: 100000, diancite: 100000, tyranitarite: 100000, salamencite: 100000, metagrossite: 100000,

	garchompite: 70000, steelixite: 70000, kangaskhanite: 70000, gyaradosite: 70000, alakazite: 70000, lucarionite: 70000, gardevoirite: 70000, galladite: 70000,
	aerodactylite: 70000, heracronite: 70000, mawilite: 70000, lopunnite: 70000, pinsirite: 70000,

	gengarite: 50000, abomasite: 50000, scizorite: 50000, absolite: 50000, aggronite: 50000, ampharosite: 50000, houndoominite: 50000, manectite: 50000,
	pidgeotite: 50000, sharpedonite: 50000, slowbronite: 50000, altarianite: 50000, beedrillite: 50000,

	medichamite: 30000, banettite: 30000, glalitite: 30000, cameruptite: 30000, sablenite: 30000, audinite: 30000,
};
const MEGA_PRICE = Object.fromEntries(Object.entries(MEGA_TIER).map(([id, step]) => [id, MEGA_STEP[step]]));

const HELD_PRICE = {
	choiceband: 20000, choicespecs: 20000, choicescarf: 20000,
	lifeorb: 15000, assaultvest: 15000, focussash: 15000, leftovers: 15000, rockyhelmet: 15000, weaknesspolicy: 15000, eviolite: 15000,
	expertbelt: 10000, heavydutyboots: 10000,
};
const TMS = Array.from({ length: 229 }, (_, i) => `tm${String(i + 1).padStart(3, '0')}`).filter(id => NAMES[id]);
const MEGA_STONES = Dex.items.all().filter(item => item.megaStone && NAMES[item.id] && !['Future', 'CAP'].includes(item.isNonstandard)
	&& Object.values(item.megaStone).every(forme => Dex.species.get(forme).exists)).map(item => item.id).sort();
const SPECIALS = {
	mart: { count: [[1, 70], [2, 25], [3, 5]], tiers: [
		{ tier: 'tm', weight: 40, items: TMS },
		{ tier: 'vitamin', weight: 35, items: VITAMINS },
		{ tier: 'held', weight: 25, items: HELD_CHEAP },
	] },
	department: { count: [[1, 40], [2, 45], [3, 15]], tiers: [
		{ tier: 'held', weight: 37, items: HELD_STRONG, price: HELD_PRICE },
		{ tier: 'tm', weight: 30, items: TMS },
		{ tier: 'mega', weight: 25, items: MEGA_STONES, price: MEGA_PRICE },
		{ tier: 'master', weight: 8, items: ['masterball'], price: 50000 },
	] },
};
const SPECIAL_ONLY = new Set([...MEGA_STONES, 'masterball']);

const PREMIER = 'premierball';

const FILE = 'items.csv';
const cost = new Map(csv(FILE).map(row => [toID(row.identifier), Number(row.cost)]));
const ids = [...new Set([...MART_BADGES.flatMap(([, list]) => list), ...MART_POOL, ...SPECIALTIES.map(s => s.item), ...DEPARTMENT.flatMap(p => p.items), PREMIER])];
for (const id of ids) if (SPECIAL_ONLY.has(id)) throw new Error(`${id}: 메가스톤·마스터볼은 특별 상품에만`);
const prices = {}, fixed = [];
for (const id of ids) {
	if (!NAMES[id]) throw new Error(`${id}: 가방이 모르는 도구 (data/names/items.json 에 없음)`);
	const item = Dex.items.get(id);
	if (item.exists && (item.megaStone || item.zMove)) throw new Error(`${id}: 메가스톤·Z크리스탈은 팔지 않음`);
	if (!cost.has(id)) throw new Error(`${id}: PokeAPI ${FILE} 에 없음`);
	const price = cost.get(id);
	if (!Number.isInteger(price) || price < 0) throw new Error(`${id}: 값 ${price}`);
	const given = SPECIALTIES.find(x => x.item === id && x.price)?.price;
	if (price === 0 && !given && id !== PREMIER) fixed.push(id);
	prices[id] = price || given || FIXED_PRICE;
}
const held = new Set(DEPARTMENT.find(p => p.pool === 'held').items);
for (const id of [...MART_BADGES.flatMap(([, list]) => list), ...MART_POOL, ...SPECIALTIES.map(s => s.item)]) if (held.has(id)) throw new Error(`${id}: 지니는 도구는 백화점에만`);

const specialPrices = {};
for (const { tiers } of Object.values(SPECIALS)) {
	for (const { items, price } of tiers) {
		for (const id of items) {
			if (!NAMES[id]) throw new Error(`${id}: 가방이 모르는 도구 (data/names/items.json 에 없음)`);
			if (Dex.items.get(id).zMove) throw new Error(`${id}: Z크리스탈은 팔지 않음`);
			const given = typeof price === 'object' ? price[id] : price;
			if (typeof price === 'object' && !given) throw new Error(`${id}: 값 표에 없음`);
			specialPrices[id] = given ?? prices[id] ?? (/^tm\d{3}$/.test(id) ? tmPrice(id) : (cost.get(id) || FIXED_PRICE));
		}
	}
	if (tiers.reduce((sum, t) => sum + t.weight, 0) !== 100) throw new Error('특별 상품 등급 확률 합이 100 이 아님');
}

// Prices by game (data/sources/game-prices.json, keyed by the disc standards of story/machine-standards.mjs) for the
// everyday goods (herbs, drinks and stones included); held items, priced town specialties and the Premier Ball keep
// PokéTale's own prices, and so do the special goods but the Vitamins (story/shop.mjs specialGoods). Kept only where
// they differ from today's.
const GAME_PRICES = JSON.parse(read('data/sources/game-prices.json'));
const ownPriced = new Set([...HELD_CHEAP, ...SPECIALTIES.filter(s => s.price).map(s => s.item), PREMIER]);
const games = {};
for (const [std, table] of Object.entries(GAME_PRICES.games)) {
	if (!MACHINE_STANDARDS[std]) throw new Error(`${std}: 기술머신 규격에 없는 게임`);
	const differ = Object.entries(table).filter(([id, price]) => Object.hasOwn(prices, id) && !ownPriced.has(id) && Number.isInteger(price) && price > 0 && price !== prices[id]);
	if (differ.length) games[std] = Object.fromEntries(differ.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

// The first generation each shop item appears in (PokeAPI item_game_indices.csv); the TMs sold are Scarlet/Violet's
// discs. Items of generation 1, and those PokeAPI has no game for, are left out (always on the shelves).
const itemIds = new Map(csv(FILE).map(row => [row.id, toID(row.identifier)]));
const firstGen = new Map();
for (const row of csv('item_game_indices.csv')) {
	const id = itemIds.get(row.item_id), gen = Number(row.generation_id);
	if (id && Number.isInteger(gen) && !(firstGen.get(id) <= gen)) firstGen.set(id, gen);
}
const shopIds = [...new Set([...ids, ...Object.keys(specialPrices)])].sort();
const since = Object.fromEntries(shopIds.map(id => [id, /^tm\d{3}$/.test(id) ? MACHINE_STANDARDS.sv.gen : firstGen.get(id)]).filter(([, gen]) => gen > 1));

const SELL_FIXED = { expshare: 3000 };
const sellPrices = Object.fromEntries(Object.keys(NAMES).sort()
	.filter(id => !Object.hasOwn(prices, id) && !Object.hasOwn(specialPrices, id) && (Object.hasOwn(SELL_FIXED, id) || (OUTSIDE_ITEMS[id]?.kind !== 'key' && cost.get(id) > 0)))
	.map(id => [id, SELL_FIXED[id] ?? cost.get(id)]));

writeFileSync(new URL('data/shop.json', root), `${JSON.stringify({
	source: `PokeAPI ${source.commit.slice(0, 12)} data/v2/csv/${FILE} cost and item_game_indices.csv; prices by game: data/sources/game-prices.json (tools/build-shop.mjs)`,
	note: '도구 id(PokéTale 가방 id, data/names/items.json — 대개 Showdown id와 같음) → 값. games = 게임별 값(오늘 값과 다른 것만, data/sources/game-prices.json), since = 그 도구가 처음 나온 세대(PokeAPI item_game_indices.csv, 파는 기술머신은 9). fixed = PokeAPI 값이 0 이라 정한 값(FIXED_PRICE)을 쓴 도구. sellPrices = 진열·특별 상품에 없는 도구의 원래 값(팔 때 반값). 진열 규칙은 story/shop.mjs',
	fixedPrice: FIXED_PRICE,
	fixed,
	premier: PREMIER,
	prices,
	mart: { basics: MART_BADGES.map(([badges, items]) => ({ badges, items })), picks: { ...MART_PICKS, items: MART_POOL } },
	specialties: SPECIALTIES.map(({ item, region, towns }) => ({ item, region, towns })),
	department: { picks: DEPARTMENT_PICKS, pools: DEPARTMENT },
	sale: SALE,
	specials: { ...Object.fromEntries(Object.entries(SPECIALS).map(([kind, { count, tiers }]) => [kind, { count, tiers: tiers.map(({ tier, weight, items }) => ({ tier, weight, items })) }])),
		prices: specialPrices },
	sellPrices,
	games,
	since,
}, null, '\t')}\n`);
console.log(`가게 도구 ${ids.length}개, 팔기 값만 ${Object.keys(sellPrices).length}개 → data/shop.json${fixed.length ? ` (값이 없어 ${FIXED_PRICE}: ${fixed.join(', ')})` : ''}`);
