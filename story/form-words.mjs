import speciesTable from '../data/names/species.json' with { type: 'json' };
import formWordsTable from '../data/names/form-words.json' with { type: 'json' };
import aiForms from '../data/names/ai-forms.json' with { type: 'json' };
import formRegions from '../data/names/form-regions.json' with { type: 'json' };
import { toID } from '../names/index.js';
import { norm } from './norm.mjs';

const REGION_WORDS = Object.freeze({
  alola: ['alola', 'alolan', '알로라'], galar: ['galar', 'galarian', '가라르'], hisui: ['hisui', 'hisuian', '히스이'], paldea: ['paldea', 'paldean', '팔데아'],
});
const REGION_OF = new Map(Object.entries(REGION_WORDS).flatMap(([region, list]) => list.map(w => [w, region])));
const REGIONS = new Set(Object.keys(REGION_WORDS));
const FILLERS = new Set(['form', 'forme', 'style', 'mode', 'breed', 'region', 'regional', 'of', 'the', '폼', '모습', '리전폼', '리전', '의', '종', '모드', '지방']);
const KO_TAILS = ['의모습', '리전폼', '모습', '폼', '모드', '종', '의'];
const SPLIT = /[\s\-_()[\],、·・/|:]+/u;
const NON_LATIN = /(?=\p{L})\P{Script=Latin}/u;

const wordsIn = text => String(text ?? '').normalize('NFKC').split(SPLIT).filter(Boolean);

const runKey = words => { const text = words.join(''); return NON_LATIN.test(text) ? norm(text) : toID(text); };

function formWord(word) {
  let w = norm(word);
  for (;;) {
    if (!w) return null;
    if (REGION_OF.has(w)) return REGION_OF.get(w);
    if (FILLERS.has(w)) return null;
    const tail = KO_TAILS.find(t => w.length > t.length && w.endsWith(t));
    if (!tail) return w;
    w = w.slice(0, -tail.length);
  }
}

const setKey = list => [...new Set(list)].sort().join(' ');

let bases;

export const readsNamesSince = (since, reading) => !since || reading?.[since] !== false;
const NEW_NAMES = 'formNames009';
const formsOf = new Map();
function buildBases() {
  bases = new Map();
  const add = (k, id) => { if (k) bases.set(k, bases.has(k) && bases.get(k) !== id ? null : id); };
  for (const [id, r] of Object.entries(speciesTable)) {
    if (r.base) continue;
    add(toID(r.en), id);
    for (const ko of [r.ko, ...(r.old ?? [])]) if (ko) add(norm(ko), id);
  }
  return bases;
}

function baseIn(words) {
  const known = bases ?? buildBases();
  let best = null, tie = false;
  for (let i = 0; i < words.length; i++) {
    for (let j = i + 1; j <= words.length; j++) {
      const id = known.get(runKey(words.slice(i, j)));
      if (!id) continue;
      if (!best || j - i > best.j - best.i) { best = { id, i, j }; tie = false; } else if (j - i === best.j - best.i) tie = true;
    }
  }
  return best && !tie ? { id: best.id, before: best.i, end: best.j, rest: [...words.slice(0, best.i), ...words.slice(best.j)] } : null;
}

function nameKey(name, base) {
  const found = baseIn(wordsIn(name));
  if (found?.id !== base) return null;
  const key = setKey(found.rest.map(formWord).filter(Boolean));
  return key || null;
}

function formeKey(r) {
  const words = wordsIn(r.en.slice(speciesTable[r.base].en.length)).map(formWord).filter(Boolean);
  return words.every(w => REGIONS.has(w)) ? null : setKey(words) || null;
}

