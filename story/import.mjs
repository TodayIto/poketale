import storyNames from '../data/story-names.json' with { type: 'json' };
import compatWords from '../data/compat-words.json' with { type: 'json' };
import { lookupId, speciesName, stripForPrompt, hashKey, norm, findBlocks, findTags, findMarks } from './blocks.mjs';
import { namesIn } from '../names/index.js';
import { dropOocs } from './chat.mjs';
import { COMPAT_LINES, COMPAT_LINE_RE, COMPAT_FIELD_SEP, compatHead, compatFold, dropTaken } from './compat.mjs';
import { readStored, isRecord, isUnreadable } from './stored.mjs';
import { ruleNote, ruleError, refusal, failed } from './failure.mjs';
import { clone, fillSet, rngFor, newMon, uniqueUid, hpFromPercent, hpPercentOf, markDex, toID, maxHp, healParty, friendshipOf, isEgg, tidyBreeding, stateFormat } from './state.mjs';
import { FRIENDSHIP_MAX, friendshipLocked } from '../engine/friendship.mjs';
import { STATS, STATUS_IDS } from '../engine/mon.mjs';
import { evTotal } from './training.mjs';
import { PARTY_MAX, MAX_LEVEL, MAX_MOVES, MAX_IV, EV_STAT_MAX, EV_TOTAL_MAX, DEBUG_STAT_MAX } from './rules.mjs';
import { isCustomItem, customItemId, customInfo, splitEmoji, itemId, addCustomItem, tidyCustomItems, DEFAULT_EMOJI, CUSTOM_TAGS } from './custom-items.mjs';
import { learnableReader } from './learnable.mjs';
import learnableTable from '../data/learnable.json' with { type: 'json' };

export const IMPORT_VAR = '$pkb_import';

export const COMPAT_FORMAT = Object.freeze({
  fields: Object.freeze({ name: 'Name', level: 'Level', hp: 'HP', condition: 'Condition', state: 'State', english: 'English Name', number: 'Number' }),
  partyFields: Object.freeze(['name', 'level', 'hp', 'condition', 'state', 'english']),
  lineSep: ' | ',
  conditionSep: '/',
  conditions: Object.freeze(Object.fromEntries(Object.entries(compatWords.conditions).flatMap(([id, words]) => words.map(word => [word, id])))),
  shinyWords: Object.freeze([...compatWords.shiny]),
  written: Object.freeze(compatWords.write),
  storageVar: 'yp_PokemonStorage',
  entrySep: '|',
  fieldSep: '^',
  egg: 'Egg',
});

export const FIELD_FROM = Object.freeze(['record', 'auto', 'user', 'ai', 'current']);

const SET_FIELDS = ['species', 'name', 'level', 'gender', 'shiny', 'nature', 'ability', 'item', 'moves', 'ivs', 'evs', 'teraType'];
const MON_FIELDS = [...SET_FIELDS, 'hpPercent', 'status', 'place'];

export const DEBUG_FIELDS = ['friendship', 'friendshipLocked', 'eggCycles'];

const EGG_CYCLES_MAX = 255;
const ACTIONS = ['add', 'update', 'skip'];
// Auto fields that follow the species / the level (filled again when either is edited)
const BY_SPECIES = ['ability', 'moves', 'gender', 'teraType'];
const BY_LEVEL = ['moves'];

const LEVEL_NEAR = 5;

const fail = (rule, values) => { throw ruleError(`import.${rule}`, values); };

const note = (rule, values) => ruleNote(`import.${rule}`, values);

const READ_KINDS = Object.freeze({ party: 'party', storageAdd: 'add', storageRemove: 'remove' });

function compatReader(format) {
  const fieldOf = new Map(Object.entries(format.fields).map(([field, name]) => [compatFold(name), field]));
  const conditions = new Map(Object.entries(format.conditions).map(([word, id]) => [compatFold(word), id]));
  const shinyWords = new Set((format.shinyWords ?? []).map(compatFold));
  const isEggWord = text => !!format.egg && compatFold(text) === compatFold(format.egg);

  const entries = text => [...String(text ?? '').matchAll(COMPAT_LINE_RE)].map(m => {
    const [head, ...segs] = m[1].split(COMPAT_FIELD_SEP).map(s => s.trim());
    const line = compatHead(head);
    const fields = {};
    for (const seg of segs) {
      const kv = /^([^:：]+)[:：]\s*(.*)$/.exec(seg);
      const field = kv && fieldOf.get(compatFold(kv[1]));
      if (field) fields[field] = kv[2].trim();
    }
    return { kind: READ_KINDS[line?.line] ?? null, slot: line?.slot ?? null, fields, egg: !Object.keys(fields).length && segs.some(isEggWord) };
  });

  const condition = text => {
    let status, shiny = false;
    for (const word of String(text ?? '').split(format.conditionSep).map(s => s.trim()).filter(Boolean)) {
      if (shinyWords.has(compatFold(word))) { shiny = true; continue; }
      const id = conditions.get(compatFold(word));
      if (id === undefined) continue;
      if (!id) status ||= '';
      else status ||= id;
    }
    return { status, shiny };
  };

  const storageEntries = text => text.split(format.entrySep).map(entry => {
    const [name = '', level = '', english = ''] = entry.split(format.fieldSep).map(s => s.trim());
    return { fields: { name, level, english }, egg: isEggWord(name) && !level && !english };
  });
  return { entries, condition, storageEntries };
}

