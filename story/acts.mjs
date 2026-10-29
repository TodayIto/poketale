import { findBlocks, findTags, parseChange, hashKey, stripForPrompt, messageId } from './blocks.mjs';
import { readTable, writeTable, computeState, isReflected, heldChanges, changeAt, applyOps, findMon, hpPercentOf, movePp, toID } from './state.mjs';
import { readStored } from './stored.mjs';
import { findOocs, unwrapOocs } from './chat.mjs';
import { pkbLog } from './prompts.mjs';
import { coveredMarks } from './save.mjs';
import { boxOf } from './diary.mjs';

export const QUEUE_VAR = '$pkb_queue';

// How long a plugin-inserted OOC goes to the AI (last n turns - counted in player messages)
export const OOC_TURNS = 3;

const tagText = tag => `<pkb#${tag}>`;

const readQueueRaw = chat => readStored(chat?.scriptstate?.[QUEUE_VAR], { shape: queue => Array.isArray(queue.actions) });

export const queueStatus = chat => readQueueRaw(chat).status;

export function readQueue(chat) {
  const { status, value } = readQueueRaw(chat);
  if (status !== 'ok') return { v: 1, since: null, actions: [] };
  const present = tagsInChat(chat);
  return { v: 1, since: value.since ?? null, actions: value.actions.filter(a => !(a?.sent && present.has(a.sent))) };
}

export function settleQueue(chat) {
  const { status, value } = readQueueRaw(chat);
  if (status !== 'ok') return false;
  const queue = readQueue(chat);
  if (queue.actions.length === value.actions.length) return false;
  writeQueue(chat, queue);
  return true;
}
export function writeQueue(chat, queue) {
  chat.scriptstate ??= {};
  if (queue?.actions?.length) chat.scriptstate[QUEUE_VAR] = JSON.stringify({ v: 1, since: queue.since ?? null, actions: queue.actions });
  else delete chat.scriptstate[QUEUE_VAR];
}

const tagsInChat = chat => new Set((chat?.message ?? []).flatMap(m => findTags(m?.data ?? '').map(t => t.key)));

export function runAction(state, action, ctx, { normalize = false } = {}) {

  // An action is all or nothing: if any op fails, nothing is applied
  let cur = state;
  const ops = [], steps = [], errors = [];
  (action.ops ?? []).forEach((raw, i) => {
    const op = normalize ? withUids(cur, raw, ctx.sim) : raw;
    const result = applyOps(cur, [op], ctx, `act:${action.id ?? 'x'}:${i}`, null, { trace: true });
    cur = result.state;
    ops.push(op);
    steps.push(...result.steps);
    errors.push(...result.errors);
  });
  if (errors.length) return { state, ops, events: [], errors };
  const ok = steps;
  let events = ok.map(step => eventOf(step, ctx.sim));

  if (action.type === 'use' && action.item) {
    const effects = events.filter(e => !(e.kind === 'item' && e.item === toID(action.item)));
    events = [{ kind: 'use', item: toID(action.item), who: effects.find(e => e.who)?.who ?? null, effects }];
  }
  return { state: cur, ops, events, errors };
}

const REF_FIELDS = ['ref', 'a', 'b'];
function withUids(state, op, sim) {
  const out = { ...op };
  for (const field of REF_FIELDS) {
    const ref = op[field];
    if (!ref || ref === 'all' || typeof ref.uid === 'string') continue;
    try { out[field] = { uid: findMon(state, ref, sim, { boxFirst: op.op === 'withdraw' }).mon.uid }; } catch {                                            }
  }
  return out;
}

export function pendingState(chat, ctx, { uptoIndex, survey } = {}) {
  const { state, table, changed, counted, reflected } = computeState(chat, ctx, { uptoIndex, survey });
  const added = readQueue(chat).actions.filter(action => !isReflected(action, reflected, counted));
  let cur = state;
  const errors = [];
  for (const action of added) {
    const result = runAction(cur, action, ctx);
    cur = result.state;
    errors.push(...result.errors);
  }
  return { state: cur, table, errors, changed, added };
}

