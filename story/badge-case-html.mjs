import { esc } from './card.mjs';
import { say } from './screen-text.mjs';
import { BASE_TEXT, z } from './panel-zoom.mjs';

const C = '.x-risu-pkbp';

const STARS = [[34, 30, 26, 0.05], [66, 38, 18, 0.2], [44, 68, 22, 0.32], [70, 66, 15, 0.44], [26, 60, 13, 0.54], [58, 22, 16, 0.64]];
const STAR = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 0C10.8 6.6 13.4 9.2 20 10 13.4 10.8 10.8 13.4 10 20 9.2 13.4 6.6 10.8 0 10 6.6 9.2 9.2 6.6 10 0z" fill="#fffbe6"/></svg>';
const SPIN_S = 0.7;

export const BADGE_CSS = [
  `${C}-gcnt{margin-left:6px;color:#8193a1;letter-spacing:0;}`,
  `${C}-grow{display:flex;align-items:center;gap:6px;width:100%;min-height:${z(38)};margin-bottom:4px;padding:3px 6px 3px 10px;border:2px solid #a9c2d4;border-radius:10px;background:#fff;`
    + `box-shadow:0 2px 0 #c3d4e1;color:#14304a;cursor:pointer;text-align:left;}`,
  `${C}-grow:active{transform:translateY(1px);}`,
  `${C}-grow${C}-gno{color:#8193a1;background:#f6f9fb;}`,
  `${C}-grn{flex:none;max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}`,
  `${C}-gdot{flex:1;min-width:12px;height:0;border-bottom:2px dotted #a9c2d4;}`,

  `${C}-gpic{flex:none;position:relative;display:flex;align-items:center;justify-content:center;width:${z(30)};height:${z(30)};}`,
  `${C}-gpic img,${C}-gpic svg{display:block;max-width:100%;max-height:100%;}`,
  `${C}-gpic svg{width:100%;height:100%;}`,

  `${C}-gsil{filter:brightness(0) invert(.72);opacity:.75;}`,

  `${C}-grow${C}-gchamp{border-color:#d2a72c;box-shadow:0 2px 0 #b08a1e;background:#fffbea;}`,
  `${C}-grow${C}-gchamp${C}-gno{background:#fbf8ee;}`,
  `${C}-gtro{display:block;font-size:${z(22)};line-height:1;}`,
  `${C}-gdim{filter:grayscale(1);opacity:.4;}`,
  `${C}-gbig ${C}-gtro{font-size:${z(84)};}`,

  `${C}-gview{display:flex;flex-direction:column;align-items:stretch;gap:8px;}`,
  `${C}-gvtop{display:flex;align-items:center;gap:8px;}`,
  `${C}-gvname{flex:1;min-width:0;font-size:${z(15)};color:#14304a;}`,

  `${C}-gstage{position:relative;}`,
  `${C}-gnav{position:absolute;top:50%;z-index:2;display:flex;align-items:center;justify-content:center;width:${z(30)};height:${z(30)};margin-top:${z(-15)};padding:0;`
    + `border:2px solid #23435f;border-radius:50%;background:#fff;color:#23435f;box-shadow:0 2px 0 #1a3247;cursor:pointer;}`,
  `${C}-gnav svg{display:block;width:${z(11)};height:${z(11)};}`,
  `${C}-gnav:active{transform:translateY(1.5px);box-shadow:none;}`,
  `${C}-gnavp{left:${z(7)};} ${C}-gnavn{right:${z(7)};}`,

  `${C}-gbig{position:relative;display:flex;align-items:center;justify-content:center;width:100%;height:${z(150)};padding:0;font-size:${z(BASE_TEXT)};border:2.5px solid #23435f;border-radius:12px;overflow:hidden;`
    + `background:radial-gradient(circle at 50% 42%,#4a3460 0,#2a1d3a 58%,#1a1226 100%);box-shadow:inset 0 0 0 3px #6d5486,0 3px 0 #1a3247;cursor:pointer;perspective:400px;}`,
  `${C}-gbig${C}-gno{cursor:default;}`,
  `${C}-gbig ${C}-gpic{width:${z(104)};height:${z(104)};}`,
  `${C}-gbig ${C}-ic{transform:scale(3.6);}`,
  `${C}-gshine ${C}-gpic{animation:x-risu-pkbpgspin ${SPIN_S}s ease-out;}`,
  `${C}-gstar{position:absolute;display:block;opacity:0;transform:translate(-50%,-50%) scale(0);pointer-events:none;}`,
  `${C}-gstar svg{display:block;width:100%;height:100%;filter:drop-shadow(0 0 3px #fff6b0);}`,
  `${C}-gshine ${C}-gstar{animation:x-risu-pkbpgstar .55s ease-out forwards;}`,
  `@keyframes x-risu-pkbpgspin{0%{transform:rotateY(0);filter:brightness(1);} 35%{filter:brightness(1.7);} 100%{transform:rotateY(360deg);filter:brightness(1);} }`,
  `@keyframes x-risu-pkbpgstar{0%{opacity:0;transform:translate(-50%,-50%) scale(0) rotate(0);} 40%{opacity:1;transform:translate(-50%,-50%) scale(1.15) rotate(25deg);} `
    + '100%{opacity:0;transform:translate(-50%,-50%) scale(.2) rotate(70deg);} }',
  `@media (prefers-reduced-motion:reduce){${C}-gshine ${C}-gpic{animation:none;}}`,
  `${C}-gtap{margin-top:-2px;text-align:center;font-size:${z(11.5)};color:#5d7486;}`,
  `${C}-ginfo{display:grid;grid-template-columns:auto 1fr;gap:5px 10px;padding:8px 10px;border:2px solid #a9c2d4;border-radius:10px;background:#fff;font-size:${z(12.5)};}`,
  `${C}-ginfo dt{color:#5d7486;} ${C}-ginfo dd{margin:0;color:#14304a;word-break:keep-all;overflow-wrap:anywhere;}`,
].join(' ');

