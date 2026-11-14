import { esc } from './card.mjs';
import { z } from './panel-zoom.mjs';
import { ballFrame } from '../view/ui/bag.js';
import { langPath } from '../view/lang-images.js';
import { artSvg } from '../view/amie-art.js';

const C = '.x-risu-pkbp';

export const SHEET_FRAMES = Object.freeze({

  types: Object.freeze({ w: 32, h: 14, rows: 20, order: Object.freeze(['unknown', 'bug', 'dark', 'dragon', 'electric', 'fairy', 'fighting', 'fire', 'flying', 'ghost', 'grass', 'ground', 'ice',
    'normal', 'poison', 'psychic', 'rock', 'steel', 'water', 'stellar']) }),

  categories: Object.freeze({ w: 28, h: 11, order: Object.freeze(['physical', 'special', 'status']) }),

  balls: Object.freeze({ w: 12, h: 12, sheetH: 246, y: Object.freeze({ gb: 174, lb: 186, mb: 198, pb: 210, rb: 222, ub: 234 }) }),
});

const TYPE_SCALE = 1.35, CATEGORY_SCALE = 1.35, BALL_SCALE = 1.5;

const SHEET_LANGS = ['ko', 'en'];

export const screenSheets = base => [
  ...SHEET_LANGS.map(lang => [`${C}-ty-${lang}`, `${base}${langPath('images/types_ko.png', lang)}`]),
  [`${C}-cat`, `${base}images/categories.png`],
  [`${C}-ball`, `${base}images/pb.png`],
];

