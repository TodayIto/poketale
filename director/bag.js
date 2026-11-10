import { installBag, checkBagItem, chooseBagItem, chooseBagParts, BAG_ITEMS, isBall, bagItem } from '../engine/bag.mjs';
import { BALLS } from '../engine/capture.mjs';
import catchRates from '../data/catch-rates.json' with { type: 'json' };
import ko from './text-bag-ko.json' with { type: 'json' };
import en from './text-bag-en.json' with { type: 'json' };
import { phrase } from './text.js';
import { displayName } from '../engine/mon.mjs';
import { DEFAULT_LANG } from './lang.js';

const PHRASES = { ko, en };
export const bagText = (key, values = {}, lang = DEFAULT_LANG) => phrase(PHRASES, key, values, lang, 'bag text');

export const POCKETS = [

  { id: 'heal', items: ['potion', 'superpotion', 'hyperpotion', 'maxpotion', 'fullrestore', 'revive', 'maxrevive',
    'freshwater', 'sodapop', 'lemonade', 'moomoomilk', 'sweetheart', 'energypowder', 'energyroot', 'revivalherb', 'ether', 'maxether', 'elixir', 'maxelixir'] },
  { id: 'status', items: ['antidote', 'burnheal', 'iceheal', 'awakening', 'paralyzeheal', 'fullheal', 'healpowder',
    'lavacookie', 'oldgateau', 'casteliacone', 'lumiosegalette', 'shaloursable', 'ragecandybar', 'bigmalasada', 'pewtercrunchies'] },
  { id: 'battle', items: ['xattack', 'xdefense', 'xspatk', 'xspdef', 'xspeed', 'xaccuracy', 'direhit'] },
  { id: 'ball', items: Object.keys(BALLS) },
  { id: 'food', items: [] },
];

export const pokemonName = (names, pokemon) => displayName(pokemon.battle.dex, names, pokemon.species.name, pokemon.name);

export function createBag({ sim, battle, names, spec, wild, lang = DEFAULT_LANG }) {
  if (!spec) return null;
  const { items = {}, ...options } = spec;
  const foods = options.foods ?? {};
  const counts = new Map();
  for (const [id, count] of Object.entries(items)) {
    if (!BAG_ITEMS[id] && !isBall(id) && !Object.hasOwn(foods, id)) throw new Error(`가방에 넣을 수 없는 도구: ${id}`);
    if (!Number.isInteger(count) || count < 0) throw new Error(`도구 개수는 0 이상 정수: ${id}=${count}`);
    counts.set(id, count);
  }
  installBag(sim, battle, { catchRates, ...options, wild });
  const side = battle.sides[0];
  const foodIds = [...counts.keys()].filter(id => Object.hasOwn(foods, id));
  const pocketItems = pocket => (pocket.id === 'food' ? foodIds : pocket.items);

  const foodBySource = new Map(foodIds.map(id => [`item: ${bagItem(battle, id).name}`, id]));
  const itemName = id => (Object.hasOwn(foods, id) ? foods[id].name : names.item(id));
  const reason = (check, pokemon) => {
    if (check.ok) return {};
    switch (check.reason) {
    case 'notfainted': return { blocked: bagText('party-ui-handler.hasEnergy', { pokemonName: pokemonName(names, pokemon) }, lang) };
    case 'semiinvulnerable': return { blocked: bagText('own.ballNoTarget', {}, lang) };
    case 'norate': case 'nofoe': return { blocked: bagText('battle.noPokeballForce', {}, lang) };

    case 'twofoes': return { blocked: bagText('battle.noPokeballMulti', {}, lang) };

    default: return { blocked: bagText('party-ui-handler.anyEffect', {}, lang) };
    }
  };

  const targetKind = id => isBall(id) ? 'enemy' : bagItem(battle, id).boost || bagItem(battle, id).crit ? 'active' : 'party';

  const left = (id, taken) => counts.get(id) - (taken?.get(id) ?? 0);
  function itemView(id, position, taken) {
    const base = { id, name: itemName(id), count: left(id, taken), target: targetKind(id), ...(Object.hasOwn(foods, id) ? { emoji: foods[id].emoji } : {}) };
    if (base.target === 'enemy') return { ...base, ...reason(checkBagItem(battle, { item: id, position })) };
    const active = side.active[position];
    if (base.target === 'active') return { ...base, ...reason(checkBagItem(battle, { item: id, target: active.m.uid, position }), active) };

    const slots = side.pokemon.map(pokemon => {
      const target = pokemon.m.uid;
      if (!bagItem(battle, id).oneMove) return reason(checkBagItem(battle, { item: id, target, position }), pokemon);

      return { moves: pokemon.moveSlots.map(slot => ({ name: names.move(slot.id), pp: slot.pp, maxpp: slot.maxpp,
        ...reason(checkBagItem(battle, { item: id, target, move: slot.id, position }), pokemon) })) };
    });
    return { ...base, slots };
  }
  return {
    counts,

    menu(position = 0, taken = null) {

      const probe = checkBagItem(battle, { item: 'potion', target: side.active[position]?.m.uid, position });
      const locked = !probe.ok && ['ended', 'notyourturn', 'locked'].includes(probe.reason);
      return {
        pockets: POCKETS.map(pocket => ({ id: pocket.id, name: bagText(`own.pocket.${pocket.id}`, {}, lang),
          items: pocketItems(pocket).filter(id => left(id, taken) > 0).map(id => itemView(id, position, taken)) })),
        ...(locked ? { blocked: bagText('own.bagLocked', {}, lang) } : {}),
      };
    },

    choice(choice, position = 0, taken = null) {
      const id = choice.item;
      if (!(left(id, taken) > 0)) throw new Error('Invalid player choice');

      const pick = { item: id, target: null, move: null, ...(position && !isBall(id) ? { position } : {}) };
      const kind = targetKind(id);
      if (kind === 'active') pick.target = side.active[position]?.m.uid;
      else if (kind === 'party') {
        const pokemon = side.pokemon[choice.slot];
        if (!Number.isInteger(choice.slot) || !pokemon) throw new Error('Invalid player choice');
        pick.target = pokemon.m.uid;
        if (bagItem(battle, id).oneMove) {
          const slot = pokemon.moveSlots[choice.move];
          if (!Number.isInteger(choice.move) || !slot) throw new Error('Invalid player choice');
          pick.move = slot.id;
        }
      }
      if (!checkBagItem(battle, pick).ok) throw new Error('Invalid player choice');
      return { bag: pick };
    },

    owns: choice => typeof choice === 'object' && (!!choice?.bag || Array.isArray(choice?.parts)),
    commit: choice => (choice.bag ? chooseBagItem(battle, choice.bag)
      : chooseBagParts(battle, choice.parts.map(part => (typeof part === 'string' ? part : part.bag)))).ok,

    spend(id) { if (counts.get(id) > 0) counts.set(id, counts.get(id) - 1); },

    itemName,

    foodOf: from => foodBySource.get(String(from)),
    left: () => Object.fromEntries(counts),
  };
}
