const PAST = Symbol.for('pokebattle.levelUpPast');
const ROOT = Symbol.for('pokebattle.levelUpRoot');
const MADE = Symbol.for('pokebattle.levelUpByGen');

const hidden = (target, key, value) => Object.defineProperty(target, key, { value, configurable: true });

export function withPastLevelUp(table, past) {
  // New lists drop the generation tables made from the old ones
  if (table && typeof table === 'object' && past && (typeof past === 'object' || typeof past === 'string')) { hidden(table, PAST, past); hidden(table, MADE, null); }
  return table;
}

function listAt(entries, gen, newest) {
  if (!Array.isArray(entries) || !entries.length) return newest;
  let pick = null;
  for (const entry of entries) {
    if (!Array.isArray(entry)) continue;
    if (pick === null || entry[0] <= gen) pick = entry;
    if (entry[0] >= gen) break;
  }
  return !pick || pick[1] === 0 || !Array.isArray(pick[1]) ? newest : pick[1];
}

const EVOLUTION_MOVES_GEN = 8;
export const evolutionLevelMoves = (list, level, gen) =>
  (list ?? []).filter(([at]) => at === 0 || (Number.isInteger(gen) && gen < EVOLUTION_MOVES_GEN && at === level)).map(([, move]) => move);

// `gen` null, missing or 9 and later gives the newest table itself.
export function levelUpAt(table, gen) {
  const root = table?.[ROOT] ?? table;
  let past = root?.[PAST];
  if (!past || !Number.isInteger(gen) || gen >= 9) return root;
  if (typeof past === 'string') hidden(root, PAST, past = JSON.parse(past));
  let made = root[MADE];
  if (!made) { made = new Map(); hidden(root, MADE, made); }
  let at = made.get(gen);
  if (!at) {
    at = { ...root };
    for (const [id, entries] of Object.entries(past)) at[id] = listAt(entries, gen, root[id]);
    hidden(at, ROOT, root);
    made.set(gen, at);
  }
  return at;
}
