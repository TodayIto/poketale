import { say } from './screen-text.mjs';

// Kinds of why (screen text fail.why.<kind>)
export const WHY = Object.freeze(Object.fromEntries([
  'noChat', 'chatGone', 'chatMoved', 'oocMoved', 'blockGone', 'blockBroken', 'unreadable', 'denied', 'noMainScreen', 'writeBlocked', 'replying',
  'storyOn', 'busy', 'inBattle', 'ironMode', 'emptyParty', 'allFainted', 'unresumable', 'notOpened', 'noRecord', 'parkFailed', 'notPicture',
  'download', 'aiCall', 'aiFail', 'aiMany', 'noBlock', 'badBlock', 'sceneMoved', 'unknown'
].map(kind => [kind, kind])));

export const WHAT = Object.freeze(Object.fromEntries([
  'open', 'resume', 'retry', 'discard', 'restore', 'send', 'sendOn', 'result', 'storyEnd', 'autosave', 'record', 'buttons',
  'settings', 'picture', 'pictureRemove', 'compat', 'action', 'screen', 'forge', 'importOpen', 'import', 'importCancel', 'debugAdd', 'debugEdit', 'debugHeal'
].map(what => [what, what])));

export const failed = why => Object.assign(new Error(WHY[why] ? say('ko', `fail.why.${why}`) : why), { why });

export const ruleNote = (rule, values = {}) => ({ rule, values });
const isNote = value => !!value && typeof value === 'object' && typeof value.rule === 'string';

export function ruleText(note, lang) {
  const values = Object.fromEntries(Object.entries(note.values ?? {}).map(([key, value]) => [key, isNote(value) ? ruleText(value, lang) : String(value)]));
  return say(lang, `rule.${note.rule}`, values);
}

export const refusal = (notes, { join = '\n' } = {}) => Object.assign(new Error(notes.map(note => ruleText(note, 'ko')).join(join)), { notes, join });

export const ruleError = (rule, values = {}) => refusal([ruleNote(rule, values)]);

export const refused = error => Object.assign(new Error(error.message), error?.notes ? { why: 'rule', notes: error.notes, join: error.join }
  : { why: 'rule', words: String(error.message).replace(/\.$/, '') });

function kindOf(error) {
  if (typeof error === 'string') return WHY[error] ?? WHY.unknown;
  if (WHY[error?.why]) return WHY[error.why];
  const text = String(error?.message ?? error ?? '');
  if (/in progress/i.test(text)) return WHY.replying;
  if (/HTTP|fetch|network|proxy|Failed to load|받지 못/i.test(text)) return WHY.download;
  return WHY.unknown;
}

const whyOf = (error, lang) => (error?.why !== 'rule' ? say(lang, `fail.why.${kindOf(error)}`) : error.notes ? error.notes.map(note => ruleText(note, lang)).join(error.join) : error.words);

const isReplying = error => error?.why !== 'rule' && kindOf(error) === WHY.replying;

export const failureLines = (what, error, lang) => [say(lang, `fail.what.${what}`), say(lang, 'fail.reason', { why: whyOf(error, lang) })];

export const failureText = (what, error, lang) => failureLines(what, error, lang).join('\n');

export const failureNote = (what, error, lang) => ({ text: failureText(what, error, lang), kind: isReplying(error) ? 'info' : 'error' });
