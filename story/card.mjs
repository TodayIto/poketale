import { namesIn } from '../names/index.js';
import { PARTY_MAX, PAIR_TEAM_MAX } from './rules.mjs';
import { WHAT, failureText } from './failure.mjs';
import { say } from './screen-text.mjs';

const BIOMES = ['town', 'plains', 'grass', 'tallGrass', 'metropolis', 'forest', 'sea', 'swamp', 'beach', 'lake', 'seabed', 'mountain', 'badlands',
  'cave', 'desert', 'iceCave', 'meadow', 'powerPlant', 'volcano', 'graveyard', 'dojo', 'factory', 'ruins', 'wasteland', 'abyss', 'space',
  'constructionSite', 'jungle', 'fairyCave', 'temple', 'slum', 'snowyForest', 'island', 'laboratory', 'end'];
const keyOf = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const PLACE = Object.fromEntries(BIOMES.map(k => [keyOf(k), k]));
const TIMES = new Set(['day', 'night']);

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '{': '&#123;', '}': '&#125;' };

export const esc = value => String(value ?? '').replace(/[&<>"'{}]/g, c => ESC[c]);
const safeKey = key => String(key ?? '').toLowerCase().replace(/[^a-z0-9]/g, '') || 'none';
const safeUrl = url => (typeof url === 'string' && /^(https?:\/\/|data:image\/)/i.test(url.trim()) ? url.trim() : '');

export function placeName(place, lang) {
  if (place == null || place === '') return '';
  const biome = PLACE[keyOf(place)];
  return biome ? say(lang, `place.${biome}`) : String(place);
}
const timeName = (time, lang) => (TIMES.has(time) ? say(lang, `time.${time}`) : time ? String(time) : '');

const speciesName = (species, lang) => namesIn(lang).species(species);
const subLine = (spec, lang) => [placeName(spec.place, lang), timeName(spec.time, lang)].filter(Boolean).join(' · ');

function wildPair(spec, lang) {
  if (!spec?.wild || !(spec.team?.length > 1)) return null;
  return { lead: say(lang, 'card.title.wildLead'), join: say(lang, 'card.title.wildJoin'),
    mons: spec.team.slice(0, 2).map(m => ({ name: speciesName(m.species, lang), level: m.level })) };
}

export function battleTitle(spec, lang, { level = true } = {}) {
  if (!spec) return say(lang, 'card.title.battle');
  if (spec.wild) {
    const mon = spec.team?.[0];
    if (!mon) return say(lang, 'card.title.wildNone');
    const pair = wildPair(spec, lang);
    if (pair) return `${pair.lead} ${pair.mons.map(m => `${m.name}${level && m.level ? ` Lv${m.level}` : ''}`).join(` ${pair.join} `)}`;
    return `${say(lang, 'card.title.wild', { species: speciesName(mon.species, lang) })}${level && mon.level ? ` Lv${mon.level}` : ''}`;
  }
  const first = spec.name || spec.trainerClass || say(lang, 'card.title.trainer');

  return spec.foePartner ? `${first} & ${spec.foePartner.name || say(lang, 'spec.foePartner')}` : first;
}

const LOOKS = {
  trainer: ['#d8434d', '#8e2835'],
  wild: ['#3f8a5a', '#245a37'],
  progress: ['#c98a1d', '#7d5310'],
  done: ['#3d7196', '#234f6e'],
  locked: ['#8a97a2', '#5f6b75'],
  error: ['#d8434d', '#8e2835'],
};

const band = (look, lang) => say(lang, `card.band.${look}`);
// Result stamp colour per outcome (label: screen text card.outcome.<outcome>); stop = ended by the story
const OUTCOME_CLS = { win: 'win', lose: 'lose', forfeit: 'gray', run: 'gray', capture: 'cap', stop: 'gray' };

const outcomeLabel = (outcome, lang) => say(lang, `card.outcome.${Object.hasOwn(OUTCOME_CLS, outcome) ? outcome : 'end'}`);
const STATUSES = new Set(['ready', 'locked', 'progress']);

export const FONT = '"PkbPixel","Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif';

export const SEND_MS = Object.freeze({ fly: 420, okDelay: 360, ok: 900, shake: 380 });
const sec = ms => `${ms / 1000}s`;

export const NOTE_SHAPE = `font-family:${FONT};font-weight:400;letter-spacing:0;line-height:1.45;white-space:pre-line;padding:4px 10px;border-width:2.5px;border-style:solid;border-radius:9px;overflow-wrap:anywhere;`;
export const NOTE_LOOK = Object.freeze({
  error: Object.freeze({ edge: '#d8434d', drop: '#8e2835', fill: '#fff2f2', ink: '#a32634' }),
  info: Object.freeze({ edge: '#5b768b', drop: '#23435f', fill: '#eef4f9', ink: '#23435f' }),
});
const noteColours = ({ edge, drop, fill, ink }) => `border-color:${edge};box-shadow:0 3px 0 ${drop};background:linear-gradient(145deg,#ffffff,${fill});color:${ink};`;

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
  `.x-risu-pkb-hdt{flex:1 1 auto;min-width:0;}`,
  `.x-risu-pkb-hdr{margin-left:auto;font-size:12px;white-space:nowrap;}`,

  `.x-risu-pkb-dbl{display:flex;flex:none;align-items:center;height:21px;padding:0 6px;border:1.5px solid var(--pkb-edge);border-radius:6px;background:#fff;color:var(--pkb-band);font-size:11.5px;line-height:1;box-shadow:0 1.5px 0 var(--pkb-edge);}`,
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
  `.x-risu-pkb-flip{transform:scaleX(-1);}`,

  `.x-risu-pkb-face2{width:98px;}`,
  `.x-risu-pkb-face2 .x-risu-pkb-facein{position:absolute;width:56px;height:64px;}`,
  `.x-risu-pkb-f1{left:0;top:0;}`,
  `.x-risu-pkb-f2{left:42px;top:8px;box-shadow:0 0 0 2px rgba(255,255,255,.92);}`,
  `.x-risu-pkb-info{flex:1 1 0;min-width:0;}`,
  `.x-risu-pkb-title{display:flex;align-items:center;flex-wrap:wrap;gap:2px 6px;font-size:15px;line-height:1.3;color:#14304a;}`,
  `.x-risu-pkb-l-locked .x-risu-pkb-title{color:#55636f;}`,
  `.x-risu-pkb-name{overflow-wrap:anywhere;}`,

  `.x-risu-pkb-pair{display:flex;align-items:baseline;gap:0 .3em;min-width:0;}`,
  `.x-risu-pkb-pair > :first-child{flex:none;white-space:nowrap;}`,
  `.x-risu-pkb-units{display:flex;flex-wrap:wrap;min-width:0;}`,
  `.x-risu-pkb-unit{white-space:nowrap;}`,
  `.x-risu-pkb-lv{margin-left:1px;font-size:.65em;vertical-align:-.15em;}`,
  `.x-risu-pkb-join{margin:0 .35em;}`,
  `.x-risu-pkb-badge{display:inline-block;flex:none;padding:0 5px;border-radius:4px;font-size:10px;line-height:16px;color:#fff;background:#d8434d;}`,
  `.x-risu-pkb-badgecls{color:#315a77;background:#e4edf4;box-shadow:inset 0 0 0 1px #a8bccc;}`,
  `.x-risu-pkb-sub{margin-top:2px;font-size:11px;color:#5d7486;}`,
  `.x-risu-pkb-ended{display:inline-block;margin-top:6px;padding:0 8px;border-radius:999px;font-size:11px;line-height:18px;color:#7d5310;background:#fbf0d9;box-shadow:inset 0 0 0 1.5px #e0c48a;}`,

  `.x-risu-pkb-balls{display:flex;flex-wrap:nowrap;gap:4px;margin-top:7px;}`,
  `.x-risu-pkb-ball{display:inline-block;flex:none;width:16px;height:16px;border-radius:50%;border:1.5px solid #18242e;background:radial-gradient(circle closest-side,#fff 0 24%,#18242e 24% 42%,transparent 42%),linear-gradient(to bottom,#e3343f 0 43%,#18242e 43% 57%,#fff 57%);}`,
  `.x-risu-pkb-ballst{background:radial-gradient(circle closest-side,#fff 0 24%,#18242e 24% 42%,transparent 42%),linear-gradient(to bottom,#ecbc2c 0 43%,#18242e 43% 57%,#fff8dc 57%);box-shadow:0 0 0 2px rgba(236,188,44,.45);}`,
  `.x-risu-pkb-ballft{border-color:#6f7a84;background:radial-gradient(circle closest-side,#e4e8eb 0 24%,#6f7a84 24% 42%,transparent 42%),linear-gradient(to bottom,#a3adb5 0 43%,#6f7a84 43% 57%,#dde2e6 57%);opacity:.9;}`,
  `.x-risu-pkb-ballnone{border:1.5px dashed #8ea5b7;background:rgba(255,255,255,.4);}`,
  `.x-risu-pkb-l-locked .x-risu-pkb-ball,.x-risu-pkb-l-locked .x-risu-pkb-ballsep{filter:grayscale(1);opacity:.6;}`,

  `.x-risu-pkb-ballsep{flex:none;align-self:center;width:1.5px;height:14px;margin:0 2px;border-radius:1px;background:#a8bccc;}`,
  `.x-risu-pkb-rows{display:flex;flex-direction:column;gap:4px;margin-top:7px;}`,
  `.x-risu-pkb-row{display:flex;align-items:center;gap:4px;}`,
  `.x-risu-pkb-lbl{flex:none;width:26px;font-size:11px;color:#5d7486;}`,
  // Result stamp (lower part of the face, -14 deg, small)
  `.x-risu-pkb-stamp{position:absolute;left:50%;bottom:7px;z-index:1;padding:1px 6px;border:2.5px solid currentColor;border-radius:6px;font-size:13px;line-height:1.3;white-space:nowrap;background:rgba(255,255,255,.85);transform:translateX(-50%) rotate(-14deg);}`,
  `.x-risu-pkb-stwin{color:#c8302b;border-color:#d8a12a;}`,
  `.x-risu-pkb-stlose{color:#3e5468;}`,
  `.x-risu-pkb-stgray{color:#6b7a86;border-color:#8a97a2;}`,
  `.x-risu-pkb-stcap{color:#2f7a4c;}`,

  `.x-risu-pkb-ally{display:flex;align-items:center;gap:5px;min-width:0;font-size:11.5px;line-height:1.3;color:#23435f;}`,
  `.x-risu-pkb-allyface{position:relative;flex:none;width:22px;height:22px;border:1.5px solid #23435f;border-radius:50%;overflow:hidden;background:#dbe8f2;}`,
  `.x-risu-pkb-allyface > img{display:block;width:100%;height:100%;object-fit:cover;object-position:50% 0;image-rendering:pixelated;}`,
  `.x-risu-pkb-allyface svg{display:block;width:100%;height:100%;}`,
  `.x-risu-pkb-allyt{min-width:0;}`,
  `.x-risu-pkb-nw{white-space:nowrap;}`,

  `.x-risu-pkb-bdally{display:grid;grid-template-columns:auto 1fr 150px;align-items:center;row-gap:7px;}`,
  `.x-risu-pkb-bdally > .x-risu-pkb-face{grid-column:1;grid-row:1 / span 2;}`,
  `.x-risu-pkb-bdally > .x-risu-pkb-info{grid-column:2;grid-row:1 / span 2;}`,
  `.x-risu-pkb-bdally > .x-risu-pkb-ally{grid-column:3;grid-row:1;align-self:end;}`,
  `.x-risu-pkb-bdally .x-risu-pkb-act{grid-column:3;grid-row:2;align-self:start;}`,
  `.x-risu-pkb-bdally .x-risu-pkb-err,.x-risu-pkb-bdally .x-risu-pkb-note{grid-column:1 / -1;}`,

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

    + ` .x-risu-pkb-bdally{grid-template-columns:auto 1fr auto;row-gap:0;}`
    + ` .x-risu-pkb-bdally > .x-risu-pkb-face{grid-row:1 / span 3;}`
    + ` .x-risu-pkb-bdally > .x-risu-pkb-info{display:contents;}`
    + ` .x-risu-pkb-bdally .x-risu-pkb-info > *{grid-column:2;}`
    + ` .x-risu-pkb-bdally .x-risu-pkb-info > .x-risu-pkb-title{grid-column:2 / 4;grid-row:1;}`
    + ` .x-risu-pkb-bdally > .x-risu-pkb-ally{grid-column:3;grid-row:2 / span 2;}`
    + ` .x-risu-pkb-bdally .x-risu-pkb-act{grid-column:1 / -1;grid-row:auto;margin-top:10px;}`
    + ` .x-risu-pkb-bdally .x-risu-pkb-err,.x-risu-pkb-bdally .x-risu-pkb-note{margin-top:10px;}`
    + ` .x-risu-pkb-allyt > span{display:block;}`
    + ` .x-risu-pkb-allyt > .x-risu-pkb-allysep{display:none;}`

    + ` .x-risu-pkb-l-progress .x-risu-pkb-bdally > .x-risu-pkb-ally{grid-column:2 / 4;grid-row:3;margin-top:6px;}`
    + ` .x-risu-pkb-l-progress .x-risu-pkb-allyt > span{display:inline;}`
    + ` .x-risu-pkb-l-progress .x-risu-pkb-allyt > .x-risu-pkb-allysep{display:inline;}`
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

const FACE_IN = [61, 69], PAIR_IN = [53, 61], ALLY_IN = [19, 19];
const px = n => `${Math.round(n * 10) / 10}px`;

function sheetFace({ url, rect }, alt, [boxW, boxH]) {
  const src = safeUrl(url);
  const [x, y, w, h, atlasW, atlasH] = Array.isArray(rect) ? rect.map(Number) : [];
  if (!src || ![x, y, w, h, atlasW, atlasH].every(Number.isFinite) || !(w > 0 && h > 0 && atlasW > 0 && atlasH > 0) || x < 0 || y < 0 || x + w > atlasW || y + h > atlasH) return '';
  const k = Math.min(boxW / w, boxH / h);
  const l = (boxW - w * k) / 2, t = 0;
  return `<span style="left:${px(l)};top:${px(t)};width:${px(w * k)};height:${px(h * k)}">`
    + `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" style="left:${px(-x * k)};top:${px(-y * k)};width:${px(atlasW * k)};height:${px(atlasH * k)}"></span>`;
}

function faceIn({ url, rect = null, sheet = null, trainer = false, black = false, gender = null, alt = '', dim = false, flip = false }, size = FACE_IN, cls = '') {
  const src = safeUrl(url);
  const cut = src && trainer && rect ? sheetFace({ url: src, rect }, alt, size) : !src && sheet ? sheetFace(sheet, alt, size) : '';
  const inner = cut || (src
    ? `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy">`
    : silhouette(gender));
  const kind = cut ? 'x-risu-pkb-facesheet' : src ? (trainer ? 'x-risu-pkb-facetr' : 'x-risu-pkb-facemon') : '';
  const all = [cls || 'x-risu-pkb-facein', kind, black ? 'x-risu-pkb-faceblack' : '', dim ? 'x-risu-pkb-dim' : '', flip ? 'x-risu-pkb-flip' : ''].filter(Boolean).join(' ');
  return `<div class="${all}">${inner}</div>`;
}

function faceBox(first, second = null, stamp = '') {
  if (!second) return `<div class="x-risu-pkb-face">${faceIn(first)}${stamp}</div>`;
  return `<div class="x-risu-pkb-face x-risu-pkb-face2">${faceIn(first, PAIR_IN, 'x-risu-pkb-facein x-risu-pkb-f1')}${faceIn(second, PAIR_IN, 'x-risu-pkb-facein x-risu-pkb-f2')}${stamp}</div>`;
}

const trainerPicture = (face, alt) => ({ url: face?.trainerUrl, rect: face?.trainerRect, sheet: face?.trainerSheet, trainer: true, black: !!face?.trainerSilhouette,
  gender: face?.trainerGender ?? null, alt: alt ?? '' });

const samePicture = (a, b) => ['url', 'sheet', 'black', 'gender'].every(k => JSON.stringify(a[k] ?? null) === JSON.stringify(b[k] ?? null));

function opponentFace(view, lang, { dim = false, stamp = '', species: shown } = {}) {
  const spec = view.spec;
  const mon = species => ({ url: species ? callUrl(view, species) : '', alt: species ? speciesName(species, lang) : '', dim });
  if (!spec) return faceBox({ dim }, null, stamp);
  if (spec.wild) {
    const pair = wildPair(spec, lang);
    if (pair) return faceBox(mon(spec.team[0].species), mon(spec.team[1].species), stamp);
    return faceBox(mon(shown ?? spec.team?.[0]?.species), null, stamp);
  }
  const first = { ...trainerPicture(view.faces, spec.name), dim };
  if (!spec.foePartner) return faceBox(first, null, stamp);
  const second = { ...trainerPicture(view.faces?.foePartner, spec.foePartner.name), dim };
  return faceBox(first, { ...second, flip: samePicture(first, second) }, stamp);
}
function callUrl(view, species) {
  try { return view.faces?.speciesUrl?.(species) ?? ''; } catch { return ''; }
}

const ball = state => {
  const extra = { ok: '', status: ' x-risu-pkb-ballst', fainted: ' x-risu-pkb-ballft', empty: ' x-risu-pkb-ballnone' }[state] ?? ' x-risu-pkb-ballnone';
  return `<span class="x-risu-pkb-ball${extra}"></span>`;
};

const slots = (list, n) => Array.from({ length: n }, (_, i) => ball(list?.[i] ?? 'empty')).join('');
const balls = list => slots(list, PARTY_MAX);

function foeBalls(spec, foes) {
  if (!spec.foePartner) return balls(foes?.theirs);
  return `${slots(foes?.theirs, PAIR_TEAM_MAX)}<span class="x-risu-pkb-ballsep"></span>${slots(foes?.foePartner, PAIR_TEAM_MAX)}`;
}

export const blockBalls = spec => ({ theirs: (spec.team ?? []).map(() => 'ok'), ...(spec.foePartner ? { foePartner: spec.foePartner.team.map(() => 'ok') } : {}) });

export const ICON_PLANE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M2.5 20.5 22 12 2.5 3.5l.02 6.6L16 12 2.52 13.9z"/></svg>';
const ICON_X = '<svg viewBox="0 0 10 10" aria-hidden="true"><path stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M1.5 1.5l7 7M8.5 1.5l-7 7"/></svg>';

function btn(key, action, inner, { cls = '', label = '' } = {}) {
  return `<button type="button" class="x-risu-pkb-btn${cls ? ` ${cls}` : ''} x-risu-pkbk-${safeKey(key)} x-risu-pkba-${action} x-risu-pkbi-{{chat_index}}"`
    + `${label ? ` aria-label="${esc(label)}" title="${esc(label)}"` : ''}>${inner}</button>`;
}

function header(lang, spec, left, right = '', discardKey = null) {
  return `<div class="x-risu-pkb-hd"><span class="x-risu-pkb-pb"></span><span class="x-risu-pkb-hdt">${esc(left)}</span>`
    + (spec?.double ? `<span class="x-risu-pkb-dbl">${esc(say(lang, 'card.double'))}</span>` : '')
    + (right ? `<span class="x-risu-pkb-hdr">${esc(right)}</span>` : '')
    + (discardKey != null ? btn(discardKey, 'discard', ICON_X, { cls: 'x-risu-pkb-x', label: say(lang, 'card.discardLabel') }) : '') + '</div>';
}

function titleRow(spec, lang) {
  let badge = '';
  if (spec && !spec.wild) {
    if (spec.boss) badge = `<span class="x-risu-pkb-badge">${esc(say(lang, 'card.boss'))}</span>`;
    else if (spec.trainerClass && !String(spec.name ?? '').includes(spec.trainerClass)) {
      badge = `<span class="x-risu-pkb-badge x-risu-pkb-badgecls">${esc(spec.trainerClass)}</span>`;
    }
  }
  return `<div class="x-risu-pkb-title">${titleName(spec, lang)}${badge}</div>`;
}

function titleName(spec, lang) {
  const pair = wildPair(spec, lang);
  if (!pair) return `<span class="x-risu-pkb-name">${esc(battleTitle(spec, lang))}</span>`;
  const unit = (m, i) => `<span class="x-risu-pkb-unit">${esc(m.name)}${m.level ? `<span class="x-risu-pkb-lv">Lv${esc(m.level)}</span>` : ''}`
    + `${i < pair.mons.length - 1 ? `<span class="x-risu-pkb-join">${esc(pair.join)}</span>` : ''}</span>`;
  return `<span class="x-risu-pkb-name x-risu-pkb-pair"><span>${esc(pair.lead)}</span><span class="x-risu-pkb-units">${pair.mons.map(unit).join('')}</span></span>`;
}

function partnerRow(view, lang) {
  const partner = view.spec?.partner;
  if (!partner) return '';
  const who = [say(lang, 'card.partner'), partner.name].filter(Boolean).join(' ');
  const mons = partner.team.map(m => `<span class="x-risu-pkb-nw">${esc(`${speciesName(m.species, lang)} Lv${m.level}`)}</span>`).join(', ');
  return `<div class="x-risu-pkb-ally">${faceIn(trainerPicture(view.faces?.partner, partner.name), ALLY_IN, 'x-risu-pkb-allyface')}`
    + `<span class="x-risu-pkb-allyt"><span class="x-risu-pkb-nw">${esc(who)}</span><span class="x-risu-pkb-allysep"> · </span><span>${mons}</span></span></div>`;
}
const subRow = (spec, lang) => {
  const sub = spec ? subLine(spec, lang) : '';
  return sub ? `<div class="x-risu-pkb-sub">${esc(sub)}</div>` : '';
};
// Ball row = number of opponent Pokemon (no opponent Pokemon list). Wild battles have no ball row
const teamBalls = spec => (spec.wild ? '' : `<div class="x-risu-pkb-balls">${foeBalls(spec, blockBalls(spec))}</div>`);

function errorBox(errors, lang) {
  const items = (errors.length ? errors : [say(lang, 'card.unreadBlock')]).map(e => `<div>· ${esc(e)}</div>`).join('');
  return `<div class="x-risu-pkb-err"><div class="x-risu-pkb-errh">${esc(say(lang, 'card.cannotOpen'))}</div>${items}</div>`;
}

const wrapCard = (state, look, inner, key = null) => `\n\n<div class="x-risu-pkb-card x-risu-pkb-s-${state}${key != null ? ` x-risu-pkbc-${safeKey(key)}` : ''}">`
  + `<div class="x-risu-pkb-box x-risu-pkb-l-${look}">${inner}</div></div>\n\n`;
const tailBox = (key, inner) => `<div class="x-risu-pkb-tail x-risu-pkbt-${safeKey(key)}">${inner}</div>`;

const note = n => (n ? `<div class="x-risu-pkb-note x-risu-pkb-note-${n.kind}">${esc(n.text).replaceAll('\n', '<br>')}</div>` : '');

const buttonsOff = lang => failureText(WHAT.buttons, 'noMainScreen', lang);

export function renderCardTail(view, lang) {
  const t = key => esc(say(lang, key));
  const key = view?.key;
  const status = view?.status ?? 'ready';
  const errors = (view?.errors ?? []).filter(e => e != null && e !== '').map(String);
  if (!view?.spec || errors.length) return errorBox(errors, lang);
  let act = '';
  let buttons = status !== 'done';
  if (status === 'progress') {
    act = `<div class="x-risu-pkb-duo">${btn(key, 'resume', t('card.resume'))}`
      + `${btn(key, 'send', ICON_PLANE, { cls: 'x-risu-pkb-plane', label: say(lang, 'card.send') })}</div>`;
  } else if (status === 'done') {

    const r = view.result ?? {};
    if (view.latest && !r.storyEnded) {
      const send = !view.sent && view.canSend !== false, retry = !view.iron && view.canRetry !== false && view.canUndo !== false;
      act = (view.sent ? `<span class="x-risu-pkb-sent">✓ ${t('card.sent')}</span>` : send ? btn(key, 'send', `<span>${t('card.send')}</span>${ICON_PLANE}`, { label: say(lang, 'card.send') }) : '')
        + (retry ? btn(key, 'retry', `↻ ${t('card.retry')}`, { cls: 'x-risu-pkb-sec' }) : '');
      buttons = send || retry;
    }
  } else if (status === 'locked') {
    act = `<div class="x-risu-pkb-lock">${t('card.lockedNote')}</div>`;
  } else {
    act = btn(key, 'open', t('card.open'));
  }
  // Popup over the card: discard? (red x); retry? (retry on a card whose story continued after the result)
  const ask = view.ask === 'discard'
    ? `<div class="x-risu-pkb-pop"><div class="x-risu-pkb-dlg"><div class="x-risu-pkb-ask">${t('card.discardAsk')}</div>`
      + (status === 'progress' ? `<div class="x-risu-pkb-warn">${t(view.iron ? 'card.discardIron' : 'card.discardProgress')}</div>` : '')
      + `<div class="x-risu-pkb-duo">${btn(key, 'discardno', t('card.cancel'), { cls: 'x-risu-pkb-sec' })}${btn(key, 'discardok', t('card.discard'))}</div></div></div>`
    : view.ask === 'retry'
      ? `<div class="x-risu-pkb-pop"><div class="x-risu-pkb-dlg"><div class="x-risu-pkb-ask">${t('card.retryAsk')}</div>`
        + `<div class="x-risu-pkb-warn">${t('card.retryWarn')}</div>`
        + `<div class="x-risu-pkb-duo">${btn(key, 'retryno', t('card.cancel'), { cls: 'x-risu-pkb-sec' })}${btn(key, 'retryok', t('card.retry'))}</div></div></div>`
      : '';
  return (act ? `<div class="x-risu-pkb-act">${act}</div>` : '') + note(view.notice ?? (buttons && view.buttonsOff ? { text: buttonsOff(lang), kind: 'error' } : null)) + ask;
}

export function renderBattleCard(view, lang) {
  const spec = view?.spec ?? null;
  const errors = (view?.errors ?? []).filter(e => e != null && e !== '').map(String);
  const status = view?.status ?? 'ready';
  const key = view?.key;

  if (!spec) {
    return wrapCard('error', 'error', header(lang, null, say(lang, 'card.blockError'))
      + `<div class="x-risu-pkb-bd">${errorBox(errors, lang)}</div>`);
  }
  if (status === 'discarded') return renderDiscarded(view, lang);

  const discard = errors.length || view.canUndo === false ? null : key;
  let look, head, face, info;
  if (status === 'progress') {

    const p = view.progress ?? {};
    look = 'progress';
    head = header(lang, spec, band('progress', lang), '', discard);
    face = opponentFace(view, lang);
    info = titleRow(spec, lang) + `<div class="x-risu-pkb-rows"><div class="x-risu-pkb-row"><span class="x-risu-pkb-lbl">${esc(say(lang, 'card.mine'))}</span>${balls(p.mine)}</div>`
      + `<div class="x-risu-pkb-row"><span class="x-risu-pkb-lbl">${esc(say(lang, 'card.theirs'))}</span>${foeBalls(spec, p)}</div></div>`;
  } else if (status === 'done') {

    const r = view.result ?? {};
    const stamp = `<span class="x-risu-pkb-stamp x-risu-pkb-st${OUTCOME_CLS[r.outcome] ?? 'gray'}">${esc(outcomeLabel(r.outcome, lang))}</span>`;
    const species = spec.wild ? (r.faceSpecies ?? spec.team?.[0]?.species) : undefined;
    look = 'done';
    head = header(lang, spec, band('done', lang), !r.storyEnded && r.turns ? say(lang, 'card.turn', { n: r.turns }) : '');
    face = opponentFace(view, lang, { stamp, species });
    info = titleRow(spec, lang) + subRow(spec, lang) + (r.storyEnded ? `<span class="x-risu-pkb-ended">${esc(say(lang, 'card.storyEnded'))}</span>` : '');
  } else if (status === 'locked') {

    look = 'locked';
    head = header(lang, spec, band('locked', lang), '', discard);
    face = opponentFace(view, lang, { dim: true });
    info = titleRow(spec, lang) + subRow(spec, lang) + teamBalls(spec);
  } else {
    look = spec.wild ? 'wild' : 'trainer';
    head = header(lang, spec, band(look, lang), '', discard);
    face = opponentFace(view, lang);
    info = titleRow(spec, lang) + subRow(spec, lang) + teamBalls(spec);
  }
  const ally = partnerRow(view, lang);
  const body = `<div class="x-risu-pkb-bd${ally ? ' x-risu-pkb-bdally' : ''}">${face}<div class="x-risu-pkb-info">${info}</div>${ally}`
    + `${tailBox(key, renderCardTail({ ...view, status, errors }, lang))}</div>`;
  return wrapCard(status, look, head + body, key);
}

const ONE_LINE = `display:flex;align-items:center;gap:8px;box-sizing:border-box;max-width:470px;margin:6px 0 10px;padding:3px 6px 3px 10px;border-radius:0 7px 7px 0;font-family:${FONT};font-weight:400;font-size:12.5px;line-height:1.5;text-align:left;overflow-wrap:anywhere;`;

export function renderDiscarded(view, lang) {
  const restoreLabel = esc(say(lang, 'card.restore'));

  const style = `${ONE_LINE}border-left:4px solid #a3adb5;background:#eef0f2;color:#87929b;${view?.notice ? 'flex-wrap:wrap;' : ''}`;
  const restore = 'flex:none;margin-left:auto;width:24px;height:22px;padding:0;border:1.5px solid #8a97a2;border-radius:6px;background:#fff;color:#5f6b75;font:700 14px/1 sans-serif;box-shadow:0 1.5px 0 #8a97a2;cursor:pointer;';
  return `\n\n<div class="x-risu-pkb-col x-risu-pkb-gone x-risu-pkbc-${safeKey(view?.key)}" style="${esc(style)}"><span>⚔︎ ${esc(battleTitle(view?.spec ?? null, lang))}</span>`

    + (view?.canUndo === false ? '' : `<button type="button" class="x-risu-pkb-btn x-risu-pkbk-${safeKey(view?.key)} x-risu-pkba-restore x-risu-pkbi-{{chat_index}}" style="${esc(restore)}" aria-label="${restoreLabel}" title="${restoreLabel}">↺</button>`)
    + note(view?.notice) + '</div>\n\n';
}

export function renderCollapsed(view, lang) {
  const spec = view?.spec ?? null;
  if (spec && view.status === 'discarded') return renderDiscarded(view, lang);
  const parts = [battleTitle(spec, lang)];
  const errors = (view?.errors ?? []).filter(Boolean);
  if (!spec || errors.length) parts.push(say(lang, 'card.status.error'));
  else if (view.status === 'done') {
    const r = view.result ?? {};
    parts.push(outcomeLabel(r.outcome, lang));
    if (r.storyEnded) parts.push(say(lang, 'card.storyEnded'));
  } else parts.push(say(lang, `card.status.${STATUSES.has(view.status) ? view.status : 'ready'}`));
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

export function renderStoryChip(infos, lang) {
  const list = (infos ?? []).filter(Boolean);
  const vs = list.map(i => i.vs).filter(Boolean).at(-1) ?? '';
  const spans = list.map(i => i.turns).filter(Boolean);
  const from = spans.length ? Math.min(...spans.map(s => s[0])) : null, to = spans.length ? Math.max(...spans.map(s => s[1])) : null;
  const result = list.map(i => i.result).filter(Boolean).at(-1);
  const turns = from === null ? '' : from === to ? say(lang, 'chip.turn', { n: from }) : say(lang, 'chip.turns', { from, to });
  const parts = [say(lang, 'chip.story'), vs, turns, Object.hasOwn(OUTCOME_CLS, result) ? outcomeLabel(result, lang) : ''].filter(Boolean);
  const [head, ...rest] = parts;
  return `\n\n<span class="x-risu-pkb-chip"><span class="x-risu-pkb-chipi">${ICON_PLANE}</span>`
    + `<span class="x-risu-pkb-chipt">${esc(head)}${rest.map(p => `<span class="x-risu-pkb-chips"> · </span>${esc(p)}`).join('')}</span></span>\n\n`;
}
