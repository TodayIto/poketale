import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { csv, toID, englishID } from './sources.mjs';
import { readSources as readFishingSources, koreanNames, rows as fishingRows } from './build-fishing.mjs';
import { laterPrice, roundStep } from './shop-price.mjs';
import { OUTSIDE_ITEMS, MACHINE_IDS, Z_CRYSTALS, isTm, isTr } from '../story/items.mjs';
import { tmMove, machinesOf } from '../story/item-info.mjs';
import { STANDARD_IDS, machineUsedUp, isMachineId, machineOrder } from '../story/machine-standards.mjs';
import { inGen } from '../engine/mon.mjs';

const require = createRequire(import.meta.url);
const { Dex } = require('../vendor/pokemon-showdown/dist/sim/index.js');
const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const NAMES = JSON.parse(read('data/names/items.json'));
const source = JSON.parse(read('data/sources/pokeapi/source.json'));
const words = text => text.split(/\s+/).filter(Boolean);
const named = re => Object.keys(NAMES).filter(id => re.test(id)).sort();

const GEN3_PRICES = {
	// Poke Mart basics
	pokeball: [200, 'E'], potion: [300, 'E'], antidote: [100, 'E'], paralyzeheal: [200, 'E'], awakening: [250, 'E'], burnheal: [250, 'E'], iceheal: [250, 'E'],
	escaperope: [550, 'E'], repel: [350, 'E'], greatball: [600, 'E'], superpotion: [700, 'E'], superrepel: [500, 'E'], fullheal: [600, 'E'], revive: [1500, 'E'],
	ultraball: [1200, 'E'], hyperpotion: [1200, 'E'], maxrepel: [700, 'E'], maxpotion: [2500, 'E'], fullrestore: [3000, 'E'],
	// battle items
	xattack: [500, 'E'], xdefense: [550, 'E'], xspeed: [350, 'E'], xaccuracy: [950, 'E'], xspatk: [350, 'E'], xspdef: [350, 'P'], direhit: [650, 'E'], guardspec: [700, 'E'],
	blueflute: [100, 'E'], yellowflute: [200, 'E'], redflute: [300, 'E'],
	// balls
	netball: [1000, 'E'], nestball: [1000, 'E'], repeatball: [1000, 'E'], timerball: [1000, 'E'], diveball: [1000, 'E'], luxuryball: [1000, 'E'],
	duskball: [1000, 'P'], quickball: [1000, 'P'], healball: [300, 'P'], premierball: [200, 'rule'],
	// town specialties and herbs
	pewtercrunchies: [500, 'first'], ragecandybar: [300, 'first'], lavacookie: [200, 'E'], casteliacone: [200, 'first'], lumiosegalette: [250, 'first'],
	bigmalasada: [350, 'first'], energypowder: [500, 'E'], energyroot: [800, 'E'], healpowder: [450, 'E'], revivalherb: [2800, 'E'], honey: [100, 'P'],
	// department store
	hpup: [9800, 'E'], protein: [9800, 'E'], iron: [9800, 'E'], calcium: [9800, 'E'], zinc: [9800, 'E'], carbos: [9800, 'E'],
	firestone: [2100, 'E'], waterstone: [2100, 'E'], thunderstone: [2100, 'E'], leafstone: [2100, 'E'], sunstone: [2100, 'E'],
	moonstone: [2100, 'P'], shinystone: [2100, 'P'], duskstone: [2100, 'P'], dawnstone: [2100, 'P'], icestone: [2100, 'rule'],
	freshwater: [200, 'E'], sodapop: [300, 'E'], lemonade: [350, 'E'], pokedoll: [1000, 'E'], fluffytail: [1000, 'E'], poketoy: [1000, 'first'],
};

const LATER_PRICES = {
	...Object.fromEntries(words('punchingglove razorclaw smokeball utilityumbrella terrainextender airballoon scopelens metronome protectivepads toxicorb flameorb')
		.map(id => [id, [15000, 'SV']])),
	...Object.fromEntries(words('focusband gripclaw kingsrock mentalherb bigroot blacksludge stickybarb ringtarget zoomlens').map(id => [id, [10000, 'SV']])),
	...Object.fromEntries(words('quickclaw muscleband wiseglasses heatrock damprock smoothrock icyrock').map(id => [id, [8000, 'SV']])),
	...Object.fromEntries(words('soothebell absorbbulb cellbattery luminousmoss snowball adrenalineorb').map(id => [id, [5000, 'SV']])),
	...Object.fromEntries(words('powerweight powerbracer powerbelt powerlens powerband poweranklet').map(id => [id, [10000, 'SV']])),
	everstone: [3000, 'SV'], metalcoat: [3000, 'SV'], ovalstone: [2000, 'PLA'],
	luckincense: [9600, 'BW'], pureincense: [9600, 'BW'],
	seaincense: [2000, 'SM'], roseincense: [2000, 'SM'], rockincense: [2000, 'SM'], oddincense: [2000, 'SM'], waveincense: [2000, 'SM'],
	laxincense: [5000, 'SM'], fullincense: [5000, 'SM'],
	expcandys: [1600, 'PLA'], expcandym: [6000, 'PLA'], expcandyl: [18000, 'PLA'], expcandyxl: [50000, 'PLA'],
};

/** Step 1 only: the item must be in GEN3_PRICES */
const gen3 = { step: 1 };

const same = (of, why, k = 1) => ({ step: 2, of, k, why });

const later = (p, why, k = 1) => ({ step: 3, p, k, why });
/** Step 3: the item's own later price (LATER_PRICES) */
const own = { step: 3, own: true };

const stepOf = (table, why) => ({ step: 3, table, why });
/** Step 4: a value */
const value = (p, why) => ({ step: 4, p, why });
/** Discs: the power rule (machinePrice) */
const disc = { step: 'disc' };

