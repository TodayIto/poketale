import { findBlocks, findTags, parseChange, hashKey, stripForPrompt, messageId, hasBlocks, readsBlockEdges } from './blocks.mjs';
import { readTable, writeTable, computeState, isReflected, heldChanges, changeAt, applyOps, findMon, hpPercentOf, movePp, toID, hatchedParty, storyTick, isEgg, stateFormat, liveActions,
  labSet, rngFor } from './state.mjs';
import { revivalOf, labOf } from './fossil.mjs';
import { readStored } from './stored.mjs';
import { rulesAt } from './setting-changes.mjs';
import { foldCtxAt, chatNowCtx } from './battle-rule.mjs';
import { refusal, ruleError, ruleText } from './failure.mjs';
import { findOocs, unwrapOocs } from './chat.mjs';
import { pkbLog } from './prompts.mjs';
import { coveredMarks } from './save.mjs';
import { boxOf } from './diary.mjs';
import { itemId, customInfo, withItemTags } from './custom-items.mjs';
import { say } from './screen-text.mjs';
import { commandsIn } from './commands.mjs';
import { answeredLine } from './act-prompts.mjs';
import { dropTaken, statusIn, statusMoneyAt, latestStatus } from './compat.mjs';
import { withMachineStandard } from './machine-standards.mjs';
import { worldAt, discWorld } from './compat-world.mjs';
import { shopEvent, limitedKey } from './shop.mjs';

export const QUEUE_VAR = '$pkb_queue';

export const OOC_TURNS = 3;

const tagText = tag => `<pkb#${tag}>`;

// -- Unsent actions (chat variable) -------------------------------

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
  const ops = [], steps = [], errors = [], notes = [];
  (action.ops ?? []).forEach((raw, i) => {
    const key = `act:${action.id ?? 'x'}:${i}`;
    const op = normalize ? withUids(cur, raw, ctx, key) : raw;
    const result = applyOps(cur, [op], ctx, key, null, { trace: true });
    cur = result.state;
    ops.push(op);
    steps.push(...result.steps);
    errors.push(...result.errors);
    notes.push(...result.notes);
  });
  if (errors.length) return { state, ops, events: [], errors, notes };
  const ok = steps;
  let events = ok.map(step => eventOf(step, ctx));

  if (action.type === 'use' && action.item) {
    const effects = events.filter(e => !(e.kind === 'item' && e.item === itemId(action.item)));
    events = [{ kind: 'use', item: itemId(action.item), who: effects.find(e => e.who)?.who ?? null, effects }];
  }

  if (action.type === 'toss') events = events.map(e => (e.kind === 'item' ? { ...e, toss: true } : e));

  if (action.type === 'shop') events = [shopEvent(ops)];

  if (action.type === 'fish' && action.item) events = events.filter(e => !(e.kind === 'item' && e.item === itemId(action.item))).map(e => (e.kind === 'item' ? { ...e, fished: itemId(action.item) } : e));
  return { state: cur, ops, events, errors };
}

const REF_FIELDS = ['ref', 'a', 'b'];
function withUids(state, op, ctx, key) {
  const out = { ...op };

  if (op.op === 'lab' && !op.set) {
    const revival = revivalOf(op.items);
    if (revival) try { out.set = labSet(ctx, revival, rngFor(ctx.sim, key)); } catch { /* the reason is reported when applying */ }
  }
  for (const field of REF_FIELDS) {
    const ref = op[field];
    if (!ref || ref === 'all' || typeof ref.uid === 'string') continue;
    try { out[field] = { uid: findMon(state, ref, ctx, { boxFirst: op.op === 'withdraw', egg: true }).mon.uid }; } catch { /* the reason is reported when applying */ }
  }
  return out;
}

