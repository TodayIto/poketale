export class Lifetime {
  constructor() {
    this.controller = new AbortController();
  }
  get signal() { return this.controller.signal; }
  check() { this.signal.throwIfAborted(); }
  run(work) {
    if (this.signal.aborted) return Promise.reject(this.signal.reason);
    return new Promise((resolve, reject) => {
      const abort = () => reject(this.signal.reason);
      this.signal.addEventListener('abort', abort, { once: true });
      Promise.resolve().then(() => { this.check(); return work(); }).then(resolve, reject)
        .finally(() => this.signal.removeEventListener('abort', abort));
    });
  }

  listen(target, type, handler, options) {
    const off = () => { target.removeEventListener(type, handler, options); this.signal.removeEventListener('abort', off); };
    this.check();
    target.addEventListener(type, handler, options);
    this.signal.addEventListener('abort', off, { once: true });
    return off;
  }
  destroy() { this.controller.abort(new DOMException('BattleView destroyed', 'AbortError')); }
}

function settle(scene, start) {
  const signal = scene.life?.signal;
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    let cancel;
    const abort = () => { cancel?.(); reject(signal.reason); };
    signal?.addEventListener('abort', abort, { once: true });
    cancel = start(value => { signal?.removeEventListener('abort', abort); resolve(value); });
  });
}

export function tween(scene, config) {
  return settle(scene, done => {
    const added = scene.tweens.add({ ...config, onComplete: done });
    return () => added.remove();
  });
}

export function delay(scene, ms) {
  return settle(scene, done => {
    const timer = scene.time.delayedCall(ms, done);
    return () => timer.remove();
  });
}

export function destroyGame(game) {
  game.destroy(true);
  if (game.isRunning) game.runDestroy();
  else game.events.once('ready', () => queueMicrotask(() => game.runDestroy()));
}
