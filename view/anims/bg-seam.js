const SEAM_LIMIT = 12;
export const MAX_STRETCH = 2;
export const EDGE = 4;
const VIEW = 256; // local units of the field's width
const checked = new Map(); // texture key -> true (does not join) / false

function hasSideSeam(scene, key) {
  if (checked.has(key)) return checked.get(key);
  let seam = false;
  try {
    const image = scene.textures.get(key)?.getSourceImage?.();
    const w = image?.width, h = image?.height;
    if (w > 1 && h > 0 && typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const g = canvas.getContext('2d', { willReadFrequently: true });
      g.drawImage(image, 0, 0);
      const left = g.getImageData(0, 0, 1, h).data, right = g.getImageData(w - 1, 0, 1, h).data;
      let sum = 0;
      for (let i = 0; i < left.length; i += 4) sum += Math.abs(left[i] - right[i]) + Math.abs(left[i + 1] - right[i + 1]) + Math.abs(left[i + 2] - right[i + 2]);
      seam = sum / h > SEAM_LIMIT;
    }
  } catch { seam = false; } // unreadable: drawn as before
  checked.set(key, seam);
  return seam;
}

export function seamFit(w, from, to) {

  const span = to - from, k = Math.max(1, span / (w - 2 * EDGE));
  if (k > MAX_STRETCH) return null;
  return { k, base: (w - span / k) / 2 - from / k };
}

function mirrorTexture(scene, key) {
  const mirror = `${key}:mirror`;
  if (scene.textures.exists(mirror)) return mirror;
  const image = scene.textures.get(key).getSourceImage(), w = image.width, h = image.height;
  const canvas = scene.textures.createCanvas(mirror, w * 2, h), g = canvas.getContext();
  g.drawImage(image, 0, 0);
  g.save(); g.translate(w * 2, 0); g.scale(-1, 1); g.drawImage(image, 0, 0); g.restore();
  canvas.refresh();
  return mirror;
}

export const rangeForX = xs => [(320 - Math.max(...xs)) / 1.25, (640 - Math.min(...xs)) / 1.25];

export function fitBackground(scene, bg, key, from, to) {
  if (!hasSideSeam(scene, key)) return null;
  const w = scene.textures.get(key).getSourceImage().width, fit = seamFit(w, from, to);
  if (!fit) { bg.setTexture(mirrorTexture(scene, key)); return null; }
  bg.tileScaleX = fit.k;
  bg.tilePositionX = fit.base;
  return fit;
}
