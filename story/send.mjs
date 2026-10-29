import { wrapOoc, findOocs } from './chat.mjs';
import { readLog, turnSpan, hasEvents } from './narrate.mjs';
import { storyOoc, RESULT_LINE_RE } from './prompts.mjs';
import { outcomeOf } from './outcome.mjs';
import { hashKey, findTags, findMarks } from './blocks.mjs';

// What the plugin puts in a message besides OOC: action tags, marks, and a result line with its tag
const RESULT_WITH_TAG = new RegExp(String.raw`${RESULT_LINE_RE.source}(?=\s*<pkb#)`, 'g');
const ourParts = text => [...findOocs(text), ...findTags(text), ...findMarks(text)].sort((a, b) => b.start - a.start);

function ownWords(text) {
  let out = String(text ?? '').replace(RESULT_WITH_TAG, '');
  for (const part of ourParts(out)) out = out.slice(0, part.start) + out.slice(part.end);
  return out.trim();
}

export const SEND_WAIT = Object.freeze({ text: '응답이 끝나면 보냅니다', kind: 'info' });

export const isOurOoc = message => message?.role === 'user' && findOocs(message?.data ?? '').length > 0 && !ownWords(message.data);

function legacyEnd(log, upto) {
  if (!Number.isInteger(upto) || upto < 0) return 0;
  const next = log.findIndex(line => line === `|turn|${upto + 1}`);
  return next < 0 ? log.length : next;
}

export function sendRange({ sent = { upto: -1 }, log = [], to = log.length, ended = false }) {
  const first = !(sent?.count > 0 || sent?.upto >= 0);
  const from = first ? 0 : Number.isInteger(sent?.logEnd) ? sent.logEnd : legacyEnd(log, sent?.upto);
  const end = Math.min(Math.max(to ?? 0, 0), log.length);
  if (ended && sent?.ended && from >= end) return null;
  const read = readLog(log, { from, to: end });
  if (!hasEvents(read) && !(ended && !sent?.ended)) return null;
  return { from, to: end, first, read };
}

export function buildOoc(format, source, range, { screenFrom = 0, screenTo, korean = true, en = null } = {}) {
  const ended = !!source.result;
  const text = storyOoc(format, { battle: source.battle, result: source.result, ended, first: range.first, read: range.read,
    screen: (source.screen ?? []).slice(screenFrom, screenTo), korean, en });
  const span = turnSpan(range.read);
  return { text, info: { vs: source.vs ?? '', turns: span ? [span.fromTurn, span.toTurn] : null, result: ended ? outcomeOf(source.result) : '' } };
}

export function markOoc(text, info = {}, newId = () => globalThis.crypto.randomUUID()) {
  const mark = hashKey(newId());
  return { wrapped: wrapOoc(text, { ...info, mark }), mark };
}

export const oocAhead = (wrapped, text) => `${wrapped}\n\n${String(text ?? '').replace(/^\s+/, '')}`;

export function insertOoc(chat, { text, info = {}, tail = '', newId = () => globalThis.crypto.randomUUID(), now = Date.now() }) {
  chat.message ??= [];
  const messages = chat.message;
  const { wrapped, mark } = markOoc(text, info, newId);
  const end = tail ? `\n${tail}` : '';
  const last = messages.at(-1);
  if (isOurOoc(last)) {
    last.data = `${String(last.data).replace(/\s+$/, '')}\n\n${wrapped}${end}`;
    last.chatId ??= newId();
    return { index: messages.length - 1, chatId: last.chatId, appended: true, mark };
  }
  const message = { role: 'user', data: `${wrapped}${end}`, chatId: newId(), time: now };
  messages.push(message);
  return { index: messages.length - 1, chatId: message.chatId, appended: false, mark };
}

export function replyTo(messages, mark) {
  const at = (messages ?? []).findIndex(m => findOocs(String(m?.data ?? '')).some(ooc => ooc.info.mark === mark));
  if (at < 0) return 'over';
  const below = messages[at + 1];
  if (!below) return 'waiting';
  return below.role === 'char' ? 'reply' : 'over';
}
