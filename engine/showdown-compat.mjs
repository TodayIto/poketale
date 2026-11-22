import { outsideStatus } from './era.mjs';

export function injectStatus(battle, pokemon, status, { sleepTurns, freezeTurns } = {}) {

	status = outsideStatus(battle.gen, status);
	pokemon.status = status;
	pokemon.statusState = battle.initEffectState({ id: status, target: pokemon });
	statusDrops(pokemon);
	if (status === 'slp') pokemon.statusState.startTime = pokemon.statusState.time = sleepTurns;
	if (status === 'frz' && freezeTurns) pokemon.statusState.startTime = pokemon.statusState.time = freezeTurns;
	if (status === 'tox') pokemon.statusState.stage = 0;
}

export function setLevel(battle, pokemon, level) {
	pokemon.set.level = level;
	pokemon.level = level;
	pokemon.details = pokemon.getUpdatedDetails();
	refreshStats(battle, pokemon);
}

function refreshStats(battle, pokemon) {
	const species = pokemon.transformed ? pokemon.baseSpecies : pokemon.species;
	const stats = battle.spreadModify(species.baseStats, pokemon.set);
	if (species.maxHP) stats.hp = species.maxHP; // Shedinja = 1
	pokemon.baseStoredStats = stats;
	if (!pokemon.transformed) {
		for (const s of Object.keys(pokemon.storedStats)) {
			pokemon.storedStats[s] = stats[s];
			// generation 1 fights with modifiedStats (Generation 1's stats below)
			if (pokemon.modifiedStats) pokemon.modifiedStats[s] = stats[s];
		}
		pokemon.speed = pokemon.storedStats.spe;
		reapplyBoosts(pokemon);
		statusDrops(pokemon);
	}
	const oldMax = pokemon.maxhp;
	pokemon.baseMaxhp = stats.hp;

	pokemon.maxhp = pokemon.volatiles['dynamax'] ? Math.floor(stats.hp * (1.5 + (pokemon.dynamaxLevel * 0.05))) : stats.hp;
	if (pokemon.hp > 0) pokemon.hp = Math.max(1, pokemon.hp + pokemon.maxhp - oldMax);
}

function statusDrops(pokemon) {
	if (!pokemon.modifiedStats || typeof pokemon.modifyStat !== 'function') return;
	if (pokemon.status === 'par') pokemon.modifyStat('spe', 0.25);
	if (pokemon.status === 'brn') pokemon.modifyStat('atk', 0.5);
}

const GEN1_RAISE = [1, 1.5, 2, 2.5, 3, 3.5, 4], GEN1_DROP = [100, 66, 50, 40, 33, 28, 25], GEN1_CAP = 999;

function reapplyBoosts(pokemon) {
	if (!pokemon.modifiedStats || typeof pokemon.modifyStat !== 'function') return;
	for (const s of Object.keys(pokemon.modifiedStats)) {
		const boost = pokemon.boosts[s] ?? 0;
		if (!boost) continue;
		pokemon.modifyStat(s, boost > 0 ? GEN1_RAISE[boost] : GEN1_DROP[-boost] / 100);
		if (boost > 0 && pokemon.modifiedStats[s] > GEN1_CAP) pokemon.modifiedStats[s] = GEN1_CAP;
	}
}

/** The highest IV and EV the Pokemon constructor keeps */
const ENGINE_IV_MAX = 31, ENGINE_EV_MAX = 255;
const SPREAD_STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

/** Whether a set has an IV or EV the Pokemon constructor would cut */
const beyondEngine = set => SPREAD_STATS.some(s => (set?.ivs?.[s] ?? 0) > ENGINE_IV_MAX || (set?.evs?.[s] ?? 0) > ENGINE_EV_MAX);

export function restoreSpread(battle, pokemon, given) {
	if (!beyondEngine(given)) return;
	Object.assign(pokemon.set.ivs, given.ivs);
	Object.assign(pokemon.set.evs, given.evs);
	const hiddenPower = battle.dex.getHiddenPower(pokemon.set.ivs);
	pokemon.hpType = pokemon.baseHpType = pokemon.set.hpType || hiddenPower.type;
	pokemon.hpPower = pokemon.baseHpPower = hiddenPower.power;
	refreshStats(battle, pokemon);
}

export function battleFromJSON(sim, json) {
	const state = JSON.parse(json);
	const given = state.sides.map(side => side.pokemon.map(p => (beyondEngine(p.set) ? { ivs: { ...p.set.ivs }, evs: { ...p.set.evs } } : null)));
	const battle = sim.Battle.fromJSON(state);
	battle.sides.forEach((side, i) => side.pokemon.forEach((pokemon, j) => {
		if (!given[i][j]) return;
		Object.assign(pokemon.set.ivs, given[i][j].ivs);
		Object.assign(pokemon.set.evs, given[i][j].evs);
	}));
	return battle;
}

