import { esc, FONT } from './card.mjs';
import { statusShort, PARTY_MAX, BOX_SIZE } from './panel.mjs';
import { say } from './screen-text.mjs';
import { moneyText } from './diary.mjs';
import { COMPAT_TABS } from './compat.mjs';
import { EGG_SPRITE } from '../engine/breeding.mjs';
import { POKEAPI_BASE } from '../view/sprites/sources.js';
import { genderMarkSvg, textGenderSigns, nameShowsGender } from '../view/gender-mark.js';
import { badgeCaseHtml, BADGE_CSS } from './badge-case-html.mjs';
import { BASE_TEXT, z } from './panel-zoom.mjs';
import { screenCss, screenHtml, screenSheets } from './panel-screens-html.mjs';
import { ringSvg, RING_ICON, RING_COLOR } from './gauge-ring.mjs';
import { ENJOY_MAX } from './amie.mjs';

export const panelSpriteUrl = (id, shiny) => (id === EGG_SPRITE ? `${POKEAPI_BASE}egg.png`
  : `https://play.pokemonshowdown.com/sprites/gen5${shiny ? '-shiny' : ''}/${encodeURIComponent(id)}.png`);

const directPicture = slot => slot.url ?? panelSpriteUrl(slot.spriteId, slot.shiny);

const monImg = src => `<img${src === null ? '' : ` src="${esc(src)}"`} alt="" loading="lazy">`;

const PR_BASE = 'https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/37789817134f881da0a038af21991ccc93a66372/';
const PR_ITEMS = `${PR_BASE}images/items.png`;
const SD_ITEMS = 'https://play.pokemonshowdown.com/sprites/itemicons-sheet.png';

export const ICON = {
  // Poke Ball for the party tab; box and bag icons
  party: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#fff" stroke="#23435f" stroke-width="2"/>'
    + '<path d="M2 12a10 10 0 0 1 20 0z" fill="#e84d4d" stroke="#23435f" stroke-width="2"/><circle cx="12" cy="12" r="3.2" fill="#fff" stroke="#23435f" stroke-width="2"/></svg>',
  box: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10h16v9.3a1.7 1.7 0 0 1-1.7 1.7H5.7A1.7 1.7 0 0 1 4 19.3z" fill="#d6e6f2" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>'
    + '<path d="M2.6 5.6A1.6 1.6 0 0 1 4.2 4h15.6a1.6 1.6 0 0 1 1.6 1.6V10H2.6z" fill="#7fa6c4" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>'
    + '<path d="M9.3 14h5.4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="7" r="1.2" fill="currentColor"/></svg>',
  bag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6.2V4.8A1.8 1.8 0 0 1 10.8 3h2.4A1.8 1.8 0 0 1 15 4.8v1.4" fill="none" stroke="currentColor" stroke-width="2"/>'
    + '<path d="M4.6 9.8A3.6 3.6 0 0 1 8.2 6.2h7.6a3.6 3.6 0 0 1 3.6 3.6v9.1a2.1 2.1 0 0 1-2.1 2.1H6.7a2.1 2.1 0 0 1-2.1-2.1z" fill="#e9b24c" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>'
    + '<path d="M4.6 12h14.8" stroke="currentColor" stroke-width="2"/><rect x="10" y="10.2" width="4" height="4" rx="1" fill="#fff" stroke="currentColor" stroke-width="1.7"/>'
    + '<path d="M8 16.4v2.4M16 16.4v2.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',

  amie: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11.5 20.6l-7.2-7A4.5 4.5 0 0 1 11.5 7.2a4.5 4.5 0 0 1 7.2 6.4z" fill="#fff" stroke="#23435f" stroke-width="2" stroke-linejoin="round"/>'
    + '<path d="M19.6 1.8l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" fill="#fff" stroke="#23435f" stroke-width="1" stroke-linejoin="round"/></svg>',

  badges: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 13.5L5.5 22l3.8-1.8L12 23l1-9.5zM16 13.5l2.5 8.5-3.8-1.8L12 23l-1-9.5z" fill="#d8434d" stroke="#23435f" stroke-width="1.5" stroke-linejoin="round"/>'
    + '<circle cx="12" cy="9.5" r="7.5" fill="#ffd84a" stroke="#23435f" stroke-width="2"/><path d="M12 5.2l1.3 2.8 3 .3-2.3 2 .7 3-2.7-1.6-2.7 1.6.7-3-2.3-2 3-.3z" fill="#fff" stroke="#23435f" stroke-width="1" stroke-linejoin="round"/></svg>',

  travel: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.6" fill="#fff" stroke="#23435f" stroke-width="2"/>'
    + '<path d="M12 4.6l2.7 7.4H9.3z" fill="#d8434d" stroke="#23435f" stroke-width="1.4" stroke-linejoin="round"/>'
    + '<path d="M12 19.4l-2.7-7.4h5.4z" fill="#cfe0ec" stroke="#23435f" stroke-width="1.4" stroke-linejoin="round"/><circle cx="12" cy="12" r="1.3" fill="#23435f"/></svg>',

  resume: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="#fff" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>',

  aux: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8.2A2.2 2.2 0 0 1 5.2 6h9.6A2.2 2.2 0 0 1 17 8.2v6.6a2.2 2.2 0 0 1-2.2 2.2H9.6L6 20.2V17h-.8A2.2 2.2 0 0 1 3 14.8z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>'
    + '<circle cx="7.4" cy="11.5" r="1.1" fill="currentColor"/><circle cx="10" cy="11.5" r="1.1" fill="currentColor"/><circle cx="12.6" cy="11.5" r="1.1" fill="currentColor"/>'
    + '<path d="M19.4 1.8l.9 2.5 2.5.9-2.5.9-.9 2.5-.9-2.5-2.5-.9 2.5-.9z" fill="currentColor"/></svg>',

  egg: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.8c2.8 0 4.9 3.9 4.9 7.1a4.9 4.9 0 0 1-9.8 0C3.1 5.7 5.2 1.8 8 1.8z" fill="none" stroke="currentColor" stroke-width="1.7"/>'
    + '<circle cx="6.4" cy="9.4" r="1.1" fill="currentColor"/><circle cx="9.5" cy="7.3" r=".95" fill="currentColor"/></svg>',

  rest: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.2c.5 1.9 3.1 3 3.1 5.8A3.1 3.1 0 0 1 4.9 7c0-1.4.7-2.2 1.4-2.9.1 1 .6 1.6 1.3 1.8C7.2 4.4 7.3 2.6 8 1.2z" fill="currentColor"/>'
    + '<path d="M2.6 14.4l10.8-3.3M13.4 14.4L2.6 11.1" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',

  stop: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.2 4.2l7.6 7.6M11.8 4.2l-7.6 7.6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  swap: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M12.8 8a4.8 4.8 0 1 1-2.4-4.16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'
    + '<path d="M12.6 5.1L9.7 3.4l.9-1.6z" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',

  fold: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 8h7.5M7 4.6L10.4 8 7 11.4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'
    + '<path d="M13.4 2.6v10.8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',

  back: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.5 3l-5 5 5 5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  prev: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M11 2.5v11L3.5 8z"/></svg>',
  next: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M5 2.5v11L12.5 8z"/></svg>',

  add: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',

  heal: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13.6L2.7 8.4A3.1 3.1 0 0 1 8 4.3a3.1 3.1 0 0 1 5.3 4.1z" fill="currentColor"/></svg>',
};
const tabLabel = (tab, lang) => esc(say(lang, `panel.tab.${tab}`));

export const TAB_COLOR = { party: '#d8434d', box: '#3d7196', bag: '#c98a1d', amie: '#e0719a', badges: '#8a6cc7', travel: '#2f9a6e' };

const C = '.x-risu-pkbp';

export const REST_GLOW_MS = 700;

const SPARKS = [[16, 34, 17, 0], [44, 70, 12, 0.09], [64, 26, 14, 0.18], [88, 60, 11, 0.27]];
const SPARK = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 0C10.8 6.6 13.4 9.2 20 10 13.4 10.8 10.8 13.4 10 20 9.2 13.4 6.6 10.8 0 10 6.6 9.2 9.2 6.6 10 0z" fill="#fff"/></svg>';
const sparks = () => `<span class="x-risu-pkbp-spk" aria-hidden="true">${SPARKS.map(([x, y, size, delay]) =>
  `<span style="left:${x}%;top:${y}%;width:${z(size)};height:${z(size)};animation-delay:${delay}s">${SPARK}</span>`).join('')}</span>`;

export const PANEL_SHEETS = Object.freeze([[`${C}-icpr span`, PR_ITEMS], [`${C}-icsd`, SD_ITEMS], ...screenSheets(PR_BASE)].map(sheet => Object.freeze(sheet)));

