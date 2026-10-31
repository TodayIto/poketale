import { actsIn, parseAct } from './blocks.mjs';
import { findOocs } from './chat.mjs';
import { readSave, writeSave, partFor, liveSends } from './save.mjs';

const spot = (index, start) => index * 1e6 + start;

export const commandsIn = (message, index) => (message?.role === 'user' ? actsIn(message, index) : []);

export function actBlocks(chat) {
  const messages = chat?.message ?? [];
  const blocks = messages.flatMap((message, index) => actsIn(message, index)
    .map(block => ({ ...block, index, at: spot(index, block.start), ...parseAct(block.body) })));
  const answers = block => messages[block.index]?.role !== 'user' && commandsIn(messages[block.index - 1], block.index - 1).length > 0;
  return blocks.filter(block => !answers(block));
}

// This block's plan rows whose command block is in the chat now, in chat order (with the block: row.block)
function livePlans(chat, attempt, blocks = actBlocks(chat)) {
  const byKey = new Map(blocks.map(block => [block.key, block]));
  return (attempt?.plans ?? []).filter(row => byKey.has(row.act)).map(row => ({ ...row, block: byKey.get(row.act) }))
    .sort((a, b) => a.block.at - b.block.at);
}

const sameAt = (a, b) => !!a && !!b && a.turn === b.turn && a.check === b.check;
const pointOf = snapshot => (snapshot ? { turn: snapshot.turn, check: snapshot.check } : null);

export function chainFrom(chat, attempt, point, blocks) {
  const rows = [], entries = [];
  let at = point, end = null;
  for (const row of livePlans(chat, attempt, blocks)) {
    const k = sameAt(pointOf(row.from), at) ? 0 : row.entries.findIndex(entry => sameAt(entry.from, at));
    if (k < 0) continue;
    rows.push(row);
    entries.push(...row.entries.slice(k));
    end = row.to;
    at = pointOf(row.to);
  }
  return { rows, entries, end };
}

function checkpoints(chat, attempt, blocks) {
  const marks = new Map();
  (chat?.message ?? []).forEach((m, i) => findOocs(m?.data ?? '').forEach(ooc => { if (ooc.info.mark) marks.set(ooc.info.mark, spot(i, ooc.start)); }));
  const sends = liveSends(chat, attempt?.sends).filter(send => send.snapshot && marks.has(send.mark)).map(send => ({ at: marks.get(send.mark), snapshot: send.snapshot }));
  const plans = livePlans(chat, attempt, blocks).map(row => ({ at: row.block.at, snapshot: row.to }));
  return [...sends, ...plans].sort((a, b) => a.at - b.at);
}

function blockStart(chat, attempt, block, blocks) {
  return checkpoints(chat, attempt, blocks).filter(c => c.at < block.at).at(-1)?.snapshot ?? null;
}

export function nextUnplanned(chat, attempt, point, blocks = actBlocks(chat)) {
  const planned = new Set(livePlans(chat, attempt, blocks).map(row => row.act));
  const chain = chainFrom(chat, attempt, point, blocks);
  const end = chain.end ? pointOf(chain.end) : point;
  const after = chain.rows.at(-1)?.block.at ?? -1;
  for (const block of blocks) {
    if (planned.has(block.key) || block.at < after || !block.turns.length) continue;
    const from = blockStart(chat, attempt, block, blocks);
    if (from && sameAt(pointOf(from), end)) return { block, from };
  }
  return null;
}

export function rewindOf(chat, attempt, point) {
  const live = new Set(livePlans(chat, attempt).map(row => row.act));
  const sent = Math.max(-1, ...liveSends(chat, attempt?.sends).map(send => (Number.isInteger(send.logEnd) ? send.logEnd : Infinity)));
  for (const row of attempt?.plans ?? []) {
    if (live.has(row.act)) continue;
    const inside = row.entries.slice(1).some(entry => sameAt(entry.from, point)) || (row.entries.length && sameAt(pointOf(row.to), point));
    if (inside && sent <= (row.logFrom ?? 0)) return row.from;
  }
  return null;
}

function editAttempt(chat, blockKey, change) {
  const save = readSave(chat);
  const attempt = partFor(save, blockKey, 'attempt');
  if (!attempt) return false;
  writeSave(chat, { ...save, attempt: change(attempt) });
  return true;
}

const liveRows = (chat, attempt) => livePlans(chat, attempt).map(({ block, ...r }) => r);

export const addPlan = (chat, blockKey, row) => editAttempt(chat, blockKey, attempt =>
  ({ ...attempt, plans: [...liveRows(chat, attempt).filter(r => r.act !== row.act), row] }));

export const rewindPlans = (chat, blockKey, snapshot) => editAttempt(chat, blockKey, attempt => ({ ...attempt, auto: snapshot, plans: liveRows(chat, attempt) }));

// Marks rows as told (their rejected command went to the AI in the OOC with this send mark)
export const tellPlans = (chat, blockKey, acts, mark) => acts.length > 0 && editAttempt(chat, blockKey, attempt =>
  ({ ...attempt, plans: (attempt.plans ?? []).map(r => (acts.includes(r.act) ? { ...r, told: mark } : r)) }));

export function untold(chat, rows) {
  const marks = new Set((chat?.message ?? []).flatMap(m => findOocs(m?.data ?? '').map(ooc => ooc.info.mark)).filter(Boolean));
  return rows.filter(row => row.turns.some(t => t.state === 'rejected') && !(row.told && marks.has(row.told)));
}
