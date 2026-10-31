// from pokerogue locales/{ko,en}/*.json @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-10-30. See view/LICENSE-NOTE.md.

import { readFile, writeFile } from 'node:fs/promises';
import { LANGS } from '../director/lang.js';

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
const load = async (lang, file) => JSON.parse(await readFile(new URL(`../vendor/pokerogue/locales/${lang}/${file}.json`, import.meta.url), 'utf8'));
function flatten(into, prefix, value) {
  if (typeof value === 'string') { into[prefix] = value; return; }
  if (value && typeof value === 'object') for (const [key, inner] of Object.entries(value)) flatten(into, `${prefix}.${key}`, inner);
}

// Every string of the whole namespaces and the picked keys of one language, flattened to 'file.key.sub'
async function phrases(lang) {
  const flat = {};
  for (const file of whole) flatten(flat, file, await load(lang, file));
  for (const [file, keys] of Object.entries(picked)) {
    const source = await load(lang, file);
    for (const key of keys) {
      if (source[key] === undefined) throw new Error(`Missing locale key: ${lang}/${file}.${key}`);
      flatten(flat, `${file}.${key}`, source[key]);
    }
  }
  return flat;
}
let keys;
for (const lang of LANGS) {
  const flat = await phrases(lang);
  keys ??= Object.keys(flat);
  const missing = keys.filter(key => typeof flat[key] !== 'string');
  if (missing.length) throw new Error(`Missing ${lang} effect phrases: ${missing.join(', ')}`);
  const result = { _source: `from pokerogue locales/${lang} @ 7d7da4a8 (AGPL-3.0-only); locales @ 485b48eb` };
  for (const key of keys) result[key] = flat[key];
  await writeFile(new URL(`../director/text-effects-${lang}.json`, import.meta.url), JSON.stringify(result, null, 2) + '\n');
  console.log(`Extracted ${keys.length} ${lang} effect phrases -> director/text-effects-${lang}.json`);
}
