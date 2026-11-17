// A saved set stays whole (generation 9 style). In an older generation's battle only what that generation has no
// system for is switched off; species, forms, moves, items and abilities from later generations fight as they are.
export function eraSet(gen, set) {
	if (!(gen <= 2)) return set;
	// An empty ability would be filled with the species' first one
	const out = { ...set, ability: 'No Ability', nature: '' };
	if (gen === 1) Object.assign(out, { item: '', gender: '' });
	return out;
}
