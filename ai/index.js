// from pokerogue src/phases/enemy-command-phase.ts, src/field/pokemon.ts (getNextMove, getNextTargets), src/field/trainer.ts @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-11-10. See view/LICENSE-NOTE.md.

import { snapshot, restore, rolloutMove, tryChoice, applyGimmick, atSlot } from './engine-copy.js';
import { partyMatchupScores, getMatchupScore, sortScores, nextSummonIndex } from './matchup.js';
import { targetScore, targetWeight, combineScores, tableEntry } from './move-score.js';
import { liveSeedText, deriveSeed, createRng } from './rng.js';
import { lookahead, switchChoices } from './lookahead.js';
import { DEFAULT_POLICY, bossHealItems } from './policy.js';
import { checkEnemyItem } from '../engine/bag.mjs';
import { trainerOf, twinSeat } from '../engine/seats.mjs';
import { holdDecision } from './commit.js';
import { moveTargets } from '../director/targets.js';
import { isReviving } from '../director/simple-ai.js';

export { DEFAULT_POLICY, bossHealItems };

export const DIFFICULTIES = ['easy', 'normal', 'hard', 'max'];

export function aiTier({ trainer = true, difficulty = 'normal', boss = false } = {}) {
  if (!trainer) return 'wild';
  const level = DIFFICULTIES.includes(difficulty) ? DIFFICULTIES.indexOf(difficulty) : 1;
  if (!boss) return DIFFICULTIES[level];
  return level === DIFFICULTIES.length - 1 ? 'hidden' : DIFFICULTIES[level + 1];
}

export function createEnemyAI(sim, options = {}) {
  const policy = options.policy ?? DEFAULT_POLICY;
  const opts = settle({ trainer: true, difficulty: 'normal', boss: false, bossPokemon: false, mega: policy.megaAsap, ...options, policy });

  const partnerOpts = settle({ ...opts, trainer: true, boss: false, bossTrainer: false, bossPokemon: false, healItems: false,
    tera: undefined, difficulty: policy.partner.difficulty });
  const optsOf = sideId => (sideId === 'p3' ? partnerOpts : opts);

  const states = new WeakMap();
  const fresh = () => ({ switchCounter: 0, itemsLeft: null });
  const stateOf = (battle, half) => {
    if (!states.has(battle)) states.set(battle, [fresh(), fresh()]);
    return states.get(battle)[half];
  };
  const halfOf = (battle, sideId) => battle.getSide(sideId).n % 2;

  const held = new WeakMap();
  const heldOf = battle => { if (!held.has(battle)) held.set(battle, [null, null]); return held.get(battle); };

  const healPlan = (sideId, liveSide, twin) => {
    if (!opts.trainer || !opts.boss || opts.healItems === false || (sideId !== 'p2' && !twin)) return null;
    const team = [...liveSide.team, ...(twin?.team ?? [])];
    return opts.healItems ?? bossHealItems(team.map(set => set.level || 100), policy);
  };
  const report = info => {
    if (opts.onDecision) opts.onDecision(info);
    else if (info.kind === 'error' || info.problems) console.warn('[enemy AI]', info.kind === 'error' ? `${info.stage}: ${info.error}` : info.problems);
  };

  function enemyAI(battle, sideId, given = []) {
    const t0 = now();
    const liveSide = battle.getSide(sideId);
    const request = liveSide.activeRequest;
    if (!request || request.wait) throw new Error(`${sideId}: 기다리는 중인 요청에는 AI 를 부르지 않는다`);
    if (request.teamPreview) return 'default';
    const half = halfOf(battle, sideId), state = stateOf(battle, half), seatOpts = optsOf(sideId), twin = twinSeat(liveSide);
    const plan = healPlan(sideId, liveSide, twin);
    if (plan && state.itemsLeft === null) state.itemsLeft = plan.count;
    const forced = !!request.forceSwitch, turns = heldOf(battle);
    const earlier = !forced && turns[half]?.turn === battle.turn && !turns[half].sides.includes(sideId) ? turns[half] : null;
    const start = earlier?.state ?? { switchCounter: state.switchCounter, itemsLeft: state.itemsLeft };
    const problems = [];
    let ctx = null, decision;
    try {
      ctx = openDecision(sim, battle, sideId, request, liveSide, seatOpts, problems);

      decision = decide(ctx, start, plan, given, !!(twin && earlier?.gimmickUsed));
    } catch (error) {

      decision = { info: { kind: 'error', stage: error?.stage ?? 'decide', error: String(error?.stack || error), choice: 'default' }, parts: null };
    } finally {
      ctx?.close();
    }
    const { info, parts } = decision;
    if (info.choice === 'default') info.choice = fallbackChoice(battle, liveSide, request, keptParts(info, given));
    if (problems.length) info.problems = problems;
    info.tier = seatOpts.tier;
    if (!forced) {
      turns[half] = { turn: battle.turn, sides: [...(earlier?.sides ?? []), sideId], state: parts ? parts.reduce(partState, start) : start,
        gimmickUsed: !!(earlier?.gimmickUsed || decision.gimmickUsed) };
    }

    const decided = info.choice;
    holdDecision(battle, sideId, accepted => {
      if (forced) return;
      if (turns[half]?.sides.includes(sideId)) turns[half] = null;
      const live = stateOf(battle, half), base = { switchCounter: live.switchCounter, itemsLeft: live.itemsLeft };
      if (accepted !== decided) Object.assign(live, acceptedState(base, accepted));
      else if (parts) Object.assign(live, parts.reduce(partState, base));
    });
    info.ms = now() - t0;
    report(info);
    return info.choice;
  }

  enemyAI.saveState = battle => {
    const [mine, foes] = [stateOf(battle, 0), stateOf(battle, 1)];
    return { switchCounter: foes.switchCounter, ...(foes.itemsLeft !== null ? { itemsLeft: foes.itemsLeft } : {}),
      ...(battle.sides.length > 2 ? { partner: { switchCounter: mine.switchCounter } } : {}) };
  };
  enemyAI.loadState = (battle, saved) => {
    held.delete(battle);
    states.set(battle, [{ switchCounter: Number(saved?.partner?.switchCounter) || 0, itemsLeft: null },
      { switchCounter: Number(saved?.switchCounter) || 0, itemsLeft: Number.isInteger(saved?.itemsLeft) ? saved.itemsLeft : null }]);
  };
  enemyAI.tier = opts.tier;
  return enemyAI;
}

