// All coordinates are in the 320 x 180 field, before its 6x render scale.
export const MESSAGE_TOP = 132;
export const INFO_RECTS = Object.freeze({
  enemy: { left: 10, top: 23.5, right: 140, bottom: 54.5 },
  player: { left: 180, top: 87, right: 310, bottom: 129 },
});
export const SPRITE_SLOTS = Object.freeze({
  player: { x: 106, bottom: 148, region: { left: 4, top: 58, right: 176, bottom: 130 } },
  enemy: { x: 236, bottom: 84, region: { left: 144, top: 4, right: 316, bottom: 84 } },
});

export function rgbaBounds(data, width, height) {
  let left = width, top = height, right = 0, bottom = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (!data[(y * width + x) * 4 + 3]) continue;
    left = Math.min(left, x); top = Math.min(top, y);
    right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
  }
  return right > left ? { left, top, right, bottom } : null;
}

export function unionBounds(bounds) {
  const visible = bounds.filter(Boolean);
  if (!visible.length) throw new Error('Sprite has no opaque pixels');
  return {
    left: Math.min(...visible.map(b => b.left)), top: Math.min(...visible.map(b => b.top)),
    right: Math.max(...visible.map(b => b.right)), bottom: Math.max(...visible.map(b => b.bottom)),
  };
}

export function pokerogueBox(reference, side) {
  const slot = SPRITE_SLOTS[side];
  if (!slot) throw new Error(`Invalid side: ${side}`);
  if (!reference) return null;
  const [srcW, srcH, x, y, w, h] = reference.values;
  const left = slot.x - srcW / 2 + x, top = slot.bottom - srcH + y;
  return { left, top, right: left + w, bottom: top + h };
}

export function placeSprite(asset, side) {
  const { bounds, width, height } = asset;
  const slot = SPRITE_SLOTS[side];
  if (!slot) throw new Error(`Invalid side: ${side}`);
  const { left, top, right, bottom } = bounds;
  if (!(width > 0 && height > 0 && left >= 0 && top >= 0 && right <= width && bottom <= height && right > left && bottom > top)) {
    throw new Error('Invalid sprite bounds');
  }
  const w = right - left, h = bottom - top;
  if (asset.source === 'pokerogue') {

    return { x: slot.x, y: slot.bottom, scale: 1, originX: 0.5, originY: 1, mode: 'pokerogue',
      box: { left: slot.x - width / 2 + left, top: slot.bottom - height + top,
        right: slot.x - width / 2 + right, bottom: slot.bottom - height + bottom } };
  }
  const targetBox = pokerogueBox(asset.pokerogue, side);
  if (targetBox) {
    const targetArea = asset.pokerogue.values[6], sourceArea = asset.medianOpaquePixels;
    if (!(Number.isFinite(targetArea) && targetArea > 0 && Number.isFinite(sourceArea) && sourceArea > 0)) {
      throw new Error('Invalid sprite median body area');
    }
    const preferred = Math.sqrt(targetArea / sourceArea);

    const scale = Math.max(1, Math.round(preferred * 12)) / 12;
    const x = (targetBox.left + targetBox.right) / 2, y = targetBox.bottom;
    return { x, y, scale, preferred, originX: (left + right) / (2 * width), originY: bottom / height,
      mode: 'pokerogue-box', targetBox, referenceKey: asset.pokerogue.key,
      box: { left: x - w * scale / 2, top: y - h * scale, right: x + w * scale / 2, bottom: y } };
  }

  const legacyBottom = side === 'player' ? 130 : slot.bottom;

  const bottomPadding = Math.min(12, height - bottom);
  const preferred = side === 'player' || (w <= 32 && h <= 24) ? 1.5 : 1;
  const capacity = Math.min(2 * Math.min(slot.x - slot.region.left, slot.region.right - slot.x) / w,
    (legacyBottom - slot.region.top) / (h + bottomPadding));

  const scale = Math.floor(Math.min(preferred, capacity) * 6 + 1e-9) / 6;
  if (scale <= 0) throw new Error('Sprite cannot fit at the minimum 1/6 scale');
  const x = slot.x, y = legacyBottom - bottomPadding * scale;
  return {
    x, y, scale, preferred, originX: (left + right) / (2 * width), originY: bottom / height,
    region: slot.region, mode: 't07',
    box: { left: x - w * scale / 2, top: y - h * scale, right: x + w * scale / 2, bottom: y },
  };
}
