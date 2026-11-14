import { NAVY, esc, roundHtml } from './frame-parts.js';
import { FRAME } from './amie-layout.js';
import { artSvg } from './amie-art.js';
import { STARS } from '../story/amie-games.mjs';
import { trayEndSvg, trayMiddleSvg, cardCornerSvg, recordTagSvg, TRAY_COLORS, CARD_COLORS } from './amie-frame-art.js';

const CARD = Object.freeze({
  tall: { band: 30, title: 15, strip: 36, star: 26, starGap: 4, score: 20, best: 12, picture: 40, tag: [80, 26], tagText: 12, tagRoom: 64, n: [16, 11] },
  wide: { band: 34, title: 16, strip: 40, star: 30, starGap: 5, score: 22, best: 13, picture: 42, tag: [92, 30], tagText: 13, tagRoom: 74, n: [18, 12] },
});

export const LOW_CARD = 459;

const COUNT_MOST = 999;

export const CARD_TIMES = Object.freeze({ card: 200, star: 70, pop: 120, tag: 300, fade: 150 });

const tallOf = f => f === FRAME.tall;
const ink = `var(--navy-dark, ${NAVY})`;

export const countText = count => (count == null ? '' : count > COUNT_MOST ? `×${COUNT_MOST}+` : `×${count}`);

export const foodLabel = (name, count) => (count == null ? name : `${name} ${countText(count)}`);

export function trayHtml(f, w) {
  const tall = tallOf(f), mid = w - 2 * f.plate.inset;
  return `<div class="tray" aria-hidden="true"><i class="l">${trayEndSvg({ tall, side: 'l' })}</i><i class="m">${trayMiddleSvg({ tall })}</i>`
    + `<i class="r">${trayEndSvg({ tall, side: 'r', mid })}</i></div>`;
}

export function trayCss(R, f, plate) {
  const P = f.plate, [nh, nf] = CARD[tallOf(f) ? 'tall' : 'wide'].n, T = TRAY_COLORS;
  return `
  ${R} .plate{position:absolute;left:${plate.left}px;bottom:${P.bottom}px;width:${plate.w}px;height:${P.h}px;}
  ${R} .plate:not([hidden]){animation:pkbTrayIn .18s ease-out;}
  @keyframes pkbTrayIn{from{opacity:0;transform:translateY(14px);}}
  ${R} .plate .tray{position:absolute;inset:0;pointer-events:none;}
  ${R} .plate .tray i{position:absolute;top:0;height:${P.h}px;}
  ${R} .plate .tray .l{left:0;} ${R} .plate .tray .r{right:0;} ${R} .plate .tray .m{left:${P.inset}px;right:${P.inset}px;}
  ${R} .plate .items{position:absolute;left:${P.inset}px;right:${P.inset}px;top:${Math.round(P.h * 0.16)}px;display:flex;justify-content:space-around;}
  ${R} .food{position:relative;flex:none;width:${P.food}px;height:${P.food}px;display:flex;align-items:center;justify-content:center;border:2px solid ${T.grain};border-radius:50%;
    background:#fff;box-shadow:0 3px 0 ${T.slot};}
  ${R} .food:nth-child(2n){margin-top:${Math.round(P.food * 0.42)}px;}
  ${R} .food > canvas,${R} .food > img,${R} .food > svg,${R} .food > .art{width:70%;height:70%;image-rendering:pixelated;}
  ${R} .food > .art svg{width:100%;height:100%;}
  ${R} .food > .emoji{font-size:${Math.round(P.food * 0.5)}px;line-height:1;font-family:"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif;}
  ${R} .food .n{position:absolute;right:-6px;bottom:-4px;box-sizing:border-box;min-width:${nh}px;height:${nh}px;padding:0 4px;border:1.5px solid ${ink};border-radius:${nh / 2}px;
    background:${CARD_COLORS.cream};color:${ink};box-shadow:0 1.5px 0 #1a3247;font-size:${nf}px;line-height:${nh - 3}px;text-align:center;white-space:nowrap;transform-origin:100% 50%;}
  ${R} .food .n.bump{animation:pkbBump .12s ease-out;}
  @keyframes pkbBump{50%{transform:scale(1.15);}}
  ${R} .food:active{transform:translateY(2px);box-shadow:0 1px 0 ${T.slot};}
  ${R} .plate .arrow{position:absolute;top:${Math.round(P.h * 0.32)}px;}
  ${R} .plate .arrow.l{left:0;} ${R} .plate .arrow.r{right:0;}
  ${R} .plate .dots{position:absolute;left:0;right:0;bottom:-20px;display:flex;justify-content:center;gap:6px;}
  ${R} .plate .dots i{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.6);border:1.5px solid ${ink};}
  ${R} .plate .dots i.on{background:var(--red, #d8434d);}
  @media (prefers-reduced-motion: reduce){${R} .plate,${R} .food .n{animation:none !important;}}
`;
}

