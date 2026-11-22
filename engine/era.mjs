export const ABILITIES_FROM = 3, HELD_ITEMS_FROM = 2, GENDER_FROM = 2;

export const outsideStatus = (gen, status) => (status === 'tox' && gen <= 2 ? 'psn' : status);

export function eraSet(gen, set) {
	if (gen == null || !(gen < ABILITIES_FROM)) return set;
	// an empty ability would be filled with the species' first one
	const out = { ...set, ability: 'No Ability', nature: '' };
	if (gen < HELD_ITEMS_FROM) out.item = '';
	if (gen < GENDER_FROM) out.gender = '';
	return out;
}
