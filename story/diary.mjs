import { names } from '../names/index.js';
import { esc, FONT, noteRule } from './card.mjs';
import { STATS } from '../engine/mon.mjs';
import { BOX_SIZE } from './rules.mjs';
import storyNames from '../data/story-names.json' with { type: 'json' };

const LETTER_BATCHIM = { L: 'l', R: 'l', M: true, N: true };
function batchim(word) {
  const text = String(word ?? '').trim().replace(/[)\]"'’”」』>]+$/u, '');
  const abbr = /[가-힣0-9]([A-Z]{1,3})$/.exec(text);
  if (abbr) return LETTER_BATCHIM[abbr[1].slice(-1)] ?? false;
  const c = text.slice(-1);
  if (!c) return null;
  const code = c.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    const last = (code - 0xac00) % 28;
    return last === 0 ? false : last === 8 ? 'l' : true;
  }
  if (/[0-9]/.test(c)) return '1780'.includes(c) ? (c === '0' ? true : 'l') : '36'.includes(c) ? true : false;
  return null;
}

export function josa(word, pair) {
  const [a, b] = pair.split('/');
  const has = batchim(word);
  if (has === null) return `${word}${a === '으로' ? '(으)로' : `${a}(${b})`}`;
  if (a === '으로') return `${word}${has === true ? a : b}`;
  return `${word}${has ? a : b}`;
}

const sp = species => names.species(species);
const item = id => names.items(id);
const move = id => names.moves(id);
const mon = who => (who?.name ? who.name : who?.species ? sp(who.species) : who?.ref ?? '포켓몬');

// Korean stat names (official spelling) - shared by the diary and the panel
export const STAT_NAME = Object.freeze({ hp: 'HP', atk: '공격', def: '방어', spa: '특수공격', spd: '특수방어', spe: '스피드' });
const stats = list => (list?.length === STATS.length ? '모든 능력' : (list ?? []).map(s => STAT_NAME[s] ?? s).join('·'));

const NATURE_KO = Object.fromEntries(Object.entries(storyNames.natures).filter(([k]) => /[가-힣]/.test(k)).map(([ko, en]) => [en, ko]));

export const natureName = nature => NATURE_KO[nature] ?? nature;

function effectKo(event) {
  if (event.kind === 'heal') {
    if (event.revivedAll) return '기절한 포켓몬이 모두 깨어남';
    if (event.revived) return '기절에서 깨어남';
    if (event.cured) return '상태이상 나음';
    if (event.hpFrom != null && event.hpTo != null && event.hpFrom !== event.hpTo) return `HP ${event.hpFrom}% → ${event.hpTo}%`;
    return '';
  }
  if (event.kind === 'level') return `Lv${event.from} → ${event.to}`;
  if (event.kind === 'evolve') return `${josa(sp(event.species), '으로/로')} 진화`;
  if (event.kind === 'teach') return `${move(event.move)} 배움`;

  if (event.kind === 'evs') return `${STAT_NAME[event.stat] ?? event.stat} 기초포인트 +${event.to - event.from}`;
  if (event.kind === 'exp') return `경험치 +${Number(event.amount).toLocaleString('ko-KR')}${event.to > event.from ? `, Lv${event.from} → ${event.to}` : ''}`;
  if (event.kind === 'ability') return `특성 ${names.abilities(event.from)} → ${names.abilities(event.to)}`;
  if (event.kind === 'nature') return `능력치는 ${natureName(event.nature)} 성격처럼`;
  if (event.kind === 'hypertrain') return `대단한 특훈 — ${stats(event.stats)}`;
  if (event.kind === 'ppup') return `${move(event.move)} 최대 PP ${event.from ?? '?'} → ${event.to ?? '?'}`;
  return '';
}

