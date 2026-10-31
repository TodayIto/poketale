// from pokerogue locales/{ko,en}/*.json @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-10-30. See view/LICENSE-NOTE.md.

import { readFile, writeFile } from 'node:fs/promises';
import { LANGS } from '../director/lang.js';

const keys = {
  'command-ui-handler': ['fight', 'ball', 'pokemon', 'run', 'actionMessage', 'ballCancel'],
  'fight-ui-handler': ['power', 'accuracy', 'abilityFlyInText'],
  'party-ui-handler': ['choosePokemon', 'doWhatWithThisPokemon', 'sendOut', 'cancel', 'apply', 'selectAMove', 'revive', 'summary'],
  'pokemon-summary': ['pokemonInfo', 'status', 'powerAccuracyCategory', 'cancel', 'ot', 'type', 'expPoints', 'nextLv'],
  'pokemon-info': ['stat.hp', 'stat.atk', 'stat.def', 'stat.spatk', 'stat.spdef', 'stat.spd'],
  menu: ['yes', 'no', 'renamePokemon', 'nickname', 'rename', 'cancel'],
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
  await writeFile(new URL(`../view/text-${lang}.json`, import.meta.url), JSON.stringify(result, null, 2) + '\n');
  console.log(`Extracted ${Object.keys(result).length - 1} ${lang} phrases -> view/text-${lang}.json`);
}