export function sheetCss(address) {
  return PANEL_SHEETS.map(([selector, url]) => {
    const now = address(url);
    if (now === url) return '';
    return `${selector}{background-image:${now === null ? 'none' : `url("${now}")`};}`;
  }).join('');
}

export const SIZE = Object.freeze({
  wide: Object.freeze({ top: 84, width: 'clamp(340px, 28vw, 400px)', screenWidth: 'clamp(380px, 31vw, 430px)', text: 15, bottomGap: 12 }),
  phone: Object.freeze({ max: 640, top: 100, text: 13, sheetMax: 380 }),
  tab: Object.freeze({ w: 40, h: 44, wPhone: 38, hPhone: 38, cur: 46, border: 2.5, gap: 7, pad: 10, foldGap: 4, icon: 24, iconPhone: 22, shadow: 2 }),
  fold: Object.freeze({ min: 24, minTouch: 32, beside: 4 }),
  touch: Object.freeze({ min: 40, row: 38 }),
  hostBar: 60,
  window: Object.freeze({ room: 120 }),
  shift: Object.freeze({ min: -60, max: 60, default: 0 }),
});

export const panelShift = value => (typeof value === 'number' && Number.isFinite(value)
  ? Math.min(SIZE.shift.max, Math.max(SIZE.shift.min, Math.round(value))) : SIZE.shift.default);

const TAP_TARGETS = ['back', 'fold', 'smon', 'quill', 'badge', 'brd', 'rst', 'pairx', 'add', 'nav', 'boxname', 'seg button', 'mini button', 'gclr', 'gnav'];
const { wide: W, phone: PH, tab: TB, fold: FD } = SIZE;

const SHIFT = 'var(--pkbp-shift,0px)';
const BELOW = `var(--pkbp-below,calc(${SIZE.hostBar + W.bottomGap}px + env(safe-area-inset-bottom,0px)))`;
const topAt = top => `calc(${top}px + ${SHIFT})`;
const maxBelow = (vh, top) => `calc(${vh} - ${top}px - ${BELOW} - max(${SHIFT},0px))`;
const DVH = '@supports (height:100dvh)';

const STRIP = TB.cur - TB.border;

const foldFit = (least, normal) => {
  const room = `var(--pkbp-room,${normal + TB.foldGap + TB.shadow}px)`;
  return `--pkbp-fg:clamp(0px, ${room} - ${normal + TB.shadow}px, ${TB.foldGap}px);--pkbp-tw:clamp(${least}px, ${room} - ${TB.shadow}px - var(--pkbp-fg), ${normal}px);`;
};

const iconFit = size => `width:min(${size}px, var(--pkbp-tw) - ${FD.beside}px);height:min(${size}px, var(--pkbp-tw) - ${FD.beside}px);`;

