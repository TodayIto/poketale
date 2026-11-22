import { positionOf, positionAt } from './read.js';
import { effectText, typeNameIn } from './steps-effects.js'; // effect table + own text (own.* - Z-Moves, Ultra Burst)
import { nameWithAffix } from './text.js';
import { DEFAULT_LANG } from './lang.js';
import { toID, spriteIdOf } from '../engine/mon.mjs';
import { genHas } from '../engine/generation.mjs';

/** Lines this module handles (steps.js dispatch table) */
export const MEGA_KINDS = ['-terastallize', '-mega', '-primal', '-burst', '-zpower', '-zbroken'];

export const specGimmicks = (spec, { champions = false, gen = null } = {}) => ({
  teraOrb: genHas(gen, 'tera') && spec?.teraOrb !== false,
  zRing: genHas(gen, 'z') && spec?.zRing !== false,
  keyStone: genHas(gen, 'mega') && (champions || spec?.keyStone !== false),
  dynamax: genHas(gen, 'dynamax') && spec?.dynamaxBand !== false && spec?.dynamaxHere !== false,
});

export function gimmickOptions(request, { teraOrb = true, zRing = true, keyStone = true } = {}, slot = 0) {
  const active = request?.active?.[slot];
  if (active?.canMegaEvo && keyStone) return { mega: true };
  if (active?.canUltraBurst && zRing) return { ultra: true };
  if (active?.canTerastallize && teraOrb) return { tera: String(active.canTerastallize) };
  return {};
}

export function zChoices(request, { zRing = true } = {}, slot = 0) {
  const entries = request?.active?.[slot]?.canZMove;
  return zRing && Array.isArray(entries) && entries.some(Boolean) ? entries : null;
}

export function dynamaxChoices(request, { dynamax = true } = {}, slot = 0) {
  const active = request?.active?.[slot];
  return dynamax && active?.canDynamax && active.maxMoves?.maxMoves?.some(entry => !entry.disabled) ? active.maxMoves : null;
}

const isDynamaxed = pokemon => !!pokemon?.volatiles?.dynamax;

export function maxEntries(request, pokemon, slot = 0, picked = false) {
  const entries = request?.active?.[slot]?.maxMoves?.maxMoves;
  return Array.isArray(entries) && (picked || isDynamaxed(pokemon)) ? entries : null;
}

export const maxDeniedSource = pokemon => (pokemon?.volatiles?.taunt ? 'taunt' : 'assaultvest');

export function gimmickSuffix(choice, request, allow, slot = 0, used = {}) {
  if (['mega', 'tera', 'ultra', 'z', 'dynamax'].filter(flag => choice[flag]).length > 1) throw new Error('Invalid player choice');
  if (choice.z) {
    if (used.z || !zChoices(request, allow, slot)?.[choice.index]) throw new Error('Invalid player choice');
    return ' zmove';
  }
  if (choice.dynamax) {
    const entry = used.gimmick ? null : dynamaxChoices(request, allow, slot)?.maxMoves?.[choice.index];
    if (!entry || entry.disabled) throw new Error('Invalid player choice');
    return ' dynamax';
  }
  const options = used.gimmick ? {} : gimmickOptions(request, allow, slot);
  for (const [flag, suffix] of [['mega', ' mega'], ['tera', ' terastallize'], ['ultra', ' ultra']]) {
    if (!choice[flag]) continue;
    if (!options[flag]) throw new Error('Invalid player choice');
    return suffix;
  }
  return '';
}

export function moveNameOf(names, lang, name) {
  const status = /^Z-(.+)$/.exec(name);
  if (!status) return names.move(toID(name));
  return `${lang === 'ko' ? 'Z' : 'Z-'}${names.move(toID(status[1]))}`;
}

export function zMoveOptions({ names, lang, moveInfo }, request, allow, slot, user, foe, extra = () => ({})) {
  const entries = zChoices(request, allow, slot);
  if (!entries) return null;
  const moves = request.active[slot].moves;
  return entries.map((entry, i) => (entry && moves[i]
    ? { name: moveNameOf(names, lang, entry.move), ...moveInfo(moves[i].id, user, foe(entry, i), true), ...extra(entry, i) }
    : null));
}

