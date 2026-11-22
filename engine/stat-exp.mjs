import { STATS } from './mon.mjs';
import { EV_STAT_MAX } from './rules.mjs';

export const STAT_EXP_MAX = 65535;

export const evOfStatExp = value => Math.min(EV_STAT_MAX, Math.ceil(Math.sqrt(value)));

const isStatExp = value => Number.isInteger(value) && value >= 0 && value <= STAT_EXP_MAX;

export const isStatExpTable = value => !!value && typeof value === 'object' && !Array.isArray(value) && STATS.every(s => isStatExp(value[s]));

export function evsWithStatExp(evs, statExp) {
	if (!statExp) return evs;
	return Object.fromEntries(STATS.map(s => [s, Math.max(Math.max(0, Math.trunc(Number(evs?.[s]) || 0)), isStatExp(statExp[s]) ? evOfStatExp(statExp[s]) : 0)]));
}

export function statExpOf(statExp, evs) {
	return Object.fromEntries(STATS.map(s => {
		const ev = Math.max(0, Math.trunc(Number(evs?.[s]) || 0));
		const value = statExp?.[s];
		return [s, isStatExp(value) && evOfStatExp(value) === ev ? value : Math.min(STAT_EXP_MAX, ev * ev)];
	}));
}

export const statExpNow = (statExp, evs) => statExpOf(statExp, evsWithStatExp(evs, statExp));

export const statExpYield = base => ({ hp: base.hp, atk: base.atk, def: base.def, spa: base.spa, spd: base.spa, spe: base.spe });

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

export const VITAMIN_STAT_EXP = 2560;
const VITAMIN_STAT_EXP_BELOW = 25600;

const vitaminStats = stat => (stat === 'spa' || stat === 'spd' ? ['spa', 'spd'] : [stat]);

/** Whether a vitamin for stat works on this stat experience (statExpNow) */
export const vitaminWorks = (statExp, stat) => Math.max(...vitaminStats(stat).map(s => statExp[s] ?? 0)) < VITAMIN_STAT_EXP_BELOW;

/** A vitamin's gain as stat experience (gainStatExp) */
export const vitaminGain = stat => Object.fromEntries(vitaminStats(stat).map(s => [s, VITAMIN_STAT_EXP]));
