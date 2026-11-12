// Petting minigames and their rewards.
// Modified for PokeTale on 2026-11-12. See THIRD-PARTY-NOTICES.md.
// Ported from PlayNav (https://github.com/poooooby/PlayNav): src/amie/games/common.lua (THRESHOLDS, REWARDS, rewardList), src/amie/games/berry_picker.lua
// (rotation, patience, kinds, slots), src/amie/games/head_it.lua with data/head_it_rules.lua (stages, flights, crush / purple / giant balls, hit windows, points, combos),
// src/amie/games/tile_puzzle.lua (grids, the swap shuffle). PlayNav is MIT License, Copyright (c) 2026 poooooby - THIRD-PARTY-NOTICES.md.

import { PUFF_FLAVORS, puffId } from './amie.mjs';

export const GAMES = Object.freeze(['berry', 'head', 'tile']);
export const LEVELS = Object.freeze(['easy', 'normal', 'hard']);

export const DEFAULT_LEVEL = 'normal';

export const GAME_SPEND = 20;

export const STARS = Object.freeze([0, 1, 2, 3, 4, 4.5, 5]);
const BERRY = [0, 5, 10, 15, 20, 30, 40];

const THRESHOLDS = {
  berry: { easy: BERRY, normal: BERRY, hard: BERRY },
  head: { easy: [0, 20, 30, 40, 100, 200, 300], normal: [0, 20, 35, 50, 110, 220, 330], hard: [0, 30, 50, 70, 130, 240, 350] },
  tile: { easy: [60, 50, 40, 30, 20, 15], normal: [120, 90, 60, 50, 40, 30], hard: [180, 120, 100, 80, 70, 50] },
};

const STD = {
  easy: ['1B', '2B', '3B', '4B', '5B', '5B+1Fr', '4B+2Fr'],
  normal: ['1B', '2Fr', '3Fr', '4Fr', '5Fr', '5Fr+1Fa', '4Fr+2Fa'],
  hard: ['1B', '2Fa', '3Fa', '4Fa', '5Fa', '5Fa+1D', '4Fa+2D'],
};
const REWARDS = {
  berry: STD, head: STD,
  tile: {
    easy: ['2B', '3B', '3B', '3B', '3B', '2B+1Fr', '1B+2Fr'],
    normal: ['1B+2Fr', '3Fr', '1B+3Fr', '4Fr', '4Fr', '3Fr+1Fa', '2Fr+2Fa'],
    hard: ['1B+1Fr+1Fa', '1Fr+2Fa', '3Fa', '3Fa', '4Fa', '3Fa+1D', '3Fa+2D'],
  },
};
const GRADE_OF = { B: 'basic', Fr: 'frosted', Fa: 'fancy', D: 'deluxe' };

export function starStep(game, level, value) {
  const t = THRESHOLDS[game][level];
  if (game === 'tile') {
    if (value > t[0]) return 0;
    return t.reduce((step, most, i) => (i > 0 && value <= most ? i + 1 : step), 1);
  }
  return t.reduce((step, least, i) => (value >= least ? i : step), 0);
}
export const starsOf = (game, level, value) => STARS[starStep(game, level, value)];

export function prizesFor(game, level, value, random = Math.random) {
  const spec = REWARDS[game][level][starStep(game, level, value)];
  return spec.split('+').flatMap(part => {
    const [, n, code] = /^(\d+)(\w+)$/.exec(part);
    return Array.from({ length: Number(n) }, () => puffId(PUFF_FLAVORS[Math.floor(random() * PUFF_FLAVORS.length)], GRADE_OF[code]));
  });
}

export const BERRY_RULES = Object.freeze({
  SECONDS: 60, SLOTS: 3, PATIENCE: 3, RISE: 0.22, REST: 0.3, REST_SERVED: 0.2,
  KINDS: Object.freeze({ easy: 3, normal: 5, hard: 7 }),

  ROTATION: Object.freeze([{ n: 1, count: 10 }, { n: 2, count: 15 }, { n: 3, count: Infinity }]),
});

