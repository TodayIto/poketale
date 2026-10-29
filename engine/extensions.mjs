import { attachLineTags } from './line-tags.mjs';
import { applyFormatRules } from './rules.mjs';
import { installWinner, winnerResult } from './winner.mjs';
import { installInitialState, recordStartForms } from './initial-state.mjs';
import { attachExperience, experienceResult } from './exp.mjs';
import { installBag, bagResult } from './bag.mjs';
import { installRun, runResult } from './run.mjs';

export const EXTENSIONS = [

	{ name: 'line-tags', at: 'create', install: (sim, battle) => attachLineTags(battle), keys: ['storyLogMeta'], copy: 'strip' },

	{ name: 'rules', at: 'create', install: applyFormatRules, keys: [], copy: 'reapply' },
	{ name: 'winner', at: 'create', install: (sim, battle) => installWinner(battle), keys: ['storyWinner'], copy: 'keep',
		fields: ['outcome', 'winner'], result: winnerResult },

	{ name: 'initial-state', at: 'create', install: (sim, battle, { spec }) => installInitialState(sim, battle, spec), keys: [], copy: 'keep' },

	{ name: 'start-form', at: 'players', install: recordStartForms, keys: [], copy: 'keep' },

	{ name: 'exp', at: 'players', install: (sim, battle, { spec, options }) => { if (options.exp) attachExperience(sim, battle, spec, options); },
		keys: ['events'], copy: 'strip', fields: ['evolutions', 'learnQueue'], result: experienceResult },

	{ name: 'bag', at: 'caller', install: installBag, keys: ['storyBag', 'storyEnemyItem', 'events'], copy: 'strip',
		fields: ['itemsUsed', 'captured'], result: bagResult },

	{ name: 'run', at: 'caller', install: installRun, keys: ['storyRun', 'events'], copy: 'strip',
		fields: ['ran', 'outcome', 'winner', 'forfeited'], result: runResult },
];

// Called by createStoryBattle: extensions with the given `at`, in table order
export function installExtensions(sim, battle, at, context) {
	for (const ext of EXTENSIONS) if (ext.at === at) ext.install(sim, battle, context);
}

export const COPY_STRIP_KEYS = [...new Set(EXTENSIONS.filter(ext => ext.copy === 'strip').flatMap(ext => ext.keys))];

export function installOnCopy(sim, copy) {
	for (const ext of EXTENSIONS) if (ext.copy === 'reapply') ext.install(sim, copy, {});
}

export function extensionResults(battle) {
	const result = {};
	for (const ext of EXTENSIONS) if (ext.result) Object.assign(result, ext.result(battle));
	return result;
}
