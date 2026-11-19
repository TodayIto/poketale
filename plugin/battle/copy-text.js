export async function copyText(text, { clipboard = globalThis.navigator?.clipboard, doc = globalThis.document } = {}) {
  try {
    if (typeof clipboard?.writeText === 'function') { await clipboard.writeText(text); return true; }
  } catch {                                                    }
  let area = null;
  try {
    area = doc.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    Object.assign(area.style, { position: 'fixed', top: '0', left: '0', opacity: '0', pointerEvents: 'none' });
    doc.body.append(area);
    area.select();
    return doc.execCommand?.('copy') === true;
  } catch { return false; } finally { area?.remove(); }
}
