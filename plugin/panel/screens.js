import * as sim from '../../engine/browser-engine.mjs';
import { createOutsideScreens } from '../battle/outside.js';
import { loadLevelUp, EXP_TABLE } from '../battle/level-tables.js';
import { PHONE_CSS, isPhone, layoutOf, mountPhoneLayout } from '../battle/phone.js';
import { mountLoading } from '../battle/loading.js';
import { UI_VARS, CARD_FRAME, rowButtonsCss, crossIcon } from '../battle/ui-css.js';
import { BOX_NAME_MAX } from '../../story/rules.mjs';

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
  .poke-battle.pkb-outside { --band:0px; ${UI_VARS}
    position:fixed; inset:0; z-index:200; display:flex; flex-direction:column; align-items:center; justify-content:center; overflow:hidden;
    background:#0f1822; color:#f8f8f8; font:16px/1.5 system-ui,sans-serif; }
  .poke-battle.pkb-outside * { box-sizing:border-box; }
  .poke-battle.pkb-outside .frame { flex:none; width:min(100vw, calc(100vh * 16 / 9)); }
  .poke-battle.pkb-outside .screen { position:relative; width:100%; aspect-ratio:16 / 9; overflow:hidden; background:#000; }
  .poke-battle.pkb-outside .stage { position:absolute; inset:0; }
  /* X while loading — the same button as the battle strip's leave button. Only while the ball (.pkb-loading) shows */
  .poke-battle.pkb-outside .leave { position:absolute; top:5px; left:2px; z-index:3; display:none; width:28px; height:26px; padding:0; align-items:center; justify-content:center;
    border:2px solid var(--navy); border-radius:7px; background:#fff; color:var(--red); box-shadow:0 2.5px 0 var(--navy-dark); cursor:pointer; }
  .poke-battle.pkb-outside .pkb-loading:not([hidden]) ~ .leave { display:flex; }
  .poke-battle.pkb-outside .leave:active { transform:translateY(2px); box-shadow:0 .5px 0 var(--navy-dark); }
  .poke-battle.pkb-outside .leave svg { width:13px; height:13px; display:block; }
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

export function createPanelScreens({ fetchBytes, settings = () => ({}), show = async () => {}, hide = async () => {}, createView = openBattleView, phone = isPhone(), trainer } = {}) {
  let busy = false;

  function mountHost() {
    const root = document.createElement('section');
    root.className = 'poke-battle pkb-outside';
    root.innerHTML = `<style>${CSS}</style>`
      + `<div class="frame"><div class="screen"><div class="stage"></div><button type="button" class="leave" aria-label="닫기" title="닫기">${crossIcon(2.6)}</button></div></div>`;
    document.body.append(root);
    const press = key => { try { host.view?.pressKey?.(key); } catch {                     } };
    const takeDown = mountPhoneLayout(root, layoutOf({ phone, orientation: settings().orientation }), { press, band: false });
    const screen = root.querySelector('.screen');
    const host = { root, stage: root.querySelector('.stage'), view: null, loading: mountLoading(screen, { before: screen.querySelector('.leave') }),
      left: false, onLeave: null, remove() { takeDown(); root.remove(); } };

    root.querySelector('.leave').addEventListener('click', () => {
      if (host.left) return;
      host.left = true;
      host.view?.destroy();
      host.onLeave();
    });
    return host;
  }

  function screensFor(host) {
    const options = settings();
    return createOutsideScreens({ sim, fetchBytes, levelUp: loadLevelUp, exp: EXP_TABLE, trainer,
      viewOptions: { theme: options.theme, sound: options.sound },
      createView: async viewOptions => {
        host.loading.show();
        const view = await createView(viewOptions);
        if (host.left) { view.destroy(); throw new Error('닫힘'); }
        host.view = view;
        return whenShown(view, host.loading.hide);
      } });
  }

  async function session(work) {
    if (busy) throw new Error('다른 화면이 열려 있습니다.');
    busy = true;
    const owner = {};
    let host = null;
    try {
      host = mountHost();
      const left = new Promise(resolve => { host.onLeave = resolve; });
      await show(owner);
      const screens = screensFor(host);
      const parent = host.stage;
      const working = work({
        summary: (mon, onRename) => screens.openSummary({ parent, mon, ...(onRename ? { onRename } : {}) }),
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

  // Box rename dialog -> new name (empty = back to the default name) | null (cancelled)
  async function renameBox(current) {
    if (busy) return null;
    busy = true;
    const root = document.createElement('section');
    root.className = 'poke-battle pkb-outside pkb-dialog';
    root.innerHTML = `<style>${CSS}</style><div class="card" role="dialog" aria-label="박스 이름 바꾸기"><div class="hd">박스 이름 바꾸기</div><div class="bd">
      <input type="text" maxlength="${BOX_NAME_MAX}" autocomplete="off" spellcheck="false" aria-label="박스 이름"><p class="hint">비우면 원래 이름으로 돌아갑니다.</p>
      <div class="row"><button type="button" class="sec no">그만두기</button><button type="button" class="ok">바꾸기</button></div></div></div>`;
    document.body.append(root);
    const input = root.querySelector('input');
    input.value = current ?? '';
    const owner = {};
    try {
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
