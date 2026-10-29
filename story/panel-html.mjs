import { esc, FONT } from './card.mjs';
import { statusName, PARTY_MAX, BOX_SIZE } from './panel.mjs';

const SPRITE = (id, shiny) => `https://play.pokemonshowdown.com/sprites/gen5${shiny ? '-shiny' : ''}/${encodeURIComponent(id)}.png`;

const PR_ITEMS = 'https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/37789817134f881da0a038af21991ccc93a66372/images/items.png';
const SD_ITEMS = 'https://play.pokemonshowdown.com/sprites/itemicons-sheet.png';

export const ICON = {

  party: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#fff" stroke="#23435f" stroke-width="2"/>'
    + '<path d="M2 12a10 10 0 0 1 20 0z" fill="#e84d4d" stroke="#23435f" stroke-width="2"/><circle cx="12" cy="12" r="3.2" fill="#fff" stroke="#23435f" stroke-width="2"/></svg>',
  box: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10h16v9.3a1.7 1.7 0 0 1-1.7 1.7H5.7A1.7 1.7 0 0 1 4 19.3z" fill="#d6e6f2" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>'
    + '<path d="M2.6 5.6A1.6 1.6 0 0 1 4.2 4h15.6a1.6 1.6 0 0 1 1.6 1.6V10H2.6z" fill="#7fa6c4" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>'
    + '<path d="M9.3 14h5.4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="7" r="1.2" fill="currentColor"/></svg>',
  bag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6.2V4.8A1.8 1.8 0 0 1 10.8 3h2.4A1.8 1.8 0 0 1 15 4.8v1.4" fill="none" stroke="currentColor" stroke-width="2"/>'
    + '<path d="M4.6 9.8A3.6 3.6 0 0 1 8.2 6.2h7.6a3.6 3.6 0 0 1 3.6 3.6v9.1a2.1 2.1 0 0 1-2.1 2.1H6.7a2.1 2.1 0 0 1-2.1-2.1z" fill="#e9b24c" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>'
    + '<path d="M4.6 12h14.8" stroke="currentColor" stroke-width="2"/><rect x="10" y="10.2" width="4" height="4" rx="1" fill="#fff" stroke="currentColor" stroke-width="1.7"/>'
    + '<path d="M8 16.4v2.4M16 16.4v2.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',

  // Back to battle (only when there is a folded battle - the fourth tab)
  resume: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="#fff" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  fold: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  prev: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M11 2.5v11L3.5 8z"/></svg>',
  next: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M5 2.5v11L12.5 8z"/></svg>',
};
const TAB_LABEL = { party: '파티', box: '박스', bag: '가방' };

export const TAB_COLOR = { party: '#d8434d', box: '#3d7196', bag: '#c98a1d' };

