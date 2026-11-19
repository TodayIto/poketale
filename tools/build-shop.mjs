import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { csv, toID } from './sources.mjs';
import { OUTSIDE_ITEMS, MACHINE_IDS, isTm, isTr } from '../story/items.mjs';

const require = createRequire(import.meta.url);
const { Dex } = require('../vendor/pokemon-showdown/dist/sim/index.js');
const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const NAMES = JSON.parse(read('data/names/items.json'));
const source = JSON.parse(read('data/sources/pokeapi/source.json'));

const FIXED_PRICE = 10000;

const GEN3_PRICES = {

	pokeball: [200, 'E'], potion: [300, 'E'], antidote: [100, 'E'], paralyzeheal: [200, 'E'], awakening: [250, 'E'], burnheal: [250, 'E'], iceheal: [250, 'E'],
	escaperope: [550, 'E'], repel: [350, 'E'], oldrod: [1000, 'rule'], greatball: [600, 'E'], superpotion: [700, 'E'], superrepel: [500, 'E'], fullheal: [600, 'E'], revive: [1500, 'E'],
	ultraball: [1200, 'E'], hyperpotion: [1200, 'E'], maxrepel: [700, 'E'], maxpotion: [2500, 'E'], fullrestore: [3000, 'E'],

	xattack: [500, 'E'], xdefense: [550, 'E'], xspeed: [350, 'E'], xaccuracy: [950, 'E'], xspatk: [350, 'E'], xspdef: [350, 'P'], direhit: [650, 'E'], guardspec: [700, 'E'],
	blueflute: [100, 'E'], yellowflute: [200, 'E'], redflute: [300, 'E'],

	netball: [1000, 'E'], nestball: [1000, 'E'], repeatball: [1000, 'E'], timerball: [1000, 'E'], diveball: [1000, 'E'], luxuryball: [1000, 'E'],
	duskball: [1000, 'P'], quickball: [1000, 'P'], healball: [300, 'P'], premierball: [200, 'rule'],

	pewtercrunchies: [500, 'first'], ragecandybar: [300, 'first'], lavacookie: [200, 'E'], casteliacone: [200, 'first'], lumiosegalette: [250, 'first'],
	bigmalasada: [350, 'first'], energypowder: [500, 'E'], energyroot: [800, 'E'], healpowder: [450, 'E'], revivalherb: [2800, 'E'],

	hpup: [9800, 'E'], protein: [9800, 'E'], iron: [9800, 'E'], calcium: [9800, 'E'], zinc: [9800, 'E'], carbos: [9800, 'E'],
	firestone: [2100, 'E'], waterstone: [2100, 'E'], thunderstone: [2100, 'E'], leafstone: [2100, 'E'], sunstone: [2100, 'E'],
	moonstone: [2100, 'P'], shinystone: [2100, 'P'], duskstone: [2100, 'P'], dawnstone: [2100, 'P'], icestone: [2100, 'rule'],
	freshwater: [200, 'E'], sodapop: [300, 'E'], lemonade: [350, 'E'], pokedoll: [1000, 'E'], fluffytail: [1000, 'E'], poketoy: [1000, 'first'],

	luckincense: [9600, 'P'], pureincense: [9600, 'P'],
};

const MART_BADGES = [

	[0, ['pokeball', 'potion', 'antidote', 'paralyzeheal', 'awakening', 'burnheal', 'iceheal', 'escaperope', 'repel', 'oldrod']],
	[1, ['greatball', 'superpotion', 'superrepel']],
	[3, ['fullheal', 'revive']],
	[5, ['ultraball', 'hyperpotion', 'maxrepel']],
	[7, ['maxpotion']],
	[8, ['fullrestore']],
];

const BATTLE_GOODS = ['xattack', 'xdefense', 'xspeed', 'xaccuracy', 'xspatk', 'xspdef', 'direhit', 'guardspec', 'blueflute', 'yellowflute', 'redflute'];
const MART_POOL = [...BATTLE_GOODS,
	'netball', 'nestball', 'repeatball', 'timerball', 'diveball', 'duskball', 'quickball', 'healball', 'luxuryball'];

