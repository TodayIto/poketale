import { OT_NAME_MAX } from '../../story/rules.mjs';

export async function userName(risuai) {
  if (typeof risuai?.parseRisuChat !== 'function') return null;
  try {
    const name = String((await risuai.parseRisuChat('{{user}}')) ?? '').trim();
    return name && !name.includes('{{') ? name : null;
  } catch {
    return null;
  }
}

export async function personaName(risuai) {
  return (await userName(risuai))?.slice(0, OT_NAME_MAX) ?? null;
}