function nameId(kind, raw) {
  const text = String(raw ?? '').trim();
  const split = /^(.*?)\s*\((.*)\)\s*$/.exec(text);
  for (const part of [text, ...(split ? [split[1], split[2]] : [])]) {
    const id = part && lookupId(kind, part);
    if (id) return id;
  }
  return null;
}
const speciesOf = raw => { const id = nameId('species', raw); return id ? speciesName(id) : null; };

const named = fields => !!(fields.name || fields.english);

const eggFound = source => ({ egg: true, source });

function speciesAndNickname(sim, name, english) {
  const species = (english ? speciesOf(english) : speciesOf(name)) ?? (english || name).trim();
  const base = raw => { const s = sim.Dex.species.get(raw ?? ''); return s.exists ? s.baseSpecies : null; };
  const own = speciesOf(name);
  const isSpecies = !name || [english, species].some(n => n && compatFold(n) === compatFold(name)) || (!!own && (own === species || (!!base(own) && base(own) === base(species))));
  return { species, nickname: isSpecies ? undefined : name };
}

function toFound(fields, reader, sim, source, warnings) {
  const found = { ...speciesAndNickname(sim, fields.name, fields.english), level: undefined, hpPercent: undefined, status: undefined, source };
  const level = /(\d{1,3})/.exec(fields.level ?? '');
  if (level) found.level = Number(level[1]);
  const hp = /^(\d+(?:\.\d+)?)\s*%?/.exec(fields.hp ?? '');
  if (hp) found.hpPercent = Math.min(100, Number(hp[1]));
  if (fields.condition !== undefined) {
    const { status, shiny } = reader.condition(fields.condition);
    found.status = status;
    if (shiny) found.shiny = true;
  }
  if (found.hpPercent === 0) found.status = 'fnt';
  return found;
}

const recordText = text => stripForPrompt(dropOocs(text));

function lineOf(sim, name) {
  let s = sim.Dex.species.get(name ?? '');
  if (!s.exists) return null;
  for (;;) {
    if (s.prevo) s = sim.Dex.species.get(s.prevo);
    else if (s.baseSpecies && s.baseSpecies !== s.name) s = sim.Dex.species.get(s.baseSpecies);
    else return s.id;
  }
}
const sameName = (a, b) => !!a && !!b && compatFold(a) === compatFold(b);

export function readCompat(chat, ctx, { format = COMPAT_FORMAT } = {}) {
  const { sim } = ctx;
  const reader = compatReader(format);
  const warnings = [];
  const stored = chat?.scriptstate?.[`$${format.storageVar}`];
  const fromVar = typeof stored === 'string';
  let party = [];
  const varSource = { index: null, chatId: null, var: format.storageVar };
  let box = fromVar ? reader.storageEntries(stored).filter(e => e.egg || named(e.fields)).map(e => (e.egg ? eggFound(varSource) : toFound(e.fields, reader, sim, varSource, warnings))) : [];
  (chat?.message ?? []).forEach((message, index) => {
    const lines = reader.entries(recordText(message?.data)).filter(line => line.kind);
    const source = { index, chatId: message?.chatId ?? null };
    const partyLines = lines.filter(line => line.kind === 'party');
    if (partyLines.length) {
      const list = [], slots = new Map();
      for (const line of partyLines) {
        if (!line.egg && !named(line.fields)) continue;
        const found = line.egg ? eggFound(source) : toFound(line.fields, reader, sim, source, warnings);

        if (line.slot && slots.has(line.slot)) list[slots.get(line.slot)] = found;
        else { if (line.slot) slots.set(line.slot, list.length); list.push(found); }
      }
      party = list;
    }
    if (fromVar) return;
    const list = [...box, ...lines.filter(line => line.kind === 'add' && named(line.fields)).map(line => toFound(line.fields, reader, sim, source, warnings))];
    const gone = new Set();
    for (const line of lines.filter(l => l.kind === 'remove')) {
      const raw = String(line.fields.number ?? '').trim();
      const at = /^\d+$/.test(raw) ? Number(raw) - 1 : -1;
      if (at >= 0 && at < list.length && !gone.has(at)) gone.add(at);
      else warnings.push(note('removeMissing', { n: index + 1, number: raw }));
    }
    box = list.filter((_, i) => !gone.has(i));
  });
  if (party.length > PARTY_MAX) warnings.push(note('recordPartyOver', { count: party.length, max: PARTY_MAX }));
  return { party, box, warnings };
}

const zeroEvs = () => Object.fromEntries(STATS.map(s => [s, 0]));
const blankOf = { species: '', name: '', level: null, gender: null, shiny: false, nature: null, ability: null, item: '', moves: [], ivs: null, evs: null, teraType: null };

const blankMon = (key, place, seed) => ({ key, place, set: clone(blankOf), hpPercent: 100, status: '', from: Object.fromEntries(MON_FIELDS.map(f => [f, 'auto'])),
  match: null, action: 'add', problems: [], seed: `${seed}:${key}` });

const knownItem = id => typeof id === 'string' && lookupId('items', id) === id;
const validLevel = level => Number.isInteger(level) && level >= 1 && level <= MAX_LEVEL;
const statsOk = (values, max) => isRecord(values) && STATS.every(s => Number.isInteger(values[s]) && values[s] >= 0 && values[s] <= max);

const HOLD_RANGE = Object.freeze({ iv: DEBUG_STAT_MAX, ev: DEBUG_STAT_MAX, evTotal: Infinity });
const MAINLINE_RANGE = Object.freeze({ iv: MAX_IV, ev: EV_STAT_MAX, evTotal: EV_TOTAL_MAX });