const HERBS = ['energypowder', 'energyroot', 'healpowder', 'revivalherb'];
const SPECIALTIES = [
	{ item: 'pewtercrunchies', region: 'kanto', towns: ['회색시티', 'Pewter City'] },
	{ item: 'ragecandybar', region: 'johto', towns: ['황토마을', 'Mahogany Town'] },
	{ item: 'lavacookie', region: 'hoenn', towns: ['굴뚝산', 'Mt. Chimney', 'Mount Chimney'] },
	{ item: 'casteliacone', region: 'unova', towns: ['구름시티', 'Castelia City'] },
	{ item: 'lumiosegalette', region: 'kalos', towns: ['미르시티', 'Lumiose City'] },
	{ item: 'bigmalasada', region: 'alola', towns: ['하우올리시티', "Hau'oli City", '말리에시티', 'Malie City', '로열애비뉴', 'Royal Avenue'] },
	...HERBS.map(item => ({ item, region: 'johto', towns: ['금빛시티', 'Goldenrod City'] })),
	...HERBS.map(item => ({ item, region: 'sinnoh', towns: ['영원시티', 'Eterna City'] })),
];

const SALE = { shareMin: 10, shareMax: 20, offMin: 10, offMax: 30, round: 10 };
const MART_PICKS = { min: 4, max: 6 };

const HELD_CHEAP = ['quickclaw', 'kingsrock', 'scopelens', 'widelens', 'brightpowder', 'shellbell', 'blacksludge', 'focusband', 'luckyegg', 'amuletcoin', 'soothebell',
	'charcoal', 'mysticwater', 'miracleseed', 'magnet', 'airballoon', 'lightclay', 'smokeball', 'luckincense', 'cleansetag', 'pureincense'];
const HELD_STRONG = ['leftovers', 'choiceband', 'choicescarf', 'choicespecs', 'lifeorb', 'focussash', 'assaultvest', 'rockyhelmet', 'expertbelt', 'eviolite',
	'weaknesspolicy', 'heavydutyboots'];
const VITAMINS = ['hpup', 'protein', 'iron', 'calcium', 'zinc', 'carbos'];

const DEPARTMENT = [
	{ pool: 'vitamins', items: VITAMINS },
	{ pool: 'battle', items: BATTLE_GOODS },
	{ pool: 'stones', items: ['firestone', 'waterstone', 'thunderstone', 'leafstone', 'moonstone', 'sunstone', 'shinystone', 'duskstone', 'dawnstone', 'icestone'] },
	{ pool: 'balls', items: ['healball', 'netball', 'diveball', 'nestball', 'duskball', 'quickball', 'timerball', 'repeatball', 'luxuryball'] },
	{ pool: 'goods', items: ['freshwater', 'sodapop', 'lemonade', 'pokedoll', 'fluffytail', 'poketoy'] },
	{ pool: 'held', items: HELD_CHEAP },
];
const DEPARTMENT_PICKS = { min: 10, max: 14 };

const OUTSIDE = JSON.parse(read('data/items-outside.json'));
const machinePrice = move => { const power = Dex.moves.get(move ?? '').basePower || 0; return power >= 90 ? 5000 : power >= 70 ? 4000 : 3000; };
const machineMove = id => (/^tm\d{3}$/.test(id) ? OUTSIDE.tms[Number(id.slice(2)) - 1] : /^tr\d{2}$/.test(id) ? OUTSIDE.trs[Number(id.slice(2))] : null);

