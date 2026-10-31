import { checkLang } from '../director/lang.js';
import { interpolate } from '../director/text.js';
import ko from './screen-text-ko.mjs';
import en from './screen-text-en.mjs';

export const SCREEN_TEXT = Object.freeze({ ko, en });

// One screen text in lang: the template of key with values filled in
export function say(lang, key, values = {}) {
  const table = SCREEN_TEXT[checkLang(lang)];
  if (!Object.hasOwn(table, key)) throw new Error(`Unknown screen text key: ${key}`);
  return interpolate(table[key], values, lang);
}

export const sayer = lang => (checkLang(lang), (key, values) => say(lang, key, values));

export const perLang = build => { const made = new Map(); return lang => { if (!made.has(lang)) made.set(lang, build(sayer(lang), lang)); return made.get(lang); }; };
