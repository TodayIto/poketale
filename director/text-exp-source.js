import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { checkLang } from './lang.js';
import { MOVE_GENS_KEY } from './move-text.js';

const read = (name, lang) => JSON.parse(readFileSync(new URL(`./${name}-${checkLang(lang)}.json`, import.meta.url), 'utf8'));

export function expTextBase64(lang) {
  const text = { ...read('text-exp', lang), [MOVE_GENS_KEY]: read('text-move-gens', lang) };
  return gzipSync(JSON.stringify(text), { level: 9 }).toString('base64');
}
