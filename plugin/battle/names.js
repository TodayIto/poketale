import { namesIn } from '../../names/index.js';
import { DEFAULT_LANG } from '../../director/lang.js';

const KINDS = [['species', 'species'], ['move', 'moves'], ['ability', 'abilities'], ['item', 'items']];

export function battleNamesIn(lang = DEFAULT_LANG, dex) {
  const names = namesIn(lang);
  if (lang === 'en' && !dex?.species) throw new TypeError('English battle names need the engine Dex');
  const english = kind => value => {
    const found = typeof value === 'string' && value ? dex[kind].get(value) : null;
    return found?.exists ? found.name : names[kind](value);
  };
  return Object.freeze(Object.fromEntries(KINDS.map(([key, kind]) => [key, lang === 'en' ? english(kind) : names[kind]])));
}

// Korean names (the default language)
export const battleNames = battleNamesIn('ko');
