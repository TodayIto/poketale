import { norm } from './blocks.mjs';

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

export const COMPAT_TABS = Object.freeze({
  button: 'yptab-button', storageButton: 'yptab-button-storage', settingsButton: 'yptab-button-settings', storagePanel: 'yptab-panel-storage',
});

export const SETTLEMENT_BOT = Object.freeze({ name: 'yaripoké', vars: Object.freeze({ mode: '$yp_YariPokeMode', winInstruction: '$yp_YariPokeWinInstruction', gender: '$yp_UserGender' }) });

const compatVar = (chat, name, values) => values.get(String(chat?.scriptstate?.[`$${name}`] ?? '').trim()) ?? null;

export const COMPAT_LANG_VAR = 'yp_Language';
const COMPAT_LANGS = new Map([['1', 'ko'], ['2', 'en'], ['3', 'en']]);

export const compatLang = chat => compatVar(chat, COMPAT_LANG_VAR, COMPAT_LANGS);

export const COMPAT_TRAINER_GENDER_VAR = 'yp_GenericTrainerGender';
const COMPAT_TRAINER_GENDERS = new Map([['2', 'M'], ['3', 'F']]);

export const compatTrainerGender = chat => compatVar(chat, COMPAT_TRAINER_GENDER_VAR, COMPAT_TRAINER_GENDERS);

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

export function statusMoney(chat) {
  const messages = chat?.message ?? [];
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role !== 'char') continue;
    const windows = [...String(messages[i].data ?? '').matchAll(/\[Status Window\s*\|([^\]\r\n]*)\]/g)];
    for (let j = windows.length - 1; j >= 0; j--) {
      const value = /(?:^|\|)\s*Money\s*:\s*([^|]*)/.exec(windows[j][1])?.[1].trim();
      if (!value || !/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(value)) continue;
      const amount = Number(value.replaceAll(',', ''));
      if (Number.isSafeInteger(amount)) return amount;
    }
  }
  return null;
}
