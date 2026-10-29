// from pokerogue locales/ko/*.json @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-10-28. See view/LICENSE-NOTE.md.

// Extract only the phrases used by director/text.js and director/steps.js.
import { readFile, writeFile } from 'node:fs/promises';

const keys = {
  battle: ['useMove', 'fainted', 'hitResultCriticalHit', 'hitResultSuperEffective',
    'hitResultNotVeryEffective', 'hitResultImmune', 'attackFailed', 'attackMissed',
    'regainHealth', 'statRose_one', 'statSharplyRose_one', 'statRoseDrastically_one',
    'statFell_one', 'statHarshlyFell_one', 'statSeverelyFell_one',

    'playerComeBack', 'trainerComeBack', 'playerGo', 'trainerGo', 'trainerSendOut', 'pokemonDraggedOut', 'noEscapeSwitch',

    'trainerAppeared',

    'runAwaySuccess', 'runAwayCannotEscape', 'noEscapeTrainer', 'noEscapePokemon', 'noEscapeFlee', 'escapeVerbFlee',

    'trainerDefeated', 'hitResultOneHitKo', 'hitResultExtremelyEffective', 'hitResultMostlyIneffective', 'magicCoatActivated'],

  'party-ui-handler': ['noEnergy', 'hasEnergy'],
  'move-trigger': ['hitWithRecoil', 'cannotUseMove'],
  'battler-tags': ['flinchedLapse', 'rechargingLapse', 'truantLapse'],
  'ability-trigger': ['postSummonPressure', 'postSummonMoldBreaker'],
  'status-effect': ['poison.obtain', 'poison.activation', 'poison.heal',
    'toxic.obtain', 'toxic.activation', 'toxic.heal',
    'paralysis.obtain', 'paralysis.activation', 'paralysis.heal',
    'sleep.obtain', 'sleep.activation', 'sleep.heal',
    'freeze.obtain', 'freeze.activation', 'freeze.heal',
    'burn.obtain', 'burn.activation', 'burn.heal'],
};
const result = {
  _source: 'from pokerogue locales/ko @ 7d7da4a8 (AGPL-3.0-only); locales @ 485b48eb',
};
for (const [file, selected] of Object.entries(keys)) {
  const source = JSON.parse(await readFile(new URL(`../vendor/pokerogue/locales/ko/${file}.json`, import.meta.url), 'utf8'));
  for (const key of selected) {
    const value = key.split('.').reduce((object, part) => object?.[part], source);
    if (typeof value !== 'string') throw new Error(`Missing locale key: ${file}.${key}`);
    result[`${file}.${key}`] = value;
  }
}
await writeFile(new URL('../director/text-ko.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(`Extracted ${Object.keys(result).length - 1} Korean phrases -> director/text-ko.json`);