export function pendingState(chat, ctx, { uptoIndex, survey } = {}) {
  const { state, table, changed, counted, reflected, imported, status } = computeState(chat, ctx, { uptoIndex, survey });

  const at = { ...chatNowCtx(chat, ctx), status };
  const added = readQueue(chat).actions.filter(action => !isReflected(action, reflected, counted));
  let cur = state;
  const errors = [], holds = [];
  for (const action of added) {
    if (imported.has(action.id)) { holds.push(action); continue; }
    const result = runAction(cur, action, at);
    cur = result.state;
    errors.push(...result.errors);
    if (!result.errors.length) holds.push(action);
  }
  return { state: cur, base: state, table, errors, changed, added, holds, status, imported };
}

const actionRecord = ({ id, type, at, item, ops, in: holder }) => ({ id, type, at, ...(item ? { item } : {}), ops, ...(holder ? { in: holder } : {}) });

export function heldRecords(chat, holds) {
  const ids = new Set((holds ?? []).map(action => action.id));
  return readQueue(chat).actions.filter(action => ids.has(action.id)).map(actionRecord);
}

export function queueAction(chat, ctx, input, { now = Date.now(), salt = '' } = {}) {
  if (!input || !Array.isArray(input.ops) || !input.ops.length) throw new Error('행동에 연산이 없습니다.');
  adoptQueue(chat, ctx, { salt: `${now}:${salt}` });
  const queue = readQueue(chat);
  const pending = pendingState(chat, ctx);
  const { state: base, status } = pending;
  const at = { ...chatNowCtx(chat, ctx), status };
  const type = /^[a-z]{1,16}$/.test(String(input.type ?? '')) ? input.type : 'other';
  const action = { id: hashKey(`${now}:${salt}:${queue.actions.length}:${JSON.stringify(input.ops)}`), type, at: now };
  if (input.item) action.item = itemId(input.item);
  if (input.shop) action.shop = String(input.shop);
  const result = runAction(base, { ...action, ops: input.ops }, at, { normalize: true });
  if (result.errors.length) throw result.notes.length ? refusal(result.notes, { join: ' / ' }) : new Error(result.errors.join(' / '));

  if (hatchedParty(base).length && !hatchedParty(result.state).length) throw ruleError('acts.lastInParty');
  action.ops = result.ops;
  action.events = result.events;
  const messages = chat.message ?? [];
  if (!queue.actions.length) queue.since = { chatId: messages.at(-1)?.chatId ?? null, count: messages.length };
  const { actions, state } = netQueue([...queue.actions, action], pending, at, result.state, { seed: `${now}:${salt}`, now });
  writeQueue(chat, { ...queue, actions });
  const was = new Set(queue.actions.map(a => a.id));
  return { action: actions.find(a => !was.has(a.id)) ?? null, state };
}

function opAspect(op) {
  const uid = ref => (typeof ref?.uid === 'string' ? ref.uid : null);
  switch (op?.op) {
    case 'swap': return uid(op.a) && uid(op.b) ? 'place' : null;
    case 'deposit': case 'withdraw': return uid(op.ref) ? `roster:${uid(op.ref)}` : null;
    case 'hold': return op.fromBag && uid(op.ref) ? `hold:${uid(op.ref)}` : null;
    case 'nickname': return uid(op.ref) ? `name:${uid(op.ref)}` : null;
    case 'evolvelock': return uid(op.ref) ? `lock:${uid(op.ref)}` : null;
    case 'boxname': return Number.isInteger(Number(op.box)) ? `boxname:${Number(op.box)}` : null;
    case 'breed': return op.stop || (uid(op.a) && uid(op.b)) ? 'breed' : null;
    case 'learn': return !op.skip && uid(op.ref) ? `moves:${uid(op.ref)}` : null;
    default: return null;
  }
}

export function actionAspect(action) {
  if (action?.type === 'shop') return action.shop ? `shop:${action.shop}` : null;
  const keys = new Set((action?.ops ?? []).map(opAspect));
  return keys.size === 1 && !keys.has(null) ? [...keys][0] : null;
}

const canon = value => (Array.isArray(value) ? value.map(canon)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canon(value[key])])) : value);
const keyOf = value => JSON.stringify(canon(value));
// the box as a set: its inner order is not kept
const boxSet = state => (Array.isArray(state?.box) ? { ...state, box: state.box.map(keyOf).sort() } : state);

