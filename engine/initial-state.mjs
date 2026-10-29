import { applyPpUps } from './pp.mjs';
import { injectStatus } from './showdown-compat.mjs';

export function installInitialState(sim, battle, spec) {
	const baseFormat = battle.format;
	battle.format = Object.create(baseFormat, {
		onBattleStart: {
			value() {
				for (const [i, key] of ['p1', 'p2'].entries()) applyInitialState(sim, battle.sides[i], spec[key].team);
				baseFormat.onBattleStart?.call(this);
			},
		},
	});
}

export function recordStartForms(sim, battle) {
	for (const side of battle.sides) {
		for (const pokemon of side.pokemon) {
			pokemon.m.start = { species: battle.dex.species.get(pokemon.set.species || pokemon.set.name).name, ability: sim.Dex.toID(pokemon.set.ability) };
		}
	}
}

function applyInitialState(sim, side, team) {

	side.pokemon.forEach((pokemon, i) => {
		const member = team[i];
		pokemon.m.uid = member.uid;
		if (member.natureOrig) pokemon.m.natureOrig = member.natureOrig;
		if (member.ot) pokemon.m.ot = member.ot;

		applyPpUps(side.battle, pokemon, member.ppUps);

		for (const [moveid, pp] of Object.entries(member.pp || {})) {
			const slot = pokemon.moveSlots.find(s => s.id === sim.Dex.toID(moveid));
			if (!slot) throw new Error(`${member.uid}: 기술 "${moveid}" 이 없습니다`);
			slot.pp = Math.max(0, Math.min(slot.maxpp, pp));
		}

		let hp = pokemon.maxhp;
		if (member.hp !== undefined) hp = member.hp;
		else if (member.hpPercent !== undefined) hp = Math.round(pokemon.maxhp * member.hpPercent / 100);
		hp = Math.max(0, Math.min(pokemon.maxhp, Math.trunc(hp)));
		if (member.hpPercent > 0 && hp === 0) hp = 1;
		pokemon.hp = hp;

		if (hp === 0) {
			pokemon.fainted = true;
			pokemon.status = 'fnt';
			side.pokemonLeft--;
			return;
		}

		const status = member.status || '';
		if (status) {

			const battle = side.battle, champions = battle.dex.currentMod === 'champions';
			injectStatus(battle, pokemon, status, {
				sleepTurns: member.sleepTurns ?? (champions ? battle.sample([2, 3, 3]) : battle.random(2, 5)),
				freezeTurns: champions ? 3 : undefined,
			});
		}
	});

	// The lead is side.pokemon[0]. Fainted party members are moved to the back (input order otherwise kept).
	const alive = side.pokemon.filter(p => !p.fainted);
	if (!alive.length) throw new Error(`${side.id}: 싸울 수 있는 포켓몬이 없습니다`);
	side.pokemon = [...alive, ...side.pokemon.filter(p => p.fainted)];
	side.pokemon.forEach((p, i) => { p.position = i; });
}
