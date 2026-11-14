import * as sim from '../../engine/browser-engine.mjs';
import { createOutsideScreens } from '../battle/outside.js';
import { loadLevelUp, EXP_TABLE } from '../battle/level-tables.js';
import { PHONE_CSS, isPhone, layoutOf, mountPhoneLayout } from '../battle/phone.js';
import { mountScreenButtons } from '../battle/screen-buttons.js';
import { mountLoading } from '../battle/loading.js';
import { UI_VARS, BAND_CSS, stripX, crossIcon, ringCss, ringOnKeys } from '../battle/ui-css.js';
import { BOX_NAME_MAX, NICKNAME_MAX, sameNickname } from '../../story/rules.mjs';
import { viewWords } from '../../view/words.js';
import { sayer } from '../../story/screen-text.mjs';
import { esc, FONT } from '../../story/card.mjs';
import { SHEET_FONT } from '../../story/style.mjs';
import { loadFont } from '../../view/fonts.js';
import { CLOSE_EVENT } from '../../view/frame-parts.js';
import { viewPictureWays } from '../battle/picture-route.js';
import { createReplyNotice } from '../../view/reply-notice.js';

function whenShown(view, shown, notice = null) {
  const { showSummary, startPartyScene, startEvolution, chooseRememberMove, startAmie, startTraining } = view;
  if (showSummary) view.showSummary = (slot, options = {}) => showSummary(slot, { ...options, onOpen: () => { shown(); options.onOpen?.(); } });
  if (chooseRememberMove) view.chooseRememberMove = (options = {}) => chooseRememberMove({ ...options, onOpen: () => { shown(); options.onOpen?.(); } });
  if (startAmie) view.startAmie = (options = {}) => startAmie({ notice, ...options, onOpen: () => { shown(); options.onOpen?.(); } });
  if (startTraining) view.startTraining = (options = {}) => startTraining({ notice, ...options, onOpen: () => { shown(); options.onOpen?.(); } });
  for (const [name, original] of [['startPartyScene', startPartyScene], ['startEvolution', startEvolution]]) {
    if (original) view[name] = async (...args) => { const result = await original(...args); shown(); return result; };
  }
  return view;
}

export const WITH_X = new Set(['summary', 'evolution', 'rememberMove', 'amie', 'training']);

export const FILL_PAD = new Set(['amie', 'training']);

export const FILL_WINDOW = new Set(['amie']);

export const OWN_EXITS = new Set(['amie', 'training']);

const openBattleView = async options => (await import('../../view/index.js')).createBattleView(options);