export function cardCss(R, f) {
  const c = CARD[tallOf(f) ? 'tall' : 'wide'], C = CARD_COLORS, T = CARD_TIMES, K = `${R} .result`;
  return `
  ${K}{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(380px, calc(100% - ${2 * f.side}px));max-height:calc(100% - ${2 * f.side}px);z-index:2;
    box-sizing:border-box;display:flex;flex-direction:column;align-items:stretch;gap:0;padding:0;border-radius:14px;text-align:center;animation:pkbCardIn ${T.card}ms ease-out;}
  @keyframes pkbCardIn{from{opacity:0;transform:translate(-50%,-50%) scale(.94);}}
  ${K}.quiet{animation-duration:${T.fade}ms;} ${K}.quiet *{animation:none !important;}
  ${K}.out{opacity:0;transition:opacity ${T.fade}ms;}
  ${K} .hband{flex:none;margin:0;height:${c.band}px;padding:0 12px;border-radius:11.5px 11.5px 0 0;border-bottom:2.5px solid ${ink};box-shadow:inset 0 2px 0 rgba(255,255,255,.35);
    color:#fff;font-size:${c.title}px;line-height:${c.band}px;text-shadow:0 1px 0 ${NAVY},0 2px 0 #1a3247;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;position:relative;}
  ${K}.berry .hband{background:${C.berry};} ${K}.head .hband{background:${C.head};} ${K}.tile .hband{background:${C.tile};}
  ${K} .hband::before,${K} .hband::after{content:"";position:absolute;top:50%;left:10px;width:4px;height:4px;margin-top:-2px;background:rgba(255,255,255,.7);transform:rotate(45deg);}
  ${K} .hband::after{left:auto;right:10px;}
  ${K}.record .hband{padding:0 ${c.tagRoom}px;} ${K}.record .hband::after{display:none;}
  ${K} .in{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;align-items:center;gap:8px;padding:8px 12px 12px;}
  ${K} .stars{flex:none;display:flex;align-items:center;gap:${c.starGap}px;height:${c.strip}px;box-sizing:border-box;padding:0 12px;border:1.5px solid ${C.creamEdge};
    border-radius:${c.strip / 2}px;background:${C.cream};}
  ${K} .st{position:relative;width:${c.star}px;height:${c.star}px;} ${K} .st svg{width:100%;height:100%;}
  ${K} .st i{position:absolute;inset:0;animation:pkbStar ${T.pop}ms ease-out var(--d) both;}
  @keyframes pkbStar{0%{opacity:0;}1%{opacity:1;transform:scale(1);}50%{transform:scale(1.2);}100%{opacity:1;transform:scale(1);}}
  ${K} .scl{display:flex;flex-direction:column;align-items:center;gap:8px;}
  ${K} .sc{font-size:${c.score}px;line-height:1.2;}
  ${K} .best{font-size:${c.best}px;color:${C.best};}
  ${K} .prizes{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;}
  ${K} .prize{display:flex;align-items:center;gap:5px;padding:2px 9px 2px 3px;border:1.5px solid #9fb6c8;border-radius:14px;background:#fff;font-size:12px;white-space:nowrap;}
  ${K} .prize > :first-child{width:22px;height:22px;image-rendering:pixelated;}
  ${K} .foot{position:relative;align-self:stretch;display:flex;flex-direction:column;gap:8px;}
  ${K} .btns{display:flex;gap:10px;margin:0;}
  ${K} .btn{box-sizing:border-box;min-height:44px;white-space:nowrap;}
  ${K} .btn.picture{width:100%;min-height:${c.picture}px;display:flex;align-items:center;justify-content:center;gap:8px;}
  ${K} .btn.picture svg{width:18px;height:18px;}
  ${K} .round.picture svg{width:20px;height:20px;} ${K} .round.picture{display:none;}
  ${K} .cn{position:absolute;width:12px;height:12px;opacity:.6;pointer-events:none;}
  ${K} > .cn{top:${c.band + 6}px;} ${K} .cn.l{left:8px;} ${K} .cn.r{right:8px;} ${K} .foot .cn{top:-14px;} ${K} .foot .cn.l{left:-4px;} ${K} .foot .cn.r{right:-4px;}
  ${K} .rec{position:absolute;top:-12px;right:-8px;width:${c.tag[0]}px;height:${c.tag[1]}px;display:flex;align-items:center;justify-content:center;
    transform:rotate(-8deg);animation:pkbRec ${T.tag}ms ease-out var(--d) both;pointer-events:none;}
  ${K} .rec svg{position:absolute;inset:0;width:100%;height:100%;}
  ${K} .rec b{position:relative;font-weight:400;font-size:${c.tagText}px;color:${C.tagInk};margin-top:-2px;}
  @keyframes pkbRec{0%{opacity:0;transform:rotate(-8deg) scale(.6);}60%{opacity:1;transform:rotate(-8deg) scale(1.1);}100%{opacity:1;transform:rotate(-8deg) scale(1);}}
  ${K}.low .scl{flex-direction:row;align-items:baseline;gap:6px;} ${K}.low .best::before{content:"· ";}
  ${K}.low .btn.picture{display:none;} ${K}.low .round.picture{display:flex;}
  ${R} .toresult{position:absolute;left:50%;bottom:${f.side + 12}px;transform:translateX(-50%);z-index:2;flex:none;min-width:120px;width:auto;pointer-events:auto;}
  ${R} .toresult:active{transform:translate(-50%,2px);}
  @media (prefers-reduced-motion: reduce){${K},${K} *{animation:none !important;transition:none !important;}}
`;
}

