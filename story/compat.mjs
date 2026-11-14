import { norm } from './norm.mjs';
import storyNames from '../data/story-names.json' with { type: 'json' };

import STATUS_WORDS from '../data/status-words.json' with { type: 'json' };
import TRAVEL_WORDS from '../data/compat-travel.json' with { type: 'json' };
import { isNight } from '../engine/evolution.mjs';

export const COMPAT_LINES = Object.freeze({
  party: 'Own Pokémon', allied: 'Allied Pokémon', opposing: 'Opposing Pokémon',
  storageAdd: 'Pokémon Storage Add', storageRemove: 'Pokémon Storage Remove', intention: 'Battle Intention',
});
const NUMBERED = new Set(['party', 'allied', 'opposing']);

export const COMPAT_ENTRIES = Object.freeze([
  { name: '👾 Pokémon Status', lines: ['party', 'allied', 'opposing'] },
  { name: '💻 Pokémon Storage', lines: ['storageAdd', 'storageRemove'] },
  { name: '📣 Battle Intention', lines: ['intention'] },
].map(entry => Object.freeze({ ...entry, lines: Object.freeze(entry.lines), mark: `[${COMPAT_LINES[entry.lines[0]]}` })));

export const compatFold = text => norm(String(text ?? '').normalize('NFD').replace(/\p{M}/gu, ''));

export const COMPAT_LINE_RE = /\[([^[\]\n]*)\]/g;

export const COMPAT_FIELD_SEP = /[|｜]/;

const heads = Object.entries(COMPAT_LINES).map(([line, head]) => [line, compatFold(head)]).sort((a, b) => b[1].length - a[1].length);

export function compatHead(head) {
  const key = compatFold(head);
  for (const [line, folded] of heads) {
    if (!key.startsWith(folded)) continue;
    const rest = key.slice(folded.length);
    if (rest === '') return { line, slot: null };
    if (NUMBERED.has(line) && /^\d+$/.test(rest)) return { line, slot: Number(rest) };
  }
  return null;
}

const TAKEN = new Set(COMPAT_ENTRIES.flatMap(entry => entry.lines));
const taken = inner => TAKEN.has(compatHead(inner.split(COMPAT_FIELD_SEP)[0].trim())?.line);

export function dropTaken(text) {
  const all = String(text ?? '');
  const lines = all.split('\n');
  const kept = lines.flatMap(line => {
    const rest = line.replace(COMPAT_LINE_RE, (whole, inner) => (taken(inner) ? '' : whole));
    return rest === line ? [line] : rest.trim() ? [rest] : [];
  });
  return kept.length === lines.length && kept.every((line, i) => line === lines[i]) ? all : kept.join('\n');
}

export const COMPAT_VAR = 'pkb_compat';

export const COMPAT_TABS = Object.freeze({ button: 'yptab-button', panel: 'yptab-panel' });

export const SETTLEMENT_BOT = Object.freeze({ marker: '$yp_SexualForfeitActive', vars: Object.freeze({ mode: '$yp_YariPokeMode', winInstruction: '$yp_YariPokeWinInstruction', gender: '$yp_UserGender' }) });

export const hasSettlement = chat => {
  const state = chat?.scriptstate;
  return !!state && typeof state === 'object' && Object.hasOwn(state, SETTLEMENT_BOT.marker);
};

const compatVar = (chat, name, values) => values.get(String(chat?.scriptstate?.[`$${name}`] ?? '').trim()) ?? null;

export const COMPAT_LANG_VAR = 'yp_Language';
const BOT_LANGS = new Map([['1', 'ko'], ['2', 'en'], ['3', 'ja']]);

export const compatBotLang = chat => compatVar(chat, COMPAT_LANG_VAR, BOT_LANGS);

const OUR_LANG = { ko: 'ko', en: 'en', ja: 'en' };

export const compatLang = chat => OUR_LANG[compatBotLang(chat)] ?? null;

export const COMPAT_TRAINER_GENDER_VAR = 'yp_GenericTrainerGender';
const COMPAT_TRAINER_GENDERS = new Map([['2', 'M'], ['3', 'F']]);

export const compatTrainerGender = chat => compatVar(chat, COMPAT_TRAINER_GENDER_VAR, COMPAT_TRAINER_GENDERS);

