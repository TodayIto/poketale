// from pokerogue locales/{ko,en}/*.json @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-10-30. See view/LICENSE-NOTE.md.

import { readFile, writeFile } from 'node:fs/promises';
import { toID } from './sources.mjs';
import { LANGS } from '../director/lang.js';

const json = async path => JSON.parse(await readFile(new URL(`../vendor/pokerogue/locales/${path}.json`, import.meta.url), 'utf8'));

const en = await json('en/ability');
const names = new Map();
for (const [key, value] of Object.entries(en)) names.set(toID(value?.name), [...(names.get(toID(value?.name)) ?? []), key]);

// A unique English name uses the name's id; a shared name (As One/Embody Aspect) uses each key's own id
const shared = [...names.values()].filter(keys => keys.length > 1).flat();
for (const lang of LANGS) {
  const result = { _source: `from pokerogue locales/${lang} @ 7d7da4a8 (AGPL-3.0-only); locales @ 485b48eb` };
  const [natures, summary] = [await json(`${lang}/nature`), await json(`${lang}/pokemon-summary`)];
  for (const [id, name] of Object.entries(natures)) {
    const fragment = summary.natureFragment?.[id];
    if (typeof name !== 'string' || typeof fragment !== 'string') throw new Error(`Missing ${lang} nature text: ${id}`);
    result[`nature.${id}`] = name;
    result[`natureFragment.${id}`] = fragment;
  }
  if (Object.keys(natures).length !== 25) throw new Error(`Expected 25 natures, got ${Object.keys(natures).length}`);

  const local = await json(`${lang}/ability`);
  let count = 0;
  const add = (id, key) => {
    const description = local[key]?.description;
    if (!id || typeof description !== 'string' || !description) throw new Error(`영어 이름이나 ${lang} 설명이 없는 특성: ${key}`);
    if (result[`ability.${id}`] !== undefined) throw new Error(`ability.${id} 가 둘: ${key}`);
    result[`ability.${id}`] = description;
    count++;
  };
  for (const [id, keys] of names) if (keys.length === 1) add(id, keys[0]);
  for (const key of shared) add(toID(key), key);

  await writeFile(new URL(`../director/text-summary-${lang}.json`, import.meta.url), JSON.stringify(result, null, 1) + '\n');
  console.log(`Extracted 25 natures + ${count} ability descriptions -> director/text-summary-${lang}.json (같은 영어 이름이라 키로 넣은 것 ${shared.length}개)`);
}