export const sameState = (a, b) => keyOf(boxSet(a)) === keyOf(boxSet(b));

const monIn = (state, uid) => [...state.party, ...state.box].find(mon => mon.uid === uid) ?? null;
const uids = list => list.map(mon => mon.uid);

function placeOps(from, to) {
  const party = uids(from.party), box = uids(from.box), toParty = uids(to.party), toBox = uids(to.box);
  if (party.length !== toParty.length || [...party, ...box].sort().join() !== [...toParty, ...toBox].sort().join()) return null;
  const inParty = new Set(toParty);
  const leaving = party.filter(uid => !inParty.has(uid)), entering = box.filter(uid => inParty.has(uid));
  const ops = [], now = [...party];
  const ref = uid => ({ uid });
  entering.forEach((uid, i) => { ops.push({ op: 'swap', a: ref(uid), b: ref(leaving[i]) }); now[now.indexOf(leaving[i])] = uid; });
  toParty.forEach((uid, i) => {
    if (now[i] === uid) return;
    const k = now.indexOf(uid);
    ops.push({ op: 'swap', a: ref(now[i]), b: ref(uid) });
    [now[i], now[k]] = [now[k], now[i]];
  });
  return ops;
}

function aspectNet(aspect, from, to, same) {
  const cut = aspect.indexOf(':');
  const kind = cut < 0 ? aspect : aspect.slice(0, cut), key = aspect.slice(cut + 1);
  if (kind === 'shop') return { type: 'shop', shop: same.at(-1).shop, ops: same.flatMap(action => action.ops) };
  if (!from) return null;
  const ref = { uid: key };
  const [was, now] = [monIn(from, key), monIn(to, key)];
  const mon = ['hold', 'name', 'lock', 'moves'].includes(kind);
  if (mon && !(was && now)) return null;
  switch (kind) {
    case 'place': {
      const ops = placeOps(from, to);
      if (!ops) return null;
      const inParty = uid => from.party.some(m => m.uid === uid);
      return { type: ops.every(op => inParty(op.a.uid) && inParty(op.b.uid)) ? 'order' : 'box', ops };
    }

    case 'roster': {
      const same = uids(from.party).join() === uids(to.party).join() && uids(from.box).sort().join() === uids(to.box).sort().join();
      return same ? { type: 'box', ops: [] } : null;
    }
    case 'hold': return { type: 'hold', ops: (was.set.item || '') === (now.set.item || '') ? [] : [{ op: 'hold', ref, item: now.set.item || '', fromBag: true }] };
    case 'name': return { type: 'nickname', ops: (was.set.name || '') === (now.set.name || '') ? [] : [{ op: 'nickname', ref, name: now.set.name || '' }] };
    case 'lock': return { type: 'evolvelock', ops: (was.evolveLocked === true) === (now.evolveLocked === true) ? [] : [{ op: 'evolvelock', ref, locked: now.evolveLocked === true }] };
    case 'boxname': {
      const box = Number(key), name = state => state.boxNames?.[box] ?? '';
      return { type: 'boxname', ops: name(from) === name(to) ? [] : [{ op: 'boxname', box, name: name(to) }] };
    }
    case 'breed': {
      const pair = state => (state.breeding ?? []).join();
      if (pair(from) === pair(to)) return { type: 'breed', ops: [] };
      return { type: 'breed', ops: [to.breeding ? { op: 'breed', a: { uid: to.breeding[0] }, b: { uid: to.breeding[1] } } : { op: 'breed', stop: true }] };
    }

    case 'moves': {
      if (now.set.moves.length < was.set.moves.length) return null;
      return { type: 'learn', ops: now.set.moves.flatMap((move, i) => (was.set.moves[i] === move ? []
        : [{ op: 'learn', ref, move, ...(i < was.set.moves.length ? { forget: was.set.moves[i] } : {}) }])) };
    }
    default: return null;
  }
}

