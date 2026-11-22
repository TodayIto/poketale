import { genHas } from './generation.mjs';

/** level 1-100 */
export const MAX_LEVEL = 100;

export const PARTY_MAX = 6;
/** at most four moves */
export const MAX_MOVES = 4;
/** IVs 0-31 */
export const MAX_IV = 31;

export const DEBUG_STAT_MAX = 999;
/** shiny odds 1/4096 */
export const SHINY_ODDS = 4096;
/** the six stats (Showdown id order) */
export const STATS = Object.freeze(['hp', 'atk', 'def', 'spa', 'spd', 'spe']);
/** the five non-HP stats (fields of the engine's storedStats) */
export const NON_HP_STATS = Object.freeze(STATS.slice(1));

export const hasOneSpecial = gen => Number.isInteger(gen) && gen <= 2;

export const STATUS_IDS = Object.freeze(new Set(['', 'brn', 'par', 'slp', 'frz', 'psn', 'tox']));

export const toID = text => String(text ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');

// -- Filling empty fields ----------------------------------

export const learnsetOf = (levelUp, species) => levelUp?.[species.id] ?? (species.isCosmeticForme ? levelUp?.[toID(species.baseSpecies)] : undefined);

export function inGen(dex, kind, name, gen) {
	const entry = dex.mod(`gen${gen}`)[kind].get(name);
	return !!entry?.exists && entry.gen <= gen;
}

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

export function completeSet(dex, set, rng, { levelUp, label = set.species, tera = true, oneSpecial = false, movesUpTo = null } = {}) {
	const out = { ...set };
	const species = dex.species.get(out.species);
	const known = move => !movesUpTo || inGen(dex, 'moves', move, movesUpTo);
	const learnset = learnsetOf(levelUp, species);
	if (movesUpTo && out.moves?.length && !out.moves.every(known)) {
		const kept = out.moves.filter(known);
		// moves may come by name ('Thunder') where the level-up table has ids
		const have = new Set(kept.map(toID));
		const fill = Array.isArray(learnset) ? levelUpMoves(learnset, out.level, known).filter(move => !have.has(toID(move))).reverse() : [];
		while (kept.length < Math.min(out.moves.length, MAX_MOVES) && fill.length) kept.push(fill.shift());
		if (kept.length) out.moves = kept;
	}
	if (!out.moves?.length) {
		if (!levelUp) throw new Error(`${label}: 기술이 없습니다 (레벨업 기술 표가 없습니다)`);
		if (!Array.isArray(learnset)) throw new Error(`${label}: 레벨업 기술 표가 없습니다 (${species.id})`);
		out.moves = movesUpTo ? levelUpMoves(learnset, out.level, known) : [];
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

// -- Held-item forms ---------------------------------------

const requiredItems = species => species.requiredItems ?? (species.requiredItem ? [species.requiredItem] : []);

export const OLDER_FORM_ITEMS = Object.freeze({ 'Giratina-Origin': Object.freeze(['Griseous Orb']) });

export function formItems(dex, species, gen = null) {
	if (!gen) return [...requiredItems(species), ...(OLDER_FORM_ITEMS[species.name] ?? [])];
	return requiredItems(dex.mod(`gen${gen}`).species.get(species.name)).filter(name => inGen(dex, 'items', name, gen));
}

export function formItemMissing(dex, species, gen = null) {
	const written = dex.species.get(species);
	if (!gen || written.battleOnly || !requiredItems(written).length) return null;
	return formItems(dex, written, gen).length ? null : requiredItems(written)[0];
}

export const teraForm = species => !!species.battleOnly && (/(^|-)Tera$/.test(species.forme) || species.name === 'Terapagos-Stellar');

function formGimmick(species) {
	if (species.isMega) return 'mega';
	if (species.name === 'Necrozma-Ultra') return 'ultra';
	return teraForm(species) ? 'tera' : null;
}

export function formGimmickMissing(dex, species, gen = null) {
	const gimmick = gen ? formGimmick(dex.species.get(species)) : null;
	return gimmick && !genHas(gen, gimmick) ? gimmick : null;
}

const engineMade = species => species.isPrimal || species.forme === 'Crowned';

export function heldItemForm(dex, set, { own = true, gen = null, status = '', writtenForms = true } = {}) {
	if (!writtenForms) return itemNeededForm(dex, set);
	const item = toID(set.item);
	const holds = form => formItems(dex, form, gen).some(name => toID(name) === item);
	const written = dex.species.get(set.species);
	const out = { ...set };
	let species = written;
	if (status === 'frz' && written.name === 'Shaymin-Sky') species = dex.species.get('Shaymin');
	if (species.name === 'Terapagos-Terastal' || formGimmickMissing(dex, species, gen)) species = battleOnlyBase(dex, species);
	if (species.battleOnly) {
		const needs = requiredItems(species);
		if (needs.length && !holds(species) && !own) out.item = needs[0];
		return asForm(out, written, engineMade(species) && (holds(species) || !own) ? battleOnlyBase(dex, species) : species);
	}
	const base = dex.species.get(species.baseSpecies);
	const forms = [base, ...(base.otherFormes ?? []).map(name => dex.species.get(name))].filter(form => !form.battleOnly);
	const byMove = forms.find(form => form.requiredMove);
	if (byMove) return asForm(out, written, (set.moves ?? []).some(move => toID(move) === toID(byMove.requiredMove)) ? byMove : base);
	const byItem = item && forms.find(holds);
	if (byItem) return asForm(out, written, byItem);
	if (!requiredItems(species).length) return asForm(out, written, species);
	const made = formItems(dex, species, gen);
	if (!made.length) return asForm(out, written, base);
	if (!own) out.item = made[0];
	return asForm(out, written, species);
}

function itemNeededForm(dex, set) {
	const item = toID(set.item);
	const holds = form => requiredItems(form).some(name => toID(name) === item);
	const written = dex.species.get(set.species);
	if (written.battleOnly && (!requiredItems(written).length || holds(written))) return set;
	const species = written.battleOnly ? battleOnlyBase(dex, written) : written;
	const base = dex.species.get(species.baseSpecies);
	const forms = [base, ...(base.otherFormes ?? []).map(name => dex.species.get(name))].filter(form => !form.battleOnly);
	return asForm({ ...set }, written, (item && forms.find(holds)) || (requiredItems(species).length ? base : species));
}

function asForm(out, written, form) {
	if (form.name !== written.name) {
		out.species = form.name;
		const slot = Object.keys(written.abilities).find(key => toID(written.abilities[key]) === toID(out.ability));
		if (slot) out.ability = form.abilities[slot] ?? form.abilities[0];
	}
	if (form.requiredTeraType) out.teraType = form.requiredTeraType;
	return out;
}

export function gmaxFactor(dex, set) {
	const species = dex.species.get(set.species);
	if (!species.forme?.endsWith('Gmax') || !species.changesFrom) return set;
	return { ...set, species: dex.species.get(species.changesFrom).name, gigantamax: true };
}

export function gmaxOf(dex, set) {
	const factored = gmaxFactor(dex, set);
	return { species: dex.species.get(factored.species), has: factored.gigantamax === true };
}

export const takesMaxSoup = species => !!species.canGigantamax && species.name !== 'Melmetal';

export const DYNAMAX_LEVEL_MAX = 10;

const PLAYER_DYNAMAX_LEVEL = 0;

export const foeDynamaxLevel = level => Math.min(5, Math.max(1, Math.ceil(level / 20)));

export function withDynamaxLevel(set, player) {
	if (typeof set.dynamaxLevel === 'number') return set;
	return { ...set, dynamaxLevel: player ? PLAYER_DYNAMAX_LEVEL : foeDynamaxLevel(set.level) };
}

export const autoTeraType = (species, key = '') => {
	if (!species?.exists) return '';
	if (species.requiredTeraType) return species.requiredTeraType;
	const { types } = species;
	return types[keyIndex(String(key), types.length)];
};
/** A string -> 0 .. n-1, the same every time (FNV-1a 32-bit) */
function keyIndex(key, n) {
	let h = 0x811c9dc5;
	for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 0x01000193) >>> 0;
	return h % n;
}

export function fixedTeraType(dex, species) {
	const written = dex.species.get(species);
	return written.requiredTeraType || dex.species.get(written.baseSpecies).requiredTeraType || '';
}

// -- Pictures ----------------------------------------------

export const spriteIdOf = species => (species.isCosmeticForme ? `${toID(species.baseSpecies)}-${toID(species.forme)}` : species.spriteid);

// -- Display names -----------------------------------------

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