export const BADGE_LIST_H = 312;
const CSS = [
  `${C}{position:fixed;right:0;top:${topAt(W.top)};--pkbp-max:${maxBelow('100vh', W.top)};z-index:45;display:flex;align-items:flex-start;--pkbp-z:${W.text / BASE_TEXT};`
    + `font-family:${FONT};font-weight:400;font-size:${z(BASE_TEXT)};line-height:1.35;color:#23435f;letter-spacing:0;text-align:left;`

    + `${foldFit(FD.min, TB.w)}transform:translateX(calc(100% - var(--pkbp-tw) - var(--pkbp-fg)));transition:transform .2s ease-out;`

    + `pointer-events:none;}`,

  `${DVH}{${C}{--pkbp-max:${maxBelow('100dvh', W.top)};}}`,
  `${C}${C}-open{--pkbp-tw:${TB.w}px;transform:none;z-index:1100;pointer-events:auto;}`,
  `${C}-tab,${C}-offer{pointer-events:auto;}`,
  `${C}${C}-gone{display:none;}`,
  `${C} *{box-sizing:border-box;}`,
  `:where(${C}) button{font:inherit;margin:0;color:#1d3347;}`,
  `${C} button:focus{outline:none;} ${C} button:focus-visible{outline:2px solid #ffcf4a;outline-offset:1px;}`,

  `${C}{-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;} ${C} input,${C} textarea{user-select:text;-webkit-user-select:text;}`,

  `${C}-tabs{display:flex;flex-direction:column;gap:${TB.gap}px;padding:${TB.pad}px 0 12px;position:relative;z-index:2;}`,
  `${C}-tab{position:relative;display:flex;align-items:center;justify-content:center;width:var(--pkbp-tw);height:${TB.h}px;padding:0;border:${TB.border}px solid #23435f;border-right:0;border-radius:9px 0 0 9px;`
    + `color:#23435f;box-shadow:-2px 3px 0 #1a3247;cursor:pointer;}`,
  ...Object.entries(TAB_COLOR).map(([tab, color]) => `${C}-t${tab}{background:${color};}`),
  `${C}-tresume{margin-top:6px;background:#23435f;}`,

  `${C}-taux{background:#c3cfd8;color:#6f8494;border-color:#7d93a4;box-shadow:-2px 3px 0 #8fa3b3;}`,
  `${C}-taux${C}-on{background:#d8434d;color:#fff;border-color:#23435f;box-shadow:-2px 3px 0 #1a3247;}`,
  `${C}-lit{position:absolute;top:4px;left:4px;width:7px;height:7px;border-radius:50%;background:#ffe36b;box-shadow:0 0 0 1.5px #8e2835,0 0 6px 2px rgba(255,227,107,.85);}`,
  `${C}-tab svg{display:block;${iconFit(TB.icon)}}`,

  `${C}:not(${C}-open) ${C}-tab::after{content:"";position:absolute;left:-${TB.border}px;right:calc(0px - var(--pkbp-fg));top:-${TB.border + TB.gap / 2}px;bottom:-${TB.border + TB.gap / 2}px;}`,
  `${C}-tab:active{transform:translateY(2px);box-shadow:-2px 1px 0 #1a3247;}`,
  `${C}-open ${C}-tab${C}-cur{width:${TB.cur}px;margin-right:-${TB.border}px;}`,

  `${C}-open ${C}-tabs{align-items:flex-end;}`,
    // Task alert mark: a yellow "!"
  `${C}-bang{position:absolute;top:-7px;left:-6px;padding:0 4px;border:1.5px solid #c09a2c;border-radius:8px;background:#ffd84a;color:#6b4a00;font:10px/1.4 sans-serif;}`,

  `${C}-sheet{position:relative;z-index:1;display:flex;flex-direction:column;align-self:stretch;visibility:hidden;pointer-events:none;transition:visibility 0s .2s;}`,
  `${C}-open ${C}-sheet{visibility:visible;pointer-events:auto;transition:none;}`,
  `${C}-board{flex:1 0 auto;position:relative;z-index:1;width:${W.width};border:2.5px solid #23435f;border-right:0;border-radius:0 0 0 12px;overflow:hidden;display:flex;flex-direction:column;`
    + `max-height:var(--pkbp-max);background:linear-gradient(160deg,#ffffff,#eef5fa);box-shadow:-3px 4px 0 #1a3247;}`,
  `${C}-board${C}-scr{width:${W.screenWidth};}`,

  `${C}-hd{display:flex;align-items:center;gap:7px;margin:0 10px;padding:9px 0 5px;color:#23435f;font-size:${z(15)};border-bottom:2px solid #23435f;}`,
  `${C}-hd > svg{display:block;flex:none;width:16px;height:16px;}`,
  `${C}-hdr{margin-left:auto;font-size:${z(12)};color:#5d7486;white-space:nowrap;}`,
  `${C}-fold{display:flex;align-items:center;justify-content:center;flex:none;width:24px;height:22px;padding:0;border:1.5px solid #789db7;border-radius:6px;background:#fff;color:#23435f;box-shadow:0 1.5px 0 #466c87;cursor:pointer;}`,
  `${C}-fold svg{display:block;width:12px;height:12px;}`,
  `${C}-hd{flex:none;} ${C}-bd{flex:1 1 auto;min-height:0;overflow:auto;padding:9px 10px 10px;}`,

  `${C}-bdg{flex:1 1 ${z(BADGE_LIST_H)};}`,

  `${C}-party{display:grid;grid-template-columns:1fr 1fr;gap:9px 8px;}`,
  `${C}-cell{position:relative;min-width:0;}`,
  `${C}-slot{display:flex;gap:6px;align-items:center;width:100%;padding:5px 7px 5px 4px;border:2px solid #789db7;border-radius:22px 10px 10px 22px;`
    + `background:#fff;color:#23435f;box-shadow:0 3px 0 #466c87;cursor:pointer;text-align:left;}`,
  `${C}-slot:active{transform:translateY(1.5px);box-shadow:0 1px 0 #466c87;}`,
  `${C}-lead{border-color:#d8434d;box-shadow:0 3px 0 #8e2835;}`,
  `${C}-slot${C}-fnt{opacity:.5;}`,
  `${C}-fnt ${C}-pic img{filter:grayscale(1);}`,
  `${C}-picked{outline:3px solid #ffcf4a;outline-offset:1px;}`,
  `${C}-empty{display:flex;align-items:center;justify-content:center;min-height:${z(56)};border:2px dashed #789db7;border-radius:22px 10px 10px 22px;background:#fff;opacity:.5;font-size:${z(11)};}`,
  `${C}-pic{flex:none;display:block;width:${z(42)};height:${z(42)};border:1.5px solid #8fb0c8;border-radius:50%;background:#dbe8f2;overflow:hidden;}`,
  `${C}-pic img{display:block;width:100%;height:100%;object-fit:contain;image-rendering:pixelated;transform:scale(1.45);transform-origin:50% 62%;}`,
  `${C}-info{flex:1;min-width:0;display:block;}`,
  `${C}-nm{display:flex;align-items:center;justify-content:space-between;gap:3px;min-width:0;font-size:${z(12)};}`,
  `${C}-nmt{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}`,
  `${C}-g{flex:none;}`,
  `${C}-gm{color:#3b78c9;} ${C}-gf{color:#d8434d;}`,
  `${C}-hpbar{display:block;height:5px;margin-top:3px;border-radius:3px;background:#5f6c72;overflow:hidden;}`,
  `${C}-hpfill{display:block;height:100%;}`,
  `${C}-hphigh{background:#4fbf57;} ${C}-hpmid{background:#e0b23a;} ${C}-hplow{background:#e0443f;}`,
  `${C}-r{display:flex;align-items:center;justify-content:space-between;gap:3px;margin-top:2px;font-size:${z(10)};color:#5d7486;white-space:nowrap;}`,
  `${C}-r > span{display:flex;align-items:center;gap:3px;}`,
  `${C}-st{display:inline-block;padding:0 3px;border-radius:3px;font-size:${z(9)};line-height:12px;color:#fff;}`,
  `${C}-stpar{background:#c9a512;} ${C}-stbrn{background:#d8602b;} ${C}-stslp{background:#7d8a96;} ${C}-stfrz{background:#4aa6cf;} ${C}-stpsn,${C}-sttox{background:#9b4fb0;}`,
  `${C}-stfnt{background:#7f8b95;}`,
  `${C}-held{display:inline-block;width:8px;height:8px;border-radius:50%;background:#e9b24c;box-shadow:inset 0 0 0 1.5px #a5741c;}`,

  `${C}-emo{font-family:"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif;font-style:normal;line-height:1;}`,
  `${C}-heldemo{font-size:${z(10)};}`,

  `${C}-dbg{flex:none;display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin:0 10px;padding:7px 0 9px;border-top:1.5px dashed #c09a2c;}`,
  `${C}-dbgk{margin-right:2px;font-size:${z(11)};color:#8a6d1e;}`,
  `${C}-add{position:relative;display:flex;flex:none;height:22px;padding:2px;border:0;border-radius:6px;background:repeating-linear-gradient(-45deg,#1b1b1b 0 4px,#ffcc00 4px 8px);cursor:pointer;}`,
  `${C}-add>span{display:flex;align-items:center;gap:2px;padding:0 6px 0 4px;border-radius:4px;background:#ffd52e;color:#111;font-size:${z(11)};font-weight:700;line-height:1;white-space:nowrap;}`,
  `${C}-add svg{display:block;width:10px;height:10px;}`,
  `${C}-exp{display:block;height:3px;margin-top:1px;border-radius:2px;background:#d4dfe7;overflow:hidden;}`,
  `${C}-exp span{display:block;height:100%;background:#4aa3e8;}`,

  `${C}-badge{position:absolute;top:-8px;right:-7px;z-index:1;padding:0 4px;border:1.5px solid #c09a2c;border-radius:6px;background:#ffd84a;color:#6b4a00;font:${z(10)}/1.4 sans-serif;cursor:pointer;}`,
  `${C}-badge${C}-off{background:#d5dbe0;color:#6b7a86;border-color:#a6b0b8;cursor:default;}`,

  `${C}-brd{display:flex;align-items:center;flex:none;gap:3px;height:22px;padding:0 7px 0 5px;border:1.5px solid #e0719a;border-radius:7px;background:#fff;color:#b0476f;font-size:${z(12)};line-height:1;white-space:nowrap;box-shadow:0 1.5px 0 #b0476f;cursor:pointer;}`,
  `${C}-brd svg{display:block;width:12px;height:12px;}`,
  `${C}-brd${C}-on{background:#e0719a;border-color:#b0476f;color:#fff;}`,
  `${C}-brd${C}-no{background:#d8434d;border-color:#8e2835;color:#fff;box-shadow:0 1.5px 0 #8e2835;}`,
  `${C}-brd${C}-off{border-color:#c3cfd8;color:#a9b5be;box-shadow:none;cursor:default;}`,
  `${C}-brd${C}-off${C}-on,${C}-brd${C}-off${C}-no{background:#c3cfd8;border-color:#a9b5be;color:#fff;}`,
  `${C}-brd:not(${C}-off):active{transform:translateY(1px);box-shadow:none;}`,

  `${C}-rst{display:flex;align-items:center;flex:none;gap:3px;height:22px;padding:0 6px 0 5px;border:1.5px solid #3f9a7c;border-radius:7px;background:#fff;color:#2b7a60;font-size:${z(12)};line-height:1;white-space:nowrap;box-shadow:0 1.5px 0 #2b7a60;cursor:pointer;}`,
  `${C}-rst svg{display:block;width:12px;height:12px;}`,
  `${C}-rstc{display:flex;gap:2px;margin-left:1px;}`,
  `${C}-rstc > span{display:block;width:8px;height:8px;border-radius:50%;border:1.5px solid #3f9a7c;background:#3f9a7c;}`,
  `${C}-rstc > span${C}-used{background:#fff;border-color:#a9b5be;}`,
  `${C}-rst${C}-off{border-color:#c3cfd8;color:#a9b5be;box-shadow:none;cursor:default;}`,
  `${C}-rst${C}-off ${C}-rstc > span:not(${C}-used){background:#a9b5be;border-color:#a9b5be;}`,
  `${C}-rst:not(${C}-off):active{transform:translateY(1px);box-shadow:none;}`,

  `${C}-healed{animation:x-risu-pkbpheal ${REST_GLOW_MS}ms ease-out;}`,
  `@keyframes x-risu-pkbpheal{30%{border-color:#3f9a7c;box-shadow:0 3px 0 #2b7a60,0 0 10px 2px rgba(78,196,150,.7),inset 0 0 0 60px rgba(122,214,174,.3);} }`,
  `${C}-spk{position:absolute;inset:0;z-index:1;pointer-events:none;}`,
  `${C}-spk > span{position:absolute;display:block;opacity:0;transform:translate(-50%,-50%) scale(0);animation:x-risu-pkbpspark .42s ease-out forwards;}`,
  `${C}-spk svg{display:block;width:100%;height:100%;filter:drop-shadow(0 0 1px #2b7a60) drop-shadow(0 0 3px #4ec496);}`,
  `@keyframes x-risu-pkbpspark{0%{opacity:0;transform:translate(-50%,-30%) scale(0) rotate(0);} 45%{opacity:1;transform:translate(-50%,-60%) scale(1.1) rotate(20deg);} `
    + '100%{opacity:0;transform:translate(-50%,-110%) scale(.3) rotate(60deg);} }',
  `@media (prefers-reduced-motion:reduce){${C}-healed{animation:none;} ${C}-spk{display:none;}}`,
  `${C}-bred{border-color:#e0719a;background:linear-gradient(160deg,#fff,#fdeef4);box-shadow:0 3px 0 #b0476f;}`,
  `${C}-bredno{border-color:#d8434d;background:linear-gradient(160deg,#fff,#fdecee);box-shadow:0 3px 0 #8e2835;}`,
  `${C}-mark{position:absolute;top:-7px;left:-5px;z-index:1;display:flex;align-items:center;justify-content:center;width:19px;height:19px;border:1.5px solid #fff;border-radius:50%;`
    + `color:#fff;font:${z(11)}/1 sans-serif;font-weight:700;pointer-events:none;}`,
  `${C}-markbred,${C}-markn{background:#e0719a;box-shadow:0 1px 0 #b0476f;}`,
  `${C}-markbredno{background:#d8434d;box-shadow:0 1px 0 #8e2835;}`,
  `${C}-pair{display:flex;align-items:center;gap:6px;margin:0 0 10px;padding:6px 6px 7px 6px;border:2px solid #e0719a;border-radius:12px;background:linear-gradient(160deg,#fff,#fdeef4);box-shadow:0 3px 0 #b0476f;}`,
  `${C}-pairno{border-color:#d8434d;background:linear-gradient(160deg,#fff,#fdecee);box-shadow:0 3px 0 #8e2835;}`,

  `${C}-pairp{position:relative;display:flex;align-items:center;gap:2px;flex:none;}`,
  `${C}-pairp ${C}-pic{width:${z(34)};height:${z(34)};}`,
  `${C}-pairh{position:absolute;left:50%;bottom:-3px;transform:translateX(-50%);display:flex;align-items:center;justify-content:center;width:15px;height:15px;border-radius:50%;background:#fff;`
    + `box-shadow:0 0 0 1.5px #e0719a;font:10px/1 sans-serif;color:#e0719a;}`,
  `${C}-pairno ${C}-pairh{color:#c3cfd8;box-shadow:0 0 0 1.5px #c3cfd8;}`,
  `${C}-pairt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;}`,
  `${C}-pairk{font-size:${z(10)};color:#5d7486;}`,
  `${C}-pairc{display:flex;flex-wrap:wrap;align-items:center;gap:0 4px;font-size:${z(13)};color:#14304a;word-break:keep-all;}`,
  `${C}-pairno ${C}-pairc{flex-wrap:nowrap;gap:3px;}`,
  `${C}-pairno ${C}-pairc{color:#a32634;}`,
  `${C}-hearts{color:#e0719a;font-size:${z(11)};letter-spacing:1px;white-space:nowrap;}`,
  `${C}-pairbang{display:inline-flex;align-items:center;justify-content:center;flex:none;width:14px;height:14px;border-radius:50%;background:#d8434d;color:#fff;font:${z(10)}/1 sans-serif;font-weight:700;}`,
  `${C}-pairw{font-size:${z(11)};color:#a32634;word-break:keep-all;}`,

  `${C}-pairb{display:flex;align-items:center;gap:6px;flex:none;align-self:flex-start;margin:-3px -2px 0 0;}`,
  `${C}-pairx{position:relative;display:flex;align-items:center;justify-content:center;flex:none;width:24px;height:24px;padding:0;border:1.5px solid #789db7;border-radius:7px;background:#fff;color:#23435f;box-shadow:0 1.5px 0 #466c87;cursor:pointer;}`,
  `${C}-pairx:first-child{z-index:1;}`,
  `${C}-pairx svg{display:block;width:11px;height:11px;}`,
  `${C}-pairx:active{transform:translateY(2px);box-shadow:none;}`,
  `${C}-pairx${C}-off{color:#a9b5be;border-color:#c3cfd8;box-shadow:none;cursor:default;}`,

  `${C}-boxhd{display:flex;align-items:center;justify-content:center;gap:6px;margin-bottom:8px;}`,
  `${C}-nav{display:flex;align-items:center;justify-content:center;width:${z(28)};height:${z(26)};padding:0;border:2px solid #789db7;border-radius:7px;background:#fff;color:#23435f;box-shadow:0 2.5px 0 #466c87;cursor:pointer;}`,
  `${C}-nav svg{width:12px;height:12px;display:block;}`,

  `${C}-boxname{flex:1;display:flex;align-items:center;justify-content:center;gap:4px;min-width:0;max-width:${z(190)};height:${z(26)};padding:0 8px;border:2px solid #789db7;border-radius:7px;background:#fff;color:#23435f;font-size:${z(13)};box-shadow:0 2.5px 0 #466c87;cursor:pointer;white-space:nowrap;}`,
  `${C}-boxnm{min-width:0;overflow:hidden;text-overflow:ellipsis;}`,
  `${C}-boxat{flex:none;font-size:${z(11)};color:#5d7486;}`,
  `${C}-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:4px;padding:6px;border:2px solid #789db7;border-radius:9px;background:linear-gradient(160deg,#eef5fa,#dbe8f2);}`,
  `${C}-bc{display:block;aspect-ratio:1;width:100%;padding:0;border:1.5px solid #a9c2d4;border-radius:7px;background:#fff;overflow:hidden;cursor:pointer;}`,
  `${C}-bc img{display:block;width:100%;height:100%;object-fit:contain;image-rendering:pixelated;transform:scale(1.5);transform-origin:50% 62%;}`,
  `${C}-bce{background:rgba(255,255,255,.45);border-style:dashed;cursor:default;}`,
  `${C}-bc${C}-fnt img{filter:grayscale(1);opacity:.55;}`,

  `${C}-money{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;padding:6px 10px;border:2px solid #789db7;border-radius:9px;background:#fff;color:#23435f;box-shadow:0 2.5px 0 #466c87;}`,
  `${C}-money span{font-size:${z(12)};color:#5d7486;} ${C}-money b{font-size:${z(14)};color:#14304a;}`,
  `${C}-grp{margin:8px 2px 4px;font-size:${z(11)};color:#5d7486;letter-spacing:.05em;}`,
  `${C}-grp:first-child{margin-top:0;}`,
  `${C}-it{display:flex;align-items:center;gap:7px;width:100%;min-height:${z(34)};margin-bottom:4px;padding:3px 9px 3px 5px;border:2px solid #a9c2d4;border-radius:10px;background:#fff;box-shadow:0 2px 0 #c3d4e1;cursor:pointer;text-align:left;}`,
  `${C}-it:active{transform:translateY(1px);}`,
  `${C}-it${C}-picked{border-color:#315a77;outline-offset:0;}`,
  `${C}-ic{position:relative;flex:none;display:block;width:24px;height:24px;overflow:hidden;}`,
  `${C}-icpr{position:absolute;left:0;top:0;width:32px;height:32px;transform:scale(.75);transform-origin:0 0;}`,
  `${C}-icpr span{position:absolute;display:block;background-image:url("${PR_ITEMS}");background-repeat:no-repeat;image-rendering:pixelated;}`,
  `${C}-icsd{display:block;width:24px;height:24px;background-image:url("${SD_ITEMS}");background-repeat:no-repeat;image-rendering:pixelated;}`,
  `${C}-icdot{display:block;width:14px;height:14px;margin:5px;border-radius:50%;background:#e9b24c;box-shadow:inset 0 0 0 2px #a5741c;}`,
  `${C}-icem{display:flex;align-items:center;justify-content:center;font-size:${z(19)};}`,
  `${C}-itn{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}`,
  `${C}-itc{flex:none;font-size:${z(12)};color:#3d5a70;}`,
  `${C}-none{padding:16px 6px;text-align:center;color:#8193a1;font-size:${z(12.5)};}`,

  `${C}-hint{margin:0 2px 8px;font-size:${z(12)};color:#5d7486;}`,
  `${C}-slot${C}-off{opacity:.5;cursor:default;box-shadow:0 3px 0 #466c87;transform:none;}`,
  `${C}-off ${C}-pic img{filter:grayscale(1);}`,
  `${C}-enj{color:#b0476f;}`,

  `${C}-ering{position:absolute;right:-4px;top:-7px;z-index:1;width:22px;height:22px;pointer-events:none;}`,
  `${C}-ering > svg{display:block;width:100%;height:100%;}`,
  `${C}-ering > i{position:absolute;left:50%;top:50%;width:12px;height:12px;transform:translate(-50%,-50%);border-radius:50%;background:${RING_COLOR.enjoy};display:flex;align-items:center;justify-content:center;}`,
  `${C}-ering > i svg{display:block;width:62%;height:62%;}`,

  `${C}-offer{position:absolute;top:10px;right:100%;width:208px;margin-right:8px;padding:8px 10px 7px;border:2.5px solid #23435f;border-radius:10px;`
    + `background:linear-gradient(160deg,#ffffff,#eef5fa);box-shadow:-3px 4px 0 #1a3247;font-size:${z(12.5)};color:#14304a;}`,
  `${C}-open ${C}-offer{display:none;}`,
  `${C}-offb{display:flex;justify-content:flex-end;gap:6px;margin-top:6px;}`,
  `${C}-offb button{padding:4px 9px 3px;border:2px solid #789db7;border-radius:7px;background:#fff;color:#23435f;font-size:${z(12)};box-shadow:0 2px 0 #466c87;cursor:pointer;}`,
  `${C}-offb ${C}-offy{border-color:#8e2835;background:#d8434d;color:#fff;box-shadow:0 2px 0 #8e2835;}`,
  `${C}-offb button:active{transform:translateY(1.5px);box-shadow:none;}`,
  `${C}-bring{display:block;width:100%;margin:0 0 9px;padding:9px 10px 8px;border:2px solid #d8434d;border-radius:10px;background:#fff;color:#14304a;font-size:${z(13)};`
    + `text-align:center;box-shadow:0 3px 0 #8e2835;cursor:pointer;}`,
  `${C}-bring:active{transform:translateY(1.5px);box-shadow:0 1px 0 #8e2835;}`,

  `${C}-win{flex:none;display:flex;flex-direction:column;max-height:calc(var(--pkbp-max) - ${SIZE.window.room}px);margin:0 9px 10px;padding:7px 10px 6px;`
    + `border:2.5px solid #23435f;border-radius:9px;background:#fff;box-shadow:0 3px 0 #1a3247;}`,
  `${C}-wt,${C}-cnt{flex:none;}`,
  `${C}-wt{white-space:pre-line;font-size:${z(13)};color:#14304a;line-height:1.45;}`,
  `${C}-err ${C}-wt{color:#a32634;}`,
  `${C}-opts{display:flex;flex-direction:column;min-height:0;overflow-y:auto;overscroll-behavior:contain;margin-top:5px;padding-top:4px;border-top:1.5px solid #dbe5ec;}`,
  `${C}-opt{position:relative;flex:none;display:block;width:100%;padding:4px 6px 4px 18px;border:0;border-radius:6px;background:transparent;color:#14304a;font-size:${z(13)};text-align:left;cursor:pointer;}`,
  `${C}-opt:hover{background:#eef4f9;}`,
  `${C}-opt:hover::before{content:"";position:absolute;left:6px;top:50%;margin-top:-4px;border:4px solid transparent;border-left:6px solid #d8434d;}`,
  `${C}-opt${C}-off{color:#a9b5be;cursor:default;}`,
  `${C}-opt${C}-off:hover{background:transparent;}`,
  `${C}-opt${C}-off:hover::before{display:none;}`,
    // Toss count: left-arrow, x n, right-arrow, with how many are in the bag
  `${C}-cnt{display:flex;align-items:center;justify-content:center;gap:10px;margin-top:6px;}`,
  `${C}-cntn{min-width:56px;padding:2px 8px;border:2px solid #789db7;border-radius:7px;background:#f4f9fc;color:#14304a;font-size:${z(15)};text-align:center;}`,
  `${C}-cntof{font-size:${z(11)};color:#5d7486;}`,

  `${C}-sec{margin:0 0 9px;padding:7px 10px 8px;border:2px solid #a9c2d4;border-radius:10px;background:#fff;box-shadow:0 2px 0 #c3d4e1;}`,
  `${C}-sech{margin:0 0 4px;font-size:${z(11.5)};color:#2f7d5c;letter-spacing:.03em;}`,
  `${C}-guide{font-size:${z(13)};color:#14304a;white-space:pre-line;word-break:keep-all;overflow-wrap:anywhere;}`,
  `${C}-goal{display:flex;gap:7px;margin-top:6px;padding-top:5px;border-top:1.5px dashed #dbe5ec;font-size:${z(12)};color:#14304a;word-break:keep-all;overflow-wrap:anywhere;}`,
  `${C}-goal b{flex:none;font-weight:400;color:#2f9a6e;}`,

  `${C}-gtxt{display:flex;align-items:flex-start;gap:8px;}`,
  `${C}-gtxt ${C}-guide{flex:1;min-width:0;}`,
  `${C}-gclr{flex:none;display:flex;align-items:center;justify-content:center;width:${z(26)};height:${z(24)};padding:0;border:1.5px solid #789db7;border-radius:6px;background:#fff;`
    + `font-size:${z(11)};line-height:1;box-shadow:0 1.5px 0 #466c87;cursor:pointer;}`,
  `${C}-gclr:active{transform:translateY(1px);box-shadow:none;}`,
  `${C}-gclr${C}-off{opacity:.45;box-shadow:none;cursor:default;}`,
  `${C}-muted{color:#8193a1;}`,
  `${C}-sw{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;min-height:${z(32)};padding:4px 1px;border:0;border-top:1.5px solid #eef2f5;border-radius:0;`
    + `background:transparent;color:#14304a;font-size:${z(13)};text-align:left;cursor:pointer;}`,
  `${C}-sech + ${C}-sw{border-top:0;}`,
  `${C}-swsub{padding-left:14px;}`,
  `${C}-swk{flex:none;position:relative;width:34px;height:20px;border-radius:10px;background:#c3cfd8;box-shadow:inset 0 0 0 1.5px #7d93a4;}`,
  `${C}-swk::after{content:"";position:absolute;top:3px;left:3px;width:14px;height:14px;border-radius:50%;background:#fff;box-shadow:0 1px 0 #7d93a4;transition:left .15s;}`,
  `${C}-sw${C}-on ${C}-swk{background:#2f9a6e;box-shadow:inset 0 0 0 1.5px #1f6e4e;}`,
  `${C}-sw${C}-on ${C}-swk::after{left:17px;box-shadow:0 1px 0 #1f6e4e;}`,
  `${C}-sw${C}-off{cursor:default;color:#8193a1;}`,
  `${C}-sw${C}-off ${C}-swk{opacity:.55;}`,
  `${C}-row{display:flex;gap:8px;padding:3px 0;border-top:1.5px solid #eef2f5;font-size:${z(12.5)};}`,
  `${C}-sech + ${C}-row{border-top:0;}`,
  `${C}-rowk{flex:0 0 ${z(96)};color:#5d7486;}`,
  `${C}-rowv{flex:1;min-width:0;color:#14304a;word-break:keep-all;overflow-wrap:anywhere;}`,

  `@media (pointer:coarse){${C}{${foldFit(FD.minTouch, TB.w)}}}`,

  `@media (max-width:${PH.max}px){`
    + `${C}{top:${topAt(PH.top)};--pkbp-max:${maxBelow('100vh', PH.top)};--pkbp-z:${PH.text / BASE_TEXT};${foldFit(FD.minTouch, TB.wPhone)}}`
    + `${C}${C}-open{--pkbp-tw:${TB.wPhone}px;}`
    + `${C}-tab{height:${TB.hPhone}px;} ${C}-tab svg{${iconFit(TB.iconPhone)}}`
    + `${C}-board,${C}-board${C}-scr{width:min(${PH.sheetMax}px, calc(100vw - ${TB.wPhone + STRIP}px));}`
    + `}`,
  `${DVH}{@media (max-width:${PH.max}px){${C}{--pkbp-max:${maxBelow('100dvh', PH.top)};}}}`,

  `${C}-floor{position:fixed;left:0;right:0;bottom:0;height:0;visibility:hidden;pointer-events:none;}`,

  `@media (max-width:${PH.max}px),(pointer:coarse){`
    + `:where(${TAP_TARGETS.map(name => `${C}-${name}`).join(',')}){position:relative;}`
    + `${TAP_TARGETS.map(name => `${C}-${name}::after`).join(',')}{content:"";position:absolute;left:50%;top:50%;`
    + `width:max(100%,${SIZE.touch.min}px);height:max(100%,${SIZE.touch.min}px);transform:translate(-50%,-50%);}`
    + `${C}-opt{display:flex;align-items:center;min-height:${SIZE.touch.row}px;}`
    + `}`,

  `@media (prefers-reduced-motion:reduce){${C},${C}-sheet,${C}-swk::after{transition:none !important;}}`,
  BADGE_CSS,
  screenCss(PR_BASE),
].join(' ');

