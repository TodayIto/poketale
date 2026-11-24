import { onInfoBox } from '../sprites/placement.js';

const inside = (x, y, r) => !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;

export const uiRect = (x, y, width, height) => ({ left: x, top: 180 + y, right: x + width, bottom: 180 + y + height });

export const FIGHT_WINDOWS = Object.freeze([uiRect(0, -48, 320, 48)]);

export function backTarget(scene) {
  return scene.openMenus?.at(-1)?.tapBack() ?? null;
}

// Keep an open page strip distinct from a closed one even if neither arrow is enabled.
export const PAGE_PREV = 1, PAGE_NEXT = 2, PAGE_VISIBLE = 4;
const BUTTON_BACK = 8;

export function watchScreenButtons(scene, fn, isDestroyed) {
  let previous = -1;
  const check = () => {
    if (isDestroyed()) return;
    const top = scene.openMenus?.at(-1);
    const back = top ? top.canBack() : !!scene.levels?.evolution?.cancelable || (!!scene.amieScreen?.isOpen && scene.amieScreen.canBack());
    const pages = scene.summaryScreen?.pageButtons() ?? 0;
    const state = pages | (back ? BUTTON_BACK : 0);
    if (state === previous) return;
    previous = state;
    fn({ back: !!back, pages: pages & PAGE_VISIBLE ? { prev: !!(pages & PAGE_PREV), next: !!(pages & PAGE_NEXT) } : null });
  };
  check();
  scene.events.on('postupdate', check);
  return () => scene.events?.off('postupdate', check);
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
