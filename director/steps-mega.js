import { positionOf } from './read.js';
import { effectText, typeNameIn } from './steps-effects.js';
import { nameWithAffix } from './text.js';
import { DEFAULT_LANG } from './lang.js';

// Lines this module handles (steps.js dispatch table)
export const MEGA_KINDS = ['-terastallize', '-mega', '-primal', '-burst', '-zpower', '-zbroken'];

export function gimmickOptions(request, { teraOrb = true } = {}, slot = 0) {
  const active = request?.active?.[slot];
  if (active?.canMegaEvo) return { mega: true };
  if (active?.canTerastallize && teraOrb) return { tera: String(active.canTerastallize) };
  return {};
}

export function gimmickSuffix(choice, request, allow, slot = 0) {
  const options = gimmickOptions(request, allow, slot);
  if (choice.mega && choice.tera) throw new Error('Invalid player choice');
  if (choice.mega) { if (!options.mega) throw new Error('Invalid player choice'); return ' mega'; }
  if (choice.tera) { if (!options.tera) throw new Error('Invalid player choice'); return ' terastallize'; }
  return '';
}

export function megaFormName(names, species) {
  const full = names.species(species.id);
  const inner = /\(([^()]+)\)\s*$/.exec(full)?.[1];
  if (inner) return inner;
  const mega = /^Mega(?:-(\w+))?$/.exec(species.forme ?? '');
  return mega ? `Mega ${names.species(species.baseSpecies)}${mega[1] ? ` ${mega[1]}` : ''}` : full;
}

export function createMegaTera({ view, warn, ledger, lang = DEFAULT_LANG, affix = nameWithAffix(lang) }) {
  const nameOf = ident => affix(ledger.get(ident).name, positionOf(ident));
  const nv = ident => ({ pokemonName: nameOf(ident), pokemonNameWithAffix: nameOf(ident) });
  const say = (key, values) => view.message(effectText(key, values, lang), {});
  const typeName = type => typeNameIn(lang, type);

  async function present({ kind, args: a }) {
    switch (kind) {
    case '-terastallize': {

      const side = positionOf(a[0]), type = a[1];
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
