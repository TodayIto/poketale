export const VITAMIN_EVS = 10;

export const WING_EVS = 1;

export const HYPER_TRAIN_LEVEL = 50;

export const TERA_SHARD_COST = 50;

const vitamin = (name, stat) => ({ name, kind: 'train', vitamin: stat });
const feather = (name, stat) => ({ name, kind: 'train', vitamin: stat, evs: WING_EVS, friendship: 'wing' });
const mochi = (name, stat) => ({ name, kind: 'train', vitamin: stat, friendship: 'mochi' });
const evBerry = (name, stat) => ({ name, kind: 'train', evBerry: stat });
const candy = (name, exp) => ({ name, kind: 'train', exp });
const mint = nature => ({ name: `${nature} Mint`, kind: 'train', mint: nature });
const field = name => ({ name, kind: 'field' });

const shard = type => ({ name: `${type} Tera Shard`, kind: 'train', teraShard: type, cost: TERA_SHARD_COST });

const both = (a, b, there = {}, back = {}) => [[a, b, there], [b, a, back]];
const inTurn = (...forms) => forms.map((form, i) => [form, forms[(i + 1) % forms.length], {}]);
const ORICORIO = ['Oricorio', 'Oricorio-Pom-Pom', "Oricorio-Pa'u", 'Oricorio-Sensu'];
const nectar = (name, to) => ({ name, kind: 'train', form: ORICORIO.filter(from => from !== to).map(from => [from, to, {}]) });
const keyForm = (name, ...pairs) => ({ name, kind: 'key', form: pairs.flat() });

const fusion = (name, base, partners) => ({ name, kind: 'key', fuse: { base, partners } });
const treasure = name => ({ name, kind: 'treasure' });