export const COMPAT_TABS_CSS = `${Object.values(COMPAT_TABS).map(name => `.x-risu-${name}`).join(',')}{display:none !important;}`;

const TABS_CLASS = 'x-risu-pkbp-tabs', SHEET_CLASS = 'x-risu-pkbp-sheet', ART_CLASS = 'x-risu-pkbp-art';

export const FLOOR_CLASS = 'x-risu-pkbp-floor';

export const OWN_CLASS = 'x-risu-pkbp-own';

export const PANEL_STATES = Object.freeze({ open: 'x-risu-pkbp-open', locked: 'x-risu-pkbp-locked', gone: 'x-risu-pkbp-gone' });
const shell = (tabs, sheet, states = []) => `<div><style>${CSS}</style><div class="${ART_CLASS}"></div><div class="${FLOOR_CLASS}"></div><div class="${['x-risu-pkbp', ...states].join(' ')}">`
  + `<div class="${TABS_CLASS}">${tabs}</div><div class="${SHEET_CLASS}">${sheet}</div></div></div>`;

export const sheetArt = css => (css ? `<div><style>${css}</style></div>` : '');

export const panelShell = () => shell('', '', [PANEL_STATES.gone]);

export function renderPanel(model, { aux = null, picture = directPicture, shift = SIZE.shift.default, below = null, room = null, rested = null } = {}) {
  const { lang } = model;
  const t = key => esc(say(lang, key));
  const hits = [];
  const hit = desc => { hits.push(desc); return `x-risu-pkbp-hit x-risu-pkbp-h${hits.length - 1}`; };

  const swipe = (prev, next) => { hits.push(prev, next); return `x-risu-pkbp-swipe x-risu-pkbp-sp${hits.length - 2} x-risu-pkbp-sn${hits.length - 1}`; };
  const cls = (...list) => list.filter(Boolean).join(' ');

  const sideTabs = model.tabs.map(tab => {
    const cur = model.open && model.tab === tab;
    return `<button type="button" class="${cls('x-risu-pkbp-tab', `x-risu-pkbp-t${tab}`, cur && 'x-risu-pkbp-cur', hit({ t: 'tab', tab }))}" aria-label="${tabLabel(tab, lang)}" title="${tabLabel(tab, lang)}">`
      + `${ICON[tab]}${model.alerts[tab] ? '<span class="x-risu-pkbp-bang">!</span>' : ''}</button>`;
  }).join('');
  const resume = model.resume
    ? `<button type="button" class="${cls('x-risu-pkbp-tab', 'x-risu-pkbp-tresume', hit({ t: 'resume' }))}" aria-label="${t('panel.resume')}" title="${t('panel.resume')}">${ICON.resume}</button>` : '';
  const auxLabel = t(aux?.on ? 'panel.auxOn' : 'panel.auxOff');
  const auxTab = model.resume && aux
    ? `<button type="button" class="${cls('x-risu-pkbp-tab', 'x-risu-pkbp-taux', aux.on && 'x-risu-pkbp-on', hit({ t: 'aux' }))}" aria-pressed="${aux.on}" aria-label="${auxLabel}" title="${auxLabel}">`
      + `${ICON.aux}${aux.on ? '<span class="x-risu-pkbp-lit"></span>' : ''}</button>` : '';

  const note = model.offer?.note
    ? `<div class="x-risu-pkbp-offer" role="dialog" aria-label="${t('panel.offer.ask')}"><div>${t('panel.offer.ask')}</div><div class="x-risu-pkbp-offb">`
      + `<button type="button" class="${cls('x-risu-pkbp-offn', hit({ t: 'later' }))}">${t('panel.offer.later')}</button>`
      + `<button type="button" class="${cls('x-risu-pkbp-offy', hit({ t: 'offer', asked: true }))}">${t('panel.offer.yes')}</button></div></div>` : '';
  const lift = panelShift(shift);
  const place = [lift === SIZE.shift.default ? '' : `--pkbp-shift:${lift}px;`, Number.isFinite(below) ? `--pkbp-below:${Math.round(below)}px;` : '',
    Number.isFinite(room) ? `--pkbp-room:${Math.max(0, Math.floor(room))}px;` : ''].join('');
  const tabs = sideTabs + resume + auxTab + note + (model.travel ? `<style>${COMPAT_TABS_CSS}</style>` : '') + (place ? `<style>${C}{${place}}</style>` : '');
  const out = [];
  if (model.open && model.screen) {

    const fold = `<button type="button" class="${cls('x-risu-pkbp-fold', hit({ t: 'fold' }))}" aria-label="${t('panel.fold')}" title="${t('panel.fold')}">${ICON.fold}</button>`;
    const { head, strip, body } = screenHtml(model.screen, lang, hit, { icon: ICON, img: slot => monImg(picture(slot)), gender: (g, name) => genderMark(g, lang, name), fold, statusMark: slot => statusMark(slot, lang), swipe });
    out.push(`<div class="x-risu-pkbp-board x-risu-pkbp-scr"><div class="x-risu-pkbp-hd" style="border-bottom-color:${TAB_COLOR[model.screen.tab]}">${head}</div>${strip}`
      + `<div class="x-risu-pkbp-bd">${body}</div>${model.window ? windowHtml(model.window, hit, lang) : ''}</div>`);
  } else if (model.open) {
    const right = model.tab === 'party' ? `${model.party.filter(Boolean).length}/${PARTY_MAX}`
      : model.tab === 'box' ? `${model.box.cells.filter(Boolean).length}/${BOX_SIZE}`
      : model.tab === 'badges' ? `${model.badges.count}/${model.badges.total}` : '';

    out.push(`<div class="${cls('x-risu-pkbp-board', hit({ t: 'blank' }))}">`);
    out.push(`<div class="x-risu-pkbp-hd" style="border-bottom-color:${TAB_COLOR[model.tab]}">${ICON[model.tab]}${tabLabel(model.tab, lang)}`
      + `<span class="x-risu-pkbp-hdr">${esc(right)}</span>${model.tab === 'party' ? breedButton(model, hit) + restButton(model, hit) : ''}`
      + `<button type="button" class="${cls('x-risu-pkbp-fold', hit({ t: 'fold' }))}" aria-label="${t('panel.fold')}" title="${t('panel.fold')}">${ICON.fold}</button></div>`);

    out.push(`<div class="${cls('x-risu-pkbp-bd', model.tab === 'badges' && !model.badges.open && 'x-risu-pkbp-bdg')}">`);
    if (model.tab === 'party') out.push(partyHtml(model, hit, picture, rested));
    else if (model.tab === 'box') out.push(boxHtml(model, hit, picture));
    else if (model.tab === 'amie') out.push(amieHtml(model, hit, picture));
    else if (model.tab === 'travel') out.push(travelHtml(model, hit));
    else if (model.tab === 'badges') out.push(badgeCaseHtml(model.badges, lang, hit, { img: url => monImg(picture({ url })), icon: iconHtml }, { icon: ICON, swipe }));
    else out.push(bagHtml(model, hit));
    out.push('</div>');
    out.push(debugRow(model, hit));
    if (model.window) out.push(windowHtml(model.window, hit, lang));
    out.push('</div>');
  }
  const sheet = out.join('');
  const states = [model.open && PANEL_STATES.open, model.locked && PANEL_STATES.locked].filter(Boolean);
  return { tabs, sheet, open: !!model.open, locked: !!model.locked, html: shell(tabs, sheet, states), hits };
}

