import { createNamer, trainerName, secondName, partnerName, stageTrainer, ownLabel } from './ai-names.mjs';
import { outcomeOf } from './outcome.mjs';
import { STATS } from '../engine/mon.mjs';
import { keyLines, summaryLine, endFacts, turnSpan } from './narrate.mjs';
import { customText } from './custom-items.mjs';
import { OUTSIDE_ITEMS } from './items.mjs';

export const OUTCOME_EN = { win: 'Win', lose: 'Loss', forfeit: 'Forfeit (loss)', run: 'Ran away', capture: 'Caught', stop: 'Stopped' };

export const outcomeText = outcome => OUTCOME_EN[outcome] ?? outcome;

const wildMons = battle => (battle.team?.length ? battle.team : [{ species: 'Pokémon' }]);

const trainersText = (battle, join) => (battle?.foePartner ? `${trainerName(battle)}${join}${secondName(battle)}` : trainerName(battle));

export function opponentText(battle, namer) {
  if (battle?.wild) return wildMons(battle).map(mon => `Wild ${namer.species(mon.species)}${mon.level ? ` Lv${mon.level}` : ''}`).join(' & ');
  return trainersText(battle, ' & ');
}

export const partnerField = (battle, kind) => (kind === 'tag' && battle?.partner?.name ? [`Partner: ${battle.partner.name}`] : []);

export const BACK_TO_BACK = {

  resultField: (battle, outcomes) => `Battles: ${outcomes.map((outcome, i) => `${outcomeText(outcome)} against ${stageTrainer(battle, i + 1)}`).join(', ')}`,

  defeatedLine: (battle, stage) => `[Won against ${Array.from({ length: stage - 1 }, (_, i) => stageTrainer(battle, i + 1)).join(', ')} | Now battling ${stageTrainer(battle, stage)}]`,

  oocLine: battle => `{{user}} won the first battle against ${stageTrainer(battle, 1)} one-on-one. What follows is the second battle, against ${stageTrainer(battle, 2)}.`,
};

// -- Result line -----------------------------------------

export function resultLine({ outcome, battle, kind, caught = null, evolutions = [], stages = null, prize = null, lang = 'ko', en = null }) {
  const namer = createNamer({ lang, en });
  const parts = [`Opponent: ${opponentText(battle, namer)}`, ...partnerField(battle, kind), ...(stages ? [BACK_TO_BACK.resultField(battle, stages)] : []),
    `Outcome: ${outcomeText(outcome)}`];

  if (prize && outcome === 'win' && !battle?.wild) parts.push(`Prize Money: doubled by ${namer.items(prize)}`);
  if (caught?.species) parts.push(`Caught: ${namer.species(caught.species)} → ${caught.storage ? 'Storage' : 'Party'}`);
  const evolved = (evolutions ?? []).filter(e => e?.evolved === true);
  if (evolved.length) parts.push(`Evolved: ${evolved.map(e => `${namer.species(e.from)} → ${namer.species(e.to)}`).join(', ')}`);
  return `[Battle Result | ${parts.join(' | ')}]`;
}

export const PRIZE_ITEMS = ['amuletcoin', 'luckincense'];

export function prizeItem(results) {
  for (const result of results ?? []) {
    const held = (result?.sides?.[0]?.team ?? []).find(mon => mon?.appeared === true && PRIZE_ITEMS.includes(mon.originalItem));
    if (held) return held.originalItem;
  }
  return null;
}

export const RESULT_LINE_RE = /\[Battle (?:Result \||result:)[^\]\n]*\]/;

const resultHead = (opponent, outcome) => `The battle against ${opponent} is over. Skip the battle itself and continue the story from right after it. Result: ${outcomeText(outcome)}.`;

export const sentFormat = (format, ended) => (format === 'result' && !ended ? 'summary' : format);

const turnsText = span => (span.fromTurn === span.toTurn ? `turn ${span.fromTurn}` : `turns ${span.fromTurn}–${span.toTurn}`);

