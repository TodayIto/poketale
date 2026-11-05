const IDENT = /^p[1-4][a-z]?: /;

export const isIdent = text => IDENT.test(String(text ?? ''));

export function sideOf(ident) {
  if (/^p[13][a-z]?:/.test(ident)) return 'player';
  if (/^p[24][a-z]?:/.test(ident)) return 'enemy';
  throw new Error(`Unsupported Pokemon identifier: ${ident}`);
}

export function positionAt(sideIndex, slot) {
  const index = slot + Math.floor(sideIndex / 2);
  return (sideIndex % 2 ? 'enemy' : 'player') + (index ? String(index + 1) : '');
}
export function positionOf(ident) {
  const match = /^p([1-4])([a-z]?):/.exec(String(ident));
  if (!match) throw new Error(`Unsupported Pokemon identifier: ${ident}`);
  const side = +match[1] - 1;

  return match[2] ? (side % 2 ? 'enemy' : 'player') + (match[2] === 'a' ? '' : String(match[2].charCodeAt(0) - 96)) : positionAt(side, 0);
}

export const sideIndexOf = ident => Number(/^p([1-4])/.exec(String(ident))[1]) - 1;

export const positionOfMon = pokemon => positionAt(pokemon.side.n, pokemon.position);

export const teamOf = position => (String(position).startsWith('enemy') ? 'enemy' : 'player');

export const fieldPositions = battle => (battle.activePerHalf > 1 ? ['player', 'player2', 'enemy', 'enemy2'] : ['player', 'enemy']);

export const identName = ident => String(ident).split(': ').slice(1).join(': ');

export const uidOf = (event, ident) => event.tag?.refs.find(ref => ref.text === ident)?.uid ?? null;

export function readEvent(event) {
  const actor = isIdent(event.args[0]) ? uidOf(event, event.args[0]) : null;
  const swap = event.kind === 'switch' || event.kind === 'drag';
  return { ...event, actor, cause: swap ? event.tag.cause : null };
}
