// Friendship changes and battle benefits.
export const FRIENDSHIP_MAX = 255;

const DEFAULT_FRIENDSHIP = 50;

export const FRIEND_BALL_FRIENDSHIP = 150;

export const FRIENDSHIP_STEPS = Object.freeze({
	mention: [3, 2, 1], level: [5, 3, 2], boss: [1, 1, 1], faint: [-1, -1, -1], faintHigh: [-5, -5, -10], vitamin: [5, 3, 2], berry: [10, 5, 2],
	energypowder: [-5, -5, -10], healpowder: [-5, -5, -10], energyroot: [-10, -10, -15], revivalherb: [-15, -15, -20],
});

const FAINT_LEVEL_GAP = 30;

export const friendshipStep = (value, kind) => FRIENDSHIP_STEPS[kind][value < 100 ? 0 : value < 200 ? 1 : 2];

export const baseFriendship = (table, species) => table?.friendship?.[species.num] ?? DEFAULT_FRIENDSHIP;

const clamp = value => Math.max(0, Math.min(FRIENDSHIP_MAX, value));

const thousandths = value => Math.round(value * 1000) / 1000;

export function changeFriendship(value, amount, { item = '', ball = '', rate = 1, carry = 0 } = {}) {
	if (amount <= 0) return { value: clamp(value + amount), carry };
	let gain = amount + (ball === 'luxuryball' ? 1 : 0);
	if (item === 'soothebell') gain = Math.floor(gain * 1.5);
	const total = thousandths(gain * rate + carry);
	const next = clamp(value + Math.floor(total));
	return { value: next, carry: next === FRIENDSHIP_MAX ? 0 : thousandths(total - Math.floor(total)) };
}

export function moveFriendship(value, carry, change) {
	const total = thousandths(clamp(value + carry + change));
	const whole = Math.floor(total);
	return { value: whole, carry: whole === FRIENDSHIP_MAX ? 0 : thousandths(total - whole) };
}

export const FOND_FRIENDSHIP = 220;

const ENDURE = [[255, 20], [220, 15], [180, 10]];
const CURE_PERCENT = 20, EVADE_POINTS = 10;
const CRIT_ODDS = [0, 24, 8, 2, 1];
export const enduresPercent = value => ENDURE.find(([from]) => value >= from)?.[1] ?? 0;

export const friendlyExp = value => value >= FOND_FRIENDSHIP;

const states = new WeakMap();

const PRIORITY = Object.freeze({ faint: -1e9 - 1, damage: -1e9 - 2, accuracy: -1e9 - 3, crit: -1e9 - 4 });

export const own = (battle, pokemon) => pokemon?.side === battle.sides[0] && !pokemon.m.partner;
const friendshipOf = (battle, pokemon) => (own(battle, pokemon) ? pokemon.m.friendship : undefined);

export const friendshipLocked = holder => holder?.friendshipLocked === true;

export function stepInBattle(battle, pokemon, kind) {
	const state = states.get(battle);
	if (!state || pokemon.m.friendship === undefined || friendshipLocked(pokemon.m)) return;
	const { value, carry } = changeFriendship(pokemon.m.friendship, friendshipStep(pokemon.m.friendship, kind),
		{ item: pokemon.item, ball: pokemon.set.pokeball, rate: state.rate, carry: pokemon.m.friendshipCarry });
	pokemon.m.friendship = value;
	pokemon.m.friendshipCarry = carry;
}

export const isCarry = value => Number.isFinite(value) && value >= 0 && value < 1;

export function installFriendship(sim, battle, spec, { exp: table } = {}) {
	const members = new Map(spec.p1.team.map(m => [m.uid, m]));
	const state = { rate: spec.friendshipRate ?? 1, out: new Set() };
	states.set(battle, state);
	for (const pokemon of battle.sides[0].pokemon) {
		if (pokemon.m.partner) continue;
		const member = members.get(pokemon.m.uid);
		pokemon.m.friendship = Number.isInteger(member?.friendship) ? clamp(member.friendship) : baseFriendship(table, battle.dex.species.get(pokemon.m.start.species));
		pokemon.m.friendshipCarry = isCarry(member?.friendshipCarry) ? member.friendshipCarry : 0;
		if (friendshipLocked(member)) pokemon.m.friendshipLocked = true;
	}

	if (spec.boss) {
		const sentOut = pokemon => {
			if (!own(battle, pokemon) || state.out.has(pokemon)) return;
			state.out.add(pokemon);
			stepInBattle(battle, pokemon, 'boss');
		};
		for (const pokemon of battle.sides[0].active) if (pokemon) sentOut(pokemon);
		const actions = battle.actions;
		const switchIn = actions.switchIn;
		actions.switchIn = function (pokemon, ...rest) {
			const result = switchIn.call(this, pokemon, ...rest);
			sentOut(pokemon);
			return result;
		};
	}

	battle.onEvent('Faint', battle.format, PRIORITY.faint, function (target) {
		if (!own(battle, target)) return;
		const foeLevel = Math.max(0, ...target.foes(true).map(foe => foe.level));
		stepInBattle(battle, target, foeLevel - target.level >= FAINT_LEVEL_GAP ? 'faintHigh' : 'faint');
	});

	battle.onEvent('Damage', battle.format, PRIORITY.damage, function (damage, target, source, effect) {
		const value = friendshipOf(battle, target);
		if (value === undefined || typeof damage !== 'number' || effect?.effectType !== 'Move' || damage < target.hp || target.hp <= 1) return;
		const percent = enduresPercent(value);
		if (!percent || !battle.randomChance(percent, 100)) return;
		battle.add('-story-friendship', target, 'endure');
		return target.hp - 1;
	});

	const endTurn = battle.endTurn;
	battle.endTurn = function (...args) {
		if (battle.turn > 0) {
			for (const pokemon of battle.sides[0].active) {
				const value = friendshipOf(battle, pokemon);
				if (value === undefined || value < FOND_FRIENDSHIP || !pokemon.status || pokemon.fainted || !battle.randomChance(CURE_PERCENT, 100)) continue;
				battle.add('-story-friendship', pokemon, 'cure', pokemon.status);
				pokemon.cureStatus(true);
			}
		}
		return endTurn.apply(this, args);
	};

	battle.onEvent('Accuracy', battle.format, PRIORITY.accuracy, function (accuracy, target, source) {
		const value = friendshipOf(battle, target);
		if (value !== FRIENDSHIP_MAX || typeof accuracy !== 'number' || !source || source.side === target.side) return;
		const roll = battle.random(100);
		if (roll < accuracy - EVADE_POINTS) return true;
		if (roll < accuracy) battle.add('-story-friendship', target, 'evade');
		return 0;
	});

	battle.onEvent('ModifyCritRatio', battle.format, PRIORITY.crit, function (critRatio, source, target, move) {
		const value = friendshipOf(battle, source);
		if (value !== FRIENDSHIP_MAX || move.willCrit !== undefined || !(critRatio >= 1 && critRatio < 4)) return;
		const n = CRIT_ODDS[Math.trunc(critRatio)];
		if (battle.randomChance(1, n)) return 4;
		if (!battle.randomChance(1, n - 1)) return 0;
		battle.add('-story-friendship', source, 'crit');
		return 4;
	});
	return state;
}
