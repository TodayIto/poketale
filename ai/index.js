// from pokerogue src/phases/enemy-command-phase.ts, src/field/pokemon.ts (getNextMove), src/field/trainer.ts @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-10-30. See view/LICENSE-NOTE.md.

import { snapshot, restore, rolloutMove, tryChoice, applyGimmick } from './engine-copy.js';
import { partyMatchupScores, getMatchupScore, sortScores, nextSummonIndex } from './matchup.js';
import { moveScore, tableEntry } from './move-score.js';
import { liveSeedText, deriveSeed, createRng } from './rng.js';
import { lookahead, switchChoices } from './lookahead.js';
import { DEFAULT_POLICY, bossHealItems } from './policy.js';
import { checkEnemyItem } from '../engine/bag.mjs';
import { holdDecision } from './commit.js';
import { simpleAI } from '../director/simple-ai.js';

export { DEFAULT_POLICY, bossHealItems };

// Difficulties on the settings screen (in ascending order)
export const DIFFICULTIES = ['easy', 'normal', 'hard', 'max'];

export function aiTier({ trainer = true, difficulty = 'normal', boss = false } = {}) {
  if (!trainer) return 'wild';
  const level = DIFFICULTIES.includes(difficulty) ? DIFFICULTIES.indexOf(difficulty) : 1;
  if (!boss) return DIFFICULTIES[level];
  return level === DIFFICULTIES.length - 1 ? 'hidden' : DIFFICULTIES[level + 1];
}

export function createEnemyAI(sim, options = {}) {
  const policy = options.policy ?? DEFAULT_POLICY;
  const opts = { trainer: true, difficulty: 'normal', boss: false, bossPokemon: false, mega: policy.megaAsap, ...options, policy };
  opts.bossTrainer ??= opts.boss;
  opts.tera ??= opts.bossTrainer ? policy.tera.bossTrainer : policy.tera.trainer;
  opts.tier = aiTier(opts);

  const states = new WeakMap();
  const stateOf = battle => {
    if (!states.has(battle)) states.set(battle, { switchCounter: 0, itemsLeft: null });
    return states.get(battle);
  };
  const healPlan = liveSide => {
    if (!opts.trainer || !opts.boss || opts.healItems === false) return null;
    return opts.healItems ?? bossHealItems(liveSide.team.map(set => set.level || 100), policy);
  };
  const report = info => {
    if (opts.onDecision) opts.onDecision(info);
    else if (info.kind === 'error' || info.problems) console.warn('[enemy AI]', info.kind === 'error' ? `${info.stage}: ${info.error}` : info.problems);
  };

  function enemyAI(battle, sideId) {
    const t0 = now();
    const liveSide = battle.getSide(sideId);
    const request = liveSide.activeRequest;
    if (!request || request.wait) throw new Error(`${sideId}: 기다리는 중인 요청에는 AI 를 부르지 않는다`);
    if (request.teamPreview) return 'default';

    if (battle.activePerHalf > 1) return simpleAI(battle, sideId);
    const state = stateOf(battle);
    const plan = sideId === 'p2' ? healPlan(liveSide) : null;
    if (plan && state.itemsLeft === null) state.itemsLeft = plan.count;
    const problems = [];
    let ctx = null, decision;
    try {
      ctx = openDecision(sim, battle, sideId, request, liveSide, opts, problems);
      decision = decide(ctx, state, plan);
      if (decision.info.kind !== 'item') decision.info.choice = validate(ctx, decision.info);
    } catch (error) {

      decision = { info: { kind: 'error', stage: error?.stage ?? 'decide', error: String(error?.stack || error), choice: 'default' }, next: null };
    } finally {
      ctx?.close();
    }
    const { info, next } = decision;
    if (problems.length) info.problems = problems;
    info.tier = opts.tier;

    const forced = !!request.forceSwitch, decided = info.choice;
    holdDecision(battle, sideId, accepted => {
      if (forced) return;
      const live = stateOf(battle);
      if (accepted === decided) { if (next) Object.assign(live, next); return; }
      Object.assign(live, acceptedState(live, accepted));
    });
    info.ms = now() - t0;
    report(info);
    return info.choice;
  }

  enemyAI.saveState = battle => {
    const state = stateOf(battle);
    return { switchCounter: state.switchCounter, ...(state.itemsLeft !== null ? { itemsLeft: state.itemsLeft } : {}) };
  };
  enemyAI.loadState = (battle, saved) => {
    states.set(battle, { switchCounter: Number(saved?.switchCounter) || 0,
      itemsLeft: Number.isInteger(saved?.itemsLeft) ? saved.itemsLeft : null });
  };
  enemyAI.tier = opts.tier;
  return enemyAI;
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
    gimmick: request.forceSwitch ? '' : chooseGimmick(request.active?.[0], liveSide, opts),
    rolls: new Map(),
    scene: null,
    close() { probe.destroy(); if (ctx.scene && ctx.scene.battle !== probe) ctx.scene.battle.destroy(); },
  };
  return ctx;
}

