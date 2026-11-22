import pool from '../data/trainer-pool.json' with { type: 'json' };
import { escapeRe } from './norm.mjs';

export const STYLES = Object.freeze([...pool.styles]);
export const DEFAULT_STYLES = Object.freeze([...pool.defaultStyles]);
export const POOL = pool.pictures;

function wordRe(word) {
  const parts = fold(word).split(' ').filter(Boolean);
  const latin = /^[a-z0-9 ]+$/.test(parts.join(' '));
  const body = latin ? parts.map(escapeRe).join(' ?') : [...parts.join('')].map(escapeRe).join(' ?');
  return new RegExp(latin ? `(?<![a-z0-9])${body}(?![a-z0-9])` : body, 'u');
}

const fold = text => ` ${String(text ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `;
/** [[regexp, id, length]] longest word first */
const wordList = table => Object.entries(table).flatMap(([id, words]) => words.map(w => [wordRe(w), id, fold(w).replace(/ /g, '').length]))
  .sort((a, b) => b[2] - a[2]);
const STYLE_LIST = wordList(pool.styleWords);
const KEYWORD_LIST = wordList(Object.fromEntries(Object.entries(pool.keywords).map(([id, k]) => [id, k.words])));

function found(text, list) {
  const s = fold(text), hits = [];
  for (const [re, id] of list) {
    const m = re.exec(s);
    if (m && !hits.some(h => m.index >= h.at && m.index + m[0].length <= h.end)) hits.push({ id, at: m.index, end: m.index + m[0].length });
  }
  return hits;
}

export const NUMBER = /^\s*#?(\d+)\s*(?:번|no\.?)?\s*$/iu;

export function readStyles(value) {
  const out = [];
  for (const part of String(value ?? '').split(/\s*(?:[,，/·&+;]|\band\b|그리고)\s*/iu).filter(Boolean)) {
    const n = NUMBER.exec(part);
    const ids = n ? [STYLES[+n[1] - 1]].filter(Boolean) : found(part, STYLE_LIST).sort((a, b) => a.at - b.at).map(h => h.id);
    for (const id of ids) if (!out.includes(id)) out.push(id);
  }
  return out;
}

export function classKeyword(trainerClass) {
  if (!trainerClass) return null;
  const s = fold(trainerClass);
  for (const [re, id] of KEYWORD_LIST) if (re.test(s)) return { id, M: pool.keywords[id].M, F: pool.keywords[id].F };
  return null;
}

export const poolCard = sprite => {
  const p = POOL[sprite];
  return p?.face ? { face: p.face } : { face: null, sheet: p?.sheet ? { key: sprite, rect: p.sheet } : undefined };
};
export const poolBounds = face => pool.faceBounds[face] ?? null;

const isDefault = p => p.default ?? p.styles.some(s => DEFAULT_STYLES.includes(s));

const ofLook = look => Object.keys(POOL).filter(sprite => !POOL[sprite].keywordOnly && POOL[sprite].looks.includes(look));

export const styleCell = (look, style) => ofLook(look).filter(sprite => POOL[sprite].styles.includes(style));

export function defaultCell(look) {
  const all = ofLook(look), some = all.filter(sprite => isDefault(POOL[sprite]));
  return some.length ? some : all;
}
