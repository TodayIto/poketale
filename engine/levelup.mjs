// The level-up table (data/levelup.json) holds each species' newest list. The older generations' lists
// (data/levelup-past.json: per species [[gen, list or 0], ...] from its debut on, 0 standing for the newest list) ride on it as a
// hidden property, so code reading `table[speciesId]` keeps the newest lists and only callers that know a generation
// ask for another. A table without them (a copy made by JSON, an older bundle) gives the newest lists everywhere.
const PAST = Symbol.for('pokebattle.levelUpPast');
const ROOT = Symbol.for('pokebattle.levelUpRoot');
const MADE = Symbol.for('pokebattle.levelUpByGen');

const hidden = (target, key, value) => Object.defineProperty(target, key, { value, configurable: true });

export function withPastLevelUp(table, past) {
  // New lists drop the generation tables made from the old ones
  if (table && typeof table === 'object' && past && typeof past === 'object') { hidden(table, PAST, past); hidden(table, MADE, null); }
  return table;
}

// One species' list for a generation: its latest list of that generation or earlier, else the first one it has (a
// species newer than the generation learns as in its own first generation).
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

// The moves a Pokémon learns on evolving into a species with that list: its level-0 moves (evolution moves; Showdown
// has them from generation 8), and, learning from an older generation's table, the moves the new species learns at its
// level, as the games taught them (Charizard's Wing Attack at 36 in generation 3). Generation 7's evolution moves sit at
// level 1 in Showdown's data, among the starting moves, so they cannot be told apart and are not taught.
const EVOLUTION_MOVES_GEN = 8;
export const evolutionLevelMoves = (list, level, gen) =>
  (list ?? []).filter(([at]) => at === 0 || (Number.isInteger(gen) && gen < EVOLUTION_MOVES_GEN && at === level)).map(([, move]) => move);

// `gen` null, missing or 9 and later gives the newest table itself.
export function levelUpAt(table, gen) {
  const root = table?.[ROOT] ?? table;
  const past = root?.[PAST];
  if (!past || !Number.isInteger(gen) || gen >= 9) return root;
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
