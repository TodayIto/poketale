const later = (battle, move) => !!move?.exists && move.gen > battle.gen;

const TIE_FREE = 0.5, EARLY = 1.5, LATE = -100.5, LAST = -1e6 - 0.5;

function guarded(battle, label, run) {
	try {
		return run();
	} catch (error) {
		battle.debug(`later move code failed (${label}): ${error?.message ?? error}`);
		return undefined;
	}
}

function wrap(owner, key, tag, make) {
	const original = owner[key];
	if (original.laterMoves?.includes(tag)) return;
	const wrapped = make(original);
	wrapped.laterMoves = [...(original.laterMoves ?? []), tag];
	owner[key] = wrapped;
}

export function runLaterMoves(battle) {
	const gen = battle.gen;
	if (!(gen < 9)) return;
	revivingRequests(battle);
	critOlder(battle);
	if (gen <= 5) {
		effectiveness(battle);
		olderModifyMove(battle);
		powderImmunity(battle);
		if (gen >= 2) accuracyOlder(battle);
	}
	if (gen <= 4) hitOdds(battle);
	if (gen <= 3) {
		categoryOlder(battle);
		modifyMove(battle);
		modifyTarget(battle);
		hitTargets(battle);
		hitCount(battle);
		stealBoosts(battle);
	}
	if (gen === 3) spreadGen3(battle);
	if (gen <= 4) afterSubDamage(battle);
	if (gen <= 2) {
		semiInvulnerable(battle);
		tailwindSpeed(battle);
		moveHitGaps(battle);
		selfDestructIfHit(battle);
		multiAccuracy(battle);
		bypassSubstitute(battle);
		screensByCategory(battle);
	}
	if (gen === 2) {
		runMoveGen2(battle);
		drainSubGen2(battle);
	}
	if (gen === 1) {
		basePower(battle);
		accuracyGen1(battle);
		ohkoGen1(battle);
		multiHitGen1(battle);
		trappingGen1(battle);
		asleepGen1(battle);
		statusCuts(battle);
		prepareHit(battle);
		afterMove(battle);
		runMoveGen1(battle);
		boostFlags(battle);
		areaMoves(battle);
	}
}

const TYPE_FROM = Object.freeze({ Dark: 2, Steel: 2, Fairy: 6 });
const damageCalc = new WeakMap();
function effectiveness(battle) {
	const gen = battle.gen;
	if (gen === 1) wrap(battle.actions, 'getDamage', 'defender', getDamage => function (source, target, move, ...rest) {
		const outer = damageCalc.get(battle), calc = { target, factor: 1 };
		damageCalc.set(battle, calc);
		try {
			const damage = getDamage.call(this, source, target, move, ...rest);
			return typeof damage === 'number' && damage > 0 && calc.factor !== 1 ? Math.max(1, Math.floor(damage * calc.factor)) : damage;
		} finally {
			if (outer) damageCalc.set(battle, outer);
			else damageCalc.delete(battle);
		}
	});
	battle.onEvent('Effectiveness', battle.format, TIE_FREE, function (typeMod, target, type, move) {
		if (typeof typeMod !== 'number' || !move?.type || typeof type !== 'string') return;
		let mod = typeMod;
		const from = TYPE_FROM[move.type];
		if (from && gen < from) mod += this.dex.forGen(from).getEffectiveness(move.type, type) - this.dex.getEffectiveness(move.type, type);
		const calc = gen === 1 && target === this ? damageCalc.get(this) : null;
		const defender = gen === 1 && target === this ? calc?.target ?? this.activeTarget : null;
		if (defender) {
			if (later(this, move) && move.onEffectiveness) {
				const out = guarded(this, `${move.id} effectiveness`, () => move.onEffectiveness.call(this, mod, defender, type, move));
				if (typeof out === 'number') mod = out;
			}
			for (const id of Object.keys(defender.volatiles)) {
				const effect = this.dex.conditions.get(id);
				if (!effect.onEffectiveness || !later(this, this.dex.moves.get(id))) continue;
				const out = guarded(this, `${id} effectiveness`, () => effect.onEffectiveness.call(this, mod, defender, type, move));
				if (typeof out === 'number') mod = out;
			}
			if (calc && Math.abs(mod) > 1) calc.factor *= 2 ** (mod - Math.sign(mod));
		}
		return mod === typeMod ? undefined : mod;
	});
}

function olderModifyMove(battle) {
	const gen = battle.gen;
	battle.onEvent('ModifyMove', battle.format, TIE_FREE, function (move, pokemon) {
		if (pokemon.volatiles['laserfocus'] && move.category !== 'Status') move.willCrit = true;
		if (gen <= 4 && later(this, move) && move.target === 'self' && move.category === 'Status' && move.accuracy !== true) move.accuracy = true;
	});
}

function modifyTarget(battle) {
	wrap(battle.actions, 'useMoveInner', 'modifyTarget', useMoveInner => function (moveOrMoveName, pokemon, options, ...rest) {
		const move = battle.dex.moves.get(moveOrMoveName);

		if (later(battle, move) && move.onModifyTarget) {
			const relay = { target: options?.target };
			guarded(battle, `${move.id} target`, () => battle.singleEvent('ModifyTarget', move, null, pokemon, options?.target, move, relay));
			if (relay.target && relay.target !== options?.target) options = { ...options, target: relay.target };
		}
		return useMoveInner.call(this, moveOrMoveName, pokemon, options, ...rest);
	});
}

function hitCount(battle) {
	battle.onEvent('Damage', battle.format, TIE_FREE, function (damage, target, source, effect) {
		if (effect?.effectType === 'Move' && effect.category !== 'Status' && target && source && target !== source && damage > 0) target.timesAttacked++;
	});
}

const landedHits = new WeakMap();
function multiHitGen1(battle) {
	wrap(battle.actions, 'moveHit', 'multihit', moveHit => function (target, pokemon, move, moveData, isSecondary, isSelf, ...rest) {
		const run = () => moveHit.call(this, target, pokemon, move, moveData, isSecondary, isSelf, ...rest);
		if (isSecondary || isSelf || !move?.multihit || !(move.hit > 0)) return run();
		let result;
		if (!later(battle, move)) result = run();
		else {
			const { damage, lastHit } = move;
			const data = battle.dex.moves.get(move.id);
			Object.assign(move, { damage: undefined, lastHit: true, ignoreOffensive: data.ignoreOffensive, ignoreDefensive: data.ignoreDefensive });
			const hitData = target && !Array.isArray(target) ? target.getMoveHitData(move) : null;
			if (hitData) hitData.crit = false;
			// Generation 1's Substitute takes the first hit's damage again on later hits
			if (move.hit > 1 && target?.volatiles?.['substitute']) {
				const fresh = guarded(battle, `${move.id} hit`, () => this.getDamage(pokemon, target, move));
				if (typeof fresh === 'number') battle.lastDamage = fresh;
			}
			try {
				result = run();
			} finally {
				move.damage = damage;
				move.lastHit = lastHit;
			}
			if (target?.subFainted) target.subFainted = null;
		}
		if (result !== false) landedHits.set(move, (landedHits.get(move) ?? 0) + 1);
		return result;
	});
}