// This decision's choice and the AI state to apply if it is accepted (null = unchanged)
function decide(ctx, state, plan) {
  const { request, opts } = ctx;
  if (request.forceSwitch) return { info: { kind: 'forceSwitch', ...chooseReplacement(ctx) }, next: null };
  const counter = state.switchCounter;
  const lower = Math.max(counter - 1, 0);
  if (plan && state.itemsLeft > 0 && wantsHeal(ctx, plan.item)) {

    const koCheck = knockOutCheck(ctx);
    if (!koCheck.ko) {
      const itemsLeft = state.itemsLeft - 1;
      return { info: { kind: 'item', choice: `item ${plan.item}`, itemsLeft, koCheck }, next: { itemsLeft, switchCounter: lower } };
    }
    return { info: { kind: 'move', healSkipped: 'ko', ...chooseMove(ctx) }, next: { switchCounter: lower } };
  }
  if (opts.tier === 'hidden') {
    const info = chooseByLookahead(ctx);
    return { info, next: { switchCounter: info.kind === 'switch' ? counter + 1 : lower } };
  }
  const switched = opts.trainer && considerSwitch(ctx, counter);

  // If the engine blocks the switch (trapped by a hidden ability etc.), fall through to move selection
  if (switched?.choice && !accepts(ctx, switched.choice, 'switch')) {
    switched.rejected = switched.choice;
    delete switched.choice;
  }
  if (switched?.choice) return { info: { kind: 'switch', ...switched }, next: { switchCounter: counter + 1 } };
  return { info: { kind: 'move', switchCheck: switched || null, ...chooseMove(ctx) }, next: { switchCounter: lower } };
}

function acceptedState(state, choice) {
  const text = typeof choice === 'string' ? choice : '';
  const lower = Math.max(state.switchCounter - 1, 0);
  if (text.startsWith('item ')) return { switchCounter: lower, ...(state.itemsLeft !== null ? { itemsLeft: Math.max(0, state.itemsLeft - 1) } : {}) };
  if (text.startsWith('switch')) return { switchCounter: state.switchCounter + 1 };
  return { switchCounter: lower };
}

function accepts(ctx, choice, what) {
  const result = tryChoice(ctx.sim, ctx.json, ctx.seed, ctx.sideId, choice);
  if (result.error) ctx.problems.push({ type: 'degraded', what, choice, error: result.error });
  return result.accepted;
}

function wantsHeal(ctx, item) {
  const user = ctx.side.active[0];
  if (!user || user.fainted || user.hp > user.maxhp * ctx.opts.policy.bossHeal.hpBelow) return false;
  return checkEnemyItem(ctx.probe, { item }).ok;
}

