import { createStoryBattle } from '../engine/core.mjs';
import { engineMember } from '../engine/input.mjs';
import { displayName } from '../engine/mon.mjs';
import { newMovePp } from '../engine/pp.mjs';
import { summaryView } from './summary.js';
import { createLearnSteps, learnMoveOption, loadExpText } from './steps-exp.js';
import { PLAYER_NAME } from '../story/rules.mjs';
import { DEFAULT_LANG } from './lang.js';
import { DEFAULT_FORMAT } from '../engine/rules.mjs';

const OUTSIDE_SEED = [1, 2, 3, 4];
const langOf = ctx => ctx.lang ?? DEFAULT_LANG;

function readOutside(ctx, mon, read) {
  const { sim } = ctx;
  if (!mon?.set?.species) throw new TypeError('Story mon with set is required');
  const fainted = mon.hp === 0 || mon.status === 'fnt';

  const member = { ...engineMember(mon, ctx.customItems), uid: mon.uid ?? 'outside' };
  if (fainted) Object.assign(member, { hp: 1, status: '' });
  const foe = { uid: 'outside-foe', set: structuredClone(mon.set) };
  const spec = {
    seed: OUTSIDE_SEED, formatid: ctx.formatid || DEFAULT_FORMAT,
    p1: { name: ctx.trainer || PLAYER_NAME, team: [member] }, p2: { name: '-', team: [foe] },
  };
  const options = ctx.exp && ctx.levelUp ? { exp: ctx.exp, levelUp: ctx.levelUp } : {};
  const battle = createStoryBattle(sim, spec, options);
  try {
    return read({ battle, pokemon: battle.sides[0].pokemon[0], fainted, options });
  } finally {
    battle.destroy();
  }
}

export const outsideName = (ctx, battle, set, species = set.species) => displayName(battle.dex, ctx.names, species, set.name);

function monViewOf(ctx, { battle, pokemon, fainted }, mon, species) {
  const sp = battle.dex.species.get(species ?? pokemon.baseSpecies.name);
  const name = species ? outsideName(ctx, battle, mon.set, sp.name) : outsideName(ctx, battle, mon.set);
  return {
    speciesId: sp.id, spriteId: sp.spriteid, name, level: pokemon.level, gender: pokemon.gender || '', shiny: !!pokemon.set.shiny,
    hp: fainted ? 0 : pokemon.hp, maxhp: pokemon.maxhp, status: fainted ? '' : pokemon.status || '',
  };
}

// Current move slots (LearnMoveOption[])
const moveOptions = (ctx, { battle, pokemon }) => pokemon.baseMoveSlots.map(slot => learnMoveOption(battle, ctx.names, slot.id, slot.pp, slot.maxpp, langOf(ctx)));

function newMoveOption(ctx, battle, move) {
  const pp = newMovePp(battle, move);
  return learnMoveOption(battle, ctx.names, move.id, pp, pp, langOf(ctx));
}

export function outsideSummarySlot(ctx, mon) {
  return readOutside(ctx, mon, made => {
    const { battle, pokemon, fainted, options } = made;
    const entry = battle.sides[0].getRequestData().pokemon[0];
    const summary = summaryView(battle, ctx.names, entry, pokemon, options, langOf(ctx));
    if (fainted) summary.stats = { ...summary.stats, hp: 0 };
    return { ...monViewOf(ctx, made, mon), active: false, fainted, summary };
  });
}

export async function showOutsideSummary({ view, ctx, mon, onRename }) {
  await loadExpText(langOf(ctx));
  const slot = outsideSummarySlot(ctx, mon);
  await view.prepareOutside({ mons: [slot] });
  let nickname = null;
  const rename = onRename && (async value => {
    const accepted = await onRename(value);
    if (accepted === false) return null;
    nickname = value;
    return value || ctx.names.species(slot.speciesId);
  });
  await view.showSummary(slot, rename ? { rename } : {});
  return { nickname };
}

