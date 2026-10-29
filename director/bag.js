import { installBag, checkBagItem, chooseBagItem, BAG_ITEMS, isBall } from '../engine/bag.mjs';
import { BALLS } from '../engine/capture.mjs';
import catchRates from '../data/catch-rates.json' with { type: 'json' };
import phrases from './text-bag-ko.json' with { type: 'json' };
import { interpolate } from './text.js';
import { ownTemplate } from './own-text.js';
import { displayName } from '../engine/mon.mjs';

export function bagText(key, values = {}) {
  const template = ownTemplate(key) ?? (key !== '_source' && Object.hasOwn(phrases, key) ? phrases[key] : undefined);
  if (template === undefined) throw new Error(`Unknown bag text key: ${key}`);
  return interpolate(template, values);
}

export const POCKETS = [

  { id: 'heal', name: '회복', items: ['potion', 'superpotion', 'hyperpotion', 'maxpotion', 'fullrestore', 'revive', 'maxrevive',
    'freshwater', 'sodapop', 'lemonade', 'moomoomilk', 'sweetheart', 'energypowder', 'energyroot', 'revivalherb', 'ether', 'maxether', 'elixir', 'maxelixir'] },
  { id: 'status', name: '상태', items: ['antidote', 'burnheal', 'iceheal', 'awakening', 'paralyzeheal', 'fullheal', 'healpowder',
    'lavacookie', 'oldgateau', 'casteliacone', 'lumiosegalette', 'shaloursable', 'ragecandybar', 'bigmalasada', 'pewtercrunchies'] },
  { id: 'battle', name: '배틀', items: ['xattack', 'xdefense', 'xspatk', 'xspdef', 'xspeed', 'xaccuracy', 'direhit'] },
  { id: 'ball', name: '볼', items: Object.keys(BALLS) },
];

export const pokemonName = (names, pokemon) => displayName(pokemon.battle.dex, names, pokemon.species.name, pokemon.name);

export function createBag({ sim, battle, names, spec, wild }) {
  if (!spec) return null;
  const { items = {}, ...options } = spec;
  const counts = new Map();
  for (const [id, count] of Object.entries(items)) {
    if (!BAG_ITEMS[id] && !isBall(id)) throw new Error(`가방에 넣을 수 없는 도구: ${id}`);
    if (!Number.isInteger(count) || count < 0) throw new Error(`도구 개수는 0 이상 정수: ${id}=${count}`);
    counts.set(id, count);
  }
  installBag(sim, battle, { catchRates, ...options, wild });
  const side = battle.sides[0];
  const reason = (check, pokemon) => {
    if (check.ok) return {};
    switch (check.reason) {
    case 'notfainted': return { blocked: bagText('party-ui-handler.hasEnergy', { pokemonName: pokemonName(names, pokemon) }) };
    case 'semiinvulnerable': return { blocked: bagText('own.ballNoTarget') };
    case 'norate': case 'nofoe': return { blocked: bagText('battle.noPokeballForce') };

    default: return { blocked: bagText('party-ui-handler.anyEffect') };
    }
  };

  const targetKind = id => isBall(id) ? 'enemy' : BAG_ITEMS[id].boost || BAG_ITEMS[id].crit ? 'active' : 'party';
  function itemView(id) {
    const base = { id, name: names.item(id), count: counts.get(id), target: targetKind(id) };
    if (base.target === 'enemy') return { ...base, ...reason(checkBagItem(battle, { item: id })) };
    const active = side.active[0];
    if (base.target === 'active') return { ...base, ...reason(checkBagItem(battle, { item: id, target: active.m.uid }), active) };

    const slots = side.pokemon.map(pokemon => {
      const target = pokemon.m.uid;
      if (!BAG_ITEMS[id].oneMove) return reason(checkBagItem(battle, { item: id, target }), pokemon);

      return { moves: pokemon.moveSlots.map(slot => ({ name: names.move(slot.id), pp: slot.pp, maxpp: slot.maxpp,
        ...reason(checkBagItem(battle, { item: id, target, move: slot.id }), pokemon) })) };
    });
    return { ...base, slots };
  }
  return {
    counts,

    menu() {

      const probe = checkBagItem(battle, { item: 'potion', target: side.active[0]?.m.uid });
      const locked = !probe.ok && ['ended', 'notyourturn', 'locked'].includes(probe.reason);
      return {
        pockets: POCKETS.map(pocket => ({ id: pocket.id, name: pocket.name,
          items: pocket.items.filter(id => counts.get(id) > 0).map(itemView) })),
        ...(locked ? { blocked: bagText('own.bagLocked') } : {}),
      };
    },

    choice(choice) {
      const id = choice.item;
      if (!(counts.get(id) > 0)) throw new Error('Invalid player choice');
      const pick = { item: id, target: null, move: null };
      const kind = targetKind(id);
      if (kind === 'active') pick.target = side.active[0]?.m.uid;
      else if (kind === 'party') {
        const pokemon = side.pokemon[choice.slot];
        if (!Number.isInteger(choice.slot) || !pokemon) throw new Error('Invalid player choice');
        pick.target = pokemon.m.uid;
        if (BAG_ITEMS[id].oneMove) {
          const slot = pokemon.moveSlots[choice.move];
          if (!Number.isInteger(choice.move) || !slot) throw new Error('Invalid player choice');
          pick.move = slot.id;
        }
      }
      if (!checkBagItem(battle, pick).ok) throw new Error('Invalid player choice');
      return { bag: pick };
    },
    owns: choice => typeof choice === 'object' && !!choice?.bag,
    commit: choice => chooseBagItem(battle, choice.bag).ok,

    spend(id) { if (counts.get(id) > 0) counts.set(id, counts.get(id) - 1); },
    left: () => Object.fromEntries(counts),
  };
}
