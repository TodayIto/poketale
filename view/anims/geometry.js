// from pokerogue src/data/battle-anims.ts @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-11-19. See view/LICENSE-NOTE.md.

export function focusPoint(mon) {
  const { x, y } = mon.container, anchor = mon.placement?.anchor;
  return anchor ? { x: x + anchor[0], y: y + anchor[1] } : { x, y: y - mon.getSprite().displayHeight / 2 };
}

export function framePosition(frame, user, target, stretch = false) {
  const u = focusPoint(user), t = focusPoint(target);
  let x = (frame.x ?? 0) + 106, y = (frame.y ?? 0) + 116;
  let scaleX = (frame.zoomX ?? 0) / 100 * (frame.mirror ? -1 : 1);
  const focus = frame.focus || 1;
  if (focus === 1) { x += t.x - 234; y += t.y - 52; }
  else if (focus === 2) { x += u.x - 106; y += u.y - 116; }
  else if (focus === 3) {
    const src = [106, 116, 234, 52];
    x = u.x + (x - src[0]) / (src[2] - src[0]) * (t.x - u.x);
    y = u.y + (y - src[1]) / (src[3] - src[1]) * (t.y - u.y);
    if (frame.target === 2 && ((src[0] < src[2]) !== (u.x < t.x))) scaleX *= -1;
  } else if (stretch) { x = ((frame.x ?? 0) - SCREEN.left) * STRETCH; scaleX *= STRETCH; }
  return { x, y, scaleX, scaleY: (frame.zoomY ?? 0) / 100, angle: -(frame.angle ?? 0) };
}

export function copyPosition(pos, mon, sprite = mon.getSprite()) {
  const scale = mon.getSpriteScale(), focus = focusPoint(mon), { x, y } = mon.container;
  return {
    x: pos.x + x + (0.5 - sprite.originX) * sprite.width * scale - focus.x,
    y: pos.y + y + (0.5 - sprite.originY) * sprite.height * scale - focus.y,
  };
}

const SCREEN = Object.freeze({ left: -64, right: 192, top: -112, bottom: 64 });
const STRETCH = 320 / 256, NEAR = 4;
const covers = new WeakMap();

export function screenCover(frame) {
  let found = covers.get(frame);
  if (found) return found;
  found = new Set();
  const tiles = frame.filter(s => s.target === 2 && s.focus === 4 && s.visible && (s.opacity ?? 0) > 0 && !((s.angle ?? 0) % 360));
  const sizes = new Map();
  for (const s of tiles) {
    const key = `${s.zoomX},${s.zoomY}`;
    if (!sizes.has(key)) sizes.set(key, []);
    sizes.get(key).push(s);
  }
  for (const same of sizes.values()) {
    const w = 96 * Math.abs(same[0].zoomX ?? 0) / 100, h = 96 * Math.abs(same[0].zoomY ?? 0) / 100;
    if (!w || !h) continue;
    const dx = (a, b) => Math.abs((a.x ?? 0) - (b.x ?? 0)), dy = (a, b) => Math.abs((a.y ?? 0) - (b.y ?? 0));
    const overlaps = (a, b) => dx(a, b) < w - NEAR && dy(a, b) < h - NEAR;

    const rows = [], inRow = new Set();
    for (const first of same) {
      if (inRow.has(first)) continue;
      const row = [first]; inRow.add(first);
      for (let i = 0; i < row.length; i++) for (const b of same) {
        if (!inRow.has(b) && Math.abs(dx(row[i], b) - w) <= NEAR && dy(row[i], b) <= NEAR) { inRow.add(b); row.push(b); }
      }
      rows.push(row);
    }
    rows.sort((a, b) => b.length - a.length);

    const used = new Set();
    for (const seed of rows) {
      if (used.has(seed)) continue;
      const group = [...seed]; used.add(seed);
      for (let added = true; added;) {
        added = false;
        for (const row of rows) {
          if (used.has(row) || !row.some(b => group.some(a => Math.abs(dy(a, b) - h) <= NEAR && dx(a, b) <= w))
            || row.some(b => group.some(a => overlaps(a, b)))) continue;
          group.push(...row); used.add(row); added = true;
        }
      }
      const xs = group.map(s => s.x ?? 0), ys = group.map(s => s.y ?? 0);
      if (Math.min(...xs) - w / 2 <= SCREEN.left + NEAR && Math.max(...xs) + w / 2 >= SCREEN.right - NEAR
        && Math.min(...ys) - h / 2 <= SCREEN.top + NEAR && Math.max(...ys) + h / 2 >= SCREEN.bottom - NEAR && painted(group, w, h) >= 0.75) {
        for (const s of group) found.add(s);
      }
    }
  }
  covers.set(frame, found);
  return found;
}

function painted(tiles, w, h) {
  let inside = 0, all = 0;
  for (let y = SCREEN.top + 2; y < SCREEN.bottom; y += 4) for (let x = SCREEN.left + 2; x < SCREEN.right; x += 4) {
    all++;
    if (tiles.some(s => Math.abs(x - (s.x ?? 0)) <= w / 2 && Math.abs(y - (s.y ?? 0)) <= h / 2)) inside++;
  }
  return inside / all;
}

export function backgroundPhase(h, bgY = 0) {
  const top = (284 - bgY) / 1.25, rows = 180 / 1.25;
  if (!(h >= rows) || Math.floor(top / h) === Math.floor((top + rows - 1e-6) / h)) return 0;
  return (h - top % h) % h;
}
