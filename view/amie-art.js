import { PUFF_FLAVORS, PUFF_GRADES } from '../story/amie.mjs';

export const HEARTS = 3;

const HEART_ROWS = ['.XX.XX.', 'XHHXHHX', 'XHHHHHX', '.XHHHX.', '..XHX..', '...X...'];
const PIXELS = {
  heart: { rows: HEART_ROWS, colors: { X: '#7a1f33', H: '#ee4f6a' } },

  heartCold: { rows: HEART_ROWS, colors: { X: '#4d6274', H: '#a9bccb' } },
  note: { rows: ['...XX', '...XX', '...X.', '...X.', '.XXX.', 'XXXX.', '.XX..'], colors: { X: '#2f6fd0' }, edge: '#f4f8ff' },
  bang: { rows: ['.XXX.', 'XYYYX', 'XYYYX', 'XYYYX', '.XYX.', '.XYX.', '..X..', '.....', '.XXX.', '.XYX.', '.XXX.'], colors: { X: '#5a3a00', Y: '#ffd84a' } },
  anger: { rows: ['.X...X.', 'XRX.XRX', '.XR.RX.', '.......', '.XR.RX.', 'XRX.XRX', '.X...X.'], colors: { X: '#8e1c1c', R: '#ff4f4f' } },
  spark: { rows: ['...Y...', '...Y...', '.Y.Y.Y.', '..YWY..', 'YYWWWYY', '..YWY..', '.Y.Y.Y.', '...Y...', '...Y...'], colors: { Y: '#ffd84a', W: '#ffffff' } },
  zee: { rows: ['XXXXX', '...X.', '..X..', '.X...', 'XXXXX'], colors: { X: '#23435f' }, edge: '#f4f8ff' },
  crumb: { rows: ['XX', 'XX'], colors: { X: '#c8955a' } },
  star: { rows: ['....X....', '...XYX...', 'XXXXYXXXX', 'XYYYYYYYX', '.XYYYYYX.', '..XYYYX..', '.XYYXYYX.', '.XYX.XYX.', '.XX...XX.'], colors: { X: '#8a5a00', Y: '#ffd84a' } },
  starOff: { rows: ['....X....', '...X.X...', 'XXXX.XXXX', 'X.......X', '.X.....X.', '..X...X..', '.X..X..X.', '.X.X.X.X.', '.XX...XX.'], colors: { X: '#6a7a88' } },
};

const PUFF_ROWS = {
  basic: ['....XXXX....', '..XXCCCCXX..', '.XCCCCCCCCX.', '.XCCCCCCCCX.', 'XCCCCCCCCCCX', 'XDDDDDDDDDDX', 'XDDDDDDDDDDX', '.XDDDDDDDDX.', '..XXXXXXXX..'],
  frosted: ['....XXXX....', '..XXWWWWXX..', '.XWWWWWWWWX.', '.XWCWWCWWCX.', 'XCCCCCCCCCCX', 'XDDDDDDDDDDX', 'XDDDDDDDDDDX', '.XDDDDDDDDX.', '..XXXXXXXX..'],
  fancy: ['.....RR.....', '....XRRX....', '..XXWWWWXX..', '.XWWWWWWWWX.', '.XWCWWCWWCX.', 'XCCCCCCCCCCX', 'XDDDDDDDDDDX', 'XDDDDDDDDDDX', '.XDDDDDDDDX.', '..XXXXXXXX..'],
  deluxe: ['G....RR....G', '....XRRX....', '..XXWWWWXX..', '.XWGWWWWGWX.', '.XWCWWCWWCX.', 'XCCGCCCCGCCX', 'XDDDDDDDDDDX', 'XDGDDDDDDGDX', '.XDDDDDDDDX.', '..XXXXXXXX..'],
};
const PUFF_COLORS = {
  sweet: { C: '#f7a8c8', D: '#d0608e' }, mint: { C: '#b4e6a4', D: '#4f9a4a' }, citrus: { C: '#ffd27a', D: '#e08a20' },
  mocha: { C: '#d2a67a', D: '#7a5030' }, spice: { C: '#e8887a', D: '#9a3428' },
};

const BERRY_ROWS = ['....LL...', '...LL....', '..XXXXX..', '.XBBBBBX.', 'XBSBBBBBX', 'XBSBBBBBX', 'XBBBBBBBX', 'XBBBBBBDX', '.XBBBBDX.', '..XXXXX..'];
const BERRY_COLORS = ['#e0405a', '#5a50c8', '#f0d040', '#9ad04a', '#f080c0', '#3a8a5a', '#f0e8a0'];

