const FIELDS = [['target', 2], ['graphicFrame', 0], ['x', 0], ['y', 0], ['opacity', 255], ['zoomX', 100], ['zoomY', 100], ['angle'],
  ['focus', 1], ['priority', 1], ['locked'], ['visible', true], ['blendType'], ['tone'], ['mirror'], ['color'], ['flash']];
const NUMERIC = new Set(['graphicFrame', 'x', 'y', 'opacity', 'zoomX', 'zoomY', 'angle']);
const BOOLEAN = new Set(['locked', 'visible', 'mirror']);
const KNOWN = new Set(FIELDS.map(([k]) => k));
const same = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);

function encodeFrame(o, prev) {
  for (const k of Object.keys(o)) if (!KNOWN.has(k)) throw new Error(`Unknown anim frame field: ${k}`);
  const out = FIELDS.map(([k, base], i) => {
    if (i === 0) return o.target === 2 ? null : o.target;
    const has = Object.hasOwn(o, k), value = o[k];
    if (has && BOOLEAN.has(k) && typeof value !== 'boolean') throw new Error(`Non-boolean ${k}`);
    if (prev) {
      const prevHas = Object.hasOwn(prev, k);
      if (has === prevHas && (!has || same(value, prev[k]))) return null;
      if (!has) return '-';
      if (NUMERIC.has(k) && typeof prev[k] === 'number' && typeof value === 'number') {
        const delta = value - prev[k];
        return prev[k] + delta === value ? delta : [value];
      }
    } else {
      if (!has) return base === undefined ? null : '-';
      if (same(value, base)) return null;
    }
    return BOOLEAN.has(k) ? +value : value;
  });
  while (out.length && out.at(-1) === null) out.pop();
  return out;
}

function decodeFrame(row, prev) {
  const o = {};
  for (let i = 0; i < FIELDS.length; i++) {
    const [k, base] = FIELDS[i], e = row[i] ?? null;
    if (i === 0) { o.target = e ?? 2; continue; }
    if (e === '-') continue;
    if (prev) {
      if (e === null) { if (Object.hasOwn(prev, k)) o[k] = prev[k]; continue; }
      if (NUMERIC.has(k) && typeof prev[k] === 'number') { o[k] = typeof e === 'number' ? prev[k] + e : e[0]; continue; }
    } else if (e === null) { if (base !== undefined) o[k] = base; continue; }
    o[k] = BOOLEAN.has(k) ? e === 1 : e;
  }
  return o;
}

function mapFrames(frames, code) {
  let previous = [];
  return frames.map(frame => {

    const prevByTarget = new Map();
    for (const o of previous) { if (!prevByTarget.has(o.target)) prevByTarget.set(o.target, []); prevByTarget.get(o.target).push(o); }
    const counts = new Map();
    const out = frame.map(item => {
      const target = code === 'encode' ? item.target : (item[0] ?? 2);
      const n = counts.get(target) ?? 0; counts.set(target, n + 1);
      const prev = prevByTarget.get(target)?.[n];
      return code === 'encode' ? encodeFrame(item, prev) : decodeFrame(item, prev);
    });
    previous = code === 'encode' ? frame : out;
    return out;
  });
}

const variant = (v, code) => v && v.frames ? { ...v, frames: mapFrames(v.frames, code) } : v;
export const encodeAnim = anim => Array.isArray(anim) ? anim.map(v => variant(v, 'encode')) : variant(anim, 'encode');
export const decodeAnim = anim => Array.isArray(anim) ? anim.map(v => variant(v, 'decode')) : variant(anim, 'decode');
