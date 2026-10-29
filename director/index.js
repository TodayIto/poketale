import { createStoryBattle, extractResult } from '../engine/core.mjs';
import { createProtocolReader } from './parse.js';
import { createSteps } from './steps.js';
import { arrange } from './order.js';
import { text as defaultText } from './text.js';
import { simpleAI, isReviving } from './simple-ai.js';
import { monView } from './mon.js';
import { gimmickOptions, gimmickSuffix } from './steps-mega.js';
import { createBag } from './bag.js';
import { createRun } from './run.js';
import { summaryView } from './summary.js';
import { loadExpText } from './steps-exp.js';
import { effectText } from './steps-effects.js';
import { pokemonName } from './bag.js';
import { moveMenuInfo } from './move-info.js';
import { replaceMove } from '../engine/exp.mjs';
import { chooseEnemyItem } from '../engine/bag.mjs';
import { commitChoice } from '../ai/commit.js';

export function partySlots(battle, names, text, request, { trapped = false, reviving = false, options } = {}) {
  const side = battle.sides[0];
  return request.side.pokemon.map((pokemon, i) => {

    const mon = monView(battle, names, pokemon.ident, pokemon.details, pokemon.condition, side.pokemon[i]?.maxhp);
    const slot = { ...mon, active: !!pokemon.active, fainted: / fnt$/.test(pokemon.condition) };

    // Slot menu "check summary" -> summary screen values (not shown in the menu without an engine Pokemon)
    if (side.pokemon[i]) slot.summary = summaryView(battle, names, pokemon, side.pokemon[i], options);

    if (reviving) { if (!slot.fainted) slot.blocked = text('party-ui-handler.hasEnergy', { pokemonName: mon.name }); }
    else if (slot.fainted) slot.blocked = text('party-ui-handler.noEnergy', { pokemonName: mon.name });
    else if (trapped && !slot.active) slot.blocked = text('battle.noEscapeSwitch');
    return slot;
  });
}

export { isReviving };

function switchChoice(choice, party, { reviving = false } = {}) {
  const slot = party[choice?.slot];
  if (choice?.kind !== 'switch' || !Number.isInteger(choice.slot) || !slot || slot.blocked
    || (reviving ? !slot.fainted : slot.active || slot.fainted)) {
    throw new Error('Invalid player choice');
  }
  return `switch ${choice.slot + 1}`;
}

const DENIED = {
  disable: 'battle.moveDisabled', encore: 'battle.moveDisabled',
  taunt: 'own.moveDisabledTaunt', torment: 'battle.moveDisabledTorment', imprison: 'battle.moveDisabledImprison',
  healblock: 'battle.moveDisabledHealBlock', throatchop: 'battle.moveCannotBeSelected',
  gravity: 'battle.moveDisabledGravity', belch: 'battle.moveDisabledBelch', stuffcheeks: 'battle.moveDisabledNoBerry',
  bloodmoon: 'battle.moveDisabledConsecutive', gigatonhammer: 'battle.moveDisabledConsecutive',
  choiceband: 'battle.canOnlyUseMove', choicescarf: 'battle.canOnlyUseMove', choicespecs: 'battle.canOnlyUseMove',
  gorillatactics: 'battle.canOnlyUseMove',
};
export function moveDeniedText(battle, names, option) {
  const pokemon = battle.sides[0].active[0];
  const name = pokemon ? pokemonName(names, pokemon) : '';
  const moveName = names.move(option.id);
  if ((option.pp ?? 1) <= 0) return effectText('battle.moveNoPp');
  const source = battle.dex.toID(option.disabledSource || pokemon?.moveSlots.find(slot => slot.id === option.id)?.disabledSource || '');
  const key = DENIED[source] ?? 'battle.moveCannotBeSelected';

  const locked = source === 'gorillatactics' ? pokemon?.abilityState?.choiceLock : pokemon?.volatiles?.choicelock?.move;
  const values = { pokemonName: name, pokemonNameWithAffix: name, moveName: key === 'battle.canOnlyUseMove' && locked ? names.move(locked) : moveName };
  return effectText(key, values).trimEnd();
}

