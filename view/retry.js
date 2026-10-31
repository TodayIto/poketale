export const RETRY_DELAYS = Object.freeze([500, 1500]);

export class LoadError extends Error { name = 'LoadError'; }

// Our own time limit passed - not retried
export class TimeoutError extends LoadError { name = 'TimeoutError'; }

export function failureKind(error) {
  if (error instanceof TimeoutError) return 'timeout';
  const status = error?.status;
  if (typeof status !== 'number') return 'unknown';
  if (status >= 520 && status <= 527) return 'unreachable';
  if (status >= 400 && status < 500 && status !== 408 && status !== 429) return 'missing';
  return 'transient';
}

export const transientError = error => ['transient', 'unknown'].includes(failureKind(error));

export const missingFile = error => failureKind(error) === 'missing';

export function timeLimit(promise, ms, message, signal) {
  return new Promise((resolve, reject) => {
    const settle = (done, value) => { clearTimeout(timer); signal?.removeEventListener('abort', abort); done(value); };
    const abort = () => settle(reject, signal.reason);
    const timer = setTimeout(() => settle(reject, new TimeoutError(message)), ms);
    signal?.addEventListener('abort', abort, { once: true });
    promise.then(value => settle(resolve, value), error => settle(reject, error));
  });
}

export async function withRetry(work, { signal, retryable = transientError, delays = RETRY_DELAYS, wait = sleep } = {}) {
  for (let attempt = 0; ; attempt++) {
    try { return await work(attempt); }
    catch (error) {
      if (signal?.aborted || attempt >= delays.length || !retryable(error)) throw error;
      await wait(delays[attempt], signal);
    }
  }
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
    signal?.addEventListener('abort', abort, { once: true });
  });
}
