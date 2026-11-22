import * as sim from '../../engine/browser-engine.mjs';
import { findBlocks, findTags, findMarks, markText, parseBattle, parseAct, actBlock, actsIn, hashKey, messageId, battlesIn, battlesInText, blockAnchorIn, stripForPrompt, blockCuts, hasBlocks } from '../../story/blocks.mjs';
import { readTable, writeTable, tableStatus, createFolds, applyBattles, toEngineSpec, pruneTable, stateVars, computeState, nextStageSpec, battlesBefore, stageOf, backToBack, battleRecord, hatchedParty, toolsIn, ownsExpShare } from '../../story/state.mjs';
import { unreadableLine, isUnreadable } from '../../story/stored.mjs';
import { withLocksOf } from '../../engine/input.mjs';
import { withItemTags } from '../../story/custom-items.mjs';
import { WHAT, failed, refused, ruleError, failureNote, failureText, ruleText } from '../../story/failure.mjs';
import { LOCK_FREE, namesFor, heldUids, arrivalBase } from '../../story/panel.mjs';
import { spriteIdOf, displayName } from '../../engine/mon.mjs';
import { personaName, userName } from './persona.js'; // my name (engine p1, original trainer)
import { renderBattleCard, renderCardTail, renderCollapsed, renderDiscarded, wrapRecent, renderStoryChip, battleTitle, blockBalls, SEND_MS } from '../../story/card.mjs';
import { MARK, surveyBattles, battlePhase, cardResult, setMark, setFollow, setOpenedAt, hasFollowMarks, findBlockMessage, removeResult, placeResult, resultPlace,
  lostResult, restoreResult, takeBackResult, putBackResult, undoable, storyEndFixes, recordStoryEnds, readLast, writeLast, findOocs, unwrapOocs, readBattleAt,
  rekeyBattles, currentKey, battleMoves } from '../../story/chat.mjs';
import { chainFrom, nextUnplanned, rewindOf, addPlan, rewindPlans, tellPlans, untold, answersCommands, readActAt } from '../../story/commands.mjs';
import { failedLines, failedOoc, auxRequest, battleStatusLines, battleGimmicks } from '../../story/act-prompts.mjs';
import { createNamer, battleKind } from '../../story/ai-names.mjs';
import * as acts from '../../story/acts.mjs';
import { renderDiary, resultEvents, renderForge, forgeKindOf, commandLines } from '../../story/diary.mjs';
import { forgeKey, forgeAt, mayForge, forgeRequest, runForge, appendBattle, FORGE_MODE, withUserName } from '../../story/forge.mjs';
import { fishCast as castNow, appendCast } from '../../story/fishing.mjs';
import { drawingJobs } from '../../story/asset-maid.mjs'; // Asset Maid drawing in a chat (only read - drawHold)
import { resultMark, resultTakenBack, chatMovedOn, markNow } from '../../story/result-guard.mjs'; // a result taken back by Asset Maid's late write (guardResult)
import { showToast } from './toast.js'; // a failure of the forge button shows only for a moment
import { turnSpan } from '../../story/narrate.mjs';
import { resultLine, prizeItem, RESULT_LINE_RE } from '../../story/prompts.mjs';
import { outcomeOf } from '../../story/outcome.mjs';
import { SAVE_VAR, readSave, saveStatus, freshAttempt, retryAttempt, startSpec, setAuto, leaveAttempt, commitAttempt, addSend, sentPoint, sentAll, holdsAuto, partFor } from '../../story/save.mjs';
import { sendRange, buildOoc, insertOoc, markOoc, oocAhead, replyTo, sendWait, ownStarts } from '../../story/send.mjs';
import { withGuide } from '../../story/guide.mjs';
import { setLore, loreInLine, varTexts, writeVars, trainerLore, writeTrainerLore, loreRuleOf } from '../../story/lore.mjs';
import { fixPrompt, mayHold, holds, varsIn, sameVars } from '../../story/prompt-fix.mjs'; // the prompt right before it is sent (fixRequest)
import { applyCompat, compatLang, bagMoney, dropTaken, statusIn, battleScene, latestStatus, compatTravelVars, earlierRegion } from '../../story/compat.mjs';
import { victoryChoices } from '../../story/settlement.mjs';
import { rerollSnapshot, restartSpec, snapshotResult } from '../../director/index.js';
import { waitingTrainer } from '../../engine/core.mjs';
import { ruleFormat } from '../../engine/rules.mjs';
import { loadLevelUp, EXP_TABLE } from './level-tables.js';
import { createFetchBytes } from './fetch-bytes.js';
import { viewPictureWays } from './picture-route.js'; // the picture route the battle view takes (pictureWays option)
import { createReplyWatch } from './reply-watch.js';
import { showFrame, frameHidden } from './stage.js'; // window placement = the chat column
import { deviceStore, DEVICE_SETTINGS, deviceValue, withDevice, sharedPart, deviceSettings, deviceShift } from './device-store.js'; // this device's panel choices (public PR #7)
import { panelLift } from '../../story/panel-html.mjs'; // the widest a dragged panel may go
import { DEFAULT_SETTINGS, DEFAULT_LOOK, settingsUnreadable, LANG_OPEN, hostLang, loadSettings, saveSettings, normalizeSettings, SEND_FORMATS, PANEL_OPEN_CHOICES, mountSettings, mountPreparing, botEnabled, botKey, botsSwitched, lookOf, chosenGender, adoptOldLook, commandsOn, auxOn, IMPORT_NAMES_SHOWN, volumeFeed } from './settings.js';
import { mountImportScreen } from './import-screen.js';
import { makeDraft, importOffer, importOfferAi, importTurn, handBack, commitImport, commitDebugHeal, commitDebugBadges, readImports, cancelImport, inForce, newMonDraft, currentMonDraft, friendshipLockDraft } from '../../story/import.mjs';
import { importAiMessages, readAiParty, aiFailedFound } from '../../story/import-ai.mjs';
import { readSettingChanges, recordSettingChange, settingsBehind, rulesAt } from '../../story/setting-changes.mjs';
import { worldBehind, recordWorldChange } from '../../story/compat-world.mjs';
import { readBattleRule, recordBattleRule, battleRuleNow, chatNowCtx, chatSettings, numbersRule, newChatStart, recordNewChatStart, optionsBehind, recordOptions } from '../../story/battle-rule.mjs';
import { readBattlesOff, battlesOff, setBattlesOff } from '../../story/battles-off.mjs';
import { loadPicture, savePicture, adoptOldPicture, entryMe } from './my-picture.js';
import { voicePackStore } from './voice-pack-store.js'; // the player's voice packs - this device's store (public PR #12)
import { storyCss, sheetCss, SHEET_CLASS } from '../../story/style.mjs';
import { cardBounds } from '../../story/named.mjs';
import { opponentPictureWithGender, foePartnerPicture, partnerPicture } from '../../story/trainer-look.mjs'; // card face - the same picture choice as the battle screen
import { DEFAULT_ASSET_BASE } from '../../view/assets.js';
import { parseRecolorKey, recoloredFace } from '../../view/sprites/recolor.js'; // card faces in the opponent's hair and outfit colours
import { battleNamesIn } from './names.js';
import { say } from '../../story/screen-text.mjs';
import { createShopCards, SHOP_ACTIONS } from './shop-card.js'; // shop cards (<pkb-shop> blocks) and their buttons
import { shopsInText } from '../../story/shop.mjs';

const SPRITE = id => `https://play.pokemonshowdown.com/sprites/gen5/${id}.png`;
const TRAINER = id => `https://play.pokemonshowdown.com/sprites/trainers/${id}.png`;

let ctxPromise;

export const battleFormat = async () => {
  const pass = await sharedPass();
  return ruleFormat(pass?.chat && isOn(pass) && !pass.unreadable ? numbersRule(battleRuleNow(pass.chat, settings).value) : settings.rule);
};
const storyCtx = () => ctxPromise ??= loadLevelUp().then(levelUp => (ctxNow = { sim, levelUp, exp: EXP_TABLE, folds: createFolds(), get friendshipRate() { return settings.friendshipRate; }, get hatchRate() { return settings.hatchRate; }, get tradeEvolution() { return settings.tradeEvolution; }, get rule() { return settings.rule; }, get learnMoves() { return settings.learnMoves; } }))
  .catch(error => { ctxPromise = undefined; throw error; });
let ctxNow = null;

let settings = { ...DEFAULT_SETTINGS };

let settingsStatus = 'none';
export const currentSettings = () => settings;

export const soundFeed = volumeFeed(currentSettings);

export const voicePacks = voicePackStore({ open: () => risuai.getLocalPluginStorage() });

export const currentLang = chat => (LANG_OPEN ? settings.lang ?? compatLang(chat) ?? hostLang() : 'ko');
/** The language now in the chat open now (for places that have no chat read) */
export const openLang = async () => currentLang((await sharedPass())?.chat);

const battleLang = (origin, chat) => origin.lang ?? currentLang(chat);

const screenNames = lang => battleNamesIn(lang, sim.Dex);

const characters = new Map(); // index:chat id -> chaId
const botNames = new Map(); // chaId -> name
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

/** Marks to find the chat again (locate below) */
const targetOf = (charIndex, chatIndex, chat, character) => ({ chaId: character?.chaId ?? null, chatId: chat?.id ?? null, charIndex, chatIndex });
/** Name of one chat - by position for a chat that had no chat id */
const idOf = target => `${target.chaId}:${target.chatId ?? `#${target.charIndex}:${target.chatIndex}`}`;

const textKey = chat => JSON.stringify((chat?.message ?? []).map(m => [m?.chatId ?? null, String(m?.data ?? '')]));

const unreadableChat = chat => [tableStatus(chat), saveStatus(chat), acts.queueStatus(chat), readImports(chat).status, readSettingChanges(chat).status, readBattlesOff(chat).status,
  readBattleRule(chat).status].some(isUnreadable);

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

    get readAt() { return memo('readAt', () => rulesAt(chat)); },
    get unreadable() { return memo('unreadable', () => unreadableChat(chat)); },

    get moved() { return memo('moved', () => importTurn(chat).moved); },
    /** Text -> message index (the bottom one when several have the same text) */
    get texts() { return memo('texts', () => new Map((chat.message ?? []).map((m, i) => [String(m?.data ?? ''), i]))); },

    has(text) { return this.texts.has(text); },

    at(text) { return this.texts.get(text) ?? (chat.message ?? []).length - 1; },

    grows(text) { const bottom = String(chat.message?.at(-1)?.data ?? ''); return text.startsWith(bottom) && (bottom !== '' || quietIn(this.id) > 0); },

    get key() {
      return memo('key', () => JSON.stringify([this.id, this.text,
        Object.entries(chat.scriptstate ?? {}).filter(([k]) => k.startsWith('$pkb_') || stateVars().includes(k)).sort(([a], [b]) => (a < b ? -1 : 1))]));
    },

    computed() { return memo('computed', () => storyCtx().then(ctx => acts.pendingState(chat, ctx, { survey: this.survey }))); },
    async state() { return (await this.computed()).state; },

    before() {
      return memo('before', () => {
        const at = arrivalBase(chat);
        return at === null ? Promise.resolve(null) : storyCtx().then(ctx => heldUids(computeState(chat, ctx, { uptoIndex: at, survey: this.survey }).state));
      });
    },
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
/** Reads the chat open now afresh. fresh: the bot name too (characterAt) */
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
/** Listens for change notices. Returns: stop listening */
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
  return { id: pass.id, target: pass.target, on, chat: pass.chat, key: pass.key, lang: currentLang(pass.chat), unreadable: on && pass.unreadable, compat: on && compatBots.has(pass.target?.chaId),
    state: on ? await pass.state() : null, before: on ? await pass.before() : null, ctx: on ? { ...chatNowCtx(pass.chat, await storyCtx()), status: latestStatus(pass.chat) } : null, battle: on ? (({ key, phase }) => ({ key, phase }))(battleIn(pass)) : null,
    debug: on && settings.debug, aux: on ? auxSwitch(pass) : null, offer: on ? await offerOf(pass) : null };
}

let auxFor = null;

function auxSwitch(where) {
  const { key } = battleIn(where);
  if (!auxOn(settings) || !key) return null;
  return { on: auxFor?.id === where.id && auxFor.key === key };
}
/** Whether my chat in this chat goes through the aux model now */
const auxActive = where => !!auxSwitch(where)?.on;

export async function toggleAux() {
  const pass = await readPass();
  if (!isOn(pass) || !auxSwitch(pass)) return null;
  const on = !auxActive(pass);
  auxFor = on ? { id: pass.id, key: battleIn(pass).key } : null;
  changed();
  return { on };
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
  if (at === windows.length) await syncWindow(); // it was on top - the screen below (or hide the window)
}

const permits = new Map();

