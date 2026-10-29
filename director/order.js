import { isIdent, sideOf, uidOf } from './read.js';
import { toID } from '../engine/mon.mjs';

const BOUNDARY = new Set(['move', 'switch', 'drag', 'cant', 'upkeep', 'turn', 'win', 'tie']);

const isEffectiveness = e => e.kind === '-supereffective' || e.kind === '-resisted';
const isCrit = e => e.kind === '-crit';

export const isSurvive = ({ kind, args: a, kwArgs: kw }) =>
  (kind === '-ability' && toID(a[1]) === 'sturdy' && !kw.from)
  || (kind === '-activate' && /^(move: Endure|item: Focus Band)$/i.test(a[1] ?? ''))
  || (kind === '-enditem' && toID(a[1]) === 'focussash' && !kw.from);

const isDamage = ({ kind, args: a, kwArgs: kw }) => (kind === '-damage' && !kw.from)
  || ((kind === '-activate' || kind === '-end') && /substitute/i.test(a[1] ?? ''));

const actorOf = e => (isIdent(e.args[0]) ? uidOf(e, e.args[0]) : null);

export function openingOrder(events) {
  if (!events.some(e => e.kind === 'start')) return events;
  const end = events.findIndex(e => e.kind === 'turn');
  const head = end < 0 ? events.length : end;
  const first = side => events.findIndex((e, i) => i < head && e.kind === 'switch' && isIdent(e.args[0]) && sideOf(e.args[0]) === side);
  const player = first('player'), enemy = first('enemy');
  if (player < 0 || enemy < 0 || enemy < player) return events;
  const ordered = events.slice();
  const [enemySwitch] = ordered.splice(enemy, 1);
  ordered.splice(player, 0, enemySwitch);
  return ordered;
}

const ITEM_EFFECT = new Set(['-boost', '-unboost', '-curestatus', '-end', '-start', '-enditem']);
const usesItem = ({ kind, kwArgs: kw }) => kind === '-enditem' && (kw.eat || !(kw.from || kw.weaken || kw.silent));
function linkItems(events) {
  let using = null;
  for (const e of events) {
    if (using && !(actorOf(e) === using.uid && ITEM_EFFECT.has(e.kind))) using = null;
    if (using) e.item = using.item;
    if (usesItem(e)) using = { uid: actorOf(e), item: { id: toID(e.args[1]), eaten: !!e.kwArgs.eat } };
  }
}

const LEVEL_KINDS = new Set(['-story-levelup', '-story-learnmove', '-story-movequeue']);
function markSharedExp(events) {
  let said = false;
  events.forEach((e, i) => {
    const kind = events[i - 1]?.kind;
    if (!(kind === '-story-exp' || LEVEL_KINDS.has(kind))) said = false;
    if (e.kind === '-story-exp' && e.kwArgs.shared && !said) { e.sharedFirst = true; said = true; }
  });
}

function orderLevelUps(events) {
  const out = [];
  for (let i = 0; i < events.length; i++) {
    out.push(events[i]);
    if (events[i].kind !== '-story-exp') continue;
    const uid = events[i].args[1];
    let j = i + 1;
    while (j < events.length && LEVEL_KINDS.has(events[j].kind) && events[j].args[1] === uid) j++;
    const run = events.slice(i + 1, j), levels = run.filter(e => e.kind === '-story-levelup');
    for (const e of levels.slice(0, -1)) e.merged = true;
    out.push(...levels, ...run.filter(e => e.kind !== '-story-levelup'));
    i = j - 1;
  }
  return out;
}

function orderSegment(segment) {
  const head = segment[0]?.kind === 'move' ? segment[0] : null;
  if (head) for (const e of segment.slice(1)) e.move = head;

  // Find hits: from that target's effectiveness/crit/endure lines to that target's damage line
  const hits = [];
  let open = null;
  segment.forEach((e, i) => {
    const target = actorOf(e);
    if (isEffectiveness(e) || isCrit(e) || isSurvive(e)) {
      if (open && open.target !== target) open = null;
      open ??= { target, lines: [] };
      open.lines.push(i);
    } else if (isDamage(e)) {
      hits.push({ ...(open?.target === target ? open : { target, lines: [] }), damage: i });
      open = null;
    } else if (open) open.lines.push(i);
  });
  const target = head && isIdent(head.args[2]) ? uidOf(head, head.args[2]) : null;
  const first = hits.find(h => h.target === target);
  if (first && /substitute/i.test(segment[first.damage].args[1] ?? '')) head.onSubstitute = true;
  const inHit = new Set(hits.flatMap(h => h.lines));
  const lastHit = new Map(hits.map(h => [h.target, h]));
  const ohko = hits.length ? segment.filter(e => e.kind === '-ohko') : [];
  const said = new Set();
  const seen = new Map();
  const out = [];
  if (head) out.push({ cue: 'doll-out', move: head });
  let dollBack = !!head;
  const back = () => { if (dollBack) { out.push({ cue: 'doll-back', move: head }); dollBack = false; } };
  segment.forEach((e, i) => {
    if (inHit.has(i) || ohko.includes(e)) return;
    if (e.kind === 'faint') back();
    const hit = hits.find(h => h.damage === i);
    if (!hit) {
      out.push(e);
      if (isSurvive(e)) out.push({ cue: 'survive', event: e });
      return;
    }
    const lines = hit.lines.map(j => segment[j]);
    const effect = lines.find(isEffectiveness);
    if (effect) seen.set(hit.target, effect.kind === '-supereffective' ? 'super' : 'resisted');
    out.push(...lines.filter(l => !isEffectiveness(l) && !isCrit(l)));
    e.hit = { effectiveness: seen.get(hit.target) ?? 'normal' };
    out.push(e);
    out.push(...lines.filter(isSurvive).map(event => ({ cue: 'survive', event })), ...lines.filter(isCrit));
    if (lastHit.get(hit.target) !== hit) return;

    // After the last hit: effectiveness (once), OHKO
    for (const l of hits.filter(h => h.target === hit.target).flatMap(h => h.lines.map(j => segment[j])).filter(isEffectiveness)) {
      if (said.has(hit.target)) l.repeat = true;
      said.add(hit.target);
      out.push(l);
    }
    if (hit === hits.at(-1)) out.push(...ohko);
  });
  back();
  return out;
}

export function arrange(events) {
  linkItems(events);
  markSharedExp(events);
  const ordered = orderLevelUps(openingOrder(events));
  const out = [];
  let segment = [];
  for (const e of ordered) {
    if (BOUNDARY.has(e.kind) && segment.length) { out.push(...orderSegment(segment)); segment = []; }
    segment.push(e);
  }
  out.push(...orderSegment(segment));
  return out;
}
