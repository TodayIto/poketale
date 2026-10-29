import { LEVELUP_GZ_B64 } from 'embedded:levelup';
export { EXP_TABLE } from 'embedded:exp';

let levelUpPromise;

export function loadLevelUp() {
  return levelUpPromise ??= (async () => {
    const bytes = Uint8Array.from(atob(LEVELUP_GZ_B64), c => c.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return JSON.parse(await new Response(stream).text());
  })().catch(error => { levelUpPromise = undefined; throw error; });
}