const BALL_ROWS = ['..XXXXX..', '.XWWWWWX.', 'XSSWWWSSX', 'XWSSSSSWX', 'XWWWWWWWX', 'XSSWWWSSX', 'XWSSSSSWX', '.XWWWWWX.', '..XXXXX..'];
const BALL_COLORS = ['#e0405a', '#3a7ad8', '#e8a020'];
const PURPLE_BALL = '#9a4ad8';

const GIANT_D = 21;
const GIANT_ROWS = Array.from({ length: GIANT_D }, (_, y) => Array.from({ length: GIANT_D }, (_, x) => {
  const r = GIANT_D / 2, d = Math.hypot(x + 0.5 - r, y + 0.5 - r);
  if (d > r) return '.';
  if (d > r - 1.2) return 'X';
  if (Math.hypot(x + 0.5 - r * 0.6, y + 0.5 - r * 0.55) < 1.6) return 'H';
  return 'AWBWCW'[Math.floor((x + y) / 3) % 6];
}).join(''));

export const FOOD_ART = Object.freeze({
  cookie: { emoji: ['🍪'], rows: [
    '................', '....XXXXXXXX....', '...XCCCCCCCCX...', '..XCCCCCCDCCCX..', '.XCCCDCCCCCCSSX.', '.XCCCCHCCCCCCSX.', '.XCDCHHCCCCDCSX.', 'XCCCCCCCDCCCCSSX',
    'XCCCDCCCCCCCCSSX', '.XCCCCCCCCCCCSX.', '.XCCCCCCCCDCCSX.', '.XCCCCDCCCCCSSX.', '..XCSCCCCCCSSX..', '...XSSSSSSSSX...', '....XXXXXXXX....', '................'],
  colors: { X: '#5a3424', C: '#e2ac6c', H: '#f4cc94', D: '#5a2e16', S: '#bb7d43' } },
  riceBall: { emoji: ['🍙'], rows: [
    '................', '.......XX.......', '......XWWX......', '.....XWWWWX.....', '....XWWWWWWX....', '....XHWWWWWX....', '...XWHHWWWWWX...', '...XWHHWWWWWX...',
    '..XWWWWWWWWWWX..', '..XGWNNNNNNWGX..', '.XGWWNNNNNNWWGX.', '.XWWWNNNNNNWWWX.', '.XGGGNNNNNNGGGX.', '.XGGGNNNNNNGGGX.', '.XGGGNNNNNNGGGX.', '..XXXXXXXXXXXX..'],
  colors: { X: '#3a3a44', W: '#fbfbf4', H: '#ffffff', G: '#d6d6c8', N: '#26443a' } },
  apple: { emoji: ['🍎'], rows: [
    '......XTXXLLX...', '.......XTLLX....', '......XXTLX.....', '....XXRXXRXX....', '...XRRRRRRRRX...', '..XRHRRRRRRRRX..', '.XRHHRRRRRRRRRX.', 'XRRHRRRRRRRRRRRX',
    'XRRHRRRRRRRRRDDX', 'XRRRRRRRRRRRRDDX', 'XRRRRRRRRRRRDDDX', '.XRRRRRRRRRRDDX.', '.XRRRRRRRRRDDDX.', '..XDDDDDDDDDDX..', '...XXDDXXDDXX...', '.....XX..XX.....'],
  colors: { X: '#5a1418', R: '#e0403a', H: '#ffa08e', D: '#a82428', L: '#4f9a3a', T: '#6a4428' } },
});

export const foodArtOf = emoji => (emoji ? Object.keys(FOOD_ART).find(name => FOOD_ART[name].emoji.includes(emoji)) ?? null : null);

export function foodTexture(scene, emoji) {
  const name = foodArtOf(emoji);
  if (!name) return null;
  paint(scene, `amie-food-${name}`, FOOD_ART[name].rows, FOOD_ART[name].colors);
  return `amie-food-${name}`;
}

const BUBBLE = [
  '..XXXXXXXXXXX..', '.XWWWWWWWWWWWX.', 'XWWWWWWWWWWWWWX', 'XWWWWWWWWWWWWWX', 'XWWWWWWWWWWWWWX', 'XWWWWWWWWWWWWWX', 'XWWWWWWWWWWWWWX',
  'XWWWWWWWWWWWWWX', 'XWWWWWWWWWWWWWX', 'XWWWWWWWWWWWWWX', '.XWWWWWWWWWWWX.', '..XXXXWWWXXXX..', '......XWX......', '.......X.......'];