function netQueue(actions, pending, at, final, fresh) {
  const kept = { actions, state: final };
  const aspect = actionAspect(actions.at(-1));
  if (!aspect) return kept;
  const added = new Set(pending.added.map(action => action.id));
  const counts = action => added.has(action.id) && !pending.imported.has(action.id);
  const first = actions.slice(0, -1).findLastIndex(action => action.sent || !counts(action)) + 1;

  let start = pending.base;
  for (const action of actions.slice(0, first)) if (counts(action)) start = runAction(start, action, at).state;
  const fold = list => {
    let state = start;
    const out = [];
    for (const action of list) {
      const result = runAction(state, action, at);
      if (result.errors.length) return null;
      state = result.state;
      out.push({ ...action, events: result.events });
    }
    return { state, actions: out };
  };
  const free = actions.slice(first);
  const same = free.filter(action => actionAspect(action) === aspect), others = free.filter(action => actionAspect(action) !== aspect);
  const net = aspectNet(aspect, fold(others)?.state ?? null, final, same);
  if (!net || (net.ops.length && same.length < 2)) return kept;
  const merged = net.ops.length ? [{ id: hashKey(`net:${fresh.seed}:${JSON.stringify(net.ops)}`), type: net.type, at: fresh.now, ...(net.shop ? { shop: net.shop } : {}), ops: net.ops }] : [];
  const events = list => list.reduce((sum, action) => sum + (action.events?.length ?? 0), 0);

  for (const k of new Set([free.findIndex(action => actionAspect(action) === aspect), others.length])) {
    const folded = fold([...others.slice(0, k), ...merged, ...others.slice(k)]);
    if (folded && sameState(folded.state, final) && events(folded.actions) <= events(free)) return { actions: [...actions.slice(0, first), ...folded.actions], state: folded.state };
  }
  return kept;
}

export function limitedBought(chat, { survey } = {}) {
  const actions = new Map([...liveActions(chat, { survey })].map(([id, live]) => [id, live.action]));
  for (const action of readQueue(chat).actions) if (!actions.get(action.id)) actions.set(action.id, action);
  return new Set([...actions.values()].flatMap(a => (a?.ops ?? []).filter(op => op?.op === 'item' && op.limited && op.delta > 0)
    .map(op => limitedKey(op.limited, itemId(op.item)))));
}

export function fishCasts(chat, { survey } = {}) {
  const actions = new Map([...liveActions(chat, { survey })].map(([id, live]) => [id, live.action]));
  for (const action of readQueue(chat).actions) if (!actions.get(action.id)) actions.set(action.id, action);
  return [...actions.values()].filter(action => action?.type === 'fish');
}

const shopNet = action => {
  if (action?.type !== 'shop') return 0;
  const { got = 0, spent = 0 } = shopEvent(action.ops ?? []);
  return got - spent;
};

export function shopBalance(chat, { upto, survey } = {}) {
  const base = statusMoneyAt(chat, upto ?? Infinity);
  if (!base) return null;
  const queue = readQueue(chat);
  const unsent = upto === undefined || nextOwnMessage(chat, queue) === upto ? queue.actions : [];
  const queued = new Set(queue.actions.map(action => action.id));
  let net = unsent.reduce((sum, action) => sum + shopNet(action), 0);
  for (const [id, { action, told, at }] of liveActions(chat, { uptoIndex: upto, survey })) {
    if (queued.has(id)) continue; // not sent yet: with the unsent ones (above)
    if (told !== null ? told > base.index : at >= 2 * base.index) net += shopNet(action);
  }
  return base.money + net;
}

