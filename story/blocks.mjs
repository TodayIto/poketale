import speciesTable from '../data/names/species.json' with { type: 'json' };
import movesTable from '../data/names/moves.json' with { type: 'json' };
import abilitiesTable from '../data/names/abilities.json' with { type: 'json' };
import itemsTable from '../data/names/items.json' with { type: 'json' };
import storyNames from '../data/story-names.json' with { type: 'json' };
import { PARTY_MAX, MAX_LEVEL, MAX_MOVES, OT_NAME_MAX } from './rules.mjs';
import { toID } from '../names/index.js';

export const norm = s => String(s ?? '').normalize('NFKC').replace(/♀/g, 'f').replace(/♂/g, 'm').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

const TABLES = { species: speciesTable, moves: movesTable, abilities: abilitiesTable, items: itemsTable };
const KIND_KO = { species: '포켓몬', moves: '기술', abilities: '특성', items: '도구' };
const reverse = {};

function buildReverse(kind) {
  const names = new Map(), aliases = new Map();
  const add = (k, id) => { if (!k) return; const old = names.get(k); if (old === undefined || id.length < old.length) names.set(k, id); };
  const alias = (k, id) => { if (!k) return; aliases.set(k, aliases.has(k) && aliases.get(k) !== id ? null : id); };
  for (const [id, r] of Object.entries(TABLES[kind])) {
    if (r.en) add(toID(r.en), id), add(norm(r.en), id);
    if (!r.ko) continue;
    add(norm(r.ko), id);

    const m = /^(.+?)\s*\((.+)\)$/.exec(r.ko);
    if (kind !== 'species' || !m) continue;
    const base = norm(m[1]), inner = norm(m[2]);
    if (inner.includes(base)) alias(inner, id);
    const region = /^(.+)의 ?모습$/.exec(m[2].trim());
    if (region) alias(norm(region[1]) + base, id), alias(base + norm(region[1]), id);
  }
  return reverse[kind] = { names, aliases };
}

export function lookupId(kind, raw) {
  const table = TABLES[kind];
  if (!table) throw new TypeError(`모르는 이름표: ${kind}`);
  const id = toID(raw);
  if (id && Object.hasOwn(table, id)) return id;
  const { names, aliases } = reverse[kind] ?? buildReverse(kind);
  const k = norm(raw);
  return names.get(id) ?? names.get(k) ?? aliases.get(k) ?? (kind === 'items' ? tmId(raw) : null);
}

