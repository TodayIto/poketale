import phrases from './text-effects-ko.json' with { type: 'json' };
import { interpolate } from './text.js';
import { sideOf } from './read.js';
import { ownTemplate } from './own-text.js';
import { toID } from '../engine/mon.mjs';

// Lines this module handles (steps.js dispatch table)
export const MEGA_KINDS = ['-terastallize', '-mega', '-primal', '-burst', '-zpower', '-zbroken'];

export function gimmickOptions(request, { teraOrb = true } = {}) {
  const active = request?.active?.[0];
  if (active?.canMegaEvo) return { mega: true };
  if (active?.canTerastallize && teraOrb) return { tera: String(active.canTerastallize) };
  return {};
}

export function gimmickSuffix(choice, request, allow) {
  const options = gimmickOptions(request, allow);
  if (choice.mega && choice.tera) throw new Error('Invalid player choice');
  if (choice.mega) { if (!options.mega) throw new Error('Invalid player choice'); return ' mega'; }
  if (choice.tera) { if (!options.tera) throw new Error('Invalid player choice'); return ' terastallize'; }
  return '';
}

export function megaFormName(names, species) {
  const full = names.species(species.id);
  return /\(([^()]+)\)\s*$/.exec(full)?.[1] ?? full;
}

export function createMegaTera({ battle, view, names, warn, ledger }) {
  const nameOf = ident => ledger.get(ident).name;
  const nv = ident => ({ pokemonName: nameOf(ident), pokemonNameWithAffix: nameOf(ident) });
  const say = (key, values) => view.message(interpolate(ownTemplate(key) ?? phrases[key], values), {});
  const typeName = type => phrases[`pokemon-info.type.${toID(type)}`] ?? type;

  async function present({ kind, args: a }) {
    switch (kind) {
    case '-terastallize': {

      const side = sideOf(a[0]), type = a[1];
      if (!ledger.onField(a[0])) { warn(`${kind}:${a[0]}`); return; }
      await view.terastallize(side, type);
      await say('battle.pokemonTerastallized', { ...nv(a[0]), type: typeName(type) });
      return;
    }

    case '-mega': case '-primal': return;
    case '-burst': await say('own.ultraBurst', nv(a[0])); return;
    case '-zpower': await say('own.zPower', nv(a[0])); return;
    case '-zbroken': await say('own.zBroken', nv(a[0])); return;
    }
  }
  return { present };
}
