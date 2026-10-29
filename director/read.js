const IDENT = /^p[12][a-z]?: /;

export const isIdent = text => IDENT.test(String(text ?? ''));

export function sideOf(ident) {
  if (/^p1[a-z]?:/.test(ident)) return 'player';
  if (/^p2[a-z]?:/.test(ident)) return 'enemy';
  throw new Error(`Unsupported Pokemon identifier: ${ident}`);
}

// Name written in the ident (`p1a: Pikachu` -> `Pikachu`)
export const identName = ident => String(ident).split(': ').slice(1).join(': ');

export const uidOf = (event, ident) => event.tag?.refs.find(ref => ref.text === ident)?.uid ?? null;

export function readEvent(event) {
  const actor = isIdent(event.args[0]) ? uidOf(event, event.args[0]) : null;
  const swap = event.kind === 'switch' || event.kind === 'drag';
  return { ...event, actor, cause: swap ? event.tag.cause : null };
}