function settle(opts) {
  opts.bossTrainer ??= opts.boss;
  opts.tera ??= opts.bossTrainer ? opts.policy.tera.bossTrainer : opts.policy.tera.trainer;
  opts.tier = aiTier(opts);
  return opts;
}

const now = () => (globalThis.performance?.now ? globalThis.performance.now() : Date.now());

function openDecision(sim, battle, sideId, request, liveSide, opts, problems) {
  const json = snapshot(battle);
  const seed = deriveSeed(liveSeedText(battle), battle.turn, sideId, request.rqid ?? '');
  const probe = restore(sim, json, seed);
  const ctx = {
    sim, json, seed, sideId, request, liveSide, opts, problems, probe,
    side: probe.getSide(sideId),
    rng: createRng(deriveSeed('ai', ...seed)),
    rolls: new Map(),
    scenes: new Map(),
    close() {
      probe.destroy();
      for (const scene of ctx.scenes.values()) if (scene.battle !== probe) scene.battle.destroy();
    },
  };
  return ctx;
}

function decide(ctx, start, plan, given, gimmickUsed) {
  const { request } = ctx;
  const turn = { parts: [], taken: new Set(), gimmickUsed };
  for (const part of given) if (/^switch /.test(part ?? '')) turn.taken.add(Number(part.slice(7)));
  let state = start;
  const slots = [];
  const count = (request.forceSwitch ?? request.active).length;
  for (let i = 0; i < count; i++) {
    const info = given[i] ? { kind: 'given', choice: given[i] }
      : request.forceSwitch ? forcedSlot(ctx, i, turn) : commandSlot(ctx, seatOf(ctx, i, turn), state, plan, turn);
    if (!['item', 'given'].includes(info.kind) && info.choice !== 'default') info.choice = validate(ctx, i, info, turn);
    slots.push(info);
    if (info.choice === 'default') break;
    turn.parts.push(info.choice);
    if (/^switch /.test(info.choice)) turn.taken.add(Number(info.choice.slice(7)));
    if (/ (mega|terastallize)$/.test(info.choice)) turn.gimmickUsed = true;
    state = partState(state, info.choice);
  }
  const choice = slots.at(-1).choice === 'default' ? 'default' : turn.parts.join(', ');
  const info = count === 1 ? slots[0] : { kind: 'double', choice, slots };

  return { info, parts: request.forceSwitch ? null : turn.parts, gimmickUsed: turn.gimmickUsed };
}