function debugRow(model, hit) {
  const { lang } = model;
  const pill = (press, icon, word, label) => `<button type="button" class="x-risu-pkbp-add ${hit(press)}"${label ? ` aria-label="${esc(label)}" title="${esc(label)}"` : ''}>`
    + `<span>${ICON[icon]}${esc(say(lang, word))}</span></button>`;
  const pills = [];
  if (model.tab === 'party' && model.heal) pills.push(pill({ t: 'heal' }, 'heal', 'panel.pill.heal', say(lang, 'panel.debugAdd', { what: say(lang, 'panel.debugHeal') })));
  if (model.add?.[model.tab]) pills.push(pill({ t: 'add', where: model.tab }, 'add', 'panel.pill.add', say(lang, 'panel.debugAdd', { what: say(lang, `panel.add.${model.tab}`) })));
  const grant = model.tab === 'badges' ? model.badges.open?.grant : null;
  if (grant && !grant.off) pills.push(pill({ t: 'gymGrant' }, 'add', grant.earned ? 'badge.take' : 'badge.give'));
  return pills.length ? `<div class="x-risu-pkbp-dbg"><span class="x-risu-pkbp-dbgk">${esc(say(lang, 'panel.debugRow'))}</span>${pills.join('')}</div>` : '';
}

function breedButton(model, hit) {
  const { lang } = model;
  const label = esc(say(lang, 'panel.pill.breed'));
  const look = model.breedPick || model.breeding?.ok ? ' x-risu-pkbp-on' : model.breeding ? ' x-risu-pkbp-no' : '';
  const state = model.breedPick || !model.breeding ? `aria-pressed="${!!model.breedPick}"` : `aria-expanded="${!!model.pairShown}"`;
  return model.breedPill
    ? `<button type="button" class="x-risu-pkbp-brd${look} ${hit({ t: 'breed' })}" ${state}>${ICON.egg}${label}</button>`
    : `<span class="x-risu-pkbp-brd x-risu-pkbp-off${look}" aria-disabled="true">${ICON.egg}${label}</span>`;
}