export function createBerryPicker(level, random = Math.random) {
  const R = BERRY_RULES;
  const g = { level, kinds: R.KINDS[level], timer: R.SECONDS, score: 0, misses: 0, over: false, t: 0,
    slots: Array.from({ length: R.SLOTS }, (_, i) => ({ up: false, asking: false, want: -1, last: -1, left: 0, rise: 0, rest: 0.1 + i * 0.15, queued: false })) };
  let rot = 0, servedInRot = 0, lastAsker = -1;
  const roll = n => Math.floor(random() * n);
  const patience = () => (level === 'hard' && R.ROTATION[rot].n === 2 ? Math.max(2, R.PATIENCE - servedInRot * 0.08) : R.PATIENCE);

  const pickWant = sl => {
    if (sl.last < 0 || g.kinds < 2) return roll(g.kinds);
    const k = roll(g.kinds - 1);
    return k >= sl.last ? k + 1 : k;
  };
  const advance = () => {
    servedInRot++;
    if (servedInRot >= R.ROTATION[rot].count && rot < R.ROTATION.length - 1) {
      rot++; servedInRot = 0;
      for (const sl of g.slots) if (sl.up) Object.assign(sl, { up: false, asking: false, rest: R.REST });
    }
  };
  const down = (sl, rest) => Object.assign(sl, { up: false, asking: false, rest });

  g.step = dt => {
    if (g.over) return [];
    const events = [];
    g.t += dt;
    g.timer = Math.max(0, g.timer - dt);
    if (!g.timer) {
      g.over = true;
      for (const sl of g.slots) down(sl, 0);
      return [{ type: 'end', score: g.score }];
    }
    let asking = 0;
    g.slots.forEach((sl, i) => {
      if (sl.up && !sl.asking) {
        if ((sl.rise += dt) >= R.RISE) {
          Object.assign(sl, { asking: true, shownAt: g.t, last: sl.want });
          events.push({ type: 'ask', slot: i, want: sl.want });
        }
      } else if (sl.up) {
        if ((sl.left -= dt) <= 0) {
          down(sl, R.REST); g.misses++; advance();
          events.push({ type: 'timeout', slot: i });
        }
      } else sl.rest -= dt;
      if (sl.up || sl.queued) asking++;
    });
    if (asking < R.ROTATION[rot].n) {
      const free = g.slots.map((sl, i) => i).filter(i => !g.slots[i].up && !g.slots[i].queued);
      const fresh = free.filter(i => i !== lastAsker);
      const pool = fresh.length ? fresh : free;
      if (pool.length) { lastAsker = pool[roll(pool.length)]; g.slots[lastAsker].queued = true; }
    }
    g.slots.forEach((sl, i) => {
      if (!sl.queued || sl.up || sl.rest > 0) return;
      sl.want = pickWant(sl);
      Object.assign(sl, { queued: false, up: true, asking: false, rise: 0, left: patience() });
      events.push({ type: 'rise', slot: i });
    });
    return events;
  };

  g.give = (slot, kind) => {
    const sl = g.slots[slot];
    if (g.over || !sl?.asking) return [];
    if (sl.want === kind) {
      const quick = g.t - sl.shownAt <= 1.5;
      g.score++;
      down(sl, R.REST_SERVED); advance();
      return [{ type: 'right', slot, quick }];
    }
    down(sl, R.REST); g.misses++; advance();
    return [{ type: 'wrong', slot }];
  };
  return g;
}

