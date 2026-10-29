import { readEvent, sideOf, isIdent } from './read.js';
import { createLedger } from './ledger.js';
import { createEffects, EFFECT_KINDS } from './steps-effects.js';
import { createMegaTera, MEGA_KINDS } from './steps-mega.js';
import { createBagSteps, BAG_KINDS } from './steps-bag.js';
import { createExpSteps, EXP_KINDS } from './steps-exp.js';
import { RUN_KINDS } from './run.js';
import { winnerSide } from '../engine/core.mjs';

const IGNORED = ['', 't:', 'gametype', 'player', 'gen', 'tier', 'rule', 'debug', 'raw', 'teamsize', 'start', 'upkeep', 'turn'];

// Lines this file handles
const CORE_KINDS = ['switch', 'drag', 'replace', 'move', '-crit', '-ohko', '-supereffective', '-resisted', '-immune', '-miss', 'faint', 'win', 'tie'];

export function createSteps({ battle, view, names, text, warn, bag, options, run, mode = {}, onInput, wild = false }) {

  const ledger = createLedger({ battle, names });

  const effects = createEffects({ battle, view, names, text, warn, ledger });
  const megaTera = createMegaTera({ battle, view, names, warn, ledger });

  const bagSteps = createBagSteps({ battle, view, names, ledger, bag });

  const exp = createExpSteps({ battle, view, names, warn, ledger, options, mode, onInput });
  const runSteps = run?.steps({ view, ledger });
  const label = ident => ledger.get(ident).name;
  const values = ident => ({ pokemonName: label(ident), pokemonNameWithAffix: label(ident) });
  const say = (key, args) => view.message(text(key, args), {});

  const sayAlong = (key, args) => view.message(text(key, args), { hold: 0 });

  const owners = new Map([
    ...CORE_KINDS.map(kind => [kind, event => present(event)]),
    ...EFFECT_KINDS.map(kind => [kind, effects.present]),
    ...MEGA_KINDS.map(kind => [kind, megaTera.present]),
    ...BAG_KINDS.map(kind => [kind, bagSteps.present]),
    ...EXP_KINDS.map(kind => [kind, exp.present]),
    ...(runSteps ? RUN_KINDS.map(kind => [kind, runSteps.present]) : []),
    ...IGNORED.map(kind => [kind, () => {}]),
  ]);
  const ownerOf = event => (bagSteps.usesBagItem(event) ? bagSteps.present : owners.get(event.kind));

  const step = async function (item) {
    if (item.cue) return effects.cue(item);
    const event = ledger.observe(readEvent(item));
    await effects.bar(event);
    if (event.kind !== 'move') await reappear(event);
    const owner = ownerOf(event);
    if (owner) await owner(event);
    else warn(event.kind);
  };

  async function reappear({ before, args: a }) {
    if (!before?.semiInvulnerable) return;
    const entry = ledger.get(a[0]);
    if (!entry.semiInvulnerable && !entry.fainted && ledger.onField(a[0])) await view.setHidden(sideOf(a[0]), false);
  }

  async function enter(event) {
    const { kind, args: a } = event;
    const side = sideOf(a[0]), previous = event.previous, player = side === 'player';

    // Player-side info box exp bar (MonView.exp)
    const mon = { ...ledger.view(ledger.get(a[0])), ...exp.summonInfo(side, event.actor) };
    const trainerName = battle.sides[player ? 0 : 1].name;

    const enemyTrainerTurn = !player && !!previous && kind === 'switch' && !wild;
    const showing = enemyTrainerTurn ? view.showTrainer?.() : null;
    const recalling = previous && !previous.fainted && kind === 'switch';
    if (recalling) {

      await Promise.all([sayAlong(player ? 'battle.playerComeBack' : 'battle.trainerComeBack', { trainerName, pokemonName: previous.name }),
        view.recall(side)]);
    }
    if (enemyTrainerTurn) {
      if (!recalling) await view.pause?.(750);
      await showing;
      await view.pause?.(1500);
    }
    const wildAppears = !player && !previous && wild;

    const encounter = !player && !previous && kind === 'switch' && !!view.encounter;

    const { ball } = ledger.get(a[0]);
    const summon = () => view.summon(side, { ...mon }, { fromBall: !wildAppears, ...(ball ? { ball } : {}) });

    if (kind === 'drag') { await Promise.all([sayAlong('battle.pokemonDraggedOut', { pokemonName: mon.name }), summon()]); return; }
    if (previous || player) {
      const go = sayAlong(player ? 'battle.playerGo' : 'battle.trainerGo', { trainerName, pokemonName: mon.name });
      await Promise.all([go, summon(), enemyTrainerTurn ? view.hideTrainer?.() : null]);
      return;
    }
    if (wildAppears) {
      if (encounter) await view.encounter({ kind: 'wild', enemy: { ...mon } });
      await bagSteps.wildAppeared(mon);
    } else {
      if (encounter) await view.encounter({ kind: 'trainer' });

      await view.message(text('battle.trainerAppeared', { trainerName }), { wait: true, hold: 1500 });

      await Promise.all([encounter ? view.hideTrainer() : null, sayAlong('battle.trainerSendOut', { trainerName, pokemonName: mon.name })]);
    }
    if (!(wildAppears && encounter)) await summon();
  }

  // Lines this file handles (CORE_KINDS)
  async function present(event) {
    const { kind, args: a, kwArgs: kw } = event;
    switch (kind) {
    case 'switch':
    case 'drag': {
      const side = sideOf(a[0]), previous = event.previous;

      if (previous?.substitute) await view.substitute(side, 'clear');
      await enter(event);

      const entry = ledger.atField(side);
      if (entry.substitute) await view.substitute(side, 'add');
      if (Object.keys(previous?.boosts ?? {}).length || Object.keys(entry.boosts).length) await view.setStatStages(side, { ...entry.boosts });
      break;
    }
    case 'replace': {

      const side = sideOf(a[0]);
      if (!ledger.atField(side)) { warn('replace'); break; }
      const { speciesId, spriteId, shiny, gender, name, level } = ledger.get(a[0]), { exp: ratio } = exp.summonInfo(side, event.actor);
      await view.changeForm(side, { speciesId, spriteId, shiny, gender, name, level, ...(ratio !== undefined ? { exp: ratio } : {}) }, { instant: true });
      break;
    }
    case 'move': {
      const id = battle.dex.toID(a[1]);

      const reflected = /^(ability:\s*)?magic\s*(coat|bounce)$/i.test(String(kw.from ?? ''));
      await view.message(text(reflected ? 'battle.magicCoatActivated' : 'battle.useMove', { ...values(a[0]), moveName: names.move(id) }), { hold: 500 });

      await reappear(event);

      const options = event.onSubstitute ? [{ onSubstitute: true }] : [];
      if (!kw.miss && !kw.still) await view.playMove(id, sideOf(a[0]), isIdent(a[2]) ? sideOf(a[2]) : sideOf(a[0]), ...options);
      break;
    }

    case '-crit': await say('battle.hitResultCriticalHit'); break;
    case '-ohko': await say('battle.hitResultOneHitKo'); break;
    case '-supereffective':
    case '-resisted': {
      if (event.repeat) break;

      const double = a[1] === '2';
      await say(kind === '-supereffective'
        ? double ? 'battle.hitResultExtremelyEffective' : 'battle.hitResultSuperEffective'
        : double ? 'battle.hitResultMostlyIneffective' : 'battle.hitResultNotVeryEffective');
      break;
    }
    case '-immune': await say('battle.hitResultImmune', values(a[0])); break;
    case '-miss': await say('battle.attackMissed', values(a[1] || a[0])); break;
    case 'faint':
      if (event.before?.substitute) await view.substitute(sideOf(a[0]), 'clear');
      await view.faint(sideOf(a[0]));

      await view.message(text('battle.fainted', values(a[0])), { wait: true });
      break;
    case 'win':
    case 'tie': {

      const caught = kind === 'win' ? bagSteps.caught() : null;
      if (caught) {
        if (caught.toBox) await bagSteps.say('own.sentToBox', { pokemonName: caught.pokemonName }, { wait: true });
        await view.end({ outcome: 'win', caught: true });
        break;
      }

      if (kind === 'tie' && runSteps?.escaped()) { await view.end({ outcome: 'run' }); break; }
      const winner = winnerSide(battle);
      const outcome = kind === 'tie' || !winner ? 'tie' : winner === 'p1' ? 'win' : 'lose';
      if (outcome === 'win' && !wild) {

        const said = text('battle.trainerDefeated', { trainerName: battle.sides[1].name });
        await Promise.all([view.showTrainer?.(), view.end({ outcome, text: said })]);
      } else await view.end({ outcome });
      break;
    }
    }
  }
  step.flush = () => effects.flush();
  step.afterBattle = result => exp.afterBattle(result);

  step.restoreState = () => {
    const state = { stages: {}, substitute: {}, hidden: {}, trainer: !wild };
    for (const side of ['player', 'enemy']) {
      const entry = ledger.atField(side);
      if (!entry || entry.fainted) continue;
      state[side] = { ...ledger.view(entry), ...exp.summonInfo(side, entry.uid) };
      state.stages[side] = { ...entry.boosts };
      state.substitute[side] = entry.substitute;
      state.hidden[side] = !!entry.semiInvulnerable;
    }
    return state;
  };
  step.ledger = ledger;
  return step;
}
