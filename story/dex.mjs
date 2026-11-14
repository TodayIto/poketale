import LISTS from '../data/dex-lists.json' with { type: 'json' };
import { dexEntries, dexEntry } from '../names/dex.js';
import { BADGES, isChampion, readLeague, knownUnovaEra, PRE_STORY } from './badges.mjs';
import { latestStatus } from './compat.mjs';
import { isEgg } from './state.mjs';
import { displayName, spriteIdOf } from '../engine/mon.mjs';
import { say } from './screen-text.mjs';

export const NATIONAL = 'national';
export const NATIONAL_LAST = LISTS.national;
const part = (key, first, list) => Object.freeze({ key, first, list: Object.freeze([...list]) });

export const REGIONAL = Object.freeze(LISTS.dexes.map(d => {
  const parts = [part(d.section ?? null, d.first, d.list), ...(d.sections ?? []).map(s => part(s.key, s.first, s.list))];
  return Object.freeze({ key: d.key, first: d.first, list: Object.freeze([...new Set(parts.flatMap(p => p.list))]), parts: Object.freeze(parts) });
}));
const BY_KEY = new Map(REGIONAL.map(d => [d.key, d]));
const NATIONAL_LIST = (() => { const all = part(null, 1, Array.from({ length: NATIONAL_LAST }, (_, i) => i + 1)); return Object.freeze({ key: NATIONAL, first: 1, list: all.list, parts: Object.freeze([all]) }); })();

const numberIn = (dex, num) => { for (const p of dex.parts) { const at = p.list.indexOf(num); if (at >= 0) return p.first + at; } return null; };

export const OLD_KEYS = Object.freeze({
  unova2: 'unova', kalosCentral: 'kalos', kalosCoastal: 'kalos', kalosMountain: 'kalos',
  melemele: 'alola', akala: 'alola', ulaula: 'alola', poni: 'alola', alola2: 'alola', melemele2: 'alola', akala2: 'alola', ulaula2: 'alola', poni2: 'alola',
  armor: 'galar', crown: 'galar', kitakami: 'paldea', blueberry: 'paldea', hyperspace: 'lumiose',
});

export const dexKey = key => (key === NATIONAL || BY_KEY.has(key) ? key : BY_KEY.has(OLD_KEYS[key]) ? OLD_KEYS[key] : null);

export const dexList = key => { const now = dexKey(key); return now === NATIONAL ? NATIONAL_LIST : BY_KEY.get(now) ?? null; };

export const REGION_DEXES = Object.freeze({
  kanto: ['kanto'], johto: ['johto'], hoenn: ['hoenn'], sinnoh: ['sinnoh'], unova: ['unova'], unova2: ['unova'],
  kalos: ['kalos'], alola: ['alola'], galar: ['galar'], paldea: ['paldea'],
});

const SEEN_ONLY = new Map(LISTS.seenOnly.map(d => [d.key, Object.freeze([...d.list])]));

export const regionSeen = region => {
  const shown = (REGION_DEXES[region] ?? []).flatMap(key => dexList(key)?.list ?? []);
  if (region !== 'unova') return shown;
  const bw = new Set(SEEN_ONLY.get('unovaBW'));
  return shown.filter(num => bw.has(num));
};

const HOME = { kanto: 'kanto', johto: 'johto', hoenn: 'hoenn', sinnoh: 'sinnoh', unova: 'unova', kalos: 'kalos', alola: 'alola', galar: 'galar',
  hisui: 'hisui', paldea: 'paldea', kitakami: 'paldea' };

export function preStoryRegions(chat) {
  const league = readLeague(chat);
  if (!league) return [];
  const regions = new Set();
  for (const badge of BADGES) {
    if (!isChampion(badge) || league.slots.get(badge.slot) !== PRE_STORY) continue;
    if (badge.region === 'unova' || badge.region === 'unova2') {
      const era = knownUnovaEra(chat, league.slots);
      if (!era || era === badge.region) regions.add(badge.region);
    } else regions.add(badge.region);
  }
  return [...regions];
}

export function dexHome(chat, compat) {
  if (!compat) return null;
  return HOME[latestStatus(chat)?.region] ?? 'kanto';
}

const numsCache = new WeakMap();

function baseByNum(dex) {
  let map = numsCache.get(dex);
  if (!map) {
    map = new Map();
    for (const s of dex.species.all()) if (s.num >= 1 && s.num <= NATIONAL_LAST && !s.forme && !map.has(s.num)) map.set(s.num, s);
    numsCache.set(dex, map);
  }
  return map;
}
const numOf = (sim, id) => { const s = sim.Dex.species.get(id); return s?.exists && s.num >= 1 && s.num <= NATIONAL_LAST ? s.num : 0; };
const owned = state => [...state.party ?? [], ...state.box ?? []].filter(mon => mon && !isEgg(mon));

export function dexFill(state, sim, regions = [], mentions = []) {
  const seen = new Set(), caught = new Set();
  for (const id of state?.dex?.caught ?? []) { const n = numOf(sim, id); if (n) caught.add(n); }
  for (const mon of owned(state ?? {})) { const n = numOf(sim, mon.set.species); if (n) caught.add(n); }
  for (const id of state?.dex?.seen ?? []) { const n = numOf(sim, id); if (n) seen.add(n); }
  for (const n of caught) seen.add(n);
  for (const region of regions) for (const n of regionSeen(region)) seen.add(n);
  for (const n of mentions) if (Number.isInteger(n) && n >= 1 && n <= NATIONAL_LAST) seen.add(n);
  return { seen, caught };
}