export function queueAction(chat, ctx, input, { now = Date.now(), salt = '' } = {}) {
  if (!input || !Array.isArray(input.ops) || !input.ops.length) throw new Error('행동에 연산이 없습니다.');
  adoptQueue(chat, ctx, { salt: `${now}:${salt}` });
  const queue = readQueue(chat);
  const { state: base } = pendingState(chat, ctx);
  const type = /^[a-z]{1,16}$/.test(String(input.type ?? '')) ? input.type : 'other';
  const action = { id: hashKey(`${now}:${salt}:${queue.actions.length}:${JSON.stringify(input.ops)}`), type, at: now };
  if (input.item) action.item = toID(input.item);
  const result = runAction(base, { ...action, ops: input.ops }, ctx, { normalize: true });
  if (result.errors.length) throw new Error(result.errors.join(' / '));

  if (base.party.length && !result.state.party.length) throw new Error('파티에 포켓몬이 한 마리는 있어야 합니다.');
  action.ops = result.ops;
  action.events = result.events;
  const messages = chat.message ?? [];
  if (!queue.actions.length) queue.since = { chatId: messages.at(-1)?.chatId ?? null, count: messages.length };
  queue.actions.push(action);
  writeQueue(chat, queue);
  return { action, state: result.state };
}

export function attachQueue(chat, ctx, { salt = '', uptoIndex } = {}) {
  const queue = readQueue(chat);
  if (!queue.actions.length) return null;
  const { state, table, errors } = pendingState(chat, ctx, { uptoIndex });
  const tag = hashKey(`acts:${JSON.stringify(queue.since)}:${queue.actions.map(a => a.id).join(',')}:${salt}`);
  table.snaps[tag] = state;
  table.acts = { ...table.acts, [tag]: {
    events: queue.actions.flatMap(a => a.events ?? []), errors,

    v: 2, actions: queue.actions.map(({ id, type, at, item, ops, in: holder }) => ({ id, type, at, ...(item ? { item } : {}), ops, ...(holder ? { in: holder } : {}) })),
  } };
  writeTable(chat, table);
  writeQueue(chat, { ...queue, actions: queue.actions.map(a => ({ ...a, sent: tag })) });
  return tag;
}

export function nextOwnMessage(chat, queue = readQueue(chat), table = null) {
  const messages = chat?.message ?? [];
  if (!queue.actions.length || !queue.since) return -1;
  let sinceIndex;
  if (queue.since.chatId) {
    sinceIndex = messages.findIndex(m => m.chatId === queue.since.chatId);
    if (sinceIndex < 0) return -1;
  } else sinceIndex = queue.since.count - 1;
  const acts = (table ?? readTable(chat)).acts ?? {};
  return messages.findIndex((m, i) => i > sinceIndex && m?.role === 'user' && !findTags(m.data ?? '').some(t => acts[t.key]));
}

export function adoptQueue(chat, ctx, { salt = '' } = {}) {
  const index = nextOwnMessage(chat);
  if (index < 0) return -1;
  const tag = attachQueue(chat, ctx, { salt, uptoIndex: index });
  if (!tag) return -1;
  const message = chat.message[index];
  message.data = `${String(message.data ?? '').replace(/\s+$/, '')}\n${tagText(tag)}`;
  return index;
}