function stealBoosts(battle) {
	const steal = (foe, pokemon, move) => {
		if (!move?.stealsBoosts || move.laterStole || !foe || foe === pokemon || !later(battle, move)) return;
		move.laterStole = true;
		guarded(battle, `${move.id} steal`, () => {
			const boosts = Object.fromEntries(Object.entries(foe.boosts).filter(([, stage]) => stage > 0));
			if (!Object.keys(boosts).length) return;
			battle.attrLastMove('[still]');
			battle.add('-clearpositiveboost', foe, pokemon, `move: ${move.name}`);
			battle.boost(boosts, pokemon, pokemon, move);
			foe.boostBy(Object.fromEntries(Object.entries(boosts).map(([stat, stage]) => [stat, -stage])));
			if (move.id === 'spectralthief') battle.addMove('-anim', pokemon, 'Spectral Thief', foe);
		});
	};
	if (battle.gen === 1) {
		battle.onEvent('TryHit', battle.format, LAST, function (target, source, move) {
			steal(target, source, move);
		});
		return;
	}
	wrap(battle.actions, 'moveHit', 'steal', moveHit => function (target, pokemon, move, moveData, isSecondary, isSelf, ...rest) {
		if (!isSecondary && !isSelf) steal(Array.isArray(target) ? target[0] : target, pokemon, move);
		return moveHit.call(this, target, pokemon, move, moveData, isSecondary, isSelf, ...rest);
	});
}

const SEMI_MOVES = new Set(['fly', 'dig']);
const semiOf = (battle, pokemon) => {
	if (!pokemon || Array.isArray(pokemon)) return null;
	const id = battle.gen === 1 ? (pokemon.volatiles['invulnerability'] ? pokemon.volatiles['twoturnmove']?.move : null) : [...SEMI_MOVES].find(semi => pokemon.volatiles[semi]);
	return SEMI_MOVES.has(id) ? id : null;
};
function semiInvulnerable(battle) {
	wrap(battle.actions, 'tryMoveHit', 'semi', tryMoveHit => function (target, pokemon, move, ...rest) {
		const semi = later(battle, move) ? semiOf(battle, target) : null;
		const own = semi ? battle.dex.forGen(move.gen).conditions.get(semi) : null;
		if (!own?.onInvulnerability || guarded(battle, `${move.id} through ${semi}`, () => own.onInvulnerability.call(battle, target, pokemon, move)) === false) {
			return tryMoveHit.call(this, target, pokemon, move, ...rest);
		}
		const kept = Object.getOwnPropertyDescriptor(battle, 'runEvent');
		const runEvent = battle.runEvent;
		battle.runEvent = function (id, on, ...args) {
			return id === 'Invulnerability' && on === target ? true : runEvent.call(this, id, on, ...args);
		};

		const lent = battle.gen === 1 && semi === 'fly' && move.volatileStatus === 'smackdown' && !target.volatiles['fly'] ? target.volatiles['invulnerability'] : null;
		if (lent) target.volatiles['fly'] = lent;
		let result;
		try {
			result = tryMoveHit.call(this, target, pokemon, move, ...rest);
		} finally {
			if (kept) Object.defineProperty(battle, 'runEvent', kept);
			else delete battle.runEvent;
			if (lent) {
				if (target.volatiles['fly'] === lent) delete target.volatiles['fly'];
				else target.removeVolatile('invulnerability');
			}
		}
		return result;
	});
}

const BOUND = 'laterpartiallytrapped';
function boundCondition(battle, gen) {
	const id = `${BOUND}${gen}`;
	const data = battle.dex.data.Conditions;
	if (Object.hasOwn(data, id)) return id;
	const own = battle.dex.forGen(gen).conditions.get('partiallytrapped');
	data[id] = {
		name: id,
		duration: own.duration,
		durationCallback: own.durationCallback,
		onStart: own.onStart,
		onEnd: own.onEnd,
		onTrapPokemon: own.onTrapPokemon,
		onResidualOrder: own.onResidualOrder,
		onResidualSubOrder: own.onResidualSubOrder,
		onResidual(pokemon) {
			const state = this.effectState;
			const source = state.source;
			if (source && (!source.isActive || source.hp <= 0 || !source.activeTurns)) {
				delete pokemon.volatiles[id];
				this.add('-end', pokemon, state.sourceEffect, '[partiallytrapped]', '[silent]');
				return;
			}
			const shown = !pokemon.volatiles['partiallytrapped'];
			if (shown) pokemon.volatiles['partiallytrapped'] = state;
			try {
				this.damage(pokemon.baseMaxhp / state.boundDivisor, pokemon, null, this.dex.conditions.get('partiallytrapped'));
			} finally {
				if (shown) delete pokemon.volatiles['partiallytrapped'];
			}
		},
	};
	return id;
}
const FREES_TRAPPED = new Set(['rapidspin', 'mortalspin']);
function trappingGen1(battle) {
	wrap(battle.actions, 'moveHit', 'trapping', moveHit => function (target, pokemon, move, moveData, isSecondary, isSelf, ...rest) {
		const data = moveData || move;
		if (data?.volatileStatus !== 'partiallytrapped' || !later(battle, move)) {
			const result = moveHit.call(this, target, pokemon, move, moveData, isSecondary, isSelf, ...rest);
			if (!isSecondary && !isSelf && FREES_TRAPPED.has(move?.id) && later(battle, move) && result !== false && pokemon.hp) {
				for (const id of Object.keys(pokemon.volatiles)) if (id.startsWith(BOUND)) pokemon.removeVolatile(id);
			}
			return result;
		}

		const held = target && !Array.isArray(target) ? Object.keys(target.volatiles).find(key => key.startsWith(BOUND)) : null;
		const id = held ?? guarded(battle, `${move.id} trap`, () => boundCondition(battle, move.gen));
		if (!id) return moveHit.call(this, target, pokemon, move, moveData, isSecondary, isSelf, ...rest);
		data.volatileStatus = id;
		try {
			return moveHit.call(this, target, pokemon, move, moveData, isSecondary, isSelf, ...rest);
		} finally {
			data.volatileStatus = 'partiallytrapped';
		}
	});
}

function drainSubGen2(battle) {
	wrap(battle.actions, 'moveHit', 'drainsub', moveHit => function (target, pokemon, move, moveData, isSecondary, isSelf, ...rest) {
		const sub = !isSecondary && !isSelf && target && target !== pokemon && !Array.isArray(target) ? target.volatiles['substitute'] : null;
		const drain = move?.drain;
		if (!sub || !drain || !(move.gen >= 4) || !later(battle, move)) return moveHit.call(this, target, pokemon, move, moveData, isSecondary, isSelf, ...rest);
		const hp = sub.hp;
		move.drain = undefined;
		let result;
		try {
			result = moveHit.call(this, target, pokemon, move, moveData, isSecondary, isSelf, ...rest);
		} finally {
			move.drain = drain;
		}
		const dealt = target.volatiles['substitute'] === sub ? hp - sub.hp : hp;
		if (dealt > 0 && pokemon.hp) battle.heal(Math.ceil(dealt * drain[0] / drain[1]), pokemon, target, 'drain');
		return result;
	});
}

