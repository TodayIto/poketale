export const CHAT_SCREEN = '.default-chat-screen';

export const OUR_FRAME = 'body > iframe[srcdoc*="pkb-stage-frame-7f3a"]';

const MARK = 'x-pkb-stage';

export const LATER_FRAMES = `body > iframe[${MARK}] ~ iframe`;

let doc = null;
let aboveOthers = () => true;

export function useMainDocument(root, onTop = () => true) { doc = root; aboveOthers = onTop; }

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

export const TOP_Z = 2147483647;
const UNDER_Z = TOP_Z - 1;
const PLAIN_Z = 2000;
const STEP_LIMIT = 2;
const FIGHT_MS = 5000;
let standing = false;
let steps = [];
let yielded = false;
let lowered = [];
let givingBack = Promise.resolve();

function inlineStyle(text) {
  const style = {};
  for (const part of text.split(';')) {
    const at = part.indexOf(':');
    if (at > 0) style[part.slice(0, at).trim().toLowerCase()] = part.slice(at + 1).replace(/!important/i, '').trim().toLowerCase();
  }
  return style;
}
const zOf = style => Number.parseInt(style['z-index'], 10);

async function covering(frame) {
  const ours = zOf(inlineStyle(await frame.getStyleAttribute()));
  const later = await doc.querySelectorAll(LATER_FRAMES);
  const over = [];
  for (let i = 0, n = await later.length(); i < n; i++) {
    const other = await later.at(i);
    const style = inlineStyle(await other.getStyleAttribute());
    if (style.display !== 'none' && style.position === 'fixed' && zOf(style) >= ours) over.push({ frame: other, style });
  }
  return { ours, over };
}

async function stepOnTop(frame, { ours, over }) {
  const now = Date.now();
  if (steps.length >= STEP_LIMIT || (steps.length > 0 && now - steps.at(-1) < FIGHT_MS)) {
    yielded = true;
    console.info('[poke-battle] 다른 플러그인 창이 우리 창을 다시 덮음 — 이번에 열린 동안은 우리 창을 더 올리지 않고, 낮춘 창은 되돌림');
    await giveBack();
    return;
  }
  steps.push(now);
  if (ours < TOP_Z) await frame.setStyle('z-index', String(TOP_Z));
  for (const { frame: other, style } of over) {
    if (zOf(style) < TOP_Z) continue;
    lowered.push({ frame: other, was: style['z-index'] });
    await other.setStyle('z-index', String(UNDER_Z));
  }
}

async function giveBack() {
  const list = lowered.reverse();
  lowered = [];
  for (const { frame, was } of list) {
    try {
      if (zOf(inlineStyle(await frame.getStyleAttribute())) === UNDER_Z) await frame.setStyle('z-index', was);
    } catch {                          }
  }
}

export const TRACK_MS = 500;
let tracking = null;

let checking = Promise.resolve();
function track(frame, rect, full) {
  let last = rect, busy = false;
  const check = async () => {
    try {
      if (!full) {
        const next = await measure();
        if (tracking === timer && !same(next, last)) { last = next; await place(frame, next); }
      }
      if (tracking === timer && standing && !yielded) {
        const found = await covering(frame);
        if (found.over.length > 0 && tracking === timer) await stepOnTop(frame, found);
      }
    } catch {                             } finally { busy = false; }
  };
  const timer = setInterval(() => {
    if (busy) return;
    busy = true;
    checking = check();
  }, TRACK_MS);
  tracking = timer;
}
function stopTracking() { clearInterval(tracking); tracking = null; }

export async function showFrame(show, { full = false } = {}) {
  stopTracking();
  await checking;
  await givingBack;
  const frame = doc ? await doc.querySelector(OUR_FRAME).catch(() => null) : null;
  if (!frame) return show();
  standing = aboveOthers();
  if (!standing) await giveBack();
  const rect = full ? null : await measure().catch(() => null);
  await place(frame, rect);
  await show();
  await frame.setStyle('z-index', String(standing ? TOP_Z : PLAIN_Z));
  if (standing) await frame.setAttribute(MARK, '1');
  track(frame, rect, full);
}

export function frameHidden() {
  stopTracking();
  steps = [];
  yielded = false;
  givingBack = checking.then(giveBack);
}
