import { isNamedSprite } from '../../story/named.mjs';
import { loadFont } from '../../view/fonts.js';

const ENTRY_FONT = 'PkbPixel';

export const entryNamed = spec => (isNamedSprite(spec?.p2?.trainerSprite) ? { name: spec.p2.name ?? '' } : null);

// Animation timings (ms, press = 0). Change them only here
export const ENTRY_MS = Object.freeze({
  plateAt: 30, plate: 320,
  hit: 330, flash: 300,
  shake: 350,
  vsIn: 420, slide: 350,
  stamp: 720, stampIn: 90,
  thud: 180,
  vsEnd: 1400,
  namedImg: 300, namedRibbon: 560, namedShake: 300,
  namedEnd: 2620,
  away: 200,
  turnAt: 100, turn: 380,
  spreadAt: 550, spread: 320,
  flicker: 700,
  barsAt: 700, bars: 450, barStagger: 80,
  wildEnd: 1300, wildReveal: 350,
  ballAfter: 1000, ballOut: 150,
  exit: 500,
});

const closedAt = kind => (kind === 'wild' ? ENTRY_MS.barsAt + ENTRY_MS.barStagger + ENTRY_MS.bars : ENTRY_MS.plateAt + ENTRY_MS.plate);

const EASE = { plate: 'cubic-bezier(.7,0,.3,1)', slide: 'cubic-bezier(.2,.8,.3,1)', turn: 'cubic-bezier(.6,0,.3,1)', stamp: 'cubic-bezier(.5,0,.9,.6)' };

const PX = 100 / 600;
const MOTION = Object.freeze({ slide: 50 * PX, thud: 5 * PX });
const SHAKE = Object.freeze([[0, 0], [-7, 3], [6, -4], [-5, -2], [4, 3], [0, 0]].map(([x, y]) => [x * PX, y * PX]));

const PLATE = Object.freeze({ angle: -64, side: 2, edge: 0.012, edgeMin: 5 });
const PLATE_OUT = 115;
const PLATE_OPEN = 102;

export function namedPlace({ w, h }, { width: W, height: H }) {
  const scale = H / 80, width = Math.round(w * scale), height = Math.round(h * scale);
  const right = width <= W * 0.96 ? Math.min(W * (W >= H ? 0.10 : 0.02), W - width) : (W - width) / 2;
  return { width, height, right: Math.round(right), bottom: -Math.round(80 * scale * 0.12) };
}

const PLATE_CSS = {
  up: 'background:linear-gradient(to bottom,#c92633,#e3343f 70%,#ec4a54);',
  down: 'background:linear-gradient(to bottom,#fff,#f3f6f8 30%,#dfe6ec);',
};
const EDGE = '#151515';

