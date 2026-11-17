// Every region prints its own TM/HM/TR discs: the number on a disc means the move of the game that region
// belongs to (TM11 is Bubble Beam in Kanto, Sunny Day in Johto, Water Pulse in Paldea). A disc keeps the
// standard it was obtained under, so its move and whether it is used up never change afterwards.

// vg / versionGroup: PokeAPI version group whose machine table is the standard (tools/sources.mjs checks the pair).
// Games sharing a table are not listed separately (Yellow, Crystal, Emerald, Platinum, Black 2/White 2, Ultra Sun/Moon).
// Remakes are standards of their own (FireRed/LeafGreen, HeartGold/SoulSilver, Omega Ruby/Alpha Sapphire); Brilliant
// Diamond/Shining Pearl is not, as PokeAPI has 17 of its 100 discs. Listed by generation, the order the bag sorts in.
export const MACHINE_STANDARDS = Object.freeze({
	rb: Object.freeze({ vg: '1', versionGroup: 'red-blue', gen: 1, region: Object.freeze(['관동', 'Kanto']), reusableTm: false }),
	gs: Object.freeze({ vg: '3', versionGroup: 'gold-silver', gen: 2, region: Object.freeze(['성도', 'Johto']), reusableTm: false }),
	rs: Object.freeze({ vg: '5', versionGroup: 'ruby-sapphire', gen: 3, region: Object.freeze(['호연', 'Hoenn']), reusableTm: false }),
	frlg: Object.freeze({ vg: '7', versionGroup: 'firered-leafgreen', gen: 3, region: Object.freeze(['관동', 'Kanto']), reusableTm: false }),
	dp: Object.freeze({ vg: '8', versionGroup: 'diamond-pearl', gen: 4, region: Object.freeze(['신오', 'Sinnoh']), reusableTm: false }),
	hgss: Object.freeze({ vg: '10', versionGroup: 'heartgold-soulsilver', gen: 4, region: Object.freeze(['성도', 'Johto']), reusableTm: false }),
	bw: Object.freeze({ vg: '11', versionGroup: 'black-white', gen: 5, region: Object.freeze(['하나', 'Unova']), reusableTm: true }),
	xy: Object.freeze({ vg: '15', versionGroup: 'x-y', gen: 6, region: Object.freeze(['칼로스', 'Kalos']), reusableTm: true }),
	oras: Object.freeze({ vg: '16', versionGroup: 'omega-ruby-alpha-sapphire', gen: 6, region: Object.freeze(['호연', 'Hoenn']), reusableTm: true }),
	sm: Object.freeze({ vg: '17', versionGroup: 'sun-moon', gen: 7, region: Object.freeze(['알로라', 'Alola']), reusableTm: true }),
	swsh: Object.freeze({ vg: '20', versionGroup: 'sword-shield', gen: 8, region: Object.freeze(['가라르', 'Galar']), reusableTm: true }),
	sv: Object.freeze({ vg: '25', versionGroup: 'scarlet-violet', gen: 9, region: Object.freeze(['팔데아', 'Paldea']), reusableTm: false }),
});

export const STANDARD_IDS = Object.freeze(Object.keys(MACHINE_STANDARDS));

// Scarlet/Violet discs keep the plain ids (tm001 ... tm229) they had before standards existed
export const DEFAULT_STANDARD = 'sv';

export const MACHINE_KINDS = Object.freeze(['tm', 'hm', 'tr']);

const ID_RE = new RegExp(`^(${MACHINE_KINDS.join('|')})(\\d{3})(${STANDARD_IDS.filter(s => s !== DEFAULT_STANDARD).join('|')})?$`);

export const machineId = (kind, number, std = DEFAULT_STANDARD) => `${kind}${String(number).padStart(3, '0')}${std === DEFAULT_STANDARD ? '' : std}`;

export function parseMachineId(id) {
	const m = ID_RE.exec(String(id ?? ''));
	return m ? { kind: m[1], number: Number(m[2]), std: m[3] ?? DEFAULT_STANDARD } : null;
}

