import { UI_VARS, CARD_FRAME, crossIcon } from './ui-css.js';
import { loadFont } from '../../view/fonts.js';
import { FONT, noteRule } from '../../story/card.mjs';
import { SHEET_FONT } from '../../story/style.mjs';
import { WHAT, failureText, ruleText } from '../../story/failure.mjs';
import { say, sayer, perLang } from '../../story/screen-text.mjs';
import { TAB_COLOR } from '../../story/panel-html.mjs';
import { itemName, bagItemName, itemLabel, namesFor } from '../../story/panel.mjs';
import { natureName, statName, moneyText } from '../../story/diary.mjs';
import { editMon, setAction, setBag, refillMon, draftProblems, draftPartyCount, bagDraft } from '../../story/import.mjs';
import { isCustomItem, customText, DEFAULT_EMOJI } from '../../story/custom-items.mjs';
import { learnableTms } from '../../story/item-info.mjs';
import { STATS, MAX_LEVEL, MAX_MOVES, MAX_IV, PARTY_MAX, STATUS_IDS, displayName, toID } from '../../engine/mon.mjs';
import { EV_STAT_MAX, EV_TOTAL_MAX } from '../../engine/rules.mjs';
import storyNames from '../../data/story-names.json' with { type: 'json' };
import itemTable from '../../data/names/items.json' with { type: 'json' };

export const FROM_LABEL = perLang(t => Object.freeze(Object.fromEntries(['record', 'auto', 'user', 'ai', 'current'].map(from => [from, t(`import.from.${from}`)]))));

export const ACTIONS = perLang(t => Object.freeze(['add', 'update', 'skip'].map(id => [id, t(`import.action.${id}`)])));
const PLACES = perLang(t => Object.freeze(['party', 'box'].map(id => [id, t(`import.place.${id}`)])));

const GROUPS = [
  { id: 'basic', fields: ['species', 'name', 'level'] },
  { id: 'battle', fields: ['nature', 'ability', 'moves', 'item'], details: true },
  { id: 'now', fields: ['hpPercent', 'status'], details: true },
  { id: 'look', fields: ['gender', 'shiny'], details: true },
  { id: 'advanced', fields: ['ivs', 'evs', 'teraType'], details: true },
];
export const FIELD_GROUPS = perLang(t => Object.freeze(GROUPS.map(g => Object.freeze({ ...g, label: t(`import.group.${g.id}`) }))));

export const FIELD_LABEL = perLang(t => Object.freeze(Object.fromEntries(['place', ...GROUPS.flatMap(g => g.fields)].map(f => [f, t(`rule.import.field.${f}`)]))));

// Fields shown as small badges on a list row (place is shown by the section the row is in)
const ROW_FIELDS = GROUPS.flatMap(g => g.fields);
const ROW_SHORT = perLang(t => Object.fromEntries(ROW_FIELDS.map(f => [f, t(`import.short.${f}`)])));
const NICKNAME_MAX = 20;
const NEW_ITEM_MAX = 40;
const BAG_COUNT_MAX = 999;
export const STATUS_CHOICES = perLang(t => Object.freeze([['', t('import.none')], ...[...STATUS_IDS].filter(Boolean).map(id => [id, t(`import.status.${id}`)])]));
const SHINY_CHOICES = perLang(t => Object.freeze([[false, t('import.no')], [true, t('import.yes')]]));
const TYPE_KO = Object.fromEntries(Object.entries(storyNames.types).filter(([k]) => /[가-힣]/.test(k)).map(([ko, en]) => [en, ko]));

export const typeName = (type, lang) => (lang === 'ko' ? TYPE_KO[type] ?? type : type);
const GENDER_LABEL = perLang(t => ({ M: t('import.gender.M'), F: t('import.gender.F'), '': t('import.none') }));

function screenNames(sim, lang) {
  const names = namesFor(lang, sim);
  return { species: names.species, moves: names.move, abilities: names.ability, item: id => itemName(id, names), bagItem: id => bagItemName(id, names),
    nature: name => natureName(name, lang), names };
}

const itemLabelIn = (holder, id, sim, lang, { bag = false } = {}) => itemLabel(holder, id, namesFor(lang, sim), { bag });

function pickList(entries, fallback) {
  const count = new Map();
  for (const e of entries) count.set(e.label, (count.get(e.label) ?? 0) + 1);
  const options = entries.map(e => ({ key: e.key, label: count.get(e.label) > 1 ? `${e.label} (${e.hint})` : e.label, hint: e.hint }));
  const byKey = new Map(options.map(o => [o.key, o.label]));
  const byText = new Map();
  for (const o of options) for (const text of [o.label, o.hint, o.key]) if (text && !byText.has(norm(text))) byText.set(norm(text), o.key);
  return {
    options,
    label: key => byKey.get(key) ?? (key ? String(key) : ''),
    find: text => byText.get(norm(text)) ?? fallback?.(text) ?? null,
  };
}
const norm = text => String(text ?? '').normalize('NFC').trim().toLowerCase();
const available = entry => entry.exists && (!entry.isNonstandard || entry.isNonstandard === 'Past');
const cache = new WeakMap();

export function choicesFor(sim, lang) {
  const { Dex } = sim;
  let byLang = cache.get(Dex);
  if (!byLang) cache.set(Dex, byLang = new Map());
  let lists = byLang.get(lang);
  if (lists) return lists;
  const t = sayer(lang), n = screenNames(sim, lang);
  const species = Dex.species.all().filter(s => available(s) && s.num > 0 && !s.battleOnly && !/Gmax|Totem/.test(s.forme));

  const items = Object.keys(itemTable).map(id => ({ id, engine: Dex.items.get(id) }));
  const english = ({ id, engine }) => (engine.exists ? engine.name : itemTable[id].en ?? id);
  const speciesOf = text => { const s = Dex.species.get(String(text ?? '')); return s.exists && species.includes(s) ? s.name : null; };
  const stat = s => statName(s, lang);
  lists = {
    species: pickList(species.map(s => ({ key: s.name, label: n.species(s.id), hint: s.name })), speciesOf),

    moves: pickList(Dex.moves.all().filter((m, i, all) => available(m) && !m.isZ && !m.isMax && all.findIndex(o => o.id === m.id) === i)
      .map(m => ({ key: m.id, label: n.moves(m.id), hint: m.name }))),
    items: pickList(items.filter(item => available(item.engine)).map(item => ({ key: item.id, label: n.item(item.id), hint: english(item) }))),
    bag: pickList(items.map(item => ({ key: item.id, label: n.bagItem(item.id), hint: english(item) }))),
    abilities: pickList(Dex.abilities.all().filter(a => available(a) && a.id !== 'noability').map(a => ({ key: a.name, label: n.abilities(a.name), hint: a.name }))),
    natures: Dex.natures.all().map(nt => [nt.name, nt.plus ? t('import.natureStats', { nature: n.nature(nt.name), plus: stat(nt.plus), minus: stat(nt.minus) })
      : t('import.natureNeutral', { nature: n.nature(nt.name) })])
      .sort((a, b) => a[1].localeCompare(b[1], lang)),
    types: Dex.types.all().filter(type => available(type)).map(type => [type.name, typeName(type.name, lang)]),
  };
  byLang.set(lang, lists);
  return lists;
}

