export const MAX_LEVEL = 100;

export const PARTY_MAX = 6;

export const MAX_MOVES = 4;

export const MAX_IV = 31;

export const DEBUG_STAT_MAX = 999;

export const SHINY_ODDS = 4096;

export const STATS = Object.freeze(['hp', 'atk', 'def', 'spa', 'spd', 'spe']);

export const NON_HP_STATS = Object.freeze(STATS.slice(1));

// Generations 1-2 have one Special stat in place of Sp. Atk and Sp. Def
export const hasOneSpecial = gen => Number.isInteger(gen) && gen <= 2;

export const STATUS_IDS = Object.freeze(new Set(['', 'brn', 'par', 'slp', 'frz', 'psn', 'tox']));

export const toID = text => String(text ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');

// The level-up moves known at a level: the last four learned, or those learned at level 0
function levelUpMoves(learnset, level, known = () => true) {
	const moves = [];
	for (const [at, move] of learnset) {
		if (at > level) break;
		if (at < 1 || moves.includes(move) || !known(move)) continue;
		if (moves.length === MAX_MOVES) moves.shift();
		moves.push(move);
	}
	return moves.length ? moves : [...new Set(learnset.filter(([at, move]) => at === 0 && known(move)).map(([, move]) => move))].slice(-MAX_MOVES);
}

// oneSpecial: made in generation 1 or 2, so one IV is drawn for both special stats. movesUpTo: a foe in a battle of that
// generation brings only the generation's moves (owner's decision: later moves are the player's edge); a given later
// move is dropped and its slot filled from the level-up moves, and a set left with no move keeps its moves as they were
export function completeSet(dex, set, rng, { levelUp, label = set.species, tera = true, oneSpecial = false, movesUpTo = null } = {}) {
	const out = { ...set };
	const species = dex.species.get(out.species);
	const known = move => !movesUpTo || !(dex.moves.get(move).gen > movesUpTo);
	const learnset = levelUp?.[species.id];
	if (movesUpTo && out.moves?.length && !out.moves.every(known)) {
		const kept = out.moves.filter(known);
		// Moves may come by name ('Thunder') where the level-up table has ids
		const have = new Set(kept.map(toID));
		const fill = Array.isArray(learnset) ? levelUpMoves(learnset, out.level, known).filter(move => !have.has(toID(move))).reverse() : [];
		while (kept.length < Math.min(out.moves.length, MAX_MOVES) && fill.length) kept.push(fill.shift());
		if (kept.length) out.moves = kept;
	}
	if (!out.moves?.length) {
		if (!levelUp) throw new Error(`${label}: 기술이 없습니다 (레벨업 기술 표가 없습니다)`);
		if (!Array.isArray(learnset)) throw new Error(`${label}: 레벨업 기술 표가 없습니다 (${species.id})`);
		out.moves = (movesUpTo && levelUpMoves(learnset, out.level, known)) || [];
		if (!out.moves.length) out.moves = levelUpMoves(learnset, out.level);
		if (!out.moves.length) throw new Error(`${label}: 레벨 ${out.level}에 채울 레벨업 기술이 없습니다 (${species.id})`);
	}
	if (!out.ability) {
		const normal = ['0', '1'].map(k => species.abilities[k]).filter(Boolean);
		out.ability = normal[rng.random(normal.length)];
	}
	if (!out.nature) {
		const natures = dex.natures.all();
		out.nature = natures[rng.random(natures.length)].name;
	}
	out.ivs = { ...out.ivs };
	out.evs = { ...out.evs };
	const open = STATS.filter(s => out.ivs[s] === undefined);
	for (let n = Math.min(out.perfectIvs ?? 0, open.length); n > 0; n--) out.ivs[open.splice(rng.random(open.length), 1)[0]] = MAX_IV;
	delete out.perfectIvs;
	for (const s of STATS) {
		if (out.ivs[s] === undefined) out.ivs[s] = rng.random(MAX_IV + 1);
		if (out.evs[s] === undefined) out.evs[s] = 0;
	}
	// Both are still drawn so the draws after them stay the same; a given one wins over a drawn one
	if (oneSpecial && open.includes('spd')) out.ivs.spd = out.ivs.spa;
	else if (oneSpecial && open.includes('spa')) out.ivs.spa = out.ivs.spd;
	if (!out.gender) {
		if (species.gender) out.gender = species.gender === 'N' ? '' : species.gender;
		else out.gender = rng.random() < species.genderRatio.M ? 'M' : 'F';
	}
	if (out.shiny === undefined) out.shiny = rng.random(SHINY_ODDS) === 0;
	if (!out.teraType && tera) out.teraType = species.requiredTeraType || species.types[rng.random(species.types.length)];
	return out;
}

const requiredItems = species => species.requiredItems ?? (species.requiredItem ? [species.requiredItem] : []);

export function heldItemForm(dex, set) {
	const item = toID(set.item);
	const holds = form => requiredItems(form).some(name => toID(name) === item);
	const written = dex.species.get(set.species);
	if (written.battleOnly && (!requiredItems(written).length || holds(written))) return set;
	const species = written.battleOnly ? battleOnlyBase(dex, written) : written;
	const base = dex.species.get(species.baseSpecies);
	const forms = [base, ...(base.otherFormes ?? []).map(name => dex.species.get(name))].filter(form => !form.battleOnly);
	const form = (item && forms.find(holds)) || (requiredItems(species).length ? base : species);
	const out = { ...set };
	if (form.name !== written.name) {
		out.species = form.name;
		const slot = Object.keys(written.abilities).find(key => toID(written.abilities[key]) === toID(set.ability));
		if (slot) out.ability = form.abilities[slot] ?? form.abilities[0];
	}
	if (form.requiredTeraType) out.teraType = form.requiredTeraType;
	return out;
}

export const spriteIdOf = species => (species.isCosmeticForme ? `${toID(species.baseSpecies)}-${toID(species.forme)}` : species.spriteid);

export function battleOnlyBase(dex, species) {
	const base = Array.isArray(species.battleOnly) ? species.battleOnly[0] : species.battleOnly;
	return base ? dex.species.get(base) : species;
}

export function displayName(dex, names, species, nickname) {
	const sp = dex.species.get(species);
	const nick = String(nickname ?? '').trim();
	if (nick && nick !== sp.name && nick !== sp.baseSpecies) return nick;
	return names.species(battleOnlyBase(dex, sp).id);
}