const machinePrice = move => { const power = Dex.moves.get(move ?? '').basePower || 0; return power >= 90 ? 5000 : power >= 70 ? 4000 : 3000; };
const machineMove = id => (isTm(id) ? tmMove(id) : null);
const REUSABLE_TIMES = 10;
const discPrice = id => machinePrice(machineMove(id)) * (machineUsedUp(id) ? 1 : REUSABLE_TIMES);
const TMS = MACHINE_IDS.filter(id => !isTr(id) && NAMES[id]);

const TRS = MACHINE_IDS.filter(id => isTr(id) && NAMES[id]);

const MACHINE_SALE = Object.fromEntries(STANDARD_IDS.map(std => {
	const discs = machinesOf(std).filter(d => NAMES[d.id]).map(d => d.id);
	return [std, { mart: discs.filter(id => !isTr(id)), department: discs }];
}));

const MEGA_TIER = {
	// 100k: starters, legendary and mythical, pseudo-legendary
	venusaurite: 100000, charizarditex: 100000, charizarditey: 100000, blastoisinite: 100000, sceptilite: 100000, blazikenite: 100000, swampertite: 100000,
	mewtwonitex: 100000, mewtwonitey: 100000, latiasite: 100000, latiosite: 100000, diancite: 100000, tyranitarite: 100000, salamencite: 100000, metagrossite: 100000,
	meganiumite: 100000, feraligite: 100000, emboarite: 100000, chesnaughtite: 100000, delphoxite: 100000, greninjite: 100000, dragoninite: 100000,
	baxcalibrite: 100000, zygardite: 100000, darkranite: 100000, heatranite: 100000, magearnite: 100000, zeraorite: 100000,
	// 70k: strong fully evolved
	garchompite: 70000, steelixite: 70000, kangaskhanite: 70000, gyaradosite: 70000, alakazite: 70000, lucarionite: 70000, gardevoirite: 70000, galladite: 70000,
	aerodactylite: 70000, heracronite: 70000, mawilite: 70000, lopunnite: 70000, pinsirite: 70000,
	garchompitez: 70000, lucarionitez: 70000, barbaracite: 70000, chandelurite: 70000, eelektrossite: 70000, excadrite: 70000, floettite: 70000,
	glimmoranite: 70000, golisopite: 70000, hawluchanite: 70000, pyroarite: 70000, starminite: 70000,
	// 50k: others
	gengarite: 50000, abomasite: 50000, scizorite: 50000, absolite: 50000, aggronite: 50000, ampharosite: 50000, houndoominite: 50000, manectite: 50000,
	pidgeotite: 50000, sharpedonite: 50000, slowbronite: 50000, altarianite: 50000, beedrillite: 50000,
	absolitez: 50000, clefablite: 50000, crabominite: 50000, dragalgite: 50000, drampanite: 50000, falinksite: 50000, froslassite: 50000, golurkite: 50000,
	malamarite: 50000, raichunitex: 50000, raichunitey: 50000, scolipite: 50000, scovillainite: 50000, scraftinite: 50000, staraptite: 50000,
	tatsugirinite: 50000, victreebelite: 50000,
	// 30k: the weakest
	medichamite: 30000, banettite: 30000, glalitite: 30000, cameruptite: 30000, sablenite: 30000, audinite: 30000,
	chimechite: 30000, meowsticite: 30000, skarmorite: 30000,
};
const MEGA_STONES = Dex.items.all().filter(item => item.megaStone && NAMES[item.id] && item.isNonstandard !== 'CAP'
	&& Object.values(item.megaStone).every(forme => Dex.species.get(forme).exists)).map(item => item.id).sort();

const TYPE_Z = Z_CRYSTALS.filter(id => Dex.items.get(id).zMove === true);
const Z_TIER = {
	...Object.fromEntries(TYPE_Z.map(id => [id, 50000])),
	decidiumz: 100000, inciniumz: 100000, primariumz: 100000, kommoniumz: 100000, solganiumz: 100000, lunaliumz: 100000, ultranecroziumz: 100000,
	tapuniumz: 100000, mewniumz: 100000, marshadiumz: 100000,
	snorliumz: 85000,
	pikaniumz: 70000, pikashuniumz: 70000, eeviumz: 70000, aloraichiumz: 70000, lycaniumz: 70000, mimikiumz: 70000,
};
for (const id of Z_CRYSTALS) if (!Dex.items.get(id).zMove) throw new Error(`${id}: Showdown 에 Z크리스탈이 아님`);
for (const id of Object.keys(Z_TIER)) if (!Z_CRYSTALS.includes(id)) throw new Error(`${id}: Z크리스탈이 아님`);
/** Tickets by the Legends: Z-A step: the cheaper, the more often */
const STEP_TICKETS = { 30000: 3, 50000: 2, 70000: 1.5, 85000: 1.2, 100000: 1 };
const stepTickets = table => Object.fromEntries(Object.entries(table).map(([id, step]) => [id, STEP_TICKETS[step]]));

const CATEGORIES = [];
const category = (key, place, items, options = {}) => CATEGORIES.push({ key, place, items: typeof items === 'string' ? words(items) : items, ...options });

// department shelf (10-14 picks a week)
category('vitamins', 'shelf', 'hpup protein iron calcium zinc carbos', { tickets: 3, price: gen3 });
category('battle', 'shelf', 'xattack xdefense xspeed xaccuracy xspatk xspdef direhit guardspec blueflute yellowflute redflute', { tickets: 3, price: gen3 });
category('stones', 'shelf', 'firestone waterstone thunderstone leafstone moonstone sunstone shinystone duskstone dawnstone icestone', { tickets: 3, price: gen3 });
category('balls', 'shelf', 'healball netball diveball nestball duskball quickball timerball repeatball luxuryball', { tickets: 3, price: gen3 });
category('goods', 'shelf', 'freshwater sodapop lemonade pokedoll fluffytail poketoy', { tickets: 2, price: gen3 });
category('heldMid', 'shelf', 'punchingglove razorclaw smokeball utilityumbrella terrainextender airballoon scopelens metronome protectivepads toxicorb flameorb '
	+ 'focusband gripclaw kingsrock mentalherb bigroot blacksludge stickybarb ringtarget zoomlens', { tickets: 1, cap: 12, price: own });