export function abilityChoices(sim, speciesName, value, lang) {
  const species = sim.Dex.species.get(speciesName);
  const n = screenNames(sim, lang);
  const marks = { H: 'import.abilityHidden', S: 'import.abilitySpecial' };
  const list = species.exists ? Object.entries(species.abilities).map(([slot, name]) => [name, marks[slot] ? say(lang, marks[slot], { ability: n.abilities(name) }) : n.abilities(name)]) : [];
  if (value && !list.some(([name]) => name === value)) list.push([value, n.abilities(value)]);
  return list;
}

const HANGUL_FIRST = 0xac00, HANGUL_COUNT = 11172, PER_CHOSEONG = 588, CHOSEONG_FIRST = 0x1100, CHOSEONG_COUNT = 19;
const isChoseong = c => c.charCodeAt(0) - CHOSEONG_FIRST >= 0 && c.charCodeAt(0) - CHOSEONG_FIRST < CHOSEONG_COUNT;

const choseongOf = text => [...text].map(c => {
  const n = c.charCodeAt(0) - HANGUL_FIRST;
  return n >= 0 && n < HANGUL_COUNT ? String.fromCharCode(CHOSEONG_FIRST + Math.floor(n / PER_CHOSEONG)) : c;
}).join('');
const squash = text => norm(text).replace(/\s+/g, '');

export function matchesQuery(entry, query) {
  const q = squash(query);
  if (!q) return true;
  if ([entry.label, entry.hint, entry.key].some(text => text && squash(text).includes(q))) return true;
  const initials = q.normalize('NFKC');
  return [...initials].every(isChoseong) && choseongOf(squash(entry.label)).includes(initials);
}

export function moveGroups(sim, levelUp, speciesName, taken, lang) {
  const t = sayer(lang);
  const lists = choicesFor(sim, lang);
  const species = sim.Dex.species.get(speciesName);
  const entry = (id, sub) => ({ key: id, label: lists.moves.label(id), hint: sim.Dex.moves.get(id).name, sub: taken.includes(id) ? `${sub ? `${sub} · ` : ''}${t('import.taken')}` : sub, disabled: taken.includes(id) });
  const table = species.exists ? levelUp?.[species.id] ?? levelUp?.[toID(species.changesFrom || species.baseSpecies)] ?? [] : [];
  const first = new Map();
  for (const [level, move] of table) if (!first.has(move) || level < first.get(move)) first.set(move, level);
  const byLevel = [...first].sort((a, b) => a[1] - b[1]).map(([move, level]) => entry(move, level === 0 ? t('import.onEvolve') : `Lv${level}`));
  const tms = species.exists ? learnableTms(sim, species.name).filter(tm => !first.has(tm.move)).map(tm => entry(tm.move, t('import.tmNumber', { n: String(tm.n).padStart(3, '0') }))) : [];
  const known = new Set([...first.keys(), ...tms.map(e => e.key)]);
  const rest = lists.moves.options.filter(o => !known.has(o.key)).map(o => entry(o.key, ''));
  return [
    { label: t('import.moves.levelUp'), entries: byLevel },
    { label: t('import.moves.tm'), entries: tms },
    { label: t('import.moves.other'), entries: rest, searchOnly: true },
  ];
}

export function abilityGroups(sim, speciesName, lang) {
  const lists = choicesFor(sim, lang);
  const own = abilityChoices(sim, speciesName, '', lang).map(([key, label]) => ({ key, label, hint: key }));
  const mine = new Set(own.map(e => e.key));
  return [
    { label: say(lang, 'import.abilities.own'), entries: own },
    { label: say(lang, 'import.abilities.other'), entries: lists.abilities.options.filter(o => !mine.has(o.key)), searchOnly: true },
  ];
}

export function genderChoices(sim, speciesName, lang) {
  const species = sim.Dex.species.get(speciesName);
  const fixed = species.exists ? species.gender : '';
  const ids = fixed === 'N' ? [''] : fixed ? [fixed] : ['M', 'F'];
  return ids.map(id => [id, GENDER_LABEL(lang)[id]]);
}

// Name on a row: nickname, else the species name in lang; the text as found when the species is unknown
export function monTitle(mon, sim, lang) {
  const species = sim.Dex.species.get(mon.set.species);
  return species.exists ? displayName(sim.Dex, screenNames(sim, lang).names, mon.set.species, mon.set.name) : (mon.set.name || String(mon.set.species ?? ''));
}

export function monSub(mon, sim, lang) {
  const t = sayer(lang);
  const species = sim.Dex.species.get(mon.set.species);
  const kind = species.exists ? choicesFor(sim, lang).species.label(species.name) : mon.set.species ? t('rule.import.unknownSpecies', { species: mon.set.species }) : t('import.speciesBlank');
  return `${kind} · ${Number.isInteger(mon.set.level) ? `Lv${mon.set.level}` : t('import.levelBlank')}`;
}

export function matchLabel(draft, mon, sim, lang) {
  const mine = (draft.pool ?? []).find(p => p.uid === mon.match.uid);
  return mine ? `${monTitle({ set: { species: mine.species, name: mine.name } }, sim, lang)} Lv${mine.level}` : mon.match.label;
}

export function applySummary(draft, lang) {
  const t = sayer(lang);
  const n = action => draft.mons.filter(m => m.action === action).length;
  const parts = [t('import.sum.add', { n: n('add') }), t('import.sum.update', { n: n('update') }), n('skip') ? t('import.sum.skip', { n: n('skip') }) : '',
    t('import.sum.bag', { n: Object.keys(draft.bag).length })].filter(Boolean);
  return parts.join(' · ');
}

export function quickSummary(draft, ctx, lang) {
  const { sim } = ctx;
  const kept = draft.mons.filter(m => m.action !== 'skip');
  const label = m => {
    const found = sim.Dex.species.get(m.set.species);
    const species = found.exists ? choicesFor(sim, lang).species.label(found.name) : String(m.set.species ?? '');
    const name = m.set.name && m.set.name !== species ? say(lang, 'import.quick.nick', { name: m.set.name, species }) : species;
    return Number.isInteger(m.set.level) ? `${name} Lv${m.set.level}` : name;
  };
  return { party: kept.filter(m => m.place === 'party').map(label), box: kept.filter(m => m.place === 'box').length, problems: draftProblems(draft, ctx).length };
}

export const actionChoices = (mon, lang) => ACTIONS(lang).filter(([id]) => id !== 'update' || mon.match);

const MODE_WHAT = { import: WHAT.import, create: WHAT.debugAdd, edit: WHAT.debugEdit, bag: WHAT.debugAdd };
export const MODES = perLang(t => Object.freeze(Object.fromEntries(Object.entries(MODE_WHAT).map(([mode, what]) => [mode, {
  ...Object.fromEntries(['title', 'apply', 'busy', 'before', 'untouched'].map(key => [key, t(`import.mode.${mode}.${key}`)])), what,
  ...(mode === 'create' ? { goes: place => t(`import.goes.${place === 'box' ? 'box' : 'party'}`) } : mode === 'edit' ? { goes: () => t('import.goes.edit') } : {}),
}]))));

export const createSummary = (draft, sim, lang) => {
  const m = draft.mons[0];
  return say(lang, `import.create.${m.action === 'update' ? 'update' : m.place === 'box' ? 'box' : 'party'}`, { mon: monTitle(m, sim, lang), level: m.set.level });
};

