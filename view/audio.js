// from pokerogue src/audio/audio-manager.ts @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-11-22. See view/LICENSE-NOTE.md.
// from pokerogue src/audio/background-music.ts @ 7d7da4a8 (AGPL-3.0-only)

import { battleMusic, bgmKey, loopPoint, victoryMusic } from './bgm.js';
import { audioType } from './image-route.js';

import CRIES from '../data/pokerogue-cries.json' with { type: 'json' };

const BGM_VOLUME = 0.2, SFX_VOLUME = 0.6;
const UI_SOUNDS = ['select', 'error'];

const SILENT = Object.freeze({ audio: Object.freeze({ readyState: 0, error: null }), ready: Promise.resolve() });

export const soundKind = path => (path.startsWith('bgm/') ? 'bgm' : path.startsWith('cry/') ? 'cry' : path.startsWith('ui/') ? 'ui' : 'sfx');
const KINDS = ['bgm', 'sfx', 'cry', 'ui'];
const FULL = Object.freeze({ bgm: 1, sfx: 1, cry: 1, ui: 1 }), MUTE = Object.freeze({ bgm: 0, sfx: 0, cry: 0, ui: 0 });
const unit = value => Math.max(0, Math.min(1, Number(value) || 0));

function volumeSource({ volume, sound } = {}) {
  if (typeof volume?.levels === 'function') return { levels: () => volume.levels() ?? MUTE, listen: fn => volume.listen?.(fn) ?? (() => {}), live: true };
  const fixed = sound === false ? MUTE : { ...FULL, ...(volume ?? {}) };
  return { levels: () => fixed, listen: () => () => {}, live: false };
}

class Clock {
  constructor() { this.stoppedAt = null; this.lost = 0; this.timers = new Set(); }
  now() { return (this.stoppedAt ?? performance.now()) - this.lost; }
  /** callback after ms of effect time. The returned function cancels */
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
  constructor(owner, key, loop, base = BGM_VOLUME) {
    this.owner = owner; this.key = key; this.loop = loop; this.loopPoint = loop ? loopPoint(key) : 0;
    this.base = base; this.fade = 1; this.audio = null;
    this.wanted = false; this.destroyed = false; this.ended = false; this.endCallbacks = []; this.cancelFade = null;
    if (owner.level('bgm') > 0) this.attach();
  }
  /** The track's <audio> (owner.music - fetched from here on) */
  attach() {
    if (this.audio || this.destroyed) return;
    this.audio = this.owner.music(this.key);
    this.audio.currentTime = 0;
    this.audio.loop = this.loop && !this.loopPoint;
    this.audio.onended = () => {
      if (this.destroyed) return;
      if (this.loop) { this.audio.currentTime = this.loopPoint < (this.audio.duration || Infinity) ? this.loopPoint : 0; this.play(); }
      else this.triggerEnd();
    };
    this.applyVolume();
  }
  applyVolume() { if (this.audio) this.audio.volume = unit(this.base * this.fade * this.owner.level('bgm')); }

  play() {
    if (this.destroyed) return;
    this.wanted = true;
    if (!this.owner.musicEnabled || this.owner.suspended || this.owner.level('bgm') === 0) return; // only the wanted state
    this.attach();
    if (!this.audio.paused) return;

    if (!this.audio.src) { this.owner.sourced(this.audio).then(() => { if (this.destroyed || !this.wanted) return; if (this.audio.src) this.play(); else this.destroy(); }); return; }
    this.audio.play().catch(error => {
      this.owner.note(`${error.name}: bgm/${this.key}`);
      if (error.name !== 'NotAllowedError' && error.name !== 'AbortError') this.destroy();
    });
  }
  resume() { this.play(); }
  pause() { this.wanted = false; this.audio?.pause(); }
  onEnd(callback) { if (this.ended) callback(); else this.endCallbacks.push(callback); }
  triggerEnd() {
    if (this.ended) return;
    this.ended = true;
    for (const callback of this.endCallbacks.splice(0)) callback();
  }

  fadeOut(duration, destroy = true) {
    if (this.destroyed || this.cancelFade) return;
    if (!this.audio) { if (destroy) this.destroy(); else this.pause(); return; }
    const clock = this.owner.clock, from = this.fade, started = clock.now();
    const step = () => {
      const elapsed = clock.now() - started;
      this.fade = from * (1 - Math.min(1, elapsed / duration));
      this.applyVolume();
      if (elapsed < duration + 100) { this.cancelFade = clock.timeout(25, step); return; }
      this.cancelFade = null;
      if (destroy) this.destroy(); else { this.pause(); this.fade = from; this.applyVolume(); }
    };
    this.cancelFade = clock.timeout(25, step);
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true; this.wanted = false;
    this.cancelFade?.(); this.cancelFade = null;
    if (this.audio) { this.audio.onended = null; this.audio.pause(); }
    this.owner.release(this);
    this.triggerEnd();
  }
}

