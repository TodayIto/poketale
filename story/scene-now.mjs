import { latestStatus } from './compat.mjs';
import { battlesIn } from './blocks.mjs';
import { rulesAt } from './setting-changes.mjs';
import { readBattleAt } from './chat.mjs';

/** The default when the chat says nothing: plains in the day */
export const SCENE_DEFAULT = Object.freeze({ place: 'plains', time: 'day', indoors: false });

function latestBattle(chat) {
  const messages = chat?.message ?? [];
  const readAt = rulesAt(chat);
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role !== 'char') continue;
    const spec = battlesIn(messages[i], i, readAt(i)).map(b => readBattleAt(chat, i, b.body).spec).filter(Boolean).at(-1);
    if (spec) return spec;
  }
  return null;
}

export function sceneNow(chat) {
  const status = latestStatus(chat);
  const fromStatus = status?.place ?? null;
  const battle = fromStatus && status?.timeOfDay ? null : latestBattle(chat);
  return {
    place: fromStatus ?? battle?.place ?? SCENE_DEFAULT.place,
    time: status?.timeOfDay ?? battle?.time ?? SCENE_DEFAULT.time,
    indoors: !!fromStatus && !!status.indoors,
  };
}
