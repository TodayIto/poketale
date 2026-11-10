import { plateOf, plateFor, exitTop, gameBarFor, fabBox } from './amie-layout.js';
import { LOCKED, UNLOCKED } from './lock-icon.js';
import { NAVY, TAP, esc, partsCss, ringCss, fabHtml, rowHtml, roundHtml, exitsHtml, segHtml, pickSeg, bindLongPress } from './frame-parts.js';
import { artSvg, pixelSvg } from './amie-art.js';
import { genderMarkSvg, GENDER_MARK_COLORS, nameShowsGender } from './gender-mark.js';
import { ringSvg, ringDash, RING_COLOR, RING_ICON } from '../story/gauge-ring.mjs';
import { STARS } from '../story/amie-games.mjs';
import { badgeCss, bindBadge } from './reply-notice.js';

const puff = cream => `<svg viewBox="0 0 14 14" aria-hidden="true" shape-rendering="crispEdges"><g fill="${NAVY}">`
  + '<rect x="5" y="0" width="4" height="3"/><rect x="3" y="2" width="8" height="1"/><rect x="1" y="3" width="12" height="5"/>'
  + '<rect x="2" y="8" width="10" height="5"/><rect x="3" y="13" width="8" height="1"/></g>'
  + `<rect x="4" y="3" width="6" height="1" fill="${cream}"/><rect x="2" y="4" width="10" height="3" fill="${cream}"/>`
  + '<rect x="4" y="4" width="2" height="1" fill="#fff" opacity=".8"/>'
  + '<rect x="3" y="8" width="8" height="5" fill="#c98a5a"/><rect x="5" y="8" width="1" height="5" fill="#a86a3e"/><rect x="8" y="8" width="1" height="5" fill="#a86a3e"/>'
  + '<rect x="6" y="1" width="2" height="1" fill="#e0443f"/></svg>';
export const ICON = Object.freeze({
  feed: puff('#f4a6c0'),

  play: pixelSvg(['....NNNNNN....', '..NNbbbbbbNN..', '.NbbbbyybbbbN.', '.NbbbyyyybbbN.', 'NbbbbbyybbbbbN', 'NwwbbbbbbbbwwN', 'NbwwwbbbbwwwbN',
    'NbbbbwwwwbbbbN', 'NbbbbbbbbbbbbN', 'NwwbbbbbbbbwwN', '.NbwwwwwwwwbN.', '.NbbbbbbbbbbN.', '..NNbbbbbbNN..', '....NNNNNN....'],
  { N: NAVY, b: '#7cc4e8', w: '#fff', y: '#ffd84a' }),
  train: pixelSvg(['.....NN.....', '.....NN.....', '...NNNNNN...', '..NtttttttN.', '.NhttttttttN', '.NhttttttttN', '.NrrrrrrrrrN', '.NrrrrrrrrrN', '.NhttttttttN',
    '.NhttttttttN', '.NhttddddttN', '.NhttttttttN', '.NhttttttttN', '..NtttttttN.', '...NNNNNN...'],
  { N: NAVY, t: '#d9a35b', h: '#ecc590', r: '#d8434d', d: '#a5743a' }),
});

