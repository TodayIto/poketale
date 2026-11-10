// Reply badge and close confirmation for auxiliary screens.
import { pixelSvg } from './amie-art.js';

export const BADGE_OUT = 9;

export const BADGE_ICON = pixelSvg([
  '.NNNNNNNNNN.',
  'NRRRRRRRRRRN',
  'NRRRRWWRRRRN',
  'NRRRRWWRRRRN',
  'NRRRRWWRRRRN',
  'NRRRRWWRRRRN',
  'NRRRRRRRRRRN',
  'NRRRRWWRRRRN',
  'NRRRRRRRRRRN',
  '.NNRRNNNNNN.',
  '..NRN.......',
  '..NN........',
], { N: '#5a1a22', R: '#e8434f', W: '#ffffff' }).replace('<svg ', '<svg width="24" height="24" ');

export function createReplyNotice() {
  let shown = false;
  const listeners = new Set();
  return {
    get shown() { return shown; },
    show() {
      if (shown) return;
      shown = true;
      for (const fn of [...listeners]) fn(shown);
    },
    listen(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}

export function closePress({ round = () => false, ask, stop = () => {}, close }) {
  let asking = false;
  return async () => {
    if (asking) return 'busy';
    if (!round()) { close(); return 'closed'; }
    asking = true;
    try {
      if (!await ask()) return 'kept';
    } finally { asking = false; }
    stop();
    close();
    return 'quit';
  };
}

export const badgeCss = R => `
  ${R} .exit.close .badge{position:absolute;top:${-BADGE_OUT}px;right:${-BADGE_OUT}px;width:24px;height:24px;filter:drop-shadow(0 1.5px 0 #1a3247);
    animation:pkb-badge-pop .42s cubic-bezier(.3,1.6,.5,1);}
  ${R} .exit.close .badge svg{display:block;}
  @keyframes pkb-badge-pop{0%{transform:scale(.3)}55%{transform:scale(1.25) translateY(-2px)}80%{transform:scale(.92)}100%{transform:scale(1)}}`;

export function bindBadge(root, { notice, arrived }) {
  const close = root.querySelector('.exit.close');
  if (!notice || !close) return () => {};
  const label = close.getAttribute('aria-label') ?? '';
  const badge = (root.ownerDocument ?? globalThis.document).createElement('span');
  badge.className = 'badge';
  badge.setAttribute('aria-hidden', 'true');
  badge.innerHTML = BADGE_ICON;
  badge.hidden = true;
  close.append(badge);
  const draw = shown => {
    badge.hidden = !shown;
    const text = shown && arrived ? `${label} · ${arrived}` : label;
    close.setAttribute('aria-label', text);
    close.title = text;
  };
  draw(notice.shown);
  return notice.listen(draw);
}