export async function askPermission(name, ask = () => risuai.requestPluginPermission(name)) {
  if (permits.has(name)) return permits.get(name);
  let lowered = false;
  const run = windowLine.then(async () => {
    if (permits.has(name)) return permits.get(name); // answered while this ask waited in line
    lowered = true;
    await risuai.hideContainer();
    frameHidden();
    const granted = (await ask()) === true;
    permits.set(name, granted);
    return granted;
  });
  windowLine = run.catch(() => {});
  try { return await run; } catch (error) {
    console.warn('[poke-battle] 권한을 묻지 못함', error);
    return false;
  } finally { if (lowered) await syncWindow(); }
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

/** New battle seed (Showdown Gen5 seed: four 16-bit numbers) */
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

function faces(spec, key, chat) {
  const options = pictureOptions(key, chat);
  return { ...trainerFace(opponentPictureWithGender(spec, options)),
    ...(spec?.foePartner ? { foePartner: trainerFace(foePartnerPicture(spec, options)) } : {}),
    ...(spec?.partner ? { partner: trainerFace(partnerPicture(spec)) } : {}),
    speciesUrl: species => SPRITE(spriteIdOf(sim.Dex.species.get(species))) };
}
const trainerFace = ({ sprite, face, sheet, silhouette, gender }) => ({ trainerUrl: face ? colorFace(sprite, face) : undefined,
  trainerRect: face ? cardBounds(face) : null, trainerGender: gender ?? null,
  trainerSheet: sheet ? { url: `${DEFAULT_ASSET_BASE}images/trainer/${sheet.key}.png`, rect: sheet.rect } : undefined,
  trainerSilhouette: silhouette });

const readyFaces = new Map(), waitingFaces = new Map();
let faceFetch = null;
function colorFace(sprite, face) {
  if (!parseRecolorKey(sprite).combo) return TRAINER(face);
  if (readyFaces.has(sprite)) return readyFaces.get(sprite) ?? TRAINER(face);
  if (!waitingFaces.has(sprite)) {
    faceFetch ??= createFetchBytes(risuai);
    waitingFaces.set(sprite, recoloredFace(sprite, () => faceFetch(TRAINER(face))).then(url => { readyFaces.set(sprite, url); waitingFaces.delete(sprite); }));
  }
  return TRAINER(face);
}
const FACE_WAIT_MS = 2500;

async function facesWaited() {
  if (!waitingFaces.size) return false;
  await Promise.race([Promise.all(waitingFaces.values()), new Promise(resolve => setTimeout(resolve, FACE_WAIT_MS))]);
  return true;
}

const pictureOptions = (key, chat) => ({ key, silhouette: settings.silhouette, chat, player: playerGender });

let playerGender = DEFAULT_LOOK.gender;

const playerOptions = look => ({ gender: look.gender, silhouette: look.myBack === 'silhouette' });

async function settlementGender() {
  const { name } = await personaLook();
  return chosenGender(settings, name)?.toUpperCase() ?? null;
}

async function personaLook() {
  const name = await personaName(risuai);
  if (name && settings.oldLook) {
    settings = adoptOldLook(settings, name);
    await Promise.all([adoptOldPicture(risuai.pluginStorage, name), saveSettingsInOrder(settings)]);
  }
  const look = lookOf(settings, name);
  playerGender = look.gender;
  return { name, look };
}

const ballOf = mon => (mon.fainted || mon.hp === 0 ? 'fainted' : mon.status && mon.status !== 'fnt' ? 'status' : 'ok');
const ballsOf = team => (team ?? []).map(ballOf);
const teamOf = (result, id) => result.sides.find(s => s.id === id)?.team;

function progressBalls(progress, origin) {
  const result = progress?.result ?? progress;
  if (!Array.isArray(result?.sides)) return undefined;
  const foes = [...battlesBefore(origin.stage).map(b => ballsOf(teamOf(b.result, 'p2'))), ballsOf(teamOf(result, 'p2')),
    ...(result.foePartner ? [ballsOf(result.foePartner)] : waitingTrainer(origin.stage) ? [blockBalls(origin.battle).foePartner] : [])];
  return { mine: ballsOf(teamOf(result, 'p1')), theirs: foes[0], ...(foes[1] ? { foePartner: foes[1] } : {}) };
}

function cardView(pass, key, body) {
  const lang = currentLang(pass?.chat);
  const info = pass?.survey.battles.get(key);
  const { spec, errors: notes } = info ? readBattleAt(pass.chat, info.index, body) : parseBattle(body); // read as its message reads (one not in the read: written now)
  const errors = notes.map(note => ruleText(note, lang));

  const save = pass ? pass.save : null;
  const battle = pass ? battleIn(pass) : battlePhase(null);
  const status = active?.key === key && active.origin.phase === 'starting' && pass?.id === idOf(active.origin)
    ? battlePhase(pass.survey, pass.save?.attempt ?? null).card(key) : battle.card(key);

  const shown = spec && { ...spec, place: battleScene(spec, info ? statusIn(pass.chat.message[info.index]) : null).place };

  return { lang, key, spec: shown ?? { wild: false, team: [], place: 'plains', time: null, boss: false }, errors: spec ? [] : errors,
    warnings: spec ? errors : [], latest: pass?.lastBattleKey === key, status, result: cardResult(info),

    leave: status === 'locked' && battle.phase === 'parked' && !settings.iron,
    progress: status === 'progress' ? (battle.phase === 'parked' ? save?.attempt?.balls ?? undefined : active.progress) : undefined, faces: faces(spec, key, pass?.chat ?? null), iron: settings.iron,

    sent: status === 'done' && !!pass && sentAll(pass.chat, key, info?.result?.turns ?? 0, save),

    canSend: !!pass && !pass.survey.off && pass.last?.blockKey === key, canRetry: !!pass && !pass.survey.off && !!startSpec(save, key),

    canUndo: !pass || mayUndo(pass, key),

    notice: noticeFor(pass, key) ?? (pass?.unreadable ? { text: unreadableLine(lang), kind: 'error' } : pass && storyEndFailed(pass, key) ? failureNote(WHAT.storyEnd, 'unresumable', lang) : undefined),
    buttonsOff: doc === null };
}

const SHOWN_RESULT_RE = new RegExp(String.raw`\s*${RESULT_LINE_RE.source}(?=\s*<pkb#[a-z0-9]+>)`, 'g');

const takenOut = (pass, text) => (pass.moved ? dropTaken(text) : text);

async function onDisplay(text) {
  if (typeof text !== 'string') return undefined;
  if (/<(?:div|details)\b[^>]*\bclass=["'][^"']*\bx-risu-pkb-log(?:row)?\b/.test(text)) return undefined;
  if (!text.includes('<pkb')) return plainDisplay(text);
  const marked = text.replace(SHOWN_RESULT_RE, '');
  if (!hasBlocks(marked) && !findTags(marked).length && !findMarks(marked).length && !findOocs(marked).length) return plainDisplay(text);
  const pass = await sharedPass(text);
  if (!isOn(pass)) return undefined; // Nothing is done in chats of a bot that is off
  const shown = takenOut(pass, marked);

  const at = pass.at(text), reading = pass.readAt(at);
  const found = findBlocks(shown, reading), tags = findTags(shown), marks = findMarks(shown), stories = findOocs(shown);
  const blocks = [...battlesInText(shown, messageId(pass.chat.message?.[at], at), reading), ...found.filter(b => b.kind !== 'battle' && b.kind !== 'shop')];
  changed();
  checkEnded(pass);

  const lang = currentLang(pass.chat);
  const chip = stories.length ? renderStoryChip(stories.map(s => ({ ...s.info, vs: chipOpponent(pass, s.info, lang) })), lang) : '';

  const cuts = blockCuts(shown, reading), cutAt = new Map(cuts.filter(c => c.block).map(c => [c.block.start, c]));
  const cut = piece => ({ ...piece, start: cutAt.get(piece.start)?.start ?? piece.start, end: cutAt.get(piece.start)?.end ?? piece.end });
  const pieces = [...blocks.map(b => cut({ ...b, what: 'block' })), ...tags.map(t => ({ ...t, what: 'tag' })), ...marks.map(m => ({ ...m, what: 'mark' })),

    ...stories.map((s, i) => ({ ...s, what: 'story', html: i ? '' : chip, end: s.end + /^\s*/.exec(shown.slice(s.end))[0].length })),
    ...shopsInText(shown, messageId(pass.chat.message?.[at], at), reading).map(s => cut({ ...s, what: 'shop' })),
    ...cuts.filter(c => !c.block).map(c => ({ ...c, what: 'loose' }))]
    .sort((a, b) => b.start - a.start);
  let out = shown, drew = false;
  for (const piece of pieces) {
    let html = '';
    if (piece.what === 'block' && piece.kind === 'battle') {
      let view = cardView(pass, piece.key, piece.body);
      if (await facesWaited()) view = cardView(pass, piece.key, piece.body); // a recoloured face just made (colorFace)
      const card = renderBattleCard(view, view.lang).trim();
      drawn.set(piece.key, { id: pass.id, html: drawnHtml(view) });

      if (view.status === 'progress' && text.includes(markText(MARK.moved, piece.key))) html = renderCollapsed(view, view.lang);
      else html = view.status === 'discarded' ? renderDiscarded(view, view.lang) : wrapRecent(card, renderCollapsed(view, view.lang));
    } else if (piece.what === 'mark' && piece.kind === MARK.here) {
      html = followedCard(pass, piece.key, blocks);
    } else if (piece.what === 'shop') {
      html = await shops.draw(pass, at, piece);
    } else if (piece.what === 'story') html = piece.html;
    drew ||= !!html;
    out = out.slice(0, piece.start) + html + out.slice(piece.end);
  }
  const log = await diaryHtml(text, pass, at);

  const choices = await victoryChoices({ chat: pass.chat, index: at, survey: pass.survey, myGender: settlementGender });
  return withSheet(out.replace(/\s+$/, '') + log + choices, drew || !!log);
}

async function plainDisplay(text) {
  const last = await sharedPass();
  const grows = !!last && !last.has(text) && last.grows(text);
  if (grows) observeGrow(last.id);
  const pass = last && !last.has(text) && !grows ? await sharedPass(text) : last;
  if (!isOn(pass)) return undefined;
  const lang = currentLang(pass.chat), at = pass.at(text);
  const events = await passingAt(pass, at); // eggs hatching, a new egg
  const html = renderDiary({ events, forge: forgeSlot(pass, at, text) }, lang, screenNames(lang));
  const shown = takenOut(pass, text);
  return html ? withSheet(shown.replace(/\s+$/, '') + html) : shown !== text ? shown : undefined;
}

const withSheet = (out, drew = true) => (sheetReady || !drew ? out : `${out.replace(/\s+$/, '')}\n\n<style>${storyCss({ scope: '' })}</style>\n\n`);

function chipOpponent(pass, info, lang) {
  if (!info.battle) return info.vs;
  const spec = blockSpec(pass, info.battle);
  return spec ? battleTitle(spec, lang, { level: false }) : '';
}

function battleBlock(where, key) {
  const info = where.survey.battles.get(key);
  return info ? battlesIn(where.chat.message[info.index], info.index, rulesAt(where.chat)(info.index)).find(b => b.key === key) ?? null : null;
}

function blockSpec(where, key) {
  const block = battleBlock(where, key);
  return block ? readBattleAt(where.chat, where.survey.battles.get(key).index, block.body).spec : null;
}

function followedCard(pass, key, blocksHere) {
  if (!pass || blocksHere.some(b => b.kind === 'battle' && b.key === key)) return '';
  const block = battleBlock(pass, key);
  if (!block) return '';
  const view = cardView(pass, key, block.body);
  return view.status === 'progress' ? renderBattleCard(view, view.lang) : '';
}

const passingAt = async (pass, at) => (Number.isInteger(at) && at >= 0 && pass?.chat ? acts.passingIn(pass.chat, await storyCtx(), at) : []);

async function diaryHtml(text, pass, at) {
  try {
    const own = acts.actsIn(text, pass?.table);
    const lang = currentLang(pass?.chat);
    const changes = hasBlocks(text) ? acts.changesIn(text, pass?.chat, await storyCtx(), lang) : null;
    const counts = t => { const meta = pass?.table?.meta?.[t.key]; return !meta?.blockKey || pass.survey.battles.get(meta.blockKey)?.committed !== 'discarded'; };
    const results = findTags(text).filter(counts).flatMap(t => resultEvents(pass?.table?.meta?.[t.key], pass?.table?.snaps?.[t.key]));

    const rows = new Map([...(pass?.save?.record?.plans ?? []), ...(pass?.save?.attempt?.plans ?? [])].map(row => [row.act, row]));
    const names = screenNames(lang);
    const commands = actsIn({ ...pass?.chat.message?.[at], data: text }, at, pass?.readAt(at)).map(block => {
      const { turns, errors } = readActAt(pass?.chat, at, block.body);
      return commandLines(turns, rows.get(block.key)?.turns ?? null, lang, names, answersCommands(pass?.chat, at) ? [] : errors); // a reply's blocks are not commands
    });
    const passing = await passingAt(pass, at); // eggs hatching, a new egg
    const log = { events: [...results, ...passing, ...(changes?.events ?? []), ...commands.flatMap(c => c.plain.map(line => ({ kind: 'line', text: line }))), ...(own?.events ?? [])],
      errors: [...(changes?.errors ?? []), ...commands.flatMap(c => c.errors), ...(own?.errors ?? [])] };
    return renderDiary({ ...log, forge: forgeSlot(pass, at, text) }, lang, names);
  } catch (error) {
    console.warn('[poke-battle] 메시지 로그를 만들지 못함', error);
    return '';
  }
}

let writes = Promise.resolve();
/** Runs work after every earlier write (our writes never overlap) */
function inLine(work) {
  const run = writes.then(work);
  writes = run.catch(() => {});
  return run;
}

let varsAt = null;

const HELD = Symbol('held');

const mayWrite = (found, { result = false } = {}) => isOn(found) || result;

function writeChat(target, change, { vars = false, missing = false, result = false, onWait, defer = false } = {}) {
  return whenQuiet(target, found => {
    if (!found) {
      if (missing) throw failed('chatGone');
      return undefined;
    }
    return writeRecords(found, change, { vars, result });
  }, { onWait, defer });
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
  // A write to a chat whose bot is off leaves its variables unknown
  const inLine = vars ? (on ? varsKey({ id, chat: found.chat }) : null) : varsAt === before ? varsKey({ id, chat: found.chat }) : varsAt;
  await land(found, inLine);
  return result;
}

async function clearDerived(found, { messages = true } = {}) {
  const lore = setLore(found.chat, false);
  const ctx = messages && handsBack(found.chat) ? await storyCtx() : null;
  const back = !!ctx && handBack(found.chat, computeState(found.chat, ctx).state, ctx, { lang: currentLang(found.chat) });
  if (lore || back) await land(found, null);
}

const handsBack = chat => importTurn(chat).moved && !unreadableChat(chat) && !isUnreadable(settingsStatus);

async function land(found, inLine) {
  if (found.recheck) await recheck(found);
  await risuai.setChatToIndex(found.charIndex, found.chatIndex, found.chat);
  observe(idOf(found.target), found.chat, { ours: true });
  varsAt = inLine;
  lastPass = Promise.resolve(makePass(found.charIndex, found.chatIndex, found.chat, found.character, ++readSeq));
  changed();
}

const AGAIN = Symbol('again');
const DRAWING = Symbol('drawing');

const targetQueues = new Map();

const urgentQueued = new Map();

function whenQuiet(target, work, { onWait, defer = false } = {}) {
  const key = target ? idOf(target) : null;
  let waiting = false;
  const wait = {
    start() { if (!waiting) { waiting = true; onWait?.(true); } },
    end() { if (waiting) { waiting = false; onWait?.(false); } },
  };
  if (target && quietIn(key)) wait.start();
  if (!defer) urgentQueued.set(key, (urgentQueued.get(key) ?? 0) + 1);
  const urgentDone = () => {
    if (defer) return;
    const left = urgentQueued.get(key) - 1;
    if (left > 0) urgentQueued.set(key, left); else urgentQueued.delete(key);
  };
  const hold = defer ? { since: Date.now(), key } : null;
  const run = (targetQueues.get(key) ?? Promise.resolve()).then(() => headWrite(target, work, wait, hold)).finally(() => { urgentDone(); wait.end(); });
  const tail = run.catch(() => {});
  targetQueues.set(key, tail);
  tail.then(() => { if (targetQueues.get(key) === tail) targetQueues.delete(key); });
  return run;
}

async function headWrite(target, work, wait, hold = null) {
  const find = target ? () => locate(target) : () => readPass();
  let drawing = 0, stale = 0;
  for (;;) {
    if (!target || quietIn(idOf(target))) await untilQuiet(find, wait.start);
    const outcome = await inLine(async () => {
      const found = await find();
      if (found && quietIn(idOf(found.target))) return AGAIN;
      drawing = hold && found && !urgentQueued.has(hold.key) ? drawHold(idOf(found.target), found.chat, hold.since) : 0;
      if (drawing) return DRAWING;
      if (target && found) Object.assign(found, { base: chatPrint(found.chat), recheck: stale < RECHECKS });
      wait.end();
      try {
        return await work(found);
      } catch (error) {
        if (error === STALE) return STALE;
        throw error;
      }
    });
    if (outcome === DRAWING) { await sleep(drawing); continue; }
    if (outcome === STALE) { stale++; continue; }
    if (outcome !== AGAIN) return outcome;
  }
}

const RECHECKS = 3;
const STALE = Symbol('stale');

const chatPrint = chat => ({ messages: (chat?.message ?? []).map(m => [m?.chatId ?? null, String(m?.data ?? '')]),
  rest: JSON.stringify([chat?.localLore ?? null, chat?.scriptstate ?? null]) });
const samePrint = (a, b) => a.rest === b.rest && a.messages.length === b.messages.length
  && a.messages.every(([id, text], i) => id === b.messages[i][0] && text === b.messages[i][1]);

async function recheck(found) {
  const now = await risuai.getChatFromIndex(found.charIndex, found.chatIndex).catch(() => null);
  const same = !!now && (now.id ?? null) === found.target.chatId;
  if (same && samePrint(chatPrint(now), found.base)) return;
  if (same) observe(idOf(found.target), now);
  throw STALE;
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
const compatStatus = new Map(); // chaId -> one line shown in the settings window
const compatBots = new Set();
const compatSeen = new Set();

const compatLine = work => whenQuiet(null, work).catch(error => console.warn('[poke-battle] 호환 봇 항목을 맞추지 못함', error));

async function compatAt(charIndex, chaId, on) {
  const character = await risuai.getCharacterFromIndex(charIndex).catch(() => null);
  if (!character || character.chaId !== chaId) return false;
  const result = applyCompat(character.globalLore, on);
  const first = !compatSeen.has(chaId);
  compatSeen.add(chaId);
  if (!result.found.length) { // not a compatible bot
    compatStatus.delete(chaId);
    if (compatBots.delete(chaId) || first) changed();
    return true;
  }
  if (!compatBots.has(chaId)) { compatBots.add(chaId); changed(); }
  if (result.changed) {
    try {
      if (typeof risuai.setCharacterToIndex !== 'function') throw new Error('setCharacterToIndex missing');
      await risuai.setCharacterToIndex(charIndex, { ...character, globalLore: result.lore });
    } catch (error) {
      console.warn('[poke-battle] 봇 카드 로어북을 고치지 못함', error);
      compatStatus.set(chaId, failureText(WHAT.compat, typeof risuai.setCharacterToIndex === 'function' ? error : 'writeBlocked', await openLang()));
      return false;
    }
  }

  const lang = await openLang();
  const missing = result.missing.length ? `\n${say(lang, 'notice.compatMissing', { names: result.missing.join(', ') })}` : '';
  compatStatus.set(chaId, on
    ? `${say(lang, result.changed ? 'notice.compatWrapped' : 'notice.compatOn', { n: result.found.length })}${missing}`
    : say(lang, 'notice.compatOff'));
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
    return null; // that character has no such chat - it was deleted
  }
  return null;
}

let doc;
// waiters for the main screen to change and settle (one screen-watch turn)
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
    const press = { key: pick('pkbk'), action: pick('pkba'), index: Number(pick('pkbi')), item: pick('pkbs') }; // item: a shop row's button
    await element.addEventListener('click', () => onButton(press).catch(error => onButtonError(press, error)));
    await element.addClass('x-risu-pkb-bound'); // after the listener is attached - if it could not be, again next turn
  }
}

const openBattleWindow = async options => (await import('./runtime.js')).mountBattle(options);

let errorApp;
async function showError(error) {
  console.error(error);
  errorApp?.close?.();
  const owner = {};
  errorApp = await openBattleWindow({ fetchBytes: () => Promise.reject(error), onClose: () => hideWindow(owner), lang: await openLang() });
  errorApp.showError(error);
  await showWindow(owner);
}

const PRESS_WHAT = { open: WHAT.open, leaveok: WHAT.open, resume: WHAT.resume, retry: WHAT.retry, retryok: WHAT.retry, send: WHAT.send, discardok: WHAT.discard, restore: WHAT.restore };

const OPENS = new Set(['open', 'leaveok', 'resume', 'retry', 'retryok']);
async function onButtonError(press, error) {
  if (!press.key || (OPENS.has(press.action) && !error?.why)) return showError(error);
  if (!error?.why) console.error(error);
  return showNotice(press, failureNote(PRESS_WHAT[press.action] ?? WHAT.action, error, await openLang()));
}

const withIndex = (html, index) => html.replaceAll('{{chat_index}}', Number.isInteger(index) ? String(index) : 'x');
async function setTail(press, view) {
  const element = doc && await doc.querySelector(`.x-risu-pkbt-${press.key}`);
  if (element) await element.setInnerHTML(withIndex(renderCardTail(view, view.lang), press.index));
}

async function refreshCard(press) {
  if (!doc) return;
  await drawCard(await readPass(), press.key, press.index);
}

const drawn = new Map();
/** Swaps the card in place with how it looks in this read of the chat */
async function drawCard(pass, key, index) {
  const view = viewFor(pass, key);
  if (view && view.status !== 'discarded') await swapCard(pass.id, key, renderBattleCard(view, view.lang).trim(), index);
}

async function swapCard(id, key, html, index) {
  const element = doc && await doc.querySelector(`.x-risu-pkbc-${key}`);
  if (element) {
    const inner = html.slice(html.indexOf('>') + 1, html.lastIndexOf('</div>')); // the inside, without the outer card div
    await element.setInnerHTML(withIndex(inner, index));
  }
  drawn.set(key, { id, html });
}

const drawnHtml = view => (view.status === 'discarded' ? renderDiscarded(view, view.lang) : renderBattleCard(view, view.lang)).trim();
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
  if (view?.status === 'discarded') await swapCard(pass.id, press.key, drawnHtml(view), press.index); // a discarded line has no button slot: the whole line
  else if (view) await setTail(press, view);
}