category('heldCheap', 'shelf', 'quickclaw muscleband wiseglasses heatrock damprock smoothrock icyrock soothebell absorbbulb cellbattery luminousmoss snowball adrenalineorb',
	{ tickets: 1.5, cap: 12, price: own });
category('typeBoost', 'shelf', 'charcoal mysticwater miracleseed magnet silkscarf sharpbeak silverpowder hardstone poisonbarb spelltag dragonfang softsand blackglasses '
	+ 'blackbelt nevermeltice twistedspoon fairyfeather', { tickets: 1, cap: 8, price: later(3000, 'SV 3,000 (type boosters)') });
category('training', 'shelf', 'powerweight powerbracer powerbelt powerlens powerband poweranklet everstone', { tickets: 1, cap: 6, price: own });
category('incense', 'shelf', 'luckincense pureincense seaincense laxincense roseincense rockincense oddincense fullincense waveincense', { tickets: 1, cap: 6, price: own });
category('evoPLA', 'shelf', 'upgrade electirizer magmarizer razorfang protector reapercloth ovalstone metalcoat', { tickets: 1.5, cap: 8,
	price: same('firestone', 'same family: evolution stones'), prices: { ovalstone: own, metalcoat: own } });
category('apples', 'shelf', 'sweetapple tartapple', { tickets: 1, price: later(2200, 'SV 2,200') });
category('ppup', 'shelf', ['ppup'], { tickets: 2, price: later(10000, 'SV 10,000') });
category('maxrevive', 'shelf', ['maxrevive'], { tickets: 2, price: later(3000, 'PLA 3,000') });
category('expcandy', 'shelf', 'expcandyxs expcandys expcandym expcandyl expcandyxl', { tickets: 1, price: own, prices: { expcandyxs: same('expcandys', 'tied: 1/8 of S', 1 / 8) } });
category('normalgem', 'shelf', ['normalgem'], { tickets: 1, price: later(15000, 'SV 15,000') });
category('nectar', 'shelf', 'rednectar yellownectar pinknectar purplenectar', { tickets: 0.5, price: later(300, 'SV 300') });
// the modern berries (Gen 2's are duplicates, never sold - UNSOLD)
const GEN2_BERRIES = words('berry bitterberry burntberry goldberry iceberry mintberry miracleberry mysteryberry przcureberry psncureberry');
category('berries', 'shelf', named(/berry$/).filter(id => !GEN2_BERRIES.includes(id)), { tickets: 0.25, cap: 4, price: value(200, 'Z-A 80-600 (family 200)') });

// department special goods (2-4 a week)
category('choice', 'special', 'choiceband choicespecs choicescarf', { tickets: 2, price: later(100000, 'SV 100,000') });
category('heldTop', 'special', 'lifeorb focussash assaultvest rockyhelmet eviolite weaknesspolicy', { tickets: 3, price: later(50000, 'SV 50,000') });
category('heldStrong', 'special', 'expertbelt clearamulet blunderpolicy redcard ejectbutton ejectpack powerherb mirrorherb brightpowder',
	{ tickets: 4, cap: 24, price: later(30000, 'SV 30,000') });
category('heldGood', 'special', 'leftovers heavydutyboots abilityshield covertcloak loadeddice throatspray destinyknot lightclay shedshell whiteherb electricseed '
	+ 'psychicseed mistyseed grassyseed widelens shellbell safetygoggles roomservice ironball laggingtail bindingband', { tickets: 5, cap: 30, price: later(20000, 'SV 20,000') });
category('neverSoldHeld', 'special', 'luckyegg amuletcoin boosterenergy floatstone machobrace cleansetag', {
	tickets: { luckyegg: 6, amuletcoin: 6, boosterenergy: 6, floatstone: 10, machobrace: 10, cleansetag: 10 },
	prices: { luckyegg: same('lifeorb', 'tied: Top-held level'), amuletcoin: same('lifeorb', 'tied: Top-held level'), boosterenergy: same('expertbelt', 'tied: Strong-held level'),
		floatstone: same('focusband', 'tied: mid-held level'), machobrace: same('powerweight', 'same effect: Power items'), cleansetag: value(500, 'value step') } });
category('speciesHeld', 'special', 'lightball thickclub leek luckypunch metalpowder quickpowder deepseatooth deepseascale',
	{ tickets: 8, cap: 32, price: later(10000, 'SV 10,000 (mid-held level)') });
category('gems', 'special', named(/gem$/).filter(id => id !== 'normalgem'), { tickets: 5, cap: 24, price: same('normalgem', 'same family: Normal Gem') });
category('evoRare', 'special', 'dubiousdisc dragonscale prismscale whippeddream sachet linkingcord syrupyapple crackedpot chippedpot unremarkableteacup masterpieceteacup '
	+ 'galaricacuff galaricawreath blackaugurite peatblock auspiciousarmor maliciousarmor metalalloy berrysweet cloversweet flowersweet lovesweet ribbonsweet starsweet '
	+ 'strawberrysweet', { tickets: 5, cap: 30, price: same('firestone', 'same family: evolution stones') });
category('ppRare', 'special', 'ether maxether elixir maxelixir ppmax', { tickets: { ether: 8, maxether: 8, elixir: 8, maxelixir: 8, ppmax: 4 },
	prices: { ether: value(1200, 'Gen 3 item data'), maxether: value(2000, 'Gen 3 item data'), elixir: value(3000, 'Gen 3 item data'), maxelixir: value(4500, 'Gen 3 item data'),
		ppmax: value(9800, 'Gen 3 item data (no game sells it)') } });