function css(f, width, plate) {
  const P = f.plate, ink = `var(--navy-dark, ${NAVY})`, drop = '0 2.5px 0 #1a3247';
  const fab = (name, b, left) => `.pkb-amie .fab.${name}{${left ? 'left' : 'right'}:${fabBox(b).side}px;bottom:${b.bottom}px;--d:${b.d}px;}`;
  return `
  ${partsCss('.pkb-amie')}
  .pkb-amie{position:absolute;inset:0;z-index:1;pointer-events:none;overflow:hidden;font-size:13px;line-height:1.35;}
  .pkb-amie[hidden]{display:none;}
  .pkb-amie .pet{position:absolute;inset:0;}
  .pkb-amie .exit{top:${exitTop(f)}px;} .pkb-amie .exit.back{left:${f.side}px;} .pkb-amie .exit.close{right:${f.side}px;}
  .pkb-amie .top{position:absolute;left:${f.side + TAP + f.gap}px;top:${f.top}px;display:flex;align-items:center;gap:${f.gap}px;}
  ${ringCss('.pkb-amie', f.ring)}
  .pkb-amie .ring.enjoy .ic{background:${RING_COLOR.enjoy};} .pkb-amie .ring.full .ic{background:${RING_COLOR.full};}
  .pkb-amie .chip{max-width:${Math.max(60, width - 2 * f.side - 2 * TAP - 2 * f.ring - 4 * f.gap)}px;overflow:hidden;text-overflow:ellipsis;
    padding:3px 11px;border:2.5px solid ${ink};border-radius:14px;background:rgba(255,255,255,.92);box-shadow:${drop};white-space:nowrap;}
  .pkb-amie .chip .g{font-size:12px;margin-left:3px;} .pkb-amie .chip .g svg{display:inline;vertical-align:baseline;} .pkb-amie .chip small{color:#5d7486;font-size:11px;margin-left:4px;}
  .pkb-amie .debug{position:absolute;left:${f.side}px;top:${f.top + f.ring + 6}px;display:flex;align-items:center;gap:6px;padding:1px 6px;border-radius:6px;background:rgba(15,24,34,.6);color:#fff;font-size:11px;}
  .pkb-amie .debug .lock{flex:none;display:flex;align-items:center;justify-content:center;width:32px;height:28px;margin:2px -4px 2px 0;border:2px solid ${NAVY};border-radius:7px;
    background:#fff;color:${NAVY};box-shadow:0 2px 0 ${NAVY};}
  .pkb-amie .debug .lock.on{border-color:#c98a1d;background:#fff3cf;color:#8a5a00;box-shadow:0 2px 0 #8a5a00;}
  .pkb-amie .debug .lock:active{transform:translateY(2px);box-shadow:none;}
  .pkb-amie .debug .lock svg{width:16px;height:16px;}
  .pkb-amie .say{position:absolute;left:50%;top:${f.top + f.ring + 8}px;transform:translateX(-50%);max-width:calc(100% - 24px);padding:3px 12px;border:2.5px solid ${ink};
    border-radius:14px;background:#fff;box-shadow:${drop};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .pkb-amie .debug:not([hidden]) + .say{top:${f.top + f.ring + 46}px;}
  .pkb-amie .plate{position:absolute;left:${plate.left}px;bottom:${P.bottom}px;width:${plate.w}px;height:${P.h}px;}
  .pkb-amie .plate .dish{position:absolute;inset:${Math.round(P.h * 0.11)}px ${Math.round(P.inset * 0.53)}px 0;border:3px solid ${ink};border-radius:50%;
    background:radial-gradient(ellipse at 50% 40%, #ffffff 0 55%, #dbe8f2 56% 64%, #ffffff 65%);box-shadow:0 4px 0 #1a3247;}
  .pkb-amie .plate .items{position:absolute;left:${P.inset}px;right:${P.inset}px;top:${Math.round(P.h * 0.16)}px;display:flex;justify-content:space-around;}
  .pkb-amie .food{position:relative;flex:none;width:${P.food}px;height:${P.food}px;display:flex;align-items:center;justify-content:center;border:2px solid #789db7;border-radius:50%;
    background:#fff;box-shadow:0 3px 0 #466c87;}
  .pkb-amie .food:nth-child(2n){margin-top:${Math.round(P.food * 0.42)}px;}
  .pkb-amie .food > canvas,.pkb-amie .food > img,.pkb-amie .food > svg,.pkb-amie .food > .art{width:70%;height:70%;image-rendering:pixelated;}
  .pkb-amie .food > .art svg{width:100%;height:100%;}
  .pkb-amie .food > .emoji{font-size:${Math.round(P.food * 0.5)}px;line-height:1;font-family:"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif;}
  .pkb-amie .food .n{position:absolute;right:-6px;bottom:-6px;padding:0 4px;border:1.5px solid ${ink};border-radius:7px;background:#fff;font-size:10px;line-height:13px;white-space:nowrap;}
  .pkb-amie .food:active{transform:translateY(2px);box-shadow:0 1px 0 #466c87;}
  .pkb-amie .plate .arrow{position:absolute;top:${Math.round(P.h * 0.32)}px;}
  .pkb-amie .plate .arrow.l{left:0;} .pkb-amie .plate .arrow.r{right:0;}
  .pkb-amie .plate .dots{position:absolute;left:0;right:0;bottom:-20px;display:flex;justify-content:center;gap:6px;}
  .pkb-amie .plate .dots i{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.6);border:1.5px solid ${ink};}
  .pkb-amie .plate .dots i.on{background:var(--red, #d8434d);}
  ${fab('feed', f.feed, true)} ${fab('play', f.play, false)} ${fab('train', f.train, false)}
  .pkb-amie .menu{position:absolute;right:${f.train.side}px;bottom:${f.play.bottom + f.play.d + 34}px;width:min(320px, calc(100% - ${2 * f.train.side}px));}
  .pkb-amie .gtop{position:absolute;left:0;right:0;top:0;height:${gameBarFor(f)}px;padding:0 ${f.side + TAP + 12}px;display:flex;flex-direction:column;justify-content:center;gap:5px;
    background:linear-gradient(rgba(15,24,34,.62),rgba(15,24,34,.4));color:#fff;text-shadow:0 1px 0 #0008;}
  .pkb-amie .gtop .ln{display:flex;align-items:baseline;justify-content:space-between;gap:10px;font-size:15px;white-space:nowrap;}
  .pkb-amie .gtop .ln span{min-width:0;overflow:hidden;text-overflow:ellipsis;}
  .pkb-amie .gtop .time{height:9px;border:1.5px solid #fff;border-radius:5px;background:rgba(255,255,255,.25);overflow:hidden;}
  .pkb-amie .gtop .time i{display:block;height:100%;background:#7cd650;}
  .pkb-amie .gtop .time.low i{background:#f0584a;}
  .pkb-amie .result{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(380px, calc(100% - ${2 * f.side}px));z-index:2;
    display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;}
  .pkb-amie .result .hd{margin:0;font-size:15px;}
  .pkb-amie .result .stars{display:flex;gap:4px;} .pkb-amie .result .stars svg{width:26px;height:26px;}
  .pkb-amie .result .sc{font-size:18px;}
  .pkb-amie .result .prizes{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;}
  .pkb-amie .result .prize{display:flex;align-items:center;gap:5px;padding:2px 9px 2px 3px;border:1.5px solid #9fb6c8;border-radius:14px;background:#fff;font-size:12px;white-space:nowrap;}
  .pkb-amie .result .prize > :first-child{width:22px;height:22px;image-rendering:pixelated;}
  .pkb-amie .result .btns{display:flex;gap:10px;width:100%;margin-top:4px;}
  ${badgeCss('.pkb-amie')}
  .pkb-amie .askshade{position:absolute;inset:0;z-index:2;pointer-events:auto;background:rgba(15,24,34,.35);}
  .pkb-amie .ask{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(340px, calc(100% - ${2 * f.side}px));z-index:4;
    display:flex;flex-direction:column;gap:10px;text-align:center;}
  .pkb-amie .ask .q{margin:2px 0 0;font-size:15px;}
  .pkb-amie .ask .btns{display:flex;gap:10px;width:100%;}
`;
}

