import { newMovePp } from './pp.mjs';
import { friendlyExp, stepInBattle } from './friendship.mjs';
import { setLevel, newMoveSlot } from './showdown-compat.mjs';
import { formatRules, EV_STAT_MAX, EV_TOTAL_MAX } from './rules.mjs';
import { MAX_LEVEL, STATS, NON_HP_STATS, toID } from './mon.mjs';
import { genderAllows, everstoneStops, levelEvolution, battleEvolution, ABSENT_TRADE_EVOLUTION } from './evolution.mjs';
import { winnerSide } from './winner.mjs';

const states = new WeakMap();

export function expForLevel(growth, level) {
	const n = Math.trunc(level);
	if (n < 1 || n > MAX_LEVEL) throw new Error(`레벨 ${level}: 1~100 만`);
	if (n === 1) return 0;
	const n3 = n ** 3;
	switch (growth) {
	case 'erratic':
		if (n < 50) return Math.floor(n3 * (100 - n) / 50);
		if (n < 68) return Math.floor(n3 * (150 - n) / 100);
		if (n < 98) return Math.floor(n3 * Math.floor((1911 - 10 * n) / 3) / 500);
		return Math.floor(n3 * (160 - n) / 100);
	case 'fast': return Math.floor(4 * n3 / 5);
	case 'mediumfast': return n3;
	case 'mediumslow': return Math.floor(6 * n3 / 5 - 15 * n * n + 100 * n - 140);
	case 'slow': return Math.floor(5 * n3 / 4);
	case 'fluctuating':
		if (n < 15) return Math.floor(n3 * (Math.floor((n + 1) / 3) + 24) / 50);
		if (n < 36) return Math.floor(n3 * (n + 14) / 50);
		return Math.floor(n3 * (Math.floor(n / 2) + 32) / 50);
	}
	throw new Error(`모르는 경험치 그룹 "${growth}"`);
}

export function levelForExp(growth, exp) {
	let level = 1;
	while (level < MAX_LEVEL && expForLevel(growth, level + 1) <= exp) level++;
	return level;
}

export const EXP_RATES = Object.freeze([0.33, 0.66, 1, 1.5, 2, 3]);

export const RATES = Object.freeze([0.5, 1, 1.5, 2, 3]);
export const DEFAULT_EXP_RATE = 1;

const EXP_RATE_THIRDS = new Map([[0.33, 1 / 3], [0.66, 2 / 3]]);

export const EXP_RATE_DIGITS = Object.freeze({ ints: 2, decimals: 1 });
const RATE_SCALE = 10 ** EXP_RATE_DIGITS.decimals;
export const EXP_RATE_MIN = 1 / RATE_SCALE;
export const EXP_RATE_MAX = (10 ** (EXP_RATE_DIGITS.ints + EXP_RATE_DIGITS.decimals) - 1) / RATE_SCALE;

export const isExpRate = value => typeof value === 'number' && value >= EXP_RATE_MIN && value <= EXP_RATE_MAX && Math.round(value * RATE_SCALE) / RATE_SCALE === value;

export const isExpRateSetting = value => isExpRate(value) || EXP_RATE_THIRDS.has(value);

export const expRateValue = rate => EXP_RATE_THIRDS.get(rate) ?? rate;

export const STORY_EXP_PACE = 1.5;

export const storyExpRate = rate => Math.round(expRateValue(rate) * STORY_EXP_PACE * RATE_SCALE * 10) / (RATE_SCALE * 10);

const mod4096 = (value, numerator) => Math.floor((value * numerator + 2047) / 4096);

export function calcExpGain({ baseExp, level, victorLevel, shared = false, luckyEgg = false, canEvolve = false, friendly = false, multipliers = [], rate = DEFAULT_EXP_RATE }) {
	const s = shared ? 2 : 1;
	const base = Math.floor(baseExp * level / (5 * s));
	let exp = Math.floor(base * ((2 * level + 10) / (level + victorLevel + 10)) ** 2.5) + 1;
	for (const m of [...multipliers, luckyEgg ? 6144 : 4096, canEvolve ? 4915 : 4096, friendly ? 4915 : 4096, Math.round(rate * 4096)]) exp = mod4096(exp, m);
	return exp;
}