function partState(s, part) {
  if (part === 'pass') return s;
  const lower = Math.max(s.switchCounter - 1, 0);
  if (part.startsWith('item ')) return { ...s, switchCounter: lower, ...(s.itemsLeft !== null ? { itemsLeft: Math.max(0, s.itemsLeft - 1) } : {}) };
  if (/^switch /.test(part)) return { ...s, switchCounter: s.switchCounter + 1 };
  return { ...s, switchCounter: lower };
}

function acceptedState(state, choice) {
  const parts = typeof choice === 'string' ? choice.split(',').map(part => part.trim()) : [''];
  return parts.reduce(partState, { switchCounter: state.switchCounter, itemsLeft: state.itemsLeft });
}

function accepts(ctx, parts, what) {
  const result = tryChoice(ctx.sim, ctx.json, ctx.seed, ctx.sideId, parts);
  if (result.error) ctx.problems.push({ type: 'degraded', what, choice: parts.at(-1), error: result.error });
  return result.accepted;
}

function commandSlot(ctx, seat, s, plan, turn) {
  const { opts, probe } = ctx;

  if (!seat.user || seat.user.fainted || seat.active.commanding) return { kind: 'pass', choice: 'pass' };
  if (plan && s.itemsLeft > 0 && wantsHeal(ctx, seat, plan.item)) {

    const koCheck = knockOutCheck(ctx, seat);
    if (!koCheck.ko) return { kind: 'item', choice: `item ${plan.item}`, itemsLeft: s.itemsLeft - 1, koCheck };
    return { kind: 'move', healSkipped: 'ko', ...chooseMove(ctx, seat) };
  }
  if (opts.tier === 'hidden' && probe.activePerHalf === 1) return chooseByLookahead(ctx, seat);
  const switched = opts.trainer && considerSwitch(ctx, seat, s.switchCounter, turn);
  // If the engine blocks the switch (trapped by a hidden ability etc.), fall through to move selection
  if (switched?.choice && !accepts(ctx, [...turn.parts, switched.choice], 'switch')) {
    switched.rejected = switched.choice;
    delete switched.choice;
  }
  if (switched?.choice) return { kind: 'switch', ...switched };
  return { kind: 'move', switchCheck: switched || null, ...chooseMove(ctx, seat) };
}

function wantsHeal(ctx, seat, item) {
  const { user } = seat;
  if (user.hp > user.maxhp * ctx.opts.policy.bossHeal.hpBelow) return false;
  return checkEnemyItem(ctx.probe, { item, position: seat.i, side: ctx.sideId }).ok;
}

function forcedSlot(ctx, i, turn) {
  if (!ctx.request.forceSwitch[i]) return { kind: 'pass', choice: 'pass' };
  return { kind: 'forceSwitch', ...chooseReplacement(ctx, i, turn) };
}

function chooseReplacement(ctx, i, turn) {
  const { probe, side, rng, request, opts, liveSide } = ctx;

  if (isReviving(request)) {
    const trainer = trainerOf(side.active[i]);
    const fainted = side.pokemon.map((pokemon, k) => ({ pokemon, index: k + 1 }))
      .filter(({ pokemon, index }) => pokemon.fainted && trainerOf(pokemon) === trainer && !turn.taken.has(index));
    if (!fainted.length) return { choice: 'default', revive: true };
    return { choice: `switch ${fainted[rng.int(fainted.length)].index}`, revive: true };
  }
  const scores = partyMatchupScores(probe, side, false, i, turn.taken);
  if (!scores.length) return { choice: 'pass', scores };
  if (opts.tier === 'easy') {

    const teamIndex = index => liveSide.team.indexOf(liveSide.pokemon[index - 1]?.set);
    const next = scores.slice().sort((a, b) => teamIndex(a.index) - teamIndex(b.index))[0];
    return { choice: `switch ${next.index}`, scores, order: 'team' };
  }
  return { choice: `switch ${nextSummonIndex(scores, rng)}`, scores };
}

