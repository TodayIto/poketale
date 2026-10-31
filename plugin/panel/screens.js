import * as sim from '../../engine/browser-engine.mjs';
import { createOutsideScreens } from '../battle/outside.js';
import { loadLevelUp, EXP_TABLE } from '../battle/level-tables.js';
import { PHONE_CSS, isPhone, layoutOf, mountPhoneLayout } from '../battle/phone.js';
import { mountScreenButtons } from '../battle/screen-buttons.js';
import { mountLoading } from '../battle/loading.js';
import { UI_VARS, CARD_FRAME, BAND_CSS, rowButtonsCss, crossIcon } from '../battle/ui-css.js';
import { BOX_NAME_MAX } from '../../story/rules.mjs';
import { sayer } from '../../story/screen-text.mjs';
import { esc } from '../../story/card.mjs';

function whenShown(view, shown) {
  const { showSummary, startPartyScene, startEvolution } = view;
  if (showSummary) view.showSummary = (slot, options = {}) => showSummary(slot, { ...options, onOpen: () => { shown(); options.onOpen?.(); } });
  for (const [name, original] of [['startPartyScene', startPartyScene], ['startEvolution', startEvolution]]) {
    if (original) view[name] = async (...args) => { const result = await original(...args); shown(); return result; };
  }
  return view;
}

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
  /* Phone: no strip row (the pad is below) - the strip lies over the top of the view with only the X while loading */
  .poke-battle.pkb-outside.pkb-portrait .band { position:absolute; top:0; left:0; right:0; z-index:3; height:auto; padding:5px 2px; pointer-events:none; }
  .poke-battle.pkb-outside.pkb-portrait .band button { pointer-events:auto; }
  .poke-battle.pkb-outside.pkb-portrait { justify-content:flex-start; }
  .poke-battle.pkb-outside.pkb-landscape { flex-direction:row; }
  /* Box rename — a small window in the card style */
  .poke-battle.pkb-outside.pkb-dialog { background:rgba(15,24,34,.78); padding:16px; }
  .poke-battle.pkb-outside .card { width:min(340px, 100%); overflow:hidden; ${CARD_FRAME} color:var(--ink); font-weight:700; font-size:14px; }
  .poke-battle.pkb-outside .card .hd { padding:5px 12px; background:#3d7196; color:#fff; border-bottom:2.5px solid #234f6e; text-shadow:0 1px 0 #0005; }
  .poke-battle.pkb-outside .card .bd { padding:12px 14px 14px; }
  .poke-battle.pkb-outside .card input { width:100%; font:inherit; font-size:16px; padding:7px 10px; border:2px solid var(--navy); border-radius:8px; background:#fff; color:#14304a; outline:none; }
  .poke-battle.pkb-outside .card input:focus { box-shadow:0 0 0 3px #ffd35c; }
  .poke-battle.pkb-outside .card .hint { margin:6px 0 0; font-size:12px; color:#5b768b; }
  ${rowButtonsCss('.poke-battle.pkb-outside .card .row')}
  ${PHONE_CSS}
`;

export function createPanelScreens({ fetchBytes, settings = () => ({}), lang, show = async () => {}, hide = async () => {}, createView = openBattleView, phone = isPhone(), trainer } = {}) {
  let busy = false;

  function mountHost(shown) {
    const close = esc(sayer(shown)('screen.close'));
    const root = document.createElement('section');
    root.className = 'poke-battle pkb-outside';
    root.innerHTML = `<style>${CSS}</style>`
      + `<div class="frame"><div class="band"><button type="button" class="leave" aria-label="${close}" title="${close}">${crossIcon(2.6)}</button><span class="grow"></span></div>`
      + '<div class="screen"><div class="stage"></div></div></div>';
    document.body.append(root);
    const press = key => { try { host.view?.pressKey?.(key); } catch {                     } };
    const layout = layoutOf({ phone });
    const takeDown = mountPhoneLayout(root, layout, { press, band: false, lang: shown });
    const leave = root.querySelector('.leave'), ball = mountLoading(root.querySelector('.screen'), { lang: shown });
    const buttons = mountScreenButtons(root.querySelector('.band'), { press, lang: shown });

    // Loading: the ball and the X. Back and the page arrows only once the screen shows (PC only)
    const loading = {
      show() { ball.show(); leave.hidden = false; buttons.show(false); },
      hide() { ball.hide(); leave.hidden = true; buttons.show(layout === 'desktop'); },
    };
    const host = { root, stage: root.querySelector('.stage'), view: null, loading, left: false, onLeave: null,
      watch(view) { view.watchButtons?.(buttons.set); }, remove() { takeDown(); root.remove(); } };

    leave.addEventListener('click', () => {
      if (host.left) return;
      host.left = true;
      host.view?.destroy();
      host.onLeave();
    });
    return host;
  }

  async function screensFor(host, shown) {
    const options = settings();
    return createOutsideScreens({ sim, fetchBytes, levelUp: loadLevelUp, exp: EXP_TABLE, trainer, lang: shown,
      viewOptions: { theme: options.theme, sound: options.sound },
      createView: async viewOptions => {
        host.loading.show();
        const view = await createView(viewOptions);
        if (host.left) { view.destroy(); throw new Error('Closed'); }
        host.view = view;
        host.watch(view);
        return whenShown(view, host.loading.hide);
      } });
  }

  async function session(work) {
    if (busy) throw new Error('Another screen is open');
    busy = true;
    const owner = {};
    let host = null;
    try {
      const shown = await lang();
      host = mountHost(shown);
      const left = new Promise(resolve => { host.onLeave = resolve; });
      await show(owner);
      const screens = await screensFor(host, shown);
      const parent = host.stage;
      const working = work({
        summary: (mon, onRename, customItems) => screens.openSummary({ parent, mon, customItems, ...(onRename ? { onRename } : {}) }),
        learnMove: (mon, move, party) => screens.openLearnMove({ parent, mon, move, party }),
        evolution: (mon, into, learn) => screens.openEvolution({ parent, mon, into, learn }),
      });

      // When closed with X, drop the remaining work (waiting on the closed screen)
      return await Promise.race([working, left.then(() => { working.catch(() => {}); return undefined; })]);
    } finally {
      host?.remove();
      busy = false;
      await hide(owner);
    }
  }

  async function renameBox(current) {
    if (busy) return null;
    busy = true;
    const root = document.createElement('section');
    root.className = 'poke-battle pkb-outside pkb-dialog';
    const owner = {};
    try {
      const say = sayer(await lang());
      const t = key => esc(say(key));
      root.innerHTML = `<style>${CSS}</style><div class="card" role="dialog" aria-label="${t('screen.boxRename')}"><div class="hd">${t('screen.boxRename')}</div><div class="bd">
      <input type="text" maxlength="${BOX_NAME_MAX}" autocomplete="off" spellcheck="false" aria-label="${t('screen.boxName')}"><p class="hint">${t('screen.boxHint')}</p>
      <div class="row"><button type="button" class="sec no">${t('screen.cancel')}</button><button type="button" class="ok">${t('screen.rename')}</button></div></div></div>`;
      document.body.append(root);
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

  return { session, renameBox, get busy() { return busy; } };
}