export const boxOf = (state, position) => {
  const index = Math.floor(position / BOX_SIZE);
  return { n: index + 1, name: state?.boxNames?.[index] || '' };
};
const boxSent = box => (box?.n ? ` — ${josa(box.name ? `"${box.name}"` : `박스 ${box.n}`, '으로/로')} 보냈다` : box ? ' — 박스로 보냈다' : '');

// One event -> one diary line (e.g. received 2 Potions, Pikachu Lv13 -> 15)
export function diaryLine(event) {
  const who = mon(event?.who);
  switch (event?.kind) {
    case 'battle': return battleLine(event);
    case 'add': {
      const name = event.who?.name ? `${event.who.name}(${sp(event.who.species)})` : sp(event.who?.species);
      return `${josa(`${name} Lv${event.level}`, '을/를')} 받았다${boxSent(event.box)}`;
    }
    case 'level': return `${who} Lv${event.from ?? '?'} → ${event.to ?? (event.delta ? `+${event.delta}` : '?')}`;
    case 'heal': {
      if (event.all) return event.revivedAll ? '기절한 포켓몬이 모두 깨어났다' : '파티가 모두 기운을 되찾았다';
      if (event.revived) return `${josa(who, '이/가')} 기절에서 깨어났다`;
      if (event.cured) return `${who}의 상태이상이 나았다`;
      if (event.hpFrom != null && event.hpTo != null) return `${who} HP ${event.hpFrom}% → ${event.hpTo}%`;
      return `${josa(who, '이/가')} 회복했다`;
    }
    case 'item': return event.delta > 0 ? `${item(event.item)} ${event.delta}개를 받았다` : `${item(event.item)} ${-event.delta}개를 잃었다`;
    case 'use': {
      const effect = (event.effects ?? []).map(effectKo).filter(Boolean).join(', ');
      return `${event.who ? `${who}에게 ` : ''}${josa(item(event.item), '을/를')} 썼다${effect ? ` (${effect})` : ''}`;
    }
    case 'swap': {
      const [a, b] = event.at ?? [];
      if (a?.party && b?.party) return `${josa(mon(event.a), '과/와')} ${mon(event.b)}의 순서를 바꿨다`;
      return `${josa(mon(event.a), '과/와')} ${josa(mon(event.b), '을/를')} 맞바꿨다 (파티 ↔ 박스)`;
    }
    case 'release': return `${josa(who, '을/를')} 놓아주었다`;
    case 'deposit': return `${josa(who, '을/를')} 박스에 맡겼다`;
    case 'withdraw': return `${josa(who, '을/를')} 박스에서 데려왔다`;
    case 'nickname': return `${sp(event.who?.species) || who}에게 "${event.name}"${batchim(event.name) === true ? '이라는' : '라는'} 별명을 지어 주었다`;
    case 'hold':
      if (event.item) return `${who}에게 ${josa(item(event.item), '을/를')} 지니게 했다`;
      return event.prev ? `${who}의 ${josa(item(event.prev), '을/를')} 뺐다` : `${who}의 도구를 뺐다`;
    case 'evolve': return `${josa(who, '이/가')} ${josa(sp(event.species), '으로/로')} 진화했다`;
    case 'teach':
      if (event.forget) return `${josa(who, '이/가')} ${josa(move(event.forget), '을/를')} 잊고 ${josa(move(event.move), '을/를')} 배웠다`;
      return event.learned ? `${josa(who, '이/가')} ${josa(move(event.move), '을/를')} 배웠다`
        : `${josa(who, '은/는')} 이제 ${josa(move(event.move), '을/를')} 배울 수 있다`;

    case 'skipmove': return `${josa(who, '은/는')} ${josa(move(event.move), '을/를')} 배우지 않았다`;
    case 'noevolve': return `${who}의 진화를 멈췄다`;
    case 'pp': return `${who}의 PP를 회복했다`;
    case 'boxname': return event.name ? `박스 ${event.box + 1}의 이름을 "${event.name}"${batchim(event.name) === true ? '으로' : '로'} 바꿨다` : `박스 ${event.box + 1}의 이름을 되돌렸다`;
    case 'money': return event.delta > 0 ? `${event.delta}원을 받았다` : `${-event.delta}원을 썼다`;

    case 'evs': case 'exp': case 'ability': case 'nature': case 'hypertrain': case 'ppup': return `${who}: ${effectKo(event)}`;
    default: return event?.op ? `(${event.op})` : null;
  }
}