export function screenCss(base) {
  const T = SHEET_FRAMES.types, K = SHEET_FRAMES.categories, B = SHEET_FRAMES.balls;
  return [
    `${C}-board${C}-scr ${C}-hd{gap:6px;}`,
    `${C}-back{display:flex;align-items:center;justify-content:center;flex:none;width:24px;height:22px;padding:0;border:1.5px solid #789db7;border-radius:6px;background:#fff;color:#23435f;box-shadow:0 1.5px 0 #466c87;cursor:pointer;}`,
    `${C}-back svg{display:block;width:12px;height:12px;}`,
    `${C}-back:active{transform:translateY(1px);box-shadow:none;}`,
    `${C}-hdt{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}`,
    `${C}-navn{font-size:${z(11)};color:#5d7486;white-space:nowrap;}`,

    `${C}-strip{flex:none;display:flex;align-items:center;gap:8px;margin:0 10px;padding:6px 0 5px;border-bottom:1.5px solid #dbe5ec;}`,
    `${C}-swipe{touch-action:pan-y;}`,
    `${C}-strip ${C}-navn{margin-left:auto;padding-left:4px;}`,
    `${C}-smon{position:relative;flex:none;display:block;width:${z(32)};height:${z(32)};padding:0;border:1.5px solid #8fb0c8;border-radius:50%;background:#dbe8f2;cursor:pointer;}`,
    `${C}-smon > span{display:block;width:100%;height:100%;border-radius:50%;overflow:hidden;}`,
    `${C}-smon img{display:block;width:100%;height:100%;object-fit:contain;image-rendering:pixelated;transform:scale(1.45);transform-origin:50% 62%;}`,
    `${C}-smon:active{transform:translateY(1px);}`,
    `${C}-smon${C}-on{border:2.5px solid #d8434d;box-shadow:0 0 0 2px #ffd35c;cursor:default;transform:none;}`,
    `${C}-smon${C}-fnt img{filter:grayscale(1);opacity:.6;}`,

    `${C}-hero{display:flex;gap:10px;align-items:center;margin-bottom:8px;}`,
    `${C}-hpic{position:relative;flex:none;width:${z(80)};height:${z(80)};border:2px solid #789db7;border-radius:14px;background:radial-gradient(circle at 50% 62%,#ffffff,#dbe8f2 70%);box-shadow:0 2.5px 0 #466c87;overflow:hidden;}`,
    `${C}-hpic img{display:block;width:100%;height:100%;object-fit:contain;image-rendering:pixelated;transform:scale(1.25);transform-origin:50% 60%;}`,
    `${C}-dex{position:absolute;left:5px;top:2px;font-size:${z(10)};color:#5d7486;}`,
    `${C}-hinfo{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;}`,
    `${C}-hname{display:flex;align-items:center;gap:5px;min-width:0;font-size:${z(16)};color:#14304a;}`,
    `${C}-hname b{font-weight:400;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}`,
    `${C}-hname ${C}-g{margin-left:auto;}`,
    `${C}-shiny{color:#d8a400;}`,
    `${C}-quill{display:flex;align-items:center;justify-content:center;flex:none;width:22px;height:20px;padding:0;border:1.5px solid #789db7;border-radius:6px;background:#fff;color:#23435f;box-shadow:0 1.5px 0 #466c87;cursor:pointer;}`,
    `${C}-quill svg{width:13px;height:13px;display:block;}`,
    `${C}-quill:active{transform:translateY(1px);box-shadow:none;}`,
    `${C}-hsub{font-size:${z(12)};color:#5d7486;}`,
    `${C}-htypes{display:flex;gap:4px;}`,
    `${C}-hhp{display:flex;align-items:center;gap:6px;font-size:${z(11)};color:#5d7486;white-space:nowrap;}`,
    `${C}-hhp ${C}-hpbar{flex:1;margin:0;height:6px;}`,

    `${C}-ty{flex:none;display:inline-block;width:${z(T.w * TYPE_SCALE)};height:${z(T.h * TYPE_SCALE)};background-repeat:no-repeat;background-size:${z(T.w * TYPE_SCALE)} ${z(T.h * T.rows * TYPE_SCALE)};image-rendering:pixelated;vertical-align:middle;}`,
    ...SHEET_LANGS.map(lang => `${C}-ty-${lang}{background-image:url("${base}${langPath('images/types_ko.png', lang)}");}`),
    `${C}-cat{flex:none;display:inline-block;width:${z(K.w * CATEGORY_SCALE)};height:${z(K.h * CATEGORY_SCALE)};background:url("${base}images/categories.png") no-repeat;`
      + `background-size:${z(K.w * K.order.length * CATEGORY_SCALE)} ${z(K.h * CATEGORY_SCALE)};image-rendering:pixelated;vertical-align:middle;}`,
    `${C}-ball{flex:none;display:inline-block;width:${z(B.w * BALL_SCALE)};height:${z(B.h * BALL_SCALE)};margin-right:4px;background:url("${base}images/pb.png") no-repeat;`
      + `background-size:${z(B.w * BALL_SCALE)} ${z(B.sheetH * BALL_SCALE)};image-rendering:pixelated;vertical-align:middle;}`,

    `${C}-seg{display:flex;margin:0 0 9px;padding:2px;border:2px solid #789db7;border-radius:9px;background:#fff;box-shadow:0 2.5px 0 #466c87;}`,
    `${C}-seg button{flex:1;padding:4px 0 3px;border:0;border-radius:6px;background:transparent;color:#5d7486;font-size:${z(13)};cursor:pointer;}`,
    `${C}-seg button${C}-on{background:#d8434d;color:#fff;box-shadow:0 2px 0 #8e2835;cursor:default;}`,
    `${C}-mini{display:inline-flex;margin-left:auto;padding:1px;border:1.5px solid #789db7;border-radius:7px;background:#fff;}`,
    `${C}-mini button{padding:1px 6px;border:0;border-radius:5px;background:transparent;color:#5d7486;font-size:${z(11)};cursor:pointer;}`,
    `${C}-mini button${C}-on{background:#23435f;color:#fff;cursor:default;}`,

    `${C}-scr ${C}-sech{display:flex;align-items:center;gap:6px;color:#a32634;}`,
    `${C}-scr ${C}-rowk{flex:0 0 auto;min-width:${z(70)};white-space:nowrap;}`,
    `${C}-scr ${C}-sec > ${C}-row:first-child{border-top:0;}`,
    `${C}-scr ${C}-rowv{display:flex;align-items:center;flex-wrap:wrap;gap:0 4px;}`,
    `${C}-red{font-weight:400;color:#d8434d;} ${C}-blue{color:#2f6fb8;}`,

    `${C}-stk{color:#3d5a70;}`,
    `${C}-up{color:#d8434d;} ${C}-down{color:#2f6fb8;} ${C}-gold{color:#b8860b;}`,

    `${C}-tri{display:inline-block;width:0;height:0;margin:0 1px 0 3px;border:4px solid transparent;vertical-align:1px;}`,
    `${C}-triup{border-top:0;border-bottom:7px solid currentColor;} ${C}-tridn{border-bottom:0;border-top:7px solid currentColor;}`,
    `${C}-nmk{font-size:${z(11.5)};white-space:nowrap;}`,
    `${C}-mint{flex-basis:100%;font-size:${z(11.5)};color:#5d7486;}`,
    `${C}-abn{font-size:${z(13.5)};color:#14304a;}`,
    `${C}-abd{margin-top:2px;font-size:${z(12)};color:#3d5a70;word-break:keep-all;overflow-wrap:anywhere;}`,

    `${C}-sec${C}-bondsec{display:flex;align-items:center;gap:8px;border-color:#e0719a;box-shadow:0 2px 0 #f3c1d3;}`,
    `${C}-sec${C}-bondlow{border-color:#8fa3b3;box-shadow:0 2px 0 #cdd8e0;}`,
    `${C}-bondi{flex:none;display:block;width:${z(14)};height:${z(12)};} ${C}-bondi svg{display:block;width:100%;height:100%;}`,
    `${C}-bond{flex:1;min-width:0;font-size:${z(12.5)};color:#14304a;word-break:keep-all;overflow-wrap:anywhere;}`,

    `${C}-stg{display:grid;grid-template-columns:1fr 1fr;gap:0 14px;}`,
    `${C}-st2{display:flex;align-items:baseline;justify-content:space-between;gap:6px;padding:4px 1px;border-top:1.5px solid #eef2f5;font-size:${z(13)};}`,
    `${C}-st2:nth-child(-n+2){border-top:0;}`,
    `${C}-st2 b{font-weight:400;color:#14304a;} ${C}-st2 small{font-size:${z(10)};color:#8193a1;}`,
    `${C}-foot{margin-top:4px;font-size:${z(11)};color:#8193a1;}`,
    `${C}-expl{display:flex;align-items:center;gap:6px;margin-top:5px;font-size:${z(10.5)};color:#5d7486;}`,
    `${C}-expb{flex:1;height:6px;border-radius:3px;background:#d4dfe7;overflow:hidden;box-shadow:inset 0 0 0 1px #c3d4e1;} ${C}-expb span{display:block;height:100%;background:#4aa3e8;}`,

    `${C}-mvs{display:flex;flex-direction:column;gap:5px;}`,
    `${C}-mv{display:flex;align-items:center;gap:6px;width:100%;min-height:${z(32)};padding:4px 8px 4px 6px;border:2px solid #a9c2d4;border-radius:10px;background:#fff;box-shadow:0 2px 0 #c3d4e1;color:#14304a;text-align:left;cursor:pointer;}`,
    `${C}-mv:active{transform:translateY(1px);}`,
    `${C}-mvstill{cursor:default;} ${C}-mvstill:active{transform:none;}`,
    `${C}-mvsel{border-color:#315a77;box-shadow:0 2.5px 0 #466c87;outline:3px solid #ffcf4a;outline-offset:0;}`,
    `${C}-mvnew{border-color:#d8434d;background:linear-gradient(160deg,#fff,#fdecee);box-shadow:0 2.5px 0 #8e2835;}`,
    `${C}-mvpick{border-style:dashed;border-color:#d8434d;} ${C}-mvpick${C}-mvsel{border-style:solid;border-color:#d8434d;}`,
    `${C}-mvn{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:${z(13.5)};}`,
    `${C}-mvpp{flex:none;font-size:${z(11.5)};color:#3d5a70;white-space:nowrap;}`,
    `${C}-radio{flex:none;width:14px;height:14px;border:2px solid #d8434d;border-radius:50%;background:#fff;} ${C}-radioon{background:#d8434d;box-shadow:inset 0 0 0 2.5px #fff;}`,
    `${C}-chip{flex:none;display:inline-block;padding:0 5px;border:1.5px solid #a9c2d4;border-radius:6px;background:#f4f9fc;color:#3d5a70;font-size:${z(10.5)};line-height:1.5;white-space:nowrap;}`,
    `${C}-chipred{border-color:#d8434d;background:#d8434d;color:#fff;}`,
    `${C}-chipevo{border-color:#8a6cc7;background:#8a6cc7;color:#fff;}`,
    `${C}-chipon{border-color:#23435f;background:#23435f;color:#fff;}`,

    `${C}-desc{position:sticky;bottom:0;z-index:1;margin-top:8px;padding:7px 10px 8px;border:2px solid #789db7;border-radius:10px;background:#fff;box-shadow:0 2.5px 0 #466c87;}`,
    `${C}-desct{display:flex;align-items:center;gap:7px;font-size:${z(13)};color:#14304a;}`,
    `${C}-descn{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}`,
    `${C}-descv{display:flex;align-items:center;gap:10px;margin-top:4px;font-size:${z(11.5)};color:#5d7486;}`,
    `${C}-descv b{font-weight:400;color:#14304a;}`,
    `${C}-descd{margin-top:5px;padding-top:5px;border-top:1.5px dashed #dbe5ec;font-size:${z(12.5)};color:#14304a;line-height:1.45;word-break:keep-all;overflow-wrap:anywhere;}`,
    `${C}-lab{margin:0 2px 6px;font-size:${z(11.5)};color:#5d7486;}`,

    `${C}-flow{display:flex;align-items:center;flex-wrap:wrap;gap:5px;margin:0 0 8px;padding:5px 8px;border:2px solid #ffcf4a;border-radius:9px;background:#fffbe8;font-size:${z(12)};color:#6b4a00;}`,
    `${C}-flowk{margin-right:auto;}`,
    `${C}-optred{color:#a32634;}`,
    `${C}-scr ${C}-wt{word-break:keep-all;overflow-wrap:anywhere;}`,
  ].join(' ');
}

