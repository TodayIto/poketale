// from pokerogue src/main.ts @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/scene-base.ts @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-10-28. See view/LICENSE-NOTE.md.
import Phaser from 'phaser';
import { BattleScene } from './scene.js';
import { Lifetime, destroyGame } from './lifetime.js';
import { throwBall } from './ball-throw.js';
import { runAway } from './run-away.js';
import { keyAction } from './ui/keys.js';
import { showTrainer, hideInfo, pause } from './flow-extras.js';
import { checkTheme } from './ui/theme.js';
import { prepareOutside, showSummary, startPartyScene, endPartyScene } from './outside.js';
import { refitScale } from './refit.js';
import { GAME_SPEEDS, DEFAULT_SPEED } from './game-speed.js';
import { QUALITIES, DEFAULT_QUALITY, CANVAS_SIZE } from './quality.js';

// Phone pad: arrows, A, B -> the same input as the keyboard (keys from the view/ui/keys.js table)
export const PAD_KEYS = Object.freeze({ up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', a: 'z', b: 'x' });

function checkSpeed(speed) {
  if (!GAME_SPEEDS.includes(speed)) throw new TypeError(`Unknown speed: ${speed} (${GAME_SPEEDS.join(' | ')})`);
  return speed;
}

export async function createBattleView(options) {
  if (!options?.parent || typeof options.fetchBytes !== 'function') throw new Error('parent and fetchBytes are required');
  options = { ...options, theme: checkTheme(options.theme) };

  options.speed = checkSpeed(options.speed ?? DEFAULT_SPEED);
  options.quality ??= DEFAULT_QUALITY;
  if (!QUALITIES.includes(options.quality)) throw new TypeError(`Unknown quality: ${options.quality} (${QUALITIES.join(' | ')})`);
  const [width, height] = CANVAS_SIZE[options.quality];
  const life = new Lifetime();
  let resolveScene, rejectScene;
  const ready = new Promise((resolve, reject) => { resolveScene = resolve; rejectScene = reject; });
  const scene = new BattleScene(options, life, resolveScene, rejectScene);
  const game = new Phaser.Game({
    type: Phaser.WEBGL, parent: options.parent, width, height,
    pixelArt: true, roundPixels: true, backgroundColor: '#203040', banner: false,
    audio: { noAudio: true }, dom: { createContainer: false },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, scene: [scene],
  });

  const resizer = new ResizeObserver(() => refitScale(game.scale));
  resizer.observe(options.parent);
  const oldTabIndex = options.parent.getAttribute('tabindex');
  options.parent.tabIndex = 0;
  const focus = () => options.parent.focus({ preventScroll: true });
  options.parent.addEventListener('pointerdown', focus);

  const doc = options.parent.ownerDocument;
  let destroyed = false;
  const forward = e => {
    if (destroyed || (e.target !== doc.body && e.target !== doc.documentElement) || !keyAction(e)) return;
    focus();
    const copy = new KeyboardEvent('keydown', { key: e.key, code: e.code, repeat: e.repeat, shiftKey: e.shiftKey, bubbles: true, cancelable: true });
    options.parent.dispatchEvent(copy);
    if (copy.defaultPrevented) e.preventDefault();
  };
  doc.addEventListener('keydown', forward);

  let suspended = false;
  const blockKeys = e => { if (suspended) { e.stopImmediatePropagation(); e.preventDefault(); } };
  options.parent.addEventListener('keydown', blockKeys, true);
  const unhook = () => {
    options.parent.removeEventListener('keydown', blockKeys, true);
    options.parent.removeEventListener('pointerdown', focus); doc.removeEventListener('keydown', forward);
    if (oldTabIndex === null) options.parent.removeAttribute('tabindex'); else options.parent.setAttribute('tabindex', oldTabIndex);
  };

  const stop = () => life.destroy();
  if (options.signal?.aborted) stop(); else options.signal?.addEventListener('abort', stop, { once: true });
  try { await life.run(() => ready); }
  catch (error) {
    resizer.disconnect(); scene.cleanup(); destroyGame(game); unhook();
    throw error;
  }
  finally { options.signal?.removeEventListener('abort', stop); }
  focus();
  const view = {};
  for (const [api, method] of Object.entries({ preload: 'prepare', summon: 'summon', recall: 'recall', hpChange: 'hpChange', setStatus: 'setStatus', faint: 'faint', message: 'message', end: 'end', playMove:'playMove', playCommon:'playCommon', statStage:'statStage', chooseAction:'chooseAction', chooseSwitch:'chooseSwitch' })) {
    view[api] = (...args) => life.run(() => {
      if (['summon', 'recall', 'hpChange', 'setStatus', 'faint'].includes(api) && !['player', 'enemy'].includes(args[0])) throw new Error(`Invalid side: ${args[0]}`);
      return scene[method](...args);
    });
  }

  view.warmUp = () => life.run(() => scene.warmUp());

  for (const api of ['showAbility', 'hideAbility', 'setStatStages', 'changeForm', 'substitute', 'playCharge', 'setHidden']) {
    view[api] = (...args) => life.run(() => scene.effects[api](...args));
  }

  view.terastallize = (...args) => life.run(() => scene.tera.terastallize(...args));

  view.throwBall = (...args) => life.run(() => throwBall(scene, ...args));

  view.runAway = () => life.run(() => runAway(scene));

  for (const api of ['gainExp', 'partyExp', 'playFanfare', 'updateLevel', 'showLevelUpStats', 'confirm', 'chooseForgetMove', 'startEvolution', 'evolve', 'endEvolution']) {
    view[api] = (...args) => life.run(() => scene.levels[api](...args));
  }

  view.encounter = (...args) => life.run(() => scene.encounter.encounter(...args));
  view.hideTrainer = () => life.run(() => scene.encounter.hideTrainer());

  view.trainerPicture = who => (destroyed ? null : scene.encounter.picture(who));
  view.playSound = path => { if (!destroyed) scene.audio?.play(path).catch(() => {}); };

  view.showTrainer = () => life.run(() => showTrainer(scene));
  view.hideInfo = side => life.run(() => hideInfo(scene, side));
  view.pause = ms => life.run(() => pause(scene, ms));

  view.setSpeed = speed => { scene.gameSpeed.speed = checkSpeed(speed); };

  view.fadeOutMusic = (duration = 500) => { if (!destroyed) scene.audio?.fadeOutBgm(duration); };

  view.restore = state => life.run(() => scene.restore(state));
  view.waitEnd = () => life.run(() => scene.waitEnd());
  view.showEnd = () => life.run(async () => scene.showEnd());

  view.prepareOutside = options => life.run(() => prepareOutside(scene, options));
  view.showSummary = (slot, options) => life.run(() => showSummary(scene, slot, options));

  view.startPartyScene = options => life.run(() => startPartyScene(scene, options));
  view.endPartyScene = () => life.run(() => endPartyScene(scene));

  view.pressKey = key => {
    const name = PAD_KEYS[key];
    if (!name) throw new TypeError(`Unknown pad key: ${key} (up down left right a b)`);
    if (destroyed || suspended) return false;
    for (const type of ['keydown', 'keyup']) options.parent.dispatchEvent(new KeyboardEvent(type, { key: name, bubbles: true, cancelable: true }));
    return true;
  };

  view.suspend = () => {
    if (destroyed || suspended) return;
    suspended = true;
    game.loop.sleep();
    scene.suspend();
  };
  view.resume = () => {
    if (destroyed || !suspended) return;
    suspended = false;
    game.loop.resetDelta();
    game.loop.wake();
    scene.resume();
  };
  Object.defineProperty(view, 'suspended', { get: () => suspended, enumerable: false });

  view.destroy = () => {
    if (destroyed) return;
    destroyed = true; resizer.disconnect(); life.destroy(); scene.cleanup(); destroyGame(game);
    unhook();
  };
  return view;
}