export function resultEvents(meta, state = null) {
  if (!meta?.outcome) return [];
  const caught = meta.caught ?? null;
  const events = [{ kind: 'battle', outcome: meta.outcome, title: meta.title ?? '', caught, box: caught?.storage ? boxOf(state, caught.storage - 1) : null }];
  for (const e of meta.evolved ?? []) events.push({ kind: 'evolve', who: { species: e.from, name: '' }, species: e.to });
  return events;
}

function battleLine(event) {
  const title = event.title || '상대';
  const wild = title.startsWith('야생');
  switch (event.outcome) {
    case 'win': return wild ? `${josa(title, '을/를')} 쓰러뜨렸다` : `${title}에게 이겼다`;
    case 'lose': return `${title}에게 졌다`;
    case 'forfeit': return `${title}에게 항복했다`;
    case 'run': return `${title}에게서 도망쳤다`;
    case 'capture': {
      const mon = event.caught?.species ? sp(event.caught.species) : title.replace(/^야생\s*/, '');
      return `${josa(mon, '을/를')} 잡았다${boxSent(event.box)}`;
    }
    default: return null;
  }
}

const ICON_BOOK = '<svg viewBox="0 0 18 18" aria-hidden="true"><rect x="4" y="1.8" width="11.5" height="14.4" rx="1.6" fill="#fdf8e8" stroke="currentColor" stroke-width="1.5"/>'
  + '<path d="M7 2v14" stroke="#d8434d" stroke-width="1.2"/><path d="M9 6h4.5M9 9h4.5M9 12h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>'
  + '<path d="M2.3 5h3.2M2.3 9h3.2M2.3 13h3.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
const LINE = 22;

