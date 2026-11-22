import { norm } from './norm.mjs';
import { TARGETS, recolorKey, hasHair, PALETTES, STYLE_POLICY, STYLE_SNAP } from '../view/sprites/recolor.js';
import { POOL, NUMBER } from './trainer-pool.mjs';

/** Target colour names, in number order (number = index + 1) */
export const HAIR_COLORS = Object.freeze(TARGETS.hair.map(t => t.name));
export const OUTFIT_COLORS = Object.freeze(TARGETS.outfit.map(t => t.name));

const HAIR_WORDS = {
  black: ['black', 'dark', 'jet', 'raven', 'charcoal', 'ebony', '검은', '검정', '까만', '까망', '흑발', '흑색', '검은색', '어두운', '칠흑', '먹색'],
  brown: ['brown', 'brunette', 'chestnut', '갈색', '갈발', '밤색', '브라운', '고동'],
  light_brown: ['lightbrown', 'lightbrunette', 'hazel', 'sandy', 'tan', 'peach', '밝은갈색', '연갈색', '연한갈색', '라이트브라운', '황갈색', '황토'],
  blonde: ['blonde', 'blond', 'golden', 'gold', 'yellow', 'cream', 'mustard', 'platinumblonde', '금발', '금색', '황금', '노란', '노랑', '블론드', '크림', '겨자',
    '머스타드', '머스터드', '플래티넘블론드'],
  red: ['red', 'reddish', 'ginger', 'auburn', 'crimson', 'scarlet', 'orange', 'burgundy', 'wine', 'maroon', 'coral', 'salmon', 'ruby', 'cherry', 'tangerine',
    '빨간', '빨강', '붉은', '적발', '적색', '홍발', '주황', '다홍', '레드', '버건디', '와인', '코랄', '산호', '연어색', '진홍', '선홍', '핏빛', '루비', '체리', '귤색'],
  white: ['white', 'silver', 'grey', 'gray', 'platinum', 'ivory', '흰', '하얀', '하양', '은발', '백발', '은색', '회색', '잿빛', '백색', '실버', '우유색', '아이보리'],
  blue: ['blue', 'bluish', 'navy', 'cyan', 'teal', 'azure', 'aqua', 'cobalt', 'sapphire', '파란', '파랑', '푸른', '청색', '하늘색', '남색', '청발', '블루',
    '아쿠아', '코발트', '사파이어', '쪽색'],
  pink: ['pink', 'rose', 'magenta', 'fuchsia', 'coralpink', '분홍', '핑크', '연분홍', '장밋빛', '자홍', '마젠타', '코랄핑크'],
  green: ['green', 'emerald', 'mint', 'turquoise', 'lime', 'jade', '초록', '녹색', '연두', '풀색', '그린', '민트', '청록', '터키석', '터쿼이즈', '에메랄드',
    '라임', '비취', '녹발'],
  purple: ['purple', 'purplish', 'violet', 'lavender', 'lilac', 'mauve', '보라', '자주', '퍼플', '라벤더'],
};
const OUTFIT_WORDS = {
  red: ['red', 'reddish', 'crimson', 'scarlet', 'maroon', 'burgundy', 'wine', 'salmon', 'ruby', 'cherry', '빨간', '빨강', '붉은', '적색', '레드', '와인색',
    '버건디', '와인', '연어색', '진홍', '선홍', '핏빛', '루비', '체리'],
  orange: ['orange', 'coral', 'tangerine', '주황', '오렌지', '다홍', '코랄', '산호', '귤색'],
  yellow: ['yellow', 'gold', 'golden', 'mustard', '노란', '노랑', '황색', '금색', '옐로', '겨자', '머스타드', '머스터드'],
  green: ['green', 'olive', 'khaki', 'mint', 'emerald', 'turquoise', 'lime', 'jade', 'camo', '초록', '녹색', '연두', '카키', '올리브', '그린', '민트', '에메랄드',
    '청록', '터키석', '터쿼이즈', '라임', '비취', '카모', '군복무늬', '위장무늬'],
  blue: ['blue', 'bluish', 'skyblue', 'cyan', 'teal', 'azure', 'denim', 'aqua', 'cobalt', 'sapphire', '파란', '파랑', '푸른', '하늘색', '청색', '블루', '청바지',
    '데님', '아쿠아', '코발트', '사파이어'],
  navy: ['navy', 'darkblue', 'deepblue', 'indigo', '남색', '네이비', '감색', '곤색', '쪽색', '짙은파란', '짙은파랑', '진한파란', '진한파랑', '어두운파란', '어두운파랑'],
  purple: ['purple', 'purplish', 'violet', 'lavender', 'lilac', 'mauve', '보라', '자주', '퍼플', '라벤더'],
  pink: ['pink', 'rose', 'magenta', 'fuchsia', 'coralpink', '분홍', '핑크', '자홍', '마젠타', '코랄핑크'],
  black: ['black', 'dark', 'ebony', '검은', '검정', '까만', '흑색', '블랙', '어두운', '칠흑', '먹색'],
  white: ['white', 'ivory', 'cream', 'silverwhite', '흰', '하얀', '하양', '백색', '화이트', '아이보리', '크림', '우유색'],
  brown: ['brown', 'tan', 'chestnut', 'ochre', '갈색', '밤색', '브라운', '고동', '황토'],
  grey: ['grey', 'gray', 'charcoal', 'darkgrey', 'darkgray', '회색', '잿빛', '그레이', '진회색'],

  beige: ['beige', 'sand', 'camel', 'peach', 'apricot', '베이지', '모래색', '살구색'],
  light_grey: ['lightgrey', 'lightgray', 'silver', 'ash', 'platinum', '연회색', '밝은회색', '은색', '실버', '은회색'],
};

