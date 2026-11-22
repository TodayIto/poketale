/** Attaches the record to a battle (createStoryBattle, before setPlayer) */
export function installUsedMoves(battle) {
	const actions = battle.actions;
	const { runMove } = actions;
	actions.runMove = function (moveOrMoveName, pokemon, targetLoc, options, ...rest) {
		const before = pokemon.lastMove;
		const result = runMove.call(this, moveOrMoveName, pokemon, targetLoc, options, ...rest);

		if (pokemon.lastMove && pokemon.lastMove !== before) {
			const id = options?.zMove ? this.dex.moves.get(moveOrMoveName).id : pokemon.lastMove.id;
			const used = (pokemon.m.usedMoves ??= []);
			if (!used.includes(id)) used.push(id);
		}
		return result;
	};
}

export const usedMoves = pokemon => pokemon?.m?.usedMoves ?? [];