const QUILL = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.6 2.4c-3.6.4-6.6 2.6-8.4 6.2L4 11.4l1 1 2.8-1.2c3.4-1.8 5.6-4.8 5.8-8.8z" fill="#fff" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M2.4 13.6l3.4-3.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
const UP = '<i class="x-risu-pkbp-tri x-risu-pkbp-triup"></i>', DOWN = '<i class="x-risu-pkbp-tri x-risu-pkbp-tridn"></i>';

export function typeBadge(type, lang) {
  const T = SHEET_FRAMES.types, at = Math.max(0, T.order.indexOf(String(type).toLowerCase()));
  return `<span class="x-risu-pkbp-ty x-risu-pkbp-ty-${SHEET_LANGS.includes(lang) ? lang : SHEET_LANGS[0]}" style="background-position:0 calc(-${at * T.h * TYPE_SCALE}px * var(--pkbp-z))" title="${esc(type)}"></span>`;
}
const categoryBadge = category => {
  const K = SHEET_FRAMES.categories, at = Math.max(0, K.order.indexOf(String(category).toLowerCase()));
  return `<span class="x-risu-pkbp-cat" style="background-position:calc(-${at * K.w * CATEGORY_SCALE}px * var(--pkbp-z)) 0" title="${esc(category)}"></span>`;
};
export const ballBadge = id => {
  const B = SHEET_FRAMES.balls, y = B.y[ballFrame(id)] ?? B.y.pb;
  return `<span class="x-risu-pkbp-ball" style="background-position:0 calc(-${y * BALL_SCALE}px * var(--pkbp-z))"></span>`;
};