export const COMPAT_SETTINGS = Object.freeze([
  { key: 'solo', name: 'yp_SoloJourney' },
  { key: 'light', name: 'yp_LightheartedTone' },
  { key: 'banter', name: 'yp_BanterTag', needs: 'light' },
  { key: 'guide', name: 'yp_JourneyGuideEnabled' },
  { key: 'fair', name: 'yp_NoBattleProtagonistBias' },
  { key: 'events', name: 'yp_RandomEventEnabled' },
].map(setting => Object.freeze(setting)));
const settingOf = key => {
  const setting = COMPAT_SETTINGS.find(s => s.key === key);
  if (!setting) throw new Error(`Unknown compatible bot setting: ${key}`);
  return setting;
};

export function compatSettingVars(key, on) {
  const setting = settingOf(key);
  return { [setting.name]: on ? '1' : '0', ...(on && setting.needs ? { [settingOf(setting.needs).name]: '1' } : {}) };
}

const COMPAT_GUIDE = Object.freeze({ text: 'yp_JourneyGuide', goal: 'yp_JourneyGuideGoal' });

export function compatTravelVars(change) {
  if (change?.clear === 'guide') return { [COMPAT_GUIDE.text]: '', [COMPAT_GUIDE.goal]: '' };
  return compatSettingVars(change?.key, change?.on);
}

const NONE = new Set(TRAVEL_WORDS.none.map(word => word.toLowerCase()));

export const START_ROW_KEYS = Object.freeze(Object.keys(TRAVEL_WORDS.startRows.ko));

const START_ROWS = new Map(Object.entries(TRAVEL_WORDS.startRows)
  .map(([lang, rows]) => [lang, START_ROW_KEYS.map(key => ({ key, labels: new Set((rows[key] ?? []).map(norm)) }))]));

export function compatTravel(chat) {
  const value = name => String(chat?.scriptstate?.[`$${name}`] ?? '').trim();
  const said = name => (NONE.has(value(name).toLowerCase()) || !value(name) ? null : value(name));
  const on = Object.fromEntries(COMPAT_SETTINGS.map(s => [s.key, value(s.name) !== '0']));
  return {
    guide: on.guide ? { text: said(COMPAT_GUIDE.text), goal: said(COMPAT_GUIDE.goal) } : null,
    settings: COMPAT_SETTINGS.filter(s => !s.needs || on[s.needs]).map(s => ({ key: s.key, on: on[s.key] })),
    start: startSettings(value('yp_StartSettingsDisplay'), START_ROWS.get(compatBotLang(chat)) ?? []),
  };
}

function startSettings(html, names) {
  const rows = new Map();
  for (const row of elementsWith(parseHtml(html), 'yptab-row')) {
    const label = elementsWith(row, 'yptab-setting-label')[0];
    if (!label) continue;
    const name = elementsWith(row, 'yptab-name')[0];
    const key = names.find(r => r.labels.has(norm(textOf(label))))?.key;
    const text = name ? textOf(name) : textOf(row, label);
    if (key && text && !rows.has(key)) rows.set(key, text);
  }
  return START_ROW_KEYS.filter(key => rows.has(key)).map(key => ({ key, value: rows.get(key) }));
}

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
function parseHtml(html) {
  const top = { tag: '', classes: [], children: [] }, open = [top];
  for (const m of String(html).matchAll(/<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|([^<]+)|</g)) {
    const [, close, name, attrs, text] = m;
    const here = open.at(-1);
    if (text !== undefined || m[0] === '<') { if (here.tag !== 'script' && here.tag !== 'style') here.children.push(decode(text ?? '<')); continue; }
    if (!name) continue;
    const tag = name.toLowerCase();
    if (close) {
      const at = open.findLastIndex(el => el.tag === tag);
      if (at > 0) open.length = at;
      continue;
    }
    const cls = /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i.exec(attrs);
    const el = { tag, classes: (cls?.[1] ?? cls?.[2] ?? cls?.[3] ?? '').split(/\s+/).filter(Boolean), children: [] };
    here.children.push(tag === 'br' ? ' ' : el);
    if (!VOID.has(tag) && !/\/\s*$/.test(attrs)) open.push(el);
  }
  return top;
}

function elementsWith(el, name) {
  const found = [];
  const walk = node => {
    for (const child of node.children) {
      if (typeof child === 'string') continue;
      if (child.classes.some(c => c === name || c === `x-risu-${name}`)) found.push(child);
      walk(child);
    }
  };
  walk(el);
  return found;
}

