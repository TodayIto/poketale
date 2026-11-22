import { CHANGE_ENTRY, VARS, trainerEntries } from './lore.mjs';

const PLACES = Object.fromEntries(Object.keys(VARS).map(k => [k, `{{getvar::${VARS[k].slice(1)}}}`]));

export const SECTION = (() => {
  const at = CHANGE_ENTRY.indexOf(PLACES.party);
  const end = CHANGE_ENTRY.indexOf(PLACES.bag);
  if (at < 1 || end < at) return null;
  const from = CHANGE_ENTRY.lastIndexOf('\n', at - 2) + 1;
  const to = CHANGE_ENTRY.indexOf('\n', end + PLACES.bag.length);
  const text = CHANGE_ENTRY.slice(from, to < 0 ? CHANGE_ENTRY.length : to + 1);
  const rest = Object.values(PLACES).reduce((left, place) => (left?.split(place).length === 2 ? left.replace(place, '') : null), text);
  return rest !== null && !rest.includes('{{') && !rest.includes('}}') ? text : null;
})();

const HEAD = SECTION?.slice(0, SECTION.indexOf('\n') + 1) ?? null;

export function sectionOf(vars) {
  if (!SECTION || !vars || !Object.keys(PLACES).every(k => typeof vars[k] === 'string')) return null;
  return Object.entries(PLACES).reduce((text, [k, place]) => text.replace(place, () => vars[k]), SECTION);
}

export const varsIn = chat => ({ ...Object.fromEntries(Object.entries(VARS).map(([k, name]) => [k, chat?.scriptstate?.[name]])),
  lore: trainerEntries(chat).map(({ key, content }) => ({ key, content })) });
/** Whether two of varsIn are the same */
export const sameVars = (a, b) => !!a && !!b && Object.keys(VARS).every(k => a[k] === b[k])
  && a.lore.length === b.lore.length && a.lore.every((e, i) => e.key === b.lore[i].key && e.content === b.lore[i].content);

const texts = messages => (Array.isArray(messages) ? messages : []).filter(m => typeof m?.content === 'string');

export const mayHold = messages => !!HEAD && texts(messages).some(m => m.content.includes(HEAD));
/** Whether the prompt holds entry 2 filled in with these values */
export const holds = (messages, vars) => { const section = sectionOf(vars); return !!section && texts(messages).some(m => m.content.includes(section)); };

const cutForms = text => [`\n\n${text}`, `${text}\n\n`, `\n${text}`, `${text}\n`, text];

export function fixPrompt(messages, { stale = [], fresh }) {
  if (!Array.isArray(messages) || !fresh) return messages;
  const swaps = [];
  const to = sectionOf(fresh);
  for (const vars of stale) {
    const from = sectionOf(vars);
    if (from && to && from !== to && !swaps.some(([f]) => f === from)) swaps.push([from, to]);
  }
  const freshLore = fresh.lore ?? [];
  const now = new Set(freshLore.map(e => e.content));
  const loreSwaps = [];
  for (const vars of stale) {
    for (const entry of vars?.lore ?? []) {
      if (!entry.content || now.has(entry.content) || loreSwaps.some(([f]) => f === entry.content)) continue;
      loreSwaps.push([entry.content, freshLore.find(e => e.key === entry.key)?.content ?? null]);
    }
  }
  if (!swaps.length && !loreSwaps.length) return messages;
  let changed = false;
  const out = [];
  for (const message of messages) {
    if (typeof message?.content !== 'string') { out.push(message); continue; }
    let text = message.content;
    for (const [from, into] of swaps) if (text.includes(from)) text = text.split(from).join(into);
    for (const [from, into] of loreSwaps) {
      if (!text.includes(from)) continue;
      if (into !== null) { text = text.split(from).join(into); continue; }
      const form = cutForms(from).find(f => text.includes(f));
      text = text.split(form).join('');
    }
    if (text === message.content) { out.push(message); continue; }
    changed = true;
    if (text.trim() !== '' || message.content.trim() === '') out.push({ ...message, content: text });
  }
  return changed ? out : messages;
}
