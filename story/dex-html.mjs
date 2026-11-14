import { esc } from './card.mjs';
import { say } from './screen-text.mjs';
import { z } from './panel-zoom.mjs';
import { typeBadge, ballBadge } from './panel-screens-html.mjs';

const C = '.x-risu-pkbp';

export const DEX_ICONS = 'https://play.pokemonshowdown.com/sprites/pokemonicons-sheet.png';
const ICON_W = 40, ICON_H = 30, ICON_COLS = 12, SHEET_W = 480, SHEET_H = 4110;

const DEX_LIST_H = 312;
const no3 = n => String(n).padStart(3, '0');
const cls = (...list) => list.filter(Boolean).join(' ');

export function subBarHtml(subs, now, hit, lang) {
  return `<div class="x-risu-pkbp-dxfix"><div class="x-risu-pkbp-seg x-risu-pkbp-dxsub">${subs.map(sub => {
    const label = esc(say(lang, `panel.sub.${sub}`));
    return sub === now ? `<button type="button" class="x-risu-pkbp-on" aria-pressed="true">${label}</button>`
      : `<button type="button" class="${hit({ t: 'sub', sub })}">${label}</button>`;
  }).join('')}</div></div>`;
}

const LAMPS = '<span class="x-risu-pkbp-dxlamps" aria-hidden="true"><i class="x-risu-pkbp-dxlens"></i><i style="background:#ff8a8a"></i><i style="background:#ffd84a"></i><i style="background:#6fd39a"></i></span>';
const ball = lang => `<span class="x-risu-pkbp-dxball" title="${esc(say(lang, 'dex.caughtMark'))}">${ballBadge('pokeball')}</span>`;

const icon = num => `<span class="x-risu-pkbp-dxi" style="background-position:calc(-${(num % ICON_COLS) * ICON_W}px * var(--pkbp-z)) calc(-${Math.floor(num / ICON_COLS) * ICON_H}px * var(--pkbp-z))"></span>`;

export function dexListHtml(view, hit, lang, icons) {
  const t = key => esc(say(lang, key));
  const arrow = d => `<button type="button" class="x-risu-pkbp-dxarr ${hit({ t: 'dexNav', key: view.key, d })}" aria-label="${t(d < 0 ? 'dex.prevDex' : 'dex.nextDex')}" title="${t(d < 0 ? 'dex.prevDex' : 'dex.nextDex')}">${d < 0 ? icons.prev : icons.next}</button>`;
  const top = `<div class="x-risu-pkbp-dxtop">${LAMPS}${arrow(-1)}`
    + `<button type="button" class="x-risu-pkbp-dxplate ${hit({ t: 'dexMode', key: view.key, national: view.national })}">${esc(view.label)}</button>${arrow(1)}</div>`;
  const bar = `<div class="x-risu-pkbp-dxbar"><span>${t('dex.seen')}<b>${view.seen}</b></span><span>${t('dex.caught')}<b>${view.caught}</b></span>`
    + `<span class="x-risu-pkbp-dxof">/ ${view.total}</span></div>`;
  const listKey = view.national ? 'national' : view.key;
  const rows = view.rows.map(row => {
    if (row.section) return `<div class="x-risu-pkbp-dxsec">${esc(row.label)}</div>`;
    const mark = row.state === 'caught' ? ball(lang) : '<span class="x-risu-pkbp-dxnob"></span>';
    const no = `<span class="x-risu-pkbp-dxno">${no3(row.no)}</span>`;
    if (row.state === 'seen') return `<div class="x-risu-pkbp-dxrb x-risu-pkbp-dx-${row.num}">${mark}${no}<span class="x-risu-pkbp-dxbi">${icon(row.num)}</span><span class="x-risu-pkbp-dxn">${esc(row.name)}</span></div>`;
    if (row.state === 'unseen') return `<div class="x-risu-pkbp-dxrb x-risu-pkbp-dxun x-risu-pkbp-dx-${row.num}">${mark}${no}<span class="x-risu-pkbp-dxbi"></span><span class="x-risu-pkbp-dxn">-----</span></div>`;
    return `<button type="button" class="x-risu-pkbp-dxrb x-risu-pkbp-dx-${row.num} ${hit({ t: 'dexRow', num: row.num, name: row.name, key: listKey })}">`
      + `${mark}${no}<span class="x-risu-pkbp-dxbi">${icon(row.num)}</span><span class="x-risu-pkbp-dxn">${esc(row.name)}</span></button>`;
  }).join('');
  return `<div class="x-risu-pkbp-dxdev x-risu-pkbp-dxlist">${top}${bar}<div class="x-risu-pkbp-dxscr">${rows}</div></div>`;
}

