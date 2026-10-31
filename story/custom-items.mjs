import { toID } from '../engine/mon.mjs';

export const CUSTOM_PREFIX = 'custom:';

// Picture of a custom item written without an emoji
export const DEFAULT_EMOJI = '📦';

export const isCustomItem = id => typeof id === 'string' && id.startsWith(CUSTOM_PREFIX);

export function customItemId(name) {
  const text = String(name ?? '').normalize('NFKC').toLowerCase();
  return CUSTOM_PREFIX + (text.replace(/[^\p{L}\p{N}]/gu, '') || text.replace(/\s+/g, ''));
}

export const itemId = id => (isCustomItem(id) ? id : toID(id));

export function customInfo(holder, id) {
  if (!isCustomItem(id)) return null;
  const info = holder?.customItems?.[id];
  return info ? { name: info.name, emoji: info.emoji } : null;
}

export function customText(holder, id) {
  const info = customInfo(holder, id);
  return info ? `${info.emoji} ${info.name}` : null;
}

const PICTO = '\\p{Extended_Pictographic}[\\uFE0E\\uFE0F]?\\p{Emoji_Modifier}?(?:[\\u{E0020}-\\u{E007E}]+\\u{E007F})?';
const ONE = `(?:\\p{Regional_Indicator}{2}|[0-9#*]\\uFE0F?\\u20E3|${PICTO}(?:\\u200D${PICTO})*)`;
const LEAD_RE = new RegExp(`^\\s*(${ONE})(?:\\s*${ONE})*\\s*`, 'u');

export function splitEmoji(text) {
  const s = String(text ?? '');
  const m = LEAD_RE.exec(s);
  return m ? { emoji: m[1], rest: s.slice(m[0].length).trim() } : { emoji: '', rest: s.trim() };
}

export function addCustomItem(state, id, { name, emoji }) {
  if (!isCustomItem(id) || state.customItems?.[id]) return;
  state.customItems = { ...state.customItems, [id]: { name: String(name).trim(), emoji: emoji || DEFAULT_EMOJI } };
}

export function tidyCustomItems(state) {
  if (!state.customItems) return;
  const used = new Set([...Object.keys(state.bag ?? {}).filter(id => state.bag[id] > 0), ...[...state.party ?? [], ...state.box ?? []].map(mon => mon.set?.item)]);
  for (const id of Object.keys(state.customItems)) if (!used.has(id)) delete state.customItems[id];
  if (!Object.keys(state.customItems).length) delete state.customItems;
}