export function bagGroups(sim, state, lang) {
  const t = sayer(lang);
  const owned = id => state?.bag?.[id] ?? 0;
  const own = Object.keys(state?.bag ?? {}).filter(id => isCustomItem(id) && owned(id) > 0)
    .map(id => ({ key: id, label: (customText(state, id) ?? itemLabelIn(state, id, sim, lang)).trim(), hint: '', sub: t('import.inBag', { n: owned(id) }) }));
  return [
    ...(own.length ? [{ label: t('import.storyItems'), entries: own }] : []),
    { label: t('import.items'), entries: choicesFor(sim, lang).bag.options.map(o => (owned(o.key) ? { ...o, sub: t('import.inBag', { n: owned(o.key) }) } : o)) },
  ];
}

// Bag mode footer once nothing is left to fix: "puts in 3 Potions (2 now -> 5)"
export function bagSummary(draft, state, sim, lang) {
  const [id, { count }] = Object.entries(draft.bag)[0];
  const name = draft.customItems[id]?.name ?? itemLabelIn(state, id, sim, lang, { bag: true });
  return say(lang, 'import.bagSummary', { name, add: draft.add, now: draft.base.bag[id], count });
}

const IMPORT_Z = 310;

const PICK_SHOWN = 150;
const SPRITE = id => `https://play.pokemonshowdown.com/sprites/gen5/${encodeURIComponent(id)}.png`;
const FROM_COLOR = { record: '#3d7196', auto: '#7d8c98', user: TAB_COLOR.bag, ai: '#7b5ea7', current: '#4a8a5a' };
const BACK = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.5 3l-5 5 5 5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const NEXT = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const CSS = `
  .pkb-import { ${UI_VARS}
    position:fixed; inset:0; z-index:${IMPORT_Z}; display:flex; justify-content:center; align-items:flex-start; padding:24px 16px; overflow:auto;
    background:rgba(15,24,34,.82); font:14px/1.45 ${FONT}; font-weight:400; color:#14304a; }
  .pkb-import * { box-sizing:border-box; }
  .pkb-import button, .pkb-import input, .pkb-import select { font:inherit; }
  .pkb-import button:focus-visible, .pkb-import input:focus-visible, .pkb-import select:focus-visible { outline:2px solid #ffcf4a; outline-offset:1px; }
  .pkb-import .card { position:relative; width:min(560px, 100%); height:760px; max-height:100%; display:flex; flex-direction:column; overflow:hidden; ${CARD_FRAME} }
  .pkb-import .hd { flex:none; display:flex; align-items:center; gap:8px; min-height:36px; padding:6px 8px 6px 12px; background:var(--navy); color:#fff; border-bottom:2.5px solid var(--navy-dark); }
  .pkb-import .hd b { flex:1; min-width:0; font-weight:400; font-size:15px; letter-spacing:.02em; }
  .pkb-import .hd button { flex:none; width:26px; height:26px; padding:0; display:flex; align-items:center; justify-content:center; border:2px solid #fff; border-radius:7px;
    background:transparent; color:#fff; cursor:pointer; }
  .pkb-import .hd button svg { width:12px; height:12px; }
  .pkb-import .hd .back[hidden] { display:none; }
  .pkb-import .body { flex:1; min-height:0; overflow:auto; padding:10px 12px 14px; }
  .pkb-import .intro { margin:0 0 8px; font-size:13px; color:#3b5a73; white-space:pre-line; }
  ${noteRule('.pkb-import .warn', 'info')}
  ${noteRule('.pkb-import .err', 'error')}
  .pkb-import .warn, .pkb-import .err { margin:0 0 8px; font-size:12.5px; }
  .pkb-import .legend { display:flex; flex-wrap:wrap; gap:6px; margin:0 0 6px; font-size:12px; color:#3b5a73; }
  .pkb-import .from { display:inline-block; padding:1px 6px; border-radius:999px; color:#fff; font-size:11px; line-height:1.5; white-space:nowrap; }
  .pkb-import h3 { display:flex; align-items:center; gap:6px; margin:14px 0 6px; padding-bottom:3px; font-size:14px; font-weight:400; border-bottom:2.5px solid; }
  .pkb-import h3 .n { color:#5b768b; font-size:12px; }
  .pkb-import h3 .n.over { color:var(--red); }
  .pkb-import .row-act.place { padding-top:3px; }
  .pkb-import .opt:disabled { color:#c3cdd5; cursor:default; }
  .pkb-import .empty { margin:2px 0 6px; color:#7d8c98; font-size:13px; }
  /* Pokemon rows */
  .pkb-import .mon { margin:0 0 7px; border:2px solid #789db7; border-radius:10px; background:#fff; box-shadow:0 2px 0 #466c87; }
  .pkb-import .mon.bad { border-color:var(--red); box-shadow:0 2px 0 var(--red-dark); }
  .pkb-import .mon.skip { opacity:.55; }
  .pkb-import .mon .open { width:100%; display:grid; grid-template-columns:44px 1fr 16px; align-items:center; gap:8px; padding:6px 8px; border:0; background:transparent; color:inherit;
    text-align:left; cursor:pointer; border-radius:8px 8px 0 0; }
  .pkb-import .mon .open:hover { background:#f1f7fb; }
  .pkb-import .open > svg { width:14px; height:14px; color:#789db7; }
  .pkb-import .pic { width:44px; height:44px; display:flex; align-items:center; justify-content:center; border-radius:8px; background:#dbe8f2; overflow:hidden; }
  .pkb-import .pic img { width:56px; height:56px; image-rendering:pixelated; }
  .pkb-import .who { min-width:0; display:flex; flex-direction:column; gap:2px; }
  .pkb-import .who b { font-weight:400; font-size:14px; overflow-wrap:anywhere; }
  .pkb-import .who .sub { font-size:12px; color:#5b768b; }
  .pkb-import .chips { display:flex; flex-wrap:wrap; gap:3px; margin-top:2px; }
  .pkb-import .chips .from { padding:0 5px; font-size:10.5px; }
  .pkb-import .probs { margin:2px 0 0; padding:0; list-style:none; color:var(--red); font-size:12px; }
  .pkb-import .probs.err { margin:0 0 8px; padding:5px 10px; }
  .pkb-import .row-act { display:flex; flex-wrap:wrap; align-items:center; gap:4px 6px; padding:4px 8px 6px; border-top:1.5px dashed #b9cddc; font-size:12px; color:#3b5a73; }
  .pkb-import .row-act .match { flex:1 1 140px; min-width:0; overflow-wrap:anywhere; }
  /* Text choices (the settings window look: chosen = white on red) */
  .pkb-import .opts { display:inline-flex; flex-wrap:wrap; gap:2px; }
  .pkb-import .opt { min-width:38px; padding:4px 7px 3px; border:none; border-radius:6px; background:transparent; color:#8b9ba8; font-size:13px; cursor:pointer; }
  .pkb-import .opt[aria-checked="false"]:hover { color:#23435f; }
  .pkb-import .opt[aria-checked="true"] { color:#fff; background:var(--red); box-shadow:0 2px 0 var(--red-dark); }
  .pkb-import .btn { flex:none; padding:5px 9px 4px; border:2px solid var(--navy); border-radius:7px; background:#fff; color:#23435f; font-size:12px; box-shadow:0 2px 0 var(--navy-dark); cursor:pointer; }
  .pkb-import .btn:not(:disabled):active { transform:translateY(2px); box-shadow:none; }
  .pkb-import .btn:disabled { opacity:.45; cursor:default; box-shadow:none; }
  .pkb-import input, .pkb-import select { min-width:0; width:100%; font-size:14px; padding:5px 7px; border:2px solid var(--navy); border-radius:7px; background:#fff; color:#14304a; }
  /* A field that opens the picker */
  .pkb-import .pickbtn { width:100%; min-width:0; display:flex; align-items:center; gap:6px; padding:5px 7px; border:2px solid var(--navy); border-radius:7px; background:#fff;
    color:#14304a; font-size:14px; text-align:left; cursor:pointer; }
  .pkb-import .pickbtn:hover { background:#f1f7fb; }
  .pkb-import .pickbtn .t { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .pkb-import .pickbtn .t.ph { color:#8b9ba8; }
  .pkb-import .pickbtn > svg { flex:none; width:12px; height:12px; color:#789db7; }
  /* Picker: header, search box on top, grouped list (covers the card) */
  .pkb-import .pick { position:absolute; inset:0; z-index:2; display:flex; flex-direction:column; background:#f6fafd; }
  .pkb-import .pick .search { flex:none; padding:8px 12px; border-bottom:2px solid #b9cddc; background:#eef4f9; }
  .pkb-import .pick .items { flex:1; min-height:0; overflow:auto; padding:2px 12px 14px; }
  .pkb-import .pick h4 { margin:12px 0 2px; font-size:12.5px; font-weight:400; color:var(--red); }
  .pkb-import .pick .it { width:100%; display:flex; align-items:baseline; gap:8px; padding:8px 8px 7px; border:0; border-bottom:1.5px dashed #d3e0ea; background:transparent;
    color:#14304a; font-size:14px; text-align:left; cursor:pointer; }
  .pkb-import .pick .it:not(:disabled):hover { background:#e4eff7; }
  .pkb-import .pick .it[aria-selected="true"] { color:#fff; background:var(--red); border-radius:6px; }
  .pkb-import .pick .it[aria-selected="true"] .en, .pkb-import .pick .it[aria-selected="true"] .s { color:#ffe3e3; }
  .pkb-import .pick .it:disabled { color:#9aa8b4; cursor:default; }
  .pkb-import .pick .it .en { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:11.5px; color:#7d8c98; }
  .pkb-import .pick .it .s { margin-left:auto; flex:none; font-size:12px; color:#5b768b; }
  .pkb-import .pick .more { margin:10px 0 0; font-size:12px; color:#5b768b; }
  /* Asked before closing with edits (the same layer as the picker) */
  .pkb-import .pick.ask { justify-content:center; align-items:center; padding:16px; background:rgba(15,24,34,.6); }
  .pkb-import .ask .box { width:min(340px, 100%); padding:14px 14px 12px; border:2.5px solid var(--navy); border-radius:12px; background:#fff; box-shadow:0 3px 0 var(--navy-dark); }
  .pkb-import .ask p { margin:0 0 12px; font-size:14px; white-space:pre-line; }
  .pkb-import .ask p small { font-size:12px; color:#5b768b; }
  .pkb-import .ask .row { display:flex; justify-content:flex-end; gap:8px; }
  /* Bag */
  .pkb-import .bag { display:grid; grid-template-columns:1fr 72px auto 28px; align-items:center; gap:6px 6px; }
  .pkb-import .bag .name { min-width:0; overflow-wrap:anywhere; }
  .pkb-import .bag .x { width:26px; height:26px; padding:0; display:flex; align-items:center; justify-content:center; border:0; border-radius:50%; background:#e4edf4; color:var(--navy); cursor:pointer; }
  .pkb-import .bag .x svg { width:9px; height:9px; }
  .pkb-import .bag-add { margin-top:8px; }
  /* Editor */
  .pkb-import .ed-top { display:flex; align-items:center; gap:10px; margin-bottom:8px; }
  .pkb-import .ed-top .who { flex:1; }
  .pkb-import fieldset { margin:0 0 10px; padding:6px 10px 8px; border:2px solid #b9cddc; border-radius:10px; background:#fbfdfe; min-width:0; }
  .pkb-import legend { padding:0 6px; color:var(--red); font-size:13px; }
  .pkb-import .f { display:grid; grid-template-columns:92px 1fr; align-items:start; gap:4px 8px; padding:5px 0; border-bottom:1.5px dashed #d3e0ea; }
  .pkb-import .f:last-child { border-bottom:none; }
  .pkb-import .f .lab { display:flex; flex-direction:column; align-items:flex-start; gap:3px; padding-top:5px; font-size:13px; }
  .pkb-import .f .ctl { min-width:0; display:flex; flex-direction:column; gap:4px; }
  .pkb-import .f .note { font-size:11.5px; color:#5b768b; }
  .pkb-import .f .note.bad { color:var(--red); }
  .pkb-import .moves { display:grid; grid-template-columns:1fr 1fr; gap:4px; }
  .pkb-import .more-btn { width:100%; display:flex; align-items:baseline; gap:8px; margin:0 0 10px; padding:9px 12px; border:2px dashed #789db7; border-radius:10px;
    background:#f1f7fb; color:#23435f; font-size:14px; text-align:left; cursor:pointer; }
  .pkb-import .more-btn:hover { background:#e4eff7; }
  .pkb-import .more-btn .what { flex:1; min-width:0; font-size:12px; color:#5b768b; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .pkb-import .more-btn > svg { flex:none; align-self:center; width:12px; height:12px; color:#789db7; transform:rotate(90deg); }
  .pkb-import .more-btn[aria-expanded="true"] > svg { transform:rotate(-90deg); }
  .pkb-import .stats { display:grid; grid-template-columns:repeat(3, 1fr); gap:4px 6px; }
  .pkb-import .stats label { display:flex; flex-direction:column; gap:1px; font-size:11px; color:#5b768b; }
  /* Debug modes: where the new Pokemon goes; the emoji field and picture */
  .pkb-import .goes { margin:0 0 8px; padding:6px 10px; border:2px dashed #c98a1d; border-radius:10px; background:#fff8e6; color:#6b4a00; font-size:13px; }
  .pkb-import .emo { font-family:"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif; }
  .pkb-import .emoji-in { width:4.5em; font-size:18px; text-align:center; }
  .pkb-import .pick .new { display:flex; flex-direction:column; align-items:flex-start; gap:8px; margin:12px 0 0; }
  .pkb-import .pick .new p { margin:0; font-size:13px; color:#5b768b; }
  /* Footer: what apply does, problems left, the apply button */
  .pkb-import .ft { flex:none; display:flex; align-items:center; gap:10px; padding:8px 12px 10px; border-top:2.5px solid var(--navy); background:#eef4f9; }
  .pkb-import .ft .sum { flex:1; min-width:0; font-size:12.5px; color:#3b5a73; white-space:pre-line; }
  .pkb-import .ft .sum.bad { color:var(--red); }
  .pkb-import .apply { flex:none; padding:8px 14px; border:2px solid var(--red-dark); border-radius:9px; background:var(--red-fill); color:#fff; box-shadow:0 3px 0 var(--red-dark);
    text-shadow:0 1px 0 #0004; cursor:pointer; font-size:14px; }
  .pkb-import .apply:disabled { opacity:.45; cursor:default; box-shadow:none; }
  .pkb-import .apply:not(:disabled):active { transform:translateY(2px); box-shadow:0 1px 0 var(--red-dark); }
  /* Quick mode: a short card in the middle */
  .pkb-import.quick { align-items:center; }
  .pkb-import.quick .card { width:min(420px, 100%); height:auto; }
  .pkb-import .ft[hidden] { display:none; }
  .pkb-import .q-body h3 { margin:12px 0 4px; }
  .pkb-import .q-names { margin:0 0 4px; font-size:13px; color:#23435f; overflow-wrap:anywhere; }
  .pkb-import .q-money { display:flex; justify-content:space-between; margin:12px 0 0; padding:6px 10px; border:2px solid #789db7; border-radius:9px; background:#fff; box-shadow:0 2px 0 #466c87; }
  .pkb-import .q-money b { font-weight:400; }
  .pkb-import .q-fill { margin:12px 0 0; font-size:12.5px; color:#3b5a73; }
  .pkb-import .q-fix { margin:12px 0 0; font-size:13px; color:var(--red); }
  .pkb-import .q-body .apply.big { display:block; width:100%; margin:14px 0 0; padding:11px 14px; font-size:16px; }
  .pkb-import .q-link { display:flex; align-items:center; justify-content:center; gap:4px; width:100%; margin:8px 0 0; padding:4px; border:0; background:transparent;
    color:#3d7196; font-size:12.5px; text-decoration:underline; text-underline-offset:3px; cursor:pointer; }
  .pkb-import .q-link > svg { width:10px; height:10px; }
  .pkb-import .q-note { margin:8px 0 0; font-size:11.5px; color:#7d8c98; text-align:center; }
  .pkb-import .q-body .err { margin:10px 0 0; }
  @media (max-width:640px) {
    .pkb-import { padding:0; background:#0f1822; }
    .pkb-import .card { width:100%; height:100%; border:0; border-radius:0; box-shadow:none; }
    .pkb-import input, .pkb-import select { font-size:16px; }
    .pkb-import .f { grid-template-columns:76px 1fr; }
    .pkb-import .moves { grid-template-columns:1fr; }
    .pkb-import.quick { padding:16px; background:rgba(15,24,34,.82); }
    .pkb-import.quick .card { height:auto; ${CARD_FRAME} }
  }
`;

