import { DEFAULT_FORMAT, DEFAULT_GEN, doublesFormat, multiFormat, formatRules, hasDoubles } from './rules.mjs';
import { installExtensions, extensionResults } from './extensions.mjs';
import { completeSet, heldItemForm, gmaxFactor, withDynamaxLevel, hasOneSpecial } from './mon.mjs';
import { levelUpAt } from './levelup.mjs';
import { eraSet, outsideStatus } from './era.mjs';
import { evsWithStatExp } from './stat-exp.mjs';
import { ruleGen, generationOf } from './generation.mjs';
import { checkSpec } from './input.mjs';
import { startsFainted } from './initial-state.mjs';
import { countsResult } from './counts.mjs';

// Format defaults and HP, PP and EV rules live in engine/rules.mjs
export { DEFAULT_FORMAT, MAINLINE_FORMAT, CHAMPIONS_FORMAT, doublesFormat, multiFormat, hasDoubles } from './rules.mjs';
export { winnerSide } from './winner.mjs';

export function createStoryBattle(sim, given, options = {}) {

	checkSpec(sim.Dex, given);
	const shape = battleShape(given);

	const format = given.formatid || DEFAULT_FORMAT;

	const { gen } = formatRules(sim, format).dex;
	const battle = new sim.Battle({
		formatid: shape.kind === 'multi' ? multiFormat(sim, format) : shape.kind === 'double' ? doublesFormat(format) : format,
		seed: given.seed,
		send: given.send,
	});

	const context = { spec: given, options, seats: shape.seats, sets: {}, whole: {} };
	installExtensions(sim, battle, 'create', context);

	const rng = new sim.PRNG(given.seed);

	const gmax = formatRules(sim, battle.format).champions ? set => set : set => gmaxFactor(sim.Dex, set);

	const movesUpTo = gen < DEFAULT_GEN ? gen : null;

	const lift = (set, m) => (hasOneSpecial(gen) && m.statExp ? { ...set, evs: evsWithStatExp(set.evs, m.statExp) } : set);

	const complete = (m, key) => lift(completeSet(sim.Dex, m.set, rng, { levelUp: levelUpAt(options.levelUp, key === 'p1' ? m.learnGen : movesUpTo), label: m.uid, tera: !m.noTera,
		...(hasOneSpecial(gen) ? { oneSpecial: true } : {}), ...((key === 'p2' || key === 'p4' || key === 'waiting') && movesUpTo ? { movesUpTo } : {}) }), m);
	for (const [key, seat] of Object.entries(shape.seats)) {
		context.sets[key] = seat.team.map(m => complete(m, key));

		const team = context.sets[key].map((set, i) => heldItemForm(sim.Dex, gmax(withDynamaxLevel(set, key === 'p1')),
			{ own: key === 'p1', status: seat.team[i].status, gen: generationOf(ruleGen(given)), writtenForms: !!given.writtenForms }));

		const era = team.map(set => eraSet(gen, set));
		if (era.some((set, i) => set !== team[i])) context.whole[key] = team;
		battle.setPlayer(key, { name: seat.name, team: sim.Teams.pack(era) });
	}

	if (shape.waiting) context.sets.waiting = shape.waiting.team.map(m => complete(m, 'waiting'));
	installExtensions(sim, battle, 'players', context); // experience (options.exp), the waiting trainer's filled sets
	return battle;
}

const able = team => team.filter(member => !startsFainted(member)).length;

export function battleShape(spec) {
	if ((spec.partner || spec.foePartner) && !spec.double) throw new Error('태그배틀(partner)·상대 둘(foePartner)은 더블배틀(double)에서만 됩니다');

	const double = spec.double && hasDoubles(spec.formatid || DEFAULT_FORMAT);
	const foes = spec.foePartner ? able(spec.p2.team) + able(spec.foePartner.team) : able(spec.p2.team);
	const merged = () => (spec.foePartner ? { ...spec.p2, team: [...spec.p2.team, ...spec.foePartner.team.map(member => ({ ...member, trainer: spec.foePartner.name }))] } : spec.p2);
	if (double && spec.partner && able(spec.partner.team) && foes >= 2) {
		const partner = { ...spec.partner, team: spec.partner.team.map(member => ({ ...member, partner: spec.partner.name })) };
		if (spec.foePartner) return { kind: 'multi', seats: { p1: spec.p1, p2: spec.p2, p3: partner, p4: spec.foePartner } };
		const order = [...spec.p2.team.filter(member => !startsFainted(member)), ...spec.p2.team.filter(startsFainted)];

		const half = n => ({ ...spec.p2, team: order.filter((_, i) => i % 2 === n)
			.map(member => ({ ...member, teamSlot: spec.p2.team.indexOf(member), ...(n ? { split: true } : {}) })) });
		return { kind: 'multi', seats: { p1: spec.p1, p2: half(0), p3: partner, p4: half(1) } };
	}
	const kind = double && able(spec.p1.team) >= 2 && foes >= 2 ? 'double' : 'single';
	if (kind === 'single' && spec.foePartner && able(spec.p2.team) && able(spec.foePartner.team)) return { kind, seats: { p1: spec.p1, p2: spec.p2 }, waiting: spec.foePartner };
	return { kind, seats: { p1: spec.p1, p2: merged() } };
}