function restButton(model, hit) {
  const { lang } = model;
  const { left, max, why } = model.rest;
  const circles = Array.from({ length: max }, (_, i) => `<span${i < left ? '' : ' class="x-risu-pkbp-used"'}></span>`).join('');
  const label = esc(say(lang, 'panel.rest.label', { left, max }));
  const inside = `${ICON.rest}${esc(say(lang, 'panel.pill.rest'))}<span class="x-risu-pkbp-rstc">${circles}</span>`;
  if (why === 'none') return `<span class="x-risu-pkbp-rst x-risu-pkbp-off" aria-disabled="true" aria-label="${label}" title="${label}">${inside}</span>`;
  return `<button type="button" class="x-risu-pkbp-rst${why ? ' x-risu-pkbp-off' : ''} ${hit({ t: 'rest' })}"${why ? ' aria-disabled="true"' : ''} aria-label="${label}" title="${label}">${inside}</button>`;
}

const heldMark = (held, lang) => {
  const title = esc(say(lang, 'panel.held', { item: held.name }));
  return held.emoji ? `<span class="x-risu-pkbp-emo x-risu-pkbp-heldemo" title="${title}">${esc(held.emoji)}</span>` : `<span class="x-risu-pkbp-held" title="${title}"></span>`;
};

const statusMark = (slot, lang) => (slot.fainted ? `<span class="x-risu-pkbp-st x-risu-pkbp-stfnt">${esc(say(lang, 'panel.fainted'))}</span>`
  : slot.status ? `<span class="x-risu-pkbp-st x-risu-pkbp-st${slot.status}">${esc(statusShort(slot.status, lang))}</span>` : '');

