import { say } from '../../story/screen-text.mjs';

export const SLOW_MS = 3000;

const CSS = `
  .pkb-loading { position:absolute; inset:0; z-index:2; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px;
    background:#15202d; font:14px/1.5 system-ui,sans-serif; color:#c7d4df; }
  .pkb-loading[hidden] { display:none; }
  .pkb-loading.page { position:fixed; z-index:99; background:#0f1822; }
  .pkb-loading .ball { width:44px; height:44px; border-radius:50%; border:3px solid #18242e;
    background:radial-gradient(circle closest-side,#fff 0 22%,#18242e 22% 38%,transparent 38%),linear-gradient(to bottom,#e3343f 0 44%,#18242e 44% 56%,#fff 56%);
    animation:pkb-loading-spin 1s linear infinite; }
  .pkb-loading p { margin:0; visibility:hidden; }
  .pkb-loading.slow p { visibility:visible; }
  @keyframes pkb-loading-spin { to { transform:rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .pkb-loading .ball { animation-duration:3s; } }`;

export function mountLoading(parent, { before = null, page = false, hidden = false, lang }) {
  const element = document.createElement('div');
  element.className = ['pkb-loading', page && 'page'].filter(Boolean).join(' ');
  element.setAttribute('role', 'status');
  element.innerHTML = `<style>${CSS}</style><div class="ball"></div><p>${say(lang, 'window.loading')}</p>`;
  parent.insertBefore(element, before);
  let slow = null;
  const hide = () => { element.hidden = true; clearTimeout(slow); slow = null; };
  const show = () => {
    element.hidden = false;
    element.classList.remove('slow');
    clearTimeout(slow);
    slow = setTimeout(() => element.classList.add('slow'), SLOW_MS);
  };
  if (hidden) hide(); else show();
  return { element, show, hide, remove() { hide(); element.remove(); } };
}