export class BattleAudio {

  constructor(assets, parent, options = {}) {
    this.assets = assets; this.parent = parent; this.sounds = new Map(); this.active = new Set();
    this.voices = new WeakMap();
    this.diagnostics = [];
    this.volume = volumeSource(options);
    this.voicePacks = typeof options.voicePacks === 'function' ? options.voicePacks : null; this.pack = null; this.packRead = null; // voice packs (cryVoice)
    this.wild = options.wild ?? true;
    const chosen = battleMusic(options);
    this.battleBgm = chosen.key;
    if (chosen.unknown !== undefined) this.note(`Unknown PokeRogue BGM "${chosen.unknown}" → ${chosen.key}`);
    this.victoryBgm = victoryMusic(options);
    this.musicEnabled = true; this.destroyed = false;
    this.currentBgm = null; this.tracks = new Set(); // live tracks (current track + replaceBgmUntilEnd temporary track)
    this.pendingLoads = new Set(); this.finishes = new Set();
    // If autoplay was blocked, retry on the first touch/key
    this.unlock = () => { if (this.suspended) return; for (const track of this.tracks) if (track.wanted) track.play(); };
    this.suspended = false; // view.suspend (window collapsed)
    this.clock = new Clock(); this.wake = null; this.woken = null;

    this.speed = () => 1;
    parent.addEventListener('pointerdown', this.unlock);
    parent.addEventListener('keydown', this.unlock);
    this.stopVolume = this.volume.listen(() => this.volumeChanged());
  }
  /** A kind's level now (0..1 - soundKind) */
  level(kind) { return unit(this.volume.levels()?.[kind]); }
  /** Every kind at 0 (amie-sound.js off) */
  get silent() { return KINDS.every(kind => this.level(kind) === 0); }

  adopt(voice, base, path, kind = soundKind(path)) {
    this.voices.set(voice, { base, kind });
    voice.volume = unit(base * this.level(kind));
    return voice;
  }

  volumeChanged() {
    if (this.destroyed) return;
    const music = this.level('bgm');
    for (const track of [...this.tracks]) {
      track.applyVolume();
      if (!music) track.audio?.pause();
      else if (track.wanted) track.play();
    }
    for (const voice of this.active) {
      const kept = this.voices.get(voice);
      if (kept) voice.volume = unit(kept.base * this.level(kept.kind));
    }
  }
  note(text) { if (!this.diagnostics.includes(text)) this.diagnostics.push(text); }
  /** Resolves when a loaded <audio> (load) has its address, or no way gave one */
  sourced(audio) {
    const entry = [...this.sounds.values()].find(sound => sound.audio === audio);
    return entry?.sourced ?? Promise.resolve();
  }