const genderMark = (g, lang, name = '') => ((g === 'M' || g === 'F') && !nameShowsGender(name)
  ? `<span class="x-risu-pkbp-g x-risu-pkbp-g${g.toLowerCase()}">${genderMarkSvg(g, { label: say(lang, `import.gender.${g}`) })}</span>` : '');

function partyHtml(model, hit, picture, rested) {
  const { lang } = model;
  const t = key => esc(say(lang, key));
  const pair = model.breeding;
  const band = pair && model.pairShown ? pairBand(model, pair, hit, picture) : '';
  const cells = model.party.map((slot, i) => {
    if (!slot) return `<div class="x-risu-pkbp-cell"><div class="x-risu-pkbp-empty">${t('panel.empty')}</div></div>`;
    const picked = model.picked === slot.uid;

    if (slot.egg) {
      return `<div class="x-risu-pkbp-cell"><button type="button" class="x-risu-pkbp-slot${i === 0 ? ' x-risu-pkbp-lead' : ''}${picked ? ' x-risu-pkbp-picked' : ''}${model.breedPick ? ' x-risu-pkbp-off' : ''} ${hit({ t: 'slot', where: 'party', uid: slot.uid })}">`
        + `<span class="x-risu-pkbp-pic">${monImg(picture(slot))}</span><span class="x-risu-pkbp-info"><span class="x-risu-pkbp-nm"><span class="x-risu-pkbp-nmt">${esc(slot.name)}</span></span></span></button></div>`;
    }
    const status = statusMark(slot, lang);
    const width = slot.maxhp ? Math.round(slot.hp / slot.maxhp * 1000) / 10 : 0;

    const bred = pair && [pair.a, pair.b].includes(slot.uid) ? (pair.ok ? 'bred' : 'bredno') : '';
    const mark = model.breedPick && picked ? '<span class="x-risu-pkbp-mark x-risu-pkbp-markn">1</span>'
      : bred ? `<span class="x-risu-pkbp-mark x-risu-pkbp-mark${bred}">${bred === 'bred' ? '♥' : '!'}</span>` : '';
    const healed = !!rested?.includes(slot.uid);
    const slotHtml = `<button type="button" class="x-risu-pkbp-slot${i === 0 ? ' x-risu-pkbp-lead' : ''}${bred ? ` x-risu-pkbp-${bred}` : ''}${slot.fainted ? ' x-risu-pkbp-fnt' : ''}${picked ? ' x-risu-pkbp-picked' : ''}${healed ? ' x-risu-pkbp-healed' : ''} ${hit({ t: 'slot', where: 'party', uid: slot.uid })}">`
      + `<span class="x-risu-pkbp-pic">${monImg(picture(slot))}</span>`
      + '<span class="x-risu-pkbp-info">'
      + `<span class="x-risu-pkbp-nm"><span class="x-risu-pkbp-nmt">${esc(slot.name)}</span>${genderMark(slot.gender, lang, slot.name)}</span>`
      + `<span class="x-risu-pkbp-hpbar"><span class="x-risu-pkbp-hpfill x-risu-pkbp-hp${slot.hpClass}" style="width:${width}%"></span></span>`
      + `<span class="x-risu-pkbp-r"><span>${slot.hp}/${slot.maxhp}${status}</span>`
      + `<span>Lv${slot.level}${slot.held ? heldMark(slot.held, lang) : ''}</span></span>`
      + (slot.exp === null ? '' : `<span class="x-risu-pkbp-exp"><span style="width:${Math.round(slot.exp * 1000) / 10}%"></span></span>`)
      + '</span></button>';

    const badge = slot.badge ? (model.locked
      ? `<span class="x-risu-pkbp-badge x-risu-pkbp-off">▲${slot.badge}</span>`
      : `<button type="button" class="x-risu-pkbp-badge ${hit({ t: 'badge', uid: slot.uid })}" aria-label="${t('panel.levelUp')}" title="${t('panel.levelUp')}">▲${slot.badge}</button>`) : '';
    return `<div class="x-risu-pkbp-cell">${slotHtml}${healed ? sparks() : ''}${mark}${badge}</div>`;
  });

  const bring = model.offer?.button ? `<button type="button" class="x-risu-pkbp-bring ${hit({ t: 'offer' })}">${t('panel.offer.button')}</button>` : '';
  return `${bring}${band}<div class="x-risu-pkbp-party">${cells.join('')}</div>`;
}

function pairBand(model, pair, hit, picture) {
  const { lang } = model;
  const t = key => esc(say(lang, key));
  const pic = uid => `<span class="x-risu-pkbp-pic">${monImg(picture(model.party.find(slot => slot?.uid === uid)))}</span>`;
  const how = pair.ok
    ? `<span class="x-risu-pkbp-pairc">${esc(pair.label)} <span class="x-risu-pkbp-hearts">${'♥'.repeat(pair.hearts)}${'♡'.repeat(3 - pair.hearts)}</span></span>`
    : `<span class="x-risu-pkbp-pairc"><span class="x-risu-pkbp-pairbang">!</span><span>${esc(pair.label)}</span></span><span class="x-risu-pkbp-pairw">${esc(pair.why)}</span>`;
  const button = (press, icon, key) => (model.breedable
    ? `<button type="button" class="x-risu-pkbp-pairx ${hit({ t: press })}" aria-label="${t(key)}" title="${t(key)}">${ICON[icon]}</button>`
    : `<span class="x-risu-pkbp-pairx x-risu-pkbp-off" aria-disabled="true" aria-label="${t(key)}" title="${t(key)}">${ICON[icon]}</span>`);
  return `<div class="x-risu-pkbp-pair${pair.ok ? '' : ' x-risu-pkbp-pairno'}"><span class="x-risu-pkbp-pairp">${pic(pair.a)}<span class="x-risu-pkbp-pairh">♥</span>${pic(pair.b)}</span>`
    + `<span class="x-risu-pkbp-pairt"><span class="x-risu-pkbp-pairk">${t('panel.breed.on')}</span>${how}</span>`
    + `<span class="x-risu-pkbp-pairb">${button('rebreed', 'swap', 'panel.breed.swap')}${button('unbreed', 'stop', 'panel.breed.stop')}</span></div>`;
}

function amieHtml(model, hit, picture) {
  const { lang } = model;
  const t = (key, values) => esc(say(lang, key, values));
  const cells = model.party.filter(slot => slot && !slot.egg).map(slot => {
    const off = model.locked || !slot.pet;
    const inner = `<span class="x-risu-pkbp-pic">${monImg(picture(slot))}</span><span class="x-risu-pkbp-info">`
      + `<span class="x-risu-pkbp-nm"><span class="x-risu-pkbp-nmt">${esc(slot.name)}</span>${genderMark(slot.gender, lang, slot.name)}</span>`
      + `<span class="x-risu-pkbp-r"><span>Lv${slot.level}${slot.fainted ? `<span class="x-risu-pkbp-st x-risu-pkbp-stfnt">${t('panel.fainted')}</span>` : ''}</span>`
      + `${model.debug ? `<span class="x-risu-pkbp-enj">${t('panel.amieEnjoy', { n: slot.enjoy })}</span>` : ''}</span></span>`;

    const ring = `<span class="x-risu-pkbp-ering" role="img" title="${t('amie.enjoy')}" aria-label="${t('amie.enjoy')}">${ringSvg('enjoy', slot.enjoy / ENJOY_MAX)}<i>${RING_ICON.enjoy}</i></span>`;
    return `<div class="x-risu-pkbp-cell">${ring}${off
      ? `<span class="x-risu-pkbp-slot x-risu-pkbp-off" aria-disabled="true">${inner}</span>`
      : `<button type="button" class="x-risu-pkbp-slot ${hit({ t: 'pet', uid: slot.uid })}">${inner}</button>`}</div>`;
  });
  return `<div class="x-risu-pkbp-hint">${t(model.locked ? 'panel.amieLocked' : 'panel.amieHint')}</div><div class="x-risu-pkbp-party">${cells.join('')}</div>`;
}