category('medicineRare', 'special', 'sweetheart berryjuice oldgateau', { tickets: 8,
	prices: { sweetheart: same('potion', 'same effect: Potion'), berryjuice: same('potion', 'same effect: Potion'), oldgateau: same('fullheal', 'same effect: Full Heal') } });
category('rarecandy', 'special', ['rarecandy'], { tickets: 12, price: value(4800, 'Gen 3 item data') });
category('sacredash', 'special', ['sacredash'], { tickets: 3, price: later(100000, 'value: a Mega top step') });
category('evFeather', 'special', 'healthfeather musclefeather resistfeather geniusfeather cleverfeather swiftfeather', { tickets: 6, cap: 24,
	price: value(1000, 'same effect: 1/10 of a vitamin') });
category('evMochi', 'special', 'healthmochi musclemochi resistmochi geniusmochi clevermochi swiftmochi freshstartmochi', { tickets: 3, price: same('hpup', 'same effect: a vitamin') });
category('mints', 'special', named(/mint$/), { tickets: 3, cap: 24, price: later(20000, 'SV 20,000') });

category('bottlecap', 'special', 'bottlecap goldbottlecap', { tickets: { bottlecap: 4, goldbottlecap: 2 }, price: later(20000, 'SV 20,000'),
	prices: { goldbottlecap: same('choiceband', 'capped at the Choice level (user)') } });
category('terashard', 'special', named(/terashard$/), { tickets: 3, cap: 24, price: value(500, 'value step (item data 500)') });
category('rareBalls', 'special', 'fastball friendball heavyball levelball loveball lureball moonball dreamball beastball safariball sportball parkball',
	{ tickets: 4, cap: 24, price: same('netball', 'same family: special balls') });
category('plates', 'special', named(/(plate|memory|drive)$/).filter(id => id !== 'legendplate'), { tickets: 2, cap: 16, price: same('charcoal', 'same effect: type booster') });
category('capsule', 'special', ['abilitycapsule'], { tickets: 8, price: later(100000, 'SV 100,000') });
category('patch', 'special', ['abilitypatch'], { tickets: 16, price: same('abilitycapsule', 'tied: 2 Capsules', 2) });
category('masterball', 'special', ['masterball'], { tickets: 9, price: later(100000, 'tied: 2 Mega top steps', 2) });
category('legendItems', 'special', 'griseouscore adamantcrystal lustrousglobe griseousorb adamantorb lustrousorb redorb blueorb souldew rustedsword rustedshield '
	+ 'cornerstonemask hearthflamemask wellspringmask legendplate', { tickets: 1, cap: 15, price: later(100000, 'tied: a Mega top step') });
category('formKeys', 'special', 'gracidea revealglass prisonbottle meteorite dnasplicers nsolarizer nlunarizer reinsofunity rotomcatalog zygardecube',
	{ tickets: 2, cap: 12, price: later(100000, 'tied: half the Mega top step', 1 / 2) });
category('tm', 'special', TMS, { tickets: 1, cap: 30, price: disc });
category('mega', 'special', MEGA_STONES, { gimmick: 'mega', tickets: stepTickets(MEGA_TIER), cap: 45, price: stepOf(MEGA_TIER, 'Z-A step') });
category('zcrystal', 'special', Z_CRYSTALS, { gimmick: 'z', tickets: stepTickets(Z_TIER), cap: 45, price: stepOf(Z_TIER, 'Mega step equivalent') });

category('dynamax', 'special', 'maxhoney maxmushrooms dynamaxcandy', { gimmick: 'dynamax', tickets: 8, pack: { maxmushrooms: 3, dynamaxcandy: 3 },
	prices: { maxhoney: same('maxrevive', 'same effect: Max Revive'), maxmushrooms: value(3000, 'kept (pack of 3)'), dynamaxcandy: same('rarecandy', 'same effect: Rare Candy') } });

const GIFTS = [
	{ id: 'oldrod', badges: 0 }, { id: 'goodrod', badges: 2 }, { id: 'superrod', badges: 5 }, { id: 'pokeflute', badges: 0 }, { id: 'expshare', badges: 0 },
	{ id: 'keystone', badges: 0, gimmick: 'mega' }, { id: 'zring', badges: 0, gimmick: 'z' }, { id: 'teraorb', badges: 0, gimmick: 'tera' },
	{ id: 'dynamaxband', badges: 0, gimmick: 'dynamax' },
];
// no game sold them (people give them): our values
category('gifts', 'gift', GIFTS.map(g => g.id), { prices: { oldrod: value(1000, 'fixed'), goodrod: value(5000, 'fixed'), superrod: value(10000, 'fixed'),
	pokeflute: value(1000, 'fixed'), expshare: value(3000, 'fixed'), keystone: value(10000, 'fixed'), zring: value(10000, 'fixed'), teraorb: value(10000, 'fixed'),
	dynamaxband: value(10000, 'fixed') } });

const MART_SPECIAL = words('vitamins stones heldMid heldCheap typeBoost training incense evoPLA apples ppup maxrevive expcandy normalgem tm capsule');
const SPECIAL_COUNT = { mart: [[1, 40], [2, 45], [3, 15]], department: [[2, 30], [3, 50], [4, 20]] };
const DEPARTMENT_PICKS = { min: 10, max: 14 };

const UNSOLD = new Set([
	...named(/fossil(ized\w+)?$|^fossilized/), 'oldamber',
	...words('nugget bignugget pearl bigpearl pearlstring stardust starpiece cometshard rarebone tinymushroom bigmushroom balmmushroom relicgold gimmighoulcoin prettyfeather'),
	'wishingpiece', ...GEN2_BERRIES, ...words('pinkbow polkadotbow berserkgene mail stick'), ...words('crucibellite vilevial'), 'cherishball', 'strangeball',
	'moomoomilk', 'shaloursable',
]);