const C = '.x-risu-pkbp';
const CSS = [
  `${C}{position:fixed;right:0;top:84px;z-index:45;display:flex;align-items:flex-start;font-family:${FONT};font-weight:400;font-size:13px;line-height:1.35;color:#23435f;letter-spacing:0;text-align:left;`

    + `transform:translateX(calc(100% - 44px));transition:transform .2s ease-out;}`,
  `${C}${C}-open{transform:none;}`,
  `${C}${C}-gone{display:none;}`,
  `${C}${C}-low{top:280px;}`,
  `${C} *{box-sizing:border-box;}`,
  `:where(${C}) button{font:inherit;margin:0;color:#1d3347;}`,
  `${C} button:focus{outline:none;} ${C} button:focus-visible{outline:2px solid #ffcf4a;outline-offset:1px;}`,

  // Tabs: filled tabs with a navy border. When open the current tab joins the sheet
  `${C}-tabs{display:flex;flex-direction:column;gap:7px;padding-top:10px;position:relative;z-index:2;}`,
  `${C}-tab{position:relative;display:flex;align-items:center;justify-content:center;width:40px;height:44px;padding:0;border:2.5px solid #23435f;border-right:0;border-radius:9px 0 0 9px;`
    + `color:#23435f;box-shadow:-2px 3px 0 #1a3247;cursor:pointer;}`,
  ...Object.entries(TAB_COLOR).map(([tab, color]) => `${C}-t${tab}{background:${color};}`),
  `${C}-tresume{margin-top:6px;background:#23435f;}`,
  `${C}-tab svg{display:block;width:24px;height:24px;}`,
  `${C}-tab:active{transform:translateY(2px);box-shadow:-2px 1px 0 #1a3247;}`,
  `${C}-open ${C}-tab${C}-cur{width:46px;margin-right:-2.5px;}`,

  `${C}-bang{position:absolute;top:-7px;left:-6px;padding:0 4px;border:1.5px solid #c09a2c;border-radius:8px;background:#ffd84a;color:#6b4a00;font:10px/1.4 sans-serif;}`,

  `${C}-sheet{position:relative;z-index:1;visibility:hidden;pointer-events:none;transition:visibility 0s .2s;}`,
  `${C}-open ${C}-sheet{visibility:visible;pointer-events:auto;transition:none;}`,
  `${C}-stabs{display:none;}`,

  `${C}-board{min-height:calc(10px + 3 * 44px + 2 * 7px + 3px + 9px);position:relative;z-index:1;width:300px;max-width:calc(100vw - 50px);border:2.5px solid #23435f;border-right:0;border-radius:0 0 0 12px;overflow:hidden;display:flex;flex-direction:column;max-height:calc(100vh - 100px);`
    + `background:linear-gradient(160deg,#ffffff,#eef5fa);box-shadow:-3px 4px 0 #1a3247;}`,

  `${C}-hd{display:flex;align-items:center;gap:7px;margin:0 10px;padding:9px 0 5px;color:#23435f;font-size:15px;border-bottom:2px solid #23435f;}`,
  `${C}-hd > svg{display:block;flex:none;width:16px;height:16px;}`,
  `${C}-hdr{margin-left:auto;font-size:12px;color:#5d7486;white-space:nowrap;}`,
  `${C}-fold{display:flex;align-items:center;justify-content:center;flex:none;width:24px;height:22px;padding:0;border:1.5px solid #789db7;border-radius:6px;background:#fff;color:#23435f;box-shadow:0 1.5px 0 #466c87;cursor:pointer;}`,
  `${C}-fold svg{display:block;width:12px;height:12px;}`,
  `${C}-hd{flex:none;} ${C}-bd{flex:1 1 auto;min-height:0;overflow:auto;padding:9px 10px 10px;}`,

  `${C}-party{display:grid;grid-template-columns:1fr 1fr;gap:9px 8px;}`,
  `${C}-cell{position:relative;min-width:0;}`,
  `${C}-slot{display:flex;gap:6px;align-items:center;width:100%;padding:5px 7px 5px 4px;border:2px solid #789db7;border-radius:22px 10px 10px 22px;`
    + `background:#fff;color:#23435f;box-shadow:0 3px 0 #466c87;cursor:pointer;text-align:left;}`,
  `${C}-slot:active{transform:translateY(1.5px);box-shadow:0 1px 0 #466c87;}`,
  `${C}-lead{border-color:#d8434d;box-shadow:0 3px 0 #8e2835;}`,
  `${C}-slot${C}-fnt{opacity:.5;}`,
  `${C}-fnt ${C}-pic img{filter:grayscale(1);}`,
  `${C}-picked{outline:3px solid #ffcf4a;outline-offset:1px;}`,
  `${C}-empty{display:flex;align-items:center;justify-content:center;min-height:56px;border:2px dashed #789db7;border-radius:22px 10px 10px 22px;background:#fff;opacity:.5;font-size:11px;}`,
  `${C}-pic{flex:none;display:block;width:42px;height:42px;border:1.5px solid #8fb0c8;border-radius:50%;background:#dbe8f2;overflow:hidden;}`,
  `${C}-pic img{display:block;width:100%;height:100%;object-fit:contain;image-rendering:pixelated;transform:scale(1.45);transform-origin:50% 62%;}`,
  `${C}-info{flex:1;min-width:0;display:block;}`,
  `${C}-nm{display:flex;align-items:center;justify-content:space-between;gap:3px;min-width:0;font-size:12px;}`,
  `${C}-nmt{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}`,
  `${C}-g{flex:none;}`,
  `${C}-gm{color:#3b78c9;} ${C}-gf{color:#d8434d;}`,
  `${C}-hpbar{display:block;height:5px;margin-top:3px;border-radius:3px;background:#5f6c72;overflow:hidden;}`,
  `${C}-hpfill{display:block;height:100%;}`,
  `${C}-hphigh{background:#4fbf57;} ${C}-hpmid{background:#e0b23a;} ${C}-hplow{background:#e0443f;}`,
  `${C}-r{display:flex;align-items:center;justify-content:space-between;gap:3px;margin-top:2px;font-size:10px;color:#5d7486;white-space:nowrap;}`,
  `${C}-r > span{display:flex;align-items:center;gap:3px;}`,
  `${C}-st{display:inline-block;padding:0 3px;border-radius:3px;font-size:9px;line-height:12px;color:#fff;}`,
  `${C}-stpar{background:#c9a512;} ${C}-stbrn{background:#d8602b;} ${C}-stslp{background:#7d8a96;} ${C}-stfrz{background:#4aa6cf;} ${C}-stpsn,${C}-sttox{background:#9b4fb0;}`,
  `${C}-stfnt{background:#7f8b95;}`,
  `${C}-held{display:inline-block;width:8px;height:8px;border-radius:50%;background:#e9b24c;box-shadow:inset 0 0 0 1.5px #a5741c;}`,
  `${C}-exp{display:block;height:3px;margin-top:1px;border-radius:2px;background:#d4dfe7;overflow:hidden;}`,
  `${C}-exp span{display:block;height:100%;background:#4aa3e8;}`,

  `${C}-badge{position:absolute;top:-8px;right:-7px;z-index:1;padding:0 4px;border:1.5px solid #c09a2c;border-radius:6px;background:#ffd84a;color:#6b4a00;font:10px/1.4 sans-serif;cursor:pointer;}`,
  `${C}-badge${C}-off{background:#d5dbe0;color:#6b7a86;border-color:#a6b0b8;cursor:default;}`,

  `${C}-boxhd{display:flex;align-items:center;justify-content:center;gap:6px;margin-bottom:8px;}`,
  `${C}-nav{display:flex;align-items:center;justify-content:center;width:28px;height:26px;padding:0;border:2px solid #789db7;border-radius:7px;background:#fff;color:#23435f;box-shadow:0 2.5px 0 #466c87;cursor:pointer;}`,
  `${C}-nav svg{width:12px;height:12px;display:block;}`,
  `${C}-boxname{flex:1;max-width:170px;height:26px;padding:0 8px;border:2px solid #789db7;border-radius:7px;background:#fff;color:#23435f;font-size:13px;line-height:22px;text-align:center;box-shadow:0 2.5px 0 #466c87;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}`,
  `${C}-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:4px;padding:6px;border:2px solid #789db7;border-radius:9px;background:linear-gradient(160deg,#eef5fa,#dbe8f2);}`,
  `${C}-bc{display:block;aspect-ratio:1;width:100%;padding:0;border:1.5px solid #a9c2d4;border-radius:7px;background:#fff;overflow:hidden;cursor:pointer;}`,
  `${C}-bc img{display:block;width:100%;height:100%;object-fit:contain;image-rendering:pixelated;transform:scale(1.5);transform-origin:50% 62%;}`,
  `${C}-bce{background:rgba(255,255,255,.45);border-style:dashed;cursor:default;}`,
  `${C}-bc${C}-fnt img{filter:grayscale(1);opacity:.55;}`,
  `${C}-boxn{margin-top:6px;text-align:right;font-size:11px;color:#5d7486;}`,

  `${C}-money{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;padding:6px 10px;border:2px solid #789db7;border-radius:9px;background:#fff;color:#23435f;box-shadow:0 2.5px 0 #466c87;}`,
  `${C}-money span{font-size:12px;color:#5d7486;} ${C}-money b{font-size:14px;color:#14304a;}`,
  `${C}-grp{margin:8px 2px 4px;font-size:11px;color:#5d7486;letter-spacing:.05em;}`,
  `${C}-grp:first-child{margin-top:0;}`,
  `${C}-it{display:flex;align-items:center;gap:7px;width:100%;min-height:34px;margin-bottom:4px;padding:3px 9px 3px 5px;border:2px solid #a9c2d4;border-radius:10px;background:#fff;box-shadow:0 2px 0 #c3d4e1;cursor:pointer;text-align:left;}`,
  `${C}-it:active{transform:translateY(1px);}`,
  `${C}-it${C}-picked{border-color:#315a77;outline-offset:0;}`,
  `${C}-ic{position:relative;flex:none;display:block;width:24px;height:24px;overflow:hidden;}`,
  `${C}-icpr{position:absolute;left:0;top:0;width:32px;height:32px;transform:scale(.75);transform-origin:0 0;}`,
  `${C}-icpr span{position:absolute;display:block;background-image:url("${PR_ITEMS}");background-repeat:no-repeat;image-rendering:pixelated;}`,
  `${C}-icsd{display:block;width:24px;height:24px;background-image:url("${SD_ITEMS}");background-repeat:no-repeat;image-rendering:pixelated;}`,
  `${C}-icdot{display:block;width:14px;height:14px;margin:5px;border-radius:50%;background:#e9b24c;box-shadow:inset 0 0 0 2px #a5741c;}`,
  `${C}-itn{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}`,
  `${C}-itc{flex:none;font-size:12px;color:#3d5a70;}`,
  `${C}-none{padding:16px 6px;text-align:center;color:#8193a1;font-size:12.5px;}`,

  `${C}-win{flex:none;margin:0 9px 10px;padding:7px 10px 6px;border:2.5px solid #23435f;border-radius:9px;background:#fff;box-shadow:0 3px 0 #1a3247;}`,
  `${C}-wt{white-space:pre-line;font-size:13px;color:#14304a;line-height:1.45;}`,
  `${C}-err ${C}-wt{color:#a32634;}`,
  `${C}-opts{display:flex;flex-direction:column;margin-top:5px;padding-top:4px;border-top:1.5px solid #dbe5ec;}`,
  `${C}-opt{position:relative;display:block;width:100%;padding:4px 6px 4px 18px;border:0;border-radius:6px;background:transparent;color:#14304a;font-size:13px;text-align:left;cursor:pointer;}`,
  `${C}-opt:hover{background:#eef4f9;}`,
  `${C}-opt:hover::before{content:"";position:absolute;left:6px;top:50%;margin-top:-4px;border:4px solid transparent;border-left:6px solid #d8434d;}`,
  `${C}-opt${C}-off{color:#a9b5be;cursor:default;}`,
  `${C}-opt${C}-off:hover{background:transparent;}`,
  `${C}-opt${C}-off:hover::before{display:none;}`,

  `@media (max-width:640px){`
    + `${C},${C}${C}-open{top:38%;transform:none;}`
    + `${C}-tab{width:38px;height:38px;} ${C}-tab svg{width:22px;height:22px;}`
    + `${C}-tabs{transition:opacity .2s;} ${C}-open ${C}-tabs{visibility:hidden;opacity:0;}`
    + `${C}-sheet{position:fixed;left:0;right:0;bottom:0;display:flex;flex-direction:column;transform:translateY(100%);transition:transform .2s ease-in,visibility 0s .2s;}`
    + `${C}-open ${C}-sheet{transform:none;transition:transform .2s ease-out;}`
    + `${C}-stabs{display:flex;flex-direction:row;align-items:flex-end;gap:6px;padding:0 0 0 12px;}`
    + `${C}-stabs ${C}-tab:not(${C}-cur){height:33px;}`
    + `${C}-stabs ${C}-tab,${C}-stabs ${C}-tab${C}-cur{width:48px;height:38px;margin:0 0 -2.5px;border:2.5px solid #23435f;border-bottom:0;border-radius:11px 11px 0 0;box-shadow:none;}`
    + `${C}-board{min-height:0;width:100%;max-width:none;max-height:72vh;border-right:0;border-left:0;border-bottom:0;border-radius:14px 14px 0 0;box-shadow:0 -2px 0 #1a3247;}`
    + `${C}-fold svg{transform:rotate(90deg);}`
    + `${C}-win{margin-bottom:calc(10px + env(safe-area-inset-bottom,0px));}`
    + `}`,

  `@media (prefers-reduced-motion:reduce){${C},${C}-sheet,${C}-tabs{transition:none !important;}}`,
].join(' ');

