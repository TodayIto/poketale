import { DEFAULT_FORMAT } from './rules.mjs';
import { installExtensions, extensionResults } from './extensions.mjs';
import { completeSet } from './mon.mjs';
import { checkSpec } from './input.mjs';

// Format defaults and HP, PP and EV rules live in engine/rules.mjs
export { DEFAULT_FORMAT, MAINLINE_FORMAT, CHAMPIONS_FORMAT } from './rules.mjs';
export { winnerSide } from './winner.mjs';

export function createStoryBattle(sim, spec, options = {}) {

	checkSpec(sim.Dex, spec);

	const battle = new sim.Battle({
		formatid: spec.formatid || DEFAULT_FORMAT,
		seed: spec.seed,
		send: spec.send,
	});

	const context = { spec, options };
	installExtensions(sim, battle, 'create', context);

	const rng = new sim.PRNG(spec.seed);
	for (const key of ['p1', 'p2']) {
		const team = spec[key].team.map(m => completeSet(sim.Dex, m.set, rng, { levelUp: options.levelUp, label: m.uid }));
		battle.setPlayer(key, { name: spec[key].name, team: sim.Teams.pack(team) });
	}
	installExtensions(sim, battle, 'players', context);
	return battle;
}

export function extractResult(sim, battle) {
	return {
		ended: battle.ended,
		turn: battle.turn,
		sides: battle.sides.map(side => ({
			id: side.id,
			name: side.name,
			pokemonLeft: side.pokemonLeft,
			team: side.pokemon.map(p => ({
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
				item: p.item || '',
				originalItem: sim.Dex.toID(p.set.item) || '',
				ability: p.m.start.ability,

				nature: p.set.nature,
				ivs: { ...p.set.ivs },

				evs: { ...p.set.evs },
				gender: p.gender,
				shiny: !!p.set.shiny,
				teraType: p.teraType,
				terastallized: p.terastallized || '',

				moves: p.baseMoveSlots.map((s, i) => ({ id: s.id, pp: s.pp, maxpp: s.maxpp, ppUps: p.ppUps[i] ?? 0 })),
				exp: p.m.exp,
			})),
		})),

		...extensionResults(battle),
	};
}
