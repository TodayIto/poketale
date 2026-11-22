const P0 = Object.freeze([106, 148]), P1 = Object.freeze([236, 84]);
const MIDDLE = Object.freeze([(P0[0] + P1[0]) / 2, (P0[1] + P1[1]) / 2]);
export const HORIZON = 50;
export const MESSAGE_TOP = 132;

export const axisPoint = (t, lift = 0) => [P0[0] + (P1[0] - P0[0]) * t, P0[1] + (P1[1] - P0[1]) * t - lift];
const AXIS_WIDTH = P1[0] - P0[0];

// rule 1: camera
export const ZOOM = Object.freeze({ mine: 0.55, foe: 0.75, both: 0.55 });
const DOUBLE_ZOOM = 0.92;
const TILT = Object.freeze({ mine: -15, foe: 30, both: 7 });

const BASE_CENTRE = Object.freeze({ player: Object.freeze([106, 144.5]), enemy: Object.freeze([236, 70.5]) });
const SLIDE = 0.2; // x AXIS_WIDTH = 26
const RAISE = 12;

export const CX = 160;
const GAP = Object.freeze({ single: { mine: 68, foe: 68, both: 72 }, double: { mine: 82, foe: 82, both: 110 } });
const MY_FEET = 182;
const FOE_FEET = Object.freeze({ single: 42, double: 30 }); // below the moved horizon
export const TOP = Object.freeze({ player: { single: 6, double: 58 }, enemy: { single: 2, double: -14 } }); // head limits (doubles: under the compact boxes / a little cut)
const MAX_WIDTH = 210;
const MAX_GROW = 3.5;

const REFERENCE = Object.freeze({
  player: { body: [74, 61], zoom: { single: { mine: 2.4, both: 2.2 }, double: { mine: 2.3, both: 2.1 } } },
  enemy: { body: [94, 90], zoom: { single: {}, double: {} } },
});
// rule 4: the middle of the field (doubles)
export const LIFT = 8, SPREAD = 0.18, MID_SCALE = 0.55;
const MID_BASE_WIDTH = Object.freeze({ player: 44, enemy: 40 });

const COMPACT_TEXT = 0.9;

export const COMPACT = Object.freeze({ width: 88, height: 31, edge: { foe: 1, mine: 0 }, overlap: 3 });

const LINE = { above: 4.5, below: 4.8, topEdge: 3.5, labelTop: 17, clear: 0 };

export const compactRows = k => Math.max(0, Math.floor(LINE.labelTop - LINE.topEdge - LINE.clear - (LINE.above + LINE.below) * k));

const centre = (k, rows) => ((LINE.topEdge + LINE.above * k) + (LINE.labelTop - rows - LINE.below * k)) / 2;

export function compactStyle() {
  const k = COMPACT_TEXT, rowsCut = compactRows(k);
  return { text: k, rowsCut, width: COMPACT.width, height: COMPACT.height - rowsCut, lineCentre: rowsCut ? centre(k, rowsCut) : null };
}

const team = position => (position === 'player' || position === 'player2' ? 'player' : 'enemy');

/** 'mine' | 'foe' | 'both' | null - which side has a giant */
export function whoIsGiant(giants) {
  const mine = giants.some(p => team(p) === 'player'), foe = giants.some(p => team(p) === 'enemy');
  return mine && foe ? 'both' : mine ? 'mine' : foe ? 'foe' : null;
}

export function camera(double, who) {
  if (!who) return { zoom: 1, tilt: 0, horizon: HORIZON };
  return { zoom: ZOOM[who] * (double ? DOUBLE_ZOOM : 1), tilt: TILT[who], horizon: HORIZON + TILT[who] };
}

export function giantSpot(double, who, side) {
  const kind = double ? 'double' : 'single', g = GAP[kind][who];
  const feet = side === 'player' ? MY_FEET : HORIZON + TILT[who] + FOE_FEET[kind];
  return { x: side === 'player' ? CX - g : CX + g, feet, top: TOP[side][kind], maxWidth: who === 'both' ? 2 * g - 10 : MAX_WIDTH };
}

