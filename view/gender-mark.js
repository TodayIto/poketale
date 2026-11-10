export const GENDER_MARK = Object.freeze({
  M: Object.freeze([
    '.....####',
    '.......##',
    '......#.#',
    '.....#..#',
    '.####....',
    '#....#...',
    '#....#...',
    '#....#...',
    '#....#...',
    '.####....',
  ]),
  F: Object.freeze([
    '..###..',
    '.#...#.',
    '#.....#',
    '#.....#',
    '.#...#.',
    '..###..',
    '...#...',
    '.#####.',
    '...#...',
    '...#...',
  ]),
});

export const GENDER_MARK_BATTLE = Object.freeze({
  M: Object.freeze([
    '....####',
    '......##',
    '.....#.#',
    '....#..#',
    '.###....',
    '#...#...',
    '#...#...',
    '#...#...',
    '.###....',
  ]),
  F: Object.freeze([
    '.###.',
    '#...#',
    '#...#',
    '#...#',
    '.###.',
    '..#..',
    '.###.',
    '..#..',
    '..#..',
  ]),
});

export const textGenderSigns = text => String(text).replace(/([\u2640\u2642])\uFE0F/g, '$1');

export const nameShowsGender = name => /[\u2640\u2642]/.test(String(name ?? ''));

export const GENDER_MARK_COLORS = Object.freeze({ M: '#3b78c9', F: '#e0577a' });

export const MARK_EM = 12;

export function markSize(gender, marks = GENDER_MARK) {
  const rows = marks[gender];
  return rows ? { w: Math.max(...rows.map(row => row.length)), h: rows.length } : null;
}

export function markRuns(gender, marks = GENDER_MARK) {
  const runs = [];
  (marks[gender] ?? []).forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      let end = x;
      while (row[end] === '#') end++;
      if (end > x) runs.push({ x, y, w: end - x });
      x = Math.max(end, x + 1);
    }
  });
  return runs;
}

const emOf = px => `${Math.round(px / MARK_EM * 10000) / 10000}em`;

export function genderMarkSvg(gender, { color = 'currentColor', cls = '', label = '' } = {}) {
  const size = markSize(gender);
  if (!size) return '';
  const rects = markRuns(gender).map(({ x, y, w }) => `<rect x="${x}" y="${y}" width="${w}" height="1"/>`).join('');
  const a11y = label ? `role="img" aria-label="${String(label).replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`)}"` : 'aria-hidden="true"';
  return `<svg${cls ? ` class="${cls}"` : ''} viewBox="0 0 ${size.w} ${size.h}" width="${emOf(size.w)}" height="${emOf(size.h)}" shape-rendering="crispEdges" ${a11y}>`
    + `<g fill="${color}">${rects}</g></svg>`;
}
