import { expTextBase64 } from './text-exp-source.js';
import { interpolate } from './text.js';
import { expForLevel, levelForExp, replaceMove } from '../engine/exp.mjs';
import { newMovePp } from '../engine/pp.mjs';
import { MAX_LEVEL, NON_HP_STATS } from '../engine/mon.mjs';
import { createLedger } from './ledger.js';
import { identName } from './read.js';
import { ownTemplate } from './own-text.js';

// Lines this module handles (steps.js dispatch table)
export const EXP_KINDS = ['-story-exp', '-story-levelup', '-story-learnmove', '-story-movequeue', '-story-replacemove', '-story-skipmove'];
let phrases, pendingText;

export function loadExpText() {
  return pendingText ??= (async () => {
    const bytes = Uint8Array.from(atob(expTextBase64()), c => c.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    phrases = JSON.parse(await new Response(stream).text());
    return phrases;
  })().catch(error => { pendingText = undefined; throw error; });
}

function requireExpText() {
  if (!phrases) throw new Error('Exp text is not loaded: await loadExpText() first');
  return phrases;
}

// Synchronous text lookup. Await loadExpText() in an async step before calling.
export function expText(key, values = {}, { keepCodes = false } = {}) {
  const phrases = requireExpText();
  if (ownTemplate(key)) return interpolate(ownTemplate(key), values);
  if (key === '_source' || !Object.hasOwn(phrases, key)) throw new Error(`Unknown exp text key: ${key}`);

  const result = interpolate(phrases[key], values);
  return keepCodes ? result : result.replace(/@[ds]\{[^}]*\}/g, '');
}

export function learnMoveOption(battle, names, id, pp, maxpp) {
  const phrases = requireExpText();
  const move = battle.dex.moves.get(id);
  return {
    id: move.id, name: names.move(move.id), type: move.type, category: move.category, pp, maxpp,

    power: move.category !== 'Status' && move.basePower > 0 ? move.basePower : null,
    accuracy: move.accuracy === true ? null : move.accuracy,
    description: phrases[`move.${move.id}`] ?? '',
  };
}

const newMovePP = newMovePp;

export function createLearnSteps(view) {
  const say = (key, values, wait = true) => view.message(expText(key, values), wait ? { wait } : { wait, hold: 0 });

  const sayTimed = (key, values, timing) => view.message(expText(key, values), { wait: true, ...timing });

  const fanfare = () => { Promise.resolve(view.playFanfare()).catch(() => {}); };

  async function learnFlow({ mon, moves, newMove, commit, inEvolution = false }) {
    await loadExpText();
    const pokemonName = mon.name, moveName = newMove.name;
    while (true) {
      await say('battle.learnMovePrompt', { pokemonName, moveName });
      await say('battle.learnMoveLimitReached', { pokemonName });
      await say('battle.learnMoveReplaceQuestion', { moveName }, false);
      if (await view.confirm()) {
        await say('battle.learnMoveForgetQuestion');
        const slot = await view.chooseForgetMove({ mon, moves, newMove });
        if (Number.isInteger(slot) && slot >= 0 && slot < moves.length) {
          await commit(slot);

          await view.message(expText('battle.countdownPoof', {}, { keepCodes: true }), { wait: true });
          await say('battle.learnMoveForgetSuccess', { pokemonName, moveName: moves[slot].name });
          await say('battle.learnMoveAnd');
          await learned(pokemonName, moveName, inEvolution);
          return slot;
        }
      }

      await say('battle.learnMoveStopTeaching', { moveName }, false);
      if (await view.confirm()) {
        await commit(null);
        await say('battle.learnMoveNotLearned', { pokemonName, moveName });
        return null;
      }
    }
  }

  async function learned(pokemonName, moveName, inEvolution) {
    fanfare();
    if (inEvolution) await sayTimed('battle.learnMove', { pokemonName, moveName }, { hold: 1000 });
    else await say('battle.learnMove', { pokemonName, moveName });
  }

  return { say, sayTimed, fanfare, learned, learnFlow };
}

