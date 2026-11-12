// Petting, feeding and visit state.
// Modified for PokeTale on 2026-11-12. See THIRD-PARTY-NOTICES.md.
// Ported from PlayNav (https://github.com/poooooby/PlayNav): data/amie_rules.lua (PET, HIT, HIGH_FIVE, IDLE numbers),
// src/amie/session.lua (petTouch, hit, highFive, feedStart / feedHold: bites), src/amie/play.lua (handlePress, update: wake, petting, high five, dozing),
// src/amie/rules.lua (the Poke Puff catalogue), data/amie_rules.lua PUFF (bites per species, the pace of a nearly full Pokemon, species that do not eat).
// PlayNav is MIT License, Copyright (c) 2026 poooooby - THIRD-PARTY-NOTICES.md.

import SPOT_TABLE from '../data/amie-spots.json' with { type: 'json' };
import { FRIENDSHIP_MAX } from '../engine/friendship.mjs';
import { toID } from '../engine/mon.mjs';
import { OUTSIDE_ITEMS, FOOD_BERRY } from './items.mjs';
import { isCustomItem, hasTag } from './custom-items.mjs';

export const ENJOY_MAX = 100;

export const ENJOY_PER_MESSAGE = 10;

export const ENJOY_STEP = 5;
export const FRIENDSHIP_PER_STEP = 1;

export const canPet = mon => !mon.egg && mon.hp !== 0;

export const canJoin = mon => canPet(mon) && !mon.status;

export const GAME_COMPANIONS = 2;

export function pickCompanions(candidates, { most = GAME_COMPANIONS, random = Math.random } = {}) {
  return candidates.map(one => ({ one, key: random() }))
    .sort((a, b) => enjoymentOf(b.one) - enjoymentOf(a.one) || a.key - b.key)
    .slice(0, most).map(({ one }) => one);
}

export const gameCandidates = (party, mon) => party.filter(other => other.uid !== mon.uid && canJoin(other));

const NO_STROKE = new Set([218, 378]);
export const strokable = num => !NO_STROKE.has(num);

export const enjoymentOf = mon => mon?.enjoy ?? ENJOY_MAX;

export const spendable = (enjoy, most) => Math.max(0, Math.min(most, Math.floor(enjoy / ENJOY_STEP) * ENJOY_STEP));

export const friendshipFor = spent => Math.floor(spent / ENJOY_STEP) * FRIENDSHIP_PER_STEP;

export function setEnjoyment(mon, value) {
  if (value >= ENJOY_MAX) delete mon.enjoy;
  else mon.enjoy = Math.max(0, value);
}

export const FULL_MAX = 100;

const FULL_PER_MESSAGE = 10;

export const FULL_PER_FOOD = 30;

export const fullnessOf = mon => mon?.full ?? 0;

export const canEat = mon => fullnessOf(mon) < FULL_MAX;

export function setFullness(mon, value) {
  if (value <= 0) delete mon.full;
  else mon.full = Math.min(FULL_MAX, value);
}

export function afterMessage(state) {
  if (!state.party.some(mon => mon.enjoy !== undefined || mon.full !== undefined)) return state;
  return { ...state, party: state.party.map(mon => {
    if (mon.enjoy === undefined && mon.full === undefined) return mon;
    const next = { ...mon };
    if (mon.enjoy !== undefined) setEnjoyment(next, mon.enjoy + ENJOY_PER_MESSAGE);
    if (mon.full !== undefined) setFullness(next, mon.full - FULL_PER_MESSAGE);
    return next;
  }) };
}

const FOOD_CUSTOM = 1;

export function foodFriendship(id, sim, holder) {
  if (isCustomItem(id)) return hasTag(holder, id, 'food') ? FOOD_CUSTOM : 0;
  const key = toID(id);
  return (Object.hasOwn(OUTSIDE_ITEMS, key) ? OUTSIDE_ITEMS[key].food : null) ?? (sim.Dex.items.get(key).isBerry ? FOOD_BERRY : 0);
}