const usableNow = (battle, pokemon, move) => later(battle, move) && (pokemon.status === 'slp' ? !!move.sleepUsable
	: pokemon.status === 'frz' && !!move.flags?.['defrost'] && !(move.id === 'burnup' && !pokemon.hasType('Fire')));
const canPick = (battle, pokemon) => (pokemon?.status === 'slp' || pokemon?.status === 'frz') && pokemon.moveSlots.some(slot => usableNow(battle, pokemon, battle.dex.moves.get(slot.id)));
function withoutStatus(pokemon, run) {
	const status = pokemon.status;
	pokemon.status = '';
	try {
		return run();
	} finally {
		pokemon.status = status;
	}
}

const SLEEP_LOCKS = ['lockedmove', 'rage', 'partialtrappinglock'];
function asleepGen1(battle) {
	const sides = () => {
		for (const side of battle.sides ?? []) {
			if (!side) continue;
			wrap(side, 'chooseMove', 'asleep', chooseMove => function (...args) {
				const pokemon = this.active[this.getChoiceIndex()];
				return canPick(battle, pokemon) ? withoutStatus(pokemon, () => chooseMove.apply(this, args)) : chooseMove.apply(this, args);
			});
		}
	};

	sides();
	wrap(battle, 'setPlayer', 'asleep', setPlayer => function (...args) {
		const result = setPlayer.apply(this, args);
		sides();
		return result;
	});
	wrap(battle, 'choose', 'asleep', choose => function (...args) {
		sides();
		return choose.apply(this, args);
	});

	wrap(battle, 'maybeTriggerEndlessBattleClause', 'asleep', clause => function (...args) {
		const thawing = this.sides.flatMap(side => side.pokemon).filter(p => p.status === 'frz' && !p.fainted
			&& p.moveSlots.some(slot => slot.pp > 0 && usableNow(this, p, this.dex.moves.get(slot.id))));
		for (const p of thawing) p.status = '';
		try {
			return clause.apply(this, args);
		} finally {
			for (const p of thawing) p.status = 'frz';
		}
	});
	wrap(battle, 'getRequests', 'asleep', getRequests => function (...args) {
		sides();
		const requests = getRequests.apply(this, args);
		this.sides.forEach((side, i) => side.active.forEach((pokemon, j) => {
			if (!requests[i]?.active?.[j] || !canPick(this, pokemon)) return;
			const data = guarded(this, 'asleep request', () => withoutStatus(pokemon, () => pokemon.getMoveRequestData()));
			if (data) requests[i].active[j] = data;
		}));
		return requests;
	});
	wrap(battle.actions, 'runMove', 'asleep', runMove => function (moveOrMoveName, pokemon, ...rest) {
		const run = () => runMove.call(this, moveOrMoveName, pokemon, ...rest);
		const asleep = pokemon?.status === 'slp', frozen = pokemon?.status === 'frz';
		const recharging = asleep && !!pokemon.volatiles['mustrecharge'];
		if (!recharging && !canPick(battle, pokemon)) return run();
		const from = battle.log.length;
		const kept = Object.getOwnPropertyDescriptor(battle, 'runEvent');
		const runEvent = battle.runEvent;
		const restore = () => {
			if (kept) Object.defineProperty(battle, 'runEvent', kept);
			else delete battle.runEvent;
		};
		let used = false;
		// Decided on the move that runs, after Encore's override
		battle.runEvent = function (id, on, target, move, ...args) {
			if (id !== 'BeforeMove' || on !== pokemon) return runEvent.call(this, id, on, target, move, ...args);
			restore();
			if (recharging) return withoutStatus(pokemon, () => runEvent.call(this, id, on, target, move, ...args));
			if (!usableNow(this, pokemon, move)) return runEvent.call(this, id, on, target, move, ...args);
			if (asleep) {
				// Waking up: generation 1's own sleep handler spends the turn
				if (pokemon.statusState.time <= 1) return runEvent.call(this, id, on, target, move, ...args);
				pokemon.statusState.time--;
				this.add('cant', pokemon, 'slp');
			}
			const result = withoutStatus(pokemon, () => runEvent.call(this, id, on, target, move, ...args));
			if (result) used = true;
			if (result && frozen && pokemon.status === 'frz') {
				this.add('-curestatus', pokemon, 'frz', `[from] move: ${move.name}`);
				pokemon.setStatus('');
			}
			return result;
		};
		let result;
		try {
			result = run();
		} finally {
			restore();
		}
		if (used && asleep) {
			guarded(battle, 'sleep locks', () => {

				for (const id of SLEEP_LOCKS) delete pokemon.volatiles[id];
				if (pokemon.volatiles['partiallytrapped']?.source === pokemon) delete pokemon.volatiles['partiallytrapped'];

				const notice = `|-mustrecharge|${pokemon}`;
				const lines = battle.log.slice(from).filter(line => line === notice);
				for (let n = lines.length; n > 1; n--) battle.log.splice(battle.log.lastIndexOf(notice), 1);
			});
		}
		return result;
	});
}

const AREA_TARGETS = new Set(['foeSide', 'allySide', 'allyTeam', 'all']);
function areaMoves(battle) {
	wrap(battle.actions, 'tryMoveHit', 'area', tryMoveHit => function (target, pokemon, move, ...rest) {
		if (!AREA_TARGETS.has(move.target) || !later(battle, move)) return tryMoveHit.call(this, target, pokemon, move, ...rest);
		const own = Object.getOwnPropertyDescriptor(battle, 'runEvent');
		const runEvent = battle.runEvent;
		battle.runEvent = function (id, ...args) {
			return id === 'Invulnerability' ? true : runEvent.call(this, id, ...args);
		};
		try {
			return tryMoveHit.call(this, target, pokemon, move, ...rest);
		} finally {
			if (own) Object.defineProperty(battle, 'runEvent', own);
			else delete battle.runEvent;
		}
	});
}

function revivingRequests(battle) {
	wrap(battle, 'getRequests', 'reviving', getRequests => function (type, ...rest) {
		const requests = getRequests.call(this, type, ...rest);
		for (const [i, side] of this.sides.entries()) {
			const entries = requests[i]?.side?.pokemon;
			if (!entries) continue;
			side.pokemon.forEach((pokemon, j) => {
				if (entries[j] && pokemon.isActive && side.slotConditions[pokemon.position]?.['revivalblessing']) entries[j].reviving = true;
			});
		}
		return requests;
	});
}

const SPECIAL_TYPES = new Set(['Fire', 'Water', 'Grass', 'Ice', 'Electric', 'Dark', 'Psychic', 'Dragon']);