export function hiddenTrapText(battle, names, text) {
  const trapper = battle.sides[1].active.find(foe => foe && !foe.fainted && foe.hp && battle.dex.abilities.get(foe.ability).onFoeTrapPokemon
    && foe.hasAbility(foe.ability));
  if (!trapper) return text('battle.noEscapeSwitch');
  const name = pokemonName(names, trapper);
  return effectText('ability-trigger.arenaTrap', { pokemonNameWithAffix: name, pokemonName: name, abilityName: names.ability(trapper.ability) });
}

export const SNAPSHOT_VERSION = 1;

const unresumable = reason => Object.assign(new Error(`복원할 수 없는 스냅샷입니다 (${reason})`),
  { why: 'unresumable', unresumable: true });

function hashText(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
}

function fingerprint(battle) {
  const parts = [battle.format.id];
  for (const side of battle.sides) {
    for (const p of side.pokemon) {
      const moves = p.baseMoveSlots.map(slot => {
        const m = battle.dex.moves.get(slot.id);
        return [m.id, m.type, m.category, m.basePower, m.accuracy, m.pp, m.priority];
      });
      parts.push([p.species.id, p.species.types, p.species.baseStats, p.baseAbility, p.item, moves]);
    }
  }
  return hashText(JSON.stringify(parts));
}

const stateCheck = battle => hashText(battle.log.filter(line => !line.startsWith('|t:|')).join('\n'));

function seedText(seed) {
  const text = Array.isArray(seed) ? seed.join(',') : String(seed ?? '');
  if (!/^(sodium,|gen5,|[0-9])/.test(text)) throw new TypeError(`PRNG 씨앗이 아닙니다: ${text}`);
  return text;
}

export function rerollSnapshot(snapshot, seed) {
  checkSnapshot(snapshot);
  return { ...structuredClone(snapshot), reseeds: [...(snapshot.reseeds ?? []), { at: snapshot.inputs.length, seed: seedText(seed) }] };
}

function buildEngine(sim, spec, options, names, text) {
  const battle = createStoryBattle(sim, spec, options);
  try {
    const wild = isWild(spec);

    const bag = createBag({ sim, battle, names, spec: spec.bag, wild });

    // Command menu "Run" (engine/run.mjs). In a trainer battle, a forfeit confirmation
    const run = createRun({ sim, battle, names, text, wild });
    return { battle, wild, bag, run };
  } catch (error) {
    battle.destroy();
    throw error;
  }
}

function replaySnapshot(battle, from, fp, input) {
  if (from.fp !== undefined && from.fp !== fp) throw unresumable('규칙·자료가 저장할 때와 다름');

  const reseeds = from.reseeds ?? [];
  const reseedAt = count => { for (const r of reseeds) if (r.at === count) battle.prng.setSeed(r.seed); };
  from.inputs.forEach((entry, i) => { reseedAt(i); input(entry); });
  reseedAt(from.inputs.length);

  if (from.check !== undefined && (battle.turn !== from.turn || stateCheck(battle) !== from.check)) {
    throw unresumable(`턴 ${from.turn} 상태가 다시 넣은 판(턴 ${battle.turn})과 다름`);
  }
}

export function snapshotResult(sim, snapshot, options = {}) {
  checkSnapshot(snapshot);
  const { battle, bag, run } = buildEngine(sim, snapshot.spec, options, null, defaultText);
  try {
    replaySnapshot(battle, snapshot, fingerprint(battle), entry => applyInput({ battle, bag, run }, entry));
    return extractResult(sim, battle);
  } finally {
    battle.destroy();
  }
}

function applyInput({ battle, bag, run }, input) {
  const [who, choice] = input;
  if (who === 'p1') return run.owns(choice) ? run.commit(choice) : bag?.owns(choice) ? bag.commit(choice) : battle.choose('p1', choice);

  if (who === 'p2') return /^item /.test(choice) ? chooseEnemyItem(battle, { item: choice.slice(5) }).ok : battle.choose('p2', choice);
  if (who === 'learn') { replaceMove(battle, input[1], input[2], input[3]); return true; }
  throw new Error(`Unknown snapshot input: ${who}`);
}

function filledSpec(battle, spec) {
  const copy = JSON.parse(JSON.stringify(spec));
  copy.seed = battle.prngSeed;
  for (const [i, key] of ['p1', 'p2'].entries()) {
    copy[key].team = copy[key].team.map((member, j) => {
      const set = JSON.parse(JSON.stringify(battle.sides[i].team[j]));

      set.shiny = !!set.shiny;
      return { ...member, set };
    });
  }
  return copy;
}

