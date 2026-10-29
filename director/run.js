import { installRun, checkRun, chooseRun, checkForfeit, forfeit } from '../engine/run.mjs';
import { pokemonName } from './bag.js';

export const FORFEIT_QUESTION = '정말로 도망칠까요?';
export const FORFEIT_NOTE = '패배로 기록됩니다';

// Lines this module's steps handle (director/steps.js dispatch table)
export const RUN_KINDS = ['-story-run', '-story-forfeit'];

export function createRun({ sim, battle, names, text, wild }) {
  installRun(sim, battle, { wild });

  function blockedText(check) {
    if (check.reason === 'trainer') return text('battle.noEscapeTrainer');
    const trap = check.trap;
    if (check.reason === 'trapped' && trap?.source && (trap.effect === 'move' || trap.effect === 'ability')) {

      return text('battle.noEscapePokemon', {
        pokemonName: pokemonName(names, trap.source),
        moveName: trap.effect === 'move' ? names.move(trap.id) : names.ability(trap.id),
        escapeVerb: text('battle.escapeVerbFlee'),
      });
    }
    return text('battle.noEscapeFlee');
  }

  return {

    menu() {
      const check = checkRun(battle);
      if (check.ok) return {};

      if (check.reason === 'trainer' && checkForfeit(battle).ok) return { confirm: { text: FORFEIT_QUESTION, note: FORFEIT_NOTE } };
      return { blocked: blockedText(check) };
    },

    choice() {
      if (!wild) {
        if (!checkForfeit(battle).ok) throw new Error('Invalid player choice');
        return { forfeit: true };
      }
      if (!checkRun(battle).ok) throw new Error('Invalid player choice');
      return { run: true };
    },
    owns: choice => typeof choice === 'object' && (choice?.run === true || choice?.forfeit === true),

    ends: choice => typeof choice === 'object' && choice?.forfeit === true,
    commit: choice => (choice?.forfeit ? forfeit(battle) : chooseRun(battle)).ok,

    steps({ view, ledger }) {
      const say = (key, values, options = {}) => view.message(text(key, values), options);
      const nameOf = ident => ledger.get(ident).name;
      let ran = false;
      return {
        escaped: () => ran,
        async present({ kind, args: a, kwArgs: kw }) {
          if (kind === '-story-forfeit') return;
          const result = a[2];
          if (result === 'escaped') {
            ran = true;
            await view.message('', {});

            const leaving = Promise.resolve(view.runAway()).then(() => null, error => ({ error }));
            if (String(kw.from ?? '') === 'ability: Run Away') {
              await view.showAbility('player', nameOf(a[0]), names.ability('runaway'));
              await view.hideAbility();
            }

            await say('battle.runAwaySuccess', {}, { wait: true, promptDelay: 500 });
            const failed = await leaving;
            if (failed) throw failed.error;
          } else if (result === 'failed') {
            await say('battle.runAwayCannotEscape', {}, { wait: true, promptDelay: 500 });
          } else if (result === 'blocked') {

            const from = /^(move|ability):\s*(.*)$/.exec(String(kw.from ?? ''));
            const source = kw.of ? nameOf(String(kw.of)) : null;
            await view.message(from && source
              ? text('battle.noEscapePokemon', { pokemonName: source, escapeVerb: text('battle.escapeVerbFlee'),
                moveName: names[from[1]](battle.dex.toID(from[2])) })
              : text('battle.noEscapeFlee'), { wait: true });
          }
        },
      };
    },
  };
}