export function attachExperience(sim, battle, spec, { exp: table, levelUp }) {
	if (!table?.species) throw new Error('경험치 표(options.exp)가 없습니다');
	if (!levelUp) throw new Error('경험치를 쓰려면 레벨업 기술 표(options.levelUp)도 필요합니다');

	const effort = formatRules(sim, battle.format).effort && Array.isArray(table.effort);
	const state = { sim, table, levelUp, effort, share: spec.expShare !== false, rate: spec.expRate ?? DEFAULT_EXP_RATE, faced: new Map(), awarded: new Set(), learnQueue: [],
		world: { timeOfDay: spec.timeOfDay ?? 'day', weather: spec.weather ?? null, region: spec.region ?? null, money: spec.money ?? null, badges: spec.badges ?? 0,
			trade: spec.tradeEvolution ?? ABSENT_TRADE_EVOLUTION, partner: !!spec.partner } };
	states.set(battle, state);
	const [p1] = battle.sides;
	const members = new Map(spec.p1.team.map(m => [m.uid, m]));
	for (const pokemon of p1.pokemon) {
		if (pokemon.m.partner) continue;
		const growth = growthOf(state.table, speciesOf(battle, pokemon));
		pokemon.m.startLevel = pokemon.level;
		if (!growth) continue;

		const level = Math.min(pokemon.level, MAX_LEVEL);
		const low = expForLevel(growth, level);
		const high = level < MAX_LEVEL ? expForLevel(growth, level + 1) - 1 : low;
		const given = members.get(pokemon.m.uid)?.exp;
		pokemon.m.exp = Math.max(low, Math.min(high, Math.trunc(Number.isFinite(given) ? given : low)));
	}

	recordFacing(battle, state);
	const actions = battle.actions;
	const switchIn = actions.switchIn;
	actions.switchIn = function (...args) {
		const result = switchIn.apply(this, args);
		recordFacing(battle, state);
		return result;
	};

	battle.onEvent('Faint', battle.format, -1e9, function (target) {
		if (target.side.n % 2) awardExperience(battle, state, target);
	});
	return state;
}

export function awardCaptureExperience(battle, foe) {
	const state = states.get(battle);
	if (state) awardExperience(battle, state, foe);
}

function speciesOf(battle, pokemon) {

	return battle.dex.species.get(pokemon.m.start.species);
}

export function growthOf(table, species) {
	const row = table?.species?.[species.num];
	return row ? table.growthRates[row[1]] : null;
}

function recordFacing(battle, state) {
	const p1 = battle.sides[0];
	for (const foe of battle.sides.filter(side => side.n % 2).flatMap(side => side.active)) {
		if (!foe || foe.hp <= 0) continue;
		let set = state.faced.get(foe);
		if (!set) state.faced.set(foe, set = new Set());
		for (const mon of p1.active) if (mon && mon.hp > 0) set.add(mon);
	}
}

function awardExperience(battle, state, foe) {
	if (state.awarded.has(foe)) return;
	state.awarded.add(foe);
	recordFacing(battle, state);
	const row = state.table.species[speciesOf(battle, foe).num];
	if (!row) return;
	const faced = state.faced.get(foe) || new Set();
	// EVs first, then experience (gainEffort below - on level-up the new stats include this battle's EVs)
	if (state.effort) {
		const yieldOf = effortYield(state.table, speciesOf(battle, foe));
		for (const p of battle.sides[0].pokemon) if (p.hp > 0 && !p.fainted && p.m.exp !== undefined && (state.share || faced.has(p))) gainEffort(p, yieldOf);
	}

	const recipients = battle.sides[0].pokemon
		.filter(p => p.hp > 0 && !p.fainted && p.m.exp !== undefined && p.level < MAX_LEVEL)
		.map(p => ({ pokemon: p, participant: faced.has(p) }))
		.filter(r => state.share || r.participant)
		.sort((a, b) => b.participant - a.participant);
	for (const r of recipients) {
		r.gain = calcExpGain({
			baseExp: row[0], level: foe.level, victorLevel: r.pokemon.level, shared: !r.participant,
			luckyEgg: r.pokemon.item === 'luckyegg', canEvolve: pastEvolutionLevel(battle, r.pokemon), friendly: friendlyExp(r.pokemon.m.friendship ?? 0), rate: state.rate,
		});
	}
	for (const { pokemon, gain, participant } of recipients) gainExperience(battle, state, pokemon, gain, participant);
}

