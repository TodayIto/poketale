import { FIELD_ATLASES_GZ_B64 } from 'embedded:view';

let tables;

export function fieldAtlases() {
  return tables ??= (async () => {
    const bytes = Uint8Array.from(atob(FIELD_ATLASES_GZ_B64), c => c.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return JSON.parse(await new Response(stream).text());
  })().catch(error => { tables = undefined; throw error; });
}

export function atlasJson([names, first, sw, sh, rects, index]) {
  const list = typeof names === 'number'
    ? Array.from({ length: names }, (_, i) => `${String(i + 1).padStart(4, '0')}.png`) : names.split(',');
  const boxes = rects.split(';').map(r => r.split(',').map(Number));
  const order = index.split(',').map(Number);
  const frames = list.map((filename, i) => {
    const [x, y, w, h, sx, sy, fw = sw, fh = sh] = boxes[order[i]];
    return { filename, rotated: false, trimmed: true, sourceSize: { w: fw, h: fh },
      spriteSourceSize: { x: sx, y: sy, w, h }, frame: { x, y, w, h } };
  });
  frames.unshift(...frames.splice(first, 1));
  return { frames };
}

export function animFrames(json, end = 128) {
  return json.frames.map(f => f.filename).filter(n => /^\d{4}\.png$/.test(n) && +n.slice(0, 4) >= 1 && +n.slice(0, 4) <= end).sort();
}
