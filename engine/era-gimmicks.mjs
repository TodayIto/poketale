// Moves whose whole effect is a mechanic an older generation had not introduced yet: weather, terrain, abilities, held
// items and gender. A battle in such a generation disables them, the way Disable does, unless the story's setting enables
// them ('enable'); generation 9 has every mechanic and is left as it is. (Later moves whose own code older battle code
// skips are run whatever the setting: later-moves.mjs.)
import { toID } from './mon.mjs';

export const ERA_GIMMICK_MODES = Object.freeze(['disable', 'enable']);
export const DEFAULT_ERA_GIMMICKS = 'disable';

// The generation each weather a move can start came in with
const WEATHER_FROM = Object.freeze({ raindance: 2, sunnyday: 2, sandstorm: 2, hail: 3, snowscape: 9 });
const TERRAIN_FROM = 6, ABILITIES_FROM = 3, HELD_ITEMS_FROM = 2, GENDER_FROM = 2;

// Moves that only work on abilities (or on the Plus and Minus abilities)
const ABILITY_MOVES = new Set(['skillswap', 'roleplay', 'worryseed', 'simplebeam', 'entrainment', 'gastroacid', 'doodle', 'gearup', 'magneticflux']);
// Moves that only work between genders (generation 1 has none)
const GENDER_MOVES = new Set(['attract', 'captivate']);
// Moves that fail unless a weather or terrain they need is up (Aurora Veil: hail), with the generation it came in with
const NEEDS_FROM = Object.freeze({ auroraveil: 3, steelroller: TERRAIN_FROM });
// Moves that only work with a held item: throwing, swapping, giving, restoring or eating one, or hitting a target's
const HELD_ITEM_MOVES = new Set(['fling', 'naturalgift', 'trick', 'switcheroo', 'bestow', 'recycle', 'teatime', 'poltergeist', 'corrosivegas',
	'stuffcheeks', 'magicroom', 'belch']);

// The disabledSource a disabled move shows (director/index.js moveDeniedText reads it by id: 'eragimmick')
const SOURCE = Object.freeze({ name: 'Era Gimmick' });
export const ERA_GIMMICK_SOURCE = toID(SOURCE.name);

export const eraGimmickMode = value => (ERA_GIMMICK_MODES.includes(value) ? value : DEFAULT_ERA_GIMMICKS);

// true when the move's whole effect needs a mechanic generation `gen` does not have
export function eraMissing(dex, gen, moveId) {
	if (!(gen < 9)) return false;
	const move = dex.moves.get(moveId);
	if (!move?.exists) return false;
	if (move.category === 'Status' && !move.selfSwitch) {
		const from = move.weather ? WEATHER_FROM[toID(move.weather)] : null;
		if (from && gen < from) return true;
		if (move.terrain && gen < TERRAIN_FROM) return true;
	}
	if (gen < ABILITIES_FROM && ABILITY_MOVES.has(move.id)) return true;
	if (gen < HELD_ITEMS_FROM && HELD_ITEM_MOVES.has(move.id)) return true;
	if (gen < GENDER_FROM && GENDER_MOVES.has(move.id)) return true;
	if (gen < (NEEDS_FROM[move.id] ?? 0)) return true;
	return false;
}

// Moves a story's setting leaves unusable in a battle of generation `gen`
export const eraBlocked = (dex, gen, moveId, mode) => eraGimmickMode(mode) === 'disable' && eraMissing(dex, gen, moveId);

// mode is the battle spec's value when the battle is made; a copy keeps it on the battle (storyEraGimmicks)
export function installEraGimmicks(battle, mode) {
	if (mode !== undefined) battle.storyEraGimmicks = eraGimmickMode(mode);
	if (!(battle.gen < 9)) return;
	if (battle.storyEraGimmicks === 'disable') {
		battle.onEvent('DisableMove', battle.format, function (pokemon) {
			for (const slot of pokemon.moveSlots) if (eraMissing(battle.dex, battle.gen, slot.id)) pokemon.disableMove(slot.id, false, SOURCE);
		});
		return;
	}
	if (battle.gen <= 2) startOlderGimmicks(battle);
	if (battle.gen === 1) weatherPower(battle);
}

// Generation 1 battle code makes every Pokémon genderless; enabled, they keep the story's gender (Attract, Captivate).
// Runs once the teams are in
export function keepStoryGenders(battle) {
	if (battle.storyEraGimmicks !== 'enable' || !(battle.gen < GENDER_FROM)) return;
	for (const side of battle.sides) for (const pokemon of side?.pokemon ?? []) {
		const gender = pokemon.m?.start?.gender;
		if (gender === 'M' || gender === 'F') pokemon.gender = gender;
	}
}

// Enabled in generations whose own move code starts no weather (1) or no terrain (1-2): a move that only starts one
// starts it the way later generations do. Their upkeep, residual damage and terrain power already run there; a stat
// change a weather makes through a stat event (Snow's Defense in generation 1) does not.
function startOlderGimmicks(battle) {
	const { actions } = battle;
	const moveHit = actions.moveHit;
	if (moveHit.eraGimmicks) return;
	const wrapped = function (target, pokemon, move, moveData, isSecondary, isSelf) {
		const data = moveData || move;
		const weather = battle.gen < 2 && data.weather, terrain = data.terrain;
		if (isSecondary || isSelf || move.category !== 'Status' || !(weather || terrain)) return moveHit.call(this, target, pokemon, move, moveData, isSecondary, isSelf);
		const started = weather ? battle.field.setWeather(weather, pokemon, move) : battle.field.setTerrain(terrain, pokemon, move);
		// A move that also switches the user out (Chilly Reception) goes on to the move code, which asks for the switch
		if (move.selfSwitch) return moveHit.call(this, target, pokemon, move, moveData, isSecondary, isSelf);
		if (started) return undefined;
		battle.add('-fail', pokemon);
		return false;
	};
	wrapped.eraGimmicks = true;
	actions.moveHit = wrapped;
}

// Generation 1 damage has no weather step; rain and harsh sunlight change power by generation 2's rule
function weatherPower(battle) {
	battle.onEvent('BasePower', battle.format, function (basePower, attacker, defender, move) {
		const rain = battle.field.isWeather('raindance'), sun = battle.field.isWeather('sunnyday');
		if (!rain && !sun) return;
		if ((rain && move.type === 'Water') || (sun && move.type === 'Fire')) return this.chainModify(1.5);
		if ((rain && (move.type === 'Fire' || move.id === 'solarbeam')) || (sun && move.type === 'Water')) return this.chainModify(0.5);
	});
}
