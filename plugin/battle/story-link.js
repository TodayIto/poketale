import * as sim from '../../engine/browser-engine.mjs';
import { findBlocks, findTags, findMarks, markText, parseBattle, hashKey, messageId, battlesIn, battlesInText } from '../../story/blocks.mjs';
import { readTable, writeTable, tableStatus, createFolds, applyBattleResult, toEngineSpec, pruneTable, stateVars } from '../../story/state.mjs';
import { UNREADABLE, isUnreadable } from '../../story/stored.mjs';
import { WHAT, failed, refused, failureNote, failureText } from '../../story/failure.mjs';
import { LOCK_FREE } from '../../story/panel.mjs';
import { personaName } from './persona.js';
import { renderBattleCard, renderCardTail, renderCollapsed, renderDiscarded, wrapRecent, renderStoryChip, battleTitle, SEND_MS } from '../../story/card.mjs';
import { MARK, surveyBattles, battlePhase, cardResult, setMark, setFollow, setOpenedAt, hasFollowMarks, findBlockMessage, removeResult, placeResult, resultPlace,
  lostResult, restoreResult, takeBackResult, putBackResult, undoable, storyEndFixes, recordStoryEnds, readLast, writeLast, findOocs } from '../../story/chat.mjs';
import * as acts from '../../story/acts.mjs';
import { renderDiary, resultEvents, renderForge } from '../../story/diary.mjs';
import { forgeKey, forgeAt, mayForge, forgeRequest, runForge, appendBattle } from '../../story/forge.mjs';
import { showToast } from './toast.js';
import { turnSpan } from '../../story/narrate.mjs';
import { resultLine, RESULT_LINE_RE } from '../../story/prompts.mjs';
import { outcomeOf } from '../../story/outcome.mjs';
import { readSave, saveStatus, freshAttempt, retryAttempt, startSpec, setAuto, leaveAttempt, commitAttempt, addSend, sentPoint, sentAll, holdsAuto } from '../../story/save.mjs';
import { sendRange, buildOoc, insertOoc, markOoc, oocAhead, replyTo, SEND_WAIT } from '../../story/send.mjs';
import { setLore, loreInLine, varTexts, writeVars, trainerLore, writeTrainerLore } from '../../story/lore.mjs';
import { applyCompat } from '../../story/compat.mjs';
import { rerollSnapshot, restartSpec, snapshotResult } from '../../director/index.js';
import { loadLevelUp, EXP_TABLE } from './level-tables.js';
import { createFetchBytes } from './fetch-bytes.js';
import { showFrame, frameHidden } from './stage.js';
import { DEFAULT_SETTINGS, SETTINGS_UNREADABLE, loadSettings, saveSettings, mountSettings, mountPreparing, botEnabled, botKey, botsSwitched, ruleFormat, lookOf, adoptOldLook } from './settings.js';
import { loadPicture, savePicture, adoptOldPicture, entryMe } from './my-picture.js';
import { storyCss, sheetCss, SHEET_CLASS } from '../../story/style.mjs';
import { cardBounds } from '../../story/named.mjs';
import { opponentPicture } from '../../story/trainer-look.mjs';
import { DEFAULT_ASSET_BASE } from '../../view/assets.js';

const SPRITE = id => `https://play.pokemonshowdown.com/sprites/gen5/${id}.png`;
const TRAINER = id => `https://play.pokemonshowdown.com/sprites/trainers/${id}.png`;

let ctxPromise;
const storyCtx = () => ctxPromise ??= loadLevelUp().then(levelUp => ({ sim, levelUp, exp: EXP_TABLE, folds: createFolds() }))
  .catch(error => { ctxPromise = undefined; throw error; });

let settings = { ...DEFAULT_SETTINGS };

let settingsStatus = 'none';
export const currentSettings = () => settings;

const characters = new Map();
const botNames = new Map();
async function characterAt(charIndex, chat, { fresh = false } = {}) {
  const key = `${charIndex}:${chat?.id ?? ''}`;
  if (!fresh && characters.has(key)) { const chaId = characters.get(key); return { chaId, name: botNames.get(chaId) }; }
  const character = await risuai.getCharacterFromIndex(charIndex).catch(() => null);
  if (!character) return null;
  const info = { chaId: character.chaId ?? null, name: typeof character.name === 'string' ? character.name : '', lore: character.globalLore };
  characters.set(key, info.chaId);
  botNames.set(info.chaId, info.name);
  return info;
}

const isOn = x => !!x && botEnabled(settings, x.bot);

const targetOf = (charIndex, chatIndex, chat, character) => ({ chaId: character?.chaId ?? null, chatId: chat?.id ?? null, charIndex, chatIndex });

// Name of one chat - by position for a chat that had no chat id
const idOf = target => `${target.chaId}:${target.chatId ?? `#${target.charIndex}:${target.chatIndex}`}`;

const textKey = chat => JSON.stringify((chat?.message ?? []).map(m => [m?.chatId ?? null, String(m?.data ?? '')]));

const unreadableChat = chat => [tableStatus(chat), saveStatus(chat), acts.queueStatus(chat)].some(isUnreadable);

function makePass(charIndex, chatIndex, chat, character, seq) {
  const target = targetOf(charIndex, chatIndex, chat, character);
  const once = {};
  const memo = (name, make) => (name in once ? once[name] : (once[name] = make()));
  return {
    charIndex, chatIndex, chat, target, id: idOf(target), bot: character?.name ?? '', seq,

    lore: character?.lore,
    get table() { return memo('table', () => readTable(chat)); },
    get survey() { return memo('survey', () => surveyBattles(chat, this.table)); },
    get lastBattleKey() { return this.survey.lastBattleKey; },
    get save() { return memo('save', () => readSave(chat)); },
    get last() { return memo('last', () => readLast(chat)); },
    get text() { return memo('text', () => textKey(chat)); },
    get unreadable() { return memo('unreadable', () => unreadableChat(chat)); },

    get texts() { return memo('texts', () => new Map((chat.message ?? []).map((m, i) => [String(m?.data ?? ''), i]))); },

    has(text) { return this.texts.has(text); },

    at(text) { return this.texts.get(text) ?? (chat.message ?? []).length - 1; },

    grows(text) { const bottom = String(chat.message?.at(-1)?.data ?? ''); return text.startsWith(bottom) && (bottom !== '' || quietIn(this.id) > 0); },

    get key() {
      return memo('key', () => JSON.stringify([this.id, this.text,
        Object.entries(chat.scriptstate ?? {}).filter(([k]) => k.startsWith('$pkb_')).sort(([a], [b]) => (a < b ? -1 : 1))]));
    },

    computed() { return memo('computed', () => storyCtx().then(ctx => acts.pendingState(chat, ctx, { survey: this.survey }))); },
    async state() { return (await this.computed()).state; },
  };
}

async function openIndexes() {
  try {
    const charIndex = await risuai.getCurrentCharacterIndex();
    if (typeof charIndex !== 'number' || charIndex < 0) return null;
    return { charIndex, chatIndex: await risuai.getCurrentChatIndex() };
  } catch { return null; }
}

let lastPass = null;

let readSeq = 0;

// Reads the chat open now afresh. fresh: the bot name too (characterAt)
function readPass(at = null, { fresh = false } = {}) {
  const seq = ++readSeq;
  const promise = (async () => {
    const where = at ?? await openIndexes();
    if (!where) return null;
    const chat = await risuai.getChatFromIndex(where.charIndex, where.chatIndex);
    if (!chat) return null;
    const pass = makePass(where.charIndex, where.chatIndex, chat, await characterAt(where.charIndex, chat, { fresh }), seq);
    observe(pass.id, chat);
    return pass;
  })().catch(() => null);
  lastPass = promise;
  return promise;
}

async function sharedPass(text) {
  const where = await openIndexes();
  if (!where) return null;
  const last = await lastPass;
  if (last && last.charIndex === where.charIndex && last.chatIndex === where.chatIndex && (text === undefined || last.has(text))) return last;
  return readPass(where);
}

const listeners = new Set();

export function onStoryChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function changed() {
  for (const listener of listeners) {
    try { listener(); } catch (error) { console.warn('[poke-battle] 바뀜 알림', error); }
  }
}

export async function storyNow({ fresh = false } = {}) {
  const pass = fresh ? await readPass() : await sharedPass();
  if (!pass) return null;
  const on = isOn(pass);
  return { id: pass.id, target: pass.target, on, chat: pass.chat, key: pass.key, unreadable: on && pass.unreadable, compat: on && compatBots.has(pass.target?.chaId),
    state: on ? await pass.state() : null, ctx: on ? await storyCtx() : null, battle: on ? (({ key, phase }) => ({ key, phase }))(battleIn(pass)) : null };
}

