export const AMIE_SFX = Object.freeze({
  // petting
  reward: { path: 'se/sparkle.wav', volume: 0.3, gap: 1500 }, // a paid reward (its hearts)
  tap: { path: 'se/pb_bounce_1.wav', volume: 0.3, gap: 250 }, // a tap on its body
  dislike: { path: 'ui/error.wav', volume: 0.25, gap: 1500 }, // a disliked spot touched
  highFive: { path: 'se/hit.wav', volume: 0.3, gap: 800 },

  serve: { path: 'se/sparkle.wav', volume: 0.25, gap: 600 }, // the food reaches its mouth (the flash with stars)
  bite: { path: 'se/pb_move.wav', volume: 0.35, gap: 200 },
  eaten: { path: 'se/restore.wav', volume: 0.3, gap: 600, key: true },

  go: { path: 'se/shing.wav', volume: 0.3, gap: 500, key: true }, // "Go!"
  pick: { path: 'se/pb_move.wav', volume: 0.3, gap: 120 }, // a berry taken from the tree
  right: { path: 'se/sparkle.wav', volume: 0.3, gap: 250 }, // the berry it wanted
  wrong: { path: 'ui/error.wav', volume: 0.25, gap: 300 }, // a wrong berry, or it waited too long
  head: { path: 'se/pb_bounce_1.wav', volume: 0.35, gap: 80 }, // a ball headed
  headJust: { path: 'se/pb_bounce_1.wav', volume: 0.4, gap: 80, rate: 1.25 }, // headed at the best moment (higher)
  drop: { path: 'se/hit_weak.wav', volume: 0.25, gap: 400 }, // a ball missed
  giant: { path: 'se/danger.wav', volume: 0.2, gap: 3000 }, // the giant ball comes
  bonus: { path: 'se/achv.wav', volume: 0.3, gap: 500, key: true }, // the giant ball headed
  tilePick: { path: 'ui/select.wav', volume: 0.35, gap: 80 }, // a tile chosen
  tileSwap: { path: 'se/pb_move.wav', volume: 0.35, gap: 80 },
  tileHome: { path: 'se/pb_lock.wav', volume: 0.35, gap: 150 }, // a tile in its place
  timeUp: { path: 'ui/menu_open.wav', volume: 0.35, gap: 1000, key: true },
  done: { path: 'se/achv.wav', volume: 0.35, gap: 1000, key: true }, // the puzzle finished
  result: { path: 'se/level_up.wav', volume: 0.3, gap: 1000, key: true }, // the result card
  record: { path: 'se/level_up_fanfare.wav', volume: 0.35, gap: 1000, key: true },

  punch1: { path: 'se/hit_weak.wav', volume: 0.3, gap: 90 },
  punch2: { path: 'se/hit.wav', volume: 0.3, gap: 90 }, // a punch with its second wind
  burst: { path: 'se/pb_rel.wav', volume: 0.3, gap: 300, key: true }, // a bag bursts
  found: { path: 'se/achv.wav', volume: 0.3, gap: 1000, key: true }, // a new bag found
  effect: { path: 'se/upgrade.wav', volume: 0.25, gap: 1000, key: true }, // an effect bag's star reaches the meter
  reset: { path: 'se/stat_down.wav', volume: 0.25, gap: 1000, key: true },
  wind: { path: 'se/sparkle.wav', volume: 0.25, gap: 2000 }, // its second wind
});

export const AMIE_MUSIC = Object.freeze({ room: 'menu', game: 'mystery_encounter_fun_and_games', training: 'menu' });
/** Music volume (the battle's is 0.2): a quiet room */
export const MUSIC_VOLUME = 0.12;

export const BURST = 4;
export const BURST_MS = 600;
/** How long the music fades when a screen is left (ms) */
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
        try { audio.load(path, false, 'sfx'); } catch { /* the view is gone */ }
      }
    },
    play(name) {
      const sfx = AMIE_SFX[name];
      if (!sfx || off() || audio.suspended || audio.level?.('sfx') === 0) return false;
      const t = now();
      if (t - (last.get(name) ?? -Infinity) < sfx.gap) return false;
      while (recent.length && t - recent[0] >= BURST_MS) recent.shift();
      if (recent.length >= BURST && !sfx.key) return false;
      last.set(name, t); recent.push(t);
      Promise.resolve(audio.play(sfx.path, sfx.rate ?? 1, sfx.volume, { kind: 'sfx' })).catch(() => {});
      return true;
    },
    music(place) {
      const key = AMIE_MUSIC[place];
      if (!key || off()) return;
      if (playing === key && audio.currentBgm?.key === key) return;
      playing = key;
      audio.playBgm(key, { volume: MUSIC_VOLUME });
    },
    stopMusic() {
      if (off() || !playing) return;
      playing = null;
      audio.fadeOutBgm(MUSIC_FADE);
    },
  };
}
