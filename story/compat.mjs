export const COMPAT_ENTRIES = Object.freeze([
  { name: '👾 Pokémon Status', mark: '[Own Pokémon' },
  { name: '💻 Pokémon Storage', mark: '[Pokémon Storage Add' },
  { name: '📣 Battle Intention', mark: '[Battle Intention' },
]);

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