export function restartSpec(from, seed) {
  const spec = from?.v === SNAPSHOT_VERSION ? from.spec : from;
  if (!spec?.p1?.team?.length || !spec?.p2?.team?.length) throw new Error('다시 시작할 수 없는 spec 입니다');
  return { ...structuredClone(spec), seed: seedText(seed) };
}

function checkSnapshot(from) {
  if (!from || typeof from !== 'object' || from.v !== SNAPSHOT_VERSION || !from.spec || !Array.isArray(from.inputs)) {
    throw unresumable(`판 ${from?.v ?? '없음'}, 지금 ${SNAPSHOT_VERSION}`);
  }
  if (from.reseeds !== undefined && (!Array.isArray(from.reseeds)
    || from.reseeds.some(r => !Number.isInteger(r?.at) || r.at < 0 || r.at > from.inputs.length || typeof r.seed !== 'string'))) {
    throw unresumable('reseeds');
  }
}

export const isWild = spec => !!(spec?.wild ?? spec?.bag?.wild);

export const silentView = new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : async () => undefined) });

export async function runBattle({ sim, spec, options = {}, view, names, text = defaultText, enemyAI = simpleAI,
  warnings = [], development = true, from, onTurn, onBattle, replayView = silentView }) {
  if (from) { checkSnapshot(from); spec = from.spec; }
  for (const side of [spec.p1, spec.p2]) {
    if (!side.team.length || side.team.length > 6) throw new Error('Each side needs 1–6 Pokemon (singles)');
  }

  await loadExpText();
  const { battle, wild, bag, run } = buildEngine(sim, spec, options, names, text);

  try {

    // Snapshot: initial state + input log (SNAPSHOT_VERSION above)
    const baseSpec = from ? from.spec : filledSpec(battle, spec);
    const fp = fingerprint(battle);
    const inputs = [];
    const input = entry => { inputs.push(structuredClone(entry)); return applyInput({ battle, bag, run }, entry); };
    const reseeds = from?.reseeds ?? [];
    if (from) {
      replaySnapshot(battle, from, fp, input);
      enemyAI.loadState?.(battle, from.ai);
    }
    let latest = null, final = null;
    let shown = 0;
    const takeSnapshot = () => ({ v: SNAPSHOT_VERSION, spec: baseSpec, inputs: structuredClone(inputs),
      ai: enemyAI.saveState?.(battle) ?? null, turn: battle.turn, fp, check: stateCheck(battle),
      ...(reseeds.length ? { reseeds: structuredClone(reseeds) } : {}) });
    onBattle?.({

      progress: () => final ?? { turn: battle.turn, ended: battle.ended, log: [...battle.log], result: extractResult(sim, battle), shown },

      snapshot: () => latest,
    });
    const battleOptions = options;

    const gimmicks = { teraOrb: spec.teraOrb !== false };
    const seen = new Set(warnings);
    const warn = kind => {
      if (seen.has(kind)) return;
      seen.add(kind);
      warnings.push(kind);
      if (development) console.warn(`[director] Unhandled protocol: ${kind}`);
    };
    async function choosePlayer(request) {
      if (request.forceSwitch) {

        const reviving = isReviving(request);
        const party = partySlots(battle, names, text, request, { reviving, options: battleOptions });
        return switchChoice(await view.chooseSwitch({ party, forced: true, ...(reviving ? { revive: true } : {}) }), party, { reviving });
      }
      const options = request.active?.[0]?.moves;
      if (!options?.length) throw new Error('No player move request');

      if (options.length === 1 && options[0].pp === undefined && request.active[0].trapped && options[0].id !== 'struggle') return 'move 1';
      const moves = options.map(option => ({
        id: option.id, name: names.move(option.id), type: battle.dex.moves.get(option.id).type,
        category: battle.dex.moves.get(option.id).category,

        pp: option.pp, maxpp: option.maxpp, disabled: !!option.disabled,

        ...(option.disabled || (option.pp ?? 1) <= 0 ? { blocked: moveDeniedText(battle, names, option) } : {}),

        // Power, accuracy and effectiveness hints for the move menu
        ...moveMenuInfo(battle, option.id, battle.sides[1].active[0]),
      }));
      const party = partySlots(battle, names, text, request, { trapped: !!request.active[0].trapped, options: battleOptions });

      const choice = await view.chooseAction({ moves, canSwitch: true, party, ...gimmickOptions(request, gimmicks), ...(bag ? { bag: bag.menu() } : {}), run: run.menu() });
      if (choice?.kind === 'switch') return switchChoice(choice, party);
      if (choice?.kind === 'run') return run.choice();
      if (choice?.kind === 'item' && bag) return bag.choice(choice);
      if (choice?.kind !== 'move' || !Number.isInteger(choice.index) || !moves[choice.index] || moves[choice.index].disabled) {
        throw new Error('Invalid player choice');
      }
      return `move ${choice.index + 1}${gimmickSuffix(choice, request, gimmicks)}`;
    }
    const reader = createProtocolReader();

    const mode = { silent: !!from };
    let current = from ? replayView : view;
    const stepView = new Proxy({}, { get: (_, key) => current[key] });
    const step = createSteps({ battle, view: stepView, names, text, warn, bag, options, run, mode, wild,
      onInput: entry => inputs.push(structuredClone(entry)) });
    let turns = 0;
    if (from) {
      for (const item of arrange(reader.read(battle.log, battle.storyLogMeta))) await step(item);
      await step.flush();
      shown = reader.cursor;
      mode.silent = false; current = view;

      if (!battle.ended) await view.restore?.(step.restoreState());
    }
    while (true) {

      const events = reader.read(battle.log, battle.storyLogMeta);
      const waiting = new Set(events);
      for (const item of arrange(events)) {
        if (!item.cue) {
          waiting.delete(item);
          const firstWaiting = events.find(e => waiting.has(e));
          const upto = firstWaiting ? events[events.indexOf(firstWaiting) - 1] : events.at(-1);
          shown = Math.max(shown, (upto && reader.endOf(upto)) ?? shown);
        }
        await step(item);
      }
      await step.flush();
      if (battle.ended) {

        const result = { ...extractResult(sim, battle), log: [...battle.log] };

        try { await step.afterBattle(result); }
        catch (error) {
          if (error?.name === 'AbortError') throw error;
          result.evolutionError = String(error?.message ?? error);
          if (development) console.warn('[director] evolution failed; battle result kept', error);
          try { await view.endEvolution?.(); await view.showEnd?.(); } catch {                                }
        }
        final = { turn: battle.turn, ended: true, log: result.log, result, shown: result.log.length };
        return result;
      }
      if (++turns > 1000) throw new Error('Battle did not finish within 1000 choices');
      const request = battle.sides[0].activeRequest;
      const enemyRequest = battle.sides[1].activeRequest;

      if (request && !request.wait && !request.forceSwitch && request.active) {
        latest = takeSnapshot();
        if (onTurn) {
          try { Promise.resolve(onTurn(latest)).catch(error => { if (development) console.warn('[director] onTurn failed', error); }); }
          catch (error) { if (development) console.warn('[director] onTurn failed', error); }
        }
      }
      const playerChoice = request?.wait ? undefined : await choosePlayer(request ?? {});

      // Forfeit: ends at once (the foe is not asked)
      if (playerChoice && run.ends(playerChoice)) {
        if (!input(['p1', playerChoice])) throw new Error('Engine rejected forfeit');
        continue;
      }

      const enemyChoice = enemyRequest && !enemyRequest.wait ? await enemyAI(battle, 'p2') : undefined;
      if (!playerChoice && !enemyChoice) throw new Error('Both sides are waiting without an update');

      if (playerChoice && !input(['p1', playerChoice])) {

        const retry = battle.sides[0].activeRequest?.active?.[0];
        if (typeof playerChoice === 'string' && playerChoice.startsWith('switch') && retry?.trapped) {
          await view.message(hiddenTrapText(battle, names, text), { wait: true });
          continue;
        }

        const move = /^move (\d+)/.exec(typeof playerChoice === 'string' ? playerChoice : '');
        const option = move && retry?.moves?.[move[1] - 1];
        if (option?.disabled) {
          await view.message(moveDeniedText(battle, names, option), { wait: true });
          continue;
        }
        throw new Error(`Engine rejected player choice: ${playerChoice}`);
      }

      if (playerChoice) commitChoice(battle, 'p1', playerChoice);
      if (enemyChoice && !input(['p2', enemyChoice])) throw new Error(`Engine rejected enemy choice: ${enemyChoice}`);
      if (enemyChoice) commitChoice(battle, 'p2', enemyChoice);
    }
  } finally {

    battle.destroy();
  }
}