const QUIET_LINE = /^\|(t:|split\||debug\||-hint\||$)/;

const quietState = battle => JSON.stringify([
	battle.sides.map(side => [Object.keys(side.sideConditions), side.slotConditions.map(Object.keys),
		side.pokemon.map(p => [p.hp, p.status, p.switchFlag, p.fainted, Object.keys(p.volatiles)])]),
	battle.field.weather, battle.field.terrain, Object.keys(battle.field.pseudoWeather),
]);

export function sayQuietFailures(battle) {
	if (!(battle.gen < 9)) return;
	const { actions } = battle;
	const runMove = actions.runMove;
	if (runMove.quietFailures) return;
	const wrapped = function (move, pokemon, ...rest) {
		const from = battle.log.length;
		const before = battle.gen === 1 ? quietState(battle) : null;
		const result = runMove.call(this, move, pokemon, ...rest);
		const ident = `${pokemon}`;
		const lines = battle.log.slice(from).filter(line => !QUIET_LINE.test(line));
		const at = lines.findIndex(line => line.startsWith(`|move|${ident}|`));
		const failed = battle.gen === 1 ? quietState(battle) === before : pokemon.moveThisTurnResult === false;
		if (at >= 0 && at === lines.length - 1 && failed && !battle.ended) battle.add('-fail', pokemon);
		return result;
	};
	wrapped.quietFailures = true;
	actions.runMove = wrapped;
}

export function keepFormTypes(battle) {
	const original = battle.getCallback;
	if (original.formTypes) return;
	const wrapped = function (target, effect, callbackName) {
		const callback = original.call(this, target, effect, callbackName);
		if (!callback || callbackName !== 'onType' || effect !== target?.baseSpecies || !target.m?.formWithoutItem) return callback;
		return function (types, pokemon) {
			const item = pokemon.getItem();
			return item.onPlate || item.onMemory ? callback.call(this, types, pokemon) : types;
		};
	};
	wrapped.formTypes = true;
	battle.getCallback = wrapped;
	const single = battle.singleEvent;
	battle.singleEvent = function (eventid, effect, state, target, ...rest) {
		const out = single.call(this, eventid, effect, state, target, ...rest);
		const prop = eventid === 'ModifyType' && effect?.effectType === 'Move' && target?.m?.formWithoutItem ? FORM_TYPE_MOVES[effect.id] : null;
		if (prop && !target.getItem()[prop]) {
			const species = target.species;
			const type = (species.requiredItems ?? [species.requiredItem]).map(name => this.dex.items.get(name ?? '')[prop]).find(Boolean);
			if (type) effect.type = type;
		}
		return out;
	};
}

export function keepFormOnSwitch(battle, kept) {
	const original = battle.getCallback;
	if (original.formOnSwitch) return;
	const wrapped = function (target, effect, callbackName) {
		const callback = original.call(this, target, effect, callbackName);
		if (!callback || (callbackName !== 'onSwitchIn' && callbackName !== 'onBeforeSwitchIn') || effect !== target?.baseSpecies || !kept(target)) return callback;
		return undefined;
	};
	wrapped.formOnSwitch = true;
	battle.getCallback = wrapped;
}

const FORM_TYPE_MOVES = Object.freeze({ judgment: 'onPlate', multiattack: 'onMemory', technoblast: 'onDrive' });

export function startedGimmicks(battle, teraForm) {
	for (const side of battle.sides) {
		if (!side) continue;
		if (side.pokemon.some(p => p.species.isMega)) for (const p of side.pokemon) Object.assign(p, { canMegaEvo: false, canMegaEvoX: false, canMegaEvoY: false });
		if (side.pokemon.some(p => p.species.name === 'Necrozma-Ultra')) for (const p of side.pokemon) p.canUltraBurst = null;
		const tera = side.pokemon.filter(p => teraForm(p.species));
		for (const p of tera) Object.assign(p, { terastallized: p.teraType, addedType: '', knownType: true, apparentType: p.teraType });
		if (tera.length) for (const p of side.pokemon) p.canTerastallize = null;
	}
}

export function crownMoves(battle) {
	for (const side of battle.sides) {
		for (const pokemon of side?.pokemon ?? []) {
			const signature = CROWNED_MOVES[pokemon.species.name];
			const slot = signature ? pokemon.set.moves.findIndex(move => battle.dex.toID(move) === 'ironhead') : -1;
			if (slot < 0 || ![signature, 'ironhead'].includes(pokemon.baseMoveSlots[slot]?.id)) continue;
			if (pokemon.baseMoveSlots[slot].id === 'ironhead') {
				const move = battle.dex.moves.get(signature);
				const pp = battle.calculatePP(move, pokemon.ppUps[slot]);
				pokemon.baseMoveSlots[slot] = { move: move.name, id: move.id, pp, maxpp: pp, target: move.target, disabled: false, disabledSource: '', used: false };
				pokemon.moveSlots = pokemon.baseMoveSlots.slice();
			}
			pokemon.m.crowned = { slot, move: signature };
		}
	}
}

