// from pokerogue src/audio/audio-manager.ts @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/audio/background-music.ts @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-10-28. See view/LICENSE-NOTE.md.

import { battleMusic, bgmKey, loopPoint, victoryMusic } from './bgm.js';

import CRIES from '../data/pokerogue-cries.json' with { type: 'json' };

const BGM_VOLUME = 0.2;
const UI_SOUNDS = ['select', 'error'];

const SILENT = Object.freeze({ audio: Object.freeze({ readyState: 0, error: null }), ready: Promise.resolve() });

class Clock {
  constructor() { this.stoppedAt = null; this.lost = 0; this.timers = new Set(); }
  now() { return (this.stoppedAt ?? performance.now()) - this.lost; }

  timeout(ms, callback) {
    const timer = { at: this.now() + ms, callback, id: null };
    this.timers.add(timer);
    if (this.stoppedAt === null) this.arm(timer);
    return () => { clearTimeout(timer.id); this.timers.delete(timer); };
  }
  arm(timer) { timer.id = setTimeout(() => { this.timers.delete(timer); timer.callback(); }, timer.at - this.now()); }
  stop() {
    if (this.stoppedAt !== null) return;
    this.stoppedAt = performance.now();
    for (const timer of this.timers) clearTimeout(timer.id);
  }
  start() {
    if (this.stoppedAt === null) return;
    this.lost += performance.now() - this.stoppedAt; this.stoppedAt = null;
    for (const timer of this.timers) this.arm(timer);
  }
}

class Music {
  constructor(owner, key, loop) {
    this.owner = owner; this.key = key; this.loop = loop; this.loopPoint = loop ? loopPoint(key) : 0;
    this.audio = owner.music(key);
    this.audio.currentTime = 0; this.audio.volume = BGM_VOLUME;
    this.audio.loop = loop && !this.loopPoint;
    this.audio.onended = () => {
      if (this.destroyed) return;
      if (this.loop) { this.audio.currentTime = this.loopPoint < (this.audio.duration || Infinity) ? this.loopPoint : 0; this.play(); }
      else this.triggerEnd();
    };
    this.wanted = false; this.destroyed = false; this.ended = false; this.endCallbacks = []; this.cancelFade = null;
  }

  play() {
    if (this.destroyed) return;
    this.wanted = true;
    if (!this.owner.musicEnabled || this.owner.suspended || !this.audio.paused) return;
    this.audio.play().catch(error => {
      this.owner.note(`${error.name}: bgm/${this.key}`);
      if (error.name !== 'NotAllowedError' && error.name !== 'AbortError') this.destroy();
    });
  }
  resume() { this.play(); }
  pause() { this.wanted = false; this.audio.pause(); }
  onEnd(callback) { if (this.ended) callback(); else this.endCallbacks.push(callback); }
  triggerEnd() {
    if (this.ended) return;
    this.ended = true;
    for (const callback of this.endCallbacks.splice(0)) callback();
  }

  fadeOut(duration, destroy = true) {
    if (this.destroyed || this.cancelFade) return;
    const clock = this.owner.clock, from = this.audio.volume, started = clock.now();
    const step = () => {
      const elapsed = clock.now() - started;
      this.audio.volume = from * (1 - Math.min(1, elapsed / duration));
      if (elapsed < duration + 100) { this.cancelFade = clock.timeout(25, step); return; }
      this.cancelFade = null;
      if (destroy) this.destroy(); else { this.pause(); this.audio.volume = from; }
    };
    this.cancelFade = clock.timeout(25, step);
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true; this.wanted = false;
    this.cancelFade?.(); this.cancelFade = null;
    this.audio.onended = null; this.audio.pause(); this.audio.volume = BGM_VOLUME;
    this.owner.release(this);
    this.triggerEnd();
  }
}

export class BattleAudio {

