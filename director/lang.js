export const LANGS = Object.freeze(['ko', 'en']);
export const DEFAULT_LANG = 'ko';

// The language code itself, or a TypeError for one we have no tables for
export function checkLang(lang) {
  if (!LANGS.includes(lang)) throw new TypeError(`Unknown language: ${lang}`);
  return lang;
}
