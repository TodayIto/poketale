import { STATS, hasOneSpecial } from './mon.mjs';
import { EV_STAT_MAX } from './rules.mjs';

// Generations 1-2 raise stat experience in place of EVs (Bulbapedia "Stat experience"; pret/pokered, pret/pokecrystal):
// a defeated foe adds its base stats, shared out like its experience, each stat up to 65535 and no cap on the total. One
// Special gains the foe's base Special (generation 2: its base Sp. Atk) and counts for both special stats.
// The story keeps EVs, so they carry to every generation: a stat's EV is min(252, ceil(sqrt(stat experience))), which
// gives the games' stats (floor(min(255, ceil(sqrt S)) / 4) in the formula). The stat experience behind each EV is kept
// as mon.statExp; where the EV was changed without it (another generation, training, berries) it is taken as EV squared
export const STAT_EXP_MAX = 65535;

export const usesStatExp = gen => hasOneSpecial(gen);

export const evOfStatExp = value => Math.min(EV_STAT_MAX, Math.ceil(Math.sqrt(value)));

const isStatExp = value => Number.isInteger(value) && value >= 0 && value <= STAT_EXP_MAX;

export function statExpOf(statExp, evs) {
	return Object.fromEntries(STATS.map(s => {
		const ev = Math.max(0, Math.trunc(Number(evs?.[s]) || 0));
		const value = statExp?.[s];
		return [s, isStatExp(value) && evOfStatExp(value) === ev ? value : Math.min(STAT_EXP_MAX, ev * ev)];
	}));
}

// The foe's base stats as gains; Special is its base Sp. Atk for both special stats
export const statExpYield = base => ({ hp: base.hp, atk: base.atk, def: base.def, spa: base.spa, spd: base.spa, spe: base.spe });

// Adds gains to stat experience and raises the EVs to match. EVs never go down here: an EV above what its stat
// experience gives (imported, or past 252) stays
export function gainStatExp(statExp, evs, gain) {
	const out = { ...statExp };
	const nextEvs = { ...evs };
	for (const s of STATS) {
		const add = Math.max(0, Math.trunc(gain[s] ?? 0));
		if (!add) continue;
		out[s] = Math.min(STAT_EXP_MAX, out[s] + add);
		nextEvs[s] = Math.max(nextEvs[s] ?? 0, evOfStatExp(out[s]));
	}
	return { statExp: out, evs: nextEvs };
}

// Vitamins (Bulbapedia "Vitamin"; pret item_effects.asm): usable below 25600 stat experience, each adds 2560, which may
// end above 25600. A special vitamin raises the one Special, so both special stats
export const VITAMIN_STAT_EXP = 2560;
export const VITAMIN_STAT_EXP_BELOW = 25600;

export const vitaminStats = stat => (stat === 'spa' || stat === 'spd' ? ['spa', 'spd'] : [stat]);

export const vitaminWorks = (statExp, stat) => Math.max(...vitaminStats(stat).map(s => statExp[s])) < VITAMIN_STAT_EXP_BELOW;

export const vitaminGain = stat => Object.fromEntries(vitaminStats(stat).map(s => [s, VITAMIN_STAT_EXP]));
