import { SEND_MS, ICON_PLANE, noteRule } from '../../story/card.mjs';

export const END_GUARD_MS = 500;

export function outcomeLine(outcome, caught = '') {
  const lines = { win: '승부에서 이겼다!', lose: '승부에서 졌다…', forfeit: '승부에서 물러났다…', run: '무사히 도망쳤다!' };
  if (outcome === 'capture') {
    const name = caught || '포켓몬';
    const batchim = /[가-힣]$/.test(name) && (name.charCodeAt(name.length - 1) - 0xac00) % 28 !== 0;
    return `${name}${batchim ? '을' : '를'} 잡았다!`;
  }
  return lines[outcome] ?? '';
}

export const PLANE = ICON_PLANE;

export const END_CSS = `
  .poke-battle .screen { container-type:inline-size; }
  .poke-battle .end { position:absolute; inset:0; z-index:2; cursor:pointer; -webkit-tap-highlight-color:transparent; user-select:none;
    background:rgba(6,9,14,.985); animation:pkb-sink .45s ease-out both; }
  .poke-battle .end[hidden] { display:none; }
  /* One result line: the battle screen's pixel font (BattleViewEmerald, loaded by view/ui/text.js), white text + grey shadow (message box style) */
  .poke-battle .end .word { position:absolute; left:0; right:0; top:20%; margin:0; padding:0 4%; text-align:center; color:#f8f8f8;
    font-family:BattleViewEmerald, system-ui, sans-serif; font-weight:400; font-size:clamp(18px, 5cqw, 46px); line-height:1.2;
    letter-spacing:.04em; -webkit-font-smoothing:none; text-shadow:.08em .08em 0 #585868; animation:pkb-word .5s .12s ease-out both; }
  .poke-battle .end .btns { position:absolute; left:50%; top:58%; transform:translate(-50%,-50%); width:clamp(180px, 40cqw, 380px);
    display:flex; flex-direction:column; gap:clamp(14px, 3.6cqw, 32px); cursor:default; }
  .poke-battle .end .btns[hidden] { display:none; }
  .poke-battle .end .hint { position:absolute; left:0; right:0; bottom:6%; margin:0; text-align:center; color:#8696a5; opacity:.7;
    font-size:clamp(11px, 1.6cqw, 15px); font-weight:600; letter-spacing:.04em; }
  @keyframes pkb-sink { from { background:rgba(6,9,14,0); } to { background:rgba(6,9,14,.985); } }
  @keyframes pkb-word { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
  @media (prefers-reduced-motion: reduce) { .poke-battle .end, .poke-battle .end .word { animation-duration:.01s; } }
  .poke-battle .end button { font:inherit; font-weight:700; font-size:clamp(14px, 2.3cqw, 22px); letter-spacing:.04em; width:100%;
    min-height:clamp(38px, 6.2cqw, 58px); display:flex; align-items:center; justify-content:center; gap:.5em; padding:.35em .9em;
    border:2.5px solid var(--red-dark); border-radius:12px; background:var(--red-fill); color:#fff;
    box-shadow:0 4px 0 var(--red-dark); text-shadow:0 1px 0 #0004; cursor:pointer; }
  .poke-battle .end button.retry { border-color:var(--navy); background:var(--paper); color:var(--navy);
    box-shadow:0 4px 0 var(--navy-dark); text-shadow:none; }
  .poke-battle .end button[hidden] { display:flex; visibility:hidden; } /* keeps its room — the send button always in the same place */
  .poke-battle .end button:active { transform:translateY(3px); box-shadow:0 1px 0 var(--red-dark); }
  .poke-battle .end button.retry:active { box-shadow:0 1px 0 var(--navy-dark); }
  .poke-battle .end button:focus-visible { outline:3px solid #ffd35c; outline-offset:2px; }
  .poke-battle .end button:disabled { cursor:default; }
  .poke-battle .end button .icon { position:relative; display:inline-flex; width:1.15em; height:1.15em; }
  .poke-battle .end button svg { width:100%; height:100%; display:block; }
  ${noteRule('.poke-battle .end .note', 'error')}
  .poke-battle .end .note { margin:0; font-size:clamp(12px, 1.7cqw, 15px); text-align:center; }
  .poke-battle .end .note:empty { display:none; }
  /* A short flying paper-plane motion + a brief ✓ — the same as the strip's paper plane */
  .poke-battle .flying svg { animation:pkb-fly ${SEND_MS.fly}ms ease-in forwards; }
  .poke-battle .flying .icon::after, .poke-battle .flying.icon-host::after { content:'✓'; position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
    font-weight:900; opacity:0; animation:pkb-ok ${SEND_MS.ok}ms ${SEND_MS.okDelay}ms ease-out forwards; }
  .poke-battle .shaking { animation:pkb-shake ${SEND_MS.shake}ms ease-in-out; }
  @keyframes pkb-fly { 0% { transform:none; opacity:1; } 30% { transform:translate(-12%,8%) rotate(-6deg); } 100% { transform:translate(150%,-130%) rotate(-14deg) scale(.6); opacity:0; } }
  @keyframes pkb-ok { 0% { opacity:0; transform:scale(.4); } 35% { opacity:1; transform:scale(1.15); } 70% { opacity:1; transform:none; } 100% { opacity:1; } }
  @keyframes pkb-shake { 0%,100% { translate:0; } 20% { translate:-3px; } 40% { translate:3px; } 60% { translate:-2px; } 80% { translate:2px; } }
  @media (prefers-reduced-motion: reduce) { .poke-battle .flying svg { animation-duration:.01s; } .poke-battle .shaking { animation:none; } }
`;

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const animationsDone = element => Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {})));

