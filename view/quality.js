export const QUALITIES = Object.freeze(['high', 'low']);
export const DEFAULT_QUALITY = 'high';
export const CANVAS_SIZE = Object.freeze({ high: [1920, 1080], low: [960, 540] });
export const LOW_ZOOM = 0.5;

export function fitCamera(camera, quality) {
  if (quality === 'low') camera.setZoom(LOW_ZOOM).centerOn(1920 / 2, 1080 / 2);
}