function considerSwitch(ctx, seat, counter, turn) {
  const { probe, side, opts, rng } = ctx;
  if (opts.tier === 'easy') return null;
  const { user } = seat;

  if (user.getLockedMove()) return null;

  if (user.trapped || seat.active.trapped) return null;
  const partyScores = partyMatchupScores(probe, side, true, seat.i, turn.taken);
  if (!partyScores.length) return null;
  const opponents = user.foes();
  if (!opponents.length) return null;
  const matchupScore = opponents.reduce((sum, opp) => sum + getMatchupScore(probe, user, opp), 0) / opponents.length;
  const sorted = sortScores(partyScores);
  const switchMultiplier = 1 - (counter ? 0.1 ** (1 / counter) : 0);
  const threshold = matchupScore * ((opts.bossTrainer ? 2 : 3) + (opts.tier === 'normal' ? 1 : 0));
  const result = { activeScore: matchupScore, partyScores, switchMultiplier, threshold };
  if (sorted[0].score * switchMultiplier >= threshold) result.choice = `switch ${nextSummonIndex(partyScores, rng)}`;
  return result;
}

function usableMoves(active) {
  return (active?.moves || []).map((m, i) => ({ ...m, slot: i + 1 }))
    .filter(m => !m.disabled && (m.pp === undefined || m.pp > 0));
}

function seatOf(ctx, i, turn) {
  const seats = ctx.seats ??= [];
  if (!seats[i]) {
    const active = ctx.request.active[i];
    const gimmick = turn.gimmickUsed ? '' : chooseGimmick(active, ctx.liveSide.active[i], ctx.liveSide, ctx.opts);
    seats[i] = { i, active, user: ctx.side.active[i], gimmick };
  }
  return seats[i];
}

function aimsOf(ctx, seat, option, move) {
  const { user } = seat;
  const type = option.target ?? move.target;
  if (type === 'randomNormal' || type === 'scripted') {
    const foes = user.adjacentFoes();
    const targets = (type === 'randomNormal' && foes.length > 1 ? [foes[ctx.rng.int(foes.length)]] : foes.slice(0, 1))
      .map(pokemon => ({ loc: 0, pokemon }));
    return { spread: false, field: false, scripted: type === 'scripted', named: false, targets: targets.length ? targets : [{ loc: 0, pokemon: user }] };
  }
  const where = moveTargets(ctx.probe, user, type);
  const targets = where.targets.map(t => ({ loc: t.loc, pokemon: user.getAtLoc(t.loc) })).filter(t => t.pokemon && !t.pokemon.fainted);
  return { spread: where.spread, field: type === 'all', scripted: false, named: where.choose && option.target !== undefined && ctx.probe.activePerHalf > 1,
    targets: targets.length ? targets : [{ loc: user.getLocOf(user), pokemon: user }] };
}

function moveOf(ctx, seat, option) {
  const key = `${seat.i}|${option.slot}`;
  let e = ctx.rolls.get(key);
  if (e) return e;
  const move = ctx.probe.dex.moves.get(option.id);
  const aims = aimsOf(ctx, seat, option, move);
  const rollAt = pokemon => {
    const roll = rolloutMove(ctx.sim, ctx.json, ctx.seed, ctx.sideId, { position: seat.i, move: option.id, target: pokemon.getSlot(), gimmick: seat.gimmick });
    if (roll.error) ctx.problems.push({ type: 'degraded', what: 'rollout', move: option.id, error: roll.error });
    return roll;
  };
  let shared = null;
  const rollOf = target => (aims.spread ? (shared ??= rollAt(aims.targets[0].pokemon)) : (target.roll ??= rollAt(target.pokemon)));
  ctx.rolls.set(key, e = { option, move, aims, rollOf });
  return e;
}