const MART_BADGES = [
	[0, ['pokeball', 'potion', 'antidote', 'paralyzeheal', 'awakening', 'burnheal', 'iceheal', 'escaperope', 'repel']],
	[1, ['greatball', 'superpotion', 'superrepel']],
	[3, ['fullheal', 'revive']],
	[5, ['ultraball', 'hyperpotion', 'maxrepel']],
	[7, ['maxpotion']],
	[8, ['fullrestore']],
];

const BATTLE_GOODS = CATEGORIES.find(c => c.key === 'battle').items;
const MART_POOL = [...BATTLE_GOODS, 'netball', 'nestball', 'repeatball', 'timerball', 'diveball', 'duskball', 'quickball', 'healball', 'luxuryball'];
const MART_PICKS = { min: 4, max: 6 };

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

	{ item: 'honey', region: 'sinnoh', towns: ['꽃향기마을', 'Floaroma Town', 'Floaroma Meadow'] },
];

const TOWNS = {
	kanto: ['pallet-town', 'viridian-city', 'pewter-city', 'cerulean-city', 'vermilion-city', 'lavender-town', 'celadon-city', 'fuchsia-city', 'saffron-city',
		'cinnabar-island', 'indigo-plateau', 'one-island', 'two-island', 'three-island', 'four-island', 'five-island', 'six-island', 'seven-island'],
	johto: ['new-bark-town', 'cherrygrove-city', 'violet-city', 'azalea-town', 'goldenrod-city', 'ecruteak-city', 'olivine-city', 'cianwood-city', 'mahogany-town',
		'blackthorn-city'],
	hoenn: ['littleroot-town', 'oldale-town', 'petalburg-city', 'rustboro-city', 'dewford-town', 'slateport-city', 'mauville-city', 'verdanturf-town',
		'fallarbor-town', 'lavaridge-town', 'fortree-city', 'lilycove-city', 'mossdeep-city', 'sootopolis-city', 'pacifidlog-town', 'ever-grande-city'],
	sinnoh: ['twinleaf-town', 'sandgem-town', 'jubilife-city', 'oreburgh-city', 'floaroma-town', 'eterna-city', 'hearthome-city', 'solaceon-town', 'veilstone-city',
		'pastoria-city', 'celestic-town', 'canalave-city', 'snowpoint-city', 'sunyshore-city', 'fight-area', 'survival-area', 'resort-area'],
	unova: ['nuvema-town', 'accumula-town', 'striaton-city', 'nacrene-city', 'castelia-city', 'nimbasa-city', 'driftveil-city', 'mistralton-city', 'icirrus-city',
		'opelucid-city', 'lacunosa-town', 'undella-town', 'black-city', 'white-forest', 'anville-town', 'aspertia-city', 'virbank-city', 'floccesy-town',
		'lentimas-town', 'humilau-city'],
	kalos: ['vaniville-town', 'aquacorde-town', 'santalune-city', 'lumiose-city', 'camphrier-town', 'cyllage-city', 'ambrette-town', 'geosenge-town', 'shalour-city',
		'coumarine-city', 'laverre-city', 'dendemille-town', 'anistar-city', 'couriway-town', 'snowbelle-city', 'kiloude-city'],
	alola: ['iki-town', 'hauoli-city', 'heahea-city', 'paniola-town', 'konikoni-city', 'malie-city', 'po-town', 'tapu-village', 'seafolk-village'],
	galar: ['postwick', 'wedgehurst', 'motostoke', 'turffield', 'hulbury', 'stow-on-side', 'ballonlea', 'hammerlocke', 'circhester', 'spikemuth', 'wyndon',
		'freezington'],
	hisui: ['jubilife-village'],
	paldea: ['cabo-poco', 'los-platos', 'mesagoza', 'cortondo', 'artazon', 'levincia', 'cascarrafa', 'porto-marinada', 'medali', 'montenevera', 'alfornada',
		'zapapico'],
	kitakami: ['mossui-town'],
};
const TOWN_KO = { 'jubilife-village': ['축복마을'] };
const TOWN_REGIONS = { kitakami: ['kitakami', 'paldea'] };

const SEVII_KO = ['원', '투', '쓰리', '포', '파이브', '식스', '세븐'];
const SEVII_EN = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'];
const SEVII_OWN = ['Knot', 'Boon', 'Kin', 'Floe', 'Chrono', 'Fortune', 'Quest'];
const TOWN_ALIASES = {
	...Object.fromEntries(SEVII_EN.map((en, i) => [`${en.toLowerCase()}-island`,
		[`${i + 1}번 섬`, `${i + 1}섬`, `섬${i + 1}`, `${SEVII_KO[i]} 아일랜드`, `Island ${en}`, `Island ${i + 1}`, `${i + 1} Island`, `${SEVII_OWN[i]} Island`]])),
	'vermilion-city': ['Vermillion City'],
};
const townList = (() => {
	const files = readFishingSources(), ko = koreanNames(files);
	const locations = new Map(fishingRows(files['locations.csv']).map(r => [r.identifier, r]));
	const english = new Map(fishingRows(files['location_names.en.csv']).map(r => [r.location_id, r.name]));
	const regionOf = Object.fromEntries(fishingRows(files['regions.csv']).map(r => [r.id, r.identifier]));
	const seen = new Set();
	return Object.entries(TOWNS).flatMap(([region, ids]) => ids.map(id => {
		const location = locations.get(id);
		if (!location) throw new Error(`마을 ${id}: PokeAPI locations.csv 에 없음`);
		if (seen.has(id)) throw new Error(`마을 ${id}: 두 번`);
		seen.add(id);

		if (regionOf[location.region_id] !== region && !(region === 'kitakami' && regionOf[location.region_id] === 'paldea')) {
			throw new Error(`마을 ${id}: 지방 ${regionOf[location.region_id]} (표에는 ${region})`);
		}
		const en = english.get(location.id);
		const names = [...(TOWN_KO[id] ?? ko.get(englishID(en ?? '')) ?? [])];
		if (!en || !names.length) throw new Error(`마을 ${id}: 이름 없음 (en ${en}, ko ${names.length})`);
		return { id, regions: TOWN_REGIONS[region] ?? [region], names: [...names, en, ...(TOWN_ALIASES[id] ?? [])] };
	}));
})();
for (const id of Object.keys(TOWN_ALIASES)) if (!townList.some(t => t.id === id)) throw new Error(`마을 다른 이름 ${id}: 마을 표에 없음`);
{
	const owner = new Map();
	for (const t of townList) for (const name of t.names) {
		if (owner.has(name) && owner.get(name) !== t.id) throw new Error(`마을 이름 ${name}: ${owner.get(name)}·${t.id} 둘에`);
		owner.set(name, t.id);
	}
}

