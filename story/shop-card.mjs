import { esc, safeKey } from './card.mjs';
import { hashKey } from './blocks.mjs';
import { moneyAmount } from './diary.mjs';
import { say } from './screen-text.mjs';
import { PR_ITEMS, SD_ITEMS } from './panel-html.mjs';

export const SHOP_MS = Object.freeze({ grow: 320, fold: 220, paid: 800 });

export const CART_MAX = 99;

export const cartMost = (mode, row) => (mode === 'sell' ? row?.owned ?? 0 : row?.limited ? 1 : CART_MAX);

export const SPECIAL_TAB = 'special';

const ROW_H = 41;

const LOOKS = { mart: ['#2f7fc1', '#1d5689'], department: ['#6b3594', '#3f1a5c'] };
const kindOf = kind => (Object.hasOwn(LOOKS, kind) ? kind : 'mart');

export const shopName = (block, lang) => block?.name || say(lang, `shop.kind.${kindOf(block?.kind)}`);

export const regionName = (region, lang) => (region && /^[a-z]+$/.test(region) ? (() => { try { return say(lang, `region.${region}`); } catch { return ''; } })() : '');

const ICON_SHOP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="x-risu-pkb-shwall" d="M4 10.5V20h16v-9.5" fill="#fff" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>'
  + '<path class="x-risu-pkb-shaw" d="M3 4.5h18l1 4.2a2.6 2.6 0 0 1-5 .8 2.6 2.6 0 0 1-5 0 2.6 2.6 0 0 1-5 0 2.6 2.6 0 0 1-5-.8z" fill="#2f7fc1" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>'
  + '<path d="M10 20v-5.2h4V20" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
const ICON_FOLD = '<svg viewBox="0 0 10 10" aria-hidden="true"><path stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none" d="M1.5 6.8 5 3.2l3.5 3.6"/></svg>';
const ICON_CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle class="x-risu-pkb-shpc" cx="12" cy="12" r="10.5"/><path class="x-risu-pkb-shpk" d="M7 12.4l3.3 3.3L17.2 8.8"/></svg>';

function btn(key, action, inner, { cls = '', label = '', item = '', off = false } = {}) {
  return `<button type="button" class="x-risu-pkb-btn${cls ? ` ${cls}` : ''} x-risu-pkbk-${safeKey(key)} x-risu-pkba-${action}${item ? ` x-risu-pkbs-${safeKey(item)}` : ''} x-risu-pkbi-{{chat_index}}"`
    + `${label ? ` aria-label="${esc(label)}" title="${esc(label)}"` : ''}${off ? ' disabled' : ''}>${inner}</button>`;
}

function itemPicture(icon) {
  if (icon?.sheet === 'pokerogue') {
    return `<span class="x-risu-pkb-shic"><span class="x-risu-pkb-shicpr"><span style="left:${icon.ox}px;top:${icon.oy}px;width:${icon.w}px;height:${icon.h}px;background-position:-${icon.x}px -${icon.y}px"></span></span></span>`;
  }
  if (icon?.sheet === 'showdown') {
    return `<span class="x-risu-pkb-shic"><span class="x-risu-pkb-shicsd" style="background-position:-${(icon.num % 16) * 24}px -${Math.floor(icon.num / 16) * 24}px"></span></span>`;
  }
  return '<span class="x-risu-pkb-shic"><span class="x-risu-pkb-shicdot"></span></span>';
}

function itemRow(view, row, lang) {
  const count = row.count ?? 0, max = cartMost(view.mode, row);
  if (row.soldOut) {
    return `<div class="x-risu-pkb-shit x-risu-pkb-shout">${itemPicture(row.icon)}<span class="x-risu-pkb-shn">${esc(row.name)}</span>`
      + `<span class="x-risu-pkb-shp">${esc(moneyAmount(row.price, lang))}</span><span class="x-risu-pkb-shsold">${esc(say(lang, 'shop.soldOut'))}</span></div>`;
  }
  return `<div class="x-risu-pkb-shit${count ? ' x-risu-pkb-shon' : ''}">${itemPicture(row.icon)}<span class="x-risu-pkb-shn">${esc(row.name)}</span>`
    + (view.mode === 'sell' ? `<span class="x-risu-pkb-show">×${esc(row.owned)}</span>` : '')
    + (row.was ? `<span class="x-risu-pkb-shsale">SALE</span><s class="x-risu-pkb-shwas">${esc(moneyAmount(row.was, lang))}</s>` : '')
    + `<span class="x-risu-pkb-shp${row.was ? ' x-risu-pkb-shpsale' : ''}">${esc(moneyAmount(row.price, lang))}</span><span class="x-risu-pkb-shq">`
    + btn(view.key, 'shopsub', '−', { cls: 'x-risu-pkb-shqb', item: row.id, label: say(lang, 'shop.less'), off: !count })
    + `<span class="x-risu-pkb-shc">${count}</span>`
    + btn(view.key, 'shopadd', '+', { cls: 'x-risu-pkb-shqb', item: row.id, label: say(lang, 'shop.more'), off: count >= max })
    + '</span></div>';
}

