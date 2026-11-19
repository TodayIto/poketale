export const MAX_LEVEL = 100;

export const PARTY_MAX = 6;

export const MAX_MOVES = 4;

export const MAX_IV = 31;

export const DEBUG_STAT_MAX = 999;

export const SHINY_ODDS = 4096;

export const STATS = Object.freeze(['hp', 'atk', 'def', 'spa', 'spd', 'spe']);

export const NON_HP_STATS = Object.freeze(STATS.slice(1));

export const STATUS_IDS = Object.freeze(new Set(['', 'brn', 'par', 'slp', 'frz', 'psn', 'tox']));

export const toID = text => String(text ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');

export const learnsetOf = (levelUp, species) => levelUp?.[species.id] ?? (species.isCosmeticForme ? levelUp?.[toID(species.baseSpecies)] : undefined);

export function completeSet(dex, set, rng, { levelUp, label = set.species, tera = true } = {}) {
	const out = { ...set };
	const species = dex.species.get(out.species);
	if (!out.moves?.length) {
		if (!levelUp) throw new Error(`${label}: 기술이 없습니다 (레벨업 기술 표가 없습니다)`);
		const learnset = learnsetOf(levelUp, species);
		if (!Array.isArray(learnset)) throw new Error(`${label}: 레벨업 기술 표가 없습니다 (${species.id})`);
		out.moves = [];
		for (const [level, move] of learnset) {
			if (level > out.level) break;
			if (level < 1 || out.moves.includes(move)) continue;
			if (out.moves.length === MAX_MOVES) out.moves.shift();
			out.moves.push(move);
		}

		if (!out.moves.length) out.moves = [...new Set(learnset.filter(([level]) => level === 0).map(([, move]) => move))].slice(-MAX_MOVES);
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
	if (!out.gender) {
		if (species.gender) out.gender = species.gender === 'N' ? '' : species.gender;
		else out.gender = rng.random() < species.genderRatio.M ? 'M' : 'F';
	}
	if (out.shiny === undefined) out.shiny = rng.random(SHINY_ODDS) === 0;
	if (!out.teraType && tera) out.teraType = species.requiredTeraType || species.types[rng.random(species.types.length)];
	return out;
}

const requiredItems = species => species.requiredItems ?? (species.requiredItem ? [species.requiredItem] : []);

export const OLDER_FORM_ITEMS = Object.freeze({ 'Giratina-Origin': Object.freeze(['Griseous Orb']) });

export function formItems(dex, species, gen = null) {
	if (!gen) return [...requiredItems(species), ...(OLDER_FORM_ITEMS[species.name] ?? [])];
	const mod = dex.mod(`gen${gen}`);
	return requiredItems(mod.species.get(species.name)).filter(name => { const item = mod.items.get(name); return item.exists && item.gen <= gen; });
}

export function formItemMissing(dex, species, gen = null) {
	const written = dex.species.get(species);
	if (!gen || written.battleOnly || !requiredItems(written).length) return null;
	return formItems(dex, written, gen).length ? null : requiredItems(written)[0];
}

export const teraForm = species => !!species.battleOnly && (/(^|-)Tera$/.test(species.forme) || species.name === 'Terapagos-Stellar');

const GIMMICK_GENS = Object.freeze({ mega: Object.freeze([6, 7]), ultra: Object.freeze([7]), tera: Object.freeze([9]) });

function formGimmick(species) {
	if (species.isMega) return 'mega';
	if (species.name === 'Necrozma-Ultra') return 'ultra';
	return teraForm(species) ? 'tera' : null;
}

export function formGimmickMissing(dex, species, gen = null) {
	const gimmick = gen ? formGimmick(dex.species.get(species)) : null;
	return gimmick && !GIMMICK_GENS[gimmick].includes(gen) ? gimmick : null;
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

export function fixedTeraType(dex, species) {
	const written = dex.species.get(species);
	return written.requiredTeraType || dex.species.get(written.baseSpecies).requiredTeraType || '';
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
