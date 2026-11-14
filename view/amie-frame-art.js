export const TRAY = Object.freeze({
  tall: Object.freeze({ h: 110, inset: 46, top: 4, lip: 47, bottom: 51, ear: [15, 41], earW: 10, slot: [6, 3] }),
  wide: Object.freeze({ h: 124, inset: 64, top: 4, lip: 53, bottom: 58, ear: [17, 47], earW: 12, slot: [8, 4] }),
});
export const TRAY_COLORS = Object.freeze({
  ink: '#23435f', drop: '#1a3247', rimHi: '#f6dcaa', rim: '#e8c48a', cloth: '#fff8ea', check: '#fbecd0', clothEdge: '#f2dcb4',
  lip: '#e0b878', side: '#c8965a', grain: '#b5834a', slot: '#8a6440',
});
export const CARD_COLORS = Object.freeze({
  berry: '#7cc45a', head: '#5aa8e8', tile: '#f0b040', cream: '#fff6dc', creamEdge: '#f0d89a', best: '#5d7486',
  tag: '#ffd84a', tagHi: '#fff1a0', tagLow: '#e8b830', tagInk: '#8a5a00',
});

function paths(w, h, colorAt) {
  const by = {};
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w;) {
      const c = colorAt(x, y);
      let end = x + 1;
      while (end < w && colorAt(end, y) === c) end++;
      if (c) by[c] = `${by[c] || ''}M${x} ${y}h${end - x}v1h${x - end}z`;
      x = end;
    }
  }
  return Object.entries(by).map(([c, d]) => `<path fill="${c}" d="${d}"/>`).join('');
}
const svg = (w, h, dot, body) => `<svg viewBox="0 0 ${w} ${h}" width="${w * dot}" height="${h * dot}" shape-rendering="crispEdges" aria-hidden="true">${body}</svg>`;

const shaped = (inside, fill, ink, drop, down) => (x, y) => {
  if (!inside(x, y)) return [...Array(down)].some((_, k) => inside(x, y - k - 1)) ? drop : null;
  return inside(x - 1, y) && inside(x + 1, y) && inside(x, y - 1) && inside(x, y + 1) ? fill(x, y) : ink;
};

const ROUND = [3, 2, 1, 1];

const bodyAt = (d, y) => d.earW + (y > d.lip ? (y === d.bottom ? 2 : 1) : (ROUND[y - d.top] ?? 0));
const inTray = d => (x, y) => {
  if (y >= d.top && y <= d.bottom && x >= bodyAt(d, y)) return true;
  const [a, b] = d.ear, k = Math.min(y - a, b - y);
  return k >= 0 && x >= 0 && x <= d.earW && x >= ([2, 1][k] ?? 0);
};
const LEAF = ['.##', '###', '#..'];

function trayDot(d, gx0) {
  const C = TRAY_COLORS, [a, b] = d.ear, [sw, sh] = d.slot, sy = Math.round((a + b - 3) / 2 - sh / 2), E = d.inset / 2;
  return shaped(inTray(d), (x, y) => {
    const gx = gx0(x);
    if (x < d.earW) {
      if (x >= d.earW - sw && y >= sy && y < sy + sh) return y === sy ? C.ink : C.slot;
      return y === a + 1 ? C.rimHi : y < b - 3 ? C.rim : y === b - 3 ? C.lip : C.side;
    }
    const dy = y - d.top, dx = x - bodyAt(d, y);
    if (y > d.lip) {
      const lx = x - E + 8, ly = y - d.lip - 1;
      if (LEAF[ly]?.[lx] === '#') return C.rim;
      return y === d.lip + 2 && (gx % 8 + 8) % 8 < 5 ? C.grain : C.side;
    }
    if (y === d.lip) return C.lip;
    if (dy === 1 || dx === 1) return C.rimHi;
    if (dy < 3 || dx < 3) return C.rim;
    if (dy === 3 || dx === 3) return C.clothEdge;
    return (Math.floor((dy - 3) / 4) + Math.floor(((gx % 8) + 8) % 8 / 4)) % 2 ? C.check : C.cloth;
  }, C.ink, C.drop, 2);
}

export function trayEndSvg({ tall = true, side = 'l', mid = 0 } = {}) {
  const d = tall ? TRAY.tall : TRAY.wide, E = d.inset / 2, m = Math.round(mid / 2);
  const dot = trayDot(d, side === 'l' ? x => x - E : x => m + E - 1 - x);
  return svg(E, d.h / 2, 2, paths(E, d.h / 2, side === 'l' ? dot : (x, y) => dot(E - 1 - x, y)));
}

export function trayMiddleSvg({ tall = true } = {}) {
  const d = tall ? TRAY.tall : TRAY.wide, id = `pkb-tray-${tall ? 't' : 'w'}`, dot = trayDot(d, x => x - 99);
  return `<svg width="100%" height="${d.h}" shape-rendering="crispEdges" aria-hidden="true"><defs><pattern id="${id}" patternUnits="userSpaceOnUse" width="16" height="${d.h}">`
    + `<g transform="scale(2)">${paths(8, d.h / 2, (x, y) => dot(x + 99, y))}</g></pattern></defs><rect width="100%" height="${d.h}" fill="url(#${id})"/></svg>`;
}

const CORNERS = {
  berry: [['..LA', '.LVA', 'LVA.', 'VA..'], { L: '#a6dc78', A: '#7cc45a', V: '#4ea04e' }],
  head: [['.BB.', 'BBBB', 'WNNW', '.WW.'], { B: '#5aa8e8', W: '#fbfbf4', N: '#23435f' }],
  tile: [['AABB', 'AABB', 'BBAA', 'BBAA'], { A: '#f0b040', B: '#ffe08a' }],
};

export function cardCornerSvg(game) {
  const [rows, colors] = CORNERS[game] || CORNERS.tile;
  return svg(4, 4, 3, paths(4, 4, (x, y) => colors[rows[y][x]] || null));
}

export function recordTagSvg({ tall = true } = {}) {
  const C = CARD_COLORS, W = tall ? 40 : 46, H = tall ? 12 : 14, mid = (H - 1) / 2;
  const cut = y => Math.round(3 * (1 - Math.abs(y - mid) / mid));
  const inside = (x, y) => y >= 0 && y < H && x >= cut(y) && x < W - cut(y);
  return svg(W, H + 1, 2, paths(W, H + 1, shaped(inside, (x, y) => (y === 1 ? C.tagHi : y === H - 2 ? C.tagLow : C.tag), C.tagInk, '#1a3247', 1)));
}
