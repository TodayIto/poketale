import { keyAction } from './keys.js';

export function openMenu(scene, { input, paused = () => false, close = () => {}, tapWindows = null }) {
  const parent = scene.options.parent, signal = scene.life.signal;
  const key = e => {
    if (paused() || e.repeat || e.target !== parent && e.target !== scene.game.canvas) return;
    const action = keyAction(e);
    if (!action) return;
    e.preventDefault(); e.stopImmediatePropagation(); input(action);
  };
  const open = scene.openMenus ??= [];
  const entry = { tapBack: () => { const windows = tapWindows?.(); return windows ? { windows, back: () => input('back') } : null; } };
  const menu = {};
  menu.promise = new Promise((resolve, reject) => {
    let settled = false;
    const settle = (done, value) => {
      if (settled) return;
      settled = true;
      parent.removeEventListener('keydown', key, true);
      signal.removeEventListener('abort', menu.abort);
      open.splice(open.indexOf(entry), 1);
      close();
      done(value);
    };
    menu.finish = value => settle(resolve, value);
    menu.fail = error => settle(reject, error);
    menu.abort = () => settle(reject, signal.reason);
  });
  open.push(entry);
  parent.addEventListener('keydown', key, true);
  signal.addEventListener('abort', menu.abort, { once: true });
  return menu;
}