const windows = [];
let windowLine = Promise.resolve();
function syncWindow() {
  const run = windowLine.then(async () => {
    const top = windows.at(-1);
    if (top) await showFrame(() => risuai.showContainer('fullscreen'), top.stage);
    else { await risuai.hideContainer(); frameHidden(); }
  });
  windowLine = run.catch(() => {});
  return run;
}
export async function showWindow(owner, stage = {}) {
  const at = windows.findIndex(w => w.owner === owner);
  if (at >= 0) windows.splice(at, 1);
  windows.push({ owner, stage });
  await syncWindow();
}
export async function hideWindow(owner) {
  const at = windows.findIndex(w => w.owner === owner);
  if (at < 0) return;
  windows.splice(at, 1);
  if (at === windows.length) await syncWindow();
}

export async function askPermission(name) {
  const run = windowLine.then(async () => {
    await risuai.hideContainer();
    frameHidden();
    return risuai.requestPluginPermission(name);
  });
  windowLine = run.catch(() => {});
  try { return (await run) === true; } catch (error) {
    console.warn('[poke-battle] 권한을 묻지 못함', error);
    return false;
  } finally { await syncWindow(); }
}

let active = null;
function setActive(next) {
  if (active === next) return;
  active = next;
  changed();
}

let opening = false;

const notices = new Map();
const noticeFor = (pass, key) => { const notice = notices.get(key); return notice && notice.id === pass?.id ? notice.note : undefined; };

const freshSeed = () => Array.from(crypto.getRandomValues(new Uint16Array(4)));

function shownIn(id, seq = Infinity) {
  if (!active || id !== idOf(active.origin)) return null;
  const { phase, markedAt } = active.origin;
  if (phase !== 'running') return { key: active.key, step: phase };
  return { key: active.key, step: seq <= markedAt ? 'starting' : active.collapsed ? 'folded' : 'running' };
}

function battleIn(where) {
  const survey = where.survey ?? surveyBattles(where.chat, readTable(where.chat));
  const save = 'save' in where ? where.save : readSave(where.chat);
  return battlePhase(survey, save?.attempt ?? null, shownIn(where.id, where.seq));
}

function faces(spec, key) {
  const { face, sheet, silhouette } = opponentPicture(spec, pictureOptions(key));
  return { trainerUrl: face ? TRAINER(face) : undefined, trainerRect: face ? cardBounds(face) : null,
    trainerSheet: sheet ? { url: `${DEFAULT_ASSET_BASE}images/trainer/${sheet.key}.png`, rect: sheet.rect } : undefined,
    trainerSilhouette: silhouette,
    speciesUrl: species => SPRITE(sim.Dex.species.get(species).spriteid) };
}

const pictureOptions = key => ({ key, silhouette: settings.silhouette });

const playerOptions = look => ({ gender: look.gender, silhouette: look.myBack === 'silhouette' });

async function personaLook() {
  const name = await personaName(risuai);
  if (name && settings.oldLook) {
    settings = adoptOldLook(settings, name);
    await Promise.all([adoptOldPicture(risuai.pluginStorage, name), saveSettingsInOrder(settings)]);
  }
  return { name, look: lookOf(settings, name) };
}

const ballOf = mon => (mon.fainted || mon.hp === 0 ? 'fainted' : mon.status && mon.status !== 'fnt' ? 'status' : 'ok');
const ballsOf = side => (side?.team ?? []).map(ballOf);
function progressBalls(progress) {
  const sides = progress?.result?.sides ?? progress?.sides;
  if (!Array.isArray(sides)) return undefined;
  return { mine: ballsOf(sides.find(s => s.id === 'p1') ?? sides[0]), theirs: ballsOf(sides.find(s => s.id === 'p2') ?? sides[1]) };
}

function cardView(pass, key, body) {
  const { spec, errors } = parseBattle(body);
  const info = pass?.survey.battles.get(key);

  const save = pass ? pass.save : null;
  const battle = pass ? battleIn(pass) : battlePhase(null);
  const status = active?.key === key && active.origin.phase === 'starting' && pass?.id === idOf(active.origin)
    ? battlePhase(pass.survey, pass.save?.attempt ?? null).card(key) : battle.card(key);

  return { key, spec: spec ?? { wild: false, team: [], place: 'plains', time: 'day', boss: false }, errors: spec ? [] : errors,
    warnings: spec ? errors : [], latest: pass?.lastBattleKey === key, status, result: cardResult(info),
    progress: status === 'progress' ? (battle.phase === 'parked' ? save?.attempt?.balls ?? undefined : active.progress) : undefined, faces: faces(spec, key), iron: settings.iron,

    sent: status === 'done' && !!pass && sentAll(pass.chat, key, info?.result?.turns ?? 0, save),

    canSend: !!pass && pass.last?.blockKey === key, canRetry: !!pass && !!startSpec(save, key),

    canUndo: !pass || mayUndo(pass, key),

    notice: noticeFor(pass, key) ?? (pass?.unreadable ? { text: UNREADABLE, kind: 'error' } : pass && storyEndFailed(pass, key) ? failureNote(WHAT.storyEnd, 'unresumable') : undefined),
    buttonsOff: doc === null };
}

const SHOWN_RESULT_RE = new RegExp(String.raw`\s*${RESULT_LINE_RE.source}(?=\s*<pkb#[a-z0-9]+>)`, 'g');