export function storyOoc(format, { battle, own = null, result = null, ended = false, first = true, read, whole = null, screen = [], stage = 1, lang = 'ko', en = null }) {
  const namer = createNamer({ lang, en });
  const opponent = battle?.wild ? `the wild ${wildMons(battle).map(mon => namer.species(mon.species)).join(' and ')}` : trainersText(battle, ' and ');
  format = sentFormat(format, ended);
  const sides = { theirs: stageTrainer(battle, stage), wild: !!battle?.wild, partner: battle?.partner ? partnerName(battle) : null,
    second: battle?.foePartner && stage === 1 ? secondName(battle) : null };
  if (format === 'result') {
    const facts = endFacts(whole ?? read, namer, { evolutions: result?.evolutions ?? [], sides });
    return `(OOC: ${[resultHead(opponent, outcomeOf(result)), ...(facts ? [facts] : [])].join('\n')})`;
  }
  const summary = format === 'summary';
  const span = turnSpan(read);
  const outcome = ended ? ` Result: ${outcomeText(outcomeOf(result))}.` : '';
  const below = summary ? '' : ' below';
  const facts = (summary ? '. Fill in the details yourself, keeping to these facts' : ', keeping to the facts')
    + (ended ? '.' : ", and stop there. The battle isn't over yet.");
  const resume = 'Continue from your last narration';
  let head;
  if (ended && first) head = `Narrate the battle against ${opponent}${below} as story${facts}${outcome}`;
  else if (ended) {
    head = span
      ? `${resume}: narrate ${turnsText(span)} of the battle against ${opponent}${below}${facts}${outcome}`
      : `${resume} and narrate how the battle against ${opponent} ends.${outcome}`;
  } else {
    const what = span ? turnsText(span) : 'the battle so far';
    const narrate = first ? `Narrate ${what}${below} as story` : `${resume}: narrate ${what}${below}`;
    head = `The battle against ${opponent} is still going on. ${narrate}${facts}`;
  }
  const body = summary ? summaryLine(read, namer, { evolutions: ended ? result?.evolutions : [], sides })
    : format === 'log' ? (screen ?? []).join('\n') : keyLines(read, namer, sides, { battle, own }).join('\n');
  if (!body) return `(OOC: ${head})`;
  const told = stage > 1 && first ? [BACK_TO_BACK.oocLine(battle)] : [];
  return `(OOC: ${[head, ...told, body].join('\n')})`;
}

export const USER = '{{user}}';