const spreadRange = (kind, mon, field) => (kind === DEBUG_KIND || mon.from[field] === 'current' ? HOLD_RANGE : MAINLINE_RANGE);

export const typedRange = draft => (draft.kind === DEBUG_KIND ? HOLD_RANGE : MAINLINE_RANGE);

export const pastMainline = set => ({
  ivs: STATS.some(s => (set?.ivs?.[s] ?? 0) > MAX_IV),
  evs: STATS.some(s => (set?.evs?.[s] ?? 0) > EV_STAT_MAX) || evTotal(set?.evs) > EV_TOTAL_MAX,
});
const learnable = learnableReader(learnableTable);

export function unlearnableMoves(set, sim) {
  const species = sim.Dex.species.get(set?.species ?? '');
  const moves = species.exists ? learnable(species.id) : null;
  return moves ? (set.moves ?? []).filter(move => !moves.has(sim.Dex.moves.get(move).id)) : [];
}

export function foreignAbility(set, sim) {
  const species = sim.Dex.species.get(set?.species ?? '');
  return species.exists && !!set.ability && !Object.values(species.abilities).some(ability => toID(ability) === toID(set.ability));
}

export const mainlineBreaks = (set, sim) => ({ ...pastMainline(set), moves: unlearnableMoves(set, sim).length > 0, ability: foreignAbility(set, sim) });

function usable(sim, species, field, value, range = HOLD_RANGE) {
  switch (field) {
    case 'name': return typeof value === 'string';
    case 'gender': return value === '' ? species.gender === 'N' : (value === 'M' || value === 'F') && (!species.gender || species.gender === value);
    case 'shiny': return typeof value === 'boolean';
    case 'nature': return !!value && sim.Dex.natures.get(value).exists;

    case 'ability': return !!value && sim.Dex.abilities.get(value).exists;
    case 'item': return value === '' || knownItem(value);
    case 'moves': return Array.isArray(value) && value.length >= 1 && value.length <= MAX_MOVES && new Set(value.map(toID)).size === value.length && value.every(m => sim.Dex.moves.get(m).exists);
    case 'ivs': return statsOk(value, range.iv);
    case 'evs': return statsOk(value, range.ev) && evTotal(value) <= range.evTotal;
    case 'teraType': return !!value && sim.Dex.types.get(value).exists;
  }
  return false;
}

function fillAuto(mon, ctx, fields) {
  const { sim } = ctx;
  const refill = new Set(fields.filter(f => mon.from[f] === 'auto' && f !== 'species' && f !== 'level'));
  if (!refill.size) return;
  delete mon.fillError;
  const species = sim.Dex.species.get(mon.set.species || '');
  const fixed = { item: '', shiny: false, evs: zeroEvs() };
  if (species.exists) fixed.teraType = species.requiredTeraType || species.types[0];

  const free = () => {
    const rng = rngFor(sim, `import:${mon.seed}`), natures = sim.Dex.natures.all();
    return { nature: natures[rng.random(natures.length)].name, ivs: Object.fromEntries(STATS.map(s => [s, rng.random(MAX_IV + 1)])) };
  };
  const leaveBlank = () => {
    const drawn = refill.has('nature') || refill.has('ivs') ? free() : {};
    for (const f of refill) mon.set[f] = Object.hasOwn(fixed, f) ? clone(fixed[f]) : Object.hasOwn(drawn, f) ? drawn[f] : clone(blankOf[f]);
  };
  if (!species.exists || !validLevel(mon.set.level)) return leaveBlank();
  const given = { species: species.name, level: mon.set.level };
  for (const f of SET_FIELDS) {
    if (f === 'species' || f === 'level') continue;
    if (refill.has(f)) { if (Object.hasOwn(fixed, f)) given[f] = clone(fixed[f]); continue; }
    if (usable(sim, species, f, mon.set[f])) given[f] = clone(mon.set[f]);
  }
  let full;
  try {
    full = fillSet(ctx, given, rngFor(sim, `import:${mon.seed}`));
  } catch (e) {

    mon.fillError = e.notes?.[0] ?? note('noMovesAtLevel', { species: species.name, level: mon.set.level, id: species.id });
    return leaveBlank();
  }
  for (const f of refill) mon.set[f] = full[f];
}

function monProblems(mon, ctx, kind) {
  const { sim } = ctx;
  const out = [];
  const { set } = mon;
  const species = sim.Dex.species.get(set.species || '');
  if (!species.exists) out.push(set.species ? note('unknownSpecies', { species: set.species }) : note('noSpecies'));
  if (set.level === null || set.level === undefined || set.level === '') out.push(note('noLevel'));
  else if (!validLevel(set.level)) out.push(note('levelRange', { max: MAX_LEVEL, level: set.level }));
  if (mon.fillError) out.push(mon.fillError);
  if (species.exists && validLevel(set.level) && !mon.fillError) {
    for (const f of ['gender', 'shiny', 'nature', 'ability', 'item', 'moves', 'ivs', 'evs', 'teraType']) {
      if (usable(sim, species, f, set[f], spreadRange(kind, mon, f))) continue;
      const field = note(`field.${f}`);
      out.push(set[f] === null || set[f] === undefined ? note('badFieldEmpty', { field })
        : note('badField', { field, value: Array.isArray(set[f]) ? set[f].join(', ') : typeof set[f] === 'object' ? JSON.stringify(set[f]) : set[f] }));
    }
  }
  if (typeof set.name !== 'string') out.push(note('badName'));
  if (!(typeof mon.hpPercent === 'number' && mon.hpPercent >= 0 && mon.hpPercent <= 100)) out.push(note('hpRange', { hp: mon.hpPercent }));
  if (!STATUS_IDS.has(mon.status)) out.push(note('unknownStatus', { status: mon.status }));
  if (mon.place !== 'party' && mon.place !== 'box') out.push(note('placeRange', { place: mon.place }));
  if (mon.friendship !== undefined && !(Number.isInteger(mon.friendship) && mon.friendship >= 0 && mon.friendship <= FRIENDSHIP_MAX)) out.push(note('friendshipRange', { value: mon.friendship }));
  if (mon.eggCycles !== undefined && !(Number.isInteger(mon.eggCycles) && mon.eggCycles >= 1 && mon.eggCycles <= EGG_CYCLES_MAX)) out.push(note('eggCyclesRange', { value: mon.eggCycles, max: EGG_CYCLES_MAX }));
  return out;
}

