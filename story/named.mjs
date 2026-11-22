import named from '../data/named-trainers.json' with { type: 'json' };
import { norm } from './norm.mjs';
import { poolBounds } from './trainer-pool.mjs';

const TITLES = new Set(named.titles);

const CLASSES = new Set(named.classes);

const words = text => String(text ?? '').split(/[\s·,]+/).map(norm).filter(Boolean);

const SPLIT = /[\s·,]+/, SPLIT_JA = /[\s·,・･、､]+/;

const JAPANESE = Object.freeze({ ...named.ja });
const WITH_JAPANESE = Object.freeze({ ...named.names, ...JAPANESE });

const JA_HONORIFICS = ['さん', 'くん', '君', 'ちゃん', '様', 'さま', '先生', 'せんせい', '氏', '殿', 'どの', '先輩', 'せんぱい'];
const JA_HONORIFIC_SUFFIX = [...JA_HONORIFICS].sort((a, b) => b.length - a.length); // attached forms - longest first
const KATAKANA = /^[\p{Script=Katakana}ー]+$/u;

const jaUnsuffixed = (word, names) => {
  if (Object.hasOwn(names, word)) return word;
  const suffix = JA_HONORIFIC_SUFFIX.find(s => word.length > s.length && word.endsWith(s));
  const stem = suffix ? word.slice(0, -suffix.length) : '';
  return stem && (KATAKANA.test(stem) || Object.hasOwn(names, stem)) ? stem : word;
};

const titleNo = (word, titles) => {
  for (let at = word.indexOf('の'); at > 0; at = word.indexOf('の', at + 1)) {
    const head = word.slice(0, at), tail = word.slice(at + 1);
    if (norm(tail) && titles.has(norm(head))) return [head, tail];
  }
  return [word];
};

export const HONORIFICS = ['님', '씨', '군', '양', '선생', '선생님', '선배', '선배님', 'mr', 'mrs', 'ms', 'miss', 'mister', 'sir', 'madam', 'maam'];
const HONORIFIC_SUFFIX = ['선생님', '선배님', '선배', '님', '씨']; // attached forms - longest first
const unsuffixed = word => {
  if (Object.hasOwn(named.names, word) || TITLES.has(word) || CLASSES.has(word)) return word;
  const suffix = HONORIFIC_SUFFIX.find(s => word.length > s.length && word.endsWith(s));
  return suffix ? word.slice(0, -suffix.length) : word;
};

export const MORE_TITLES = Object.freeze(['섬킹', '섬퀸', '캡틴', '시련 캡틴', 'Island Kahuna', 'Kahuna', 'Trial Captain', 'Captain',
  'しまキング', 'しまクイーン', 'キャプテン', 'ジムリーダー', '四天王', 'してんのう', 'チャンピオン', '博士', 'はかせ', 'ライバル', 'ボス'].map(norm));

const NO_NAME = '상대';

const NAMELESS = ['이름 없음', '이름 모를', '무명', 'unnamed', 'nameless', 'no name'];

function stripName({ wild = false, name, trainerClass, oldTitles = false, oldJapanese = false } = {}, names = named.names, ja = JAPANESE) {
  if (wild || !name) return { hit: null, rest: [] };
  if (!oldJapanese) names = names === named.names && ja === JAPANESE ? WITH_JAPANESE : { ...names, ...ja };
  const titles = new Set([...TITLES, ...(oldTitles ? [] : MORE_TITLES)]);
  const strip = new Set([...titles, ...HONORIFICS, ...(oldJapanese ? [] : JA_HONORIFICS), ...CLASSES, ...words(trainerClass), norm(trainerClass), NO_NAME, ...NAMELESS.map(norm)]);
  const joined = list => list.map(w => w.key).join('');
  // number of words to strip from the front (or back) - 0 if none
  const front = list => { for (let n = list.length; n > 0; n--) if (strip.has(joined(list.slice(0, n)))) return n; return 0; };
  const back = list => { for (let n = list.length; n > 0; n--) if (strip.has(joined(list.slice(-n)))) return n; return 0; };
  let rest = String(name).split(oldJapanese ? SPLIT : SPLIT_JA).flatMap(w => (oldJapanese ? [w] : titleNo(w, titles))).filter(w => norm(w)).map(w => {
    const key = oldJapanese ? unsuffixed(norm(w)) : jaUnsuffixed(unsuffixed(norm(w)), names);
    return { text: key === norm(w) ? w : key, key };
  });
  while (rest.length) {
    const hit = Object.hasOwn(names, joined(rest)) ? names[joined(rest)] : null;
    if (hit) return { hit, rest };
    const head = front(rest);
    if (head) { rest = rest.slice(head); continue; }
    const tail = back(rest);
    if (tail) rest = rest.slice(0, -tail);
    else break;
  }
  return { hit: null, rest };
}

export const namedTrainer = battle => stripName(battle).hit;

export const namedIn = (battle, names, ja = {}) => stripName(battle, names, ja).hit;

export const personalName = battle => stripName(battle).rest.map(w => w.text).join(' ');

export const SHOWDOWN_TRAINER = 'showdown:';

export const isNamedSprite = key => typeof key === 'string' && Object.hasOwn(named.people, key);

/** Picture key -> [Korean, English] name (official spelling) | null */
export const namedPerson = key => (isNamedSprite(key) ? named.people[key] : null);

export const cardFace = key => (isNamedSprite(key) && Object.hasOwn(named.showdown, key) ? named.showdown[key] : null);

export const namedGender = key => (isNamedSprite(key) ? named.gender[key] ?? null : null);

export const cardBounds = face => named.faceBounds?.[face] ?? poolBounds(face);

export const cardSheet = key => (isNamedSprite(key) && Object.hasOwn(named.sheet, key) ? { key, rect: named.sheet[key] } : null);

export const plainTrainerSprite = gender => (gender === 'F' ? 'ace_trainer_f' : 'ace_trainer_m');

export const BOSS_BGM = 'battle_unova_elite';

const ROCKET = /로켓\s*단|rocket/i;
export function bossBgm({ wild = false, boss = false, sprite = null, name = null, trainerClass = null } = {}) {
  if (wild) return null;
  if (sprite === 'giovanni' && ROCKET.test(`${name ?? ''} ${trainerClass ?? ''}`)) return named.rocketBgm;
  if (isNamedSprite(sprite)) return named.music[sprite] ?? BOSS_BGM;
  return boss ? BOSS_BGM : null;
}