export const PUFF_FLAVORS = Object.freeze(['sweet', 'mint', 'citrus', 'mocha', 'spice']);
export const PUFF_GRADES = Object.freeze(['basic', 'frosted', 'fancy', 'deluxe']);
export const FREE_GRADE = 'basic';

export const puffFriendship = grade => (grade === FREE_GRADE ? 1 : 2);

export const feedHeals = fed => parsePuff(fed.puff)?.grade !== FREE_GRADE;

export const puffId = (flavor, grade) => `${flavor}_${grade}`;

export function parsePuff(id) {
  const [flavor, grade, ...rest] = String(id ?? '').split('_');
  return !rest.length && PUFF_FLAVORS.includes(flavor) && PUFF_GRADES.includes(grade) ? { flavor, grade } : null;
}

export const puffCount = (state, id) => state?.puffs?.[id] ?? 0;

export function addPuffs(state, id, delta) {
  const count = Math.max(0, puffCount(state, id) + delta);
  const puffs = { ...state.puffs };
  if (count) puffs[id] = count; else delete puffs[id];
  if (Object.keys(puffs).length) state.puffs = puffs; else delete state.puffs;
  return count;
}

const BITES = { 1: [23, 24, 316, 317, 321, 336, 443, 455],
  2: [3, 95, 103, 115, 130, 131, 143, 146, 148, 149, 150, 160, 199, 208, 226, 244, 245, 248, 249, 250, 289, 297, 306, 320, 330, 350, 357, 381, 382, 383, 384,
    389, 450, 460, 464, 465, 472, 473, 477, 483, 484, 486, 487, 493, 497, 545, 593, 604, 614, 623, 638, 640, 643, 644, 646, 675, 697, 699, 706, 713, 716, 717, 718],
  5: [50, 177, 298, 406, 412, 433, 492, 590, 595, 602, 682] };
const BITES_OF = new Map(Object.entries(BITES).flatMap(([n, list]) => list.map(num => [num, Number(n)])));
export const bitesOf = num => BITES_OF.get(num) ?? 3;

const NON_EATERS = new Set([11, 14, 204, 266, 268, 292, 665]);
export const eatsFood = num => !NON_EATERS.has(num);

export const BITE = Object.freeze({ QUICK: 0.45, SLOW: 1.1, SLOW_AT: 90 });
export const biteSeconds = (fullness, bites) => (bites >= 2 && fullness >= BITE.SLOW_AT ? BITE.SLOW : BITE.QUICK);

const KINDS = Object.freeze({ L: 'liked', N: 'normal', D: 'disliked', X: 'none' });
export const GRID = 6;

export const MIDDLE_CELL = (GRID >> 1) * GRID + (GRID >> 1);

export function parseSpots(text) {
  const cells = String(text).replaceAll('/', '').split('');
  if (cells.length !== GRID * GRID || cells.some(c => !KINDS[c])) throw new TypeError(`Bad spot grid: ${text}`);
  return cells.map(c => KINDS[c]);
}

export const DEFAULT_SPOTS = Array.from({ length: GRID }, (_, r) => 'LND'[Math.floor(r * 3 / GRID)].repeat(GRID)).join('/');

export function spotsFor(ids, table = SPOT_TABLE) {
  const id = ids.find(one => one && Object.hasOwn(table, one));
  return id ? table[id].replaceAll('X', 'N') : DEFAULT_SPOTS;
}

export function bodyPixel(data, width, height, x, y, radius) {
  let best = null, bestD = radius * radius;
  for (let py = Math.max(0, Math.floor(y - radius)); py < Math.min(height, Math.floor(y + radius) + 1); py++) {
    for (let px = Math.max(0, Math.floor(x - radius)); px < Math.min(width, Math.floor(x + radius) + 1); px++) {
      if (!(data[(py * width + px) * 4 + 3] > 0)) continue;
      const dx = Math.max(px - x, 0, x - px - 1), dy = Math.max(py - y, 0, y - py - 1), d = dx * dx + dy * dy;
      if (d <= bestD && (!best || d < bestD)) { best = { x: px, y: py }; bestD = d; }
    }
  }
  return best;
}

