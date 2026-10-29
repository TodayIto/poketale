// from pokerogue locales/ko/*.json @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-10-28. See view/LICENSE-NOTE.md.

import { readFile, writeFile } from 'node:fs/promises';

const whole = ['battler-tags', 'arena-tag', 'weather', 'terrain', 'ability-trigger', 'modifier', 'move-trigger', 'pokemon-form-battle', 'status-effect'];
const picked = {
  battle: ['statWontGoAnyHigher_one', 'statWontGoAnyLower_one', 'attackHitsCount', 'drainMessage', 'hpHealBerry',
    'turnEndHpRestore', 'hitResultNoEffect', 'moveNoPp', 'moveDisabledHealBlock', 'moveDisabledImprison',
    'moveDisabledGravity', 'moveDisabledTorment', 'disableInterruptedMove', 'throatChopInterruptedMove', 'notDisabled', 'hpIsFull',
    'statRose_one', 'statSharplyRose_one', 'statRoseDrastically_one', 'statFell_one', 'statHarshlyFell_one', 'statSeverelyFell_one',
    'pokemonTerastallized', 'stealEatBerry', 'ppReduced', 'attackFailed',
    'ppHealBerry',

    'moveDisabled', 'moveCannotBeSelected', 'canOnlyUseMove', 'moveDisabledBelch', 'moveDisabledNoBerry', 'moveDisabledConsecutive'],
  'fight-ui-handler': ['abilityFlyInText'],
  'pokemon-info': ['type', 'stat'],
};
const result = { _source: 'from pokerogue locales/ko @ 7d7da4a8 (AGPL-3.0-only); locales @ 485b48eb' };
const load = async file => JSON.parse(await readFile(new URL(`../vendor/pokerogue/locales/ko/${file}.json`, import.meta.url), 'utf8'));
function flatten(prefix, value) {
  if (typeof value === 'string') { result[prefix] = value; return; }
  if (value && typeof value === 'object') for (const [key, inner] of Object.entries(value)) flatten(`${prefix}.${key}`, inner);
}
for (const file of whole) flatten(file, await load(file));
for (const [file, keys] of Object.entries(picked)) {
  const source = await load(file);
  for (const key of keys) {
    if (source[key] === undefined) throw new Error(`Missing locale key: ${file}.${key}`);
    flatten(`${file}.${key}`, source[key]);
  }
}
await writeFile(new URL('../director/text-effects-ko.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(`Extracted ${Object.keys(result).length - 1} Korean effect phrases -> director/text-effects-ko.json`);
