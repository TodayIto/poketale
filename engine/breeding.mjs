// Egg compatibility, inheritance and hatching.
import breeding from '../data/breeding.json' with { type: 'json' };
import { completeSet, MAX_IV, MAX_MOVES, SHINY_ODDS, STATS, toID } from './mon.mjs';
import { REGIONAL_FORMES } from './evolution.mjs';

export const EGG_CHANCE = Object.freeze({ sameSpecies: [70, 50], otherSpecies: [50, 20], ditto: [50, 20] });

export const compatHearts = chance => (chance >= EGG_CHANCE.sameSpecies[0] ? 3 : chance >= EGG_CHANCE.otherSpecies[0] ? 2 : chance > 0 ? 1 : 0);

export const HATCH_FRIENDSHIP = 100;

export const EGG_SPRITE = 'egg';

const HATCH_LEVEL = 1;

export const CYCLES_PER_MESSAGE = 2;

const INCUBATORS = Object.freeze(new Set(['flamebody', 'magmaarmor', 'steamengine']));

const INHERITED_IVS = [3, 5];

const HIDDEN_ABILITY_PERCENT = 60, SAME_SLOT_PERCENT = 80;

const POWER_ITEMS = Object.freeze({ powerweight: 'hp', powerbracer: 'atk', powerbelt: 'def', powerlens: 'spa', powerband: 'spd', poweranklet: 'spe' });

const UNINHERITED_BALLS = new Set(['masterball', 'cherishball']);
const EGG_BALL = 'pokeball';

const INCENSE_NEEDED = false;
const INCENSE = Object.freeze({ wynaut: 'laxincense', azurill: 'seaincense', munchlax: 'fullincense', happiny: 'luckincense', mimejr: 'oddincense',
	chingling: 'pureincense', bonsly: 'rockincense', budew: 'roseincense', mantyke: 'waveincense' });

const PAIRED = Object.freeze({ nidoranf: 'Nidoran-M', nidoranm: 'Nidoran-F', illumise: 'Volbeat', volbeat: 'Illumise' });

const HATCHES_AS = Object.freeze({ manaphy: 'Phione' });

const NO_EGGS = 'Undiscovered', DITTO = 'Ditto';

export const eggGroupsOf = species => breeding.eggGroups[species.id] ?? species.eggGroups;
const isDitto = species => eggGroupsOf(species).includes(DITTO);

export const eggCycles = (dex, species) => breeding.cycles[dex.species.get(species).num] ?? breeding.cycles[1];

export const hatchSpeed = abilities => CYCLES_PER_MESSAGE * (abilities.some(a => INCUBATORS.has(toID(a))) ? 2 : 1);

export function eggChance(dex, a, b) {
	const sa = dex.species.get(a.species), sb = dex.species.get(b.species);
	const no = reason => ({ chance: 0, reason });
	const ga = eggGroupsOf(sa), gb = eggGroupsOf(sb);
	if (ga.includes(NO_EGGS) || gb.includes(NO_EGGS)) return no('noEggs');
	const sameOt = String(a.ot ?? '').trim() === String(b.ot ?? '').trim() ? 1 : 0;
	if (isDitto(sa) && isDitto(sb)) return no('twoDitto');
	if (isDitto(sa) || isDitto(sb)) return { chance: EGG_CHANCE.ditto[sameOt], reason: null };
	if (!a.gender || !b.gender) return no('genderless');
	if (a.gender === b.gender) return no('sameGender');
	if (!ga.some(g => gb.includes(g))) return no('eggGroup');
	return { chance: (sa.num === sb.num ? EGG_CHANCE.sameSpecies : EGG_CHANCE.otherSpecies)[sameOt], reason: null };
}

function roles(dex, a, b) {
	const ditto = p => isDitto(dex.species.get(p.set.species));
	if (a.set.gender === 'F') return [a, b];
	if (b.set.gender === 'F') return [b, a];
	return ditto(a) ? [b, a] : [a, b];
}

export function lowestStage(dex, name) {
	let s = dex.species.get(name);
	if (s.changesFrom) s = dex.species.get(s.changesFrom);
	while (s.prevo) s = dex.species.get(s.prevo);
	if (s.forme === 'F' || s.forme === 'M') s = dex.species.get(s.baseSpecies);
	return s;
}

const regionOfForm = ({ forme }) => (forme === 'White-Striped' ? 'Hisui' : [...REGIONAL_FORMES].find(r => forme === r || forme.startsWith(`${r}-`)) ?? '');

function eggForm(dex, line, other) {
	const base = lowestStage(dex, line.set.species);
	const holder = [line, other].find(p => toID(p.set.item) === 'everstone' && lowestStage(dex, p.set.species).num === base.num);
	const theirs = holder && lowestStage(dex, holder.set.species);
	return theirs && regionOfForm(theirs) !== regionOfForm(base) ? theirs : base;
}

