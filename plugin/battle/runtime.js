import * as sim from '../../engine/browser-engine.mjs';
import { loadLevelUp, EXP_TABLE } from './level-tables.js';
import { createBattleView } from '../../view/index.js';
import { createBattleSession, isWild } from './flow.js';
import { mark, clearBattleMarks } from './marks.js';
import { END_CSS, END_GUARD_MS, mountEndScreen, flyAway, shake, PLANE } from './end-screen.js';
import { UI_VARS, CARD_FRAME, rowButtonsCss, crossIcon } from './ui-css.js';
import { PHONE_CSS, isPhone, layoutOf, mountPhoneLayout, choiceCursor } from './phone.js';
import { ENTRY_CSS, mountEntry, backToChat, entryNamed, STAMP_SOUND } from './entry.js';
import { entryPictures, entrySound } from './entry-art.js';
import { PLAYER_NAME } from '../../story/state.mjs';
import { mountLoading } from './loading.js';
import { outcomeOf, isLoss } from '../../story/outcome.mjs';
import { noteLooks, noteRule } from '../../story/card.mjs';
import { WHAT, failureLines, failureText } from '../../story/failure.mjs';
import { SHEET_FONT } from '../../story/style.mjs';
import { loadFont } from '../../view/fonts.js';
import { names } from '../../names/index.js';
import { DEFAULT_SPEED, nextSpeed } from '../../view/game-speed.js';

// Our UI icons (icons only, no text)
const ICON = {
  leave: crossIcon(2.6),
  send: PLANE,
  fold: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M2.5 5h11L8 12z"/></svg>',

  speed: speed => `<span class="mul">x${speed}</span>`,


};

// Orientation button label: what pressing it turns the layout to

const SEND_NOTE_MS = 4000;

const humanError = error => failureLines(WHAT.open, error);

