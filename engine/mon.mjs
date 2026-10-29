export const MAX_LEVEL = 100;

export const PARTY_MAX = 6;

export const MAX_MOVES = 4;

export const MAX_IV = 31;

export const SHINY_ODDS = 4096;

export const STATS = Object.freeze(['hp', 'atk', 'def', 'spa', 'spd', 'spe']);

export const NON_HP_STATS = Object.freeze(STATS.slice(1));

export const STATUS_IDS = Object.freeze(new Set(['', 'brn', 'par', 'slp', 'frz', 'psn', 'tox']));

export const REGIONAL_FORMES = Object.freeze(new Set(['Alola', 'Galar', 'Hisui', 'Paldea']));

export const toID = text => String(text ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');

export function completeSet(dex, set, rng, { levelUp, label = set.species } = {}) {
	const out = { ...set };
	const species = dex.species.get(out.species);
	if (!out.moves?.length) {
		if (!levelUp) throw new Error(`${label}: 기술이 없습니다 (레벨업 기술 표가 없습니다)`);
		const learnset = levelUp[species.id];
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
	for (const s of STATS) {
		if (out.ivs[s] === undefined) out.ivs[s] = rng.random(MAX_IV + 1);
		if (out.evs[s] === undefined) out.evs[s] = 0;
	}
	if (!out.gender) {
		if (species.gender) out.gender = species.gender === 'N' ? '' : species.gender;
		else out.gender = rng.random() < species.genderRatio.M ? 'M' : 'F';
	}
	if (out.shiny === undefined) out.shiny = rng.random(SHINY_ODDS) === 0;
	if (!out.teraType) out.teraType = species.requiredTeraType || species.types[rng.random(species.types.length)];
	return out;
}

// Gender-specific evolutions (female-only Vespiquen, male Meowstic etc.) require the same gender
export const genderAllows = (gender, target) => !(target.gender === 'M' || target.gender === 'F') || gender === target.gender;

export const isLevelEvolution = (target, level) => !target.evoType && !!target.evoLevel && !target.evoCondition && !target.evoRegion && target.evoLevel <= level;

// Evolution into another region's form (only in that region)
export const isForeignRegional = (target, species) => REGIONAL_FORMES.has(target.forme) && target.forme !== species.forme;

export const holdsEverstone = item => toID(item) === 'everstone';

export function evolutionTargets(dex, { species: name, gender }, how) {
	const species = dex.species.get(name);
	const ready = species.evos.map(id => dex.species.get(id))
		.filter(t => how(t) && genderAllows(gender, t) && !isForeignRegional(t, species));
	if (ready.length > 1 && species.forme && ready.some(t => t.forme === species.forme)) return ready.filter(t => t.forme === species.forme);
	return ready;
}

export function levelEvolution(dex, mon, level) {
	if (holdsEverstone(mon.item)) return null;
	const ready = evolutionTargets(dex, mon, t => isLevelEvolution(t, level));
	return ready.length === 1 ? ready[0].name : null;
}

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