function modeSwitch(view, lang) {
  const side = mode => (view.mode === mode
    ? `<span class="x-risu-pkb-shmd x-risu-pkb-shmd-${mode} x-risu-pkb-shmdon">${esc(say(lang, `shop.mode.${mode}`))}</span>`
    : btn(view.key, mode === 'buy' ? 'shopbuy' : 'shopsell', esc(say(lang, `shop.mode.${mode}`)), { cls: `x-risu-pkb-shmd x-risu-pkb-shmd-${mode}` }));
  return `<div class="x-risu-pkb-shmode">${side('buy')}${side('sell')}</div>`;
}

function tabRow(view, lang) {
  const tabs = view.tabs ?? [];
  if (!tabs.length) return '';
  return `<div class="x-risu-pkb-shtabs">${tabs.map(tab => {
    const special = tab.id === SPECIAL_TAB;
    const label = `${esc(say(lang, special ? 'shop.tab.special' : `panel.group.${tab.id}`))}${tab.dot ? '<span class="x-risu-pkb-shdot"></span>' : ''}`;
    const cls = `x-risu-pkb-shtab${special ? ' x-risu-pkb-shtabsp' : ''}`;
    return tab.id === view.tab ? `<span class="${cls} x-risu-pkb-shtabon">${label}</span>` : btn(view.key, 'shoptab', label, { cls, item: tab.id });
  }).join('')}</div>`;
}

function cartRow(view, lang) {
  const t = key => esc(say(lang, key));
  const sell = view.mode === 'sell';
  const why = view.why && view.why !== 'empty' ? `<div class="x-risu-pkb-shwhy x-risu-pkb-shbad">${t(`shop.why.${view.why}`)}</div>` : '';
  const bonus = !sell && view.bonus ? `<span class="x-risu-pkb-shbonus">${esc(say(lang, 'shop.bonus', { n: view.bonus }))}</span>` : '';
  const act = view.paid
    ? `<span class="x-risu-pkb-shpaid x-risu-pkb-shpaid-${sell ? 'sell' : 'buy'}">${ICON_CHECK}</span>`
    : btn(view.key, 'shoppay', t(sell ? 'shop.paySell' : 'shop.payBuy'), { cls: `x-risu-pkb-shpay x-risu-pkb-shpay-${sell ? 'sell' : 'buy'}`, off: !!view.why });
  return `<div class="x-risu-pkb-shcart"><div class="x-risu-pkb-shsum"><div class="x-risu-pkb-shtot"><span>${t(sell ? 'shop.gain' : 'shop.total')}</span>`
    + `<b>${esc(`${sell && view.total ? '+' : ''}${moneyAmount(view.total ?? 0, lang)}`)}</b>${bonus}</div>${why}</div><div class="x-risu-pkb-act">${act}</div></div>`;
}

const note = n => (n ? `<div class="x-risu-pkb-note x-risu-pkb-note-${n.kind}">${esc(n.text).replaceAll('\n', '<br>')}</div>` : '');

// What an open card shows that a payment depends on (its prices, the cart's total, the Premier Ball bonus), as a class on
// its body: plugin/battle/shop-card.js pays only while the card on screen carries the signature of now
export const shownSelector = (key, shown) => `.x-risu-pkbsb-${safeKey(key)}.x-risu-pkbsg-${hashKey(JSON.stringify(shown))}`;