export function dexDetailHtml(open, hit, lang, { img, icon: icons, swipe }) {
  const t = key => esc(say(lang, key));
  const fields = [
    open.category ? ['dex.category', esc(open.category)] : null,
    ['dex.type', open.types.map(type => typeBadge(type, lang)).join('')],
    ['dex.height', esc(open.height)], ['dex.weight', esc(open.weight)],
  ].filter(Boolean).map(([key, value]) => `<div class="x-risu-pkbp-dxf"><span>${t(key)}</span><b>${value}</b></div>`).join('');
  const look = d => {
    const to = (open.look + d + open.looks) % open.looks;
    return `<button type="button" class="x-risu-pkbp-dxlk ${hit({ t: 'dexLook', look: to })}" aria-label="${t('dex.look')}" title="${t('dex.look')}">${d < 0 ? icons.prev : icons.next}</button>`;
  };
  const looks = open.looks > 1 ? `<div class="x-risu-pkbp-dxlks">${look(-1)}<span>${open.look + 1}/${open.looks}</span>${look(1)}</div>` : '';
  const step = (d, to) => {
    const label = t(d < 0 ? 'dex.prev' : 'dex.next');
    const inner = d < 0 ? `${icons.prev}<span>${label}</span>` : `<span>${label}</span>${icons.next}`;
    return to ? `<button type="button" class="x-risu-pkbp-dxpg ${hit({ t: 'dexStep', num: to })}">${inner}</button>` : `<span class="x-risu-pkbp-dxpg x-risu-pkbp-off" aria-disabled="true">${inner}</span>`;
  };
  const pane = `<div class="x-risu-pkbp-dxpane ${swipe({ t: 'dexStep', num: open.prev ?? 0 }, { t: 'dexStep', num: open.next ?? 0 })}">`
    + `<span class="x-risu-pkbp-dxbig">${img({ spriteId: open.spriteId, shiny: open.shiny })}</span>${looks}</div>`;
  return `<div class="x-risu-pkbp-dxdev x-risu-pkbp-dxdet" role="dialog" aria-label="${esc(open.name)}">`
    + `<div class="x-risu-pkbp-dxtop"><button type="button" class="x-risu-pkbp-dxback ${hit({ t: 'dexClose' })}" aria-label="${t('panel.sc.back')}" title="${t('panel.sc.back')}">${icons.back}</button>${LAMPS}</div>`
    + `<div class="x-risu-pkbp-dxname">${ball(lang)}<span class="x-risu-pkbp-dxno">No.${no3(open.no)}</span><b>${esc(open.name)}</b>${open.form ? `<small>${esc(open.form)}</small>` : ''}</div>`
    + `<div class="x-risu-pkbp-dxsplit">${pane}<div class="x-risu-pkbp-dxfields">${fields}</div></div>`
    + (open.text ? `<div class="x-risu-pkbp-dxtext">${esc(open.text)}</div>` : '<div class="x-risu-pkbp-dxtext x-risu-pkbp-dxtextno"></div>')
    + `<div class="x-risu-pkbp-dxpager">${step(-1, open.prev)}${step(1, open.next)}</div></div>`;
}

