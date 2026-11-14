import { ENJOY_STEP, FULL_MAX, FULL_PER_FOOD } from '../story/amie.mjs';

export const MOODS = Object.freeze(['sick', 'sleepy', 'hungry', 'full', 'happy', 'calm']);

export const HAPPY_FROM = 60;

export function moodOf({ status = '', enjoy = 0, full = 0 } = {}) {
  if (status && status !== 'slp' && status !== 'fnt') return 'sick';
  if (status === 'slp' || enjoy < ENJOY_STEP) return 'sleepy';
  if (full < FULL_PER_FOOD) return 'hungry';
  if (full >= FULL_MAX) return 'full';
  if (enjoy >= HAPPY_FROM) return 'happy';
  return 'calm';
}

export const moodHop = mood => (mood === 'sick' || mood === 'sleepy' ? 0 : mood === 'hungry' ? 0.6 : 1);

const NONE = Object.freeze({ dx: 0, lift: 0, tilt: 0, sx: 0, sy: 0 });

const bump = (f, from, len) => (f < from || f >= from + len ? 0 : Math.sin(((f - from) / len) * Math.PI));

export function moodMotion(mood, t, { still = false } = {}) {
  if (still) return NONE;
  switch (mood) {
    case 'sick': {

      const k = bump((t % 3) / 3, 0, 0.17);
      return { dx: Math.sin(t * 42) * 1.2 * k, lift: 0, tilt: Math.sin(t * 42 + 1) * 0.02 * k, sx: 0, sy: -0.015 * k };
    }
    case 'sleepy': {

      const sway = Math.sin(t * 1.3);
      return { dx: sway * 1.5, lift: 0, tilt: sway * 0.05, sx: 0.02, sy: -0.04 };
    }
    case 'hungry': {

      const k = bump((t % 5) / 5, 0.1, 0.32);
      return { dx: 0, lift: 0, tilt: 0.07 * k, sx: 0.035 * k, sy: -0.08 * k };
    }
    case 'full': {

      const rock = Math.sin(t * 1.8);
      return { dx: 0, lift: 0, tilt: rock * 0.035, sx: 0.015 * Math.abs(rock), sy: -0.01 * Math.abs(rock) };
    }
    case 'happy': {

      const f = (t % 2.6) / 2.6, k = bump(f, 0, 0.08) + 0.7 * bump(f, 0.08, 0.07);
      return { dx: 0, lift: 5 * k, tilt: 0, sx: 0, sy: 0.02 * k };
    }
    default: return NONE;
  }
}