function hatchling(dex, base, held, rng) {
	let s = base;
	if (INCENSE_NEEDED && INCENSE[s.id] && !held.includes(INCENSE[s.id])) s = dex.species.get(s.evos[0]);
	if (HATCHES_AS[s.id]) s = dex.species.get(HATCHES_AS[s.id]);
	if (PAIRED[s.id] && rng.random(2)) s = dex.species.get(PAIRED[s.id]);

	const female = dex.species.get(`${s.name}-F`);
	if (female.exists && female.gender === 'F' && s.gender === 'M') return rng.random(2) ? { species: female, gender: 'F' } : { species: s, gender: 'M' };
	return { species: s, gender: null };
}

const ivOf = (parent, stat) => parent.hyper?.[stat] ?? parent.set.ivs?.[stat] ?? MAX_IV;

const natureOf = parent => parent.natureOrig ?? parent.set.nature;

function inheritIvs(a, b, rng) {
	const ivs = {};
	const held = [a, b].map(p => toID(p.set.item));
	let left = INHERITED_IVS[held.includes('destinyknot') ? 1 : 0];
	const open = [...STATS];
	const take = (stat, parent) => { ivs[stat] = ivOf(parent, stat); open.splice(open.indexOf(stat), 1); left--; };
	const powered = [a, b].filter(p => POWER_ITEMS[toID(p.set.item)]);
	if (powered.length) {
		const parent = powered[rng.random(powered.length)];
		take(POWER_ITEMS[toID(parent.set.item)], parent);
	}
	while (left > 0) take(open[rng.random(open.length)], rng.random(2) ? a : b);
	return ivs;
}

function inheritNature(a, b, rng) {
	const holders = [a, b].filter(p => toID(p.set.item) === 'everstone');
	return holders.length ? natureOf(holders[rng.random(holders.length)]) : undefined;
}

function inheritAbility(dex, line, species, rng) {
	const from = dex.species.get(line.set.species);
	const slot = Object.keys(from.abilities).find(k => toID(from.abilities[k]) === toID(line.set.ability)) ?? '0';
	const normal = ['0', '1'].filter(k => species.abilities[k]);
	if (slot === 'H' && species.abilities.H && rng.random(100) < HIDDEN_ABILITY_PERCENT) return species.abilities.H;
	if (slot === 'H') return species.abilities[normal[rng.random(normal.length)]];
	const same = species.abilities[slot] ? slot : '0';
	const other = normal.find(k => k !== same);
	return species.abilities[other && rng.random(100) >= SAME_SLOT_PERCENT ? other : same];
}

function inheritBall(dex, line, other, rng) {
	const sameSpecies = dex.species.get(line.set.species).num === dex.species.get(other.set.species).num;
	const ball = toID((sameSpecies && rng.random(2) ? other : line).ball || EGG_BALL);
	return UNINHERITED_BALLS.has(ball) ? EGG_BALL : ball;
}

export function eggMovesOf(dex, name) {
	const s = dex.species.get(name);
	return breeding.eggMoves[s.id] ?? breeding.eggMoves[lowestStage(dex, s.name).id] ?? [];
}

const levelMoves = (levelUp, species) => new Set((levelUp?.[species.id] ?? []).map(([, move]) => move));

function pushMoves(moves, more) {
	for (const move of more) {
		if (moves.includes(move)) continue;
		if (moves.length >= MAX_MOVES) moves.shift();
		moves.push(move);
	}
	return moves;
}

export function breedEgg(dex, a, b, rng, { levelUp }) {
	const [line, other] = roles(dex, a, b);
	const held = [a, b].map(p => toID(p.set.item));
	const { species, gender } = hatchling(dex, eggForm(dex, line, other), held, rng);
	const nature = inheritNature(a, b, rng);
	const set = completeSet(dex, {
		species: species.name, level: HATCH_LEVEL, ivs: inheritIvs(a, b, rng), ability: inheritAbility(dex, line, species, rng), shiny: rng.random(SHINY_ODDS) === 0,
		...(gender ? { gender } : {}), ...(nature ? { nature } : {}),
	}, rng, { levelUp });
	const learns = levelMoves(levelUp, species), eggMoves = new Set(eggMovesOf(dex, species.name));
	const knows = p => (p.set.moves ?? []).map(toID);
	const [mother, father] = line.set.gender === 'F' ? [line, other] : [other, line];
	const shared = knows(a).filter(m => learns.has(m) && knows(b).includes(m));
	const passed = [...knows(father), ...knows(mother)].filter(m => eggMoves.has(m));
	const volt = species.id === 'pichu' && held.includes('lightball') ? ['volttackle'] : [];
	set.moves = pushMoves([...set.moves], [...shared, ...passed, ...volt]);
	return { set, ball: inheritBall(dex, line, other, rng) };
}

export function giftEgg(dex, name, rng, { levelUp }) {
	const species = dex.species.get(name);
	const set = completeSet(dex, { species: species.name, level: HATCH_LEVEL }, rng, { levelUp });
	const eggMoves = eggMovesOf(dex, species.name).filter(m => !set.moves.includes(m));
	if (eggMoves.length) set.moves = pushMoves([...set.moves], [eggMoves[rng.random(eggMoves.length)]]);
	return set;
}