const CSS = `
  .poke-battle.pkb-outside { --band:36px; ${UI_VARS}
    position:fixed; inset:0; z-index:200; display:flex; flex-direction:column; align-items:center; justify-content:center; overflow:hidden;
    background:#0f1822; color:#f8f8f8; font:16px/1.5 system-ui,sans-serif; }
  .poke-battle.pkb-outside * { box-sizing:border-box; }
  .poke-battle.pkb-outside .frame { flex:none; position:relative; display:flex; flex-direction:column; width:min(100vw, calc((100vh - var(--band)) * 16 / 9)); }
  ${BAND_CSS}
  .poke-battle.pkb-outside .screen { position:relative; width:100%; aspect-ratio:16 / 9; overflow:hidden; background:#000; }
  .poke-battle.pkb-outside .stage { position:absolute; inset:0; }
  .poke-battle.pkb-outside.pkb-landscape { flex-direction:row; }
  .poke-battle.pkb-outside.pkb-desktop.pkb-fill .frame { width:100%; height:100%; }
  .poke-battle.pkb-outside.pkb-desktop.pkb-fill .screen { flex:1 1 auto; aspect-ratio:auto; min-height:0; }
  .poke-battle.pkb-outside.pkb-own-exits .band { position:absolute; top:0; left:0; right:0; z-index:5; }
  .poke-battle.pkb-outside.pkb-own-exits.pkb-exits-shown .band { display:none; }
  /* Name dialogs (box name, nickname) - the right panel's look: its pixel font, white sheet with a navy border, a header with a coloured line, close (X) at the top right,
     one red button */
  .poke-battle.pkb-outside.pkb-dialog { background:rgba(15,24,34,.78); padding:16px; font:14px/1.4 ${FONT}; font-weight:400; }
  .poke-battle.pkb-outside .card { width:min(340px, 100%); overflow:hidden; border:2.5px solid #23435f; border-radius:12px; background:linear-gradient(160deg,#ffffff,#eef5fa);
    box-shadow:0 4px 0 #1a3247; color:#14304a; }
  .poke-battle.pkb-outside .card .hd { display:flex; align-items:center; gap:8px; margin:0 12px; padding:10px 0 6px; border-bottom:2px solid #3d7196; color:#23435f; font-size:15px; }
  .poke-battle.pkb-outside .card .hd b { flex:1; min-width:0; font-weight:400; }
  .poke-battle.pkb-outside .card .hd .no { position:relative; flex:none; width:26px; height:24px; padding:0; display:flex; align-items:center; justify-content:center;
    border:1.5px solid #789db7; border-radius:6px; background:#fff; color:#23435f; box-shadow:0 1.5px 0 #466c87; cursor:pointer; }
  .poke-battle.pkb-outside .card .hd .no::after { content:""; position:absolute; left:50%; top:50%; width:40px; height:40px; transform:translate(-50%,-50%); }
  .poke-battle.pkb-outside .card .hd .no:active { transform:translateY(1px); box-shadow:none; }
  .poke-battle.pkb-outside .card .hd .no svg { width:12px; height:12px; display:block; }
  .poke-battle.pkb-outside .card .bd { padding:12px 12px 14px; }
  .poke-battle.pkb-outside .card input { width:100%; font:inherit; font-size:16px; padding:7px 10px; border:2px solid #789db7; border-radius:8px; background:#fff; color:#14304a; outline:none;
    box-shadow:inset 0 1.5px 0 rgba(0,0,0,.06); }
  .poke-battle.pkb-outside .card input:focus { border-color:#23435f; box-shadow:0 0 0 3px #ffd35c; }
  .poke-battle.pkb-outside .card .hint { margin:6px 0 0; font-size:12px; color:#5d7486; }
  .poke-battle.pkb-outside .who { display:flex; align-items:center; gap:10px; margin-bottom:10px; }
  .poke-battle.pkb-outside .who img { width:48px; height:48px; border:1.5px solid #8fb0c8; border-radius:50%; background:#dbe8f2; image-rendering:pixelated; object-fit:contain; }
  .poke-battle.pkb-outside .who small { display:block; color:#5d7486; font-size:12px; }
  .poke-battle.pkb-outside .card .ok { display:block; width:100%; margin-top:12px; padding:8px 10px 7px; font:inherit; font-size:15px; border:2px solid #8e2835; border-radius:9px;
    background:#d8434d; color:#fff; box-shadow:0 3px 0 #8e2835; cursor:pointer; }
  .poke-battle.pkb-outside .card .ok:active { transform:translateY(2px); box-shadow:0 1px 0 #8e2835; }
  .poke-battle.pkb-outside .card button:focus-visible { outline:2px solid #ffcf4a; outline-offset:2px; }
  ${ringCss('.poke-battle.pkb-outside.pkb-dialog')}
  /* phone: the keyboard covers the lower half - the dialog sits above the middle */
  @media (max-width:640px) { .poke-battle.pkb-outside.pkb-dialog { justify-content:flex-start; padding-top:12vh; } }
  ${PHONE_CSS}
`;