const BOTTOM_WORDS = ['pants', 'trousers', 'jeans', 'skirt', 'shorts', 'slacks', 'leggings', 'bottom', '바지', '치마', '스커트', '반바지', '청바지', '레깅스', '하의', '슬랙스'];

const WEAK = new Set(['dark', '어두운']);

const ACCENTS = ['trim', 'accent', 'stripe', 'piping', 'edg', 'embroider', 'detail', 'stitch', 'border', 'buttons', 'lining', 'lined', 'pattern', 'ribbon',
  'streak', 'highlight', 'tip', '테두리', '장식', '무늬', '줄', '포인트', '자수', '단추', '라인', '리본', '브릿지', '하이라이트', '메쉬', '끝'].join('|');
const ACCENT_AFTER = new RegExp(`^(?:색|빛)?의?(?:${ACCENTS})`, 'u');
const ACCENT_BEFORE = new RegExp(`(?:${ACCENTS})[a-z]{0,4}(?:with|in|of|이|가|은|는|에|으로|로)$`, 'u');

const TINT_AFTER = /^(?:ish|tinged|tint|빛|(?:색|기|끼)[이가]?(?:살짝)?감?도는|[이가]?(?:살짝)?감?도는)/u;

const SYLLABLE = /^[가-힣]$/u;
const batchim = ch => (ch.charCodeAt(0) - 0xac00) % 28 !== 0;

const siot = word => word.slice(0, -1) + String.fromCharCode(word.charCodeAt(word.length - 1) + 19);

const NO_BIT = new Set(['감', '녹']);

function withBit(words) {
  const out = [];
  for (const w of words) {
    out.push(w);
    const stem = w.endsWith('색') ? w.slice(0, -1) : w;
    const last = stem.at(-1);
    if (!last || !SYLLABLE.test(last) || NO_BIT.has(stem)) continue;
    if (stem !== w) out.push(stem + '빛');
    if (!batchim(last)) out.push(siot(stem) + '빛');
  }
  return out;
}

/** words table -> [[normalised word, colour name], ...] longest first */
const byLength = table => Object.entries(table).flatMap(([name, list]) => withBit(list.map(norm)).map(w => [w, name])).sort((a, b) => b[0].length - a[0].length);
const HAIR_LIST = byLength(HAIR_WORDS), OUTFIT_LIST = byLength(OUTFIT_WORDS);
const BOTTOM_LIST = BOTTOM_WORDS.map(norm);