export function prefetchCutIns(battle, view, request, allow) {
  if (!view.prefetchCutIn) return;
  request?.active?.forEach((_, slot) => { if (zChoices(request, allow, slot)) view.prefetchCutIn(positionAt(0, slot)); });
  battle.sides[1]?.active.forEach((pokemon, slot) => {
    if (pokemon && !pokemon.fainted && battle.actions.canZMove?.(pokemon)) view.prefetchCutIn(positionAt(1, slot));
  });
}

export function maxMoveOptions({ names, moveInfo }, request, allow, slot, user, foe, extra = () => ({})) {
  const offered = dynamaxChoices(request, allow, slot);
  const entries = offered?.maxMoves ?? maxEntries(request, user, slot);
  if (!entries) return {};
  const moves = request.active[slot].moves;
  const options = entries.map((entry, i) => {
    if (!entry || !moves[i]) return null;
    const { id, ...info } = moveInfo(moves[i].id, user, foe(entry, i), 'max');
    return { name: names.move(id ?? toID(entry.move)), ...info, ...(entry.disabled ? { disabled: true } : {}), ...extra(entry, i) };
  });
  if (!offered) return { max: options };
  return { dynamax: { moves: options, ...(offered.gigantamax ? { gigantamax: names.move(toID(offered.gigantamax)) } : {}) } };
}

export function gmaxForm(dex, species) {
  for (const name of [`${species.name}-Gmax`, `${species.baseSpecies}-Gmax`]) {
    const form = dex.species.get(name);
    if (form?.exists) return { speciesId: form.id, spriteId: spriteIdOf(form) };
  }
  return null;
}

export function dynamaxState(dex, entry) {
  if (entry.dynamax !== 'gmax') return { kind: 'dynamax' };
  return { kind: 'gmax', form: dex ? gmaxForm(dex, dex.species.get(entry.speciesId)) : null };
}

export function megaFormName(names, species) {
  const full = (names.speciesFull ?? names.species)(species.id);
  const inner = /\(([^()]+)\)\s*$/.exec(full)?.[1];
  if (inner) return inner;
  const mega = /^Mega(?:-(\w+))?$/.exec(species.forme ?? '');
  return mega ? `Mega ${names.species(species.baseSpecies)}${mega[1] ? ` ${mega[1]}` : ''}` : full;
}

export function createMegaTera({ view, warn, ledger, dex, lang = DEFAULT_LANG, affix = nameWithAffix(lang) }) {
  const nameOf = ident => affix(ledger.get(ident).name, positionOf(ident));
  const nv = ident => ({ pokemonName: nameOf(ident), pokemonNameWithAffix: nameOf(ident) });
  const say = (key, values) => view.message(effectText(key, values, lang), {});
  const typeName = type => typeNameIn(lang, type);

  const attackingZ = ({ args, kwArgs: kw = {} }) => !!kw.zeffect || (!!dex.moves.get(args[1]).isZ && dex.moves.get(args[1]).category !== 'Status');

  /** View call for one handled line (steps.js dispatch table) */
  async function present(event) {
    const { kind, args: a } = event;
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

    case '-zpower': {
      const side = positionOf(a[0]), move = event.zMove; // the Z-Move this powers up (order.js linkZPower)
      const cut = move && ledger.onField(a[0]) && attackingZ(move) ? view.zCutIn?.(side, dex.toID(move.kwArgs?.anim ?? move.args[1])) : null;
      await Promise.all([cut, say('own.zPower', nv(a[0]))]);
      return;
    }
    case '-zbroken': await say('own.zBroken', nv(a[0])); return;
    }
  }

  const dynamax = {
    async start({ args: a }) {
      if (!ledger.onField(a[0])) { warn(`-start:dynamax:${a[0]}`); return; }
      const entry = ledger.get(a[0]), gmax = a[2] === 'Gmax';
      const form = gmax && dex ? gmaxForm(dex, dex.species.get(entry.speciesId)) : null;
      await view.dynamax?.(positionOf(a[0]), { gmax, ...(form ? { form } : {}) });
    },
    async end({ args: a }) {
      if (ledger.onField(a[0])) await view.undynamax?.(positionOf(a[0]), {});
    },
  };
  return { present, dynamax };
}