function draftMon(found, place, key, ctx, seed) {
  const mon = blankMon(key, place, seed);
  const record = (field, value) => { if (field in mon.set) mon.set[field] = value; else mon[field] = value; mon.from[field] = 'record'; };
  record('place', place);
  if (found.egg) return { ...mon, egg: true, action: 'skip' };
  record('species', found.species);
  record('name', found.nickname ?? '');
  if (found.level !== undefined) record('level', found.level);
  if (found.shiny) record('shiny', true);
  if (found.status === 'fnt') record('hpPercent', 0);
  else {
    if (found.hpPercent !== undefined) record('hpPercent', found.hpPercent);
    if (found.status !== undefined) record('status', found.status);
  }
  fillAuto(mon, ctx, SET_FIELDS);
  return mon;
}

const labelOf = ({ name, species, level }) => `${name ? `${name} (${species})` : species}${level ? ` Lv${level}` : ''}`;

function valuesOf(ctx, state, mon) {
  const hpPercent = mon.hp === null || mon.hp === undefined ? 100 : mon.hp / maxHp(ctx.sim, mon.set, stateFormat(state)) * 100;
  return { set: Object.fromEntries(SET_FIELDS.map(f => [f, clone(mon.set[f])])), hpPercent, status: mon.status === 'fnt' ? '' : mon.status ?? '' };
}
const FOLLOWING = MON_FIELDS.filter(f => f !== 'place');
const putField = (mon, field, value) => { if (field in mon.set) mon.set[field] = value; else mon[field] = value; };

function followPair(mon, hit, ctx) {
  const free = FOLLOWING.filter(f => mon.from[f] === 'auto' || mon.from[f] === 'current');
  if (hit) {
    for (const f of free) { putField(mon, f, clone(f in hit.now.set ? hit.now.set[f] : hit.now[f])); mon.from[f] = 'current'; }
    return;
  }
  const back = free.filter(f => mon.from[f] === 'current');
  for (const f of back) { putField(mon, f, f in blankOf ? clone(blankOf[f]) : f === 'hpPercent' ? 100 : ''); mon.from[f] = 'auto'; }
  fillAuto(mon, ctx, back);
}

function rematch(draft, ctx) {
  if (draft.kind === DEBUG_KIND) return;
  const { sim } = ctx;
  const taken = new Set();
  const pairs = new Map();
  const mons = draft.mons.filter(m => !m.egg), pool = draft.pool.filter(p => !p.egg);
  const lines = new Map(pool.map(p => [p.uid, lineOf(sim, p.species)]));
  const nicknamed = mons.filter(m => m.set.name), plain = mons.filter(m => !m.set.name);
  for (const mon of nicknamed) {
    const line = lineOf(sim, mon.set.species);
    const hit = line && pool.find(p => !taken.has(p.uid) && lines.get(p.uid) === line && sameName(p.name, mon.set.name));
    if (hit) { taken.add(hit.uid); pairs.set(mon.key, hit); }
  }
  for (const mon of plain) {
    const line = lineOf(sim, mon.set.species);
    if (!line) continue;
    const near = p => !validLevel(mon.set.level) || Math.abs(p.level - mon.set.level) <= LEVEL_NEAR;
    const score = p => [toID(p.species) === toID(mon.set.species) ? 0 : 1, p.name ? 1 : 0, validLevel(mon.set.level) ? Math.abs(p.level - mon.set.level) : 0];
    const hits = pool.filter(p => !taken.has(p.uid) && lines.get(p.uid) === line && near(p))
      .sort((a, b) => { const x = score(a), y = score(b); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; });
    if (hits.length) { taken.add(hits[0].uid); pairs.set(mon.key, hits[0]); }
  }
  const eggs = draft.mons.filter(m => m.egg), ourEggs = draft.pool.filter(p => p.egg);
  for (const samePlace of [true, false]) {
    for (const mon of eggs) {
      if (pairs.has(mon.key)) continue;
      const hit = ourEggs.find(p => !taken.has(p.uid) && (!samePlace || p.place === mon.place));
      if (hit) { taken.add(hit.uid); pairs.set(mon.key, hit); }
    }
  }
  for (const mon of draft.mons) {
    const hit = pairs.get(mon.key);
    const match = hit ? { uid: hit.uid, place: hit.place, label: labelOf(hit) } : null;
    if ((mon.match?.uid ?? null) === (match?.uid ?? null)) { mon.match = match; continue; }
    mon.match = match;
    if (mon.egg) mon.action = match ? 'update' : 'skip';
    else if (mon.action !== 'skip') mon.action = match ? 'update' : 'add';
    followPair(mon, hit, ctx);
  }
}