function gainExperience(battle, state, pokemon, gain, participant) {
	const growth = growthOf(state.table, speciesOf(battle, pokemon));
	const before = pokemon.m.exp;
	pokemon.m.exp = Math.min(before + gain, expForLevel(growth, MAX_LEVEL));
	battle.add('-story-exp', pokemon, pokemon.m.uid, pokemon.m.exp - before, pokemon.m.exp, ...(participant ? [] : ['[shared]']));

	while (pokemon.level < MAX_LEVEL && pokemon.m.exp >= expForLevel(growth, pokemon.level + 1)) {
		setLevel(battle, pokemon, pokemon.level + 1);
		stepInBattle(battle, pokemon, 'level');
		const { maxhp, hp } = pokemon;
		battle.add('-story-levelup', pokemon, pokemon.m.uid, pokemon.level, JSON.stringify({ hp, maxhp, ...withoutHp(pokemon.baseStoredStats) }));
		learnLevelMoves(battle, state, pokemon);
	}
}

const withoutHp = stats => Object.fromEntries(NON_HP_STATS.map(s => [s, stats[s]]));

const POWER_ITEMS = { powerweight: 'hp', powerbracer: 'atk', powerbelt: 'def', powerlens: 'spa', powerband: 'spd', poweranklet: 'spe' };
const POWER_ITEM_BONUS = 8;

const EFFORT_ORDER = ['hp', 'atk', 'def', 'spe', 'spa', 'spd'];

export function effortYield(table, species) {
	const digits = table?.effortForms?.[species.id] ?? table?.effort?.[species.num];
	if (typeof digits !== 'string') return null;
	const order = table.effortStats ?? STATS;
	return Object.fromEntries(order.map((s, i) => [s, Number(digits[i]) || 0]));
}

function gainEffort(pokemon, base) {
	if (!base) return {};
	const item = pokemon.item;
	const gain = Object.fromEntries(STATS.map(s => [s, base[s] * (item === 'machobrace' ? 2 : 1)]));
	if (POWER_ITEMS[item]) gain[POWER_ITEMS[item]] += POWER_ITEM_BONUS;
	const evs = pokemon.set.evs;
	let total = STATS.reduce((sum, s) => sum + (evs[s] || 0), 0);
	const added = {};
	for (const s of EFFORT_ORDER) {
		const n = Math.max(0, Math.min(gain[s], EV_STAT_MAX - (evs[s] || 0), EV_TOTAL_MAX - total));
		if (!n) continue;
		evs[s] = (evs[s] || 0) + n;
		total += n;
		added[s] = n;
	}
	return added;
}

function learnLevelMoves(battle, state, pokemon) {
	const learnset = state.levelUp[speciesOf(battle, pokemon).id] || [];
	for (const [level, moveid] of learnset) {
		if (level !== pokemon.level) continue;
		const move = battle.dex.moves.get(moveid);
		if (!move.exists) continue;
		if (pokemon.baseMoveSlots.some(s => s.id === move.id)) continue;
		if (state.learnQueue.some(q => q.pokemon === pokemon && q.move === move.id)) continue;
		if (pokemon.baseMoveSlots.length < 4) {
			addMoveSlot(battle, pokemon, move, pokemon.baseMoveSlots.length);
			battle.add('-story-learnmove', pokemon, pokemon.m.uid, move.name);
		} else {

			state.learnQueue.push({ pokemon, move: move.id, level });
			battle.add('-story-movequeue', pokemon, pokemon.m.uid, move.name);
		}
	}
}

function addMoveSlot(battle, pokemon, move, index) {
	const slot = newMoveSlot(move, newMovePp(battle, move));
	const old = pokemon.baseMoveSlots[index];
	pokemon.baseMoveSlots[index] = slot;
	pokemon.ppUps[index] = 0;
	pokemon.set.moves = pokemon.baseMoveSlots.map(s => s.id);

	if (!pokemon.transformed) {
		const current = pokemon.moveSlots[index];
		if (!current || (!current.virtual && current === old)) pokemon.moveSlots[index] = slot;
	}
	return old;
}