export function createPanelScreens({ fetchBytes, settings = () => ({}), lang, show = async () => {}, hide = async () => {}, createView = openBattleView, phone = isPhone(), trainer, battleFormat,
  replies = null } = {}) {
  let busy = false;

  function mountHost(shown) {
    const root = document.createElement('section');
    root.className = 'poke-battle pkb-outside';
    root.innerHTML = `<style>${CSS}</style>`
      + `<div class="frame"><div class="band">${stripX(esc(sayer(shown)('screen.close')))}<span class="grow"></span></div>`
      + '<div class="screen"><div class="stage"></div></div></div>';
    document.body.append(root);
    const press = key => { try { host.view?.pressKey?.(key); } catch {                     } };
    const layout = layoutOf({ phone });
    const takeDown = mountPhoneLayout(root, layout, { press, lang: shown });
    const leave = root.querySelector('.leave'), ball = mountLoading(root.querySelector('.screen'), { lang: shown });
    const buttons = mountScreenButtons(root.querySelector('.band'), { press, lang: shown });

    let loadingNow = true, screen = null;
    const drawX = () => {
      leave.hidden = !loadingNow && !WITH_X.has(screen);
      root.classList.toggle('pkb-exits-shown', !loadingNow && OWN_EXITS.has(screen));
    };
    // Loading: the ball and the X. Back and the page arrows only once the screen shows (PC only)
    const loading = {
      show() { ball.show(); loadingNow = true; drawX(); buttons.show(false); },
      hide() { ball.hide(); loadingNow = false; drawX(); buttons.show(layout === 'desktop'); },
    };
    const host = { root, stage: root.querySelector('.stage'), view: null, loading, left: false, onLeave: null,

      opening(name) {
        screen = name; drawX();
        root.classList.toggle('pkb-fill', (layout === 'portrait' ? FILL_PAD : FILL_WINDOW).has(name));
        root.classList.toggle('pkb-own-exits', OWN_EXITS.has(name));
      },
      watch(view) { view.watchButtons?.(buttons.set); }, remove() { takeDown(); root.remove(); } };

    leave.addEventListener('click', () => {
      if (host.left) return;
      host.left = true;
      const open = !!host.view && !host.view.closed;
      host.view?.destroy();
      host.onLeave(open);
    });

    root.addEventListener(CLOSE_EVENT, event => { event.preventDefault(); leave.click(); });
    return host;
  }

  async function screensFor(host, shown, notice) {
    const options = settings();
    return createOutsideScreens({ sim, fetchBytes, levelUp: loadLevelUp, exp: EXP_TABLE, trainer, battleFormat, lang: shown,
      viewOptions: { theme: options.theme, sound: options.sound, pictureWays: viewPictureWays(options.panelPicture) },
      createView: async viewOptions => {
        host.loading.show();
        const view = await createView(viewOptions);
        if (host.left) { view.destroy(); throw new Error('Closed'); }
        host.view = view;
        host.watch(view);
        return whenShown(view, host.loading.hide, notice);
      } });
  }

  async function session(work) {
    if (busy) throw new Error('Another screen is open');
    busy = true;
    const owner = {};
    let host = null, unwatch = () => {};
    try {
      const shown = await lang();
      host = mountHost(shown);
      const left = new Promise(resolve => { host.onLeave = resolve; });

      const notice = createReplyNotice();
      if (replies) {
        unwatch = await Promise.resolve(replies(() => notice.show())).catch(error => { console.warn('[poke-battle] 답장 배지를 켜지 못함', error); return () => {}; });
      }
      await show(owner);
      const screens = await screensFor(host, shown, notice);
      const parent = host.stage;
      const screen = (name, opening) => (...args) => { host.opening(name); return opening(...args); };
      const working = work({
        summary: screen('summary', (mon, onRename, customItems) => screens.openSummary({ parent, mon, customItems, ...(onRename ? { onRename } : {}) })),
        learnMove: screen('learnMove', (mon, move, party) => screens.openLearnMove({ parent, mon, move, party })),
        evolution: screen('evolution', (mon, into, learn) => screens.openEvolution({ parent, mon, into, learn })),
        rememberMove: screen('rememberMove', (mon, moves, party) => screens.openRememberMove({ parent, mon, moves, party })),
        amie: screen('amie', (mon, { debug, state, party, awake, trainWhy, lock, scene } = {}) => screens.openAmie({ parent, mon, state, party, debug, awake, trainWhy, lock, scene })),
        hatch: screen('evolution', mon => screens.openHatch({ parent, mon })),
        training: screen('training', (mon, scene) => screens.openTraining({ parent, mon, scene })),

        get closed() { return host.left; },
      });

      const settled = working.catch(error => { if (host.left) return undefined; throw error; });
      return await Promise.race([settled, left.then(viewOpen => (viewOpen ? settled : undefined))]);
    } finally {
      try { unwatch(); } catch {                       }
      host?.remove();
      busy = false;
      await hide(owner);
    }
  }

  async function askName({ words: wordsIn, current, max }) {
    if (busy) return null;
    busy = true;
    const root = document.createElement('section');
    root.className = 'poke-battle pkb-outside pkb-dialog';
    const owner = {};
    try {
      const shown = await lang(), say = sayer(shown);
      const t = key => esc(say(key));
      const words = wordsIn({ say, lang: shown });
      const whoLine = words.who ? `<div class="who"><div>${esc(words.who.name)}<small>${esc(words.who.note)}</small></div></div>` : '';
      root.innerHTML = `<style>${CSS}</style><div class="card" role="dialog" aria-label="${esc(words.title)}"><div class="hd"><b>${esc(words.title)}</b>`
        + `<button type="button" class="no" aria-label="${t('screen.close')}" title="${t('screen.close')}">${crossIcon(2.6)}</button></div><div class="bd">${whoLine}
      <input type="text" maxlength="${max}" autocomplete="off" spellcheck="false" aria-label="${esc(words.label)}"><p class="hint">${esc(words.hint)}</p>
      <button type="button" class="ok">${t('screen.rename')}</button></div></div>`;
      document.body.append(root);
      ringOnKeys(root);
      loadFont(SHEET_FONT).catch(error => console.warn('[poke-battle] 이름 창 글꼴을 올리지 못함 — 대체 글꼴로', error));

      if (words.who?.picture) {
        const img = new Image();
        img.alt = '';
        img.addEventListener('error', () => img.remove());
        img.src = words.who.picture;
        root.querySelector('.who').prepend(img);
      }
      const input = root.querySelector('input');
      input.value = current ?? '';
      await show(owner);
      input.focus(); input.select();
      return await new Promise(resolve => {
        root.querySelector('.ok').addEventListener('click', () => resolve(input.value.trim()));
        root.querySelector('.no').addEventListener('click', () => resolve(null));
        input.addEventListener('keydown', event => {
          if (event.isComposing) return;
          if (event.key === 'Enter') resolve(input.value.trim());
          if (event.key === 'Escape') resolve(null);
        });
      });
    } finally {
      root.remove();
      busy = false;
      await hide(owner);
    }
  }

  const renameBox = current => askName({ current, max: BOX_NAME_MAX, words: ({ say }) => ({ title: say('screen.boxRename'), label: say('screen.boxName'), hint: say('screen.boxHint') }) });

  async function renameMon(mon) {
    const name = await askName({ current: mon.name, max: NICKNAME_MAX, words: ({ say, lang: shown }) => {
      const words = viewWords(shown);
      return { title: words('menu.renamePokemon'), label: words('menu.nickname'), hint: say('screen.monHint', { species: mon.species }),
        who: { picture: mon.picture, name: mon.name, note: `${mon.species} · Lv${mon.level}` } };
    } });
    return name === null || sameNickname(name, { nickname: mon.nickname, shown: mon.name }) ? null : name;
  }

  return { session, renameBox, renameMon, get busy() { return busy; } };
}