  load(path, loop = false, kind = soundKind(path)) {
    if (this.destroyed) throw new Error('BattleAudio destroyed');
    if (this.sounds.has(path)) return this.sounds.get(path);
    if (this.level(kind) === 0) return SILENT; // its kind at 0: not fetched (a later load with the level up fetches it)
    const audio = new Audio();
    audio.crossOrigin = 'anonymous'; audio.preload = 'auto'; audio.loop = loop;
    const voice = kind === 'cry' && this.voicePacks && path.startsWith('cry/'), file = voice ? path.replace(/#\d+$/, '') : path;
    const url = this.assets.url(`audio/${file}`), route = this.assets.route;
    const ways = [...(voice ? ['pack'] : []), ...(route ? route.order(url) : ['direct'])];
    let finished = false, sourcedNow;
    const sourced = new Promise(resolve => { sourcedNow = resolve; }); // an address is set, or none will be
    const ready = new Promise(resolve => {
      const done = () => {
        finished = true;
        clearTimeout(timer); audio.onloadeddata = audio.onerror = null;
        this.pendingLoads.delete(done);
        this.assets.life.signal.removeEventListener('abort', done); resolve(audio);
      };
      const left = [...ways];
      let triedDirect = false;
      const next = () => {
        if (this.destroyed) return; // destroy empties the element (its error lands here)
        const way = left.shift();
        if (!way) {
          if (!finished) { this.diagnostics.push(`Audio unavailable: ${path}`); done(); }
          sourcedNow(); return;
        }
        if (way === 'pack') {
          this.packUrl(path).then(src => {
            if (this.destroyed) return;
            if (!src) { next(); return; }
            audio.src = src; sourcedNow(); audio.load();
          }, error => { this.note(`Voice pack failed: ${path} (${error?.message ?? error})`); next(); });
          return;
        }
        if (way === 'direct') { triedDirect = true; audio.src = url; sourcedNow(); audio.load(); return; }
        route.objectUrl(url, () => audioType(url)).then(src => {
          if (this.destroyed) return;
          if (triedDirect) route.markDown(url); // direct failed, the host gave it
          audio.src = src; sourcedNow(); audio.load(); // also after the 15s limit (ready already resolved): a late track still plays
        }, error => { this.note(`Audio via host failed: ${path} (${error?.message ?? error})`); if (!this.destroyed) next(); });
      };

      const timer = setTimeout(() => { this.diagnostics.push(`Audio load timeout: ${path}`); done(); audio.onerror = next; }, 15000);
      audio.onloadeddata = done;
      audio.onerror = next;
      this.assets.life.signal.addEventListener('abort', done, { once: true });
      this.pendingLoads.add(done);
      next();
    });
    this.sounds.set(path, { audio, ready, sourced });
    return { audio, ready };
  }

  async preload(mons) {

    await Promise.all(['se/pb_rel.wav', 'se/hit.wav', 'se/hit_strong.wav', 'se/hit_weak.wav', 'se/faint.wav', ...UI_SOUNDS.map(name => `ui/${name}.wav`),
      ...mons.map(mon => this.cryPath(mon)).filter(Boolean)].map(path => this.load(path).ready));
  }

  preloadMusic() {
    this.load(`bgm/${this.battleBgm}.mp3`, true); // music at 0: nothing (load)
  }

  cryPath(mon) {
    const key = Object.hasOwn(CRIES, mon?.spriteId ?? '') ? CRIES[mon.spriteId] : null;
    return key ? `cry/${key}.m4a` : null;
  }

  readPack() {
    return (this.packRead ??= Promise.resolve().then(() => this.voicePacks()).then(pack => (this.pack = pack ?? null),
      error => { this.packRead = null; throw error; }));
  }

  async packUrl(path) {
    const pack = await this.readPack();
    const [, key, line] = /^cry\/(.+)\.m4a(?:#(\d+))?$/.exec(path) ?? [];
    return pack && key ? pack.url(key, Number(line ?? 0)) : null;
  }

  cryVoice(mon, moment = null) {
    const path = this.cryPath(mon);
    if (!path || !this.voicePacks || this.destroyed || this.level('cry') === 0) return path;
    this.readPack().catch(error => this.note(`Voice pack failed: ${error?.message ?? error}`));
    let count = 0, fitting = [];
    try {
      const key = path.slice('cry/'.length, -'.m4a'.length);
      count = this.pack?.variants(key) ?? 0;
      if (moment) fitting = this.pack?.lines(key, moment) ?? [];
    } catch (error) { this.note(`Voice pack failed: ${path} (${error?.message ?? error})`); }
    const line = fitting.length ? fitting[Math.floor(Math.random() * fitting.length)] : count > 1 ? Math.floor(Math.random() * count) : 0;
    return line ? `${path}#${line}` : path;
  }

  // -- Background music (audio-manager.ts) --

  music(key) {
    const path = `bgm/${key}.mp3`;
    const cached = this.load(path, true).audio;
    if (![...this.tracks].some(track => track.audio === cached)) return cached;
    const audio = new Audio();
    audio.crossOrigin = 'anonymous'; audio.preload = 'auto'; audio.src = cached.src || this.assets.url(`audio/${path}`); // the same file (a blob: address when it came through the host)
    this.extra ??= new Set(); this.extra.add(audio);
    return audio;
  }
  release(track) { this.tracks.delete(track); if (this.currentBgm === track) this.currentBgm = null; }

  playBgm(name, { loop = true, volume = BGM_VOLUME } = {}) {
    if (this.destroyed || this.assets.life.signal.aborted) return null;
    if (!this.volume.live && this.level('bgm') === 0) return null;
    const key = bgmKey(name);
    if (!key) { this.note(`Unknown PokeRogue BGM "${name}"`); return null; }
    if (this.currentBgm?.key === key) { this.currentBgm.play(); return null; }
    this.currentBgm?.destroy();
    const track = this.currentBgm = new Music(this, key, loop, volume);
    this.tracks.add(track);
    track.play();
    return track;
  }

  replaceBgmUntilEnd(name) {
    if (this.destroyed || this.level('bgm') === 0 || this.assets.life.signal.aborted) return null;
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
  /** fadeOutBgm(duration = 500, destroy = true) */
  fadeOutBgm(duration = 500, destroy = true) {
    this.currentBgm?.fadeOut(duration, destroy);
    if (destroy) this.currentBgm = null;
  }

  startBattleMusic() { return this.playBgm(this.battleBgm); }

  finishBattle({ outcome, caught = false }) {
    if (outcome === 'win') { if (!caught && this.victoryBgm) this.playBgm(this.victoryBgm); }
    else if (outcome === 'lose' || outcome === 'tie') this.fadeOutBgm(5000);
  }

  setMusicEnabled(enabled) {
    this.musicEnabled = !!enabled;
    for (const track of this.tracks) {
      if (!this.musicEnabled) track.audio?.pause();
      else if (track.wanted) track.play();
    }
  }
  stopMusic() { this.setMusicEnabled(false); }

  suspend() {
    if (this.destroyed || this.suspended) return;
    this.suspended = true;
    this.clock.stop();
    for (const track of this.tracks) track.audio?.pause();
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

  awake() {
    if (!this.suspended) return Promise.resolve();
    return (this.woken ??= new Promise(resolve => { this.wake = () => { this.wake = this.woken = null; resolve(); }; }));
  }

  // -- Sound effects --

  async play(path, rate = 1, volume = SFX_VOLUME, { maxMs = Infinity, kind = path && soundKind(path) } = {}) {
    if (!path || this.destroyed || this.suspended || this.level(kind) === 0) return; // no new sounds while collapsed
    const { audio, ready } = this.load(path, false, kind);
    await ready;
    if (this.suspended) await this.awake();
    if (this.destroyed) return;
    this.assets.life.check();
    if (audio.error || audio.readyState < 2) return;
    // Animation sound events can overlap, including repetitions of the same sample.
    const voice = this.adopt(audio.cloneNode(), volume, path, kind);

    voice.preservesPitch = voice.webkitPreservesPitch = voice.mozPreservesPitch = false;
    voice.playbackRate = rate;
    await new Promise(resolve => {
      let cancel, cancelWait = null;
      const finish = () => {
        cancel(); cancelWait?.(); voice.pause(); voice.onended = voice.onerror = null;
        voice.removeAttribute('src'); voice.load();
        this.assets.life.signal.removeEventListener('abort', finish);
        this.active.delete(voice); this.finishes.delete(finish); resolve();
      };
      cancel = this.clock.timeout(Math.min(maxMs, (Number.isFinite(audio.duration) ? audio.duration / rate + 1 : 16) * 1000), finish);

      const speed = this.speed();
      if (speed > 1 && Number.isFinite(audio.duration)) {
        cancelWait = this.clock.timeout(Math.min(maxMs, audio.duration / rate * 1000) / speed, () => { cancelWait = null; resolve(); });
      }
      voice.onended = voice.onerror = finish;
      this.active.add(voice);
      this.finishes.add(finish);
      this.assets.life.signal.addEventListener('abort', finish, { once: true });
      voice.play().catch(error => { this.diagnostics.push(`Playback skipped: ${path}: ${error.name}`); finish(); });
    });
  }

  cry(mon, slow = false, moment = null) { return this.play(this.cryVoice(mon, moment), slow ? 0.85 : 1); }

  faintCry(mon) { return this.play(this.cryVoice(mon, 'faint'), 0.85, undefined, { maxMs: 3000 }); }

  playUi(name) {
    if (this.destroyed || !UI_SOUNDS.includes(name)) return;
    this.play(`ui/${name}.wav`).catch(() => {});
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stopVolume();
    this.musicEnabled = false;
    this.currentBgm = null;
    for (const track of [...this.tracks]) track.destroy(); // temporary tracks' onEnd sees destroyed, so it doesn't restart another track
    this.parent.removeEventListener('pointerdown', this.unlock);
    this.parent.removeEventListener('keydown', this.unlock);
    for (const done of [...this.pendingLoads]) done();
    this.wake?.(); // sounds waiting for reopen see destroyed and end
    for (const finish of [...this.finishes]) finish();
    for (const voice of this.active) voice.pause(); // sounds added directly by exp-bar.js
    const media = [...[...this.sounds.values()].map(s => s.audio), ...(this.extra ?? [])];
    for (const audio of media) { audio.pause(); audio.removeAttribute('src'); audio.load(); }
    this.sounds.clear(); this.active.clear(); this.extra?.clear();
  }
}