export const EMOTES = Object.freeze({

  dots: { rows: ['.........', '.........', '.........', '.A..A..A.', '.........', '.........', '.........'], colors: { A: '#23435f' } },

  drop: { rows: ['....A....', '...ABA...', '..ABBBA..', '.ABBBBBA.', '.ABHBBBA.', '..ABBBA..', '...AAA...'], colors: { A: '#2a5aa0', B: '#7cc4f0', H: '#ffffff' } },

  cross: { rows: ['.A.....A.', 'AAA...AAA', '.AAA.AAA.', '..AAAAA..', '.AAA.AAA.', 'AAA...AAA', '.A.....A.'], colors: { A: '#d8434d' } },

  heart: { rows: ['.AA...AA.', 'ABBA.ABBA', 'ABBBABBBA', 'ABBBBBBBA', '.ABBBBBA.', '..ABBBA..', '...ABA...'], colors: { A: '#7a1f33', B: '#ee4f6a' } },

  zzz: { rows: ['....AAAAA', '.......A.', 'AAAA..A..', '...A.AAAA', '..A......', '.A.......', 'AAAA.....'], colors: { A: '#23435f' } },

  bang: { rows: ['...AAA...', '...ABA...', '...ABA...', '...ABA...', '...AAA...', '.........', '...AAA...'], colors: { A: '#8e1c1c', B: '#ff5a4f' } },

  sparkle: { rows: ['..A......', '.ABA...A.', '..A...ABA', '......ABA', '..A....A.', '.ABA.....', '..A......'], colors: { A: '#c98a1d', B: '#ffe27a' } },
});

const emoteRows = kind => BUBBLE.map((row, y) => (y >= 2 && y < 9 ? row.slice(0, 3) + EMOTES[kind].rows[y - 2].replace(/\./g, 'W') + row.slice(12) : row));

export function emote(scene, into, kind, x, y, { tweens = scene.tweens } = {}) {
  const icon = scene.add.image(x, y, `amie-emote-${kind}`).setOrigin(0.5, 1).setScale(0.4).setAlpha(0);
  into.add(icon);
  tweens.add({ targets: icon, scale: 1.5, alpha: 1, duration: 180, ease: 'Back.easeOut' });
  tweens.add({ targets: icon, alpha: 0, y: y - 6, delay: 1400, duration: 350, onComplete: () => icon.destroy() });
  return icon;
}