function buildForms(newNames) {
  const forms = new Map();
  for (const [id, r] of Object.entries(speciesTable)) {
    if (!r.base || !readsNamesSince(r.since, { [NEW_NAMES]: newNames })) continue;
    const row = aiForms[id], named = Array.isArray(row);
    const label = /\(([^()]+)\)$/.exec(r.ko ?? '')?.[1];
    const keys = [
      ...(named ? row.filter(Boolean).map(name => [1, nameKey(name, r.base)]) : []),
      [2, label ? setKey(wordsIn(label).map(formWord).filter(Boolean)) || null : null],
      [2, formeKey(r)],
    ];
    const list = forms.get(r.base) ?? [];
    for (const [tier, key] of keys) if (key && !list.some(f => f.id === id && f.tier === tier && f.key === key)) list.push({ id, tier, key });
    forms.set(r.base, list);
  }

  if (newNames) {
    for (const [id, names] of Object.entries(formWordsTable)) {
      const r = speciesTable[id];
      if (!r) continue;
      const base = r.base ?? id, list = forms.get(base) ?? [];
      for (const name of names) {
        const at = baseIn(wordsIn(name));
        const key = setKey((at?.id === base ? at.rest : wordsIn(name)).map(formWord).filter(Boolean)) || null;
        if (key && !list.some(f => f.id === id && f.tier === 3 && f.key === key)) list.push({ id, tier: 3, key });
      }
      forms.set(base, list);
    }
  }
  formsOf.set(newNames, forms);
  return forms;
}

function pick(ids, shared) {
  const all = [...new Set(ids)].sort();
  if (!all.length) return undefined;
  if (all.length === 1) return all[0];
  if (all.every(shared)) return all;
  const short = all.reduce((a, b) => (b.length < a.length ? b : a));
  return all.every(id => id.startsWith(short)) ? short : null;
}

export function readFormWords(raw, { readHalf, shared = () => false, reading } = {}) {
  const newNames = readsNamesSince(NEW_NAMES, reading);
  const text = String(raw ?? '').normalize('NFKC').trim();
  const halves = /^(.+?)\s*\(([^()]+)\)$/.exec(text);
  if (halves && readHalf) {
    const a = readHalf(halves[1]), b = readHalf(halves[2]);
    if (typeof a === 'string' && a === b) return a;
  }
  const words = wordsIn(text), found = baseIn(words);
  if (found) return formOf(words, found, halves, shared, newNames);

  const got = new Set();
  for (const split of gluedSplits(words)) {
    const at = baseIn(split), id = at && formOf(split, at, null, shared, newNames);
    if (id) got.add(JSON.stringify(id));
  }
  return got.size === 1 ? JSON.parse([...got][0]) : null;
}

let koBases;

function* gluedSplits(words) {
  koBases ??= new Set([...(bases ?? buildBases())].filter(([k, id]) => id && NON_LATIN.test(k)).map(([k]) => k));
  for (let i = 0; i < words.length; i++) {
    const w = norm(words[i]);
    if (!NON_LATIN.test(w) || bases.has(w)) continue;
    for (let at = 0; at < w.length; at++) {
      for (let end = at + 1; end <= w.length; end++) {
        const k = w.slice(at, end);
        if (k.length < w.length && koBases.has(k)) yield [...words.slice(0, i), ...[w.slice(0, at), k, w.slice(end)].filter(Boolean), ...words.slice(i + 1)];
      }
    }
  }
}

function formOf(words, found, halves, shared, newNames) {

  const side = list => new Set(list.map(formWord).filter(Boolean));
  const front = side(words.slice(0, found.before)), back = side(words.slice(found.end));
  if ([...front].some(w => back.has(w)) && !(halves && wordsIn(halves[1]).length === found.end)) return null;
  const written = [...new Set(found.rest.map(formWord).filter(Boolean))];
  if (!written.length) return null;
  const key = setKey(written), forms = (formsOf.get(newNames) ?? buildForms(newNames)).get(found.id) ?? [];
  for (const tier of newNames ? [1, 2, 3] : [1, 2]) {
    const got = pick(forms.filter(f => f.tier === tier && f.key === key).map(f => f.id), shared);
    if (got !== undefined) return got;
  }
  if (written.length === 1 && REGIONS.has(written[0])) {
    const id = formRegions[`${found.id}${written[0]}`];
    if (id) return id;
  }

  const missing = f => { const words = f.key.split(' '); return words.length === written.length + 1 && written.every(w => words.includes(w)) && REGIONS.has(words.find(w => !written.includes(w))); };
  for (const tier of [1, 2]) {
    const got = pick(forms.filter(f => f.tier === tier && missing(f)).map(f => f.id), shared);
    if (got !== undefined) return got;
  }
  return null;
}
