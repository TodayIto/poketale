export function injectStatus(battle, pokemon, status, { sleepTurns, freezeTurns } = {}) {
	// Generations 1-2 keep bad poison only inside the battle it started in; it is plain poison outside
	if (status === 'tox' && battle.gen <= 2) status = 'psn';
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

// Generation 1 keeps the stats it fights with in modifiedStats, with paralysis and burn applied to them when the status
// starts or the stats are recalculated (Showdown's species change does the same)
function statusDrops(pokemon) {
	if (!pokemon.modifiedStats || typeof pokemon.modifyStat !== 'function') return;
	if (pokemon.status === 'par') pokemon.modifyStat('spe', 0.25);
	if (pokemon.status === 'brn') pokemon.modifyStat('atk', 0.5);
}

// Generation 1's own recalculation of a boosted stat (its Pokemon.boostBy)
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

function refreshStats(battle, pokemon) {
	const species = pokemon.transformed ? pokemon.baseSpecies : pokemon.species;
	const stats = battle.spreadModify(species.baseStats, pokemon.set);
	if (species.maxHP) stats.hp = species.maxHP;
	pokemon.baseStoredStats = stats;
	if (!pokemon.transformed) {
		for (const s of Object.keys(pokemon.storedStats)) {
			pokemon.storedStats[s] = stats[s];
			if (pokemon.modifiedStats) pokemon.modifiedStats[s] = stats[s];
		}
		pokemon.speed = pokemon.storedStats.spe;
		reapplyBoosts(pokemon);
		statusDrops(pokemon);
	}
	const oldMax = pokemon.maxhp;
	pokemon.baseMaxhp = stats.hp;
	pokemon.maxhp = pokemon.volatiles['dynamax'] ? 2 * stats.hp : stats.hp;
	if (pokemon.hp > 0) pokemon.hp = Math.max(1, pokemon.hp + pokemon.maxhp - oldMax);
}

const ENGINE_IV_MAX = 31, ENGINE_EV_MAX = 255;
const SPREAD_STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

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

// Older generations' move code sometimes lets a move fail without a word (generation 2 Sleep Talk while awake,
// generation 3 Mirror Coat with nothing to reflect). Such a move gets the failure line the later code prints. From
// generation 2 Showdown records the failure (moveThisTurnResult false), so a move that works silently (Wish) is left
// alone; generation 1 records nothing, so there a move followed by nothing failed when it changed nothing either (later
// moves can work silently there: Baton Pass only asks for a switch, Mean Look traps without a word).
// Generation 9 is left as it is. Hints are not shown in the story (generation 3 First Impression after the first turn
// gives only a hint).
const QUIET_LINE = /^\|(t:|split\||debug\||-hint\||$)/;

// What a move can change without a line: switches it asks for, volatiles, side, slot and field conditions, HP
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
	if (!made) { const { error } = side.choice; side.clearChoice(); side.choice.error = error; return false; }
	if (battle.allChoicesDone()) battle.commitChoices();
	return true;
}

function choosePartsIn(side, parts) {
	return chooseEach(side, parts) && side.isChoiceDone();
}

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
			const event = ['mega', 'terastallize'].includes(words.at(-1)) ? words.pop() : '';
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