const SALE = { shareMin: 10, shareMax: 20, offMin: 10, offMax: 30, round: 10 };

const PREMIER = 'premierball';

const catOf = new Map();
for (const c of CATEGORIES) {
	if (!['shelf', 'special', 'gift'].includes(c.place)) throw new Error(`${c.key}: 자리 ${c.place}`);
	if (!c.items.length) throw new Error(`${c.key}: 도구 없음`);
	for (const id of c.items) {
		if (!NAMES[id]) throw new Error(`${c.key} ${id}: 가방이 모르는 도구 (data/names/items.json 에 없음)`);
		if (catOf.has(id)) throw new Error(`${id}: 두 분류에 (${catOf.get(id).key}, ${c.key})`);
		if (UNSOLD.has(id)) throw new Error(`${id}: 안 파는 목록에 있음`);
		catOf.set(id, c);
		if (c.place !== 'gift') {
			const t = typeof c.tickets === 'object' ? c.tickets?.[id] : c.tickets;
			if (!(t > 0)) throw new Error(`${c.key} ${id}: 표 수(tickets) 없음`);
		}
		const item = Dex.items.get(id);
		if (item.exists && item.zMove && c.gimmick !== 'z') throw new Error(`${id}: Z크리스탈은 Z 분류에만`);
		if (item.exists && item.megaStone && c.gimmick !== 'mega') throw new Error(`${id}: 메가스톤은 메가 분류에만`);
	}
	if (c.cap !== undefined && !(c.cap > 0)) throw new Error(`${c.key}: 상한 ${c.cap}`);
}
for (const id of MEGA_STONES) if (!Object.hasOwn(MEGA_TIER, id)) throw new Error(`${id}: 메가스톤 단계 표(MEGA_TIER)에 없음`);
for (const id of MART_SPECIAL) if (!CATEGORIES.some(c => c.key === id && c.place !== 'gift')) throw new Error(`${id}: 프렌들리숍 특별 상품 분류가 없음`);
const SHOP_ONLY = new Set([...MART_BADGES.flatMap(([, list]) => list), ...MART_POOL, ...SPECIALTIES.map(s => s.item), PREMIER]);
for (const id of SHOP_ONLY) if (!NAMES[id]) throw new Error(`${id}: 가방이 모르는 도구`);
// every item of our bag is placed or never sold (the discs: their own rule)
const placed = new Set([...catOf.keys(), ...SHOP_ONLY, ...TRS]);
const loose = Object.keys(NAMES).filter(id => !placed.has(id) && !UNSOLD.has(id) && !isMachineId(id));
if (loose.length) throw new Error(`분류가 없는 도구 (CATEGORIES 나 UNSOLD 에 넣기): ${loose.join(', ')}`);

const cost = new Map(csv('items.csv').map(row => [toID(row.identifier), Number(row.cost)]));
const sourceOf = id => { const c = catOf.get(id); return c?.prices?.[id] ?? c?.price ?? gen3; };
const final = new Map(), why = {};

const tieRound = price => (price % 100 === 0 ? price : roundStep(price));
function priceOf(id, path = []) {
	if (final.has(id)) return final.get(id);
	if (path.includes(id)) throw new Error(`값이 돌고 돎: ${[...path, id].join(' -> ')}`);
	let price, from;
	const src = sourceOf(id);
	if (GEN3_PRICES[id]) [price, from] = [GEN3_PRICES[id][0], `Gen 3/4 store (${GEN3_PRICES[id][1]})`];
	else if (src.step === 1) throw new Error(`${id}: 3세대 값 표(GEN3_PRICES)에 없음`);
	else if (src.step === 2) {
		if (!catOf.has(src.of) && !GEN3_PRICES[src.of]) throw new Error(`${id}: 묶은 도구 ${src.of} 에 값이 없음`);
		[price, from] = [tieRound(src.k * priceOf(src.of, [...path, id])), src.why];
	} else if (src.step === 3 && src.own) {
		if (!LATER_PRICES[id]) throw new Error(`${id}: 나중 세대 값 표(LATER_PRICES)에 없음`);
		const [p, game] = LATER_PRICES[id];
		[price, from] = [laterPrice(p), `${game} ${p.toLocaleString('en')}`];
	} else if (src.step === 3 && src.table) {
		if (!src.table[id]) throw new Error(`${id}: 단계 표에 없음`);
		[price, from] = [laterPrice(src.table[id]), `${src.why} ${src.table[id].toLocaleString('en')}`];
	} else if (src.step === 3) [price, from] = [tieRound(src.k * laterPrice(src.p)), src.why];
	else if (src.step === 4) [price, from] = [src.p, src.why];
	else if (src.step === 'disc') {
		const move = machineMove(id);
		if (!move || !Dex.moves.get(move).exists) throw new Error(`${id}: 기술 표에 없는 기술머신`);
		[price, from] = [discPrice(id), 'disc rule'];
	}
	if (!Number.isInteger(price) || price <= 0) throw new Error(`${id}: 값 ${price}`);
	final.set(id, price);
	why[id] = from;
	return price;
}
const discOnly = id => { const move = machineMove(id); if (move !== null && !Dex.moves.get(move).exists) throw new Error(`${id}: 기술 표에 없는 기술`); return discPrice(id); };