export function replaceMove(battle, uid, slotIndex, moveId) {
	const state = states.get(battle);
	if (!state) throw new Error('경험치가 걸리지 않은 배틀입니다');
	const id = toID(moveId);
	const at = state.learnQueue.findIndex(q => q.pokemon.m.uid === uid && q.move === id);
	if (at < 0) throw new Error(`${uid}: 배울 기술 대기열에 "${moveId}" 이 없습니다`);
	const side = battle.sides[0];
	if (side.choice?.actions?.length) throw new Error('p1 이 이번 턴 선택 중에는 기술을 바꿀 수 없습니다');
	const { pokemon } = state.learnQueue[at];
	const move = battle.dex.moves.get(id);
	if (slotIndex === null) {
		state.learnQueue.splice(at, 1);
		battle.add('-story-skipmove', pokemon, uid, move.name);
		return;
	}

	if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > Math.min(3, pokemon.baseMoveSlots.length)) {
		throw new Error(`${uid}: 기술 칸 ${slotIndex} 이 없습니다`);
	}
	if (pokemon.baseMoveSlots.some(s => s.id === move.id)) throw new Error(`${uid}: 이미 "${move.name}" 을 알고 있습니다`);
	state.learnQueue.splice(at, 1);
	const old = addMoveSlot(battle, pokemon, move, slotIndex);
	battle.add('-story-replacemove', pokemon, uid, old ? old.move : '', move.name);
	refreshRequest(battle, side, pokemon);
}

function refreshRequest(battle, side, pokemon) {
	const request = side.activeRequest;
	if (!request || request.wait || battle.ended) return;
	if (request.active && pokemon.isActive) request.active = side.active.map(p => p?.getMoveRequestData());
	request.side = side.getRequestData();
	side.emitRequest(request);
}

export function getLearnQueue(battle) {
	return (states.get(battle)?.learnQueue || []).map(q => ({ uid: q.pokemon.m.uid, move: q.move, level: q.level }));
}

function pastEvolutionLevel(battle, pokemon) {
	return speciesOf(battle, pokemon).evos.some(id => {
		const t = battle.dex.species.get(id);
		return !t.evoType && t.evoLevel && t.evoLevel <= pokemon.level && genderAllows(pokemon.gender, t);
	});
}

function conditionText(t) {
	return [t.evoType, t.evoItem, t.evoMove, t.evoCondition, t.evoRegion && `region ${t.evoRegion}`].filter(Boolean).join(' / ') || 'level';
}

function evolvingMon(battle, pokemon) {
	return { species: pokemon.m.cloak ?? speciesOf(battle, pokemon).name, gender: pokemon.gender, item: toID(pokemon.set.item), uid: pokemon.m.uid,
		moves: pokemon.baseMoveSlots.map(s => s.id), nature: pokemon.m.natureOrig ?? pokemon.set.nature, ability: pokemon.m.start.ability,
		stats: { atk: pokemon.storedStats.atk, def: pokemon.storedStats.def }, counts: pokemon.m.counts };
}

export function getEvolutions(battle) {
	const list = [];
	const { world } = states.get(battle);
	const won = winnerSide(battle) === 'p1';
	const own = battle.sides[0].pokemon.filter(p => !p.m.partner);
	for (const pokemon of own) {
		if (pokemon.fainted || pokemon.hp <= 0) continue;
		const species = speciesOf(battle, pokemon);
		const mon = evolvingMon(battle, pokemon);
		const now = { ...world, level: pokemon.level, friendship: pokemon.m.friendship, party: own.filter(p => p !== pokemon).map(p => speciesOf(battle, p).name) };
		const entry = (to, extra) => ({ uid: pokemon.m.uid, from: species.name, to, ...extra });
		const leveled = pokemon.level > pokemon.m.startLevel;
		const byLevel = leveled ? levelEvolution(battle.dex, mon, now) : null;
		const to = byLevel ?? battleEvolution(battle.dex, mon, { ...now, won });
		if (to) list.push(entry(to, byLevel ? { level: pokemon.level } : {}));
		else if (leveled && !everstoneStops(battle.dex, mon)) {
			for (const t of species.evos.map(id => battle.dex.species.get(id)).filter(t => genderAllows(pokemon.gender, t))) {
				if ((t.evoType || t.evoCondition || t.evoRegion || !t.evoLevel) && !(t.evoLevel > pokemon.level)) list.push(entry(t.name, { unsupported: conditionText(t) }));
			}
		}
	}
	return list;
}

export function experienceResult(battle) {
	if (!states.has(battle)) return {};
	return { evolutions: getEvolutions(battle), learnQueue: getLearnQueue(battle) };
}