const shops = createShopCards({ sim, doc: () => doc, lang: chat => currentLang(chat), compat: pass => compatBots.has(pass.target?.chaId), actionPass,
  foeGimmicks: () => settings.foeGimmicks, settings: () => settings,
  queue: (action, target) => queueAction(action, target), bindButtons });

const forgeName = (id, key) => `${id}:${key}`;
const forging = new Set();

const forgeAsking = new Map();

const forgeSlots = new Map();

const forgeLook = (pass, key, at) => {
  const name = forgeName(pass.id, key);
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
  forgeSlots.set(forgeName(pass.id, key), { id: pass.id, key, cls: key, html: renderForge(view, currentLang(pass.chat)) });
  return view;
}

async function refreshForge(pass) {
  const index = new Map((pass.chat.message ?? []).map((m, i) => [forgeKey(messageId(m, i)), i]));

  const named = new Map((pass.chat.message ?? []).flatMap((m, i) => (messageId(m, i) !== messageId(null, i) ? [[forgeKey(messageId(null, i)), i]] : [])));
  const bottom = forgeAt(pass.chat);
  if (bottom >= 0) {
    const key = forgeKey(messageId(pass.chat.message[bottom], bottom));
    const name = forgeName(pass.id, key);
    if (!forgeSlots.has(name)) forgeSlots.set(name, { id: pass.id, key, html: null });
  }
  for (const [name, slot] of forgeSlots) {
    const at = slot.id === pass.id ? index.get(slot.key) : undefined;
    const late = at === undefined && slot.id === pass.id ? named.get(slot.key) : undefined;
    if (late !== undefined) {
      const key = forgeKey(messageId(pass.chat.message[late], late)), moved = forgeName(pass.id, key);
      forgeSlots.delete(name); forgeAsking.delete(name);
      if (!forgeSlots.get(moved)?.cls) forgeSlots.set(moved, { id: pass.id, key, cls: slot.cls ?? slot.key, html: slot.html }); // unless drawn anew under it
      continue;
    }
    if (at === undefined) { forgeSlots.delete(name); forgeAsking.delete(name); continue; }
    const html = renderForge({ key: slot.key, ...forgeLook(pass, slot.key, at) }, currentLang(pass.chat));
    if (html === slot.html) continue;
    try {
      const element = doc && (await doc.querySelector(`.x-risu-pkbf-${slot.cls ?? slot.key}`) ?? await doc.querySelector(`.x-risu-pkbfi-${at}`));
      if (element) { await element.setInnerHTML(withIndex(html, at)); slot.html = html; }
    } catch (error) { console.warn('[poke-battle] 칼 칸을 바꿔 끼우지 못함', error); }
  }
}