export function dexLooks(state, sim, num) {
  const ids = new Set([...state?.dex?.seen ?? [], ...state?.dex?.caught ?? [], ...owned(state ?? {}).map(mon => sim.Dex.species.get(mon.set.species).id)]
    .map(id => sim.Dex.species.get(id)).filter(s => s?.exists && s.num === num).map(s => s.id));
  const base = baseByNum(sim.Dex).get(num);
  const order = dexEntries(num).map(row => row.id);
  const rank = id => { const at = order.indexOf(id); return at < 0 ? order.length + (id === base?.id ? -0.5 : 0) : at; };
  const plain = [...ids].sort((a, b) => rank(a) - rank(b));
  if (!plain.length && base) plain.push(base.id);
  const shiny = [...new Set(owned(state ?? {}).filter(mon => mon.set.shiny && numOf(sim, mon.set.species) === num).map(mon => sim.Dex.species.get(mon.set.species).id))]
    .sort((a, b) => rank(a) - rank(b));
  return [...plain.map(id => ({ id, shiny: false })), ...shiny.map(id => ({ id, shiny: true }))];
}

const measure = (value, unit) => (typeof value === 'number' ? `${value.toFixed(1)}${unit}` : String(value ?? ''));

export function dexView({ state, sim, lang, names, ui, home = null, regions = [], mentions = [] }) {
  const key = BY_KEY.get(dexKey(ui?.dex?.key))?.key ?? BY_KEY.get(dexKey(home))?.key ?? REGIONAL[0].key;
  const national = ui?.dex ? !!ui.dex.national : home === null;
  const shown = national ? NATIONAL_LIST : dexList(key);
  const { seen, caught } = dexFill(state, sim, regions, mentions);
  const base = baseByNum(sim.Dex);
  const nameOf = num => (base.has(num) ? displayName(sim.Dex, names, base.get(num).id) : '');
  const rows = shown.parts.flatMap(p => [
    ...(p.key ? [{ section: p.key, label: say(lang, `dex.section.${p.key}`) }] : []),
    ...p.list.map((num, i) => {
      const mark = caught.has(num) ? 'caught' : seen.has(num) ? 'seen' : 'unseen';
      return { no: p.first + i, num, state: mark, name: mark === 'unseen' ? '' : nameOf(num) };
    }),
  ]);
  const view = {
    key, national, label: say(lang, `dex.name.${national ? NATIONAL : key}`),
    seen: shown.list.filter(n => seen.has(n)).length, caught: shown.list.filter(n => caught.has(n)).length, total: shown.list.length, rows, open: null,
  };
  const open = ui?.dexOpen;
  if (open && caught.has(open.num)) {
    const list = dexList(open.key) ?? shown;
    const caughtIn = list.list.filter(n => caught.has(n));
    const here = caughtIn.indexOf(open.num);
    const looks = dexLooks(state, sim, open.num);
    const look = looks[((open.look ?? 0) % looks.length + looks.length) % looks.length];
    const species = sim.Dex.species.get(look.id);
    const rows0 = dexEntries(open.num);
    const entry = lang === 'ko' ? dexEntry(species.id) ?? rows0[0] ?? null : null;
    view.open = {
      num: open.num, no: numberIn(list, open.num) ?? open.num, key: list.key,

      name: entry ? rows0[0]?.name ?? entry.name : displayName(sim.Dex, names, species.id),
      form: entry ? entry.form || (entry.name !== (rows0[0]?.name ?? entry.name) ? entry.name : '') : species.forme.replace(/-/g, ' '),
      types: [...species.types], category: entry ? entry.category ?? rows0[0]?.category ?? '' : '',
      height: entry ? measure(entry.height, 'm') : measure(species.heightm, 'm'), weight: entry ? measure(entry.weight, 'kg') : measure(species.weightkg, 'kg'),
      text: entry?.text ?? '', spriteId: spriteIdOf(species) || species.id, shiny: look.shiny,
      looks: looks.length, look: looks.indexOf(look),
      prev: here > 0 ? caughtIn[here - 1] : null, next: here >= 0 && here < caughtIn.length - 1 ? caughtIn[here + 1] : null,
    };
  }
  return view;
}

const stepKey = (key, d) => { const at = Math.max(0, REGIONAL.findIndex(x => x.key === dexKey(key))); return REGIONAL[(at + d + REGIONAL.length) % REGIONAL.length].key; };

export function dexPress(ui, hit, { state, sim, lang }) {
  const same = { ui, effect: null };
  switch (hit.t) {
    case 'dexNav': return { ui: { ...ui, dex: { key: stepKey(hit.key, hit.d < 0 ? -1 : 1), national: false }, dexOpen: null, message: null }, effect: null };
    case 'dexMode': return { ui: { ...ui, dex: { key: dexKey(hit.key) ?? REGIONAL[0].key, national: !hit.national }, dexOpen: null, message: null }, effect: null };
    case 'dexRow': {
      if (dexFill(state, sim).caught.has(hit.num)) return { ui: { ...ui, dexOpen: { num: hit.num, look: 0, key: hit.key }, message: null }, effect: null };
      return same;
    }
    case 'dexStep': return ui.dexOpen && dexFill(state, sim).caught.has(hit.num) ? { ui: { ...ui, dexOpen: { ...ui.dexOpen, num: hit.num, look: 0 } }, effect: null } : same;
    case 'dexLook': return ui.dexOpen ? { ui: { ...ui, dexOpen: { ...ui.dexOpen, look: hit.look } }, effect: null } : same;
    case 'dexClose': return { ui: { ...ui, dexOpen: null }, effect: null };
    default: return same;
  }
}
