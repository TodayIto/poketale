import { SIZE } from '../../story/panel-html.mjs';

export const HOST_INPUT = 'textarea';

export const INPUT_PAD = 10;

export async function belowSheet(doc, floor) {
  const bottom = (await floor.getBoundingClientRect()).top;
  if (!(bottom > 0)) return null;
  const boxes = await doc.querySelectorAll(HOST_INPUT);
  let top = null;
  for (let i = 0, n = await boxes.length(); i < n; i++) {
    const r = await (await boxes.at(i)).getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && r.top < bottom && (top === null || r.top > top)) top = r.top;
  }
  if (top === null || top < bottom / 2) return null;
  return Math.round(bottom - top) + INPUT_PAD + SIZE.wide.bottomGap;
}
