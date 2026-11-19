import { originalBackground } from './bg-engine.js';

const ADD = 'AnimTimedAddBgEvent', UPDATE = 'AnimTimedUpdateBgEvent';
const FIELDS = ['bgX', 'bgY', 'opacity'];
const isBg = e => e.eventType === ADD || e.eventType === UPDATE;

export function normalizeBackground(events) {
  if (!events) return events;
  const frames = Object.keys(events).map(Number).sort((a, b) => a - b);
  const all = frames.flatMap(f => events[f]).filter(isBg);
  if (!all.length || all.some(e => !FIELDS.every(k => k in e) || (e.eventType === UPDATE && e.resourceName))) return events;

  const list = [], planes = [];
  let alive = false;
  const pending = [];
  for (const f of frames) {
    const here = events[f].filter(isBg).sort((a, b) => (a.eventType === ADD ? 0 : 1) - (b.eventType === ADD ? 0 : 1));
    for (const e of here) {
      if (e.eventType === ADD) {
        alive = true;
        list.push({ f, e: { ...e } });

        for (const [move, end] of pending.splice(0)) if (end > f && !e.resourceName) list.push({ f, e: { ...move, frameIndex: f, duration: end - f } });
      } else if (alive) list.push({ f, e: { ...e } });
      else {
        pending.push([e, f + (e.duration ?? 0)]);
        const plane = { ...e, plane: true };
        if (!plane.bgX) delete plane.bgX;
        if (!plane.bgY) delete plane.bgY;
        planes.push({ f, e: plane });
      }
    }
  }

  for (let start = 0; start < list.length;) {
    let end = start + 1;
    while (end < list.length && list[end].e.eventType !== ADD) end++;
    const set = list[start].e, moves = list.slice(start + 1, end);
    const raise = new Set(moves.filter(m => m.e.opacity > 0).map(m => m.f));
    let run = [];
    const closeRun = () => {
      const fade = [...run].reverse().find(m => !m.e.bgX && !m.e.bgY) ?? run.at(-1);
      for (const m of run) if (m !== fade) m.emptyOpacity = true;
      run = [];
    };
    for (const m of moves) {
      if (m.e.opacity > 0) { closeRun(); continue; }
      if (raise.has(m.f)) { m.emptyOpacity = true; continue; }
      run.push(m);
    }
    closeRun();
    let x = set.bgX - 320, y = set.bgY - 284;
    for (const m of moves) {
      const e = m.e, original = { ...e };
      if (m.emptyOpacity) delete e.opacity;
      const busy = axis => e.opacity !== undefined || !!original[axis];
      if (!original.bgX && (busy('bgY') || x === -320)) delete e.bgX;
      if (!original.bgY && (busy('bgX') || y === -284)) delete e.bgY;
      if (e.bgX !== undefined) x = e.bgX * 0.5 - 320;
      if (e.bgY !== undefined) y = e.bgY * 0.5 - 284;
    }
    start = end;
  }

  const out = {};
  for (const f of frames) {
    const sounds = events[f].filter(e => !isBg(e));
    if (sounds.length) out[f] = sounds;
  }
  for (const { f, e } of [...planes, ...list]) {
    if (e.eventType === UPDATE && FIELDS.every(k => e[k] === undefined)) continue;
    (out[f] ??= []).push(e);
  }
  return out;
}

export function normalizeAnim(anim, file) {
  const one = (v, index) => {
    if (!v?.frameTimedEvents) return v;
    const bgFrames = file && originalBackground(file, index);
    if (!bgFrames) return { ...v, frameTimedEvents: normalizeBackground(v.frameTimedEvents) };
    const events = {};
    for (const [f, list] of Object.entries(v.frameTimedEvents)) {
      const kept = list.filter(e => !isBg(e));
      if (kept.length) events[f] = kept;
    }
    return { ...v, frameTimedEvents: events, bgFrames };
  };
  return Array.isArray(anim) ? anim.map(one) : one(anim, 0);
}

export function stepBackground(events, each) {
  const timeline = [];
  for (const f of Object.keys(events).map(Number).sort((a, b) => a - b)) for (const e of events[f]) if (isBg(e)) timeline.push([f, e]);
  let bg = null, tweens = [], i = 0;
  const STEP = 0.1, limit = timeline.reduce((m, [f, e]) => Math.max(m, f + (e.duration ?? 0)), 0) + 1;
  for (let t = 0; t <= limit + 1e-9; t = Math.round((t + STEP) * 10) / 10) {
    const before = bg && { ...bg };
    let set = false;
    while (i < timeline.length && timeline[i][0] <= t + 1e-9) {
      const [f, e] = timeline[i++];
      if (e.eventType === ADD) {
        bg = { plane: !e.resourceName, x: (e.bgX ?? 0) - 320, y: (e.bgY ?? 0) - 284, alpha: (e.opacity ?? 0) / 255 };
        tweens = []; set = true;
        continue;
      }
      if (!bg && e.plane) bg = { plane: true, x: -320, y: -284, alpha: 0 };
      if (!bg) continue;
      const to = {};
      if (e.bgX !== undefined) to.x = e.bgX * 0.5 - 320;
      if (e.bgY !== undefined) to.y = e.bgY * 0.5 - 284;
      if (e.opacity !== undefined) to.alpha = e.opacity / 255;
      tweens.push({ f, d: e.duration ?? 0, to, from: null });
    }
    if (bg) for (const tw of tweens) {
      if (t < tw.f) continue;
      tw.from ??= Object.fromEntries(Object.keys(tw.to).map(k => [k, bg[k]]));
      const p = tw.d ? Math.min(1, (t - tw.f) / tw.d) : 1;
      if (tw.done) continue;
      for (const k in tw.to) bg[k] = tw.from[k] + (tw.to[k] - tw.from[k]) * p;
      if (p >= 1) tw.done = true;
    }
    each(t, bg, before, set);
  }
}

export function backgroundFrames(events, frames) {
  const out = [];
  if (events) stepBackground(events, (t, bg) => { if (Number.isInteger(t) && t < frames) out[t] = bg && { ...bg }; });
  for (let f = 0; f < frames; f++) out[f] ??= out[f - 1] ?? null;
  return out;
}

export const hasBackground = events => !!events && Object.values(events).some(list => list.some(isBg));

const ends = new WeakMap();

export function backgroundEnd(events) {
  if (!events) return 0;
  let known = ends.get(events);
  if (known !== undefined) return known;
  let last = 0;
  stepBackground(events, (t, bg, before, set) => {
    if (set) last = t;
    if (!bg || !before) return;
    const seen = bg.alpha > 0 || before.alpha > 0;
    if (bg.alpha !== before.alpha || (seen && ['x', 'y'].some(k => bg[k] !== before[k]))) last = t;
  });
  known = Math.round(last * 10) / 10;
  ends.set(events, known);
  return known;
}