export function attachQueue(chat, ctx, { salt = '', uptoIndex } = {}) {
  const queue = readQueue(chat);
  if (!queue.actions.length) return null;
  const { state, table, errors } = pendingState(chat, ctx, { uptoIndex });
  const tag = hashKey(`acts:${JSON.stringify(queue.since)}:${queue.actions.map(a => a.id).join(',')}:${salt}`);
  table.snaps[tag] = withItemTags(state);
  table.acts = { ...table.acts, [tag]: {
    events: queue.actions.flatMap(a => a.events ?? []), errors,

    v: 2, actions: queue.actions.map(actionRecord),
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
    if (sinceIndex < 0) return -1; // the reference message was deleted, so the place is unknown - do not bind
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

// -- Material for one log line (events) -------------------------------

export function eventOf({ op, before, after }, ctx) {
  const sim = ctx?.sim;
  const all = state => (state ? [...state.party, ...state.box] : []);
  const byUid = (state, uid) => all(state).find(m => m.uid === uid) ?? null;
  // An egg is just an egg: what hatches from it is not told
  const who = mon => (mon ? (isEgg(mon) ? { uid: mon.uid, egg: true, species: '', name: '' } : { uid: mon.uid, species: mon.set.species, name: mon.set.name || '' }) : null);
  const refWho = (ref, opts) => {
    try { if (before) return who(findMon(before, ref, ctx, { ...opts, egg: true }).mon); } catch { /* below */ }
    return { ref: ref?.slot ? `#${ref.slot}` : ref?.box ? `box ${ref.box}` : ref?.name ?? '?' };
  };
  const pair = w => [byUid(before, w?.uid), byUid(after, w?.uid)];

  const named = ids => {
    const fromOp = id => (op.custom && id === itemId(op.item) ? { name: op.custom.name, emoji: op.custom.emoji } : null);
    const found = ids.map(id => [id, customInfo(after, id) ?? customInfo(before, id) ?? fromOp(id)]).filter(([, info]) => info);
    return found.length ? { customItems: Object.fromEntries(found) } : {};
  };

  const hp = (mon, state) => (mon && sim ? hpPercentOf(sim, mon, stateFormat(state)) : null);
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

        const revived = op.revive ? (before?.party ?? []).filter(m => m.hp === 0).length : 0;
        return revived ? { kind: 'heal', all: true, revivedAll: revived } : { kind: 'heal', all: true };
      }
      const w = refWho(op.ref); const [b, a] = pair(w);
      return { kind: 'heal', who: w, hpFrom: hp(b, before), hpTo: hp(a, after),
        cured: !!(b && a && b.status && b.status !== 'fnt' && !a.status), revived: !!(b && a && b.hp === 0 && a.hp !== 0) };
    }
    case 'item': return { kind: 'item', item: itemId(op.item), delta: op.delta, ...named([itemId(op.item)]) };
    case 'swap': {
      const at = w => { const i = before?.party.findIndex(m => m.uid === w.uid) ?? -1; return i >= 0 ? { party: i + 1 } : { box: true }; };
      const a = refWho(op.a), b = refWho(op.b);

      const revived = [a, b].find(w => at(w).box && byUid(before, w?.uid)?.revived);
      return { kind: 'swap', a, b, at: [at(a), at(b)], ...(revived ? { revived: revived.uid } : {}) };
    }
    case 'release': case 'deposit': return { kind: op.op, who: refWho(op.ref) };
    case 'withdraw': {

      const w = refWho(op.ref, { boxFirst: true });
      return { kind: 'withdraw', who: w, ...(byUid(before, w?.uid)?.revived ? { revived: true } : {}) };
    }

    case 'lab': {
      const added = labOf(after).find(m => !labOf(before).some(b => b.uid === m.uid));
      return { kind: 'lab', items: (op.items ?? []).map(itemId), species: added?.set.species ?? revivalOf(op.items)?.species ?? '' };
    }
    case 'nickname': return { kind: 'nickname', who: refWho(op.ref), name: String(op.name ?? '').trim() };

    case 'evolvelock': { const w = refWho(op.ref); return { kind: 'evolvelock', who: w, locked: op.locked === true, ...(before ? { was: byUid(before, w?.uid)?.evolveLocked === true } : {}) }; }
    case 'hold': {
      const w = refWho(op.ref); const [b] = pair(w);
      const item = op.item ? itemId(op.item) : '', prev = b?.set.item || '';
      return { kind: 'hold', who: w, item, prev, ...named([item, prev]) };
    }
    case 'evolve': {

      const w = refWho(op.ref); const [, a] = pair(w);
      const joined = before && after ? all(after).filter(m => !byUid(before, m.uid)).map(m => ({ uid: m.uid, species: m.set.species })) : [];
      return { kind: 'evolve', who: w, species: a?.set.species ?? op.species, ...(joined.length ? { joined } : {}) };
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
    // friendship: no words anywhere (never shown, never told to the AI)
    case 'friendship': return { kind: 'friendship', who: refWho(op.ref) };
    // Items outside battle: vitamins, Exp. Candy, Ability Capsule/Patch, Mints, Bottle Caps
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
      const move = toID(op.move), max = (mon, state) => (mon && sim ? movePp(sim, mon, move, stateFormat(state)).maxpp : null);
      return { kind: 'ppup', who: w, move, from: max(b, before), to: max(a, after) };
    }

    case 'tera': { const w = refWho(op.ref); const [, a] = pair(w); return { kind: 'tera', who: w, type: a?.set.teraType ?? op.type }; }
    case 'form': { const w = refWho(op.ref); const [, a] = pair(w); return { kind: 'form', who: w, species: a?.set.species ?? op.species }; }

    case 'gmax': return { kind: 'gmax', who: refWho(op.ref), on: op.on === true };
    case 'dmaxLevel': {
      const w = refWho(op.ref); const [b, a] = pair(w);
      return { kind: 'dmaxLevel', who: w, from: b?.set.dynamaxLevel ?? 0, to: a?.set.dynamaxLevel ?? 0 };
    }
    // Fusions: the partner that went in / came out, and the form now
    case 'fuse': case 'unfuse': {
      const w = refWho(op.ref); const [b, a] = pair(w);
      const other = op.op === 'fuse' ? refWho(op.with) : who(b?.fused);
      return { kind: op.op, who: w, other, species: a?.set.species ?? op.species };
    }

    case 'amie': return { kind: 'amie', who: refWho(op.ref) };

    case 'feed': {
      const item = op.puff === undefined && op.item ? itemId(op.item) : null;
      return { kind: 'feed', who: refWho(op.ref), ...(item ? { item, ...named([item]) } : {}) };
    }
    // Training screen: no line either (as petting)
    case 'train': return { kind: 'train', who: refWho(op.ref) };
    case 'puff': return { kind: 'puff' };

    case 'amieRecord': return { kind: 'amieRecord' };

    case 'egg': {
      const added = all(after).find(m => !byUid(before, m.uid));
      const at = added ? after.box.indexOf(added) : -1;
      return { kind: 'gotEgg', box: added ? (at >= 0 ? boxOf(after, at) : false) : op.to === 'box' };
    }
    case 'breed': return op.stop ? { kind: 'breedStop' } : { kind: 'breed', a: refWho(op.a), b: refWho(op.b) };

    case 'hatched': {
      const w = refWho(op.ref), [b, a] = pair(w);
      if (!isEgg(b) || !a || isEgg(a)) return { kind: 'hatched', who: w };
      const slot = after.party.indexOf(a);
      return { kind: 'hatch', who: { uid: a.uid, species: a.set.species, name: '' }, slot: slot >= 0 ? slot + 1 : null };
    }
    case 'rest': return { kind: 'rest' }; // a short rest: one line for the whole party
    default: return { kind: 'other', op: String(op?.op ?? '?') };
  }
}