export const HEAD_RULES = Object.freeze({
  FPS: 30, TIME: 1800, SPAWN_Y: 480, GIANT_Y: 580, OUT_TOP: 480, OUT_BOTTOM: -200, RISE_FLOOR: 5, DRIFT: 2 * 0.7447, MIN_GAP_F: 12, HEAD_FRAMES: 8,
  SLOT_X: Object.freeze([0, -100, 100]),

  WINDOW: Object.freeze({ goodHigh: [105, 130], just: [130, 180], goodLow: [180, 205], miss: [240, 280] }), BALL_H: 90, TEST_DROP: 0.25, GIANT_H: 350, GIANT_DROP: 0.4,
  POINTS: Object.freeze({ good: 1, just: 3, fever: 2 }), CAP: 999,
  MILESTONE: Object.freeze([{ every: 100, points: 100 }, { every: 50, points: 50 }, { every: 10, points: 10 }]),

  BIG_BONUS: Object.freeze({ good: 10, just: 50 }),

  CRUSH_MIN_FALL: 300,

  END_WAIT: 30, LEAVE_FRAMES: 18, GIANT_END_FRAMES: 36,

  STAGES: Object.freeze({
    easy: [[90, -8, -15, 30, 30, 600, 5], [90, -8, -15, 30, 30, 600, 5], [90, -8, -15, 30, 30, 299970, 5]],
    normal: [[75, -5, -10, 30, 30, 600, 15], [75, -5, -10, 25, 25, 600, 15], [75, -5, -10, 20, 20, 299970, 15]],
    hard: [[60, -3, -5, 25, 25, 600, 15], [60, -3, -5, 20, 20, 600, 15], [60, -3, -5, 15, 15, 299970, 15]],
  }),

  PATTERNS: Object.freeze({
    easy: { crush: 5, purple: 0, flights: [[1.2, 0.52, 30, 0.4, 36, 0.6], [1.4, 0.56, 32, 0.6, 42, 0.8], [1.6, 0.6, 40, 0.8, 48, 1],
      [1, 0.2, 24, 0.2, 36, 0.4], [1.2, 0.4, 24, 0.4, 36, 0.6], [1.2, 0.4, 30, 0.6, 36, 0.8], [2, 0.8, 30, 0.8, 36, 1], [1.2, 0.6, 40, 0.8, 60, 1]] },
    normal: { crush: 5, purple: 5, flights: [[1.6, 0.6, 32, 0.4, 48, 0.6], [2, 0.4, 32, 0.6, 42, 0.8], [2.2, 0.8, 40, 0.8, 48, 1],
      [1.2, 0.2, 24, 0.2, 36, 0.4], [1.2, 0.4, 24, 0.4, 36, 0.6], [1.2, 0.4, 30, 0.6, 36, 0.8], [2.6, 0.8, 36, 0.8, 38, 1], [1.2, 0.6, 40, 0.8, 60, 1]] },
    hard: { crush: 10, purple: 10, flights: [[1.8, 0.6, 36, 0.4, 54, 0.6], [2, 0.6, 32, 0.6, 42, 0.8], [2.4, 0.8, 40, 0.8, 48, 1],
      [1.2, 0.2, 24, 0.2, 36, 0.4], [1.2, 0.4, 24, 0.4, 36, 0.6], [1.2, 0.4, 30, 0.6, 36, 0.8], [3, 1.2, 40, 0.8, 46, 1], [1.2, 0.6, 40, 0.8, 60, 1]] },
  }),
});

const JUST_MID = (HEAD_RULES.WINDOW.just[0] + HEAD_RULES.WINDOW.just[1]) / 2;

export const headTestY = (y, giant = false) => 120 - y + (giant ? HEAD_RULES.GIANT_H * HEAD_RULES.GIANT_DROP : HEAD_RULES.BALL_H * HEAD_RULES.TEST_DROP);

export function headGrade(y, giant = false) {
  const s = headTestY(y, giant), W = HEAD_RULES.WINDOW;
  if (s >= W.just[0] && s < W.just[1]) return 'just';
  if ((s >= W.goodHigh[0] && s < W.goodHigh[1]) || (s >= W.goodLow[0] && s < W.goodLow[1])) return 'good';
  return null;
}