export function giantZoom(double, who, side, w, h) {
  const kind = double ? 'double' : 'single', spot = giantSpot(double, who, side);
  const fit = (bw, bh) => Math.min((spot.feet - spot.top) / bh, spot.maxWidth / bw);
  const [rw, rh] = REFERENCE[side].body, rk = Math.min(fit(rw, rh), REFERENCE[side].zoom[kind][who] ?? Infinity);
  const area = rw * rk * rh * rk;
  return Math.min(Math.sqrt(area / (w * h)), fit(w, h), MAX_GROW);
}

export function fieldLayout(double, mons) {
  const positions = Object.keys(mons);
  const giants = positions.filter(p => mons[p].giant);
  const who = whoIsGiant(giants), cam = camera(double, who);
  const out = { who, camera: cam, mons: {}, bases: {}, middles: [] };
  const sideHasGiant = side => giants.some(p => team(p) === side);
  for (const side of ['player', 'enemy']) {
    const has = sideHasGiant(side);

    const slide = double && who && who !== 'both' && !has ? (side === 'enemy' ? 1 : -1) * SLIDE * AXIS_WIDTH : 0;
    const raise = double && who === 'foe' && side === 'player' ? -RAISE : 0;
    out.bases[side] = { show: !has, centre: BASE_CENTRE[side], zoom: has ? 1 : cam.zoom, move: [slide, raise] };
  }
  // rule 4: the partners of giants, far (the foe's) first
  const middles = double ? positions.filter(p => !mons[p].giant && sideHasGiant(team(p))).sort((a, b) => (team(a) === 'enemy' ? -1 : 1) - (team(b) === 'enemy' ? -1 : 1)) : [];

  const tOf = position => (who === 'both' ? (team(position) === 'enemy' ? 0.5 + SPREAD : 0.5 - SPREAD) : 0.5);
  for (const position of positions) {
    const { box } = mons[position], side = team(position);
    const foot = [(box.left + box.right) / 2, box.bottom];
    if (!who) { out.mons[position] = { kind: 'normal', centre: foot, zoom: 1, move: [0, 0], depth: box.bottom }; continue; }
    if (mons[position].giant) {
      const spot = giantSpot(double, who, side), zoom = giantZoom(double, who, side, box.right - box.left, box.bottom - box.top);
      // my giant is in front of everything, the foe's behind everything (rule 5)
      out.mons[position] = { kind: 'giant', centre: foot, zoom, move: [spot.x - foot[0], spot.feet - foot[1]], depth: side === 'player' ? Infinity : -Infinity };
    } else if (middles.includes(position)) {
      const [x, y] = axisPoint(tOf(position), LIFT);
      out.mons[position] = { kind: 'middle', centre: foot, zoom: MID_SCALE, move: [x - foot[0], y - foot[1]], depth: y };
      out.middles.push({ position, side, x, y, width: MID_BASE_WIDTH[side] });
    } else {
      const b = out.bases[side], y = b.centre[1] + (foot[1] - b.centre[1]) * b.zoom;
      out.mons[position] = { kind: 'shrink', centre: b.centre, zoom: b.zoom, move: b.move, depth: y };
    }
  }
  return out;
}
/** Applies a layout transform to a point */
export const mapPoint = (t, [x, y]) => [t.centre[0] + (x - t.centre[0]) * t.zoom + t.move[0], t.centre[1] + (y - t.centre[1]) * t.zoom + t.move[1]];

export function compactSpots(positions) {
  const { edge, overlap } = COMPACT, { width, height } = compactStyle(), step = height - overlap, spots = {};
  const foes = positions.filter(p => team(p) === 'enemy'), mine = positions.filter(p => team(p) === 'player');
  foes.forEach((p, i) => { spots[p] = { x: edge.foe, y: edge.foe + i * step }; });
  mine.forEach((p, i) => { spots[p] = { x: 320 - edge.mine - width, y: MESSAGE_TOP - edge.mine - height - (mine.length - 1 - i) * step }; });
  return spots;
}