export function makeDraft(chat, state, ctx, { seed = 0, format } = {}) {
  const found = readCompat(chat, ctx, format ? { format } : {});
  const pool = [...(state?.party ?? []).map(m => [m, 'party']), ...(state?.box ?? []).map(m => [m, 'box'])]
    .map(([m, place]) => ({ uid: m.uid, place, species: m.set.species, name: m.set.name ?? '', level: m.set.level, now: valuesOf(ctx, state, m), ...(isEgg(m) ? { egg: true } : {}) }));
  const bag = Object.fromEntries(Object.entries(state?.bag ?? {}).filter(([, n]) => n > 0).map(([id, n]) => [id, { count: n, from: 'current' }]));

  const customItems = Object.fromEntries(Object.keys(bag).filter(isCustomItem).map(id => [id, customInfo(state, id)]).filter(([, info]) => info));
  const draft = {
    v: 1,
    mons: [...found.party.map((f, i) => draftMon(f, 'party', `p${i + 1}`, ctx, seed)), ...found.box.map((f, i) => draftMon(f, 'box', `b${i + 1}`, ctx, seed))],
    bag, warnings: found.warnings, pool, base: { bag: Object.fromEntries(Object.entries(bag).map(([id, e]) => [id, e.count])) }, customItems,
  };
  rematch(draft, ctx);
  for (const mon of draft.mons) mon.problems = monProblems(mon, ctx, draft.kind);
  return draft;
}

export function importTurn(chat) {
  const { status, imports } = readImports(chat);
  const moves = imports.filter(imp => imp.kind !== DEBUG_KIND);
  const latest = moves.findLast(inForce);
  const moved = !!latest && latest.kind !== HANDBACK_KIND;
  return { status, moved, back: latest?.kind === HANDBACK_KIND ? latest : null, declined: !moved && !!moves.length && !inForce(moves.at(-1)) };
}

export function importOffer(chat, state, ctx, { allowed = false, seed = 0 } = {}) {
  if (!allowed || !state) return null;
  const turn = importTurn(chat);
  if (isUnreadable(turn.status) || turn.moved || turn.declined || (!turn.back && state.party.length)) return null;
  const draft = makeDraft(chat, state, ctx, { seed });
  return draft.mons.length ? draft : null;
}

export const HANDBACK_KIND = 'handback';

const plainValue = (value, seps) => [...String(value ?? '')].map(c => (seps.includes(c) || c === '\n' || c === '\r' ? ' ' : c)).join('').trim();
const LINE_SEPS = ['|', '｜', '[', ']'];

export function compatRecords(state, ctx, { lang = 'ko' } = {}) {
  const { sim } = ctx;
  const words = COMPAT_FORMAT.written[lang] ?? COMPAT_FORMAT.written.en;
  const species = namesIn(lang === 'ko' ? 'ko' : 'en').species;
  const nameOf = mon => mon.set.name || species(mon.set.species);
  const { fields } = COMPAT_FORMAT;
  const lines = state.party.map((mon, i) => {
    if (isEgg(mon)) return `[${[`${COMPAT_LINES.party} ${i + 1}`, COMPAT_FORMAT.egg].join(COMPAT_FORMAT.lineSep)}]`;
    const hp = hpPercentOf(sim, mon, stateFormat(state));
    const status = hp === 0 ? 'fnt' : mon.status || '';
    const values = {
      name: nameOf(mon), level: mon.set.level, hp: `${hp}%`, state: words.state, english: mon.set.species,
      condition: [words.conditions[status], ...(mon.set.shiny ? [words.shiny] : [])].join(` ${COMPAT_FORMAT.conditionSep} `),
    };
    return `[${[`${COMPAT_LINES.party} ${i + 1}`, ...COMPAT_FORMAT.partyFields.map(f => `${fields[f]}: ${plainValue(values[f], LINE_SEPS)}`)].join(COMPAT_FORMAT.lineSep)}]`;
  });
  const boxSeps = [COMPAT_FORMAT.entrySep, COMPAT_FORMAT.fieldSep];
  const storage = state.box.map(mon => (isEgg(mon) ? COMPAT_FORMAT.egg : [nameOf(mon), mon.set.level, mon.set.species].map(v => plainValue(v, boxSeps)).join(COMPAT_FORMAT.fieldSep))).join(COMPAT_FORMAT.entrySep);
  return { lines, storage };
}

const hasOurs = text => findBlocks(text).length + findTags(text).length + findMarks(text).length > 0;

export function handBack(chat, state, ctx, { lang = 'ko', now = Date.now() } = {}) {
  const turn = importTurn(chat);
  if (turn.status !== 'ok' || !turn.moved) return false;
  const { lines, storage } = compatRecords(state, ctx, { lang });
  const messages = chat.message ?? [];
  for (const message of messages) if (hasOurs(message.data)) message.data = stripForPrompt(message.data);
  const last = messages.findLastIndex(m => m?.role === 'char');
  if (last >= 0 && lines.length) messages[last].data = `${dropTaken(messages[last].data).replace(/\s+$/, '')}\n\n${lines.join('\n')}`;
  chat.scriptstate[`$${COMPAT_FORMAT.storageVar}`] = storage;
  appendImport(chat, now, HANDBACK_KIND, () => ({ mons: [], bag: {}, kind: HANDBACK_KIND, state: clone(state) }));
  return true;
}