export function screenHtml(view, lang, hit, helpers) {
  const cls = (...list) => list.filter(Boolean).join(' ');
  const back = view.back ? `<button type="button" class="${cls('x-risu-pkbp-back', hit({ t: 'scBack' }))}" aria-label="${esc(view.backLabel)}" title="${esc(view.backLabel)}">${helpers.icon.back}</button>` : helpers.icon.party;
  const head = `${back}<span class="x-risu-pkbp-hdt">${esc(view.title)}</span><span class="x-risu-pkbp-hdr">${esc(view.right)}</span>${helpers.fold}`;

  const swiped = view.nav ? helpers.swipe({ t: 'scNav', d: -1 }, { t: 'scNav', d: 1 }) : '';
  const strip = view.nav ? `<div class="${cls('x-risu-pkbp-strip', swiped)}" role="group" aria-label="${esc(view.navLabel)}">${view.nav.mons.map((m, i) => {
    const look = cls('x-risu-pkbp-smon', i + 1 === view.nav.at && 'x-risu-pkbp-on', m.fainted && 'x-risu-pkbp-fnt');
    const inner = `<span>${helpers.img(m)}</span>`;
    return i + 1 === view.nav.at ? `<span class="${look}" aria-current="true" title="${esc(m.name)}">${inner}</span>`
      : `<button type="button" class="${cls(look, hit({ t: 'scMon', uid: m.uid }))}" aria-label="${esc(m.name)}" title="${esc(m.name)}">${inner}</button>`;
  }).join('')}<span class="x-risu-pkbp-navn">${view.nav.at}/${view.nav.of}</span></div>` : '';
  const out = [];
  if (view.hero) out.push(heroHtml(view.hero, lang, hit, helpers, swiped));
  if (view.pages) {
    out.push(`<div class="x-risu-pkbp-seg">${view.pages.map(p => (p.id === view.page ? `<button type="button" class="x-risu-pkbp-on" aria-pressed="true">${esc(p.label)}</button>`
      : `<button type="button" class="${hit({ t: 'scPage', page: p.id })}" aria-pressed="false">${esc(p.label)}</button>`)).join('')}</div>`);
  }
  if (view.band) out.push(`<div class="x-risu-pkbp-flow"><span class="x-risu-pkbp-flowk">${esc(view.band.step)}</span>${view.band.chips.map(c => `<span class="x-risu-pkbp-chip x-risu-pkbp-chipon">${esc(c)}</span>`).join('')}</div>`);
  if (view.profile) out.push(profileHtml(view.profile, lang));
  if (view.stats) out.push(statsHtml(view.stats, hit));
  if (view.hint) out.push(`<div class="x-risu-pkbp-lab">${esc(view.hint)}</div>`);
  if (view.list) out.push(listHtml(view.list, lang, hit));
  return { head, strip, body: out.join('') };
}