export function eventOf({ op, before, after }, sim) {
  const all = state => (state ? [...state.party, ...state.box] : []);
  const byUid = (state, uid) => all(state).find(m => m.uid === uid) ?? null;
  const who = mon => (mon ? { uid: mon.uid, species: mon.set.species, name: mon.set.name || '' } : null);
  const refWho = (ref, opts) => {
    try { if (before) return who(findMon(before, ref, sim, opts).mon); } catch {             }
    return { ref: ref?.slot ? `#${ref.slot}` : ref?.box ? `box ${ref.box}` : ref?.name ?? '?' };
  };
  const pair = w => [byUid(before, w?.uid), byUid(after, w?.uid)];
  const hp = mon => (mon && sim ? hpPercentOf(sim, mon) : null);
  switch (op?.op) {
    case 'add': {
      const added = all(after).find(m => !byUid(before, m.uid));

      const at = added ? after.box.indexOf(added) : -1;
      return { kind: 'add', who: added ? who(added) : { species: op.set?.species, name: op.set?.name ?? '' }, level: added?.set.level ?? op.set?.level,
        box: added ? (at >= 0 ? boxOf(after, at) : false) : op.to === 'box' };
    }
    case 'level': {
      const w = refWho(op.ref); const [b, a] = pair(w);
      return { kind: 'level', who: w, from: b?.set.level ?? null, to: a?.set.level ?? op.to ?? null, delta: op.delta ?? null };
    }
    case 'heal': {
      if (op.ref === 'all') {

        // Sacred Ash (revive): include the number revived - one log line "all fainted Pokemon revived"
        const revived = op.revive ? (before?.party ?? []).filter(m => m.hp === 0).length : 0;
        return revived ? { kind: 'heal', all: true, revivedAll: revived } : { kind: 'heal', all: true };
      }
      const w = refWho(op.ref); const [b, a] = pair(w);
      return { kind: 'heal', who: w, hpFrom: hp(b), hpTo: hp(a),
        cured: !!(b && a && b.status && b.status !== 'fnt' && !a.status), revived: !!(b && a && b.hp === 0 && a.hp !== 0) };
    }
    case 'item': return { kind: 'item', item: toID(op.item), delta: op.delta };
    case 'swap': {
      const at = w => { const i = before?.party.findIndex(m => m.uid === w.uid) ?? -1; return i >= 0 ? { party: i + 1 } : { box: true }; };
      const a = refWho(op.a), b = refWho(op.b);
      return { kind: 'swap', a, b, at: [at(a), at(b)] };
    }
    case 'release': case 'deposit': return { kind: op.op, who: refWho(op.ref) };
    case 'withdraw': return { kind: 'withdraw', who: refWho(op.ref, { boxFirst: true }) };
    case 'nickname': return { kind: 'nickname', who: refWho(op.ref), name: String(op.name ?? '').trim() };
    case 'hold': {
      const w = refWho(op.ref); const [b] = pair(w);
      return { kind: 'hold', who: w, item: op.item ? toID(op.item) : '', prev: b?.set.item || '' };
    }
    case 'evolve': {
      const w = refWho(op.ref); const [, a] = pair(w);
      return { kind: 'evolve', who: w, species: a?.set.species ?? op.species };
    }
    case 'teach': {
      const w = refWho(op.ref); const [, a] = pair(w);
      return { kind: 'teach', who: w, move: toID(op.move), forget: op.forget ? toID(op.forget) : null, learned: !!a?.set.moves.includes(toID(op.move)) };
    }
    case 'money': return { kind: 'money', delta: op.delta };

    case 'learn': {
      const w = refWho(op.ref);
      return op.skip ? { kind: 'skipmove', who: w, move: toID(op.move) }
        : { kind: 'teach', who: w, move: toID(op.move), forget: op.forget ? toID(op.forget) : null, learned: true };
    }
    case 'noevolve': { const w = refWho(op.ref); return { kind: 'noevolve', who: w, species: pair(w)[0]?.pending?.evolve ?? null }; }
    case 'pp': return { kind: 'pp', who: refWho(op.ref), move: op.move ? toID(op.move) : null };
    case 'boxname': return { kind: 'boxname', box: Number(op.box), name: String(op.name ?? '').trim() };

    case 'evs': {
      const w = refWho(op.ref); const [b, a] = pair(w);
      return { kind: 'evs', who: w, stat: op.stat, from: b?.set.evs?.[op.stat] ?? 0, to: a?.set.evs?.[op.stat] ?? 0 };
    }
    case 'exp': {
      const w = refWho(op.ref); const [b, a] = pair(w);
      return { kind: 'exp', who: w, amount: (a?.exp ?? 0) - (b?.exp ?? 0), from: b?.set.level ?? null, to: a?.set.level ?? null };
    }
    case 'ability': {
      const w = refWho(op.ref); const [b, a] = pair(w);
      return { kind: 'ability', who: w, from: toID(b?.set.ability), to: toID(a?.set.ability ?? op.ability) };
    }
    case 'nature': {
      const w = refWho(op.ref); const [b, a] = pair(w);
      return { kind: 'nature', who: w, nature: a?.set.nature ?? op.nature, from: b?.set.nature ?? null };
    }
    case 'hypertrain': {
      const w = refWho(op.ref); const [b, a] = pair(w);
      return { kind: 'hypertrain', who: w, stats: Object.keys(a?.hyper ?? {}).filter(s => !Object.hasOwn(b?.hyper ?? {}, s)) };
    }
    case 'ppup': {

      // PP Up / PP Max: that move's max PP from what to what (one log line)
      const w = refWho(op.ref); const [b, a] = pair(w);
      const move = toID(op.move), max = mon => (mon && sim ? movePp(sim, mon, move).maxpp : null);
      return { kind: 'ppup', who: w, move, from: max(b), to: max(a) };
    }
    default: return { kind: 'other', op: String(op?.op ?? '?') };
  }
}

