import { attachLineTags } from './line-tags.mjs';
import { applyFormatRules } from './rules.mjs';
import { installWinner, winnerResult } from './winner.mjs';
import { installInitialState, recordStartForms } from './initial-state.mjs';
import { attachExperience, experienceResult } from './exp.mjs';
import { installBag, bagResult } from './bag.mjs';
import { installRun, runResult } from './run.mjs';
import { installSeats } from './seats.mjs';
import { installField } from './field.mjs';
import { installFriendship } from './friendship.mjs';
import { installCounts } from './counts.mjs';
import { installUsedMoves } from './used-moves.mjs';
import { allowRayquazaMega, blockZMoves, blockUltraBurst, blockMegaEvo, blockTerastallize, allowDynamax, crownMoves, keepFormTypes, keepFormOnSwitch, startedGimmicks, sayQuietFailures } from './showdown-compat.mjs';
import { installEraGimmicks, keepStoryGenders } from './era-gimmicks.mjs';
import { runLaterMoves } from './later-moves.mjs';
import { formItems, teraForm, toID } from './mon.mjs';
import { genHas, ruleGen, battleRuleGen, generationOf } from './generation.mjs';

export const EXTENSIONS = [

	{ name: 'line-tags', at: 'create', install: (sim, battle) => attachLineTags(battle), keys: ['storyLogMeta'], copy: 'strip' },

	{ name: 'rules', at: 'create', install: applyFormatRules, keys: [], copy: 'reapply' },

	{ name: 'gen-gimmicks', at: 'create', install: (sim, battle, { spec }) => {
		if (spec) {
			const gen = ruleGen(spec);
			if (gen != null) battle.storyRuleGen = gen;
		}
		const gen = battleRuleGen(battle);
		if (gen == null) return;
		if (!genHas(gen, 'mega')) blockMegaEvo(battle);
		if (!genHas(gen, 'z')) blockZMoves(battle);
		if (!genHas(gen, 'ultra')) blockUltraBurst(battle);
		if (!genHas(gen, 'tera')) blockTerastallize(battle);
	}, keys: ['storyRuleGen'], copy: 'reapply' },

	{ name: 'rayquaza-mega', at: 'create', install: (sim, battle) => { if (battle.gen === 9 && genHas(battleRuleGen(battle), 'mega')) allowRayquazaMega(battle); }, keys: [], copy: 'reapply' },

	{ name: 'dynamax', at: 'create', install: (sim, battle) => {
		if (battle.gen >= 8 && genHas(battleRuleGen(battle), 'dynamax')) allowDynamax(battle);
	}, keys: [], copy: 'reapply' },

	{ name: 'quiet-failures', at: 'create', install: (sim, battle) => sayQuietFailures(battle), keys: [], copy: 'reapply' },

	{ name: 'later-moves', at: 'create', install: (sim, battle) => runLaterMoves(battle), keys: [], copy: 'reapply' },

	{ name: 'era-gimmicks', at: 'create', install: (sim, battle, { spec }) => installEraGimmicks(battle, spec), keys: ['storyEraGimmicks'], copy: 'reapply' },

	{ name: 'used-moves', at: 'create', install: (sim, battle) => installUsedMoves(battle), keys: [], copy: 'keep' },
	{ name: 'winner', at: 'create', install: (sim, battle) => installWinner(battle), keys: ['storyWinner'], copy: 'keep',
		fields: ['outcome', 'winner'], result: winnerResult },

	{ name: 'initial-state', at: 'create', install: (sim, battle, { seats, sets }) => installInitialState(sim, battle, seats, sets), keys: [], copy: 'keep' },

	{ name: 'written-forms', at: 'create', install: (sim, battle, { spec }) => {
		if (!spec?.writtenForms) return;
		battle.storyWrittenForms = true;
		atBattleStart(battle, () => { startedGimmicks(battle, teraForm); crownMoves(battle); });
	}, keys: [], copy: 'keep' },

	{ name: 'field', at: 'create', install: (sim, battle, { spec }) => installField(sim, battle, spec), keys: [], copy: 'keep' },

	{ name: 'seats', at: 'create', install: (sim, battle, { seats }) => {
		if (seats ? seats.p2.team.some(member => member.trainer) : battle.sides.some(side => side?.pokemon.some(p => p.m.trainer))) installSeats(battle);
	}, keys: [], copy: 'reapply' },

	{ name: 'gen4-forms', at: 'create', install: (sim, battle, { spec }) => {
		if (battle.gen === 4 && (!spec || spec.writtenForms)) keepFormOnSwitch(battle, pokemon => pokemon.side.n === 0 && lacksFormItem(sim, pokemon, 4));
	}, keys: [], copy: 'reapply' },
	{ name: 'forms-without-item', at: 'players', install: (sim, battle, { spec }) => {
		if (spec?.writtenForms) markFormsWithoutItem(sim, battle, generationOf(ruleGen(spec)));
		keepFormTypes(battle);
	}, keys: [], copy: 'reapply' },

	{ name: 'start-form', at: 'players', install: (sim, battle, { sets, whole }) => recordStartForms(battle, sets, whole), keys: [], copy: 'keep' },

	{ name: 'era-genders', at: 'players', install: (sim, battle) => keepStoryGenders(battle), keys: [], copy: 'keep' },

	{ name: 'waiting', at: 'players', install: (sim, battle, { sets }) => { if (sets.waiting) battle.storyWaiting = sets.waiting; }, keys: ['storyWaiting'], copy: 'strip' },

	{ name: 'friendship', at: 'players', install: (sim, battle, { spec, options }) => { if (options.exp) installFriendship(sim, battle, spec, options); },
		keys: ['events'], copy: 'strip' },

	{ name: 'counts', at: 'players', install: (sim, battle, { spec, options }) => { if (options.exp) installCounts(sim, battle, spec); }, keys: ['events'], copy: 'strip' },

	{ name: 'exp', at: 'players', install: (sim, battle, { spec, options }) => { if (options.exp) attachExperience(sim, battle, spec, options); },
		keys: ['events'], copy: 'strip', fields: ['evolutions', 'learnQueue'], result: experienceResult },

	{ name: 'bag', at: 'caller', install: installBag, keys: ['storyBag', 'storyEnemyItem', 'events'], copy: 'strip',
		fields: ['itemsUsed', 'captured'], result: bagResult },
	// running and forfeit
	{ name: 'run', at: 'caller', install: installRun, keys: ['storyRun', 'events'], copy: 'strip',
		fields: ['ran', 'outcome', 'winner', 'forfeited'], result: runResult },
];