const TABS_CLASS = 'x-risu-pkbp-tabs', SHEET_CLASS = 'x-risu-pkbp-sheet';

export const PANEL_STATES = Object.freeze({ open: 'x-risu-pkbp-open', locked: 'x-risu-pkbp-locked', gone: 'x-risu-pkbp-gone', low: 'x-risu-pkbp-low' });
const shell = (tabs, sheet, states = []) => `<div><style>${CSS}</style><div class="${['x-risu-pkbp', ...states].join(' ')}">`
  + `<div class="${TABS_CLASS}">${tabs}</div><div class="${SHEET_CLASS}">${sheet}</div></div></div>`;

export const panelShell = () => shell('', '', [PANEL_STATES.gone]);

export function renderPanel(model) {
  const hits = [];
  const hit = desc => { hits.push(desc); return `x-risu-pkbp-hit x-risu-pkbp-h${hits.length - 1}`; };
  const cls = (...list) => list.filter(Boolean).join(' ');
  const tabButtons = () => ['party', 'box', 'bag'].map(tab => {
    const cur = model.open && model.tab === tab;
    return `<button type="button" class="${cls('x-risu-pkbp-tab', `x-risu-pkbp-t${tab}`, cur && 'x-risu-pkbp-cur', hit({ t: 'tab', tab }))}" aria-label="${TAB_LABEL[tab]}" title="${TAB_LABEL[tab]}">`
      + `${ICON[tab]}${model.alerts[tab] ? '<span class="x-risu-pkbp-bang">!</span>' : ''}</button>`;
  }).join('');
  const resume = model.resume
    ? `<button type="button" class="${cls('x-risu-pkbp-tab', 'x-risu-pkbp-tresume', hit({ t: 'resume' }))}" aria-label="배틀로 돌아가기" title="배틀로 돌아가기">${ICON.resume}</button>` : '';
  const tabs = tabButtons() + resume;
  const out = [];
  if (model.open) {

    // Horizontal tabs above the sheet on phones (hidden by CSS in wide windows)
    out.push(`<div class="x-risu-pkbp-stabs">${tabButtons()}</div>`);
    const right = model.tab === 'party' ? `${model.party.filter(Boolean).length}/${PARTY_MAX}`
      : model.tab === 'box' ? `${model.box.cells.filter(Boolean).length}/${BOX_SIZE}` : '';
    out.push('<div class="x-risu-pkbp-board">');
    out.push(`<div class="x-risu-pkbp-hd" style="border-bottom-color:${TAB_COLOR[model.tab]}">${ICON[model.tab]}${TAB_LABEL[model.tab]}`
      + `<span class="x-risu-pkbp-hdr">${esc(right)}</span>`
      + `<button type="button" class="${cls('x-risu-pkbp-fold', hit({ t: 'fold' }))}" aria-label="접기" title="접기">${ICON.fold}</button></div>`);
    out.push('<div class="x-risu-pkbp-bd">');
    if (model.tab === 'party') out.push(partyHtml(model, hit));
    else if (model.tab === 'box') out.push(boxHtml(model, hit));
    else out.push(bagHtml(model, hit));
    out.push('</div>');
    if (model.window) out.push(windowHtml(model.window, hit));
    out.push('</div>');
  }
  const sheet = out.join('');
  const states = [model.open && PANEL_STATES.open, model.locked && PANEL_STATES.locked].filter(Boolean);
  return { tabs, sheet, open: !!model.open, locked: !!model.locked, html: shell(tabs, sheet, states), hits };
}

