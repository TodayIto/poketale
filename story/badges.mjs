import table from '../data/badges.json' with { type: 'json' };
import WORDS from '../data/milestone-words.json' with { type: 'json' };
import { POKEAPI_ROOT } from '../view/sprites/sources.js';
import LEADER_NAMES from '../data/leader-names.json' with { type: 'json' };
import NAMED from '../data/named-trainers.json' with { type: 'json' };
import { compatFold, COMPAT_LINE_RE, latestStatus } from './compat.mjs';
import { norm } from './norm.mjs';

const freeze = value => Object.freeze(value);

export const BADGE_REGIONS = freeze(table.regions.map(region => freeze({ id: region.id, name: freeze([...region.name]) })));

export const BADGES = freeze(table.badges.map(badge => freeze({ ...badge, kind: badge.kind ?? 'gym', name: freeze([...badge.name]),
  leaders: freeze((badge.leaders ?? []).map(pair => freeze([...pair]))), place: badge.place ? freeze([...badge.place]) : null,
  picture: badge.picture ? freeze({ ...badge.picture }) : null })));
const BY_ID = new Map(BADGES.map(badge => [badge.id, badge]));

export const badgeById = id => BY_ID.get(id) ?? null;

export const isTrial = badge => badge.kind === 'trial' || badge.kind === 'grand';

export const isChampion = badge => badge.kind === 'champion';

export const inLang = (pair, lang) => pair[lang === 'ko' ? 0 : 1];

export function earnedBadges(state) {
  const own = new Set(Array.isArray(state?.badges) ? state.badges : []);
  return BADGES.filter(badge => own.has(badge.id)).map(badge => badge.id);
}

export const badgeCount = state => earnedBadges(state).filter(id => !isChampion(BY_ID.get(id))).length;

export function withBadge(state, id, earned) {
  const own = new Set(earnedBadges(state));
  if (earned) own.add(id); else own.delete(id);
  return BADGES.filter(badge => own.has(badge.id)).map(badge => badge.id);
}

export function badgePicture(badge) {
  if (!badge.picture) return { trophy: true };
  const { pokeapi, item } = badge.picture;
  if (pokeapi) return { url: `${POKEAPI_ROOT}badges/${pokeapi}.png` };
  return { item };
}

export const LEAGUE_VAR = 'yp_LeagueMilestone';
export const UNOVA_ERA_VAR = 'yp_UnovaEra';
export const LEAGUE_SLOTS = 89;

export const PRE_STORY = 'PRE-STORY';

const ERA_ONLY = { unova: [37, 44], unova2: [39, 45] };
const ERAS = new Map([['1', 'unova'], ['2', 'unova2']]);

const isDate = text => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return false;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return date.getUTCFullYear() === Number(m[1]) && date.getUTCMonth() === Number(m[2]) - 1 && date.getUTCDate() === Number(m[3]);
};

const slotValue = text => {
  const value = String(text).trim();
  if (isDate(value)) return value;
  return /^pre[-_ ]?story$/i.test(value) ? PRE_STORY : null;
};

export function readLeague(chat) {
  const raw = chat?.scriptstate?.[`$${LEAGUE_VAR}`];
  if (raw === undefined || raw === null) return null;
  const slots = new Map();
  String(raw).split('|').slice(0, LEAGUE_SLOTS).forEach((text, i) => {
    const value = slotValue(text);
    if (value) slots.set(i + 1, value);
  });
  const era = unovaEra(chat, slots);
  return { slots, era, entries: BADGES.filter(badge => slots.has(badge.slot) && shownIn(badge.region, era)) };
}

export const unovaEra = (chat, slots) => knownUnovaEra(chat, slots) ?? 'unova';

export function knownUnovaEra(chat, slots) {
  const set = ERAS.get(String(chat?.scriptstate?.[`$${UNOVA_ERA_VAR}`] ?? '').trim());
  if (set) return set;
  const filled = Object.entries(ERA_ONLY).filter(([, own]) => own.some(slot => slots.has(slot))).map(([era]) => era);
  return filled.length === 1 ? filled[0] : null;
}

const shownIn = (region, era) => !era || !(region in ERA_ONLY) || region === era;

export const shownRegions = era => BADGE_REGIONS.filter(region => shownIn(region.id, era));

const suffixOf = badge => WORDS.suffix[WORDS.rankSlots.includes(badge.slot) ? 'rank' : badge.kind];
const LOG_NAMES = new Map();
for (const badge of BADGES) {
  const [ko, en, ja] = suffixOf(badge);
  for (const name of [badge.name[0] + ko, badge.name[1] + en, WORDS.ja[badge.slot] + ja]) {
    const key = compatFold(name);
    LOG_NAMES.set(key, [...new Set([...LOG_NAMES.get(key) ?? [], badge.slot])]);
  }
}
const LOG_HEAD = compatFold('Event Log');
const TROPHY = '🏆';