function hitOn(roll, pokemon) {
  if (roll.error) return roll;
  const hit = roll.hits[pokemon.getSlot()];
  return { failed: roll.failed, basePower: roll.basePower, damage: hit?.damage ?? 0, ko: hit?.ko ?? false, typeMod: hit?.typeMod };
}

const foeTargets = (e, user) => e.aims.targets.filter(t => !user.isAlly(t.pokemon));

function knockedOut(e, user) {
  if (e.move.category === 'Status' || e.aims.scripted) return [];
  return foeTargets(e, user).filter(t => { const hit = hitOn(e.rollOf(t), t.pokemon); return !hit.failed && !!hit.ko; });
}

function rollMoves(ctx, seat, pool) {
  const rows = pool.map(option => moveOf(ctx, seat, option));
  for (const e of rows) for (const target of e.aims.targets) e.rollOf(target);
  return rows;
}

function knockOutCheck(ctx, seat) {
  const rows = rollMoves(ctx, seat, usableMoves(seat.active));
  const kos = rows.map(e => knockedOut(e, seat.user).length > 0);
  return { ko: kos.some(Boolean), moves: rows.map((e, k) => {
    const error = e.aims.targets.map(t => e.rollOf(t).error).find(Boolean);
    return { move: e.move.id, ko: kos[k], ...(error ? { error } : {}) };
  }) };
}

function gimmickScene(ctx, seat) {
  if (ctx.scenes.has(seat.i)) return ctx.scenes.get(seat.i);
  let battle = ctx.probe;
  if (seat.gimmick) {
    const copy = restore(ctx.sim, ctx.json, ctx.seed);
    try {
      applyGimmick(copy, ctx.sideId, seat.gimmick, seat.i);
      battle = copy;
    } catch (error) {
      copy.destroy();
      ctx.problems.push({ type: 'degraded', what: 'gimmick', gimmick: seat.gimmick, error: String(error?.message || error) });
    }
  }
  const scene = { battle, user: battle.getSide(ctx.sideId).active[seat.i] };
  ctx.scenes.set(seat.i, scene);
  return scene;
}

function scoring(ctx, seat, e, target) {
  const { battle, user } = gimmickScene(ctx, seat);
  return { ctx: { battle, user, move: e.move, activeMove: battle.dex.getActiveMove(e.option.id), entry: tableEntry(e.move.id, e.move),
    roll: hitOn(e.rollOf(target), target.pokemon), options: ctx.opts }, pokemon: atSlot(battle, target.pokemon.getSlot()) };
}

function pickTarget(ctx, seat, e, candidates) {
  if (candidates.length === 1) return candidates[0];
  const rows = candidates.map(target => {
    const { ctx: c, pokemon } = scoring(ctx, seat, e, target);
    return { target, weight: targetWeight(c, pokemon) };
  }).sort((a, b) => (a.weight < b.weight ? 1 : a.weight > b.weight ? -1 : 0));
  let weights = rows.map(row => row.weight);
  const lowest = weights.at(-1);
  if (lowest < 1) weights = weights.map(w => w + Math.abs(lowest - 1));
  const cutoff = weights.findIndex(w => w < weights[0] / 2);
  if (cutoff > -1) weights = weights.slice(0, cutoff);
  if (weights.length === 1 || ctx.opts.tier === 'max' || ctx.opts.tier === 'hidden') return rows[0].target;
  const total = weights.reduce((sum, w) => sum + w, 0);
  const roll = ctx.rng.int(total);
  let sum = 0;
  return rows[weights.findIndex(w => roll < (sum += w))].target;
}

function scoreMove(ctx, seat, e, koOnly) {
  const { aims } = e;
  if (aims.scripted) return { score: combineScores([], false), targets: aims.targets };
  const targets = aims.spread ? aims.targets : [pickTarget(ctx, seat, e, koOnly ? knockedOut(e, seat.user) : aims.targets)];
  const scores = targets.map(target => { const { ctx: c, pokemon } = scoring(ctx, seat, e, target); return targetScore(c, pokemon); });
  return { score: combineScores(scores, aims.spread && !aims.field), targets };
}