const genderMark = g => (g === 'M' ? '<span class="x-risu-pkbp-g x-risu-pkbp-gm">♂</span>' : g === 'F' ? '<span class="x-risu-pkbp-g x-risu-pkbp-gf">♀</span>' : '');

function partyHtml(model, hit) {
  const cells = model.party.map((slot, i) => {
    if (!slot) return '<div class="x-risu-pkbp-cell"><div class="x-risu-pkbp-empty">빈 칸</div></div>';
    const picked = model.picked === slot.uid;
    const status = slot.fainted ? '<span class="x-risu-pkbp-st x-risu-pkbp-stfnt">기절</span>'
      : slot.status ? `<span class="x-risu-pkbp-st x-risu-pkbp-st${slot.status}">${statusName(slot.status)}</span>` : '';
    const width = slot.maxhp ? Math.round(slot.hp / slot.maxhp * 1000) / 10 : 0;
    const slotHtml = `<button type="button" class="x-risu-pkbp-slot${i === 0 ? ' x-risu-pkbp-lead' : ''}${slot.fainted ? ' x-risu-pkbp-fnt' : ''}${picked ? ' x-risu-pkbp-picked' : ''} ${hit({ t: 'slot', where: 'party', uid: slot.uid })}">`
      + `<span class="x-risu-pkbp-pic"><img src="${esc(SPRITE(slot.spriteId, slot.shiny))}" alt="" loading="lazy"></span>`
      + '<span class="x-risu-pkbp-info">'
      + `<span class="x-risu-pkbp-nm"><span class="x-risu-pkbp-nmt">${esc(slot.name)}</span>${genderMark(slot.gender)}</span>`
      + `<span class="x-risu-pkbp-hpbar"><span class="x-risu-pkbp-hpfill x-risu-pkbp-hp${slot.hpClass}" style="width:${width}%"></span></span>`
      + `<span class="x-risu-pkbp-r"><span>${slot.hp}/${slot.maxhp}${status}</span>`
      + `<span>Lv${slot.level}${slot.item ? '<span class="x-risu-pkbp-held" title="지닌 도구"></span>' : ''}</span></span>`
      + (slot.exp === null ? '' : `<span class="x-risu-pkbp-exp"><span style="width:${Math.round(slot.exp * 1000) / 10}%"></span></span>`)
      + '</span></button>';

    const badge = slot.badge ? (model.locked
      ? `<span class="x-risu-pkbp-badge x-risu-pkbp-off">▲${slot.badge}</span>`
      : `<button type="button" class="x-risu-pkbp-badge ${hit({ t: 'badge', uid: slot.uid })}" aria-label="레벨업 마무리" title="레벨업 마무리">▲${slot.badge}</button>`) : '';
    return `<div class="x-risu-pkbp-cell">${slotHtml}${badge}</div>`;
  });
  return `<div class="x-risu-pkbp-party">${cells.join('')}</div>`;
}

