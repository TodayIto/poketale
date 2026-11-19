import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export function readMarshal(buf) {
  if (buf[0] !== 4 || buf[1] !== 8) throw new Error('not Ruby Marshal 4.8');
  let p = 2;
  const syms = [], objs = [];
  const byte = () => { if (p >= buf.length) throw new Error('truncated'); return buf[p++]; };
  const int = () => {
    let c = (byte() << 24) >> 24;
    if (c === 0) return 0;
    if (c > 4) return c - 5;
    if (c < -4) return c + 5;
    if (c > 0) { let x = 0; for (let i = 0; i < c; i++) x += byte() * 2 ** (8 * i); return x; }
    c = -c; let x = -1;
    for (let i = 0; i < c; i++) { x &= ~(0xff << (8 * i)); x |= byte() << (8 * i); }
    return x;
  };
  const bytes = () => { const n = int(); if (n < 0 || p + n > buf.length) throw new Error('bad length'); const b = buf.subarray(p, p + n); p += n; return b; };
  const sym = () => {
    const t = String.fromCharCode(byte());
    if (t === ':') { const s = bytes().toString('latin1'); syms.push(s); return s; }
    if (t === ';') return syms[int()];
    throw new Error(`symbol expected at ${p}`);
  };
  const reg = o => (objs.push(o), o);
  const ivars = o => { const n = int(); for (let i = 0; i < n; i++) { const k = sym(); const v = read(); if (o && typeof o === 'object') o[k] = v; } return o; };
  function read() {
    const t = String.fromCharCode(byte());
    switch (t) {
      case '0': return null;
      case 'T': return true;
      case 'F': return false;
      case 'i': return int();
      case ':': case ';': p--; return sym();
      case '@': return objs[int()];
      case 'I': return ivars(read());
      case '"': return reg(bytes().toString('utf8'));
      case 'f': return reg(parseFloat(bytes().toString('latin1')));
      case 'l': { const sign = byte(), n = int(); let x = 0n; for (let i = 0; i < n * 2; i++) x |= BigInt(byte()) << BigInt(8 * i); return reg(Number(sign === 45 ? -x : x)); }
      case '[': { const a = reg([]); const n = int(); for (let i = 0; i < n; i++) a.push(read()); return a; }
      case '{': case '}': { const h = reg({}); const n = int(); for (let i = 0; i < n; i++) { const k = read(); h[k] = read(); } if (t === '}') read(); return h; }
      case 'o': { const o = reg({ __class: sym() }); return ivars(o); }
      case 'C': { const cls = sym(); const o = read(); if (o && typeof o === 'object') o.__class = cls; return o; }
      case 'u': {
        const cls = sym(), b = bytes(), o = { __class: cls, d: [] };
        for (let i = 0; i + 8 <= b.length; i += 8) o.d.push(b.readDoubleLE(i));
        return reg(o);
      }
      case 'U': { const o = reg({ __class: sym() }); o.data = read(); return o; }
      case 'e': sym(); return read();
      case 'S': { const o = reg({ __class: sym() }); return ivars(o); }
      default: throw new Error(`unsupported Marshal type ${JSON.stringify(t)} at ${p - 1}`);
    }
  }
  return read();
}

export const essentialsAnims = buf => (readMarshal(buf)['@array'] ?? []).filter(a => a?.__class === 'PBAnimation');

const anyNonZero = (...v) => v.some(Boolean);
const four = (...v) => v.map(x => x || 0);

