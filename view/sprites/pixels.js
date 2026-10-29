export function opaquePixels(rgba) {
  let count = 0;
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i]) count++;
  return count;
}

export function median(values) {
  if (!values.length || values.some(v => !Number.isFinite(v) || v < 0)) throw new Error('Invalid pixel counts');
  const sorted = [...values].sort((a, b) => a - b), mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
