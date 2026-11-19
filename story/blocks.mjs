import speciesTable from '../data/names/species.json' with { type: 'json' };
import movesTable from '../data/names/moves.json' with { type: 'json' };
import abilitiesTable from '../data/names/abilities.json' with { type: 'json' };
import itemsTable from '../data/names/items.json' with { type: 'json' };
import storyNames from '../data/story-names.json' with { type: 'json' };
import aiForms from '../data/names/ai-forms.json' with { type: 'json' };
import { PARTY_MAX, PAIR_TEAM_MAX, MAX_LEVEL, MAX_MOVES, MAX_IV, OT_NAME_MAX } from './rules.mjs';
import { STATS } from '../engine/mon.mjs';
import { toID, koSpellings, readsOfficial } from '../names/index.js';
import { DEFAULT_EMOJI, CUSTOM_EFFECTS, customItemId, splitEmoji, topEffect } from './custom-items.mjs';
import { ruleNote } from './failure.mjs';
import { readTime, clockHourOf, regionIn } from './compat.mjs';
import { DEFAULT_STANDARD, regionStandard, parseMachineId, isMachineId as isTm } from './machine-standards.mjs';
import { machineByMove, machineByNumber, hasMachineKind, nearestStandards } from './item-info.mjs';
import { norm } from './norm.mjs';
import { readHair, readOutfit } from './trainer-colors.mjs';
import { readStyles } from './trainer-pool.mjs';
import { ITEM_EFFECTS_READY } from './item-effects.mjs';
import { readFormWords } from './form-words.mjs';

export { norm };

const TABLES = { species: speciesTable, moves: movesTable, abilities: abilitiesTable, items: itemsTable };
const reverse = {};

const ITEM_ALIASES = Object.freeze({
  linkingcord: ['링킹코드'], leafstone: ['잎의돌', '나뭇잎의돌'], thunderstone: ['번개의돌'], shinystone: ['빛나는돌'], metalcoat: ['메탈코트'],
  kingsrock: ['왕의징표', '킹스락'], dragonscale: ['드래곤스케일'], dubiousdisc: ['수상한디스크', '괴상한디스크'], reapercloth: ['영계의옷'],
  electirizer: ['일렉트라이저'], magmarizer: ['마그마라이저'], sachet: ['향주머니'],
});

function buildReverse(kind, official) {
  const names = new Map(), aliases = new Map(), legacy = new Map();
  const add = (k, id) => { if (!k) return; const old = names.get(k); if (old === undefined || id.length < old.length) names.set(k, id); };
  const alias = (k, id) => { if (!k) return; aliases.set(k, aliases.has(k) && aliases.get(k) !== id ? null : id); };
  for (const [id, r] of Object.entries(TABLES[kind])) {
    if (r.en) add(toID(r.en), id), add(norm(r.en), id);
    // Scarlet/Violet discs were named TM011 / 기술머신011 before discs carried their move and region
    const disc = kind === 'items' && parseMachineId(id);
    if (disc && disc.std === DEFAULT_STANDARD) for (const old of ['TM', '기술머신']) legacy.set(norm(`${old}${String(disc.number).padStart(3, '0')}`), id);
    if (kind === 'items') for (const other of ITEM_ALIASES[id] ?? []) alias(norm(other), id);
    const [ko, ...before] = koSpellings(r, { officialKo: official });
    if (!ko) continue;
    add(norm(ko), id);
    for (const other of before) alias(norm(other), id);
    if (kind === 'items' && ko.includes('의')) alias(norm(ko.replaceAll('의', '')), id);

    const m = /^(.+?)\s*\((.+)\)$/.exec(ko);
    if (kind !== 'species' || !m) continue;
    const base = norm(m[1]), inner = norm(m[2]);
    if (inner.includes(base)) alias(inner, id);
    const region = /^(.+)의 ?모습$/.exec(m[2].trim());
    if (region) alias(norm(region[1]) + base, id), alias(base + norm(region[1]), id);
  }
  return reverse[`${kind}:${official}`] = { names, aliases, legacy };
}

export const readsFormNames = reading => reading?.aiFormNames !== false;

export const readsItemTags = reading => ITEM_EFFECTS_READY && reading?.itemTags !== false;

export const readsFoeLooks = reading => reading?.foeLooks !== false;

export const readsTrainerColors = reading => reading?.trainerColors !== false;
const COLOR_KEYS = new Set(['hair', 'outfit', 'foePartnerHair', 'foePartnerOutfit']);

export const readsMobStyles = reading => reading?.mobStyles !== false;
const STYLE_KEYS = new Set(['outfitStyle', 'foePartnerStyle']);
const FIELD_RE = /^\s*(effect|for)(?:\s*[:：]\s*|\s+)(\S.*?)\s*$/iu;

const FOR_TAIL_RE = /^(?:(\S+)\s+)?for(?:\s*[:：]\s*|\s+)(\S.*)$/iu;

function itemField(part) {
  const m = FIELD_RE.exec(part);
  if (!m) return null;
  if (m[1].toLowerCase() === 'for') return { effect: null, owner: m[2] };
  const tail = FOR_TAIL_RE.exec(m[2]);
  return tail ? { effect: tail[1]?.toLowerCase() ?? null, owner: tail[2] } : { effect: m[2].toLowerCase(), owner: '' };
}

const joinField = (got, field) => ({ effect: topEffect(got.effect ?? [], field.effect ?? []), owner: field.owner || got.owner });

function takeFields(value, read) {
  const none = { text: String(value), effect: null, owner: '' };
  if (!read) return none;
  const parts = String(value).split(/[|｜]/);
  let got = { effect: null, owner: '' }, found = false;
  const kept = [parts[0]];
  for (const part of parts.slice(1)) {
    const field = itemField(part);
    if (!field) { kept.push(part); continue; }
    found = true;
    got = joinField(got, field);
  }
  return found ? { text: kept.join('|').trim(), ...got } : none;
}

function takeTag(text, tags) {
  const m = tags ? /^(.*\S)\s+(\S+)$/u.exec(String(text).trim()) : null;
  return m && CUSTOM_EFFECTS.includes(m[2]) && /\p{L}/u.test(m[1]) ? { name: m[1], tag: m[2] } : { name: String(text).trim(), tag: null };
}

const MEGA_TATSUGIRI = ['Mega Tatsugiri'];
const SHARED_FORMS = Object.freeze({
  meowsticmmega: { gender: 'M', from: 'meowstic' }, meowsticfmega: { gender: 'F', from: 'meowsticf' },
  tatsugiricurlymega: { from: 'tatsugiri', also: MEGA_TATSUGIRI }, tatsugiridroopymega: { from: 'tatsugiridroopy', also: MEGA_TATSUGIRI },
  tatsugiristretchymega: { from: 'tatsugiristretchy', also: MEGA_TATSUGIRI },
});

export function pickForm(ids, { gender, species, seed } = {}) {
  const fits = ids.filter(id => (!gender || !SHARED_FORMS[id].gender || SHARED_FORMS[id].gender === gender)
    && (!species || id === species || SHARED_FORMS[id].from === species));
  if (fits.length === 1) return fits[0];
  if (seed === undefined) return null;
  const among = fits.length ? fits : ids;
  return among[seededIndex(seed, among.length)];
}

let formReverse;
function buildFormReverse() {
  const keys = new Map(), named = new Map();
  const add = (k, id) => {
    if (!k) return;
    named.set(k, [...new Set([...(named.get(k) ?? []), id])]);
    if (!keys.has(k)) return void keys.set(k, id);
    const old = keys.get(k);
    keys.set(k, old === null || old === id ? old : old.length < id.length && id.startsWith(old) ? old : id.length < old.length && old.startsWith(id) ? id : null);
  };
  for (const [id, row] of Object.entries(aiForms)) {
    if (!Array.isArray(row) || !Object.hasOwn(speciesTable, id)) continue;

    const [en, ko, ...old] = row;
    if (ko) add(norm(ko), id);
    for (const name of [en, ...old, ...(SHARED_FORMS[id]?.also ?? [])]) {
      add(toID(name), id), add(norm(name), id);
      if (ko) add(norm(`${name}(${ko})`), id);
    }
  }

  for (const [k, id] of keys) if (id === null && named.get(k).every(f => Object.hasOwn(SHARED_FORMS, f))) keys.set(k, named.get(k));
  return formReverse = keys;
}

const formId = (id, k) => { const keys = formReverse ?? buildFormReverse(); return (id ? keys.get(id) : null) ?? keys.get(k) ?? null; };

const NON_LATIN = /(?=\p{L})\P{Script=Latin}/u;

export function lookupId(kind, raw, { allLetters = false, reading, form } = {}) {
  const found = readId(kind, raw, allLetters, reading);
  return Array.isArray(found) ? pickForm(found, { seed: String(raw ?? '').trim(), ...form }) : found;
}

