import { panelModel, reduce, initialUi, levelUpPlan, levelUpAction, evolutionMoves, evolveAction, teachAction, rememberAction, petAction, trainAction, spinInto, actions, boxName,
  pendingCount, DEFAULT_SCREEN_PLACE, liveScreen, screenTab, slotView, namesFor } from '../../story/panel.mjs';
import { screenView } from '../../story/panel-screens.mjs';
import { loadExpText } from '../../director/steps-exp.js';
import { rememberableMoves } from '../../story/state.mjs';
import { trainBlock } from '../../story/training.mjs';
import { renderPanel, panelShell, PANEL_STATES, OWN_CLASS, sheetCss, sheetArt } from '../../story/panel-html.mjs';
import { unreadableLine } from '../../story/stored.mjs';
import { WHAT, failureText } from '../../story/failure.mjs';
import { CHAT_SCREEN } from '../battle/stage.js';
import { statusMoney, compatTravel } from '../../story/compat.mjs';

const clone = value => JSON.parse(JSON.stringify(value));

const SWIPE_PX = 40;

const ECHO_MS = 400;

const TYPING = ':is(input, textarea, select, [contenteditable]:not([contenteditable="false"])):focus';

export function keyOf(event) {
  if (!event || event.ctrlKey || event.altKey || event.metaKey || event.repeat) return null;
  const key = event.key;
  return key === 'Escape' || key === 'Esc' ? 'esc' : key === 'b' || key === 'B' ? 'b' : null;
}

