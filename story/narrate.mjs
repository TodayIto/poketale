import { toID } from '../engine/mon.mjs';
import { nicknamed } from './ai-names.mjs';
import { TOOL_TURNS } from './tools.mjs';

const USER = '{{user}}';

const SIDE = { p1: 'mine', p2: 'theirs', p3: 'mine', p4: 'theirs' };
const IDENT = /^p\d[a-z]?:/;

export function readLog(log, { from = 0, to = log?.length ?? 0, dex = null } = {}) {
  const at = new Map();
  const met = [];
  const sent = new Set();
  const turns = [{ turn: 0, events: [] }];
  const summary = { sent: [], gimmicks: [], fainted: [], winner: null, caught: null, ran: false, turns: 0 };
  const players = { mine: null, theirs: null };
  let split = 0;
  let recent = null, recentLive = false;
  let weather = null;
  let changed = null;
  let zpower = null;
  let resized = null;
  let recentUser = null;
  const lastMoveBy = new Map();
  const teraOf = new Map();
  let hint = -1, stellar = false, shell = null;
  let hits = [];
  const lines = log ?? [];
  const end = Math.min(to, lines.length);
  const illusion = new Set(lines.filter(l => l.startsWith('|replace|')).map(l => SIDE[/^(p\d)/.exec(l.split('|')[2] ?? '')?.[1]]).filter(Boolean));
  const identOf = ident => /^(p\d)([a-z]?):\s*(.*)$/.exec(ident).slice(1);
  const meet = (player, name) => {
    const mon = { player, side: SIDE[player], ident: name, species: name, seat: null, hp: null, maxhp: null };
    met.push(mon);
    return mon;
  };
  const named = (player, name, more = () => true) => met.findLast(m => m.player === player && m.ident === name && more(m));
  const who = ident => {
    const [player, letter, name] = identOf(ident);
    return (letter && at.get(player + letter)) || named(player, name) || meet(player, name);
  };
  const ref = mon => ({ species: mon.species, nick: nickOf(mon), side: mon.side, seat: mon.seat });
  const setHp = (mon, text) => {
    const [hp, maxhp] = String(text).split(' ')[0].split('/').map(Number);
    const before = mon.maxhp ? mon.hp / mon.maxhp : null;
    if (Number.isFinite(hp)) mon.hp = hp;
    if (Number.isFinite(maxhp)) mon.maxhp = maxhp;
    if (String(text).startsWith('0')) mon.hp = 0;
    return before;
  };
  const pct = mon => (mon.maxhp ? Math.round(mon.hp / mon.maxhp * 100) : 0);

  const seen = ident => {
    if (!/^p\d[a-z]?:/.test(ident)) return null;
    const [player, letter, name] = identOf(ident);
    return (letter && at.get(player + letter)) || named(player, name) || null;
  };
  const types = typeWatch(dex, seen, () => [...at.values()]);

  const guardOf = mon => {
    if (!mon) return null;
    if (mon.known) return { state: 'real' };
    const field = new Set(at.values());
    const accounted = met.filter(m => m !== mon && m.side === mon.side && ILLUSION_SPECIES.has(toID(m.species)) && (m.hp === 0 || field.has(m))).length;
    const guard = { state: 'maybe', side: mon.side, species: mon.species, accounted };
    (mon.guards ??= []).push(guard);
    return guard;
  };

  const reasonOf = (cmd, args, i) => {
    const target = args[0] ? seen(args[0]) : null;
    if (cmd === '-immune' && hint === i - 1) return { from: { kind: 'abilities', name: 'Prankster' } };
    if (cmd === '-resisted' && target && shell === target) return { from: { kind: 'abilities', name: 'Tera Shell' } };
    if (cmd === '-supereffective' && stellar && target && teraOf.has(target)) return { note: 'Terastallized' };
    const { real, ...found } = causeOf(cmd, args, types);
    if (real) found.guard = guardOf(target);
    return found.skin ? { ...found, skin: { ...found.skin, user: ref(found.skin.user), guard: guardOf(found.skin.user) } } : found;
  };

  for (let i = 0; i < end; i++) {
    const line = lines[i];
    if (split === 1) { split = 0; continue; }
    if (split === 2) split = 1;
    const [, cmd, ...args] = line.split('|');
    if (cmd === 'split') { split = 2; continue; }
    const live = i >= from;

    const push = (event, mark = true) => {
      if (live) turns[turns.length - 1].events.push(event);
      if (mark) { recent = event; recentLive = live; }
    };

    const moveOf = () => {
      if (recent?.type !== 'move') return null;
      if (live && !recentLive) push({ ...recent, cont: true, effects: [] });
      return recent;
    };
    const silent = args.includes('[silent]');

    const onMove = (mon, effect) => {
      if (recent?.type !== 'move' || (mon && mon === recentUser)) return false;
      moveOf().effects.push(effect);
      return true;
    };
    const absorbed = (mon, ability) => onMove(mon, { kind: 'tag', tag: 'absorbed', mon: null, byMon: ref(mon), by: { kind: 'abilities', name: ability } });

    const gimmick = event => {
      push(event, false);
      if (live && !event.ended) summary.gimmicks.push(event);
    };
    switch (cmd) {
    case 'player': if (SIDE[args[0]] && args[1]) players[SIDE[args[0]]] = args[1]; break;
    case 'turn': turns.push({ turn: Number(args[0]), events: [] }); summary.turns = Number(args[0]); recent = null; zpower = null; lastMoveBy.clear(); break;
    case 'switch': case 'drag': {
      const [player, letter, name] = identOf(args[0]);
      const field = new Set(at.values());
      const mon = named(player, name, m => !field.has(m) && m.hp !== 0) ?? meet(player, name);
      met.splice(met.indexOf(mon), 1);
      met.push(mon);
      mon.species = args[1].split(',')[0];
      mon.seat = player + letter;
      Object.assign(mon, { known: false, guards: [] });
      at.set(mon.seat, mon);
      setHp(mon, args[2]);
      if (live && !sent.has(mon)) { sent.add(mon); summary.sent.push(ref(mon)); }
      push({ type: 'switch', mon: ref(mon), hp: pct(mon) });
      break;
    }
    case 'swap': {

      const [player, letter] = identOf(args[0]);
      const was = player + letter, to = player + 'abc'[Number(args[1])];
      const [mover, other] = [at.get(was), at.get(to)];
      at.set(to, mover);
      if (other) at.set(was, other); else at.delete(was);
      break;
    }
    case 'replace': {

      const mon = who(args[0]);
      const was = ref(mon);
      mon.ident = identOf(args[0])[2];
      mon.species = args[1].split(',')[0];
      for (const guard of mon.guards ?? []) guard.state = 'disguised';
      Object.assign(mon, { known: true, guards: [] });

      if (recent?.type !== 'move' || recentUser === mon || !hits.some(h => h.mon === mon && h.effect.kind === 'hp')) break;
      types.line(cmd, args);
      for (const h of hits.filter(one => one.mon === mon)) {
        h.effect.mon = ref(mon);
        if (h.effect.kind !== 'tag') continue;
        for (const k of ['types', 'from', 'note', 'skin', 'guard']) delete h.effect[k];
        Object.assign(h.effect, reasonOf(h.cmd, h.args, h.i));
      }
      (recent.reveal ??= []).push({ was, mon: ref(mon) });
      break;
    }
    case 'move': {
      const mon = who(args[0]);
      const target = args[2] ? who(args[2]) : null;
      const z = zpower === mon;
      if (z) zpower = null;
      const event = { type: 'move', mon: ref(mon), move: args[1], target: target && target !== mon ? ref(target) : null, miss: args.includes('[miss]'), ...(z ? { z } : {}), effects: [] };
      push(event);
      recentUser = mon;
      hits = [];
      lastMoveBy.set(mon, args[1]);
      stellar = args.includes('[anim] Tera Blast Stellar');
      shell = null;
      if (z && live) summary.gimmicks.push(event);
      break;
    }

    case 'detailschange': changed = { at: i, mon: who(args[0]), species: args[1].split(',')[0] }; break;
    case '-mega': case '-primal': case '-burst': {
      const mon = who(args[0]);
      const into = changed?.at === i - 1 && changed.mon === mon ? changed.species : null;
      gimmick({ type: cmd.slice(1), mon: ref(mon), ...(cmd === '-primal' ? {} : { into }) });
      break;
    }
    case '-zpower': zpower = who(args[0]); break;
    case '-terastallize': teraOf.set(who(args[0]), args[1]); gimmick({ type: 'tera', mon: ref(who(args[0])), tera: args[1] }); break;
    case '-start': case '-end': {

      if (cmd === '-start' && args[1] === 'ability: Flash Fire') { absorbed(who(args[0]), 'Flash Fire'); break; }
      if (args[1] !== 'Dynamax') break;
      const mon = who(args[0]);
      resized = { mon, at: i };
      gimmick(cmd === '-start' ? { type: 'dynamax', mon: ref(mon), gmax: args[2] === 'Gmax' } : { type: 'dynamax', mon: ref(mon), ended: true });
      break;
    }
    case '-damage': case '-heal': {
      const mon = who(args[0]);
      if (silent && resized?.mon === mon && i - resized.at <= 2) { setHp(mon, args[1]); break; }
      const before = setHp(mon, args[1]);
      const from = fromOf(args);
      const delta = before === null ? 0 : Math.round(mon.hp / mon.maxhp * 100 - before * 100);
      const prev = from ? null : moveOf();
      const entry = { mon: ref(mon), delta, before: before === null ? null : Math.round(before * 100), hp: pct(mon), from };
      if (prev) {
        const effect = { kind: 'hp', ...entry };
        prev.effects.push(effect);
        hits.push({ effect, mon });
      }
      else push({ type: cmd === '-damage' ? 'damage' : 'heal', ...entry });
      break;
    }
    case '-supereffective': case '-resisted': case '-crit': case '-immune': case '-miss': {
      const prev = moveOf();
      const tag = { '-supereffective': 'super effective', '-resisted': 'not very effective', '-crit': 'critical hit', '-immune': 'no effect', '-miss': 'missed' }[cmd];
      if (!prev) break;
      const mon = args[0] ? who(args[0]) : null;
      const effect = { kind: 'tag', tag, mon: mon ? ref(mon) : null, ...reasonOf(cmd, args, i) };
      prev.effects.push(effect);
      if (mon) hits.push({ effect, mon, cmd, args, i });
      break;
    }
    case '-hint': if (/Dark is immune to Prankster/.test(args[0] ?? '')) hint = i; break;
    case '-activate': {
      if (!/^p\d/.test(args[0] ?? '')) break;
      const mon = who(args[0]);

      const guard = lastMoveBy.get(mon);
      if (args[1] === 'move: Protect' && guard && PROTECTS.has(toID(guard))) onMove(mon, { kind: 'tag', tag: 'blocked', mon: null, by: { kind: 'moves', name: guard } });
      else if (args[1] === 'item: Safety Goggles') onMove(mon, { kind: 'tag', tag: 'no effect', mon: ref(mon), from: { kind: 'items', name: 'Safety Goggles' } });
      else if (args[1] === 'ability: Tera Shell') shell = mon;
      break;
    }

    case 'cant': {
      const ability = /^ability:\s*(.+)$/.exec(args[1] ?? '')?.[1];
      const of = tagArg(args, 'of');
      if (ability && of && recent?.type === 'move' && recent.move === args[2] && seen(of) === recentUser) {
        const blocker = who(args[0]);
        onMove(blocker, { kind: 'tag', tag: 'blocked', mon: null, byMon: ref(blocker), by: { kind: 'abilities', name: ability } });
      }
      break;
    }

    case '-fail': {
      const from = fromOf(args);
      if (from && !from.kind && WEATHER_FAIL.has(from.name) && /^p\d/.test(args[0] ?? '') && seen(args[0]) === recentUser) {
        onMove(null, { kind: 'tag', tag: 'no effect', mon: null, from: { kind: 'abilities', name: from.name } });
      }
      break;
    }
    case '-status': push({ type: 'status', mon: ref(who(args[0])), status: args[1] }); break;
    case 'faint': {
      const mon = who(args[0]);
      if (live) summary.fainted.push(ref(mon));
      push({ type: 'faint', mon: ref(mon) });
      break;
    }
    case '-story-ball': {
      const mon = who(args[0]);
      push({ type: 'ball', mon: ref(mon), ball: args[2], result: args[4] });
      if (live && args[4] === 'caught') summary.caught = { mon: ref(mon), ball: args[2] };
      break;
    }

    case '-story-item': push({ type: 'item', mon: ref(who(args[0])), item: args[2], ...(args[3] && args[3] !== '[fail]' ? { label: args[3] } : {}), ...(args.includes('[fail]') ? { failed: true } : {}) }); break;

    case '-story-tool': {
      const trainer = tagArg(args, 'trainer') ?? null;
      push({ type: 'tool', mon: ref(who(args[0])), item: args[2], label: args[3], tag: args[4], trainer, failed: args.includes('[fail]'), boosts: [] });
      break;
    }
    case '-boost': case '-unboost': {
      const mon = seen(args[0]);
      if (recent?.type === 'tool' && recent.tag === 'cheer' && mon && mon.seat === recent.mon.seat) {
        recent.boosts.push({ stat: args[1], amount: Number(args[2]) * (cmd === '-boost' ? 1 : -1) });
      }
      break;
    }
    case '-story-run': if (live && args[2] === 'escaped') summary.ran = true; push({ type: 'run', result: args[2] }); break;
    case '-story-levelup': push({ type: 'levelup', mon: ref(who(args[0])), level: Number(args[2]) }); break;
    case 'win': if (live) summary.winner = args[0]; break;

    case '-ability':
      if (silent) break;

      if (args[2] === 'boost' && ABSORB.has(toID(args[1])) && absorbed(who(args[0]), args[1])) break;
      push({ type: 'ability', mon: ref(who(args[0])), ability: args[1], from: fromOf(args) }, false);
      break;
    case '-item': {
      if (silent) break;
      // Generations 4-5 Frisk names the item but not the foe holding it
      const holder = IDENT.test(args[0] ?? '') ? args[0] : null, finder = tagArg(args, 'of');
      if (holder) push({ type: 'helditem', mon: ref(who(holder)), item: args[1], from: fromOf(args) }, false);
      else if (finder && IDENT.test(finder)) push({ type: 'helditem', mon: ref(who(finder)), item: args[1], from: fromOf(args), foe: true }, false);
      break;
    }
    case '-enditem': {
      if (silent) break;
      const from = fromOf(args);
      const how = args.includes('[eat]') ? 'eat' : !from || from.name === 'gem' ? 'used' : 'lost';
      push({ type: 'enditem', mon: ref(who(args[0])), item: args[1], how, from: how === 'lost' && from.kind === 'moves' ? from : null }, false);
      break;
    }
    case '-weather': {

      if (args.includes('[upkeep]')) break;
      const now = args[0] === 'none' ? null : args[0];
      if (now === weather) break;
      const of = tagArg(args, 'of');
      push(now ? { type: 'weather', weather: now, from: fromOf(args), of: of ? ref(who(of)) : null } : { type: 'weather', weather: null, ended: weather }, false);
      weather = now;
      break;
    }
    case '-fieldstart': case '-fieldend': {
      if (silent) break;
      const name = String(args[0] ?? '').replace(/^move:\s*/, '');
      if (name) push({ type: 'field', field: name, ended: cmd === '-fieldend' }, false);
      break;
    }
    default: break;
    }
    types.line(cmd, args);
  }

  const later = new Map(at);
  for (let i = end; i < lines.length; i++) {
    const [, cmd, ...args] = lines[i].split('|');
    if (!/^p\d[a-z]:/.test(args[0] ?? '')) continue;
    const [player, letter] = identOf(args[0]);
    if (cmd === 'switch' || cmd === 'drag') later.set(player + letter, null);
    else if (cmd === 'swap') {
      const to = player + 'abc'[Number(args[1])], mover = later.get(player + letter);
      later.set(player + letter, later.get(to) ?? null);
      later.set(to, mover ?? null);
    } else if (cmd === 'replace') for (const guard of later.get(player + letter)?.guards ?? []) guard.state = 'disguised';
  }
  return { turns: turns.filter(t => t.events.length), summary, players, illusion: [...illusion] };
}

