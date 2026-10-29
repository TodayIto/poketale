import { CARD_CSS, CHIP_CSS } from './card.mjs';
import { DIARY_CSS } from './diary.mjs';
import { TOAST_CSS } from './toast.mjs';

// Class of the <style> inserted in the main document (found again on reload so only its text is replaced)
export const SHEET_CLASS = 'x-risu-pkb-sheet';

export function scopeCss(css, scope) {
  if (!scope) return css;
  const rules = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open < 0) break;
    let depth = 0, close = open;
    for (; close < css.length; close++) {
      if (css[close] === '{') depth++;
      else if (css[close] === '}' && --depth === 0) break;
    }
    const head = css.slice(i, open).trim();
    const block = css.slice(open, close + 1);
    if (/^@(container|media)\b/.test(head)) rules.push(`${head}{${scopeCss(block.slice(1, -1), scope)}}`);
    else rules.push((head.startsWith('@') ? head : head.split(',').map(s => `${scope} ${s.trim()}`).join(',')) + block);
    i = close + 1;
  }
  return rules.join(' ');
}

export function storyCss({ scope = '.chattext' } = {}) {
  return scopeCss([CARD_CSS, CHIP_CSS, DIARY_CSS].join(' '), scope);
}

export const SHEET_FONT = 'PkbPixel';

export const fontFaceCss = (name, base64) => `@font-face{font-family:"${name}";src:url(data:font/woff2;base64,${base64}) format("woff2");font-weight:400;}`;

export async function sheetCss() {
  const { FONTS } = await import('embedded:fonts');
  return `${fontFaceCss(SHEET_FONT, FONTS[SHEET_FONT])} ${storyCss()} ${TOAST_CSS}`;
}