export function mountAmieFrame(stage, { size, f, words, mon, picture, games, levels, level = levels[0], busy = () => false, select = () => {}, notice = null, on }) {
  const doc = stage.ownerDocument, plateAt = plateFor(size.width, f);
  const root = doc.createElement('div');
  root.className = 'pkb-amie';
  const ring = (kind, label) => `<div class="ring ${kind}" role="img" title="${esc(label)}" aria-label="${esc(label)}">${ringSvg(kind, 0)}`
    + `<span class="ic">${RING_ICON[kind]}</span></div>`;

  const sign = nameShowsGender(mon.name) ? '' : genderMarkSvg(mon.gender, { color: GENDER_MARK_COLORS[mon.gender] });
  const fab = (kind, word) => fabHtml(kind, word, ICON[kind]);
  let picked = levels.includes(level) ? level : levels[0];
  root.innerHTML = `<style>${css(f, size.width, plateAt)}</style>`
    + exitsHtml(words)
    + `<div class="pet"><div class="top">${ring('enjoy', words.enjoy)}${ring('full', words.fullness)}`
    + `<div class="chip">${esc(mon.name)}${sign ? `<span class="g">${sign}</span>` : ''}<small>Lv${esc(mon.level)}</small></div></div>`
    + '<div class="debug" hidden><span class="dt"></span><button type="button" class="lock" hidden></button></div><div class="say" hidden></div>'
    + `<div class="plate" role="group" aria-label="${esc(words.foodTitle)}" hidden><div class="dish"></div><div class="items"></div>`
    + roundHtml('arrow l', 'prev', words.prev) + roundHtml('arrow r', 'next', words.next)
    + '<div class="dots"></div></div>'
    + `<div class="menu sheet" role="dialog" aria-label="${esc(words.playTitle)}" hidden><p class="hd">${esc(words.playTitle)}</p>`
    + segHtml(words.levelTitle, levels.map(lv => [lv, words.levels[lv]]), picked)
    + games.map(game => rowHtml({ game }, artSvg(game), words.games[game])).join('')
    + '</div>'
    + fab('feed', words.feed) + fab('play', words.play) + fab('train', words.train)
    + '</div>'
    + `<div class="gtop" hidden><div class="ln"><span class="gn"></span><span class="gs"></span></div>`
    + `<div class="time" role="progressbar" aria-label="${esc(words.time)}" aria-valuemin="0" aria-valuemax="100"><i></i></div></div>`
    + '<div class="result sheet" role="dialog" hidden><p class="hd"></p><div class="stars"></div><div class="sc"></div><div class="prizes"></div>'
    + `<div class="btns"><button type="button" class="btn back">${esc(words.gameBack)}</button><button type="button" class="btn main again">${esc(words.again)}</button></div></div>`
    + `<div class="askshade" hidden></div><div class="ask sheet" role="alertdialog" hidden><p class="q"></p>`
    + `<div class="btns"><button type="button" class="btn main yes">${esc(words.yes ?? '')}</button><button type="button" class="btn no">${esc(words.no ?? '')}</button></div></div>`;
  stage.append(root);
  const $ = selector => root.querySelector(selector);
  const plate = $('.plate'), items = $('.items'), dots = $('.dots'), prev = $('.arrow.l'), next = $('.arrow.r'), menu = $('.menu');
  const feedButton = $('.fab.feed'), playButton = $('.fab.play'), say = $('.say'), debugLine = $('.debug'), debugText = $('.debug .dt'), lockButton = $('.debug .lock');
  let foods = [], page = 0, sayTimer = null, answer = null;

  const pressed = act => () => {
    if (busy()) return;
    select();
    act();
  };
  const press = (element, act) => element.addEventListener('click', pressed(act));

  function drawPlate() {
    const shown = plateOf(foods, plateAt.per, page);
    page = shown.page;
    items.replaceChildren(...shown.items.map(food => {
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'food';
      button.title = food.name;
      button.setAttribute('aria-label', food.name);
      button.append(picture(food.icon));

      if (food.count !== null) button.append(Object.assign(doc.createElement('span'), { className: 'n', textContent: `×${food.count}` }));

      bindLongPress(button, { tap: pressed(() => on.food(food, button)), long: () => on.name?.(food) });
      return button;
    }));
    prev.disabled = shown.page === 0;
    next.disabled = shown.page >= shown.pages - 1;
    prev.hidden = next.hidden = dots.hidden = shown.pages < 2;
    dots.innerHTML = Array.from({ length: shown.pages }, (_, i) => `<i${i === shown.page ? ' class="on"' : ''}></i>`).join('');
  }
  const openPlate = open => {
    plate.hidden = !open;
    feedButton.classList.toggle('on', open);
    if (open) drawPlate();
  };
  const openMenu = open => {
    menu.hidden = !open;
    playButton.classList.toggle('on', open);
  };

  press(feedButton, () => { openMenu(false); openPlate(plate.hidden); });
  press(playButton, () => { openPlate(false); openMenu(menu.hidden); });
  press($('.fab.train'), () => on.train());
  press(prev, () => { page--; drawPlate(); });
  press(next, () => { page++; drawPlate(); });
  const seg = menu.querySelector('.seg');
  for (const button of seg.querySelectorAll('button')) {
    press(button, () => { picked = button.getAttribute('data-value'); pickSeg(seg, picked); on.level?.(picked); });
  }
  for (const button of menu.querySelectorAll('.row')) press(button, () => { openMenu(false); on.game(button.getAttribute('data-game'), picked); });

  lockButton.addEventListener('click', () => { select(); on.lock?.(); });
  $('.exit.back').addEventListener('click', () => { select(); on.back?.(); });
  $('.exit.close').addEventListener('click', () => { select(); on.close?.(); });

  for (const choice of ['back', 'again']) $(`.result .btn.${choice}`).addEventListener('click', () => { if (answer) { select(); answer(choice); } });

  const unbadge = bindBadge(root, { notice, arrived: words.arrived });
  let asked = null;
  const settleAsk = yes => {
    if (!asked) return;
    const done = asked;
    asked = null;
    $('.ask').hidden = $('.askshade').hidden = true;
    done(yes);
  };
  $('.ask .yes').addEventListener('click', () => { select(); settleAsk(true); });
  $('.ask .no').addEventListener('click', () => { select(); settleAsk(false); });

  return {
    root,

    gauges({ enjoy, full }) {
      for (const [kind, share] of [['enjoy', enjoy], ['full', full]]) {
        const arc = root.querySelector(`.ring.${kind} .arc`);
        arc.setAttribute('stroke-dasharray', ringDash(share));
      }
    },

    setFoods(list) {
      foods = list.filter(food => food.count === null || food.count > 0);
      if (!plate.hidden) drawPlate();
    },
    get plateOpen() { return !plate.hidden; },
    get menuOpen() { return !menu.hidden; },

    back() {
      if (!menu.hidden) { openMenu(false); return true; }
      if (!plate.hidden) { openPlate(false); return true; }
      return false;
    },
    closeMenu() { openMenu(false); },

    talk(text, secs = 1.4) {
      say.textContent = text;
      say.hidden = false;
      clearTimeout(sayTimer);
      sayTimer = setTimeout(() => { say.hidden = true; }, secs * 1000);
    },

    debug(text, lock = null) {
      debugLine.hidden = text == null;
      debugText.textContent = text ?? '';
      lockButton.hidden = text == null || !lock;
      if (lockButton.hidden) return;
      lockButton.innerHTML = lock.on ? LOCKED : UNLOCKED;
      lockButton.classList.toggle('on', !!lock.on);
      lockButton.title = lock.label;
      lockButton.setAttribute('aria-label', lock.label);
    },

    show(on) { $('.pet').hidden = !on; if (on) $('.gtop').hidden = true; },

    game: {
      start(name) {
        $('.gtop .gn').textContent = name;
        $('.gtop .gs').textContent = '';
        $('.gtop').hidden = false;
      },
      score(text) { $('.gtop .gs').textContent = text; },
      time(share) {
        const bar = $('.gtop .time');
        bar.hidden = share == null;
        if (share == null) return;
        const left = Math.max(0, Math.min(1, share));
        bar.querySelector('i').style.width = `${(left * 100).toFixed(1)}%`;
        bar.classList.toggle('low', left < 0.25);
        bar.setAttribute('aria-valuenow', String(Math.round(left * 100)));
      },

      result({ title, stars, score, prizes }) {
        const card = $('.result');
        card.querySelector('.hd').textContent = title;
        const max = STARS.at(-1);
        card.querySelector('.stars').innerHTML = Array.from({ length: max }, (_, i) => artSvg(stars >= i + 1 ? 'star' : stars >= i + 0.5 ? 'starHalf' : 'starOff')).join('');
        card.querySelector('.stars').setAttribute('aria-label', `${stars}/${max}`);
        card.querySelector('.sc').textContent = score;
        card.querySelector('.prizes').replaceChildren(...prizes.map(prize => {
          const chip = doc.createElement('span');
          chip.className = 'prize';
          chip.append(prize.picture, `${prize.name}${prize.count > 1 ? ` ×${prize.count}` : ''}`);
          return chip;
        }));
        card.hidden = false;
        return new Promise(resolve => { answer = choice => { answer = null; card.hidden = true; resolve(choice); }; });
      },
      stop() { $('.gtop').hidden = true; $('.result').hidden = true; answer = null; },
    },

    ask(text) {
      settleAsk(false);
      $('.ask .q').textContent = text;
      $('.ask').hidden = $('.askshade').hidden = false;
      return new Promise(resolve => { asked = resolve; });
    },
    get asking() { return !!asked; },

    answer(yes) { const was = !!asked; settleAsk(yes); return was; },
    remove() { clearTimeout(sayTimer); unbadge(); settleAsk(false); root.remove(); },
  };
}