function causeOf(cmd, args, types) {
  if (cmd === '-immune') {
    const from = fromOf(args);
    if (from) return from.kind === 'abilities' ? { from } : {};
  }
  if (!['-supereffective', '-resisted', '-immune'].includes(cmd) || !args[0]) return {};
  return types.cause(cmd, args[0]) ?? {};
}

const PROTECTS = new Set(['protect', 'detect', 'kingsshield', 'spikyshield', 'banefulbunker', 'obstruct', 'silktrap', 'burningbulwark']);
const ABSORB = new Set(['lightningrod', 'stormdrain', 'sapsipper', 'motordrive', 'wellbakedbody', 'windrider']);
const WEATHER_FAIL = new Set(['Primordial Sea', 'Desolate Land']);

const WEATHER_TYPE = { SunnyDay: 'Fire', DesolateLand: 'Fire', RainDance: 'Water', PrimordialSea: 'Water', Sandstorm: 'Rock', Hail: 'Ice', Snowscape: 'Ice' };
const TERRAIN_TYPE = { electricterrain: 'Electric', grassyterrain: 'Grass', mistyterrain: 'Fairy', psychicterrain: 'Psychic' };
const DRIVE_TYPE = { Douse: 'Water', Shock: 'Electric', Burn: 'Fire', Chill: 'Ice' };
const ATE = new Set(['pixilate', 'aerilate', 'refrigerate', 'galvanize']);

