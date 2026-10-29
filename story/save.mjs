import { findOocs } from './chat.mjs';
import { messageId } from './blocks.mjs';
import { readStored } from './stored.mjs';

export const SAVE_VAR = '$pkb_save';

const part = value => typeof value?.blockKey === 'string' && (value.sends === undefined || Array.isArray(value.sends));
const shapeV2 = save => [save.record, save.attempt].every(p => p == null || part(p)) && (save.start == null || typeof save.start.blockKey === 'string');

function readSaveRaw(chat) {
  const raw = chat?.scriptstate?.[SAVE_VAR];
  const now = readStored(raw, { v: 2, shape: shapeV2 });
  return now.status === 'unsupported' ? readStored(raw, { v: 1, shape: part }) : now;
}

export const saveStatus = chat => readSaveRaw(chat).status;

const startOf = s => (s?.spec ? { blockKey: s.blockKey, spec: s.spec } : null);
const recordOf = r => (r ? { blockKey: r.blockKey, sends: r.sends ?? [] } : null);
const placeOf = o => (typeof o?.on === 'string' ? { on: o.on, above: typeof o.above === 'string' ? o.above : null } : null);

const attemptOf = a => (a ? { blockKey: a.blockKey, auto: a.auto ?? null, balls: a.balls ?? null, sends: [...a.sends ?? [], ...a.prepared ? [a.prepared] : []],
  opened: placeOf(a.opened) } : null);

function openedHere(chat) {
  const messages = chat?.message ?? [], at = messages.length - 1;
  return at < 0 ? null : { on: messageId(messages[at], at), above: at > 0 ? messageId(messages[at - 1], at - 1) : null };
}

function fromV1(save) {
  const start = startOf({ blockKey: save.blockKey, spec: save.start });
  if (!save.auto) return { start, record: recordOf(save), attempt: null };
  return { start, record: save.retry ? recordOf(save) : null, attempt: attemptOf(save) };
}

export function readSave(chat) {
  const { status, value: save } = readSaveRaw(chat);
  if (status !== 'ok') return null;
  const { start, record, attempt } = save.v === 2 ? save : fromV1(save);
  return { v: 2, start: startOf(start), record: recordOf(record), attempt: attemptOf(attempt) };
}

export function writeSave(chat, save) {
  chat.scriptstate ??= {};
  if (!save?.start && !save?.record && !save?.attempt) { delete chat.scriptstate[SAVE_VAR]; return; }
  chat.scriptstate[SAVE_VAR] = JSON.stringify({ v: 2, start: save.start ?? null, record: save.record ?? null, attempt: save.attempt ?? null });
}
const empty = { start: null, record: null, attempt: null };

export function liveSends(chat, sends) {
  const messages = chat?.message ?? [];
  const marks = new Set(messages.flatMap(m => findOocs(m?.data ?? '').map(ooc => ooc.info.mark)).filter(Boolean));
  const ids = new Set(messages.map(m => m?.chatId).filter(Boolean));
  return (sends ?? []).filter(send => send && (send.mark ? marks.has(send.mark) : ids.has(send.chatId)));
}

const progress = send => [send.upto ?? -1, Number.isInteger(send.logEnd) ? send.logEnd : Infinity, send.ended ? 1 : 0];

function ahead(a, b) {
  const x = progress(a), y = progress(b);
  const at = x.findIndex((v, i) => v !== y[i]);
  return at < 0 ? 0 : x[at] < y[at] ? -1 : 1;
}

// The row furthest into the battle (of level rows, the later one) | null (none)
const furthest = sends => sends.reduce((best, send) => (best && ahead(send, best) < 0 ? best : send), null);

// This block's committed record ('record') or current attempt ('attempt') | null
export const partFor = (save, blockKey, which) => (save?.[which]?.blockKey === blockKey ? save[which] : null);

export const latestCheckpoint = (chat, of) => (of ? furthest(liveSends(chat, of.sends).filter(send => send.snapshot)) : null);

export function freshAttempt(chat, blockKey) {
  const save = readSave(chat) ?? empty;
  writeSave(chat, { start: null, record: save.record, attempt: attemptOf({ blockKey, opened: openedHere(chat) }) });
}

