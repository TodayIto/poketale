// Descriptions for battles of other generations: per move (text-move-gens-<lang>.json, embedded with the exp texts under
// MOVE_GENS_KEY by text-exp-source.js) or ability (text-ability-gens-<lang>.json), [first battle generation, last, text]
// ranges, 0 standing for Champions battles. Written for PokéTale from Pokémon Showdown's per-generation notes and data,
// starting from today's text (PokeRogue's locale descriptions). Where Pokémon Champions changed a move or ability,
// today's text gives Champions' version or generation 9's (the locales differ), and a range gives the other. Where it
// describes PokeRogue's own rules, is wrong or has a typo, a range covers Champions and generation 9 too. A battle no
// range covers keeps today's text.
export const MOVE_GENS_KEY = '@moveGens';

export const championsBattle = battle => String(battle?.dex?.currentMod ?? '').startsWith('champions');

// The text of the range holding the generation, or null
export function rangeText(ranges, gen) {
  if (!Array.isArray(ranges) || !Number.isInteger(gen)) return null;
  for (const range of ranges) if (Array.isArray(range) && gen >= range[0] && gen <= range[1] && typeof range[2] === 'string') return range[2];
  return null;
}

// The text for a battle: of its generation, or of Champions
export const rangedText = (ranges, gen, champions) => rangeText(ranges, champions ? 0 : gen);

export function moveDescription(phrases, id, gen, champions = false) {
  const ranged = rangedText(phrases?.[MOVE_GENS_KEY]?.[id], gen, champions);
  return ranged ?? phrases?.[`move.${id}`] ?? '';
}
