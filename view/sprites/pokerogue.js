import { canvasBounds } from './showdown.js';
import { unionBounds } from './placement.js';
import STILL from './pokerogue-still.json' with { type: 'json' };

export async function loadPokerogueStill(assets, mon, back, key, reference) {
  const direction = back ? 'b' : 'f', frames = STILL[reference.key];
  const [x, y, w, h, sx, sy] = (mon.shiny && frames[`s${direction}`]) || frames[direction];
  const url = assets.url(`images/pokemon/${back ? 'back/' : ''}${mon.shiny ? 'shiny/' : ''}${reference.key}.png`);
  const img = await assets.loadImage(url);
  assets.life.check();
  const [width, height, left, top, boxW, boxH] = reference.values;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  canvas.getContext('2d').drawImage(img, x, y, w, h, sx, sy, w, h);
  assets.scene.textures.addCanvas(key, canvas).add(0, 0, 0, 0, width, height);
  assets.scene.anims.create({ key, frames: [{ key, frame: 0 }], repeat: -1 });

  const bounds = { left, top, right: Math.min(width, left + boxW), bottom: Math.min(height, top + boxH) };
  const result = { key, frame: 0, width, height, bounds, url, source: 'pokerogue' };
  assets.diagnostics.push({ sprite: mon.spriteId, back, url, still: true, width, height, bounds });
  return result;
}

// Reconstruct trimmed frames in sourceSize coordinates before measuring them.
export function pokerogueGeometry(image, atlas) {
  const frames = atlas.textures.flatMap(texture => texture.frames);
  const width = frames[0].sourceSize.w, height = frames[0].sourceSize.h;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const bounds = unionBounds(frames.map(f => {
    if (f.rotated || f.sourceSize.w !== width || f.sourceSize.h !== height) throw new Error('Unsupported PokeRogue atlas geometry');
    context.clearRect(0, 0, width, height);
    context.drawImage(image, f.frame.x, f.frame.y, f.frame.w, f.frame.h,
      f.spriteSourceSize.x, f.spriteSourceSize.y, f.frame.w, f.frame.h);
    return canvasBounds(canvas);
  }));
  return { width, height, bounds };
}