export function cellAt(fx, fy) {
  if (!(fx >= 0 && fx < 1 && fy >= 0 && fy < 1)) return -1;
  return Math.floor(fy * GRID) * GRID + Math.floor(fx * GRID);
}

export const TICK_HZ = 30;
export const PET = Object.freeze({
  MOVE: 4,
  SPOT_TICKS: 36,
  NORMAL_TICKS: 96,
  BODY_TICKS: 96,
  DISLIKED_TICKS: 30,
  SWITCH_TICKS: 4,
  OFF_BODY_TICKS: 30,
  LOCK_TICKS: 24,
  DISLIKE_LOCK_TICKS: 24,
  SPEND: 5,
});

export const HIT = Object.freeze({ TICKS: 8, COOL_TICKS: 90, SPEND: 5 });

export const HIGH_FIVE = Object.freeze({ MIN_FRIENDSHIP: 5, POSE_TICKS: 10, STEP: 50, PER_STEP: 30, RAND: 30, SPEND: 5, LEAP_TICKS: 21 });

export const IDLE_TICKS = 900;

export const WAKE_TICKS = 21;

export function highFiveTicks(friendship, random = Math.random) {
  const f = Math.max(0, Math.min(FRIENDSHIP_MAX, friendship));
  return (Math.floor((FRIENDSHIP_MAX - f) / HIGH_FIVE.STEP) + 1) * HIGH_FIVE.PER_STEP + Math.floor(random() * HIGH_FIVE.RAND);
}

