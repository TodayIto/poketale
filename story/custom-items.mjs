import { toID } from '../engine/mon.mjs';

export const CUSTOM_PREFIX = 'custom:';

export const DEFAULT_EMOJI = '📦';

export const CUSTOM_TAGS = Object.freeze(['taunt', 'distract', 'cheer', 'food']);

export const isCustomItem = id => typeof id === 'string' && id.startsWith(CUSTOM_PREFIX);

export function customItemId(name) {
  const text = String(name ?? '').normalize('NFKC').toLowerCase();
  return CUSTOM_PREFIX + (text.replace(/[^\p{L}\p{N}]/gu, '') || text.replace(/\s+/g, ''));
}

export const itemId = id => (isCustomItem(id) ? id : toID(id));

export function customInfo(holder, id) {
  if (!isCustomItem(id)) return null;
  const info = holder?.customItems?.[id];
  if (!info) return null;
  const tags = tidyTags(info.tags);
  return { name: info.name, emoji: info.emoji, ...(tags.length ? { tags } : {}) };
}

export const hasTag = (holder, id, tag) => !!customInfo(holder, id)?.tags?.includes(tag);

const tidyTags = tags => CUSTOM_TAGS.filter(tag => [].concat(tags ?? []).includes(tag));

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

export function addCustomItem(state, id, { name, emoji, tags }) {
  if (!isCustomItem(id)) return;
  const old = state.customItems?.[id];
  const entry = old ? { ...old } : { name: String(name).trim(), emoji: emoji || DEFAULT_EMOJI };
  if (tags !== undefined) {
    const tidy = tidyTags(tags);
    if (tidy.length) entry.tags = tidy; else delete entry.tags;
  }
  state.customItems = { ...state.customItems, [id]: entry };
}

export function tidyCustomItems(state) {
  if (!state.customItems) return;
  const used = new Set([...Object.keys(state.bag ?? {}).filter(id => state.bag[id] > 0), ...[...state.party ?? [], ...state.box ?? []].map(mon => mon.set?.item)]);
  for (const id of Object.keys(state.customItems)) if (!used.has(id)) delete state.customItems[id];
  if (!Object.keys(state.customItems).length) delete state.customItems;
}