function modifyMove(battle) {
	battle.onEvent('ModifyMove', battle.format, EARLY, function (move, pokemon, target) {
		const type = move.type;
		if (later(this, move) && move.onModifyType) guarded(this, `${move.id} type`, () => move.onModifyType.call(this, move, pokemon, target));
		if (move.id !== 'struggle' && (pokemon.volatiles['electrify'] || (move.type === 'Normal' && this.field.pseudoWeather['iondeluge']))) move.type = 'Electric';
		if (move.type !== type && move.category !== 'Status' && !ownCategory(this, move)) move.category = SPECIAL_TYPES.has(move.type) ? 'Special' : 'Physical';
	});
}

function hitTargets(battle) {
	wrap(battle.actions, 'tryMoveHit', 'hitTargets', tryMoveHit => function (target, pokemon, move, ...rest) {
		const result = tryMoveHit.call(this, target, pokemon, move, ...rest);
		if (target && (result || result === 0) && later(battle, move)) {
			move.hitTargets ??= [];
			if (!move.hitTargets.includes(target)) move.hitTargets.push(target);
		}
		return result;
	});
}

function basePower(battle) {
	battle.onEvent('BasePower', battle.format, EARLY, function (power, attacker, defender, move) {
		let out;
		if (later(this, move) && move.onBasePower) out = guarded(this, `${move.id} power`, () => move.onBasePower.call(this, power, attacker, defender, move));
		if (defender?.side.sideConditions['auroraveil'] && !defender.getMoveHitData(move).crit
			&& !defender.volatiles[move.category === 'Physical' ? 'reflect' : 'lightscreen']) this.chainModify(0.5);
		for (const id of Object.keys(defender?.volatiles ?? {})) {
			if (!(later(this, move) || later(this, this.dex.moves.get(id)))) continue;
			const effect = conditionFor(this, id, move, 'onSourceModifyDamage');
			if (effect) guarded(this, `${id} damage`, () => effect.onSourceModifyDamage.call(this, power, attacker, defender, move));
		}

		const semi = later(this, move) ? semiOf(this, defender) : null;
		const own = semi ? this.dex.forGen(move.gen).conditions.get(semi) : null;
		const doubles = own?.onSourceBasePower ?? own?.onSourceModifyDamage;
		if (doubles) guarded(this, `${semi} damage`, () => doubles.call(this, power, attacker, defender, move));
		return out;
	});
}

function conditionFor(battle, id, move, handler) {
	const effect = battle.dex.conditions.get(id);
	if (effect[handler]) return effect;
	if (!later(battle, move)) return null;
	const own = battle.dex.forGen(move.gen).conditions.get(id);
	return own[handler] ? own : null;
}

function sureHit(battle, accuracy, target, move) {
	if (!later(battle, move)) return false;
	for (const id of Object.keys(target?.volatiles ?? {})) {
		if (battle.dex.conditions.get(id).onAccuracy) continue;
		const effect = conditionFor(battle, id, move, 'onAccuracy');
		if (effect && guarded(battle, `${id} accuracy`, () => effect.onAccuracy.call(battle, accuracy, target, null, move)) === true) return true;
	}
	return false;
}

const OHKO_ACCURACY = 30;
const ohkoAccuracy = (source, target) => (OHKO_ACCURACY + source.level - target.level) * 256 / 100;

function accuracyGen1(battle) {
	battle.onEvent('Accuracy', battle.format, TIE_FREE, function (accuracy, target, source, move) {
		if (typeof accuracy !== 'number') return;
		if (move?.laterOhko) return ohkoAccuracy(source, target);
		if (sureHit(this, accuracy, target, move)) return true;
		for (const id of Object.keys(this.field.pseudoWeather)) {
			const effect = this.dex.conditions.get(id);
			if (effect.onModifyAccuracy && later(this, this.dex.moves.get(id))) guarded(this, `${id} accuracy`, () => effect.onModifyAccuracy.call(this, accuracy, target, source, move));
		}
	});
}

function accuracyOlder(battle) {
	battle.onEvent('Accuracy', battle.format, TIE_FREE, function (accuracy, target, source, move) {
		if (typeof accuracy === 'number' && sureHit(this, accuracy, target, move)) return true;
	});
	if (battle.gen !== 2) return;

	wrap(battle.actions, 'tryMoveHit', 'ohko', tryMoveHit => function (target, pokemon, move, ...rest) {
		if (!move?.ohko || !target || Array.isArray(target) || !later(battle, move)) return tryMoveHit.call(this, target, pokemon, move, ...rest);
		const kept = Object.getOwnPropertyDescriptor(battle, 'runEvent');
		const runEvent = battle.runEvent;
		battle.runEvent = function (id, on, ...args) {
			return id === 'ModifyAccuracy' && on === target && typeof args[2] === 'number' ? ohkoAccuracy(pokemon, target) : runEvent.call(this, id, on, ...args);
		};
		try {
			return tryMoveHit.call(this, target, pokemon, move, ...rest);
		} finally {
			if (kept) Object.defineProperty(battle, 'runEvent', kept);
			else delete battle.runEvent;
		}
	});
}

const OHKO_DAMAGE = 65535;
function ohkoGen1(battle) {
	wrap(battle.actions, 'tryMoveHit', 'ohko', tryMoveHit => function (target, pokemon, move, ...rest) {
		if (!move?.ohko || !target || target === pokemon || !later(battle, move)) return tryMoveHit.call(this, target, pokemon, move, ...rest);
		if (pokemon.level < target.level && !target.volatiles['invulnerability']) {
			battle.add('-immune', target, '[ohko]');
			return false;
		}
		if (pokemon.level < target.level) return tryMoveHit.call(this, target, pokemon, move, ...rest);
		const { ohko, damage } = move;
		Object.assign(move, { ohko: false, damage: OHKO_DAMAGE, laterOhko: true });
		let result;
		try {
			result = tryMoveHit.call(this, target, pokemon, move, ...rest);
		} finally {
			Object.assign(move, { ohko, damage, laterOhko: false });
		}
		if (result !== false && !target.hp) battle.add('-ohko');
		return result;
	});
}