function textOf(el, skip = null) {
  const parts = [];
  const walk = node => { for (const child of node.children) if (typeof child === 'string') parts.push(child); else if (child !== skip) walk(child); };
  walk(el);
  return parts.join('').replace(/\s+/g, ' ').trim();
}
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = text => text.replace(/&(?:#(\d+)|#x([0-9a-f]+)|(\w+));/gi, (whole, dec, hex, name) => {
  const code = dec ? Number(dec) : hex ? parseInt(hex, 16) : null;
  if (code !== null) return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : whole;
  return ENTITIES[name.toLowerCase()] ?? whole;
});

const OPEN = `{{#when::keep::{{getvar::${COMPAT_VAR}}}::isnot::1}}`;
const CLOSE = '{{/when}}';

function split(content) {
  const lines = String(content ?? '').split('\n');
  let n = 0;
  while (n < lines.length && lines[n].startsWith('@@')) n++;
  return { head: lines.slice(0, n).map(line => `${line}\n`).join(''), body: lines.slice(n).join('\n') };
}

export const isWrapped = content => {
  const { body } = split(content);
  return body.startsWith(`${OPEN}\n`) && body.endsWith(`\n${CLOSE}`);
};
export const wrap = content => {
  if (isWrapped(content)) return content;
  const { head, body } = split(content);
  return `${head}${OPEN}\n${body}\n${CLOSE}`;
};
export const unwrap = content => {
  if (!isWrapped(content)) return content;
  const { head, body } = split(content);
  return head + body.slice(OPEN.length + 1, -(CLOSE.length + 1));
};

function find(lore, want, taken) {
  const free = (entry, i) => !taken.has(i) && typeof entry?.content === 'string';
  let at = lore.findIndex((entry, i) => free(entry, i) && entry.comment === want.name);
  if (at < 0) at = lore.findIndex((entry, i) => free(entry, i) && entry.content.includes(want.mark));
  return at;
}

export function applyCompat(lore, on) {
  const list = Array.isArray(lore) ? lore : [];
  const taken = new Set(), found = [], missing = [];
  const next = list.slice();
  let changed = false;
  for (const want of COMPAT_ENTRIES) {
    const at = find(list, want, taken);
    if (at < 0) { missing.push(want.name); continue; }
    taken.add(at); found.push(want.name);
    const content = on ? wrap(list[at].content) : unwrap(list[at].content);
    if (content !== list[at].content) { next[at] = { ...list[at], content }; changed = true; }
  }
  return { lore: next, changed, found, missing };
}

export function compatUpToDate(lore) {
  const { found, changed } = applyCompat(lore, true);
  return !found.length || !changed;
}

const TIMES_OF_DAY = Object.freeze(['morning', 'day', 'dusk', 'night']);

export const timeOfDayAt = hour => (hour >= 6 && hour <= 9 ? 'morning' : hour >= 10 && hour <= 16 ? 'day' : hour === 17 ? 'dusk' : 'night');

export const dayOrNight = timeOfDay => (isNight(timeOfDay) ? 'night' : 'day');

export const FIELD_WEATHERS = Object.freeze({ none: null, rain: 'raindance', snow: 'snowscape', sand: 'sandstorm', sun: 'sunnyday', mist: null });
const FIELD_TERRAINS = Object.freeze({ mist: 'mistyterrain' });

const tokensOf = text => ` ${String(text ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `;

const entryOf = (word, value) => {
  const tokens = tokensOf(word);
  return /^[ a-z0-9]+$/.test(tokens) ? { latin: tokens, value } : { folded: compatFold(word), value };
};
const wordTable = groups => Object.entries(groups).flatMap(([value, list]) => list.map(word => entryOf(word, value)))
  .sort((a, b) => (b.latin ?? b.folded).length - (a.latin ?? a.folded).length);

function wordIn(table, text) {
  const folded = compatFold(text), tokens = tokensOf(text);
  for (const entry of table) {
    if (entry.latin ? tokens.includes(entry.latin) : [...entry.folded].length === 1 ? folded === entry.folded || folded.endsWith(entry.folded) : folded.includes(entry.folded)) return entry.value;
  }
  return null;
}

const WEATHER_WORDS = wordTable(STATUS_WORDS.weather);

const INDOOR_WORDS = wordTable({ indoors: STATUS_WORDS.indoors });

const REGION_WORDS = wordTable(STATUS_WORDS.regions);

