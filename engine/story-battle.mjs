import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import * as core from './core.mjs';
export { replaceMove, getLearnQueue, getEvolutions } from './exp.mjs';
const require = createRequire(import.meta.url);
const sim = require('../vendor/pokemon-showdown/dist/sim/index.js');
const levelUp = JSON.parse(readFileSync(new URL('../data/levelup.json', import.meta.url), 'utf8'));
const exp = JSON.parse(readFileSync(new URL('../data/exp.json', import.meta.url), 'utf8'));

export const createStoryBattle = spec => core.createStoryBattle(sim, spec, { levelUp, exp });
export const extractResult = battle => core.extractResult(sim, battle);
