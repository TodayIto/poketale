import { noteLooks } from './card.mjs';

// How long a toast stays (ms), fading in and out at the ends
export const TOAST_MS = 4000;
export const TOAST_CLASS = 'x-risu-pkb-toast';

export const toastKind = kind => `${TOAST_CLASS}-${kind}`;

export const TOAST_CSS = [
  `.${TOAST_CLASS}{position:fixed;left:50%;bottom:96px;z-index:60;box-sizing:border-box;width:max-content;max-width:min(420px,calc(100vw - 32px));`
    + `transform:translateX(-50%);font-size:13px;text-align:left;pointer-events:none;animation:x-risu-pkbtoast ${TOAST_MS}ms ease forwards;}`,
  ...noteLooks(kind => `.${TOAST_CLASS}.${toastKind(kind)}`),
  `@keyframes x-risu-pkbtoast{0%{opacity:0;} 6%{opacity:1;} 88%{opacity:1;} 100%{opacity:0;} }`,
].join(' ');