export const OUTSIDE_ITEMS = {

	freshwater: { name: 'Fresh Water', kind: 'medicine', heal: 30, food: 1 },
	sodapop: { name: 'Soda Pop', kind: 'medicine', heal: 50, food: 1 },
	lemonade: { name: 'Lemonade', kind: 'medicine', heal: 70, food: 1 },
	moomoomilk: { name: 'Moomoo Milk', kind: 'medicine', heal: 100, food: 1 },
	sweetheart: { name: 'Sweet Heart', kind: 'medicine', heal: 20, food: 2 },

	energypowder: { name: 'Energy Powder', kind: 'medicine', heal: 60 },
	energyroot: { name: 'Energy Root', kind: 'medicine', heal: 120 },
	healpowder: { name: 'Heal Powder', kind: 'medicine', cure: 'all' },
	revivalherb: { name: 'Revival Herb', kind: 'medicine', revive: 'full' },

	sacredash: { name: 'Sacred Ash', kind: 'medicine', revive: 'full', all: true },

	lavacookie: { name: 'Lava Cookie', kind: 'medicine', cure: 'all', food: 2 },
	oldgateau: { name: 'Old Gateau', kind: 'medicine', cure: 'all', food: 2 },
	casteliacone: { name: 'Casteliacone', kind: 'medicine', cure: 'all', food: 2 },
	ragecandybar: { name: 'Rage Candy Bar', kind: 'medicine', cure: 'all', food: 2 },
	lumiosegalette: { name: 'Lumiose Galette', kind: 'medicine', cure: 'all', food: 2 },
	shaloursable: { name: 'Shalour Sable', kind: 'medicine', cure: 'all', food: 2 },
	bigmalasada: { name: 'Big Malasada', kind: 'medicine', cure: 'all', food: 2 },
	pewtercrunchies: { name: 'Pewter Crunchies', kind: 'medicine', cure: 'all', food: 2 },

	hpup: vitamin('HP Up', 'hp'), protein: vitamin('Protein', 'atk'), iron: vitamin('Iron', 'def'),
	calcium: vitamin('Calcium', 'spa'), zinc: vitamin('Zinc', 'spd'), carbos: vitamin('Carbos', 'spe'),

	healthfeather: feather('Health Feather', 'hp'), musclefeather: feather('Muscle Feather', 'atk'), resistfeather: feather('Resist Feather', 'def'),
	geniusfeather: feather('Genius Feather', 'spa'), cleverfeather: feather('Clever Feather', 'spd'), swiftfeather: feather('Swift Feather', 'spe'),

	healthmochi: mochi('Health Mochi', 'hp'), musclemochi: mochi('Muscle Mochi', 'atk'), resistmochi: mochi('Resist Mochi', 'def'),
	geniusmochi: mochi('Genius Mochi', 'spa'), clevermochi: mochi('Clever Mochi', 'spd'), swiftmochi: mochi('Swift Mochi', 'spe'),
	freshstartmochi: { name: 'Fresh-Start Mochi', kind: 'train', evReset: true },

	pomegberry: evBerry('Pomeg Berry', 'hp'), kelpsyberry: evBerry('Kelpsy Berry', 'atk'), qualotberry: evBerry('Qualot Berry', 'def'),
	hondewberry: evBerry('Hondew Berry', 'spa'), grepaberry: evBerry('Grepa Berry', 'spd'), tamatoberry: evBerry('Tamato Berry', 'spe'),

	ppup: { name: 'PP Up', kind: 'train', ppUp: 1 },
	ppmax: { name: 'PP Max', kind: 'train', ppUp: 3 },

	expcandyxs: candy('Exp. Candy XS', 100), expcandys: candy('Exp. Candy S', 800), expcandym: candy('Exp. Candy M', 3000),
	expcandyl: candy('Exp. Candy L', 10000), expcandyxl: candy('Exp. Candy XL', 30000),

	abilitycapsule: { name: 'Ability Capsule', kind: 'train', ability: 'capsule' },
	abilitypatch: { name: 'Ability Patch', kind: 'train', ability: 'patch' },

	lonelymint: mint('Lonely'), adamantmint: mint('Adamant'), naughtymint: mint('Naughty'), bravemint: mint('Brave'),
	boldmint: mint('Bold'), impishmint: mint('Impish'), laxmint: mint('Lax'), relaxedmint: mint('Relaxed'),
	modestmint: mint('Modest'), mildmint: mint('Mild'), rashmint: mint('Rash'), quietmint: mint('Quiet'),
	calmmint: mint('Calm'), gentlemint: mint('Gentle'), carefulmint: mint('Careful'), sassymint: mint('Sassy'),
	timidmint: mint('Timid'), hastymint: mint('Hasty'), jollymint: mint('Jolly'), naivemint: mint('Naive'),
	seriousmint: mint('Serious'),

	bottlecap: { name: 'Bottle Cap', kind: 'train', hyper: 'one' },
	goldbottlecap: { name: 'Gold Bottle Cap', kind: 'train', hyper: 'all' },

	...Object.fromEntries(['Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost',
		'Dragon', 'Dark', 'Steel', 'Fairy', 'Stellar'].map(type => [`${type.toLowerCase()}terashard`, shard(type)])),

	rednectar: nectar('Red Nectar', 'Oricorio'), yellownectar: nectar('Yellow Nectar', 'Oricorio-Pom-Pom'),
	pinknectar: nectar('Pink Nectar', "Oricorio-Pa'u"), purplenectar: nectar('Purple Nectar', 'Oricorio-Sensu'),

	linkingcord: { name: 'Linking Cord', kind: 'evolve', trade: true },

	luckyegg: { name: 'Lucky Egg', kind: 'held' },
	amuletcoin: { name: 'Amulet Coin', kind: 'held' },
	soothebell: { name: 'Soothe Bell', kind: 'held' },

	smokeball: { name: 'Smoke Ball', kind: 'held' },

	luckincense: { name: 'Luck Incense', kind: 'held' },
	cleansetag: { name: 'Cleanse Tag', kind: 'held' },
	pureincense: { name: 'Pure Incense', kind: 'held' },

	nugget: treasure('Nugget'), bignugget: treasure('Big Nugget'), pearl: treasure('Pearl'), bigpearl: treasure('Big Pearl'),
	pearlstring: treasure('Pearl String'), stardust: treasure('Stardust'), starpiece: treasure('Star Piece'), cometshard: treasure('Comet Shard'),
	tinymushroom: treasure('Tiny Mushroom'), bigmushroom: treasure('Big Mushroom'), balmmushroom: treasure('Balm Mushroom'),
	relicgold: treasure('Relic Gold'), rarebone: treasure('Rare Bone'), gimmighoulcoin: treasure('Gimmighoul Coin'),

	prettyfeather: treasure('Pretty Feather'),

	repel: field('Repel'), superrepel: field('Super Repel'), maxrepel: field('Max Repel'), escaperope: field('Escape Rope'),
	honey: { ...field('Honey'), food: 1 },

	teraorb: { name: 'Tera Orb', kind: 'key' },

	expshare: { name: 'Exp. Share', kind: 'key' },

	oldrod: { name: 'Old Rod', kind: 'key', rod: 0 },
	goodrod: { name: 'Good Rod', kind: 'key', rod: 1 },
	superrod: { name: 'Super Rod', kind: 'key', rod: 2 },

	gracidea: keyForm('Gracidea', both('Shaymin', 'Shaymin-Sky', { day: true })),
	revealglass: keyForm('Reveal Glass', ...['Tornadus', 'Thundurus', 'Landorus', 'Enamorus'].map(name => both(name, `${name}-Therian`))),
	prisonbottle: keyForm('Prison Bottle', both('Hoopa', 'Hoopa-Unbound', { moves: [['hyperspacehole', 'hyperspacefury']] }, { moves: [['hyperspacefury', 'hyperspacehole']] })),
	meteorite: keyForm('Meteorite', inTurn('Deoxys', 'Deoxys-Attack', 'Deoxys-Defense', 'Deoxys-Speed')),

	dnasplicers: fusion('DNA Splicers', 'Kyurem', {
		Reshiram: { into: 'Kyurem-White', moves: [['glaciate', 'iceburn'], ['scaryface', 'fusionflare']] },
		Zekrom: { into: 'Kyurem-Black', moves: [['glaciate', 'freezeshock'], ['scaryface', 'fusionbolt']] } }),
	nsolarizer: fusion('N-Solarizer', 'Necrozma', {
		Solgaleo: { into: 'Necrozma-Dusk-Mane', moves: [['confusion', 'sunsteelstrike']], learn: 'sunsteelstrike', fallback: 'confusion' } }),
	nlunarizer: fusion('N-Lunarizer', 'Necrozma', {
		Lunala: { into: 'Necrozma-Dawn-Wings', moves: [['confusion', 'moongeistbeam']], learn: 'moongeistbeam', fallback: 'confusion' } }),
	reinsofunity: fusion('Reins of Unity', 'Calyrex', {
		Glastrier: { into: 'Calyrex-Ice', learn: 'glaciallance', steed: true, fallback: 'confusion' },
		Spectrier: { into: 'Calyrex-Shadow', learn: 'astralbarrage', steed: true, fallback: 'confusion' } }),

	rotomcatalog: { name: 'Rotom Catalog', kind: 'key', pick: { base: 'Rotom', fallback: 'thundershock', forms: { Rotom: null, 'Rotom-Heat': 'overheat',
		'Rotom-Wash': 'hydropump', 'Rotom-Frost': 'blizzard', 'Rotom-Fan': 'airslash', 'Rotom-Mow': 'leafstorm' } } },

	zygardecube: { name: 'Zygarde Cube', kind: 'key', cube: { forms: ['Zygarde-10%', 'Zygarde'], abilities: ['Aura Break', 'Power Construct'],
		moves: ['thousandarrows', 'thousandwaves', 'coreenforcer', 'extremespeed', 'dragondance'] } },
};

