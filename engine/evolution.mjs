import { toID } from './mon.mjs';

export const REGIONAL_FORMES = Object.freeze(new Set(['Alola', 'Galar', 'Hisui', 'Paldea']));

export const genderAllows = (gender, target) => !(target.gender === 'M' || target.gender === 'F') || gender === target.gender;
/** Friendship evolution: level up at this much or more (generation 8) */
export const EVOLVE_FRIENDSHIP = 160;

export const isNight = timeOfDay => timeOfDay === 'dusk' || timeOfDay === 'night';

export const isEvolutionNight = timeOfDay => timeOfDay === 'night';

const holdsEverstone = item => toID(item) === 'everstone';

const EVERSTONE_IGNORED = new Set(['kadabra']);

export const everstoneStops = (dex, mon) => holdsEverstone(mon.item) && !EVERSTONE_IGNORED.has(dex.species.get(mon.species).id);

const GMAX_NO_EVOLVE = new Set(['pikachu', 'meowth', 'eevee']);

const gmaxStops = (dex, mon) => mon.gigantamax === true && GMAX_NO_EVOLVE.has(dex.species.get(mon.species).id);

export const EVOLUTION_WAYS = Object.freeze(['level', 'item', 'trade', 'battle', 'spin']);

const EVOLUTION_GATES = Object.freeze([
	{ id: 'locked', ways: EVOLUTION_WAYS, refuses: true, stops: (dex, mon) => mon.evolveLocked === true },
	{ id: 'everstone', ways: Object.freeze(['level', 'trade', 'battle']), stops: everstoneStops },
	{ id: 'gmax', ways: EVOLUTION_WAYS, stops: gmaxStops },
	{ id: 'generation', ways: EVOLUTION_WAYS, into: (mon, target) => laterSpecies(mon, target) },
]);
const MON_GATES = EVOLUTION_GATES.filter(g => g.stops), BRANCH_GATES = EVOLUTION_GATES.filter(g => g.into);

const laterSpecies = (mon, target) => Number.isInteger(mon.evolveGen) && target.gen > mon.evolveGen;

export const genMark = gen => (Number.isInteger(gen) ? { evolveGen: gen } : {});

export const branchOpen = (mon, target) => !BRANCH_GATES.some(g => g.into(mon, target));

export function evolutionGate(dex, mon, way) {
	const gate = MON_GATES.find(g => g.ways.includes(way) && g.stops(dex, mon));
	return gate ? { id: gate.id, ...(gate.refuses ? { refuses: true } : {}) } : null;
}

export const lockMark = locked => (locked === true ? { evolveLocked: true } : {});
/** Whether a gate stops mon evolving this way */
export const evolutionStops = (dex, mon, way) => !!evolutionGate(dex, mon, way);

export const willingMon = mon => ({ ...mon, evolveLocked: false });

export const evolutionHeld = (dex, mon) => MON_GATES.some(g => !g.refuses && g.ways.length === EVOLUTION_WAYS.length && g.stops(dex, mon));

export const TRADE_EVOLUTIONS = Object.freeze(['cord', 'level']);

export const ABSENT_TRADE_EVOLUTION = 'cord';

export const DEFAULT_TRADE_EVOLUTION_SETTING = 'level';

const COUNT_KINDS = Object.freeze(['damage', 'recoil', 'uses', 'kos', 'mentions', 'crits']);
/** Counts that last one battle only */
export const BATTLE_COUNTS = Object.freeze(new Set(['crits']));

export function personalityOf(uid) {
	let h = 0x811c9dc5;
	for (const ch of String(uid ?? '')) h = Math.imul(h ^ ch.codePointAt(0), 0x01000193) >>> 0;
	return h;
}

// Toxtricity's form by nature (Sword / Shield): Amped and Low Key
const AMPED = new Set(['hardy', 'brave', 'adamant', 'naughty', 'docile', 'impish', 'lax', 'hasty', 'jolly', 'naive', 'rash', 'sassy', 'quirky']);
const LOW_KEY = new Set(['lonely', 'bold', 'relaxed', 'timid', 'serious', 'modest', 'mild', 'quiet', 'bashful', 'calm', 'gentle', 'careful']);

const silcoon = p => (p >>> 16) % 10 < 5;
const rare = p => p % 100 === 0;