let tmByMove;
function tmId(raw) {
  const m = /^\s*(?:tm|기술\s*머신)\s*[-:.#]?\s*(.+?)\s*$/i.exec(raw) ?? /^\s*(.+?)\s*[-:.]?\s*(?:tm|기술\s*머신)\s*$/i.exec(raw);
  if (!m) return null;
  if (/^\d{1,3}$/.test(m[1])) {
    const id = `tm${m[1].padStart(3, '0')}`;
    return Object.hasOwn(itemsTable, id) ? id : null;
  }
  tmByMove ??= new Map(Object.entries(itemsTable).filter(([, r]) => r.move).map(([id, r]) => [r.move, id]));
  const move = lookupId('moves', m[1]);
  return (move && tmByMove.get(move)) ?? null;
}

export function speciesName(raw) {
  const id = lookupId('species', raw);
  return id ? speciesTable[id].en : null;
}

function need(kind, raw, errors) {
  const id = lookupId(kind, raw);
  if (!id) errors.push(`모르는 ${KIND_KO[kind]}: ${String(raw).trim()}`);
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
const TIME = words({ day: ['day', 'morning', 'dawn', 'noon', '낮', '아침', '새벽', '오후', '점심'], night: ['night', 'dusk', 'evening', '밤', '저녁', '황혼', '한밤'] });
const BOSS_CLASS = /관장|사천왕|챔피언|gym\s*leader|elite\s*four|champion/i;

const LOOKS = words({
  boy: ['boy', 'youngboy', '소년', '남자아이', '남자애'], girl: ['girl', 'younggirl', '소녀', '여자아이', '여자애'],
  young_man: ['youngman', '청년', '젊은남자', '젊은남성'], young_woman: ['youngwoman', 'younglady', '숙녀', '아가씨', '젊은여자', '젊은여성'],
  middle_aged_man: ['middleagedman', '중년남자', '중년남성', '아저씨'], middle_aged_woman: ['middleagedwoman', '중년여자', '중년여성', '아주머니', '아줌마'],
  old_man: ['oldman', 'elderlyman', '노인', '할아버지', '노인남자'], old_woman: ['oldwoman', 'elderlywoman', '할머니', '노부인', '노인여자'],
});
const LOOK_GENDER = { boy: 'M', girl: 'F', young_man: 'M', young_woman: 'F', middle_aged_man: 'M', middle_aged_woman: 'F', old_man: 'M', old_woman: 'F' };

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

const BLOCK_RE = /<\s*pkb-(battle|change|end)\s*>([\s\S]*?)<\s*\/\s*pkb-\1\s*>/gi;
const TAG_RE = /<pkb#([a-z0-9]+)>/g;

const MARK_RE = /<pkb!([a-z]):([a-z0-9]+)>/g;

export const MARK = { open: 'p', discarded: 'x', here: 'h', moved: 'm', openedAt: 'w' };

export function findBlocks(text) {
  const out = [];
  for (const m of String(text ?? '').matchAll(BLOCK_RE)) {
    out.push({ kind: m[1].toLowerCase(), body: m[2], start: m.index, end: m.index + m[0].length, key: hashKey(m[2].trim()) });
  }
  return out;
}

export const messageId = (message, index) => message?.chatId ?? `#${index}`;

// Battle key = message id + index of the battle block within the message (from 0) + block content
export const battleKey = (id, n, body) => hashKey(`${id}\n${n}\n${hashKey(String(body ?? '').trim())}`);

export const battlesInText = (text, id) => findBlocks(text).filter(b => b.kind === 'battle').map((b, n) => ({ ...b, hash: b.key, key: battleKey(id, n, b.body) }));

// Battle blocks in a message
export const battlesIn = (message, index) => battlesInText(message?.data ?? '', messageId(message, index));

export function findTags(text) {
  return [...String(text ?? '').matchAll(TAG_RE)].map(m => ({ key: m[1], start: m.index, end: m.index + m[0].length }));
}

export function findMarks(text) {
  return [...String(text ?? '').matchAll(MARK_RE)].map(m => ({ kind: m[1], key: m[2], start: m.index, end: m.index + m[0].length }));
}
export const markText = (kind, key) => `<pkb!${kind}:${key}>`;

export function stripForPrompt(text) {
  return String(text ?? '').replace(BLOCK_RE, '').replace(TAG_RE, '').replace(MARK_RE, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function lines(body, errors) {
  const out = [];
  for (const raw of String(body ?? '').split(/\r?\n/)) {
    const line = raw.replace(/^\s*[-*•·]\s+/, '').trim();
    if (!line) continue;
    const m = /^([^:：]+?)\s*[:：]\s*(.*)$/.exec(line);
    if (!m) { errors.push(`읽을 수 없는 줄: ${line}`); continue; }
    out.push({ key: norm(m[1]), value: m[2].trim(), line });
  }
  return out;
}

const BATTLE_KEYS = words({
  opponent: ['opponent', 'type', 'battle', 'vs', '상대', '종류', '배틀'], name: ['name', 'trainer', 'trainername', '이름', '트레이너이름'],
  gender: ['gender', 'sex', '성별'], look: ['look', 'looks', 'appearance', '모습', '외모', '겉모습'], class: ['class', 'trainerclass', 'job', '직업'], rank: ['rank', 'tier', '등급'],
  place: ['place', 'biome', 'location', 'area', '장소', '바이옴', '지형'], time: ['time', '시간', '시간대'], pokemon: ['pokemon', 'mon', '포켓몬'],
});
const SET_KEYS = words({
  ability: ['ability', '특성'], moves: ['moves', 'move', '기술', '기술들'], item: ['item', 'helditem', 'hold', '도구', '지닌도구', '지닌물건'],
  nature: ['nature', '성격'], gender: ['gender', 'sex', '성별'], shiny: ['shiny', '이로치', '색이다름'], tera: ['tera', 'teratype', '테라', '테라타입'],
  name: ['nickname', 'name', '별명', '이름', '닉네임'], hp: ['hp', '체력'], status: ['status', '상태', '상태이상'], level: ['level', 'lv', 'lvl', '레벨'],
  box: ['box', '박스'], party: ['party', '파티'], ot: ['ot', 'originaltrainer', '어버이'],
});
const CHANGE_KEYS = words({
  add: ['add', 'get', 'catch', '추가', '얻음', '받음', '잡음'], level: ['level', 'levelup', 'lv', '레벨', '레벨업'], heal: ['heal', 'restore', '회복', '치료'],
  item: ['item', 'bag', 'items', '도구', '가방', '아이템'], release: ['release', 'farewell', '놓아주기', '떠나보내기', '방생'],
  deposit: ['deposit', 'tobox', '맡기기', '보관'], withdraw: ['withdraw', 'toparty', '꺼내기'], nickname: ['nickname', 'rename', '별명', '이름'],
  hold: ['hold', 'helditem', 'give', '지닌도구', '지니기', '들리기'], evolve: ['evolve', 'evolution', '진화'], teach: ['teach', 'learn', 'move', '기술', '가르치기', '배우기'],
  money: ['money', 'cash', '돈', '소지금', '금액'],
});

const LEVEL_RES = [/(?:\blv\.?|\blvl\.?|\bl|레벨)\s*\.?\s*(\d{1,3})(?!\d)/i, /(?<!\d)(\d{1,3})\s*(?:레벨|lv\b)/i];

function takeLevel(text) {
  for (const re of LEVEL_RES) {
    const m = re.exec(text);
    if (m) return { level: Number(m[1]), rest: (text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length)).trim() };
  }
  return { level: null, rest: text.trim() };
}

function splitSeg(seg, map) {
  const m = /^(\S+)(?:\s+(\S+))?/.exec(seg);
  if (!m) return null;
  for (const [head, n] of [[m[1] + (m[2] ?? ''), 2], [m[1], 1]]) {
    const k = norm(head.replace(/[:：]$/, ''));
    if (n === 2 && !m[2]) continue;
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
  if (n > 100) { warn?.(`HP 는 100% 까지: ${s} → 100%`); return 100; }
  return n;
}

function parseSet(value, errors, dest, warnings = errors) {
  const warn = text => warnings.push(text);
  const segs = String(value).split(/[|｜]/).map(s => s.trim()).filter(Boolean);
  if (!segs.length) { errors.push('포켓몬 줄이 비었음'); return null; }
  let { level, rest } = takeLevel(segs[0]);
  const set = {};
  let to = 'party', ot = null;
  for (const seg of segs.slice(1)) {
    const kv = splitSeg(seg, SET_KEYS);
    if (!kv) {

      const lv = takeLevel(seg);
      if (level == null && lv.level != null && !lv.rest) { level = lv.level; continue; }
      if (/^\d+(?:\.\d+)?\s*%$/.test(seg)) { set.hpPercent = percent(seg, warn); continue; }
      if (GENDER.has(norm(seg)) && /^[♂♀]$/.test(seg)) { set.gender = GENDER.get(norm(seg)); continue; }
      if (NOT_SHINY.has(norm(seg))) continue;
      errors.push(`모르는 덧붙임: ${seg}`);
      continue;
    }
    const [k, v] = kv;
    if (k === 'shiny') {
      const yes = v ? SHINY.get(norm(v)) : 'yes';
      if (yes === 'yes') set.shiny = true;
      else if (yes !== 'no') errors.push(`이로치는 예/아니오: ${seg}`);
      continue;
    }
    if (k === 'box' || k === 'party') {
      if (dest) to = k; else errors.push(`배틀 블록에는 쓸 수 없음: ${seg}`);
      continue;
    }
    if (!v) { errors.push(`값이 없음: ${seg}`); continue; }
    if (k === 'ot') {

      if (dest) ot = v.slice(0, OT_NAME_MAX); else errors.push(`배틀 블록에는 쓸 수 없음: ${seg}`);
      continue;
    }
    if (k === 'level') {
      const n = /^(?:lv\.?\s*)?(\d{1,3})$/i.exec(v);
      if (n) level = Number(n[1]); else errors.push(`레벨을 읽을 수 없음: ${v}`);
    } else if (k === 'ability') {
      const id = need('abilities', v, errors); if (id) set.ability = id;
    } else if (k === 'item') {
      const id = need('items', v, errors); if (id) set.item = id;
    } else if (k === 'moves') {
      const moves = v.split(/[,，、\/]/).map(s => s.trim()).filter(Boolean).map(s => need('moves', s, errors)).filter(Boolean);
      if (moves.length > MAX_MOVES) errors.push(`기술은 ${MAX_MOVES}개까지: ${moves.length}개`);
      if (moves.length) set.moves = [...new Set(moves)].slice(0, MAX_MOVES);
    } else if (k === 'nature') {
      const n = storyNames.natures[norm(v)];
      if (n) set.nature = n; else errors.push(`모르는 성격: ${v}`);
    } else if (k === 'gender') {
      const g = GENDER.get(norm(v));
      if (g) set.gender = g; else errors.push(`모르는 성별: ${v}`);
    } else if (k === 'tera') {
      const t = storyNames.types[norm(v)];
      if (t) set.teraType = t; else errors.push(`모르는 테라 타입: ${v}`);
    } else if (k === 'name') {
      set.name = v;
    } else if (k === 'hp') {
      const p = percent(v, warn);
      if (p != null) set.hpPercent = p; else errors.push(`HP 는 0~100%: ${v}`);
    } else if (k === 'status') {
      const s = STATUS.get(norm(v));
      if (s !== undefined) set.status = s; else errors.push(`모르는 상태: ${v}`);
    }
  }
  if (!rest) { errors.push(`포켓몬 이름이 없음: ${segs[0]}`); return null; }
  const species = speciesName(rest);
  if (!species) { errors.push(`모르는 포켓몬: ${rest}`); return null; }
  if (level == null) { errors.push(`레벨이 없음: ${rest}`); return null; }
  if (level < 1 || level > MAX_LEVEL) { errors.push(`레벨은 1~${MAX_LEVEL}: ${rest} Lv${level}`); return null; }
  return { set: { species, level, ...set }, to, ...(ot ? { ot } : {}) };
}

export function parseBattle(body) {
  const errors = [];
  let fatal = false;
  const spec = { wild: null, name: null, gender: null, look: null, trainerClass: null, boss: null, place: 'plains', time: 'day', team: [] };
  for (const { key, value, line } of lines(body, errors)) {
    const k = BATTLE_KEYS.get(key);
    if (!k) { errors.push(`모르는 항목: ${line}`); continue; }
    if (k === 'pokemon') {
      const r = parseSet(value, errors, false);
      if (r) spec.team.push(r.set); else fatal = true;
      continue;
    }
    if (!value) { errors.push(`값이 없음: ${line}`); continue; }
    if (k === 'opponent') {
      const o = OPPONENT.get(norm(value));
      if (o) spec.wild = o === 'wild'; else errors.push(`상대는 야생/트레이너: ${value}`);
    } else if (k === 'name') spec.name = value;
    else if (k === 'class') spec.trainerClass = value;
    else if (k === 'gender') {
      const g = GENDER.get(norm(value));
      if (g) spec.gender = g; else errors.push(`모르는 성별: ${value}`);
    } else if (k === 'look') {
      const l = LOOKS.get(norm(value));
      if (l) spec.look = l; else errors.push(`모르는 모습: ${value}`);
    } else if (k === 'rank') {
      const r = RANK.get(norm(value));
      if (r) spec.boss = r === 'boss'; else errors.push(`등급은 일반/보스: ${value}`);
    } else if (k === 'place') {
      const b = storyNames.biomes[norm(value)];
      if (b) spec.place = b; else errors.push(`모르는 장소: ${value} (초원으로)`);
    } else if (k === 'time') {
      const t = TIME.get(norm(value));
      if (t) spec.time = t; else errors.push(`시간은 낮/밤: ${value}`);
    }
  }
  if (spec.wild == null) { errors.push('상대(야생/트레이너)가 없음'); fatal = true; }
  const n = spec.team.length;
  if (!n && !fatal) { errors.push('포켓몬이 없음'); fatal = true; }
  if (spec.wild === true && n > 1) { errors.push(`야생은 한 마리만: ${n}마리`); fatal = true; }
  if (spec.wild === false && n > PARTY_MAX) { errors.push(`트레이너 포켓몬은 ${PARTY_MAX}마리까지: ${n}마리`); fatal = true; }

  // Without a rank, guess from the class (else the name)
  if (spec.boss == null) spec.boss = !spec.wild && BOSS_CLASS.test(`${spec.trainerClass ?? ''} ${spec.name ?? ''}`);

  if (spec.look) spec.gender = LOOK_GENDER[spec.look];
  return { spec: fatal ? null : spec, errors };
}

function ref(str, errors) {
  const s = String(str ?? '').trim();

  const b = /^(?:box|storage|박스)\s*#?\s*(\d+)(?:번)?$/i.exec(s);
  if (b) {
    const box = Number(b[1]);
    if (box >= 1) return { box };
    errors.push(`박스 번호는 1부터: ${s}`);
    return null;
  }
  const m = /^#\s*(\d+)(?:번)?$/.exec(s);
  if (m) {
    const slot = Number(m[1]);
    if (slot >= 1 && slot <= PARTY_MAX) return { slot };
    errors.push(`파티 번호는 #1~#${PARTY_MAX}: ${s}`);
    return null;
  }
  if (!s || s.startsWith('#')) { errors.push(s ? `파티 번호를 읽을 수 없음: ${s}` : '누구인지 없음'); return null; }
  return { name: s };
}

function headRef(value, rest = true) {
  const s = value.trim();
  const slot = /^(#\s*\d+(?:번)?)\s*(.*)$/.exec(s);
  if (slot) return [slot[1], slot[2].trim()];
  const parts = s.split(/\s+/).filter(Boolean);
  for (let n = parts.length - (rest ? 1 : 0); n >= 2; n--) {
    const head = parts.slice(0, n).join(' ');
    if (speciesName(head)) return [head, parts.slice(n).join(' ')];
  }
  return parts.length ? [parts[0], parts.slice(1).join(' ')] : ['', ''];
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

export function parseChange(body) {
  const errors = [], warnings = [];
  const ops = [];
  for (const { key, value, line } of lines(body, errors)) {
    const op = CHANGE_KEYS.get(key);
    if (!op) { errors.push(`모르는 항목: ${line}`); continue; }
    if (!value) { errors.push(`값이 없음: ${line}`); continue; }
    const errs = [], warns = [];
    const r = parseOp(op, value, errs, warns);
    errors.push(...errs, ...warns);
    warnings.push(...warns);

    if (r && !errs.length) ops.push(r);
  }
  return { ops, errors, warnings };
}

function parseOp(op, value, errors, warnings) {
  const warn = text => warnings.push(text);
  switch (op) {
    case 'add': {
      const r = parseSet(value, errors, true, warnings);
      return r && { op, set: r.set, to: r.to, ...(r.ot ? { ot: r.ot } : {}) };
    }
    case 'level': {
      const m = /^(.*?)\s*(?:([+-])\s*(\d{1,3})|=\s*(?:lv\.?\s*)?(\d{1,3})|(?:lv\.?\s*|레벨\s*)?(\d{1,3}))\s*(?:레벨)?$/i.exec(value);
      if (!m || !m[1] || /^#\s*$/.test(m[1])) { errors.push(`레벨 변경을 읽을 수 없음: ${value} (예: #1 +3, #1 =20)`); return null; }
      const who = ref(m[1], errors);
      if (!who) return null;
      if (m[3] != null) {
        const delta = Number(m[2] + m[3]);
        if (!delta) { errors.push(`레벨 변화가 0: ${value}`); return null; }
        return { op, ref: who, delta };
      }
      const to = Number(m[4] ?? m[5]);
      if (to < 1 || to > MAX_LEVEL) { errors.push(`레벨은 1~${MAX_LEVEL}: ${to}`); return null; }
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

      const { name, n } = /^\s*(?:tm|기술\s*머신)\s*[-:.#]?\s*\d{1,3}\s*$/i.test(value) ? { name: value.trim(), n: 1 } : tailCount(value, 1);
      const item = need('items', name, errors);
      if (!item) return null;
      if (!Number.isSafeInteger(n)) { errors.push(`도구 개수가 너무 큼: ${value}`); return null; }
      if (!n) { errors.push(`도구 개수가 0: ${value}`); return null; }
      return { op, item, delta: n };
    }
    case 'release': case 'deposit': case 'withdraw': {
      const who = ref(value, errors);
      return who && { op, ref: who };
    }
    case 'nickname': {
      const [h, name] = headRef(value);
      if (!name) { errors.push(`새 별명이 없음: ${value}`); return null; }
      const who = ref(h, errors);
      return who && { op, ref: who, name };
    }
    case 'hold': {
      const [h, rest] = headRef(value, false);
      const who = ref(h, errors);
      if (!who) return null;
      if (!rest || NONE.has(norm(rest))) return { op, ref: who, item: null };
      const item = need('items', rest, errors);
      return item && { op, ref: who, item };
    }
    case 'evolve': {
      const [h, rest] = headRef(value);
      if (!rest) { errors.push(`무엇으로 진화하는지 없음: ${value}`); return null; }
      const who = ref(h, errors);
      if (!who) return null;
      const species = speciesName(rest);
      if (!species) { errors.push(`모르는 포켓몬: ${rest}`); return null; }
      return { op, ref: who, species };
    }
    case 'teach': {
      const [h, rest] = headRef(value);
      const who = ref(h, errors);
      if (!who) return null;

      let learn = rest, forget = null;
      const f = /^(.*?)\s+(?:forget|replace|replacing|잊기|잊고|잊음)\s+(.+)$/i.exec(rest);
      const d = /^(.+?)\s+(?:대신|instead\s+of)\s+(.+)$/i.exec(rest);
      if (f) [learn, forget] = [f[1], f[2]];
      else if (d) [forget, learn] = [d[1], d[2]];
      if (!learn) { errors.push(`배울 기술이 없음: ${value}`); return null; }
      const move = need('moves', learn, errors);
      const old = forget ? need('moves', forget, errors) : null;
      if (!move || (forget && !old)) return null;
      return old ? { op, ref: who, move, forget: old } : { op, ref: who, move };
    }
    case 'money': {
      const m = /^([+-])?\s*[₩$]?\s*(\d[\d,]*)\s*(?:원|₩|p|pokedollars?)?$/i.exec(value.trim());
      if (!m) { errors.push(`돈을 읽을 수 없음: ${value} (예: +500)`); return null; }
      const delta = Number((m[1] ?? '+') + m[2].replace(/,/g, ''));

      if (!Number.isSafeInteger(delta)) { errors.push(`돈 숫자가 너무 큼: ${value}`); return null; }
      if (!delta) { errors.push(`돈 변화가 0: ${value}`); return null; }
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
    if (END_KEYS.get(key) !== 'result') { errors.push(`모르는 항목: ${line}`); continue; }
    const r = END_RESULT.get(norm(value));
    if (r) outcome = r; else errors.push(`결과는 승리/패배/중단: ${value}`);
  }
  return { outcome: outcome ?? 'stop', errors };
}
