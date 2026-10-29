import { TOAST_CLASS, TOAST_MS, toastKind } from '../../story/toast.mjs';

let showing = null;

// Shows note = { text, kind } (story/failure.mjs failureNote - two lines in one text) for TOAST_MS
export async function showToast(doc, { text, kind }) {
  const body = doc && await doc.querySelector('body');
  if (!body) return;
  const toast = await doc.createElement('div');
  await toast.addClass(TOAST_CLASS);
  await toast.addClass(toastKind(kind));
  await toast.setTextContent(text);
  const before = showing;
  showing = toast;
  if (before) await before.remove();
  await body.appendChild(toast);
  setTimeout(() => {
    if (showing === toast) showing = null;
    Promise.resolve(toast.remove()).catch(error => console.warn('[poke-battle] 알림을 지우지 못함', error));
  }, TOAST_MS);
}