const RULES = Object.freeze({

	sirfetchd: { after: 'battle', count: { kind: 'crits', at: 3 } },
	runerigus: { level: true, time: 'night', count: { kind: 'damage', at: 49 } },
	basculegion: { level: true, count: { kind: 'recoil', at: 294 } },
	basculegionf: { level: true, count: { kind: 'recoil', at: 294 } },
	annihilape: { level: true, count: { kind: 'uses', of: 'ragefist', at: 20 } },
	wyrdeer: { level: true, count: { kind: 'uses', of: 'psyshieldbash', at: 20 } },
	overqwil: { level: true, count: { kind: 'uses', of: 'barbbarrage', at: 20 } },
	kingambit: { level: true, count: { kind: 'kos', of: 'bisharp', at: 3 } },
	pawmot: { level: true, count: { kind: 'mentions', at: 4 } },
	brambleghast: { level: true, count: { kind: 'mentions', at: 4 } },
	rabsca: { level: true, count: { kind: 'mentions', at: 4 } },
	gholdengo: { level: true, money: 9999 },
	solgaleo: { time: 'daySky' }, lunala: { time: 'nightSky' }, // by how the time looks (dusk = night), as the battle picture
	urshifu: { level: true, friendship: true, choice: 'dark' }, urshifurapidstrike: { level: true, friendship: true, choice: 'water' },
	malamar: { flip: true },
	palafin: { partner: true },
	melmetal: { level: true, badges: 4 },
	alcremie: { spin: true },

	silcoon: { personality: silcoon }, cascoon: { personality: p => !silcoon(p) },
	dudunsparcethreesegment: { personality: rare }, dudunsparce: { personality: p => !rare(p) },
	maushold: { personality: rare }, mausholdfour: { personality: p => !rare(p) },
	toxtricitylowkey: { natures: LOW_KEY }, toxtricity: { natures: AMPED },
	lycanrocdusk: { ability: 'owntempo', time: 'dusk', first: true },
	sylveon: { level: true, friendship: true, moveType: 'Fairy', first: true },
	probopass: { item: 'Thunder Stone' }, // generation 8 on: a Thunder Stone instead of the magnetic field
	shedinja: { extra: 'ninjask' },
	escavalier: { with: 'shelmet' }, accelgor: { with: 'karrablast' },

	alakazam: { tradeLevel: 36 }, machamp: { tradeLevel: 36 }, golem: { tradeLevel: 36 }, golemalola: { tradeLevel: 36 }, gengar: { tradeLevel: 36 },
	gigalith: { tradeLevel: 36 }, conkeldurr: { tradeLevel: 36 },
	trevenant: { tradeLevel: 28 }, gourgeist: { tradeLevel: 28 }, gourgeistsmall: { tradeLevel: 28 }, gourgeistlarge: { tradeLevel: 28 }, gourgeistsuper: { tradeLevel: 28 },
});
const ruleOf = target => RULES[target.id] ?? null;

const EXTRA_EVOS = Object.freeze({ meltan: ['Melmetal'], rockruff: ['Lycanroc-Dusk'], rockruffdusk: ['Lycanroc', 'Lycanroc-Midnight'] });

// Showdown evoCondition words a branch without a rule can have, as checks
const CONDITIONS = Object.freeze({
	'during the day': (dex, mon, now) => !isEvolutionNight(now.timeOfDay),
	'at night': (dex, mon, now) => isEvolutionNight(now.timeOfDay),
	'during rain': (dex, mon, now) => now.weather === 'raindance' || now.weather === 'primordialsea',
	'with an Atk stat > its Def stat': (dex, mon) => mon.stats?.atk > mon.stats?.def,
	'with an Atk stat < its Def stat': (dex, mon) => mon.stats?.atk < mon.stats?.def,
	'with an Atk stat equal to its Def stat': (dex, mon) => mon.stats?.atk === mon.stats?.def,
	'with a Remoraid in party': (dex, mon, now) => (now.party ?? []).some(name => toID(dex.species.get(name).baseSpecies) === 'remoraid'),
	'with a Dark-type in the party': (dex, mon, now) => (now.party ?? []).some(name => dex.species.get(name).types.includes('Dark')),
});

export const DUSK_FORM_HOURS = Object.freeze(new Set([17, 18, 19]));
const TIMES = Object.freeze({ day: timeOfDay => !isEvolutionNight(timeOfDay), night: isEvolutionNight,
	dusk: (timeOfDay, now) => timeOfDay === 'dusk' || DUSK_FORM_HOURS.has(now.clockHour),
	daySky: timeOfDay => !isNight(timeOfDay), nightSky: isNight });

const regionOf = (target, from) => (target.evoRegion ? toID(target.evoRegion) : REGIONAL_FORMES.has(target.forme) && target.forme !== from.forme ? toID(target.forme) : null);

function wayOf(target) {
	const rule = ruleOf(target);
	if (rule?.spin) return 'spin';
	if (rule?.after) return 'battle';
	if (rule?.item || target.evoType === 'useItem') return 'item';
	return target.evoType === 'trade' ? 'trade' : 'level';
}
const itemOf = target => toID(ruleOf(target)?.item ?? target.evoItem);