const blockPlaces = Object.entries(storyNames.biomes).reduce((groups, [word, biome]) => ({ ...groups, [biome]: [...groups[biome] ?? [], word] }), {});
const morePlaces = STATUS_WORDS.places;
const PLACE_WORDS = wordTable(Object.fromEntries([...new Set([...Object.keys(blockPlaces), ...Object.keys(morePlaces)])]
  .map(biome => [biome, [...blockPlaces[biome] ?? [], ...morePlaces[biome] ?? []]])));
const TIME_WORDS = wordTable(STATUS_WORDS.times);

const timeWordIn = text => String(text).split(/\d+/).map(piece => wordIn(TIME_WORDS, piece)).find(Boolean) ?? null;

const PM_TIMES = new Set(STATUS_WORDS.clock.pmTimes);

const HOUR_RE = new RegExp(`(\\d{1,2})\\s*(?:[:：${STATUS_WORDS.clock.hour.join('')}]|$)`);
const MERIDIEM_WORDS = wordTable(STATUS_WORDS.clock.meridiem);

export function readTime(text) {
  const hour = hourOf(text);
  return hour !== null ? timeOfDayAt(hour) : timeWordIn(text);
}
function hourOf(text) {
  const m = HOUR_RE.exec(text);
  if (!m) return null;
  const hour = Number(m[1]);
  if (hour > 23) return null;
  const meridiem = wordIn(MERIDIEM_WORDS, text);
  if (meridiem) return meridiem === 'pm' && hour < 12 ? hour + 12 : meridiem === 'am' && hour === 12 ? 0 : hour;
  const word = hour >= 1 && hour <= 12 ? timeWordIn(text) : null;
  if (!word) return hour;

  const am = hour % 12, pm = am + 12;
  return [am, pm].find(h => timeOfDayAt(h) === word) ?? (PM_TIMES.has(word) ? pm : am);
}
const MONEY_RE = /^(?:\d+|\d{1,3}(?:,\d{3})+)$/;
const STATUS_RE = /\[Status Window\s*\|([^\]\r\n]*)\]/g;

export function readStatusWindow(inner) {
  const fields = {};
  for (const part of String(inner ?? '').split(COMPAT_FIELD_SEP)) {
    const m = /^\s*([A-Za-z ]+?)\s*[:：]\s*(.*?)\s*$/.exec(part);
    if (m && m[2]) fields[m[1].toLowerCase()] = m[2];
  }
  const indoors = !!fields.site && wordIn(INDOOR_WORDS, fields.site) !== null;
  const money = fields.money && MONEY_RE.test(fields.money) ? Number(fields.money.replaceAll(',', '')) : null;
  return {
    timeOfDay: fields.time ? readTime(fields.time) : null,
    weather: fields.weather ? (indoors ? 'none' : wordIn(WEATHER_WORDS, fields.weather) ?? 'none') : null,
    region: fields.region ? wordIn(REGION_WORDS, fields.region) : null,
    place: ['area', 'site', 'location'].map(key => (fields[key] ? wordIn(PLACE_WORDS, fields[key]) : null)).find(Boolean) ?? null,
    location: fields.location ?? null,
    date: fields.date ?? null,
    money: Number.isSafeInteger(money) ? money : null,
    indoors,
  };
}

const windowsIn = message => (message?.role === 'char' ? [...String(message.data ?? '').matchAll(STATUS_RE)].map(m => readStatusWindow(m[1])).reverse() : []);

export const statusIn = message => windowsIn(message)[0] ?? null;

export function latestStatus(chat, upto = Infinity) {
  const messages = chat?.message ?? [];
  for (let i = Math.min(upto, messages.length - 1); i >= 0; i--) {
    const found = statusIn(messages[i]);
    if (found) return found;
  }
  return null;
}

export const bagMoney = (chat, compat) => (compat ? statusMoney(chat) : null);

export function statusMoney(chat) {
  const messages = chat?.message ?? [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const found = windowsIn(messages[i]).find(w => w.money !== null);
    if (found) return found.money;
  }
  return null;
}

const SHELTERED = new Set(['cave', 'ice_cave', 'fairy_cave', 'seabed', 'laboratory', 'factory', 'dojo', 'power_plant', 'temple', 'abyss', 'space']);

export function battleScene(battle, status) {
  const place = battle?.place ?? status?.place ?? 'plains';
  const timeOfDay = battle?.time ?? status?.timeOfDay ?? 'day';
  const field = SHELTERED.has(place) ? 'none' : status?.weather ?? 'none';
  return { place, time: dayOrNight(timeOfDay), timeOfDay, weather: FIELD_WEATHERS[field], terrain: FIELD_TERRAINS[field] ?? null };
}
