import { toID } from '../engine/mon.mjs';
import { ITEM_EFFECTS_READY } from './item-effects.mjs';
import { isMachineId } from './machine-standards.mjs';

export const CUSTOM_PREFIX = 'custom:';
/** Picture of a custom item written without an emoji */
export const DEFAULT_EMOJI = '📦';

export const CUSTOM_EFFECTS = Object.freeze(['cheer', 'distract', 'taunt', 'food']);

const EFFECT_ORDER = ITEM_EFFECTS_READY ? CUSTOM_EFFECTS : Object.freeze(['food', ...CUSTOM_EFFECTS.filter(effect => effect !== 'food')]);

export const topEffect = (...effects) => EFFECT_ORDER.find(effect => effects.flat().includes(effect)) ?? null;
/** An owner as stored: the text as written, trimmed ('' = none) */
const ownerText = owner => (typeof owner === 'string' ? owner.trim() : '');

export const isCustomItem = id => typeof id === 'string' && id.startsWith(CUSTOM_PREFIX);

export function customItemId(name) {
  const text = String(name ?? '').normalize('NFKC').toLowerCase();
  return CUSTOM_PREFIX + (text.replace(/[^\p{L}\p{N}]/gu, '') || text.replace(/\s+/g, ''));
}

export function storyDisc(holder, id) {
  if (!isCustomItem(id)) return null;
  const disc = holder?.customItems?.[id]?.disc;
  return typeof disc === 'string' && isMachineId(disc) ? disc : null;
}

export const itemAs = (holder, id) => storyDisc(holder, id) ?? id;

export const itemId = id => (isCustomItem(id) ? id : toID(id));

export function customInfo(holder, id) {
  if (!isCustomItem(id)) return null;
  const info = holder?.customItems?.[id];
  if (!info) return null;
  const effect = CUSTOM_EFFECTS.includes(info.effect) ? info.effect : topEffect([].concat(info.tags ?? []));
  const owner = ownerText(info.owner);
  const ownerMon = owner && typeof info.ownerMon === 'string' && info.ownerMon ? info.ownerMon : '';
  return { name: info.name, emoji: info.emoji, ...(effect ? { effect } : {}), ...(owner ? { owner } : {}), ...(ownerMon ? { ownerMon } : {}) };
}

export function ownerName(state, id, speciesName = species => species) {
  const info = customInfo(state, id);
  if (!info?.owner) return '';
  const mon = info.effect === 'cheer' && info.ownerMon ? [...state.party ?? [], ...state.box ?? []].find(m => m.uid === info.ownerMon && !m.egg) : null;
  return mon ? mon.set.name || speciesName(mon.set.species) : info.owner;
}

export function withTags(info) {
  if (!info || typeof info !== 'object' || !Object.hasOwn(info, 'effect')) return info;
  return { ...info, tags: CUSTOM_EFFECTS.includes(info.effect) ? [info.effect] : [] };
}

export const itemsWithTags = items => (items && typeof items === 'object' ? Object.fromEntries(Object.entries(items).map(([id, info]) => [id, withTags(info)])) : items);

export const withItemTags = state => (state?.customItems ? { ...state, customItems: itemsWithTags(state.customItems) } : state);

/** Whether a custom item has effect (CUSTOM_EFFECTS) */
export const hasEffect = (holder, id, effect) => customInfo(holder, id)?.effect === effect;

export function customText(holder, id) {
  const info = customInfo(holder, id);
  return info ? `${info.emoji} ${info.name}` : null;
}

const DEX_WORDS = ['도감', 'pokedex', 'rotomdex', 'rotomphone', 'smartrotom', '로토무폰', '스마트로토무', 'pokemonencyclopedia'];
const DEX_NOT = ['페이지', '케이스', '커버', '부품', '업그레이드', '조각', '데이터칩', '스티커', '포스터', '책장', 'page', 'case', 'cover', 'upgrade',
  'sticker', 'poster', 'chip', 'shelf', 'scanner', 'module'];

const nameKey = text => String(text ?? '').normalize('NFKD').replace(/\p{M}/gu, '').normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const dexName = text => { const key = nameKey(text); return !!key && DEX_WORDS.some(w => key.includes(w)) && !DEX_NOT.some(w => key.includes(w)); };

export function isDexItem(holder, id) {
  if (!isCustomItem(id)) return false;
  return dexName(id.slice(CUSTOM_PREFIX.length)) || dexName(holder?.customItems?.[id]?.name);
}

const PICTO = '\\p{Extended_Pictographic}[\\uFE0E\\uFE0F]?\\p{Emoji_Modifier}?(?:[\\u{E0020}-\\u{E007E}]+\\u{E007F})?';
const ONE = `(?:\\p{Regional_Indicator}{2}|[0-9#*]\\uFE0F?\\u20E3|${PICTO}(?:\\u200D${PICTO})*)`;
const LEAD_RE = new RegExp(`^\\s*(${ONE})(?:\\s*${ONE})*\\s*`, 'u');

export function splitEmoji(text) {
  const s = String(text ?? '');
  const m = LEAD_RE.exec(s);
  return m ? { emoji: m[1], rest: s.slice(m[0].length).trim() } : { emoji: '', rest: s.trim() };
}

export function addCustomItem(state, id, info, { story = false } = {}) {
  if (!isCustomItem(id)) return;
  const { name, emoji, effect, owner, ownerMon, tags } = info ?? {};
  const old = customInfo(state, id);
  const entry = old ? { ...old } : { name: String(name).trim(), emoji: emoji || DEFAULT_EMOJI };
  const disc = storyDisc(state, id); // the disc noted where it was first had stays (storyDiscs)
  if (disc) entry.disc = disc;
  const given = key => Object.hasOwn(info ?? {}, key);
  const next = story ? topEffect(entry.effect ?? [], effect ?? []) : given('effect') ? topEffect(effect ?? []) : tags !== undefined ? topEffect([].concat(tags ?? [])) : entry.effect;
  if (next) entry.effect = next; else delete entry.effect;
  const who = ownerText(owner);
  if (who) {
    entry.owner = who;
    if (typeof ownerMon === 'string' && ownerMon) entry.ownerMon = ownerMon; else delete entry.ownerMon;
  } else if (!story && given('owner')) { delete entry.owner; delete entry.ownerMon; }
  state.customItems = { ...state.customItems, [id]: withTags(entry) };
}

export function tidyCustomItems(state) {
  if (!state.customItems) return;
  const used = new Set([...Object.keys(state.bag ?? {}).filter(id => state.bag[id] > 0), ...[...state.party ?? [], ...state.box ?? []].map(mon => mon.set?.item)]);
  for (const id of Object.keys(state.customItems)) if (!used.has(id)) delete state.customItems[id];
  if (!Object.keys(state.customItems).length) delete state.customItems;
}
