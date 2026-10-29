import { names } from '../../names/index.js';

// Adapts the name table's plural API to the director's singular API.
export const battleNames = Object.freeze({
  species: names.species, move: names.moves, ability: names.abilities, item: names.items,
});
