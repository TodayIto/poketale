import { panelModel, reduce, initialUi, openUi, openWays, DEFAULT_PANEL_OPEN, levelUpPlan, levelUpAction, evolutionMoves, evolveAction, teachAction, rememberAction, petAction, recordAction, trainAction, spinInto, actions, boxName,
  pendingCount, DEFAULT_SCREEN_PLACE, liveScreen, screenTab, slotView, namesFor, restedSlots, fishMessage, boxArrivals, hatchLook } from '../../story/panel.mjs';
import { screenView } from '../../story/panel-screens.mjs';
import { loadExpText } from '../../director/steps-exp.js';
import { rememberableMoves, dynamaxLevelShown } from '../../story/state.mjs';
import { trainBlock } from '../../story/training.mjs';
import { renderPanel, panelShell, PANEL_STATES, OWN_CLASS, sheetCss, sheetArt, REST_GLOW_MS, SIZE, panelShift, panelLift, shiftLimits } from '../../story/panel-html.mjs';
import { unreadableLine } from '../../story/stored.mjs';
import { WHAT, failureText } from '../../story/failure.mjs';
import { CHAT_SCREEN } from '../battle/stage.js';
import { bagMoney, compatTravel, latestStatus } from '../../story/compat.mjs';
import { labAt } from '../../story/fossil.mjs';
import { dexHome, preStoryRegions } from '../../story/dex.mjs';
import { storyMentions } from '../../story/dex-mentions.mjs';
import { sceneNow } from '../../story/scene-now.mjs';
import { belowSheet } from './host-bar.js'; // the host's chat input bar: the sheet stops above it
import { chatRoom } from './chat-room.js'; // the room right of the host's chat text: the folded tabs fit into it

const clone = value => JSON.parse(JSON.stringify(value));

const SWIPE_PX = 40;

const ECHO_MS = 400;

const HIT_BIND_BATCH = 16;

const TYPING = ':is(input, textarea, select, [contenteditable]:not([contenteditable="false"])):focus';

export function keyOf(event) {
  if (!event || event.ctrlKey || event.altKey || event.metaKey || event.repeat) return null;
  const key = event.key;
  return key === 'Escape' || key === 'Esc' ? 'esc' : key === 'b' || key === 'B' ? 'b' : null;
}

export const TAP = Object.freeze({ move: 10, ms: 700 });

export const isTap = (down, up) => !!down && Math.hypot(up.x - down.x, up.y - down.y) <= TAP.move && up.at - down.at <= TAP.ms;

export const TAB_MARGIN = 10;

export const HOVER = Object.freeze({ dwell: 0, slack: 64, grace: 100 }); // opens at once, gathers 0.1 s beyond 64 px

const HOVER_SETTLE = SIZE.bar.move + (SIZE.bar.tabs - 2) * SIZE.bar.step;

export function canHover(win = globalThis) {
  try { return !!win.matchMedia?.('(hover: hover) and (pointer: fine)').matches; } catch { return false; }
}

export const DRAG_START = 6;

const notMouse = event => typeof event?.pointerType === 'string' && event.pointerType !== '' && event.pointerType !== 'mouse';

