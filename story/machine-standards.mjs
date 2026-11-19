// Every region prints its own TM/HM/TR discs: the number on a disc means the move of the game that region
// belongs to (TM11 is Bubble Beam in Kanto, Sunny Day in Johto, Water Pulse in Paldea). A disc keeps the
// standard it was obtained under, so its move and whether it is used up never change afterwards.

// vg / versionGroup: PokeAPI version group whose machine table is the standard (tools/sources.mjs checks the pair).
// Games sharing a table are not listed separately (Yellow, Crystal, Emerald, Platinum, Black 2/White 2, Ultra Sun/Moon).
export const MACHINE_STANDARDS = Object.freeze({
	rb: Object.freeze({ vg: '1', versionGroup: 'red-blue', gen: 1, region: Object.freeze(['관동', 'Kanto']), reusableTm: false }),
	gs: Object.freeze({ vg: '3', versionGroup: 'gold-silver', gen: 2, region: Object.freeze(['성도', 'Johto']), reusableTm: false }),
	rs: Object.freeze({ vg: '5', versionGroup: 'ruby-sapphire', gen: 3, region: Object.freeze(['호연', 'Hoenn']), reusableTm: false }),
	dp: Object.freeze({ vg: '8', versionGroup: 'diamond-pearl', gen: 4, region: Object.freeze(['신오', 'Sinnoh']), reusableTm: false }),
	bw: Object.freeze({ vg: '11', versionGroup: 'black-white', gen: 5, region: Object.freeze(['하나', 'Unova']), reusableTm: true }),
	xy: Object.freeze({ vg: '15', versionGroup: 'x-y', gen: 6, region: Object.freeze(['칼로스', 'Kalos']), reusableTm: true }),
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

// Region ids are the ones story/compat.mjs reads from the compatible bot's Status Window (data/status-words.json).
// world is the bot's (story/compat.mjs compatWorld): its starting region (1 Kanto ... 9 Paldea) keeps Kanto in its
// original era when the journey starts there, and in the Johto era otherwise; a Journeys story uses one standard
// everywhere, also where no region is known. Without a world, a region names the standard printed on its discs.
export function regionStandard(region, world) {
	const { startRegion = null, journeys = false } = world ?? {};
	if (journeys) return JOURNEYS_STANDARD;
	switch (region) {
		case 'kanto': return startRegion && startRegion !== 1 ? 'gs' : 'rb';
		case 'johto': return 'gs';
		case 'hoenn': return 'rs';
		case 'sinnoh': return 'dp';
		case 'unova': return 'bw';
		case 'kalos': return 'xy';
		case 'alola': return 'sm';
		case 'galar': return 'swsh';
		case 'paldea': case 'kitakami': return 'sv';
		default: return null;
	}
}

// Adds the standard that machine numbers written in this message are read with. Messages before a chat's
// regionMachines mark keep the Scarlet/Violet reading they always had (story/setting-changes.mjs RULES).
export const withMachineStandard = (reading, region, world) => ({
	...reading,
	machineStd: reading?.regionMachines ? regionStandard(region, world) ?? DEFAULT_STANDARD : DEFAULT_STANDARD,
});

const ORDER = new Map(STANDARD_IDS.map((s, i) => [s, i]));

export function machineOrder(a, b) {
	const x = parseMachineId(a), y = parseMachineId(b);
	if (!x || !y) return x ? -1 : y ? 1 : 0;
	return ORDER.get(x.std) - ORDER.get(y.std) || MACHINE_KINDS.indexOf(x.kind) - MACHINE_KINDS.indexOf(y.kind) || x.number - y.number;
}