const CRIT_GEN2 = [0, 17, 32, 64, 85, 128];
const FOCUS_BONUS = gen => (gen <= 1 ? 0 : gen === 2 ? 1 : 2);
function critOlder(battle) {
	wrap(battle.actions, 'getDamage', 'crit', getDamage => function (source, target, move, ...rest) {
		const run = () => getDamage.call(this, source, target, move, ...rest);
		if (!source || !target || typeof move !== 'object' || move.willCrit !== undefined || move.category === 'Status' || !later(battle, move)) return run();
		const focused = !!source.volatiles['focusenergy'];
		if (battle.gen > 1) {
			if (move.ohko || move.damage || move.damageCallback || !(move.basePower || move.basePowerCallback)) return run();
			const crit = guarded(battle, `${move.id} crit`, () => ownCrit(battle, source, target, move, focused));
			if (typeof crit !== 'boolean') return run();
			move.willCrit = crit;
			try {
				return run();
			} finally {
				move.willCrit = undefined;
			}
		}
		const own = Object.getOwnPropertyDescriptor(battle, 'randomChance');
		const randomChance = battle.randomChance;
		const restore = () => {
			if (own) Object.defineProperty(battle, 'randomChance', own);
			else delete battle.randomChance;
		};
		battle.randomChance = function (numerator, denominator, ...more) {
			restore();
			if (denominator !== 256) return randomChance.call(this, numerator, denominator, ...more);
			return guarded(battle, `${move.id} crit`, () => ownCrit(battle, source, target, move, focused)) ?? randomChance.call(this, numerator, denominator, ...more);
		};
		const focus = source.volatiles['focusenergy'];
		if (focus) delete source.volatiles['focusenergy'];
		try {
			return run();
		} finally {
			restore();
			if (focus && !source.volatiles['focusenergy']) source.volatiles['focusenergy'] = focus;
		}
	});
}

function ownCrit(battle, source, target, move, focused) {
	const gen = move.gen;
	let stage = battle.runEvent('ModifyCritRatio', source, target, move, move.critRatio || 0);
	// ModifyCritRatio already gave the battle generation's Focus Energy bonus
	if (focused) stage += FOCUS_BONUS(gen) - FOCUS_BONUS(battle.gen);
	if (gen === 2) return battle.random(256) < CRIT_GEN2[battle.clampIntRange(stage, 0, 5)];
	const table = gen <= 5 ? [0, 16, 8, 4, 3, 2] : gen === 6 ? [0, 16, 8, 2, 1] : [0, 24, 8, 2, 1];
	stage = battle.clampIntRange(stage, 0, table.length - 1);
	return stage > 0 && battle.randomChance(1, table[stage]);
}

const OLD_HITS = '2,2,2,3,3,3,4,5';
const HITS_FROM_5 = Object.freeze([2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 5, 5, 5]);
function hitOdds(battle) {
	wrap(battle, 'sample', 'hits', sample => function (items, ...rest) {
		const move = this.activeMove;
		if (move?.gen >= 5 && later(this, move) && items?.length === 8 && items.join() === OLD_HITS) return sample.call(this, HITS_FROM_5, ...rest);
		return sample.call(this, items, ...rest);
	});
}

function spreadGen3(battle) {
	battle.onEvent('ModifyDamagePhase1', battle.format, TIE_FREE, function (damage, source, target, move) {
		if (!move?.spreadHit || !(move.gen >= 4) || typeof damage !== 'number' || !later(this, move)) return;
		const cut = this.modify(damage, 0.75);
		return move.target === 'allAdjacentFoes' ? cut * 2 : cut;
	});
}

function powderImmunity(battle) {
	battle.onEvent('TryHit', battle.format, TIE_FREE, function (target, source, move) {
		if (!move?.flags?.['powder'] || !(move.gen >= 6) || target === source || !later(this, move) || !target?.hasType('Grass')) return;
		this.add('-immune', target);
		return null;
	});
}

const SPLIT_FROM = 4;
const ownCategory = (battle, move) => later(battle, move) && move.gen >= SPLIT_FROM && move.category !== 'Status';
const categoryOf = (battle, move) => {
	const category = battle.dex.forGen(move.gen).moves.get(move.id).category;
	return category === 'Physical' || category === 'Special' ? category : move.category;
};
export function moveCategory(battle, moveOrId) {
	const move = typeof moveOrId === 'string' ? battle.dex.moves.get(moveOrId) : moveOrId;
	if (!move?.exists || !(battle.gen < SPLIT_FROM) || !ownCategory(battle, move)) return move?.category;
	return categoryOf(battle, move);
}
function categoryOlder(battle) {
	wrap(battle, 'singleEvent', 'category', singleEvent => function (id, effect, ...rest) {
		if (id === 'ModifyMove' && effect?.effectType === 'Move' && typeof effect.hit === 'number' && ownCategory(this, effect)) effect.category = categoryOf(this, effect);
		return singleEvent.call(this, id, effect, ...rest);
	});
	wrap(battle, 'getCategory', 'category', getCategory => function (move, ...rest) {
		const data = typeof move === 'string' ? this.dex.moves.get(move) : move;

		if (typeof data?.hit === 'number' || !ownCategory(this, data)) return getCategory.call(this, move, ...rest);
		return categoryOf(this, data);
	});
}

function runMoveGen2(battle) {
	wrap(battle.actions, 'runMove', 'gen2', runMove => function (moveOrMoveName, pokemon, ...rest) {
		pokemon.activeMoveActions++;
		const moved = pokemon.moveThisTurn;
		const result = runMove.call(this, moveOrMoveName, pokemon, ...rest);
		if (moved) return result;

		if (!pokemon.moveThisTurn && pokemon.moveThisTurnResult === undefined) pokemon.moveThisTurnResult = false;
		battle.lastSuccessfulMoveThisTurn = pokemon.moveThisTurn && pokemon.moveThisTurnResult !== false ? battle.activeMove?.id ?? pokemon.moveThisTurn : null;
		if (!pokemon.moveThisTurn || pokemon.fainted) return result;
		const move = battle.activeMove?.id ? battle.activeMove : battle.dex.getActiveMove(pokemon.moveThisTurn);
		for (const [id, state] of Object.entries(pokemon.volatiles)) {
			const effect = battle.dex.conditions.get(id);
			if (!effect.onAfterMove || !later(battle, battle.dex.moves.get(id))) continue;
			guarded(battle, `${id} after move`, () => battle.singleEvent('AfterMove', effect, state, pokemon, null, move));
		}
		return result;
	});
}

function prepareHit(battle) {
	battle.onEvent('TryMove', battle.format, EARLY, function (pokemon, target, move) {
		if (!later(this, move) || !move.onPrepareHit) return;
		const result = guarded(this, `${move.id} prepare`, () => this.singleEvent('PrepareHit', move, {}, target, pokemon, move));
		if (result || result === undefined) return;
		if (result === false) this.add('-fail', pokemon);
		return null;
	});
}

function afterMove(battle) {
	battle.onEvent('AfterMove', battle.format, EARLY, function (pokemon, target, move) {
		if (!later(this, move) || !move.onAfterMove) return;
		move.hitTargets ??= target ? [target] : [];
		guarded(this, `${move.id} after move`, () => move.onAfterMove.call(this, pokemon, target, move));
	});
}

// Moves Encore does not lock in (generation 2's Pokemon.moveUsed)
const ENCORE_SKIPS = new Set(['metronome', 'mimic', 'mirrormove', 'sketch', 'sleeptalk', 'transform']);