export function createExpSteps({ battle, view, names, warn, ledger = createLedger({ battle, names }), options = {}, mode = {}, onInput }) {
  const table = options.exp, levelUp = options.levelUp;
  const party = () => battle.sides?.[0]?.pokemon ?? [];
  const byUid = uid => party().find(p => p.m?.uid === uid);
  const growthOf = p => {
    const row = table?.species?.[battle.dex.species.get(p.set.species).num];
    return row ? table.growthRates[row[1]] : null;
  };
  const statsOf = p => ({ hp: p.baseMaxhp, ...Object.fromEntries(NON_HP_STATS.map(s => [s, p.baseStoredStats[s]])) });

  const tracked = new Map();
  for (const p of party()) {
    if (p.m?.exp === undefined) continue;
    tracked.set(p.m.uid, { exp: p.m.exp, level: p.level, stats: statsOf(p), growth: growthOf(p) });
  }

  // Lines we produced ourselves via replaceMove (their text was already shown in the prompt flow)
  const expected = [];

  const displayName = p => (p.name === p.species.name || p.name === p.species.baseSpecies ? names.species(p.species.id) : p.name);
  const { say, sayTimed, fanfare, learned, learnFlow } = createLearnSteps(view);

  function levelRatio(growth, exp) {
    if (!growth) return null;
    const level = levelForExp(growth, exp);
    if (level >= MAX_LEVEL) return { level, ratio: 0 };
    const low = expForLevel(growth, level), high = expForLevel(growth, level + 1);
    return { level, ratio: Math.max(0, Math.min(1, (exp - low) / (high - low))) };
  }

  const onField = uid => ledger.field.player === uid;
  const nameOf = (uid, ident) => ledger.pokemon.get(uid)?.name ?? identName(ident);

  // Summary and learn-move screens (chosen now, so current engine values)
  const iconMon = p => ({ speciesId: p.species.id, spriteId: p.species.spriteid, name: displayName(p), level: p.level,
    gender: p.gender || '', shiny: !!p.set.shiny, hp: p.hp, maxhp: p.maxhp, status: p.status || '' });

  function summonInfo(side, uid) {
    if (side !== 'player') return {};
    const record = tracked.get(uid);
    const shown = record && levelRatio(record.growth, record.exp);
    return shown ? { exp: shown.ratio } : {};
  }

  const mergedFrom = new Map();

  async function showLevelUp(ident, uid, level, stats, prev) {
    const next = { hp: stats.maxhp, ...Object.fromEntries(NON_HP_STATS.map(s => [s, stats[s]])) };
    fanfare();
    const message = say('battle.levelUp', { pokemonName: nameOf(uid, ident), level });
    if (onField(uid)) {
      await Promise.all([message, view.updateLevel('player', { level, hp: stats.hp, maxhp: stats.maxhp })]);
    } else await message;
    await view.showLevelUpStats({ prev, next });
  }

  function summaryMon(p) {
    return { ...iconMon(p), dexNumber: p.species.num };
  }

  async function present(event) {
    const { kind, args: a } = event;

    await loadExpText();
    switch (kind) {
    case '-story-exp': {

      const [ident, uid, gain, total] = a, record = tracked.get(uid), p = byUid(uid);
      if (!record || !p) { warn(`${kind}:unknown uid`); return; }
      const target = levelRatio(record.growth, Number(total));

      if (event.sharedFirst) await say('own.expShare');
      if (onField(uid)) {
        await say('battle.expGain', { pokemonName: nameOf(uid, ident), exp: Number(gain) });
        if (target) await view.gainExp('player', target);
      } else {
        const { tera, ...icon } = ledger.view(ledger.pokemon.get(uid));
        await view.partyExp(icon, Number(gain));
      }
      record.exp = Number(total);
      if (target) record.level = target.level;
      return;
    }
    case '-story-levelup': {
      const [ident, uid, level, json] = a, record = tracked.get(uid);
      const stats = JSON.parse(json), next = { hp: stats.maxhp, ...Object.fromEntries(NON_HP_STATS.map(s => [s, stats[s]])) };
      const prev = mergedFrom.get(uid) ?? record?.stats ?? next;
      if (record) { record.stats = next; record.level = Number(level); }
      if (event.merged) { mergedFrom.set(uid, prev); return; }
      mergedFrom.delete(uid);
      await showLevelUp(ident, uid, Number(level), stats, prev);
      return;
    }
    case '-story-learnmove': {
      const [ident, uid, moveName] = a;
      await learned(nameOf(uid, ident), names.move(battle.dex.toID(moveName)), false);
      return;
    }
    case '-story-movequeue': {
      if (mode.silent) return;

      const [, uid, moveName] = a, p = byUid(uid);
      if (!p) { warn(`${kind}:unknown uid`); return; }
      const move = battle.dex.moves.get(moveName);
      const pp = newMovePP(battle, move);
      const moves = p.baseMoveSlots.map(s => learnMoveOption(battle, names, s.id, s.pp, s.maxpp));
      await learnFlow({ mon: summaryMon(p), moves, newMove: learnMoveOption(battle, names, move.id, pp, pp), commit: slot => {
        onInput?.(['learn', uid, slot, move.id]);
        replaceMove(battle, uid, slot, move.id);
        expected.push(`${slot === null ? '-story-skipmove' : '-story-replacemove'}|${uid}|${move.name}`);
      } });
      return;
    }
    case '-story-replacemove':
    case '-story-skipmove': {
      const key = `${kind}|${a[1]}|${a.at(-1)}`, at = expected.indexOf(key);
      if (at >= 0) { expected.splice(at, 1); return; }

      const pokemonName = nameOf(a[1], a[0]);
      const moveName = names.move(battle.dex.toID(a.at(-1)));
      if (kind === '-story-skipmove') await say('battle.learnMoveNotLearned', { pokemonName, moveName });
      else {
        if (a[2]) await say('battle.learnMoveForgetSuccess', { pokemonName, moveName: names.move(battle.dex.toID(a[2])) });
        fanfare();
        await say('battle.learnMove', { pokemonName, moveName });
      }
      return;
    }
    }
  }

  async function afterBattle(result) {
    const team = result?.sides?.[0]?.team ?? [];

    const evolving = (result?.evolutions ?? []).filter(e => !e.unsupported && team.some(m => m.uid === e.uid) && byUid(e.uid));
    if (evolving.length) await view.waitEnd?.();
    for (const evolution of evolving) {
      const member = team.find(m => m.uid === evolution.uid);
      const outcome = await evolveScreen(member, evolution);
      if (outcome) Object.assign(member, outcome);
      evolution.evolved = !!outcome;
    }
    if (evolving.length) await view.showEnd?.();
  }

  async function evolveScreen(member, evolution) {
    await loadExpText();
    const from = battle.dex.species.get(evolution.from), to = battle.dex.species.get(evolution.to);
    const nicknamed = !(member.name === from.name || member.name === from.baseSpecies);
    const preName = nicknamed ? member.name : names.species(from.id);
    const mon = sp => ({ speciesId: sp.id, spriteId: sp.spriteid, name: nicknamed ? member.name : names.species(sp.id), level: member.level,
      gender: member.gender || '', shiny: !!member.shiny, hp: member.hp, maxhp: member.maxhp, status: member.status === 'fnt' ? '' : member.status || '' });
    await view.startEvolution(mon(from));
    await say('menu.evolving', { pokemonName: preName }, false);
    if (!await view.evolve(mon(to), { canCancel: true })) {
      await say('menu.stoppedEvolving', { pokemonName: preName });
      await view.endEvolution();
      return null;
    }
    await sayTimed('menu.evolutionDone', { pokemonName: preName, evolvedPokemonName: mon(to).name }, { promptDelay: 4000 });
    const outcome = { species: to.name, baseSpecies: to.baseSpecies, name: nicknamed ? member.name : to.name, moves: member.moves.map(m => ({ ...m })) };

    for (const [level, id] of levelUp?.[to.id] ?? []) {
      if (level !== 0 || outcome.moves.some(m => m.id === id)) continue;
      const move = battle.dex.moves.get(id);
      if (!move.exists) continue;
      const pp = newMovePP(battle, move), slot = { id: move.id, pp, maxpp: pp };
      const pokemonName = mon(to).name;
      if (outcome.moves.length < 4) {
        outcome.moves.push(slot);
        await learned(pokemonName, names.move(move.id), true);
        continue;
      }
      const summary = { ...mon(to), dexNumber: to.num };
      const moves = outcome.moves.map(m => learnMoveOption(battle, names, m.id, m.pp, m.maxpp));
      await learnFlow({ mon: summary, moves, newMove: learnMoveOption(battle, names, move.id, pp, pp), inEvolution: true,
        commit: index => { if (index !== null) outcome.moves[index] = slot; } });
    }
    await view.endEvolution();
    return outcome;
  }

  return { present, summonInfo, afterBattle, learnFlow, state: { tracked } };
}
