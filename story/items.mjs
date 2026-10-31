// Vitamins: EV +10, up to 252 per stat, 510 total
export const VITAMIN_EVS = 10;

export const HYPER_TRAIN_LEVEL = 50;

const vitamin = (name, stat) => ({ name, kind: 'train', vitamin: stat });
const candy = (name, exp) => ({ name, kind: 'train', exp });
const mint = nature => ({ name: `${nature} Mint`, kind: 'train', mint: nature });
const field = name => ({ name, kind: 'field' });
const treasure = name => ({ name, kind: 'treasure' });

export const OUTSIDE_ITEMS = {

	freshwater: { name: 'Fresh Water', kind: 'medicine', heal: 30 },
	sodapop: { name: 'Soda Pop', kind: 'medicine', heal: 50 },
	lemonade: { name: 'Lemonade', kind: 'medicine', heal: 70 },
	moomoomilk: { name: 'Moomoo Milk', kind: 'medicine', heal: 100 },
	sweetheart: { name: 'Sweet Heart', kind: 'medicine', heal: 20 },

	energypowder: { name: 'Energy Powder', kind: 'medicine', heal: 60 },
	energyroot: { name: 'Energy Root', kind: 'medicine', heal: 120 },
	healpowder: { name: 'Heal Powder', kind: 'medicine', cure: 'all' },
	revivalherb: { name: 'Revival Herb', kind: 'medicine', revive: 'full' },

	sacredash: { name: 'Sacred Ash', kind: 'medicine', revive: 'full', all: true },

	lavacookie: { name: 'Lava Cookie', kind: 'medicine', cure: 'all' },
	oldgateau: { name: 'Old Gateau', kind: 'medicine', cure: 'all' },
	casteliacone: { name: 'Casteliacone', kind: 'medicine', cure: 'all' },
	ragecandybar: { name: 'Rage Candy Bar', kind: 'medicine', cure: 'all' },
	lumiosegalette: { name: 'Lumiose Galette', kind: 'medicine', cure: 'all' },
	shaloursable: { name: 'Shalour Sable', kind: 'medicine', cure: 'all' },
	bigmalasada: { name: 'Big Malasada', kind: 'medicine', cure: 'all' },
	pewtercrunchies: { name: 'Pewter Crunchies', kind: 'medicine', cure: 'all' },

	hpup: vitamin('HP Up', 'hp'), protein: vitamin('Protein', 'atk'), iron: vitamin('Iron', 'def'),
	calcium: vitamin('Calcium', 'spa'), zinc: vitamin('Zinc', 'spd'), carbos: vitamin('Carbos', 'spe'),

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

	linkingcord: { name: 'Linking Cord', kind: 'evolve', trade: true },

	luckyegg: { name: 'Lucky Egg', kind: 'held' },
	amuletcoin: { name: 'Amulet Coin', kind: 'held' },
	soothebell: { name: 'Soothe Bell', kind: 'held' },

	nugget: treasure('Nugget'), bignugget: treasure('Big Nugget'), pearl: treasure('Pearl'), bigpearl: treasure('Big Pearl'),
	pearlstring: treasure('Pearl String'), stardust: treasure('Stardust'), starpiece: treasure('Star Piece'), cometshard: treasure('Comet Shard'),
	tinymushroom: treasure('Tiny Mushroom'), bigmushroom: treasure('Big Mushroom'), balmmushroom: treasure('Balm Mushroom'),
	relicgold: treasure('Relic Gold'), rarebone: treasure('Rare Bone'), gimmighoulcoin: treasure('Gimmighoul Coin'),

	repel: field('Repel'), superrepel: field('Super Repel'), maxrepel: field('Max Repel'), escaperope: field('Escape Rope'),
	honey: field('Honey'), pokedoll: field('Poké Doll'), fluffytail: field('Fluffy Tail'),

	teraorb: { name: 'Tera Orb', kind: 'key' },

	expshare: { name: 'Exp. Share', kind: 'key' },
};

export const EXP_SHARE_MODES = ['always', 'item'];

export const expShareOn = (mode, bag) => mode !== 'item' || (bag?.expshare ?? 0) > 0;

export const tmId = number => `tm${String(number).padStart(3, '0')}`;
export const isTm = id => /^tm\d{3}$/.test(String(id ?? ''));
export const tmNumber = id => (isTm(id) ? Number(String(id).slice(2)) : null);