export function mountBattle({ parent = document.body, fetchBytes, onClose = () => {}, spec, development = false, createView = createBattleView,
  bgm                                                                              , story,
  iron = false, onCollapse, onRetry, viewOptions: extraViewOptions = {}, onSpeed, phone = isPhone(), me = { black: true, image: null } }) {
  loadFont(SHEET_FONT).catch(error => console.warn('[poke-battle] 배틀 창 글꼴을 올리지 못함, 대체 글꼴로', error));
  const root = document.createElement('section');
  root.className = 'poke-battle';
  root.innerHTML = `<style>
    .poke-battle { --band:36px; ${UI_VARS}
      position:fixed; inset:0; z-index:100; display:flex; justify-content:center; align-items:center; overflow:hidden; /* strip + 16:9 centred vertically in the stage (chat column) */
      background:#0f1822; color:#f8f8f8; font:16px/1.5 system-ui,sans-serif; }
    .poke-battle * { box-sizing:border-box; }
    /* Only the battle screen below the strip is 16:9. Wide window = smaller by the strip, empty at the sides; tall window = strip, battle, empty space below */
    .poke-battle .frame { flex:none; display:flex; flex-direction:column; width:min(100vw, calc((100vh - var(--band)) * 16 / 9)); }
    .poke-battle .band { flex:none; height:var(--band); display:flex; align-items:center; gap:8px; padding:0 2px; }
    .poke-battle .band .grow { flex:1; }
    .poke-battle .band button { flex:none; width:28px; height:26px; padding:0; display:flex; align-items:center; justify-content:center;
      border:2px solid var(--navy); border-radius:7px; background:#fff; color:var(--navy); box-shadow:0 2.5px 0 var(--navy-dark); cursor:pointer; }
    .poke-battle .band button:active { transform:translateY(2px); box-shadow:0 .5px 0 var(--navy-dark); }
    .poke-battle .band button:focus-visible { outline:2px solid #ffd35c; outline-offset:2px; }
    .poke-battle .band button[hidden] { display:none; }
    .poke-battle .band button svg { width:16px; height:16px; display:block; }
    .poke-battle .band .leave { color:var(--red); }
    .poke-battle .band .leave svg { width:13px; height:13px; }
    .poke-battle .screen { position:relative; width:100%; aspect-ratio:16 / 9; overflow:hidden; background:#203040; }
    .poke-battle .stage { position:absolute; inset:0; }
    .poke-battle .band .send, .poke-battle .side .send { position:relative; }${END_CSS}${PHONE_CSS}${ENTRY_CSS}
    /* Speed button: wider by its multiplier label (after the phone layout's button width) */
    .poke-battle .band button.speed, .poke-battle .side button.speed { width:auto; min-width:28px; padding:0 5px; gap:1px; }
    .poke-battle.pkb-portrait .band button.speed, .poke-battle.pkb-landscape .side button.speed { min-width:var(--tap); }
    .poke-battle .band .speed svg, .poke-battle .side .speed svg { width:14px; height:14px; }
    .poke-battle .speed .mul { font-size:12px; font-weight:800; line-height:1; }
    .poke-battle.pkb-portrait .speed .mul, .poke-battle.pkb-landscape .speed .mul { font-size:calc(var(--tap) * .28); }
    .poke-battle pre { white-space:pre-wrap; overflow-wrap:anywhere; font-size:12px; }
    .poke-battle details { margin:20px 0; }
    /* Small window in the card style (error, leave confirmation) */
    .poke-battle .oops, .poke-battle .confirm { position:absolute; inset:0; z-index:4; display:flex; align-items:center; justify-content:center; padding:16px; }
    .poke-battle .oops { z-index:3; background:#15202d; }
    .poke-battle .confirm { background:#0008; }
    .poke-battle .oops[hidden], .poke-battle .confirm[hidden] { display:none; }
    .poke-battle .card { width:min(360px, 100%); max-height:100%; overflow:auto; ${CARD_FRAME}
      color:var(--ink); font-weight:700; font-size:14px; line-height:1.5; }
    .poke-battle .card .hd { padding:5px 12px; background:var(--red); color:#fff; font-size:14px; border-bottom:2.5px solid var(--red-dark); text-shadow:0 1px 0 #0005; }
    .poke-battle .card .hd.navy { background:var(--navy); border-bottom-color:var(--navy-dark); }
    .poke-battle .card .bd { padding:12px 14px 14px; }
    .poke-battle .card p { margin:0 0 4px; white-space:pre-line; }
    .poke-battle .card .sub { font-size:12.5px; color:#5b768b; }
    ${rowButtonsCss('.poke-battle .card .row')}
    .poke-battle .card .row button:active { transform:translateY(2px); box-shadow:0 1px 0 var(--navy-dark); }
    .poke-battle .card details { margin:12px 0 0; font-size:12px; color:#5b768b; }
    .poke-battle .card summary { cursor:pointer; }
    .poke-battle .card pre { max-height:160px; overflow:auto; margin:6px 0; padding:6px; border:1.5px solid #c1d2df; border-radius:6px; background:#fff; color:#2c4a62; font-weight:400; }
    .poke-battle .card .copy { font:inherit; font-size:12px; padding:2px 8px; border:1.5px solid var(--navy); border-radius:6px; background:#fff; color:var(--navy); cursor:pointer; }
    /* Line over the view during the battle (showNote). Look by its kind (NOTE_LOOK) */
    .poke-battle .sendnote { position:absolute; left:50%; top:8px; transform:translateX(-50%); z-index:3; max-width:calc(100% - 24px); margin:0;
      font-size:13px; text-align:center; }
    ${noteLooks(kind => `.poke-battle .sendnote.${kind}`).join(' ')}
    .poke-battle .sendnote[hidden] { display:none; }
    /* Story arrival: a small red dot on the fold button (storyDot) */
    .poke-battle .fold { position:relative; }
    .poke-battle .fold.dot::after { content:''; position:absolute; top:-4px; right:-4px; width:9px; height:9px; border-radius:50%; background:var(--red); box-shadow:0 0 0 1.5px #fff; }
    /* The failure line on the strip when the autosave failed (saved again next turn - gone once it works). Top left of the battle screen in the phone landscape layout, which has no strip */
    ${noteRule('.poke-battle .savenote', 'error')}
    .poke-battle .savenote { flex:none; max-width:60%; font-size:12px; }
    .poke-battle .savenote[hidden] { display:none; }
    .poke-battle .screen > .savenote { position:absolute; left:8px; top:8px; z-index:3; }
    /* Shows which end-screen button the pad's arrow keys picked (same as the leave confirmation) */
    .poke-battle.pkb-portrait .end .btns button:focus, .poke-battle.pkb-landscape .end .btns button:focus { outline:3px solid #ffd35c; outline-offset:2px; }
  </style><div class="frame">
    <div class="band">
      <button class="close leave" type="button" aria-label="나가기" title="나가기">${ICON.leave}</button>
      <span class="savenote" role="status" hidden></span>
      <span class="grow"></span>
      <button class="speed" type="button" title="배속" hidden></button>
      <button class="send icon-host" type="button" aria-label="이야기로 보내기" title="이야기로 보내기" hidden>${ICON.send}</button>
      <button class="fold" type="button" aria-label="접기" title="접기" hidden>${ICON.fold}</button>
    </div>
    <div class="screen">
      <div class="stage"></div>
      <p class="sendnote" role="alert" hidden></p>
      <div class="oops" role="alert" hidden><div class="card"><div class="hd"></div><div class="bd">
        <p class="human"></p>
        <div class="row"><button class="retry" type="button">다시 시도</button></div>
        <details><summary>자세히 · 복사</summary><pre class="dev"></pre><button class="copy" type="button">복사</button></details>
      </div></div></div>
      <div class="confirm" role="dialog" aria-modal="true" aria-labelledby="poke-battle-confirm" hidden><div class="card"><div class="hd" id="poke-battle-confirm">배틀을 그만둘까요?</div><div class="bd">
        <p class="what"></p>
        <div class="row"><button class="keep sec" type="button">계속하기</button><button class="quit" type="button">그만두기</button></div>
      </div></div></div>
    </div>
  </div>`;
  parent.append(root);
  const $ = selector => root.querySelector(selector);
  const screenBox = $('.screen'), stage = $('.stage'), oops = $('.oops'), confirmBox = $('.confirm'), sendNote = $('.sendnote');
  const leaveButton = $('.band .leave'), sendButton = $('.band .send'), foldButton = $('.band .fold'), speedButton = $('.band .speed');
  const saveNote = $('.band .savenote');
  let session, closed = false, started = false, paused = false;

  const startSpec = story ? story.spec : spec;
  const entry = story?.from || !startSpec ? null : (() => {
    const kind = isWild(startSpec) ? 'wild' : 'trainer', named = entryNamed(startSpec), boss = !!startSpec.boss;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pictures = entryPictures(startSpec, { fetchBytes, wild: kind === 'wild', named: !!named, image: me.image });
    const myName = startSpec.p1?.name && startSpec.p1.name !== PLAYER_NAME ? startSpec.p1.name : '나';
    const stamp = extraViewOptions.sound ? entrySound(STAMP_SOUND) : null;
    return mountEntry(root, { kind, boss, named, reduced, pictures, sound: stamp, foeBlack: !!startSpec.p2?.trainerSilhouette, meBlack: me.black,
      names: { me: myName, foe: kind === 'wild' ? '' : startSpec.p2?.name ?? '' } });
  })();

  const preparing = mountLoading(screenBox, { before: oops, hidden: !!entry });

  let takeDown = () => {};
  function putLayout() {
    takeDown();
    takeDown = mountPhoneLayout(root, layoutOf({ phone }), { press: key => padPress(key),
      left: [leaveButton], right: [foldButton, sendButton, speedButton], screen: screenBox, onScreen: [saveNote] });
  }
  putLayout();

  function padPress(key) {
    if (closed) return;
    if (!confirmBox.hidden) return confirmCursor.press(key);
    if (mode === 'result' && endPress?.(key)) return;
    if (mode === 'running' || mode === 'result') session?.pressKey?.(key);
  }
  let endChoice = null, endPress = null, stopEnd = () => {}, saveFailed = false;

  let mode = 'preparing';
  const setMode = next => {
    mode = next;
    root.dataset.mode = mode;
    sendButton.hidden = !(mode === 'running' && story?.onSend);
    speedButton.hidden = mode !== 'running';
    foldButton.hidden = !((mode === 'running' && onCollapse) || mode === 'result');
  };
  setMode('preparing');

  async function loaded() {
    mark('pb:warm');
    await session.warmUp();
    mark('pb:loaded');
  }
  function showError(error) {
    if (closed) return;
    console.error(error);
    hideConfirm();
    preparing.hide(); entry?.remove(); root.querySelector('.end')?.remove();
    [oops.querySelector('.hd').textContent, oops.querySelector('.human').textContent] = humanError(error);
    oops.querySelector('.dev').textContent = String(error?.stack ?? error);
    oops.querySelector('.row').hidden = !onRetry;
    oops.hidden = false;
    setMode('error');
    (onRetry ? oops.querySelector('.retry') : leaveButton).focus();
  }
  oops.querySelector('.retry').onclick = () => onRetry?.();
  oops.querySelector('.copy').onclick = async () => {
    const text = oops.querySelector('.dev').textContent;
    try { await navigator.clipboard.writeText(text); oops.querySelector('.copy').textContent = '복사함'; }
    catch {
      const range = document.createRange(); range.selectNodeContents(oops.querySelector('.dev'));
      getSelection().removeAllRanges(); getSelection().addRange(range);
    }
  };
  async function close() {
    if (closed) return;
    closed = true;
    preparing.hide();
    session?.close();
    stopEnd();
    entry?.remove();

    if ((mode === 'running' || mode === 'result') && !paused) await backToChat(root).catch(() => {});
    try { await onClose(); root.remove(); takeDown(); }
    catch (error) {

      // If hiding itself fails, keep the error and a close button to retry.
      closed = false; root.classList.remove('pkb-clear'); root.querySelector('.pkb-veil')?.remove(); showError(error);
    }
  }

  const hideConfirm = () => {
    if (confirmBox.hidden) return;
    confirmBox.hidden = true;
    stage.focus?.({ preventScroll: true });
  };
  const confirmCursor = choiceCursor([confirmBox.querySelector('.keep'), confirmBox.querySelector('.quit')], hideConfirm);
  leaveButton.onclick = () => {
    if (mode === 'result' && endChoice && !saveFailed) return endChoice('confirm');
    if (mode !== 'running' || forfeitFailed) return close();
    confirmBox.querySelector('.what').textContent = iron ? '철인 모드라 패배로 기록됩니다.' : '이 배틀은 없던 일이 됩니다.';
    confirmBox.hidden = false;
    confirmCursor.select(0);
  };
  confirmBox.querySelector('.keep').onclick = hideConfirm;

  let forfeitFailed = false;
  confirmBox.querySelector('.quit').onclick = async () => {
    confirmBox.hidden = true;
    if (iron && story?.onForfeit) {
      const progress = (() => { try { return session?.progress?.(); } catch { return undefined; } })();
      try { await story.onForfeit(progress); } catch (error) {
        console.error('[poke-battle] 강제 패배를 적지 못함', error);
        forfeitFailed = true;
        confirmBox.querySelector('.what').textContent = failureText(WHAT.result, error);
        confirmBox.hidden = false;
        confirmCursor.select(1);
        return;
      }
    }
    close();
  };
  confirmBox.addEventListener('keydown', e => {
    e.stopPropagation();
    const key = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', Enter: 'a', ' ': 'a', z: 'a', Z: 'a', Escape: 'b', Backspace: 'b', x: 'b', X: 'b' }[e.key];
    if (key) { e.preventDefault(); confirmCursor.press(key); }
  });
  confirmBox.addEventListener('pointerdown', e => { if (e.target === confirmBox) hideConfirm(); });

  const autosave = snapshot => Promise.resolve(story.onTurn(snapshot)).then(() => { saveNote.hidden = true; }, error => {
    console.warn('[poke-battle] 자동 저장 실패', error);
    saveNote.textContent = failureText(WHAT.autosave, error);
    saveNote.hidden = false;
  });
  let sending = false, noteTimer = null;

  const showNote = (text, kind = 'error', { stay = false } = {}) => {
    clearTimeout(noteTimer);
    sendNote.className = `sendnote ${kind}`;
    sendNote.textContent = text ?? '';
    sendNote.hidden = !text;
    if (text && !stay) noteTimer = setTimeout(() => { sendNote.hidden = true; }, SEND_NOTE_MS);
  };
  sendButton.onclick = async () => {
    if (sending || mode !== 'running') return;
    sending = true;
    showNote(null);
    try {

      const sent = await story?.onSend?.({ onWait: note => showNote(note?.text ?? null, note?.kind, { stay: true }) });
      if (sent?.note) showNote(sent.note.text, sent.note.kind);
      await (sent?.sent ? flyAway(sendButton) : shake(sendButton));
    } catch (error) {
      console.error('[poke-battle] 이야기로 보내기 실패', error);
      showNote(failureText(WHAT.send, error));
    } finally { sending = false; stage.focus?.({ preventScroll: true }); }
  };

  let speed = extraViewOptions.speed ?? DEFAULT_SPEED;
  const drawSpeed = () => {
    speedButton.innerHTML = ICON.speed(speed);
    speedButton.setAttribute('aria-label', `배속 ${speed}배`);
  };
  drawSpeed();
  speedButton.onclick = () => {
    speed = nextSpeed(speed);
    drawSpeed();
    session?.setSpeed(speed);
    Promise.resolve(onSpeed?.(speed)).catch(error => {
      console.error('[poke-battle] 배속 저장 실패', error);
      showNote(failureText(WHAT.settings, error));
    });
    stage.focus?.({ preventScroll: true });
  };



  foldButton.onclick = () => {
    if (mode === 'result') return saveFailed ? close() : endChoice?.('confirm');
    if (mode === 'running') { hideConfirm(); onCollapse?.(); }
  };

  function showEnd(result) {
    let busy = false, ui = null, shownAt = 0;
    const openEnd = () => {
      if (ui || closed) return;
      ui = mountEndScreen(screenBox, { outcome: outcomeOf(result), caught: result.captured ? names.species(result.captured.species) : '', retry: !!story?.onRetry && !iron && isLoss(result), send: !!story?.onSend,
        onChoice: kind => endChoice(kind) });
      shownAt = Date.now();
      root.dataset.mode = 'end';

      document.addEventListener('keydown', onEndKey, true);
      stopEnd = () => document.removeEventListener('keydown', onEndKey, true);
    };

    // End screen keys: confirm/cancel = to chat (the battle view already dismissed the end text)
    const onEndKey = event => {
      if (!['Enter', ' ', 'Escape', 'z', 'x', 'Z', 'X', 'Backspace'].includes(event.key)) return;
      if (event.target?.closest?.('button')) return;
      event.preventDefault(); event.stopPropagation();
      endChoice('confirm');
    };

    endPress = key => {
      if (!ui) return false;
      const buttons = [...ui.element.querySelectorAll('.btns button:not([hidden])')];
      const picked = buttons.indexOf(document.activeElement);
      if (['up', 'down', 'left', 'right'].includes(key)) {
        const step = key === 'up' || key === 'left' ? -1 : 1;
        if (buttons.length) buttons[(picked + step + buttons.length) % buttons.length].focus();
      } else if (key === 'a' && picked >= 0) buttons[picked].click();
      else endChoice('confirm');
      return true;
    };
    endChoice = async kind => {
      if (busy || closed) return;
      if (ui && Date.now() - shownAt < END_GUARD_MS) return;
      busy = true; ui?.busy(true);
      let committed = null;
      try {
        if (kind === 'retry') { await story.onRetry(result); return; }

        ({ committed } = story ? await story.onResult(result) : { committed: false });
        saveFailed = false;
        if (committed && kind === 'send') { await story.onSend(); await ui?.fly(); }
        await close();
      } catch (error) {
        console.error('[poke-battle] 끝 화면', error);
        if (!ui) { openEnd(); shownAt = 0; }
        if (committed === null) { saveFailed = true; ui.note(failureText(WHAT.result, error)); }
        else ui.note(failureText(WHAT.send, error));
      } finally { busy = false; ui?.busy(false); }
    };

    session.waitDismiss().then(pressed => { if (pressed) openEnd(); }, () => {});
    stage.focus?.({ preventScroll: true });
  }
  return {
    close, showError, covered: entry?.covered ?? Promise.resolve(),

    pause() { paused = true; try { session?.pause?.(); } catch (error) { console.warn('[poke-battle] 멈춤 실패', error); } },
    resume() {
      paused = false;
      try { session?.resume?.(); } catch (error) { console.warn('[poke-battle] 다시 시작 실패', error); }
      stage.focus?.({ preventScroll: true });
    },

    storyDot(on) { foldButton.classList.toggle('dot', on); },

    progress() { return session?.progress?.() ?? null; },

    // Snapshot at the start of the last turn (checkpoint) | null
    snapshot() { return session?.snapshot?.() ?? null; },

    screen() { return session?.screen?.() ?? { lines: [], marks: {} }; },
    get mode() { return mode; },
    async start() {
      if (started || closed) return;
      started = true;
      clearBattleMarks();
      try {
        entry?.shown();
        const spec = startSpec;

        const options = loadLevelUp().then(levelUp => { mark('pb:levelup'); return { levelUp, exp: EXP_TABLE }; });
        session = createBattleSession({ sim, spec, options, createView,
          viewOptions: { ...extraViewOptions, parent: stage, fetchBytes, bgm },
          from: story?.from ?? undefined, onTurn: story?.onTurn && autosave,
          onPrepared: async () => {
            await loaded();
            preparing.hide();

            if (entry) await entry.open().revealed;
            setMode('running');
          }, development });
        const result = await session.run().finally(() => { hideConfirm(); });
        if (!result || closed) return;
        setMode('result');
        showEnd(result);
        return result;
      } catch (error) {
        if (error?.unresumable) throw error;
        showError(error);
      }
    },
  };
}