const movePart = (seat, e, target) => `move ${e.option.slot}${e.aims.named ? ` ${target.loc}` : ''}${seat.gimmick ? ` ${seat.gimmick}` : ''}`;

function rollSummary(e, user, targets) {
  const hits = targets.map(t => hitOn(e.rollOf(t), t.pokemon));
  const error = hits.find(hit => hit.error)?.error;
  if (error) return { error };
  const foes = hits.filter((hit, k) => !user.isAlly(targets[k].pokemon));
  return { damage: foes.reduce((sum, hit) => sum + hit.damage, 0), ko: foes.some(hit => hit.ko), failed: hits.some(hit => hit.failed) };
}

function chooseMove(ctx, seat) {
  const { opts, rng } = ctx;
  const pool = usableMoves(seat.active);
  if (!pool.length) return { choice: 'default', reason: 'no usable move' };
  if (pool.length === 1) {

    const e = moveOf(ctx, seat, pool[0]);
    if (!e.aims.named) return { choice: movePart(seat, e, e.aims.targets[0]), pool: pool.map(m => m.id) };
  }

  const evaluated = rollMoves(ctx, seat, pool);

  const ko = evaluated.filter(e => knockedOut(e, seat.user).length);
  const koOnly = ko.length > 0 && opts.tier !== 'easy';
  const scored = (koOnly ? ko : evaluated).map(e => {
    const { score, targets } = scoreMove(ctx, seat, e, koOnly);
    return { e, score, targets, roll: rollSummary(e, seat.user, targets) };
  });
  const sorted = scored.sort((a, b) => (a.score < b.score ? 1 : a.score > b.score ? -1 : 0));
  const chosen = pickIndex(sorted, opts, rng);
  const pick = sorted[chosen];
  return {
    choice: movePart(seat, pick.e, pick.targets[0]),
    koOnly: ko.length > 0,
    rank: chosen,
    ...(seat.gimmick ? { gimmick: seat.gimmick } : {}),
    scores: sorted.map(({ e, score, targets, roll }) => ({ move: e.move.id, slot: e.option.slot, score, ...roll,
      ...(e.aims.named ? { target: targets[0].loc } : {}) })),
  };
}

function pickIndex(sorted, opts, rng) {
  const smartRandom = () => {

    let chosen = 0;
    while (chosen < sorted.length - 1 && rng.int(8) >= 5) chosen++;
    return chosen;
  };
  switch (opts.tier) {
  case 'wild':

    if (!opts.bossPokemon) return smartRandom();
    break;
  case 'easy': {
    const roll = rng.int(10);
    if (roll < 4) return rng.int(sorted.length);
    if (roll < 7) {

      for (let i = sorted.length - 1; i > 0; i--) if (!sorted[i].roll.failed) return i;
      return 0;
    }
    return smartRandom();
  }
  case 'normal': {

    const best = sorted[0].score;
    if (!(best > 0)) return 0;
    const near = sorted.slice(0, 3).filter(e => e.score >= best / 3).length;
    return rng.int(near);
  }
  case 'max':
  case 'hidden':
    return 0;
  }

  let chosen = 0;
  while (chosen < sorted.length - 1) {
    const ratio = sorted[chosen + 1].score / sorted[chosen].score;
    if (!(ratio >= 0) || rng.int(100) >= Math.round(ratio * 50)) break;
    chosen++;
  }
  return chosen;
}