let seq = 0;
const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.flat().filter(c => c !== null && c !== undefined && c !== false));
  return node;
};

// Replaces a node's children with a nested list of nodes (null/false left out)
const fillWith = (node, ...children) => node.replaceChildren(...children.flat(Infinity).filter(c => c !== null && c !== undefined && c !== false));
const svg = html => { const span = document.createElement('span'); span.innerHTML = html; return span.firstChild; };

function fromBadge(from, lang, text = FROM_LABEL(lang)[from]) {
  if (!from) return null;
  const badge = el('span', { className: 'from', textContent: text, title: FROM_LABEL(lang)[from] ?? '' });
  badge.style.background = FROM_COLOR[from];
  return badge;
}

export function mountImportScreen({ parent = document.body, mode: firstMode = 'import', draft: given = null, state = null, ctx, seed = () => [1, 2, 3, 4], lang, money = null,
  onApply = async () => {}, onClose = () => {} }) {
  loadFont(SHEET_FONT).catch(error => console.warn('[poke-battle] 가져오기 화면 글꼴을 올리지 못함 — 대체 글꼴로', error));
  const { sim } = ctx;
  const t = sayer(lang);
  const lists = choicesFor(sim, lang);
  let mode = firstMode;
  let text = MODES(lang)[mode === 'quick' ? 'import' : mode];
  const fieldLabel = FIELD_LABEL(lang), fromLabel = FROM_LABEL(lang);
  const badge = (from, label) => fromBadge(from, lang, label);
  const title = m => monTitle(m, sim, lang);

  const words = note => ruleText(note, lang);
  const one = mode === 'create' || mode === 'edit';
  const id = `pkb-imp-${++seq}`;

  let wanted = { item: null, name: '', emoji: DEFAULT_EMOJI, add: 1, isNew: false };
  const fromPick = () => bagDraft(state, wanted.isNew ? { name: wanted.name, emoji: wanted.emoji, add: wanted.add } : { item: wanted.item, add: wanted.add });
  const start = mode === 'bag' ? fromPick() : given;
  let draft = start, busy = false, failure = '', picker = null, details = false;
  let view = one ? start.mons[0].key : null;

  const root = el('section', { className: 'pkb-import' });
  root.innerHTML = `<style>${CSS}</style><div class="card" role="dialog" aria-labelledby="${id}-title">
    <div class="hd"><button class="back" type="button" aria-label="${t('import.toList')}" title="${t('import.toList')}" hidden>${BACK}</button><b id="${id}-title">${text.title}</b>
      <button class="x" type="button" aria-label="${t('import.close')}" title="${t('import.close')}">${crossIcon(2.8)}</button></div>
    <div class="body"></div>
    <div class="ft"><span class="sum" aria-live="polite"></span><button class="apply" type="button">${text.apply}</button></div>
  </div>`;
  parent.append(root);
  const card = root.querySelector('.card'), body = root.querySelector('.body'), sum = root.querySelector('.ft .sum'), applyButton = root.querySelector('.apply'), back = root.querySelector('.hd .back');
  const heading = root.querySelector('.hd b'), foot = root.querySelector('.ft');

  const mon = key => draft.mons.find(m => m.key === key);
  const change = next => { draft = next; failure = ''; draw(); };
  const edit = (key, field, value) => change(editMon(draft, key, field, value, ctx));

  function openPicker({ title, groups, value = '', none = null, searchHint = '', empty = null, pick }) {
    closePicker();
    const input = el('input', { type: 'search', placeholder: t('import.search'), autocomplete: 'off', enterKeyHint: 'search' });
    input.setAttribute('aria-label', t('import.searchOf', { title }));
    const items = el('div', { className: 'items' });
    const close = el('button', { type: 'button', innerHTML: BACK });
    close.setAttribute('aria-label', t('import.pickBack')); close.title = t('import.back');
    close.onclick = closePicker;
    picker = el('div', { className: 'pick' }, el('div', { className: 'hd' }, close, el('b', { textContent: title })), el('div', { className: 'search' }, input), items);
    picker.setAttribute('role', 'dialog'); picker.setAttribute('aria-label', title);
    const entryButton = e => {
      const b = el('button', { type: 'button', className: 'it', disabled: !!e.disabled },
        el('span', { textContent: e.label }), e.hint && e.hint !== e.label ? el('span', { className: 'en', textContent: e.hint }) : null, e.sub ? el('span', { className: 's', textContent: e.sub }) : null);
      b.setAttribute('aria-selected', String(e.key === value));
      b.onclick = () => { closePicker(); pick(e.key); };
      return b;
    };
    const render = () => {
      const q = input.value, searching = !!squash(q);
      const out = [];
      let shown = 0, more = 0;
      if (none !== null && matchesQuery({ key: '', label: none }, q)) out.push(entryButton({ key: '', label: none }));
      for (const g of groups) {
        if (g.searchOnly && !searching) continue;
        const found = g.entries.filter(e => matchesQuery(e, q));
        if (!found.length) continue;
        const room = Math.max(0, PICK_SHOWN - shown);
        if (room) out.push(el('h4', { textContent: g.label }), found.slice(0, room).map(entryButton));
        shown += Math.min(room, found.length); more += Math.max(0, found.length - room);
      }

      if (!shown && !out.length) out.push(empty?.(q) ?? el('p', { className: 'more', textContent: t('import.noName') }));
      if (more) out.push(el('p', { className: 'more', textContent: t('import.more', { n: more }) }));
      if (searchHint && !searching) out.push(el('p', { className: 'more', textContent: searchHint }));
      fillWith(items, out);
    };
    input.oninput = () => { render(); items.scrollTop = 0; };
    input.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      items.querySelector('.it:not(:disabled)')?.click();
    });
    card.append(picker);
    render();
    items.querySelector('.it[aria-selected="true"]')?.scrollIntoView?.({ block: 'center' });
    input.focus();
  }
  function closePicker() { picker?.remove(); picker = null; }

  const pickButton = (text, { label, placeholder, open }) => {
    const b = el('button', { type: 'button', className: 'pickbtn' }, el('span', { className: `t${text ? '' : ' ph'}`, textContent: text || placeholder }), svg(NEXT));
    b.setAttribute('aria-label', t('import.pickOf', { label, text: text || placeholder }));
    b.onclick = open;
    return b;
  };

  // Text choices (one chosen)
  const choices = (list, value, label, pick, { disabled = new Map() } = {}) => {
    const g = el('div', { className: 'opts' }); g.setAttribute('role', 'radiogroup'); g.setAttribute('aria-label', label);
    for (const [v, name] of list) {
      const b = el('button', { type: 'button', className: 'opt', textContent: name, disabled: disabled.has(v), title: disabled.get(v) ?? '' });
      b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(v === value));
      b.onclick = () => { if (v !== value) pick(v); };
      g.append(b);
    }
    return g;
  };
  const select = (list, value, label, pick) => {
    const s = el('select', {}, list.map(([v, name]) => el('option', { value: String(v), textContent: name, selected: v === value })));
    s.setAttribute('aria-label', label);
    s.onchange = () => pick(list.find(([v]) => String(v) === s.value)[0]);
    return s;
  };
  const numberInput = (value, { min, max, label, pick, empty = false }) => {
    const input = el('input', { type: 'number', min, max, step: 1, inputMode: 'numeric', value: Number.isFinite(value) ? String(value) : '' });
    input.setAttribute('aria-label', label);
    input.onchange = () => {
      const text = input.value.trim();
      if (text === '' && empty) return pick(undefined);
      const n = Math.round(Number(text));
      if (text === '' || !Number.isFinite(n)) { input.value = Number.isFinite(value) ? String(value) : ''; return undefined; }
      return pick(Math.max(min, Math.min(max, n)));
    };
    return input;
  };

  function monRow(m) {
    const bad = m.action !== 'skip' && m.problems.length > 0;
    const row = el('div', { className: `mon${bad ? ' bad' : ''}${m.action === 'skip' ? ' skip' : ''}` });
    const open = el('button', { type: 'button', className: 'open' },
      picture(m),
      el('span', { className: 'who' },
        el('b', { textContent: title(m) }),
        el('span', { className: 'sub', textContent: monSub(m, sim, lang) }),
        el('span', { className: 'chips' }, ROW_FIELDS.filter(f => m.from[f]).map(f => {
          const chip = badge(m.from[f], ROW_SHORT(lang)[f]); chip.title = `${fieldLabel[f]}: ${fromLabel[m.from[f]]}`; return chip;
        })),
        bad ? el('ul', { className: 'probs' }, m.problems.map(p => el('li', { textContent: words(p) }))) : null),
      svg(NEXT));
    open.setAttribute('aria-label', t('import.editOf', { mon: title(m) }));
    open.onclick = () => { view = m.key; draw(); body.scrollTop = 0; };
    row.append(open, actionLine(m), m.action === 'skip' ? null : placeLine(m));
    return row;
  }

  const partyCount = () => draftPartyCount(draft);
  function placeLine(m) {
    const full = m.place !== 'party' && partyCount() >= PARTY_MAX;
    return el('div', { className: 'row-act place' }, el('span', { className: 'match', textContent: t('import.goesTo') }),
      choices(PLACES(lang), m.place, t('import.goesToOf', { mon: title(m) }), place => edit(m.key, 'place', place),
        { disabled: full ? new Map([['party', t('import.partyMax', { max: PARTY_MAX })]]) : undefined }));
  }
  function actionLine(m) {
    const line = el('div', { className: 'row-act' },
      el('span', { className: 'match', textContent: m.match ? t(m.match.place === 'box' ? 'import.looksLikeBox' : 'import.looksLike', { mon: matchLabel(draft, m, sim, lang) }) : t('import.comesNew') }));
    line.append(choices(actionChoices(m, lang), m.action, t('import.howOf', { mon: title(m) }), action => change(setAction(draft, m.key, action))));
    return line;
  }
  function picture(m) {
    const box = el('span', { className: 'pic' });
    const species = sim.Dex.species.get(m.set.species);
    if (species.exists) {
      const img = el('img', { src: SPRITE(species.spriteid || species.id), alt: '', loading: 'lazy' });
      img.addEventListener('error', () => img.remove());
      box.append(img);
    }
    return box;
  }
  function bagSection() {
    const label = id => customText(draft, id) ?? lists.bag.label(id);
    const rows = Object.entries(draft.bag).sort(([a], [b]) => label(a).localeCompare(label(b), lang));
    const grid = el('div', { className: 'bag' });
    for (const [item, { count, from }] of rows) {
      const remove = el('button', { type: 'button', className: 'x', innerHTML: crossIcon(3) });
      remove.setAttribute('aria-label', t('import.removeOf', { item: label(item) })); remove.title = t('import.remove');
      remove.onclick = () => change(setBag(draft, item, 0));
      grid.append(el('span', { className: 'name', textContent: label(item) }),
        numberInput(count, { min: 0, max: BAG_COUNT_MAX, label: t('import.amountOf', { item: label(item) }), pick: n => change(setBag(draft, item, n)) }),
        badge(from) ?? el('span'), remove);
    }

    const add = el('div', { className: 'bag-add' }, pickButton('', { label: t('import.toBag'), placeholder: t('import.pickToAdd'), open: () => openPicker({
      title: t('import.toBag'),
      groups: [{ label: t('import.items'), entries: lists.bag.options.map(o => (draft.bag[o.key] ? { ...o, sub: t('import.taken'), disabled: true } : o)) }],
      pick: item => change(setBag(draft, item, 1)),
    }) }));
    return [rows.length ? grid : el('p', { className: 'empty', textContent: t('import.bagEmpty') }), add];
  }
  const section = (label, color, n, children, { over = false } = {}) => {
    const h = el('h3', {}, label, n === null ? null : el('span', { className: `n${over ? ' over' : ''}`, textContent: `${n}` }));
    h.style.borderColor = color;
    return [h, ...children];
  };
  function drawList() {
    const party = draft.mons.filter(m => m.place === 'party'), box = draft.mons.filter(m => m.place === 'box');
    fillWith(body,
      el('p', { className: 'intro', textContent: t('import.intro') }),
      draft.warnings.map(w => el('p', { className: 'warn', textContent: words(w) })),
      el('div', { className: 'legend' }, ['record', 'auto', 'user', ...(Object.values(draft.bag).some(b => b.from === 'current') ? ['current'] : [])].map(f => badge(f))),
      section(t('import.place.party'), TAB_COLOR.party, `${partyCount()}/${PARTY_MAX}`, party.length ? party.map(monRow) : [el('p', { className: 'empty', textContent: t('import.noParty') })],
        { over: partyCount() > PARTY_MAX }),
      partyCount() > PARTY_MAX ? el('p', { className: 'err', textContent: t('import.partyOver', { max: PARTY_MAX }) }) : null,
      section(t('import.place.box'), TAB_COLOR.box, box.length, box.length ? box.map(monRow) : [el('p', { className: 'empty', textContent: t('import.noBox') })]),
      section(t('import.bag'), TAB_COLOR.bag, null, [el('p', { className: 'intro', textContent: t('import.bagIntro') }), ...bagSection()]));
  }

  const fieldRow = (m, field, control, note = null) => el('div', { className: 'f' },
    el('span', { className: 'lab' }, el('span', { textContent: fieldLabel[field] }), badge(m.from[field])),
    el('span', { className: 'ctl' }, control, note));
  function statInputs(m, field, max) {
    const values = m.set[field] ?? {};
    const grid = el('div', { className: 'stats' });
    for (const stat of STATS) {
      grid.append(el('label', {}, statName(stat, lang), numberInput(values[stat], { min: 0, max, label: `${fieldLabel[field]} ${statName(stat, lang)}`,
        pick: n => edit(m.key, field, { ...values, [stat]: n }) })));
    }
    return grid;
  }

  function moveSlots(m) {
    const moves = [...(m.set.moves ?? [])];
    const grid = el('div', { className: 'moves' });
    for (let i = 0; i < MAX_MOVES; i++) {
      const move = moves[i] ?? '';
      const put = value => { const next = [...moves]; next[i] = value; edit(m.key, 'moves', [...new Set(next.filter(Boolean))]); };
      grid.append(pickButton(move ? lists.moves.label(move) : '', { label: t('import.move', { n: i + 1 }), placeholder: t('import.moveEmpty', { n: i + 1 }), open: () => openPicker({
        title: t('import.pickMove', { n: i + 1 }), value: move, none: move ? t('import.emptySlot') : null, searchHint: t('import.otherMoves'),
        groups: moveGroups(sim, ctx.levelUp, m.set.species, moves.filter((_, j) => j !== i), lang), pick: put,
      }) }));
    }
    return grid;
  }
  function drawEditor(m) {
    const refill = el('button', { type: 'button', className: 'btn', textContent: t('import.refill') });
    refill.title = t('import.refillHint');
    refill.onclick = () => change(refillMon(draft, m.key, ctx, { seed: seed() }));
    refill.hidden = !Object.values(m.from).includes('auto');
    const s = m.set;
    const evTotal = STATS.reduce((n, stat) => n + (s.evs?.[stat] ?? 0), 0);
    const controls = {
      species: () => pickButton(lists.species.label(s.species), { label: fieldLabel.species, placeholder: t('import.pickSpecies'), open: () => openPicker({
        title: t('import.pickSpeciesTitle'), value: s.species, groups: [{ label: t('import.pokemon'), entries: lists.species.options }], pick: v => edit(m.key, 'species', v) }) }),
      name: () => {

        // An empty nickname means the species name - shown greyed in the box
        const input = el('input', { type: 'text', value: s.name ?? '', maxLength: NICKNAME_MAX, placeholder: sim.Dex.species.get(s.species).exists ? lists.species.label(s.species) : t('import.none') });
        input.setAttribute('aria-label', fieldLabel.name);
        input.onchange = () => edit(m.key, 'name', input.value.trim());
        return input;
      },
      level: () => numberInput(s.level, { min: 1, max: MAX_LEVEL, label: fieldLabel.level, empty: true, pick: v => edit(m.key, 'level', v) }),
      nature: () => pickButton(lists.natures.find(([v]) => v === s.nature)?.[1] ?? '', { label: fieldLabel.nature, placeholder: t('import.notChosen'), open: () => openPicker({
        title: t('import.pickNature'), value: s.nature ?? '', groups: [{ label: fieldLabel.nature, entries: lists.natures.map(([key, label]) => ({ key, label, hint: key })) }], pick: v => edit(m.key, 'nature', v) }) }),
      ability: () => pickButton(s.ability ? abilityChoices(sim, s.species, s.ability, lang).find(([v]) => v === s.ability)[1] : '', { label: fieldLabel.ability, placeholder: t('import.notChosen'),
        open: () => openPicker({ title: t('import.pickAbility'), value: s.ability ?? '', groups: abilityGroups(sim, s.species, lang), searchHint: t('import.otherAbilities'), pick: v => edit(m.key, 'ability', v) }) }),
      moves: () => moveSlots(m),
      item: () => pickButton(lists.items.label(s.item ?? ''), { label: fieldLabel.item, placeholder: t('import.none'), open: () => openPicker({
        title: t('import.pickItem'), value: s.item ?? '', none: t('import.none'), groups: [{ label: t('import.items'), entries: lists.items.options }], pick: v => edit(m.key, 'item', v) }) }),
      hpPercent: () => numberInput(m.hpPercent, { min: 0, max: 100, label: 'HP %', pick: v => edit(m.key, 'hpPercent', v) }),
      status: () => select(STATUS_CHOICES(lang), m.status ?? '', fieldLabel.status, v => edit(m.key, 'status', v)),
      gender: () => choices(genderChoices(sim, s.species, lang), s.gender ?? '', fieldLabel.gender, v => edit(m.key, 'gender', v)),
      shiny: () => choices(SHINY_CHOICES(lang), !!s.shiny, fieldLabel.shiny, v => edit(m.key, 'shiny', v)),
      ivs: () => statInputs(m, 'ivs', MAX_IV),
      evs: () => statInputs(m, 'evs', EV_STAT_MAX),
      teraType: () => select([...(s.teraType ? [] : [['', t('import.notChosen')]]), ...lists.types.filter(([t]) => t !== 'Stellar' || s.teraType === 'Stellar')], s.teraType ?? '',
        fieldLabel.teraType, v => edit(m.key, 'teraType', v)),
    };
    const notes = {
      hpPercent: el('span', { className: 'note', textContent: t('import.hpNote') }),
      evs: el('span', { className: `note${evTotal > EV_TOTAL_MAX ? ' bad' : ''}`, textContent: t('import.evTotal', { n: evTotal, max: EV_TOTAL_MAX }) }),
      moves: el('span', { className: 'note', textContent: t('import.movesNote', { max: MAX_MOVES }) }),
      name: el('span', { className: 'note', textContent: t('import.nameNote') }),
    };
    const group = g => el('fieldset', {}, el('legend', { textContent: g.label }), g.fields.map(f => fieldRow(m, f, controls[f](), notes[f] ?? null)));

    const toggle = el('button', { type: 'button', className: 'more-btn' },
      el('span', { textContent: t(details ? 'import.detailsHide' : 'import.detailsShow') }),
      el('span', { className: 'what', textContent: t('import.detailsWhat') }), svg(NEXT));
    toggle.setAttribute('aria-expanded', String(details));
    toggle.onclick = () => { details = !details; draw(); };
    fillWith(body,
      el('div', { className: 'ed-top' }, picture(m), el('span', { className: 'who' }, el('b', { textContent: title(m) }), el('span', { className: 'sub', textContent: monSub(m, sim, lang) })), refill),
      m.action !== 'skip' && m.problems.length ? el('ul', { className: 'probs err' }, m.problems.map(p => el('li', { textContent: words(p) }))) : null,

      one
        ? el('p', { className: 'goes', textContent: text.goes(m.place) })
        : el('div', { className: `mon${m.action === 'skip' ? ' skip' : ''}` }, actionLine(m)),
      FIELD_GROUPS(lang).filter(g => !g.details).map(group),
      toggle,
      details ? FIELD_GROUPS(lang).filter(g => g.details).map(group) : null);
  }

  const setPick = patch => { wanted = { ...wanted, ...patch }; draft = fromPick(); failure = ''; draw(); };

  const openBagPicker = () => openPicker({
    title: t('import.pickBagItem'), value: wanted.isNew ? '' : wanted.item ?? '', groups: bagGroups(sim, state, lang),
    empty: q => {
      const add = el('button', { type: 'button', className: 'btn', textContent: t('import.asNew') });
      add.onclick = () => { closePicker(); setPick({ isNew: true, item: null, name: q.trim() }); body.querySelector('.new-name')?.focus(); };
      return el('div', { className: 'new' }, el('p', { textContent: t('import.notGameItem', { name: q.trim() }) }), add);
    },
    pick: item => setPick({ isNew: false, item }),
  });
  function drawBag() {
    const chosen = draft.item;
    const label = !chosen ? '' : customText(draft, chosen) ?? itemLabelIn(state, chosen, sim, lang, { bag: true });
    const row = (name, control, note = null) => el('div', { className: 'f' }, el('span', { className: 'lab' }, el('span', { textContent: name })), el('span', { className: 'ctl' }, control, note));
    const rows = [row(t('import.item'), pickButton(wanted.isNew ? '' : label, { label: t('import.itemToPut'), placeholder: t(wanted.isNew ? 'import.fromList' : 'import.pickAnItem'), open: openBagPicker }))];
    if (wanted.isNew) {
      const name = el('input', { type: 'text', className: 'new-name', value: wanted.name, maxLength: NEW_ITEM_MAX, placeholder: t('import.newName') });
      name.setAttribute('aria-label', t('import.newName'));
      name.onchange = () => setPick({ name: name.value.trim() });
      const emoji = el('input', { type: 'text', className: 'emo emoji-in', value: wanted.emoji, maxLength: 16 });
      emoji.setAttribute('aria-label', t('import.newPicture'));
      emoji.onchange = () => setPick({ emoji: emoji.value.trim() || DEFAULT_EMOJI });

      const game = chosen && !draft.customItems[chosen];
      rows.push(row(t('import.name'), name, el('span', { className: 'note', textContent: game ? t('import.asGameItem', { name: label }) : t('import.newItemNote') })),
        row(t('import.picture'), emoji, el('span', { className: 'note', textContent: t('import.pictureNote') })));
    }
    rows.push(row(t('import.amount'), numberInput(wanted.add, { min: 1, max: BAG_COUNT_MAX, label: t('import.amountToPut'), pick: n => setPick({ add: n }) }),
      chosen ? el('span', { className: 'note', textContent: t('import.bagNow', { n: draft.base.bag[chosen] }) }) : null));
    fillWith(body, el('p', { className: 'intro', textContent: t('import.bagIntroDebug') }),
      el('fieldset', {}, el('legend', { textContent: t('import.itemToPut') }), rows));
  }

  const toList = () => { mode = 'import'; text = MODES(lang).import; view = null; draw(); body.scrollTop = 0; };
  function drawQuick() {
    const { party, box, problems } = quickSummary(draft, ctx, lang);
    const go = el('button', { type: 'button', className: 'apply big', textContent: problems ? t('import.quick.fix') : busy ? t('import.quick.busy') : t('import.quick.apply'), disabled: busy });
    go.onclick = problems ? toList : apply;
    const link = problems ? null : el('button', { type: 'button', className: 'q-link', disabled: busy }, el('span', { textContent: t('import.quick.review') }), svg(NEXT));
    if (link) link.onclick = toList;
    const partyHead = el('h3', { textContent: t('import.quick.party', { n: party.length }) }), boxHead = box ? el('h3', { textContent: t('import.quick.box', { n: box }) }) : null;
    partyHead.style.borderColor = TAB_COLOR.party;
    if (boxHead) boxHead.style.borderColor = TAB_COLOR.box;
    fillWith(body, el('div', { className: 'q-body' },
      el('p', { className: 'intro', textContent: t('import.quick.found') }),
      party.length ? [partyHead, el('p', { className: 'q-names', textContent: party.join(' · ') })] : null, boxHead,
      Number.isSafeInteger(money) ? el('div', { className: 'q-money' }, el('span', { textContent: t('panel.money') }), el('b', { textContent: moneyText(money.toLocaleString(lang), lang) })) : null,
      problems ? el('p', { className: 'q-fix', textContent: t('import.quick.toFix', { n: problems }) }) : el('p', { className: 'q-fill', textContent: t('import.quick.fill') }),
      go, link,
      problems ? null : el('p', { className: 'q-note', textContent: t('import.quick.undo') }),
      failure ? el('p', { className: 'err', textContent: failure }) : null));
  }

  function draw() {
    const top = body.scrollTop;
    const quick = mode === 'quick';
    root.classList.toggle('quick', quick);
    foot.hidden = quick;
    heading.textContent = quick ? t('import.quick.title') : text.title;
    if (quick) { back.hidden = true; drawQuick(); }
    else if (mode === 'bag') drawBag();
    else {
      const editing = view && mon(view);
      if (!editing) view = null;
      back.hidden = !editing || one;
      if (editing) drawEditor(editing); else drawList();
    }
    body.scrollTop = top;
    const problems = draftProblems(draft, ctx);
    sum.classList.toggle('bad', !!(failure || problems.length));
    const done = mode === 'bag' ? () => bagSummary(draft, state, sim, lang) : one ? () => createSummary(draft, sim, lang) : () => applySummary(draft, lang);
    sum.textContent = failure || (problems.length ? t(problems.length > 1 ? 'import.toFixMore' : 'import.toFix', { before: text.before, n: problems.length, first: words(problems[0]) }) : done());
    applyButton.disabled = busy || problems.length > 0;
    applyButton.textContent = busy ? text.busy : text.apply;
  }
  back.onclick = () => { view = null; draw(); };

  async function apply() {
    if (busy || draftProblems(draft, ctx).length) return;
    busy = true; failure = ''; draw();
    try { await onApply(draft); } catch (error) {
      console.warn('[poke-battle] 가져오기를 적용하지 못함', error);
      busy = false; failure = failureText(text.what, error, lang); draw();
      return;
    }
    busy = false;
    await close();
  }
  applyButton.onclick = apply;

  let closed = false;
  async function close() { if (closed) return; closed = true; root.remove(); await onClose(); }

  function askClose() {
    if (mode === 'bag' ? !wanted.item && !wanted.isNew : draft === start) return close();
    closePicker();
    const keep = el('button', { type: 'button', className: 'btn', textContent: t('import.keepEditing') });
    const drop = el('button', { type: 'button', className: 'apply', textContent: t('import.discard') });
    keep.onclick = closePicker;
    drop.onclick = close;
    picker = el('div', { className: 'pick ask' }, el('div', { className: 'box' },
      el('p', {}, `${t('import.askDiscard')}\n`, el('small', { textContent: text.untouched })), el('div', { className: 'row' }, keep, drop)));
    picker.setAttribute('role', 'alertdialog'); picker.setAttribute('aria-label', t('import.askClose'));
    card.append(picker);
    keep.focus();
    return undefined;
  }
  root.querySelector('.hd .x').onclick = askClose;
  root.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    e.preventDefault(); e.stopPropagation();
    if (picker) closePicker();
    else if (view && mode === 'import') { view = null; draw(); } else askClose();
  });
  draw();
  root.querySelector('.hd .x').focus();
  if (mode === 'bag') openBagPicker();
  return { close, get draft() { return draft; } };
}
