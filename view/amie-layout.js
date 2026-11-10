import { TAP, FAB_PAD, FAB_BAND } from './frame-parts.js';

export function fieldFor(width, height) {
  if (height > width) return { w: 180, h: Math.round(Math.min(400, Math.max(240, 180 * height / width))) };
  return { w: Math.round(Math.min(400, Math.max(180, 180 * width / height))), h: 180 };
}

export function fitCanvas(scene, { w, h }) {
  const cam = scene.cameras.main, zoom = cam.zoom;
  const before = { width: scene.scale.gameSize.width, height: scene.scale.gameSize.height };
  if (before.width !== w * 6 * zoom || before.height !== h * 6 * zoom) scene.scale.setGameSize(w * 6 * zoom, h * 6 * zoom);
  cam.setSize(w * 6 * zoom, h * 6 * zoom);
  cam.centerOn(w * 3, h * 3);
  return before;
}

export function restoreCanvas(scene, size) {
  if (!size) return;
  const cam = scene.cameras.main;
  if (scene.scale.gameSize.width !== size.width || scene.scale.gameSize.height !== size.height) scene.scale.setGameSize(size.width, size.height);
  cam.setSize(size.width, size.height);
  cam.centerOn(960, 540);
}

export const FRAME = Object.freeze({
  wide: Object.freeze({ top: 14, side: 16, ring: 54, gap: 10, feed: { d: 78, side: 22, bottom: 26 }, play: { d: 64, side: 118, bottom: 26 }, train: { d: 64, side: 24, bottom: 26 },
    plate: { w: 440, h: 124, bottom: 40, food: 52, inset: 64, between: true }, feet: 236, gutter: 16, headroom: 16, look: { short: 764, scale: 9 } }),
  tall: Object.freeze({ top: 10, side: 10, ring: 48, gap: 8, feed: { d: 70, side: 14, bottom: 14 }, play: { d: 60, side: 96, bottom: 14 }, train: { d: 60, side: 14, bottom: 14 },
    plate: { w: 340, h: 110, bottom: 118, food: 44, inset: 46, between: false }, feet: 262, gutter: 15, headroom: 16, look: { short: 390, scale: 7 * 0.8 } }),
});

export const frameFor = (width, height) => (height > width ? FRAME.tall : FRAME.wide);

export const fabBox = b => ({ side: b.side - FAB_PAD, w: b.d + 2 * FAB_PAD, h: b.d + FAB_BAND, bottom: b.bottom });

export const exitTop = f => f.top + (f.ring - TAP) / 2;

export const gameBarFor = f => 2 * exitTop(f) + TAP;

export function petScale({ width, height, battle = 1, body }) {
  const f = frameFor(width, height);
  const want = battle * Math.min(width, height) * f.look.scale / f.look.short;
  const room = { w: width - 2 * f.gutter, h: height - f.feet - (f.top + f.ring + f.headroom) };
  const fit = Math.min(room.w / body.w, room.h / body.h);
  return { scale: Math.max(0, Math.min(want, fit)), want, room };
}

const PLATE_GAP = 8, FOOD_GAP = 10;

export function plateFor(width, f) {
  const P = f.plate;
  const feed = fabBox(f.feed), play = fabBox(f.play);
  const from = P.between ? feed.side + feed.w + PLATE_GAP : f.side, to = width - (P.between ? play.side + play.w + PLATE_GAP : f.side);
  const w = Math.max(0, Math.min(P.w, to - from));
  return { left: Math.round(Math.max(from, Math.min(to - w, (width - w) / 2))), w, per: Math.max(1, Math.floor((w - 2 * P.inset) / (P.food + FOOD_GAP))) };
}

export function plateOf(foods, per, page) {
  const pages = Math.max(1, Math.ceil(foods.length / per));
  const at = Math.max(0, Math.min(pages - 1, page));
  return { items: foods.slice(at * per, at * per + per), page: at, pages };
}