function runMoveGen1(battle) {
	const charging = id => {
		const move = battle.dex.moves.get(id);
		return later(battle, move) && move.flags['charge'];
	};
	const started = new Map(), struck = new Map(), recharge = new Set();
	battle.onEvent('BeforeMove', battle.format, LATE, function (pokemon, target, move) {
		started.set(pokemon, move);
	});

	wrap(battle.actions, 'switchIn', 'passedStages', switchIn => function (pokemon, ...rest) {
		const was = pokemon?.modifiedStats ? statInputs(pokemon) : null;
		const result = switchIn.call(this, pokemon, ...rest);
		if (was && pokemon.isActive) {
			const now = statInputs(pokemon);
			for (const stat of RESTAT) if (pokemon.boosts[stat] || now[stat] !== was[stat]) guarded(battle, 'switch-in stats', () => freshStat(pokemon, stat));
		}
		return result;
	});
	wrap(battle.actions, 'tryMoveHit', 'struck', tryMoveHit => function (target, pokemon, move, ...rest) {
		if (move?.multihit) landedHits.set(move, 0);
		const result = tryMoveHit.call(this, target, pokemon, move, ...rest);

		struck.set(pokemon, move?.multihit && landedHits.get(move) === 0 ? false : result);
		return result;
	});

	const statsNow = () => new Map(battle.getAllActive().map(p => [p, { transformed: p.transformed, inputs: statInputs(p), modified: { ...p.modifiedStats } }]));
	const windows = [];
	wrap(battle.actions, 'useMove', 'stats', useMove => function (moveOrMoveName, pokemon, ...rest) {
		const run = () => useMove.call(this, moveOrMoveName, pokemon, ...rest);
		if (!later(battle, battle.dex.moves.get(moveOrMoveName))) {
			if (!windows.length) return run();
			guarded(battle, 'stats', () => restatAll(windows.at(-1)));
			try {
				return run();
			} finally {
				windows[windows.length - 1] = statsNow();
			}
		}
		windows.push(statsNow());
		try {
			return run();
		} finally {
			const before = windows.pop();
			guarded(battle, 'stats', () => restatAll(before));
		}
	});
	wrap(battle.actions, 'useMoveInner', 'gen1', useMoveInner => function (moveOrMoveName, pokemon, options, ...rest) {
		const move = battle.dex.moves.get(moveOrMoveName);
		if (!later(battle, move)) return useMoveInner.call(this, moveOrMoveName, pokemon, options, ...rest);

		if (move.target === 'allies') options = { ...options, target: pokemon };
		struck.delete(pokemon);
		const result = useMoveInner.call(this, moveOrMoveName, pokemon, options, ...rest);
		const hit = struck.get(pokemon);
		if (move.selfBoost && hit !== undefined && hit !== false && pokemon.hp) {
			const active = typeof moveOrMoveName === 'string' ? battle.dex.getActiveMove(moveOrMoveName) : moveOrMoveName;
			guarded(battle, `${move.id} self boost`, () => this.moveHit(pokemon, pokemon, active, move.selfBoost, false, true));
		}

		if (move.self?.volatileStatus === 'mustrecharge' && hit !== undefined && hit !== false) recharge.add(pokemon);
		return result;
	});
	wrap(battle.actions, 'runMove', 'gen1', runMove => function (moveOrMoveName, pokemon, ...rest) {
		pokemon.activeMoveActions++;
		started.delete(pokemon);
		struck.delete(pokemon);
		recharge.delete(pokemon);
		const from = battle.log.length;
		const locked = pokemon.volatiles['twoturnmove'], attacking = locked && charging(locked.move) ? locked.move : null;
		const result = attacking ? withoutPP(pokemon, () => runMove.call(this, moveOrMoveName, pokemon, ...rest)) : runMove.call(this, moveOrMoveName, pokemon, ...rest);
		if (recharge.delete(pokemon) && pokemon.hp && !pokemon.volatiles['mustrecharge']) {
			guarded(battle, 'recharge', () => {
				pokemon.addVolatile('mustrecharge');
				battle.add('-mustrecharge', pokemon);
			});
		}
		const move = started.get(pokemon);
		started.delete(pokemon);

		if (!move) pokemon.moveThisTurnResult = false;
		else if (!locked && pokemon.volatiles['twoturnmove']) {
			pokemon.moveThisTurnResult = null;
			battle.lastSuccessfulMoveThisTurn = null;
		} else {
			const status = battle.dex.moves.get(move.id).category === 'Status';
			const told = status && battle.log.slice(from).some(line => line.startsWith('|-fail|') || line.startsWith('|-immune|'));
			const worked = struck.has(pokemon) && struck.get(pokemon) !== false && !told;
			pokemon.moveThisTurnResult = worked;
			battle.lastSuccessfulMoveThisTurn = worked ? battle.activeMove?.id ?? move.id : null;
		}

		if (move && (pokemon.moveThisTurn || pokemon.volatiles['twoturnmove'])) pokemon.lastMoveEncore = ENCORE_SKIPS.has(move.id) ? null : move;
		if (attacking) {
			pokemon.removeVolatile('twoturnmove');
			pokemon.removeVolatile(attacking);
		} else {
			const lock = pokemon.volatiles['twoturnmove'];
			if (lock && charging(lock.move) && !pokemon.volatiles[lock.move]) guarded(battle, `${lock.move} charge`, () => {
				const defender = lock.source && !lock.source.fainted ? lock.source : null;
				const added = pokemon.addVolatile(lock.move, defender, battle.dex.moves.get(lock.move));
				if (added && defender && defender !== pokemon) pokemon.volatiles[lock.move].targetLoc = pokemon.getLocOf(defender);
			});
		}
		return result;
	});
}

const RESTAT = ['atk', 'def', 'spa', 'spd', 'spe'];
const STAGE_UP = [1, 1.5, 2, 2.5, 3, 3.5, 4], STAGE_DOWN = [100, 66, 50, 40, 33, 28, 25];

// The status that cuts a stat, and by how much
const STATUS_CUT = Object.freeze({ atk: ['brn', 0.5], spe: ['par', 0.25] });

function statInputs(pokemon) {
	return Object.fromEntries(RESTAT.map(stat => [stat, `${pokemon.storedStats[stat]}:${pokemon.boosts[stat]}:${STATUS_CUT[stat]?.[0] === pokemon.status}`]));
}

function freshStat(pokemon, stat) {
	const stage = pokemon.boosts[stat];
	pokemon.modifiedStats[stat] = pokemon.storedStats[stat];
	pokemon.modifyStat(stat, stage >= 0 ? STAGE_UP[stage] : STAGE_DOWN[-stage] / 100);
	if (stage > 0 && pokemon.modifiedStats[stat] > 999) pokemon.modifiedStats[stat] = 999;
	const cut = STATUS_CUT[stat];
	if (cut && pokemon.status === cut[0]) pokemon.modifyStat(stat, cut[1]);
}

function restatAll(before) {
	for (const [pokemon, was] of before) {
		if (!pokemon.isActive || pokemon.fainted || !pokemon.modifiedStats || pokemon.transformed !== was.transformed) continue;
		const now = statInputs(pokemon);
		for (const stat of RESTAT) {
			if (now[stat] !== was.inputs[stat]) freshStat(pokemon, stat);
			else pokemon.modifiedStats[stat] = was.modified[stat];
		}
	}
}

