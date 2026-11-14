import { snapshot, restore } from './engine-copy.js';
import { partyMatchupScores, sortScores } from './matchup.js';
import { deriveSeed } from './rng.js';

const PESSIMISM = 0.7;
const SWITCHES = 2;
const BEAM = 2;
const REPLIES = 2;

export function moveChoices(pokemon, suffix = '') {
  if (!pokemon || pokemon.fainted) return [];
  return pokemon.moveSlots.map((slot, i) => (!slot.disabled && slot.pp > 0 ? `move ${i + 1}${suffix}` : null)).filter(Boolean);
}

export function switchChoices(battle, side, count = SWITCHES) {
  const scores = partyMatchupScores(battle, side, true);
  return sortScores(scores).slice(0, count).map(s => `switch ${s.index}`);
}

export function lookahead({ sim, json, seed, probe, sideId, mine, forcedSwitches, problems }) {
  const foe = probe.getSide(sideId).foe;
  const theirs = [...moveChoices(foe.active[0]), ...switchChoices(probe, foe)];
  if (!theirs.length) theirs.push('default');
  let sims = 0, rejected = 0;
  const turn = (from, branchSeed, choice, reply) => {
    sims++;
    const out = play(sim, from, branchSeed, sideId, choice, reply, forcedSwitches);
    if (out.rejected) rejected++;
    else if (out.error) problems.push({ type: 'degraded', what: 'lookahead', choice, reply, error: out.error });
    else if (out.capped) problems.push({ type: 'capped', cap: 'forcedSwitches', limit: forcedSwitches, choice, reply });
    return out.copy ?? null;
  };
  const rows = [], retained = new Set();
  const destroy = copy => { retained.delete(copy); copy.destroy(); };
  const discard = reply => {
    if (!reply.next) return;
    destroy(reply.next.copy);
    reply.next = null;
  };
  try {
    mine.forEach((choice, i) => {
      const replies = [];
      theirs.forEach((reply, j) => {
        const copy = turn(json, deriveSeed('look', ...seed, i, j), choice, reply);
        if (!copy) return;
        retained.add(copy);
        const side = copy.getSide(sideId);
        replies.push({ reply, value: value(copy, sideId),
          next: copy.ended ? null : { copy, mine: moveChoices(side.active[0]), theirs: moveChoices(side.foe.active[0]) } });
        if (copy.ended) destroy(copy);
        // Appending replies cannot bring an already discarded reply back into
        // the worst two. Include ended replies so ties and deep seeds stay put.
        const keep = new Set(worstReplies(replies));
        for (const entry of replies) if (!keep.has(entry)) discard(entry);
      });
      if (replies.length) rows.push({ choice, order: i, replies, value: combine(replies.map(r => r.value)) });
      // Retain at most two replies for each of the best two rows, plus the
      // current row. Serialize only the positions actually searched next.
      const keep = new Set(rows.slice().sort(rankRows).slice(0, BEAM));
      for (const row of rows) if (!keep.has(row)) row.replies.forEach(discard);
    });
    if (!rows.length) return null;
    rows.sort(rankRows);
    if (rows.length > 1) {
      for (const row of rows.slice(0, BEAM)) {
        row.deep = combine(worstReplies(row.replies).map((reply, k) => {
          if (!reply.next || !reply.next.mine.length || !reply.next.theirs.length) return reply.value;
          const { copy, mine, theirs } = reply.next;
          const next = copyJson(copy);
          discard(reply);
          let best = -Infinity;
          mine.forEach((choice, e) => {
            const values = [];
            theirs.forEach((answer, p) => {
              const branch = turn(next, deriveSeed('look2', ...seed, row.order, k, e, p), choice, answer);
              if (!branch) return;
              try { values.push(value(branch, sideId)); } finally { branch.destroy(); }
            });
            if (values.length) best = Math.max(best, combine(values));
          });
          return best === -Infinity ? reply.value : best;
        }));
      }
    }
    const deep = rows.filter(row => row.deep !== undefined);
    const pick = deep.length ? deep.reduce((a, b) => (b.deep > a.deep || (b.deep === a.deep && b.order < a.order) ? b : a)) : rows[0];
    return { choice: pick.choice, sims, rejected, rows: rows.map(r => ({ choice: r.choice, value: round(r.value), ...(r.deep !== undefined ? { deep: round(r.deep) } : {}) })) };
  } finally {
    for (const copy of retained) copy.destroy();
  }
}

const rankRows = (a, b) => b.value - a.value || a.order - b.order;
const worstReplies = replies => replies.slice().sort((a, b) => a.value - b.value).slice(0, REPLIES);
const round = x => Math.round(x * 1000) / 1000;
const combine = values => PESSIMISM * Math.min(...values) + (1 - PESSIMISM) * values.reduce((s, v) => s + v, 0) / values.length;

function play(sim, json, seed, sideId, mine, theirs, cap) {
  const copy = restore(sim, json, seed);
  try {
    copy.randomizer = baseDamage => Math.floor(baseDamage * 0.925);
    copy.onEvent('CriticalHit', copy.format, (crit, target, source, move) => move?.willCrit === true);
    const foeId = sideId === 'p1' ? 'p2' : 'p1';
    if (copy.choose(sideId, mine) === false || copy.choose(foeId, theirs) === false) { copy.destroy(); return { rejected: true }; }
    for (let filled = 0; !copy.ended; filled++) {
      const pending = copy.sides.filter(side => side.requestState === 'switch' && !side.isChoiceDone());
      if (!pending.length) break;
      if (filled === cap) { copy.destroy(); return { capped: true }; }
      for (const side of pending) copy.choose(side.id, 'default');
    }
    return { copy };
  } catch (error) {
    copy.destroy();
    return { error: String(error?.message || error) };
  }
}

// Value of the position as seen from sideId
function value(battle, sideId) {
  const side = battle.getSide(sideId);
  if (battle.ended) {
    if (side.foe.pokemonLeft === 0 && side.pokemonLeft > 0) return 100;
    if (side.pokemonLeft === 0 && side.foe.pokemonLeft > 0) return -100;
    return 0;
  }
  return teamValue(side) - teamValue(side.foe);
}

function teamValue(side) {
  let total = 0;
  for (const pokemon of side.pokemon) {
    if (pokemon.fainted || pokemon.hp <= 0) continue;
    total += 1 + pokemon.hp / pokemon.maxhp - (pokemon.status ? (pokemon.status === 'slp' || pokemon.status === 'frz' ? 0.25 : 0.15) : 0);
  }
  const active = side.active[0];
  if (active && !active.fainted) {
    const b = active.boosts;
    total += 0.04 * Math.max(-6, Math.min(6, b.atk + b.def + b.spa + b.spd + b.spe));
  }
  return total;
}

function copyJson(copy) {
  delete copy.randomizer;
  return snapshot(copy);
}