function chooseReplacement(ctx) {
  const { probe, side, rng, request, opts, liveSide } = ctx;

  if (request?.side?.pokemon?.some(p => p.active && p.reviving)) {
    const fainted = side.pokemon.map((pokemon, i) => ({ pokemon, index: i + 1 })).filter(({ pokemon }) => pokemon.fainted);
    if (!fainted.length) return { choice: 'default', revive: true };
    return { choice: `switch ${fainted[rng.int(fainted.length)].index}`, revive: true };
  }
  const scores = partyMatchupScores(probe, side, false);
  if (!scores.length) return { choice: 'pass', scores };
  if (opts.tier === 'easy') {

    const teamIndex = index => liveSide.team.indexOf(liveSide.pokemon[index - 1]?.set);
    const next = scores.slice().sort((a, b) => teamIndex(a.index) - teamIndex(b.index))[0];
    return { choice: `switch ${next.index}`, scores, order: 'team' };
  }
  return { choice: `switch ${nextSummonIndex(scores, rng)}`, scores };
}

function considerSwitch(ctx, counter) {
  const { probe, side, request, opts, rng } = ctx;
  if (opts.tier === 'easy') return null;
  const user = side.active[0];

  if (!user || user.getLockedMove()) return null;

  if (user.trapped || request.active?.[0]?.trapped) return null;
  const partyScores = partyMatchupScores(probe, side, true);
  if (!partyScores.length) return null;
  const opponents = side.foe.active.filter(p => p && !p.fainted && p.hp > 0);
  if (!opponents.length) return null;
  const matchupScore = opponents.reduce((sum, opp) => sum + getMatchupScore(probe, user, opp), 0) / opponents.length;
  const sorted = sortScores(partyScores);
  const switchMultiplier = 1 - (counter ? 0.1 ** (1 / counter) : 0);
  const threshold = matchupScore * ((opts.bossTrainer ? 2 : 3) + (opts.tier === 'normal' ? 1 : 0));
  const result = { activeScore: matchupScore, partyScores, switchMultiplier, threshold };
  if (sorted[0].score * switchMultiplier >= threshold) result.choice = `switch ${nextSummonIndex(partyScores, rng)}`;
  return result;
}

function usableMoves(request) {
  return (request.active?.[0]?.moves || []).map((m, i) => ({ ...m, slot: i + 1 }))
    .filter(m => !m.disabled && (m.pp === undefined || m.pp > 0));
}

const gimmickSuffix = ctx => (ctx.gimmick ? ` ${ctx.gimmick}` : '');

function evaluate(ctx, option) {
  let e = ctx.rolls.get(option.slot);
  if (!e) {
    const roll = rolloutMove(ctx.sim, ctx.json, ctx.seed, ctx.sideId, option.id, ctx.gimmick);
    if (roll.error) ctx.problems.push({ type: 'degraded', what: 'rollout', move: option.id, error: roll.error });
    ctx.rolls.set(option.slot, e = { option, move: ctx.probe.dex.moves.get(option.id), roll });
  }
  return e;
}

const knocksOut = e => e.move.category !== 'Status' && e.move.target !== 'scripted' && !e.roll.failed && !!e.roll.ko;

function knockOutCheck(ctx) {
  const rows = usableMoves(ctx.request).map(option => evaluate(ctx, option));
  return { ko: rows.some(knocksOut), moves: rows.map(e => ({ move: e.move.id, ko: !!e.roll.ko, ...(e.roll.error ? { error: e.roll.error } : {}) })) };
}

function gimmickScene(ctx) {
  if (ctx.scene) return ctx.scene;
  let battle = ctx.probe;
  if (ctx.gimmick) {
    const copy = restore(ctx.sim, ctx.json, ctx.seed);
    try {
      applyGimmick(copy, ctx.sideId, ctx.gimmick);
      battle = copy;
    } catch (error) {
      copy.destroy();
      ctx.problems.push({ type: 'degraded', what: 'gimmick', gimmick: ctx.gimmick, error: String(error?.message || error) });
    }
  }
  const side = battle.getSide(ctx.sideId);
  return ctx.scene = { battle, user: side.active[0], foe: side.foe.active[0] };
}