export const DIARY_CSS = [
  `.x-risu-pkb-log{display:block;margin:6px 0 2px;padding:0;max-width:470px;font-family:${FONT};font-weight:700;text-align:left;}`,
  `.x-risu-pkb-logi{box-sizing:border-box;vertical-align:top;position:relative;display:inline-flex;align-items:center;justify-content:center;width:28px;height:25px;margin:0;padding:0;list-style:none;cursor:pointer;border:2px solid #315a77;border-radius:7px;background:#fff;box-shadow:0 2.5px 0 #23435f;color:#315a77;user-select:none;}`,
  `.x-risu-pkb-logi::-webkit-details-marker{display:none;}`,
  `.x-risu-pkb-logi::marker{content:"";}`,
  `.x-risu-pkb-logi:active{transform:translateY(1.5px);box-shadow:0 1px 0 #23435f;}`,
  `.x-risu-pkb-logi svg{display:block;width:17px;height:17px;}`,
  `.x-risu-pkb-log[open] .x-risu-pkb-logi{background:#fbf0cf;}`,
  `.x-risu-pkb-bang{position:absolute;top:-7px;right:-8px;width:15px;height:15px;border:1.5px solid #fff;border-radius:50%;background:#d8434d;color:#fff;font:700 10px/12px sans-serif;text-align:center;box-shadow:0 1px 0 #8e2835;}`,
  `.x-risu-pkb-paper{box-sizing:border-box;margin:7px 0 4px;padding:3px 12px 4px 34px;border:1px solid #e2d4a8;border-radius:3px 9px 9px 3px;`
    + `background-color:#fdf8e6;background-image:linear-gradient(to right,transparent 23px,#e59a9a 23px,#e59a9a 24.5px,transparent 24.5px),`
    + `repeating-linear-gradient(to bottom,transparent 0,transparent ${LINE - 1}px,#cbd9e6 ${LINE - 1}px,#cbd9e6 ${LINE}px);`
    + `background-position:0 0,0 3px;box-shadow:0 2px 0 #dccb98,inset 3px 0 0 rgba(160,130,70,.08);color:#3d3527;font-size:13px;line-height:${LINE}px;}`,
  `.x-risu-pkb-pl{overflow-wrap:anywhere;}`,
  `.x-risu-pkb-pe{color:#c2303b;overflow-wrap:anywhere;}`,
  `.x-risu-pkb-paper:empty{min-height:${LINE + 9}px;}`,

  `.x-risu-pkb-logrow{position:relative;display:flow-root;max-width:470px;}`,
  `.x-risu-pkb-fgs:only-child:not(:empty){padding-top:31px;}`,
  `.x-risu-pkb-fgs:only-child .x-risu-pkb-fg{left:0;}`,
  `.x-risu-pkb-btn.x-risu-pkb-fg{box-sizing:border-box;vertical-align:top;position:absolute;top:6px;left:34px;display:inline-flex;align-items:center;justify-content:center;width:28px;height:25px;margin:0;padding:0;border:2px solid #315a77;border-radius:7px;background:#fff;box-shadow:0 2.5px 0 #23435f;color:#315a77;cursor:pointer;}`,
  `.x-risu-pkb-btn.x-risu-pkb-fg:hover{filter:none;background:#fff4f4;}`,
  `.x-risu-pkb-btn.x-risu-pkb-fg:active{transform:translateY(1.5px);box-shadow:0 1px 0 #23435f;}`,
  `.x-risu-pkb-btn.x-risu-pkb-fg svg{display:block;width:17px;height:17px;}`,
  `.x-risu-pkb-btn.x-risu-pkb-fg.x-risu-pkb-busy{cursor:default;background:#eef4f9;transform:none;box-shadow:0 2.5px 0 #23435f;}`,
  `.x-risu-pkb-fg.x-risu-pkb-busy svg{animation:x-risu-pkbforge 0.9s ease-in-out infinite;}`,
  `@keyframes x-risu-pkbforge{0%,100%{transform:rotate(0deg);} 50%{transform:rotate(-24deg);} }`,
  `.x-risu-pkb-fgask{position:absolute;top:6px;left:68px;display:flex;align-items:center;gap:5px;width:max-content;max-width:calc(100% - 68px);min-height:25px;padding:2px 4px 2px 7px;box-sizing:border-box;border:1.5px solid #315a77;border-radius:7px;background:#fff;color:#23435f;font-family:${FONT};font-size:11px;line-height:1.3;box-shadow:0 2px 0 #23435f;animation:x-risu-pkbask .15s ease-out;}`,
  `.x-risu-pkb-fgask>span{min-width:0;overflow-wrap:anywhere;}`,
  `.x-risu-pkb-fgask .x-risu-pkb-fgok{display:inline-flex;flex:none;align-items:center;justify-content:center;width:23px;height:21px;padding:0;border:1.5px solid #315a77;border-radius:5px;background:#eef4f9;color:#23435f;font:700 14px/1 sans-serif;box-shadow:0 1px 0 #23435f;}`,
  `.x-risu-pkb-fgs:only-child .x-risu-pkb-fgask{left:34px;max-width:calc(100% - 34px);}`,
  `@keyframes x-risu-pkbask{from{opacity:0;transform:translateX(-4px);}to{opacity:1;transform:none;}}`,
  noteRule('.x-risu-pkb-fgnote', 'info'),
  `.x-risu-pkb-fgnote{display:block;box-sizing:border-box;max-width:470px;margin:5px 0 4px;font-size:11.5px;text-align:left;}`,
  `.x-risu-pkb-fgsub{display:block;font-size:10px;opacity:.85;}`,
].join(' ');

