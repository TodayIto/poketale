import speciesTable from '../data/names/species.json' with { type: 'json' };
import { koSpellings } from '../names/index.js';
import { stripForPrompt, messageId } from './blocks.mjs';
import { rulesAt } from './setting-changes.mjs';

const LAST = 1025;

export const EXCLUDED_KO = Object.freeze(['슬리퍼', '부스터', '파이어', '썬더', '블루', '럭키', '마그마', '랜턴', '플러시', '코일', '크랩', '킹크랩', '셀러', '투구', '고지',
  '나시', '우파', '물거미', '모래뱀', '흉내내', '먹고자', '질퍽이', '보송송', '으랏차', '두두', '삐', '마자', '아라리']);

export const EXCLUDED_EN = Object.freeze(['Ditto', 'Golem', 'Electrode', 'Persian', 'Slowpoke', 'Mew']);

const AFTER_KO = new Set([...'가이은는을를의와과도에랑로으만까부처보한들야아여였예요인다나든라마뿐밖조하께고네죠']);
const isHangul = c => c >= 0xac00 && c <= 0xd7a3;
const isWordEn = c => (c >= 0x61 && c <= 0x7a) || (c >= 0x41 && c <= 0x5a) || (c >= 0x30 && c <= 0x39);

const node = () => ({ next: new Map(), num: 0 });
function add(root, name, num) {
  let at = root;
  for (let i = 0; i < name.length; i++) { const c = name.charCodeAt(i); let to = at.next.get(c); if (!to) at.next.set(c, to = node()); at = to; }
  if (!at.num) at.num = num;
}

const enSpellings = en => {
  if (!en) return [];
  const name = en.replace(/’/g, "'").replace(/-F$/, '♀').replace(/-M$/, '♂').toLowerCase();
  return [...new Set([name, name.normalize('NFD').replace(/\p{M}/gu, '')])];
};

function namesOf(official) {
  const reading = { officialKo: official };
  const ko = [], en = [];
  const skipKo = new Set(EXCLUDED_KO), skipEn = new Set(EXCLUDED_EN.map(s => s.toLowerCase()));
  for (const record of Object.values(speciesTable)) {
    if (!(record.num >= 1 && record.num <= LAST)) continue;
    if (!record.base) {
      for (const name of koSpellings(record, reading)) if (!skipKo.has(name)) ko.push([name, record.num]);
      for (const name of enSpellings(record.en)) if (!skipEn.has(name)) en.push([name, record.num]);
      continue;
    }

    const m = /^(.+?)\s*\(([^()\s]+)\)$/.exec(record.ko ?? '');
    if (m && m[2].includes(m[1]) && !skipKo.has(m[2])) ko.push([m[2], record.num]);
  }
  return { ko, en };
}

const tries = new Map();

function trieOf(official) {
  let root = tries.get(official);
  if (!root) {
    root = node();
    const { ko, en } = namesOf(official);
    for (const [name, num] of ko) add(root, name, num);
    for (const [name, num] of en) add(root, name, num);
    tries.set(official, root);
  }
  return root;
}

export const mentionText = text => stripForPrompt(text)
  .replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(style|script)\b[\s\S]*?<\/\1\s*>/gi, ' ').replace(/<\/?[a-zA-Z][^<>]*>/g, ' ');

const lower = c => (c >= 0x41 && c <= 0x5a ? c + 32 : c === 0x2019 ? 0x27 : c >= 0xc0 && c <= 0xde ? String.fromCharCode(c).toLowerCase().charCodeAt(0) : c);
const AFTER_CODES = new Set([...AFTER_KO].map(ch => ch.charCodeAt(0)));

export function mentionsIn(text, official = true) {
  const root = trieOf(official);
  const found = new Set();
  const len = text.length;
  for (let i = 0; i < len; i++) {
    const c = text.charCodeAt(i);
    const ko = isHangul(c);
    if (!ko && !isWordEn(c)) continue;
    const left = i > 0 ? text.charCodeAt(i - 1) : 0;
    if (ko ? isHangul(left) : isWordEn(left)) continue;
    let at = root, best = 0, end = i;
    for (let j = i; j < len; j++) {
      const cj = text.charCodeAt(j);
      at = at.next.get(ko ? cj : lower(cj));
      if (!at) break;
      if (!at.num) continue;
      const next = j + 1 < len ? text.charCodeAt(j + 1) : 0;
      const fits = isHangul(cj) ? !isHangul(next) || AFTER_CODES.has(next) : !isWordEn(next);
      if (fits) { best = at.num; end = j; }
    }
    if (best) { found.add(best); i = end; }
  }
  return [...found];
}

const CACHE_CHATS = 20;
const cache = new Map();

export const scanStats = { scanned: 0 };
export const resetMentionCache = () => { cache.clear(); scanStats.scanned = 0; };

function officialFrom(chat, count) {
  const at = rulesAt(chat);
  let lo = 0, hi = count;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (at(mid).officialKo !== false) hi = mid; else lo = mid + 1; }
  return lo;
}

export function storyMentions(chat) {
  const messages = chat?.message ?? [];
  const out = new Set();
  if (!messages.length) return out;
  const from = officialFrom(chat, messages.length);
  const chatKey = String(chat?.id ?? '');
  let kept = cache.get(chatKey);
  if (!kept) {
    if (cache.size >= CACHE_CHATS) cache.clear();
    cache.set(chatKey, kept = new Map());
  }
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    if (message?.role !== 'char' || typeof message.data !== 'string' || !message.data) continue;
    const official = i >= from;
    const key = messageId(message, i);
    let hit = kept.get(key);
    if (!hit || hit.official !== official || hit.text !== message.data) {
      scanStats.scanned++;
      hit = { text: message.data, official, nums: mentionsIn(mentionText(message.data), official) };
      kept.set(key, hit);
    }
    for (const n of hit.nums) out.add(n);
  }
  return out;
}
