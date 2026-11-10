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

export const EXTENSIONS = [

	{ name: 'line-tags', at: 'create', install: (sim, battle) => attachLineTags(battle), keys: ['storyLogMeta'], copy: 'strip' },

	{ name: 'rules', at: 'create', install: applyFormatRules, keys: [], copy: 'reapply' },
	{ name: 'winner', at: 'create', install: (sim, battle) => installWinner(battle), keys: ['storyWinner'], copy: 'keep',
		fields: ['outcome', 'winner'], result: winnerResult },

	{ name: 'initial-state', at: 'create', install: (sim, battle, { seats }) => installInitialState(sim, battle, seats), keys: [], copy: 'keep' },

	{ name: 'field', at: 'create', install: (sim, battle, { spec }) => installField(sim, battle, spec), keys: [], copy: 'keep' },

	{ name: 'seats', at: 'create', install: (sim, battle, { seats }) => {
		if (seats ? seats.p2.team.some(member => member.trainer) : battle.sides.some(side => side?.pokemon.some(p => p.m.trainer))) installSeats(battle);
	}, keys: [], copy: 'reapply' },

	{ name: 'start-form', at: 'players', install: (sim, battle, { sets }) => recordStartForms(battle, sets), keys: [], copy: 'keep' },

	{ name: 'waiting', at: 'players', install: (sim, battle, { sets }) => { if (sets.waiting) battle.storyWaiting = sets.waiting; }, keys: ['storyWaiting'], copy: 'strip' },

	{ name: 'friendship', at: 'players', install: (sim, battle, { spec, options }) => { if (options.exp) installFriendship(sim, battle, spec, options); },
		keys: ['events'], copy: 'strip' },

	{ name: 'counts', at: 'players', install: (sim, battle, { spec, options }) => { if (options.exp) installCounts(sim, battle, spec); }, keys: ['events'], copy: 'strip' },

	{ name: 'exp', at: 'players', install: (sim, battle, { spec, options }) => { if (options.exp) attachExperience(sim, battle, spec, options); },
		keys: ['events'], copy: 'strip', fields: ['evolutions', 'learnQueue'], result: experienceResult },

	{ name: 'bag', at: 'caller', install: installBag, keys: ['storyBag', 'storyEnemyItem', 'events'], copy: 'strip',
		fields: ['itemsUsed', 'captured'], result: bagResult },

	{ name: 'run', at: 'caller', install: installRun, keys: ['storyRun', 'events'], copy: 'strip',
		fields: ['ran', 'outcome', 'winner', 'forfeited'], result: runResult },
];

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
