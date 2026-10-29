export const PICTURE_KEY = 'pkb_my_picture';

// Key in plugin storage holding this persona's picture (data URL)
export const pictureKey = name => `${PICTURE_KEY}:${name}`;

export const PICTURE_SHORT_SIDE = 512;

const PICTURE_TYPE = 'image/webp', PICTURE_QUALITY = 0.92;

const CLEAR_EDGE_SHARE = 0.25;

export function fitShortSide(width, height, max = PICTURE_SHORT_SIDE) {
  const short = Math.min(width, height);
  if (short <= max) return { width, height };
  const scale = max / short;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function clearEdges({ data, width, height }) {
  let clear = 0, total = 0;
  const at = (x, y) => { total++; if (data[(y * width + x) * 4 + 3] < 128) clear++; };
  for (let x = 0; x < width; x++) { at(x, 0); if (height > 1) at(x, height - 1); }
  for (let y = 1; y < height - 1; y++) { at(0, y); if (width > 1) at(width - 1, y); }
  return total > 0 && clear / total >= CLEAR_EDGE_SHARE;
}

export const entryMe = (look, image) => (look === 'image' && image ? { black: false, image } : { black: look !== 'color', image: null });

export async function loadPicture(storage, name) {
  const value = await storage?.getItem?.(pictureKey(name));
  return typeof value === 'string' && value.startsWith('data:image/') ? value : null;
}

export async function savePicture(storage, name, dataUrl) {
  if (dataUrl) await storage.setItem(pictureKey(name), dataUrl);
  else await storage.removeItem(pictureKey(name));
}

export async function adoptOldPicture(storage, name) {
  const old = await storage.getItem(PICTURE_KEY);
  if (typeof old === 'string' && await storage.getItem(pictureKey(name)) == null) await storage.setItem(pictureKey(name), old);
  await storage.removeItem(PICTURE_KEY);
}

export async function shrinkPicture(file) {
  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = fitShortSide(bitmap.width, bitmap.height);
    const canvas = Object.assign(document.createElement('canvas'), { width, height });
    const g = canvas.getContext('2d');
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(bitmap, 0, 0, width, height);
    return canvas.toDataURL(PICTURE_TYPE, PICTURE_QUALITY);
  } finally { bitmap.close(); }
}