const SKINS = { pixilate: ['Pixilate', 'Fairy'], aerilate: ['Aerilate', 'Flying'], refrigerate: ['Refrigerate', 'Ice'], galvanize: ['Galvanize', 'Electric'],
  normalize: ['Normalize', 'Normal'], liquidvoice: ['Liquid Voice', 'Water'] };
const ATE_KEEP = new Set(['judgment', 'multiattack', 'naturalgift', 'revelationdance', 'technoblast', 'terrainpulse', 'weatherball']);
const NORMALIZE_KEEP = new Set([...ATE_KEEP, 'hiddenpower', 'struggle']);

const UMBRELLA_WEATHER = new Set(['SunnyDay', 'DesolateLand', 'RainDance', 'PrimordialSea']);

function typeWatch(dex, seen, field = () => []) {
  const none = { line() {}, cause: () => null };
  if (!dex) return none;

  const state = new WeakMap();
  let turn = 0, weather = null, terrain = null, deluge = -1, moveType = null, moveId = null, moveUser = null, gassed = false;
  const of = mon => {
    if (!state.has(mon)) state.set(mon, { species: null, types: null, added: '', tera: null, roost: -1, electrify: -1, calm: false, balloon: false, risen: new Set(),
      ability: null, changed: false, dynamax: false });
    return state.get(mon);
  };
  const lost = (mon, ability = '?') => { if (mon) Object.assign(of(mon), { ability, changed: true }); };
  const speciesOf = mon => dex.species.get(of(mon).species ?? mon.species);
  const mayHave = (mon, ids) => Object.values(speciesOf(mon).abilities ?? {}).some(name => ids.includes(toID(name)));
  const typesOf = mon => {
    const s = of(mon);
    if (s.tera && s.tera !== 'Stellar') return [s.tera];
    const species = speciesOf(mon);
    let list = s.types ?? (species.exists ? [...species.types] : null);
    if (!list) return null;
    if (s.added && !list.includes(s.added)) list = [...list, s.added];
    if (s.roost === turn) list = list.filter(t => t !== 'Flying');
    return list.length ? list : ['Normal'];
  };
  const CALM = ['cloudnine', 'airlock'];
  const calmField = () => field().some(mon => of(mon).calm);
  const airborne = mon => of(mon).balloon || of(mon).risen.size > 0 || !!typesOf(mon)?.includes('Flying') || mayHave(mon, ['levitate']);
  const typeOfMove = (user, name) => {
    const move = dex.moves.get(name);
    if (!user || !move.exists) return null;
    const s = of(user), species = speciesOf(user), forme = species.forme ?? '';
    let type = move.type;
    switch (move.id) {
    case 'terablast': if (s.tera) type = s.tera; break;
    case 'weatherball':
      if (UMBRELLA_WEATHER.has(weather) || (weather && calmField()) || mayHave(user, ['megasol'])) return null;
      type = WEATHER_TYPE[weather] ?? 'Normal'; break;
    case 'terrainpulse':
      if (terrain && airborne(user)) return null;
      type = TERRAIN_TYPE[toID(terrain)] ?? 'Normal'; break;
    case 'revelationdance': type = s.tera && s.tera !== 'Stellar' ? s.tera : typesOf(user)?.[0]; break;
    case 'judgment': case 'multiattack': type = species.types[0]; break;
    case 'ivycudgel': case 'ragingbull': type = species.types[1] ?? species.types[0]; break;
    case 'aurawheel': type = forme === 'Hangry' ? 'Dark' : 'Electric'; break;
    case 'technoblast': type = DRIVE_TYPE[forme] ?? 'Normal'; break;
    default: if (move.onModifyType) return null;
    }

    if (s.ability === '?') return null;
    const abilities = s.ability === null ? Object.values(species.abilities ?? {}).map(toID) : [s.ability].filter(Boolean);
    for (const id of abilities) {
      const ability = dex.abilities.get(id);
      if (!ability.onModifyType) continue;
      if (!ATE.has(id) || type === 'Normal') return null;
    }
    if (s.electrify === turn || (deluge === turn && type === 'Normal')) type = 'Electric';
    return !type || type === 'Stellar' || type === '???' ? null : type;
  };

  const gives = (cmd, type, list) => {
    if (cmd === '-immune') return list.some(t => !dex.getImmunity(type, t));
    if (list.some(t => !dex.getImmunity(type, t))) return false;
    const total = list.reduce((a, t) => a + dex.getEffectiveness(type, t), 0);
    return Math.sign(total) === (cmd === '-supereffective' ? 1 : -1);
  };

  const skinOf = (cmd, target) => {
    const move = dex.moves.get(moveId ?? '');
    if (!moveUser || !move.exists || move.onModifyType || move.isZ || of(moveUser).dynamax || of(moveUser).electrify === turn || deluge === turn) return null;
    if (move.id === 'terablast' && of(moveUser).tera) return null;
    const list = typesOf(target);
    const options = [];
    for (const [id, [ability, type]] of Object.entries(SKINS)) {
      const applies = id === 'liquidvoice' ? !!move.flags?.sound : id === 'normalize' ? !NORMALIZE_KEEP.has(move.id) : move.type === 'Normal' && !ATE_KEEP.has(move.id);
      if (!applies || move.type === type) continue;
      options.push({ ability, ok: !!list && gives(cmd, type, list) });
    }
    return options.length ? { user: moveUser, options, changed: of(moveUser).changed || gassed } : null;
  };

  const statusTypes = list => {
    const move = dex.moves.get(moveId ?? '');
    if (!move.exists || move.category !== 'Status') return [];
    if (move.id === 'leechseed') return list.filter(t => t === 'Grass');
    const kinds = [move.status, move.flags?.powder ? 'powder' : null].filter(Boolean);
    return list.filter(t => kinds.some(k => !dex.getImmunity(k, t)));
  };
  return {
    line(cmd, args) {
      const mon = seen(args[0] ?? '');
      switch (cmd) {
      case 'turn': turn = Number(args[0]); break;

      case 'switch': case 'drag': if (mon) Object.assign(of(mon), { calm: false, balloon: false, risen: new Set(), ability: null, dynamax: false });
      case 'replace':
        if (mon) Object.assign(of(mon), { species: null, types: null, added: '', roost: -1, electrify: -1 });
        if (mon && cmd === 'replace') of(mon).changed = true;
        break;
      case 'detailschange': case '-formechange': if (mon) Object.assign(of(mon), { species: args[1].split(',')[0], types: null, added: '', ability: null, changed: true }); break;
      case '-terastallize': if (mon) of(mon).tera = args[1]; break;
      case '-transform': {
        const into = seen(args[1]);
        if (mon && into) Object.assign(of(mon), { types: typesOf(into), added: '', calm: of(into).calm });
        lost(mon);
        break;
      }
      case '-start': {
        if (!mon) break;
        const value = args[2] && !args[2].startsWith('[') ? args[2] : null;
        if (args[1] === 'typechange') {
          const from = tagArg(args, 'of');
          const list = value ? value.split('/') : from && seen(from) ? typesOf(seen(from)) : null;
          if (list) Object.assign(of(mon), { types: list, added: '' });
        } else if (args[1] === 'typeadd' && value) of(mon).added = value;
        else if (/^(move: )?(Magnet Rise|Telekinesis)$/.test(args[1])) of(mon).risen.add(args[1].replace(/^move: /, ''));
        else if (args[1] === 'Dynamax') of(mon).dynamax = true;
        break;
      }
      case '-end':
        if (mon && args[1] === 'typechange') of(mon).types = null;
        if (mon && /^(move: )?(Magnet Rise|Telekinesis)$/.test(args[1])) of(mon).risen.delete(args[1].replace(/^move: /, ''));
        if (mon && args[1] === 'Dynamax') of(mon).dynamax = false;

        if (args[1] === 'ability: Neutralizing Gas') for (const one of field()) if (mayHave(one, CALM)) of(one).calm = true;
        break;
      case '-ability':
        if (mon && CALM.includes(toID(args[1]))) of(mon).calm = true;
        if (toID(args[1]) === 'neutralizinggas') gassed = true;

        if (mon) {
          of(mon).ability = toID(args[1]);
          if (args.some(a => a.startsWith('[from]'))) of(mon).changed = true;
        }
        break;
      case '-endability': if (mon) { of(mon).calm = false; lost(mon, ''); } break;
      case '-activate': {
        const other = seen(tagArg(args, 'of') ?? '');

        const swap = /^(move: )?Skill Swap$/.test(args[1] ?? '');
        if (mon && other && swap) [of(mon).calm, of(other).calm] = [of(other).calm, of(mon).calm];
        if (swap) { lost(mon); lost(other); }

        if (['ability: Mummy', 'ability: Lingering Aroma'].includes(args[1])) lost(seen(args[2] ?? ''), toID(args[1].replace(/^ability: /, '')));
        break;
      }
      case '-item': if (mon && args[1] === 'Air Balloon') of(mon).balloon = true; break;
      case '-enditem': if (mon && args[1] === 'Air Balloon') of(mon).balloon = false; break;
      case '-singleturn':
        if (mon && args[1] === 'move: Roost') of(mon).roost = turn;
        if (mon && args[1] === 'move: Electrify') of(mon).electrify = turn;
        break;
      case '-fieldactivate': if (args[0] === 'move: Ion Deluge') deluge = turn; break;
      case '-weather': weather = args[0] === 'none' ? null : args[0]; break;
      case '-fieldstart': case '-fieldend': {
        const name = String(args[0] ?? '').replace(/^move:\s*/, '');
        if (/Terrain$/.test(name)) terrain = cmd === '-fieldstart' ? name : null;
        break;
      }
      case 'move': moveType = typeOfMove(mon, args[1]); moveId = toID(args[1]); moveUser = mon; break;
      default: break;
      }
    },
    cause(cmd, ident) {
      const target = seen(ident);
      if (!target) return null;
      const skin = skinOf(cmd, target);
      const real = [target.side];
      const out = more => (more || skin ? { ...more, ...(skin ? { skin } : {}), real } : null);
      const list = moveType ? typesOf(target) : null;
      if (!list) return out(null);
      if (cmd === '-immune') {
        const chart = list.filter(t => !dex.getImmunity(moveType, t));
        if (chart.length) return out({ types: chart });
        const status = statusTypes(list);
        if (status.length) return out({ types: status });

        const up = moveType !== 'Ground' ? [] : [...(of(target).balloon ? [{ kind: 'items', name: 'Air Balloon' }] : []),
          ...[...of(target).risen].map(name => ({ kind: 'moves', name }))];
        return out(up.length === 1 ? { from: up[0] } : null);
      }

      const mods = list.map(t => dex.getEffectiveness(moveType, t) + (moveId === 'freezedry' && t === 'Water' ? 2 : 0)
        + (moveId === 'flyingpress' ? dex.getEffectiveness('Flying', t) : 0));
      const total = mods.reduce((a, b) => a + b, 0);
      const sign = cmd === '-supereffective' ? 1 : -1;
      if (Math.sign(total) !== sign) return out(null);
      return out({ types: list.filter((t, i) => Math.sign(mods[i]) === sign) });
    },
  };
}