export function createPetting({ spots, enjoy = ENJOY_MAX, friendship, back = true, stroke = true, friends = [], random = Math.random }) {
  const kinds = parseSpots(spots);
  const kindAt = cell => (cell >= 0 ? kinds[cell] : 'none');
  const m = { stage: back ? 'back' : 'awake', enjoy, spent: 0, gains: [] };
  const mates = friends.map(one => ({ uid: one.uid, enjoy: enjoymentOf(one), gains: [] }));
  m.pickFriends = () => pickCompanions(mates, { random }).map(one => one.uid);
  m.spendFriends = (uids, most) => [...new Set(uids)].flatMap(uid => {
    const one = mates.find(mate => mate.uid === uid);
    if (!one) return [];
    const spent = spendable(one.enjoy, most);
    if (spent) { one.enjoy -= spent; one.gains.push(spent); }
    return [{ uid, spent, friendship: friendshipFor(spent) }];
  });
  m.friendsSpent = () => mates.filter(one => one.gains.length).map(one => ({ uid: one.uid, gains: [...one.gains] }));
  let tick = 0, wakeT = 0, idle = 0, lock = 0, lastPress = -Infinity, tapReady = 0;
  let touch = null;
  let five = null;
  let fiveLeft = highFiveTicks(friendship, random);
  const freshTouch = () => ({ cls: null, clsT: 0, pend: null, pendT: 0, anyT: 0, offT: 0 });

  const spend = m.spend = most => {
    const spent = spendable(m.enjoy, most);
    m.enjoy -= spent; m.spent += spent;
    if (spent) m.gains.push(spent);
    return { spent, friendship: friendshipFor(spent) };
  };

  m.press = cell => {
    idle = 0;
    if (m.stage === 'back') {
      if (kindAt(cell) === 'none') return [];
      m.stage = 'exclaim'; wakeT = 0;
      return [{ type: 'wake' }];
    }
    if (m.stage === 'exclaim') return [];
    if (m.stage === 'dozing') { m.stage = 'awake'; return [{ type: 'wakeUp' }]; }
    if (kindAt(cell) !== 'none') {
      if (tick - lastPress <= HIT.TICKS) {
        lastPress = -Infinity; touch = null;
        return tap(kindAt(cell));
      }
      lastPress = tick;
      touch = freshTouch();
    } else if (friendship >= HIGH_FIVE.MIN_FRIENDSHIP) five = { held: 0 };
    return [];
  };
  m.release = () => { touch = null; five = null; };

  m.step = ({ down = false, cell = -1, moved = 0 } = {}) => {
    tick++;
    if (m.stage === 'exclaim') {
      if (++wakeT < WAKE_TICKS) return [];
      m.stage = 'awake'; idle = 0;
      return [{ type: 'awake' }];
    }
    if (m.stage !== 'awake') return [];
    idle = down ? 0 : idle + 1;
    if (idle >= IDLE_TICKS) {
      m.stage = 'dozing'; touch = null; five = null;
      return [{ type: 'doze' }];
    }
    if (lock > 0) { lock--; return []; }
    if (five && down) return holdFive();
    if (!touch || !down || !stroke) return [];
    return pet(cell, moved > PET.MOVE);
  };

  function tap(kind) {
    if (!stroke) return [{ type: 'hit', angry: true }];
    if (kind === 'disliked') {
      lock = PET.DISLIKE_LOCK_TICKS;
      return [{ type: 'dislike' }];
    }
    if (tick < tapReady) return [{ type: 'hit', angry: true }];
    tapReady = tick + HIT.COOL_TICKS;
    lock = PET.LOCK_TICKS;
    return [{ type: 'hit' }, { type: 'reward', spot: kind, ...spend(HIT.SPEND) }];
  }

  function holdFive() {
    five.held++;
    if (five.held < HIGH_FIVE.POSE_TICKS) return [];
    const events = five.held === HIGH_FIVE.POSE_TICKS ? [{ type: 'pose' }] : [];
    if (--fiveLeft > 0) return events;
    five = null;
    fiveLeft = highFiveTicks(friendship, random);
    lock = HIGH_FIVE.LEAP_TICKS;
    return [...events, { type: 'highFive', ...spend(HIGH_FIVE.SPEND) }];
  }

  function pet(cell, moving) {
    const kind = kindAt(cell);
    if (kind === 'none') {
      if (++touch.offT >= PET.OFF_BODY_TICKS) touch = { ...freshTouch(), offT: touch.offT };
      return [];
    }
    touch.offT = 0;
    const cls = kind === 'normal' ? `cell${cell}` : kind;
    if (cls !== touch.cls) {
      if (touch.pend !== cls) { touch.pend = cls; touch.pendT = 0; }
      if (touch.cls === null || ++touch.pendT >= PET.SWITCH_TICKS) Object.assign(touch, { cls, clsT: 0, pend: null });
    } else touch.pend = null;
    if (!moving) return [];
    const events = [{ type: 'stroke', spot: kind }];
    if (touch.cls === cls) touch.clsT++;
    if (kind !== 'disliked') touch.anyT++;
    const need = kind === 'disliked' ? PET.DISLIKED_TICKS : kind === 'liked' ? PET.SPOT_TICKS : PET.NORMAL_TICKS;
    const onSpot = touch.cls === cls && touch.clsT >= need;
    const onBody = kind !== 'disliked' && touch.anyT >= PET.BODY_TICKS;
    if (!onSpot && !onBody) return events;
    touch = freshTouch();

    const paid = onSpot ? kind : 'normal';
    if (paid === 'disliked') {
      lock = PET.DISLIKE_LOCK_TICKS;
      return [...events, { type: 'dislike' }];
    }
    lock = PET.LOCK_TICKS;
    return [...events, { type: 'reward', spot: paid, ...spend(PET.SPEND) }];
  }

  return m;
}

export const SPIN = Object.freeze({ TURNS: 1, RADIUS: 6 });

export function spinOf(points) {
  if (!(points?.length >= 3)) return null;
  const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length, cy = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  const radius = points.reduce((sum, p) => sum + Math.hypot(p.x - cx, p.y - cy), 0) / points.length;
  let turned = 0;
  for (let i = 1; i < points.length; i++) {
    let d = Math.atan2(points[i].y - cy, points[i].x - cx) - Math.atan2(points[i - 1].y - cy, points[i - 1].x - cx);
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    turned += d;
  }
  if (radius < SPIN.RADIUS || Math.abs(turned) < SPIN.TURNS * 2 * Math.PI) return null;
  return { clockwise: turned > 0, seconds: (points.at(-1).t - points[0].t) / 1000 };
}