function heroHtml(hero, lang, hit, helpers, swiped) {
  const width = hero.maxhp ? Math.round(hero.hp / hero.maxhp * 1000) / 10 : 0;
  return `<div class="x-risu-pkbp-hero${swiped ? ` ${swiped}` : ''}">`
    + `<div class="x-risu-pkbp-hpic">${helpers.img({ spriteId: hero.spriteId, shiny: hero.shiny })}<span class="x-risu-pkbp-dex">No.${String(hero.dex).padStart(4, '0')}</span></div>`
    + '<div class="x-risu-pkbp-hinfo">'
    + `<div class="x-risu-pkbp-hname"><b>${esc(hero.name)}</b>${hero.shiny ? '<span class="x-risu-pkbp-shiny">★</span>' : ''}`
    + `<button type="button" class="x-risu-pkbp-quill ${hit({ t: 'scRename' })}" aria-label="${esc(hero.rename)}" title="${esc(hero.rename)}">${QUILL}</button>${helpers.gender(hero.gender, hero.name)}</div>`
    + `<div class="x-risu-pkbp-hsub">${esc(hero.species)} · Lv${hero.level}</div>`
    + `<div class="x-risu-pkbp-htypes">${hero.types.map(type => typeBadge(type, lang)).join('')}</div>`
    + `<div class="x-risu-pkbp-hhp"><span class="x-risu-pkbp-hpbar"><span class="x-risu-pkbp-hpfill x-risu-pkbp-hp${hero.hpClass}" style="width:${width}%"></span></span>`
    + `<span>${hero.hp}/${hero.maxhp}</span>${helpers.statusMark(hero)}</div>`
    + '</div></div>';
}

const sec = (head, body, right = '') => `<div class="x-risu-pkbp-sec"><div class="x-risu-pkbp-sech">${esc(head)}${right}</div>${body}</div>`;
const row = (label, value) => `<div class="x-risu-pkbp-row"><span class="x-risu-pkbp-rowk">${esc(label)}</span><span class="x-risu-pkbp-rowv">${value}</span></div>`;

const bondHtml = ({ band, text }) => {
  const low = band === 'lowest';
  return `<div class="x-risu-pkbp-sec x-risu-pkbp-bondsec${low ? ' x-risu-pkbp-bondlow' : ''}"><span class="x-risu-pkbp-bondi">${artSvg(low ? 'heartCold' : 'heart')}</span>`
    + `<div class="x-risu-pkbp-bond">${esc(text)}</div></div>`;
};

function profileHtml(profile, lang) {
  const rows = profile.rows.map(r => {
    if (r.key === 'ball') return row(r.label, `${ballBadge(r.ball)}${esc(r.text)}`);
    if (r.key === 'tera') return row(r.label, typeBadge(r.type, lang));
    if (r.key === 'ot') return row(r.label, `<span class="x-risu-pkbp-blue">${esc(r.text)}</span>`);
    if (r.key === 'nature') {
      const n = r.nature;
      const marks = n.plus ? ` <span class="x-risu-pkbp-nmk"><span class="x-risu-pkbp-up">${esc(n.plus)}${UP}</span> <span class="x-risu-pkbp-down">${esc(n.minus)}${DOWN}</span></span>` : '';
      return row(r.label, `<span>${esc(n.before)}<b class="x-risu-pkbp-red">${esc(n.name)}</b>${esc(n.after)}</span>${marks}${n.mint ? `<span class="x-risu-pkbp-mint">${esc(n.mint)}</span>` : ''}`);
    }
    return row(r.label, r.none ? `<span class="x-risu-pkbp-muted">${esc(r.text)}</span>` : esc(r.text));
  }).join('');
  return `<div class="x-risu-pkbp-sec">${rows}</div>`
    + sec(profile.ability.label, `<div class="x-risu-pkbp-abn">${esc(profile.ability.name)}</div>${profile.ability.description ? `<div class="x-risu-pkbp-abd">${esc(profile.ability.description)}</div>` : ''}`)

    + (profile.friendship ? bondHtml(profile.friendship) : '');
}