export const ENTRY_CSS = `
  .poke-battle .pkb-entry { position:absolute; inset:0; z-index:6; overflow:hidden; pointer-events:none; container-type:size; --ink:#18242e; }
  .poke-battle .pkb-entry > * { --side:calc(${PLATE.side} * hypot(100cqw, 100cqh)); --edge:max(${PLATE.edgeMin}px, ${PLATE.edge * 100}cqmin);
    --fig:min(62cqh, 44cqw); --name:max(14px, 3.6cqmin); --vs:clamp(84px, 15cqw, 170px); --ribbon:max(18px, min(5cqw, 40px)); }
  @container (orientation: portrait) { .poke-battle .pkb-entry > * { --fig:min(36cqh, 70cqw); } }
  .poke-battle .pkb-entry .shake, .poke-battle .pkb-entry .layer { position:absolute; inset:0; }
  .poke-battle .pkb-entry .cov { position:absolute; left:50%; top:50%; width:var(--side); height:var(--side); margin:calc(var(--side) / -2) 0 0 calc(var(--side) / -2); }
  .poke-battle .pkb-entry .half { position:absolute; left:0; width:100%; height:50%; box-sizing:border-box; }
  .poke-battle .pkb-entry .half.up { top:0; ${PLATE_CSS.up} border-bottom:var(--edge) solid ${EDGE}; }
  .poke-battle .pkb-entry .half.down { bottom:0; ${PLATE_CSS.down} border-top:var(--edge) solid ${EDGE}; }
  .poke-battle .pkb-entry .bars div { position:absolute; left:0; right:0; height:0; background:#000; }
  .poke-battle .pkb-entry .who { position:absolute; display:flex; flex-direction:column; align-items:center; white-space:nowrap;
    font:var(--name)/1.2 ${ENTRY_FONT}, system-ui, sans-serif; }
  .poke-battle .pkb-entry .who canvas { display:block; height:var(--fig); image-rendering:pixelated; }
  .poke-battle .pkb-entry .who.me { left:1.5%; top:3%; }
  .poke-battle .pkb-entry .who.me canvas { filter:drop-shadow(4px 4px 0 #0003); }
  .poke-battle .pkb-entry .who.me.black canvas { filter:brightness(0) drop-shadow(4px 4px 0 #0005); }
  /* My uploaded picture (entry-art.js pictureFrame): inside the figure box (--fig square) at its own ratio, only scaled down, smoothly. A square photo (framed) gets a thin border frame */
  .poke-battle .pkb-entry .who.me canvas.pic { height:auto; max-width:var(--fig); max-height:var(--fig); image-rendering:auto; }
  .poke-battle .pkb-entry .who.me canvas.pic.framed { border:max(2px, .45cqmin) solid #f8f8f8; border-radius:3px; filter:none;
    box-shadow:0 0 0 2px #151515, 4px 4px 0 2px #0005; }
  .poke-battle .pkb-entry .who.foe { right:1.5%; bottom:2%; }
  .poke-battle .pkb-entry .who.foe canvas { filter:drop-shadow(-4px 4px 0 #0003); }
  .poke-battle .pkb-entry .who.foe.black canvas { filter:brightness(0) drop-shadow(-4px 4px 0 #0005); } /* Opponent silhouette: the same fill as mine, the shadow toward the opponent's side */
  .poke-battle .pkb-entry .who b { font-weight:400; padding:2px 12px; border-radius:6px; box-shadow:0 3px 0 #0006; color:#fff; }
  .poke-battle .pkb-entry .who.me b { margin-top:calc(var(--fig) * .06); background:#151515cc; }
  .poke-battle .pkb-entry .who.foe b { margin-bottom:calc(var(--fig) * .06); background:#151515; }
  .poke-battle .pkb-entry .who b:empty { display:none; }
  .poke-battle .pkb-entry .vs { position:absolute; left:50%; top:50%; width:var(--vs); overflow:visible; }
  .poke-battle .pkb-entry .named canvas { position:absolute; image-rendering:pixelated; filter:drop-shadow(-6px 6px 0 #0003); }
  .poke-battle .pkb-entry .named p { position:absolute; left:0; right:0; bottom:12%; margin:0; padding:10px 7%; background:rgba(24,36,46,.92);
    border-block:4px solid #e3343f; color:#f8f8f8; font:var(--ribbon)/1.2 ${ENTRY_FONT}, system-ui, sans-serif; letter-spacing:.04em;
    -webkit-font-smoothing:none; text-shadow:2px 2px 0 #585868; }
  .poke-battle .pkb-entry .flash { position:absolute; inset:0; background:#fff; opacity:0; }
  .poke-battle .pkb-entry .ball { position:absolute; left:50%; bottom:9%; width:30px; height:30px; margin-left:-15px; border-radius:50%; border:2.5px solid var(--ink);
    box-sizing:border-box; opacity:0; animation:pkb-entry-spin 1s linear infinite;
    background:radial-gradient(circle closest-side,#fff 0 22%,var(--ink) 22% 38%,transparent 38%),linear-gradient(to bottom,#e3343f 0 44%,var(--ink) 44% 56%,#fff 56%); }
  @keyframes pkb-entry-spin { to { transform:rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .poke-battle .pkb-entry .ball { animation-duration:3s; } }
  /* Before the panels have fully closed and while brightening after the battle: the window is transparent (the chat shows through). The battle window frame is hidden */
  .poke-battle.pkb-clear { background:transparent; }
  .poke-battle.pkb-clear > :not(.pkb-entry):not(.pkb-veil) { visibility:hidden; }
  /* Staying more than 1 second longer brings the strip's X above the panels (so preparing can be cancelled) */
  .poke-battle.pkb-entry-slow .band, .poke-battle.pkb-entry-slow .side.left { position:relative; z-index:7; } /* phone landscape: the X is in the left column */
`;