const plain = s => String(s ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
function nickOf(mon) {
  const name = plain(mon.ident), species = plain(mon.species), base = plain(String(mon.species).split('-')[0]);
  return name && name !== species && name !== base ? mon.ident : null;
}

const FROM_MOVES = new Set(['Spiky Shield']);

function tagArg(args, tag) {
  return args.find(a => a.startsWith(`[${tag}]`))?.replace(new RegExp(`^\\[${tag}\\]\\s*`), '');
}

function fromOf(args) {
  const raw = args.find(a => a.startsWith('[from]'));
  if (!raw) return null;
  const text = raw.replace(/^\[from\]\s*/, '');
  const m = /^(item|ability|move):\s*(.+)$/i.exec(text);
  if (m) return { kind: { item: 'items', ability: 'abilities', move: 'moves' }[m[1].toLowerCase()], name: m[2] };
  if (FROM_MOVES.has(text)) return { kind: 'moves', name: text };
  return { kind: null, name: text };
}

export const hasEvents = read => read.turns.some(t => t.events.length);

const STATUS_EN = { par: 'was paralyzed', brn: 'was burned', slp: 'fell asleep', frz: 'was frozen', psn: 'was poisoned', tox: 'was badly poisoned' };
// Weather: start and end sentences. Unknown weather by its name
const WEATHER_EN = {
  SunnyDay: ['The sunlight turned harsh', 'The harsh sunlight faded'],
  DesolateLand: ['The sunlight turned extremely harsh', 'The extremely harsh sunlight faded'],
  RainDance: ['It started to rain', 'The rain stopped'],
  PrimordialSea: ['A heavy rain began to fall', 'The heavy rain lifted'],
  Sandstorm: ['A sandstorm kicked up', 'The sandstorm subsided'],
  Hail: ['It started to hail', 'The hail stopped'],
  Snowscape: ['It started to snow', 'The snow stopped'],
  DeltaStream: ['Mysterious strong winds began to blow', 'The mysterious strong winds dissipated'],
};
const FROM_EN = { psn: 'poison', tox: 'poison', brn: 'burn', recoil: 'recoil', confusion: 'confusion' };

export function monText(mon, namer) {
  if (!mon) return 'Pokémon';
  if (!mon.nick) return namer.species(mon.species);
  return namer.seen('nick', mon.nick) ? mon.nick : nicknamed(mon.nick, namer.species(mon.species));
}

function fromText(from, namer) {
  if (!from) return '';
  if (from.kind) return ` from ${namer[from.kind](from.name)}`;
  return ` from ${FROM_EN[toID(from.name)] ?? from.name}`;
}

const hpText = (name, x) => `${name} HP ${x.before === null || x.before === undefined ? '' : `${x.before}% → `}${x.hp}%`;

function sidesOf(read, sides = {}) {
  return { mine: USER, theirs: sides.theirs || read.players?.theirs || 'Opponent', wild: !!sides.wild,
    partner: sides.partner ?? null, second: sides.second ?? null };
}

const OWNERS = ['mine', 'partner', 'theirs', 'second'];

function ownerOf(mon, sides) {
  const player = String(mon?.seat ?? '').slice(0, 2);
  if (mon?.side === 'mine') return player === 'p3' && sides.partner ? 'partner' : 'mine';
  if (!sides.second) return 'theirs';
  if (player === 'p4') return 'second';
  return mon.seat === 'p2b' ? 'second' : 'theirs';
}

const ownerName = (owner, sides) => ({ mine: sides.mine, partner: sides.partner, theirs: sides.theirs, second: sides.second }[owner]);

function sentOutText(owner, mons, sides) {
  if (owner === 'theirs' && sides.wild) return `Wild ${mons} appeared`;
  return `${ownerName(owner, sides)} sent out ${mons}`;
}

function userText(m, namer, sides) {
  const owner = ownerOf(m, sides);
  return owner === 'partner' || owner === 'second' ? `${ownerName(owner, sides)}'s ${monText(m, namer)}` : monText(m, namer);
}

const zMoveName = (move, namer) => (/^Z-./.test(move) ? namer.zStatus(move.slice(2)) : namer.moves(move));

function gimmickText(e, namer, sides) {
  const user = () => userText(e.mon, namer, sides);
  switch (e.type) {
  case 'mega': return e.into ? `${user()} Mega Evolved into ${namer.species(e.into)}` : `${user()} Mega Evolved`;
  case 'primal': return `${user()} underwent Primal Reversion`;

  case 'burst': return `${user()} underwent Ultra Burst and became ${namer.species(e.into ?? 'Necrozma-Ultra')}`;
  case 'dynamax': return e.ended ? `${user()} returned to normal size` : `${user()} ${e.gmax ? 'Gigantamaxed' : 'Dynamaxed'}`;
  case 'tera': return `${user()} Terastallized into the ${e.tera} type`;
  case 'move': return e.z ? `${user()} used the Z-Move ${zMoveName(e.move, namer)}` : null;
  default: return null;
  }
}

function tagText(x, mon, namer, ctx) {
  if (x.tag === 'blocked' || x.tag === 'absorbed') return `${x.tag} by ${x.byMon ? `${mon(x.byMon)}'s ` : ''}${namer[x.by.kind](x.by.name)}`;
  const text = x.tag === 'no effect' && x.mon ? `no effect on ${mon(x.mon)}` : x.tag;
  if (!ctx.sure(x.guard)) return text;

  const start = x.skin && ctx.sure(x.skin.guard) ? ctx.start(x.skin.user) : null;
  const skin = start && x.skin.options.find(o => toID(o.ability) === start);
  if (skin) return skin.ok && !x.skin.changed ? `${text} from ${mon(x.skin.user)}'s ${namer.abilities(skin.ability)}` : text;
  if (x.types) return `${text} (${x.types.join('/')} type)`;
  if (x.note) return `${text} (${x.note})`;
  return x.from ? `${text}${fromText(x.from, namer)}` : text;
}

const ILLUSION_SPECIES = new Set(['zorua', 'zoroark', 'zoruahisui', 'zoroarkhisui']);

function reasonCtx(read, battle, own = null) {
  const halves = { theirs: [...(battle?.team ?? []), ...(battle?.foePartner?.team ?? [])], mine: [...(battle?.partner?.team ?? [])] };
  const mine = Array.isArray(own) ? own : [];
  const mayIllude = set => (set?.ability ? toID(set.ability) === 'illusion' : ILLUSION_SPECIES.has(toID(set?.species)));
  const broken = new Set(read?.illusion ?? []);
  const count = (side, known, team) => {
    const n = known ? team.filter(mayIllude).length : null;
    return n === 0 && broken.has(side) ? null : n;
  };
  const users = { theirs: count('theirs', Array.isArray(battle?.team), halves.theirs), mine: count('mine', Array.isArray(own), [...halves.mine, ...mine]) };
  const risky = new Set(broken);
  if (halves.mine.some(mayIllude)) risky.add('mine');
  const sure = guard => {
    if (!guard || guard.state === 'real') return true;
    if (guard.state === 'disguised') return false;
    const n = users[guard.side];
    if (n === null || n === undefined) return !risky.has(guard.side);
    return n === 0 || (n === 1 && ILLUSION_SPECIES.has(toID(guard.species))) || guard.accounted >= n;
  };
  const start = ref => {
    const seat = String(ref?.seat ?? '');
    const team = ref?.side === 'theirs' ? halves.theirs : seat.startsWith('p3') ? halves.mine : seat.startsWith('p1') ? mine : [];
    const same = team.filter(set => toID(set?.species) === toID(ref?.species));
    if (!same.length || same.some(set => !set.ability)) return null;
    const ids = new Set(same.map(set => toID(set.ability)));
    return ids.size === 1 ? [...ids][0] : null;
  };
  return { sure, start };
}

function eventText(e, namer, sides, ctx = reasonCtx(null, null)) {
  const mon = m => monText(m, namer);
  switch (e.type) {
  case 'switch': return sentOutText(ownerOf(e.mon, sides), mon(e.mon), sides);
  case 'move': {

    if (e.reveal?.length) {
      const reveal = e.reveal.map(r => `${mon(r.was)} was really ${mon(r.mon)}, disguised by ${namer.abilities('Illusion')}`).join('. ');
      return `${reveal}. ${eventText({ ...e, reveal: null }, namer, sides, ctx)}`;
    }

    const user = userText(e.mon, namer, sides);

    const head = e.cont ? `${user}'s ${zMoveName(e.move, namer)}` : e.z ? gimmickText(e, namer, sides) : `${user} used ${namer.moves(e.move)}`;
    if (e.miss) return `${head} → missed`;

    const parts = [
      ...e.effects.filter(x => x.kind === 'hp').map(x => hpText(mon(x.mon), x)),
      ...e.effects.filter(x => x.kind === 'tag').map(x => tagText(x, mon, namer, ctx)),
    ];
    return parts.length ? `${head} → ${parts.join(', ')}` : head;
  }
  case 'damage': case 'heal': return `${hpText(mon(e.mon), e)}${fromText(e.from, namer)}`;
  case 'status': return `${mon(e.mon)} ${STATUS_EN[e.status] ?? `got ${e.status}`}`;
  case 'faint': return `${mon(e.mon)} fainted`;
  case 'ball': return `${namer.items(e.ball)} thrown at ${mon(e.mon)} → ${e.result === 'caught' ? 'caught' : e.result === 'blocked' ? 'blocked' : 'broke free'}`;
  case 'item': return `${ownerName(ownerOf(e.mon, sides), sides)} used ${e.label ?? namer.items(e.item)} on ${mon(e.mon)}${e.failed ? ' → no effect' : ''}`;
  case 'tool': return toolText(e, mon, sides);
  case 'run': return e.result === 'escaped' ? 'Got away safely' : 'Could not get away';
  case 'levelup': return `${mon(e.mon)} grew to Lv${e.level}`;

  case 'ability': return `${mon(e.mon)}'s ${namer.abilities(e.ability)} activated${fromText(e.from, namer)}`;
  case 'helditem': return e.foe ? `${mon(e.mon)} found a foe holding ${namer.items(e.item)}${fromText(e.from, namer)}` : e.from?.kind === 'moves' ? `${mon(e.mon)} obtained ${namer.items(e.item)}${fromText(e.from, namer)}` : `${mon(e.mon)} is holding ${namer.items(e.item)}${fromText(e.from, namer)}`;
  case 'enditem':
    if (e.how === 'eat') return `${mon(e.mon)} ate its ${namer.items(e.item)}`;
    if (e.how === 'lost') return `${mon(e.mon)} lost its ${namer.items(e.item)}${fromText(e.from, namer)}`;

    if (toID(e.item) === 'airballoon') return `${mon(e.mon)}'s ${namer.items(e.item)} popped`;
    return `${mon(e.mon)}'s ${namer.items(e.item)} was used up`;
  case 'weather':
    if (!e.weather) return WEATHER_EN[e.ended]?.[1] ?? 'The weather cleared';

    return `${WEATHER_EN[e.weather]?.[0] ?? `The weather became ${e.weather}`}${e.of && e.from?.kind ? ` from ${mon(e.of)}'s ${namer[e.from.kind](e.from.name)}` : fromText(e.from, namer)}`;
  case 'field': return `${namer.moves(e.field)} ${e.ended ? 'ended' : 'started'}`;
  case 'mega': case 'primal': case 'burst': case 'dynamax': case 'tera': return gimmickText(e, namer, sides);
  default: return '';
  }
}

const STAT_EN = { atk: 'Attack', def: 'Defense', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed', accuracy: 'accuracy', evasion: 'evasiveness' };
const listEn = items => (items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items.at(-1)}` : items[0] ?? '');
function toolText(e, mon, sides) {
  const target = e.trainer ?? mon(e.mon);
  const used = `${sides.mine} used ${e.label} on ${target}`;
  if (e.failed) return `${used} → no effect`;
  const name = e.trainer ?? mon(e.mon);
  if (e.tag === 'cheer') {
    const rose = e.boosts.filter(b => b.amount > 0).map(b => STAT_EN[b.stat] ?? b.stat), fell = e.boosts.filter(b => b.amount < 0).map(b => STAT_EN[b.stat] ?? b.stat);
    return [used, ...(rose.length ? [`${name}'s ${listEn(rose)} rose`] : []), ...(fell.length ? [`${name}'s ${listEn(fell)} fell`] : [])].join('. ');
  }
  if (e.tag === 'taunt') return `${used}. ${name} is taunted into attacking for ${TOOL_TURNS} turns`;
  if (e.tag === 'distract') return `${used}. ${name} is distracted for ${TOOL_TURNS} turns`;
  return used;
}

export function keyLines(read, namer, sides = {}, { battle = null, own = null } = {}) {
  const who = sidesOf(read, sides);
  const ctx = reasonCtx(read, battle, own);
  const byTurn = new Map();
  for (const t of read.turns) {
    const turn = Math.max(1, t.turn);
    byTurn.set(turn, [...(byTurn.get(turn) ?? []), ...t.events]);
  }
  return [...byTurn].map(([turn, events]) => {
    const sentences = events.map(e => eventText(e, namer, who, ctx)).filter(Boolean);
    return `Turn ${turn}: ${sentences.join('. ')}${sentences.length ? '.' : ''}`;
  });
}

export function turnSpan(read) {
  const list = read.turns.map(t => Math.max(1, t.turn));
  return list.length ? { fromTurn: Math.min(...list), toTurn: Math.max(...list) } : null;
}

export function summaryLine(read, namer, { evolutions = [], sides = {} } = {}) {
  const s = read.summary;
  const who = sidesOf(read, sides);
  const list = mons => mons.map(m => monText(m, namer)).join(', ') || '-';
  const parts = [];
  for (const owner of OWNERS) {
    const sent = s.sent.filter(m => ownerOf(m, who) === owner);
    if (sent.length) parts.push(`${sentOutText(owner, list(sent), who)}.`);
  }
  for (const e of s.gimmicks ?? []) parts.push(`${gimmickText(e, namer, who)}.`);
  const facts = endFacts(read, namer, { evolutions });
  return [...parts, ...(facts ? [facts] : [])].join(' ');
}

export function endFacts(read, namer, { evolutions = [] } = {}) {
  const s = read.summary;
  const parts = [];
  if (s.fainted.length) parts.push(`Fainted: ${s.fainted.map(m => monText(m, namer)).join(', ')}.`);
  if (s.caught) parts.push(`Caught: ${monText(s.caught.mon, namer)} with ${namer.items(s.caught.ball)}.`);
  else if (s.ran) parts.push('Ran away.');
  const evolved = evolutions.filter(e => e?.evolved === true);
  if (evolved.length) parts.push(`Evolved: ${evolved.map(e => `${namer.species(e.from)} → ${namer.species(e.to)}`).join(', ')}.`);
  return parts.join(' ');
}