const HAIR_NOUNS = new Set(HAIR_LIST.map(([w]) => w).filter(w => w.endsWith('발')));

function colorIn(text, list, names) {
  const n = NUMBER.exec(text);
  if (n) return names[+n[1] - 1] ?? null;
  const s = norm(text);
  let best = null;
  for (let at = 0; at < s.length;) {
    const hit = list.find(([word]) => s.startsWith(word, at));
    if (!hit) { at++; continue; }
    const [word, name] = hit, end = at + word.length, after = s.slice(end);
    const rank = word.endsWith('ish') || TINT_AFTER.test(after) || ACCENT_AFTER.test(after) || ACCENT_BEFORE.test(s.slice(0, at)) ? 3
      : HAIR_NOUNS.has(word) ? 0 : WEAK.has(word) ? 2 : 1;
    if (!best || rank < best.rank) best = { rank, name };
    at = end;
  }
  return best?.name ?? null;
}

/** A hair field's value -> hair colour name | null */
export const readHair = value => colorIn(String(value ?? ''), HAIR_LIST, HAIR_COLORS);

const JOINER = /^(.*?[가-힣])(이랑|랑|와|과)$/u;

function splitJoined(part) {
  const words = part.trim().split(/\s+/), out = [];
  let cur = [];
  words.forEach((word, i) => {
    cur.push(word);
    const m = i < words.length - 1 && JOINER.exec(word);
    if (!m || batchim(m[1].at(-1)) !== (m[2] === '과' || m[2] === '이랑')) return;
    const w = norm(word);
    if (OUTFIT_LIST.some(([color]) => w.endsWith(color))) return;
    cur[cur.length - 1] = m[1];
    out.push(cur.join(' '));
    cur = [];
  });
  if (cur.length) out.push(cur.join(' '));
  return out;
}

export function readOutfit(value) {
  const text = String(value ?? '');
  const whole = NUMBER.test(text);
  const parts = whole ? [text] : text.split(/\s*(?:[,，/·&+;]|\band\b|그리고|하고)\s*/iu).filter(Boolean).flatMap(splitJoined);
  let top = null, bottom = null;
  for (const part of parts) {
    const color = colorIn(part, OUTFIT_LIST, OUTFIT_COLORS);
    if (!color) continue;
    const lower = norm(part);
    if (BOTTOM_LIST.some(w => lower.includes(w))) bottom ??= color;
    else top ??= color;
  }
  return top || bottom ? { top, bottom } : null;
}

const ALL_PARTS = Object.freeze(new Set(['head', 'top', 'bottom']));

export function colorParts(sprite) {
  const entry = POOL[sprite];
  if (!entry) return ALL_PARTS;
  return new Set(STYLE_POLICY[entry.styles[0]] ?? []);
}

export function colorCombo(sprite, colors, styled = false) {
  const parts = PALETTES[sprite]?.parts;
  if (!parts || !colors) return null;
  const allow = styled ? colorParts(sprite) : ALL_PARTS, snap = styled ? STYLE_SNAP[POOL[sprite]?.styles[0]] : null;
  const num = (names, name) => (name ? names.indexOf(name) + 1 : 0);

  const outfit = name => num(OUTFIT_COLORS, name && snap ? (snap.lightColors.includes(name) ? snap.light : snap.dark) : name);
  const top = allow.has('top') && parts.top?.length ? outfit(colors.top) : 0;
  const bottom = allow.has('bottom') && parts.bottom?.length ? outfit(colors.bottom ?? (parts.top?.length ? null : colors.top)) : 0;
  return { hair: allow.has('head') && hasHair(sprite) ? num(HAIR_COLORS, colors.hair) : 0, top, bottom }; // hair or a hat (the hat takes the hair colour)
}

export const coloredSprite = (sprite, colors, styled = false) => recolorKey(sprite, colorCombo(sprite, colors, styled));

export const showsHair = (sprite, styled = false) => hasHair(sprite) && (!styled || colorParts(sprite).has('head'));
