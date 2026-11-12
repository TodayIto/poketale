import { CHAT_SCREEN } from '../battle/stage.js';

export const CHAT_TEXT = '.chattext';

export const MEASURED = 12;

export async function chatRoom(doc, floor) {
  const right = (await floor.getBoundingClientRect()).right;
  if (!(right > 0)) return null;
  const boxes = await doc.querySelectorAll(`${CHAT_SCREEN} ${CHAT_TEXT}`);
  let end = null;
  for (let i = 0, n = Math.min(await boxes.length(), MEASURED); i < n; i++) {
    const r = await (await boxes.at(i)).getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && (end === null || r.right > end)) end = r.right;
  }
  return end === null ? null : Math.max(0, Math.floor(right - end));
}