  constructor(assets, parent, options = {}) {
    this.assets = assets; this.parent = parent; this.sounds = new Map(); this.active = new Set();
    this.diagnostics = [];
    this.silent = options.sound === false;
    this.wild = options.wild ?? true;
    const chosen = battleMusic(options);
    this.battleBgm = chosen.key;
    if (chosen.unknown !== undefined) this.note(`Unknown PokeRogue BGM "${chosen.unknown}" → ${chosen.key}`);
    this.victoryBgm = victoryMusic(options);
    this.musicEnabled = true; this.destroyed = false;
    this.currentBgm = null; this.tracks = new Set();
    this.pendingLoads = new Set(); this.finishes = new Set();

    // If autoplay was blocked, retry on the first touch/key
    this.unlock = () => { if (this.suspended) return; for (const track of this.tracks) if (track.wanted) track.play(); };
    this.suspended = false;
    this.clock = new Clock(); this.wake = null; this.woken = null;
    parent.addEventListener('pointerdown', this.unlock);
    parent.addEventListener('keydown', this.unlock);
  }
  note(text) { if (!this.diagnostics.includes(text)) this.diagnostics.push(text); }
  load(path, loop = false) {
    if (this.destroyed) throw new Error('BattleAudio destroyed');
    if (this.silent) return SILENT;
    if (this.sounds.has(path)) return this.sounds.get(path);
    const audio = new Audio();
    audio.crossOrigin = 'anonymous'; audio.preload = 'auto'; audio.loop = loop;
    audio.volume = loop ? BGM_VOLUME : 0.6;
    audio.src = this.assets.url(`audio/${path}`);
    const ready = new Promise(resolve => {
      const done = () => {
        clearTimeout(timer); audio.onloadeddata = audio.onerror = null;
        this.pendingLoads.delete(done);
        this.assets.life.signal.removeEventListener('abort', done); resolve(audio);
      };
      const timer = setTimeout(() => { this.diagnostics.push(`Audio load timeout: ${path}`); done(); }, 15000);
      audio.onloadeddata = done;
      audio.onerror = () => { this.diagnostics.push(`Audio unavailable: ${path}`); done(); };
      this.assets.life.signal.addEventListener('abort', done, { once: true });
      this.pendingLoads.add(done);
      audio.load();
    });
    this.sounds.set(path, { audio, ready });
    return { audio, ready };
  }

  async preload(mons) {
    if (this.silent) return;

    await Promise.all(['se/pb_rel.wav', 'se/hit.wav', 'se/hit_strong.wav', 'se/hit_weak.wav', 'se/faint.wav', ...UI_SOUNDS.map(name => `ui/${name}.wav`),
      ...mons.map(mon => this.cryPath(mon)).filter(Boolean)].map(path => this.load(path).ready));
  }

  preloadMusic() {
    if (!this.silent) this.load(`bgm/${this.battleBgm}.mp3`, true);
  }

  cryPath(mon) {
    const key = Object.hasOwn(CRIES, mon?.spriteId ?? '') ? CRIES[mon.spriteId] : null;
    return key ? `cry/${key}.m4a` : null;
  }

  music(key) {
    const path = `bgm/${key}.mp3`;
    const cached = this.load(path, true).audio;
    if (![...this.tracks].some(track => track.audio === cached)) return cached;
    const audio = new Audio();
    audio.crossOrigin = 'anonymous'; audio.preload = 'auto'; audio.src = this.assets.url(`audio/${path}`);
    this.extra ??= new Set(); this.extra.add(audio);
    return audio;
  }
  release(track) { this.tracks.delete(track); if (this.currentBgm === track) this.currentBgm = null; }

  playBgm(name, { loop = true } = {}) {
    if (this.destroyed || this.silent || this.assets.life.signal.aborted) return null;
    const key = bgmKey(name);
    if (!key) { this.note(`Unknown PokeRogue BGM "${name}"`); return null; }
    if (this.currentBgm?.key === key) { this.currentBgm.play(); return null; }
    this.currentBgm?.destroy();
    const track = this.currentBgm = new Music(this, key, loop);
    this.tracks.add(track);
    track.play();
    return track;
  }

  replaceBgmUntilEnd(name) {
    if (this.destroyed || this.silent || this.assets.life.signal.aborted) return null;
    const key = bgmKey(name);
    if (!key) { this.note(`Unknown PokeRogue BGM "${name}"`); return null; }

    for (const track of [...this.tracks]) if (track !== this.currentBgm) track.destroy();
    const temp = new Music(this, key, false);
    this.tracks.add(temp);
    temp.onEnd(() => { if (!this.destroyed) this.currentBgm?.resume(); temp.destroy(); });
    this.currentBgm?.pause();
    temp.play();
    return temp;
  }

