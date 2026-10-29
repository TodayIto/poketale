import { ppUpCount } from './pp.mjs';
import { STATS, MAX_IV } from './mon.mjs';

// Mainline rules: custom game (mainline level, IV and EV formulas, mainline PP Ups)
export const MAINLINE_FORMAT = 'gen9customgame@@@!Team Preview';

export const CHAMPIONS_FORMAT = 'gen9championscustomgame@@@!Team Preview,Level Clause Mod';

export const DEFAULT_FORMAT = MAINLINE_FORMAT;

export const EV_STAT_MAX = 252, EV_TOTAL_MAX = 510;

export const NO_EVS = Object.freeze(Object.fromEntries(STATS.map(s => [s, 0])));

const cache = new WeakMap();
const wrapped = new WeakSet();

export function formatRules(sim, format = DEFAULT_FORMAT) {

	let byId = cache.get(sim.Dex);
	if (!byId) cache.set(sim.Dex, byId = new Map());
	const key = typeof format === 'string' ? format : null;
	if (key !== null && byId.has(key)) return byId.get(key);
	const f = key !== null ? sim.Dex.formats.get(format, true) : format;
	const dex = sim.Dex.forFormat(f);
	const ruleTable = sim.Dex.formats.getRuleTable(f);
	const champions = f.mod === 'champions';
	const scripts = dex.data.Scripts || {};

	const self = { dex, ruleTable, trunc: dex.trunc, gen: dex.gen };
	const statModify = scripts.statModify || sim.Battle.prototype.statModify;
	const calculatePP = scripts.calculatePP || sim.Battle.prototype.calculatePP;
	const rules = {
		formatid: typeof format === 'string' ? format : format.id, champions, effort: !champions, dex,

		stat: (baseStats, set, statName) => statModify.call(self, baseStats, rules.engineSet(set), statName),

		engineSet: set => (champions ? { ...set, evs: NO_EVS } : set),

		maxPp(moveId, ups = 0) {
			const move = dex.moves.get(moveId);
			if (!move?.exists) return 0;
			return calculatePP.call(self, move, ppUpCount(move, ups));
		},

		maxHp(set) {
			const species = dex.species.get(set.species);
			if (species.maxHP) return species.maxHP;
			const full = { ...set, ivs: { hp: set.ivs?.hp ?? MAX_IV }, evs: { hp: set.evs?.hp ?? 0 } };
			return rules.stat(species.baseStats, full, 'hp');
		},
	};
	if (key !== null) byId.set(key, rules);
	return rules;
}

export function applyFormatRules(sim, battle) {
	const rules = formatRules(sim, battle.format);
	if (rules.effort || wrapped.has(battle)) return rules;
	const statModify = battle.statModify;
	battle.statModify = function (baseStats, set, statName) {
		return statModify.call(this, baseStats, { ...set, evs: NO_EVS }, statName);
	};
	wrapped.add(battle);
	return rules;
}
