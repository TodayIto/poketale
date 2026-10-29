import { OT_NAME_MAX } from '../../story/rules.mjs';

export async function personaName(risuai) {
  if (typeof risuai?.parseRisuChat !== 'function') return null;
  try {
    const name = String((await risuai.parseRisuChat('{{user}}')) ?? '').trim();
    return name && !name.includes('{{') ? name.slice(0, OT_NAME_MAX) : null;
  } catch {
    return null;
  }
}