export function convertCel(c) {
  const o = {};
  o.x = ((c[0] || 0) - 128) * 0.5;
  o.y = ((c[1] || 0) - 224) * 0.5;
  if (c[2]) o.zoomX = c[2];
  if (c[11]) o.zoomY = c[11];
  if (c[3]) o.angle = c[3];
  if (c[4]) o.mirror = true;
  if (c[6]) o.visible = true;
  if (c[5]) o.blendType = c[5];
  const pattern = c[7] ?? 0;
  o.target = pattern === -1 ? 0 : pattern === -2 ? 1 : 2;
  o.graphicFrame = pattern >= 0 ? pattern : 0;
  if (c[8]) o.opacity = c[8];
  if (anyNonZero(c[12], c[13], c[14], c[15])) o.color = four(c[12], c[13], c[14], c[15]);
  if (anyNonZero(c[16], c[17], c[18], c[19])) o.tone = four(c[16], c[17], c[18], c[19]);
  if (anyNonZero(c[21], c[22], c[23], c[24])) o.flash = four(c[21], c[22], c[23], c[24]);
  if (c[20]) o.locked = true;
  if (c[25]) o.priority = c[25];
  o.focus = c[26] || 1;
  return o;
}

const EVENT = { 0: 'AnimTimedSoundEvent', 1: 'AnimTimedAddBgEvent', 2: 'AnimTimedUpdateBgEvent', 3: 'AnimTimedAddFgEvent', 4: 'AnimTimedUpdateFgEvent' };
const noPng = s => String(s ?? '').replace(/\.png$/i, '');

export function convertTiming(t) {
  const type = t['@timingType'] ?? 0, frameIndex = t['@frame'] ?? 0, eventType = EVENT[type];
  if (!eventType) throw new Error(`unknown timing type ${type}`);
  if (type === 0) return { frameIndex, resourceName: t['@name'] ?? '', volume: t['@volume'] ?? 100, pitch: t['@pitch'] ?? 100, eventType };
  const e = { frameIndex, resourceName: noPng(t['@name']) };
  for (const [from, to] of [['@bgX', 'bgX'], ['@bgY', 'bgY'], ['@opacity', 'opacity']]) if (t[from] != null) e[to] = t[from];
  e.duration = t['@duration'] ?? 0;
  const color = ['@colorRed', '@colorGreen', '@colorBlue', '@colorAlpha'].map(k => t[k]);
  if (color.some(v => v != null) && anyNonZero(...color)) e.color = four(...color);
  if (t['@flashScope']) Object.assign(e, { flashScope: t['@flashScope'], flashColor: (t['@flashColor']?.d ?? []).map(Math.round), flashDuration: t['@flashDuration'] ?? 0 });
  e.eventType = eventType;
  return e;
}

export function convertAnim(a) {
  const frames = (a['@array'] ?? []).map(frame => (frame ?? []).filter(Boolean).map(convertCel));
  const frameTimedEvents = {};
  for (const t of [...(a['@timing'] ?? [])].sort((x, y) => (x['@frame'] ?? 0) - (y['@frame'] ?? 0))) {
    const e = convertTiming(t);
    (frameTimedEvents[e.frameIndex] ??= []).push(e);
  }
  return { graphic: noPng(a['@graphic']), frames, frameTimedEvents, position: a['@position'] ?? 1, hue: a['@hue'] ?? 0 };
}

export function convertMove(anims, id) {
  const own = anims.find(a => a['@name'] === `Move:${id}`), opp = anims.find(a => a['@name'] === `OppMove:${id}`);
  if (!own) return undefined;
  return opp ? [convertAnim(own), convertAnim(opp)] : convertAnim(own);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [file, out, ...ids] = process.argv.slice(2);
  if (!file) { console.error('usage: node tools/essentials-anim.mjs <PkmnAnimations.rxdata> <out dir> [MOVE ...]'); process.exit(1); }
  const anims = essentialsAnims(readFileSync(file));
  if (!ids.length) { console.log(anims.map(a => a['@name']).filter(n => /^Move:/.test(n ?? '')).join('\n')); process.exit(0); }
  mkdirSync(out, { recursive: true });
  for (const id of ids) {
    const anim = convertMove(anims, id);
    if (!anim) { console.error(`no Move:${id}`); process.exitCode = 1; continue; }
    const path = join(out, `${id.toLowerCase()}.json`);
    writeFileSync(path, JSON.stringify(anim));
    const v = [anim].flat();
    console.log(`${path}: ${v.map(x => `${x.graphic} ${x.frames.length}f`).join(' / ')}`);
  }
}