// Restart the same animation (remove the class, force a style calculation, add it again)
function restart(button, cls) {
  button.classList.remove('shaking', 'flying');
  void button.offsetWidth;
  button.classList.add(cls);
}

export async function flyAway(button, { hold = 900 } = {}) {
  restart(button, 'flying');
  const plane = button.querySelector('svg');
  if (plane) await animationsDone(plane);
  await wait(hold);
  button.classList.remove('flying');
}

// Only a slight shake when there is no new turn since last time
export async function shake(button) {
  restart(button, 'shaking');
  await animationsDone(button);
  button.classList.remove('shaking');
}

export function mountEndScreen(screen, { outcome = '', caught = '', retry = false, send = false, onChoice = () => {} }) {
  const end = document.createElement('div');
  end.className = 'end';
  end.dataset.outcome = outcome;
  end.innerHTML = `<p class="word"></p><div class="btns">
      <button class="retry" type="button">↻ 다시 하기</button>
      <button class="send" type="button"><span>이야기로 보내기</span><span class="icon">${PLANE}</span></button>
      <p class="note" role="alert"></p>
    </div><p class="hint">아무 데나 누르면 채팅으로</p>`;
  end.querySelector('.word').textContent = outcomeLine(outcome, caught);
  const $ = selector => end.querySelector(selector);
  const retryButton = $('.retry'), sendButton = $('.send'), note = $('.note');
  retryButton.hidden = !retry;
  sendButton.hidden = !send;
  if (!retry && !send) $('.btns').hidden = true;
  retryButton.onclick = event => { event.stopPropagation(); onChoice('retry'); };
  sendButton.onclick = event => { event.stopPropagation(); onChoice('send'); };
  end.addEventListener('click', event => { if (!event.target.closest('.btns')) onChoice('confirm'); });
  screen.append(end);
  return {
    element: end,

    note(text) { note.textContent = text ?? ''; },
    busy(on) { retryButton.disabled = sendButton.disabled = !!on; },
    fly: () => flyAway(sendButton, { hold: 450 }),
    remove() { end.remove(); },
  };
}
