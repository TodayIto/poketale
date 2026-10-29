import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import * as bag from './bag.mjs';
const require = createRequire(import.meta.url);
const sim = require('../vendor/pokemon-showdown/dist/sim/index.js');
export const catchRates = JSON.parse(readFileSync(new URL('../data/catch-rates.json', import.meta.url), 'utf8'));

export const installBag = (battle, options = {}) => bag.installBag(sim, battle, { catchRates, ...options });
export const { checkBagItem, chooseBagItem, BAG_ITEMS, isBall } = bag;