// -- Message log ---------------------------------

export function actsIn(text, table) {
  const acts = findTags(text).map(t => table?.acts?.[t.key]).filter(Boolean);
  if (!acts.length) return null;
  return { events: acts.flatMap(a => a.events ?? []), errors: acts.flatMap(a => a.errors ?? []) };
}

export const heldLine = lang => say(lang, 'notice.held');

export function changesIn(text, chat, ctx, lang) {
  if (!hasBlocks(text)) return null;
  const messages = chat?.message ?? [];
  const readAt = rulesAt(chat);
  const changeKeys = (data, reading) => findBlocks(data, reading).filter(b => b.kind === 'change').map(b => b.key);
  const textKeys = new Map(); // the text's change block keys in each reading (two at most)
  const keysOf = reading => { const edges = readsBlockEdges(reading); if (!textKeys.has(edges)) textKeys.set(edges, changeKeys(text, reading)); return textKeys.get(edges); };
  const same = messages.findLastIndex(m => String(m?.data ?? '') === String(text));
  const index = same >= 0 ? same : messages.findLastIndex((m, i) => {
    const keys = keysOf(readAt(i));
    if (!keys.length) return false;
    const own = changeKeys(m?.data ?? '', readAt(i));
    return keys.every(k => own.includes(k));
  });
  const blocks = findBlocks(text, index >= 0 ? readAt(index) : undefined).filter(b => b.kind === 'change');
  if (!blocks.length) return null;
  let state = null, table = null, status = null;
  if (index >= 0 && ctx) ({ state, table, status } = computeState(chat, ctx, { uptoIndex: index - 1 }));

  const own = index >= 0 ? null : statusIn({ role: 'char', data: text });
  const ctxAt = foldCtxAt(chat, ctx, { next: own });
  const at = ctx && { ...(index >= 0 ? ctxAt(index) : ctx), status: statusIn(messages[index]) ?? status };

  const reading = index >= 0 ? readAt(index) : undefined;

  const region = (own ?? (index >= 0 ? at?.status ?? statusIn(messages[index]) ?? latestStatus(chat, index) : latestStatus(chat)))?.region ?? null;

  const place = index >= 0 ? index : messages.length, here = ctxAt(place);
  const machineReading = withMachineStandard(reading ?? readAt(place), region, discWorld(worldAt(chat)(place), here.formGen, here.battleRule));
  const chatId = index >= 0 ? messageId(messages[index], index) : null;
  const held = index >= 0 ? heldChanges(chat, table ?? readTable(chat)) : new Set();
  const events = [], errors = [];
  for (const [n, block] of blocks.entries()) {
    if (held.has(changeAt(index, n))) { errors.push(heldLine(lang)); continue; }
    const { ops, errors: unread } = parseChange(block.body, machineReading);
    errors.push(...unread.map(note => ruleText(note, lang)));
    if (!state) { events.push(...ops.map(op => eventOf({ op, before: null, after: null }, null))); continue; }
    const result = applyOps(state, ops, at, `${chatId}:${block.key}`, table, { trace: true });
    state = result.state;
    for (const step of result.steps) {
      if (step.error) errors.push(step.notes.length ? step.notes.map(note => ruleText(note, lang)).join(' / ') : step.error);
      else {
        events.push(eventOf(step, at));

        errors.push(...step.notes.map(note => ruleText(note, lang)));
      }
    }
  }
  return { events, errors };
}

