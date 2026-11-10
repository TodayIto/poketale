import { toID } from '../engine/mon.mjs';
import { nicknamed } from './ai-names.mjs';

const USER = '{{user}}';

const SIDE = { p1: 'mine', p2: 'theirs', p3: 'mine', p4: 'theirs' };

export function readLog(log, { from = 0, to = log?.length ?? 0 } = {}) {
  const at = new Map();
  const met = [];
  const sent = new Set();
  const turns = [{ turn: 0, events: [] }];
  const summary = { sent: [], fainted: [], winner: null, caught: null, ran: false, turns: 0 };
  const players = { mine: null, theirs: null };
  let split = 0;
  let recent = null, recentLive = false;
  let weather = null;
  const lines = log ?? [];
  const end = Math.min(to, lines.length);
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
    switch (cmd) {
    case 'player': if (SIDE[args[0]] && args[1]) players[SIDE[args[0]]] = args[1]; break;
    case 'turn': turns.push({ turn: Number(args[0]), events: [] }); summary.turns = Number(args[0]); recent = null; break;
    case 'switch': case 'drag': {
      const [player, letter, name] = identOf(args[0]);
      const field = new Set(at.values());
      const mon = named(player, name, m => !field.has(m) && m.hp !== 0) ?? meet(player, name);
      met.splice(met.indexOf(mon), 1);
      met.push(mon);
      mon.species = args[1].split(',')[0];
      mon.seat = player + letter;
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
      mon.ident = identOf(args[0])[2];
      mon.species = args[1].split(',')[0];
      break;
    }
    case 'move': {
      const mon = who(args[0]);
      const target = args[2] ? who(args[2]) : null;
      push({ type: 'move', mon: ref(mon), move: args[1], target: target && target !== mon ? ref(target) : null, miss: args.includes('[miss]'), effects: [] });
      break;
    }
    case '-damage': case '-heal': {
      const mon = who(args[0]);
      const before = setHp(mon, args[1]);
      const from = fromOf(args);
      const delta = before === null ? 0 : Math.round(mon.hp / mon.maxhp * 100 - before * 100);
      const prev = from ? null : moveOf();
      const entry = { mon: ref(mon), delta, before: before === null ? null : Math.round(before * 100), hp: pct(mon), from };
      if (prev) prev.effects.push({ kind: 'hp', ...entry });
      else push({ type: cmd === '-damage' ? 'damage' : 'heal', ...entry });
      break;
    }
    case '-supereffective': case '-resisted': case '-crit': case '-immune': case '-miss': {
      const prev = moveOf();
      const tag = { '-supereffective': 'super effective', '-resisted': 'not very effective', '-crit': 'critical hit', '-immune': 'no effect', '-miss': 'missed' }[cmd];
      if (prev) prev.effects.push({ kind: 'tag', tag, mon: args[0] ? ref(who(args[0])) : null });
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

    case '-story-item': push({ type: 'item', mon: ref(who(args[0])), item: args[2], ...(args[3] ? { label: args[3] } : {}) }); break;
    case '-story-run': if (live && args[2] === 'escaped') summary.ran = true; push({ type: 'run', result: args[2] }); break;
    case '-story-levelup': push({ type: 'levelup', mon: ref(who(args[0])), level: Number(args[2]) }); break;
    case 'win': if (live) summary.winner = args[0]; break;

    case '-ability': if (!silent) push({ type: 'ability', mon: ref(who(args[0])), ability: args[1], from: fromOf(args) }, false); break;
    case '-item': if (!silent) push({ type: 'helditem', mon: ref(who(args[0])), item: args[1], from: fromOf(args) }, false); break;
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
      const of = args.find(a => a.startsWith('[of]'))?.replace(/^\[of\]\s*/, '');
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
  }
  return { turns: turns.filter(t => t.events.length), summary, players };
}

const plain = s => String(s ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
function nickOf(mon) {
  const name = plain(mon.ident), species = plain(mon.species), base = plain(String(mon.species).split('-')[0]);
  return name && name !== species && name !== base ? mon.ident : null;
}

function fromOf(args) {
  const raw = args.find(a => a.startsWith('[from]'));
  if (!raw) return null;
  const text = raw.replace(/^\[from\]\s*/, '');
  const m = /^(item|ability|move):\s*(.+)$/i.exec(text);
  if (m) return { kind: { item: 'items', ability: 'abilities', move: 'moves' }[m[1].toLowerCase()], name: m[2] };
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

function eventText(e, namer, sides) {
  const mon = m => monText(m, namer);
  switch (e.type) {
  case 'switch': return sentOutText(ownerOf(e.mon, sides), mon(e.mon), sides);
  case 'move': {

    const owner = ownerOf(e.mon, sides);
    const user = owner === 'partner' || owner === 'second' ? `${ownerName(owner, sides)}'s ${mon(e.mon)}` : mon(e.mon);

    const head = e.cont ? `${user}'s ${namer.moves(e.move)}` : `${user} used ${namer.moves(e.move)}`;
    if (e.miss) return `${head} → missed`;

    const parts = [
      ...e.effects.filter(x => x.kind === 'hp').map(x => hpText(mon(x.mon), x)),
      ...e.effects.filter(x => x.kind === 'tag').map(x => (x.tag === 'no effect' && x.mon ? `no effect on ${mon(x.mon)}` : x.tag)),
    ];
    return parts.length ? `${head} → ${parts.join(', ')}` : head;
  }
  case 'damage': case 'heal': return `${hpText(mon(e.mon), e)}${fromText(e.from, namer)}`;
  case 'status': return `${mon(e.mon)} ${STATUS_EN[e.status] ?? `got ${e.status}`}`;
  case 'faint': return `${mon(e.mon)} fainted`;
  case 'ball': return `${namer.items(e.ball)} thrown at ${mon(e.mon)} → ${e.result === 'caught' ? 'caught' : e.result === 'blocked' ? 'blocked' : 'broke free'}`;
  case 'item': return `${ownerName(ownerOf(e.mon, sides), sides)} used ${e.label ?? namer.items(e.item)} on ${mon(e.mon)}`;
  case 'run': return e.result === 'escaped' ? 'Got away safely' : 'Could not get away';
  case 'levelup': return `${mon(e.mon)} grew to Lv${e.level}`;

  case 'ability': return `${mon(e.mon)}'s ${namer.abilities(e.ability)} activated${fromText(e.from, namer)}`;
  case 'helditem': return e.from?.kind === 'moves' ? `${mon(e.mon)} obtained ${namer.items(e.item)}${fromText(e.from, namer)}` : `${mon(e.mon)} is holding ${namer.items(e.item)}${fromText(e.from, namer)}`;
  case 'enditem':
    if (e.how === 'eat') return `${mon(e.mon)} ate its ${namer.items(e.item)}`;
    if (e.how === 'lost') return `${mon(e.mon)} lost its ${namer.items(e.item)}${fromText(e.from, namer)}`;
    return `${mon(e.mon)}'s ${namer.items(e.item)} was used up`;
  case 'weather':
    if (!e.weather) return WEATHER_EN[e.ended]?.[1] ?? 'The weather cleared';

    return `${WEATHER_EN[e.weather]?.[0] ?? `The weather became ${e.weather}`}${e.of && e.from?.kind ? ` from ${mon(e.of)}'s ${namer[e.from.kind](e.from.name)}` : fromText(e.from, namer)}`;
  case 'field': return `${namer.moves(e.field)} ${e.ended ? 'ended' : 'started'}`;
  default: return '';
  }
}

export function keyLines(read, namer, sides = {}) {
  const who = sidesOf(read, sides);
  const byTurn = new Map();
  for (const t of read.turns) {
    const turn = Math.max(1, t.turn);
    byTurn.set(turn, [...(byTurn.get(turn) ?? []), ...t.events]);
  }
  return [...byTurn].map(([turn, events]) => {
    const sentences = events.map(e => eventText(e, namer, who)).filter(Boolean);
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
  if (s.fainted.length) parts.push(`Fainted: ${list(s.fainted)}.`);
  if (s.caught) parts.push(`Caught: ${monText(s.caught.mon, namer)} with ${namer.items(s.caught.ball)}.`);
  else if (s.ran) parts.push('Ran away.');
  const evolved = evolutions.filter(e => e?.evolved === true);
  if (evolved.length) parts.push(`Evolved: ${evolved.map(e => `${namer.species(e.from)} → ${namer.species(e.to)}`).join(', ')}.`);
  return parts.join(' ');
}