export const DEBUG_KIND = 'debug';

export function newMonDraft(ctx, { place = 'party', seed = 0 } = {}) {
  const mon = blankMon('n1', place, seed);
  for (const f of ['species', 'name', 'level', 'place']) mon.from[f] = 'user';
  fillAuto(mon, ctx, SET_FIELDS);
  mon.problems = monProblems(mon, ctx, DEBUG_KIND);
  return { v: 1, kind: DEBUG_KIND, mons: [mon], bag: {}, warnings: [], pool: [], base: { bag: {} } };
}

export function currentMonDraft(ctx, state, uid) {
  const place = state.party.some(m => m.uid === uid) ? 'party' : state.box.some(m => m.uid === uid) ? 'box' : fail('notInState', { uid });
  const found = [...state.party, ...state.box].find(m => m.uid === uid);
  const { set, hpPercent, status } = valuesOf(ctx, state, found);
  const debug = isEgg(found) ? { eggCycles: Math.ceil(found.egg.cycles) } : { friendship: friendshipOf(ctx, found), friendshipLocked: friendshipLocked(found) };
  const mon = { key: 'e1', place, set, hpPercent, status, ...debug, from: Object.fromEntries([...MON_FIELDS, ...Object.keys(debug)].map(f => [f, 'current'])),
    match: { uid, place, label: labelOf(set) }, action: 'update', problems: [], seed: `0:e1` };
  mon.problems = monProblems(mon, ctx, DEBUG_KIND);
  return { v: 1, kind: DEBUG_KIND, mons: [mon], bag: {}, warnings: [], pool: [], base: { bag: {} } };
}

export const friendshipLockDraft = (ctx, state, uid, locked) => editMon(currentMonDraft(ctx, state, uid), 'e1', 'friendshipLocked', !!locked, ctx);

export function bagDraft(state, { item = null, name = '', emoji = '', add = 1, tags } = {}) {
  const written = String(name ?? '').trim();
  const id = written ? lookupId('items', written) ?? customItemId(written) : item;
  const known = isCustomItem(id) ? customInfo(state, id) ?? { name: written || id, emoji: splitEmoji(emoji).emoji || DEFAULT_EMOJI } : null;
  const custom = known && tags !== undefined ? { ...known, tags: CUSTOM_TAGS.filter(tag => tags.includes(tag)) } : known;
  const now = id ? state?.bag?.[id] ?? 0 : 0;
  return {
    v: 1, kind: DEBUG_KIND, mons: [], warnings: [], pool: [],
    bag: id ? { [id]: { count: now + Number(add), from: 'user' } } : {}, base: { bag: id ? { [id]: now } : {} }, add: Number(add), item: id,
    customItems: custom ? { [id]: custom } : {},
  };
}

const monAt = (draft, key) => draft.mons.find(m => m.key === key) ?? fail('notInDraft', { key });

function editValue(sim, field, value) {
  switch (field) {
    case 'species': return speciesOf(value) ?? String(value ?? '').trim();
    case 'name': return String(value ?? '').trim();
    case 'level': return value === null || value === undefined || value === '' ? null : Number(value);
    case 'gender': return value === 'M' || value === 'F' ? value : '';
    case 'shiny': return !!value;
    case 'nature': return storyNames.natures[norm(value)] ?? (sim.Dex.natures.get(String(value ?? '')).exists ? sim.Dex.natures.get(String(value)).name : String(value ?? ''));
    case 'ability': { const id = nameId('abilities', value); return id ? sim.Dex.abilities.get(id).name : String(value ?? ''); }
    case 'item': return !value || toID(value) === 'none' ? '' : nameId('items', value) ?? String(value);
    case 'moves': return (Array.isArray(value) ? value : String(value ?? '').split(/[,，、/]/)).map(m => String(m).trim()).filter(Boolean).map(m => nameId('moves', m) ?? m);
    case 'ivs': case 'evs': return Object.fromEntries(STATS.map(s => [s, Number(value?.[s])]));
    case 'teraType': return storyNames.types[norm(value)] ?? (sim.Dex.types.get(String(value ?? '')).exists ? sim.Dex.types.get(String(value)).name : String(value ?? ''));
    case 'hpPercent': return Number(value);
    case 'status': return String(value ?? '');
    case 'place': return value;
    case 'friendship': case 'eggCycles': return Number(value);
    case 'friendshipLocked': return value === true;
  }
  return fail('badEditField', { field });
}

export function editMon(draft, key, field, value, ctx) {
  const next = clone(draft);
  const mon = monAt(next, key);
  if (!MON_FIELDS.includes(field) && !(DEBUG_FIELDS.includes(field) && field in mon)) fail('badEditField', { field });
  if (mon.egg && field !== 'place') fail('badEditField', { field });
  const v = editValue(ctx.sim, field, value);
  if (field in mon.set && field !== 'place') mon.set[field] = v; else mon[field] = v;
  mon.from[field] = 'user';

  const blanks = SET_FIELDS.filter(f => mon.set[f] === null || (f === 'moves' && !mon.set.moves?.length));
  fillAuto(mon, ctx, [...(field === 'species' ? BY_SPECIES : field === 'level' ? BY_LEVEL : []), ...blanks]);
  if (['species', 'name', 'level'].includes(field)) rematch(next, ctx);
  mon.problems = monProblems(mon, ctx, next.kind);
  return next;
}

export const canTake = (mon, action) => ACTIONS.includes(action) && !(mon.egg && action === 'add');

