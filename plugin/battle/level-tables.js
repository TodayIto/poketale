import { LEVELUP_GZ_B64 } from 'embedded:levelup';
import { withPastLevelUp } from '../../engine/levelup.mjs';
export { EXP_TABLE } from 'embedded:exp'; // exp (data/exp.json)

let levelUpPromise;

export function unpackLevelUp(data) {
  if (!data?.species) return data;
  const latest = {}, past = {};
  for (const [id, [list, older]] of Object.entries(data.species)) { latest[id] = list; if (older) past[id] = older; }

  return withPastLevelUp(latest, JSON.stringify(past));
}

export function loadLevelUp() {
  return levelUpPromise ??= (async () => {
    const bytes = Uint8Array.from(atob(LEVELUP_GZ_B64), c => c.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return unpackLevelUp(JSON.parse(await new Response(stream).text()));
  })().catch(error => { levelUpPromise = undefined; throw error; });
}