export async function startPanel({ doc, read, queueAction, screens, changes = () => () => {}, resume = async () => {}, toggleAux = async () => null, debugAdd = async () => {}, debugEdit = async () => {}, debugHeal = async () => {}, debugBadges = async () => {}, debugLock = async () => {},
  botTravel = async () => {}, quickImport = async () => {}, importLater = async () => {}, pictures = null, place = () => DEFAULT_SCREEN_PLACE, trainer = async () => null }) {
  const body = await doc.querySelector('body');
  if (!body) return null;
  const root = await doc.createElement('div');
  await root.addClass('x-risu-pkbp-root');
  await body.appendChild(root);
  await root.setInnerHTML(panelShell());
  const [outer, tabsBox, sheetBox, artBox] = await Promise.all(['.x-risu-pkbp', '.x-risu-pkbp-tabs', '.x-risu-pkbp-sheet', '.x-risu-pkbp-art'].map(selector => root.querySelector(selector)));
  if (!outer || !tabsBox || !sheetBox) { await root.remove(); return null; }

  let ui = initialUi();
  let now = null;
  let chatId;
  const chatScreens = new Map();
  let shown = { tabs: null, sheet: null, states: PANEL_STATES.gone, art: '' };
  let lastSig = null, busy = false, stopped = false;
  let away = false;
  let line = Promise.resolve(), queued = false, missed = false;

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

    const travel = cur?.on && cur.compat ? compatTravel(cur.chat) : null;

    const sig = JSON.stringify([cur?.key ?? null, cur?.lang ?? null, !!cur?.on, battle.phase, chatScreen, !!cur?.compat, !!cur?.debug, cur?.aux?.on ?? null, cur?.offer ?? null, travel,
      pictures?.route() ?? null, place()]);
    if (!force && sig === lastSig) return;
    if ((cur?.id ?? null) !== chatId) {
      const id = cur?.id ?? null;
      if (chatId !== undefined) {
        if (ui.screen) chatScreens.set(chatId, ui.screen); else chatScreens.delete(chatId);
        const back = chatScreens.get(id) ?? null;
        chatScreens.delete(id);
        ui = { ...initialUi(), open: ui.open, pairHidden: ui.pairHidden, ...(back ? { screen: back, tab: screenTab(back) } : {}) };
      }
      chatId = id;
    }

    now = cur?.on && chatScreen
      ? { target: cur.target, chat: cur.chat, lang: cur.lang, state: cur.state, locked: !!battle.key, show: true, ctx: cur.ctx, unreadable: !!cur.unreadable, debug: !!cur.debug, offer: cur.offer ?? null } : null;

    if (now) now.resume = battle.phase === 'folded' || battle.phase === 'parked';
    if (now) now.live = battle.phase === 'live';
    if (now) now.aux = cur.aux ?? null;
    if (now) {
      now.travel = travel;
      now.money = cur.compat ? statusMoney(cur.chat) : undefined;
    }
    await draw();
    lastSig = sig;
  }

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
    for (let i = 0; i < n; i++) {
      const element = await list.at(i);
      const index = Number((await element.getClassName()).match(/x-risu-pkbp-h(\d+)/)?.[1]);
      const hit = hits[index];
      if (!hit) continue;
      await element.addEventListener('click', event => {
        if (swipedJust()) return;
        if (hit.t === 'blank' ? echo(event) : (took(event), false)) return;
        press(hit).catch(error => console.warn('[poke-battle] 패널', error));
      });
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
        swipedAt = Date.now();
        press(dx < 0 ? next : prev).catch(error => console.warn('[poke-battle] 패널', error));
      });
    }
  }

  let swipeFrom = null, swipedAt = 0;
  const swipedJust = () => Date.now() - swipedAt < 400;

  let taken = null;
  const took = event => { taken = { x: event?.clientX, y: event?.clientY, at: Date.now() }; };
  const echo = event => {
    const last = taken;
    taken = null;
    return !!last && Date.now() - last.at < ECHO_MS && last.x === event?.clientX && last.y === event?.clientY;
  };

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
      return setStates([PANEL_STATES.gone]);
    }
    if (away) return setStates([PANEL_STATES.gone]);
    const screen = await screenNow();

    const shownUi = now.unreadable && !ui.message ? { ...ui, message: { text: unreadableLine(now.lang), error: true } } : ui;
    const view = renderPanel(panelModel({ state: now.state, ctx: now.ctx, lang: now.lang, locked: now.locked, resume: now.resume, debug: now.debug, offer: now.offer, travel: now.travel,
      ui: shownUi, screen, money: now.money }), { aux: now.aux, picture: pictures?.src });
    const states = [view.open && PANEL_STATES.open, view.locked && PANEL_STATES.locked].filter(Boolean);

    if (view.open && view.sheet !== shown.sheet) { await fill(sheetBox, view.sheet, view.hits); shown.sheet = view.sheet; }

    if (view.open && pictures && artBox) {
      const art = sheetCss(url => pictures.src({ url }));
      if (art !== shown.art) { await artBox.setInnerHTML(sheetArt(art)); shown.art = art; }
    }

    if (view.tabs !== shown.tabs) { await fill(tabsBox, view.tabs, view.hits); shown.tabs = view.tabs; }
    await setStates(states);
  }

  async function screenNow() {
    const live = liveScreen(ui.screen, now);
    if (live !== ui.screen) ui = { ...ui, screen: live };
    if (!live || !ui.open) return null;
    try {
      await loadExpText(now.lang);
      const values = screenView(live, { state: now.state, ctx: now.ctx, lang: now.lang, trainer: live.kind === 'summary' ? await trainer() : null });
      if (values) return values;
    } catch (error) {
      console.warn('[poke-battle] 패널 화면', error);
      say(failureText(WHAT.screen, error, now.lang), true);
    }
    ui = { ...ui, screen: null };
    return null;
  }

  const envNow = () => ({ state: now.state, ctx: now.ctx, lang: now.lang, locked: now.locked, debug: now.debug, place: place() });

  async function press(hit) {
    if (busy || !now) return;
    if (hit.t === 'aux') {
      busy = true;
      try { await toggleAux(); } finally { busy = false; }
      missed = false;
      return void await refresh({ force: true });
    }
    const { ui: next, effect } = reduce(ui, hit, envNow());
    const opening = !ui.open && next.open;
    ui = next;
    if (!effect) {
      await draw();
      if (opening) await refresh({ force: true });
      return;
    }
    busy = true;
    try {
      await draw();
      await run(effect, now.target, now.lang);
    } finally {
      busy = false;
      await draw().catch(() => {});
      if (missed) { missed = false; refresh(); }
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

  async function queue(action, after, target, lang, screen) {
    try {
      await queueAction(action, target);
      if (screen !== undefined) ui = { ...ui, screen };
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

  async function run(effect, target, lang) {
    try {
      switch (effect.kind) {
        case 'resume': return await resume();
        case 'queue': {
          const ok = await queue(effect.action, effect.after, target, lang, effect.screen);

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
          await screens.session(open => open.summary(mon, onRename, now?.state.customItems));
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
          const action = teachAction(mon, effect.item, effect.move, result);
          if (action) await queue(action, undefined, target, lang);
          else await refresh({ force: true });
          return;
        }
        case 'remember': {

          const mon = findMon(effect.uid);
          if (!mon) return;
          const party = now.state.party, moves = rememberableMoves(now.ctx, mon);
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
          const settle = async action => (action ? queue(action, undefined, target, lang) : (await refresh({ force: true }), true));
          away = true;
          await draw();
          await screens.session(async open => {
            for (let awake = false; mon && !open.closed; awake = true) {
              const ctx = now.ctx;
              const lock = now.debug ? locked => debugLock(effect.uid, locked, target) : null;
              const pet = await open.amie(mon, { debug: now.debug, state: now.state, party: now.state.party, awake, trainWhy: trainBlock(mon, ctx), lock });
              const into = pet.spin ? spinInto(ctx, mon, pet.spin) : null;
              const result = into ? { ...pet, evolution: { into, ...await open.evolution(mon, into, species => evolutionMoves(ctx, mon, species)) } } : pet;
              if (!await settle(petAction(mon, result)) || into || !pet.train || open.closed) return;
              mon = findMon(effect.uid);
              if (!mon) return;
              if (!await settle(trainAction(mon, await open.training(mon)))) return;
              mon = findMon(effect.uid);
            }
          }).finally(() => { away = false; });
          return;
        }
        case 'train': {

          const mon = findMon(effect.uid);
          if (!mon) return;
          const result = await screens.session(open => open.training(mon));
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
      const shown = await screens.session(async open => !!(await open.hatch(clone(mon))).shown);
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
        if (plan.hatch) done.hatched = !!(await open.hatch(mon)).shown;
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

  const outside = await doc.addEventListener('pointerdown', async ({ clientX, clientY }) => {
    if (stopped || !ui.open || busy || !now?.show || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return;
    try {
      const areas = await Promise.all([sheetBox.getBoundingClientRect(), tabsBox.getBoundingClientRect()]);
      const inside = areas.some(r => r.width > 0 && r.height > 0 && clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom);
      if (!inside && !stopped && ui.open && !busy && now?.show) await press({ t: 'fold' });
    } catch (error) { console.warn('[poke-battle] 패널', error); }
  }, true);

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
    stop: async () => { stopped = true; unlisten(); unpictures(); try { await doc.removeEventListener('pointerdown', outside); await doc.removeEventListener('keydown', keys); await root.remove(); } catch {                    } },
    get ui() { return ui; },
  };
}
