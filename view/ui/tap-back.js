import { onInfoBox } from '../sprites/placement.js';

const inside = (x, y, r) => !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;

// Window in ui container coordinates (x, y = top left) -> field coordinate rectangle
export const uiRect = (x, y, width, height) => ({ left: x, top: 180 + y, right: x + width, bottom: 180 + y + height });

export const FIGHT_WINDOWS = Object.freeze([uiRect(0, -48, 320, 48)]);

export function backTarget(scene) {
  return scene.openMenus?.at(-1)?.tapBack() ?? null;
}

export function screenButtons(scene) {
  const top = scene.openMenus?.at(-1);
  return { back: top ? top.canBack() : !!scene.levels?.evolution?.cancelable, pages: scene.summaryScreen?.pages() ?? null };
}

export function installTapBack(scene) {
  const down = (pointer, over) => {
    if (over?.length) return;
    const x = pointer.worldX / 6, y = pointer.worldY / 6;
    if (onInfoBox(scene, x, y)) return;
    const target = backTarget(scene);
    if (!target || target.windows.some(r => inside(x, y, r))) return;
    target.back();
  };
  scene.input?.on?.('pointerdown', down);
  return () => scene.input?.off?.('pointerdown', down);
}
