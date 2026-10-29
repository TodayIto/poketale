import { monView } from './mon.js';
import { parseHealth } from './parse.js';
import { sideOf, isIdent, identName, uidOf } from './read.js';
import { pokemonName } from './bag.js';
import { toID } from '../engine/mon.mjs';

const BOOSTS = ['atk', 'def', 'spa', 'spd', 'spe', 'accuracy', 'evasion'];

const VIEW_KEYS = ['speciesId', 'spriteId', 'name', 'level', 'gender', 'shiny', 'hp', 'maxhp', 'status', 'tera'];

const SEMI_INVULNERABLE = new Set(['fly', 'bounce', 'dig', 'dive', 'phantomforce', 'shadowforce', 'skydrop']);

export function createLedger({ battle, names }) {
  const pokemon = new Map();
  const field = { player: null, enemy: null };

  for (const [i, side] of ['player', 'enemy'].entries()) {
    for (const p of battle.sides[i]?.pokemon ?? []) {
      pokemon.set(p.m.uid, { uid: p.m.uid, side, speciesId: p.species.id, spriteId: p.species.spriteid, name: pokemonName(names, p),
        level: p.level, gender: p.gender || '', shiny: !!p.set.shiny, hp: p.hp, maxhp: p.maxhp, status: p.fainted ? '' : p.status || '',
        ball: p.pokeball, boosts: {}, substitute: false, semiInvulnerable: null, disabled: null, fainted: !!p.fainted });
    }
  }
  let current = null;

  const blank = (uid, side, name) => ({ uid, side, name, boosts: {}, substitute: false, semiInvulnerable: null, disabled: null, fainted: false });

  function get(ident) {
    const uid = uidOf(current, ident);
    if (!pokemon.has(uid)) pokemon.set(uid, blank(uid, sideOf(ident), identName(ident)));
    return pokemon.get(uid);
  }
  const atField = side => (field[side] === null ? null : pokemon.get(field[side]));
  const copy = entry => entry && { ...entry, boosts: { ...entry.boosts } };
  const setBoost = (entry, stat, value) => {
    if (value) entry.boosts[stat] = Math.max(-6, Math.min(6, value)); else delete entry.boosts[stat];
  };
  const setHealth = (entry, value) => {
    const health = parseHealth(value, entry.maxhp);
    Object.assign(entry, health);
    if (health.hp > 0) entry.fainted = false;
  };
  function setView(entry, mon) {
    for (const key of VIEW_KEYS) delete entry[key];
    for (const key of VIEW_KEYS) if (mon[key] !== undefined) entry[key] = mon[key];
  }

  function semiInvulnerable(event, entry) {
    const { kind, args: a } = event;
    if (kind === '-prepare' && SEMI_INVULNERABLE.has(toID(a[1])) && event.move?.kwArgs.still) {
      entry.semiInvulnerable = toID(a[1]);
      if (toID(a[1]) === 'skydrop' && isIdent(a[2])) get(a[2]).semiInvulnerable = 'skydrop';
    }
    const acts = kind === 'move' || kind === 'cant' || (kind === '-activate' && /^confusion$/i.test(a[1] ?? ''));
    const falls = (kind === '-start' && /smack down/i.test(a[1] ?? '')) || (kind === '-activate' && /^move: gravity$/i.test(a[1] ?? ''))
      || (kind === '-end' && /sky drop/i.test(a[1] ?? ''));
    if (acts || falls || kind === 'faint') entry.semiInvulnerable = null;
  }

  function observe(event) {
    current = event;
    const { kind, args: a } = event;
    const entry = isIdent(a[0]) ? get(a[0]) : null;
    const before = copy(entry);
    const result = { ...event, before };
    switch (kind) {
    case 'switch': case 'drag': {
      const side = entry.side, previous = atField(side);
      result.previous = copy(previous);

      const passed = previous && previous !== entry && ['copyvolatile', 'shedtail'].includes(event.cause) ? copy(previous) : null;
      if (previous && previous !== entry) Object.assign(previous, { boosts: {}, substitute: false, semiInvulnerable: null, disabled: null });
      setView(entry, monView(battle, names, a[0], a[1], a[2], entry.maxhp));
      entry.boosts = passed && event.cause === 'copyvolatile' ? passed.boosts : {};
      entry.substitute = !!passed?.substitute;
      entry.semiInvulnerable = null;
      entry.fainted = false;
      field[side] = entry.uid;
      break;
    }
    case 'replace': {

      const health = a[2] ?? `${entry.hp}/${entry.maxhp}${entry.status ? ` ${entry.status}` : ''}`;
      Object.assign(entry, monView(battle, names, a[0], a[1], health, entry.maxhp));
      break;
    }
    case '-damage': case '-heal': case '-sethp': setHealth(entry, a[1]); break;
    case '-status': entry.status = a[1]; break;
    case '-curestatus': entry.status = ''; break;
    case 'faint': entry.fainted = true; entry.substitute = false; break;
    case '-boost': case '-unboost': {
      const delta = Number(a[2]) * (kind === '-boost' ? 1 : -1);
      setBoost(entry, a[1], (entry.boosts[a[1]] || 0) + delta);
      break;
    }
    case '-setboost': setBoost(entry, a[1], Number(a[2])); break;
    case '-clearboost': entry.boosts = {}; break;
    case '-clearallboost': for (const side of ['player', 'enemy']) if (atField(side)) atField(side).boosts = {}; break;
    case '-clearnegativeboost': for (const stat of BOOSTS) if (entry.boosts[stat] < 0) delete entry.boosts[stat]; break;
    case '-clearpositiveboost': for (const stat of BOOSTS) if (entry.boosts[stat] > 0) delete entry.boosts[stat]; break;
    case '-invertboost': for (const stat of BOOSTS) if (entry.boosts[stat]) entry.boosts[stat] = -entry.boosts[stat]; break;
    case '-copyboost': entry.boosts = { ...get(a[1]).boosts }; break;
    case '-swapboost': {
      const target = get(a[1]), list = a[2] ? a[2].split(/,\s*/).filter(Boolean) : BOOSTS;
      const [mine, theirs] = [{ ...entry.boosts }, { ...target.boosts }];
      for (const stat of list) { setBoost(entry, stat, theirs[stat]); setBoost(target, stat, mine[stat]); }
      break;
    }
    case '-transform': {
      const target = get(a[1]);
      Object.assign(entry, { speciesId: target.speciesId, spriteId: target.spriteId });
      entry.boosts = { ...target.boosts };
      break;
    }
    case '-formechange': case 'detailschange': {
      const details = kind === 'detailschange' ? a[1] : '';
      const species = battle.dex.species.get(details ? details.split(', ')[0] : a[1]);
      if (!species?.exists) break;
      const parts = details.split(', ');
      Object.assign(entry, { speciesId: species.id, spriteId: species.spriteid,
        shiny: details ? parts.includes('shiny') : entry.shiny,
        gender: details ? (parts.includes('M') ? 'M' : parts.includes('F') ? 'F' : '') : entry.gender });
      break;
    }
    case '-start':
      if (/substitute/i.test(a[1] ?? '')) entry.substitute = true;
      if (/^(move: )?disable$/i.test(a[1] ?? '')) entry.disabled = a[2];
      break;
    case '-end':
      if (/substitute/i.test(a[1] ?? '')) entry.substitute = false;
      if (/^(move: )?disable$/i.test(a[1] ?? '')) entry.disabled = null;
      break;
    case '-terastallize': entry.tera = a[1]; break;
    case '-story-levelup': {
      const stats = JSON.parse(a[3]);
      Object.assign(entry, { level: Number(a[2]), hp: stats.hp, maxhp: stats.maxhp });
      break;
    }
    }
    if (entry) semiInvulnerable(event, entry);
    return result;
  }

  return {
    pokemon, field, observe,

    get,

    atField,

    onField: ident => isIdent(ident) && field[sideOf(ident)] === get(ident).uid,

    // Ledger -> view MonView
    view: entry => Object.fromEntries(VIEW_KEYS.filter(key => entry[key] !== undefined).map(key => [key, entry[key]])),
  };
}
