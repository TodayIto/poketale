import { names } from '../names/index.js';
import { PARTY_MAX } from './rules.mjs';
import { WHAT, failureText } from './failure.mjs';

const BIOME_KO = {
  town: '마을', plains: '평야', grass: '풀숲', tallGrass: '높은 풀숲', metropolis: '대도시', forest: '숲', sea: '바다', swamp: '늪지',
  beach: '해변', lake: '호수', seabed: '해저', mountain: '산', badlands: '악지', cave: '동굴', desert: '사막', iceCave: '얼음 동굴',
  meadow: '목초지', powerPlant: '발전소', volcano: '화산', graveyard: '묘지', dojo: '도장', factory: '공장', ruins: '고대 유적',
  wasteland: '황무지', abyss: '심연', space: '우주', constructionSite: '공사장', jungle: '정글', fairyCave: '페어리 동굴', temple: '사원',
  slum: '슬럼', snowyForest: '눈덮인 숲', island: '섬', laboratory: '연구소', end: '???',
};
const keyOf = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const PLACE = Object.fromEntries(Object.entries(BIOME_KO).map(([k, v]) => [keyOf(k), v]));
const TIME_KO = { day: '낮', night: '밤' };

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '{': '&#123;', '}': '&#125;' };

// Text safe for HTML + CBS.
export const esc = value => String(value ?? '').replace(/[&<>"'{}]/g, c => ESC[c]);
const safeKey = key => String(key ?? '').toLowerCase().replace(/[^a-z0-9]/g, '') || 'none';
const safeUrl = url => (typeof url === 'string' && /^(https?:\/\/|data:image\/)/i.test(url.trim()) ? url.trim() : '');

export function placeName(place) {
  if (place == null || place === '') return '';
  return PLACE[keyOf(place)] ?? String(place);
}
const timeName = time => TIME_KO[time] ?? (time ? String(time) : '');
const speciesName = species => names.species(species);
const subLine = spec => [placeName(spec.place), timeName(spec.time)].filter(Boolean).join(' · ');

export function battleTitle(spec, { level = true } = {}) {
  if (!spec) return '배틀';
  if (spec.wild) {
    const mon = spec.team?.[0];
    if (!mon) return '야생 포켓몬';
    return `야생 ${speciesName(mon.species)}${level && mon.level ? ` Lv${mon.level}` : ''}`;
  }
  return spec.name || spec.trainerClass || '트레이너';
}

const LOOKS = {
  trainer: ['#d8434d', '#8e2835'],
  wild: ['#3f8a5a', '#245a37'],
  progress: ['#c98a1d', '#7d5310'],
  done: ['#3d7196', '#234f6e'],
  locked: ['#8a97a2', '#5f6b75'],
  error: ['#d8434d', '#8e2835'],
};

const BAND = { trainer: '승부를 걸어왔다!', wild: '야생 포켓몬이 나타났다!', progress: '배틀 중', done: '배틀 결과', locked: '다른 배틀 중' };
const OUTCOME = {
  win: { label: '승리', cls: 'win' },
  lose: { label: '패배', cls: 'lose' },
  forfeit: { label: '항복', cls: 'gray' },
  run: { label: '도망', cls: 'gray' },
  capture: { label: '포획', cls: 'cap' },
  stop: { label: '중단', cls: 'gray' },
};
const STATUS_KO = { ready: '대기', locked: '잠김', progress: '배틀 중' };

export const FONT = '"PkbPixel","Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif';

export const SEND_MS = Object.freeze({ fly: 420, okDelay: 360, ok: 900, shake: 380 });
const sec = ms => `${ms / 1000}s`;

export const NOTE_SHAPE = `font-family:${FONT};font-weight:400;letter-spacing:0;line-height:1.45;white-space:pre-line;padding:4px 10px;border-width:2.5px;border-style:solid;border-radius:9px;overflow-wrap:anywhere;`;
export const NOTE_LOOK = Object.freeze({
  error: Object.freeze({ edge: '#d8434d', drop: '#8e2835', fill: '#fff2f2', ink: '#a32634' }),
  info: Object.freeze({ edge: '#5b768b', drop: '#23435f', fill: '#eef4f9', ink: '#23435f' }),
});
const noteColours = ({ edge, drop, fill, ink }) => `border-color:${edge};box-shadow:0 3px 0 ${drop};background:linear-gradient(145deg,#ffffff,${fill});color:${ink};`;

// CSS rule for a line that is always of one kind. selector = the line
export const noteRule = (selector, kind) => `${selector}{${NOTE_SHAPE}${noteColours(NOTE_LOOK[kind])}}`;

export const noteLooks = at => [
  `${Object.keys(NOTE_LOOK).map(at).join(',')}{${NOTE_SHAPE}}`,
  ...Object.entries(NOTE_LOOK).map(([kind, look]) => `${at(kind)}{${noteColours(look)}}`),
];

export const CARD_CSS = [
  `.x-risu-pkb-card{display:block;box-sizing:border-box;width:100%;max-width:470px;min-width:0;margin:8px 0 12px;padding:0;container-type:inline-size;color:#23435f;font-family:${FONT};font-weight:400;font-size:14px;line-height:1.4;text-align:left;letter-spacing:0;}`,
  `.x-risu-pkb-card *{box-sizing:border-box;}`,
  `.x-risu-pkb-box{position:relative;overflow:hidden;border:2.5px solid #315a77;border-radius:12px;background:linear-gradient(145deg,#ffffff,#eaf4fb);box-shadow:0 4px 0 #23435f;}`,
  ...Object.entries(LOOKS).map(([look, [band, edge]]) => `.x-risu-pkb-l-${look}{--pkb-band:${band};--pkb-edge:${edge};}`),
  `.x-risu-pkb-l-done{background:linear-gradient(145deg,#f8fbfd,#e3edf4);border-color:#789db7;box-shadow:0 3px 0 #466c87;}`,
  `.x-risu-pkb-l-locked,.x-risu-pkb-l-error{background:#eef1f4;border-color:#a7b4bf;box-shadow:0 3px 0 #7d8b96;color:#6b7a86;}`,
  `.x-risu-pkb-l-error{color:#23435f;}`,

  `.x-risu-pkb-hd{display:flex;align-items:center;gap:7px;min-height:31px;padding:5px 8px 5px 11px;color:#fff;font-size:13px;background:var(--pkb-band);border-bottom:2.5px solid var(--pkb-edge);}`,
  `.x-risu-pkb-hdr{margin-left:auto;font-size:12px;white-space:nowrap;}`,
  `.x-risu-pkb-pb{display:inline-block;flex:none;width:15px;height:15px;border-radius:50%;border:1.5px solid #18242e;box-shadow:0 0 0 1.5px rgba(255,255,255,.75);background:radial-gradient(circle closest-side,#fff 0 26%,#18242e 26% 44%,transparent 44%),linear-gradient(to bottom,#e3343f 0 43%,#18242e 43% 57%,#fff 57%);}`,
  `.x-risu-pkb-bd{display:flex;flex-wrap:wrap;align-items:center;gap:10px 12px;padding:11px 12px;}`,
  `.x-risu-pkb-tail{display:contents;}`,

  `.x-risu-pkb-face{position:relative;flex:none;width:64px;height:72px;}`,
  `.x-risu-pkb-facein{width:100%;height:100%;border:1.5px solid #8fb0c8;border-radius:8px;overflow:hidden;background:#dbe8f2;}`,
  `.x-risu-pkb-facein img{display:block;width:100%;height:100%;object-fit:contain;image-rendering:pixelated;}`,
  `.x-risu-pkb-facein svg{display:block;width:100%;height:100%;}`,
  `.x-risu-pkb-facetr img{object-fit:contain;object-position:50% 0;}`,
  `.x-risu-pkb-facemon img{transform:scale(1.55);transform-origin:50% 64%;}`,

  `.x-risu-pkb-faceblack img{filter:brightness(0) drop-shadow(-1px 1px 0 #0005);}`,

  `.x-risu-pkb-facesheet{position:relative;}`,
  `.x-risu-pkb-facesheet span{position:absolute;display:block;overflow:hidden;}`,
  `.x-risu-pkb-facesheet img{position:absolute;max-width:none;max-height:none;object-fit:fill;margin:0;padding:0;}`,
  `.x-risu-pkb-dim{filter:grayscale(1);opacity:.7;}`,
  `.x-risu-pkb-info{flex:1 1 0;min-width:0;}`,
  `.x-risu-pkb-title{display:flex;align-items:center;flex-wrap:wrap;gap:2px 6px;font-size:15px;line-height:1.3;color:#14304a;}`,
  `.x-risu-pkb-l-locked .x-risu-pkb-title{color:#55636f;}`,
  `.x-risu-pkb-name{overflow-wrap:anywhere;}`,
  `.x-risu-pkb-badge{display:inline-block;flex:none;padding:0 5px;border-radius:4px;font-size:10px;line-height:16px;color:#fff;background:#d8434d;}`,
  `.x-risu-pkb-badgecls{color:#315a77;background:#e4edf4;box-shadow:inset 0 0 0 1px #a8bccc;}`,
  `.x-risu-pkb-sub{margin-top:2px;font-size:11px;color:#5d7486;}`,
  `.x-risu-pkb-ended{display:inline-block;margin-top:6px;padding:0 8px;border-radius:999px;font-size:11px;line-height:18px;color:#7d5310;background:#fbf0d9;box-shadow:inset 0 0 0 1.5px #e0c48a;}`,

  `.x-risu-pkb-balls{display:flex;flex-wrap:nowrap;gap:4px;margin-top:7px;}`,
  `.x-risu-pkb-ball{display:inline-block;flex:none;width:16px;height:16px;border-radius:50%;border:1.5px solid #18242e;background:radial-gradient(circle closest-side,#fff 0 24%,#18242e 24% 42%,transparent 42%),linear-gradient(to bottom,#e3343f 0 43%,#18242e 43% 57%,#fff 57%);}`,
  `.x-risu-pkb-ballst{background:radial-gradient(circle closest-side,#fff 0 24%,#18242e 24% 42%,transparent 42%),linear-gradient(to bottom,#ecbc2c 0 43%,#18242e 43% 57%,#fff8dc 57%);box-shadow:0 0 0 2px rgba(236,188,44,.45);}`,
  `.x-risu-pkb-ballft{border-color:#6f7a84;background:radial-gradient(circle closest-side,#e4e8eb 0 24%,#6f7a84 24% 42%,transparent 42%),linear-gradient(to bottom,#a3adb5 0 43%,#6f7a84 43% 57%,#dde2e6 57%);opacity:.9;}`,
  `.x-risu-pkb-ballnone{border:1.5px dashed #8ea5b7;background:rgba(255,255,255,.4);}`,
  `.x-risu-pkb-l-locked .x-risu-pkb-ball{filter:grayscale(1);opacity:.6;}`,
  `.x-risu-pkb-rows{display:flex;flex-direction:column;gap:4px;margin-top:7px;}`,
  `.x-risu-pkb-row{display:flex;align-items:center;gap:4px;}`,
  `.x-risu-pkb-lbl{flex:none;width:26px;font-size:11px;color:#5d7486;}`,

  `.x-risu-pkb-stamp{position:absolute;left:50%;bottom:7px;z-index:1;padding:1px 6px;border:2.5px solid currentColor;border-radius:6px;font-size:13px;line-height:1.3;white-space:nowrap;background:rgba(255,255,255,.85);transform:translateX(-50%) rotate(-14deg);}`,
  `.x-risu-pkb-stwin{color:#c8302b;border-color:#d8a12a;}`,
  `.x-risu-pkb-stlose{color:#3e5468;}`,
  `.x-risu-pkb-stgray{color:#6b7a86;border-color:#8a97a2;}`,
  `.x-risu-pkb-stcap{color:#2f7a4c;}`,

  // Right button column (fixed width - buttons line up across consecutive cards in the chat)
  `.x-risu-pkb-act{flex:none;width:150px;display:flex;flex-direction:column;gap:7px;}`,
  `.x-risu-pkb-btn{position:relative;display:flex;align-items:center;justify-content:center;gap:5px;width:100%;margin:0;padding:8px 8px 7px;border:2px solid #922837;border-radius:9px;background:#e84d4d;color:#fff;font-family:inherit;font-weight:400;font-size:13px;line-height:1.25;letter-spacing:0;white-space:nowrap;box-shadow:0 3px 0 #922837;cursor:pointer;}`,
  `.x-risu-pkb-btn:hover{filter:brightness(1.05);}`,
  `.x-risu-pkb-btn:active{transform:translateY(2px);box-shadow:0 1px 0 #922837;}`,
  `.x-risu-pkb-btn svg{display:block;flex:none;width:14px;height:14px;}`,
  `.x-risu-pkb-btn.x-risu-pkb-sec{color:#23435f;background:#fff;border-color:#4383ae;box-shadow:0 3px 0 #23435f;font-size:12px;}`,
  `.x-risu-pkb-btn.x-risu-pkb-sec:active{box-shadow:0 1px 0 #23435f;}`,
  `.x-risu-pkb-sent{display:flex;align-items:center;justify-content:center;width:100%;padding:8px 8px 7px;border:2px solid #b9c3cb;border-radius:9px;background:#eef1f3;color:#8d98a1;font-size:13px;line-height:1.25;white-space:nowrap;}`,
  `.x-risu-pkb-duo{display:flex;gap:6px;}`,
  `.x-risu-pkb-duo > *{flex:1 1 0;min-width:0;}`,
  `.x-risu-pkb-duo .x-risu-pkb-btn{font-size:12px;padding-left:4px;padding-right:4px;}`,
  `.x-risu-pkb-duo .x-risu-pkb-btn.x-risu-pkb-plane{flex:none;width:32px;padding:0;}`,
  `.x-risu-pkb-hd .x-risu-pkb-btn.x-risu-pkb-x{flex:none;width:21px;height:21px;margin:0 0 0 auto;padding:0;border:1.5px solid var(--pkb-edge);border-radius:6px;background:#fff;color:#d8434d;box-shadow:0 1.5px 0 var(--pkb-edge);}`,
  `.x-risu-pkb-hd .x-risu-pkb-btn.x-risu-pkb-x:active{transform:translateY(1px);box-shadow:none;}`,
  `.x-risu-pkb-hd .x-risu-pkb-x svg{width:10px;height:10px;}`,
  `.x-risu-pkb-lock{padding:6px 8px;border:1.5px dashed #9aa6b0;border-radius:8px;background:#f6f7f9;color:#67737d;font-size:11px;line-height:1.45;text-align:center;}`,

  `.x-risu-pkb-err,.x-risu-pkb-note{flex:1 1 100%;min-width:0;font-size:11.5px;}`,
  noteRule('.x-risu-pkb-err', 'error'),
  ...noteLooks(kind => `.x-risu-pkb-note-${kind}`),
  `.x-risu-pkb-errh{margin-bottom:1px;font-size:12px;}`,

  `.x-risu-pkb-pop{position:absolute;inset:0;z-index:3;display:flex;align-items:center;justify-content:center;padding:8px;background:rgba(20,48,74,.58);}`,
  `.x-risu-pkb-dlg{width:min(260px,100%);padding:9px 12px 11px;border:2.5px solid #315a77;border-radius:10px;background:#fff;box-shadow:0 4px 0 #23435f;text-align:center;}`,
  `.x-risu-pkb-ask{margin:0 0 7px;font-size:13px;color:#14304a;}`,
  `.x-risu-pkb-warn{margin:-4px 0 7px;font-size:11.5px;color:#c8303b;}`,
  `.x-risu-pkb-dlg .x-risu-pkb-duo{gap:8px;}`,

  `.x-risu-pkb-fly svg{animation:x-risu-pkbfly ${sec(SEND_MS.fly)} ease-in forwards;}`,
  `.x-risu-pkb-fly::after{content:"✓";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:17px;opacity:0;animation:x-risu-pkbok ${sec(SEND_MS.ok)} ${sec(SEND_MS.okDelay)} ease-out forwards;}`,
  `.x-risu-pkb-shake{animation:x-risu-pkbshake ${sec(SEND_MS.shake)} ease-in-out;}`,
  `@keyframes x-risu-pkbfly{0%{transform:none;opacity:1;} 30%{transform:translate(-2px,1px) rotate(-6deg);} 100%{transform:translate(22px,-18px) rotate(-14deg) scale(.6);opacity:0;} }`,
  `@keyframes x-risu-pkbok{0%{opacity:0;transform:scale(.4);} 35%{opacity:1;transform:scale(1.15);} 100%{opacity:1;transform:none;} }`,
  `@keyframes x-risu-pkbshake{0%,100%{translate:0;} 20%{translate:-3px;} 40%{translate:3px;} 60%{translate:-2px;} 80%{translate:2px;} }`,

  `@container (max-width:380px){`
    + `.x-risu-pkb-act{width:100%;flex-direction:row;flex-wrap:wrap;}`
    + ` .x-risu-pkb-act > *{flex:1 1 0;min-width:0;}`
    + ` .x-risu-pkb-act > .x-risu-pkb-lock,.x-risu-pkb-act > .x-risu-pkb-duo{flex:1 1 100%;}`
    + ` .x-risu-pkb-act > .x-risu-pkb-sec{order:-1;}`
    + ` }`,
].join(' ');

const SIL_BODY = '#8a9aa8', SIL_HAIR = '#6f8191';
function silhouette(gender) {
  const shoulders = `<path fill="${SIL_BODY}" d="M6 66q2-20 23-20t23 20z"/>`;
  let parts;
  if (gender === 'F') {
    parts = `<path fill="${SIL_HAIR}" d="M15 26q0-17 14-17t14 17v14q-4 3-14 3t-14-3z"/><circle fill="${SIL_BODY}" cx="29" cy="25" r="11"/>${shoulders}`;
  } else if (gender === 'M') {
    parts = `<circle fill="${SIL_BODY}" cx="29" cy="24" r="12"/><path fill="${SIL_HAIR}" d="M17 20q2-11 12-11t12 11q-4-5-12-5t-12 5z"/>${shoulders}`;
  } else {
    parts = `<circle fill="${SIL_BODY}" cx="29" cy="24" r="12"/>${shoulders}`
      + '<text x="29" y="29" text-anchor="middle" font-size="14" font-family="sans-serif" fill="#fff">?</text>';
  }
  return `<svg viewBox="0 0 58 66" width="58" height="66" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${parts}</svg>`;
}

const FACE_W = 61, FACE_H = 69;
const px = n => `${Math.round(n * 10) / 10}px`;
function sheetFace({ url, rect }, alt) {
  const src = safeUrl(url);
  const [x, y, w, h, atlasW, atlasH] = Array.isArray(rect) ? rect.map(Number) : [];
  if (!src || ![x, y, w, h, atlasW, atlasH].every(Number.isFinite) || !(w > 0 && h > 0 && atlasW > 0 && atlasH > 0) || x < 0 || y < 0 || x + w > atlasW || y + h > atlasH) return '';
  const k = Math.min(FACE_W / w, FACE_H / h);
  const l = (FACE_W - w * k) / 2, t = 0;
  return `<span style="left:${px(l)};top:${px(t)};width:${px(w * k)};height:${px(h * k)}">`
    + `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" style="left:${px(-x * k)};top:${px(-y * k)};width:${px(atlasW * k)};height:${px(atlasH * k)}"></span>`;
}

function faceBox({ url, rect = null, sheet = null, trainer = false, black = false, gender = null, alt = '', dim = false, stamp = '' }) {
  const src = safeUrl(url);
  const cut = src && trainer && rect ? sheetFace({ url: src, rect }, alt) : !src && sheet ? sheetFace(sheet, alt) : '';
  const inner = cut || (src
    ? `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy">`
    : silhouette(gender));
  const kind = cut ? 'x-risu-pkb-facesheet' : src ? (trainer ? 'x-risu-pkb-facetr' : 'x-risu-pkb-facemon') : '';
  const cls = ['x-risu-pkb-facein', kind, black ? 'x-risu-pkb-faceblack' : '', dim ? 'x-risu-pkb-dim' : ''].filter(Boolean).join(' ');
  return `<div class="x-risu-pkb-face"><div class="${cls}">${inner}</div>${stamp}</div>`;
}

function opponentFace(view, opts = {}) {
  const spec = view.spec;
  if (!spec) return faceBox({ ...opts });
  if (spec.wild) {
    const species = opts.species ?? spec.team?.[0]?.species;
    return faceBox({ url: species ? callUrl(view, species) : '', alt: species ? speciesName(species) : '', ...opts });
  }
  if (opts.species) return faceBox({ url: callUrl(view, opts.species), alt: speciesName(opts.species), ...opts });
  return faceBox({ url: view.faces?.trainerUrl, rect: view.faces?.trainerRect, sheet: view.faces?.trainerSheet, trainer: true, black: !!view.faces?.trainerSilhouette,
    gender: spec.gender, alt: spec.name ?? '', ...opts });
}
function callUrl(view, species) {
  try { return view.faces?.speciesUrl?.(species) ?? ''; } catch { return ''; }
}

const ball = state => {
  const extra = { ok: '', status: ' x-risu-pkb-ballst', fainted: ' x-risu-pkb-ballft', empty: ' x-risu-pkb-ballnone' }[state] ?? ' x-risu-pkb-ballnone';
  return `<span class="x-risu-pkb-ball${extra}"></span>`;
};
const balls = list => {
  const slots = Array.from({ length: PARTY_MAX }, (_, i) => list?.[i] ?? 'empty');
  return slots.map(ball).join('');
};

export const ICON_PLANE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M2.5 20.5 22 12 2.5 3.5l.02 6.6L16 12 2.52 13.9z"/></svg>';
const ICON_X = '<svg viewBox="0 0 10 10" aria-hidden="true"><path stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M1.5 1.5l7 7M8.5 1.5l-7 7"/></svg>';

function btn(key, action, inner, { cls = '', label = '' } = {}) {
  return `<button type="button" class="x-risu-pkb-btn${cls ? ` ${cls}` : ''} x-risu-pkbk-${safeKey(key)} x-risu-pkba-${action} x-risu-pkbi-{{chat_index}}"`
    + `${label ? ` aria-label="${esc(label)}" title="${esc(label)}"` : ''}>${inner}</button>`;
}

function header(left, right = '', discardKey = null) {
  return `<div class="x-risu-pkb-hd"><span class="x-risu-pkb-pb"></span><span>${esc(left)}</span>`
    + (right ? `<span class="x-risu-pkb-hdr">${esc(right)}</span>` : '')
    + (discardKey != null ? btn(discardKey, 'discard', ICON_X, { cls: 'x-risu-pkb-x', label: '이 배틀 카드 버리기' }) : '') + '</div>';
}

function titleRow(spec) {
  let badge = '';
  if (spec && !spec.wild) {
    if (spec.boss) badge = '<span class="x-risu-pkb-badge">보스</span>';
    else if (spec.trainerClass && !String(spec.name ?? '').includes(spec.trainerClass)) {
      badge = `<span class="x-risu-pkb-badge x-risu-pkb-badgecls">${esc(spec.trainerClass)}</span>`;
    }
  }
  return `<div class="x-risu-pkb-title"><span class="x-risu-pkb-name">${esc(battleTitle(spec))}</span>${badge}</div>`;
}
const subRow = spec => {
  const sub = spec ? subLine(spec) : '';
  return sub ? `<div class="x-risu-pkb-sub">${esc(sub)}</div>` : '';
};

const teamBalls = spec => (spec.wild ? '' : `<div class="x-risu-pkb-balls">${balls((spec.team ?? []).map(() => 'ok'))}</div>`);

function errorBox(errors) {
  const items = errors.map(e => `<div>· ${esc(e)}</div>`).join('');
  return `<div class="x-risu-pkb-err"><div class="x-risu-pkb-errh">배틀을 열 수 없습니다</div>${items}</div>`;
}

const wrapCard = (state, look, inner, key = null) => `\n\n<div class="x-risu-pkb-card x-risu-pkb-s-${state}${key != null ? ` x-risu-pkbc-${safeKey(key)}` : ''}">`
  + `<div class="x-risu-pkb-box x-risu-pkb-l-${look}">${inner}</div></div>\n\n`;
const tailBox = (key, inner) => `<div class="x-risu-pkb-tail x-risu-pkbt-${safeKey(key)}">${inner}</div>`;

const note = n => (n ? `<div class="x-risu-pkb-note x-risu-pkb-note-${n.kind}">${esc(n.text).replaceAll('\n', '<br>')}</div>` : '');

// The line under a card whose buttons cannot work on this screen (view.buttonsOff)
const BUTTONS_OFF = failureText(WHAT.buttons, 'noMainScreen');

export function renderCardTail(view) {
  const key = view?.key;
  const status = view?.status ?? 'ready';
  const errors = (view?.errors ?? []).filter(e => e != null && e !== '').map(String);
  if (!view?.spec || errors.length) return errorBox(errors.length ? errors : ['배틀 내용을 읽지 못했습니다']);
  let act = '';
  let buttons = status !== 'done';
  if (status === 'progress') {
    act = `<div class="x-risu-pkb-duo">${btn(key, 'resume', '배틀로 돌아가기')}`
      + `${btn(key, 'send', ICON_PLANE, { cls: 'x-risu-pkb-plane', label: '이야기로 보내기' })}</div>`;
  } else if (status === 'done') {

    const r = view.result ?? {};
    if (view.latest && !r.storyEnded) {
      const send = !view.sent && view.canSend !== false, retry = !view.iron && view.canRetry !== false && view.canUndo !== false;
      act = (view.sent ? '<span class="x-risu-pkb-sent">✓ 보냄</span>' : send ? btn(key, 'send', `<span>이야기로 보내기</span>${ICON_PLANE}`, { label: '이야기로 보내기' }) : '')
        + (retry ? btn(key, 'retry', '↻ 다시 하기', { cls: 'x-risu-pkb-sec' }) : '');
      buttons = send || retry;
    }
  } else if (status === 'locked') {
    act = '<div class="x-risu-pkb-lock">진행 중인 배틀이 끝난 뒤에 열 수 있습니다</div>';
  } else {
    act = btn(key, 'open', '전투 들어가기');
  }

  const ask = view.ask === 'discard'
    ? '<div class="x-risu-pkb-pop"><div class="x-risu-pkb-dlg"><div class="x-risu-pkb-ask">이 배틀 카드를 버릴까요?</div>'
      + (status === 'progress' ? `<div class="x-risu-pkb-warn">${view.iron ? '철인 모드라 패배로 기록됩니다' : '진행 중이던 배틀도 지워집니다'}</div>` : '')
      + `<div class="x-risu-pkb-duo">${btn(key, 'discardno', '그만두기', { cls: 'x-risu-pkb-sec' })}${btn(key, 'discardok', '버리기')}</div></div></div>`
    : view.ask === 'retry'
      ? '<div class="x-risu-pkb-pop"><div class="x-risu-pkb-dlg"><div class="x-risu-pkb-ask">다시 할까요?</div>'
        + '<div class="x-risu-pkb-warn">이 배틀 뒤로 이어진 이야기가 있습니다. 지난 결과는 지워지고, 새 결과는 맨 아래 메시지에 붙습니다.</div>'
        + `<div class="x-risu-pkb-duo">${btn(key, 'retryno', '그만두기', { cls: 'x-risu-pkb-sec' })}${btn(key, 'retryok', '다시 하기')}</div></div></div>`
      : '';
  return (act ? `<div class="x-risu-pkb-act">${act}</div>` : '') + note(view.notice ?? (buttons && view.buttonsOff ? { text: BUTTONS_OFF, kind: 'error' } : null)) + ask;
}

export function renderBattleCard(view) {
  const spec = view?.spec ?? null;
  const errors = (view?.errors ?? []).filter(e => e != null && e !== '').map(String);
  const status = view?.status ?? 'ready';
  const key = view?.key;

  if (!spec) {
    return wrapCard('error', 'error', header('배틀 블록 오류')
      + `<div class="x-risu-pkb-bd">${errorBox(errors.length ? errors : ['배틀 내용을 읽지 못했습니다'])}</div>`);
  }
  if (status === 'discarded') return renderDiscarded(view);

  const discard = errors.length || view.canUndo === false ? null : key;
  let look, head, face, info;
  if (status === 'progress') {

    // In progress (folded): face and name + 6+6 ball rows (no turn count or place)
    const p = view.progress ?? {};
    look = 'progress';
    head = header(BAND.progress, '', discard);
    face = opponentFace(view);
    info = titleRow(spec) + `<div class="x-risu-pkb-rows"><div class="x-risu-pkb-row"><span class="x-risu-pkb-lbl">나</span>${balls(p.mine)}</div>`
      + `<div class="x-risu-pkb-row"><span class="x-risu-pkb-lbl">상대</span>${balls(p.theirs)}</div></div>`;
  } else if (status === 'done') {

    const r = view.result ?? {};
    const o = OUTCOME[r.outcome] ?? { label: '끝', cls: 'gray' };
    const stamp = `<span class="x-risu-pkb-stamp x-risu-pkb-st${o.cls}">${o.label}</span>`;
    const species = spec.wild ? (r.faceSpecies ?? spec.team?.[0]?.species) : undefined;
    look = 'done';
    head = header(BAND.done, !r.storyEnded && r.turns ? `${r.turns}턴` : '');
    face = opponentFace(view, { stamp, species });
    info = titleRow(spec) + subRow(spec) + (r.storyEnded ? '<span class="x-risu-pkb-ended">이야기로 끝남</span>' : '');
  } else if (status === 'locked') {

    look = 'locked';
    head = header(BAND.locked, '', discard);
    face = opponentFace(view, { dim: true });
    info = titleRow(spec) + subRow(spec) + teamBalls(spec);
  } else {
    look = spec.wild ? 'wild' : 'trainer';
    head = header(BAND[look], '', discard);
    face = opponentFace(view);
    info = titleRow(spec) + subRow(spec) + teamBalls(spec);
  }
  const body = `<div class="x-risu-pkb-bd">${face}<div class="x-risu-pkb-info">${info}</div>${tailBox(key, renderCardTail({ ...view, status, errors }))}</div>`;
  return wrapCard(status, look, head + body, key);
}

const ONE_LINE = `display:flex;align-items:center;gap:8px;box-sizing:border-box;max-width:470px;margin:6px 0 10px;padding:3px 6px 3px 10px;border-radius:0 7px 7px 0;font-family:${FONT};font-weight:400;font-size:12.5px;line-height:1.5;text-align:left;overflow-wrap:anywhere;`;

export function renderDiscarded(view) {

  const style = `${ONE_LINE}border-left:4px solid #a3adb5;background:#eef0f2;color:#87929b;${view?.notice ? 'flex-wrap:wrap;' : ''}`;
  const restore = 'flex:none;margin-left:auto;width:24px;height:22px;padding:0;border:1.5px solid #8a97a2;border-radius:6px;background:#fff;color:#5f6b75;font:700 14px/1 sans-serif;box-shadow:0 1.5px 0 #8a97a2;cursor:pointer;';
  return `\n\n<div class="x-risu-pkb-col x-risu-pkb-gone x-risu-pkbc-${safeKey(view?.key)}" style="${esc(style)}"><span>⚔︎ ${esc(battleTitle(view?.spec ?? null))}</span>`

    + (view?.canUndo === false ? '' : `<button type="button" class="x-risu-pkb-btn x-risu-pkbk-${safeKey(view?.key)} x-risu-pkba-restore x-risu-pkbi-{{chat_index}}" style="${esc(restore)}" aria-label="되살리기" title="되살리기">↺</button>`)
    + note(view?.notice) + '</div>\n\n';
}

export function renderCollapsed(view) {
  const spec = view?.spec ?? null;
  if (spec && view.status === 'discarded') return renderDiscarded(view);
  const parts = [battleTitle(spec)];
  const errors = (view?.errors ?? []).filter(Boolean);
  if (!spec || errors.length) parts.push('오류');
  else if (view.status === 'done') {
    const r = view.result ?? {};
    parts.push(OUTCOME[r.outcome]?.label ?? '끝');
    if (r.storyEnded) parts.push('이야기로 끝남');
  } else parts.push(STATUS_KO[view.status] ?? '대기');
  const style = `display:block;box-sizing:border-box;max-width:470px;margin:6px 0 10px;padding:3px 10px;border-left:4px solid #d8434d;border-radius:0 7px 7px 0;background:#eef3f7;color:#315a77;font-family:${FONT};font-weight:400;font-size:12.5px;line-height:1.5;text-align:left;overflow-wrap:anywhere;`;
  return `\n\n<div class="x-risu-pkb-col" style="${esc(style)}">⚔︎ ${esc(parts.join(' · '))}</div>\n\n`;
}

export function wrapRecent(html, collapsed, n = 5) {
  const k = Math.max(0, Math.floor(Number(n) || 0));
  const lim = k ? `{{? {{lastmessageid}}-${k - 1}}}` : '{{? {{lastmessageid}}+1}}';
  return `\n\n{{#if {{greater_equal::{{chat_index}}::${lim}}}}}${String(html).trim()}{{/if}}`
    + `{{#if {{less::{{chat_index}}::${lim}}}}}${String(collapsed).trim()}{{/if}}\n\n`;
}

export const CHIP_CSS = [
  `.x-risu-pkb-chip{display:inline-flex;align-items:center;gap:7px;max-width:100%;margin:2px 0;padding:4px 11px 4px 8px;border:2px solid #315a77;border-radius:999px;`
    + `background:linear-gradient(135deg,#ffffff 0%,#f3f8fc 55%,#e2eef7 100%);box-shadow:0 2.5px 0 #23435f;color:#1d3347;font-family:${FONT};font-weight:700;font-size:13px;line-height:1.35;text-align:left;cursor:default;user-select:none;}`,
  `.x-risu-pkb-chipi{display:inline-flex;flex:none;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:#d8434d;color:#fff;box-shadow:0 1.5px 0 #8e2835;}`,
  `.x-risu-pkb-chipi svg{display:block;width:12px;height:12px;margin-left:1px;}`,
  `.x-risu-pkb-chipt{min-width:0;overflow-wrap:anywhere;}`,
  `.x-risu-pkb-chips{color:#5b768b;}`,
].join(' ');

export function renderStoryChip(infos) {
  const list = (infos ?? []).filter(Boolean);
  const vs = list.map(i => i.vs).filter(Boolean).at(-1) ?? '';
  const spans = list.map(i => i.turns).filter(Boolean);
  const from = spans.length ? Math.min(...spans.map(s => s[0])) : null, to = spans.length ? Math.max(...spans.map(s => s[1])) : null;
  const result = list.map(i => i.result).filter(Boolean).at(-1);
  const parts = ['배틀 이야기', vs, from === null ? '' : from === to ? `${from}턴` : `${from}~${to}턴`, OUTCOME[result]?.label ?? ''].filter(Boolean);
  const [head, ...rest] = parts;
  return `\n\n<span class="x-risu-pkb-chip"><span class="x-risu-pkb-chipi">${ICON_PLANE}</span>`
    + `<span class="x-risu-pkb-chipt">${esc(head)}${rest.map(p => `<span class="x-risu-pkb-chips"> · </span>${esc(p)}`).join('')}</span></span>\n\n`;
}