export function setAction(draft, key, action) {
  const next = clone(draft);
  const mon = monAt(next, key);
  if (!canTake(mon, action)) fail('badAction', { action });
  mon.action = action;
  return next;
}

export function setBag(draft, item, count) {
  const next = clone(draft);
  const id = nameId('items', item) ?? itemId(item);
  const n = Number(count);
  if (n === 0) delete next.bag[id]; else next.bag[id] = { count: n, from: 'user' };
  return next;
}

export function refillMon(draft, key, ctx, { seed = 0 } = {}) {
  const next = clone(draft);
  const mon = monAt(next, key);
  mon.seed = `${seed}:${key}`;
  fillAuto(mon, ctx, SET_FIELDS);
  mon.problems = monProblems(mon, ctx, next.kind);
  return next;
}

export const draftPartyCount = draft => draft.mons.filter(mon => mon.action !== 'skip' && mon.place === 'party').length;

export function draftProblems(draft, ctx) {
  const out = [];
  const targets = new Map();
  for (const mon of draft.mons) {
    if (mon.action === 'skip') continue;
    const label = note(mon.place === 'box' ? 'monInBox' : 'monInParty', { mon: labelOf(mon.set) || note('newMon') });
    for (const problem of monProblems(mon, ctx, draft.kind)) out.push(note('monProblem', { mon: label, problem }));
    if (mon.action === 'update') {
      if (!mon.match) out.push(note('noMatch', { mon: label }));
      else if (targets.has(mon.match.uid)) out.push(note('sameMatch', { mon: label, other: targets.get(mon.match.uid) }));
      else targets.set(mon.match.uid, label);
    }
  }
  if (draft.kind === DEBUG_KIND && !draft.mons.length) {
    if (!draft.item) out.push(note('pickItem'));
    else if (!Number.isSafeInteger(draft.add) || draft.add < 1) out.push(note('addCount', { add: draft.add }));
  }

  const party = draftPartyCount(draft);
  if (party > PARTY_MAX) out.push(note('partyOver', { max: PARTY_MAX, count: party }));
  for (const [id, { count }] of Object.entries(draft.bag)) {
    if (!knownItem(id) && !draft.customItems?.[id]) out.push(note('bagUnknown', { id }));
    if (!Number.isSafeInteger(count) || count < 0) out.push(note('bagCount', { id, count }));
  }
  return out;
}

const importShape = imp => isRecord(imp) && typeof imp.id === 'string' && isRecord(imp.at) && Array.isArray(imp.mons) && (imp.bag === undefined || isRecord(imp.bag))
  && (imp.canceled === undefined || typeof imp.canceled === 'number') && (imp.badges === undefined || (Array.isArray(imp.badges) && imp.badges.every(id => typeof id === 'string')));
const readImportsRaw = chat => readStored(chat?.scriptstate?.[IMPORT_VAR], { shape: value => Array.isArray(value.imports) && value.imports.every(importShape) });

export function readImports(chat) {
  const { status, value } = readImportsRaw(chat);
  return { status, imports: status === 'ok' ? value.imports : [] };
}

function writeImports(chat, imports) {
  chat.scriptstate ??= {};
  if (imports.length) chat.scriptstate[IMPORT_VAR] = JSON.stringify({ v: 1, imports });
  else delete chat.scriptstate[IMPORT_VAR];
}

const locks = m => m.from.friendshipLocked === 'user' && m.friendshipLocked === true;

export function commitImport(chat, draft, ctx, { now = Date.now() } = {}) {
  const problems = draftProblems(draft, ctx);
  if (problems.length) throw refusal(problems);
  return appendImport(chat, now, JSON.stringify([draft.mons, draft.bag]), id => {
    const mons = draft.mons.filter(m => m.action !== 'skip').map((m, n) => ({
      action: m.action, uid: m.action === 'update' ? m.match.uid : `i${hashKey(`${id}:${n}`)}`, place: m.place,
      set: { ...Object.fromEntries(SET_FIELDS.map(f => [f, clone(m.set[f])])), item: m.set.item ? itemId(m.set.item) : '', moves: m.set.moves.map(toID) },
      hpPercent: m.hpPercent, status: m.status, ...(m.from.friendship === 'user' || locks(m) ? { friendship: m.friendship } : {}),
      ...(m.from.friendshipLocked === 'user' ? { friendshipLocked: m.friendshipLocked } : {}),
      ...(m.from.eggCycles === 'user' ? { eggCycles: m.eggCycles } : {}), from: { ...m.from },
    }));
    const counts = Object.fromEntries(Object.entries(draft.bag).map(([itemId, e]) => [itemId, e.count]));
    const bag = Object.fromEntries([...new Set([...Object.keys(draft.base.bag), ...Object.keys(counts)])]
      .filter(itemId => (counts[itemId] ?? 0) !== (draft.base.bag[itemId] ?? 0)).map(itemId => [itemId, counts[itemId] ?? 0]));
    return { mons, bag, ...(draft.kind ? { kind: draft.kind } : {}), ...(Object.keys(draft.customItems ?? {}).length ? { customItems: clone(draft.customItems) } : {}) };
  });
}

export const commitDebugHeal = (chat, { now = Date.now() } = {}) => appendImport(chat, now, 'heal', () => ({ mons: [], bag: {}, kind: DEBUG_KIND, heal: 'party' }));

export const commitDebugBadges = (chat, badges, { now = Date.now() } = {}) => appendImport(chat, now, `badges:${badges.join(',')}`,
  () => ({ mons: [], bag: {}, kind: DEBUG_KIND, badges: [...badges] }));