function boxHtml(model, hit) {
  const { box } = model;
  const nav = d => `<button type="button" class="x-risu-pkbp-nav ${hit({ t: 'boxnav', d })}" aria-label="${d < 0 ? '이전 박스' : '다음 박스'}">${d < 0 ? ICON.prev : ICON.next}</button>`;

  const name = () => `<button type="button" class="x-risu-pkbp-boxname ${hit({ t: 'boxname' })}" title="이름 바꾸기">${esc(box.name)}</button>`;
  const head = `<div class="x-risu-pkbp-boxhd">${nav(-1)}${name()}${nav(1)}</div>`;
  const cells = box.cells.map(slot => (slot
    ? `<button type="button" class="x-risu-pkbp-bc${slot.fainted ? ' x-risu-pkbp-fnt' : ''}${model.picked === slot.uid ? ' x-risu-pkbp-picked' : ''} ${hit({ t: 'slot', where: 'box', uid: slot.uid })}" title="${esc(`${slot.name} Lv${slot.level}`)}">`
      + `<img src="${esc(SPRITE(slot.spriteId, slot.shiny))}" alt="" loading="lazy"></button>`
    : '<span class="x-risu-pkbp-bc x-risu-pkbp-bce"></span>'));
  return `${head}<div class="x-risu-pkbp-grid">${cells.join('')}</div><div class="x-risu-pkbp-boxn">${esc(`${box.index + 1} / ${box.count}`)}</div>`;
}