function atBattleStart(battle, fn) {
	const baseFormat = battle.format;
	battle.format = Object.create(baseFormat, { onBattleStart: { value() { fn(); baseFormat.onBattleStart?.call(this); } } });
}

function markFormsWithoutItem(sim, battle, gen) {
	for (const pokemon of battle.sides[0]?.pokemon ?? []) if (lacksFormItem(sim, pokemon, gen)) pokemon.m.formWithoutItem = true;
}

function lacksFormItem(sim, pokemon, gen) {
	const items = formItems(sim.Dex, pokemon.species, gen);
	return items.length > 0 && !items.some(name => toID(name) === pokemon.item);
}

export function installExtensions(sim, battle, at, context) {
	for (const ext of EXTENSIONS) if (ext.at === at) ext.install(sim, battle, context);
}

/** Fields removed while serializing an AI copy */
export const COPY_STRIP_KEYS = [...new Set(EXTENSIONS.filter(ext => ext.copy === 'strip').flatMap(ext => ext.keys))];

/** Extensions re-attached to a restored AI copy */
export function installOnCopy(sim, copy) {
	for (const ext of EXTENSIONS) if (ext.copy === 'reapply') ext.install(sim, copy, {});
}

/** Extension results merged into extractResult (in table order) */
export function extensionResults(battle) {
	const result = {};
	for (const ext of EXTENSIONS) if (ext.result) Object.assign(result, ext.result(battle));
	return result;
}