export const waitingTrainer = spec => battleShape(spec).waiting ?? null;

export function extractResult(sim, battle) {

	const [mine, theirs, ally, other] = battle.sides;
	const own = p => !p.m.partner && !p.m.trainer;

	const sideMon = p => ({ ...resultMon(sim, p), appeared: p.previouslySwitchedIn > 0 });
	const half = (side, extra, mon) => {
		const team = [...side.pokemon.filter(own), ...extra];
		return { id: side.id, name: side.name, pokemonLeft: team.length === side.pokemon.length ? side.pokemonLeft : team.filter(p => !p.fainted).length,
			team: team.map(mon) };
	};
	const split = other ? other.pokemon.filter(p => p.m.split) : [];
	const partner = [...mine.pokemon, ...(ally?.pokemon ?? [])].filter(p => p.m.partner);
	const foePartner = [...theirs.pokemon.filter(p => p.m.trainer), ...(other?.pokemon.filter(p => !p.m.split) ?? [])];
	return {
		ended: battle.ended,
		turn: battle.turn,

		...(battle.activePerHalf > 1 ? { double: true } : {}),
		sides: [half(mine, [], sideMon), half(theirs, split, sideMon)],

		...(partner.length ? { partner: partner.map(p => resultMon(sim, p)) } : {}),
		// a second opposing trainer's Pokemon, apart from p2's team
		...(foePartner.length ? { foePartner: foePartner.map(sideMon) } : {}),

		...extensionResults(battle),
	};
}

/** One Pokemon of the result */
function resultMon(sim, p) {
	return {
		uid: p.m.uid,

		species: p.m.start.species,
		baseSpecies: p.m.start.species,
		name: p.name,
		level: p.level,

		hp: p.volatiles.dynamax ? p.getUndynamaxedHP() : p.hp,
		maxhp: p.volatiles.dynamax ? p.baseMaxhp : p.maxhp,
		fainted: p.fainted,

		status: p.fainted ? 'fnt' : outsideStatus(p.battle.gen, p.status) || '',
		active: p.isActive,

		...(p.isActive ? { position: p.position + Math.floor(p.side.n / 2) * p.side.active.length } : {}),
		item: p.item || '',

		originalItem: sim.Dex.toID(p.m.start.whole?.item ?? p.set.item) || '',
		ability: sim.Dex.toID(p.m.start.ability),

		nature: p.m.start.whole?.nature ?? p.set.nature,
		ivs: { ...(p.m.start.whole?.ivs ?? p.set.ivs) },

		evs: { ...p.set.evs },
		gender: p.m.start.whole?.gender ?? p.gender,
		shiny: !!p.set.shiny,

		teraType: p.m.noTera && !p.set.teraType ? undefined : p.teraType,
		terastallized: p.terastallized || '',

		moves: p.baseMoveSlots.map((s, i) => (p.m.crowned?.slot === i && s.id === p.m.crowned.move ? { id: 'ironhead', pp: p.m.crowned.pp, maxpp: p.m.crowned.maxpp, ppUps: p.m.crowned.ppUps }
			: { id: s.id, pp: s.pp, maxpp: s.maxpp, ppUps: p.ppUps[i] ?? 0 })),
		exp: p.m.exp, // p1 only, with options.exp (otherwise omitted from the JSON)
		friendship: p.m.friendship, // p1 own only (engine/friendship.mjs - otherwise omitted from the JSON)
		friendshipCarry: p.m.friendshipCarry || undefined,

		...(p.m.statExp ? { statExp: { ...p.m.statExp } } : {}),
		counts: countsResult(p),
		cloak: p.m.cloak,

		...(p.m.start.gigantamax ? { gigantamax: true } : {}),
		...(p.m.start.dynamaxLevel !== undefined ? { dynamaxLevel: p.m.start.dynamaxLevel } : {}),
	};
}
