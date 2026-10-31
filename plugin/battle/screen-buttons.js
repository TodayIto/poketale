import { BACK_ICON, bindPress } from './phone.js';
import { say } from '../../story/screen-text.mjs';

const arrow = path => `<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="${path}"/></svg>`;

export const SCREEN_BUTTONS = Object.freeze([
  ['prev', 'left', 'window.prevPage', arrow('M3.6 8 11.4 2.6v10.8z')],
  ['next', 'right', 'window.nextPage', arrow('M12.4 8 4.6 13.4V2.6z')],
  ['back', 'b', 'window.backKey', BACK_ICON],
]);

export function mountScreenButtons(band, { before = null, press, lang }) {
  const buttons = Object.fromEntries(SCREEN_BUTTONS.map(([name, key, labelKey, icon]) => {
    const label = say(lang, labelKey);
    const button = document.createElement('button');
    Object.assign(button, { type: 'button', className: `screen-${name}`, innerHTML: icon, title: label, tabIndex: -1, hidden: true });
    button.setAttribute('aria-label', label);
    bindPress(button, () => { if (!button.disabled) press(key); });
    band.insertBefore(button, before);
    return [name, button];
  }));
  let state = null, shown = false;
  const draw = () => {
    const pages = shown ? state?.pages : null;
    buttons.back.hidden = !shown || !state;
    buttons.back.disabled = !state?.back;
    buttons.prev.hidden = buttons.next.hidden = !pages;
    buttons.prev.disabled = !pages?.prev;
    buttons.next.disabled = !pages?.next;
  };
  draw();
  return { buttons, set(next) { state = next; draw(); }, show(on) { shown = on; draw(); } };
}
