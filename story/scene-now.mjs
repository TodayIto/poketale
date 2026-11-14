import { latestStatus } from './compat.mjs';
import { battlesIn } from './blocks.mjs';
import { readBattleAt } from './chat.mjs';

export const SCENE_DEFAULT = Object.freeze({ place: 'plains', time: 'day', indoors: false });

function latestBattle(chat) {
  const messages = chat?.message ?? [];
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role !== 'char') continue;
    const spec = battlesIn(messages[i], i).map(b => readBattleAt(chat, i, b.body).spec).filter(Boolean).at(-1);
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