async function askForge(press, pass) {
  const name = forgeName(pass.id, press.key);
  if (forging.has(name)) return;
  const lang = currentLang(pass.chat);
  try {
    const asked = forgeRequest({ chat: pass.chat, key: press.key, quiet: !quietIn(pass.id), state: await pass.state(), sim, naming: naming(lang) });
    if (asked.why) throw failed(asked.why);
    if (forgeAsking.has(name)) forgeAsking.delete(name); else forgeAsking.set(name, pass.text);
    await refreshForge(pass);
    await bindButtons();
  } catch (error) { await showToast(doc, failureNote(WHAT.forge, error, lang)); }
}
async function forgeBattle(press, pass, kind) {
  const running = forgeName(pass.id, press.key);
  if (forging.has(running)) return;
  forging.add(running);
  const lang = currentLang(pass.chat);
  try {
    if (pass.unreadable) throw failed('unreadable'); // before the paid call: nothing could be written
    const asked = forgeRequest({ chat: pass.chat, key: press.key, quiet: !quietIn(pass.id), state: await pass.state(), sim, naming: naming(lang), kind });
    if (asked.why) throw failed(asked.why);
    await refreshForge(pass);
    const made = await runForge(askAux, asked.messages, asked.basis.reading);
    if (made.why) throw Object.assign(failed(made.why), { cause: made.error });
    const ctx = await storyCtx();

    const wrote = await writeChat(pass.target, chat => appendBattle(chat, asked, made.block, { state: acts.pendingState(chat, ctx).state, sim, naming: naming(lang) }),
      { vars: true, missing: true });
    if (wrote === HELD) throw failed('writeBlocked');
    if (wrote !== true) throw failed('sceneMoved');
  } catch (error) {
    if (error?.why) console.warn('[poke-battle] 배틀을 만들지 못함', error.message, error.cause ?? '');
    else console.error(error);
    await showToast(doc, failureNote(WHAT.forge, error, lang));
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
  if (SHOP_ACTIONS.has(action)) return shops.press(press);
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
  case 'leaveok': return startBattle(press, { leave: true }); // the battle left to resume is stopped first (prepareBattle)
  case 'leave': case 'leaveno': case 'retryno': {

    const pass = await actionPass();
    const view = pass && viewFor(pass, key);
    if (view) await setTail(press, action === 'leave' && view.leave ? { ...view, ask: 'leave' } : view);
    return undefined;
  }
  case 'resume': {

    const pass = await actionPass();
    if (!pass) return undefined;
    if (shownIn(pass.id)?.key === key) return reopen();
    return startBattle(press, { mode: 'resume' }); // after the window was lost - from the autosave
  }
  default: break;
  }
  const pass = await actionPass();
  if (!pass) return undefined;
  switch (action) {

  case 'send': dropGuards(pass.id); return cardSend(press, pass);
  case 'discard': case 'discardno': {

    const view = viewFor(pass, key);
    if (view) await setTail(press, { ...view, ask: action === 'discard' ? 'discard' : undefined });
    return undefined;
  }
  case 'discardok': dropGuards(pass.id); return discardCard(press, pass);
  case 'restore': dropGuards(pass.id); return restoreCard(press, pass); // restore button: a battle that was in progress starts over
  case 'forge': return askForge(press, pass);
  default: {

    const kind = forgeKindOf(action);
    if (!kind) return undefined;
    const name = forgeName(pass.id, press.key);
    if (forgeAsking.get(name) !== pass.text) return;
    forgeAsking.delete(name);
    dropGuards(pass.id);
    return forgeBattle(press, pass, kind);
  }
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
    leaveAttempt(chat, target.key); // restored, it still starts over
    if (!setMark(chat, target.key, MARK.discarded)) throw failed('blockGone');
    setFollow(chat, null); // also remove the in-progress card that followed down
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
  const origin = { ...pass.target, key: press.key, battle: blockSpec(pass, press.key), stage: auto.spec, phase: 'parked' };
  const played = playedAt(auto, await storyCtx());
  await saveForfeit(origin, { turn: auto.turn, result: played?.result });
}

async function startBattle(press, { mode = 'new', retryOf = 'record', owner = {}, leave = false } = {}) {
  if (opening) return false; // pressed again while opening (quick double press) - only one opens
  opening = true;
  let app, origin, markOpen;
  try {
    ({ app, origin, markOpen } = await prepareBattle(press, mode, retryOf, owner, leave));
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
  origin.markedAt = readSeq; // reads started up to here may lack the open mark
  try {
    await app.start();
  } catch (error) {

    if (!error?.unresumable) throw error;
    if (active?.origin === origin) await dropActive();
    throw error;
  }
  return true;
}

function moveRecords(chat) {
  const { renamed, relinked, all } = battleMoves(chat);

  const before = settings.debug ? JSON.stringify([(chat.message ?? []).map(m => m?.data), chat.scriptstate]) : '';
  const moved = rekeyBattles(chat, { moves: all });
  if (moved && settings.debug) {
    const pairs = map => [...map].filter(([from]) => before.includes(from)).map(([from, to]) => `${from} → ${to}`).join(', ');
    console.info('[poke-battle] 배틀 기록 열쇠 옮김', { 이름붙음: pairs(renamed), 다시이음: pairs(relinked) });
  }
  return moved;
}

const rekeyDue = pass => !shownIn(pass.id) && rekeyBattles(pass.chat, { dry: true, table: pass.table });

function blockToOpen(pass, key) {
  const at = findBlockMessage(pass.chat, key);
  if (at < 0) throw failed('blockGone');
  const reading = rulesAt(pass.chat)(at);
  const block = battlesIn(pass.chat.message[at], at, reading).find(b => b.key === key);
  const { spec: battle, errors } = readBattleAt(pass.chat, at, block.body);
  if (!battle) throw failed('blockBroken'); // the card itself lists what is wrong with the block
  return { at, reading, block, battle, errors };
}

function partyToFight(state) {
  const fighters = hatchedParty(state);
  if (!fighters.length) throw failed('emptyParty');
  if (!fighters.some(m => m.hp !== 0)) throw failed('allFainted');
  return fighters;
}

function newBattleCheck(chat, key, ctx) {
  blockToOpen({ chat }, key);
  partyToFight(acts.pendingState(chat, ctx).state);
}

async function prepareBattle(press, mode, retryOf, owner, leave = false) {
  let pass = await actionPass();
  if (!pass) return {};

  let key = press.key = currentKey(pass.chat, press.key) ?? press.key;

  if (rekeyDue(pass)) {
    await writeChat(pass.target, chat => { const moved = moveRecords(chat); if (moved) restoreResult(chat); return moved; }, { vars: true, missing: true });
    pass = await actionPass();
    if (!pass) return {};
    key = press.key = currentKey(pass.chat, key) ?? key;
    if (mode === 'new' && battleIn(pass).card(key) !== 'ready') {
      await refreshCard(press).catch(() => {});
      return {};
    }
  }
  let now = battleIn(pass);

  const off = () => pass.survey.off || now.card(key) === 'off';

  if (leave && mode === 'new' && !settings.iron && now.phase === 'parked' && now.key !== key && !shownIn(pass.id)) {
    const parked = now.key;
    if (off()) {
      await refreshCard(press).catch(() => {});
      return {};
    }
    const stop = chat => {
      setMark(chat, parked, null);
      setFollow(chat, null);
      setOpenedAt(chat, parked, false);
      leaveAttempt(chat, parked);
    };
    const left = structuredClone(pass.chat);
    stop(left);
    newBattleCheck(left, key, await storyCtx());
    dropGuards(pass.id);
    await writeChat(pass.target, chat => {
      if (battleIn({ id: pass.id, chat }).key !== parked || findBlockMessage(chat, key) < 0) return false;
      stop(chat);
      return true;
    }, { vars: true, missing: true });
    pass = await actionPass();
    if (!pass) return {};
    now = battleIn(pass);
  }

  if (shownIn(pass.id) || (now.key && now.key !== key)) throw failed('busy');
  if (mode === 'resume' && now.phase !== 'parked') throw failed('unresumable');
  if (mode !== 'resume' && off()) {
    await refreshCard(press).catch(() => {});
    return {};
  }
  const { at, reading, battle, errors } = blockToOpen(pass, key);
  const ctx = await storyCtx();
  const save = pass.save;

  let from = null, start = null;
  let commands = null;

  const first = mode === 'retry' ? startSpec(save, key) : null;
  const restart = !!first && backToBack(first);
  if (mode === 'resume') {
    from = save.attempt.auto;

    const chain = from?.check ? chainFrom(pass.chat, save.attempt, { turn: from.turn, check: from.check }) : null;
    if (chain?.entries.length) commands = (await planner()).commandQueue(chain.entries);
  }
  else if (mode === 'retry') {
    from = retryAttempt(structuredClone(pass.chat), key, retryOf, { restart });

    if (from) from = rerollSnapshot(from, freshSeed());
    else start = first;
  }
  const persona = await personaLook();

  let base = null;
  const retryBase = () => (base ??= encounterBase(structuredClone(pass.chat), key, ctx, pass.table).state);
  let spec, startBalls = mode === 'resume' ? save.attempt.balls ?? undefined : undefined;
  if (!from) {

    const { state } = mode === 'retry' ? { state: retryBase() } : acts.pendingState(pass.chat, ctx);
    const fighters = partyToFight(state);

    const playerName = persona.name;

    const rule = battleRuleNow(pass.chat, settings);
    spec = start ? restartSpec(start, freshSeed()) : toEngineSpec(state, battle, { ...chatNowCtx(pass.chat, ctx), playerName, lang: currentLang(pass.chat), battleRegion: reading.battleRegion,
      wildHiddenAbility: reading.wildHiddenAbility },
      { seed: freshSeed(), formatid: rule.format, expShare: settings.expShare, eraGimmicks: settings.eraGimmicks, expRate: settings.expRate, effectItems: settings.effectItems, foeGimmicks: settings.foeGimmicks, picture: pictureOptions(key, pass.chat), player: playerOptions(persona.look),
        status: statusIn(pass.chat.message[at]),
        earlierRegion: reading.battleRegion ? earlierRegion(pass.chat, at) : null, blockFirst: knownOtherBot(pass) });
    startBalls = { mine: fighters.map(ballOf), ...blockBalls(battle) };
  }

  const { difficulty } = settings;
  if (spec) spec = { ...spec, difficulty };
  if (from?.spec) from = { ...from, spec: { ...from.spec, difficulty } };

  if (mode === 'retry') {
    if (spec) spec = withLocksOf(retryBase(), spec);
    if (from?.spec) from = { ...from, spec: withLocksOf(retryBase(), from.spec) };
  }

  const { myPicture } = persona.look;
  const me = entryMe(myPicture, myPicture === 'image' ? await loadPicture(risuai.pluginStorage, persona.name) : null);

  const origin = { ...pass.target, index: at, key, battle, startBalls, phase: 'starting', stage: spec ?? from.spec, lang: currentLang(pass.chat) };
  if (active) await parkActive();

  const markOpen = () => writeChat(origin, chat => {
    if (findBlockMessage(chat, key) < 0) throw failed('blockGone');

    if (mode === 'retry' && retryOf === 'record' && !mayUndo({ id: idOf(origin), chat }, key)) throw failed('storyOn');
    dropGuards(idOf(origin)); // every check passed: the open goes ahead (prepareBattle)
    if (mode === 'retry') { retryAttempt(chat, key, retryOf, { restart }); if (from) setAuto(chat, key, from); }
    else if (mode === 'new') freshAttempt(chat, key);
    setMark(chat, key, MARK.open);

    if (mode !== 'resume') setOpenedAt(chat, key, true);
    setFollow(chat, key);
  }, { vars: true, missing: true });
  const app = await openBattleWindow({
    fetchBytes: createFetchBytes(risuai), iron: settings.iron,
    lang: origin.lang, // battle sentences (and so the log send format) in this language
    onSpeed: speed => keepSettings({ ...settings, speed }), // a speed changed during the battle is kept for the next one
    me,

    viewOptions: { theme: settings.theme, volume: soundFeed, speed: settings.speed, typeHints: settings.typeHints, moveAnims: settings.moveAnims, quality: settings.quality, spriteStyle: settings.spriteStyle,
      pictureWays: viewPictureWays(settings.panelPicture),
      voicePacks: voicePacks.source },

    onClose: async () => { await hideWindow(owner); await finish(origin); },
    onCollapse: () => collapse().catch(showError),

    onRetry: () => app.close().then(() => startBattle(press, { mode, retryOf })).catch(error => onButtonError(press, error)),
    story: { spec, from, commands,
      onTurn: snapshot => autosave(origin, snapshot, { defer: true }),
      onResult: result => saveResult(origin, result),

      onSend: options => (origin.phase === 'saved' ? sendCommitted(origin, options) : sendLive(origin, options)),
      onRetry: () => retryFromEnd(origin, press),
      onForfeit: progress => saveForfeit(origin, progress),
      nextStage: ended => nextStage(origin, ended),
      onStage: next => { origin.stage = next; } },
  });
  return { app, origin, markOpen };
}

async function retryFromEnd(origin, press) {
  if (settings.iron) return;
  dropGuards(idOf(origin));
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

function encounterBase(chat, key, ctx, table) {
  removeResult(chat, key, table);
  return acts.pendingState(chat, ctx);
}

async function nextStage(origin, { result, spec }) {
  if (!waitingTrainer(spec)) return null;
  const found = await locate(origin);
  if (!found) throw failed('blockGone');
  const ctx = await storyCtx();
  return nextStageSpec(spec, result, encounterBase(structuredClone(found.chat), origin.key, ctx).state, ctx, { seed: freshSeed() });
}

async function finish(origin) {
  if (active?.origin === origin) setActive(null);

  if (origin.phase !== 'starting' && origin.phase !== 'running') return;
  origin.phase = 'left';

  await origin.marking?.catch(() => {});
  try {
    await writeChat(origin, chat => {
      const unmarked = setMark(chat, origin.key, null);
      const unfollowed = setFollow(chat, null).length > 0; // also remove the in-progress card that followed down
      const unopened = setOpenedAt(chat, origin.key, false); // change blocks that arrived meanwhile are applied again
      return leaveAttempt(chat, origin.key) || unmarked || unfollowed || unopened;
    }, { vars: true });
  } catch (error) { console.warn('[poke-battle] 열림 표식을 떼지 못함', error); }
}

async function collapse() {
  if (!active || active.collapsed) return;
  active.collapsed = true;
  active.app.pause();
  active.app.storyDot(false);
  active.progress = progressBalls(active.app.progress(), active.origin) ?? active.progress;
  await hideWindow(active.window);
  await refreshCard(active.press).catch(() => {});
}

const battleOn = origin => isOn({ bot: botNames.get(origin.chaId) });

async function fitActive() {
  if (!active || active.collapsed || battleOn(active.origin)) return;
  const { origin, app } = active;
  if (origin.phase === 'running' && app.mode === 'running') await collapse();
}
/** The card's "back to battle" */
async function reopen() {
  if (!active) return;

  if (active.collapsed && await replayPlanned()) return;
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
  if (origin.phase === 'saved') return true; // already committed - answered without waiting for the line
  const ctx = await storyCtx();
  let ended = false, kept = null;
  const wrote = await writeChat(origin, chat => {
    if (origin.phase === 'saved') return false;
    if (findBlockMessage(chat, origin.key) < 0) throw failed('blockGone');
    const save = chat.scriptstate?.[SAVE_VAR] ?? null;
    const tag = resultChange(chat, origin, { outcome, result, apply }, ctx);
    if (!tag) { ended = true; return false; }

    kept = drawingJobs(chat) ? { save, mark: resultMark(chat, tag) } : null;
    return true;
  }, { vars: true, missing: true, result: true });
  if (wrote) {
    origin.phase = 'saved';
    if (kept) guards.set(idOf(origin), { origin, args: { outcome, result, apply }, ...kept, seen: Date.now() });
  } else if (ended) endInStory(origin);
  return origin.phase === 'saved';
}

function resultChange(chat, origin, { outcome, result, apply }, ctx) {
  const blockAt = findBlockMessage(chat, origin.key);
  if (surveyBattles(chat, readTable(chat)).battles.get(origin.key)?.phase === 'story') return null;

  const { state: before, table, added } = encounterBase(chat, origin.key, ctx);

  const battles = [...battlesBefore(origin.stage), ...(apply ? [battleRecord(origin.stage, apply, outcome)] : [])];

  const after = applyBattles(before, battles, { ...ctx, status: latestStatus(chat, blockAt) }, { battle: origin.battle });
  const tag = hashKey(`${origin.key}:${Date.now()}`);

  const caughtMon = result.captured ? [...after.party, ...after.box].find(m => ![...before.party, ...before.box].some(b => b.uid === m.uid)) : null;
  const caught = caughtMon ? { species: caughtMon.set.species, storage: after.box.includes(caughtMon) ? after.box.indexOf(caughtMon) + 1 : null } : null;
  const evolutions = [...battlesBefore(origin.stage).map(b => b.result), result].flatMap(r => r.evolutions ?? [])
    .filter(e => e?.evolved === true && !e.unsupported).map(e => ({ from: e.from, to: e.to, evolved: true }));

  const stages = backToBack(origin.stage) ? [...battlesBefore(origin.stage).map(b => outcomeOf(b.result)), outcome] : null;

  const prize = prizeItem([...battlesBefore(origin.stage).map(b => b.result), result]);
  const line = resultLine({ outcome, battle: origin.battle, kind: battleKind(apply), caught, evolutions, stages, prize, ...naming(battleLang(origin, chat)) });

  const anchor = blockAnchorIn(chat, origin.key, rulesAt(chat));
  const place = resultPlace(chat, placeResult(chat, { blockKey: origin.key, line, tag }));
  table.snaps[tag] = withItemTags(after);

  table.meta = { ...table.meta, [tag]: { blockKey: origin.key, ...anchor, outcome, turns: result.turn ?? 0,
    faceSpecies: result.captured?.species ?? origin.battle.team?.[0]?.species, title: battleTitle(origin.battle, battleLang(origin, chat), { level: false }),
    wild: !!origin.battle.wild, caught, evolved: evolutions,
    ...(added.length ? { held: added.map(action => action.id) } : {}) } };
  writeTable(chat, table);

  writeLast(chat, { blockKey: origin.key, ...anchor, tag, outcome, battle: origin.battle, line, place,
    result: { turn: result.turn ?? 0, outcome: result.outcome ?? null, winner: result.winner ?? null, captured: result.captured ?? null,
      forfeited: !!result.forfeited, playerName: result.sides?.[0]?.name ?? null, log: result.log ?? [], screen: result.screen ?? [],
      ...(result.screenHp?.length ? { screenHp: result.screenHp } : {}),
      evolutions,
      own: ownStarts(origin.stage),
      ...(stageOf(origin.stage) > 1 ? { stage: stageOf(origin.stage) } : {}) } });
  commitAttempt(chat, origin.key);
  return tag;
}

async function saveResult(origin, result) {
  return { committed: await writeResult(origin, { outcome: outcomeOf(result), result, apply: result }) };
}

async function saveForfeit(origin, progress) {
  const now = progress?.result;
  const apply = Array.isArray(now?.sides) ? now : null;
  const screen = active?.origin === origin ? active.app.screen() : null;
  await writeResult(origin, { outcome: 'lose', result: { turn: progress?.turn ?? 0, log: progress?.log ?? [], sides: now?.sides, screen: screen?.lines ?? [], screenHp: screen?.hp ?? [] }, apply });
}

const loreRuleNow = chat => { const rule = battleRuleNow(chat, settings); return loreRuleOf(rule.value, rule.gen); };

const ruleSpecNow = chat => { const rule = battleRuleNow(chat, settings); return { formatid: rule.format, ...(rule.gen ? { formGen: rule.gen } : {}) }; };

function battleForVars(where) {
  const { chat } = where;
  const survey = where.survey ?? surveyBattles(chat, readTable(chat));
  const save = 'save' in where ? where.save : readSave(chat);
  const now = battleIn({ id: where.id, seq: where.seq, chat, survey, save });
  let key = now.key, turn = null, battle = null, pending = false, stage = 1;
  if (now.phase === 'parked') { turn = save.attempt.auto?.turn ?? null; stage = stageOf(save.attempt.auto?.spec); }
  else if (key) {
    battle = active.origin.battle;
    stage = stageOf(active.origin.stage);
    turn = (() => { try { return active.app.progress()?.turn ?? null; } catch { return null; } })();
  } else {
    key = [...survey.battles.values()].filter(info => !info.attempt && now.card(info.key) === 'ready').sort((a, b) => a.at - b.at).at(-1)?.key ?? null;
    pending = !!key;
  }
  if (!key) return null;
  if (!battle) battle = blockSpec({ chat, survey }, key);
  if (!battle) return null;

  let result = null, engineSpec = null;
  if (!pending) {
    const chain = save?.attempt?.plans?.length ? chainIn({ id: where.id, seq: where.seq, chat, survey, save }) : null;
    const at = chain?.end ?? (now.phase === 'parked' ? save.attempt.auto : null);
    if (at) turn = at.turn ?? turn;
    result = at ? statusAt(at) : (() => { try { return active.app.progress()?.result ?? null; } catch { return null; } })();
    engineSpec = at?.spec ?? (active?.key === key ? active.origin.stage : null);
  }

  const tools = engineSpec ? toolsIn(engineSpec) : settings.effectItems;

  const gimmicks = result ? battleGimmicks(engineSpec ?? ruleSpecNow(chat)) : null;
  return { spec: battle, turn: result?.turn ?? turn, pending, ...(stage > 1 ? { stage } : {}), ...(result ? { now: result } : {}), ...(commandsOn(settings) ? { commands: true } : {}),
    ...(tools ? {} : { tools: false }), ...(gimmicks ? { gimmicks } : {}) };
}

const statusMemo = new Map();

function statusAt(snapshot) {
  if (!snapshot?.check || !ctxNow) return null;
  const key = snapshotKey(snapshot);
  if (!statusMemo.has(key)) {
    try { statusMemo.set(key, snapshotResult(sim, snapshot, { levelUp: ctxNow.levelUp, exp: ctxNow.exp })); }
    catch (error) { console.warn('[poke-battle] 배틀 상태 줄을 만들지 못함', error); return null; }
    if (statusMemo.size > 8) statusMemo.delete(statusMemo.keys().next().value);
  }
  return statusMemo.get(key);
}

const naming = lang => ({ lang, en: dexName });

const bagTools = battle => (battle ? battle.tools !== false : settings.effectItems === true);
const varsOf = (state, where) => { const battle = battleForVars(where); return varTexts(state, { sim, battle, ...naming(currentLang(where.chat)), effectItems: bagTools(battle) }); };

const rematchEntries = (state, where) => (battlesOff(where.chat) ? [] : trainerLore(state, naming(currentLang(where.chat))));

const writeStoryVars = (into, state, where) => [writeVars(into, varsOf(state, where)), writeTrainerLore(into, rematchEntries(state, where))].some(Boolean);

const varsKey = where => JSON.stringify([where.id, where.text ?? textKey(where.chat), stateVars().map(name => where.chat?.scriptstate?.[name] ?? null),
  battleForVars(where), currentLang(where.chat), settings.effectItems === true, battlesOff(where.chat)]);

async function setVars(where) {
  const { state, table, changed } = acts.pendingState(where.chat, await storyCtx());
  if (changed) writeTable(where.chat, table);
  return writeStoryVars(where.chat, state, where) || changed;
}

const VARS_SEEN = 4;
const varsSeen = new Map();
function rememberVars(id, chat) {
  const now = varsIn(chat);
  if (now.party === undefined && now.bag === undefined && !now.lore.length) return; // none of ours (a chat of a bot that is off)
  const list = varsSeen.get(id) ?? [];
  if (sameVars(list.at(-1), now)) return; // the common case: as last seen
  const at = list.findIndex(vars => sameVars(vars, now));
  if (at >= 0) list.splice(at, 1);
  list.push(now);
  if (list.length > VARS_SEEN) list.shift();
  varsSeen.delete(id);
  varsSeen.set(id, list);
  if (varsSeen.size > SEEN_CHATS) varsSeen.delete(varsSeen.keys().next().value);
}

async function freshVars(pass) {
  const state = await pass.state();
  return { ...varsOf(state, pass), lore: rematchEntries(state, pass).map(({ key, content }) => ({ key, content })) };
}

let freshMemo = null;

async function fixRequest(messages) {
  try {
    if (!mayHold(messages)) return messages;
    const pass = await readPass();
    if (!isOn(pass) || pass.unreadable) return messages;
    const stored = varsIn(pass.chat);
    const key = varsKey(pass);
    if (key === varsAt && holds(messages, stored)) return messages;
    const fresh = freshMemo?.key === key ? freshMemo.fresh : await freshVars(pass);
    freshMemo = { key, fresh };
    const fixed = fixPrompt(messages, { stale: [...(varsSeen.get(pass.id) ?? []), stored], fresh });
    if (fixed !== messages) watchSoon();
    return fixed;
  } catch (error) {
    console.warn('[poke-battle] 보내는 글의 파티·가방을 바로잡지 못함', error);
    return messages;
  }
}

const PROMPT_UP_MS = 400;

async function startReplacer() {
  if (typeof risuai.addRisuReplacer !== 'function') return;
  await askPermission('replacer', async () => {
    const tip = setTimeout(() => { openLang().then(lang => showToast(doc, { text: say(lang, 'notice.replacerAsk'), kind: 'info' })).catch(() => {}); }, PROMPT_UP_MS);
    try { await risuai.addRisuReplacer('beforeRequest', fixRequest); } finally { clearTimeout(tip); }
    return risuai.requestPluginPermission('replacer');
  });
}

const SETTLE_MS = 900;

const SEEN_CHATS = 4;
const observed = new Map();

function observe(id, chat, { ours = false } = {}) {
  const messages = chat?.message ?? [];
  const before = observed.get(id);
  const last = messages.length - 1;

  const seen = last < 0 ? undefined : before?.texts.get(messageId(messages[last], last)) ?? before?.texts.get(messageId(null, last));
  const same = !!before && (last < 0 || seen === messages[last].data) && !aboveChanged(before.order, messages);
  const streaming = !!chat?.isStreaming;

  const ended = !streaming && before?.streaming && before.grewAt;
  const changedAt = ours ? before?.changedAt ?? 0 : same && !streaming ? before.changedAt : ended || Date.now();
  observed.delete(id);
  observed.set(id, { texts: new Map(messages.map((m, i) => [messageId(m, i), m.data])), order: messages.map(m => m?.data), changedAt, streaming });
  if (observed.size > SEEN_CHATS) observed.delete(observed.keys().next().value);
  rememberVars(id, chat);
  if (replyWatch?.id === id) seeReplies(replyWatch, messages, { streaming, ours });
}

function aboveChanged(order, messages) {
  for (let i = 0; i < messages.length - 1; i++) if (order[i] !== messages[i]?.data) return true;
  return false;
}

function observeGrow(id) {
  const seen = observed.get(id);
  if (seen) seen.grewAt = Date.now();
}

function quietIn(id) {
  const seen = observed.get(id);
  if (!seen || seen.streaming) return SETTLE_MS;
  return Math.max(0, SETTLE_MS - (Date.now() - seen.changedAt));
}

const DRAW_CAP_MS = 25_000;
const DRAW_POLL_MS = 1000;

const drawSeen = new Map();

function drawHold(id, chat, since) {
  const jobs = drawingJobs(chat);
  if (!jobs) { drawSeen.delete(id); return 0; }
  const now = Date.now();
  let seen = drawSeen.get(id);
  if (seen?.jobs !== jobs) {
    seen = { jobs, at: now };
    drawSeen.delete(id);
    drawSeen.set(id, seen);
    if (drawSeen.size > SEEN_CHATS) drawSeen.delete(drawSeen.keys().next().value);
  }
  const left = DRAW_CAP_MS - (now - Math.min(seen.at, since));
  return left > 0 ? Math.min(DRAW_POLL_MS, left) : 0;
}

let watchHeld = null;

function watchHold(pass) {
  const since = watchHeld?.id === pass.id ? watchHeld.since : Date.now();
  const wait = drawHold(pass.id, pass.chat, since);
  watchHeld = wait ? { id: pass.id, since } : null;
  return wait;
}

const GUARD_MS = 60_000;

const guards = new Map();

const dropGuards = id => guards.delete(id);

function guardResult(pass) {
  const guard = guards.get(pass.id);
  if (!guard || guard.busy) return;
  const now = Date.now();
  if (drawingJobs(pass.chat)) guard.seen = now;
  if (now - guard.seen > GUARD_MS || chatMovedOn(guard.mark, pass.chat)) { guards.delete(pass.id); return; } // too late, or the chat went on with the result in it
  guard.mark = markNow(guard.mark, pass.chat);
  if (!resultTakenBack(guard.mark, pass.chat)) return;
  guard.busy = true;
  storyCtx().then(ctx => writeChat(guard.origin, chat => {
    if (guards.get(pass.id) !== guard || !resultTakenBack(guard.mark, chat)) return false;
    let tag = guard.mark.tag;
    if (readLast(chat)?.tag === tag) {
      if (restoreResult(chat) < 0) return false;
    } else {
      chat.scriptstate ??= {};
      if (guard.save === null) delete chat.scriptstate[SAVE_VAR]; else chat.scriptstate[SAVE_VAR] = guard.save; // the attempt this result commits
      tag = resultChange(chat, guard.origin, guard.args, ctx);
      if (!tag) return false;
    }
    guard.mark = resultMark(chat, tag);
    if (settings.debug) console.info('[poke-battle] 에셋메이드가 되돌린 배틀 결과를 다시 씀', { 결과: tag });
    return true;
  }, { vars: true, result: true }))
    .catch(error => console.warn('[poke-battle] 되돌려진 배틀 결과를 다시 쓰지 못함', error))
    .finally(() => { guard.busy = false; });
}

function followMoves(pass) {
  const key = battleIn(pass).key;
  if (!key && !hasFollowMarks(pass.chat)) return false; // the common case: no battle in progress and no marks
  return setFollow({ message: (pass.chat.message ?? []).map(m => ({ ...m })) }, key).length > 0;
}

async function pendingFixes(pass) {
  if (!isOn(pass)) return { lore: !loreInLine(pass.chat, false), handBack: handsBack(pass.chat) }; // a chat of a bot that is off: only bringing it to the off form
  if (pass.unreadable) return {};
  const lore = !loreInLine(pass.chat, true, notCompatBot(pass), !battlesOff(pass.chat), loreRuleNow(pass.chat));
  const { state, changed: fills } = await pass.computed();
  const key = varsKey(pass);
  const differ = varsAt !== key && writeStoryVars({ scriptstate: { ...pass.chat.scriptstate }, localLore: pass.chat.localLore }, state, pass);
  if (!differ) varsAt = key;
  const ends = storyEndFixes(pass.chat, pass.table, pass.survey, { canPlay });

  const battle = newChatStart(pass.chat, settings) || optionsBehind(pass.chat, settings);
  return { lore, vars: differ || fills, follow: followMoves(pass), behind: settingsBehind(pass.chat, chatSettings(pass.chat, settings)), battle, world: worldBehind(pass.chat),
    settle: acts.settleQueue({ message: pass.chat.message, scriptstate: { ...pass.chat.scriptstate } }),
    lost: lostResult(pass.chat, pass.last, pass.table) >= 0, ends: ends.drop.length + ends.add.length > 0,

    rekey: rekeyDue(pass) };
}

function playedAt(snapshot, ctx) {
  try {
    const result = snapshotResult(sim, snapshot, { levelUp: ctx.levelUp, exp: ctx.exp });

    const before = battlesBefore(snapshot.spec);
    return { ...battleRecord(snapshot.spec, result), ...(before.length ? { before } : {}) };
  } catch (error) {
    if (!error?.unresumable) throw error;
    console.warn('[poke-battle] 이야기로 끝난 배틀의 자동 저장을 다시 넣지 못함', error);
    unplayable.add(snapshotKey(snapshot));
    return null;
  }
}

const unplayable = new Set();
const snapshotKey = snapshot => hashKey(JSON.stringify(snapshot));
/** Whether a replay of this autosave may work (not failed with this code) */
const canPlay = snapshot => !unplayable.has(snapshotKey(snapshot));

function storyEndFailed(pass, key) {
  const info = pass.survey.battles.get(key);
  const auto = info?.committed === 'story' && info.ended.attempt && pass.save?.attempt?.blockKey === key ? pass.save.attempt.auto : null;
  return !!auto && !canPlay(auto);
}

const MESSAGE_FIXES = ['follow', 'lost', 'ends', 'handBack', 'rekey'];
const needsWrite = (fixes, { messages = true } = {}) => Object.entries(fixes).some(([name, on]) => on && (messages || !MESSAGE_FIXES.includes(name)));

function writeFixes(pass, fixes, { messages = true, attach = null, defer = false } = {}) {
  return whenQuiet(pass.target, async found => {
    if (!found) return {};
    let attached;
    const ctx = messages && fixes.ends ? await storyCtx() : null;
    const wrote = await writeRecords(found, chat => {
      attached = attach?.(chat);
      if (fixes.lore) setLore(chat, true, { other: notCompatBot(pass), battles: !battlesOff(chat), rule: loreRuleNow(chat) });

      if (fixes.battle) { recordNewChatStart(chat, settings); recordOptions(chat, settings); }

      if (fixes.behind || fixes.battle) recordSettingChange(chat, chatSettings(chat, settings));

      if (fixes.world) recordWorldChange(chat);
      if (messages) {
        if (fixes.rekey) moveRecords(chat); // first: the fixes below find the records under the keys the blocks have now
        if (fixes.lost || fixes.rekey) restoreResult(chat); // a result lost under the old key shows only once its records are moved
        if (fixes.ends) {

          const table = readTable(chat), save = readSave(chat);
          const { added } = acts.pendingState(chat, ctx);
          if (recordStoryEnds(chat, table, key => startSpec(save, key)?.p2?.team ?? null, snapshot => playedAt(snapshot, ctx), { canPlay, held: added })) writeTable(chat, table);
        }
        setFollow(chat, battleIn({ id: pass.id, chat }).key);
      }
    }, { vars: !!(fixes.vars || fixes.lore || (messages && (fixes.lost || fixes.ends || fixes.rekey))) });
    if (wrote === HELD) await clearDerived(found, { messages });
    return { attached };
  }, { defer });
}

async function catchUp(pass) {
  const wait = quietIn(pass.id);
  if (wait) return watchLater(wait);
  const fixes = await pendingFixes(pass);
  if (needsWrite(fixes)) await writeFixes(pass, fixes, { defer: true });
  if (fixes.rekey) watchSoon();
}

async function catchLost(pass) {
  if (quietIn(pass.id)) return; // the held turn comes again (watchLater)
  const fixes = await pendingFixes(pass);
  if (fixes.lost) await writeFixes(pass, { lost: true });
}

function sendPiece(chat, target, what) {
  const { key } = target;
  const got = what(chat);
  if (!got) return null;
  const { source, at, notes = [] } = got;
  const point = sentPoint(chat, key, { ended: at.ended, stage: source.stage });
  const range = sendRange({ sent: point, log: source.log ?? [], to: at.to, ended: at.ended, dex: sim.Dex });

  if (!range) {
    if (!notes.length) return null;
    const logEnd = point.logEnd ?? 0;
    return { text: failedOoc(notes), info: { battle: key, turns: null, result: '' },
      send: { upto: Math.max(point.upto, 0), logFrom: logEnd, logEnd, screenEnd: point.screenEnd, ended: false, snapshot: at.snapshot ?? null, stage: source.stage } };
  }
  const built = buildOoc(settings.sendFormat, { ...source, key }, range,
    { screenFrom: range.first ? 0 : point.screenEnd, screenTo: at.screenEnd, ...naming(battleLang(target, chat)), guide: settings.oocTrial });
  const text = notes.length ? built.text.replace(/\)$/, `\n${notes.join('\n')})`) : built.text;
  const upto = at.ended ? at.endTurn ?? 0 : turnSpan(range.read)?.toTurn ?? Math.max(point.upto, 0);
  return { text, info: built.info, send: { upto, logFrom: range.from, logEnd: range.to, screenEnd: at.screenEnd, ended: at.ended, snapshot: at.snapshot ?? null, stage: source.stage } };
}

async function sendOnce(target, what, { onWait, acts: told = [] } = {}) {
  const lang = battleLang(target, null);
  const ctx = await storyCtx();
  let mark = null;
  const sent = await writeChat(target, (chat, found) => {
    const piece = sendPiece(chat, target, what);
    if (!piece) return false;

    const salt = `${Date.now()}:${Math.random()}`;
    acts.adoptQueue(chat, ctx, { salt });
    const tag = acts.attachQueue(chat, ctx, { salt });
    const placed = insertOoc(chat, { text: piece.text, info: piece.info, tail: tag ? acts.tagText(tag) : '' });
    mark = placed.mark;

    addSend(chat, target.key, { chatId: placed.chatId, mark, ...piece.send });
    tellPlans(chat, target.key, told, mark);

    if (!piece.send.ended && battleIn({ id: idOf(found.target), chat }).key === target.key) setFollow(chat, target.key);
    return true;
  }, { vars: true, missing: true, onWait: settings.autoSend && onWait ? waiting => tellWait(onWait, waiting, lang) : undefined });
  if (sent !== true) return { sent: false };
  if (!settings.autoSend) return { sent: true };
  const note = await sendChatOn(target, mark, lang);
  if (!note) return { sent: true };
  notices.set(target.key, { id: idOf(target), note });
  return { sent: true, note };
}

async function sendChatOn(target, mark, lang) {
  if (!(await askPermission('sendChat'))) return failureNote(WHAT.sendOn, 'denied', lang);
  const pass = await readPass();
  const last = pass?.chat.message?.at(-1);
  if (pass?.id !== idOf(target)) return failureNote(WHAT.sendOn, 'chatMoved', lang);
  if (!findOocs(String(last?.data ?? '')).some(ooc => ooc.info.mark === mark)) return failureNote(WHAT.sendOn, 'oocMoved', lang);
  awaited.set(mark, pass.id); // this send's wait, set up before sendChat is called
  const note = await risuai.sendChat('').then(sent => (sent === false ? failureNote(WHAT.sendOn, 'denied', lang) : undefined), error => { // false: permission refused
    console.warn('[poke-battle] 채팅을 보내지 못함', error);
    return failureNote(WHAT.sendOn, error, lang);
  });
  if (note) awaited.delete(mark);
  return note;
}

const awaited = new Map();
/** The screen watch's look at this read for the replies awaited in its chat */
function seeReply(pass) {
  for (const [mark, id] of awaited) {
    if (id !== pass.id) continue;
    const reply = replyTo(pass.chat.message ?? [], mark);
    if (reply === 'waiting' || (reply === 'reply' && quietIn(pass.id))) continue;
    awaited.delete(mark);
    if (reply === 'reply' && active && !active.collapsed) active.app.storyDot(true);
  }
}

let replyWatch = null;
function seeReplies(watch, messages, options) {
  const { reply, wait } = watch.watch.see(messages, { ...options, at: Date.now() });
  clearTimeout(watch.timer);
  watch.timer = null;
  if (reply) { try { watch.onReply(); } catch (error) { console.warn('[poke-battle] 답장 배지를 보이지 못함', error); } }
  if (wait) watch.timer = setTimeout(() => { if (replyWatch === watch) readPass(); }, wait + 50);
}

export async function watchReplies(onReply) {
  const pass = await readPass();
  if (!pass) return () => {};
  const messages = pass.chat.message ?? [];
  const watch = { id: pass.id, onReply, timer: null,
    watch: createReplyWatch({ messages, streaming: !!pass.chat.isStreaming, at: Date.now() }) }; // a reply arriving now counts when it finishes
  clearTimeout(replyWatch?.timer);
  replyWatch = watch;
  seeReplies(watch, messages, { streaming: !!pass.chat.isStreaming });
  return () => {
    clearTimeout(watch.timer);
    if (replyWatch === watch) replyWatch = null;
  };
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
  return () => ({ source: { battle: origin.battle, own: ownStarts(origin.stage), result: null, log: progress.log, screen: screen.lines, screenHp: screen.hp, stage: stageOf(origin.stage) },
    at: { to: shown, ended: false, screenEnd: screen.lines.length, snapshot } });
}

const tellWait = (onWait, waiting, lang) => Promise.resolve().then(() => onWait(waiting ? sendWait(lang) : null))
  .catch(error => console.warn('[poke-battle] 기다림 안내를 보이지 못함', error));

async function sendLive(origin, options) {
  const pass = await readPass();
  const planned = pass?.id === idOf(origin) ? await plannedWhat(pass) : null;
  if (planned) return sendOnce({ ...origin, key: planned.target.key }, planned.what, { ...options, acts: planned.acts });
  const what = liveWhat(origin);
  return what ? sendOnce(origin, what, options) : { sent: false };
}

function sendCommitted(target, options) {
  return sendOnce(target, chat => {
    const last = readLast(chat);
    const info = surveyBattles(chat, readTable(chat)).battles.get(target.key);
    if (!last || last.blockKey !== target.key || info?.committed !== 'done' || info.result.tag !== last.tag) throw failed('noRecord');
    const screen = last.result.screen ?? [], log = last.result.log ?? [];
    return { source: { battle: last.battle, own: last.result.own ?? null, result: last.result, log, screen, screenHp: last.result.screenHp ?? [], stage: last.result.stage },
      at: { to: log.length, ended: true, endTurn: last.result.turn ?? 0, screenEnd: screen.length, snapshot: null } };
  }, options);
}

function sendFromCard(pass, key, options) {
  const live = liveOrigin(pass);
  if (live?.key === key) return sendLive(live, options);

  if (pass.survey.off) return Promise.resolve({ sent: false });
  if (battleIn(pass).card(key) === 'done') return sendCommitted({ ...pass.target, key, lang: currentLang(pass.chat) }, options);

  return plannedWhat(pass).then(planned => {
    if (planned?.target.key !== key) throw failed('notOpened');
    return sendOnce(planned.target, planned.what, { ...options, acts: planned.acts });
  });
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

// ---------- Autosave ----------

async function autosave(origin, snapshot, { defer = false } = {}) {
  if (origin.phase !== 'running') return undefined;
  origin.autoLatest = snapshot;
  const live = active?.origin === origin ? active : null;
  const balls = live ? progressBalls(live.app.progress(), origin) : undefined;
  if (live && balls) live.progress = balls;
  return writeChat(origin, chat => origin.autoLatest === snapshot && origin.phase === 'running'
    && setAuto(chat, origin.key, snapshot, balls ?? live?.progress ?? null), { vars: true, defer });
}

const planner = () => import('./planner.js');
const planOptions = async () => { const { levelUp, exp } = await storyCtx(); return { levelUp, exp }; };
const samePoint = (a, b) => !!a && !!b && a.turn === b.turn && a.check === b.check;

const langOf = (where, key) => (active?.key === key && idOf(active.origin) === where.id ? battleLang(active.origin, where.chat) : currentLang(where.chat));

function positionIn(where) {
  const now = battleIn(where);
  if (!now.key) return null;
  if (now.phase === 'parked') {
    const auto = ('save' in where ? where.save : readSave(where.chat))?.attempt?.auto;
    return auto?.check ? { key: now.key, point: { turn: auto.turn, check: auto.check }, snapshot: auto, live: false } : null;
  }
  const own = active?.key === now.key && idOf(active.origin) === where.id && active.origin.phase === 'running';
  const position = own ? active.app.position() : null;
  return position ? { key: now.key, ...position, live: true } : null;
}

function chainIn(where) {
  const position = positionIn(where);
  if (!position) return null;
  const attempt = partFor('save' in where ? where.save : readSave(where.chat), position.key, 'attempt');
  return { position, attempt, ...chainFrom(where.chat, attempt, position.point) };
}

async function checkPlans(pass) {

  if (!(commandsOn(settings) && pass.chat.message?.some(m => String(m?.data ?? '').includes('<pkb-act'))) && !pass.save?.attempt?.plans?.length) return;
  let where = pass;
  for (let round = 0; round < PLAN_ROUNDS; round++) {
    if (!where || where.id !== pass.id || !isOn(where) || where.unreadable) return;
    const position = positionIn(where);
    if (!position) return;
    const target = { ...where.target, key: position.key };
    const attempt = partFor(where.save, position.key, 'attempt');
    const back = rewindOf(where.chat, attempt, position.point);
    let wrote;
    if (back) {
      wrote = await writeChat(target, chat => {
        const now = positionIn({ id: where.id, chat });
        if (!samePoint(now?.point, position.point) || !rewindOf(chat, partFor(readSave(chat), position.key, 'attempt'), position.point)) return false;
        return rewindPlans(chat, position.key, back);
      }, { vars: true, defer: true });

      if (wrote === true && position.live && active?.key === position.key) await dropActive();
    } else {
      const next = commandsOn(settings) ? nextUnplanned(where.chat, attempt, position.point) : null;
      if (!next) return;
      const lang = langOf(where, position.key);
      const plan = await (await planner()).workOut(next.from, next.block.turns, { options: await planOptions(), lang });
      const row = { act: next.block.key, from: next.from, to: plan.to, logFrom: plan.logFrom, entries: plan.entries, turns: plan.turns, told: null };
      wrote = await writeChat(target, chat => {
        const now = positionIn({ id: where.id, chat });
        if (!samePoint(now?.point, position.point)) return false;
        if (nextUnplanned(chat, partFor(readSave(chat), position.key, 'attempt'), position.point)?.block.key !== row.act) return false;
        return addPlan(chat, position.key, row);
      }, { vars: true, defer: true });
    }
    if (wrote !== true) return;
    where = await readPass();
  }
}
const PLAN_ROUNDS = 8; // blocks worked out in one screen-watch turn at most (the next turn goes on)

async function replayPlanned() {
  const { origin, press } = active;
  const pass = await readPass();
  if (pass?.id !== idOf(origin)) return false;
  const chain = chainIn(pass);
  if (!chain?.position.live || !chain.entries.length) return false;
  const saved = await writeChat(origin, chat => setAuto(chat, origin.key, chain.position.snapshot), { vars: true });
  if (saved !== true) return false;
  await dropActive();
  await startBattle({ ...press, action: 'resume' }, { mode: 'resume' });
  return true;
}

function battleSpecOf(where, key) {
  if (active?.key === key) return active.origin.battle;
  return blockSpec(where, key);
}

async function plannedWhat(where, extra = null) {
  const chain = chainIn(where);
  if (!chain) return null;
  const rows = [...chain.rows, ...(extra ? [extra] : [])];
  if (!rows.length) return null;
  const { position } = chain;
  const end = extra?.to ?? chain.end;
  const lang = langOf(where, position.key);
  const read = await (await planner()).readAt(end, { options: await planOptions(), lang });
  const battle = battleSpecOf(where, position.key);
  const tell = untold(where.chat, rows);
  const notes = failedLines(tell, naming(lang));

  const over = read.log.some(line => /^\|(win|tie)\|/.test(line)) ? statusAt(end) : null;
  const what = chat => {
    const again = chainIn({ id: where.id, chat });
    if (!again || again.end?.check !== chain.end?.check || !samePoint(again.position.point, position.point)) return null; // the battle or its commands changed meanwhile
    return { source: { battle, own: ownStarts(end.spec), result: over, log: read.log, screen: read.lines, screenHp: read.hp, stage: stageOf(end.spec) }, notes,
      at: { to: read.log.length, ended: false, screenEnd: read.lines.length, snapshot: end } };
  };
  return { target: { ...where.target, key: position.key, lang }, what, acts: tell.map(row => row.act) };
}

const AUX_RECENT = 8; // messages, when the setting has none
const AUX_CHARS = 2000; // per message: longer ones keep their end (nearest the command)

function auxRecent(chat, n) {
  return (chat?.message ?? []).slice(-n).map(m => ({ role: m.role, text: stripForPrompt(unwrapOocs(m?.data ?? '')).slice(-AUX_CHARS) })).filter(m => m.text);
}

async function askAux(args) {
  return risuai.runLLMModel({ ...args, messages: withUserName(args.messages, await userName(risuai)) });
}

async function auxCommand(pass, input) {
  const chain = chainIn(pass);
  const from = chain?.end ?? chain?.position.snapshot;
  if (!from) return null;
  const lang = langOf(pass, chain.position.key);
  const plan = await planner();
  const options = await planOptions();
  const now = statusAt(from);
  const status = battleStatusLines(now, createNamer(naming(lang)), battleSpecOf(pass, chain.position.key));
  const messages = auxRequest({ status, recent: auxRecent(pass.chat, settings.auxRecent ?? AUX_RECENT), input: String(input).slice(-AUX_CHARS), double: battleKind(now) !== 'single',
    tools: toolsIn(from.spec), gimmicks: battleGimmicks(from.spec) });
  let answer;
  try { answer = await askAux({ messages, mode: FORGE_MODE, allowPlugins: true }); }
  catch (error) { console.warn('[poke-battle] 보조 모델이 명령을 뽑지 못함', error); return null; }
  const body = findBlocks(String(answer?.result ?? '')).find(b => b.kind === 'act')?.body;
  const turns = body ? parseAct(body).turns : [];
  if (!turns.length) return null;
  const own = actBlock(body.replace(/^\s*id\s*:.*$/gim, ''), hashKey(`${Date.now()}:${Math.random()}`));
  const done = await plan.workOut(from, turns, { options, lang });
  return { row: { act: own.key, from, to: done.to, logFrom: done.logFrom, entries: done.entries, turns: done.turns, told: null, block: { turns } }, text: own.text };
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
    try { return acts.queueAction(chat, ctx, action, { salt: String(Math.random()) }); } catch (error) { throw refused(error); }
  }, { vars: true, missing: true });
  return queued === HELD ? null : queued || null;
}

export async function fishCast(rod, target = null) {
  const pass = await actionPass();
  if (!pass) return null;
  const to = target ?? pass.target;
  if (quietIn(pass.id)) throw failed('replying');
  const ctx = await storyCtx();
  let cast = null, battle = null;
  const wrote = await writeChat(to, (chat, found) => {
    if (battleIn({ id: idOf(found.target), chat }).key) throw failed('inBattle');
    battle = null;
    const { state } = acts.pendingState(chat, ctx);
    cast = castNow(chat, { rod, bag: state.bag, levels: hatchedParty(state).map(mon => mon.set.level), actions: acts.fishCasts(chat),
      speciesName: id => sim.Dex.species.get(id).name });
    if (cast.rule) throw refused(ruleError(cast.rule));
    if (cast.why) throw failed(cast.why);
    try { acts.queueAction(chat, ctx, cast.action, { salt: String(Math.random()) }); } catch (error) { throw refused(error); }
    if (cast.block) {
      appendCast(chat, cast);
      battle = battlesIn(chat.message[cast.at], cast.at, rulesAt(chat)(cast.at)).at(-1)?.key ?? null; // the block just appended is the message's last
    }
    return true;
  }, { vars: true, missing: true });
  if (wrote === HELD) return null;
  if (wrote !== true) throw failed('sceneMoved');
  return battle ? { ...cast.result, battle } : cast.result;
}

export async function writeBotTravel(change, target) {
  const values = Object.entries(compatTravelVars(change)).map(([name, value]) => [`$${name}`, value]);
  const wrote = await writeChat(target, (chat, found) => {
    if (!compatBots.has(found.target.chaId)) throw failed('writeBlocked');
    if (battleIn({ id: idOf(found.target), chat }).key) throw failed('inBattle');
    chat.scriptstate ??= {};
    const changes = values.filter(([name, value]) => chat.scriptstate[name] !== value);
    for (const [name, value] of changes) chat.scriptstate[name] = value;
    return changes.length > 0;
  }, { missing: true });
  if (wrote === HELD) throw failed('writeBlocked');
}

export async function pendingParty() {
  const pass = await readPass();
  if (!isOn(pass)) return null;
  const { state, errors } = acts.pendingState(pass.chat, await storyCtx());
  return { state, errors, actions: acts.readQueue(pass.chat).actions };
}

async function pressHere(pass, key, action) {
  const press = { key, action, index: findBlockMessage(pass.chat, key) };
  await onButton(press).catch(error => onButtonError(press, error));
}

export async function resumeHere() {
  const pass = await readPass();
  if (!isOn(pass)) return;
  const { key } = battleIn(pass);
  if (key) await pressHere(pass, key, 'resume');
}

export async function openHere(key, target = null) {
  const pass = await readPass();
  if (!isOn(pass) || !key || (target && idOf(target) !== pass.id)) return;
  if (battleIn(pass).card(key) !== 'ready') return;
  await pressHere(pass, key, 'open');
}

async function onInput(text) {
  if (typeof text !== 'string') return undefined;
  try {
    const pass = await readPass(null, { fresh: true });
    await compatForInput(pass); // the character card as the prompt will see it
    if (!pass) return undefined;
    const fixes = await pendingFixes(pass);

    if (!isOn(pass) || pass.unreadable) {
      if (needsWrite(fixes, { messages: false })) await writeFixes(pass, fixes, { messages: false });
      return undefined;
    }

    const aux = auxActive(pass) ? await auxCommand(pass, text) : null;
    const planned = await plannedWhat(pass, aux?.row);
    if (!liveOrigin(pass) && !planned && !acts.readQueue(pass.chat).actions.length && !needsWrite(fixes, { messages: false })) return undefined;
    const ctx = await storyCtx();
    const { attached } = await writeFixes(pass, fixes, { messages: false, attach: chat => {
      const origin = liveOrigin({ id: pass.id, chat });
      const from = planned ?? (origin && { target: origin, what: liveWhat(origin), acts: [] });
      const piece = from?.what && sendPiece(chat, from.target, from.what);
      const ooc = piece && markOoc(piece.text, piece.info);
      if (ooc) addSend(chat, from.target.key, { mark: ooc.mark, ...piece.send });

      const block = aux && ooc && addPlan(chat, from.target.key, (({ block: _, ...row }) => row)(aux.row)) ? aux.text : null;
      if (ooc) tellPlans(chat, from.target.key, from.acts, ooc.mark);
      return { ooc: ooc?.wrapped ?? null, block, tag: acts.attachQueue(chat, ctx, { salt: `${Date.now()}:${Math.random()}` }) };
    } });
    if (!attached?.ooc && !attached?.tag) return undefined;
    const mine = text.replace(/\s+$/, '');
    return `${attached.ooc ? oocAhead(attached.ooc, mine) : mine}${attached.block ? `\n\n${attached.block}` : ''}${attached.tag ? `\n${acts.tagText(attached.tag)}` : ''}`;
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

  const latest = acts.isLatestOwn(pass.chat, text);
  const naming = { names: dexName, lang: currentLang(pass.chat) };

  if (!text.includes('<pkb') && !acts.readQueue(pass.chat).actions.length && !(pass.moved && dropTaken(text) !== text)) {
    const log = latest ? acts.passingLog(pass.chat, await storyCtx(), naming) : '';
    return log ? `${text.replace(/\s+$/, '')}\n${log}` : undefined;
  }
  return acts.promptText(text, pass.chat, pass.table, { ...naming, guide: settings.oocTrial ? withGuide : null, commands: commandsOn(settings), moved: pass.moved,
    ctx: latest ? await storyCtx() : null });
}

let deviceBox = null, deviceReady = null;

let sharedSwitches = null;
const device = () => (deviceBox ??= deviceStore(risuai));

const deviceLoaded = () => (deviceReady ??= device().load().then(() => changed(), error => console.warn('[poke-battle] 이 기기 설정', error)));

async function onThisDevice(loaded) {
  sharedSwitches = deviceSettings(loaded);
  await deviceLoaded();
  return withDevice(loaded, device());
}

export const panelShiftNow = () => deviceShift(device()) ?? settings.panelShift;
let deviceWrites = Promise.resolve();

function keepOnDevice(before, next) {
  const store = device();
  if (!store.usable) return Promise.resolve();
  const changes = DEVICE_SETTINGS.filter(key => next[key] !== before[key]).map(key => [key, deviceValue(key, next[key])]).filter(([, value]) => value !== undefined);
  if (!changes.length) return deviceWrites;
  const write = () => Promise.all(changes.map(([key, value]) => store.set(key, value)));
  return deviceWrites = deviceWrites.then(write, write);
}

export async function setPanelSetting(key, value) {
  const own = deviceValue(key, value);
  if (own === undefined || settings[key] === own) return;
  await deviceLoaded();
  const next = { ...settings, [key]: own };
  changeSettings(next).catch(console.error);
  if (device().usable) return deviceWrites;
  return isUnreadable(settingsStatus) ? undefined : saveSettingsInOrder(next);
}

export async function setPanelShift(value) {
  await deviceLoaded();
  if (device().usable) {
    await device().set('panelShift', panelLift(value));
    changed();
    return;
  }
  const shift = panelLift(value);
  if (shift === settings.panelShift) return void changed();
  const next = { ...settings, panelShift: shift };
  changeSettings(next).catch(console.error);
  return isUnreadable(settingsStatus) ? undefined : saveSettingsInOrder(next);
}

export function taleValues(chat, lang) {
  const battles = chat ? { on: !battlesOff(chat), usable: !isUnreadable(readBattlesOff(chat).status) } : null;
  return { sendFormat: settings.sendFormat, sendFormats: SEND_FORMATS(lang), debug: settings.debug === true, typeHints: settings.typeHints === true,
    ...deviceSettings(settings), panelOpens: PANEL_OPEN_CHOICES(lang), battles };
}

export async function setTale(key, value, target) {
  if (DEVICE_SETTINGS.includes(key)) return setPanelSetting(key, value);
  if (key === 'battles') return target ? switchBattlesIn(target, !value) : undefined;
  if (!['sendFormat', 'debug', 'typeHints'].includes(key) || settings[key] === value) return undefined;
  if (normalizeSettings({ ...settings, [key]: value })[key] !== value) return undefined; // not one of its values
  return keepSettings({ ...settings, [key]: value });
}

let settingsApp;
let settingsSaves = Promise.resolve();

export function saveSettingsInOrder(next) {
  const save = () => saveSettings(risuai.pluginStorage, sharedPart(next, sharedSwitches, device()));
  return settingsSaves = settingsSaves.then(save, save);
}

export function changeSettings(next) {
  keepOnDevice(settings, next).catch(error => console.warn('[poke-battle] 이 기기 설정 저장', error));
  const switched = botsSwitched(settings, next);
  const commands = commandsOn(settings) !== commandsOn(next);
  const tools = (settings.effectItems === true) !== (next.effectItems === true);
  settings = next;
  soundFeed.changed(); // the volume of a battle or screen open now
  changed();
  if (switched.length || commands || tools) watchSoon();
  return Promise.all(switched.map(s => reconcileBot(s.name, s.on)));
}

function keepSettings(next) {
  changeSettings(next).catch(console.error);
  return isUnreadable(settingsStatus) ? undefined : saveSettingsInOrder(next);
}
let windowChanges = Promise.resolve();

function changeInWindow(target, next) {
  const change = async () => {
    if (target) {
      try { await writeChat(target, chat => [recordOptions(chat, next), recordSettingChange(chat, chatSettings(chat, next))].some(Boolean), { vars: true }); } catch (error) { console.error(error); }
    }
    return keepSettings(next);
  };
  return windowChanges = windowChanges.then(change, change);
}

const battleRuleOf = pass => (pass?.chat && isOn(pass) ? { value: battleRuleNow(pass.chat, settings).value, status: readBattleRule(pass.chat).status } : null);

function changeBattleRule(target, value) {
  const change = async () => {
    let after = null;
    const wrote = await writeChat(target, (chat, found) => {
      const changed = recordBattleRule(chat, value, settings);
      recordSettingChange(chat, chatSettings(chat, settings));
      after = battleRuleOf({ ...found, chat });
      return changed;
    }, { vars: true, missing: true });
    if (wrote === HELD) throw failed('writeBlocked');
    watchSoon();
    return after;
  };
  const done = windowChanges.then(change, change);
  windowChanges = done.catch(() => {});
  return done;
}
export async function openSettings() {
  if (settingsApp) return;
  settingsApp = true;
  const owner = {};
  let app = null;
  try {

    const preparing = mountPreparing({ lang: await openLang() });
    let pass, bot = null, persona, picture = null, imports = null, chatBattles = null, chatRule = null, packs = [];
    try {
      await showWindow(owner, { full: true });

      ({ settings, status: settingsStatus } = await loadSettings(risuai.pluginStorage));
      settings = await onThisDevice(settings); // this device's panel switches over the shared ones
      soundFeed.changed();
      ({ name: persona } = await personaLook()); // my gender, my back sprite and my picture belong to this persona
      if (persona) picture = await loadPicture(risuai.pluginStorage, persona);
      packs = await voicePacks.list(); // read from this device's store (failures read as none - voice-pack-store.js)
      pass = await readPass();
      if (pass) bot = { name: (await characterAt(pass.charIndex, pass.chat, { fresh: true }))?.name ?? '', compat: compatStatus.get(pass.target?.chaId) ?? '' };
      if (pass) imports = importsOf(pass.chat);
      if (pass) chatBattles = battlesOffOf(pass.chat);
      chatRule = battleRuleOf(pass);
    } finally { preparing.remove(); }
    const unreadable = isUnreadable(settingsStatus);
    const lang = currentLang(pass?.chat);
    app = mountSettings({ settings, bot, persona, notice: unreadable ? settingsUnreadable(lang) : '', picture, imports, battlesOff: chatBattles, battleRule: chatRule, voicePacks: packs, lang,
      inUse: { lang }, // the language row when no language is chosen
      onPicture: next => savePicture(risuai.pluginStorage, persona, next),
      onVoicePackAdd: files => voicePacks.add(files), onVoicePackRemove: id => voicePacks.remove(id),
      onPermission: askPermission, // "send the chat on" asks for sendChat when turned on
      onChange: next => changeInWindow(pass?.target, next),
      onImport: () => openImport(pass.target, next => app.setImports(next)),
      onCancelImport: id => cancelImportIn(pass.target, id),
      onBattlesOff: off => switchBattlesIn(pass.target, off),
      onBattleRule: value => changeBattleRule(pass.target, value),
      onClose: async () => { settingsApp = undefined; importApp?.close(); await hideWindow(owner); } });
    settingsApp = app;
  } finally {

    if (!app) { settingsApp = undefined; await hideWindow(owner); }
  }
}

const battlesOffOf = chat => ({ off: battlesOff(chat), status: readBattlesOff(chat).status });

async function switchBattlesIn(target, off) {
  let after = null;
  const wrote = await writeChat(target, (chat, found) => {
    importLock(found, chat);
    const done = setBattlesOff(chat, off);
    after = battlesOffOf(chat);
    return done;
  }, { vars: true, missing: true });
  if (wrote === HELD) throw failed('writeBlocked');
  watchSoon();
  return after;
}

let importApp;

const importsOf = chat => {
  const { status, imports } = readImports(chat);
  const lang = currentLang(chat);
  return { status, list: imports.filter(imp => !imp.kind && inForce(imp))
    .map(imp => ({ id: imp.id, time: imp.time, count: imp.mons.length, names: imp.mons.slice(0, IMPORT_NAMES_SHOWN).map(mon => importedName(mon, lang)) })) };
};

function importedName(mon, lang) {
  if (['auto', 'current'].includes(mon.from?.species)) return say(lang, 'panel.egg');
  const species = sim.Dex.species.get(mon.set?.species ?? '');
  return species.exists ? displayName(sim.Dex, namesFor(lang, sim), species.name, mon.set.name) : (mon.set?.name || String(mon.set?.species ?? ''));
}

const importLock = (found, chat = found.chat) => { if (battleIn({ id: idOf(found.target), chat }).key) throw failed('inBattle'); };

async function importStart(target) {
  const found = await locate(target);
  if (!found) throw failed('chatGone');
  if (!isOn(found)) throw failed('writeBlocked');
  importLock(found);
  const ctx = await storyCtx();
  const { state, holds } = acts.pendingState(found.chat, ctx);
  return { found, ctx, state, holds };
}

const draftGen = chat => battleRuleNow(chat, settings).gen;

async function openImport(target, applied) {
  if (importApp) return;
  const { found, ctx, state, holds } = await importStart(target);
  const draft = makeDraft(found.chat, state, ctx, { seed: freshSeed(), gen: draftGen(found.chat) });
  importApp = mountImportScreen({ draft, ctx, seed: freshSeed, lang: currentLang(found.chat), gen: draftGen(found.chat),
    onApply: async edited => applied(await applyImportTo(target, edited, ctx, holds)),
    onClose: () => { importApp = undefined; } });
}

async function debugScreen(target, screen) {
  if (!settings.debug || importApp) return;
  const { found, ctx, state, holds } = await importStart(target);
  const options = screen({ ctx, state, chat: found.chat });
  const owner = {};
  await showWindow(owner, { full: true });
  try {
    await new Promise(resolve => {
      importApp = mountImportScreen({ ctx, seed: freshSeed, lang: currentLang(found.chat), gen: draftGen(found.chat), ...options,
        onApply: edited => applyImportTo(target, edited, ctx, holds), onClose: () => { importApp = undefined; resolve(); } });
    });
  } finally { await hideWindow(owner); }
}

export const debugAdd = (where, target) => debugScreen(target, ({ ctx, state, chat }) => (where === 'bag' ? { mode: 'bag', state }
  : { mode: 'create', draft: newMonDraft(ctx, { place: where, seed: freshSeed(), gen: draftGen(chat) }) }));

export const debugEdit = (uid, target) => debugScreen(target, ({ ctx, state }) => ({ mode: 'edit', draft: currentMonDraft(ctx, state, uid) }));

export async function debugLock(uid, locked, target) {
  if (!settings.debug) return;
  const { ctx, state, holds } = await importStart(target);
  await applyImportTo(target, friendshipLockDraft(ctx, state, uid, locked), ctx, holds);
}

export async function debugHeal(target) {
  if (!settings.debug) return;
  await importStart(target);
  await writeImportRecord(target, chat => { commitDebugHeal(chat); return true; });
}

export async function debugBadges(badges, target) {
  if (!settings.debug) return;
  await importStart(target);
  await writeImportRecord(target, chat => { commitDebugBadges(chat, badges); return true; });
}

async function writeImportRecord(target, write) {
  const wrote = await writeChat(target, (chat, found) => {
    importLock(found, chat);
    return write(chat);
  }, { vars: true, missing: true });
  if (wrote === HELD) throw failed('writeBlocked');
  return wrote;
}

async function applyImportTo(target, draft, ctx, holds = []) {
  return writeImportRecord(target, chat => {

    try { commitImport(chat, draft, ctx, { now: Date.now(), held: acts.heldRecords(chat, holds), state: acts.pendingState(chat, ctx).state }); } catch (error) { throw refused(error); }
    return importsOf(chat);
  });
}

async function cancelImportIn(target, id) {
  let after = null;
  await writeImportRecord(target, chat => {
    const done = cancelImport(chat, id);
    after = importsOf(chat);
    return done && after;
  });
  return after;
}

const ASKED_KEY = 'pkb_import_asked';
const ASKED_MAX = 500; // oldest names drop off first
let askedChats = null; // Promise<string[]> - read once
const askedList = () => askedChats ??= (async () => {
  try {
    const list = JSON.parse(await risuai.pluginStorage.getItem(ASKED_KEY) ?? '[]');
    return Array.isArray(list) ? list.filter(id => typeof id === 'string') : [];
  } catch { return []; }
})();

const importAllowed = x => isOn(x) && !x.unreadable && !battleIn(x).key;
let offerSeen = null;

const notCompatBot = x => (x?.target?.chaId && compatSeen.has(x.target.chaId) ? !compatBots.has(x.target.chaId) : null);

const knownOtherBot = x => notCompatBot(x) === true;

const askedKey = (id, chat) => { const back = importTurn(chat).back; return back ? `${id}:${back.id}` : id; };

async function offerOf(pass) {
  const allowed = importAllowed(pass);
  const other = knownOtherBot(pass);
  const key = JSON.stringify([pass.key, allowed, other]);
  if (offerSeen?.key !== key) {
    const state = await pass.state();
    offerSeen = { key, offer: !!importOffer(pass.chat, state, await storyCtx(), { allowed }) || (other && importOfferAi(pass.chat, state, { allowed })) };
  }
  return offerSeen.offer ? { note: !(await askedList()).includes(askedKey(pass.id, pass.chat)), button: true } : null;
}

async function markAsked(target) {
  const list = await askedList();
  const found = await locate(target);
  if (!found) return;
  const id = askedKey(idOf(target), found.chat);
  if (list.includes(id)) return;
  list.push(id);
  list.splice(0, Math.max(0, list.length - ASKED_MAX));
  changed();
  await risuai.pluginStorage.setItem(ASKED_KEY, JSON.stringify(list)).catch(error => console.warn('[poke-battle] 불러오기 알림을 기억하지 못함', error));
}

export const importLater = target => markAsked(target);

export async function quickImport(target, { asked = false } = {}) {
  if (asked) await markAsked(target);
  if (importApp) return;
  const { found, ctx, state, holds } = await importStart(target);
  const offered = importOffer(found.chat, state, ctx, { allowed: true, seed: freshSeed() });

  const ai = !offered && knownOtherBot(found) && importOfferAi(found.chat, state, { allowed: true });
  const draft = offered ?? makeDraft(found.chat, state, ctx, { seed: freshSeed(), gen: draftGen(found.chat) });
  const options = ai ? { mode: 'aiAsk', manual: aiDraft(found.chat, state, ctx, aiFailedFound()), readAi: () => readPartyByAux(target, ctx) }
    : { mode: offered ? 'quick' : 'import', draft, money: bagMoney(found.chat, compatBots.has(found.target.chaId)) }; // the panel's bag line (storyNow compat)
  const owner = {};
  await showWindow(owner, { full: true });
  try {
    await new Promise(resolve => {
      importApp = mountImportScreen({ ...options, ctx, seed: freshSeed, lang: currentLang(found.chat), gen: draftGen(found.chat),
        onApply: edited => applyImportTo(target, edited, ctx, holds), onClose: () => { importApp = undefined; resolve(); } });
    });
  } finally { await hideWindow(owner); }
}

const aiDraft = (chat, state, ctx, found) => makeDraft(chat, state, ctx, { seed: freshSeed(), found, gen: draftGen(chat) });

async function readPartyByAux(target, ctx) {
  const { found, state } = await importStart(target);
  const messages = importAiMessages(found.chat, { recent: settings.importRecent }); // the setting "messages to read" (settings.js)
  let read = { why: 'noBlock' };
  if (messages) {
    try { read = readAiParty(await askAux({ messages, mode: FORGE_MODE, allowPlugins: true }), ctx, { owned: ownsExpShare(state) }); } catch (error) { read = { why: 'aiCall', error }; }
  }
  if (read.why) console.warn('[poke-battle] 보조 모델로 파티를 읽지 못함', read.why, read.error ?? '');
  return aiDraft(found.chat, state, ctx, read.found ?? aiFailedFound());
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
  let seen = null;
  try {
    settle();
    const reading = readPass(); // the screen changed - read again (this turn's panel shares this read)
    changed();
    const pass = await reading;
    seen = pass?.id ?? null;
    await fitActive();
    if (!pass) return;
    checkCompat(pass);
    guardResult(pass);

    const held = watchHold(pass);
    if (held) watchLater(held);
    if (!isOn(pass)) return held ? undefined : await catchUp(pass); // a chat of a bot that is off: our derived things are taken out, nothing else
    seeReply(pass);
    await bindButtons();
    await checkActive(pass);
    if (!held) {
      await checkPlans(pass);
      await catchUp(pass);
    } else await catchLost(pass);
    await refreshDrawn(pass);
    await refreshForge(pass);
    await shops.refresh(pass);
  } catch (error) { console.error(error); }
  finally {
    watching = false;
    if (watchAgain) { watchAgain = false; watchSoon(); }
    recheckQuiet(seen);
  }
}

function recheckQuiet(id) {
  const wait = id === null ? 0 : quietIn(id);
  if (wait && !watchTimer) watchTimer = setTimeout(watchNow, wait);
}

export async function startStoryLink() {
  ({ settings, status: settingsStatus } = await loadSettings(risuai.pluginStorage));
  settings = await onThisDevice(settings); // this device's panel switches over the shared ones
  soundFeed.changed();

  try {
    const name = await personaName(risuai);
    playerGender = lookOf(name ? adoptOldLook(settings, name) : settings, name).gender;
  } catch { /* the default gender */ }
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

  startReplacer().catch(error => console.warn('[poke-battle] 보내는 글 바로잡기를 켜지 못함', error));
}