export function createHeadIt(level, random = Math.random) {
  const H = HEAD_RULES, stages = H.STAGES[level], pattern = H.PATTERNS[level];
  const g = { level, timer: H.TIME, points: 0, combo: 0, maxCombo: 0, fever: false, stage: 0, mons: 1, balls: [], heads: [0, 0, 0], phase: 'play', bonus: 0,
    over: false, score: 0 };
  let stageF = 0, interval = stages[0][0], counter = -1, lastCrush = false, wait = 0;
  const roll = n => Math.floor(random() * n);
  const row = () => stages[g.stage];
  const flightOf = kind => pattern.flights[{ plain: g.stage, crush: 3 + g.stage, purple: 6, giant: 7 }[kind]];

  const arriveIn = (y, v, grav) => {
    for (let n = 0; n <= 900; n++) {
      if (headTestY(y) >= JUST_MID) return n;
      v += grav; y -= v;
    }
    return Infinity;
  };

  const fallIn = (f, n) => {
    let v = f[0], y = 0;
    for (let i = 0; i < n; i++) { v += f[1]; y += v; }
    return y;
  };
  const clearOn = (slot, f) => {
    const due = arriveIn(H.SPAWN_Y, f[0], f[1]);
    return g.balls.every(b => b.slot !== slot || b.state !== 'fall' || b.missed || Math.abs(arriveIn(b.y, b.v, b.g) - due) >= H.MIN_GAP_F);
  };

  const kindOf = () => {
    if (lastCrush) return 'plain';
    const r = roll(100);
    if (r < pattern.crush) return fallIn(flightOf('crush'), Math.floor(interval)) > H.CRUSH_MIN_FALL ? 'crush' : 'plain';
    return r < pattern.crush + pattern.purple ? 'purple' : 'plain';
  };

  const launch = () => {
    const n = g.mons;
    const first = n === 2 ? roll(2) : n >= 3 ? roll(3) : 0;
    const order = [first, ...[0, 1, 2].filter(s => s !== first)].filter(s => s < n);
    let kind = kindOf(), slot = order.find(s => clearOn(s, flightOf(kind)));
    if (slot === undefined && kind !== 'plain') { kind = 'plain'; slot = order.find(s => clearOn(s, flightOf(kind))); }
    if (slot === undefined) return false;
    lastCrush = kind === 'crush';
    const f = flightOf(kind);
    g.balls.push({ slot, x: H.SLOT_X[slot], y: H.SPAWN_Y, v: f[0], g: f[1], f, kind, state: 'fall', missed: false });
    return true;
  };
  const missBall = b => {
    b.missed = true;
    if (b.kind === 'giant') return { type: 'miss', slot: b.slot, giant: true };
    g.combo = 0; g.fever = false; interval = row()[0];
    return { type: 'miss', slot: b.slot, giant: false };
  };

  const afterTime = () => {
    if (g.phase === 'play') {
      if (g.balls.length || ++wait < H.END_WAIT) return [];
      g.phase = 'leave'; g.mons = 1; wait = 0;
      return [{ type: 'leave' }];
    }
    if (g.phase === 'leave') {
      if (++wait < H.LEAVE_FRAMES) return [];
      g.phase = 'giant'; wait = 0;
      const f = flightOf('giant');
      g.balls.push({ slot: 0, x: 0, y: H.GIANT_Y, v: f[0], g: f[1], f, kind: 'giant', state: 'fall', missed: false });
      return [{ type: 'giant' }];
    }
    if (g.balls.some(b => b.kind === 'giant' && b.state === 'fall' && !b.missed) || ++wait < H.GIANT_END_FRAMES) return [];
    g.over = true;
    g.score = Math.min(H.CAP, g.points) + g.maxCombo + g.bonus;
    return [{ type: 'end', score: g.score }];
  };

  g.tick = () => {
    if (g.over) return [];
    const events = [];
    if (g.timer > 0) {
      g.timer--;
      stageF++;
      if (g.stage < 2 && stageF >= row()[5]) {
        g.stage++; g.mons = g.stage + 1; stageF = 0; interval = row()[0]; counter = -1;
        events.push({ type: 'stage', mons: g.mons });
      }
      counter++;
      if ((counter === 0 || counter >= interval) && launch()) counter = 0;
    }
    for (const b of g.balls) {
      const giant = b.kind === 'giant';
      if (b.state === 'fall') {
        b.v += b.g; b.y -= b.v;
        if (!b.missed && headTestY(b.y, giant) >= H.WINDOW.miss[0]) events.push(missBall(b));
        if (b.y < H.OUT_BOTTOM) b.gone = true;
      } else {
        b.y += b.v; b.v = Math.max(H.RISE_FLOOR, b.v - b.decel);
        if (b.dir) b.x += b.dir * H.DRIFT;
        if (b.y > H.OUT_TOP + (giant ? H.GIANT_H : H.BALL_H) / 2) b.gone = true;
      }
    }
    g.balls = g.balls.filter(b => !b.gone);
    g.heads = g.heads.map(h => Math.max(0, h - 1));
    if (g.timer <= 0) events.push(...afterTime());
    return events;
  };

  g.tap = slot => {
    if (g.over || slot >= g.mons || g.heads[slot] > 0) return [];
    g.heads[slot] = H.HEAD_FRAMES;
    const ball = g.balls.filter(b => b.slot === slot && b.state === 'fall' && !b.missed).sort((a, b) => a.y - b.y)[0];
    const how = ball ? headGrade(ball.y, ball.kind === 'giant') : null;
    if (!how) return [];
    const f = ball.f;
    Object.assign(ball, how === 'just' ? { state: 'rise', v: f[4], decel: f[5] } : { state: 'rise', v: f[2], decel: f[3], dir: roll(2) ? 1 : -1 });
    if (ball.kind === 'giant') {
      g.bonus = H.BIG_BONUS[how];
      return [{ type: 'bonus', slot, how, points: g.bonus }];
    }
    let points = H.POINTS[how] * (g.fever ? H.POINTS.fever : 1);
    g.combo = Math.min(H.CAP, g.combo + 1);
    g.maxCombo = Math.max(g.maxCombo, g.combo);
    points += H.MILESTONE.find(m => g.combo % m.every === 0)?.points ?? 0;
    g.points = Math.min(H.CAP, g.points + points);
    const r = row();
    interval = Math.max(r[3], Math.min(r[0], interval + (how === 'just' ? r[2] : r[1])));
    if (!g.fever && g.combo >= r[6]) { g.fever = true; interval = r[4]; }
    return [{ type: 'hit', slot, how, points, combo: g.combo, fever: g.fever }];
  };
  return g;
}

