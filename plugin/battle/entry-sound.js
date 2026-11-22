export const GRACE_MS = 350;
const HAVE_CURRENT_DATA = 2;
const RETRIED = new Set(['NotAllowedError', 'AbortError']);

export function createEntrySounds({ makeAudio = () => new Audio(), target = globalThis, clock = () => performance.now(),
  warn = (...args) => console.warn(...args), activated = () => globalThis.navigator?.userActivation?.hasBeenActive ?? null,
  later = (fn, ms) => setTimeout(fn, ms) } = {}) {
  const kept = new Map();
  let armed = false;
  const onPress = () => { for (const entry of kept.values()) entry.gesture(); };
  const arm = () => {
    if (armed || typeof target?.addEventListener !== 'function') return;
    armed = true;
    for (const type of ['pointerdown', 'keydown']) target.addEventListener(type, onPress, true);
  };

  function sound(key, source) {
    const old = kept.get(key);
    if (old && !old.broken) return old.play;
    const audio = makeAudio();
    audio.preload = 'auto';
    audio.crossOrigin = 'anonymous';
    let due = null, primed = false, sounding = false, priming = false;
    const entry = { broken: false };
    const tell = (what, error, wanted = due) => warn(`[poke-battle] 진입 효과음 ${what}: ${key}`, error?.name ?? '', error?.message ?? '',
      { readyState: audio.readyState, networkState: audio.networkState, activated: activated(), late: wanted ? Math.round(clock() - wanted.at) : 0 });
    const inTime = wanted => clock() <= wanted.at + GRACE_MS;

    const tryPlay = () => { try { return Promise.resolve(audio.play()); } catch (error) { return Promise.reject(error); } };
    function start() {
      const wanted = due;
      due = null;
      if (!wanted) return;
      sounding = true;
      audio.muted = false;
      audio.volume = wanted.volume;
      if (audio.currentTime) try { audio.currentTime = 0; } catch { /* not seekable yet - it starts from the start anyway */ }
      tryPlay().then(() => { primed = true; }, error => {
        sounding = false;
        wanted.error = error;

        if (RETRIED.has(error?.name) && inTime(wanted)) { wanted.press = error.name === 'NotAllowedError'; due = wanted; return; }
        tell('재생 실패', error, wanted);
      });
    }
    audio.addEventListener?.('canplay', () => { if (due && !due.press && inTime(due)) start(); }); // canplay comes again after a seek: not for a refused play
    audio.addEventListener?.('ended', () => { sounding = false; });
    audio.addEventListener?.('pause', () => { if (!priming) sounding = false; });
    entry.gesture = () => {
      if (due && inTime(due)) { start(); return; }
      if (primed || priming || sounding || !audio.src) return;

      priming = true;
      audio.muted = true;
      tryPlay().then(() => {
        primed = true;
        if (!sounding) { audio.pause(); try { audio.currentTime = 0; } catch { /* as above */ } }
      }, () => {}).finally(() => { priming = false; if (!sounding) audio.muted = false; });
    };
    entry.play = volume => {
      if (entry.broken) { tell('파일 없음'); return; }
      due = { volume, at: clock() };
      const wanted = due;
      if (audio.readyState >= HAVE_CURRENT_DATA) start();
      later(() => { if (due === wanted) { due = null; tell('늦어서 건너뜀', wanted.error ?? null, wanted); } }, GRACE_MS + 1);
    };
    kept.set(key, entry);
    source(audio, () => { entry.broken = true; tell('파일을 받지 못함'); });
    arm();
    return entry.play;
  }
  return { sound, primeNow: onPress };
}
