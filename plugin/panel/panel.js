import { panelModel, reduce, initialUi, levelUpPlan, levelUpAction, evolutionMoves, stoneAction, teachAction, actions, boxName,
  pendingCount } from '../../story/panel.mjs';
import { renderPanel, panelShell, PANEL_STATES } from '../../story/panel-html.mjs';
import { unreadableLine } from '../../story/stored.mjs';
import { WHAT, failureText } from '../../story/failure.mjs';
import { CHAT_SCREEN } from '../battle/stage.js';
import { statusMoney } from '../../story/compat.mjs';

const clone = value => JSON.parse(JSON.stringify(value));

export async function startPanel({ doc, read, queueAction, screens, changes = () => () => {}, resume = async () => {}, toggleAux = async () => null, debugAdd = async () => {}, debugEdit = async () => {}, debugHeal = async () => {},
  quickImport = async () => {}, importLater = async () => {} }) {
  const body = await doc.querySelector('body');
  if (!body) return null;
  const root = await doc.createElement('div');
  await root.addClass('x-risu-pkbp-root');
  await body.appendChild(root);
  await root.setInnerHTML(panelShell());
  const [outer, tabsBox, sheetBox] = await Promise.all(['.x-risu-pkbp', '.x-risu-pkbp-tabs', '.x-risu-pkbp-sheet'].map(selector => root.querySelector(selector)));
  if (!outer || !tabsBox || !sheetBox) { await root.remove(); return null; }

  let ui = initialUi();
  let now = null;
  let chatId;
  let shown = { tabs: null, sheet: null, states: PANEL_STATES.gone };
  let lastSig = null, busy = false, stopped = false;
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

    const sig = JSON.stringify([cur?.key ?? null, cur?.lang ?? null, !!cur?.on, battle.phase, chatScreen, !!cur?.compat, !!cur?.debug, cur?.aux?.on ?? null, cur?.offer ?? null]);
    if (!force && sig === lastSig) return;
    if ((cur?.id ?? null) !== chatId) {
      if (chatId !== undefined) ui = { ...initialUi(), open: ui.open };
      chatId = cur?.id ?? null;
    }

    now = cur?.on && chatScreen
      ? { target: cur.target, chat: cur.chat, lang: cur.lang, state: cur.state, locked: !!battle.key, show: true, ctx: cur.ctx, unreadable: !!cur.unreadable, debug: !!cur.debug, offer: cur.offer ?? null } : null;

    if (now) now.resume = battle.phase === 'folded' || battle.phase === 'parked';
    if (now) now.aux = cur.aux ?? null;
    if (now) {
      now.low = !!cur.compat;
      now.money = cur.compat ? statusMoney(cur.chat) : undefined;
    }
    await draw();
    lastSig = sig;
  }

  // Syncs the outer element's classes (open, locked, hidden)
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
      if (hit) await element.addEventListener('click', () => { press(hit).catch(error => console.warn('[poke-battle] 패널', error)); });
    }
  }

  let drawing = Promise.resolve();
  function draw() {
    const next = drawing.then(drawNow);
    drawing = next.catch(() => {});
    return next;
  }
  async function drawNow() {
    if (stopped) return;
    if (!now?.show) {

      if (shown.tabs) { await tabsBox.setInnerHTML(''); shown.tabs = ''; }
      return setStates([PANEL_STATES.gone]);
    }

    const shownUi = now.unreadable && !ui.message ? { ...ui, message: { text: unreadableLine(now.lang), error: true } } : ui;
    const view = renderPanel(panelModel({ state: now.state, ctx: now.ctx, lang: now.lang, locked: now.locked, resume: now.resume, debug: now.debug, offer: now.offer, ui: shownUi, money: now.money }), { compat: now.low, aux: now.aux });
    const states = [view.open && PANEL_STATES.open, view.locked && PANEL_STATES.locked, now.low && PANEL_STATES.low].filter(Boolean);

    if (view.open && view.sheet !== shown.sheet) { await fill(sheetBox, view.sheet, view.hits); shown.sheet = view.sheet; }

    if (view.tabs !== shown.tabs) { await fill(tabsBox, view.tabs, view.hits); shown.tabs = view.tabs; }
    await setStates(states);
  }

  async function press(hit) {
    if (busy || !now) return;
    if (hit.t === 'aux') {
      busy = true;
      try { await toggleAux(); } finally { busy = false; }
      missed = false;
      return void await refresh({ force: true });
    }
    const env = { state: now.state, ctx: now.ctx, lang: now.lang, locked: now.locked, debug: now.debug };
    const { ui: next, effect } = reduce(ui, hit, env);
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

  async function queue(action, after, target, lang) {
    try {
      await queueAction(action, target);
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
          const ok = await queue(effect.action, effect.after, target, lang);

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
        case 'levelup': return void await levelUp(effect.uid, target, lang);
        case 'evolveItem': {
          const mon = findMon(effect.uid);
          if (!mon) return;
          const learn = evolutionMoves(now.ctx, mon, effect.into);
          const result = await screens.session(open => open.evolution(mon, effect.into, learn));
          const action = stoneAction(mon, effect.item, { into: effect.into, ...result }, { consumeHeld: !!effect.consumeHeld });
          if (action) await queue(action, undefined, target, lang);
          else await refresh({ force: true });
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

  async function levelUp(uid, target, lang) {
    const start = findMon(uid);
    if (!start || now.locked || !pendingCount(start)) return;
    const plan = levelUpPlan(start);
    const party = now.state.party;
    const ctx = now.ctx;
    const done = { moves: [], evolution: null };
    let mon = clone(start);
    try {
      await screens.session(async open => {
        for (const move of plan.moves) {
          const result = await open.learnMove(mon, move, party.map(m => (m.uid === mon.uid ? mon : m)));
          done.moves.push({ move, result });
          if (result.learned) {
            mon = clone(mon);
            if (result.forgot) mon.set.moves[mon.set.moves.indexOf(result.forgot)] = move; else mon.set.moves.push(move);
          }
        }
        if (plan.evolve) {
          const result = await open.evolution(mon, plan.evolve, evolutionMoves(ctx, mon, plan.evolve));
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
      const horizontalTabs = await sheetBox.querySelector('.x-risu-pkbp-stabs');
      const [sheet, tabs, horizontal] = await Promise.all([
        sheetBox.getBoundingClientRect(), tabsBox.getBoundingClientRect(), horizontalTabs?.getBoundingClientRect(),
      ]);
      const areas = horizontal?.height > 0 ? [sheet] : [sheet, tabs];
      const inside = areas.some(r => r.width > 0 && r.height > 0 && clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom);
      if (!inside && !stopped && ui.open && !busy && now?.show) await press({ t: 'fold' });
    } catch (error) { console.warn('[poke-battle] 패널', error); }
  }, true);
  const unlisten = changes(() => { refresh(); });
  return {
    refresh: () => refresh({ force: true }),
    stop: async () => { stopped = true; unlisten(); try { await doc.removeEventListener('pointerdown', outside); await root.remove(); } catch {                    } },
    get ui() { return ui; },
  };
}