  fadeOutBgm(duration = 500, destroy = true) {
    this.currentBgm?.fadeOut(duration, destroy);
    if (destroy) this.currentBgm = null;
  }

  startBattleMusic() { return this.playBgm(this.battleBgm); }

  finishBattle({ outcome, caught = false }) {
    if (outcome === 'win') { if (!caught && this.victoryBgm) this.playBgm(this.victoryBgm); }
    else if (outcome === 'lose' || outcome === 'tie') this.fadeOutBgm(5000);
  }

  // Sound off/on (musicEnabled). While off the track state is kept and only the sound stops
  setMusicEnabled(enabled) {
    this.musicEnabled = !!enabled;
    for (const track of this.tracks) {
      if (!this.musicEnabled) track.audio.pause();
      else if (track.wanted) track.play();
    }
  }
  stopMusic() { this.setMusicEnabled(false); }

  suspend() {
    if (this.destroyed || this.suspended) return;
    this.suspended = true;
    this.clock.stop();
    for (const track of this.tracks) track.audio.pause();
    for (const voice of this.active) voice.pause();
  }
  resume() {
    if (this.destroyed || !this.suspended) return;
    this.suspended = false;
    this.clock.start();
    if (this.musicEnabled) for (const track of this.tracks) if (track.wanted) track.play();
    for (const voice of this.active) voice.play()?.catch?.(() => {});
    this.wake?.();
  }

  // If collapsed, waits until reopened (or closed); otherwise resolves at once
  awake() {
    if (!this.suspended) return Promise.resolve();
    return (this.woken ??= new Promise(resolve => { this.wake = () => { this.wake = this.woken = null; resolve(); }; }));
  }

  async play(path, rate = 1, volume = 0.6, { maxMs = Infinity } = {}) {
    if (!path || this.suspended || this.silent) return;
    const { audio, ready } = this.load(path);
    await ready;
    if (this.suspended) await this.awake();
    if (this.destroyed) return;
    this.assets.life.check();
    if (audio.error || audio.readyState < 2) return;

    // Animation sound events can overlap, including repetitions of the same sample.
    const voice = audio.cloneNode();
    voice.volume = Math.max(0, Math.min(1, volume)); voice.playbackRate = rate;
    await new Promise(resolve => {
      let cancel;
      const finish = () => {
        cancel(); voice.pause(); voice.onended = voice.onerror = null;
        voice.removeAttribute('src'); voice.load();
        this.assets.life.signal.removeEventListener('abort', finish);
        this.active.delete(voice); this.finishes.delete(finish); resolve();
      };
      cancel = this.clock.timeout(Math.min(maxMs, (Number.isFinite(audio.duration) ? audio.duration / rate + 1 : 16) * 1000), finish);
      voice.onended = voice.onerror = finish;
      this.active.add(voice);
      this.finishes.add(finish);
      this.assets.life.signal.addEventListener('abort', finish, { once: true });
      voice.play().catch(error => { this.diagnostics.push(`Playback skipped: ${path}: ${error.name}`); finish(); });
    });
  }

  cry(mon, slow = false) { return this.play(this.cryPath(mon), slow ? 0.85 : 1); }

  faintCry(mon) { return this.play(this.cryPath(mon), 0.85, undefined, { maxMs: 3000 }); }

  playUi(name) {
    if (this.destroyed || !UI_SOUNDS.includes(name)) return;
    this.play(`ui/${name}.wav`).catch(() => {});
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.musicEnabled = false;
    this.currentBgm = null;
    for (const track of [...this.tracks]) track.destroy();
    this.parent.removeEventListener('pointerdown', this.unlock);
    this.parent.removeEventListener('keydown', this.unlock);
    for (const done of [...this.pendingLoads]) done();
    this.wake?.();
    for (const finish of [...this.finishes]) finish();
    for (const voice of this.active) voice.pause();
    const media = [...[...this.sounds.values()].map(s => s.audio), ...(this.extra ?? [])];
    for (const audio of media) { audio.pause(); audio.removeAttribute('src'); audio.load(); }
    this.sounds.clear(); this.active.clear(); this.extra?.clear();
  }
}