export function passingIn(chat, ctx, index) {
  const message = chat?.message?.[index];
  if (!ctx || message?.role !== 'char') return [];
  const { state } = computeState(chat, ctx, { uptoIndex: index - 1 });
  return storyTick(state, messageId(message, index), foldCtxAt(chat, ctx)(index)).events;
}

export function passingTold(chat, ctx, index) {
  const messages = chat?.message ?? [];
  if (!ctx || !(index >= 0)) return [];
  try {
    const from = messages.findLastIndex((m, i) => i < index && m?.role === 'user') + 1;
    const events = [];
    for (let i = from; i < index; i++) events.push(...passingIn(chat, ctx, i));
    return events.filter(e => e?.kind === 'egg' || e?.kind === 'hatch');
  } catch (error) {
    console.warn('[poke-battle] story passing left out of <pkb-log>', error);
    return [];
  }
}

export function passingLog(chat, ctx, { names = null, lang = 'ko' } = {}) {
  const latest = (chat?.message ?? []).findLastIndex(m => m?.role === 'user');
  return pkbLog(passingTold(chat, ctx, latest), { lang, en: names });
}

export function isLatestOwn(chat, text) {
  const messages = chat?.message ?? [];
  const latest = messages.findLastIndex(m => m?.role === 'user');
  return latest >= 0 && String(messages[latest].data ?? '') === String(text ?? '');
}

// -- Text sent to the AI -----------------------------

const inWindow = (messages, index) => messages.slice(index).filter(m => m?.role === 'user').length <= OOC_TURNS;