const CROWNED_MOVES = Object.freeze({ 'Zacian-Crowned': 'behemothblade', 'Zamazenta-Crowned': 'behemothbash' });

export function allowRayquazaMega(battle) {
	const { actions } = battle;
	const original = actions.canMegaEvo;
	if (original.rayquaza) return;
	const wrapped = function (pokemon) {
		return rayquazaMega(this.dex, pokemon.baseSpecies, pokemon.baseMoves, pokemon.getItem()) ?? original.call(this, pokemon);
	};
	wrapped.rayquaza = true;
	actions.canMegaEvo = wrapped;
}

export function rayquazaMega(dex, species, moveIds, item) {
	if (species.id !== 'rayquaza') return null;
	const mega = dex.species.get(species.otherFormes?.[0]);
	return mega?.isMega && mega.requiredMove && moveIds.includes(dex.moves.get(mega.requiredMove).id) && !item?.zMove ? mega.name : null;
}

export function blockZMoves(battle) {
	const { actions } = battle;
	if (actions.canZMove.blocked) return;
	const getZMove = actions.getZMove;
	const canZMove = () => undefined;
	canZMove.blocked = true;
	actions.canZMove = canZMove;
	actions.getZMove = function (move, pokemon, skipChecks) {
		return skipChecks ? getZMove.call(this, move, pokemon, skipChecks) : undefined;
	};
}

export function blockUltraBurst(battle) {
	const { actions } = battle;
	if (actions.canUltraBurst.blocked) return;
	const canUltraBurst = () => null;
	canUltraBurst.blocked = true;
	actions.canUltraBurst = canUltraBurst;
}

export function blockMegaEvo(battle) {
	const { actions } = battle;
	if (actions.canMegaEvo?.blocked) return;
	const none = Object.assign(() => null, { blocked: true });
	for (const name of ['canMegaEvo', 'canMegaEvoX', 'canMegaEvoY']) if (actions[name]) actions[name] = none;
}

export function blockTerastallize(battle) {
	const { actions } = battle;
	if (!actions.canTerastallize || actions.canTerastallize.blocked) return;
	actions.canTerastallize = Object.assign(() => null, { blocked: true });
}

export function allowDynamax(battle) {

	if (battle.runAction.dynamax) return;
	const runAction = battle.runAction;
	battle.runAction = Object.assign(function (action) {
		const out = runAction.call(this, action);
		if (action.choice === 'runDynamax') {
			action.pokemon.m.gimmick = 'dynamax';
			action.pokemon.canTerastallize = null;
		} else if (action.choice === 'terastallize' && action.pokemon.terastallized) action.pokemon.m.gimmick = 'tera';
		return out;
	}, { dynamax: true });
	const resolveFaints = battle.resolveFaints;
	battle.resolveFaints = function (...args) {
		const out = resolveFaints.apply(this, args);
		for (const side of this.sides) {
			for (const pokemon of side?.pokemon ?? []) if (pokemon.fainted && !pokemon.volatiles['dynamax']) pokemon.maxhp = pokemon.baseMaxhp;
		}
		return out;
	};
	if (battle.gameType === 'multi') {
		const add = battle.add, addSplit = battle.addSplit;
		battle.add = function (...parts) { if (parts[0] !== '-candynamax') add.apply(this, parts); };
		battle.addSplit = function (side, secret, shared) { if (secret?.[0] !== '-candynamax') addSplit.call(this, side, secret, shared); };
	}
	const open = fresh => {
		for (const side of battle.sides) {
			if (fresh) side.dynamaxUsed = false;
			side.canDynamaxNow = canDynamaxNow;
			for (const pokemon of side.pokemon) {
				const getDynamaxRequest = pokemon.getDynamaxRequest;
				pokemon.getDynamaxRequest = function (skipChecks) {
					if (!skipChecks && (this.terastallized || this.m.gimmick === 'tera')) return undefined;
					return getDynamaxRequest.call(this, skipChecks);
				};
			}
		}
	};
	if (battle.started) {
		open(false);

		if (battle.requestState === 'move' && battle.sides.some(side => side.canDynamaxNow())) {
			const requests = battle.getRequests(battle.requestState);
			battle.sides.forEach((side, i) => { if (side.activeRequest !== null) side.activeRequest = requests[i]; });
		}
	} else {
		const start = battle.start;
		battle.start = function (...args) {
			open(true);
			return start.apply(this, args);
		};
	}
}

