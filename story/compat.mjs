export const COMPAT_ENTRIES = Object.freeze([
  { name: '👾 Pokémon Status', mark: '[Own Pokémon' },
  { name: '💻 Pokémon Storage', mark: '[Pokémon Storage Add' },
  { name: '📣 Battle Intention', mark: '[Battle Intention' },
]);

export const COMPAT_VAR = 'pkb_compat';
const OPEN = `{{#when::keep::{{getvar::${COMPAT_VAR}}}::isnot::1}}`;
const CLOSE = '{{/when}}';

// Text -> { head: @@ decorator lines (with trailing newline), body }
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