function appendImport(chat, now, key, body) {
  const { status, imports } = readImports(chat);
  if (isUnreadable(status)) throw failed('unreadable');
  const messages = chat?.message ?? [];
  let id = `imp${hashKey(`${now}:${imports.length}:${key}`)}`;
  for (let n = 2; imports.some(imp => imp.id === id); n++) id = `imp${hashKey(`${now}:${imports.length}:${n}`)}`;
  const imp = { id, time: now, at: anchorAtEnd(messages), ...body(id) };
  writeImports(chat, [...imports, imp]);
  return imp;
}

export const inForce = imp => !imp.canceled;

export function cancelImport(chat, id, { now = Date.now() } = {}) {
  const { status, imports } = readImports(chat);
  if (status !== 'ok' || !imports.some(imp => imp.id === id && inForce(imp))) return false;
  writeImports(chat, imports.map(imp => (imp.id === id ? { ...imp, canceled: now } : imp)));
  return true;
}

export const ANCHOR_EARLIER = 3;

export function anchorAtEnd(messages) {
  const index = messages.length - 1;
  const earlier = messages.slice(Math.max(0, index - ANCHOR_EARLIER), Math.max(0, index)).map(m => m?.chatId).filter(isChatId).reverse();
  return { chatId: messages[index]?.chatId ?? null, index, ...(earlier.length ? { earlier } : {}) };
}
const isChatId = id => id !== null && id !== undefined;

export function importPlace(messages, record) {
  const { chatId, index, earlier } = record.at ?? {};
  const where = id => (isChatId(id) ? messages.findIndex(m => m?.chatId === id) : -1);
  const found = where(chatId);
  if (found >= 0) return found;
  for (const id of Array.isArray(earlier) ? earlier : []) {
    const place = where(id);
    if (place >= 0) return place;
  }
  return Math.max(-1, Math.min(Number.isInteger(index) ? index : -1, messages.length - 1));
}

function updatedMon(ctx, old, set) {
  const mon = { ...clone(old), set };
  mon.pp = Object.fromEntries(Object.entries(old.pp ?? {}).filter(([id]) => set.moves.includes(id)));
  const ppUps = Object.entries(old.ppUps ?? {}).filter(([id]) => set.moves.includes(id));
  if (ppUps.length) mon.ppUps = Object.fromEntries(ppUps); else delete mon.ppUps;
  if (old.set.nature !== set.nature) delete mon.natureOrig;
  if (!STATS.every(s => old.set.ivs?.[s] === set.ivs[s])) delete mon.hyper;
  if (toID(old.set.species) === toID(set.species) && old.set.level === set.level) mon.pending = { ...old.pending, moves: old.pending.moves.filter(id => !set.moves.includes(id)) };
  else {
    const { exp, pending } = newMon(ctx, set, old.uid);
    Object.assign(mon, { exp, pending });
    delete mon.counts;
  }
  return mon;
}

export function applyImport(state, imp, ctx) {
  if (imp.kind === HANDBACK_KIND) return clone(imp.state);
  const { sim } = ctx;
  const next = clone(state);
  const partyOrder = [];
  for (const entry of imp.mons ?? []) {
    let mon;
    if (entry.action === 'update') {
      const list = [next.party, next.box].find(l => l.some(m => m.uid === entry.uid));
      if (!list) continue;
      const index = list.findIndex(m => m.uid === entry.uid);
      mon = updatedMon(ctx, list[index], clone(entry.set));
      const target = entry.place === 'box' ? next.box : next.party;
      if (target === list) list[index] = mon;
      else { list.splice(index, 1); target.push(mon); }
    } else if (entry.action === 'add') {
      mon = newMon(ctx, clone(entry.set), uniqueUid(next, entry.uid));
      (entry.place === 'box' ? next.box : next.party).push(mon);
    } else continue;
    mon.hp = hpFromPercent(sim, mon.set, entry.hpPercent ?? 100, false, stateFormat(next));
    mon.status = mon.hp === 0 ? 'fnt' : entry.status || '';

    if (entry.friendship !== undefined && !isEgg(mon)) { mon.friendship = entry.friendship; delete mon.friendshipCarry; }
    if (entry.friendshipLocked !== undefined && !isEgg(mon)) {
      if (entry.friendshipLocked === true) mon.friendshipLocked = true; else delete mon.friendshipLocked;
    }
    if (entry.eggCycles !== undefined && isEgg(mon)) mon.egg.cycles = entry.eggCycles;
    if (!isEgg(mon)) markDex(next, sim, mon.set.species, true);
    if (entry.place !== 'box') partyOrder.push(mon.uid);
  }
  if (imp.kind !== DEBUG_KIND) {
    const first = partyOrder.map(uid => next.party.find(m => m.uid === uid)).filter(Boolean);
    next.party = [...first, ...next.party.filter(m => !partyOrder.includes(m.uid))];
  }
  next.box.push(...next.party.splice(PARTY_MAX));
  for (const [id, count] of Object.entries(imp.bag ?? {})) {
    if (count > 0) next.bag[id] = count; else delete next.bag[id];
  }

  for (const [id, info] of Object.entries(isRecord(imp.customItems) ? imp.customItems : {})) addCustomItem(next, id, info);
  tidyCustomItems(next);
  tidyBreeding(next);
  if (imp.heal === 'party') healParty(next, ctx);
  if (imp.badges) next.badges = [...imp.badges];
  return next;
}