const coveredOf = new WeakMap();
const coveredIn = chat => {
  if (!chat || typeof chat !== 'object') return new Set();
  if (!coveredOf.has(chat)) coveredOf.set(chat, coveredMarks(chat, index => inWindow(chat.message ?? [], index)));
  return coveredOf.get(chat);
};

const guidedOf = new WeakMap();
const guidedIn = chat => {
  if (!chat || typeof chat !== 'object') return null;
  if (!guidedOf.has(chat)) {
    const messages = chat.message ?? [], covered = coveredIn(chat);
    let found = null;
    for (let index = messages.length - 1; index >= 0 && !found && inWindow(messages, index); index--) {
      const text = String(messages[index]?.data ?? '');
      const ooc = findOocs(text).findLast(o => !covered.has(o.info.mark));
      if (ooc) found = { index, piece: text.slice(ooc.start, ooc.end) };
    }
    guidedOf.set(chat, found);
  }
  return guidedOf.get(chat);
};

function guided(ooc, guide) {
  try {
    return guide(ooc.inner, ooc.info);
  } catch (error) {
    console.warn('[poke-battle] narration guide skipped', error);
    return ooc.inner;
  }
}

const END_SLOT = '\uE000';
const oocEnd = text => text.replace(/\)(\s*(?:<\/pkb-story\s*>)?\s*)$/, `${END_SLOT})$1`);

export function promptText(text, chat, table, { names = null, lang = 'ko', guide = null, commands: taking = false, moved = false, ctx = null } = {}) {
  const messages = chat?.message ?? [];
  let out = String(text ?? '');
  const latest = messages.findLastIndex(m => m?.role === 'user');
  const latestText = latest >= 0 ? String(messages[latest].data ?? '') : null;
  const mine = isLatestOwn(chat, text);

  const commands = taking && mine ? commandsIn(messages[latest], latest, rulesAt(chat)(latest)) : [];
  const line = commands.length ? answeredLine(commands.every(block => block.own)) : null;
  let slot = !!line;
  const covered = coveredIn(chat);
  for (const ooc of findOocs(out).reverse()) {
    if (covered.has(ooc.info.mark)) { out = out.slice(0, ooc.start) + out.slice(ooc.end); continue; }
    const piece = out.slice(ooc.start, ooc.end);
    const index = messages.findLastIndex(m => String(m?.data ?? '').includes(piece));
    if (index < 0) continue; // keep it when the message is unknown
    if (!inWindow(messages, index)) { out = out.slice(0, ooc.start) + out.slice(ooc.end); continue; }
    const shown = guide && guidedIn(chat)?.index === index && guidedIn(chat).piece === piece ? guided(ooc, guide) : piece;
    out = out.slice(0, ooc.start) + (slot ? oocEnd(shown) : shown) + out.slice(ooc.end);
    slot = false;
  }
  out = unwrapOocs(out); // remaining OOCs of ours: strip the tag, keep the OOC
  let events = [];
  const own = findTags(out).filter(t => table?.acts?.[t.key]);
  if (own.length && own.some(t => latestText?.includes(tagText(t.key)))) events = own.flatMap(t => table.acts[t.key].events ?? []);
  else if (!own.length && mine && nextOwnMessage(chat, readQueue(chat), table) === latest) {
    events = readQueue(chat).actions.flatMap(a => a.events ?? []);
  }

  if (ctx && mine) events = [...passingTold(chat, ctx, latest), ...events];
  out = stripForPrompt(moved ? dropTaken(out) : out);
  if (line) out = out.includes(END_SLOT) ? out.replace(END_SLOT, `\n${line}`) : `${out}\n(OOC: ${line})`;

  const shop = events.filter(e => e?.kind === 'shop');
  const after = shop.length ? shopBalance(chat, { upto: latest }) : null;
  const money = after === null ? null : after - shop.reduce((sum, e) => sum + (e.got ?? 0) - (e.spent ?? 0), 0);
  const log = pkbLog(events, { lang, en: names, money });
  return log ? `${out}\n${log}` : out;
}

export { tagText };
