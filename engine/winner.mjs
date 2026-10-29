export function installWinner(battle) {
	const win = battle.win;
	battle.win = function (side) {
		const target = side && typeof side === 'string' ? this.getSide(side) : side && this.sides.includes(side) ? side : null;
		const ended = win.call(this, side);
		if (ended) this.storyWinner = target ? target.id : null;
		return ended;
	};
}

export function winnerSide(battle) {
	if (!battle.ended) return null;
	if (battle.storyWinner !== undefined) return battle.storyWinner;
	return battle.winner ? battle.sides.find(s => s.name === battle.winner)?.id ?? null : null;
}

export function winnerResult(battle) {
	const winner = winnerSide(battle);
	return { outcome: !battle.ended ? 'ongoing' : winner ? 'win' : 'tie', winner };
}