export function renderShopInside(view, lang) {
  const t = key => esc(say(lang, key));
  const phase = view.phase ?? 'closed';
  const look = phase === 'past' ? 'locked' : `sh${kindOf(view.kind)}`;
  const open = phase === 'open';
  const fold = open ? btn(view.key, 'shopout', ICON_FOLD, { cls: 'x-risu-pkb-x x-risu-pkb-shfold', label: say(lang, 'shop.close') }) : '';
  const head = `<div class="x-risu-pkb-hd"><span class="x-risu-pkb-shhdi">${ICON_SHOP}</span><span class="x-risu-pkb-hdt">${t(phase === 'past' ? 'shop.band.past' : 'shop.band')}</span>${fold}</div>`;
  const subParts = [view.name ? say(lang, `shop.kind.${kindOf(view.kind)}`) : '', regionName(view.region, lang)].filter(Boolean);
  const sub = subParts.length ? `<div class="x-risu-pkb-sub x-risu-pkb-shsub">${esc(subParts.join(' · '))}</div>` : '';
  let right = '';
  if (phase === 'closed') right = view.buttonsOff ? '' : `<div class="x-risu-pkb-act">${btn(view.key, 'shopin', t('shop.enter'), { cls: 'x-risu-pkb-shgo' })}</div>`;
  else if (open && view.money != null) right = `<div class="x-risu-pkb-shm"><span>${t('panel.money')}</span><b>${esc(moneyAmount(view.money, lang))}</b></div>`;
  const top = `<div class="x-risu-pkb-bd"><span class="x-risu-pkb-shtile">${ICON_SHOP}</span><div class="x-risu-pkb-info"><div class="x-risu-pkb-title"><span class="x-risu-pkb-name">${esc(shopName(view, lang))}</span></div>${sub}</div>${right}</div>`;
  let shop = '';
  if (open) {
    const rows = view.rows ?? [];
    const list = rows.length ? rows.map(row => itemRow(view, row, lang)).join('') : `<div class="x-risu-pkb-shnone">${t('shop.sellNone')}</div>`;
    const fill = Math.max(1, view.fill ?? rows.length);
    const body = `${modeSwitch(view, lang)}${tabRow(view, lang)}<div class="x-risu-pkb-shlist${view.tab === SPECIAL_TAB ? ' x-risu-pkb-shlistsp' : ''}" style="min-height:${fill * ROW_H - 5}px">${list}</div>${cartRow(view, lang)}${note(view.note)}`;
    const signed = view.shown ? ` x-risu-pkbsg-${hashKey(JSON.stringify(view.shown))}` : '';
    shop = `<div class="x-risu-pkb-shbody${view.grow ? ' x-risu-pkb-shgrow' : ''} x-risu-pkbsb-${safeKey(view.key)}${signed}"><div class="x-risu-pkb-shin">${body}</div></div>`;
  }
  return `<div class="x-risu-pkb-box x-risu-pkb-l-${look}">${head}${top}${shop}</div>`;
}

export const renderShopCard = (view, lang) => `\n\n<div class="x-risu-pkb-card x-risu-pkb-shop x-risu-pkbsh-${safeKey(view.key)}">${renderShopInside(view, lang)}</div>\n\n`;

