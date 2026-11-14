export const CHAT_SCREEN = '.default-chat-screen';

export const OUR_FRAME = 'body > iframe[srcdoc*="pkb-stage-frame-7f3a"]';

const MARK = 'x-pkb-stage';

export const LATER_FRAMES = `body > iframe[${MARK}] ~ iframe`;

const NOT_BOXES = ['iframe', 'script', 'style', 'link', 'meta', 'noscript', 'template', '[freezed]',
  'input', 'textarea', 'a',
  '#app', '#preloading', '#code-contextmenu', '.partial-edit-btn-wrapper', '[data-tippy-root]', '.dnd-poly-drag-image', '.sortable-fallback', '.empty-portal',
  '[class*="textcolor"]', '[class*="darkbg"]',
  '.x-risu-pkbp-root', '.x-risu-pkb-toast'];

export const BODY_BOXES = `body > *${NOT_BOXES.map(s => `:not(${s})`).join('')}`;

let doc = null;
let aboveOthers = () => true;
let debugOn = () => false;

export function useMainDocument(root, onTop = () => true, debug = () => false) { doc = root; aboveOthers = onTop; debugOn = debug; }

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

const BOX_Z = 0;
const PLAIN_Z = 2000;
const RAISE_LIMIT = 3;
const FIGHT_MS = 5000;

const LOW_MARK = 'x-pkb-lowered';

export const LOWERED = `body > [${LOW_MARK}]:not([${LOW_MARK}=""])`;
let standing = false;

let lowered = new Map();
let leftAlone = new Set();
let nextId = 1;
let openingFirst = 1;
let givingBack = Promise.resolve();

function inlineStyle(text) {
  const style = {};
  for (const part of text.split(';')) {
    const at = part.indexOf(':');
    if (at <= 0) continue;
    const name = part.slice(0, at).trim().toLowerCase(), value = part.slice(at + 1);
    style[name] = value.replace(/!important/i, '').trim().toLowerCase();
    if (/!important/i.test(value)) style[`${name}!`] = true;
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
  return { ours, over: over.concat(await boxesOver(frame, ours)) };
}

async function boxesOver(frame, ours) {
  const boxes = await doc.querySelectorAll(BODY_BOXES);
  const n = await boxes.length();
  if (n === 0) return [];
  const mine = await frame.getBoundingClientRect();
  const over = [];
  for (let i = 0; i < n; i++) {
    const box = await boxes.at(i);
    const style = inlineStyle(await box.getStyleAttribute());
    if (style.display === 'none' || style.visibility === 'hidden' || zOf(style) < ours) continue;
    const r = await box.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && overlap(r, mine)) over.push({ frame: box, style, box: true });
  }
  return over;
}
const overlap = (a, b) => a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;

async function described({ frame, box }) {
  if (!box) return 'iframe (plugin window)';
  try { return ((await frame.getOuterHTML()).match(/^<[^>]*>/)?.[0] ?? '?').replace(/\sstyle="[^"]*"/, '').slice(0, 160); } catch { return '?'; }
}

async function noteLeft(found) {
  if (!debugOn()) return;
  console.info(`[poke-battle] debug: 그쪽이 계속 다시 올림 — 이번에 열린 동안 손대지 않음 ${await described(found)} — 그쪽 인라인 z-index: ${found.style['z-index'] ?? '(없음)'}`);
}

async function noteLowered(found, again = false) {
  if (!debugOn()) return;
  console.info(`[poke-battle] debug: 우리 창 아래로 ${again ? '다시 ' : ''}낮춤 ${await described(found)} — 원래 인라인 z-index: ${found.style['z-index'] ?? '(없음)'}`);
}

function readMark(text) {
  const m = /^(\d+) (-?\d+) ?(.*)$/.exec(text ?? '');
  return m ? { id: Number(m[1]), to: Number(m[2]), was: m[3] } : null;
}

async function stepOnTop(frame, { ours, over }) {
  if (ours < TOP_Z) await frame.setStyle('z-index', String(TOP_Z));
  for (const found of over) {
    const z = zOf(found.style);
    if (!(z >= TOP_Z || (found.box && Number.isNaN(z)))) continue;

    if (found.style['z-index!']) continue;
    const to = found.box ? BOX_Z : UNDER_Z;
    const theirs = found.style['z-index'] ?? '';
    const id = readMark(await found.frame.getAttribute(LOW_MARK))?.id;
    const known = lowered.get(id);
    if (known?.left) continue;
    if (known) {
      const now = Date.now();
      known.raises = known.raises.filter(at => now - at < FIGHT_MS).concat(now);
      Object.assign(known, { frame: found.frame, last: theirs });
      if (known.raises.length >= RAISE_LIMIT) {
        known.left = true;
        leftAlone.add(id);
        await noteLeft(found);
        continue;
      }
    } else {
      const id = nextId++;
      lowered.set(id, { frame: found.frame, was: theirs, to, raises: [] });
      await found.frame.setAttribute(LOW_MARK, `${id} ${to} ${theirs}`);
    }
    await found.frame.setStyle('z-index', String(to));
    await noteLowered(found, !!known);
  }
}

async function keepLowered() {
  if (nextId === openingFirst) return;
  const marked = await doc.querySelectorAll(LOWERED);
  const here = new Set();
  for (let i = 0, n = await marked.length(); i < n; i++) {
    const el = await marked.at(i);
    const mark = readMark(await el.getAttribute(LOW_MARK));
    if (!mark || mark.id < openingFirst) continue;
    here.add(mark.id);
    const entry = lowered.get(mark.id);
    if (entry) entry.frame = el;
    else lowered.set(mark.id, { frame: el, was: mark.was, to: mark.to, raises: [], left: leftAlone.has(mark.id) });
  }
  for (const id of lowered.keys()) if (!here.has(id)) lowered.delete(id);
}

async function giveBack() {
  const list = [...lowered.values()];
  lowered = new Map();
  leftAlone = new Set();
  openingFirst = nextId;
  for (const { frame, was, to, last, left } of list) {
    try {

      if (!left && zOf(inlineStyle(await frame.getStyleAttribute())) === to) await frame.setStyle('z-index', last ?? was);
      await frame.setAttribute(LOW_MARK, '');
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
      if (tracking === timer && standing) {
        await keepLowered();
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
  givingBack = checking.then(giveBack);
}