const laterEffect = (battle, effect) => !!effect && (effect.effectType === 'Ability' || effect.effectType === 'Item' || later(battle, battle.dex.moves.get(effect.id)));
function statusCuts(battle) {
	battle.onEvent('AfterSetStatus', battle.format, TIE_FREE, function (status, target, source, effect) {
		if (!target?.modifiedStats || effect?.effectType === 'Move') return;
		for (const [stat, [id, by]] of Object.entries(STATUS_CUT)) if (status?.id === id) target.modifyStat(stat, by);
	});
	wrap(battle, 'boost', 'cuts', boost => function (changes, target = null, source = null, effect = null, ...rest) {
		const pokemon = target ?? this.event?.target;
		const cause = effect ?? this.effect;
		const stages = pokemon?.modifiedStats ? { ...pokemon.boosts } : null;
		const result = boost.call(this, changes, target, source, effect, ...rest);
		if (stages && laterEffect(this, cause)) {
			for (const [stat, [id, by]] of Object.entries(STATUS_CUT)) if (pokemon.status === id && pokemon.boosts[stat] !== stages[stat]) pokemon.modifyStat(stat, by);
		}
		return result;
	});
}

function withoutPP(pokemon, run) {
	const own = Object.getOwnPropertyDescriptor(pokemon, 'deductPP');
	pokemon.deductPP = () => 0;
	try {
		return run();
	} finally {
		if (own) Object.defineProperty(pokemon, 'deductPP', own);
		else delete pokemon.deductPP;
	}
}

function boostFlags(battle) {
	wrap(battle, 'boost', 'flags', boost => function (changes, target = null, ...rest) {
		const pokemon = target ?? this.event?.target;
		const result = boost.call(this, changes, target, ...rest);
		if (result && pokemon && changes) {
			if (Object.values(changes).some(x => x > 0)) pokemon.statsRaisedThisTurn = true;
			if (Object.values(changes).some(x => x < 0)) pokemon.statsLoweredThisTurn = true;
		}
		return result;
	});
}

const QUICK_CLAW_SPEED = 65535;
function tailwindSpeed(battle) {
	wrap(battle, 'getActionSpeed', 'tailwind', getActionSpeed => function (action, ...rest) {
		const result = getActionSpeed.call(this, action, ...rest);
		if (action.pokemon?.side.sideConditions['tailwind'] && typeof action.speed === 'number' && action.speed !== QUICK_CLAW_SPEED) action.speed *= 2;
		return result;
	});
}

const REFUSALS = new Set(['TryHit', 'TryHitField', 'TryHitSide']);
function watchRefusal(battle, data, run) {
	const own = Object.getOwnPropertyDescriptor(battle, 'singleEvent');
	const singleEvent = battle.singleEvent;
	let refused = false;
	battle.singleEvent = function (id, effect, ...rest) {
		const out = singleEvent.call(this, id, effect, ...rest);
		if (effect === data && REFUSALS.has(id) && !out) refused = true;
		return out;
	};
	try {
		return [run(), refused];
	} finally {
		if (own) Object.defineProperty(battle, 'singleEvent', own);
		else delete battle.singleEvent;
	}
}

function moveHitGaps(battle) {
	const gen = battle.gen;
	wrap(battle.actions, 'moveHit', 'gaps', moveHit => function (target, pokemon, move, moveData, isSecondary, isSelf) {
		const run = () => moveHit.call(this, target, pokemon, move, moveData, isSecondary, isSelf);
		if (isSecondary || isSelf || !later(battle, move)) return run();
		const data = moveData || move;
		const from = battle.log.length;

		const sub = target && target !== pokemon ? target.volatiles['substitute'] : null;
		const subHp = sub?.hp;
		const [result, refused] = watchRefusal(battle, data, run);
		if (refused) {
			move.laterRefused = true;
			return result;
		}
		const intoSub = !!sub && (target.volatiles['substitute'] !== sub || sub.hp !== subHp);
		if (intoSub) {
			if (gen === 1 && target.volatiles['substitute'] !== sub) guarded(battle, `${move.id} broke a Substitute`, () => {
				if (data.self && data.self.volatileStatus !== 'lockedmove') this.moveHit(pokemon, pokemon, move, data.self, false, true);
				brokeSub(battle, pokemon, target, move, subHp);
			});
			return result;
		}
		let worked = false;
		if (data.slotCondition) {
			const user = target ?? pokemon;
			worked = !!guarded(battle, `${move.id} slot`, () => user.side.addSlotCondition(user, data.slotCondition, pokemon, move));
		}
		if (gen === 1 && data.onHitField) {
			const hit = guarded(battle, `${move.id} field`, () => battle.singleEvent('HitField', data, {}, target, pokemon, move));
			if (hit === false) battle.add('-fail', pokemon);
			else worked = true;
		}
		if (gen === 1 && data.onHitSide) {
			const side = move.target === 'foeSide' ? pokemon.side.foe : pokemon.side;
			if (guarded(battle, `${move.id} side`, () => battle.singleEvent('HitSide', data, {}, side, pokemon, move)) !== false) worked = true;
		}
		if (gen === 1 && data.onAfterHit && target && (typeof result === 'number' || result === true)) {
			guarded(battle, `${move.id} after hit`, () => battle.singleEvent('AfterHit', data, {}, target, pokemon, move));
		}
		if (gen === 1 && data.forceSwitch && target && target !== pokemon && target.hp && pokemon.hp && (typeof result === 'number' || result === true)
			&& battle.canSwitch(target.side) && guarded(battle, `${move.id} drag`, () => battle.runEvent('DragOut', target, pokemon, move))) target.forceSwitchFlag = true;
		if (data.thawsTarget && target?.status === 'frz' && typeof result === 'number') target.cureStatus();
		if (worked && data.selfSwitch && pokemon.hp && !pokemon.switchFlag && (battle.canSwitch(pokemon.side) || move.id === 'revivalblessing')) {
			pokemon.switchFlag = move.id;
		}
		if (!worked || result) return result;

		const fail = `|-fail|${target ?? pokemon}`;
		const at = battle.log.lastIndexOf(fail);
		if (at >= from) battle.log.splice(at, 1);
		return true;
	});
}

function brokeSub(battle, pokemon, target, move, dealt) {
	if (!pokemon.hp || !(dealt > 0)) return;
	if (move.drain && move.gen >= 3) battle.heal(Math.ceil(dealt * move.drain[0] / move.drain[1]), pokemon, target, 'drain');
	if (!move.recoil || (move.gen >= 3 && move.gen <= 4)) return;
	const recoil = move.gen === 2 ? 1 : Math.max(1, Math.round(dealt * move.recoil[0] / move.recoil[1]));
	battle.damage(recoil, pokemon, target, 'recoil');
}

