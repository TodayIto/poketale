import { createStoryBattle } from '../engine/core.mjs';
import { engineMember } from '../engine/input.mjs';
import { STATS, displayName, spriteIdOf } from '../engine/mon.mjs';
import { newMovePp } from '../engine/pp.mjs';
import { summaryView } from './summary.js';
import { createLearnSteps, learnMoveOption, loadExpText } from './steps-exp.js';
import { PLAYER_NAME, EV_TOTAL_MAX, sameNickname } from '../story/rules.mjs';
import { DEFAULT_LANG } from './lang.js';
import { DEFAULT_FORMAT } from '../engine/rules.mjs';
import { enjoymentOf, fullnessOf, gameCandidates } from '../story/amie.mjs';
import { GAMES, LEVELS } from '../story/amie-games.mjs';
import { FIND_ORDER, BAG_IDS, BAG_SIZES, EFFECT_BAGS, SOOTHING_BAG, bagOf, traineeOf, hungBagOf, ENERGY_MAX, effortOn } from '../story/training.mjs';
import { foodList, puffFood } from '../story/panel.mjs';
import { canSpin, evolutionChoices, evolutionFlips } from '../engine/evolution.mjs';
import { friendshipOf, friendshipLine, isEgg } from '../story/state.mjs';
import { sayer } from '../story/screen-text.mjs';
import { withParticle } from '../story/diary.mjs';
import { EGG_SPRITE } from '../engine/breeding.mjs';
import { friendshipLocked } from '../engine/friendship.mjs';

const OUTSIDE_SEED = [1, 2, 3, 4];
const langOf = ctx => ctx.lang ?? DEFAULT_LANG;

function readOutside(ctx, mon, read) {
  const { sim } = ctx;
  if (!mon?.set?.species) throw new TypeError('Story mon with set is required');
  const fainted = mon.hp === 0 || mon.status === 'fnt';
  const format = ctx.battleFormat || DEFAULT_FORMAT;

  const member = { ...engineMember(mon, ctx.customItems), uid: mon.uid ?? 'outside' };
  if (fainted) Object.assign(member, { hp: 1, status: '' });
  const foe = { uid: 'outside-foe', set: structuredClone(mon.set) };
  const spec = {
    seed: OUTSIDE_SEED, formatid: format,
    p1: { name: ctx.trainer || PLAYER_NAME, team: [member] }, p2: { name: '-', team: [foe] },
  };
  const options = ctx.exp && ctx.levelUp ? { exp: ctx.exp, levelUp: ctx.levelUp } : {};
  const battle = createStoryBattle(sim, spec, options);
  try {
    return read({ battle, pokemon: battle.sides[0].pokemon[0], fainted, options, format });
  } finally {
    battle.destroy();
  }
}

export const outsideName = (ctx, battle, set, species = set.species) => displayName(battle.dex, ctx.names, species, set.name);

function monViewOf(ctx, { battle, pokemon, fainted }, mon, species) {
  const sp = battle.dex.species.get(species ?? pokemon.baseSpecies.name);
  const name = species ? outsideName(ctx, battle, mon.set, sp.name) : outsideName(ctx, battle, mon.set);
  return {
    speciesId: sp.id, spriteId: spriteIdOf(sp), name, level: pokemon.level, gender: pokemon.gender || '', shiny: !!pokemon.set.shiny,
    hp: fainted ? 0 : pokemon.hp, maxhp: pokemon.maxhp, status: fainted ? '' : pokemon.status || '',
  };
}

const moveOptions = (ctx, { battle, pokemon }) => pokemon.baseMoveSlots.map(slot => learnMoveOption(battle, ctx.names, slot.id, slot.pp, slot.maxpp, langOf(ctx)));

function newMoveOption(ctx, battle, move) {
  const pp = newMovePp(battle, move);
  return learnMoveOption(battle, ctx.names, move.id, pp, pp, langOf(ctx));
}