const BUY = ['#e84d4d', '#922837'], SELL = ['#169c8c', '#0c6359'], ENTER = ['#2f7fc1', '#1d5689'], GOLD = '#d2a641';
export const SHOP_CSS = [
  ...Object.entries(LOOKS).map(([kind, [band, edge]]) => `.x-risu-pkb-l-sh${kind}{--pkb-band:${band};--pkb-edge:${edge};}`),

  `.x-risu-pkb-shhdi{display:flex;flex:none;width:17px;height:17px;color:#fff;}`,
  `.x-risu-pkb-shtile .x-risu-pkb-shaw{fill:var(--pkb-band);}`,
  `.x-risu-pkb-shhdi .x-risu-pkb-shaw{fill:rgba(255,255,255,.3);}`,
  `.x-risu-pkb-shhdi .x-risu-pkb-shwall{fill:none;}`,
  `.x-risu-pkb-shhdi svg,.x-risu-pkb-shtile svg{display:block;width:100%;height:100%;}`,
  `.x-risu-pkb-l-locked .x-risu-pkb-shhdi,.x-risu-pkb-l-locked .x-risu-pkb-shtile{filter:grayscale(1);opacity:.75;}`,
  `.x-risu-pkb-shtile{display:flex;flex:none;width:46px;height:46px;padding:7px;border:1.5px solid #8fb0c8;border-radius:10px;background:#dbe8f2;color:#23435f;}`,
  `.x-risu-pkb-shsub{color:#7b8c99;}`,

  `.x-risu-pkb-l-shdepartment{border-color:#4a2268;background:linear-gradient(150deg,#fffdf6,#f6eefb 60%,#efe3f6);box-shadow:0 4px 0 #2e1242,inset 0 0 0 1.5px ${GOLD};}`,
  `.x-risu-pkb-l-shdepartment .x-risu-pkb-hd{position:relative;background:linear-gradient(100deg,#4d2270,#7d3fa6 45%,#5a2a80);border-bottom:3px solid ${GOLD};box-shadow:inset 0 -1.5px 0 #f3d98a;}`,
  `.x-risu-pkb-l-shdepartment .x-risu-pkb-hd::before{content:"";position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(135deg,rgba(255,224,140,.13) 0 2px,transparent 2px 9px);}`,
  `.x-risu-pkb-l-shdepartment .x-risu-pkb-hdt{position:relative;color:#fff7dc;}`,
  `.x-risu-pkb-l-shdepartment .x-risu-pkb-hdt::after{content:" ✦";color:${GOLD};}`,
  `.x-risu-pkb-l-shdepartment .x-risu-pkb-shtile{border:2px solid ${GOLD};background:linear-gradient(145deg,#fff6dd,#f1e2b8);box-shadow:inset 0 0 0 1.5px #fffaf0;}`,
  `.x-risu-pkb-l-shdepartment .x-risu-pkb-title{color:#3f1a5c;}`,
  `.x-risu-pkb-l-shdepartment .x-risu-pkb-shit{border-color:#e2d3ec;}`,
  `.x-risu-pkb-l-shdepartment .x-risu-pkb-shcart{border-top-color:#e4cf98;}`,

  `.x-risu-pkb-hd .x-risu-pkb-btn.x-risu-pkb-shfold{position:relative;color:var(--pkb-band);}`,

  `.x-risu-pkb-btn.x-risu-pkb-shgo{background:${ENTER[0]};border-color:${ENTER[1]};box-shadow:0 3px 0 ${ENTER[1]};}`,
  `.x-risu-pkb-btn.x-risu-pkb-shgo:active{box-shadow:0 1px 0 ${ENTER[1]};}`,

  `.x-risu-pkb-shm{display:flex;flex:none;flex-direction:column;align-items:flex-end;margin-left:auto;font-size:11px;line-height:1.3;color:#5d7486;}`,
  `.x-risu-pkb-shm b{font-weight:400;font-size:15px;color:#14304a;white-space:nowrap;}`,

  `.x-risu-pkb-shbody{display:grid;grid-template-rows:1fr;grid-template-columns:minmax(0,1fr);}`,
  `.x-risu-pkb-shin{min-width:0;min-height:0;overflow:hidden;}`,
  `.x-risu-pkb-shgrow{animation:x-risu-pkbshgrow ${SHOP_MS.grow / 1000}s ease-out;}`,
  `.x-risu-pkb-shgone{animation:x-risu-pkbshfold ${SHOP_MS.fold / 1000}s ease-in forwards;}`,
  `@keyframes x-risu-pkbshgrow{from{grid-template-rows:0fr;opacity:.2;} to{grid-template-rows:1fr;opacity:1;} }`,
  `@keyframes x-risu-pkbshfold{from{grid-template-rows:1fr;opacity:1;} to{grid-template-rows:0fr;opacity:0;} }`,

  `.x-risu-pkb-shmode{display:flex;margin:0 12px 8px;padding:3px;border:2px solid #b9cbd9;border-radius:11px;background:#eef3f7;}`,
  `.x-risu-pkb-shmd,.x-risu-pkb-btn.x-risu-pkb-shmd{flex:1 1 0;display:flex;align-items:center;justify-content:center;min-width:0;height:30px;margin:0;padding:0 6px;border:0;border-radius:8px;background:transparent;box-shadow:none;color:#5d7486;font-size:13.5px;}`,
  `.x-risu-pkb-btn.x-risu-pkb-shmd:active{transform:none;box-shadow:none;}`,
  `.x-risu-pkb-shmdon{color:#fff;box-shadow:0 2px 0 rgba(0,0,0,.25);}`,
  `.x-risu-pkb-shmdon.x-risu-pkb-shmd-buy{background:${BUY[0]};}`,
  `.x-risu-pkb-shmdon.x-risu-pkb-shmd-sell{background:${SELL[0]};}`,

  `.x-risu-pkb-shtabs{display:flex;flex-wrap:nowrap;gap:4px;margin:0 12px;overflow-x:auto;overflow-y:hidden;scrollbar-width:thin;border-bottom:2px solid #c9d9e5;}`,
  `.x-risu-pkb-shtab,.x-risu-pkb-btn.x-risu-pkb-shtab{position:relative;flex:none;display:flex;align-items:center;gap:4px;width:auto;min-width:0;margin:0 0 -2px;padding:6px 10px 5px;border:2px solid transparent;border-bottom:0;border-radius:8px 8px 0 0;background:transparent;box-shadow:none;color:#6a8193;font-size:12.5px;white-space:nowrap;}`,
  `.x-risu-pkb-btn.x-risu-pkb-shtab:active{transform:none;box-shadow:none;}`,
  `.x-risu-pkb-shtabon{border-color:#c9d9e5;background:#fff;color:#14304a;box-shadow:0 2px 0 #fff;}`,
  `.x-risu-pkb-shdot{display:inline-block;flex:none;width:7px;height:7px;border-radius:50%;background:#e8584d;}`,
  `.x-risu-pkb-shlist{display:flex;flex-direction:column;gap:5px;padding:9px 12px 10px;}`,

  `.x-risu-pkb-shtab.x-risu-pkb-shtabsp,.x-risu-pkb-btn.x-risu-pkb-shtab.x-risu-pkb-shtabsp{color:#9a6a12;}`,
  `.x-risu-pkb-shtabsp.x-risu-pkb-shtabon{border-color:#e6cf8f;background:#fffaf0;box-shadow:0 2px 0 #fffaf0;}`,
  `.x-risu-pkb-shlistsp{background:linear-gradient(180deg,#fffaf0,#fbf3dc);}`,
  `.x-risu-pkb-shlistsp .x-risu-pkb-shit{border-color:#ecdcb0;}`,
  `.x-risu-pkb-shlistsp .x-risu-pkb-shon{border-color:#c99a2e;background:#fffdf6;}`,
  `.x-risu-pkb-shout{opacity:.6;filter:grayscale(.8);}`,
  `.x-risu-pkb-shsold{flex:none;width:80px;text-align:center;padding:2px 0;border:1.5px solid #b9c3cb;border-radius:7px;color:#6b7a86;font-size:12px;}`,
  `.x-risu-pkb-shnone{padding:12px 4px;text-align:center;font-size:12.5px;color:#8193a1;}`,
  `.x-risu-pkb-shit{display:flex;align-items:center;gap:7px;min-height:36px;padding:3px 5px 3px 6px;border:2px solid #c9d9e5;border-radius:10px;background:#fff;}`,
  `.x-risu-pkb-shon{border-color:#4383ae;background:#f4f9fd;}`,
  `.x-risu-pkb-shic{position:relative;flex:none;display:block;width:24px;height:24px;overflow:hidden;}`,
  `.x-risu-pkb-shicpr{position:absolute;left:0;top:0;width:32px;height:32px;transform:scale(.75);transform-origin:0 0;}`,
  `.x-risu-pkb-shicpr span{position:absolute;display:block;background-image:url("${PR_ITEMS}");background-repeat:no-repeat;image-rendering:pixelated;}`,
  `.x-risu-pkb-shicsd{display:block;width:24px;height:24px;background-image:url("${SD_ITEMS}");background-repeat:no-repeat;image-rendering:pixelated;}`,
  `.x-risu-pkb-shicdot{display:block;width:14px;height:14px;margin:5px;border-radius:50%;background:#e9b24c;box-shadow:inset 0 0 0 2px #a5741c;}`,
  `.x-risu-pkb-shn{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;color:#14304a;}`,
  `.x-risu-pkb-show{flex:none;font-size:11px;color:#7b8c99;}`,
  `.x-risu-pkb-shp{flex:none;margin-left:auto;font-size:12.5px;color:#3d5a70;white-space:nowrap;}`,

  `.x-risu-pkb-shsale{flex:none;margin-left:auto;padding:0 4px;border-radius:4px;background:#e8484d;color:#fff;font-size:9.5px;line-height:15px;letter-spacing:.03em;}`,
  `.x-risu-pkb-shwas{flex:none;font-size:11px;color:#98a6b1;white-space:nowrap;}`,
  `.x-risu-pkb-shsale ~ .x-risu-pkb-shp{margin-left:0;}`,
  `.x-risu-pkb-shpsale{color:#d2353d;}`,
  `.x-risu-pkb-shq{display:flex;flex:none;align-items:center;gap:2px;}`,
  `.x-risu-pkb-btn.x-risu-pkb-shqb{width:26px;height:26px;padding:0;border:2px solid #4383ae;border-radius:7px;background:#fff;color:#23435f;font-size:15px;line-height:1;box-shadow:0 2px 0 #23435f;}`,
  `.x-risu-pkb-btn.x-risu-pkb-shqb:active{transform:translateY(1.5px);box-shadow:0 .5px 0 #23435f;}`,
  `.x-risu-pkb-shc{display:inline-block;min-width:24px;text-align:center;font-size:13px;color:#14304a;}`,
  `.x-risu-pkb-btn:disabled{cursor:default;filter:none;transform:none;color:#8d98a1;background:#eef1f3;border-color:#b9c3cb;box-shadow:0 3px 0 #b9c3cb;}`,
  `.x-risu-pkb-btn.x-risu-pkb-shqb:disabled{box-shadow:0 2px 0 #c9d1d8;}`,

  `.x-risu-pkb-shcart{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin:0 12px 11px;padding-top:10px;border-top:2px dashed #c9d9e5;}`,
  `.x-risu-pkb-shsum{flex:1 1 0;min-width:0;}`,
  `.x-risu-pkb-shtot{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 8px;font-size:12px;color:#5d7486;}`,
  `.x-risu-pkb-shtot b{font-weight:400;font-size:17px;color:#14304a;white-space:nowrap;}`,
  `.x-risu-pkb-shbonus{padding:0 7px;border-radius:999px;font-size:11px;line-height:18px;color:#7d5310;background:#fbf0d9;box-shadow:inset 0 0 0 1.5px #e0c48a;white-space:nowrap;}`,
  `.x-risu-pkb-shwhy{margin-top:2px;font-size:11px;color:#8193a1;}`,
  `.x-risu-pkb-shbad{color:#c8303b;}`,
  ...[['buy', BUY], ['sell', SELL]].flatMap(([mode, [fill, edge]]) => [
    `.x-risu-pkb-btn.x-risu-pkb-shpay-${mode}:not(:disabled){background:${fill};border-color:${edge};box-shadow:0 3px 0 ${edge};}`,
    `.x-risu-pkb-btn.x-risu-pkb-shpay-${mode}:not(:disabled):active{box-shadow:0 1px 0 ${edge};}`,
    `.x-risu-pkb-shpaid-${mode}{--pkb-paid:${fill};}`,
  ]),

  `.x-risu-pkb-shpaid{display:flex;align-items:center;justify-content:center;width:100%;height:36px;}`,
  `.x-risu-pkb-shpaid svg{display:block;width:32px;height:32px;animation:x-risu-pkbshpop .32s cubic-bezier(.2,1.6,.4,1) both;}`,
  `.x-risu-pkb-shpc{fill:var(--pkb-paid);}`,
  `.x-risu-pkb-shpk{fill:none;stroke:#fff;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:16;stroke-dashoffset:16;animation:x-risu-pkbshtick .3s .2s ease-out forwards;}`,
  `@keyframes x-risu-pkbshpop{from{transform:scale(.2);opacity:0;} to{transform:none;opacity:1;} }`,
  `@keyframes x-risu-pkbshtick{to{stroke-dashoffset:0;} }`,
  `.x-risu-pkb-shop .x-risu-pkb-note{margin:0 12px 11px;}`,
  `@container (max-width:380px){`
    + `.x-risu-pkb-shcart .x-risu-pkb-act{width:100%;}`
    + ` .x-risu-pkb-shlist{padding:8px 9px 9px;}`
    + ` .x-risu-pkb-shcart,.x-risu-pkb-shmode{margin-left:9px;margin-right:9px;}`
    + ` .x-risu-pkb-shtabs{margin:0 9px;gap:2px;}`
    + ` .x-risu-pkb-shtab,.x-risu-pkb-btn.x-risu-pkb-shtab{padding:6px 7px 5px;font-size:12px;}`
    + ` }`,
].join(' ');
