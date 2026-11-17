import { applyPpUps } from './pp.mjs';
import { injectStatus, restoreSpread } from './showdown-compat.mjs';
import { heldItemForm } from './mon.mjs';

export function installInitialState(sim, battle, seats, sets) {
	const baseFormat = battle.format;
	battle.format = Object.create(baseFormat, {
		onBattleStart: {
			value() {
				for (const side of battle.sides) applyInitialState(sim, side, seats[side.id].team, sets[side.id]);
				baseFormat.onBattleStart?.call(this);
			},
		},
	});
}

export function recordStartForms(sim, battle, sets) {
	for (const side of battle.sides) {
		for (const pokemon of side.pokemon) {
			const set = sets[side.id][side.team.indexOf(pokemon.set)];
			// The whole set as it started, before an older generation switched parts of it off (engine/era.mjs). The Tera type
			// is the one its held-item form carries in generation 9 (an Ogerpon without its mask would turn Grass)
			const { teraType } = heldItemForm(sim.Dex, set);
			pokemon.m.start = { species: battle.dex.species.get(set.species).name, ability: set.ability, nature: set.nature, item: set.item, gender: set.gender,
				...(set.ivs ? { ivs: { ...set.ivs } } : {}), ...(teraType ? { teraType } : {}) };
		}
	}
}

export const startsFainted = member => (member.hp !== undefined ? Math.trunc(member.hp) <= 0 : member.hpPercent !== undefined && member.hpPercent <= 0);

function applyInitialState(sim, side, team, sets) {

	side.pokemon.forEach((pokemon, i) => {
		const member = team[i];
		pokemon.m.uid = member.uid;

		restoreSpread(side.battle, pokemon, sets[i]);
		if (member.partner) pokemon.m.partner = member.partner;
		if (member.trainer) pokemon.m.trainer = member.trainer;
		if (member.split) pokemon.m.split = true;
		if (member.teamSlot !== undefined) pokemon.m.teamSlot = member.teamSlot;
		if (member.natureOrig) pokemon.m.natureOrig = member.natureOrig;
		if (member.ot) pokemon.m.ot = member.ot;
		if (member.heldCustom) pokemon.m.heldCustom = member.heldCustom;
		if (member.noTera) pokemon.m.noTera = true;

		applyPpUps(side.battle, pokemon, member.ppUps);

		for (const [moveid, pp] of Object.entries(member.pp || {})) {
			const slot = pokemon.moveSlots.find(s => s.id === sim.Dex.toID(moveid));
			if (!slot) {
				// A foe's later move the battle generation does not have was dropped (engine/core.mjs), and its PP with it
				if ((member.set?.moves ?? []).some(m => sim.Dex.toID(m) === sim.Dex.toID(moveid))) continue;
				throw new Error(`${member.uid}: 기술 "${moveid}" 이 없습니다`);
			}
			slot.pp = Math.max(0, Math.min(slot.maxpp, pp));
		}

		let hp = pokemon.maxhp;
		if (member.hp !== undefined) hp = member.hp;
		else if (member.hpPercent !== undefined) hp = Math.round(pokemon.maxhp * member.hpPercent / 100);
		hp = Math.max(0, Math.min(pokemon.maxhp, Math.trunc(hp)));
		if (member.hpPercent > 0 && hp === 0) hp = 1;
		pokemon.hp = hp;

		if (startsFainted(member)) {
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

	let alive = side.pokemon.filter(p => !p.fainted);
	if (!alive.length) throw new Error(`${side.id}: 싸울 수 있는 포켓몬이 없습니다`);
	const own = alive.find(p => !p.m.trainer), second = alive.find(p => p.m.trainer);
	if (own && second && side.active.length > 1) alive = [own, second, ...alive.filter(p => p !== own && p !== second)];
	side.pokemon = [...alive, ...side.pokemon.filter(p => p.fainted)];
	side.pokemon.forEach((p, i) => { p.position = i; });
}