export function outsideSummarySlot(ctx, mon) {
  return readOutside(ctx, mon, made => {
    const { battle, pokemon, fainted, options, format } = made;
    const entry = battle.sides[0].getRequestData().pokemon[0];
    const summary = summaryView(battle, ctx.names, entry, pokemon, options, langOf(ctx));
    if (fainted) summary.stats = { ...summary.stats, hp: 0 };
    if (effortOn(ctx.sim, format)) summary.evs = Object.fromEntries(STATS.map(s => [s, pokemon.set.evs?.[s] ?? 0]));

    const bond = friendshipLine(mon, ctx, langOf(ctx));
    if (bond) summary.bond = bond;
    return { ...monViewOf(ctx, made, mon), active: false, fainted, summary };
  });
}

export async function showOutsideSummary({ view, ctx, mon, onRename }) {
  await loadExpText(langOf(ctx));
  const slot = outsideSummarySlot(ctx, mon);
  await view.prepareOutside({ mons: [slot] });
  let nickname = null;

  let current = { nickname: mon.set.name ?? '', shown: slot.name };
  const rename = onRename && (async value => {
    if (sameNickname(value, current)) return null;
    const accepted = await onRename(value);
    if (accepted === false) return null;
    nickname = value;
    current = { nickname: value, shown: value || ctx.names.species(slot.speciesId) };
    return current.shown;
  });
  await view.showSummary(slot, rename ? { rename } : {});
  return { nickname };
}

export function outsidePartyViews(ctx, party, mon) {
  const list = Array.isArray(party) && party.some(m => m?.uid === mon.uid) ? party.filter(m => !isEgg(m)) : [mon];
  const views = list.map(member => {
    const shown = member.uid === mon.uid ? mon : member;
    return readOutside(ctx, shown, made => monViewOf(ctx, made, shown));
  });
  return { views, cursor: Math.max(0, list.findIndex(m => m?.uid === mon.uid)) };
}

export function learnModel(ctx, mon, moveId) {
  return readOutside(ctx, mon, made => {
    const { battle, pokemon } = made;
    const move = battle.dex.moves.get(moveId);
    if (!move.exists) throw new TypeError(`Unknown move: ${moveId}`);
    if (pokemon.baseMoveSlots.some(slot => slot.id === move.id)) return null;
    return { shown: { ...monViewOf(ctx, made, mon), dexNumber: pokemon.baseSpecies.num }, moves: moveOptions(ctx, made), newMove: newMoveOption(ctx, battle, move) };
  });
}

export function rememberModel(ctx, mon, moves) {
  return readOutside(ctx, mon, ({ battle }) => moves.map(({ move, level }) => ({ ...newMoveOption(ctx, battle, battle.dex.moves.get(move)), level })));
}

