import { findBlocks, findTags, findMarks, markText, parseEnd, parseBattle, battlesIn, battlesInText, blockAnchorIn, actsIn, messageId, hashKey, MARK } from './blocks.mjs';
import { readTable, writeTable, storyEndTrainer, rosterMon, changeAt } from './state.mjs';
import { readSave, writeSave } from './save.mjs';
import { escapeRe } from './norm.mjs';
import { RESULT_LINE_RE as RESULT_LINE } from './prompts.mjs';
import { rulesAt } from './setting-changes.mjs';

export { MARK };

const STORY_RE = /<pkb-story((?:\s+[a-z]+="[^"]*")*)\s*>([\s\S]*?)<\/pkb-story\s*>/g;
const ATTR_ESC = { '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' };
const attrText = value => String(value ?? '').replace(/[&"<>]/g, c => ATTR_ESC[c]);
const attrValue = value => value.replace(/&(amp|quot|lt|gt);/g, (_, n) => ({ amp: '&', quot: '"', lt: '<', gt: '>' })[n]);

export function wrapOoc(text, info = {}) {
  const attrs = [['battle', info.battle], ['turns', info.turns ? info.turns.join('-') : ''], ['result', info.result], ['mark', info.mark], ['form', info.form]]
    .filter(([, v]) => v).map(([k, v]) => ` ${k}="${attrText(v)}"`).join('');
  return `<pkb-story${attrs}>${text}</pkb-story>`;
}

export function findOocs(text) {
  return [...String(text ?? '').matchAll(STORY_RE)].map(m => {
    const info = Object.fromEntries([...m[1].matchAll(/([a-z]+)="([^"]*)"/g)].map(a => [a[1], attrValue(a[2])]));
    const turns = /^(\d+)-(\d+)$/.exec(info.turns ?? '');
    return { start: m.index, end: m.index + m[0].length, inner: m[2],
      info: { battle: info.battle ?? '', vs: info.vs ?? '', turns: turns ? [Number(turns[1]), Number(turns[2])] : null, result: info.result ?? '', mark: info.mark ?? '', ...(info.form ? { form: info.form } : {}) } };
  });
}

export const unwrapOocs = text => String(text ?? '').replace(STORY_RE, (_, __, inner) => inner);

export const dropOocs = text => String(text ?? '').replace(STORY_RE, '');

export const LAST_VAR = '$pkb_last';
export function readLast(chat) {
  const raw = chat?.scriptstate?.[LAST_VAR];
  if (typeof raw !== 'string' || !raw) return null;
  try { const last = JSON.parse(raw); return last?.v === 1 ? last : null; } catch { return null; }
}
export function writeLast(chat, last) {
  chat.scriptstate ??= {};
  if (last) chat.scriptstate[LAST_VAR] = JSON.stringify({ v: 1, ...last });
  else delete chat.scriptstate[LAST_VAR];
}

export const readBattleAt = (chat, index, body) => parseBattle(body, rulesAt(chat)(index));

const resultOf = (table, tagKey, blockKey) => { const meta = table.meta?.[tagKey]; return !!meta && !meta.storyEnd && meta.blockKey === blockKey; };

const endSource = (blockKey, message, index, n, body) => hashKey(`end:${blockKey}:${messageId(message, index)}:${n}:${String(body ?? '').trim()}`);

export function surveyBattles(chat, table = readTable(chat)) {
  const battles = new Map();
  const order = [];
  let lastBattleKey = null;
  const messages = chat?.message ?? [];
  const spot = (index, start) => index * 1e6 + start;
  // Marks on block messages (open, discarded), and per key its openedAt marks and its last result tag
  const open = new Set(), discarded = new Set(), openedAt = new Map(), lastResult = new Map();
  messages.forEach((message, index) => {
    const text = message?.data ?? '';
    for (const mark of findMarks(text)) {
      if (mark.kind === MARK.open) open.add(mark.key);
      else if (mark.kind === MARK.discarded) discarded.add(mark.key);
      else if (mark.kind === MARK.openedAt) openedAt.set(mark.key, [...(openedAt.get(mark.key) ?? []), spot(index, mark.start)]);
    }
    for (const tag of findTags(text)) {
      const meta = table.meta?.[tag.key];
      if (meta && !meta.storyEnd) lastResult.set(meta.blockKey, spot(index, tag.start));
    }
  });
  const openings = openingsOf(messages, { open, openedAt, lastResult, attempt: readSave(chat)?.attempt ?? null, spot });
  const held = new Set();
  const spans = new Map();
  const begin = (info, at, attempt) => {
    if (attempt) info.attempt = { at };
    info.phase = 'open';
    spans.set(info.key, []);
  };
  const close = key => {
    if (!battles.get(key)?.discarded) for (const change of spans.get(key) ?? []) held.add(change);
    spans.delete(key);
  };
  messages.forEach((message, index) => {
    const text = message?.data ?? '';
    const opened = start => openings.get(spot(index, start));
    const blocks = findBlocks(text);
    const anchored = opened(text.length);
    const events = [
      ...battlesIn(message, index).map(b => ({ ...b, type: 'battle' })),
      ...blocks.filter(b => b.kind === 'end').map((b, n) => ({ ...b, type: 'end', n })),
      ...blocks.filter(b => b.kind === 'change').map((b, n) => ({ ...b, type: 'change', n })),
      ...findTags(text).map(t => ({ ...t, type: 'tag' })),
      ...findMarks(text).filter(m => m.kind === MARK.openedAt && opened(m.start)?.key === m.key).map(m => ({ ...m, type: 'opened', attempt: opened(m.start).attempt })),
      ...(anchored?.anchored ? [{ ...anchored, start: text.length, type: 'opened' }] : []),
    ].sort((a, b) => a.start - b.start);
    let seq = 0;
    for (const event of events) {
      const at = index * 1e6 + seq++;
      if (event.type === 'battle') {
        const info = { key: event.key, index, chatId: message.chatId ?? null, result: null, ended: null, discarded: discarded.has(event.key),
          attempt: null, phase: 'ready', committed: 'ready', at };
        if (battles.has(event.key)) order.splice(order.indexOf(event.key), 1);
        battles.set(event.key, info); order.push(event.key);
        lastBattleKey = event.key;
        if (openings.get(event.key) === 'block') begin(info, at, true);
      } else if (event.type === 'opened') {
        const info = battles.get(event.key);
        if (info) begin(info, at, event.attempt);
      } else if (event.type === 'change') {
        for (const changes of spans.values()) changes.push(changeAt(index, event.n));
      } else if (event.type === 'tag') {
        const meta = table.meta?.[event.key];
        const info = meta && !meta.storyEnd && battles.get(meta.blockKey);
        if (info) {
          info.result = { ...meta, tag: event.key, index, at }; info.phase = info.committed = 'done';
          close(info.key);
        }
      } else if (event.type === 'end') {
        const unfinished = [...order].reverse().map(k => battles.get(k)).filter(info => (info.phase === 'open' || info.phase === 'ready') && !info.discarded);
        const target = unfinished.find(info => info.phase === 'open') ?? unfinished[0];
        if (target) {
          target.ended = { outcome: parseEnd(event.body).outcome, index, start: event.start, at, source: endSource(target.key, message, index, event.n, event.body),
            attempt: target.phase === 'open' && !!target.attempt };
          target.phase = target.committed = 'story';
          close(target.key);
        }
      }
    }
  });
  for (const info of battles.values()) {

    if (spans.has(info.key) && info.phase === 'open' && info.attempt) close(info.key);
    else if (info.phase === 'open' && !info.attempt) info.phase = info.committed;
    if (info.discarded) info.committed = info.phase = 'discarded';
    if (info.phase === 'ready') info.phase = info.committed;
  }
  return { battles, lastBattleKey, held };
}

function openingsOf(messages, { open, openedAt, lastResult, attempt, spot }) {
  const openings = new Map();
  const ids = new Map(messages.map((m, i) => [messageId(m, i), i]));
  const endOf = id => { const i = ids.get(id); return i === undefined ? undefined : spot(i, String(messages[i]?.data ?? '').length); };
  for (const [key, marks] of openedAt) {
    const result = lastResult.get(key);
    for (const at of marks) if (result !== undefined && at < result) openings.set(at, { key, attempt: false });
  }
  for (const key of open) {
    const result = lastResult.get(key);
    const after = at => at !== undefined && (result === undefined || at > result);
    const mark = (openedAt.get(key) ?? []).filter(after).at(-1);
    if (mark !== undefined) { openings.set(mark, { key, attempt: true }); continue; }
    const place = attempt?.blockKey === key ? attempt.opened : null;
    if (place) {
      const at = endOf(place.on) ?? endOf(place.above);
      if (after(at)) openings.set(at, { key, attempt: true, anchored: true });
    } else if (result === undefined) openings.set(key, 'block');
  }
  return openings;
}

export function battlePhase(survey, attempt = null, shown = null) {
  const infoOf = key => survey?.battles?.get(key);
  let key = null, phase = null;
  if (shown?.step === 'starting') [key, phase] = [shown.key, 'live'];
  else if (shown?.step === 'running' || shown?.step === 'folded') {
    if (infoOf(shown.key)?.phase === 'open') [key, phase] = [shown.key, shown.step === 'folded' ? 'folded' : 'live'];
  } else if (!shown && attempt?.auto && infoOf(attempt.blockKey)?.phase === 'open') [key, phase] = [attempt.blockKey, 'parked'];
  const card = k => {
    if (key && k === key) return 'progress';
    const info = infoOf(k);
    const at = !info ? 'ready' : info.phase === 'open' ? info.committed : info.phase;
    if (at === 'story') return 'done';
    return at === 'ready' && key ? 'locked' : at;
  };
  return { key, phase, card };
}

export function cardResult(info) {
  if (!info) return undefined;
  const { result, ended } = info;
  if (ended && (!result || ended.at > result.at)) return { outcome: ended.outcome, storyEnded: true };
  if (result) return { outcome: result.outcome, turns: result.turns, faceSpecies: result.faceSpecies };
  return undefined;
}

export function withMark(text, key, kind = null) {
  let out = String(text ?? '');
  for (const mark of findMarks(out).reverse()) {
    if (mark.key === key && (mark.kind === MARK.open || mark.kind === MARK.discarded)) out = out.slice(0, mark.start) + out.slice(mark.end);
  }
  return kind ? out + markText(kind, key) : out;
}

function dropKinds(text, kinds) {
  let out = String(text ?? '');
  for (const mark of findMarks(out).reverse()) if (kinds.includes(mark.kind)) out = out.slice(0, mark.start) + out.slice(mark.end);
  return out;
}

export function setFollow(chat, key = null) {
  const messages = chat?.message ?? [];
  const before = messages.map(m => String(m?.data ?? ''));
  const after = before.map(text => dropKinds(text, [MARK.here, MARK.moved]));
  const block = key ? findBlockMessage(chat, key) : -1;
  const bottom = messages.length - 1;
  if (block >= 0 && bottom > block) {
    after[bottom] += markText(MARK.here, key);
    after[block] += markText(MARK.moved, key);
  }
  const changed = [];
  after.forEach((text, i) => { if (text !== before[i]) { messages[i].data = text; changed.push(i); } });
  return changed;
}

export const hasFollowMarks = chat => (chat?.message ?? []).some(m => findMarks(m?.data ?? '').some(mark => mark.kind === MARK.here || mark.kind === MARK.moved));

export function findBlockMessage(chat, key) {
  return (chat?.message ?? []).findIndex((m, i) => battlesIn(m, i).some(b => b.key === key));
}

export function setMark(chat, key, kind) {
  const index = findBlockMessage(chat, key);
  if (index < 0) return false;
  const message = chat.message[index];
  message.data = withMark(message.data, key, kind);
  return true;
}

const BLOCK_MARKS = [MARK.open, MARK.moved, MARK.discarded];

function sameBlockMessage(chat, table) {
  const messages = chat?.message ?? [];
  const save = readSave(chat);
  const times = new Map();
  for (const rec of [...Object.values(table?.meta ?? {}), readLast(chat), save?.start, save?.record, save?.attempt]) {
    if (typeof rec?.blockKey !== 'string' || typeof rec.blockTime !== 'number') continue;
    if (!times.has(rec.blockKey)) times.set(rec.blockKey, new Set());
    times.get(rec.blockKey).add(rec.blockTime);
  }
  const holds = (key, index) => {
    const text = String(messages[index]?.data ?? '');
    return findTags(text).some(tag => table?.meta?.[tag.key]?.blockKey === key)
      || findMarks(text).some(mark => mark.key === key && BLOCK_MARKS.includes(mark.kind));
  };
  return (key, index) => {
    const time = messages[index]?.time;
    if (times.has(key) && typeof time === 'number') return times.get(key).has(time);
    return holds(key, index);
  };
}

export function renamedKeys(chat, table = readTable(chat)) {
  const now = new Set(), renamed = [], seen = new Map();
  const same = sameBlockMessage(chat, table);
  const count = text => { seen.set(text, (seen.get(text) ?? 0) + 1); return text; };
  (chat?.message ?? []).forEach((message, index) => {
    const text = String(message?.data ?? '');
    if (!/<\s*pkb-/i.test(text)) return;
    const battles = battlesIn(message, index), acts = actsIn(message, index);
    for (const block of [...battles, ...acts]) now.add(block.key);
    const texts = [...battles.map(b => count(`b:${b.hash}`)), ...acts.filter(a => !a.own).map(a => count(`a:${hashKey(a.body.trim())}`))];
    if (!message.chatId) return;
    battlesInText(text, `#${index}`).forEach((block, n) => { if (same(block.key, index)) renamed.push([block.key, battles[n].key, texts[n]]); });
    actsIn({ data: text }, index).filter(block => !block.own).forEach((block, n) => renamed.push([block.key, acts.filter(a => !a.own)[n].key, texts[battles.length + n]]));
  });
  return new Map(renamed.filter(([key, to, text]) => !now.has(key) && key !== to && seen.get(text) === 1).map(([key, to]) => [key, to]));
}

function placeIndex(messages, place) {
  const at = messages.findIndex((m, i) => messageId(m, i) === place?.on);
  if (at >= 0 || !place) return at;
  const fresh = messages[place.at];
  if (!fresh || fresh.role === 'user' || place.at < 1 || messageId(messages[place.at - 1], place.at - 1) !== place.above) return -1;
  return place.at;
}

export function relinkedKeys(chat, { table = readTable(chat), renamed = renamedKeys(chat, table) } = {}) {
  const save = readSave(chat), last = readLast(chat);
  if (!save?.attempt?.block && !last?.block && !Object.values(table.meta ?? {}).some(m => m?.block)) return new Map();
  const messages = chat?.message ?? [];
  const blocks = [], texts = new Map(), marks = [];
  messages.forEach((message, index) => {
    const text = String(message?.data ?? '');
    if (!/<\s*pkb/i.test(text)) return;
    for (const b of battlesIn(message, index)) { blocks.push({ key: b.key, hash: b.hash, index }); texts.set(b.hash, (texts.get(b.hash) ?? 0) + 1); }
    for (const m of findMarks(text)) marks.push({ ...m, index });
  });
  const present = new Set(blocks.map(b => b.key));

  const taken = new Set([...Object.values(table.meta ?? {}).map(m => m?.blockKey), last?.blockKey, save?.start?.blockKey, save?.record?.blockKey, save?.attempt?.blockKey,
    ...marks.map(m => m.key)]);
  for (const [key, to] of renamed) if (taken.has(key)) taken.add(to);
  const claims = new Map();
  const same = sameBlockMessage(chat, table);
  const claim = (rec, holds) => {
    const key = rec.blockKey;
    if (!key || typeof rec.block !== 'string' || present.has(key) || renamed.has(key) || texts.get(rec.block) !== 1) return;
    const block = blocks.find(b => b.hash === rec.block);
    if (taken.has(block.key) || !holds(block) || !same(key, block.index)) return;
    claims.set(key, claims.has(key) && claims.get(key) !== block ? null : block);
  };
  messages.forEach((message, index) => {
    for (const tag of findTags(message?.data ?? '')) {
      const meta = table.meta?.[tag.key];
      if (meta && !meta.storyEnd) claim(meta, block => block.index <= index);
    }
  });
  if (last?.place && last.line && table.meta?.[last.tag]) {
    const at = placeIndex(messages, last.place);
    claim(last, block => at >= 0 && block.index <= at);
  }
  const attempt = save?.attempt;
  if (attempt) claim(attempt, block => marks.some(m => m.kind === MARK.open && m.key === attempt.blockKey && m.index === block.index));
  const targets = [...claims.values()].filter(Boolean);
  return new Map([...claims].filter(([, block]) => block && targets.filter(b => b === block).length === 1).map(([key, block]) => [key, block.key]));
}

export function battleMoves(chat, table = readTable(chat)) {
  const renamed = renamedKeys(chat, table), relinked = relinkedKeys(chat, { table, renamed });
  return { renamed, relinked, all: new Map([...renamed, ...relinked]) };
}

export const currentKey = (chat, key) => (findBlockMessage(chat, key) >= 0 ? key : battleMoves(chat).all.get(key) ?? null);

export function rekeyBattles(chat, { table: read = null, moves = battleMoves(chat, read ?? readTable(chat)).all, dry = false } = {}) {
  if (!moves.size) return false;
  const messages = chat?.message ?? [];
  const to = key => moves.get(key) ?? key;
  const placeName = id => { const at = /^#(\d+)$/.exec(id ?? '')?.[1]; return (at !== undefined && messages[Number(at)]?.chatId) || id; };

  const moved = rec => {
    const { blockTime: _, ...rest } = rec;
    const time = typeof rec.block === 'string' ? blockAnchorIn(chat, to(rec.blockKey)).blockTime : undefined;
    return { ...rest, blockKey: to(rec.blockKey), ...(time !== undefined ? { blockTime: time } : {}) };
  };
  let changed = false;
  for (const message of messages) {
    let text = String(message?.data ?? '');
    const original = text;
    for (const mark of findMarks(text).reverse()) if (moves.has(mark.key)) text = text.slice(0, mark.start) + markText(mark.kind, to(mark.key)) + text.slice(mark.end);
    text = text.replace(STORY_RE, whole => whole.replace(/^(<pkb-story\b[^>]*?\sbattle=")([a-z0-9]+)"/, (s, head, key) => `${head}${to(key)}"`));
    if (text === original) continue;
    if (dry) return true;
    message.data = text; changed = true;
  }
  const table = dry && read ? read : readTable(chat);
  let metaMoved = false;
  for (const [tag, meta] of Object.entries(table.meta ?? {})) {
    if (!moves.has(meta?.blockKey)) continue;
    if (dry) return true;
    table.meta[tag] = moved(meta); metaMoved = true;
  }
  if (metaMoved) { writeTable(chat, table); changed = true; }
  const save = readSave(chat);
  if (save) {
    const part = p => {
      const battle = moves.has(p?.blockKey), acts = !!p?.plans?.some(row => moves.has(row.act));
      if (!battle && !acts) return p;
      return { ...(battle ? moved(p) : p), ...(battle && p.opened ? { opened: { on: placeName(p.opened.on), above: placeName(p.opened.above) } } : {}),
        ...(acts ? { plans: p.plans.map(row => ({ ...row, act: to(row.act) })) } : {}) };
    };
    const next = { start: part(save.start), record: part(save.record), attempt: part(save.attempt) };
    if (['start', 'record', 'attempt'].some(which => next[which] !== save[which])) {
      if (dry) return true;
      writeSave(chat, next); changed = true;
    }
  }
  const last = readLast(chat);
  if (last && moves.has(last.blockKey)) {
    if (dry) return true;
    const { v: _, ...rest } = last;
    writeLast(chat, { ...moved(rest), ...(last.place ? { place: { ...last.place, on: placeName(last.place.on), above: placeName(last.place.above) } } : {}) });
    changed = true;
  }
  return changed;
}

function lastResultAt(chat, blockKey, table) {
  let at = null;
  (chat?.message ?? []).forEach((message, i) => {
    for (const tag of findTags(message?.data ?? '')) if (resultOf(table, tag.key, blockKey)) at = [i, tag.start];
  });
  return at;
}

function dropOpenedAt(chat, key, side, table) {
  const result = lastResultAt(chat, key, table);
  const before = (i, start) => !!result && (i < result[0] || (i === result[0] && start < result[1]));
  let changed = false;
  (chat?.message ?? []).forEach((message, i) => {
    let text = String(message?.data ?? '');
    const original = text;
    for (const mark of findMarks(text).reverse()) {
      if (mark.kind !== MARK.openedAt || mark.key !== key || before(i, mark.start) !== (side === 'committed')) continue;
      text = text.slice(0, mark.start) + text.slice(mark.end);
    }
    if (text !== original) { message.data = text; changed = true; }
  });
  return changed;
}

export function removeResult(chat, blockKey, table = readTable(chat)) {
  dropOpenedAt(chat, blockKey, 'committed', table);
  let removed = 0;
  for (const message of chat?.message ?? []) {
    for (const tag of findTags(message.data ?? '').reverse()) {
      if (!resultOf(table, tag.key, blockKey)) continue;
      message.data = message.data.replace(resultText(tag.key), '');
      removed++;
    }
  }
  return removed;
}

const resultText = tag => new RegExp(`\\s*${RESULT_LINE.source}\\s*<pkb#${escapeRe(tag)}>|\\s*<pkb#${escapeRe(tag)}>`);

export function undoable(chat, survey, key, { quiet = true } = {}) {
  const result = survey?.battles?.get(key)?.result;
  if (!result) return true;
  if (!quiet || (chat?.message ?? []).slice(result.index + 1).some(m => m?.role === 'char')) return false;
  return ![...survey.battles.values()].some(other => other.key !== key && other.result && other.result.at > result.at);
}

function latestResult(chat, blockKey, table) {
  let found = null;
  for (const message of chat?.message ?? []) for (const tag of findTags(message?.data ?? '')) if (resultOf(table, tag.key, blockKey)) found = { message, tag: tag.key };
  return found;
}

export function takeBackResult(chat, blockKey, table = readTable(chat)) {
  const found = latestResult(chat, blockKey, table);
  const line = found && new RegExp(`\\s*(${RESULT_LINE.source})\\s*(?=<pkb#${escapeRe(found.tag)}>)`).exec(found.message.data ?? '');
  if (!line) return false;
  found.message.data = String(found.message.data).replace(line[0], '\n');
  table.meta[found.tag] = { ...table.meta[found.tag], taken: line[1] };
  writeTable(chat, table);
  return true;
}

export function putBackResult(chat, blockKey, table = readTable(chat)) {
  const found = latestResult(chat, blockKey, table);
  const taken = found && table.meta[found.tag]?.taken;
  if (taken) {
    found.message.data = String(found.message.data).replace(new RegExp(`\\s*<pkb#${escapeRe(found.tag)}>`), `\n\n${taken}\n<pkb#${found.tag}>`);
    const { taken: _, ...meta } = table.meta[found.tag];
    table.meta[found.tag] = meta;
    writeTable(chat, table);
    return true;
  }
  if (found) return false;
  const messages = chat?.message ?? [];
  const last = readLast(chat);
  if (last?.blockKey !== blockKey || !last.line || !resultOf(table, last.tag, blockKey)) return false;
  if (messages.some(m => findTags(m?.data ?? '').some(t => t.key === last.tag))) return false;
  const index = messages.findIndex((m, i) => messageId(m, i) === last.place?.on);
  if (index < 0) return false;
  appendResult(messages[index], last.line, last.tag);
  return true;
}

export function setOpenedAt(chat, key, on, table = readTable(chat)) {
  const messages = chat?.message ?? [];
  let changed = dropOpenedAt(chat, key, 'attempt', table);
  if (on && messages.length) { messages.at(-1).data = String(messages.at(-1).data ?? '') + markText(MARK.openedAt, key); changed = true; }
  return changed;
}

const appendResult = (message, line, tag) => { message.data = `${String(message.data ?? '').replace(/\s+$/, '')}\n\n${line}\n<pkb#${tag}>`; };

export function placeResult(chat, { blockKey, line, tag }) {
  const messages = chat?.message ?? [];
  if (!messages.length) throw new Error('채팅에 메시지가 없습니다.');
  setMark(chat, blockKey, null);
  setFollow(chat, null);
  const index = messages.length - 1;
  appendResult(messages[index], line, tag);
  return index;
}

export function resultPlace(chat, index) {
  const messages = chat?.message ?? [];
  return { at: index, on: messageId(messages[index], index), above: index > 0 ? messageId(messages[index - 1], index - 1) : null };
}

export function lostResult(chat, last, table = readTable(chat)) {
  const place = last?.place;
  if (!place || !last.line || !last.tag || !table.meta?.[last.tag]) return -1;
  const messages = chat?.message ?? [];
  if (messages.some(m => findTags(m?.data ?? '').some(t => t.key === last.tag))) return -1;
  const block = findBlockMessage(chat, last.blockKey);
  const info = surveyBattles(chat, table).battles.get(last.blockKey);

  const stale = info?.phase === 'open' && readSave(chat)?.attempt?.blockKey !== last.blockKey;
  if (block < 0 || (info?.phase !== 'ready' && !stale)) return -1;
  const at = placeIndex(messages, place);
  return at < 0 ? -1 : Math.max(at - 1, block);
}

export function restoreResult(chat, table = readTable(chat)) {
  const last = readLast(chat);
  const index = lostResult(chat, last, table);
  if (index < 0) return -1;
  appendResult(chat.message[index], last.line, last.tag);
  setMark(chat, last.blockKey, null);
  writeLast(chat, { ...last, place: resultPlace(chat, index) });
  return index;
}

const endTags = (chat, table) => (chat?.message ?? []).flatMap((message, index) => findTags(message?.data ?? '')
  .filter(t => table.meta?.[t.key]?.storyEnd).map(t => ({ tag: t.key, index, meta: table.meta[t.key] })));

export function storyEndFixes(chat, table = readTable(chat), survey = surveyBattles(chat, table), { canPlay = () => false } = {}) {
  const messages = chat?.message ?? [];
  const attempt = readSave(chat)?.attempt ?? null;
  const ends = [];
  for (const info of survey.battles.values()) {
    if (info.committed !== 'story') continue;
    const block = battlesIn(messages[info.index], info.index).find(b => b.key === info.key);
    const battle = block ? readBattleAt(chat, info.index, block.body).spec : null;
    const autosave = info.ended.attempt && attempt?.blockKey === info.key ? attempt.auto ?? null : null;
    if (battle) ends.push({ key: info.key, index: info.ended.index, source: info.ended.source, outcome: info.ended.outcome, battle, autosave });
  }
  const linked = new Set();
  const drop = endTags(chat, table).filter(({ meta }) => {
    const end = ends.find(e => e.source === meta.end);
    if (linked.has(meta.end) || !end) return true;
    if (!meta.storyEnd?.engine && end.autosave && canPlay(end.autosave)) return true;
    linked.add(meta.end);
    return false;
  });
  const carried = new Set(drop.map(({ meta }) => meta.blockKey));
  return { drop, add: ends.filter(e => !linked.has(e.source) && (storyEndTrainer(e.battle, e.outcome) || e.autosave || carried.has(e.key))) };
}

export function recordStoryEnds(chat, table, teamOf = () => null, playedOf = () => null, { canPlay, held = [] } = {}) {
  const { drop, add } = storyEndFixes(chat, table, surveyBattles(chat, table), { canPlay });
  const records = new Map(drop.map(({ meta }) => [meta.blockKey, meta.storyEnd]));
  for (const { tag, index } of drop) {
    const message = chat.message[index];
    message.data = String(message.data ?? '').replace(new RegExp(`\\n?<pkb#${escapeRe(tag)}>`, 'g'), '');
  }
  for (const end of add) {
    const record = records.get(end.key);
    const person = storyEndTrainer(end.battle, end.outcome, record?.trainer?.team ?? teamOf(end.key)?.map(({ set }) => rosterMon(set)) ?? null);
    const engine = record?.engine ?? (end.autosave ? playedOf(end.autosave, end.key) : null);

    const actions = record?.actions ?? (engine && !record?.engine && held.length ? held.map(({ id, type, at, item, ops }) => ({ id, type, at, ...(item ? { item } : {}), ops })) : null);
    const storyEnd = { ...person, ...(engine ? { engine } : {}), ...(actions ? { actions } : {}) };
    const tag = hashKey(`end:${end.source}:${JSON.stringify(storyEnd)}`);
    table.meta = { ...table.meta, [tag]: { blockKey: end.key, end: end.source, storyEnd } };
    const message = chat.message[end.index];
    if (!findTags(message.data ?? '').some(t => t.key === tag)) message.data = `${String(message.data ?? '').replace(/\s+$/, '')}\n<pkb#${tag}>`;
  }
  return drop.length + add.length;
}