function logHtml(rows, bad) {
  const bang = bad ? '<span class="x-risu-pkb-bang">!</span>' : '';
  const label = bad ? '기록 (반영 못 한 줄 있음)' : '기록';
  return `<details class="x-risu-pkb-log${bad ? ' x-risu-pkb-logbad' : ''}">`
    + `<summary class="x-risu-pkb-logi" title="${label}" aria-label="${label}">${ICON_BOOK}${bang}</summary>`
    + `<div class="x-risu-pkb-paper">${rows}</div></details>`;
}

export function renderDiary({ events = [], errors = [], forge = null } = {}) {
  const lines = events.map(diaryLine).filter(Boolean);
  const bad = errors.filter(e => e != null && e !== '').map(String);
  const rows = lines.map(l => `<div class="x-risu-pkb-pl">${esc(l)}</div>`).join('')
    + bad.map(e => `<div class="x-risu-pkb-pe">! ${esc(e)}</div>`).join('');
  const log = rows ? logHtml(rows, bad.length > 0) : '';
  if (!forge || forge.buttonsOff) return log ? `\n\n${log}\n\n` : '';
  if (forge.pending) return '\n\n<div class="x-risu-pkb-logrow">' + log + '<div class="x-risu-pkb-fgs x-risu-pkbfi-{{chat_index}}"></div></div>\n\n';
  const slot = `<div class="x-risu-pkb-fgs x-risu-pkbf-${forge.key}">${renderForge(forge)}</div>`;
  return `\n\n<div class="x-risu-pkb-logrow">${log}{{#if {{equal::{{chat_index}}::${forge.at}}}}}${slot}{{/if}}</div>\n\n`;
}

// Whether a message has log lines (renderDiary draws the log)
export const hasLog = ({ events = [], errors = [] } = {}) => events.some(e => diaryLine(e)) || errors.some(e => e != null && e !== '');

const ICON_SWORD = '<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M15.6 2.4 14.9 5.2 7.6 12.5 5.5 10.4 12.8 3.1z" fill="#e3ebf2" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>'
  + '<path d="M4.3 9.5 8.5 13.7" stroke="#d8434d" stroke-width="2.1" stroke-linecap="round"/><path d="M6.3 11.7 3.3 14.7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
  + '<circle cx="2.7" cy="15.3" r="1.2" fill="currentColor"/></svg>';
const FORGE_LABEL = '이 장면으로 배틀 만들기';

export const FORGE_BUSY = '배틀을 만드는 중입니다.';
export const FORGE_HOLD = '끝날 때까지 메시지를 보내거나 고치지 마십시오.';

export function renderForge({ key, on = false, busy = false, ask = false } = {}) {
  if (!on && !busy) return '';
  const label = busy ? FORGE_BUSY : FORGE_LABEL;
  const button = `<button type="button" class="x-risu-pkb-btn x-risu-pkb-fg${busy ? ' x-risu-pkb-busy' : ''} x-risu-pkbk-${key} x-risu-pkba-forge x-risu-pkbi-{{chat_index}}"`
    + ` title="${label}" aria-label="${label}" aria-expanded="${ask && !busy}"${busy ? ' disabled' : ''}>${ICON_SWORD}</button>`;
  const lines = busy ? `<div class="x-risu-pkb-fgnote">${esc(FORGE_BUSY)}<span class="x-risu-pkb-fgsub">${esc(FORGE_HOLD)}</span></div>` : '';
  const confirm = ask && !busy ? `<span class="x-risu-pkb-fgask" role="group" aria-label="배틀 생성 확인"><span>보조모델을 이용해 배틀을 생성합니다.</span><button type="button" class="x-risu-pkb-btn x-risu-pkb-fgok x-risu-pkbk-${key} x-risu-pkba-forgeok x-risu-pkbi-{{chat_index}}" title="배틀 생성 확인" aria-label="배틀 생성 확인">✓</button></span>` : '';
  return button + confirm + lines;
}
