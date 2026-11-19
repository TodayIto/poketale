import { BG_TIMINGS } from './tints.js';

const nz = v => v ?? 0;

export function engineFrames({ n, bg }) {
  const plane = { o: 0, c: [0, 0, 0, 0] };
  let pic = null, rec = null;
  const out = [];
  for (let f = 0; f < n; f++) {
    for (const m of bg) {
      if (m.set !== undefined || !rec || !(m.d > 0) || f <= m.f || f > m.f + m.d) continue;
      const p = (f - m.f) / m.d, layer = pic ?? plane;
      if (pic && m.x != null) pic.ox = rec.ox - (m.x - rec.ox) * p;
      if (pic && m.y != null) pic.oy = rec.oy - (m.y - rec.oy) * p;
      if (m.o != null) layer.o = rec.o + (m.o - rec.o) * p;
      layer.c = rec.c.map((v, k) => (m.c?.[k] != null ? v + (m.c[k] - v) * p : v));
    }
    for (const t of bg) {
      if (t.f !== f) continue;
      if (t.set) {
        pic = { name: t.set, ox: -nz(t.x), oy: -nz(t.y), ox0: -nz(t.x), oy0: -nz(t.y), o: nz(t.o), c: [0, 1, 2, 3].map(k => nz(t.c?.[k])) };
        plane.o = 0;
      } else if (t.set === '') {
        plane.c = [0, 1, 2, 3].map(k => nz(t.c?.[k])); plane.o = nz(t.o); pic = null;
      } else rec = pic ? { ox: pic.ox, oy: pic.oy, o: pic.o, c: [...pic.c] } : { ox: 0, oy: 0, o: plane.o, c: [...plane.c] };
    }
    out.push(pic ? { pic: pic.name, o: pic.o, c: [...pic.c], at: [-pic.ox0, -pic.oy0], sx: pic.ox0 - pic.ox, sy: pic.oy0 - pic.oy }
      : plane.o > 0 ? { pic: '', o: plane.o, c: [...plane.c], at: [0, 0], sx: 0, sy: 0 } : null);
  }
  return out;
}

export function originalBackground(file, v) {
  const variant = BG_TIMINGS[file]?.[v];
  return variant && engineFrames(variant);
}

export const tintState = c => {
  const s = c ? c[3] / 255 : 0;
  return { s, r: c ? c[0] * s : 0, g: c ? c[1] * s : 0, b: c ? c[2] * s : 0 };
};

export const tintMatrix = ({ s, r, g, b }) => [1 - s, 0, 0, 0, r, 0, 1 - s, 0, 0, g, 0, 0, 1 - s, 0, b, 0, 0, 0, 1, 0];
