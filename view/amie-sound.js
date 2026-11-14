export const AMIE_SFX = Object.freeze({

  reward: { path: 'se/sparkle.wav', volume: 0.3, gap: 1500 },
  tap: { path: 'se/pb_bounce_1.wav', volume: 0.3, gap: 250 },
  dislike: { path: 'ui/error.wav', volume: 0.25, gap: 1500 },
  highFive: { path: 'se/hit.wav', volume: 0.3, gap: 800 },

  serve: { path: 'se/sparkle.wav', volume: 0.25, gap: 600 },
  bite: { path: 'se/pb_move.wav', volume: 0.35, gap: 200 },
  eaten: { path: 'se/restore.wav', volume: 0.3, gap: 600, key: true },

  go: { path: 'se/shing.wav', volume: 0.3, gap: 500, key: true },
  pick: { path: 'se/pb_move.wav', volume: 0.3, gap: 120 },
  right: { path: 'se/sparkle.wav', volume: 0.3, gap: 250 },
  wrong: { path: 'ui/error.wav', volume: 0.25, gap: 300 },
  head: { path: 'se/pb_bounce_1.wav', volume: 0.35, gap: 80 },
  headJust: { path: 'se/pb_bounce_1.wav', volume: 0.4, gap: 80, rate: 1.25 },
  drop: { path: 'se/hit_weak.wav', volume: 0.25, gap: 400 },
  giant: { path: 'se/danger.wav', volume: 0.2, gap: 3000 },
  bonus: { path: 'se/achv.wav', volume: 0.3, gap: 500, key: true },
  tilePick: { path: 'ui/select.wav', volume: 0.35, gap: 80 },
  tileSwap: { path: 'se/pb_move.wav', volume: 0.35, gap: 80 },
  tileHome: { path: 'se/pb_lock.wav', volume: 0.35, gap: 150 },
  timeUp: { path: 'ui/menu_open.wav', volume: 0.35, gap: 1000, key: true },
  done: { path: 'se/achv.wav', volume: 0.35, gap: 1000, key: true },
  result: { path: 'se/level_up.wav', volume: 0.3, gap: 1000, key: true },
  record: { path: 'se/level_up_fanfare.wav', volume: 0.35, gap: 1000, key: true },

  punch1: { path: 'se/hit_weak.wav', volume: 0.3, gap: 90 },
  punch2: { path: 'se/hit.wav', volume: 0.3, gap: 90 },
  burst: { path: 'se/pb_rel.wav', volume: 0.3, gap: 300, key: true },
  found: { path: 'se/achv.wav', volume: 0.3, gap: 1000, key: true },
  effect: { path: 'se/upgrade.wav', volume: 0.25, gap: 1000, key: true },
  reset: { path: 'se/stat_down.wav', volume: 0.25, gap: 1000, key: true },
  wind: { path: 'se/sparkle.wav', volume: 0.25, gap: 2000 },
});

export const AMIE_MUSIC = Object.freeze({ room: 'menu', game: 'mystery_encounter_fun_and_games', training: 'menu' });

export const MUSIC_VOLUME = 0.12;

export const BURST = 4;
export const BURST_MS = 600;

const MUSIC_FADE = 400;

export const PET_SOUNDS = Object.freeze(['reward', 'tap', 'dislike', 'highFive', 'serve', 'bite', 'eaten', 'go', 'pick', 'right', 'wrong', 'head', 'headJust', 'drop', 'giant',
  'bonus', 'tilePick', 'tileSwap', 'tileHome', 'timeUp', 'done', 'result', 'record']);
export const TRAINING_SOUNDS = Object.freeze(['punch1', 'punch2', 'burst', 'found', 'effect', 'reset', 'wind']);

export function amieSound(audio, { now = () => performance.now() } = {}) {
  const off = () => !audio || audio.silent || audio.destroyed;
  const last = new Map(), recent = [];
  let playing = null;
  return {
    get off() { return off(); },
    preload(names) {
      if (off()) return;
      for (const path of new Set(names.map(name => AMIE_SFX[name]?.path).filter(Boolean))) {
        try { audio.load(path); } catch {                        }
      }
    },
    play(name) {
      const sfx = AMIE_SFX[name];
      if (!sfx || off() || audio.suspended) return false;
      const t = now();
      if (t - (last.get(name) ?? -Infinity) < sfx.gap) return false;
      while (recent.length && t - recent[0] >= BURST_MS) recent.shift();
      if (recent.length >= BURST && !sfx.key) return false;
      last.set(name, t); recent.push(t);
      Promise.resolve(audio.play(sfx.path, sfx.rate ?? 1, sfx.volume)).catch(() => {});
      return true;
    },
    music(place) {
      const key = AMIE_MUSIC[place];
      if (!key || off()) return;
      if (playing === key && audio.currentBgm?.key === key) return;
      playing = key;
      const track = audio.playBgm(key);
      if (track) track.audio.volume = MUSIC_VOLUME;
    },
    stopMusic() {
      if (off() || !playing) return;
      playing = null;
      audio.fadeOutBgm(MUSIC_FADE);
    },
  };
}