export async function startPanel({ doc, read, queueAction, screens, changes = () => () => {}, resume = async () => {}, toggleAux = async () => null, debugAdd = async () => {}, debugEdit = async () => {}, debugHeal = async () => {}, debugBadges = async () => {}, debugLock = async () => {}, fish = async () => null, openBattle = async () => {},
  botTravel = async () => {}, quickImport = async () => {}, importLater = async () => {}, pictures = null, place = () => DEFAULT_SCREEN_PLACE, trainer = async () => null, shift = () => 0,
  restSound = () => {}, mouse = canHover, open = () => DEFAULT_PANEL_OPEN, stay = () => false, drag = () => false, moveShift = async () => {},
  tale = () => null, setTale = async () => {}, openSettings = async () => {} }) {
  const body = await doc.querySelector('body');
  if (!body) return null;
  const root = await doc.createElement('div');
  await root.addClass('x-risu-pkbp-root');
  await body.appendChild(root);
  await root.setInnerHTML(panelShell());
  const [outer, tabsBox, sheetBox, artBox, floor] = await Promise.all(['.x-risu-pkbp', '.x-risu-pkbp-tabs', '.x-risu-pkbp-sheet', '.x-risu-pkbp-art', '.x-risu-pkbp-floor']
    .map(selector => root.querySelector(selector)));
  if (!outer || !tabsBox || !sheetBox) { await root.remove(); return null; }

  let mode = open();
  let ui = openUi(initialUi(), mode);

  const ways = () => openWays(mode, mouse());
  let now = null;
  let chatId;
  const chatScreens = new Map();

  const arrivals = new Map();
  let shown = { tabs: null, sheet: null, base: null, slots: null, states: PANEL_STATES.gone, art: '' };
  let lastSig = null, busy = false, stopped = false;
  let away = false;
  let line = Promise.resolve(), queued = false, missed = false;

  let glow = null;

  const tabsOut = () => !!now?.show && !away && (ui.open || !ui.gathered);
  const outsideSteps = () => tabsOut() && (ui.open ? !stay() : !ways().always);
  let down = null;
  const outsideListeners = {
    pointerdown: ({ clientX, clientY }) => { down = Number.isFinite(clientX) && Number.isFinite(clientY) ? { x: clientX, y: clientY, at: Date.now() } : null; },
    click: async ({ clientX, clientY }) => {
      const from = down;
      down = null;
      if (stopped || busy || !outsideSteps() || !Number.isFinite(clientX) || !Number.isFinite(clientY) || !isTap(from, { x: clientX, y: clientY, at: Date.now() })) return;
      if (ownClick(clientX, clientY)) return;
      try {
        const [sheet, tabs] = await Promise.all([sheetBox.getBoundingClientRect(), tabsBox.getBoundingClientRect()]);

        if (ownClick(clientX, clientY)) return;
        const within = (r, m) => r.width > 0 && r.height > 0 && clientX >= r.left - m && clientX <= r.right + m && clientY >= r.top - m && clientY <= r.bottom + m;
        if ((ui.open && within(sheet, 0)) || within(tabs, TAB_MARGIN)) return;
        if (!stopped && !busy && outsideSteps()) await press({ t: 'outside' });
      } catch (error) { console.warn('[poke-battle] 패널', error); }
    },
  };

  function listenWhile(listeners, off = () => {}) {
    let listening = null; // the host's ids of the listeners while they listen: [[type, id]]
    let listenLine = Promise.resolve();
    return on => {
      listenLine = listenLine.then(async () => {
        if (on && !stopped && !listening) {

          const added = await Promise.allSettled(Object.entries(listeners).map(async ([type, fn]) => [type, await doc.addEventListener(type, fn, true)]));
          const failed = added.find(r => r.status === 'rejected');
          if (failed) {
            await Promise.allSettled(added.filter(r => r.status === 'fulfilled').map(({ value: [type, id] }) => doc.removeEventListener(type, id)));
            throw failed.reason;
          }
          listening = added.map(r => r.value);
        } else if ((!on || stopped) && listening) {
          const ids = listening;
          listening = null;
          off();
          await Promise.all(ids.map(([type, id]) => doc.removeEventListener(type, id)));
        }
      }).catch(error => console.warn('[poke-battle] 패널', error));
      return listenLine;
    };
  }
  /** Listens for taps outside (on) or stops (off) */
  const listenOutside = listenWhile(outsideListeners, () => { down = null; });

  const STRIP_FRESH = 500;
  let dwell = null, grace = null; // the timers: the stay on the bar, the time beyond the slack
  let hoverOpen = false, hoverAt = 0; // the hover let the tabs out (and when)
  let strip = null, measuring = false, pointer = null;
  const clearDwell = () => { clearTimeout(dwell); dwell = null; };
  const clearGrace = () => { clearTimeout(grace); grace = null; };

  function endHover() {
    clearDwell(); clearGrace();
    hoverOpen = false; strip = null; pointer = null;
  }
  const barEnter = event => {
    if (stopped || !ways().hover || notMouse(event) || !ui.gathered || ui.open || dwell) return;
    dwell = setTimeout(() => {
      dwell = null;
      if (stopped || !ways().hover || busy || !now?.show || away || !ui.gathered || ui.open) return;
      press({ t: 'bar' }, { hover: true }).catch(error => console.warn('[poke-battle] 패널', error));
    }, HOVER.dwell);
  };
  const barLeave = () => clearDwell();

  async function hoverBar(element, hit) {
    if (hit.t !== 'bar' || !ways().hover) return;
    await element.addEventListener('pointerenter', barEnter);
    await element.addEventListener('pointerleave', barLeave);
  }

  const hoverBeat = (box, hit) => box === tabsBox && hit.t !== 'bar' && hoverOpen && Date.now() - hoverAt < HOVER_SETTLE;

  function judge() {
    if (!hoverOpen || !strip || !pointer) return;
    const { rect } = strip, m = HOVER.slack, { x, y } = pointer;
    if (rect.width > 0 && rect.height > 0 && x >= rect.left - m && x <= rect.right + m && y >= rect.top - m && y <= rect.bottom + m) return clearGrace();
    if (grace) return;
    grace = setTimeout(() => {
      grace = null;
      if (stopped || !ways().hover || busy || !hoverOpen || ui.open || ui.gathered || !tabsOut()) return;
      press({ t: 'outside' }, { hover: true }).catch(error => console.warn('[poke-battle] 패널', error));
    }, HOVER.grace);
  }
  const listenHover = listenWhile({
    pointermove: event => {
      const { clientX: x, clientY: y } = event ?? {};
      if (stopped || !hoverOpen || notMouse(event) || !Number.isFinite(x) || !Number.isFinite(y)) return;
      pointer = { x, y };
      if (strip && Date.now() - strip.at < STRIP_FRESH) return judge();
      if (measuring) return; // judged with the newest place once the measure is in
      measuring = true;
      tabsBox.getBoundingClientRect().then(rect => { strip = { rect, at: Date.now() }; }, error => console.warn('[poke-battle] 패널', error))
        .finally(() => { measuring = false; judge(); });
    },
  });

  let lift = null;
  let dragged = null; // the height while dragging (px) - drawn instead of shift() until it is kept
  let liftWrite = Promise.resolve(), liftPending = null;
  let windowSize = null;
  const clampTo = (value, { min, max }) => panelLift(Math.min(max, Math.max(min, value)));
  const screenRange = () => shiftLimits({ ...windowSize, below: now?.below ?? undefined });

  const shiftNow = () => dragged ?? clampTo(shift(), screenRange());
  function writeLift(value) {
    liftPending = value;
    liftWrite = liftWrite.then(async () => {
      if (liftPending === null) return;
      const v = liftPending;
      liftPending = null;
      await outer.setStyleAttribute(`--pkbp-shift:${v}px;`);
    }).catch(error => console.warn('[poke-battle] 패널 끌기', error));
    return liftWrite;
  }
  const liftListeners = {
    pointerdown: async ({ clientX, clientY, button }) => {
      lift = null;
      if (stopped || busy || !drag() || !now?.show || away || button > 0 || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return;
      const hold = { y: clientY, from: shiftNow(), moved: false, on: false };
      lift = hold;
      try {
        const r = await tabsBox.getBoundingClientRect();
        hold.on = r.width > 0 && r.height > 0 && clientX >= r.left - TAB_MARGIN && clientX <= r.right + TAB_MARGIN && clientY >= r.top - TAB_MARGIN && clientY <= r.bottom + TAB_MARGIN;
      } catch { hold.on = false; }
      if (!hold.on && lift === hold) lift = null;
    },
    pointermove: ({ clientY }) => {
      const hold = lift;
      if (!hold?.on || stopped || !Number.isFinite(clientY)) return;
      const dy = clientY - hold.y;
      if (!hold.moved && Math.abs(dy) < DRAG_START) return;
      hold.moved = true;
      dragged = clampTo(hold.from + dy, screenRange());
      writeLift(dragged);
    },
    pointerup: async () => {
      const hold = lift;
      lift = null;
      if (!hold?.moved || dragged === null) return;
      swipedAt = Date.now(); // the click that ends a drag is not a press on a tab
      const value = dragged;
      try { await liftWrite; await moveShift(value); } catch (error) { console.warn('[poke-battle] 패널 끌기', error); }
      dragged = null;
      await draw().catch(() => {});
      await outer.setStyleAttribute('').catch(() => {});
    },
  };
  liftListeners.pointercancel = liftListeners.pointerup;

  const listenLift = listenWhile(liftListeners, () => {
    lift = null;
    if (dragged === null) return;
    dragged = null;
    liftPending = null;
    outer.setStyleAttribute('').catch(() => {});
  });

  function refresh({ force = false } = {}) {
    if (!force) {
      if (queued) return line;
      queued = true;
    }
    line = line.then(() => {
      if (!force) {
        queued = false;
        if (busy) { missed = true; return undefined; }
      }
      return recompute({ force });
    }).catch(error => console.warn('[poke-battle] 패널', error));
    return line;
  }

  async function recompute({ force }) {
    const cur = await read({ fresh: force });
    const battle = cur?.battle ?? { key: null, phase: null };
    const chatScreen = !!(await doc.querySelector(CHAT_SCREEN));

    const below = cur?.on && chatScreen && floor
      ? await belowSheet(doc, floor).catch(error => { console.warn('[poke-battle] 패널 입력창 재기', error); return null; }) : null;

    const room = cur?.on && chatScreen && floor
      ? await chatRoom(doc, floor).catch(error => { console.warn('[poke-battle] 패널 채팅 오른쪽 재기', error); return null; }) : null;

    const travel = cur?.on && cur.compat ? compatTravel(cur.chat) : null;

    const dex = cur?.on ? { home: dexHome(cur.chat, !!cur.compat), regions: cur.compat ? preStoryRegions(cur.chat) : [],
      mentions: [...storyMentions(cur.chat)].sort((a, b) => a - b) } : null;

    const nextMode = open();
    if (nextMode !== mode) {
      const hovered = ways().hover;
      ui = openUi(ui, nextMode, mode);
      mode = nextMode;
      if (ways().hover !== hovered) shown.tabs = null;
    }

    const height = shift();
    windowSize = cur?.on && chatScreen && floor && (drag() || panelLift(height) !== panelShift(height))
      ? await floor.getBoundingClientRect().then(r => (r.top > 0 ? { width: Math.round(r.width), height: Math.round(r.top) } : null),
        error => { console.warn('[poke-battle] 패널 화면 크기 재기', error); return null; }) : null;

    const taleNow = cur?.on ? tale(cur.chat, cur.lang) : null;
    const sig = JSON.stringify([cur?.key ?? null, cur?.lang ?? null, !!cur?.on, battle.phase, chatScreen, !!cur?.compat, !!cur?.debug, cur?.aux?.on ?? null, cur?.offer ?? null, travel, dex,
      pictures?.route() ?? null, place(), height, below, room, mode, !!stay(), !!drag(), taleNow, windowSize]);
    if (!force && sig === lastSig) return;
    if ((cur?.id ?? null) !== chatId) {
      const id = cur?.id ?? null;
      if (chatId !== undefined) {
        if (ui.screen) chatScreens.set(chatId, ui.screen); else chatScreens.delete(chatId);
        const back = chatScreens.get(id) ?? null;
        chatScreens.delete(id);
        ui = { ...initialUi(), open: ui.open, pairHidden: ui.pairHidden, gathered: ui.gathered, seen: ui.seen, ...(back ? { screen: back, tab: screenTab(back) } : {}) };
      }
      chatId = id;
    }

    now = cur?.on && chatScreen
      ? { target: cur.target, chat: cur.chat, lang: cur.lang, state: cur.state, locked: !!battle.key, show: true, ctx: cur.ctx, unreadable: !!cur.unreadable, debug: !!cur.debug, offer: cur.offer ?? null } : null;

    if (now) now.resume = battle.phase === 'folded' || battle.phase === 'parked';
    if (now) now.live = battle.phase === 'live';
    if (now) now.aux = cur.aux ?? null;
    if (now) { now.below = below; now.room = room; }

    if (now) {
      const was = arrivals.get(chatId) ?? {};
      const found = boxArrivals(now.state, { before: cur.before ?? null, known: was.known ?? null, arrived: was.arrived ?? [] });
      arrivals.set(chatId, { known: found.known, arrived: found.arrived });
      ui = { ...ui, fresh: found.fresh };
    }
    if (now) {
      now.travel = travel;
      now.money = bagMoney(cur.chat, cur.compat, cur.state);
      now.compat = !!cur.compat;
      now.dex = dex;
      now.labHere = labAt(latestStatus(cur.chat));
      now.tale = taleNow;
    }
    await draw();
    lastSig = sig; // only after drawing everything - if it fails midway, the next notice redraws
  }

  /** Syncs the outer element's classes (open, locked, hidden) */
  async function setStates(states) {
    const key = states.join(' ');
    if (key === shown.states) return;
    for (const name of Object.values(PANEL_STATES)) {
      if (states.includes(name)) await outer.addClass(name); else await outer.removeClass(name);
    }
    shown.states = key;
  }

  async function fill(box, html, hits) {
    await box.setInnerHTML(html);
    const list = await box.querySelectorAll('.x-risu-pkbp-hit');
    const n = await list.length();
    const blanks = []; // the empty board listens last (below)
    for (let start = 0; start < n; start += HIT_BIND_BATCH) {

      const bound = await Promise.allSettled(Array.from({ length: Math.min(HIT_BIND_BATCH, n - start) }, async (_, offset) => {
        const element = await list.at(start + offset);
        const index = Number((await element.getClassName()).match(/x-risu-pkbp-h(\d+)/)?.[1]);
        const hit = hits[index];
        if (!hit) return null;
        const listener = event => {
          if (swipedJust()) return;
          if (hoverBeat(box, hit)) return;
          if (hit.t === 'blank' ? echo(event) : (took(event), false)) return;
          press(hit).catch(error => console.warn('[poke-battle] 패널', error));
        };
        if (hit.t === 'blank') return [element, listener];
        await element.addEventListener('click', listener);
        await hoverBar(element, hit);
        return null;
      }));
      for (const one of bound) {
        if (one.status === 'rejected') throw one.reason;
        if (one.value) blanks.push(one.value);
      }
    }

    const own = await box.querySelectorAll(`.${OWN_CLASS}`);
    const owned = await own.length();
    for (let i = 0; i < owned; i++) {
      const element = await own.at(i);
      if ((await element.getClassName()).split(' ').includes(OWN_CLASS)) await element.addEventListener('click', took);
    }

    const swipes = await box.querySelectorAll('.x-risu-pkbp-swipe');
    const count = await swipes.length();
    for (let i = 0; i < count; i++) {
      const element = await swipes.at(i);
      const name = await element.getClassName();
      const prev = hits[Number(name.match(/x-risu-pkbp-sp(\d+)/)?.[1])], next = hits[Number(name.match(/x-risu-pkbp-sn(\d+)/)?.[1])];
      if (!prev || !next) continue;
      await element.addEventListener('pointerdown', ({ clientX, clientY }) => { swipeFrom = { x: clientX, y: clientY }; });
      await element.addEventListener('pointerup', ({ clientX, clientY }) => {
        const from = swipeFrom;
        swipeFrom = null;
        const dx = clientX - from?.x, dy = clientY - from?.y;
        if (!from || !(Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.5)) return;
        swipedAt = Date.now(); // the click that follows the swipe's pointerup is not a press
        press(dx < 0 ? next : prev).catch(error => console.warn('[poke-battle] 패널', error));
      });
    }

    const passes = hits.some(hit => hit?.t === 'seen') ? await box.querySelectorAll('.x-risu-pkbp-hover') : null;
    const passed = passes ? await passes.length() : 0;
    for (let i = 0; i < passed; i++) {
      const element = await passes.at(i);
      const hit = hits[Number((await element.getClassName()).match(/x-risu-pkbp-hv(\d+)/)?.[1])];
      if (hit) await element.addEventListener('pointerenter', () => { press(hit, { hover: true }).catch(error => console.warn('[poke-battle] 패널', error)); });
    }

    for (const [element, listener] of blanks) await element.addEventListener('click', listener);
  }

  async function fillSlots(view) {
    for (const [name, html] of Object.entries(view.slots)) {
      if (shown.slots?.[name] === html) continue;
      const list = await sheetBox.querySelectorAll(`.${name}`);
      if (!(await list.length())) return false;
      await fill(await list.at(0), html, view.hits);
    }
    return true;
  }

  let swipeFrom = null, swipedAt = 0;
  const swipedJust = () => Date.now() - swipedAt < 400 || !!lift?.moved; // a drag of the panel too (liftListeners), while it lasts

  let taken = null, tookLast = null;
  const took = event => { taken = tookLast = { x: event?.clientX, y: event?.clientY, at: Date.now() }; };
  const echo = event => {
    const last = taken;
    taken = null;
    return !!last && Date.now() - last.at < ECHO_MS && last.x === event?.clientX && last.y === event?.clientY;
  };

  const ownClick = (x, y) => !!tookLast && Date.now() - tookLast.at < ECHO_MS && tookLast.x === x && tookLast.y === y;

  let drawing = Promise.resolve();
  function draw() {
    const next = drawing.then(drawNow);
    drawing = next.catch(() => {});
    return next;
  }

  let picturesDue = false;
  function picturesArrived() {
    if (picturesDue) return;
    picturesDue = true;
    const next = drawing.then(() => { picturesDue = false; return drawNow(); });
    drawing = next.catch(error => console.warn('[poke-battle] 패널', error));
  }
  async function drawNow() {
    if (stopped) return;
    if (!now?.show) {

      if (shown.tabs) { await tabsBox.setInnerHTML(''); shown.tabs = ''; }
      listenOutside(false); endHover(); listenHover(false); listenLift(false);
      return setStates([PANEL_STATES.gone]);
    }
    if (away) { listenOutside(false); endHover(); listenHover(false); listenLift(false); return setStates([PANEL_STATES.gone]); }
    const screen = await screenNow();

    const shownUi = now.unreadable && !ui.message ? { ...ui, message: { text: unreadableLine(now.lang), error: true } } : ui;
    const view = renderPanel(panelModel({ state: now.state, ctx: now.ctx, lang: now.lang, locked: now.locked, resume: now.resume, debug: now.debug, offer: now.offer, travel: now.travel,
      compat: now.compat, dexHome: now.dex?.home ?? null, dexRegions: now.dex?.regions ?? [], dexMentions: now.dex?.mentions ?? [], ui: shownUi, screen, money: now.money, labHere: now.labHere ?? false }), { aux: now.aux, picture: pictures?.src, shift: shiftNow(), below: now.below, room: now.room,
      rested: glow && Date.now() < glow.until ? glow.uids : null, drag: !!drag(), tale: now.tale ?? null });
    const states = [view.open && PANEL_STATES.open, view.locked && PANEL_STATES.locked, view.gathered && PANEL_STATES.gathered].filter(Boolean);

    if (view.open && view.sheet !== shown.sheet) {
      if (!(view.base !== null && view.base === shown.base && await fillSlots(view))) await fill(sheetBox, view.sheet, view.hits);
      shown.sheet = view.sheet; shown.base = view.base; shown.slots = view.slots;
    }

    if (view.open && pictures && artBox) {
      const art = sheetCss(url => pictures.src({ url }), { dexIcons: view.dexIcons });
      if (art !== shown.art) { await artBox.setInnerHTML(sheetArt(art)); shown.art = art; }
    }

    if (view.tabs !== shown.tabs) { await fill(tabsBox, view.tabs, view.hits); shown.tabs = view.tabs; }
    await setStates(states);
    listenOutside(outsideSteps());
    if (!ui.gathered) clearDwell();
    if (hoverOpen && (!ways().hover || !(tabsOut() && !ui.open && !ui.gathered))) endHover();

    else if (!hoverOpen && !stopped && ways().hover && tabsOut() && !ui.open && !ui.gathered) hoverOpen = true;
    listenHover(hoverOpen);
    listenLift(!!drag());
  }

  async function screenNow() {
    const live = liveScreen(ui.screen, now);
    if (live !== ui.screen) ui = { ...ui, screen: live };
    if (!live || !ui.open) return null;
    try {
      await loadExpText(now.lang);
      const values = screenView(live, { state: now.state, ctx: now.ctx, lang: now.lang, locked: !!now.locked, trainer: live.kind === 'summary' ? await trainer() : null });
      if (values) return values;
    } catch (error) {
      console.warn('[poke-battle] 패널 화면', error);
      say(failureText(WHAT.screen, error, now.lang), true);
    }
    ui = { ...ui, screen: null };
    return null;
  }

  const envNow = () => ({ state: now.state, ctx: now.ctx, lang: now.lang, locked: now.locked, debug: now.debug, place: place(), open: mode, stay: !!stay(), labHere: now.labHere ?? false });

  async function press(hit, { hover: byHover = false } = {}) {
    if (busy || !now) return;
    if (!byHover) endHover();
    else if (hit.t === 'bar') { hoverOpen = true; hoverAt = Date.now(); }
    if (hit.t === 'aux') {
      busy = true; // one flip per tap
      try { await toggleAux(); } finally { busy = false; }
      missed = false; // the forced re-read below covers notices that arrived meanwhile
      return void await refresh({ force: true });
    }
    const { ui: next, effect } = reduce(ui, hit, envNow());
    const opening = !ui.open && next.open, folding = ui.open && !next.open;
    ui = next;
    if (!effect) {
      await draw();
      if (opening) await refresh({ force: true });
      else if (folding) await refresh();
      return;
    }
    busy = true; // one action at a time - taken before the first await (fast double tap)
    try {
      await draw();
      await run(effect, now.target, now.lang);
    } finally {
      busy = false;
      await draw().catch(() => {});
      if (missed) { missed = false; refresh(); } // notice that arrived while a screen was open
    }
  }

  const say = (text, error = false) => { ui = { ...ui, message: text ? { text, error } : null }; };
  const findMon = uid => now?.state.party.find(m => m.uid === uid) ?? now?.state.box.find(m => m.uid === uid) ?? null;

  if (globalThis.pokeBattleDebug) {
    globalThis.pokeBattleDebug.panelEffect = async effect => {
      if (busy || !now) return;
      busy = true;
      try { await run(effect, now.target, now.lang); } finally { busy = false; await draw().catch(() => {}); }
    };
  }

  async function queue(action, after, target, lang, screen, done = () => {}) {
    try {
      const queued = await queueAction(action, target);
      if (screen !== undefined) ui = { ...ui, screen };
      done(queued);
      say(after ?? null);
      return true;
    } catch (error) {
      if (!error?.why) console.warn('[poke-battle] 패널 행동', error);
      say(failureText(WHAT.action, error, lang), true);
      return false;
    } finally {
      await refresh({ force: true });
    }
  }

  function rested(before, after) {
    const uids = restedSlots(before, after);
    if (!uids.length) return;
    glow = { uids, until: Date.now() + REST_GLOW_MS };
    restSound();
  }

  async function run(effect, target, lang) {
    try {
      switch (effect.kind) {
        case 'resume': return await resume();
        case 'queue': {
          const before = now.state;
          const ok = await queue(effect.action, effect.after, target, lang, effect.screen, effect.action.type === 'rest' ? queued => rested(before, queued?.state) : undefined);

          const mon = ok && effect.followLevelUp ? findMon(effect.followLevelUp) : null;
          if (mon && pendingCount(mon) && !now?.locked) await levelUp(mon.uid, target, lang);
          return;
        }
        case 'summary': {
          const mon = findMon(effect.uid);
          if (!mon) return;

          const onRename = async name => {
            try { await queueAction(actions.nickname(mon, name), target); return true; } catch (error) { console.warn('[poke-battle] 별명', error); return false; }
          };

          const onEvolveLock = now?.locked ? null : async locked => {
            try { await queueAction(actions.evolveLock(mon, locked), target); return true; } catch (error) { console.warn('[poke-battle] 진화 잠금', error); return false; }
          };

          const dynamaxShown = !!now?.state && dynamaxLevelShown(now.state, now.ctx?.status?.region ?? null);

          await screens.session(open => open.summary(mon, onRename, now?.state.customItems, onEvolveLock, dynamaxShown, now?.ctx?.formGen ?? null));
          return void await refresh({ force: true });
        }
        case 'levelup': return void await (place() === 'window' ? levelUpWindow(effect.uid, target, lang) : levelUpStep(effect.uid, target, lang));
        case 'rename': {

          const mon = findMon(effect.uid);
          if (!mon) return;
          const slot = slotView(mon, now.ctx, now.state, lang);
          const name = await screens.renameMon({ name: slot.name, nickname: mon.set.name ?? '', species: namesFor(lang, now.ctx.sim).species(slot.speciesId), level: slot.level,
            picture: pictures ? pictures.src(slot) : null });
          if (name === null) return void await refresh({ force: true });
          await queue(actions.nickname(mon, name), undefined, target, lang);
          return;
        }
        case 'evolve': {

          const ctx = now.ctx;
          const steps = effect.evolutions.map(step => ({ step, mon: findMon(step.uid) })).filter(({ mon }) => mon);
          if (!steps.length) return;
          const done = [];
          try {
            await screens.session(async open => {
              for (const { step, mon } of steps) done.push({ step, mon, result: await open.evolution(mon, step.into, species => evolutionMoves(ctx, mon, species)) });
            });
          } finally {
            const action = evolveAction(effect, done);
            if (action) await queue(action, undefined, target, lang);
            else await refresh({ force: true });
          }
          return;
        }
        case 'teachTm': {
          // TM: out-of-battle learn-move screen (over the party screen). If not learned, the TM stays
          const mon = findMon(effect.uid);
          if (!mon) return;
          const party = now.state.party;
          const result = await screens.session(open => open.learnMove(mon, effect.move, party));
          const action = teachAction(mon, effect.item, effect.move, result, effect.disc);
          if (action) await queue(action, undefined, target, lang);
          else await refresh({ force: true });
          return;
        }
        case 'remember': {

          const mon = findMon(effect.uid);
          if (!mon) return;
          const party = now.state.party, moves = rememberableMoves(now.ctx, mon, now.state);
          const result = await screens.session(async open => {
            const move = await open.rememberMove(mon, moves, party);
            return move ? { move, ...await open.learnMove(mon, move, party) } : null;
          });
          const action = rememberAction(mon, result);
          if (action) await queue(action, undefined, target, lang);
          else await refresh({ force: true });
          return;
        }
        case 'pet': {

          let mon = findMon(effect.uid);
          if (!mon) return;
          const scene = sceneNow(now.chat);
          const settle = async action => (action ? queue(action, undefined, target, lang) : (await refresh({ force: true }), true));
          away = true;
          await draw();
          await screens.session(async open => {
            for (let awake = false; mon && !open.closed; awake = true) {
              const ctx = now.ctx;
              const lock = now.debug ? locked => debugLock(effect.uid, locked, target) : null; // debug mode: the friendship lock after the screen's numbers
              const pet = await open.amie(mon, { debug: now.debug, state: now.state, party: now.state.party, awake, trainWhy: trainBlock(mon, ctx), lock, scene });
              const into = pet.spin ? spinInto(ctx, mon, pet.spin) : null;
              const result = into ? { ...pet, evolution: { into, ...await open.evolution(mon, into, species => evolutionMoves(ctx, mon, species)) } } : pet;

              const record = recordAction(result);
              if (record) await queue(record, undefined, target, lang);
              const settled = await settle(petAction(mon, result));
              if (!settled || into || !pet.train || open.closed) return;
              mon = findMon(effect.uid);
              if (!mon) return;
              if (!await settle(trainAction(mon, await open.training(mon, scene)))) return;
              mon = findMon(effect.uid);
            }
          }).finally(() => { away = false; }); // the panel comes back with the redraw after this work (press)
          return;
        }
        case 'train': {

          const mon = findMon(effect.uid);
          if (!mon) return;
          const scene = sceneNow(now.chat);
          away = true;
          await draw();
          const result = await screens.session(open => open.training(mon, scene)).finally(() => { away = false; });
          const action = trainAction(mon, result);
          if (action) await queue(action, undefined, target, lang);
          else await refresh({ force: true });
          return;
        }
        case 'debugAdd': {
          await debugAdd(effect.where, target);
          return void await refresh({ force: true });
        }
        case 'debugEdit': {
          await debugEdit(effect.uid, target);
          return void await refresh({ force: true });
        }
        case 'debugHeal': {
          try {
            await debugHeal(target);
            say(effect.after);
          } catch (error) { say(failureText(WHAT.debugHeal, error, lang), true); }
          return void await refresh({ force: true });
        }
        case 'debugBadges': {
          try {
            await debugBadges(effect.badges, target);
            say(effect.after);
          } catch (error) { say(failureText(WHAT.debugBadges, error, lang), true); }
          return void await refresh({ force: true });
        }
        case 'tale': {

          try { await setTale(effect.key, effect.value, target); } catch (error) {
            console.warn('[poke-battle] 패널 설정', error);
            say(failureText(effect.key === 'battles' ? WHAT.botSetting : WHAT.settings, error, lang), true);
          }
          return void await refresh({ force: true });
        }
        case 'settings': {

          try { await openSettings(); } catch (error) { console.warn('[poke-battle] 설정 창', error); }
          return;
        }
        case 'fish': {

          try {
            const result = await fish(effect.rod, target);
            if (result) ui = { ...ui, message: fishMessage(result, lang, namesFor(lang, now.ctx.sim)) };
          } catch (error) {
            if (!error?.why) console.warn('[poke-battle] 낚시', error);
            say(failureText(WHAT.fish, error, lang), true);
          }
          return void await refresh({ force: true });
        }
        case 'fishBattle': return await openBattle(effect.key, target);
        case 'botTravel': {
          try { await botTravel(effect.change, target); } catch (error) { say(failureText(effect.change.clear ? WHAT.botGuide : WHAT.botSetting, error, lang), true); }
          return void await refresh({ force: true });
        }
        case 'quickImport': {
          await quickImport(target, { asked: effect.asked });
          return void await refresh({ force: true });
        }
        case 'importLater': {
          await importLater(target);
          return void await refresh({ force: true });
        }
        case 'renameBox': {
          const name = await screens.renameBox(boxName(now.state, effect.box, lang));
          if (name === null) return void await refresh({ force: true });
          await queue(actions.boxName(effect.box, name), undefined, target, lang);
          return;
        }
        default: return;
      }
    } catch (error) {
      console.warn('[poke-battle] 패널', error);
      say(failureText(WHAT.screen, error, lang), true);
      await refresh({ force: true }).catch(() => {});
    }
  }

  async function advance(hit, target, lang) {
    const { ui: next, effect } = reduce(ui, hit, envNow());
    ui = next;
    await draw();
    if (effect) await run(effect, target, lang);
  }

  async function levelUp(uid, target, lang) {
    if (place() === 'window') return levelUpWindow(uid, target, lang);
    return advance({ t: 'lvnext', uid }, target, lang);
  }

  async function levelUpStep(uid, target, lang) {
    const mon = findMon(uid);
    if (!mon || now.locked || !pendingCount(mon)) return;
    const plan = levelUpPlan(mon);
    if (plan.hatch) {
      const shown = await screens.session(async open => !!(await open.hatch(hatchLook(mon))).shown);
      if (!shown) return void await refresh({ force: true });
      if (await queue(levelUpAction(mon, { hatched: true }), undefined, target, lang)) await advance({ t: 'lvnext', uid }, target, lang);
      return;
    }
    if (!plan.evolve) return;
    const ctx = now.ctx;
    let evolution = null;
    try {
      await screens.session(async open => {
        evolution = { into: plan.evolve, ...await open.evolution(mon, plan.evolve, species => evolutionMoves(ctx, mon, species)) };
      });
    } finally {
      const action = evolution && levelUpAction(mon, { evolution });
      if (action) await queue(action, undefined, target, lang);
      else await refresh({ force: true });
    }
  }

  async function levelUpWindow(uid, target, lang) {
    const start = findMon(uid);
    if (!start || now.locked || !pendingCount(start)) return;
    const plan = levelUpPlan(start);
    const party = now.state.party;
    const ctx = now.ctx;
    const done = { hatched: false, moves: [], evolution: null };
    let mon = clone(start);
    try {
      await screens.session(async open => {
        if (plan.hatch) {
          done.hatched = !!(await open.hatch(hatchLook(mon))).shown;
          if (!done.hatched) return;
        }
        for (const move of plan.moves) {
          const result = await open.learnMove(mon, move, party.map(m => (m.uid === mon.uid ? mon : m)));
          done.moves.push({ move, result });
          if (result.learned) {
            mon = clone(mon);
            if (result.forgot) mon.set.moves[mon.set.moves.indexOf(result.forgot)] = move; else mon.set.moves.push(move);
          }
        }
        if (plan.evolve) {
          const result = await open.evolution(mon, plan.evolve, species => evolutionMoves(ctx, mon, species));
          done.evolution = { into: plan.evolve, ...result };
        }
      });
    } finally {
      const action = levelUpAction(start, done);
      if (action) await queue(action, undefined, target, lang);
      else await refresh({ force: true });
    }
  }

  await refresh({ force: true });

  const keys = await doc.addEventListener('keydown', async event => {
    const key = keyOf(event);
    if (!key || stopped || !ui.open || busy || !now?.show || now.live) return;
    try {
      if (await doc.querySelector(TYPING)) return;
      if (!stopped && ui.open && !busy && now?.show && !now.live) await press({ t: 'back' });
    } catch (error) { console.warn('[poke-battle] 패널', error); }
  });
  const unlisten = changes(() => { refresh(); });
  const unpictures = pictures?.onChange(picturesArrived) ?? (() => {});
  return {
    refresh: () => refresh({ force: true }),
    stop: async () => { stopped = true; unlisten(); unpictures(); endHover(); await Promise.all([listenOutside(false), listenHover(false), listenLift(false)]); try { await doc.removeEventListener('keydown', keys); await root.remove(); } catch { /* already gone */ } },
    get ui() { return ui; },
  };
}