const MEGA_STEP = { 100000: 30000, 70000: 20000, 50000: 15000, 30000: 10000 };
const MEGA_TIER = {

	venusaurite: 100000, charizarditex: 100000, charizarditey: 100000, blastoisinite: 100000, sceptilite: 100000, blazikenite: 100000, swampertite: 100000,
	mewtwonitex: 100000, mewtwonitey: 100000, latiasite: 100000, latiosite: 100000, diancite: 100000, tyranitarite: 100000, salamencite: 100000, metagrossite: 100000,
	meganiumite: 100000, feraligite: 100000, emboarite: 100000, chesnaughtite: 100000, delphoxite: 100000, greninjite: 100000, dragoninite: 100000,
	baxcalibrite: 100000, zygardite: 100000, darkranite: 100000, heatranite: 100000, magearnite: 100000, zeraorite: 100000,

	garchompite: 70000, steelixite: 70000, kangaskhanite: 70000, gyaradosite: 70000, alakazite: 70000, lucarionite: 70000, gardevoirite: 70000, galladite: 70000,
	aerodactylite: 70000, heracronite: 70000, mawilite: 70000, lopunnite: 70000, pinsirite: 70000,
	garchompitez: 70000, lucarionitez: 70000, barbaracite: 70000, chandelurite: 70000, eelektrossite: 70000, excadrite: 70000, floettite: 70000,
	glimmoranite: 70000, golisopite: 70000, hawluchanite: 70000, pyroarite: 70000, starminite: 70000,

	gengarite: 50000, abomasite: 50000, scizorite: 50000, absolite: 50000, aggronite: 50000, ampharosite: 50000, houndoominite: 50000, manectite: 50000,
	pidgeotite: 50000, sharpedonite: 50000, slowbronite: 50000, altarianite: 50000, beedrillite: 50000,
	absolitez: 50000, clefablite: 50000, crabominite: 50000, dragalgite: 50000, drampanite: 50000, falinksite: 50000, froslassite: 50000, golurkite: 50000,
	malamarite: 50000, raichunitex: 50000, raichunitey: 50000, scolipite: 50000, scovillainite: 50000, scraftinite: 50000, staraptite: 50000,
	tatsugirinite: 50000, victreebelite: 50000,

	medichamite: 30000, banettite: 30000, glalitite: 30000, cameruptite: 30000, sablenite: 30000, audinite: 30000,
	chimechite: 30000, meowsticite: 30000, skarmorite: 30000,
};
const MEGA_PRICE = Object.fromEntries(Object.entries(MEGA_TIER).map(([id, step]) => [id, MEGA_STEP[step]]));

const HELD_PRICE = {
	choiceband: 20000, choicespecs: 20000, choicescarf: 20000,
	lifeorb: 15000, assaultvest: 15000, focussash: 15000, leftovers: 15000, rockyhelmet: 15000, weaknesspolicy: 15000, eviolite: 15000,
	expertbelt: 10000, heavydutyboots: 10000,
};
const TMS = MACHINE_IDS.filter(id => isTm(id) && NAMES[id]);
const MEGA_STONES = Dex.items.all().filter(item => item.megaStone && NAMES[item.id] && item.isNonstandard !== 'CAP'
	&& Object.values(item.megaStone).every(forme => Dex.species.get(forme).exists)).map(item => item.id).sort();

const GIMMICK_KEY_PRICE = 50000;
const GIMMICK_GOODS = [
	{ gimmick: 'mega', tier: 'gimmick', items: MEGA_STONES, price: MEGA_PRICE },
	{ gimmick: 'tera', tier: 'gimmickKey', items: ['teraorb'], price: GIMMICK_KEY_PRICE },
];

const TRS = MACHINE_IDS.filter(id => isTr(id) && NAMES[id]);
const TR_SALE = { region: 'galar', shop: 'department', tier: 'tm', items: TRS };

const ROD_PRICE = { goodrod: 5000, superrod: 10000 };

const FORM_ITEM_PRICE = { griseouscore: 30000, adamantcrystal: 30000, lustrousglobe: 30000 };

