import { toID } from './mon.mjs';

export const MAX_PP_UPS = 3;

export function ppUpCount(move, ups) {
	if (!move || move.noPPBoosts) return 0;
	const n = Math.trunc(Number(ups) || 0);
	return Math.max(0, Math.min(MAX_PP_UPS, n));
}

export function maxPpWith(move, ups) {
	if (!move?.exists) return 0;
	return move.pp + Math.floor(move.pp / 5) * ppUpCount(move, ups);
}

export function applyPpUps(battle, pokemon, ppUps) {
	const table = Object.fromEntries(Object.entries(ppUps || {}).map(([id, n]) => [toID(id), n]));
	pokemon.baseMoveSlots.forEach((slot, i) => {
		const move = battle.dex.moves.get(slot.id);
		const ups = ppUpCount(move, table[slot.id]);
		slot.maxpp = slot.pp = battle.calculatePP(move, ups);
		pokemon.ppUps[i] = ups;
	});
}

/** PP of a newly learned move slot (0 PP Ups) */
export const newMovePp = (battle, move) => battle.calculatePP(move, 0);