function chooseMove(ctx) {
  const { opts, rng } = ctx;
  const pool = usableMoves(ctx.request);
  if (!pool.length) return { choice: 'default', reason: 'no usable move' };
  const suffix = gimmickSuffix(ctx);
  if (pool.length === 1) return { choice: `move ${pool[0].slot}${suffix}`, pool: pool.map(m => m.id) };

  // Use each move once on an engine copy
  const evaluated = pool.map(option => evaluate(ctx, option));

  const ko = evaluated.filter(knocksOut);
  const candidates = ko.length && opts.tier !== 'easy' ? ko : evaluated;
  const { battle, user, foe } = gimmickScene(ctx);
  const scored = candidates.map(e => ({ ...e, score: moveScore({ battle, user, foe, move: e.move, activeMove: battle.dex.getActiveMove(e.option.id),
    entry: tableEntry(e.move.id, e.move), roll: e.roll, options: opts }) }));
  const sorted = scored.sort((a, b) => (a.score < b.score ? 1 : a.score > b.score ? -1 : 0));
  const chosen = pickIndex(sorted, opts, rng);
  const pick = sorted[chosen];
  return {
    choice: `move ${pick.option.slot}${suffix}`,
    koOnly: ko.length > 0,
    rank: chosen,
    ...(ctx.gimmick ? { gimmick: ctx.gimmick } : {}),
    scores: sorted.map(e => ({ move: e.move.id, slot: e.option.slot, score: e.score,
      damage: e.roll.damage, ko: e.roll.ko, failed: e.roll.failed, ...(e.roll.error ? { error: e.roll.error } : {}) })),
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

function chooseByLookahead(ctx) {
  const { side, request } = ctx;
  const best = chooseMove(ctx);
  const user = side.active[0];
  const suffix = gimmickSuffix(ctx);
  const moves = best.scores
    ? [...best.scores.map(s => `move ${s.slot}${suffix}`), ...usableMoves(request).map(m => `move ${m.slot}${suffix}`)]
    : [best.choice];
  const canSwitch = !user?.getLockedMove() && !user?.trapped && !request.active?.[0]?.trapped;
  const mine = [...new Set([...moves, ...(canSwitch ? switchChoices(ctx.probe, side) : [])])];
  if (mine.length === 1) return { kind: 'move', ...best };
  const looked = lookahead({ sim: ctx.sim, json: ctx.json, seed: ctx.seed, probe: ctx.probe, sideId: side.id, mine,
    forcedSwitches: ctx.opts.policy.forcedSwitches, problems: ctx.problems });
  if (!looked) return { kind: 'move', ...best };
  return { kind: looked.choice.startsWith('switch') ? 'switch' : 'move', ...best, choice: looked.choice, lookahead: looked };
}

function chooseGimmick(active, liveSide, opts) {
  if (!active) return '';
  if (active.canMegaEvo && opts.mega) return 'mega';
  if (!active.canTerastallize || !opts.trainer || opts.tera === 'never') return '';
  if (opts.tera === 'first') return 'terastallize';

  const livePokemon = liveSide.pokemon.find(p => p.isActive);
  const teamIndex = livePokemon ? liveSide.team.indexOf(livePokemon.set) : -1;
  const slots = opts.tera === 'ace' ? [opts.policy.aceSlot(liveSide.team.length)] : Array.isArray(opts.tera) ? opts.tera : [];
  return slots.includes(teamIndex) ? 'terastallize' : '';
}

function validate(ctx, info) {
  const tries = [info.choice];
  if (/ (mega|terastallize)$/.test(info.choice)) tries.push(info.choice.replace(/ (mega|terastallize)$/, ''));
  const firstUsable = usableMoves(ctx.request)[0];
  if (firstUsable) tries.push(`move ${firstUsable.slot}`);
  const choice = tries.find(choice => accepts(ctx, choice, 'validate')) ?? 'default';
  if (choice !== info.choice) {
    info.rejected = info.choice;
    ctx.problems.push({ type: 'rejected', choice: info.choice, fallback: choice });
  }
  return choice;
}
