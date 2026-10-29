// from pokerogue locales/{ko,en}/*.json @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-10-28. See view/LICENSE-NOTE.md.

import { readFile, writeFile } from 'node:fs/promises';
import { toID } from './sources.mjs';

const json = async path => JSON.parse(await readFile(new URL(`../vendor/pokerogue/locales/${path}.json`, import.meta.url), 'utf8'));

const keys = {

  battle: ['expGain', 'levelUp', 'learnMove', 'learnMovePrompt', 'learnMoveLimitReached', 'learnMoveReplaceQuestion',
    'learnMoveStopTeaching', 'learnMoveNotLearned', 'learnMoveForgetQuestion', 'learnMoveForgetSuccess', 'countdownPoof', 'learnMoveAnd'],

  menu: ['evolving', 'stoppedEvolving', 'evolutionDone'],
};
const result = { _source: 'from pokerogue locales/ko @ 7d7da4a8 (AGPL-3.0-only); locales @ 485b48eb' };
for (const [file, selected] of Object.entries(keys)) {
  const source = await json(`ko/${file}`);
  for (const key of selected) {
    if (typeof source[key] !== 'string') throw new Error(`Missing locale key: ${file}.${key}`);
    result[`${file}.${key}`] = source[key];
  }
}
const [en, ko] = [await json('en/move'), await json('ko/move')];
let count = 0;
const zSpecial = [], missing = [];
const firstKey = {};
for (const [key, value] of Object.entries(en)) {
  const id = toID(value?.name), effect = ko[key]?.effect;
  if (!id || typeof effect !== 'string' || !effect) { missing.push(key); continue; }

  if (firstKey[id]) {
    if (key !== firstKey[id].replace(/Physical$/, 'Special')) throw new Error(`move.${id}: 영어 이름이 같은 기술 ${firstKey[id]} · ${key}`);
    zSpecial.push(key);
    continue;
  }
  firstKey[id] = key;
  result[`move.${id}`] = effect;
  count++;
}
if (missing.length) throw new Error(`영어 이름이나 한국어 설명이 없는 기술: ${missing.join(', ')}`);
await writeFile(new URL('../director/text-exp-ko.json', import.meta.url), JSON.stringify(result, null, 1) + '\n');
console.log(`Extracted ${Object.keys(keys).reduce((n, f) => n + keys[f].length, 0)} phrases + ${count} move effects -> director/text-exp-ko.json`
  + ` (Z기술 특수 칸 ${zSpecial.length}개는 물리 칸과 같은 이름이라 뺌)`);
