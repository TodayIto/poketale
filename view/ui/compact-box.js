export function straightRuns(sigs) {
  const out = [];
  let start = 0;
  for (let i = 1; i <= sigs.length; i++) {
    if (i < sigs.length && sigs[i] === sigs[start]) continue;
    if (i - start >= 3) out.push([start, i - start]);
    start = i;
  }
  return out;
}

export function cutLines(sigs, drop, { slot = null, slotShare = 0.35, slotMin = 30, keep = 2 } = {}) {
  const runs = straightRuns(sigs), cut = new Map();
  let rest = drop;
  const slotRun = slot === null ? null : runs.find(([s, l]) => s <= slot && slot < s + l);
  if (slotRun) { const n = Math.max(0, Math.min(slotRun[1] - slotMin, Math.round(drop * slotShare))); cut.set(slotRun, n); rest -= n; }
  const others = runs.filter(r => r !== slotRun), room = others.reduce((sum, [, l]) => sum + Math.max(0, l - keep), 0);
  let left = rest;
  for (const r of [...others].sort((a, b) => b[1] - a[1])) {
    if (left <= 0 || room <= 0) break;
    const n = Math.min(r[1] - keep, left, Math.ceil(rest * (r[1] - keep) / room));
    if (n > 0) { cut.set(r, n); left -= n; }
  }
  const gone = [];
  for (const [[s, l], n] of cut) { const a = s + Math.floor((l - n) / 2); for (let i = a; i < a + n; i++) gone.push(i); }
  return gone.sort((a, b) => a - b);
}

export const mapLine = (gone, v) => v - gone.filter(g => g < v).length;

const made = new Map();

export function compactPicture(scene, key, { width, rowsCut, slotX }) {
  const id = `${key}:compact:${width}x${rowsCut}`;
  if (made.has(id) && scene.textures.exists(id)) return made.get(id);
  if (typeof document === 'undefined' || !scene.textures?.exists?.(key)) return null;
  const frame = scene.textures.getFrame(key), img = frame.source.image;
  const W = frame.cutWidth, H0 = frame.cutHeight;
  const src = document.createElement('canvas');
  src.width = W; src.height = H0;
  const ctx = src.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, frame.cutX, frame.cutY, W, H0, 0, 0, W, H0);
  const px = ctx.getImageData(0, 0, W, H0).data;
  const at = (x, y) => { const i = (y * W + x) * 4; return px[i + 3] ? `${px[i]},${px[i + 1]},${px[i + 2]},${px[i + 3]}` : '-'; };
  // only the box's rows (the player's picture has empty rows under it)
  let H = H0;
  while (H > 1 && [...Array(W).keys()].every(x => at(x, H - 1) === '-')) H--;
  const colSig = x => Array.from({ length: H }, (_, y) => at(x, y)).join('|');
  const goneX = cutLines(Array.from({ length: W }, (_, x) => colSig(x)), Math.max(0, W - width), { slot: slotX });
  const keepX = [...Array(W).keys()].filter(x => !goneX.includes(x));
  const rowSig = y => keepX.map(x => at(x, y)).join('|');
  const goneY = cutLines(Array.from({ length: H }, (_, y) => rowSig(y)), rowsCut);
  const keepY = [...Array(H).keys()].filter(y => !goneY.includes(y));
  const out = document.createElement('canvas');
  out.width = keepX.length; out.height = keepY.length;
  const o = out.getContext('2d');
  // copy runs of kept columns x kept rows (each a solid block of the original)
  const blocks = list => list.reduce((acc, v) => { const last = acc.at(-1); if (last && last[0] + last[1] === v) last[1]++; else acc.push([v, 1]); return acc; }, []);
  for (const [sx, w] of blocks(keepX)) for (const [sy, h] of blocks(keepY)) o.drawImage(src, sx, sy, w, h, mapLine(goneX, sx), mapLine(goneY, sy), w, h);
  scene.textures.addCanvas(id, out);
  const result = { key: id, width: out.width, height: out.height, mapX: x => mapLine(goneX, x), mapY: y => mapLine(goneY, y) };
  made.set(id, result);
  return result;
}