export async function learnMoveOutside({ view, ctx, mon, move: moveId, party }) {
  await loadExpText(langOf(ctx));
  const plan = learnModel(ctx, mon, moveId);
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

export async function rememberMoveOutside({ view, ctx, mon, moves, party }) {
  await loadExpText(langOf(ctx));
  const options = rememberModel(ctx, mon, moves);
  const backdrop = outsidePartyViews(ctx, party, mon);
  await view.prepareOutside({ mons: [] });
  const picked = await view.chooseRememberMove({ party: backdrop.views, cursor: backdrop.cursor, moves: options });
  return picked === null ? null : options[picked].id;
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

export async function evolveOutside({ view, ctx, mon, into, learn = () => [] }) {
  await loadExpText(langOf(ctx));
  const choices = evolutionChoices(ctx.sim.Dex, mon.set.species, into);

  const plan = readOutside(ctx, mon, made => {
    const { battle } = made;
    const target = species => {
      const to = battle.dex.species.get(species);
      if (!to.exists) throw new TypeError(`Unknown species: ${species}`);
      const newMoves = learn(to.name).map(id => battle.dex.moves.get(id)).filter(move => move.exists).map(move => newMoveOption(ctx, battle, move));
      return { species: to.name, view: monViewOf(ctx, made, mon, to.name), dexNumber: to.num, newMoves };
    };
    return { from: monViewOf(ctx, made, mon), targets: (choices.length ? choices.map(c => c.species) : [into]).map(target), moves: moveOptions(ctx, made) };
  });
  const { say, sayTimed, chooseForm } = createLearnSteps(view, langOf(ctx));
  const { from, moves } = plan;
  await view.prepareOutside({ mons: [from, ...plan.targets.map(t => t.view)] });
  await view.startEvolution(from);

  const result = { evolved: false, into: ctx.sim.Dex.species.get(into).name, learned: [] };
  try {
    const picked = choices.length ? await chooseForm(choices) : result.into;
    const target = plan.targets.find(t => t.species === picked)?.view;
    if (picked) {
      result.into = picked;
      await say('menu.evolving', { pokemonName: from.name }, false);
      result.evolved = !!await view.evolve(target, { canCancel: true, flip: evolutionFlips(ctx.sim.Dex, picked) });
    }
    if (!result.evolved) await say('menu.stoppedEvolving', { pokemonName: from.name });
    else {
      await sayTimed('menu.evolutionDone', { pokemonName: from.name, evolvedPokemonName: target.name }, { promptDelay: 4000 });

      const { dexNumber, newMoves } = plan.targets.find(t => t.species === picked);
      const shown = { ...target, dexNumber };
      for (const newMove of newMoves) {
        if (moves.some(m => m.id === newMove.id)) continue;
        result.learned.push({ move: newMove.id, ...await learnOne({ view, lang: langOf(ctx), shown, moves, newMove, inEvolution: true }) });
      }
    }
    await view.endEvolution();
  } catch (error) {

    if (!view.closed) throw error;
  }
  return result;
}

export async function hatchOutside({ view, ctx, mon }) {
  const lang = langOf(ctx), say = sayer(lang);
  const hatched = readOutside(ctx, mon, made => monViewOf(ctx, made, mon));
  const egg = { ...hatched, speciesId: EGG_SPRITE, spriteId: EGG_SPRITE, name: say('panel.egg'), gender: '', shiny: false };
  await view.prepareOutside({ mons: [egg, hatched] });
  await view.startEvolution(egg);
  try {
    await view.message(say('egg.oh'), { wait: false, hold: 0 });
    await view.evolve(hatched, { canCancel: false });
    await view.message(say('egg.hatched', { mon: withParticle(lang, hatched.name, '이/가') }), { wait: true, promptDelay: 4000 });
    await view.endEvolution();
  } catch (error) {
    if (!view.closed) throw error;
  }
  return { shown: true };
}

export const amieDebugLine = (say, { enjoy, max, full, friendship, now, locked = false }) => say(locked ? 'amie.debugLocked' : 'amie.debug', { enjoy, max, full, friendship, now });

const AMIE_BIOME = 'grass';

export async function amieOutside({ view, ctx, mon, state = null, party = [], debug = false, awake = false, trainWhy = null, lock = null }) {
  const plan = readOutside(ctx, mon, made => {
    const species = made.pokemon.species;
    return { shown: monViewOf(ctx, made, mon), ids: [species.id, made.battle.dex.species.get(species.baseSpecies).id], num: species.num };
  });

  const others = gameCandidates(party, mon).map(other => ({ ...readOutside(ctx, other, made => monViewOf(ctx, made, other)), uid: other.uid, enjoy: enjoymentOf(other) }));
  const lang = langOf(ctx), say = sayer(lang);
  const food = entry => ({ ...entry, icon: entry.grade ? { puff: entry.fed.puff } : foodIcon(entry.icon, entry.fed.item) });
  const foods = state ? foodList(state, ctx.sim, lang).map(food) : [];
  const words = {
    feed: say('amie.feed'), play: say('amie.play'), train: say('amie.train'), highFive: say('amie.highFive'),
    enjoy: say('amie.enjoy'), fullness: say('amie.fullness'), prev: say('window.prevPage'), next: say('window.nextPage'),
    foodTitle: say('amie.foodTitle'),
    playTitle: say('amie.playTitle'), levelTitle: say('amie.levelTitle'), time: say('amie.time'), ready: say('amie.ready'), go: say('amie.go'), fever: say('amie.fever'), gameBack: say('amie.gameBack'), again: say('amie.again'),
    games: Object.fromEntries(GAMES.map(game => [game, say(`amie.game.${game}`)])), levels: Object.fromEntries(LEVELS.map(lv => [lv, say(`amie.level.${lv}`)])),
    score: Object.fromEntries(GAMES.map(game => [game, values => say(`amie.score.${game}`, values)])),
    debug: values => amieDebugLine(say, values), lock: say('import.friendshipLock'), unlock: say('import.friendshipUnlock'), back: say('window.back'), close: say('screen.close'),

    arrived: say('screen.replyArrived'), quitAsk: say('amie.quitAsk'), yes: say('panel.yes'), no: say('panel.no'),
  };
  await view.prepareOutside({ mons: [plan.shown, ...others] });
  const result = { spent: 0, gains: [], friends: [], done: [], spin: null, train: false };
  try {
    const { spent, gains, friends, done, spin, train } = await view.startAmie({
      mon: plan.shown, num: plan.num, biome: AMIE_BIOME, species: plan.ids, enjoy: enjoymentOf(mon), full: fullnessOf(mon), friendship: friendshipOf(ctx, mon),
      party: others, foods, puffFood: id => food(puffFood(id, lang)), words, debug, spins: canSpin(ctx.sim.Dex, { species: mon.set.species, item: mon.set.item }),
      awake, trainWhy: trainWhy ? say(`panel.trainWhy.${trainWhy}`) : null, lock: debug && lock ? { on: friendshipLocked(mon), set: lock } : null,
      onChange: now => Object.assign(result, { spent: now.spent, gains: now.gains, friends: now.friends ?? [], done: now.done }),
    });
    Object.assign(result, { spent, gains, friends: friends ?? [], done, spin: spin ?? null, train: !!train });
  } catch (error) {

    if (!view.closed) throw error;
  }
  return result;
}

const TRAINING_BIOME = 'dojo';

export async function trainingOutside({ view, ctx, mon }) {
  const plan = readOutside(ctx, mon, made => ({ shown: monViewOf(ctx, made, mon), base: { ...made.pokemon.species.baseStats } }));
  const say = sayer(langOf(ctx));
  const stat = Object.fromEntries(STATS.map(s => [s, say(`stat.${s}`)]));
  const bagName = id => { const bag = bagOf(id); return bag.kind === 'stat' ? say('train.bag.stat', { stat: stat[bag.stat], size: bag.size.toUpperCase() }) : say(`train.bag.${id}`); };
  const words = {
    bags: say('train.bags'), pick: say('train.pick'), resetNote: say('train.resetNote'), hung: say('train.hung'), next: say('train.next'),
    back: say('window.back'), close: say('screen.close'), prevPage: say('window.prevPage'), nextPage: say('window.nextPage'), sizeTitle: say('train.sizeTitle'),
    size: Object.fromEntries(BAG_SIZES.map(size => [size, say(`train.size.${size}`)])), gain: Object.fromEntries(BAG_SIZES.map(size => [size, say(`train.gain.${size}`)])),
    noEffect: say('panel.noEffect'), reset: say('train.reset'), empty: say('train.empty'),
    energy: say('train.energy'), arrived: say('screen.replyArrived'),
    stat, bag: Object.fromEntries([...BAG_IDS, ...FIND_ORDER.filter(Boolean)].map(id => [id, bagName(id)])),

    effect: Object.fromEntries([...EFFECT_BAGS, SOOTHING_BAG].map(id => [id, say(`train.effect.${id}`)])),
    found: values => say('train.found', values),
    replace: values => say('train.replace', values),
  };
  await view.prepareOutside({ mons: [plan.shown] });
  const hung = hungBagOf(mon);
  const result = { bags: [], hung };
  try {
    const { bags, hung: left } = await view.startTraining({
      mon: plan.shown, biome: TRAINING_BIOME, base: plan.base, trainee: traineeOf(mon), hung, energyMax: ENERGY_MAX, words,
      onChange: now => Object.assign(result, now),
    });
    Object.assign(result, { bags, hung: left });
  } catch (error) {

    if (!view.closed) throw error;
  }
  return result;
}

function foodIcon(icon, id) {
  if (icon?.emoji !== undefined) return { emoji: icon.emoji };
  if (icon?.sheet === 'pokerogue') return { atlas: 'bag_items', frame: id };
  if (icon?.sheet === 'showdown') return { sheet: icon.num };
  return null;
}
