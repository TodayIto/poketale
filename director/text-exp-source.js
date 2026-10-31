import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { checkLang } from './lang.js';

export function expTextBase64(lang) {
  return gzipSync(readFileSync(new URL(`./text-exp-${checkLang(lang)}.json`, import.meta.url)), { level: 9 }).toString('base64');
}
