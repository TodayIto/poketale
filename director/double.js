import { positionAt } from './read.js';
import { moveTargets } from './targets.js';
import { ownText } from './text.js';
import { isReviving, lockedTurn } from './simple-ai.js';
import { BALLS } from '../engine/capture.mjs';
import { gimmickOptions, gimmickSuffix } from './steps-mega.js';

export async function chooseDouble(ctx, request) {
  return request.forceSwitch ? forcedSwitches(ctx, request) : commands(ctx, request);
}

function withChosen(ctx, party, chosen) {
  return party.map((slot, i) => (chosen.has(i) && !slot.blocked ? { ...slot, blocked: ownText('own.alreadyChosen', { pokemonName: slot.name }, ctx.lang) } : slot));
}

export function autoPick(battle, request, i) {
  const active = request.active[i], pokemon = battle.sides[0].active[i];
  if (!pokemon || pokemon.fainted || active.commanding) return 'pass';
  if (lockedTurn(active)) return 'move 1';
  return null;
}

export const joinParts = parts => (parts.some(part => typeof part === 'object') ? { parts } : parts.join(', '));

async function forcedSwitches(ctx, request) {
  const reviving = isReviving(request);
  const party = ctx.partySlots(request, { reviving });
  return forcedPicks(request, party, async (i, chosen) => {
    const slots = withChosen(ctx, party, chosen);
    const choice = await ctx.view.chooseSwitch({ party: slots, forced: true, position: positionAt(0, i), ...(reviving ? { revive: true } : {}) });
    return { text: ctx.switchChoice(choice, slots, { reviving }), slot: choice.slot };
  });
}

export async function forcedPicks(request, party, pickOwn) {
  const reviving = isReviving(request);
  const chosen = new Set();
  const open = () => party.map((slot, j) => j).filter(j => !chosen.has(j) && !party[j].partner
    && (reviving ? party[j].fainted : !party[j].fainted && !party[j].active));
  const picks = [];
  for (const asked of request.forceSwitch) {
    const candidates = asked ? open() : [];
    if (!candidates.length) { picks.push('pass'); continue; }
    const pick = await pickOwn(picks.length, chosen, candidates);
    if (!pick) return null;
    picks.push(pick.text);
    chosen.add(pick.slot);
  }
  return picks.join(', ');
}

async function commands(ctx, request) {
  const { battle, view, run, bag } = ctx;
  const picks = [];
  for (let i = 0; i < request.active.length;) {
    const auto = autoPick(battle, request, i);
    if (auto) { picks[i++] = auto; continue; }

    const asked = picks.some(pick => typeof pick === 'object');
    const chosen = new Set(picks.filter(pick => pick?.slot !== undefined).map(pick => pick.slot));

    const taken = new Map();
    for (const pick of picks) if (pick?.bag) taken.set(pick.bag.item, (taken.get(pick.bag.item) ?? 0) + 1);
    const choice = await view.chooseAction(commandOptions(ctx, request, i, chosen, taken, { back: asked, gimmickUsed: picks.some(pick => pick?.gimmick) }));
    if (choice?.kind === 'back') {
      if (!asked) throw new Error('Invalid player choice');
      picks.length = 0; i = 0;
      continue;
    }
    if (choice?.kind === 'run') return run.choice();
    if (choice?.kind === 'item' && bag) {
      const pick = bag.choice(choice, i, taken);
      if (pick.bag.item in BALLS) return pick;
      picks[i++] = pick;
      continue;
    }
    picks[i] = pickOf(ctx, request, i, choice, chosen);
    i++;
  }
  return joinParts(picks.map(pick => (typeof pick === 'string' || pick.bag ? pick : pick.text)));
}

function commandOptions(ctx, request, i, chosen, taken, { back, gimmickUsed }) {
  const { battle, names, lang, run, gimmicks, bag } = ctx;
  const active = request.active[i], pokemon = battle.sides[0].active[i];
  const moves = active.moves.map(option => {
    const move = battle.dex.moves.get(option.id);
    const where = moveTargets(battle, pokemon, option.target ?? move.target);
    return {
      id: option.id, name: names.move(option.id),
      pp: option.pp, maxpp: option.maxpp, disabled: !!option.disabled,
      ...(option.disabled || (option.pp ?? 1) <= 0 ? { blocked: ctx.moveDeniedText(battle, names, option, lang, pokemon) } : {}),

      ...ctx.moveInfo(option.id, pokemon, firstFoe(where, pokemon) ?? battle.sides[1].active.find(p => p && !p.fainted)),
      target: { choose: where.choose, spread: where.spread, targets: where.targets.map(t => t.position) },
    };
  });
  const party = withChosen(ctx, ctx.partySlots(request, { trapped: !!active.trapped }), chosen);
  return {
    position: positionAt(0, i), ...(back ? { back: true } : {}), moves, canSwitch: true, party,

    ...(gimmickUsed ? {} : gimmickOptions(request, gimmicks, i)),
    ...(bag ? { bag: bag.menu(i, taken) } : {}),
    run: run.menu(),
  };
}

function firstFoe(where, pokemon) {
  const foe = where.targets.find(t => !t.ally);
  return foe ? pokemon.getAtLoc(foe.loc) : null;
}

function pickOf(ctx, request, i, choice, chosen) {
  const { battle } = ctx;
  if (choice?.kind === 'switch') {
    const slots = withChosen(ctx, ctx.partySlots(request, { trapped: !!request.active[i].trapped }), chosen);
    return { text: ctx.switchChoice(choice, slots), slot: choice.slot };
  }
  const active = request.active[i], pokemon = battle.sides[0].active[i];
  const option = active.moves[choice?.index];
  if (choice?.kind !== 'move' || !option || option.disabled) throw new Error('Invalid player choice');
  const where = moveTargets(battle, pokemon, option.target ?? battle.dex.moves.get(option.id).target);
  let loc = '';
  if (where.choose) {
    const target = where.targets.length === 1 && !choice.target ? where.targets[0] : where.targets.find(t => t.position === choice.target);
    if (!target) throw new Error('Invalid player choice');
    loc = ` ${target.loc}`;
  }
  const suffix = gimmickSuffix(choice, request, ctx.gimmicks, i);
  return { text: `move ${choice.index + 1}${loc}${suffix}`, gimmick: !!suffix };
}
