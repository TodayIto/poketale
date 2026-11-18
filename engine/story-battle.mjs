import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import * as core from './core.mjs';
import { withPastLevelUp } from './levelup.mjs';
export { replaceMove, getLearnQueue, getEvolutions } from './exp.mjs';
const require = createRequire(import.meta.url);
const sim = require('../vendor/pokemon-showdown/dist/sim/index.js');
const readData = name => JSON.parse(readFileSync(new URL(`../data/${name}`, import.meta.url), 'utf8'));
const levelUp = withPastLevelUp(readData('levelup.json'), readData('levelup-past.json'));
const exp = readData('exp.json');

export const createStoryBattle = spec => core.createStoryBattle(sim, spec, { levelUp, exp });
export const extractResult = battle => core.extractResult(sim, battle);