export const DEX_CSS = [

  `${C}-dxfix{flex:none;padding:9px 10px 0;} ${C}-dxfix ${C}-dxsub{margin:0;} ${C}-dxfix + ${C}-bd{padding-top:8px;}`,
  `${C}-seg${C}-dxsub button${C}-on{background:#2f9a6e;box-shadow:0 2px 0 #1f6e4e;}`,
  `${C}-dxsub button{flex:1 1 0;min-width:0;}`,

  `${C}-dxw{position:relative;flex:1 1 ${z(DEX_LIST_H)};min-height:0;display:flex;flex-direction:column;padding:8px 10px 10px;}`,
  `${C}-dxw > ${C}-dxlist{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;}`,
  `${C}-dxov{position:absolute;inset:0;z-index:3;overflow:auto;padding:8px 10px 10px;background:linear-gradient(160deg,#ffffff,#eef5fa);} ${C}-dxov:empty{display:none;}`,
  `${C}-wslot{display:contents;}`,

  `${C}-dxdev{border:2.5px solid #23435f;border-radius:12px;overflow:hidden;background:#d8434d;box-shadow:0 3px 0 #1a3247;}`,
  `${C}-dxtop{flex:none;display:flex;align-items:center;gap:6px;padding:6px 8px;color:#fff;}`,
  `${C}-dxlamps{display:flex;align-items:center;gap:4px;flex:none;margin-right:2px;}`,
  `${C}-dxlamps i{display:block;width:8px;height:8px;border-radius:50%;box-shadow:0 0 0 1.5px #8e2835;}`,
  `${C}-dxlamps ${C}-dxlens{width:18px;height:18px;margin-right:2px;background:radial-gradient(circle at 35% 35%,#e8f6ff 0,#6cc0f0 35%,#2a78b8 100%);box-shadow:0 0 0 2px #fff,0 0 0 3.5px #8e2835;}`,
  `${C}-dxarr,${C}-dxback{flex:none;display:flex;align-items:center;justify-content:center;width:${z(24)};height:${z(24)};padding:0;border:1.5px solid #8e2835;border-radius:7px;background:#fff;color:#a32634;box-shadow:0 1.5px 0 #8e2835;cursor:pointer;}`,
  `${C}-dxarr svg,${C}-dxback svg{display:block;width:${z(11)};height:${z(11)};}`,
  `${C}-dxarr:active,${C}-dxback:active,${C}-dxplate:active{transform:translateY(1px);box-shadow:none;}`,
  `${C}-dxplate{flex:1;min-width:0;height:${z(24)};padding:0 8px;border:1.5px solid #8e2835;border-radius:7px;background:#fff;color:#a32634;font-size:${z(12.5)};box-shadow:0 1.5px 0 #8e2835;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}`,
  `${C}-dxbar{flex:none;display:flex;align-items:baseline;gap:14px;padding:3px 12px 4px;background:#b8323c;color:#ffd9dc;font-size:${z(11.5)};}`,
  `${C}-dxbar b{margin-left:4px;font-weight:400;color:#fff;font-size:${z(13)};} ${C}-dxof{margin-left:auto;font-size:${z(11)};}`,
  `${C}-dxscr{flex:1 1 auto;min-height:0;overflow-y:auto;margin:0 6px 6px;border:2px solid #8e2835;border-radius:8px;background:#fff;}`,

  `${C}-dxrb{position:relative;display:flex;align-items:center;gap:6px;width:100%;min-height:${z(31)};padding:1px 10px 1px 16px;border:0;border-radius:0;background:#fff;color:#14304a;font-size:${z(13)};text-align:left;}`,
  `button${C}-dxrb{cursor:pointer;} button${C}-dxrb:active{background:#fff1c9;}`,
  `${C}-dxrb:nth-child(even){background:#f3f7fa;} ${C}-dxrb + ${C}-dxrb{border-top:1px solid #e3eaf0;}`,
  `${C}-dxball,${C}-dxnob{flex:none;display:inline-flex;align-items:center;width:${z(18)};} ${C}-dxball ${C}-ball{margin:0;}`,
  `${C}-dxno{flex:none;width:${z(32)};font-size:${z(12)};color:#5d7486;}`,
  `${C}-dxbi{flex:none;display:flex;align-items:center;justify-content:center;width:${z(ICON_W)};height:${z(ICON_H - 4)};overflow:hidden;}`,
  `${C}-dxi{flex:none;display:block;width:${z(ICON_W)};height:${z(ICON_H)};background:url("${DEX_ICONS}") no-repeat;background-size:${z(SHEET_W)} ${z(SHEET_H)};image-rendering:pixelated;}`,
  `${C}-dxn{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}`,

  `${C}-dxsec{display:flex;align-items:center;gap:8px;min-height:${z(31)};padding:0 12px;border-top:1px solid #e3eaf0;background:#fbe9ea;color:#a32634;font-size:${z(11.5)};letter-spacing:.04em;}`,
  `${C}-dxsec::before,${C}-dxsec::after{content:"";flex:1;height:1px;background:#e3b3b8;}`,
  `${C}-dxun{color:#a9b5be;} ${C}-dxun ${C}-dxno{color:#c0cad2;} ${C}-dxun ${C}-dxn{letter-spacing:.18em;}`,

  `${C}-dxname{display:flex;align-items:center;gap:7px;margin:0 6px;padding:6px 10px 5px;border:2px solid #8e2835;border-bottom:0;border-radius:8px 8px 0 0;background:#fff;color:#14304a;}`,
  `${C}-dxname b{font-weight:400;font-size:${z(15)};white-space:nowrap;} ${C}-dxname ${C}-dxno{width:auto;} ${C}-dxname small{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:${z(11)};color:#5d7486;}`,
  `${C}-dxsplit{display:flex;gap:8px;margin:0 6px;padding:0 8px 8px;border:2px solid #8e2835;border-top:1.5px dashed #e3b9bd;border-bottom:0;background:#fff;}`,
  `${C}-dxpane{flex:none;position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;width:${z(104)};min-height:${z(104)};margin-top:8px;border:2px solid #23435f;border-radius:8px;`
    + `background-color:#e7f1f8;background-image:linear-gradient(#d4e3ee 1px,transparent 1px),linear-gradient(90deg,#d4e3ee 1px,transparent 1px);background-size:10px 10px;}`,
  `${C}-dxbig{display:block;width:${z(88)};height:${z(88)};} ${C}-dxbig img{display:block;width:100%;height:100%;object-fit:contain;image-rendering:pixelated;}`,
  `${C}-dxlks{display:flex;align-items:center;gap:4px;margin:0 0 3px;font-size:${z(10.5)};color:#5d7486;}`,
  `${C}-dxlk{display:flex;align-items:center;justify-content:center;width:${z(18)};height:${z(18)};padding:0;border:1.5px solid #789db7;border-radius:5px;background:#fff;color:#23435f;cursor:pointer;}`,
  `${C}-dxlk svg{display:block;width:${z(8)};height:${z(8)};}`,
  `${C}-dxfields{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;padding-top:6px;}`,
  `${C}-dxf{display:flex;align-items:center;gap:6px;min-height:${z(24)};border-bottom:1.5px dotted #d4dfe7;font-size:${z(12.5)};}`,
  `${C}-dxf span{flex:none;width:${z(44)};color:#b8323c;font-size:${z(11)};} ${C}-dxf b{display:flex;gap:4px;flex-wrap:wrap;min-width:0;font-weight:400;color:#14304a;}`,
  `${C}-dxtext{margin:0 6px;padding:8px 11px;border:2px solid #8e2835;border-radius:0 0 8px 8px;background:#fff;color:#14304a;font-size:${z(13)};line-height:1.55;word-break:keep-all;`
    + `box-shadow:inset 0 0 0 2px #fff,inset 0 0 0 3.5px #23435f;}`,
  `${C}-dxtextno{padding:0;min-height:6px;box-shadow:none;}`,
  `${C}-dxpager{display:flex;justify-content:space-between;padding:6px 8px 7px;}`,
  `${C}-dxpg{display:flex;align-items:center;gap:4px;height:${z(24)};padding:0 9px;border:1.5px solid #8e2835;border-radius:7px;background:#fff;color:#a32634;font-size:${z(12)};box-shadow:0 1.5px 0 #8e2835;cursor:pointer;}`,
  `${C}-dxpg svg{display:block;width:${z(9)};height:${z(9)};} ${C}-dxpg${C}-off{opacity:.45;cursor:default;box-shadow:none;}`,
].join(' ');