const FLUTE_PRICE = 1000;
const SPECIALS = {
	mart: { count: [[1, 70], [2, 25], [3, 5]], tiers: [
		{ tier: 'tm', weight: 32, items: TMS },
		{ tier: 'vitamin', weight: 32, items: VITAMINS },
		{ tier: 'held', weight: 22, items: HELD_CHEAP },
		{ tier: 'rod', weight: 10, items: ['goodrod'], price: ROD_PRICE },
		{ tier: 'flute', weight: 4, items: ['pokeflute'], price: FLUTE_PRICE },
	] },

	department: { count: [[1, 40], [2, 45], [3, 15]], tiers: [
		{ tier: 'held', weight: 24, items: HELD_STRONG, price: HELD_PRICE },
		{ tier: 'form', weight: 4, items: Object.keys(FORM_ITEM_PRICE), price: FORM_ITEM_PRICE },
		{ tier: 'tm', weight: 22, items: TMS },
		{ tier: 'gimmick', weight: 25, gimmick: true },
		{ tier: 'gimmickKey', weight: 5, gimmick: true },
		{ tier: 'master', weight: 8, items: ['masterball'], price: 50000 },
		{ tier: 'rod', weight: 8, items: ['goodrod', 'superrod'], price: ROD_PRICE },
		{ tier: 'flute', weight: 4, items: ['pokeflute'], price: FLUTE_PRICE },
	] },
};
const GIMMICK_ITEMS = GIMMICK_GOODS.flatMap(g => g.items);
const SPECIAL_ONLY = new Set([...GIMMICK_ITEMS, 'masterball', ...TRS, ...Object.keys(ROD_PRICE), ...Object.keys(FORM_ITEM_PRICE), 'pokeflute']);

const PREMIER = 'premierball';

const FILE = 'items.csv';
const cost = new Map(csv(FILE).map(row => [toID(row.identifier), Number(row.cost)]));
const ids = [...new Set([...MART_BADGES.flatMap(([, list]) => list), ...MART_POOL, ...SPECIALTIES.map(s => s.item), ...DEPARTMENT.flatMap(p => p.items), PREMIER])];
for (const id of ids) if (SPECIAL_ONLY.has(id)) throw new Error(`${id}: 메가스톤·기믹 도구·기술레코드·마스터볼은 특별 상품에만`);
const prices = {}, fixed = [];
for (const id of ids) {
	if (!NAMES[id]) throw new Error(`${id}: 가방이 모르는 도구 (data/names/items.json 에 없음)`);
	const item = Dex.items.get(id);
	if (item.exists && (item.megaStone || item.zMove)) throw new Error(`${id}: 메가스톤·Z크리스탈은 진열하지 않음`);
	if (HELD_CHEAP.includes(id) && !GEN3_PRICES[id]) {
		if (!cost.has(id)) throw new Error(`${id}: PokeAPI ${FILE} 에 없음`);
		const price = cost.get(id);
		if (!Number.isInteger(price) || price < 0) throw new Error(`${id}: 값 ${price}`);
		if (price === 0) fixed.push(id);
		prices[id] = price || FIXED_PRICE;
		continue;
	}
	const [price] = GEN3_PRICES[id] ?? [];
	if (!Number.isInteger(price) || price <= 0) throw new Error(`${id}: 3세대 값 표(GEN3_PRICES)에 없음`);
	prices[id] = price;
}
for (const id of Object.keys(GEN3_PRICES)) if (!Object.hasOwn(prices, id)) throw new Error(`${id}: 진열에 없는 도구가 3세대 값 표에 있음`);
const held = new Set(DEPARTMENT.find(p => p.pool === 'held').items);
for (const id of [...MART_BADGES.flatMap(([, list]) => list), ...MART_POOL, ...SPECIALTIES.map(s => s.item)]) if (held.has(id)) throw new Error(`${id}: 지니는 도구는 백화점에만`);

