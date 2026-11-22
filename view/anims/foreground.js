import { FOREGROUNDS } from './foregrounds.js';

export const FG_ADD = 'AnimTimedAddFgEvent', FG_UPDATE = 'AnimTimedUpdateFgEvent';
const isFg = e => e.eventType === FG_ADD || e.eventType === FG_UPDATE;

function toEvent(entry, seq) {
  const e = { frameIndex: entry.f };
  if ('set' in entry) e.resourceName = entry.set;
  if (entry.x !== undefined) e.bgX = entry.x;
  if (entry.y !== undefined) e.bgY = entry.y;
  if (entry.o !== undefined) e.opacity = entry.o;
  if (!('set' in entry)) e.duration = entry.d;
  if (entry.c) e.color = [...entry.c];
  e.seq = seq;
  e.eventType = 'set' in entry ? FG_ADD : FG_UPDATE;
  return e;
}

export function withForegrounds(file, anim) {
  const table = FOREGROUNDS[file];
  if (!table || !anim) return anim;
  const variants = [anim].flat().map((v, index) => {
    const entries = table[index];
    if (!entries || !v) return v;
    const events = { ...v.frameTimedEvents };
    entries.forEach((entry, seq) => {
      const e = toEvent(entry, seq);
      events[e.frameIndex] = [...(events[e.frameIndex] ?? []), e];
    });
    return { ...v, frameTimedEvents: events };
  });
  return Array.isArray(anim) ? variants : variants[0];
}

const clamp = v => Math.max(0, Math.min(255, v));
const states = new WeakMap();

export function foregroundFrames(events, frames) {
  if (!events) return null;
  const key = events;
  if (states.has(key) && states.get(key).frames === frames) return states.get(key).out;
  const list = Object.values(events).flat().filter(isFg).sort((a, b) => a.seq - b.seq || a.frameIndex - b.frameIndex);
  let out = null;
  if (list.length) {
    out = [];
    let picture = null, ox = 0, oy = 0, opacity = 0, color = [0, 0, 0, 0], planeOpacity = 0, planeColor = [0, 0, 0, 0];
    let old = [0, 0, 0, [0, 0, 0, 0]];
    for (let frame = 0; frame < frames; frame++) {
      for (const e of list) {
        if (e.eventType !== FG_UPDATE || !(e.duration > 0) || e.frameIndex + e.duration < frame || e.frameIndex >= frame) continue;
        const p = (frame - e.frameIndex) / e.duration;
        const hue = (e.color ?? [null, null, null, null]).map((to, i) => clamp(to === null ? old[3][i] : old[3][i] + (to - old[3][i]) * p));
        if (picture === null) {
          if (e.opacity !== undefined) planeOpacity = clamp(old[2] + (e.opacity - old[2]) * p);
          planeColor = hue;
        } else {

          if (e.bgX !== undefined) ox = old[0] - (e.bgX - old[0]) * p;
          if (e.bgY !== undefined) oy = old[1] - (e.bgY - old[1]) * p;
          if (e.opacity !== undefined) opacity = clamp(old[2] + (e.opacity - old[2]) * p);
          color = hue;
        }
      }
      for (const e of list) {
        if (e.frameIndex !== frame) continue;
        if (e.eventType === FG_ADD) {
          const hue = (e.color ?? []).concat([0, 0, 0, 0]).slice(0, 4).map(v => v ?? 0);
          if (e.resourceName) {
            picture = e.resourceName; ox = -(e.bgX ?? 0); oy = -(e.bgY ?? 0); color = hue; opacity = e.opacity ?? 0; planeOpacity = 0;
          } else {
            picture = null; opacity = 0; planeColor = hue; planeOpacity = e.opacity ?? 0;
          }
        } else {
          old = picture === null ? [0, 0, planeOpacity, [...planeColor]] : [ox, oy, opacity, [...color]];
        }
      }
      out.push({ picture, ox, oy, opacity, color: [...color], planeOpacity, planeColor: [...planeColor] });
    }
    if (out.every(s => !s.opacity && !s.planeOpacity)) out = null; // never seen
  }
  states.set(key, { frames, out });
  return out;
}

export const foregroundPictures = events => [...new Set(Object.values(events ?? {}).flat().filter(e => e.eventType === FG_ADD && e.resourceName).map(e => e.resourceName))];

export const FRONT_BACKGROUNDS = ['surf.json', 'muddy-water.json', 'sludge-wave.json', 'splishy-splash.json'];

export function withFrontBackgrounds(file, anim) {
  if (!anim || !FRONT_BACKGROUNDS.includes(file)) return anim;
  const one = v => (v ? { ...v, bgFront: true } : v);
  return Array.isArray(anim) ? anim.map(one) : one(anim);
}
