// from pokerogue src/system/game-speed.ts @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/utils/common.ts (FixedInt, fixedInt) @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-10-28. See view/LICENSE-NOTE.md.

// Selectable speeds (the setting and the bar button cycle in this order)
export const GAME_SPEEDS = Object.freeze([1, 1.5, 2, 3]);
export const DEFAULT_SPEED = 1;

export const nextSpeed = speed => GAME_SPEEDS[(GAME_SPEEDS.indexOf(speed) + 1) % GAME_SPEEDS.length];

class FixedInt { constructor(value) { this.value = value; } }
export const fixed = ms => new FixedInt(ms);

const isConfig = value => !!value && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const TIME_PROPERTIES = ['delay', 'completeDelay', 'loopDelay', 'duration', 'repeatDelay', 'hold', 'startDelay'];

export function installGameSpeed(scene, speed = DEFAULT_SPEED) {
  const state = { speed };
  const scaled = value => (value instanceof FixedInt ? value.value : typeof value === 'number' ? Math.ceil(value / state.speed) : value);
  const scale = config => {
    if (!isConfig(config)) return config;
    const copy = { ...config };
    for (const key of TIME_PROPERTIES) if (key in copy) copy[key] = scaled(copy[key]);
    if (Array.isArray(copy.tweens)) copy.tweens = copy.tweens.map(scale);
    return copy;
  };
  const { time, tweens } = scene;
  const addEvent = time.addEvent;
  time.addEvent = function (config) {
    return addEvent.call(this, isConfig(config) && 'delay' in config ? { ...config, delay: scaled(config.delay) } : config);
  };
  for (const [name, list] of [['add', false], ['chain', false], ['addCounter', false], ['create', true], ['addMultiple', true]]) {
    const original = tweens[name];
    tweens[name] = function (config) { return original.call(this, list && Array.isArray(config) ? config.map(scale) : scale(config)); };
  }
  return state;
}
