// from pokerogue locales/{ko,en}/*.json @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-10-30. See view/LICENSE-NOTE.md.

import { readFile, writeFile } from 'node:fs/promises';
import { LANGS } from '../director/lang.js';

const keys = {
  battle: ['useMove', 'fainted', 'hitResultCriticalHit', 'hitResultSuperEffective',
    'hitResultNotVeryEffective', 'hitResultImmune', 'attackFailed', 'attackMissed',
    'regainHealth', 'statRose_one', 'statSharplyRose_one', 'statRoseDrastically_one',
    'statFell_one', 'statHarshlyFell_one', 'statSeverelyFell_one',

    'playerComeBack', 'trainerComeBack', 'playerGo', 'trainerGo', 'trainerSendOut', 'pokemonDraggedOut', 'noEscapeSwitch',

    'trainerAppeared', 'multiWildAppeared',

    'runAwaySuccess', 'runAwayCannotEscape', 'noEscapeTrainer', 'noEscapePokemon', 'noEscapeFlee', 'escapeVerbFlee',

    'trainerDefeated', 'hitResultOneHitKo', 'hitResultExtremelyEffective', 'hitResultMostlyIneffective', 'magicCoatActivated',

    'wildPokemonWithAffix', 'foePokemonWithAffix'],

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
for (const lang of LANGS) {
  const result = { _source: `from pokerogue locales/${lang} @ 7d7da4a8 (AGPL-3.0-only); locales @ 485b48eb` };
  for (const [file, selected] of Object.entries(keys)) {
    const source = JSON.parse(await readFile(new URL(`../vendor/pokerogue/locales/${lang}/${file}.json`, import.meta.url), 'utf8'));
    for (const key of selected) {
      const value = key.split('.').reduce((object, part) => object?.[part], source);
      if (typeof value !== 'string') throw new Error(`Missing locale key: ${lang}/${file}.${key}`);
      result[`${file}.${key}`] = value;
    }
  }
  await writeFile(new URL(`../director/text-${lang}.json`, import.meta.url), JSON.stringify(result, null, 2) + '\n');
  console.log(`Extracted ${Object.keys(result).length - 1} ${lang} phrases -> director/text-${lang}.json`);
}