function travelHtml(model, hit) {
  const { travel, lang, locked } = model;
  const t = key => esc(say(lang, key));
  const cls = (...list) => list.filter(Boolean).join(' ');
  const sec = (head, body) => `<div class="x-risu-pkbp-sec"><div class="x-risu-pkbp-sech">${t(head)}</div>${body}</div>`;

  const clearOf = `x-risu-pkbp-gclr x-risu-pkbp-emo`, clearName = `title="${t('panel.travel.clear')}" aria-label="${t('panel.travel.clear')}"`;
  const clear = () => (locked ? `<span class="${clearOf} x-risu-pkbp-off" aria-disabled="true" ${clearName}>❌</span>`
    : `<button type="button" class="${clearOf} ${hit({ t: 'guideClear' })}" ${clearName}>❌</button>`);
  const guide = !travel.guide ? `<div class="x-risu-pkbp-guide x-risu-pkbp-muted">${t('panel.travel.guideOff')}</div>`
    : !travel.guide.text ? `<div class="x-risu-pkbp-guide x-risu-pkbp-muted">${t('panel.travel.none')}</div>`
      : `<div class="x-risu-pkbp-gtxt"><div class="x-risu-pkbp-guide">${esc(travel.guide.text)}</div>${clear()}</div>`;
  const goal = travel.guide?.goal ? `<div class="x-risu-pkbp-goal"><b>${t('panel.travel.goal')}</b><span>${esc(travel.guide.goal)}</span></div>` : '';
  const switches = travel.settings.map(({ key, on }) => {
    const look = cls('x-risu-pkbp-sw', on && 'x-risu-pkbp-on', key === 'banter' && 'x-risu-pkbp-swsub', locked && 'x-risu-pkbp-off');
    const inner = `<span>${t(`panel.travel.set.${key}`)}</span><span class="x-risu-pkbp-swk"></span>`;
    const state = `aria-checked="${on}" title="${t(on ? 'panel.travel.on' : 'panel.travel.off')}"`;
    return locked ? `<span class="${look}" role="switch" aria-disabled="true" ${state}>${inner}</span>`
      : `<button type="button" class="${look} ${hit({ t: 'botSet', key, on: !on })}" role="switch" ${state}>${inner}</button>`;
  }).join('');

  const start = travel.start.map(({ key, value }) => `<div class="x-risu-pkbp-row"><span class="x-risu-pkbp-rowk">${t(`panel.travel.row.${key}`)}</span><span class="x-risu-pkbp-rowv">${esc(textGenderSigns(value))}</span></div>`).join('');
  return sec('panel.travel.guide', guide + goal)
    + (locked ? `<div class="x-risu-pkbp-hint">${t('panel.travel.locked')}</div>` : '')
    + sec('panel.travel.settings', switches)
    + (start ? sec('panel.travel.start', start) : '');
}

function boxHtml(model, hit, picture) {
  const { box, lang } = model;
  const t = key => esc(say(lang, key));
  const nav = d => `<button type="button" class="x-risu-pkbp-nav ${hit({ t: 'boxnav', d })}" aria-label="${t(d < 0 ? 'panel.boxPrev' : 'panel.boxNext')}">${d < 0 ? ICON.prev : ICON.next}</button>`;

  const name = () => `<button type="button" class="x-risu-pkbp-boxname ${hit({ t: 'boxname' })}" title="${t('panel.rename')}"><span class="x-risu-pkbp-boxnm">${esc(box.name)}</span>`
    + `<span class="x-risu-pkbp-boxat">(${box.index + 1}/${box.count})</span></button>`;
  const head = `<div class="x-risu-pkbp-boxhd">${nav(-1)}${name()}${nav(1)}</div>`;
  const cells = box.cells.map(slot => (slot
    ? `<button type="button" class="x-risu-pkbp-bc${slot.fainted ? ' x-risu-pkbp-fnt' : ''}${model.picked === slot.uid ? ' x-risu-pkbp-picked' : ''} ${hit({ t: 'slot', where: 'box', uid: slot.uid })}" title="${esc(slot.egg ? slot.name : `${slot.name} Lv${slot.level}`)}">`
      + `${monImg(picture(slot))}</button>`
    : '<span class="x-risu-pkbp-bc x-risu-pkbp-bce"></span>'));
  return `${head}<div class="x-risu-pkbp-grid">${cells.join('')}</div>`;
}

function iconHtml(icon) {
  if (icon?.emoji) return `<span class="x-risu-pkbp-ic x-risu-pkbp-icem x-risu-pkbp-emo">${esc(icon.emoji)}</span>`;
  if (icon?.sheet === 'pokerogue') {
    return `<span class="x-risu-pkbp-ic"><span class="x-risu-pkbp-icpr"><span style="left:${icon.ox}px;top:${icon.oy}px;width:${icon.w}px;height:${icon.h}px;background-position:-${icon.x}px -${icon.y}px"></span></span></span>`;
  }
  if (icon?.sheet === 'showdown') {
    return `<span class="x-risu-pkbp-ic"><span class="x-risu-pkbp-icsd" style="background-position:-${(icon.num % 16) * 24}px -${Math.floor(icon.num / 16) * 24}px"></span></span>`;
  }
  return '<span class="x-risu-pkbp-ic"><span class="x-risu-pkbp-icdot"></span></span>';
}

function bagHtml(model, hit) {
  const { bag, lang } = model;
  const out = [];

  if (bag.money !== null) out.push(`<div class="x-risu-pkbp-money"><span>${esc(say(lang, 'panel.money'))}</span><b>${esc(moneyText(Number(bag.money).toLocaleString(lang), lang))}</b></div>`);
  if (!bag.groups.length) out.push(`<div class="x-risu-pkbp-none">${esc(say(lang, 'panel.bagEmpty'))}</div>`);
  for (const group of bag.groups) {
    out.push(`<div class="x-risu-pkbp-grp">${esc(group.label)}</div>`);
    for (const item of group.items) {
      out.push(`<button type="button" class="x-risu-pkbp-it${model.picked === item.id ? ' x-risu-pkbp-picked' : ''} ${hit({ t: 'item', item: item.id })}">`
        + `${iconHtml(item.icon)}<span class="x-risu-pkbp-itn">${esc(item.name)}</span><span class="x-risu-pkbp-itc">×${item.count}</span></button>`);
    }
  }
  return out.join('');
}

function windowHtml(win, hit, lang) {
  const options = (win.options ?? []).map(o => (o.disabled
    ? `<button type="button" class="x-risu-pkbp-opt x-risu-pkbp-off" aria-disabled="true">${esc(o.label)}</button>`
    : `<button type="button" class="x-risu-pkbp-opt${o.red ? ' x-risu-pkbp-optred' : ''} ${hit(o.hit)}">${esc(o.label)}</button>`));

  return `<div class="x-risu-pkbp-win ${OWN_CLASS}${win.error ? ' x-risu-pkbp-err' : ''}"><div class="x-risu-pkbp-wt">${esc(win.text)}</div>`
    + (win.count ? countHtml(win.count, hit, lang) : '')
    + (options.length ? `<div class="x-risu-pkbp-opts">${options.join('')}</div>` : '') + '</div>';
}

function countHtml({ n, max }, hit, lang) {
  const step = d => `<button type="button" class="x-risu-pkbp-nav ${hit({ t: 'count', d })}" aria-label="${esc(say(lang, d < 0 ? 'panel.less' : 'panel.more'))}">${d < 0 ? ICON.prev : ICON.next}</button>`;
  return `<div class="x-risu-pkbp-cnt">${step(-1)}<span class="x-risu-pkbp-cntn">×${n}</span>${step(1)}<span class="x-risu-pkbp-cntof">${esc(say(lang, 'panel.inBag', { n: max }))}</span></div>`;
}
