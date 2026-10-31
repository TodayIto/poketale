import { teamOf } from './read.js';
import ko from './text-ko.json' with { type: 'json' };
import en from './text-en.json' with { type: 'json' };
import { checkLang, DEFAULT_LANG, LANGS } from './lang.js';
import { ownTemplate } from './own-text.js';

const RULES = { ko: { particles: true, affix: false }, en: { particles: false, affix: true } };
const BASE = { ko, en };

const pairs = [['은', '는'], ['이', '가'], ['을', '를'], ['으로', '로'], ['과', '와'], ['이랑', '랑']];

export function postposition(word, particle) {
  const pair = pairs.find(p => p.includes(particle));
  if (!pair) throw new Error(`Unknown particle: ${particle}`);
  const plain = word.replace(/\([^()]*\)/g, '');
  const code = plain.charCodeAt(plain.length - 1);
  if (code >= 0xac00 && code <= 0xd7a3) {
    const final = (code - 0xac00) % 28;
    return pair[final && !(pair[0] === '으로' && final === 8) ? 0 : 1];
  }

  const last = plain.at(-1);
  if (/\d/.test(last || '')) {
    let final = '13678'.includes(last);
    if (last === '0') {
      const zeros = /0+$/.exec(plain.replaceAll(',', ''))?.[0].length || 0;
      final = plain.includes('.') || !([12, 20, 24, 32, 44].includes(zeros) || zeros >= 52);
    }
    return pair[final ? 0 : 1];
  }
  if (/[っんッンﾝ]/u.test(last || '')) return pair[0];
  if (/[\u3041-\u309f\u30a0-\u30fa\u31f0-\u31ff\uff66-\uff9c]/u.test(last || '')) return pair[1];
  return particle;
}

export function interpolate(template, values = {}, lang = DEFAULT_LANG) {
  const expanded = template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (values[key] === undefined) throw new Error(`Missing text value: ${key}`);
    return String(values[key]);
  });
  if (!RULES[checkLang(lang)].particles) return expanded;
  let previous = 0;
  return expanded.replace(/\[\[(은|는|이|가|을|를|으로|로|과|와|이랑|랑)\]\]/g, (match, particle, offset) => {
    const result = postposition(expanded.slice(previous, offset), particle);
    previous = offset + match.length;
    return result;
  });
}

export function phrase(tables, key, values, lang = DEFAULT_LANG, what = 'text') {
  const table = tables[checkLang(lang)];
  const template = ownTemplate(key, lang) ?? (key !== '_source' && Object.hasOwn(table, key) ? table[key] : undefined);
  if (template === undefined) throw new Error(`Unknown ${what} key: ${key}`);
  return interpolate(template, values, lang);
}

const NO_TABLE = Object.fromEntries(LANGS.map(lang => [lang, {}]));

// Own sentence only (director/own-text.js)
export const ownText = (key, values, lang = DEFAULT_LANG) => phrase(NO_TABLE, key, values, lang, 'own text');

export function text(key, values, lang = DEFAULT_LANG) {
  const table = BASE[checkLang(lang)];
  if (!Object.hasOwn(table, key) || key === '_source') throw new Error(`Unknown text key: ${key}`);
  return interpolate(table[key], values, lang);
}

export function nameWithAffix(lang = DEFAULT_LANG, wild = false) {
  if (!RULES[checkLang(lang)].affix) return name => name;
  return (name, position) => (teamOf(position) === 'enemy' && name !== undefined ? text(wild ? 'battle.wildPokemonWithAffix' : 'battle.foePokemonWithAffix', { pokemonName: name }, lang) : name);
}

export const statusNames = { par: 'paralysis', brn: 'burn', psn: 'poison', tox: 'toxic', slp: 'sleep', frz: 'freeze' };
export const commonNames = { ...statusNames, tox: 'poison', frz: 'frozen' };
