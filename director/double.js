import { positionAt } from './read.js';
import { moveTargets } from './targets.js';
import { ownText } from './text.js';
import { isReviving, lockedTurn } from './simple-ai.js';
import { BALLS } from '../engine/capture.mjs';
import { gimmickOptions, gimmickSuffix, zMoveOptions, maxMoveOptions, maxEntries, maxDeniedSource, prefetchCutIns } from './steps-mega.js';

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
    const partner = ctx.partner?.();
    const choice = await ctx.view.chooseSwitch({ party: slots, forced: true, position: positionAt(0, i), ...(reviving ? { revive: true } : {}),
      ...(partner ? { partner } : {}) });
    return { text: ctx.switchChoice(choice, slots, { reviving }), slot: choice.slot };
  });
}

export async function forcedPicks(request, party, pickOwn) {
  const reviving = isReviving(request);
  const chosen = new Set();
  const open = () => party.map((slot, j) => j).filter(j => !chosen.has(j)
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
  prefetchCutIns(battle, view, request, ctx.gimmicks); // the Z cut-in art of whoever can use a Z-Move this turn
  for (let i = 0; i < request.active.length;) {
    const auto = autoPick(battle, request, i);
    if (auto) { picks[i++] = auto; continue; }

    const asked = picks.some(pick => typeof pick === 'object');
    const chosen = new Set(picks.filter(pick => pick?.slot !== undefined).map(pick => pick.slot));

    const taken = new Map();
    for (const pick of picks) if (pick?.bag) taken.set(pick.bag.item, (taken.get(pick.bag.item) ?? 0) + 1);

    const used = { gimmick: picks.some(pick => pick?.gimmick), z: picks.some(pick => pick?.z) };
    const options = commandOptions(ctx, request, i, chosen, taken, { back: asked, used });
    const choice = await view.chooseAction(options);
    if (choice?.kind === 'back') {
      if (!asked) throw new Error('Invalid player choice');
      picks.length = 0; i = 0;
      continue;
    }
    if (choice?.kind === 'run') return run.choice(); // the whole side runs (or forfeits), from either position
    if (choice?.kind === 'item' && bag) {
      const pick = bag.choice(choice, options.party, i, taken); // its slot is a slot of the party screen shown
      if (pick.bag.item in BALLS) return pick; // a ball takes the whole side's turn
      picks[i++] = pick;
      continue;
    }
    picks[i] = pickOf(ctx, request, i, choice, chosen, used);
    i++;
  }
  return joinParts(picks.map(pick => (typeof pick === 'string' || pick.bag ? pick : pick.text)));
}

function commandOptions(ctx, request, i, chosen, taken, { back, used }) {
  const { battle, names, lang, run, gimmicks, bag } = ctx;
  const active = request.active[i], pokemon = battle.sides[0].active[i];
  const anyFoe = () => battle.sides[1].active.find(p => p && !p.fainted);
  const targetOf = where => ({ choose: where.choose, spread: where.spread, targets: where.targets.map(t => t.position) });

  const maxed = maxEntries(request, pokemon, i);
  const moves = active.moves.map((option, slot) => {
    const move = battle.dex.moves.get(option.id);
    const where = moveTargets(battle, pokemon, maxed?.[slot]?.target ?? option.target ?? move.target);
    const blocked = maxed ? (maxed[slot]?.disabled ? { ...option, disabledSource: maxDeniedSource(pokemon) } : null)
      : option.disabled || (option.pp ?? 1) <= 0 ? option : null;
    return {
      id: option.id, name: names.move(option.id),
      pp: option.pp, maxpp: option.maxpp, disabled: maxed ? !!maxed[slot]?.disabled : !!option.disabled,
      ...(blocked ? { blocked: ctx.moveDeniedText(battle, names, blocked, lang, pokemon) } : {}),

      ...ctx.moveInfo(option.id, pokemon, firstFoe(where, pokemon) ?? anyFoe()),
      target: targetOf(where),
    };
  });

  const zWhere = entry => moveTargets(battle, pokemon, entry.target);
  const z = used.z ? null : zMoveOptions(ctx, request, gimmicks, i, pokemon, entry => firstFoe(zWhere(entry), pokemon) ?? anyFoe(),
    entry => ({ target: targetOf(zWhere(entry)) }));

  const dynamax = maxMoveOptions(ctx, request, used.gimmick ? { ...gimmicks, dynamax: false } : gimmicks, i, pokemon,
    entry => firstFoe(zWhere(entry), pokemon) ?? anyFoe(), entry => ({ target: targetOf(zWhere(entry)) }));
  const party = withChosen(ctx, ctx.partySlots(request, { trapped: !!active.trapped }), chosen);
  const partner = ctx.partner?.(); // the party screen's partner page (a tag battle) - view only
  return {
    position: positionAt(0, i), ...(back ? { back: true } : {}), moves, canSwitch: true, party, ...(partner ? { partner } : {}),

    ...(used.gimmick ? {} : gimmickOptions(request, gimmicks, i)),
    ...(z ? { z } : {}),
    ...dynamax,
    ...(bag ? { bag: bag.menu(party, i, taken) } : {}),
    run: run.menu(),
  };
}

/** The first foe a move can reach (move menu effectiveness hint) */
function firstFoe(where, pokemon) {
  const foe = where.targets.find(t => !t.ally);
  return foe ? pokemon.getAtLoc(foe.loc) : null;
}

function pickOf(ctx, request, i, choice, chosen, used) {
  const { battle } = ctx;
  if (choice?.kind === 'switch') {
    const slots = withChosen(ctx, ctx.partySlots(request, { trapped: !!request.active[i].trapped }), chosen);
    return { text: ctx.switchChoice(choice, slots), slot: choice.slot };
  }
  const active = request.active[i], pokemon = battle.sides[0].active[i];
  const option = active.moves[choice?.index];
  if (choice?.kind !== 'move' || !option) throw new Error('Invalid player choice');

  const suffix = gimmickSuffix(choice, request, ctx.gimmicks, i, used);
  const z = suffix === ' zmove';

  const maxed = maxEntries(request, pokemon, i, suffix === ' dynamax')?.[choice.index];
  if (maxed ? maxed.disabled : option.disabled) throw new Error('Invalid player choice');

  const where = moveTargets(battle, pokemon, z ? request.active[i].canZMove[choice.index].target
    : maxed?.target ?? option.target ?? battle.dex.moves.get(option.id).target);
  let loc = '';
  if (where.choose) {
    const target = where.targets.length === 1 && !choice.target ? where.targets[0] : where.targets.find(t => t.position === choice.target);
    if (!target) throw new Error('Invalid player choice');
    loc = ` ${target.loc}`;
  }
  return { text: `move ${choice.index + 1}${loc}${suffix}`, ...(z ? { z: true } : { gimmick: !!suffix }) };
}