export const isMachineId = id => parseMachineId(id) !== null;

// HMs are never used up; TRs always are; TMs depend on the standard
export function machineUsedUp(id) {
	const m = parseMachineId(id);
	if (!m) return false;
	if (m.kind === 'hm') return false;
	if (m.kind === 'tr') return true;
	return !MACHINE_STANDARDS[m.std].reusableTm;
}

// Pokémon Journeys (the 2019 anime) is set in the generation-8 era in every region it visits
export const JOURNEYS_STANDARD = 'swsh';

// The games whose discs a region has, oldest first. Region ids are the ones story/compat.mjs reads from the compatible
// bot's Status Window (data/status-words.json); Gold/Silver and HeartGold/SoulSilver also go to Kanto
const REGION_GAMES = Object.freeze({
	kanto: ['rb', 'gs', 'frlg', 'hgss'], johto: ['gs', 'hgss'], hoenn: ['rs', 'oras'], sinnoh: ['dp'], unova: ['bw'], kalos: ['xy'], alola: ['sm'],
	galar: ['swsh'], paldea: ['sv'], kitakami: ['sv'],
});
export const regionGames = region => REGION_GAMES[region] ?? [];

// Each region's original game. Its discs were named with the region alone ("(관동)", "(Kanto)") before names carried
// the generation, and those names still read as them; a remake never had such a name
const ORIGINALS = new Set(Object.values(REGION_GAMES).map(games => games[0]));
export const regionOnlyLabels = std => (ORIGINALS.has(std) ? { ko: MACHINE_STANDARDS[std].region[0], en: MACHINE_STANDARDS[std].region[1] } : null);

// world is { journeys, gen } (story/generation.mjs discWorld): gen is the story's world generation. A region's discs
// are those of its latest game of that generation or earlier (Kanto in a generation-3 world is FireRed/LeafGreen), of
// its first game before that; a Pokémon Journeys story uses one standard everywhere, also where no region is known.
// Without a generation, a region names its original discs.
export function regionStandard(region, world) {
	if (world?.journeys) return JOURNEYS_STANDARD;
	const games = REGION_GAMES[region];
	if (!games) return null;
	return (Number.isInteger(world?.gen) ? games.filter(std => MACHINE_STANDARDS[std].gen <= world.gen).at(-1) : null) ?? games[0];
}

// Adds the standard that machine numbers written in this message are read with, and the region whose other games a
// disc named with its move is looked for in first. Messages before a chat's regionMachines mark keep the
// Scarlet/Violet reading they always had (story/setting-changes.mjs RULES).
export const withMachineStandard = (reading, region, world) => ({
	...reading,
	machineStd: reading?.regionMachines ? regionStandard(region, world) ?? DEFAULT_STANDARD : DEFAULT_STANDARD,
	machineRegion: reading?.regionMachines && !world?.journeys ? region ?? null : null,
});

// The label in a disc's name: the region and generation of its game (관동·3세대 / Kanto · Gen 3)
export function standardLabels(std) {
	const { region: [ko, en], gen } = MACHINE_STANDARDS[std];
	return { ko: `${ko}·${gen}세대`, en: `${en} · Gen ${gen}` };
}

// The generation a region tag names, if it has one ((관동·3세대), (Kanto · Gen 3))
export const tagGen = text => Number(/(\d)\s*세대|\bgen\.?\s*(\d)/i.exec(String(text ?? ''))?.slice(1).find(Boolean)) || null;

const ORDER = new Map(STANDARD_IDS.map((s, i) => [s, i]));

export function machineOrder(a, b) {
	const x = parseMachineId(a), y = parseMachineId(b);
	if (!x || !y) return x ? -1 : y ? 1 : 0;
	return ORDER.get(x.std) - ORDER.get(y.std) || MACHINE_KINDS.indexOf(x.kind) - MACHINE_KINDS.indexOf(y.kind) || x.number - y.number;
}
