export const CHAT_SCREEN = '.default-chat-screen';

const OUR_FRAME = 'body > iframe[srcdoc*="pkb-stage-frame-7f3a"]';

let doc = null;

// Main document (set by main.js when getRootDocument returns one). Without it, always the whole window
export function useMainDocument(root) { doc = root; }

async function measure() {
  const chat = await doc.querySelector(CHAT_SCREEN);
  if (!chat) return null;
  const r = await chat.getBoundingClientRect();
  const rect = { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) };
  return rect.width > 0 && rect.height > 0 ? rect : null;
}
const same = (a, b) => a === b || (!!a && !!b && a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height);

async function place(frame, rect) {
  const set = { 'max-width': rect ? `${rect.width}px` : '', 'max-height': rect ? `${rect.height}px` : '',
    'margin-left': rect ? `${rect.left}px` : '', 'margin-top': rect ? `${rect.top}px` : '' };
  for (const [key, value] of Object.entries(set)) await frame.setStyle(key, value);
}

const TRACK_MS = 500;
let tracking = null;
function track(frame, rect) {
  let last = rect, busy = false;
  const timer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      const next = await measure();
      if (tracking === timer && !same(next, last)) { last = next; await place(frame, next); }
    } catch {                               } finally { busy = false; }
  }, TRACK_MS);
  tracking = timer;
}
function stopTracking() { clearInterval(tracking); tracking = null; }

export async function showFrame(show, { full = false } = {}) {
  stopTracking();
  const frame = doc ? await doc.querySelector(OUR_FRAME).catch(() => null) : null;
  if (!frame) return show();
  const rect = full ? null : await measure().catch(() => null);
  await place(frame, rect);
  await show();
  if (!full) track(frame, rect);
}

export function frameHidden() { stopTracking(); }