export function outsidePartyViews(ctx, party, mon) {
  const list = Array.isArray(party) && party.some(m => m?.uid === mon.uid) ? party : [mon];
  const views = list.map(member => {
    const shown = member.uid === mon.uid ? mon : member;
    return readOutside(ctx, shown, made => monViewOf(ctx, made, shown));
  });
  return { views, cursor: Math.max(0, list.findIndex(m => m?.uid === mon.uid)) };
}

export async function learnMoveOutside({ view, ctx, mon, move: moveId, party }) {
  await loadExpText(langOf(ctx));
  const plan = readOutside(ctx, mon, made => {
    const { battle, pokemon } = made;
    const move = battle.dex.moves.get(moveId);
    if (!move.exists) throw new TypeError(`Unknown move: ${moveId}`);
    if (pokemon.baseMoveSlots.some(slot => slot.id === move.id)) return null;
    return { shown: { ...monViewOf(ctx, made, mon), dexNumber: pokemon.baseSpecies.num }, moves: moveOptions(ctx, made), newMove: newMoveOption(ctx, battle, move) };
  });
  if (!plan) return { learned: false };
  const backdrop = outsidePartyViews(ctx, party, mon);
  await view.prepareOutside({ mons: [plan.shown] });
  await view.startPartyScene({ party: backdrop.views, cursor: backdrop.cursor });
  try {
    return await learnOne({ view, lang: langOf(ctx), ...plan, inEvolution: false });
  } finally {
    await view.endPartyScene();
  }
}

async function learnOne({ view, lang, shown, moves, newMove, inEvolution }) {
  const { learned, learnFlow } = createLearnSteps(view, lang);
  if (moves.length < 4) {
    await learned(shown.name, newMove.name, inEvolution);
    moves.push(newMove);
    return { learned: true };
  }
  let picked = null;
  await learnFlow({ mon: shown, moves: [...moves], newMove, inEvolution, commit: slot => { picked = slot; } });
  if (picked === null) return { learned: false };
  const forgot = moves[picked].id;
  moves[picked] = newMove;
  return { learned: true, forgot };
}

export async function evolveOutside({ view, ctx, mon, into, learn = [] }) {
  await loadExpText(langOf(ctx));
  const plan = readOutside(ctx, mon, made => {
    const { battle } = made;
    const to = battle.dex.species.get(into);
    if (!to.exists) throw new TypeError(`Unknown species: ${into}`);
    const newMoves = learn.map(id => battle.dex.moves.get(id)).filter(move => move.exists).map(move => newMoveOption(ctx, battle, move));
    return { from: monViewOf(ctx, made, mon), target: monViewOf(ctx, made, mon, to.name), dexNumber: to.num, moves: moveOptions(ctx, made), newMoves };
  });
  const { say, sayTimed } = createLearnSteps(view, langOf(ctx));
  const { from, target, moves } = plan;
  await view.prepareOutside({ mons: [from, target] });
  await view.startEvolution(from);
  try {
    await say('menu.evolving', { pokemonName: from.name }, false);
    const evolved = !!await view.evolve(target, { canCancel: true });
    if (!evolved) {
      await say('menu.stoppedEvolving', { pokemonName: from.name });
      return { evolved: false, learned: [] };
    }
    await sayTimed('menu.evolutionDone', { pokemonName: from.name, evolvedPokemonName: target.name }, { promptDelay: 4000 });

    const shown = { ...target, dexNumber: plan.dexNumber };
    const learned = [];
    for (const newMove of plan.newMoves) {
      if (moves.some(m => m.id === newMove.id)) continue;
      learned.push({ move: newMove.id, ...await learnOne({ view, lang: langOf(ctx), shown, moves, newMove, inEvolution: true }) });
    }
    return { evolved: true, learned };
  } finally {
    await view.endEvolution();
  }
}
