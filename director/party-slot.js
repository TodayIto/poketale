export const requestIndex = (party, slot) => party.slice(0, slot).filter(p => !p.partner).length;

export const partyIndex = (party, index) => party.findIndex((p, i) => !p.partner && requestIndex(party, i) === index);