/** sim/side.ts canDynamaxNow without its gen 8 check (this = the side) */
function canDynamaxNow() {

	if (this.battle.gameType === 'multi' && this.battle.turn % 2 !== [1, 1, 0, 0][this.n]) return false;
	return !this.dynamaxUsed;
}

export function newMoveSlot(move, pp) {
	return { move: move.name, id: move.id, pp, maxpp: pp, target: move.target, disabled: false, disabledSource: '', used: false };
}

export function revive(battle, pokemon, hp) {
	pokemon.side.pokemonLeft++;
	pokemon.fainted = false;
	pokemon.faintQueued = false;
	pokemon.subFainted = false;
	pokemon.status = '';
	pokemon.statusState = battle.initEffectState({ id: '', target: pokemon });
	pokemon.hp = hp;
}

export const sideLead = side => side.active.find(pokemon => pokemon && !pokemon.fainted) ?? side.active[0];

const SWITCH_ORDER = 103;

export function chooseEventAction(battle, side, event, position = 0) {
	side.clearChoice();

	side.active.forEach((pokemon, i) => side.choice.actions.push(i === position
		? { choice: 'event', event, order: SWITCH_ORDER, priority: 0, pokemon, side } : { choice: 'pass', pokemon, side }));
	if (battle.allChoicesDone()) battle.commitChoices();
}

export function chooseParts(battle, side, parts) {
	if (!side.requestState || side.choice.cantUndo) return false;
	side.clearChoice();
	const made = choosePartsIn(side, parts);
	if (!made) { const { error } = side.choice; side.clearChoice(); side.choice.error = error; return false; } // nothing half-chosen is left
	if (battle.allChoicesDone()) battle.commitChoices();
	return true;
}

function choosePartsIn(side, parts) {
	return chooseEach(side, parts) && side.isChoiceDone();
}

const MOVE_EVENTS = Object.freeze({ mega: 'mega', megax: 'megax', megay: 'megay', zmove: 'zmove', ultra: 'ultra',
	dynamax: 'dynamax', gigantamax: 'dynamax', max: 'dynamax', terastallize: 'terastallize', terastal: 'terastallize' });

export function chooseEach(side, parts) {
	for (const part of parts) {
		if (typeof part === 'object') {
			const index = side.getChoiceIndex();
			if (index >= side.active.length) return false;
			side.choice.actions.push({ choice: 'event', event: part.event, order: SWITCH_ORDER, priority: 0, pokemon: side.active[index], side });
			continue;
		}
		const [kind, ...rest] = part.trim().split(' ');
		let ok;
		if (kind === 'move') {
			const words = [...rest];

			const event = words.length > 1 && Object.hasOwn(MOVE_EVENTS, words.at(-1)) ? MOVE_EVENTS[words.pop()] : '';
			const targetLoc = words.length > 1 ? Number(words.pop()) : undefined;
			ok = side.chooseMove(words[0], targetLoc, event);
		} else if (kind === 'switch') ok = side.chooseSwitch(rest[0]);
		else if (kind === 'pass') ok = side.choosePass();
		else throw new Error(`Unsupported choice part: ${part}`);
		if (!ok || side.choice.error) return false;
	}
	return true;
}

export function findTrap(battle, pokemon) {
	const candidates = [];
	for (const [id, state] of Object.entries(pokemon.volatiles)) candidates.push({ id, state, event: 'TrapPokemon', holder: pokemon });
	for (const [id, state] of Object.entries(battle.field.pseudoWeather)) candidates.push({ id, state, event: 'TrapPokemon', holder: null });
	for (const foe of pokemon.foes()) {
		if (!foe.ignoringAbility()) candidates.push({ ability: foe.getAbility(), state: foe.abilityState, event: 'FoeTrapPokemon', holder: foe });
		for (const [id, state] of Object.entries(foe.volatiles)) candidates.push({ id, state, event: 'FoeTrapPokemon', holder: foe });
	}
	const saved = { trapped: pokemon.trapped, maybeTrapped: pokemon.maybeTrapped };
	const parent = { effect: battle.effect, effectState: battle.effectState };
	try {
		for (const candidate of candidates) {
			const effect = candidate.ability ?? battle.dex.conditions.getByID(candidate.id);
			const handler = effect?.[`on${candidate.event}`];
			if (typeof handler !== 'function') continue;
			pokemon.trapped = false;
			battle.effect = effect;
			battle.effectState = candidate.state;
			handler.call(battle, pokemon);
			if (pokemon.trapped) return { candidate, effect };
		}
		return null;
	} finally {
		Object.assign(pokemon, saved);
		battle.effect = parent.effect;
		battle.effectState = parent.effectState;
	}
}