const shelfIds = [...new Set([...SHOP_ONLY, ...CATEGORIES.filter(c => c.place !== 'special').flatMap(c => c.items)])];
const prices = Object.fromEntries(shelfIds.map(id => [id, priceOf(id)]));
for (const id of Object.keys(GEN3_PRICES)) if (!final.has(id)) throw new Error(`${id}: 진열에 없는 도구가 3세대 값 표에 있음`);

const specialPrices = {};
for (const c of CATEGORIES.filter(c => c.place === 'special' || MART_SPECIAL.includes(c.key))) for (const id of c.items) specialPrices[id] = priceOf(id);
for (const id of TRS) specialPrices[id] = discOnly(id);
for (const { department } of Object.values(MACHINE_SALE)) for (const id of department) specialPrices[id] ??= discOnly(id);
for (const id of Object.keys(LATER_PRICES)) if (!final.has(id)) throw new Error(`${id}: 쓰지 않는 나중 세대 값`);
// a TM whose move a TR teaches -> that TR (sold instead of it in Galar)
const trOf = new Map(TRS.map(id => [machineMove(id), id]));
const replaces = Object.fromEntries(TMS.filter(id => trOf.has(machineMove(id))).map(id => [id, trOf.get(machineMove(id))]));
for (const [tm, tr] of Object.entries(replaces)) if (specialPrices[tm] !== specialPrices[tr]) throw new Error(`${tr}: ${tm} 와 값이 다름`);
const PACKS = Object.fromEntries(CATEGORIES.flatMap(c => Object.entries(c.pack ?? {})));
for (const [id, pack] of Object.entries(PACKS)) {
	if (catOf.get(id)?.place !== 'special' || !Number.isInteger(pack) || pack < 2) throw new Error(`${id}: 묶음은 특별 상품에만, 2개 이상`);
	if (OUTSIDE_ITEMS[id]?.kind === 'key') throw new Error(`${id}: 중요한 도구는 묶음으로 팔지 않음`);
}

const SELL_FIXED = { expshare: 3000, healthfeather: 300, musclefeather: 300, resistfeather: 300, geniusfeather: 300, cleverfeather: 300, swiftfeather: 300, prettyfeather: 1000 };
const sellPrices = Object.fromEntries(Object.keys(NAMES).sort()
	.filter(id => Object.hasOwn(SELL_FIXED, id) || (!Object.hasOwn(prices, id) && !Object.hasOwn(specialPrices, id) && OUTSIDE_ITEMS[id]?.kind !== 'key' && cost.get(id) > 0))
	.map(id => [id, SELL_FIXED[id] ?? cost.get(id)]));
if (prices.expshare !== SELL_FIXED.expshare) throw new Error('학습장치: 진열 값과 팔기 값이 다름');

const SINCE_FIXED = {
	stellarterashard: [9, 'Scarlet / Violet The Indigo Disk (no PokeAPI game index)'],
	nsolarizer: [7, 'Ultra Sun / Ultra Moon (no PokeAPI game index)'], nlunarizer: [7, 'Ultra Sun / Ultra Moon (no PokeAPI game index)'],
};
const POKEAPI_NAME = id => id.replace(/feather$/, 'wing'); // healthfeather -> PokeAPI health-wing (prettyfeather is unsold)
const itemOfApi = new Map(csv('items.csv').map(row => [row.id, toID(row.identifier)]));
const apiGen = new Map();
for (const row of csv('item_game_indices.csv')) {
	const id = itemOfApi.get(row.item_id), gen = Number(row.generation_id);
	if (id && Number.isInteger(gen) && !(apiGen.get(id) <= gen)) apiGen.set(id, gen);
}
const GENS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
function sinceOf(id) {
	if (Dex.items.get(id).exists) {
		const gen = GENS.find(g => inGen(Dex, 'items', id, g));
		if (!gen) throw new Error(`${id}: Showdown 이 아는 도구인데 어느 세대에도 없음`);
		return gen;
	}
	const gen = SINCE_FIXED[id]?.[0] ?? apiGen.get(id) ?? apiGen.get(POKEAPI_NAME(id));
	if (!GENS.includes(gen)) throw new Error(`${id}: 처음 나온 세대를 모름 (Showdown·PokeAPI 둘 다 없음 - SINCE_FIXED 에 넣기)`);
	return gen;
}
for (const id of Object.keys(SINCE_FIXED)) if (Dex.items.get(id).exists || apiGen.has(id)) throw new Error(`${id}: 이제 자료에 세대가 있음 (SINCE_FIXED 에서 빼기)`);
const sinceIds = [...new Set([...Object.keys(prices), ...Object.keys(specialPrices)])].filter(id => !isMachineId(id)).sort();
const since = Object.fromEntries(sinceIds.map(id => [id, sinceOf(id)]).filter(([, gen]) => gen > 1));

const GAME_PRICES = JSON.parse(read('data/sources/game-prices.json'));
const SPECIALTY_IDS = new Set(SPECIALTIES.map(s => s.item));
const SHELF_ORDER = [...new Set([...MART_BADGES.flatMap(([, list]) => list), ...MART_POOL, ...CATEGORIES.filter(c => c.place === 'shelf').flatMap(c => c.items),
	...SPECIALTY_IDS])];