function afterSubDamage(battle) {
	battle.onEvent('AfterSubDamage', battle.format, TIE_FREE, function (damage, target, source, move) {
		if (!move?.onAfterSubDamage || !(move.gen >= 5) || !later(this, move)) return;
		guarded(this, `${move.id} after sub damage`, () => this.singleEvent('AfterSubDamage', move, {}, target, source, move, damage));
	});
}

function selfDestructIfHit(battle) {
	wrap(battle.actions, 'tryMoveHit', 'ifHit', tryMoveHit => function (target, pokemon, move, ...rest) {
		if (move.selfdestruct !== 'ifHit' || !later(battle, move)) return tryMoveHit.call(this, target, pokemon, move, ...rest);
		let result;
		move.selfdestruct = undefined;
		try {
			result = tryMoveHit.call(this, target, pokemon, move, ...rest);
		} finally {
			move.selfdestruct = 'ifHit';
		}
		if ((result || result === 0) && !move.laterRefused && pokemon.hp) battle.faint(pokemon, pokemon, move);
		return result;
	});
}

function multiAccuracy(battle) {
	wrap(battle.actions, 'tryMoveHit', 'multiaccuracy', tryMoveHit => function (target, pokemon, move, ...rest) {
		if (!move.multiaccuracy || typeof move.multihit !== 'number' || !target || !later(battle, move)) return tryMoveHit.call(this, target, pokemon, move, ...rest);
		const all = move.multihit;
		let hits = 1;
		while (hits < all && rollsHit(battle, pokemon, target, move)) hits++;
		move.multihit = hits;
		try {
			return tryMoveHit.call(this, target, pokemon, move, ...rest);
		} finally {
			move.multihit = all;
		}
	});
}

const GEN1_ACCURACY_STAGES = [25, 28, 33, 40, 50, 66, 100, 150, 200, 250, 300, 350, 400];
const GEN2_UP = [1, 1.33, 1.66, 2, 2.33, 2.66, 3], GEN2_DOWN = [1, 0.75, 0.6, 0.5, 0.43, 0.36, 0.33];
function rollsHit(battle, pokemon, target, move) {
	if (battle.gen === 1) {
		let accuracy = move.accuracy;
		if (accuracy !== true) {
			accuracy = Math.floor(accuracy * 255 / 100);
			if (!move.ignoreAccuracy) accuracy = Math.floor(accuracy * (GEN1_ACCURACY_STAGES[pokemon.boosts.accuracy + 6] / 100));
			if (!move.ignoreEvasion) accuracy = Math.floor(accuracy * (GEN1_ACCURACY_STAGES[-target.boosts.evasion + 6] / 100));
			accuracy = battle.clampIntRange(accuracy, 1, 255);
		}
		accuracy = battle.runEvent('Accuracy', target, pokemon, move, accuracy);
		return accuracy === true || battle.randomChance(accuracy, 256);
	}
	let accuracy = move.alwaysHit ? true : battle.runEvent('Accuracy', target, pokemon, move, move.accuracy);
	if (accuracy !== true) {
		accuracy = Math.floor(accuracy * 255 / 100);
		if (!move.ignoreAccuracy) accuracy *= pokemon.boosts.accuracy > 0 ? GEN2_UP[pokemon.boosts.accuracy] : GEN2_DOWN[-pokemon.boosts.accuracy];
		if (!move.ignoreEvasion) {
			if (target.boosts.evasion > 0 && !move.ignorePositiveEvasion) accuracy *= GEN2_DOWN[target.boosts.evasion];
			else if (target.boosts.evasion < 0) accuracy *= GEN2_UP[-target.boosts.evasion];
		}
		accuracy = Math.max(Math.min(Math.floor(accuracy), 255), 1);
	} else {
		accuracy = battle.runEvent('Accuracy', target, pokemon, move, accuracy);
	}
	accuracy = battle.runEvent('ModifyAccuracy', target, pokemon, move, accuracy);
	if (accuracy !== true) accuracy = Math.max(accuracy, 0);
	if (!move.alwaysHit) accuracy = battle.runEvent('Accuracy', target, pokemon, move, accuracy);
	return accuracy === true || accuracy === 255 || battle.randomChance(accuracy, 256);
}

function bypassSubstitute(battle) {
	wrap(battle.actions, 'moveHit', 'bypasssub', moveHit => function (target, pokemon, move, moveData, isSecondary, isSelf, ...rest) {
		const run = () => moveHit.call(this, target, pokemon, move, moveData, isSecondary, isSelf, ...rest);
		const substitute = target?.volatiles?.['substitute'];
		if (!substitute || isSelf || target === pokemon || !later(battle, move) || !(move.flags?.['bypasssub'] || move.infiltrates)) return run();
		delete target.volatiles['substitute'];
		try {
			return run();
		} finally {
			if (!target.volatiles['substitute']) target.volatiles['substitute'] = substitute;
		}
	});
}

const SCREEN_OF = Object.freeze({ def: 'reflect', spd: 'lightscreen' });
function screensByCategory(battle) {
	const gen = battle.gen;
	const holder = pokemon => (gen === 1 ? pokemon.volatiles : pokemon.side.sideConditions);
	wrap(battle.actions, 'getDamage', 'screens', getDamage => function (source, target, move, ...rest) {
		const data = typeof move === 'string' ? battle.dex.moves.get(move) : move;
		if (!source || !target || !later(battle, data) || data.category === 'Status' || !(data.overrideDefensiveStat || data.overrideOffensiveStat)) {
			return getDamage.call(this, source, target, move, ...rest);
		}
		const physical = data.category === 'Physical';
		const defType = data.overrideDefensiveStat || (physical ? 'def' : 'spd');
		const atkType = data.overrideOffensiveStat || (physical ? 'atk' : 'spa');
		const undo = [];
		const put = (where, key, value) => {
			undo.push([where, key, Object.hasOwn(where, key), where[key]]);
			if (value === undefined) delete where[key];
			else where[key] = value;
		};
		if (SCREEN_OF[defType]) {
			const defending = holder(target), screen = defending[physical ? 'reflect' : 'lightscreen'];
			put(defending, 'reflect', undefined);
			put(defending, 'lightscreen', undefined);
			put(defending, SCREEN_OF[defType], screen);
			// Aurora Veil does not add to the screen of the move's category
			if (screen && target.side.sideConditions['auroraveil']) put(target.side.sideConditions, 'auroraveil', undefined);
		}
		if (gen === 2 && SCREEN_OF[atkType] && holder(source)[SCREEN_OF[atkType]]) {
			if (source.side !== target.side) put(holder(source), SCREEN_OF[atkType], undefined);
			else {

				const getStat = source.getStat;
				put(source, 'getStat', function (statName, unboosted, ...more) {
					const value = getStat.call(this, statName, unboosted, ...more);
					return statName === atkType && !unboosted ? Math.floor(value / 2) : value;
				});
			}
		}
		try {
			return getDamage.call(this, source, target, move, ...rest);
		} finally {
			for (const [where, key, had, value] of undo.reverse()) {
				if (had) where[key] = value;
				else delete where[key];
			}
		}
	});
}