export function sharedForms(raw, reading) {
  const found = readId('species', raw, false, reading);
  return Array.isArray(found) ? found : null;
}
function readId(kind, raw, allLetters, reading) {
  const table = TABLES[kind];
  if (!table) throw new TypeError(`모르는 이름표: ${kind}`);
  const id = allLetters && NON_LATIN.test(String(raw ?? '')) ? '' : toID(raw);
  const official = readsOfficial(reading);
  const { names, aliases, legacy } = reverse[`${kind}:${official}`] ?? buildReverse(kind, official);
  const k = norm(raw);
  // In story text a disc number follows the region's standard ("TM011" in Kanto is not Paldea's tm011, and "TR04"
  // is the Galar disc rather than Showdown's TR04 item); a disc's own full name or id is taken as it is
  if (kind === 'items' && reading?.regionMachines) {
    const own = discNamed(raw, names);
    if (own) return own;
    const ref = machineRef(raw, reading);
    if (ref !== undefined) return ref;
  }
  // Messages before a chat's regionMachines mark never saw region discs: their names and ids read as they always did
  const unseen = found => kind === 'items' && reading?.regionMachines === false && isTm(found) && parseMachineId(found).std !== DEFAULT_STANDARD;
  if (id && Object.hasOwn(table, id) && !unseen(id)) return id;
  const old = kind === 'items' && !reading?.regionMachines;
  const named = names.get(id) ?? names.get(k) ?? aliases.get(k) ?? (old ? legacy.get(k) : undefined);
  if (named && !unseen(named)) return named;
  return (old ? legacyTmId(raw, reading) : null)
    ?? (kind === 'species' && readsFormNames(reading) ? formId(id, k) ?? formWords(raw, reading) : null);
}

const formWords = (raw, reading) => readFormWords(raw, { readHalf: half => readId('species', half, false, reading), shared: id => Object.hasOwn(SHARED_FORMS, id) });