function branchesOf(dex, species) {
	return [...species.evos, ...EXTRA_EVOS[species.id] ?? []].map(name => dex.species.get(name))
		.filter(t => t.exists && t.isNonstandard !== 'CAP' && !ruleOf(t)?.extra);
}

const allowed = (target, from, mon, now) => genderAllows(mon.gender, target) && (!regionOf(target, from) || regionOf(target, from) === now.region);

/** Whether the rule's facts hold (the ones every way shares) */
function ruleHolds(dex, rule, mon, now) {
	if (!rule) return true;
	if (rule.time && !TIMES[rule.time](now.timeOfDay ?? 'day', now)) return false;
	if (rule.friendship && !((now.friendship ?? 0) >= EVOLVE_FRIENDSHIP)) return false;
	if (rule.count && !((mon.counts?.[rule.count.kind] ?? 0) >= rule.count.at)) return false;
	if (rule.money && !(now.money >= rule.money)) return false;
	if (rule.badges && !(now.badges >= rule.badges)) return false;
	if (rule.partner && !now.partner) return false;
	if (rule.personality && !rule.personality(personalityOf(mon.uid))) return false;
	if (rule.natures && !rule.natures.has(toID(mon.nature))) return false;
	if (rule.ability && toID(mon.ability) !== rule.ability) return false;
	if (rule.moveType && !(mon.moves ?? []).some(move => dex.moves.get(move).type === rule.moveType)) return false;
	return true;
}

function levelReady(dex, target, mon, now) {
	const rule = ruleOf(target);
	const level = now.level ?? 0;
	if (target.evoType === 'trade') return now.trade === 'level' && !!rule?.tradeLevel && level >= rule.tradeLevel;
	if (wayOf(target) !== 'level' || (target.evoLevel && level < target.evoLevel)) return false;
	if (target.evoType === 'levelFriendship' && !((now.friendship ?? 0) >= EVOLVE_FRIENDSHIP)) return false;
	if (target.evoType === 'levelHold' && toID(mon.item) !== toID(target.evoItem)) return false;
	if (target.evoType === 'levelMove' && !(mon.moves ?? []).map(toID).includes(toID(target.evoMove))) return false;
	if (!target.evoType && !target.evoLevel && !rule?.level) return false;
	if (rule) return ruleHolds(dex, rule, mon, now);
	if (!target.evoCondition) return !['levelExtra', 'other'].includes(target.evoType);
	return !!CONDITIONS[target.evoCondition]?.(dex, mon, now);
}

function pick(ready, from, now) {
	let list = ready;
	if (now.region && list.some(t => regionOf(t, from) === now.region)) list = list.filter(t => regionOf(t, from) === now.region);
	if (list.some(t => ruleOf(t)?.first)) list = list.filter(t => ruleOf(t)?.first);
	if (list.length > 1 && list.every(t => ruleOf(t)?.choice)) return list[0];
	if (list.length > 1 && list.some(t => t.forme === from.forme)) list = list.filter(t => t.forme === from.forme);
	return list.length === 1 ? list[0] : null;
}

function readyBranches(dex, mon, now, test) {
	const from = dex.species.get(mon.species);
	return { from, ready: branchesOf(dex, from).filter(t => branchOpen(mon, t) && allowed(t, from, mon, now) && test(t)) };
}

export function levelEvolution(dex, mon, now = {}) {
	if (evolutionStops(dex, mon, 'level')) return null;
	const { from, ready } = readyBranches(dex, mon, now, t => levelReady(dex, t, mon, now));
	return pick(ready, from, now)?.name ?? null;
}

export function itemEvolution(dex, mon, item, now = {}) {
	const key = toID(item);
	const stone = !evolutionStops(dex, mon, 'item'), traded = !evolutionStops(dex, mon, 'trade');
	const tradeItem = t => t.evoType === 'trade' && now.trade === 'level' && traded && !!t.evoItem && toID(t.evoItem) === key;
	const { from, ready } = readyBranches(dex, mon, now, t => (stone && wayOf(t) === 'item' && itemOf(t) === key && ruleHolds(dex, ruleOf(t), mon, now)) || tradeItem(t));
	return pick(ready, from, now)?.name ?? null;
}

export function evolutionItems(dex, trade = ABSENT_TRADE_EVOLUTION) {
	return new Set(dex.species.all().filter(t => wayOf(t) === 'item' || (trade === 'level' && t.evoType === 'trade' && t.evoItem)).map(itemOf).filter(Boolean));
}