export const TILE_GRIDS = Object.freeze({ easy: { cols: 5, rows: 4 }, normal: { cols: 6, rows: 5 }, hard: { cols: 8, rows: 6 } });

export function tileShuffle(n, random = Math.random) {
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const tiles = Array.from({ length: n }, (_, i) => i);
  for (let i = 0; i + 1 < n; i += 2) [tiles[order[i]], tiles[order[i + 1]]] = [tiles[order[i + 1]], tiles[order[i]]];
  return tiles;
}

export function createTilePuzzle(level, random = Math.random) {
  const { cols, rows } = TILE_GRIDS[level];
  const g = { level, cols, rows, tiles: tileShuffle(cols * rows, random), selected: -1, seconds: 0, over: false };
  g.home = place => g.tiles[place] === place;
  g.tick = dt => { if (!g.over) g.seconds += dt; };
  g.pick = place => {
    if (g.over || place < 0 || place >= g.tiles.length || g.home(place)) return [];
    if (g.selected < 0) { g.selected = place; return [{ type: 'select', place }]; }
    const a = g.selected;
    g.selected = -1;
    if (a === place) return [{ type: 'unselect' }];
    [g.tiles[a], g.tiles[place]] = [g.tiles[place], g.tiles[a]];
    const events = [{ type: 'swap', a, b: place, home: [a, place].filter(g.home) }];
    if (g.tiles.every((tile, i) => tile === i)) {
      g.over = true;
      events.push({ type: 'end', seconds: g.seconds });
    }
    return events;
  };
  return g;
}