function logNames(text) {
  const names = [];
  for (const [, inner] of String(text ?? '').matchAll(COMPAT_LINE_RE)) {
    const colon = inner.search(/[:：]/);
    if (colon < 0 || compatFold(inner.slice(0, colon)) !== LOG_HEAD) continue;
    const rest = inner.slice(colon + 1).trim();
    if (rest.startsWith(TROPHY)) names.push(compatFold(rest.slice(TROPHY.length)));
  }
  return names;
}

export function leaguePlaces(league, chat) {
  const places = new Map();
  (chat?.message ?? []).forEach((message, index) => {
    if (message?.role !== 'char') return;
    for (const name of logNames(message.data)) {
      const slots = (LOG_NAMES.get(name) ?? []).filter(slot => league.slots.has(slot) && league.slots.get(slot) !== PRE_STORY);
      if (!slots.length) continue;
      const status = slots.length > 1 ? latestStatus(chat, index) : null;
      const slot = slots.find(at => status?.date?.startsWith(league.slots.get(at))) ?? slots.find(at => status?.region && status.region === STATUS_REGION.get(at))
        ?? slots[0];
      places.set(slot, index);
    }
  });
  return places;
}

const STATUS_REGION = new Map(BADGES.map(badge => [badge.slot, badge.region === 'unova2' ? 'unova' : badge.region]));

export const leagueAt = (league, places, index) => league.entries.filter(badge => !(places.get(badge.slot) > index)).map(badge => badge.id);

export const leagueDate = (league, id) => league.slots.get(BY_ID.get(id)?.slot) ?? null;

const TITLE_WORDS = [...new Set([...NAMED.titles, '캡틴', '시련', '섬킹', '섬퀸', '님', '씨', '선생', '선생님', 'captain', 'trial', 'kahuna', 'island', 'mr', 'ms', 'miss',
  'ジムリーダー', 'キャプテン', 'しまキング', 'しまクイーン', '四天王', 'チャンピオン', 'ライバル', 'の', 'さん'].map(norm))].sort((a, b) => b.length - a.length);
const TITLES = new Set(TITLE_WORDS);
const LATIN = /^[a-z0-9]+$/;

function bare(word) {
  let rest = norm(word);
  for (let cut = true; cut && rest && !TITLES.has(rest) && !LATIN.test(rest);) {
    const head = TITLE_WORDS.find(t => rest.length > t.length && rest.startsWith(t)), tail = TITLE_WORDS.find(t => rest.length > t.length && rest.endsWith(t));
    cut = !!(head || tail);
    if (head) rest = rest.slice(head.length); else if (tail) rest = rest.slice(0, -tail.length);
  }
  return TITLES.has(rest) ? '' : rest;
}

const leadersOf = badge => (isChampion(badge) ? LEADER_NAMES.champions?.[badge.id] ?? [] : badge.leaders.map(([ko, en], i) => [ko, en, LEADER_NAMES.ja[badge.id]?.[i]]))
  .map(names => ({ names: names.map(norm).filter(Boolean), letter: /^[a-z]$/i.test(names[1] ?? '') }));

function namesLeader(leader, written) {
  const whole = norm(written);
  const words = String(written ?? '').split(/[\s·,&+/]+/).map(bare).filter(Boolean);
  const own = words.join('');
  if (!own) return false;
  const holds = leader.letter
    ? name => words.includes(name) || own === name
    : name => words.includes(name) || own === name || (name.length >= 2 && whole.includes(name)) || (own.length >= 2 && name.includes(own))
      || words.some(word => word.length === name.length + 1 && word.startsWith(name));
  return leader.names.some(holds);
}

export const leadsBattle = (badge, opponents = []) => !!badge && leadersOf(badge).some(leader => opponents.some(name => namesLeader(leader, name)));

export function keepRecords(records, earned, { league = null, win = null, since = Infinity } = {}) {
  const next = {};
  for (const id of earned) {
    if (records?.[id]) { next[id] = records[id]; continue; }
    const date = league ? leagueDate(league, id) : null;
    const battle = date !== PRE_STORY && win && win.index >= since && leadsBattle(BY_ID.get(id), win.opponents) ? win : null;
    next[id] = { date: league ? date : battle?.date ?? null, ...(battle ? { party: battle.party } : {}) };
  }
  return next;
}

export const recordOf = (state, id) => state?.gyms?.[id] ?? null;