async function onDisplay(text) {
  if (typeof text !== 'string') return undefined;
  if (/<(?:div|details)\b[^>]*\bclass=["'][^"']*\bx-risu-pkb-log(?:row)?\b/.test(text)) return undefined;
  if (!text.includes('<pkb')) return plainDisplay(text);
  const shown = text.replace(SHOWN_RESULT_RE, '');
  const found = findBlocks(shown), tags = findTags(shown), marks = findMarks(shown), stories = findOocs(shown);
  if (!found.length && !tags.length && !marks.length && !stories.length) return plainDisplay(text);
  const pass = await sharedPass(text);
  if (!isOn(pass)) return undefined;

  const at = pass.at(text);
  const blocks = [...battlesInText(shown, messageId(pass.chat.message?.[at], at)), ...found.filter(b => b.kind !== 'battle')];
  changed();
  checkEnded(pass);

  const chip = stories.length ? renderStoryChip(stories.map(s => s.info)) : '';
  const pieces = [...blocks.map(b => ({ ...b, what: 'block' })), ...tags.map(t => ({ ...t, what: 'tag' })), ...marks.map(m => ({ ...m, what: 'mark' })),

    ...stories.map((s, i) => ({ ...s, what: 'story', html: i ? '' : chip, end: s.end + /^\s*/.exec(shown.slice(s.end))[0].length }))]
    .sort((a, b) => b.start - a.start);
  let out = shown, drew = false;
  for (const piece of pieces) {
    let html = '';
    if (piece.what === 'block' && piece.kind === 'battle') {
      const view = cardView(pass, piece.key, piece.body);
      const card = renderBattleCard(view).trim();
      drawn.set(piece.key, { id: pass.id, html: drawnHtml(view) });

      if (view.status === 'progress' && text.includes(markText(MARK.moved, piece.key))) html = renderCollapsed(view);
      else html = view.status === 'discarded' ? renderDiscarded(view) : wrapRecent(card, renderCollapsed(view));
    } else if (piece.what === 'mark' && piece.kind === MARK.here) {
      html = followedCard(pass, piece.key, blocks);
    } else if (piece.what === 'story') html = piece.html;
    drew ||= !!html;
    out = out.slice(0, piece.start) + html + out.slice(piece.end);
  }
  const log = await diaryHtml(text, pass, at);
  return withSheet(out.replace(/\s+$/, '') + log, drew || !!log);
}

async function plainDisplay(text) {
  const last = await sharedPass();
  const pass = last && !last.has(text) && !last.grows(text) ? await sharedPass(text) : last;
  if (!isOn(pass)) return undefined;
  const html = renderDiary({ forge: forgeSlot(pass, pass.at(text), text) });
  return html ? withSheet(text.replace(/\s+$/, '') + html) : undefined;
}

const withSheet = (out, drew = true) => (sheetReady || !drew ? out : `${out.replace(/\s+$/, '')}\n\n<style>${storyCss({ scope: '' })}</style>\n\n`);

function battleBlock(where, key) {
  const info = where.survey.battles.get(key);
  return info ? battlesIn(where.chat.message[info.index], info.index).find(b => b.key === key) ?? null : null;
}

function followedCard(pass, key, blocksHere) {
  if (!pass || blocksHere.some(b => b.kind === 'battle' && b.key === key)) return '';
  const block = battleBlock(pass, key);
  if (!block) return '';
  const view = cardView(pass, key, block.body);
  return view.status === 'progress' ? renderBattleCard(view) : '';
}

async function diaryHtml(text, pass, at) {
  try {
    const own = acts.actsIn(text, pass?.table);
    const changes = findBlocks(text).some(b => b.kind === 'change') ? acts.changesIn(text, pass?.chat, await storyCtx()) : null;
    const counts = t => { const meta = pass?.table?.meta?.[t.key]; return !meta?.blockKey || pass.survey.battles.get(meta.blockKey)?.committed !== 'discarded'; };
    const results = findTags(text).filter(counts).flatMap(t => resultEvents(pass?.table?.meta?.[t.key], pass?.table?.snaps?.[t.key]));
    const log = { events: [...results, ...(changes?.events ?? []), ...(own?.events ?? [])], errors: [...(changes?.errors ?? []), ...(own?.errors ?? [])] };
    return renderDiary({ ...log, forge: forgeSlot(pass, at, text) });
  } catch (error) {
    console.warn('[poke-battle] 메시지 로그를 만들지 못함', error);
    return '';
  }
}

let writes = Promise.resolve();

// Runs work after every earlier write (our writes never overlap)
function inLine(work) {
  const run = writes.then(work);
  writes = run.catch(() => {});
  return run;
}

let varsAt = null;

const HELD = Symbol('held');

const mayWrite = (found, { result = false } = {}) => isOn(found) || result;

function writeChat(target, change, { vars = false, missing = false, result = false, onWait } = {}) {
  return whenQuiet(target, found => {
    if (!found) {
      if (missing) throw failed('chatGone');
      return undefined;
    }
    return writeRecords(found, change, { vars, result });
  }, { onWait });
}

async function writeRecords(found, change, { vars, result: commits = false }) {
  if (!mayWrite(found, { result: commits })) return HELD;
  if (unreadableChat(found.chat)) throw failed('unreadable');
  const id = idOf(found.target), on = isOn(found);
  const before = vars ? null : varsKey({ id, chat: found.chat });
  const result = await change(found.chat, found);
  if (result === false) return false;
  acts.settleQueue(found.chat);
  pruneTable(found.chat, [...acts.readQueue(found.chat).actions.map(a => a.sent), readLast(found.chat)?.tag].filter(Boolean));
  if (vars && on) await setVars({ id, chat: found.chat });

  const inLine = vars ? (on ? varsKey({ id, chat: found.chat }) : null) : varsAt === before ? varsKey({ id, chat: found.chat }) : varsAt;
  await land(found, inLine);
  return result;
}

async function clearDerived(found) {
  if (setLore(found.chat, false)) await land(found, null);
}

async function land(found, inLine) {
  await risuai.setChatToIndex(found.charIndex, found.chatIndex, found.chat);
  observe(idOf(found.target), found.chat, { ours: true });
  varsAt = inLine;
  lastPass = Promise.resolve(makePass(found.charIndex, found.chatIndex, found.chat, found.character, ++readSeq));
  changed();
}

const AGAIN = Symbol('again');

const targetQueues = new Map();

function whenQuiet(target, work, { onWait } = {}) {
  const key = target ? idOf(target) : null;
  let waiting = false;
  const wait = {
    start() { if (!waiting) { waiting = true; onWait?.(true); } },
    end() { if (waiting) { waiting = false; onWait?.(false); } },
  };
  if (target && quietIn(key)) wait.start();
  const run = (targetQueues.get(key) ?? Promise.resolve()).then(() => headWrite(target, work, wait)).finally(wait.end);
  const tail = run.catch(() => {});
  targetQueues.set(key, tail);
  tail.then(() => { if (targetQueues.get(key) === tail) targetQueues.delete(key); });
  return run;
}

async function headWrite(target, work, wait) {
  const find = target ? () => locate(target) : () => readPass();
  for (;;) {
    if (!target || quietIn(idOf(target))) await untilQuiet(find, wait.start);
    const outcome = await inLine(async () => {
      const found = await find();
      if (found && quietIn(idOf(found.target))) return AGAIN;
      wait.end();
      return work(found);
    });
    if (outcome !== AGAIN) return outcome;
  }
}

async function untilQuiet(find, waiting) {
  for (;;) {
    const found = await find();
    const wait = found ? quietIn(idOf(found.target)) : 0;
    if (!wait) return;
    waiting?.();
    await sleep(wait);
  }
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

let compatDone = null, compatRunning = null;
const compatStatus = new Map();
const compatBots = new Set();

const compatLine = work => whenQuiet(null, work).catch(error => console.warn('[poke-battle] 호환 봇 항목을 맞추지 못함', error));

async function compatAt(charIndex, chaId, on) {
  const character = await risuai.getCharacterFromIndex(charIndex).catch(() => null);
  if (!character || character.chaId !== chaId) return false;
  const result = applyCompat(character.globalLore, on);
  if (!result.found.length) { compatStatus.delete(chaId); compatBots.delete(chaId); return true; }
  if (!compatBots.has(chaId)) { compatBots.add(chaId); changed(); }
  if (result.changed) {
    try {
      if (typeof risuai.setCharacterToIndex !== 'function') throw new Error('setCharacterToIndex 없음');
      await risuai.setCharacterToIndex(charIndex, { ...character, globalLore: result.lore });
    } catch (error) {
      console.warn('[poke-battle] 봇 카드 로어북을 고치지 못함', error);
      compatStatus.set(chaId, failureText(WHAT.compat, typeof risuai.setCharacterToIndex === 'function' ? error : 'writeBlocked'));
      return false;
    }
  }
  const missing = result.missing.length ? `\n찾지 못한 항목: ${result.missing.join(', ')}` : '';
  compatStatus.set(chaId, on
    ? `${result.changed ? '봇 카드의 호환 봇 항목을 감쌌습니다' : '호환 봇 항목 감싸짐'} (${result.found.length}개).${missing}`
    : '호환 봇 항목을 원래대로 풀었습니다.');
  return true;
}

const syncCompat = (target, on) => compatLine(async () => {
  const found = await locate(target);
  return !!found && compatAt(found.charIndex, target.chaId, on);
});

const reconcileBot = (name, on) => compatLine(async () => {
  const key = botKey(name);
  for (let ci = 0; ci < MAX_CHARACTERS; ci++) {
    const character = await risuai.getCharacterFromIndex(ci).catch(() => null);
    if (!character) break;
    if (!character.chaId || botKey(character.name) !== key) continue;
    await compatAt(ci, character.chaId, on);
  }
});

function reconcileCompat(pass) {
  if (!pass?.target?.chaId) return Promise.resolve();
  const key = `${pass.id}:${isOn(pass)}`;
  compatRunning = key;
  return syncCompat(pass.target, isOn(pass))
    .then(ok => { if (ok) compatDone = key; })
    .finally(() => { if (compatRunning === key) compatRunning = null; });
}

function compatForInput(pass) {
  const { found, changed } = applyCompat(pass?.lore, isOn(pass));
  return found.length && changed ? reconcileCompat(pass) : Promise.resolve();
}

function checkCompat(pass) {
  if (!pass?.target?.chaId) return;
  const key = `${pass.id}:${isOn(pass)}`;
  if (key !== compatRunning && key !== compatDone) reconcileCompat(pass);
}

const MAX_CHARACTERS = 2000, MAX_CHATS = 1000;
async function locate(target) {
  const at = async (charIndex, chatIndex, chat) => {
    const character = await characterAt(charIndex, chat);
    if (!character || character.chaId !== target.chaId) return null;
    const found = { charIndex, chatIndex, chat, character, bot: character.name, target: targetOf(charIndex, chatIndex, chat, character) };
    observe(idOf(found.target), chat);
    return found;
  };

  const quick = await risuai.getChatFromIndex(target.charIndex, target.chatIndex).catch(() => null);
  if (quick && (quick.id ?? null) === target.chatId) {
    const found = await at(target.charIndex, target.chatIndex, quick);
    if (found) return found;
  }
  if (!target.chatId) return null;
  for (let ci = 0; ci < MAX_CHARACTERS; ci++) {
    const character = await risuai.getCharacterFromIndex(ci).catch(() => null);
    if (!character) break;
    if (character.chaId !== target.chaId) continue;
    for (let hi = 0; hi < MAX_CHATS; hi++) {
      const chat = await risuai.getChatFromIndex(ci, hi).catch(() => null);
      if (!chat) break;
      if (chat.id === target.chatId) return at(ci, hi, chat);
    }
    return null;
  }
  return null;
}

let doc;

let settleWaiters = [];

const domSettled = () => new Promise(resolve => settleWaiters.push(resolve));
function settle() {
  const waiters = settleWaiters;
  settleWaiters = [];
  for (const resolve of waiters) resolve();
}

let sheetReady = false;
async function installSheet() {
  if (!doc) return;
  let sheet = await doc.querySelector(`style.${SHEET_CLASS}`);
  if (!sheet) {
    sheet = await doc.createElement('style');
    await sheet.addClass(SHEET_CLASS);
    await (await doc.querySelector('head') ?? await doc.querySelector('body')).appendChild(sheet);
  }
  await sheet.setTextContent(await sheetCss());
  sheetReady = true;
}

let bindingButtons = Promise.resolve();
function bindButtons() {
  const next = bindingButtons.then(bindButtonsNow);
  bindingButtons = next.catch(() => {});
  return next;
}
async function bindButtonsNow() {
  if (!doc) return;
  const list = await doc.querySelectorAll('.x-risu-pkb-btn:not(.x-risu-pkb-bound)');
  const n = await list.length();
  for (let i = 0; i < n; i++) {
    const element = await list.at(i);
    const cls = await element.getClassName();
    const pick = prefix => cls.match(new RegExp(`x-risu-${prefix}-([a-z0-9]+)`))?.[1];
    const press = { key: pick('pkbk'), action: pick('pkba'), index: Number(pick('pkbi')) };
    await element.addEventListener('click', () => onButton(press).catch(error => onButtonError(press, error)));
    await element.addClass('x-risu-pkb-bound');
  }
}

const openBattleWindow = async options => (await import('./runtime.js')).mountBattle(options);

let errorApp;
async function showError(error) {
  console.error(error);
  errorApp?.close?.();
  const owner = {};
  errorApp = await openBattleWindow({ fetchBytes: () => Promise.reject(error), onClose: () => hideWindow(owner), orientation: settings.orientation });
  errorApp.showError(error);
  await showWindow(owner);
}

const PRESS_WHAT = { open: WHAT.open, resume: WHAT.resume, retry: WHAT.retry, retryok: WHAT.retry, send: WHAT.send, discardok: WHAT.discard, restore: WHAT.restore };

const OPENS = new Set(['open', 'resume', 'retry', 'retryok']);
async function onButtonError(press, error) {
  if (!press.key || (OPENS.has(press.action) && !error?.why)) return showError(error);
  if (!error?.why) console.error(error);
  return showNotice(press, failureNote(PRESS_WHAT[press.action] ?? WHAT.action, error));
}

const withIndex = (html, index) => html.replaceAll('{{chat_index}}', Number.isInteger(index) ? String(index) : 'x');
async function setTail(press, view) {
  const element = doc && await doc.querySelector(`.x-risu-pkbt-${press.key}`);
  if (element) await element.setInnerHTML(withIndex(renderCardTail(view), press.index));
}

async function refreshCard(press) {
  if (!doc) return;
  await drawCard(await readPass(), press.key, press.index);
}

const drawn = new Map();

// Swaps the card in place with how it looks in this read of the chat
async function drawCard(pass, key, index) {
  const view = viewFor(pass, key);
  if (view && view.status !== 'discarded') await swapCard(pass.id, key, renderBattleCard(view).trim(), index);
}

async function swapCard(id, key, html, index) {
  const element = doc && await doc.querySelector(`.x-risu-pkbc-${key}`);
  if (element) {
    const inner = html.slice(html.indexOf('>') + 1, html.lastIndexOf('</div>'));
    await element.setInnerHTML(withIndex(inner, index));
  }
  drawn.set(key, { id, html });
}

const drawnHtml = view => (view.status === 'discarded' ? renderDiscarded(view) : renderBattleCard(view)).trim();
const isLine = html => html.includes('x-risu-pkb-gone');

async function refreshDrawn(pass) {
  for (const [key, card] of drawn) {
    const view = card.id === pass.id ? viewFor(pass, key) : null;
    if (!view) { drawn.delete(key); continue; }
    const html = drawnHtml(view);
    if (html === card.html || isLine(html) !== isLine(card.html)) continue;
    await swapCard(pass.id, key, html, pass.survey.battles.get(key).index).catch(error => console.warn('[poke-battle] 카드를 바꿔 끼우지 못함', error));
  }
}
function viewFor(pass, key) {
  const block = pass ? battleBlock(pass, key) : null;
  return block ? cardView(pass, key, block.body) : null;
}
async function showNotice(press, note) {
  const pass = await readPass();
  notices.set(press.key, { id: pass?.id, note });
  await drawNotice(press, pass);
}

async function drawNotice(press, pass) {
  const view = viewFor(pass, press.key);
  if (view?.status === 'discarded') await swapCard(pass.id, press.key, drawnHtml(view), press.index);
  else if (view) await setTail(press, view);
}

const forging = new Set();
const forgeAsking = new Map();

const forgeSlots = new Map();

const forgeLook = (pass, key, at) => {
  const name = `${pass.id}:${key}`;
  const on = at === forgeAt(pass.chat, { quiet: !quietIn(pass.id) });
  const ask = on && forgeAsking.get(name) === pass.text;
  if (!ask) forgeAsking.delete(name);
  return { on, busy: forging.has(name), ask };
};

function forgeSlot(pass, at, text) {
  const message = pass?.chat.message?.[at];
  if (!mayForge(message)) return !pass.has(text) ? { pending: true, buttonsOff: doc === null } : null;
  const key = forgeKey(messageId(message, at));
  const view = { key, at, ...forgeLook(pass, key, at), buttonsOff: doc === null };
  forgeSlots.set(`${pass.id}:${key}`, { id: pass.id, key, html: renderForge(view) });
  return view;
}

async function refreshForge(pass) {
  const index = new Map((pass.chat.message ?? []).map((m, i) => [forgeKey(messageId(m, i)), i]));
  const bottom = forgeAt(pass.chat);
  if (bottom >= 0) {
    const key = forgeKey(messageId(pass.chat.message[bottom], bottom));
    const name = `${pass.id}:${key}`;
    if (!forgeSlots.has(name)) forgeSlots.set(name, { id: pass.id, key, html: null });
  }
  for (const [name, slot] of forgeSlots) {
    const at = slot.id === pass.id ? index.get(slot.key) : undefined;
    if (at === undefined) { forgeSlots.delete(name); forgeAsking.delete(name); continue; }
    const html = renderForge({ key: slot.key, ...forgeLook(pass, slot.key, at) });
    if (html === slot.html) continue;
    try {
      const element = doc && (await doc.querySelector(`.x-risu-pkbf-${slot.key}`) ?? await doc.querySelector(`.x-risu-pkbfi-${at}`));
      if (element) { await element.setInnerHTML(withIndex(html, at)); slot.html = html; }
    } catch (error) { console.warn('[poke-battle] 칼 칸을 바꿔 끼우지 못함', error); }
  }
}
async function askForge(press, pass) {
  const name = `${pass.id}:${press.key}`;
  if (forging.has(name)) return;
  try {
    const asked = forgeRequest({ chat: pass.chat, key: press.key, quiet: !quietIn(pass.id), state: await pass.state(), sim, naming: naming() });
    if (asked.why) throw failed(asked.why);
    if (forgeAsking.has(name)) forgeAsking.delete(name); else forgeAsking.set(name, pass.text);
    await refreshForge(pass);
    await bindButtons();
  } catch (error) { await showToast(doc, failureNote(WHAT.forge, error)); }
}
async function forgeBattle(press, pass) {
  const running = `${pass.id}:${press.key}`;
  if (forging.has(running)) return;
  forging.add(running);
  try {
    if (pass.unreadable) throw failed('unreadable');
    const asked = forgeRequest({ chat: pass.chat, key: press.key, quiet: !quietIn(pass.id), state: await pass.state(), sim, naming: naming() });
    if (asked.why) throw failed(asked.why);
    await refreshForge(pass);
    const made = await runForge(args => risuai.runLLMModel(args), asked.messages);
    if (made.why) throw Object.assign(failed(made.why), { cause: made.error });
    const ctx = await storyCtx();

    const wrote = await writeChat(pass.target, chat => appendBattle(chat, asked, made.block, { state: acts.pendingState(chat, ctx).state, sim, naming: naming() }),
      { vars: true, missing: true });
    if (wrote === HELD) throw failed('writeBlocked');
    if (wrote !== true) throw failed('sceneMoved');
  } catch (error) {
    if (error?.why) console.warn('[poke-battle] 배틀을 만들지 못함', error.message, error.cause ?? '');
    else console.error(error);
    await showToast(doc, failureNote(WHAT.forge, error));
  } finally { forging.delete(running); }
  const now = await readPass();
  if (now) await refreshForge(now);
}

async function actionPass() {
  const pass = await readPass();
  if (!pass) throw failed('noChat');
  return isOn(pass) ? pass : null;
}

async function onButton(press) {
  const { key, action } = press;
  if (!key) return undefined;
  notices.delete(key);
  switch (action) {
  case 'open': return startBattle(press);
  case 'retry': case 'retryok': {
    if (settings.iron) throw failed('ironMode');

    const pass = action === 'retry' ? await actionPass() : null;
    if (pass && storyAfterResult(pass, key)) {
      const view = viewFor(pass, key);
      if (view) return setTail(press, { ...view, ask: 'retry' });
    }
    return startBattle(press, { mode: 'retry' });
  }
  case 'retryno': {
    const pass = await actionPass();
    const view = pass && viewFor(pass, key);
    if (view) await setTail(press, view);
    return undefined;
  }
  case 'resume': {

    const pass = await actionPass();
    if (!pass) return undefined;
    if (shownIn(pass.id)?.key === key) return reopen();
    return startBattle(press, { mode: 'resume' });
  }
  default: break;
  }
  const pass = await actionPass();
  if (!pass) return undefined;
  switch (action) {
  case 'send': return cardSend(press, pass);
  case 'discard': case 'discardno': {

    const view = viewFor(pass, key);
    if (view) await setTail(press, { ...view, ask: action === 'discard' ? 'discard' : undefined });
    return undefined;
  }
  case 'discardok': return discardCard(press, pass);
  case 'restore': return restoreCard(press, pass);
  case 'forge': return askForge(press, pass);
  case 'forgeok': {
    const name = `${pass.id}:${press.key}`;
    if (forgeAsking.get(name) !== pass.text) return;
    forgeAsking.delete(name);
    return forgeBattle(press, pass);
  }
  default: return undefined;
  }
}

const mayUndo = (where, key) => undoable(where.chat, where.survey ?? surveyBattles(where.chat, readTable(where.chat)), key, { quiet: !quietIn(where.id) });

function storyAfterResult(pass, key) {
  const at = pass.survey.battles.get(key)?.result?.index;
  return at !== undefined && at < (pass.chat.message?.length ?? 0) - 1;
}

function pressedTarget(pass, press) {
  if (findBlockMessage(pass.chat, press.key) < 0) throw failed('blockGone');
  return { ...pass.target, key: press.key };
}

async function restoreCard(press, pass) {
  const target = pressedTarget(pass, press);
  await writeChat(target, (chat, found) => {
    if (!mayUndo({ id: idOf(found.target), chat }, target.key)) throw failed('storyOn');
    if (!setMark(chat, target.key, null)) throw failed('blockGone');
    putBackResult(chat, target.key);
  }, { vars: true, missing: true });
}

async function discardCard(press, pass) {
  const target = pressedTarget(pass, press);
  if (settings.iron && battleIn(pass).key === press.key) return forfeitCard(press, pass);
  await writeChat(target, async (chat, found) => {
    const id = idOf(found.target);
    if (!mayUndo({ id, chat }, target.key)) throw failed('storyOn');
    if (shownIn(id)?.key === target.key) await dropActive();
    leaveAttempt(chat, target.key);
    if (!setMark(chat, target.key, MARK.discarded)) throw failed('blockGone');
    setFollow(chat, null);
    setOpenedAt(chat, target.key, false);
    takeBackResult(chat, target.key);
  }, { vars: true, missing: true });
}

async function forfeitCard(press, pass) {
  if (active && shownIn(pass.id)?.key === press.key) {
    const { origin, app } = active;
    await saveForfeit(origin, app.progress());
    await app.close();
    return;
  }
  const { auto } = pass.save.attempt;
  const block = battleBlock(pass, press.key);
  const origin = { ...pass.target, key: press.key, battle: parseBattle(block.body).spec, start: auto.spec.p1.team, phase: 'parked' };
  const played = playedAt(auto, await storyCtx());
  await saveForfeit(origin, { turn: auto.turn, result: played?.result });
}

async function startBattle(press, { mode = 'new', retryOf = 'record', owner = {} } = {}) {
  if (opening) return false;
  opening = true;
  let app, origin, markOpen;
  try {
    ({ app, origin, markOpen } = await prepareBattle(press, mode, retryOf, owner));
  } finally { opening = false; }
  if (!app) return false;

  setActive({ key: press.key, origin, app, window: owner, collapsed: false, progress: origin.startBalls, press });
  await showWindow(owner);
  await app.covered;
  if (origin.phase !== 'starting') return true;

  try {
    origin.marking = markOpen();
    await origin.marking;
  } catch (error) {
    if (active?.origin === origin) await dropActive();
    throw error;
  }
  if (origin.phase !== 'starting') return true;
  origin.phase = 'running';
  origin.markedAt = readSeq;
  try {
    await app.start();
  } catch (error) {

    if (!error?.unresumable) throw error;
    if (active?.origin === origin) await dropActive();
    throw error;
  }
  return true;
}

async function prepareBattle(press, mode, retryOf, owner) {
  const { key } = press;
  const pass = await actionPass();
  if (!pass) return {};

  const now = battleIn(pass);
  if (shownIn(pass.id) || (now.key && now.key !== key)) throw failed('busy');
  if (mode === 'resume' && now.phase !== 'parked') throw failed('unresumable');
  const at = findBlockMessage(pass.chat, key);
  if (at < 0) throw failed('blockGone');
  const block = battlesIn(pass.chat.message[at], at).find(b => b.key === key);
  const { spec: battle, errors } = parseBattle(block.body);
  if (!battle) throw failed('blockBroken');
  const ctx = await storyCtx();
  const save = pass.save;

  let from = null, start = null;
  if (mode === 'resume') from = save.attempt.auto;
  else if (mode === 'retry') {
    from = retryAttempt(structuredClone(pass.chat), key, retryOf);

    if (from) from = rerollSnapshot(from, freshSeed());
    else start = startSpec(save, key);
  }
  const persona = await personaLook();
  let spec, startBalls = mode === 'resume' ? save.attempt.balls ?? undefined : undefined;
  if (!from) {

    let forState = pass.chat;
    if (mode === 'retry') { forState = structuredClone(pass.chat); removeResult(forState, key, pass.table); }

    const { state } = acts.pendingState(forState, ctx);
    if (!state.party.length) throw failed('emptyParty');
    if (!state.party.some(m => m.hp !== 0)) throw failed('allFainted');

    const playerName = persona.name;

    spec = start ? restartSpec(start, freshSeed()) : toEngineSpec(state, battle, { ...ctx, playerName },
      { seed: freshSeed(), formatid: ruleFormat(settings.rule), picture: pictureOptions(key), player: playerOptions(persona.look) });
    startBalls = { mine: state.party.map(ballOf), theirs: battle.team.map(() => 'ok') };
  }

  const { difficulty } = settings;
  if (spec) spec = { ...spec, difficulty };
  if (from?.spec) from = { ...from, spec: { ...from.spec, difficulty } };

  const { myPicture } = persona.look;
  const me = entryMe(myPicture, myPicture === 'image' ? await loadPicture(risuai.pluginStorage, persona.name) : null);

  const origin = { ...pass.target, index: at, key, battle, startBalls, phase: 'starting', start: (spec ?? from?.spec)?.p1?.team ?? null };
  if (active) await parkActive();

  const markOpen = () => writeChat(origin, chat => {
    if (findBlockMessage(chat, key) < 0) throw failed('blockGone');

    if (mode === 'retry' && retryOf === 'record' && !mayUndo({ id: idOf(origin), chat }, key)) throw failed('storyOn');
    if (mode === 'retry') { retryAttempt(chat, key, retryOf); if (from) setAuto(chat, key, from); }
    else if (mode === 'new') freshAttempt(chat, key);
    setMark(chat, key, MARK.open);

    if (mode !== 'resume') setOpenedAt(chat, key, true);
    setFollow(chat, key);
  }, { vars: true, missing: true });
  const app = await openBattleWindow({
    fetchBytes: createFetchBytes(risuai), iron: settings.iron,
    onSpeed: speed => keepSettings({ ...settings, speed }),
    me,

    viewOptions: { theme: settings.theme, sound: settings.sound, speed: settings.speed, typeHints: settings.typeHints, moveAnims: settings.moveAnims, quality: settings.quality },

    onClose: async () => { await hideWindow(owner); await finish(origin); },
    onCollapse: () => collapse().catch(showError),

    onRetry: () => app.close().then(() => startBattle(press, { mode, retryOf })).catch(error => onButtonError(press, error)),
    story: { spec, from,
      onTurn: snapshot => autosave(origin, snapshot),
      onResult: result => saveResult(origin, result),

      // A battle whose result is committed sends that record, one still running what it has shown so far
      onSend: options => (origin.phase === 'saved' ? sendCommitted(origin, options) : sendLive(origin, options)),
      onRetry: () => retryFromEnd(origin, press),
      onForfeit: progress => saveForfeit(origin, progress) },
  });
  return { app, origin, markOpen };
}

async function retryFromEnd(origin, press) {
  if (settings.iron) return;
  const app = active?.origin === origin ? active.app : null;
  origin.phase = 'handoff';

  const owner = {};
  await showWindow(owner);
  await app?.close();
  let failure = null;
  const took = await startBattle({ ...press, key: origin.key }, { mode: 'retry', retryOf: 'attempt', owner }).catch(error => { failure = error; return false; });
  if (!took) await hideWindow(owner).catch(() => {});
  if (failure) await onButtonError(press, failure);
}

async function finish(origin) {
  if (active?.origin === origin) setActive(null);

  if (origin.phase !== 'starting' && origin.phase !== 'running') return;
  origin.phase = 'left';

  await origin.marking?.catch(() => {});
  try {
    await writeChat(origin, chat => {
      const unmarked = setMark(chat, origin.key, null);
      const unfollowed = setFollow(chat, null).length > 0;
      const unopened = setOpenedAt(chat, origin.key, false);
      return leaveAttempt(chat, origin.key) || unmarked || unfollowed || unopened;
    }, { vars: true });
  } catch (error) { console.warn('[poke-battle] 열림 표식을 떼지 못함', error); }
}

async function collapse() {
  if (!active || active.collapsed) return;
  active.collapsed = true;
  active.app.pause();
  active.app.storyDot(false);
  active.progress = progressBalls(active.app.progress()) ?? active.progress;
  await hideWindow(active.window);
  await refreshCard(active.press).catch(() => {});
}

const battleOn = origin => isOn({ bot: botNames.get(origin.chaId) });

async function fitActive() {
  if (!active || active.collapsed || battleOn(active.origin)) return;
  const { origin, app } = active;
  if (origin.phase === 'running' && app.mode === 'running') await collapse();
}

async function reopen() {
  if (!active) return;
  await showWindow(active.window);
  if (active.collapsed) { active.collapsed = false; active.app.resume(); }
}

async function parkActive() {
  const parked = active;
  const { origin } = parked;
  const snapshot = origin.phase === 'running' ? parked.app.snapshot() : null;
  if (snapshot) {
    let saved;
    try { saved = await autosave(origin, snapshot); } catch (error) {
      console.warn('[poke-battle] 다른 채팅의 배틀을 저장하지 못함', error);
      throw failed('parkFailed');
    }
    if (saved === HELD && !holdsAuto((await locate(origin))?.chat, origin.key, snapshot)) throw failed('parkFailed');
    origin.phase = 'parked';
  }
  if (active === parked) setActive(null);
  await parked.app.close();
}

async function dropActive() {
  const dropped = active;
  if (!dropped) return;
  setActive(null);
  dropped.origin.phase = 'dropped';
  await dropped.app.close();
}

function shownStale(pass) {
  const shown = shownIn(pass.id);
  if (!shown || (shown.step !== 'running' && shown.step !== 'folded') || battleIn(pass).key === shown.key) return null;
  return pass.survey.battles.get(shown.key)?.phase === 'story' ? 'story' : 'gone';
}

async function checkActive(pass) {
  if (shownStale(pass) === 'gone') await dropActive();
  else checkEnded(pass);
}

function endInStory(origin) {
  origin.phase = 'story';
  if (active?.origin !== origin) return;
  const { app } = active;
  setActive(null);

  Promise.resolve(app.close()).then(() => watchNow()).catch(() => {});
}

function checkEnded(pass) {
  if (shownStale(pass) !== 'story') return;
  const ended = active;
  queueMicrotask(() => { if (active === ended) endInStory(ended.origin); });
}

async function writeResult(origin, { outcome, result, apply }) {
  if (origin.phase === 'saved') return true;
  const ctx = await storyCtx();
  let ended = false;
  const wrote = await writeChat(origin, chat => {
    if (origin.phase === 'saved') return false;
    if (findBlockMessage(chat, origin.key) < 0) throw failed('blockGone');
    if (surveyBattles(chat, readTable(chat)).battles.get(origin.key)?.phase === 'story') { ended = true; return false; }
    removeResult(chat, origin.key);

    const { state: before, table, added } = acts.pendingState(chat, ctx);

    const after = apply ? applyBattleResult(before, apply, ctx, { battle: origin.battle, outcome, start: origin.start }) : before;
    const tag = hashKey(`${origin.key}:${Date.now()}`);

    const caughtMon = result.captured ? [...after.party, ...after.box].find(m => ![...before.party, ...before.box].some(b => b.uid === m.uid)) : null;
    const caught = caughtMon ? { species: caughtMon.set.species, storage: after.box.includes(caughtMon) ? after.box.indexOf(caughtMon) + 1 : null } : null;
    const evolutions = (result.evolutions ?? []).filter(e => e?.evolved === true && !e.unsupported).map(e => ({ from: e.from, to: e.to, evolved: true }));
    const line = resultLine({ outcome, battle: origin.battle, caught, evolutions, korean: settings.koNames, en: dexName });
    const place = resultPlace(chat, placeResult(chat, { blockKey: origin.key, line, tag }));
    table.snaps[tag] = after;

    table.meta = { ...table.meta, [tag]: { blockKey: origin.key, outcome, turns: result.turn ?? 0,
      faceSpecies: result.captured?.species ?? origin.battle.team?.[0]?.species, title: battleTitle(origin.battle, { level: false }), caught, evolved: evolutions,
      ...(added.length ? { held: added.map(action => action.id) } : {}) } };
    writeTable(chat, table);

    writeLast(chat, { blockKey: origin.key, tag, outcome, battle: origin.battle, line, place,
      result: { turn: result.turn ?? 0, outcome: result.outcome ?? null, winner: result.winner ?? null, captured: result.captured ?? null,
        forfeited: !!result.forfeited, playerName: result.sides?.[0]?.name ?? null, log: result.log ?? [], screen: result.screen ?? [], evolutions } });
    commitAttempt(chat, origin.key);
    return true;
  }, { vars: true, missing: true, result: true });
  if (wrote) origin.phase = 'saved';
  else if (ended) endInStory(origin);
  return origin.phase === 'saved';
}

async function saveResult(origin, result) {
  return { committed: await writeResult(origin, { outcome: outcomeOf(result), result, apply: result }) };
}

async function saveForfeit(origin, progress) {
  const now = progress?.result;
  const apply = Array.isArray(now?.sides) ? now : null;
  const screen = active?.origin === origin ? active.app.screen().lines : [];
  await writeResult(origin, { outcome: 'lose', result: { turn: progress?.turn ?? 0, log: progress?.log ?? [], sides: now?.sides, screen }, apply });
}

function battleForVars(where) {
  const { chat } = where;
  const survey = where.survey ?? surveyBattles(chat, readTable(chat));
  const save = 'save' in where ? where.save : readSave(chat);
  const now = battleIn({ id: where.id, seq: where.seq, chat, survey, save });
  let key = now.key, turn = null, battle = null, pending = false;
  if (now.phase === 'parked') turn = save.attempt.auto?.turn ?? null;
  else if (key) {
    battle = active.origin.battle;
    turn = (() => { try { return active.app.progress()?.turn ?? null; } catch { return null; } })();
  } else {
    key = [...survey.battles.values()].filter(info => !info.attempt && now.card(info.key) === 'ready').sort((a, b) => a.at - b.at).at(-1)?.key ?? null;
    pending = !!key;
  }
  if (!key) return null;
  if (!battle) {
    const block = battleBlock({ chat, survey }, key);
    battle = block ? parseBattle(block.body).spec : null;
  }
  if (!battle) return null;
  const mon = battle.team?.[0];
  return { wild: !!battle.wild, opponent: battle.name || battle.trainerClass || '', species: mon?.species, level: mon?.level, turn, pending };
}

const naming = () => ({ korean: settings.koNames, en: dexName });
const varsOf = (state, where) => varTexts(state, { sim, battle: battleForVars(where), ...naming() });

const writeStoryVars = (into, state, where) => [writeVars(into, varsOf(state, where)), writeTrainerLore(into, trainerLore(state, naming()))].some(Boolean);

const varsKey = where => JSON.stringify([where.id, where.text ?? textKey(where.chat), stateVars().map(name => where.chat?.scriptstate?.[name] ?? null),
  battleForVars(where), naming()]);

async function setVars(where) {
  const { state, table, changed } = acts.pendingState(where.chat, await storyCtx());
  if (changed) writeTable(where.chat, table);
  return writeStoryVars(where.chat, state, where) || changed;
}

const SETTLE_MS = 900;

const SEEN_CHATS = 4;
const observed = new Map();

function observe(id, chat, { ours = false } = {}) {
  const messages = chat?.message ?? [];
  const before = observed.get(id);
  const last = messages.length - 1;
  const same = !!before && (last < 0 || before.texts.get(messageId(messages[last], last)) === messages[last].data);
  const streaming = !!chat?.isStreaming;
  const changedAt = ours ? before?.changedAt ?? 0 : same && !streaming ? before.changedAt : Date.now();
  observed.delete(id);
  observed.set(id, { texts: new Map(messages.map((m, i) => [messageId(m, i), m.data])), changedAt, streaming });
  if (observed.size > SEEN_CHATS) observed.delete(observed.keys().next().value);
}

// How long until the chat counts as quiet, in ms (0 = quiet now) - from the last read's record only
function quietIn(id) {
  const seen = observed.get(id);
  if (!seen || seen.streaming) return SETTLE_MS;
  return Math.max(0, SETTLE_MS - (Date.now() - seen.changedAt));
}

function followMoves(pass) {
  const key = battleIn(pass).key;
  if (!key && !hasFollowMarks(pass.chat)) return false;
  return setFollow({ message: (pass.chat.message ?? []).map(m => ({ ...m })) }, key).length > 0;
}

async function pendingFixes(pass) {
  if (!isOn(pass)) return { lore: !loreInLine(pass.chat, false) };
  if (pass.unreadable) return {};
  const lore = !loreInLine(pass.chat, true);
  const { state, changed: fills } = await pass.computed();
  const key = varsKey(pass);
  const differ = varsAt !== key && writeStoryVars({ scriptstate: { ...pass.chat.scriptstate }, localLore: pass.chat.localLore }, state, pass);
  if (!differ) varsAt = key;
  const ends = storyEndFixes(pass.chat, pass.table, pass.survey, { canPlay });
  return { lore, vars: differ || fills, follow: followMoves(pass),
    settle: acts.settleQueue({ message: pass.chat.message, scriptstate: { ...pass.chat.scriptstate } }),
    lost: lostResult(pass.chat, pass.last, pass.table) >= 0, ends: ends.drop.length + ends.add.length > 0 };
}

function playedAt(snapshot, ctx) {
  try {
    const result = snapshotResult(sim, snapshot, { levelUp: ctx.levelUp, exp: ctx.exp });
    return { result, start: snapshot.spec.p1.team.map(({ uid, set, exp }) => ({ uid, set, exp })) };
  } catch (error) {
    if (!error?.unresumable) throw error;
    console.warn('[poke-battle] 이야기로 끝난 배틀의 자동 저장을 다시 넣지 못함', error);
    unplayable.add(snapshotKey(snapshot));
    return null;
  }
}

const unplayable = new Set();
const snapshotKey = snapshot => hashKey(JSON.stringify(snapshot));

const canPlay = snapshot => !unplayable.has(snapshotKey(snapshot));

function storyEndFailed(pass, key) {
  const info = pass.survey.battles.get(key);
  const auto = info?.committed === 'story' && info.ended.attempt && pass.save?.attempt?.blockKey === key ? pass.save.attempt.auto : null;
  return !!auto && !canPlay(auto);
}

const MESSAGE_FIXES = ['follow', 'lost', 'ends'];
const needsWrite = (fixes, { messages = true } = {}) => Object.entries(fixes).some(([name, on]) => on && (messages || !MESSAGE_FIXES.includes(name)));

function writeFixes(pass, fixes, { messages = true, attach = null } = {}) {
  return whenQuiet(pass.target, async found => {
    if (!found) return {};
    let attached;
    const ctx = messages && fixes.ends ? await storyCtx() : null;
    const wrote = await writeRecords(found, chat => {
      attached = attach?.(chat);
      if (fixes.lore) setLore(chat, true);
      if (messages) {
        if (fixes.lost) restoreResult(chat);
        if (fixes.ends) {

          const table = readTable(chat), save = readSave(chat);
          const { added } = acts.pendingState(chat, ctx);
          if (recordStoryEnds(chat, table, key => startSpec(save, key)?.p2?.team ?? null, snapshot => playedAt(snapshot, ctx), { canPlay, held: added })) writeTable(chat, table);
        }
        setFollow(chat, battleIn({ id: pass.id, chat }).key);
      }
    }, { vars: !!(fixes.vars || fixes.lore || (messages && (fixes.lost || fixes.ends))) });
    if (wrote === HELD) await clearDerived(found);
    return { attached };
  });
}

async function catchUp(pass) {
  const wait = quietIn(pass.id);
  if (wait) return watchLater(wait);
  const fixes = await pendingFixes(pass);
  if (needsWrite(fixes)) await writeFixes(pass, fixes);
}

function sendPiece(chat, key, what) {
  const { source, at } = what(chat);
  const point = sentPoint(chat, key, { ended: at.ended });
  const range = sendRange({ sent: point, log: source.log ?? [], to: at.to, ended: at.ended });
  if (!range) return null;
  const { text, info } = buildOoc(settings.sendFormat, { ...source, vs: battleTitle(source.battle, { level: false }) }, range,
    { screenFrom: range.first ? 0 : point.screenEnd, screenTo: at.screenEnd, korean: settings.koNames, en: dexName });
  const upto = at.ended ? at.endTurn ?? 0 : turnSpan(range.read)?.toTurn ?? Math.max(point.upto, 0);
  return { text, info, send: { upto, logFrom: range.from, logEnd: range.to, screenEnd: at.screenEnd, ended: at.ended, snapshot: at.snapshot ?? null } };
}

async function sendOnce(target, what, { onWait } = {}) {
  const ctx = await storyCtx();
  let mark = null;
  const sent = await writeChat(target, (chat, found) => {
    const piece = sendPiece(chat, target.key, what);
    if (!piece) return false;

    const salt = `${Date.now()}:${Math.random()}`;
    acts.adoptQueue(chat, ctx, { salt });
    const tag = acts.attachQueue(chat, ctx, { salt });
    const placed = insertOoc(chat, { text: piece.text, info: piece.info, tail: tag ? acts.tagText(tag) : '' });
    mark = placed.mark;

    addSend(chat, target.key, { chatId: placed.chatId, mark, ...piece.send });

    if (!piece.send.ended && battleIn({ id: idOf(found.target), chat }).key === target.key) setFollow(chat, target.key);
    return true;
  }, { vars: true, missing: true, onWait: settings.autoSend && onWait ? waiting => tellWait(onWait, waiting) : undefined });
  if (sent !== true) return { sent: false };
  if (!settings.autoSend) return { sent: true };
  const note = await sendChatOn(target, mark);
  if (!note) return { sent: true };
  notices.set(target.key, { id: idOf(target), note });
  return { sent: true, note };
}

async function sendChatOn(target, mark) {
  const pass = await readPass();
  const last = pass?.chat.message?.at(-1);
  if (pass?.id !== idOf(target)) return failureNote(WHAT.sendOn, 'chatMoved');
  if (!findOocs(String(last?.data ?? '')).some(ooc => ooc.info.mark === mark)) return failureNote(WHAT.sendOn, 'oocMoved');
  awaited.set(mark, pass.id);
  const note = await risuai.sendChat('').then(sent => (sent === false ? failureNote(WHAT.sendOn, 'denied') : undefined), error => {
    console.warn('[poke-battle] 채팅을 보내지 못함', error);
    return failureNote(WHAT.sendOn, error);
  });
  if (note) awaited.delete(mark);
  return note;
}

const awaited = new Map();

function seeReply(pass) {
  for (const [mark, id] of awaited) {
    if (id !== pass.id) continue;
    const reply = replyTo(pass.chat.message ?? [], mark);
    if (reply === 'waiting' || (reply === 'reply' && quietIn(pass.id))) continue;
    awaited.delete(mark);
    if (reply === 'reply' && active && !active.collapsed) active.app.storyDot(true);
  }
}

function liveOrigin(where) {
  const now = battleIn(where);
  return now.key && now.phase !== 'parked' ? active.origin : null;
}

function liveWhat(origin) {
  const live = active?.origin === origin ? active : null;
  const progress = live?.app.progress();
  if (!progress?.log) return null;
  const screen = live.app.screen();
  const shown = Number.isInteger(progress.shown) ? progress.shown : progress.log.length;
  const snapshot = live.app.snapshot();
  return () => ({ source: { battle: origin.battle, result: null, log: progress.log, screen: screen.lines },
    at: { to: shown, ended: false, screenEnd: screen.lines.length, snapshot } });
}

const tellWait = (onWait, waiting) => Promise.resolve().then(() => onWait(waiting ? SEND_WAIT : null))
  .catch(error => console.warn('[poke-battle] 기다림 안내를 보이지 못함', error));

async function sendLive(origin, options) {
  const what = liveWhat(origin);
  return what ? sendOnce(origin, what, options) : { sent: false };
}

function sendCommitted(target, options) {
  return sendOnce(target, chat => {
    const last = readLast(chat);
    const info = surveyBattles(chat, readTable(chat)).battles.get(target.key);
    if (!last || last.blockKey !== target.key || info?.committed !== 'done' || info.result.tag !== last.tag) throw failed('noRecord');
    const screen = last.result.screen ?? [], log = last.result.log ?? [];
    return { source: { battle: last.battle, result: last.result, log, screen },
      at: { to: log.length, ended: true, endTurn: last.result.turn ?? 0, screenEnd: screen.length, snapshot: null } };
  }, options);
}

function sendFromCard(pass, key, options) {
  const live = liveOrigin(pass);
  if (live?.key === key) return sendLive(live, options);
  if (battleIn(pass).card(key) === 'done') return sendCommitted({ ...pass.target, key }, options);

  throw failed('notOpened');
}

async function cardSend(press, pass) {

  const onWait = note => {
    if (note) notices.set(press.key, { id: pass.id, note }); else notices.delete(press.key);
    return readPass().then(now => drawNotice(press, now));
  };
  const { sent } = await sendFromCard(pass, press.key, { onWait });

  if (sent) await domSettled();
  const button = doc && await doc.querySelector(`.x-risu-pkbk-${press.key}.x-risu-pkba-send`);
  const cls = sent ? 'x-risu-pkb-fly' : 'x-risu-pkb-shake';
  if (button) await button.addClass(cls).catch(() => {});

  await new Promise(resolve => setTimeout(resolve, sent ? SEND_MS.okDelay + SEND_MS.ok : SEND_MS.shake));
  if (button) await button.removeClass(cls).catch(() => {});
  if (sent) await refreshCard(press).catch(() => {});
}

async function autosave(origin, snapshot) {
  if (origin.phase !== 'running') return undefined;
  origin.autoLatest = snapshot;
  const live = active?.origin === origin ? active : null;
  const balls = live ? progressBalls(live.app.progress()) : undefined;
  if (live && balls) live.progress = balls;
  return writeChat(origin, chat => origin.autoLatest === snapshot && origin.phase === 'running'
    && setAuto(chat, origin.key, snapshot, balls ?? live?.progress ?? null), { vars: true });
}

export async function queueAction(action, target = null) {
  let to = target;
  if (!to) {
    const pass = await actionPass();
    if (!pass) return null;
    to = pass.target;
  }
  const ctx = await storyCtx();
  const queued = await writeChat(to, (chat, found) => {
    if (!LOCK_FREE.has(action?.type) && battleIn({ id: idOf(found.target), chat }).key) throw failed('inBattle');
    try { return acts.queueAction(chat, ctx, action, { salt: String(Math.random()) }); } catch (error) { throw refused(error.message); }
  }, { vars: true, missing: true });
  return queued === HELD ? null : queued || null;
}

export async function pendingParty() {
  const pass = await readPass();
  if (!isOn(pass)) return null;
  const { state, errors } = acts.pendingState(pass.chat, await storyCtx());
  return { state, errors, actions: acts.readQueue(pass.chat).actions };
}

export async function resumeHere() {
  const pass = await readPass();
  if (!isOn(pass)) return;
  const { key } = battleIn(pass);
  if (!key) return;
  const press = { key, action: 'resume', index: findBlockMessage(pass.chat, key) };
  await onButton(press).catch(error => onButtonError(press, error));
}

async function onInput(text) {
  if (typeof text !== 'string') return undefined;
  try {
    const pass = await readPass(null, { fresh: true });
    await compatForInput(pass);
    if (!pass) return undefined;
    const fixes = await pendingFixes(pass);

    if (!isOn(pass) || pass.unreadable) {
      if (needsWrite(fixes)) await writeFixes(pass, fixes);
      return undefined;
    }
    if (!liveOrigin(pass) && !acts.readQueue(pass.chat).actions.length && !needsWrite(fixes, { messages: false })) return undefined;
    const ctx = await storyCtx();
    const { attached } = await writeFixes(pass, fixes, { messages: false, attach: chat => {
      const origin = liveOrigin({ id: pass.id, chat });
      const what = origin && liveWhat(origin);
      const piece = what && sendPiece(chat, origin.key, what);
      const ooc = piece && markOoc(piece.text, piece.info);
      if (ooc) addSend(chat, origin.key, { mark: ooc.mark, ...piece.send });
      return { ooc: ooc?.wrapped ?? null, tag: acts.attachQueue(chat, ctx, { salt: `${Date.now()}:${Math.random()}` }) };
    } });
    if (!attached?.ooc && !attached?.tag) return undefined;
    const mine = text.replace(/\s+$/, '');
    return `${attached.ooc ? oocAhead(attached.ooc, mine) : mine}${attached.tag ? `\n${acts.tagText(attached.tag)}` : ''}`;
  } catch (error) {
    console.warn('[poke-battle] 보낼 글에 붙일 것을 붙이지 못함', error);
    return undefined;
  }
}

const DEX = { species: 'species', items: 'items', moves: 'moves', abilities: 'abilities' };
const dexName = (kind, id) => { const found = DEX[kind] ? sim.Dex[DEX[kind]].get(id) : null; return found?.exists ? found.name : null; };

async function onPrompt(text) {
  if (typeof text !== 'string') return undefined;
  const pass = await sharedPass(text);
  if (!isOn(pass)) return undefined;

  if (!text.includes('<pkb') && !acts.readQueue(pass.chat).actions.length) return undefined;
  return acts.promptText(text, pass.chat, pass.table, { names: dexName, korean: settings.koNames });
}

let settingsApp;
let settingsSaves = Promise.resolve();

export function saveSettingsInOrder(next) {
  const save = () => saveSettings(risuai.pluginStorage, next);
  return settingsSaves = settingsSaves.then(save, save);
}

export function changeSettings(next) {
  const switched = botsSwitched(settings, next);
  settings = next;
  changed();
  if (switched.length) watchSoon();
  return Promise.all(switched.map(s => reconcileBot(s.name, s.on)));
}

function keepSettings(next) {
  changeSettings(next).catch(console.error);
  return isUnreadable(settingsStatus) ? undefined : saveSettingsInOrder(next);
}
export async function openSettings() {
  if (settingsApp) return;
  settingsApp = true;
  const owner = {};

  const preparing = mountPreparing();
  let pass, bot = null, persona, picture = null;
  try {
    await showWindow(owner, { full: true });

    ({ settings, status: settingsStatus } = await loadSettings(risuai.pluginStorage));
    ({ name: persona } = await personaLook());
    if (persona) picture = await loadPicture(risuai.pluginStorage, persona);
    pass = await readPass();
    if (pass) bot = { name: (await characterAt(pass.charIndex, pass.chat, { fresh: true }))?.name ?? '', compat: compatStatus.get(pass.target?.chaId) ?? '' };
  } catch (error) { settingsApp = undefined; throw error; }
  finally { preparing.remove(); }
  const unreadable = isUnreadable(settingsStatus);
  settingsApp = mountSettings({ settings, bot, persona, notice: unreadable ? SETTINGS_UNREADABLE : '', picture,
    onPicture: next => savePicture(risuai.pluginStorage, persona, next),
    onPermission: askPermission,
    onChange: keepSettings,
    onClose: async () => { settingsApp = undefined; await hideWindow(owner); } });
}

const DOM_QUIET_MS = 120;
let watchTimer = null, watching = false, watchAgain = false;
function watchSoon() {
  if (watching) { watchAgain = true; return; }
  watchTimer ??= setTimeout(watchNow, DOM_QUIET_MS);
}

function watchLater(ms = SETTLE_MS) {
  clearTimeout(watchTimer);
  watchTimer = setTimeout(watchNow, ms);
}
async function watchNow() {
  clearTimeout(watchTimer); watchTimer = null;
  if (watching) { watchAgain = true; return; }
  watching = true;
  try {
    settle();
    const reading = readPass();
    changed();
    const pass = await reading;
    await fitActive();
    if (!pass) return;
    checkCompat(pass);
    if (!isOn(pass)) return await catchUp(pass);
    seeReply(pass);
    await bindButtons();
    await checkActive(pass);
    await catchUp(pass);
    await refreshDrawn(pass);
    await refreshForge(pass);
  } catch (error) { console.error(error); }
  finally {
    watching = false;
    if (watchAgain) { watchAgain = false; watchSoon(); }
  }
}

export async function startStoryLink() {
  ({ settings, status: settingsStatus } = await loadSettings(risuai.pluginStorage));
  await risuai.addRisuScriptHandler('display', onDisplay);
  await risuai.addRisuScriptHandler('process', onPrompt);
  await risuai.addRisuScriptHandler('input', onInput);

  if (globalThis.pokeBattleDebug) Object.assign(globalThis.pokeBattleDebug, { queueAction, pendingParty });
  doc = await risuai.getRootDocument();
  if (doc) {
    try { await installSheet(); } catch (error) { console.warn('[poke-battle] 카드 CSS 를 넣지 못함 — 메시지마다 넣는다', error); }
    const app = await doc.getElementById('app');
    const observer = await risuai.createMutationObserver(watchSoon);
    if (app) await observer.observe(app, { childList: true, subtree: true });
  }

  await watchNow();
}