export const cardClass = ({ game, record = false, height = 844, quiet = false }) =>
  ['result', 'sheet', game, record && 'record', height <= LOW_CARD && 'low', quiet && 'quiet'].filter(Boolean).join(' ');

export function cardHtml(f, { game, title, stars, score, best = null, record = false, picture = false, words }) {
  const tall = tallOf(f), max = STARS.at(-1), T = CARD_TIMES;
  let lit = 0;
  const starHtml = Array.from({ length: max }, (_, i) => {
    const on = stars >= i + 1 ? 'star' : stars >= i + 0.5 ? 'starHalf' : null;
    return `<span class="st">${artSvg('starOff')}${on ? `<i style="--d:${T.card + T.star * lit++}ms">${artSvg(on)}</i>` : ''}</span>`;
  }).join('');
  const corner = cardCornerSvg(game), cn = side => `<i class="cn ${side}">${corner}</i>`;
  const tile = artSvg('tile'), pick = `data-choice="picture"`;
  return `${cn('l')}${cn('r')}<p class="hband">${esc(title)}</p><div class="in">`
    + `<div class="stars" role="img" aria-label="${stars}/${max}">${starHtml}</div>`
    + `<div class="scl"><div class="sc">${esc(score)}</div>${best == null ? '' : `<div class="best">${esc(best)}</div>`}</div>`
    + '<div class="prizes"></div><div class="foot">'
    + (picture ? `<button type="button" class="btn picture" ${pick}>${tile}${esc(words.viewPicture)}</button>` : '')
    + '<div class="btns">'
    + (picture ? roundHtml('picture', tile, words.viewPicture).replace('<button ', `<button ${pick} `) : '')
    + `<button type="button" class="btn back" data-choice="back">${esc(words.gameBack)}</button>`
    + `<button type="button" class="btn main again" data-choice="again">${esc(words.again)}</button></div>${cn('l')}${cn('r')}</div></div>`
    + (record ? `<div class="rec" role="status" style="--d:${T.card + T.star * Math.max(0, lit - 1) + T.pop}ms">${recordTagSvg({ tall })}<b>${esc(words.newRecord)}</b></div>` : '');
}

export const toResultHtml = words => `<button type="button" class="btn toresult" hidden>${esc(words.backToResult)}</button>`;
