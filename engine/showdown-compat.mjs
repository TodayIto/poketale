export function injectStatus(battle, pokemon, status, { sleepTurns, freezeTurns } = {}) {
	pokemon.status = status;
	pokemon.statusState = battle.initEffectState({ id: status, target: pokemon });
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
	if (species.maxHP) stats.hp = species.maxHP;
	pokemon.baseStoredStats = stats;
	if (!pokemon.transformed) {
		for (const s of Object.keys(pokemon.storedStats)) pokemon.storedStats[s] = stats[s];
		pokemon.speed = pokemon.storedStats.spe;
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
