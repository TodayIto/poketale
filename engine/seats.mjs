// Trainer ownership and shared trainer state across battle seats.
export const trainerOf = pokemon => pokemon?.m.trainer ?? null;

export function twinSeat(side) {
	const [, first, , second] = side.battle.sides;
	if (!second?.pokemon.some(pokemon => pokemon.m.split)) return null;
	return side === first ? second : side === second ? first : null;
}

const shared = side => side.pokemon.some(pokemon => pokemon.m.trainer);

export const benchOf = (side, trainer) => side.pokemon.slice(side.active.length).filter(pokemon => !pokemon.fainted && trainerOf(pokemon) === trainer);

export function installSeats(battle) {
	const canSwitch = battle.canSwitch;
	battle.canSwitch = function (side) {
		if (shared(side)) {
			const subject = [this.activePokemon, this.effectState?.target].find(pokemon => pokemon?.side === side && pokemon.isActive);
			if (subject) return benchOf(side, trainerOf(subject)).length;
		}
		return canSwitch.call(this, side);
	};
	const checkFainted = battle.checkFainted;
	battle.checkFainted = function () {
		checkFainted.call(this);
		for (const side of this.sides) {
			if (!shared(side)) continue;
			for (const pokemon of side.active) if (pokemon?.fainted && pokemon.switchFlag && !benchOf(side, trainerOf(pokemon)).length) pokemon.switchFlag = false;
		}
	};
	const actions = battle.actions, dragIn = actions.dragIn;
	actions.dragIn = function (side, pos) {
		if (!shared(side)) return dragIn.call(this, side, pos);
		const trainer = trainerOf(side.active[pos]);

		battle.getRandomSwitchable = () => { const bench = benchOf(side, trainer); return bench.length ? battle.sample(bench) : null; };
		try { return dragIn.call(this, side, pos); } finally { delete battle.getRandomSwitchable; }
	};
}
