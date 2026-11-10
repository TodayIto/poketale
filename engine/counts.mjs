// Battle counters used by evolution conditions.
import { countOf, cloakAfterBattle, BATTLE_COUNTS } from './evolution.mjs';
import { own } from './friendship.mjs';

const PRIORITY = Object.freeze({ faint: -1e9 - 5, move: -1e9 - 6 });

export function installCounts(sim, battle, spec) {
	const members = new Map(spec.p1.team.map(m => [m.uid, m]));
	const counted = new Map();
	for (const pokemon of battle.sides[0].pokemon) {
		if (pokemon.m.partner) continue;
		const want = countOf(battle.dex, pokemon.m.start.species);
		if (!want) continue;
		counted.set(pokemon, want);
		const given = members.get(pokemon.m.uid)?.counts?.[want.kind];
		pokemon.m.counts = { [want.kind]: BATTLE_COUNTS.has(want.kind) || !Number.isInteger(given) ? 0 : Math.max(0, given) };
	}
	const add = (pokemon, kind, n) => { if (counted.get(pokemon)?.kind === kind) pokemon.m.counts[kind] += n; };

	const uncounted = (target, effect, source) => effect?.effectType === 'Weather' || (effect?.id === 'curse' && source === target);
	const hurt = (target, damage, effect, source) => {
		if (!own(battle, target) || !(typeof damage === 'number' && damage > 0)) return;
		if (!uncounted(target, effect, source)) add(target, 'damage', damage);
		if (effect?.id === 'recoil') add(target, 'recoil', damage);
	};
	if (counted.size) {
		const { spreadDamage, directDamage } = battle;
		battle.spreadDamage = function (damage, targets, source, effect, ...rest) {
			const dealt = spreadDamage.call(this, damage, targets, source, effect, ...rest);
			const how = typeof effect === 'string' || !effect ? this.dex.conditions.getByID(effect || '') : effect;
			(targets ?? []).forEach((target, i) => hurt(target, dealt[i], how, source));
			return dealt;
		};
		battle.directDamage = function (damage, target, source, effect, ...rest) {
			const who = target || this.event?.target, before = who?.hp ?? 0;
			const from = source || this.event?.source, how = effect || (this.event ? this.effect : null);
			const dealt = directDamage.call(this, damage, target, source, effect, ...rest);
			if (who) hurt(who, before - who.hp, how, from);
			return dealt;
		};
		const actions = battle.actions;
		const { modifyDamage } = actions;
		actions.modifyDamage = function (baseDamage, pokemon, target, move, suppressMessages = false) {
			const damage = modifyDamage.call(this, baseDamage, pokemon, target, move, suppressMessages);
			if (!suppressMessages && target.getMoveHitData(move).crit) add(pokemon, 'crits', 1);
			return damage;
		};
		battle.onEvent('AfterMove', battle.format, PRIORITY.move, function (source, target, move) {
			if (own(battle, source) && counted.get(source)?.of === move?.id) add(source, 'uses', 1);
		});
		battle.onEvent('Faint', battle.format, PRIORITY.faint, function (target, source) {
			if (own(battle, target)) {
				for (const kind of ['damage', 'recoil']) if (counted.get(target)?.kind === kind) target.m.counts[kind] = 0;
				return;
			}
			if (own(battle, source) && counted.get(source)?.of === battle.dex.species.get(target.m.start?.species ?? target.species.name).id) add(source, 'kos', 1);
		});
	}

	const cloaks = battle.sides[0].pokemon.filter(p => !p.m.partner && cloakAfterBattle(battle.dex, p.m.start.species, spec.biome));
	if (cloaks.length) {
		const sentOut = pokemon => { if (cloaks.includes(pokemon)) pokemon.m.cloak = cloakAfterBattle(battle.dex, pokemon.m.start.species, spec.biome); };
		for (const pokemon of battle.sides[0].active) if (pokemon) sentOut(pokemon);
		const actions = battle.actions;
		const switchIn = actions.switchIn;
		actions.switchIn = function (pokemon, ...rest) {
			const result = switchIn.call(this, pokemon, ...rest);
			sentOut(pokemon);
			return result;
		};
	}
}

export function countsResult(pokemon) {
	const counts = Object.fromEntries(Object.entries(pokemon.m.counts ?? {}).filter(([kind]) => !BATTLE_COUNTS.has(kind)));
	return Object.keys(counts).length ? counts : undefined;
}