const specialPrices = {};
const priceSpecial = (id, price) => {
	if (!NAMES[id]) throw new Error(`${id}: 가방이 모르는 도구 (data/names/items.json 에 없음)`);
	if (Dex.items.get(id).zMove) throw new Error(`${id}: Z크리스탈은 Z기술이 생길 때까지 팔지 않음`);
	const given = typeof price === 'object' ? price[id] : price;
	if (typeof price === 'object' && !given) throw new Error(`${id}: 값 표에 없음`);
	const move = machineMove(id);
	if (machineMove(id) === undefined || (move !== null && !Dex.moves.get(move).exists)) throw new Error(`${id}: 기술 표에 없는 기술머신·기술레코드`);
	specialPrices[id] = given ?? prices[id] ?? (move ? machinePrice(move) : (cost.get(id) || FIXED_PRICE));
};
for (const { tiers } of Object.values(SPECIALS)) {
	for (const { items = [], price } of tiers) for (const id of items) priceSpecial(id, price);
	if (tiers.reduce((sum, t) => sum + t.weight, 0) !== 100) throw new Error('특별 상품 등급 확률 합이 100 이 아님');
}
for (const { items, price, tier } of GIMMICK_GOODS) {
	if (!SPECIALS.department.tiers.some(t => t.tier === tier && t.gimmick)) throw new Error(`${tier}: 기믹 상품 등급이 백화점에 없음`);
	for (const id of items) priceSpecial(id, price);
}
for (const id of TRS) priceSpecial(id);

const trOf = new Map(TRS.map(id => [machineMove(id), id]));
const replaces = Object.fromEntries(TMS.filter(id => trOf.has(machineMove(id))).map(id => [id, trOf.get(machineMove(id))]));
for (const [tm, tr] of Object.entries(replaces)) if (specialPrices[tm] !== specialPrices[tr]) throw new Error(`${tr}: ${tm} 와 값이 다름`);

const SELL_FIXED = { expshare: 3000, abilitypatch: 50000,

  healthfeather: 300, musclefeather: 300, resistfeather: 300, geniusfeather: 300, cleverfeather: 300, swiftfeather: 300, prettyfeather: 1000 };
const sellPrices = Object.fromEntries(Object.keys(NAMES).sort()
	.filter(id => !Object.hasOwn(prices, id) && !Object.hasOwn(specialPrices, id) && (Object.hasOwn(SELL_FIXED, id) || (OUTSIDE_ITEMS[id]?.kind !== 'key' && cost.get(id) > 0)))
	.map(id => [id, SELL_FIXED[id] ?? cost.get(id)]));

writeFileSync(new URL('data/shop.json', root), `${JSON.stringify({
	source: `3세대 가게 값 (pret 디컴파일, tools/build-shop.mjs GEN3_PRICES) + PokeAPI ${source.commit.slice(0, 12)} data/v2/csv/${FILE} cost (싼 지니는 도구·팔기 값)`,
	note: '도구 id(Showdown) → 값. fixed = PokeAPI 값이 0 이라 정한 값(FIXED_PRICE)을 쓴 지니는 도구. sellPrices = 진열·특별 상품에 없는 도구의 원래 값(팔 때 반값). 진열 규칙은 story/shop.mjs',
	fixedPrice: FIXED_PRICE,
	fixed,
	premier: PREMIER,
	prices,
	mart: { basics: MART_BADGES.map(([badges, items]) => ({ badges, items })), picks: { ...MART_PICKS, items: MART_POOL } },
	specialties: SPECIALTIES.map(({ item, region, towns }) => ({ item, region, towns })),
	department: { picks: DEPARTMENT_PICKS, pools: DEPARTMENT },
	sale: SALE,
	specials: { ...Object.fromEntries(Object.entries(SPECIALS).map(([kind, { count, tiers }]) => [kind, {
		count, tiers: tiers.map(({ tier, weight, items, gimmick }) => ({ tier, weight, ...(gimmick ? { gimmick } : { items }) })),
	}])),
	gimmickGoods: GIMMICK_GOODS.map(({ gimmick, tier, items }) => ({ gimmick, tier, items })),
	trs: { ...TR_SALE, replaces },
	prices: specialPrices },
	sellPrices,
}, null, '\t')}\n`);
console.log(`가게 도구 ${ids.length}개, 특별 상품 ${Object.keys(specialPrices).length}개 (메가스톤 ${MEGA_STONES.length}, 기술레코드 ${TRS.length} — 기술머신 대신 ${Object.keys(replaces).length}), `
	+ `팔기 값만 ${Object.keys(sellPrices).length}개 → data/shop.json${fixed.length ? ` (값이 없어 ${FIXED_PRICE}: ${fixed.join(', ')})` : ''}`);