const VS_SVG = `<svg class="vs" viewBox="0 0 200 110" aria-hidden="true"><g transform="skewX(-10) translate(14 0)"
  fill="#ffd35c" stroke="#18242e" stroke-width="9" stroke-linejoin="round" paint-order="stroke">
  <polygon points="0,4 30,4 50,66 70,4 100,4 64,106 36,106"/>
  <path d="M190 4 H118 L106 16 V52 L118 64 H160 V80 H104 V106 H178 L190 94 V58 L178 46 H136 V30 H190 Z"/></g></svg>`;

// VS stamp sound (only when sound is on in the settings - runtime.js)
export const STAMP_SOUND = 'se/hit_strong.wav';

export function mountEntry(root, { kind = 'trainer', boss = false, named = null, names = {}, foeBlack = false, meBlack = true, reduced = false, start = performance.now(),
  pictures = Promise.resolve({}), sound = null } = {}) {
  const wild = kind === 'wild';
  const element = document.createElement('div');
  element.className = `pkb-entry ${wild ? 'wild' : 'trainer'}`;
  element.innerHTML = `<div class="shake">${wild ? '<div class="bars"></div>'
    : `<div class="cov"><div class="half up"></div><div class="half down"></div></div>
      <div class="layer vs-layer"><div class="who me"><b></b></div><div class="who foe"><b></b></div>${VS_SVG}</div>
      <div class="layer named"><p></p></div>`}</div><div class="flash"></div><div class="ball"></div>`;
  clearPage();
  root.classList.add('pkb-clear');
  root.append(element);
  const $ = selector => element.querySelector(selector);
  const shakeBox = $('.shake'), flash = $('.flash'), ball = $('.ball');

  const tween = (target, frames, at, duration, easing = 'ease', fill = 'both') => {
    const animation = target.animate(frames, { delay: at, duration, easing, fill });
    animation.startTime = start;
    return animation;
  };

  const moment = at => tween(element, [], at, 0, 'linear', 'none').finished;
  const shake = (at, ms) => { if (!reduced) tween(shakeBox, SHAKE.map(([x, y]) => ({ transform: `translate(${x}cqmin,${y}cqmin)` })), at, ms, 'ease', 'none'); };
  const flashAt = (at, from) => { if (!reduced) tween(flash, [{ opacity: from }, { opacity: 0 }], at, ENTRY_MS.flash, 'ease', 'none'); };
  const now = () => performance.now() - start;
  let opened = null, showWindow, openCalled;
  const visible = new Promise(resolve => { showWindow = resolve; });
  const loaded = new Promise(resolve => { openCalled = resolve; });

  let ballAt = Infinity, ballIn = null;
  const ballFrom = end => {
    if (now() >= ballAt) return;
    ballIn?.cancel();
    ballAt = end + ENTRY_MS.ballAfter;
    ballIn = tween(ball, [{ opacity: 0 }, { opacity: 1 }], ballAt, 200);
    ballIn.finished.then(() => root.classList.add('pkb-entry-slow'), () => {});
  };

  // Clears the ball too at clear time (at). If not shown yet, it never shows
  const ballAway = at => {
    if (at > ballAt) tween(ball, [{ opacity: 1 }, { opacity: 0 }], at, ENTRY_MS.ballOut, 'ease', 'forwards');
    else ballIn?.cancel();
  };
  const settle = done => done.finally(() => root.classList.remove('pkb-entry-slow'));
  const api = { element, shown: () => showWindow(), remove() { element.remove(); root.classList.remove('pkb-entry-slow', 'pkb-clear'); } };

  api.covered = moment(closedAt(kind)).then(() => root.classList.remove('pkb-clear'), () => {});

  if (wild) {

    if (!reduced) tween(flash, [0, 0.85, 0, 0.85, 0, 0].map(opacity => ({ opacity })), 0, ENTRY_MS.flicker, 'linear', 'none');
    const bars = $('.bars');
    for (let i = 0; i < 8; i++) {
      const bar = document.createElement('div');
      bar.style.top = `${i * 12.5}%`;
      bars.append(bar);
      tween(bar, [{ height: '0%' }, { height: '13%' }], ENTRY_MS.barsAt + (i % 2) * ENTRY_MS.barStagger, ENTRY_MS.bars);
    }
    ballFrom(ENTRY_MS.wildEnd);
    api.open = () => {
      if (opened) return opened;
      const at = Math.max(ENTRY_MS.wildEnd, now());
      ballAway(at);
      const reveal = tween(element, [{ opacity: 1 }, { opacity: 0 }], at, ENTRY_MS.wildReveal, 'ease', 'forwards');
      return (opened = { revealed: moment(at).then(() => {}), done: settle(reveal.finished.then(() => element.remove())) });
    };
    return api;
  }

  const font = loadFont(ENTRY_FONT).catch(error => console.warn('[poke-battle] 진입 연출 글꼴을 올리지 못함 — 대체 글꼴로', error));

  const cov = $('.cov'), up = $('.half.up'), down = $('.half.down');
  cov.style.transform = `rotate(${PLATE.angle}deg)`;
  tween(up, [{ transform: `translateY(-${PLATE_OUT}%)` }, { transform: 'none' }], ENTRY_MS.plateAt, ENTRY_MS.plate, EASE.plate);
  tween(down, [{ transform: `translateY(${PLATE_OUT}%)` }, { transform: 'none' }], ENTRY_MS.plateAt, ENTRY_MS.plate, EASE.plate);
  flashAt(ENTRY_MS.hit, 0.9);
  if (boss || named) shake(ENTRY_MS.hit, ENTRY_MS.shake);

  const vsLayer = $('.vs-layer'), namedLayer = $('.named'), ribbon = $('.named p');
  const me = $('.who.me'), foe = $('.who.foe'), mark = $('.vs');
  me.querySelector('b').textContent = names.me ?? '';
  foe.querySelector('b').textContent = names.foe ?? '';
  foe.classList.toggle('black', foeBlack);
  me.classList.toggle('black', meBlack);
  ribbon.textContent = named?.name ?? '';

  for (const el of [me, foe, mark, namedLayer]) el.style.opacity = '0';

  ballFrom(named ? ENTRY_MS.namedEnd : ENTRY_MS.vsEnd);

  const art = Promise.race([Promise.all([pictures.catch(() => ({})), font]).then(([got]) => got), loaded.then(() => ({}))]);
  const scene = Promise.all([art, visible]).then(([art]) => {
    if (!element.isConnected) return null;
    const lag = Math.max(0, now() - ENTRY_MS.vsIn), at = ENTRY_MS.vsIn + lag;
    if (named) {
      const big = art.named;
      if (big) {
        const place = namedPlace({ w: big.width, h: big.height }, { width: element.clientWidth, height: element.clientHeight });
        Object.assign(big.style, { width: `${place.width}px`, height: `${place.height}px`, right: `${place.right}px`, bottom: `${place.bottom}px` });
        namedLayer.insertBefore(big, ribbon);
        tween(big, [{ transform: 'translateX(40%)' }, { transform: 'none' }], at, ENTRY_MS.namedImg, EASE.slide);
      }
      tween(namedLayer, [{ opacity: 0 }, { opacity: 1 }], at, 160);
      tween(ribbon, [{ transform: 'translateX(100%)' }, { transform: 'none' }], ENTRY_MS.namedRibbon + lag, 300, EASE.slide);
      const hit = ENTRY_MS.stamp + lag;
      flashAt(hit, 0.45);
      shake(hit, ENTRY_MS.namedShake);
      if (sound) moment(hit).then(() => sound(STAMP_SOUND), () => {});
      ballFrom(ENTRY_MS.namedEnd + lag);
      return ENTRY_MS.namedEnd + lag;
    }

    if (art.me) me.prepend(art.me);
    if (art.foe) foe.append(art.foe);
    tween(me, [{ opacity: 0, transform: `translateX(-${MOTION.slide}cqmin)` }, { opacity: 1, transform: 'none' }], at, ENTRY_MS.slide, EASE.slide);
    tween(foe, [{ opacity: 0, transform: `translateX(${MOTION.slide}cqmin)` }, { opacity: 1, transform: 'none' }], at, ENTRY_MS.slide, EASE.slide);
    const stamp = ENTRY_MS.stamp + lag, landed = stamp + ENTRY_MS.stampIn;
    tween(mark, [{ opacity: 0 }, { opacity: 1 }], stamp, 50);
    tween(mark, [{ transform: 'translate(-50%,-50%) scale(1.5)' }, { transform: 'translate(-50%,-50%) scale(1)' }], stamp, ENTRY_MS.stampIn, EASE.stamp);
    flashAt(landed, 0.45);
    if (!reduced) tween(shakeBox, [{ transform: 'none' }, { transform: `translate(0,${MOTION.thud}cqmin)`, offset: 0.35 }, { transform: 'none' }], landed, ENTRY_MS.thud, 'ease', 'none');
    if (sound) moment(landed).then(() => sound(STAMP_SOUND), () => {});
    ballFrom(ENTRY_MS.vsEnd + lag);
    return ENTRY_MS.vsEnd + lag;
  });

  api.open = () => {
    if (opened) return opened;
    openCalled();
    const timeline = scene.then(end => {
      if (end === null) return null;

      const away = Math.max(end, now());
      ballAway(away);
      tween(named ? namedLayer : vsLayer, [{ opacity: 1 }, { opacity: 0 }], away, ENTRY_MS.away, 'ease', 'forwards');

      const turning = tween(cov, [{ transform: `rotate(${PLATE.angle}deg)` }, { transform: 'rotate(0deg)' }], away + ENTRY_MS.turnAt, ENTRY_MS.turn, EASE.turn);
      tween(up, [{ transform: 'none' }, { transform: `translateY(-${PLATE_OPEN}%)` }], away + ENTRY_MS.spreadAt, ENTRY_MS.spread, EASE.plate, 'forwards');
      const spreading = tween(down, [{ transform: 'none' }, { transform: `translateY(${PLATE_OPEN}%)` }], away + ENTRY_MS.spreadAt, ENTRY_MS.spread, EASE.plate, 'forwards');
      return { turning, spreading };
    });
    const revealed = timeline.then(t => t?.turning.finished).then(() => {});
    const done = timeline.then(t => t?.spreading.finished).then(() => element.remove());
    return (opened = { revealed, done: settle(done) });
  };
  return api;
}

function clearPage() {
  document.documentElement.style.background = 'transparent';
  document.documentElement.style.colorScheme = 'normal';
  Object.assign(document.body.style, { margin: '0', background: 'transparent' });
}

export async function backToChat(root) {
  clearPage();
  const veil = document.createElement('div');
  veil.className = 'pkb-veil';
  veil.style.cssText = 'position:absolute;inset:0;z-index:10;background:#000;pointer-events:none';
  root.append(veil);
  await veil.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ENTRY_MS.exit, easing: 'ease-in', fill: 'forwards' }).finished;
  root.classList.add('pkb-clear');
  await veil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ENTRY_MS.exit, easing: 'ease-out', fill: 'forwards' }).finished;
}
