import { MACHINE_STANDARDS, regionStandard } from './machine-standards.mjs';

// Which generation's level-up table a Pokémon learns from (the "Level-Up Moves" setting): that of the place it joined
// (`mon.metGen`), that of the region it is in now, or the newest table whatever the generation (Default, as before)
export const LEARN_MODES = Object.freeze(['origin', 'location', 'newest']);
export const DEFAULT_LEARN = 'newest';

// A place's generation: that of its region's game at the story's world generation, by the disc standards' rule
// (story/machine-standards.mjs regionStandard: Kanto is Red/Blue in a generation-1 world, FireRed/LeafGreen in a
// generation-3 one; Pokémon Journeys is Sword/Shield everywhere), else the world generation where no region with games
// is known (before the first Status Window, Hisui)
export const placeGen = (region, world) => MACHINE_STANDARDS[regionStandard(region, world)]?.gen ?? (Number.isInteger(world?.gen) ? world.gen : null);

// setting: the chat's generation setting at that message (story/generation.mjs); rule: the battle rule there. The Default
// choice, chats kept on generation 9 and Champions battles (generation 9's whatever the story's generation) learn from the
// newest tables, but still note where Pokémon join, for the day they switch.
export function learningAt({ setting, world, region, by, rule = null }) {
  const mode = LEARN_MODES.includes(by) ? by : DEFAULT_LEARN;
  return { place: placeGen(region, world), newest: mode === 'newest' || setting === 'legacy' || rule === 'champions', by: mode };
}

// The generation whose table a Pokémon learns from here, or null for the newest table (engine/levelup.mjs levelUpAt).
// mon null asks for a Pokémon joining here, whose origin is this place.
export function learnGen(learning, mon = null) {
  if (!learning || learning.newest) return null;
  const own = learning.by === 'origin' && Number.isInteger(mon?.metGen) ? mon.metGen : null;
  return own ?? (Number.isInteger(learning.place) ? learning.place : null);
}

// The place a joining Pokémon comes from, as saved on it
export const metGenOf = learning => (Number.isInteger(learning?.place) ? learning.place : null);