export const isRod = id => Number.isInteger(OUTSIDE_ITEMS[id]?.rod);

export const rodGrade = id => (isRod(id) ? OUTSIDE_ITEMS[id].rod : null);

export function steedBase(species) {
	for (const item of Object.values(OUTSIDE_ITEMS)) {
		if (item.fuse && Object.values(item.fuse.partners).some(p => p.steed && p.into === species)) return item.fuse.base;
	}
	return null;
}

export function formMoveOwners(move) {
	formMoves ??= (() => {
		const owners = new Map();
		const own = (id, form) => owners.set(id, [...new Set([...(owners.get(id) ?? []), form])]);
		for (const item of Object.values(OUTSIDE_ITEMS)) {
			for (const [, to, when] of item.form ?? []) for (const [, now] of when?.moves ?? []) own(now, to);
			for (const { into, moves = [], learn } of Object.values(item.fuse?.partners ?? {})) for (const now of [...moves.map(([, m]) => m), ...(learn ? [learn] : [])]) own(now, into);
			for (const [form, now] of Object.entries(item.pick?.forms ?? {})) if (now) own(now, form);
		}
		return owners;
	})();
	return formMoves.get(move) ?? null;
}
let formMoves = null;

export const ITEM_NAMES_SINCE = Object.freeze({

	itemNames009: Object.freeze(['smokeball', 'guardspec', 'poketoy', 'blueflute', 'redflute', 'yellowflute', 'pokeflute',
		'healthfeather', 'musclefeather', 'resistfeather', 'geniusfeather', 'cleverfeather', 'swiftfeather',
		'healthmochi', 'musclemochi', 'resistmochi', 'geniusmochi', 'clevermochi', 'swiftmochi', 'freshstartmochi',
		'normalterashard', 'fireterashard', 'waterterashard', 'electricterashard', 'grassterashard', 'iceterashard', 'fightingterashard', 'poisonterashard',
		'groundterashard', 'flyingterashard', 'psychicterashard', 'bugterashard', 'rockterashard', 'ghostterashard', 'dragonterashard', 'darkterashard',
		'steelterashard', 'fairyterashard', 'stellarterashard',
		'gracidea', 'revealglass', 'prisonbottle', 'meteorite', 'rednectar', 'yellownectar', 'pinknectar', 'purplenectar',
		'dnasplicers', 'nsolarizer', 'nlunarizer', 'reinsofunity', 'rotomcatalog', 'zygardecube',
		'luckincense', 'cleansetag', 'pureincense',
		'oldrod', 'goodrod', 'superrod']),
});

export const FOOD_BERRY = 1;

export const EXP_SHARE_MODES = ['always', 'item'];

export const expShareOn = (mode, bag) => mode !== 'item' || (bag?.expshare ?? 0) > 0;

export const TM_COUNT = 229;
export const tmId = number => `tm${String(number).padStart(3, '0')}`;
export const isTm = id => /^tm\d{3}$/.test(String(id ?? ''));
export const tmNumber = id => (isTm(id) ? Number(String(id).slice(2)) : null);

export const TR_COUNT = 100;
export const trId = number => `tr${String(number).padStart(2, '0')}`;
export const isTr = id => /^tr\d{2}$/.test(String(id ?? ''));
export const trNumber = id => (isTr(id) ? Number(String(id).slice(2)) : null);

export const MACHINE_IDS = Object.freeze([...Array.from({ length: TM_COUNT }, (_, i) => tmId(i + 1)), ...Array.from({ length: TR_COUNT }, (_, i) => trId(i))]);
