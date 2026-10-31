import named from '../data/named-trainers.json' with { type: 'json' };
import { norm } from './blocks.mjs';

const TITLES = new Set(named.titles);

const CLASSES = new Set(named.classes);

const words = text => String(text ?? '').split(/[\s·,]+/).map(norm).filter(Boolean);

export const HONORIFICS = ['님', '씨', '군', '양', '선생', '선생님', '선배', '선배님', 'mr', 'mrs', 'ms', 'miss', 'mister', 'sir', 'madam', 'maam'];
const HONORIFIC_SUFFIX = ['선생님', '선배님', '선배', '님', '씨'];
const unsuffixed = word => {
  if (Object.hasOwn(named.names, word) || TITLES.has(word) || CLASSES.has(word)) return word;
  const suffix = HONORIFIC_SUFFIX.find(s => word.length > s.length && word.endsWith(s));
  return suffix ? word.slice(0, -suffix.length) : word;
};

const NO_NAME = '상대';

const NAMELESS = ['이름 없음', '이름 모를', '무명', 'unnamed', 'nameless', 'no name'];

function stripName({ wild = false, name, trainerClass } = {}) {
  if (wild || !name) return { hit: null, rest: [] };
  const strip = new Set([...TITLES, ...HONORIFICS, ...CLASSES, ...words(trainerClass), norm(trainerClass), NO_NAME, ...NAMELESS.map(norm)]);
  const joined = list => list.map(w => w.key).join('');

  const front = list => { for (let n = list.length; n > 0; n--) if (strip.has(joined(list.slice(0, n)))) return n; return 0; };
  const back = list => { for (let n = list.length; n > 0; n--) if (strip.has(joined(list.slice(-n)))) return n; return 0; };
  let rest = String(name).split(/[\s·,]+/).filter(w => norm(w)).map(w => {
    const key = unsuffixed(norm(w));
    return { text: key === norm(w) ? w : key, key };
  });
  while (rest.length) {
    const hit = named.names[joined(rest)];
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

export const personalName = battle => stripName(battle).rest.map(w => w.text).join(' ');

export const SHOWDOWN_TRAINER = 'showdown:';

export const isNamedSprite = key => typeof key === 'string' && Object.hasOwn(named.people, key);

// Picture key -> [Korean, English] name (official spelling) | null
export const namedPerson = key => (isNamedSprite(key) ? named.people[key] : null);

export const cardFace = key => (isNamedSprite(key) && Object.hasOwn(named.showdown, key) ? named.showdown[key] : null);

export const namedGender = key => (isNamedSprite(key) ? named.gender[key] ?? null : null);

export const cardBounds = face => named.faceBounds?.[face] ?? null;

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