const picHtml = (pic, pics) => (pic.trophy ? '<span class="x-risu-pkbp-gtro" aria-hidden="true">🏆</span>' : pic.url ? pics.img(pic.url) : pics.icon(pic.icon));
const picSpot = (row, pics) => `<span class="x-risu-pkbp-gpic${row.earned ? '' : row.pic.trophy ? ' x-risu-pkbp-gdim' : ' x-risu-pkbp-gsil'}">${picHtml(row.pic, pics)}</span>`;

export function badgeCaseHtml(model, lang, hit, pics, { icon, swipe }) {
  const t = (key, values) => esc(say(lang, key, values));
  const { open } = model;
  if (open) {
    const none = t('badge.none');
    const who = { gym: 'badge.leader', trial: 'badge.captain', kahuna: open.queen ? 'badge.kahunaQueen' : 'badge.kahuna' }[open.kind];
    const info = [
      ...(open.kind === 'champion' ? [] : [[who, open.leader], [open.kind === 'gym' ? 'badge.city' : 'badge.site', open.place]]),
      ['badge.date', open.date], ['badge.party', open.party],
    ].map(([key, value]) => `<dt>${t(key)}</dt><dd>${value ? esc(value) : none}</dd>`).join('');
    const stars = open.earned && open.shine ? STARS.map(([x, y, size, delay]) => `<span class="x-risu-pkbp-gstar" style="left:${x}%;top:${y}%;width:${size / BASE_TEXT}em;height:${size / BASE_TEXT}em;animation-delay:${delay}s">${STAR}</span>`).join('') : '';
    const look = open.earned
      ? `<button type="button" class="x-risu-pkbp-gbig${open.shine ? ' x-risu-pkbp-gshine' : ''} ${hit({ t: 'gymShine' })}" data-shine="${open.shine}" aria-label="${esc(open.name)}">${picSpot(open, pics)}${stars}</button>`
      : `<div class="x-risu-pkbp-gbig x-risu-pkbp-gno">${picSpot(open, pics)}</div>`;

    const arrow = (d, to) => {
      const side = d < 0 ? 'x-risu-pkbp-gnavp' : 'x-risu-pkbp-gnavn', label = t(d < 0 ? 'badge.prev' : 'badge.next'), drawn = d < 0 ? icon.prev : icon.next;
      return to ? `<button type="button" class="x-risu-pkbp-gnav ${side} ${hit({ t: 'gymNav', d })}" aria-label="${label}" title="${label}">${drawn}</button>` : '';
    };

    const stage = `<div class="x-risu-pkbp-gstage ${swipe({ t: 'gymNav', d: -1 }, { t: 'gymNav', d: 1 })}">${arrow(-1, open.prev)}${look}${arrow(1, open.next)}</div>`;
    const line = t(open.earned ? (open.champion ? 'badge.tapTrophy' : 'badge.tap')
      : { gym: 'badge.notYet', trial: 'badge.notYetTrial', kahuna: 'badge.notYetTrial', champion: 'badge.notYetChampion' }[open.kind]);
    return `<div class="x-risu-pkbp-gview" role="dialog" aria-label="${esc(open.name)}"><div class="x-risu-pkbp-gvtop">`
      + `<button type="button" class="x-risu-pkbp-back ${hit({ t: 'gymClose' })}" aria-label="${t('panel.sc.back')}" title="${t('panel.sc.back')}">${icon.back}</button>`
      + `<span class="x-risu-pkbp-gvname">${esc(open.name)}</span></div>`
      + `${stage}${line ? `<div class="x-risu-pkbp-gtap">${line}</div>` : ''}<dl class="x-risu-pkbp-ginfo">${info}</dl></div>`;
  }
  return model.regions.map(region => `<div class="x-risu-pkbp-grp">${esc(region.name)}<span class="x-risu-pkbp-gcnt">${region.count}/${region.total}</span></div>`
    + region.rows.map(row => `<button type="button" class="x-risu-pkbp-grow${row.champion ? ' x-risu-pkbp-gchamp' : ''}${row.earned ? '' : ' x-risu-pkbp-gno'} ${hit({ t: 'gym', id: row.id })}">`
      + `<span class="x-risu-pkbp-grn">${esc(row.name)}</span><span class="x-risu-pkbp-gdot"></span>${picSpot(row, pics)}</button>`).join('')).join('');
}