const games = {};
for (const std of STANDARD_IDS) {
	const table = GAME_PRICES.games[std], shelf = GAME_PRICES.machines[std];
	if (!table || !shelf) throw new Error(`${std}: 원작 게임 상점 자료(data/sources/game-prices.json)에 없는 게임`);
	const goods = { ...table };
	for (const [item, sold] of Object.entries(GAME_PRICES.specialties)) {
		if (!SPECIALTY_IDS.has(item) || !GEN3_PRICES[item]) throw new Error(`${item}: 마을 명물이 아님`);
		if (sold.includes(std)) goods[item] = GEN3_PRICES[item][0];
	}
	for (const [id, price] of Object.entries(goods)) {
		if (!Object.hasOwn(prices, id) || !SHELF_ORDER.includes(id)) throw new Error(`${std} ${id}: 우리 진열에 없는 물건`);
		if (!Number.isInteger(price) || price <= 0) throw new Error(`${std} ${id}: 값 ${price}`);
	}
	const discs = machinesOf(std).filter(d => d.kind === 'tm');
	const machines = Object.fromEntries(Object.entries(shelf.moves).map(([move, price]) => {
		const found = discs.filter(d => d.move === move);
		if (found.length !== 1 || !NAMES[found[0].id]) throw new Error(`${std} ${move}: 그 게임의 기술머신이 하나가 아님 (${found.map(d => d.id).join(', ')})`);
		if (!Number.isInteger(price) || price <= 0) throw new Error(`${std} ${move}: 값 ${price}`);
		return [found[0].id, price];
	}).sort(([a], [b]) => machineOrder(a, b)));
	if (!shelf.shops.every(kind => ['mart', 'department'].includes(kind))) throw new Error(`${std}: 기술머신 가게 ${shelf.shops}`);
	games[std] = { goods: Object.fromEntries(SHELF_ORDER.filter(id => Object.hasOwn(goods, id)).map(id => [id, goods[id]])), machines, machineShops: shelf.shops };
}
for (const std of Object.keys(GAME_PRICES.games)) if (!STANDARD_IDS.includes(std)) throw new Error(`${std}: 기술머신 규격에 없는 게임`);

const tableOf = c => ({ key: c.key, items: c.items, tickets: typeof c.tickets === 'object' ? Object.fromEntries(c.items.map(id => [id, c.tickets[id]])) : c.tickets,
	...(c.cap !== undefined ? { cap: c.cap } : {}), ...(c.gimmick ? { gimmick: c.gimmick } : {}) });
const martShelf = new Set([...MART_BADGES.flatMap(([, list]) => list), ...MART_POOL]);
const martSpecial = MART_SPECIAL.map(key => CATEGORIES.find(c => c.key === key)).map(c => ({ ...tableOf(c), items: c.items.filter(id => !martShelf.has(id)) }))
	.map(c => (typeof c.tickets === 'object' ? { ...c, tickets: Object.fromEntries(c.items.map(id => [id, c.tickets[id]])) } : c)).filter(c => c.items.length);
writeFileSync(new URL('data/shop.json', root), `${JSON.stringify({
	source: `값 규칙 (tools/build-shop.mjs): 3·4세대 가게 값 (pret 디컴파일) → 같은 효과·같은 무리 → 나중 세대 값 (tools/shop-price.mjs) → 값 단계. 팔기 값: PokeAPI ${source.commit.slice(0, 12)} data/v2/csv/items.csv cost`,
	note: '도구 id(Showdown) → 값. 분류마다 표 수(tickets)·상한(cap). gifts = 가지기 전까지 늘 있는 진열 줄. sellPrices = 진열·특별 상품에 없는 도구의 원래 값(팔 때 반값). unsold = 안 파는 도구. since = 도구가 처음 나온 세대(Showdown 세대 Dex, 모르면 PokeAPI item_game_indices.csv; 1세대는 뺌). towns = 모든 지방의 마을(가게 진열을 마을마다 다르게 정하는 표 - PokeAPI 장소 id, 이름은 PKHeX 한국어·PokeAPI 영어). games = 원작 게임 상점: 게임마다 생활 물건 값(goods)·돈으로 파는 기술머신 값(machines)·기술머신을 파는 가게(machineShops) (data/sources/game-prices.json). 진열 규칙은 story/shop.mjs',
	premier: PREMIER,
	prices,
	mart: { basics: MART_BADGES.map(([badges, items]) => ({ badges, items })), picks: { ...MART_PICKS, items: MART_POOL } },
	specialties: SPECIALTIES.map(({ item, region, towns }) => ({ item, region, towns })),
	towns: townList,
	department: { picks: DEPARTMENT_PICKS, categories: CATEGORIES.filter(c => c.place === 'shelf').map(tableOf) },
	gifts: GIFTS.map(({ id, badges, gimmick }) => ({ id, badges, ...(gimmick ? { gimmick, shops: ['department'] } : { shops: ['mart', 'department'] }) })),
	sale: SALE,
	specials: {
		mart: { count: SPECIAL_COUNT.mart, categories: martSpecial },
		department: { count: SPECIAL_COUNT.department, categories: CATEGORIES.filter(c => c.place === 'special').map(tableOf) },
		packs: PACKS,
		trs: { region: 'galar', shop: 'department', category: 'tm', items: TRS, replaces },
		prices: specialPrices },
	sellPrices,
	unsold: [...UNSOLD].sort(),
	since,
	games,
}, null, '\t')}\n`);
console.log(`진열 값 ${Object.keys(prices).length}개, 특별 상품 값 ${Object.keys(specialPrices).length}개 (분류 ${CATEGORIES.length}개 — 메가스톤 ${MEGA_STONES.length}, Z크리스탈 ${Z_CRYSTALS.length}, `
	+ `기술레코드 ${TRS.length} — 기술머신 대신 ${Object.keys(replaces).length}, 지방 디스크 ${Object.entries(MACHINE_SALE).map(([std, m]) => `${std} ${m.department.length}`).join('·')}), `
	+ `안 파는 도구 ${UNSOLD.size}개, 팔기 값만 ${Object.keys(sellPrices).length}개, 세대 ${Object.keys(since).length}개, 원작 게임 상점 ${Object.keys(games).length}개 → data/shop.json`);
if (process.argv.includes('--why')) for (const c of CATEGORIES) console.log(`${c.key}: ${c.items.map(id => `${id} ${final.get(id)}`).join(', ')}  {${why[c.items[0]]}}`);
