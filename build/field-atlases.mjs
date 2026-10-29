import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

export const ANIMATED_ARENAS = ['end_a', 'end_b', 'end_b_3', 'power_plant_b_3'];
const ANIM_FRAME = /^(\d{4})\.png$/;

function frameList(json) {

  const frames = json.textures ? json.textures.flatMap(t => t.frames) : json.frames;
  return Array.isArray(frames) ? frames : Object.entries(frames).map(([filename, f]) => ({ filename, ...f }));
}

export function effectiveFrame(f) {
  if (f.trimmed) {
    if (f.spriteSourceSize.w !== f.frame.w || f.spriteSourceSize.h !== f.frame.h) throw new Error(`trimmed size mismatch: ${f.filename}`);
    return f;
  }
  return { ...f, trimmed: true, spriteSourceSize: { x: 0, y: 0, w: f.frame.w, h: f.frame.h }, sourceSize: { w: f.frame.w, h: f.frame.h } };
}

function encode(all, keep) {
  const frames = all.map(effectiveFrame);
  const first = frames[0].filename;
  const kept = frames.filter(f => f.filename === first || keep(f.filename))
    .sort((a, b) => a.filename.localeCompare(b.filename, 'en', { numeric: true }));
  if (kept.some(f => f.rotated)) throw new Error('rotated frame');
  const [sw, sh] = [kept[0].sourceSize.w, kept[0].sourceSize.h];
  const rects = [], index = [];
  for (const f of kept) {
    const r = [f.frame.x, f.frame.y, f.frame.w, f.frame.h, f.spriteSourceSize.x, f.spriteSourceSize.y];
    if (f.sourceSize.w !== sw || f.sourceSize.h !== sh) r.push(f.sourceSize.w, f.sourceSize.h);
    const s = r.join(',');
    let i = rects.indexOf(s);
    if (i < 0) i = rects.push(s) - 1;
    index.push(i);
  }
  const names = kept.map(f => f.filename);
  const standard = names.every((n, i) => n === `${String(i + 1).padStart(4, '0')}.png`);
  return [standard ? names.length : names.join(','), names.indexOf(first), sw, sh, rects.join(';'), index.join(',')];
}

export function fieldAtlases(assets) {
  const trainers = {}, arenas = {};
  for (const file of readdirSync(`${assets}/images/trainer`).filter(f => f.endsWith('.json')).sort()) {
    const key = file.slice(0, -5);
    const back = /^trainer_[mf]_back/.test(key);
    trainers[key] = encode(frameList(JSON.parse(readFileSync(`${assets}/images/trainer/${file}`, 'utf8'))),
      name => back || (ANIM_FRAME.test(name) && Number(ANIM_FRAME.exec(name)[1]) >= 1 && Number(ANIM_FRAME.exec(name)[1]) <= 128));
  }
  for (const key of ANIMATED_ARENAS) {
    arenas[key] = encode(frameList(JSON.parse(readFileSync(`${assets}/images/arenas/${key}.json`, 'utf8'))), () => true);
  }
  return { trainers, arenas };
}

let cache;

// One line of embedded:view: export const FIELD_ATLASES_GZ_B64 = "..."
export function fieldAtlasesModule(assets) {
  cache ??= `export const FIELD_ATLASES_GZ_B64 = ${JSON.stringify(gzipSync(JSON.stringify(fieldAtlases(assets)), { level: 9 }).toString('base64'))};`;
  return cache;
}
