import { readEvent, positionOf, sideIndexOf, isIdent, teamOf, fieldPositions } from './read.js';
import { monView } from './mon.js';
import { createLedger } from './ledger.js';
import { createEffects, EFFECT_KINDS } from './steps-effects.js';
import { createMegaTera, MEGA_KINDS } from './steps-mega.js';
import { createBagSteps, BAG_KINDS } from './steps-bag.js';
import { createExpSteps, EXP_KINDS } from './steps-exp.js';
import { RUN_KINDS } from './run.js';
import { winnerSide } from '../engine/core.mjs';
import { text as baseText, ownText, nameWithAffix } from './text.js';
import { DEFAULT_LANG } from './lang.js';

const IGNORED = ['', 't:', 'gametype', 'player', 'gen', 'tier', 'rule', 'debug', 'raw', 'teamsize', 'start', 'upkeep', 'turn'];

// Lines this file handles
const CORE_KINDS = ['switch', 'drag', 'replace', 'swap', 'move', '-crit', '-ohko', '-supereffective', '-resisted', '-immune', '-miss', 'faint', 'win', 'tie'];

export function createSteps({ battle, view, names, warn, bag, options, run, mode = {}, onInput, wild = false, lang = DEFAULT_LANG }) {
  const text = (key, values) => baseText(key, values, lang);

  const ledger = createLedger({ battle, names });

  const sideAffix = nameWithAffix(lang, wild);
  const affix = (name, position) => {
    const partner = name !== undefined && ledger.atField(position)?.partner;
    return partner ? ownText('own.partnerPokemonWithAffix', { trainerName: partner, pokemonName: name }, lang) : sideAffix(name, position);
  };

  const effects = createEffects({ battle, view, names, warn, ledger, lang, affix });
  const megaTera = createMegaTera({ view, warn, ledger, lang, affix });

  const bagSteps = createBagSteps({ battle, view, names, ledger, bag, lang, affix });

  const exp = createExpSteps({ battle, view, names, warn, ledger, options, mode, onInput, lang });
  const runSteps = run?.steps({ view, ledger });
  const label = ident => ledger.get(ident).name;
  const values = ident => ({ pokemonName: affix(label(ident), positionOf(ident)), pokemonNameWithAffix: affix(label(ident), positionOf(ident)) });
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
    if (!entry.semiInvulnerable && !entry.fainted && ledger.onField(a[0])) await view.setHidden(positionOf(a[0]), false);
  }

  async function enter(event) {
    const { kind, args: a } = event;
    const side = positionOf(a[0]), previous = event.previous, player = teamOf(side) === 'player';

    // Player-side info box exp bar (MonView.exp)
    const mon = { ...ledger.view(ledger.get(a[0])), ...exp.summonInfo(side, event.actor) };
    const { partner } = ledger.get(a[0]);
    const trainerName = partner ?? battle.sides[sideIndexOf(a[0])].name;

    const enemyTrainerTurn = !player && !!previous && kind === 'switch' && !wild;
    const showing = enemyTrainerTurn ? view.showTrainer?.() : null;
    const recalling = previous && !previous.fainted && kind === 'switch';
    if (recalling) {

      await Promise.all([sayAlong(player && !previous.partner ? 'battle.playerComeBack' : 'battle.trainerComeBack', { trainerName, pokemonName: previous.name }),
        view.recall(side)]);
    }
    if (enemyTrainerTurn) {
      if (!recalling) await view.pause?.(750);
      await showing;
      await view.pause?.(1500);
    }
    const wildAppears = !player && !previous && wild;

    if (wildAppears && event.joins) return;

    const encounter = !player && !previous && kind === 'switch' && !event.joins && !!view.encounter;

    const { ball } = ledger.get(a[0]);
    const summon = () => view.summon(side, { ...mon }, { fromBall: !wildAppears, ...(ball ? { ball } : {}) });

    if (kind === 'drag') { await Promise.all([sayAlong('battle.pokemonDraggedOut', { pokemonName: mon.name }), summon()]); return; }
    if (previous || player) {
      const go = partner ? view.message(ownText('own.partnerGo', { trainerName, pokemonName: mon.name }, lang), { hold: 0 })
        : sayAlong(player ? 'battle.playerGo' : 'battle.trainerGo', { trainerName, pokemonName: mon.name });
      await Promise.all([go, summon(), enemyTrainerTurn ? view.hideTrainer?.() : null]);
      return;
    }
    if (wildAppears) {

      const pair = (event.joinedBy ?? []).map(other => ({ position: positionOf(other.args[0]),
        mon: ledger.view({ ...monView(battle, names, other.args[0], other.args[1], other.args[2]) }) }));
      if (encounter) await view.encounter({ kind: 'wild', enemy: { ...mon }, ...(pair.length ? { others: pair } : {}) });
      if (pair.length) await say('battle.multiWildAppeared', { pokemonName1: mon.name, pokemonName2: pair[0].mon.name });
      else await bagSteps.wildAppeared(mon);
    } else if (event.joins) {

      await sayAlong('battle.trainerSendOut', { trainerName, pokemonName: mon.name });
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
      const side = positionOf(a[0]), previous = event.previous;

      if (previous?.substitute) await view.substitute(side, 'clear');
      await enter(event);

      const entry = ledger.atField(side);
      if (entry.substitute) await view.substitute(side, 'add');
      if (Object.keys(previous?.boosts ?? {}).length || Object.keys(entry.boosts).length) await view.setStatStages(side, { ...entry.boosts });
      break;
    }
    case 'replace': {

      const side = positionOf(a[0]);
      if (!ledger.atField(side)) { warn('replace'); break; }
      const { speciesId, spriteId, shiny, gender, name, level } = ledger.get(a[0]), { exp: ratio } = exp.summonInfo(side, event.actor);
      await view.changeForm(side, { speciesId, spriteId, shiny, gender, name, level, ...(ratio !== undefined ? { exp: ratio } : {}) }, { instant: true });
      break;
    }
    case 'swap': {

      const [from, to] = event.positions;
      await view.swap(from, to);
      await view.message(ownText('own.swap', { ...values(a[0]), targetName: affix(ledger.atField(from)?.name, from) }, lang), {});
      break;
    }
    case 'move': {
      const id = battle.dex.toID(a[1]);

      const reflected = /^(ability:\s*)?magic\s*(coat|bounce)$/i.test(String(kw.from ?? ''));
      await view.message(text(reflected ? 'battle.magicCoatActivated' : 'battle.useMove', { ...values(a[0]), moveName: names.move(id) }), { hold: 500 });

      await reappear(event);

      const options = event.onSubstitute ? [{ onSubstitute: true }] : [];
      if (!kw.miss && !kw.still) await view.playMove(id, positionOf(a[0]), isIdent(a[2]) ? positionOf(a[2]) : positionOf(a[0]), ...options);
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
      if (event.before?.substitute) await view.substitute(positionOf(a[0]), 'clear');
      await view.faint(positionOf(a[0]));

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
    for (const side of fieldPositions(battle)) {
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