export function pixelSvg(rows, colors) {
  const w = Math.max(...rows.map(row => row.length)), h = rows.length;
  let rects = '';
  rows.forEach((row, y) => {

    for (let x = 0; x < row.length;) {
      const c = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === c) end++;
      if (colors[c]) rects += `<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${colors[c]}"/>`;
      x = end;
    }
  });
  return `<svg viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
}

export function artSvg(name) {
  if (FOOD_ART[name]) return pixelSvg(FOOD_ART[name].rows, FOOD_ART[name].colors);
  if (name === 'starHalf') {
    const on = PIXELS.star.rows, off = PIXELS.starOff.rows;
    return pixelSvg(on.map((row, y) => row.slice(0, 5) + off[y].slice(5).replace(/X/g, 'O')), { ...PIXELS.star.colors, O: PIXELS.starOff.colors.X });
  }
  if (PIXELS[name]) return pixelSvg(PIXELS[name].rows, PIXELS[name].colors);
  if (name === 'berry') return pixelSvg(BERRY_ROWS, { X: '#3a2a2a', B: BERRY_COLORS[0], S: '#ffffffcc', D: '#00000040', L: '#3a9a3a' });
  if (name === 'head') return pixelSvg(BALL_ROWS, { X: '#2a2a3a', W: '#fbfbf4', S: BALL_COLORS[1] });
  if (name === 'tile') {
    return pixelSvg(['XXXXXXXXX', 'XAAAXBBBX', 'XAAAXBBBX', 'XAAAXBBBX', 'XXXXXXXXX', 'XCCCXAAAX', 'XCCCXAAAX', 'XCCCXAAAX', 'XXXXXXXXX'],
      { X: '#23435f', A: '#7cc4e8', B: '#9ad04a', C: '#f0d040' });
  }
  return '';
}

function paint(scene, key, rows, colors, edge) {
  if (scene.textures.exists(key)) return;
  const pad = edge ? 1 : 0;
  const canvas = scene.textures.createCanvas(key, rows[0].length + pad * 2, rows.length + pad * 2);
  const ctx = canvas.getContext();
  const each = draw => rows.forEach((row, y) => [...row].forEach((c, x) => { if (colors[c]) draw(c, x + pad, y + pad); }));
  if (edge) { ctx.fillStyle = edge; each((c, x, y) => ctx.fillRect(x - 1, y - 1, 3, 3)); }
  each((c, x, y) => { ctx.fillStyle = colors[c]; ctx.fillRect(x, y, 1, 1); });
  canvas.refresh();
}

export function artTexture(scene, name) {
  const { rows, colors, edge } = PIXELS[name];
  paint(scene, `amie-${name}`, rows, colors, edge);
  return `amie-${name}`;
}

export function amieTextures(scene) {
  for (const [name, { rows, colors, edge }] of Object.entries(PIXELS)) paint(scene, `amie-${name}`, rows, colors, edge);
  for (const flavor of PUFF_FLAVORS) {
    for (const grade of PUFF_GRADES) {
      paint(scene, `amie-puff-${flavor}_${grade}`, PUFF_ROWS[grade], { X: '#5a3424', W: '#fffaf2', R: '#e02838', G: '#ffd84a', ...PUFF_COLORS[flavor] });
    }
  }
  BERRY_COLORS.forEach((color, i) => paint(scene, `amie-berry-${i}`, BERRY_ROWS, { X: '#3a2a2a', B: color, S: '#ffffffcc', D: '#00000040', L: '#3a9a3a' }));
  BALL_COLORS.forEach((color, i) => paint(scene, `amie-ball-${i}`, BALL_ROWS, { X: '#2a2a3a', W: '#fbfbf4', S: color }));
  paint(scene, 'amie-ball-purple', BALL_ROWS, { X: '#2a2a3a', W: '#fbfbf4', S: PURPLE_BALL });
  paint(scene, 'amie-ball-giant', GIANT_ROWS, { X: '#2a2a3a', W: '#fbfbf4', H: '#ffffff', A: BALL_COLORS[0], B: BALL_COLORS[1], C: BALL_COLORS[2] });
  for (const [kind, { colors }] of Object.entries(EMOTES)) paint(scene, `amie-emote-${kind}`, emoteRows(kind), { X: '#23435f', W: '#ffffff', ...colors });

  if (!scene.textures.exists('amie-shadow')) {
    const canvas = scene.textures.createCanvas('amie-shadow', 64, 12);
    const ctx = canvas.getContext();
    ctx.fillStyle = 'rgba(0, 24, 0, 0.25)';
    ctx.beginPath(); ctx.ellipse(32, 6, 32, 6, 0, 0, Math.PI * 2); ctx.fill();
    canvas.refresh();
  }
}

const SD_ITEMS = 'https://play.pokemonshowdown.com/sprites/itemicons-sheet.png';
export async function loadItemSheet(scene) {
  if (scene.textures.exists('sd-items')) return;
  const bytes = await scene.assets.fetchBytes(SD_ITEMS);
  const url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
  try {
    const img = await scene.assets.loadImage(url);
    scene.life.check();
    if (!scene.textures.exists('sd-items')) scene.textures.addSpriteSheet('sd-items', img, { frameWidth: 24, frameHeight: 24 });
  } finally { URL.revokeObjectURL(url); }
}

export function foodPicture(scene, icon, x, y, size) {
  const fit = image => image.setScale(Math.min(size / image.width, size / image.height));
  if (icon?.puff) return fit(scene.add.image(x, y, `amie-puff-${icon.puff}`));
  if (icon?.atlas && scene.textures.exists(icon.atlas)) return fit(scene.add.image(x, y, icon.atlas, icon.frame));
  if (Number.isInteger(icon?.sheet) && scene.textures.exists('sd-items')) return fit(scene.add.image(x, y, 'sd-items', icon.sheet));
  const art = foodTexture(scene, icon?.emoji);
  if (art) return fit(scene.add.image(x, y, art));
  if (icon?.emoji) {
    const text = scene.add.text(x, y, icon.emoji, { fontSize: 72, fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif', padding: { top: 8, bottom: 8 } }).setOrigin(0.5);
    return text.setScale(Math.min(size / text.width, size / text.height));
  }
  return scene.add.graphics().fillStyle(0xc8b89a).fillCircle(x, y, size / 4);
}

export function foodElement(scene, icon, doc) {
  const art = foodArtOf(icon?.emoji);
  if (art) return Object.assign(doc.createElement('span'), { className: 'art', innerHTML: artSvg(art) });
  if (icon?.emoji) return Object.assign(doc.createElement('span'), { className: 'emoji', textContent: icon.emoji });
  const key = icon?.puff ? `amie-puff-${icon.puff}` : icon?.atlas ?? (Number.isInteger(icon?.sheet) ? 'sd-items' : null);
  if (!key || !scene.textures.exists(key)) return doc.createElement('span');
  const frame = scene.textures.getFrame(key, icon.puff ? undefined : icon.frame ?? icon.sheet);
  const side = Math.max(frame.cutWidth, frame.cutHeight);
  const canvas = doc.createElement('canvas');
  canvas.width = canvas.height = side;
  canvas.getContext('2d').drawImage(frame.source.image, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight,
    Math.floor((side - frame.cutWidth) / 2), Math.floor((side - frame.cutHeight) / 2), frame.cutWidth, frame.cutHeight);
  return canvas;
}
