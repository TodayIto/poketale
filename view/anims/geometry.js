// from pokerogue src/data/battle-anims.ts @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-10-28. See view/LICENSE-NOTE.md.

export function framePosition(frame, user, target) {
  const uh = user.getSprite().displayHeight / 2;
  const th = target.getSprite().displayHeight / 2;
  const ux = user.container.x, uy = user.container.y;
  const tx = target.container.x, ty = target.container.y;
  let x = (frame.x ?? 0) + 106, y = (frame.y ?? 0) + 116;
  let scaleX = (frame.zoomX ?? 0) / 100 * (frame.mirror ? -1 : 1);
  const focus = frame.focus || 1;
  if (focus === 1) { x += tx - 234; y += ty - th - 52; }
  else if (focus === 2) { x += ux - 106; y += uy - uh - 116; }
  else if (focus === 3) {
    const src = [106, 116, 234, 52];
    x = ux + (x - src[0]) / (src[2] - src[0]) * (tx - ux);
    y = uy - uh + (y - src[1]) / (src[3] - src[1]) * (ty - th - uy + uh);
    if (frame.target === 2 && ((src[0] < src[2]) !== (ux < tx))) scaleX *= -1;
  }
  return { x, y, scaleX, scaleY: (frame.zoomY ?? 0) / 100, angle: -(frame.angle ?? 0) };
}