export function actsIn(text, table) {
  const acts = findTags(text).map(t => table?.acts?.[t.key]).filter(Boolean);
  if (!acts.length) return null;
  return { events: acts.flatMap(a => a.events ?? []), errors: acts.flatMap(a => a.errors ?? []) };
}

export const HELD_LINE = '배틀 중이라 반영하지 않음';

export function changesIn(text, chat, ctx) {
  const blocks = findBlocks(text).filter(b => b.kind === 'change');
  if (!blocks.length) return null;
  const messages = chat?.message ?? [];
  const keys = blocks.map(b => b.key);
  const same = messages.findLastIndex(m => String(m?.data ?? '') === String(text));
  const index = same >= 0 ? same : messages.findLastIndex(m => {
    const own = findBlocks(m?.data ?? '').filter(b => b.kind === 'change').map(b => b.key);
    return keys.every(k => own.includes(k));
  });
  let state = null, table = null;
  if (index >= 0 && ctx) ({ state, table } = computeState(chat, ctx, { uptoIndex: index - 1 }));
  const chatId = index >= 0 ? messageId(messages[index], index) : null;
  const held = index >= 0 ? heldChanges(chat, table ?? readTable(chat)) : new Set();
  const events = [], errors = [];
  for (const [n, block] of blocks.entries()) {
    if (held.has(changeAt(index, n))) { errors.push(HELD_LINE); continue; }
    const { ops, errors: unread } = parseChange(block.body);
    errors.push(...unread);
    if (!state) { events.push(...ops.map(op => eventOf({ op, before: null, after: null }, null))); continue; }
    const result = applyOps(state, ops, ctx, `${chatId}:${block.key}`, table, { trace: true });
    state = result.state;
    for (const step of result.steps) {
      if (step.error) errors.push(step.error);
      else events.push(eventOf(step, ctx.sim));
    }
  }
  return { events, errors };
}

const inWindow = (messages, index) => messages.slice(index).filter(m => m?.role === 'user').length <= OOC_TURNS;

const coveredOf = new WeakMap();
const coveredIn = chat => {
  if (!chat || typeof chat !== 'object') return new Set();
  if (!coveredOf.has(chat)) coveredOf.set(chat, coveredMarks(chat, index => inWindow(chat.message ?? [], index)));
  return coveredOf.get(chat);
};

export function promptText(text, chat, table, { names = null, korean = true } = {}) {
  const messages = chat?.message ?? [];
  let out = String(text ?? '');
  const covered = coveredIn(chat);
  for (const ooc of findOocs(out).reverse()) {
    if (covered.has(ooc.info.mark)) { out = out.slice(0, ooc.start) + out.slice(ooc.end); continue; }
    const piece = out.slice(ooc.start, ooc.end);
    const index = messages.findLastIndex(m => String(m?.data ?? '').includes(piece));
    if (index < 0) continue;
    if (!inWindow(messages, index)) out = out.slice(0, ooc.start) + out.slice(ooc.end);
  }
  out = unwrapOocs(out);
  const latest = messages.findLastIndex(m => m?.role === 'user');
  const latestText = latest >= 0 ? String(messages[latest].data ?? '') : null;
  let events = [];
  const own = findTags(out).filter(t => table?.acts?.[t.key]);
  if (own.length && own.some(t => latestText?.includes(tagText(t.key)))) events = own.flatMap(t => table.acts[t.key].events ?? []);
  else if (!own.length && latestText !== null && latestText === String(text ?? '') && nextOwnMessage(chat, readQueue(chat), table) === latest) {
    events = readQueue(chat).actions.flatMap(a => a.events ?? []);
  }
  out = stripForPrompt(out);
  const log = pkbLog(events, { korean, en: names });
  return log ? `${out}\n${log}` : out;
}

export { tagText };