export function retryAttempt(chat, blockKey, of = 'record') {
  const save = readSave(chat) ?? empty;
  const source = partFor(save, blockKey, of);
  const checkpoint = latestCheckpoint(chat, source);
  const base = { blockKey, balls: source?.balls ?? null, opened: openedHere(chat) };
  if (!checkpoint) {
    writeSave(chat, { ...save, attempt: attemptOf(base) });
    return null;
  }

  const { logEnd, ...kept } = checkpoint;
  const turn = checkpoint.snapshot.turn;
  const point = Number.isInteger(turn) ? { ...kept, upto: Math.min(kept.upto ?? turn, turn - 1) } : checkpoint;
  const before = source.sends.filter(send => send !== checkpoint && ahead(send, point) <= 0);
  writeSave(chat, { ...save, attempt: attemptOf({ ...base, auto: checkpoint.snapshot, sends: [...before, point] }) });
  return checkpoint.snapshot;
}

export function setAuto(chat, blockKey, snapshot, balls = undefined) {
  const save = readSave(chat);
  const attempt = partFor(save, blockKey, 'attempt');
  if (!attempt) return false;
  const start = save.start?.blockKey === blockKey ? save.start : startOf({ blockKey, spec: snapshot?.spec });
  writeSave(chat, { ...save, start, attempt: { ...attempt, auto: snapshot ?? null, ...(balls !== undefined ? { balls } : {}) } });
  return true;
}

export const holdsAuto = (chat, blockKey, snapshot) => JSON.stringify(partFor(readSave(chat), blockKey, 'attempt')?.auto ?? null) === JSON.stringify(snapshot ?? null);

export const startSpec = (save, blockKey) => (save?.start?.blockKey === blockKey ? save.start.spec : null);

export function leaveAttempt(chat, blockKey) {
  const save = readSave(chat);
  if (!partFor(save, blockKey, 'attempt')) return false;
  writeSave(chat, { ...save, attempt: null });
  return true;
}

export function commitAttempt(chat, blockKey) {
  const save = readSave(chat) ?? empty;
  const attempt = partFor(save, blockKey, 'attempt');
  writeSave(chat, { ...save, record: recordOf({ blockKey, sends: attempt?.sends }), attempt: attempt ? null : save.attempt });
}

export function addSend(chat, blockKey, send) {
  const save = readSave(chat) ?? empty;
  const which = send.ended ? 'record' : 'attempt';
  const of = partFor(save, blockKey, which) ?? (send.ended ? recordOf({ blockKey }) : attemptOf({ blockKey }));
  const line = { chatId: send.chatId ?? null, ...(send.mark ? { mark: send.mark } : {}), upto: send.upto,
    ...(Number.isInteger(send.logFrom) ? { logFrom: send.logFrom } : {}), ...(Number.isInteger(send.logEnd) ? { logEnd: send.logEnd } : {}),
    screenEnd: send.screenEnd ?? 0, ended: !!send.ended, snapshot: send.snapshot ?? null };
  writeSave(chat, { ...save, [which]: { ...of, sends: [...of.sends, line] } });
}

export function sentPoint(chat, blockKey, { ended = false } = {}, save = readSave(chat)) {
  const live = liveSends(chat, partFor(save, blockKey, ended ? 'record' : 'attempt')?.sends);
  const last = furthest(live);
  return last ? { upto: last.upto, logEnd: Number.isInteger(last.logEnd) ? last.logEnd : null, screenEnd: last.screenEnd ?? 0, ended: !!last.ended, count: live.length }
    : { upto: -1, logEnd: null, screenEnd: 0, ended: false, count: 0 };
}

export function coveredMarks(chat, goes, save = readSave(chat)) {
  const at = new Map();
  (chat?.message ?? []).forEach((m, i) => findOocs(m?.data ?? '').forEach(ooc => { if (ooc.info.mark && !at.has(ooc.info.mark) && goes(i)) at.set(ooc.info.mark, i * 1e6 + ooc.start); }));
  const covered = new Set();
  for (const part of [save?.record, save?.attempt]) {
    const rows = liveSends(chat, part?.sends).filter(s => s.mark && at.has(s.mark) && Number.isInteger(s.logFrom) && Number.isInteger(s.logEnd));
    for (const a of rows) {
      const inside = b => b !== a && b.logFrom <= a.logFrom && b.logEnd >= a.logEnd && (!a.ended || b.ended);
      const wider = b => b.logFrom < a.logFrom || b.logEnd > a.logEnd || at.get(b.mark) < at.get(a.mark);
      if (rows.some(b => inside(b) && wider(b))) covered.add(a.mark);
    }
  }
  return covered;
}

export function sentAll(chat, blockKey, endTurn, save = readSave(chat)) {
  const point = sentPoint(chat, blockKey, { ended: true }, save);
  return point.count > 0 && point.ended && point.upto >= (endTurn ?? 0);
}