const STAT_EN = { hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' };

const STAT_FULL = { hp: 'HP', atk: 'Attack', def: 'Defense', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed' };
const signed = n => `${n > 0 ? '+' : ''}${n}`;
const EV_RESET = 'its base stats were reset';

const yen = n => `¥${Number(n).toLocaleString('en-US')}`;
const signedYen = (n, plus = '+') => `${n < 0 ? '-' : plus}${yen(Math.abs(n))}`;
const itemList = (lines, name) => lines.map(l => `${name(l.item)} ×${l.count}`).join(', ');
export const SHOP_LOG = {

  shop: ({ buy = [], bonus = [], sell = [], spent = 0, got = 0 }, name, money = null) => {
    const parts = [buy.length && `bought ${itemList(buy, name)} for ${yen(spent)}`, bonus.length && `got ${itemList(bonus, name)} free`,
      sell.length && `sold ${itemList(sell, name)} for ${yen(got)}`].filter(Boolean);
    const said = parts.length > 1 ? `${parts.slice(0, -1).join(', ')}, and ${parts.at(-1)}` : parts[0] ?? 'bought nothing';
    const now = Number.isFinite(money) ? `, money now ${signedYen(money, '')}` : '';
    return `${USER} ${said} (net ${signedYen(got - spent)}${now})`;
  },
};

const REVIVED_LOG = mon => `${USER} received ${mon}, restored from a fossil at the lab, and took it into the party`;

const andList = names => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);
export const FISH_LOG = ({ items }) => `${USER} fished up ${andList(items.map(i => `${i.name}${i.count > 1 ? ` ×${i.count}` : ''}`))}`;

export function fishGroups(events) {
  let group = null;
  const out = [];
  for (const e of events ?? []) {
    if (!(e?.kind === 'item' && e.fished && e.delta > 0)) { out.push(e); continue; }
    if (!group) { group = { kind: 'fished', items: [] }; out.push(group); }
    const line = group.items.find(i => i.item === e.item);
    if (line) line.count += e.delta; else group.items.push({ item: e.item, count: e.delta });
  }
  return out;
}

export const EVOLVE_LOCK_LOG = ({ mon, locked }) => (locked ? `${USER} chose to keep ${mon} from evolving` : `${USER} chose to let ${mon} evolve again`);

export function lockGroups(events) {
  const list = events ?? [];
  const key = e => e.who?.uid ?? JSON.stringify(e.who ?? null);
  const presses = new Map();
  for (const e of list) if (e?.kind === 'evolvelock') presses.set(key(e), [...presses.get(key(e)) ?? [], e]);
  return list.filter(e => {
    if (e?.kind !== 'evolvelock') return true;
    const mine = presses.get(key(e));
    if (e !== mine.at(-1)) return false;
    const first = mine[0];
    const was = typeof first.was === 'boolean' ? first.was : first.locked !== true;
    return (e.locked === true) !== was;
  });
}

export function logLine(event, namer = createNamer({ lang: 'en' }), money = null, fishLog = FISH_LOG) {

  const monEn = w => (w?.egg ? 'Egg' : w?.name ? w.name : w?.species ? namer.species(w.species) : w?.ref ?? 'Pokémon');

  const itemEn = id => customText(event, id) ?? namer.items(id);
  const effectEn = e => {
    if (e.kind === 'heal') {
      if (e.revivedAll) return 'revived all fainted';
      if (e.revived) return 'revived';
      if (e.cured) return 'status healed';
      if (e.hpFrom != null && e.hpTo != null && e.hpFrom !== e.hpTo) return `HP ${e.hpFrom}% → ${e.hpTo}%`;
      return '';
    }
    if (e.kind === 'level') return `Lv${e.from} → ${e.to}`;
    if (e.kind === 'evolve') return `evolved into ${namer.species(e.species)}`;
    if (e.kind === 'teach') return `learned ${namer.moves(e.move)}`;
    // Out-of-battle items
    if (e.kind === 'evs') return e.to === e.from ? '' : `its base ${STAT_FULL[e.stat] ?? e.stat} ${e.to > e.from ? 'rose' : 'fell'}`; // no effect: the item name only
    if (e.kind === 'exp') return `+${e.amount} EXP${e.to > e.from ? `, Lv${e.from} → ${e.to}` : ''}`;
    if (e.kind === 'ability') return `ability ${namer.abilities(e.from)} → ${namer.abilities(e.to)}`;
    if (e.kind === 'nature') return `stats now grow as ${e.nature} nature`;
    if (e.kind === 'hypertrain') return `hyper trained ${(e.stats ?? []).length === STATS.length ? 'all stats' : (e.stats ?? []).map(s => STAT_EN[s] ?? s).join('/')}`;
    if (e.kind === 'ppup') return `${namer.moves(e.move)} max PP ${e.from ?? '?'} → ${e.to ?? '?'}`;

    if (e.kind === 'tera') return e.type ? `its Tera Type became ${e.type}` : '';
    if (e.kind === 'form') return e.species ? `it changed into ${namer.species(e.species)}` : '';
    if (e.kind === 'fuse') return `it fused with ${monEn(e.other)} into ${namer.species(e.species)}`;
    if (e.kind === 'unfuse') return `${monEn(e.other)} separated from it and returned to the party`;

    return '';
  };
  switch (event?.kind) {
    case 'use': {
      const item = namer.items(event.item);
      const who = event.who ? ` on ${monEn(event.who)}` : '';

      const effects = OUTSIDE_ITEMS[event.item]?.evReset && (event.effects ?? []).some(e => e.kind === 'evs' && e.to !== e.from)
        ? [EV_RESET, ...(event.effects ?? []).filter(e => e.kind !== 'evs').map(effectEn)] : (event.effects ?? []).map(effectEn);
      const effect = effects.filter(Boolean).join(', ');
      return `${USER} used ${item}${who}${effect ? `: ${effect}` : ''}`;
    }
    case 'swap': {
      const [a, b] = event.at ?? [];
      if (a?.party && b?.party) return `${USER} swapped party #${a.party} and #${b.party}`;
      const swapped = `${USER} swapped ${monEn(event.a)} ${a?.party ? '(party)' : '(box)'} with ${monEn(event.b)} ${b?.party ? '(party)' : '(box)'}`;
      const revived = [event.a, event.b].find(w => w?.uid && w.uid === event.revived);
      return revived ? `${swapped}. ${REVIVED_LOG(monEn(revived))}` : swapped;
    }
    case 'hold': return event.item ? `${USER} gave ${itemEn(event.item)} to ${monEn(event.who)}` : `${USER} took ${itemEn(event.prev)} from ${monEn(event.who)}`;
    case 'deposit': return `${USER} moved ${monEn(event.who)} to the box`;

    case 'withdraw': return event.revived ? REVIVED_LOG(monEn(event.who)) : `${USER} moved ${monEn(event.who)} to the party`;
    case 'release': return `${USER} released ${monEn(event.who)}`;
    case 'evolvelock': return EVOLVE_LOCK_LOG({ mon: monEn(event.who), locked: event.locked === true }); // pkbLog tells only what changed (lockGroups)
    case 'nickname': return `${USER} nicknamed ${event.who?.species ? namer.species(event.who.species) : monEn(event.who)} "${event.name}"`;
    case 'teach': {
      const who = monEn(event.who), move = namer.moves(event.move);
      if (event.forget) return `${who} learned ${move} (forgot ${namer.moves(event.forget)})`;
      return event.learned ? `${who} learned ${move}` : `${who} can learn ${move}`; // learned: panel level-up wrap-up
    }

    case 'evolve': return [`${monEn(event.who)} evolved into ${namer.species(event.species)}`,
      ...(event.joined ?? []).map(j => `${namer.species(j.species)} came from the empty shell and joined ${USER}`)].join('. ');
    case 'level': return `${monEn(event.who)} Lv${event.from ?? '?'} → ${event.to ?? '?'}`;
    case 'heal': {
      if (event.all) return event.revivedAll ? 'All fainted Pokémon revived' : 'Party healed';
      const effect = effectEn(event);
      return `${monEn(event.who)} healed${effect ? `: ${effect}` : ''}`;
    }
    case 'evs': case 'exp': case 'ability': case 'nature': case 'hypertrain': case 'ppup': case 'tera': case 'form': { const effect = effectEn(event); return effect ? `${monEn(event.who)}: ${effect}` : null; }

    case 'feed': return event.item ? `${USER} used ${itemEn(event.item)} on ${monEn(event.who)}` : null;

    case 'egg': {
      const parents = (event.parents ?? []).map(ownLabel);
      return `An Egg was found${parents.length === 2 ? ` with ${parents.join(' and ')}` : ''} (${event.box ? 'sent to storage' : event.slot ? `party #${event.slot}` : 'party'})`;
    }
    case 'hatch': return `${event.slot ? `The Egg in party #${event.slot}` : 'An Egg'} hatched into ${namer.species(event.who?.species)}`;
    case 'item': return `${itemEn(event.item)} ${signed(event.delta)}`;
    // the message's catches gathered (fishGroups - FISH_LOG)
    case 'fished': return fishLog ? fishLog({ items: event.items.map(i => ({ name: namer.items(i.item), count: i.count })) }) : null;
    case 'shop': return SHOP_LOG.shop(event, id => namer.items(id), money);
    case 'add': return `${USER} got ${namer.species(event.who?.species)} Lv${event.level}${event.box ? ', sent to storage' : ''}`;

    case 'rest': return `${USER}'s party took a short rest and regained half of their max HP and PP`;
    default: return null;
  }
}

export function pkbLog(events, { lang = 'ko', en = null, money = null, fishLog = FISH_LOG } = {}) {
  const namer = createNamer({ lang, en });
  let balance = Number.isFinite(money) ? money : null;

  const parts = lockGroups(fishLog ? fishGroups(events) : events ?? []).map(e => {
    if (e?.kind !== 'shop' || balance === null) return logLine(e, namer, null, fishLog);
    balance += (e.got ?? 0) - (e.spent ?? 0);
    return logLine(e, namer, balance >= 0 ? balance : null);
  }).filter(Boolean);
  if (!parts.length) return '';
  return `<pkb-log>${parts.join('. ')}.</pkb-log>`;
}
