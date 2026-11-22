import { ppUpCount } from './pp.mjs';
import { STATS, MAX_IV, hasOneSpecial } from './mon.mjs';

export const MAINLINE_FORMAT = 'gen9customgame@@@!Team Preview';

export const CHAMPIONS_FORMAT = 'gen9championscustomgame@@@!Team Preview,Level Clause Mod';

export const DEFAULT_FORMAT = MAINLINE_FORMAT;

export const DEFAULT_GEN = 9;
export const GENS = Object.freeze(Array.from({ length: DEFAULT_GEN }, (_, i) => i + 1));
export const isGen = value => GENS.includes(value);

export const genFormat = gen => {
	if (!isGen(gen)) throw new Error(`No generation ${gen}`);
	return gen === DEFAULT_GEN ? MAINLINE_FORMAT : gen <= 4 ? `gen${gen}customgame` : `gen${gen}customgame@@@!Team Preview`;
};

const RULE_FORMATS = Object.freeze({ mainline: MAINLINE_FORMAT, champions: CHAMPIONS_FORMAT });
export const RULE_IDS = Object.freeze(Object.keys(RULE_FORMATS));
export const DEFAULT_RULE = 'mainline';

export function ruleFormat(value = DEFAULT_RULE, gen = isGen(value) ? value : null) {
	if (Object.hasOwn(RULE_FORMATS, value)) return RULE_FORMATS[value];
	if (value === 'auto' || isGen(value)) return genFormat(gen);
	return undefined;
}

export function formatRule(format) {
	const rule = RULE_IDS.find(id => RULE_FORMATS[id] === format) ?? (GENS.some(gen => genFormat(gen) === format) ? 'mainline' : null);
	if (!rule) throw new Error(`No rule for the format ${format}`);
	return rule;
}

export const hasDoubles = format => Number(/^gen(\d)/.exec(String(format))?.[1] ?? DEFAULT_GEN) >= 3;

export function doublesFormat(format) {
	const [id, rules] = String(format).split('@@@');
	const doubles = hasDoubles(id) ? id.replace(/^gen(\d)(champions)?customgame$/, 'gen$1$2doublescustomgame') : id;
	if (doubles === id) throw new Error(`No double-battle format for ${format}`);
	return rules === undefined ? doubles : `${doubles}@@@${rules}`;
}

export function multiFormat(sim, format) {
	const [id, rules] = doublesFormat(format).split('@@@');
	const multi = id.replace('doubles', 'multi');
	const formats = sim.Dex.formats;
	if (!formats.rulesetCache.has(multi)) {
		const doubles = sim.Dex.data.Rulesets[id];
		if (!doubles) throw new Error(`No doubles custom game for ${format}`);
		const data = {
			name: doubles.name.replace('Doubles', 'Multi'), mod: doubles.mod, gameType: 'multi', debug: doubles.debug, battle: doubles.battle,
			ruleset: [...doubles.ruleset], banlist: [...doubles.banlist], restricted: [...doubles.restricted], unbanlist: [...doubles.unbanlist],
			searchShow: false, section: doubles.section, column: doubles.column,
		};

		const made = new (formats.get(id).constructor)(data);
		made.effectType = 'Format';
		made.baseRuleset = data.ruleset.slice();
		if (made.id !== multi) throw new Error(`Multi format id mismatch: ${made.id}`);
		formats.rulesetCache.set(multi, made);
		sim.Dex.data.Rulesets[multi] = { ...made, ruleTable: null };
	}
	return rules === undefined ? multi : `${multi}@@@${rules}`;
}

export const EV_STAT_MAX = 252, EV_TOTAL_MAX = 510;
/** EVs given to the engine under Champions rules (0 stat points) */
export const NO_EVS = Object.freeze(Object.fromEntries(STATS.map(s => [s, 0])));

const cache = new WeakMap(); // Dex -> Map(formatid -> rules)
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

	const self = { dex, ruleTable, trunc: f.battle?.trunc ?? dex.trunc, gen: dex.gen };
	const statModify = scripts.statModify || sim.Battle.prototype.statModify;
	const calculatePP = scripts.calculatePP || sim.Battle.prototype.calculatePP;
	const rules = {
		formatid: typeof format === 'string' ? format : format.id, champions, effort: !champions, dex,

		stat: (baseStats, set, statName) => statModify.call(self, baseStats, rules.engineSet(set), statName),

		engineSet: set => {
			const own = champions ? { ...set, evs: NO_EVS } : set;
			if (!hasOneSpecial(self.gen)) return own;
			const ivs = own.ivs ? dvIvs(own.ivs) : {};
			const special = own.evs ? Math.max(own.evs.spa ?? 0, own.evs.spd ?? 0) : 0;
			return { ...own, nature: '', ivs, ...(own.evs ? { evs: { ...own.evs, spa: special, spd: special } } : {}) };
		},
		/** Max PP of a move slot (PP Up count ups - ignored under Champions) */
		maxPp(moveId, ups = 0) {
			const move = dex.moves.get(moveId);
			if (!move?.exists) return 0;
			return calculatePP.call(self, move, ppUpCount(move, ups));
		},

		maxHp(set) {
			const species = dex.species.get(set.species);
			if (species.maxHP) return species.maxHP;

			const full = { ...set, ivs: { ...set.ivs, hp: set.ivs?.hp ?? MAX_IV }, evs: { hp: set.evs?.hp ?? 0 } };
			return rules.stat(species.baseStats, full, 'hp');
		},
	};
	if (key !== null) byId.set(key, rules);
	return rules;
}

export function dvIvs(ivs) {
	const even = value => value - (value % 2);
	const out = Object.fromEntries(Object.entries(ivs).map(([s, v]) => [s, even(v)]));
	if (ivs.spa !== undefined || ivs.spd !== undefined) out.spa = out.spd = even(Math.max(ivs.spa ?? MAX_IV, ivs.spd ?? MAX_IV));
	const bit = s => (even(out[s] ?? MAX_IV) / 2) & 1;
	out.hp = 2 * ((bit('atk') << 3) | (bit('def') << 2) | (bit('spe') << 1) | bit('spa'));
	return out;
}

export function applyFormatRules(sim, battle) {
	const rules = formatRules(sim, battle.format);
	if ((rules.effort && !hasOneSpecial(rules.dex.gen)) || wrapped.has(battle)) return rules;
	const statModify = battle.statModify;
	battle.statModify = function (baseStats, set, statName) {
		return statModify.call(this, baseStats, rules.engineSet(set), statName);
	};
	wrapped.add(battle);
	return rules;
}
