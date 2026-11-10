import { DEFAULT_FORMAT, doublesFormat, multiFormat } from './rules.mjs';
import { installExtensions, extensionResults } from './extensions.mjs';
import { completeSet, heldItemForm } from './mon.mjs';
import { checkSpec } from './input.mjs';
import { startsFainted } from './initial-state.mjs';
import { countsResult } from './counts.mjs';

// Format defaults and HP, PP and EV rules live in engine/rules.mjs
export { DEFAULT_FORMAT, MAINLINE_FORMAT, CHAMPIONS_FORMAT, doublesFormat, multiFormat } from './rules.mjs';
export { winnerSide } from './winner.mjs';

export function createStoryBattle(sim, given, options = {}) {

	checkSpec(sim.Dex, given);
	const shape = battleShape(given);

	const format = given.formatid || DEFAULT_FORMAT;
	const battle = new sim.Battle({
		formatid: shape.kind === 'multi' ? multiFormat(sim, format) : shape.kind === 'double' ? doublesFormat(format) : format,
		seed: given.seed,
		send: given.send,
	});

	const context = { spec: given, options, seats: shape.seats, sets: {} };
	installExtensions(sim, battle, 'create', context);

	const rng = new sim.PRNG(given.seed);
	for (const [key, seat] of Object.entries(shape.seats)) {
		context.sets[key] = seat.team.map(m => completeSet(sim.Dex, m.set, rng, { levelUp: options.levelUp, label: m.uid }));
		battle.setPlayer(key, { name: seat.name, team: sim.Teams.pack(context.sets[key].map(set => heldItemForm(sim.Dex, set))) });
	}

	if (shape.waiting) context.sets.waiting = shape.waiting.team.map(m => completeSet(sim.Dex, m.set, rng, { levelUp: options.levelUp, label: m.uid }));
	installExtensions(sim, battle, 'players', context);
	return battle;
}

const able = team => team.filter(member => !startsFainted(member)).length;

export function battleShape(spec) {
	if ((spec.partner || spec.foePartner) && !spec.double) throw new Error('태그배틀(partner)·상대 둘(foePartner)은 더블배틀(double)에서만 됩니다');
	const foes = spec.foePartner ? able(spec.p2.team) + able(spec.foePartner.team) : able(spec.p2.team);
	const merged = () => (spec.foePartner ? { ...spec.p2, team: [...spec.p2.team, ...spec.foePartner.team.map(member => ({ ...member, trainer: spec.foePartner.name }))] } : spec.p2);
	if (spec.double && spec.partner && able(spec.partner.team) && foes >= 2) {
		const partner = { ...spec.partner, team: spec.partner.team.map(member => ({ ...member, partner: spec.partner.name })) };
		if (spec.foePartner) return { kind: 'multi', seats: { p1: spec.p1, p2: spec.p2, p3: partner, p4: spec.foePartner } };
		const order = [...spec.p2.team.filter(member => !startsFainted(member)), ...spec.p2.team.filter(startsFainted)];

		const half = n => ({ ...spec.p2, team: order.filter((_, i) => i % 2 === n)
			.map(member => ({ ...member, teamSlot: spec.p2.team.indexOf(member), ...(n ? { split: true } : {}) })) });
		return { kind: 'multi', seats: { p1: spec.p1, p2: half(0), p3: partner, p4: half(1) } };
	}
	const kind = spec.double && able(spec.p1.team) >= 2 && foes >= 2 ? 'double' : 'single';
	if (kind === 'single' && spec.foePartner && able(spec.p2.team) && able(spec.foePartner.team)) return { kind, seats: { p1: spec.p1, p2: spec.p2 }, waiting: spec.foePartner };
	return { kind, seats: { p1: spec.p1, p2: merged() } };
}

export const waitingTrainer = spec => battleShape(spec).waiting ?? null;

export function extractResult(sim, battle) {

	const [mine, theirs, ally, other] = battle.sides;
	const own = p => !p.m.partner && !p.m.trainer;
	const half = (side, extra) => {
		const team = [...side.pokemon.filter(own), ...extra];
		return { id: side.id, name: side.name, pokemonLeft: team.length === side.pokemon.length ? side.pokemonLeft : team.filter(p => !p.fainted).length,
			team: team.map(p => resultMon(sim, p)) };
	};
	const split = other ? other.pokemon.filter(p => p.m.split) : [];
	const partner = [...mine.pokemon, ...(ally?.pokemon ?? [])].filter(p => p.m.partner);
	const foePartner = [...theirs.pokemon.filter(p => p.m.trainer), ...(other?.pokemon.filter(p => !p.m.split) ?? [])];
	return {
		ended: battle.ended,
		turn: battle.turn,

		...(battle.activePerHalf > 1 ? { double: true } : {}),
		sides: [half(mine, []), half(theirs, split)],

		...(partner.length ? { partner: partner.map(p => resultMon(sim, p)) } : {}),

		...(foePartner.length ? { foePartner: foePartner.map(p => resultMon(sim, p)) } : {}),

		...extensionResults(battle),
	};
}

function resultMon(sim, p) {
	return {
		uid: p.m.uid,

		species: p.m.start.species,
		baseSpecies: p.m.start.species,
		name: p.name,
		level: p.level,
		hp: p.hp,
		maxhp: p.maxhp,
		fainted: p.fainted,
		status: p.fainted ? 'fnt' : p.status || '',
		active: p.isActive,

		...(p.isActive ? { position: p.position + Math.floor(p.side.n / 2) * p.side.active.length } : {}),
		item: p.item || '',
		originalItem: sim.Dex.toID(p.set.item) || '',
		ability: sim.Dex.toID(p.m.start.ability),

		nature: p.set.nature,
		ivs: { ...p.set.ivs },

		evs: { ...p.set.evs },
		gender: p.gender,
		shiny: !!p.set.shiny,
		teraType: p.teraType,
		terastallized: p.terastallized || '',

		moves: p.baseMoveSlots.map((s, i) => ({ id: s.id, pp: s.pp, maxpp: s.maxpp, ppUps: p.ppUps[i] ?? 0 })),
		exp: p.m.exp,
		friendship: p.m.friendship,
		friendshipCarry: p.m.friendshipCarry || undefined,
		counts: countsResult(p),
		cloak: p.m.cloak,
	};
}
