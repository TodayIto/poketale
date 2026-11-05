// Ability activation text shared by move and effect events.
import { isIdent } from './read.js';
import { toID } from '../engine/mon.mjs';

export const effectOf = value => {
  const match = /^(move|ability|item|pokemon):\s*(.*)$/.exec(String(value ?? ''));
  const name = match ? match[2] : String(value ?? '');
  return { prefix: match?.[1] ?? '', name, id: toID(name) };
};

export function abilityTrigger({ kind, args: a, kwArgs: kw }) {
  if (kind.startsWith('-story-')) return null;
  const from = kw.from ? effectOf(kw.from) : null;
  if (kind === '-ability') {
    if (from && from.prefix !== 'ability') return null;
    return { ident: a[0], name: from?.name ?? a[1] };
  }
  if (from?.prefix === 'ability') {
    const ofHolder = kw.of && !['-heal', '-item', '-enditem', '-transform', '-immune'].includes(kind) || (kind === '-item' && from.id === 'frisk');
    const ident = ofHolder && typeof kw.of === 'string' ? kw.of : a[0];
    return isIdent(ident) ? { ident, name: from.name } : null;
  }
  if (['-activate', '-start', '-end', '-block'].includes(kind) && /^ability:/.test(a[1] ?? '') && !kw.silent) {
    const ident = kind === '-block' && typeof kw.of === 'string' ? kw.of : a[0];
    return { ident, name: effectOf(a[1]).name };
  }
  if (kind === 'cant' && /^ability:/.test(a[1] ?? '')) return { ident: typeof kw.of === 'string' ? kw.of : a[0], name: effectOf(a[1]).name };
  return null;
}