function iconHtml(icon) {
  if (icon?.sheet === 'pokerogue') {
    return `<span class="x-risu-pkbp-ic"><span class="x-risu-pkbp-icpr"><span style="left:${icon.ox}px;top:${icon.oy}px;width:${icon.w}px;height:${icon.h}px;background-position:-${icon.x}px -${icon.y}px"></span></span></span>`;
  }
  if (icon?.sheet === 'showdown') {
    return `<span class="x-risu-pkbp-ic"><span class="x-risu-pkbp-icsd" style="background-position:-${(icon.num % 16) * 24}px -${Math.floor(icon.num / 16) * 24}px"></span></span>`;
  }
  return '<span class="x-risu-pkbp-ic"><span class="x-risu-pkbp-icdot"></span></span>';
}

function bagHtml(model, hit) {
  const { bag } = model;
  const out = [];

  if (bag.money !== null) out.push(`<div class="x-risu-pkbp-money"><span>소지금</span><b>${Number(bag.money).toLocaleString('ko-KR')}원</b></div>`);
  if (!bag.groups.length) out.push('<div class="x-risu-pkbp-none">가방이 비어 있다</div>');
  for (const group of bag.groups) {
    out.push(`<div class="x-risu-pkbp-grp">${esc(group.label)}</div>`);
    for (const item of group.items) {
      out.push(`<button type="button" class="x-risu-pkbp-it${model.picked === item.id ? ' x-risu-pkbp-picked' : ''} ${hit({ t: 'item', item: item.id })}">`
        + `${iconHtml(item.icon)}<span class="x-risu-pkbp-itn">${esc(item.name)}</span><span class="x-risu-pkbp-itc">×${item.count}</span></button>`);
    }
  }
  return out.join('');
}

function windowHtml(win, hit) {
  const options = (win.options ?? []).map(o => (o.disabled
    ? `<button type="button" class="x-risu-pkbp-opt x-risu-pkbp-off" aria-disabled="true">${esc(o.label)}</button>`
    : `<button type="button" class="x-risu-pkbp-opt ${hit(o.hit)}">${esc(o.label)}</button>`));
  return `<div class="x-risu-pkbp-win${win.error ? ' x-risu-pkbp-err' : ''}"><div class="x-risu-pkbp-wt">${esc(win.text)}</div>`
    + (options.length ? `<div class="x-risu-pkbp-opts">${options.join('')}</div>` : '') + '</div>';
}