function chooseByLookahead(ctx, seat) {
  const { side, request } = ctx;
  const best = chooseMove(ctx, seat);
  const { user } = seat;
  const suffix = seat.gimmick ? ` ${seat.gimmick}` : '';
  const moves = best.scores
    ? [...best.scores.map(s => `move ${s.slot}${suffix}`), ...usableMoves(seat.active).map(m => `move ${m.slot}${suffix}`)]
    : [best.choice];
  const canSwitch = !user.getLockedMove() && !user.trapped && !request.active?.[0]?.trapped;
  const mine = [...new Set([...moves, ...(canSwitch ? switchChoices(ctx.probe, side) : [])])];
  if (mine.length === 1) return { kind: 'move', ...best };
  const looked = lookahead({ sim: ctx.sim, json: ctx.json, seed: ctx.seed, probe: ctx.probe, sideId: side.id, mine,
    forcedSwitches: ctx.opts.policy.forcedSwitches, problems: ctx.problems });
  if (!looked) return { kind: 'move', ...best };
  return { kind: looked.choice.startsWith('switch') ? 'switch' : 'move', ...best, choice: looked.choice, lookahead: looked };
}

function chooseGimmick(active, livePokemon, liveSide, opts) {
  if (!active) return '';
  const twin = twinSeat(liveSide);
  if (active.canMegaEvo && opts.mega && !twin?.pokemon.some(p => p.species.isMega)) return 'mega';
  if (!active.canTerastallize || !opts.trainer || opts.tera === 'never' || twin?.pokemon.some(p => p.terastallized)) return '';
  if (opts.tera === 'first') return 'terastallize';

  const teamIndex = livePokemon?.m.teamSlot ?? (livePokemon ? liveSide.team.indexOf(livePokemon.set) : -1);
  const teamSize = liveSide.team.length + (twin?.team.length ?? 0);
  const slots = opts.tera === 'ace' ? [opts.policy.aceSlot(teamSize)] : Array.isArray(opts.tera) ? opts.tera : [];
  return slots.includes(teamIndex) ? 'terastallize' : '';
}

function validate(ctx, i, info, turn) {
  const tries = [info.choice];
  if (/ (mega|terastallize)$/.test(info.choice)) tries.push(info.choice.replace(/ (mega|terastallize)$/, ''));
  const firstUsable = usableMoves(ctx.request.active?.[i])[0];
  if (firstUsable) {
    const seat = seatOf(ctx, i, turn), e = moveOf(ctx, seat, firstUsable);
    tries.push(`move ${firstUsable.slot}${e.aims.named ? ` ${e.aims.targets[0].loc}` : ''}`);
  }
  const choice = tries.find(choice => accepts(ctx, [...turn.parts, choice], 'validate')) ?? 'default';
  if (choice !== info.choice) {
    info.rejected = info.choice;
    ctx.problems.push({ type: 'rejected', choice: info.choice, fallback: choice });
  }
  return choice;
}

function keptParts(info, given) {
  const decided = (info.slots ?? []).slice(0, -1).map(slot => slot.choice);
  return [...decided, ...given.slice(decided.length)];
}

function fallbackChoice(battle, liveSide, request, kept) {
  const entries = request.forceSwitch ?? request.active;
  if (entries.length === 1 && !kept[0]) return 'default';
  const taken = new Set(kept.filter(part => /^switch /.test(part ?? '')).map(part => Number(part.slice(7))));
  const reviving = isReviving(request);
  return entries.map((entry, i) => {
    if (kept[i]) return kept[i];
    if (request.forceSwitch) {
      if (!entry) return 'pass';
      const trainer = trainerOf(liveSide.active[i]);
      const k = request.side.pokemon.findIndex((p, j) => !taken.has(j + 1) && !p.active && / fnt$/.test(p.condition) === reviving
        && trainerOf(liveSide.pokemon[j]) === trainer);
      if (k < 0) return 'pass';
      taken.add(k + 1);
      return `switch ${k + 1}`;
    }
    const pokemon = liveSide.active[i];
    if (!pokemon || pokemon.fainted || entry.commanding) return 'pass';
    const own = pokemon.getMoves();
    const slot = 1 + Math.max(0, entry.moves.findIndex((m, k) => !m.disabled && !(own[k]?.id === m.id && own[k].disabled)));
    const type = entry.moves[slot - 1]?.target;
    const where = type !== undefined && battle.activePerHalf > 1 ? moveTargets(battle, pokemon, type) : null;
    const to = where?.choose ? where.targets.find(t => !t.ally) ?? where.targets[0] : null;
    return `move ${slot}${to ? ` ${to.loc}` : ''}`;
  }).join(', ');
}