function statsHtml(stats, hit) {
  const toggle = stats.modes.length > 1 ? `<span class="x-risu-pkbp-mini">${stats.modes.map(m => (m.id === stats.mode ? `<button type="button" class="x-risu-pkbp-on" aria-pressed="true">${esc(m.label)}</button>`
    : `<button type="button" class="${hit({ t: 'scStat', mode: m.id })}" aria-pressed="false">${esc(m.label)}</button>`)).join('')}</span>` : '';
  const cells = stats.cells.map(c => {
    const look = c.top ? ' x-risu-pkbp-gold' : c.up ? ' x-risu-pkbp-up' : c.down ? ' x-risu-pkbp-down' : '';
    const value = c.of ? `${c.value}<small>/${c.of}</small>` : esc(c.value);
    return `<div class="x-risu-pkbp-st2"><span class="x-risu-pkbp-stk${look}">${esc(c.label)}${c.up ? UP : c.down ? DOWN : ''}</span><b>${value}</b></div>`;
  }).join('');
  const note = stats.note ? `<div class="x-risu-pkbp-foot">${esc(stats.note.text)}</div>` : '';
  const exp = stats.exp;
  return sec(stats.title, `<div class="x-risu-pkbp-stg">${cells}</div>${note}`, toggle)
    + (exp ? sec(exp.title, row(exp.labels.total, esc(exp.total)) + row(exp.labels.next, esc(exp.next))
      + `<div class="x-risu-pkbp-expl"><span>Lv${exp.level}</span><span class="x-risu-pkbp-expb"><span style="width:${Math.round(exp.ratio * 1000) / 10}%"></span></span>${exp.nextLevel ? `<span>Lv${exp.nextLevel}</span>` : ''}</div>`) : '');
}

function listHtml(list, lang, hit) {
  const rows = list.rows.map((r, at) => {
    const look = ['x-risu-pkbp-mv', r.fresh && 'x-risu-pkbp-mvnew', at === list.selected && 'x-risu-pkbp-mvsel', r.pick && 'x-risu-pkbp-mvpick', list.still && 'x-risu-pkbp-mvstill'].filter(Boolean).join(' ');
    const mark = r.pick ? `<span class="x-risu-pkbp-radio${at === list.selected ? ' x-risu-pkbp-radioon' : ''}"></span>` : r.mark ? `<span class="x-risu-pkbp-chip x-risu-pkbp-chipred">${esc(r.mark)}</span>` : '';
    const chip = r.chip ? `<span class="x-risu-pkbp-chip${r.chip.evo ? ' x-risu-pkbp-chipevo' : ''}">${esc(r.chip.text)}</span>` : '';
    const pp = list.newPp || r.fresh && !list.still ? `PP ${r.maxpp}` : `PP ${r.pp}/${r.maxpp}`;
    const inner = `${mark}${chip}${typeBadge(r.type, lang)}<span class="x-risu-pkbp-mvn">${esc(r.name)}</span><span class="x-risu-pkbp-mvpp">${pp}</span>`;
    return list.still ? `<div class="${look}">${inner}</div>` : `<button type="button" class="${look} ${hit({ t: 'scMove', i: r.i })}">${inner}</button>`;
  }).join('');
  const d = list.detail;
  const box = d ? `<div class="x-risu-pkbp-desc"><div class="x-risu-pkbp-desct">${typeBadge(d.type, lang)}<span class="x-risu-pkbp-descn">${esc(d.name)}</span>${categoryBadge(d.category)}</div>`
    + `<div class="x-risu-pkbp-descv"><span>${esc(d.labels.power)} <b>${esc(d.power ?? d.labels.none)}</b></span><span>${esc(d.labels.accuracy)} <b>${esc(d.accuracy ?? d.labels.none)}</b></span></div>`
    + (d.description ? `<div class="x-risu-pkbp-descd">${esc(d.description)}</div>` : '') + '</div>' : '';
  return `<div class="x-risu-pkbp-mvs">${rows}</div>${box}`;
}