// The reading before region standards, kept as it was for messages before a chat's regionMachines mark and for text
// read outside a message: Scarlet/Violet TMs only, by number or by move
function legacyTmId(raw, reading) {
  const m = /^\s*(?:tm|기술\s*머신)\s*[-:.#]?\s*(.+?)\s*$/i.exec(raw) ?? /^\s*(.+?)\s*[-:.]?\s*(?:tm|기술\s*머신)\s*$/i.exec(raw);
  if (!m) return null;
  if (/^\d{1,3}$/.test(m[1])) return machineByNumber(DEFAULT_STANDARD, 'tm', Number(m[1]));
  const move = lookupId('moves', m[1], { reading });
  return move ? machineByMove(DEFAULT_STANDARD, move, 'tm', { exact: true }) : null;
}

const MACHINE_KIND_WORDS = Object.freeze({ tm: ['tm', '기술머신'], hm: ['hm', '비전머신'], tr: ['tr', '기술레코드'] });
const KIND_WORD = '(tm|hm|tr|기술\\s*머신|비전\\s*머신|기술\\s*레코드)';
const MACHINE_HEAD = new RegExp(`^\\s*${KIND_WORD}(.*)$`, 'i');
const MACHINE_TAIL = new RegExp(`^(.*?)([\\s\\-:.]*)${KIND_WORD}\\s*$`, 'i');
const MACHINE_AFTER = new RegExp(`^(.*?\\S)(\\s*)${KIND_WORD}\\s*[-:.#]?\\s*(\\d{1,3})\\s*$`, 'i');
const LATIN_KIND = /^[a-z]+$/i;
// Parentheses, also the fullwidth ones a Japanese reply uses (built from code points so the font subset ignores them)
const [WIDE_OPEN, WIDE_CLOSE] = [0xff08, 0xff09].map(c => String.fromCharCode(c));
const PAREN = new RegExp(`[(${WIDE_OPEN}]([^()${WIDE_OPEN}${WIDE_CLOSE}]*)[)${WIDE_CLOSE}]`, 'g');
const OUTER_PAREN = new RegExp(`^[(${WIDE_OPEN}](.*)[)${WIDE_CLOSE}]$`);
const DISC_NUMBER_END = new RegExp(`^(.*?)(\\s*)${KIND_WORD}\\s*[-:.#]?\\s*\\d{1,3}\\s*$`, 'i');
const SIGNED_COUNT = /\s[+-]\s*\d[\d,]*$/;
// Messages before a chat's regionMachines mark keep the TM-only test they were read with
const LEGACY_TM_NUMBER = /^\s*(?:tm|기술\s*머신)\s*[-:.#]?\s*\d{1,3}\s*$/i;
// With no reading at all, names are looked up the old way, which reads only a bare disc number as one (TM11, TR43)
const BARE_DISC_NUMBER = /^\s*(?:tm|hm|tr|기술\s*머신|비전\s*머신|기술\s*레코드)\s*[-:.#]?\s*\d{1,3}\s*$/i;

// A Latin kind word must stand apart from the words around it: Tri-Pass is not a TR, while TM11, TM(Surf), Surf HM and
// Surf(파도타기)HM are discs
const apartBefore = (kind, gap, before) => !LATIN_KIND.test(kind) || !!gap || !/[\p{L}\p{N}]$/u.test(before);
const apartAfter = (kind, after) => !LATIN_KIND.test(kind) || !/^\p{L}/u.test(after);

// A number ending an item line after a disc kind word is the disc's number, not a count, when only region tags or a
// move come before the kind word (TM11, (Kanto) TM11, TM (Kanto) 11, 거품광선 기술머신11). A sign after a space is always
// a count (거품광선 기술머신 -1), and so is a number after a kind word that ends some other name (고장난 기술머신 3).
function discNumberEnds(rest, reading) {
  const raw = rest.trim();
  if (SIGNED_COUNT.test(raw)) return false;
  const text = raw.replace(PAREN, (all, inner) => (regionIn(inner) ? ' ' : all)).trim();
  const m = DISC_NUMBER_END.exec(text);
  if (!m || !apartBefore(m[3], m[2], m[1])) return false;
  const left = m[1].replace(/[\s\-:.#]+/g, ' ').trim();
  return !left || !!moveNamed(m[1], reading);
}

const kindOf = word => {
  const w = word.toLowerCase().replace(/\s+/g, '');
  return Object.keys(MACHINE_KIND_WORDS).find(kind => MACHINE_KIND_WORDS[kind].includes(w));
};

// { kind, rest } when the text names a TM/HM/TR ("TM11", "HM03 Surf", "TM: Surf", "기술머신 거품광선", "Surf HM",
// "거품광선 기술머신11"), else null; rest is "<number> <move>" in whatever parts were written. A Latin kind word must
// stand apart from the rest (Tri-Pass is not a TR), and words before a kind word and number must be a move (고장난
// 기술머신11 is no disc).
function machineParts(raw, isMove) {
  const text = String(raw ?? '');
  const head = MACHINE_HEAD.exec(text);
  if (head && head[2].trim() && apartAfter(head[1], head[2])) return { kind: kindOf(head[1]), rest: head[2] };
  const after = MACHINE_AFTER.exec(text);
  if (after && apartBefore(after[3], after[2], after[1]) && isMove(after[1])) return { kind: kindOf(after[3]), rest: `${after[4]} ${after[1]}` };
  const tail = MACHINE_TAIL.exec(text);
  if (tail && tail[1].trim() && apartBefore(tail[3], tail[2], tail[1])) return { kind: kindOf(tail[3]), rest: tail[1] };
  return null;
}

const opensParen = c => c === '(' || c === WIDE_OPEN, closesParen = c => c === ')' || c === WIDE_CLOSE;

// Where the parenthesized group that ends the text opens, or -1
function trailingGroup(text) {
  if (!closesParen(text.at(-1))) return -1;
  let depth = 0;
  for (let i = text.length - 1; i >= 0; i--) {
    if (closesParen(text[i])) depth++;
    else if (opensParen(text[i]) && --depth === 0) return i;
  }
  return -1;
}

// The bot is shown names as English(Korean) the first time; a trailing Korean gloss after English text is dropped
function dropGloss(raw) {
  const text = String(raw ?? '').trim();
  const at = trailingGroup(text);
  if (at < 0) return text;
  const before = text.slice(0, at);
  return /[가-힣]/.test(text.slice(at)) && /[a-z]/i.test(before) ? before.trim() : text;
}

// A move as the bot writes it: as it is, without a trailing gloss in either language (Thunderbolt(10만볼트), 10만볼트
// (Thunderbolt)), since move names hold no parentheses, or inside one pair of parentheses (TM (Thunderbolt(10만볼트)))
function moveNamed(raw, reading) {
  const text = String(raw ?? '').trim().replace(/[\s\-:.#]+$/, '');
  const bare = t => { const at = trailingGroup(t); return at > 0 ? t.slice(0, at).trim() : t; };
  const inner = OUTER_PAREN.exec(text)?.[1]?.trim();
  for (const t of new Set([text, bare(text), inner, inner && bare(inner)])) {
    const move = t && lookupId('moves', t, { reading });
    if (move) return move;
  }
  return null;
}

// A disc's full name (TM11 Bubble Beam (Kanto) / 기술머신11 거품광선 (관동)) or a region disc's id written as it is (tm011rb)
function discNamed(raw, names) {
  for (const text of new Set([String(raw ?? ''), dropGloss(String(raw ?? ''))])) {
    const id = toID(text), named = names.get(id) ?? names.get(norm(text));
    if (named && isTm(named)) return named;
    const disc = parseMachineId(id);
    if (disc && disc.std !== DEFAULT_STANDARD && Object.hasOwn(itemsTable, id)) return id;
  }
  return null;
}

// A region in parentheses names the standard printed on that region's discs ((Kanto) is Red/Blue whatever era the
// bot's world is in); a region without discs (Hisui) is read as Scarlet/Violet
const tagStandard = region => regionStandard(region) ?? DEFAULT_STANDARD;

// A disc named in story text: undefined when the text is not one, null when it is but names no disc. The standard
// is a region written in parentheses ("TM11 (Kanto)"), else the message's (reading.machineStd). A move name wins over
// a number that does not match it; a move the standard has no disc for, or a kind it has none of (HMs in Paldea), is
// looked up in the nearest standards instead. "TM" is often said of any disc, so it takes the standard's disc of
// whatever kind (TM Surf in Kanto is HM03); "HM" and "TR" are said on purpose and keep their kind (HM03 Surf in Paldea
// is still an HM, and an HM no game had is no disc).
function machineRef(raw, reading) {
  let tagged = null;
  const text = String(raw ?? '').replace(PAREN, (all, inner) => {
    const region = regionIn(inner);
    if (!region) return all;
    tagged ??= tagStandard(region);
    return ' ';
  });
  // Region tags are already out, so a Korean gloss is all dropGloss can take: it is dropped from the name only when the
  // name with it is no disc form (Surf HM(파도타기 비전머신)); a Korean move in parentheses (TM (거품광선)) stays the move
  const isMove = t => !!moveNamed(t, reading);
  const parts = machineParts(text.trim(), isMove) ?? machineParts(dropGloss(text), isMove);
  if (!parts) return undefined;
  const std = tagged ?? reading?.machineStd ?? DEFAULT_STANDARD;
  const rest = parts.rest.replace(/^[\s\-:.#]+/, '').trim();
  // The whole rest first: Korean move names can start with digits (10만볼트)
  const whole = moveNamed(rest, reading);
  const m = /^(\d{1,3})(?!\d)\s*[-:.]?\s*(.*)$/.exec(rest);
  const number = !whole && m ? Number(m[1]) : null;
  const move = whole ?? (m?.[2] ? moveNamed(m[2], reading) : null);
  if (move) {
    const order = nearestStandards(std);
    if (parts.kind !== 'tm') return order.map(s => machineByMove(s, move, parts.kind, { exact: true })).find(Boolean) ?? null;
    return order.map(s => machineByMove(s, move, parts.kind)).find(Boolean) ?? null;
  }
  if (number === null) return null;
  const own = machineByNumber(std, parts.kind, number);
  if (own || hasMachineKind(std, parts.kind)) return own;
  return nearestStandards(std).filter(s => hasMachineKind(s, parts.kind)).map(s => machineByNumber(s, parts.kind, number)).find(Boolean) ?? null;
}

export function speciesName(raw, reading, form) {
  const id = lookupId('species', raw, { reading, form });
  return id ? speciesTable[id].en : null;
}

const note = (rule, values) => ruleNote(`block.${rule}`, values);

function need(kind, raw, errors, reading) {
  const id = lookupId(kind, raw, { reading });
  if (!id) errors.push(note(`unknown.${kind}`, { name: String(raw).trim() }));
  return id;
}

// Short word tables: normalized name -> value
const words = groups => {
  const m = new Map();
  for (const [value, list] of Object.entries(groups)) for (const w of list) m.set(norm(w), value);
  return m;
};
const GENDER = words({ M: ['male', 'm', '♂', 'boy', 'man', '남', '남자', '남성', '수컷', '수'], F: ['female', 'f', '♀', 'girl', 'woman', '여', '여자', '여성', '암컷', '암'] });
const STATUS = words({
  '': ['none', 'ok', 'healthy', '없음', '정상', '건강'],
  par: ['par', 'paralysis', 'paralyzed', '마비'], brn: ['brn', 'burn', 'burned', '화상'], slp: ['slp', 'sleep', 'asleep', '잠듦', '잠', '수면', '잠듬'],
  frz: ['frz', 'freeze', 'frozen', '얼음', '동결'], psn: ['psn', 'poison', 'poisoned', '독'], tox: ['tox', 'toxic', 'badlypoisoned', '맹독'],
});

const SHINY = words({
  yes: ['yes', 'y', 'true', 'on', 'o', '1', 'shiny', '예', '네', '응', '맞음', '맞다', '이로치', '색이다름'],
  no: ['no', 'n', 'false', 'off', 'x', '0', 'not', 'none', 'nope', 'normal', '아니', '아님', '아니오', '아니요', '아니다', '없음', '일반', '보통'],
});
const NOT_SHINY = new Set(['notshiny', 'nonshiny', 'noshiny', '이로치아님', '이로치아니다', '이로치아니']);
const OPPONENT = words({ wild: ['wild', '야생'], trainer: ['trainer', '트레이너', '사람'] });
const RANK = words({ normal: ['normal', '일반', '보통'], boss: ['boss', '보스', 'ace', '강적'] });
const BOSS_CLASS = /관장|사천왕|챔피언|gym\s*leader|elite\s*four|champion/i;

const LOOKS = words({
  boy: ['boy', 'youngboy', '소년', '남자아이', '남자애'], girl: ['girl', 'younggirl', '소녀', '여자아이', '여자애'],
  young_man: ['youngman', '청년', '젊은남자', '젊은남성'], young_woman: ['youngwoman', 'younglady', '숙녀', '아가씨', '젊은여자', '젊은여성'],
  middle_aged_man: ['middleagedman', '중년남자', '중년남성', '아저씨'], middle_aged_woman: ['middleagedwoman', '중년여자', '중년여성', '아주머니', '아줌마'],
  old_man: ['oldman', 'elderlyman', '노인', '할아버지', '노인남자'], old_woman: ['oldwoman', 'elderlywoman', '할머니', '노부인', '노인여자'],

  toddler: ['toddler', 'littlekid', 'preschooler', '유아', '아기', '꼬마', '어린아이', '유치원생'],
});

export const LOOK_GENDER = { boy: 'M', girl: 'F', young_man: 'M', young_woman: 'F', middle_aged_man: 'M', middle_aged_woman: 'F', old_man: 'M', old_woman: 'F' };

const readLook = (value, styleFields) => {
  const l = LOOKS.get(norm(value));
  return l === 'toddler' && !styleFields ? undefined : l;
};

export const seededIndex = (seed, n) => parseInt(hashKey(seed), 36) % n;

export function hashKey(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const n = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return (n % 36 ** 8).toString(36).padStart(8, '0');
}

const BLOCK_KINDS = 'battle|change|end|act|shop';

const BLOCK_RE = new RegExp(String.raw`<\s*pkb-(${BLOCK_KINDS})\s*>([\s\S]*?)<\s*\/\s*pkb-\1\s*>`, 'gi');
const TAG_RE = /<pkb#([a-z0-9]+)>/g;

const MARK_RE = /<pkb!([a-z]):([a-z0-9]+)>/g;

export const MARK = { open: 'p', discarded: 'x', here: 'h', moved: 'm', openedAt: 'w' };

export const readsBlockEdges = reading => reading?.blockEdges !== false;

export function findBlocks(text, reading) {
  const s = String(text ?? '');
  if (!readsBlockEdges(reading)) return [...s.matchAll(BLOCK_RE)].map(m => blockOf(m[1], m[2], m.index, m.index + m[0].length));
  return [...mentionsOut(s).matchAll(NARROW_RE)].map(m => {
    const from = m.index + m[0].indexOf('>') + 1;
    return blockOf(m[1], s.slice(from, from + m[2].length), m.index, m.index + m[0].length);
  });
}
const blockOf = (kind, body, start, end) => ({ kind: kind.toLowerCase(), body, start, end, key: hashKey(body.trim()) });

const NARROW_RE = new RegExp(String.raw`<\s*pkb-(${BLOCK_KINDS})\s*>((?:(?!<\s*pkb-\1\s*>)[\s\S])*?)<\s*\/\s*pkb-\1\s*>`, 'gi');

const CODE_SPAN_RE = /(?<!`)(`+)(?!`)[^\n]*?[^`\n]\1(?!`)/g;

const REASONING_RE = /<\s*(thoughts|think)\s*>[\s\S]*?<\s*\/\s*\1\s*>/gi;

const blank = part => part.replace(/[^\n]/g, ' ');

function spanMentionsOut(span) {
  let out = '', from = 0;
  for (const m of span.matchAll(NARROW_RE)) { out += blank(span.slice(from, m.index)) + m[0]; from = m.index + m[0].length; }
  return out + blank(span.slice(from));
}

const mentionsOut = text => codeMentionsOut(text).replace(REASONING_RE, blank);
const codeMentionsOut = text => text.replace(CODE_SPAN_RE, spanMentionsOut);

const OPEN_TAG_RE = new RegExp(String.raw`<\s*pkb-(${BLOCK_KINDS})\s*>`, 'gi');
const CLOSE_TAG_RE = new RegExp(String.raw`<\s*\/\s*pkb-(?:${BLOCK_KINDS})\s*>$`, 'i');

const REASONING_TAG_RE = /<\s*\/?\s*(?:thoughts|think)\s*>/gi;

function pastReasoning(text, start, closeAt) {
  let from = start;
  for (const m of text.slice(start, closeAt).matchAll(REASONING_TAG_RE)) from = start + m.index + m[0].length;
  return from;
}

function cutStart(text, block, edges) {
  const whole = text.slice(block.start, block.end);
  const closeAt = block.end - CLOSE_TAG_RE.exec(whole)[0].length;
  let from = block.start;
  if (!edges) for (const m of whole.slice(0, closeAt - block.start).matchAll(OPEN_TAG_RE)) if (m[1].toLowerCase() === block.kind) from = block.start + m.index;
  return pastReasoning(text, from, closeAt);
}

export function blockCuts(text, reading) {
  const s = String(text ?? ''), edges = readsBlockEdges(reading);
  const cuts = findBlocks(s, reading).map(block => ({ start: cutStart(s, block, edges), end: block.end, block }));
  if (edges) spanCuts(s, cuts);

  const whole = edges && reading ? drafts(s) : (from, to) => wholeBlocks(s, from, to);
  const loose = [];
  cuts.forEach((cut, i) => {
    const from = i ? cuts[i - 1].end : 0;
    loose.push(...whole(from, cut.start));
  });
  loose.push(...whole(cuts.at(-1)?.end ?? 0, s.length));
  return [...cuts, ...loose].sort((a, b) => a.start - b.start);
}

function wholeBlocks(text, from, to, masked = text) {
  return [...masked.slice(from, to).matchAll(NARROW_RE)].map(m => {
    const start = from + m.index, end = start + m[0].length;
    return { start: pastReasoning(text, start, end - CLOSE_TAG_RE.exec(m[0])[0].length), end };
  });
}

function drafts(text) {
  const masked = codeMentionsOut(text), reasoning = [...masked.matchAll(REASONING_RE)].map(m => [m.index, m.index + m[0].length]);
  return (from, to) => reasoning.flatMap(([start, end]) => (start < to && end > from ? wholeBlocks(text, Math.max(start, from), Math.min(end, to), masked) : []));
}

function spanCuts(text, cuts) {
  for (const m of text.matchAll(CODE_SPAN_RE)) {
    const start = m.index, end = start + m[0].length;
    const inside = cuts.filter(cut => cut.block.start > start && cut.block.end < end);
    if (!inside.length) continue;
    const first = inside[0], last = inside.at(-1);
    if (pastReasoning(text, start, first.start) === start) first.start = start;
    if (text.slice(last.end, end).search(REASONING_TAG_RE) < 0) last.end = end;
  }
}

const withoutBlocks = (text, reading) => blockCuts(text, reading).reduceRight((out, cut) => out.slice(0, cut.start) + out.slice(cut.end), String(text ?? ''));

export const hasBlocks = text => String(text ?? '').search(BLOCK_RE) >= 0;

export const messageId = (message, index) => message?.chatId ?? `#${index}`;

export const battleKey = (id, n, body) => hashKey(`${id}\n${n}\n${hashKey(String(body ?? '').trim())}`);

export const battlesInText = (text, id, reading) => findBlocks(text, reading).filter(b => b.kind === 'battle').map((b, n) => ({ ...b, hash: b.key, key: battleKey(id, n, b.body) }));

export const battlesIn = (message, index, reading) => battlesInText(message?.data ?? '', messageId(message, index), reading);

export function blockAnchorIn(chat, key, readingAt = () => undefined) {
  const messages = chat?.message ?? [];
  for (let i = 0; i < messages.length; i++) {
    const block = battlesIn(messages[i], i, readingAt(i)).find(b => b.key === key);
    if (block) return { block: block.hash, ...(typeof messages[i].time === 'number' ? { blockTime: messages[i].time } : {}) };
  }
  return {};
}

export const actsIn = (message, index, reading) => findBlocks(message?.data ?? '', reading).filter(b => b.kind === 'act').map((b, n) => {
  const id = ACT_ID_RE.exec(b.body)?.[1];
  return { ...b, own: !!id, key: id ? hashKey(`act-id\n${id}`) : battleKey(`act:${messageId(message, index)}`, n, b.body) };
});
const ACT_ID_RE = /^\s*id\s*:\s*([a-z0-9]+)\s*$/im;

export function actBlock(body, id) {
  return { text: `<pkb-act>\nid: ${id}\n${String(body ?? '').trim()}\n</pkb-act>`, key: hashKey(`act-id\n${id}`) };
}

export const shopsInText = (text, id, reading) => findBlocks(text, reading).filter(b => b.kind === 'shop')
  .map((b, n) => ({ ...b, hash: b.key, key: battleKey(`shop:${id}`, n, b.body), shop: parseShop(b.body) }));
export const shopsIn = (message, index, reading) => shopsInText(message?.data ?? '', messageId(message, index), reading);

export function findTags(text) {
  return [...String(text ?? '').matchAll(TAG_RE)].map(m => ({ key: m[1], start: m.index, end: m.index + m[0].length }));
}

export function findMarks(text) {
  return [...String(text ?? '').matchAll(MARK_RE)].map(m => ({ kind: m[1], key: m[2], start: m.index, end: m.index + m[0].length }));
}
export const markText = (kind, key) => `<pkb!${kind}:${key}>`;

const tidy = text => text.replace(TAG_RE, '').replace(MARK_RE, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

export const stripForPrompt = (text, reading) => tidy(withoutBlocks(text, reading));

export const stripBlocksRead = (text, reading) => (readsBlockEdges(reading) ? stripForPrompt(text, reading) : tidy(String(text ?? '').replace(BLOCK_RE, '')));

function lines(body, errors) {
  const out = [];
  for (const raw of String(body ?? '').split(/\r?\n/)) {
    const line = raw.replace(/^\s*[-*•·]\s+/, '').trim();
    if (!line) continue;
    const m = /^([^:：]+?)\s*[:：]\s*(.*)$/.exec(line);
    if (!m) { errors.push(note('badLine', { line })); continue; }
    out.push({ key: norm(m[1]), value: m[2].trim(), line });
  }
  return out;
}

const BATTLE_KEYS = words({
  opponent: ['opponent', 'type', 'battle', 'vs', '상대', '종류', '배틀'], name: ['name', 'trainer', 'trainername', '이름', '트레이너이름'],
  gender: ['gender', 'sex', '성별'], look: ['look', 'looks', 'appearance', '모습', '외모', '겉모습'], class: ['class', 'trainerclass', 'job', '직업'], rank: ['rank', 'tier', '등급'],
  place: ['place', 'biome', 'location', 'area', '장소', '바이옴', '지형'], time: ['time', '시간', '시간대'], pokemon: ['pokemon', 'mon', '포켓몬'],
  format: ['format', 'battleformat', 'battlestyle', 'style', '형식', '배틀형식', '방식'],
  partner: ['partner', 'ally', 'partnername', 'allyname', '동료', '파트너', '동료이름'],
  partnerPokemon: ['partnerpokemon', 'allypokemon', 'partnermon', 'allymon', '동료포켓몬', '파트너포켓몬'],

  foePartner: ['foepartner', 'opponent2', 'trainer2', 'name2', 'secondtrainer', '상대동료', '상대2', '둘째상대', '이름2'],
  foePartnerPokemon: ['foepartnerpokemon', 'opponent2pokemon', 'trainer2pokemon', 'pokemon2', 'foepartnermon', '상대동료포켓몬', '상대2포켓몬', '둘째상대포켓몬', '포켓몬2'],

  foePartnerGender: ['foepartnergender', 'foepartnersex', 'opponent2gender', 'trainer2gender', 'gender2', 'sex2', '상대동료성별', '상대2성별', '둘째상대성별', '성별2'],
  foePartnerLook: ['foepartnerlook', 'foepartnerlooks', 'foepartnerappearance', 'opponent2look', 'trainer2look', 'look2', '상대동료모습', '상대동료외모', '상대2모습',
    '둘째상대모습', '모습2', '외모2'],

  hair: ['hair', 'haircolor', 'haircolour', '머리', '머리색', '머리카락', '머리카락색', '머리색깔', '헤어', '머리칼'],
  outfit: ['outfit', 'outfitcolor', 'outfitcolour', 'clothes', 'clothing', 'clothescolor', '옷', '옷색', '옷색깔', '복장', '의상', '옷차림'],
  foePartnerHair: ['foepartnerhair', 'foepartnerhaircolor', 'opponent2hair', 'trainer2hair', 'hair2', '상대동료머리', '상대동료머리색', '상대2머리색', '둘째상대머리색', '머리색2'],
  foePartnerOutfit: ['foepartneroutfit', 'foepartnerclothes', 'opponent2outfit', 'trainer2outfit', 'outfit2', '상대동료옷', '상대동료옷색', '상대동료복장', '상대2옷색',
    '둘째상대옷색', '옷색2', '복장2'],

  outfitStyle: ['outfitstyle', 'clothingstyle', 'clothesstyle', 'outfitkind', '스타일', '옷스타일', '복장스타일', '의상스타일', '옷종류'],
  foePartnerStyle: ['foepartnerstyle', 'foepartneroutfitstyle', 'opponent2style', 'trainer2style', 'style2', '상대동료스타일', '상대2스타일', '둘째상대스타일', '스타일2'],
});
const FORMAT = words({ single: ['single', 'singles', 'singlebattle', '1v1', '싱글', '싱글배틀'], double: ['double', 'doubles', 'doublebattle', '2v2', '더블', '더블배틀'] });

const WILD_DOUBLE_MAX = 2;
const SET_KEYS = words({
  ability: ['ability', '특성'], moves: ['moves', 'move', '기술', '기술들'], item: ['item', 'helditem', 'hold', '도구', '지닌도구', '지닌물건'],
  nature: ['nature', '성격'], gender: ['gender', 'sex', '성별'], shiny: ['shiny', '이로치', '색이다름'], tera: ['tera', 'teratype', '테라', '테라타입'],
  name: ['nickname', 'name', '별명', '이름', '닉네임'], hp: ['hp', '체력'], status: ['status', '상태', '상태이상'], level: ['level', 'lv', 'lvl', '레벨'],
  box: ['box', '박스'], party: ['party', '파티'], ot: ['ot', 'originaltrainer', '어버이'], ivs: ['ivs', 'iv', '개체값'],
});
const CHANGE_KEYS = words({
  add: ['add', 'get', 'catch', '추가', '얻음', '받음', '잡음'], level: ['level', 'levelup', 'lv', '레벨', '레벨업'], heal: ['heal', 'restore', '회복', '치료'],
  item: ['item', 'bag', 'items', '도구', '가방', '아이템'], release: ['release', 'farewell', '놓아주기', '떠나보내기', '방생'],
  deposit: ['deposit', 'tobox', '맡기기', '보관'], withdraw: ['withdraw', 'toparty', '꺼내기'], nickname: ['nickname', 'rename', '별명', '이름'],
  hold: ['hold', 'helditem', 'give', '지닌도구', '지니기', '들리기'], evolve: ['evolve', 'evolution', '진화'], teach: ['teach', 'learn', 'move', '기술', '가르치기', '배우기'],
  money: ['money', 'cash', '돈', '소지금', '금액'], egg: ['egg', '알', '알받기'],
});

const LEVEL_RES = [/(?:\blv\.?|\blvl\.?|\bl|레벨)\s*\.?\s*(\d{1,3})(?!\d)/i, /(?<!\d)(\d{1,3})\s*(?:레벨|lv\b)/i];

function takeLevel(text, res = LEVEL_RES) {
  for (const re of res) {
    const m = re.exec(text);
    if (m) return { level: Number(m[1]), rest: (text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length)).trim() };
  }
  return { level: null, rest: text.trim() };
}

const LEVEL_MORE = [/(?:\blevel|\blvl|\blv|레벨)\s*[:：]?\s*\.?\s*(\d{1,3})(?!\d)/i, /(?<=[\p{Script=Latin}\d])lv\.?\s*(\d{1,3})(?!\d)/iu];
const HEAD_GENDER = /\s([♂♀])\uFE0F?$/u;

function readHead(head, reading, form, level) {
  const { level: own, rest } = takeLevel(head);
  const plain = { level, rest, species: rest ? speciesName(rest, reading, form) : null };
  if ((plain.species && level != null) || !readsFormNames(reading)) return plain;
  const more = own == null ? takeLevel(head, LEVEL_MORE) : { level: own, rest };
  const sign = HEAD_GENDER.exec(more.rest);
  const name = sign ? more.rest.slice(0, sign.index).trim() : more.rest;
  if (!name || (more.rest === rest && !sign) || (level ?? more.level) == null) return plain;
  const gender = sign ? GENDER.get(norm(sign[1])) : undefined;
  const species = speciesName(name, reading, form?.gender || !gender ? form : { ...form, gender });
  return species ? { level: level ?? more.level, rest: name, species, ...(gender ? { gender } : {}) } : plain;
}

function splitSeg(seg, map) {
  const m = /^(\S+)(?:\s+(\S+))?/.exec(seg);
  if (!m) return null;
  for (const [head, n] of [[m[1] + (m[2] ?? ''), 2], [m[1], 1]]) {
    const k = norm(head.replace(/[:：]$/, ''));

    if (n === 2 && !(m[2] && /[\p{L}\p{N}]/u.test(m[2]))) continue;
    if (map.has(k)) return [map.get(k), seg.split(/\s+/).slice(n).join(' ').replace(/^[:：]\s*/, '').trim()];
  }

  const c = /^([^:：]+)[:：]\s*(.*)$/.exec(seg);
  if (c && map.has(norm(c[1]))) return [map.get(norm(c[1])), c[2].trim()];
  return null;
}

function percent(v, warn) {
  const s = String(v).trim();
  const m = /^(\d+(?:\.\d+)?)\s*%?$/.exec(s);
  if (!m) return null;
  const n = Number(m[1]);
  if (n > 100) { warn?.(note('hpCapped', { value: s })); return 100; }
  return n;
}

function readIvs(v) {
  const n = /^([1-6])\s*v$/i.exec(v);
  if (n) return Number(n[1]) === STATS.length ? { ivs: Object.fromEntries(STATS.map(s => [s, MAX_IV])) } : { perfectIvs: Number(n[1]) };
  const nums = v.split('/').map(x => x.trim());
  if (nums.length !== STATS.length || !nums.every(x => /^\d{1,2}$/.test(x) && Number(x) <= MAX_IV)) return null;
  return { ivs: Object.fromEntries(STATS.map((s, i) => [s, Number(nums[i])])) };
}

function parseSet(value, errors, dest, warnings = errors, reading, tags = false) {
  const warn = text => warnings.push(text);
  const segs = String(value).split(/[|｜]/).map(s => s.trim()).filter(Boolean);
  if (!segs.length) { errors.push(note('emptyMon')); return null; }
  let { level } = takeLevel(segs[0]);
  const set = {};
  let to = 'party', ot = null, custom = null, fields = { effect: null, owner: '' };

  const ivField = (v, seg) => {
    const r = readIvs(v);
    if (!r) { errors.push(note('badIvs', { max: MAX_IV, seg })); return; }
    delete set.ivs; delete set.perfectIvs;
    Object.assign(set, r);
  };
  for (const seg of segs.slice(1)) {

    const field = tags ? itemField(seg) : null;
    if (field) { fields = joinField(fields, field); continue; }
    const kv = splitSeg(seg, SET_KEYS);
    if (!kv) {

      const lv = takeLevel(seg);
      if (level == null && lv.level != null && !lv.rest) { level = lv.level; continue; }
      if (/^\d+(?:\.\d+)?\s*%$/.test(seg)) { set.hpPercent = percent(seg, warn); continue; }
      if (GENDER.has(norm(seg)) && /^[♂♀]$/.test(seg)) { set.gender = GENDER.get(norm(seg)); continue; }
      if (NOT_SHINY.has(norm(seg))) continue;
      if (/^\d+\s*v$/i.test(seg)) { ivField(seg, seg); continue; }
      errors.push(note('unknownExtra', { seg }));
      continue;
    }
    const [k, v] = kv;
    if (k === 'shiny') {
      const yes = v ? SHINY.get(norm(v)) : 'yes';
      if (yes === 'yes') set.shiny = true;
      else if (yes !== 'no') errors.push(note('shinyWord', { seg }));
      continue;
    }
    if (k === 'box' || k === 'party') {
      if (dest) to = k; else errors.push(note('notInBattle', { seg }));
      continue;
    }
    if (!v) { errors.push(note('noValue', { text: seg })); continue; }
    if (k === 'ot') {

      if (dest) ot = v.slice(0, OT_NAME_MAX); else errors.push(note('notInBattle', { seg }));
      continue;
    }
    if (k === 'ivs') {
      ivField(v, seg);
    } else if (k === 'level') {
      const n = /^(?:lv\.?\s*)?(\d{1,3})$/i.exec(v);
      if (n) level = Number(n[1]); else errors.push(note('badLevel', { value: v }));
    } else if (k === 'ability') {
      const id = need('abilities', v, errors, reading); if (id) set.ability = id;
    } else if (k === 'item') {
      // A name-table item, else a custom item under the name as written (the same reading as item / hold lines)
      const { emoji, rest } = splitEmoji(v);
      const { name, tag } = takeTag(rest, tags);
      const item = itemOf(name, emoji, v, errors, heldReading(reading), tag);
      if (item) { set.item = item.item; custom = item.custom ?? null; }
    } else if (k === 'moves') {
      const moves = v.split(/[,，、\/]/).map(s => s.trim()).filter(Boolean).map(s => need('moves', s, errors, reading)).filter(Boolean);
      if (moves.length > MAX_MOVES) errors.push(note('tooManyMoves', { max: MAX_MOVES, n: moves.length }));
      if (moves.length) set.moves = [...new Set(moves)].slice(0, MAX_MOVES);
    } else if (k === 'nature') {
      const n = storyNames.natures[norm(v)];
      if (n) set.nature = n; else errors.push(note('unknownNature', { value: v }));
    } else if (k === 'gender') {
      const g = GENDER.get(norm(v));
      if (g) set.gender = g; else errors.push(note('unknownGender', { value: v }));
    } else if (k === 'tera') {
      const t = storyNames.types[norm(v)];
      if (t) set.teraType = t; else errors.push(note('unknownTera', { value: v }));
    } else if (k === 'name') {
      set.name = v;
    } else if (k === 'hp') {
      const p = percent(v, warn);
      if (p != null) set.hpPercent = p; else errors.push(note('hpRange', { value: v }));
    } else if (k === 'status') {
      const s = STATUS.get(norm(v));
      if (s !== undefined) set.status = s; else errors.push(note('unknownStatus', { value: v }));
    }
  }

  const head = readHead(segs[0], reading, { gender: set.gender, seed: String(value).trim() }, level);
  const { rest, species } = head;
  if (!rest) { errors.push(note('noMonName', { seg: segs[0] })); return null; }
  if (!species) { errors.push(note('unknown.species', { name: rest })); return null; }
  level = head.level;
  if (head.gender && !set.gender) set.gender = head.gender;
  if (level == null) { errors.push(note('noLevel', { name: rest })); return null; }
  if (level < 1 || level > MAX_LEVEL) { errors.push(note('monLevelRange', { max: MAX_LEVEL, name: rest, level })); return null; }
  if (custom) custom = withFields(custom, fields.effect, fields.owner);
  return { set: { species, level, ...set }, to, ...(ot ? { ot } : {}), ...(custom ? { custom } : {}) };
}

export function parseMonLine(value) {
  const errors = [];
  const r = parseSet(value, errors, true);
  return r ? { set: r.set, to: r.to, errors } : { errors };
}

export function parseBattle(body, reading) {
  const errors = [];
  let fatal = false;
  const spec = { wild: null, name: null, gender: null, look: null, trainerClass: null, boss: null, place: null, time: null, team: [] };

  let format = null, partnerName = null, foePartnerName = null, foePartnerLook = null, foePartnerGender = null;
  const partnerTeam = [], foePartnerTeam = [];
  const foeLooks = readsFoeLooks(reading), colorFields = readsTrainerColors(reading), styleFields = readsMobStyles(reading);

  let style = [], foePartnerStyle = null;

  const colors = {}, foePartnerColors = {};
  for (const { key, value, line } of lines(body, errors)) {
    const read = BATTLE_KEYS.get(key);

    const k = (!foeLooks && (read === 'foePartnerLook' || read === 'foePartnerGender')) || (!colorFields && COLOR_KEYS.has(read))
      || (!styleFields && STYLE_KEYS.has(read)) ? null : read;
    if (!k) { errors.push(note('unknownKey', { line })); continue; }
    if (k === 'pokemon' || k === 'partnerPokemon' || k === 'foePartnerPokemon') {
      const r = parseSet(value, errors, false, errors, reading);
      if (r) ({ pokemon: spec.team, partnerPokemon: partnerTeam, foePartnerPokemon: foePartnerTeam })[k].push(r.set); else fatal = true;
      continue;
    }
    if (!value) { errors.push(note('noValue', { text: line })); continue; }
    if (k === 'opponent') {
      const o = OPPONENT.get(norm(value));
      if (o) spec.wild = o === 'wild'; else errors.push(note('sideWord', { value }));
    } else if (k === 'name') spec.name = value;
    else if (k === 'class') spec.trainerClass = value;
    else if (k === 'gender') {
      const g = GENDER.get(norm(value));
      if (g) spec.gender = g; else errors.push(note('unknownGender', { value }));
    } else if (k === 'look') {
      const l = readLook(value, styleFields);
      if (l) spec.look = l; else errors.push(note('unknownLook', { value }));
    } else if (k === 'rank') {
      const r = RANK.get(norm(value));
      if (r) spec.boss = r === 'boss'; else errors.push(note('rankWord', { value }));
    } else if (k === 'place') {
      const b = storyNames.biomes[norm(value)];
      if (b) spec.place = b; else errors.push(note('unknownPlace', { value }));
    } else if (k === 'time') {
      const t = readTime(value), hour = clockHourOf(value);
      if (t) spec.time = t; else errors.push(note('timeWord', { value }));

      if (t && hour !== null) spec.hour = hour;
    } else if (k === 'format') {
      const f = FORMAT.get(norm(value));

      if (f) format = f; else if (styleFields && key === 'style' && readStyles(value).length) style = readStyles(value);
      else errors.push(note('formatWord', { value }));
    } else if (k === 'outfitStyle') style = readStyles(value);
    else if (k === 'foePartnerStyle') {

      const read = readStyles(value);
      if (read.length) foePartnerStyle = read;
    } else if (k === 'partner') partnerName = value;
    else if (k === 'foePartner') foePartnerName = value;
    else if (k === 'foePartnerGender') {
      const g = GENDER.get(norm(value));
      if (g) foePartnerGender = g; else errors.push(note('unknownGender', { value }));
    } else if (k === 'foePartnerLook') {
      const l = readLook(value, styleFields);
      if (l) foePartnerLook = l; else errors.push(note('unknownLook', { value }));
    } else if (COLOR_KEYS.has(k)) {

      const into = k === 'hair' || k === 'outfit' ? colors : foePartnerColors;
      if (k === 'hair' || k === 'foePartnerHair') { const h = readHair(value); if (h) into.hair = h; }
      else Object.assign(into, Object.fromEntries(Object.entries(readOutfit(value) ?? {}).filter(([, c]) => c)));
    }
  }
  if (spec.wild == null) { errors.push(note('noSide')); fatal = true; }
  const n = spec.team.length;
  if (!n && !fatal) { errors.push(note('noMons')); fatal = true; }
  if (partnerName && !partnerTeam.length) errors.push(note('partnerNoMons', { name: partnerName }));
  if (partnerTeam.length > PARTY_MAX) { errors.push(note('partnerMax', { max: PARTY_MAX, n: partnerTeam.length })); fatal = true; }

  const foePartner = spec.wild !== true && foePartnerTeam.length > 0;
  if (spec.wild === true && (foePartnerName || foePartnerTeam.length)) errors.push(note('foePartnerWild'));
  else if (foePartnerName && !foePartnerTeam.length) errors.push(note('foePartnerNoMons', { name: foePartnerName }));
  if (foePartnerTeam.length > PARTY_MAX) { errors.push(note('partnerMax', { max: PARTY_MAX, n: foePartnerTeam.length })); fatal = true; }

  const double = partnerTeam.length > 0 || foePartner || format === 'double';
  if (double) {
    spec.double = true;
    if (partnerTeam.length) spec.partner = { name: partnerName, team: partnerTeam };
    if (foePartner) {
      spec.foePartner = { name: foePartnerName, team: foePartnerTeam };

      if (foePartnerLook) spec.foePartner.look = foePartnerLook;
      const partnerGender = LOOK_GENDER[foePartnerLook] ?? foePartnerGender;
      if (partnerGender) spec.foePartner.gender = partnerGender;
      if (Object.keys(foePartnerColors).length) spec.foePartner.colors = foePartnerColors;
      if (foePartnerStyle) spec.foePartner.style = foePartnerStyle;
    }
  }
  if (spec.wild === true && n > (double ? WILD_DOUBLE_MAX : 1)) { errors.push(double ? note('wildTwo', { max: WILD_DOUBLE_MAX, n }) : note('wildOne', { n })); fatal = true; }
  if (spec.wild === false && n > PARTY_MAX) { errors.push(note('trainerMax', { max: PARTY_MAX, n })); fatal = true; }

  if (foePartner) {
    for (const [team, rule] of [[spec.team, 'pairFoeMax'], [foePartnerTeam, 'pairPartnerMax']]) {
      if (team.length > PAIR_TEAM_MAX) { errors.push(note(rule, { max: PAIR_TEAM_MAX, n: team.length })); team.length = PAIR_TEAM_MAX; }
    }
  }
  // Without a rank, guess from the class (else the name)
  if (spec.boss == null) spec.boss = !spec.wild && BOSS_CLASS.test(`${spec.trainerClass ?? ''} ${spec.name ?? ''}`);

  if (spec.look && LOOK_GENDER[spec.look]) spec.gender = LOOK_GENDER[spec.look];

  if (spec.wild === false && Object.keys(colors).length) spec.colors = colors;

  if (spec.wild === false && styleFields) spec.style = style;
  return { spec: fatal ? null : spec, errors };
}

function ref(str, errors) {
  const s = String(str ?? '').trim();

  const b = /^(?:box|storage|박스)\s*#?\s*(\d+)(?:번)?$/i.exec(s);
  if (b) {
    const box = Number(b[1]);
    if (box >= 1) return { box };
    errors.push(note('boxNumber', { ref: s }));
    return null;
  }
  const m = /^#\s*(\d+)(?:번)?$/.exec(s);
  if (m) {
    const slot = Number(m[1]);
    if (slot >= 1 && slot <= PARTY_MAX) return { slot };
    errors.push(note('partyNumber', { max: PARTY_MAX, ref: s }));
    return null;
  }
  if (!s || s.startsWith('#')) { errors.push(s ? note('badPartyNumber', { ref: s }) : note('noWho')); return null; }
  return { name: s };
}

function headRef(value, rest = true, reading) {
  const s = value.trim();
  const slot = /^(#\s*\d+(?:번)?)\s*(.*)$/.exec(s);
  if (slot) return [slot[1], slot[2].trim()];
  const parts = s.split(/\s+/).filter(Boolean);
  for (let n = parts.length - (rest ? 1 : 0); n >= 2; n--) {
    const head = parts.slice(0, n).join(' ');
    if (speciesName(head, reading)) return [head, parts.slice(n).join(' ')];
  }
  return parts.length ? [parts[0], parts.slice(1).join(' ')] : ['', ''];
}

function evolveSplit(value, reading) {
  if (!readsFormNames(reading) || /^#/.test(value.trim())) return null;
  const parts = value.trim().split(/\s+/).filter(Boolean);
  for (let n = 1; n < parts.length; n++) {
    const head = parts.slice(0, n).join(' '), rest = parts.slice(n).join(' ');
    if (speciesName(head, reading) && speciesName(rest, reading)) return [head, rest];
  }
  return null;
}

// Held items and items used in battle keep the old reading: a disc there is not a bag item (TR43 is Showdown's item for Fling)
const heldReading = reading => (reading?.regionMachines ? { ...reading, regionMachines: false } : reading);

function itemOf(name, emoji, value, errors, reading, effect = null, owner = '') {
  const id = lookupId('items', name, { reading });
  if (id) return { item: id };
  if (!/\p{L}/u.test(name)) { errors.push(note('noItemName', { value: value.trim() })); return null; }
  return { item: customItemId(name), custom: withFields({ name, emoji: emoji || DEFAULT_EMOJI }, effect, owner) };
}

const withFields = (custom, effect, owner) => {
  const top = topEffect(custom.effect ?? [], effect ?? []);
  return { ...custom, ...(top ? { effect: top } : {}), ...(owner ? { owner } : {}) };
};

function atEmoji(value) {
  const parts = value.trim().split(/\s+/);
  const leads = (part, i) => { const { emoji, rest } = splitEmoji(part); return !!emoji && (!!rest || i < parts.length - 1); };
  const at = parts.findIndex((part, i) => i > 0 && !/^[♀♂]/u.test(part) && leads(part, i));
  return at > 0 ? [parts.slice(0, at).join(' '), parts.slice(at).join(' ')] : null;
}

function tailCount(value, dflt) {
  const m = /^(.*?)\s*(?:([+-]\s*\d[\d,]*)|[x×*]\s*(\d[\d,]*)|(\d[\d,]*)\s*(?:개|ea)?)$/i.exec(value.trim());
  if (!m || !m[1]) return { name: value.trim(), n: dflt };
  const raw = (m[2] ?? m[3] ?? m[4]).replace(/[\s,]/g, '');
  return { name: m[1].trim(), n: Number(raw) };
}

const HEAL_MODS = words({ status: ['status', 'statusonly', 'cure', '상태', '상태이상', '상태만'], revive: ['revive', 'faint', 'fainted', '기절', '기절회복', '부활', '되살리기'] });
const ALL = words({ all: ['all', 'party', 'everyone', '전체', '모두', '전부', '파티'] });
const NONE = words({ none: ['none', 'nothing', 'remove', '없음', '빼기', '없애기', '해제'] });

export function parseChange(body, reading) {
  const errors = [], warnings = [];
  const ops = [];
  for (const { key, value, line } of lines(body, errors)) {
    const op = CHANGE_KEYS.get(key);
    if (!op) { errors.push(note('unknownKey', { line })); continue; }
    if (!value) { errors.push(note('noValue', { text: line })); continue; }
    const errs = [], warns = [];
    const r = parseOp(op, value, errs, warns, reading);
    errors.push(...errs, ...warns);
    warnings.push(...warns);

    if (r && !errs.length) ops.push(r);
  }
  return { ops, errors, warnings };
}

function parseOp(op, value, errors, warnings, reading) {
  const warn = text => warnings.push(text);
  switch (op) {
    case 'add': {
      const r = parseSet(value, errors, true, warnings, reading, readsItemTags(reading));
      return r && { op, set: r.set, to: r.to, ...(r.ot ? { ot: r.ot } : {}), ...(r.custom ? { custom: r.custom } : {}) };
    }
    case 'egg': {

      const m = /^(.*?)(?:\s*[,/|]?\s*(box|박스))?$/i.exec(value.trim());
      const species = need('species', m[1], errors, reading);
      return species && { op, species: speciesTable[species].en, ...(m[2] ? { to: 'box' } : {}) };
    }
    case 'level': {
      const m = /^(.*?)\s*(?:([+-])\s*(\d{1,3})|=\s*(?:lv\.?\s*)?(\d{1,3})|(?:lv\.?\s*|레벨\s*)?(\d{1,3}))\s*(?:레벨)?$/i.exec(value);
      if (!m || !m[1] || /^#\s*$/.test(m[1])) { errors.push(note('badLevelChange', { value })); return null; }
      const who = ref(m[1], errors);
      if (!who) return null;
      if (m[3] != null) {
        const delta = Number(m[2] + m[3]);
        if (!delta) { errors.push(note('levelZero', { value })); return null; }
        return { op, ref: who, delta };
      }
      const to = Number(m[4] ?? m[5]);
      if (to < 1 || to > MAX_LEVEL) { errors.push(note('levelRange', { max: MAX_LEVEL, level: to })); return null; }
      return { op, ref: who, to };
    }
    case 'heal': {
      const toks = value.trim().split(/\s+/), mods = {};

      while (toks.length) {
        const w = toks[toks.length - 1], k = norm(w);
        if (/%$/.test(w) && percent(w) != null) mods.hpPercent = percent(w, warn);
        else if (HEAL_MODS.get(k) === 'status') mods.statusOnly = true;
        else if (HEAL_MODS.get(k) === 'revive') mods.revive = true;
        else if (!['회복', 'heal', 'full', '가득'].includes(k)) break;
        toks.pop();
      }
      const target = toks.join(' ');
      const who = !target || ALL.has(norm(target)) ? 'all' : ref(target, errors);
      return who && { op, ref: who, ...mods };
    }
    case 'item': {

      const fields = takeFields(value, readsItemTags(reading));
      const { emoji, rest: written } = splitEmoji(fields.text);
      const { name: rest, tag } = takeTag(written, readsItemTags(reading));

      const discNumber = reading?.regionMachines ? discNumberEnds(rest, reading)
        : reading?.regionMachines === false ? LEGACY_TM_NUMBER.test(rest) : BARE_DISC_NUMBER.test(rest) && !SIGNED_COUNT.test(rest.trim());
      const { name, n } = discNumber ? { name: rest, n: 1 } : tailCount(rest, 1);
      const item = n > 0 ? itemOf(name, emoji, value, errors, reading, topEffect(fields.effect ?? [], tag ?? []), fields.owner) : itemOf(name, emoji, value, errors, reading);
      if (!item) return null;
      if (!Number.isSafeInteger(n)) { errors.push(note('itemCountBig', { value })); return null; }
      if (!n) { errors.push(note('itemCountZero', { value })); return null; }
      return { op, ...item, delta: n };
    }
    case 'release': case 'deposit': case 'withdraw': {
      const who = ref(value, errors);
      return who && { op, ref: who };
    }
    case 'nickname': {
      const [h, name] = headRef(value, true, reading);
      if (!name) { errors.push(note('noNickname', { value })); return null; }
      const who = ref(h, errors);
      return who && { op, ref: who, name };
    }
    case 'hold': {
      const fields = takeFields(value, readsItemTags(reading));
      const [h, rest] = atEmoji(fields.text) ?? headRef(fields.text, false, reading);
      const who = ref(h, errors);
      if (!who) return null;
      if (!rest || NONE.has(norm(rest))) return { op, ref: who, item: null };
      const { emoji, rest: written } = splitEmoji(rest);
      const { name, tag } = takeTag(written, readsItemTags(reading));
      const item = itemOf(name, emoji, value, errors, heldReading(reading), topEffect(fields.effect ?? [], tag ?? []), fields.owner);
      return item && { op, ref: who, ...item };
    }
    case 'evolve': {
      const [h, rest] = evolveSplit(value, reading) ?? headRef(value, true, reading);
      if (!rest) { errors.push(note('noEvolveTo', { value })); return null; }
      const who = ref(h, errors);
      if (!who) return null;

      const species = speciesName(rest, reading, { seed: value.trim() });
      if (!species) { errors.push(note('unknown.species', { name: rest })); return null; }
      const forms = sharedForms(rest, reading);
      return { op, ref: who, species, ...(forms ? { forms } : {}) };
    }
    case 'teach': {
      const [h, rest] = headRef(value, true, reading);
      const who = ref(h, errors);
      if (!who) return null;

      let learn = rest, forget = null;
      const f = /^(.*?)\s+(?:forget|replace|replacing|잊기|잊고|잊음)\s+(.+)$/i.exec(rest);
      const d = /^(.+?)\s+(?:대신|instead\s+of)\s+(.+)$/i.exec(rest);
      if (f) [learn, forget] = [f[1], f[2]];
      else if (d) [forget, learn] = [d[1], d[2]];
      if (!learn) { errors.push(note('noLearn', { value })); return null; }
      const move = need('moves', learn, errors, reading);
      const old = forget ? need('moves', forget, errors, reading) : null;
      if (!move || (forget && !old)) return null;
      return old ? { op, ref: who, move, forget: old } : { op, ref: who, move };
    }
    case 'money': {
      const m = /^([+-])?\s*[₩$]?\s*(\d[\d,]*)\s*(?:원|₩|p|pokedollars?)?$/i.exec(value.trim());
      if (!m) { errors.push(note('badMoney', { value })); return null; }
      const delta = Number((m[1] ?? '+') + m[2].replace(/,/g, ''));

      if (!Number.isSafeInteger(delta)) { errors.push(note('moneyBig', { value })); return null; }
      if (!delta) { errors.push(note('moneyZero', { value })); return null; }
      return { op, delta };
    }
  }
  return null;
}

const END_KEYS = words({ result: ['result', 'outcome', 'winner', '결과', '승패'] });
const END_RESULT = words({
  win: ['win', 'won', 'victory', 'player', '승리', '이김', '이겼다', '플레이어'],
  lose: ['lose', 'lost', 'loss', 'defeat', 'opponent', '패배', '짐', '졌다', '상대'],
  stop: ['stop', 'stopped', 'interrupted', 'cancel', 'cancelled', 'draw', 'none', '중단', '중지', '무승부', '없음'],
});

export function parseEnd(body) {
  const errors = [];
  const bare = String(body ?? '').trim();

  if (bare && !/[:：]/.test(bare)) {
    const r = END_RESULT.get(norm(bare));
    if (r) return { outcome: r, errors };
  }
  let outcome = null;
  for (const { key, value, line } of lines(body, errors)) {
    if (END_KEYS.get(key) !== 'result') { errors.push(note('unknownKey', { line })); continue; }
    const r = END_RESULT.get(norm(value));
    if (r) outcome = r; else errors.push(note('endWord', { value }));
  }
  return { outcome: outcome ?? 'stop', errors };
}

const SHOP_KEYS = words({ shop: ['shop', 'kind', 'type', 'store', '상점', '가게', '종류'], name: ['name', '이름', '상호', '가게이름', '상점이름'] });
const SHOP_KIND = words({
  mart: ['mart', 'pokemart', 'pokémart', 'poke mart', 'pokémon mart', 'friendly shop', 'friendlyshop', 'shop', 'store', 'market', 'convenience store',
    '프렌들리숍', '프렌들리샵', '상점', '마트', '포켓몬마트', '포케마트', '가게', '편의점'],
  department: ['department', 'department store', 'dept', 'dept store', 'departmentstore', 'mall', 'shopping mall', '백화점', '쇼핑몰'],
});

function parseShop(body) {
  const bare = String(body ?? '').trim();

  if (bare && !/[:：]/.test(bare)) return { kind: SHOP_KIND.get(norm(bare)) ?? 'mart' };
  let kind = 'mart', name = '';
  for (const { key, value } of lines(body, [])) {
    const field = SHOP_KEYS.get(key);
    if (field === 'shop') kind = SHOP_KIND.get(norm(value)) ?? kind;
    else if (field === 'name') name = value.trim();
  }
  return name ? { kind, name } : { kind };
}

const ACT_KEYS = words({ turn: ['turn', 'action', 'command', '턴', '행동', '명령'] });
const ACT_SIDES = words({ me: ['me', 'my', 'mine', 'player', 'own', '나', '내', '내쪽', '아군', '플레이어'],
  foe: ['foe', 'opponent', 'enemy', 'opp', 'them', '상대', '적', '상대쪽'] });
const ACT_VERBS = words({ switch: ['switch', 'swap', 'change', 'go', 'send', '교체', '교대', '바꾸기'], item: ['item', 'use', 'bag', '도구', '가방', '사용'],
  run: ['run', 'flee', 'escape', 'forfeit', '도망', '도주', '항복'], move: ['move', 'attack', '기술', '공격'] });
const GIMMICKS = words({ tera: ['tera', 'terastallize', 'terastal', '테라', '테라스탈'], mega: ['mega', 'megaevolve', '메가', '메가진화'] });

const ACT_SLOTS = words({ '': ['left', '1', '왼쪽', '왼', '첫째'], 2: ['right', '2', '오른쪽', '오른', '둘째'] });
const ACT_ALLY = words({ ally: ['ally', 'partner', '아군', '동료', '짝', '옆'], self: ['self', 'itself', 'myself', '자신', '자기', '자기자신'] });
const TARGET_RE = /\s*(?:>|→|->|@)\s*/;

const nameOf = (s, reading) => { const forms = sharedForms(s, reading); return { species: lookupId('species', s, { reading }), name: s, ...(forms ? { forms } : {}) }; };

function actTarget(raw, reading) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const slot = /^#\s*(\d+)(?:번)?$/.exec(s);
  if (slot) return { slot: Number(slot[1]) };
  return nameOf(s, reading);
}

export const sameName = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

export function collidingPositions(actives) {
  const standing = actives.map(p => (p && !p.fainted ? p : null));
  return standing.flatMap((p, i) => (p && standing.some((q, j) => q && j !== i && sameName(p.name, q.name)) ? [i] : []));
}

function sideOf(text) {
  const toks = String(text).trim().split(/\s+/).filter(Boolean);
  const head = norm(toks[0]);
  const attached = /^(.+?)([12])$/.exec(head);
  let side = ACT_SIDES.get(head), slot = null, used = 1;
  if (!side && attached && ACT_SIDES.has(attached[1])) [side, slot] = [ACT_SIDES.get(attached[1]), attached[2] === '2' ? '2' : ''];
  if (!side) return null;
  if (slot == null && toks.length > 1 && ACT_SLOTS.has(norm(toks[1]))) { slot = ACT_SLOTS.get(norm(toks[1])); used = 2; }
  return { side, key: `${side}${slot ?? ''}`, slotted: slot != null, rest: toks.slice(used).join(' ') };
}

const otherOf = key => (key.endsWith('2') ? key.slice(0, -1) : `${key}2`);

function targetOf(text, side, user, errors, reading) {
  const relative = rel => (user ? (rel === 'self' ? user : otherOf(user)) : { rel });
  const ally = ACT_ALLY.get(norm(text));
  if (ally) return relative(ally);
  const where = sideOf(text);
  if (!where) { errors.push(note('act.badTarget', { text })); return null; }
  if (where.slotted) return where.key;
  if (where.rest) return { side: where.side, who: nameOf(where.rest, reading) };
  return where.side === side ? relative('ally') : null;
}

function actPart(rest, side, errors, key = side, { allLetters = false, reading } = {}) {
  const toks = rest.trim().split(/\s+/).filter(Boolean);
  const verb = ACT_VERBS.get(norm(toks[0]));
  const after = toks.slice(verb ? 1 : 0).join(' ');
  if (verb === 'run') return side === 'me' ? { kind: 'run' } : null;
  if (verb === 'switch') {
    const target = actTarget(after, reading);
    if (!target) errors.push(note('act.noSwitchTarget', { text: rest }));
    return target && { kind: 'switch', target };
  }
  if (verb === 'item') {
    const m = /^(.*?)\s*(?:(#\s*\d+(?:번)?)|(?:\b(?:on|to)\b|에게|→|->)\s*(.+))?$/i.exec(after);

    const raw = (m?.[1] ?? after).trim();
    const { emoji, rest: name } = splitEmoji(raw);
    const item = itemOf(name, emoji, raw, errors, heldReading(reading));
    const target = actTarget(m?.[2] ?? m?.[3], reading);
    return { kind: 'item', item: item?.item ?? null, ...(item?.custom ? { raw } : {}), ...(target ? { target } : {}) };
  }

  const [what, aim] = after.split(TARGET_RE, 2);
  const words = what.split(/\s+/).filter(Boolean);
  const gimmick = words.length > 1 ? GIMMICKS.get(norm(words.at(-1))) : undefined;
  const name = (gimmick ? words.slice(0, -1) : words).join(' ');
  const move = lookupId('moves', name, { allLetters, reading });
  if (!move) errors.push(note('unknown.moves', { name }));
  const at = aim === undefined ? null : targetOf(aim, side, key, errors, reading);
  return { kind: 'move', move, ...(gimmick ? { gimmick } : {}), ...(move ? {} : { raw: name }), ...(at ? { at } : {}) };
}

function namedPart(rest, side, reading) {
  const toks = rest.trim().split(/\s+/);
  const what = rest.split(TARGET_RE, 1)[0].trim().split(/\s+/);
  const reads = text => { const errors = []; actPart(text, side, errors, null, { allLetters: true, reading }); return !errors.length; };
  if (reads(what.join(' '))) return null;
  for (let i = 1; i < what.length; i++) {
    if (reads(what.slice(i).join(' '))) return { who: nameOf(toks.slice(0, i).join(' '), reading), action: toks.slice(i).join(' ') };
  }
  return null;
}

const namedKey = (side, name) => `${side}:${name.trim().toLowerCase()}`;

export const sideParts = (turn, side) => [[side, turn[side]], [`${side}2`, turn[`${side}2`]], ...Object.entries(turn).filter(([key]) => key.startsWith(`${side}:`))]
  .filter(([, command]) => command);

export function parseAct(body, reading) {
  const errors = [], turns = [];
  for (const { key, value, line } of lines(body, errors)) {
    if (key === 'id') continue;
    if (ACT_KEYS.get(key.replace(/\d+$/, '')) !== 'turn') { errors.push(note('unknownKey', { line })); continue; }
    const turn = { me: null, foe: null };
    for (const part of value.split('|').map(p => p.trim()).filter(Boolean)) {
      const where = sideOf(part);
      if (!where || !where.rest) { errors.push(note('act.badSide', { part })); continue; }
      const named = namedPart(where.rest, where.side, reading);
      const byName = named && !where.slotted;
      const at = byName ? namedKey(where.side, named.who.name) : where.key;
      const command = actPart(named?.action ?? where.rest, where.side, errors, byName ? null : at, { reading });
      turn[at] = byName && command ? { ...command, who: named.who } : command;
    }
    if (!sideParts(turn, 'me').length) { errors.push(note('act.noMine', { line })); continue; }
    turns.push(turn);
  }
  return { turns, errors };
}