export function tradeEvolution(dex, mon, now = {}) {
	if (evolutionStops(dex, mon, 'trade')) return null;
	const held = toID(mon.item);
	const party = new Set((now.party ?? []).map(name => toID(dex.species.get(name).baseSpecies)));
	const { from, ready } = readyBranches(dex, mon, now, t => wayOf(t) === 'trade' && (!t.evoItem || toID(t.evoItem) === held) && (!ruleOf(t)?.with || party.has(ruleOf(t).with)));
	const into = pick(ready, from, now);
	if (!into) return null;
	const partner = ruleOf(into)?.with;
	return { into: into.name, consumeHeld: !!into.evoItem, ...(partner ? { with: dex.species.get(partner).name } : {}) };
}

export function tradePair(dex, a, b) {
	const branch = (mon, other) => branchesOf(dex, dex.species.get(mon.species))
		.find(t => branchOpen(mon, t) && wayOf(t) === 'trade' && ruleOf(t)?.with === toID(dex.species.get(other.species).baseSpecies)) ?? null;
	const ab = branch(a, b), ba = branch(b, a);
	if (!ab || !ba) return null;
	const into = [evolutionStops(dex, a, 'trade') ? null : ab.name, evolutionStops(dex, b, 'trade') ? null : ba.name];
	return into.some(Boolean) ? into : null;
}

export function battleEvolution(dex, mon, now = {}) {
	if (evolutionStops(dex, mon, 'battle') || !now.won) return null;
	const { from, ready } = readyBranches(dex, mon, now, t => wayOf(t) === 'battle' && ruleHolds(dex, ruleOf(t), mon, now));
	return pick(ready, from, now)?.name ?? null;
}

// Sweets Milcery holds to evolve (the decoration on its cream)
const SWEETS = new Set(['strawberrysweet', 'berrysweet', 'lovesweet', 'starsweet', 'cloversweet', 'flowersweet', 'ribbonsweet']);

export const canSpin = (dex, mon) => !evolutionStops(dex, mon, 'spin') && SWEETS.has(toID(mon.item))
	&& branchesOf(dex, dex.species.get(mon.species)).some(t => branchOpen(mon, t) && wayOf(t) === 'spin');

function creamOf({ clockwise, seconds }, timeOfDay) {
	if (!clockwise && seconds > 10 && timeOfDay === 'dusk') return 'Alcremie-Rainbow-Swirl';
	const long = seconds > 5, night = isEvolutionNight(timeOfDay);
	if (clockwise) return night ? (long ? 'Alcremie-Lemon-Cream' : 'Alcremie-Matcha-Cream') : (long ? 'Alcremie-Caramel-Swirl' : 'Alcremie');
	return night ? (long ? 'Alcremie-Mint-Cream' : 'Alcremie-Salted-Cream') : (long ? 'Alcremie-Ruby-Swirl' : 'Alcremie-Ruby-Cream');
}

export function spinEvolution(dex, mon, spin, now = {}) {
	return spin && canSpin(dex, mon) ? creamOf(spin, now.timeOfDay ?? 'day') : null;
}

export function evolutionChoices(dex, from, into) {
	if (!ruleOf(dex.species.get(into))?.choice) return [];
	return branchesOf(dex, dex.species.get(from)).filter(t => ruleOf(t)?.choice).map(t => ({ species: t.name, choice: ruleOf(t).choice }));
}

export const evolutionFlips = (dex, into) => !!ruleOf(dex.species.get(into))?.flip;

export function usesHeldItem(dex, into, item) {
	const target = dex.species.get(into);
	return target.evoType === 'levelHold' && !!item && toID(item) === toID(target.evoItem);
}

export function extraEvolutions(dex, from, into) {
	const target = dex.species.get(into);
	return dex.species.get(from).evos.map(name => dex.species.get(name)).filter(t => ruleOf(t)?.extra === target.id).map(t => t.name);
}

export function countOf(dex, species) {
	const rule = branchesOf(dex, dex.species.get(species)).map(ruleOf).find(r => r?.count);
	return rule ? { kind: rule.count.kind, ...(rule.count.of ? { of: rule.count.of } : {}) } : null;
}

const SANDY = new Set(['cave', 'ice_cave', 'fairy_cave', 'desert', 'beach', 'mountain', 'badlands', 'volcano', 'wasteland', 'construction_site', 'ruins']);
const TRASH = new Set(['laboratory', 'factory', 'power_plant', 'dojo', 'temple', 'slum']);

export function cloakAfterBattle(dex, species, biome) {
	if (dex.species.get(species).baseSpecies !== 'Burmy') return null;
	return SANDY.has(biome) ? 'Burmy-Sandy' : TRASH.has(biome) ? 'Burmy-Trash' : 'Burmy';
}
