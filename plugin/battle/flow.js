import { createStoryBattle, extractResult } from '../../engine/core.mjs';
import { runBattle, isWild } from '../../director/index.js';
import { createEnemyAI } from '../../ai/index.js';
import { battleNames, battleNamesIn } from './names.js';
import { DEFAULT_LANG } from '../../director/lang.js';
import { mark } from './marks.js';

export function previewBattle(sim, spec, options, names = battleNames) {
  const preview = createStoryBattle(sim, spec, options);
  try {
    const team = extractResult(sim, preview).sides.flatMap(side => side.team.map(mon => ({ side: side.id === 'p1' ? 'player' : 'enemy', mon })));
    return {
      mons: team.map(({ side, mon }) => {
        const species = sim.Dex.species.get(mon.species);
        return { side, speciesId: species.id, spriteId: species.spriteid, name: names.species(species.id),
          level: mon.level, gender: mon.gender, shiny: mon.shiny, hp: mon.hp, maxhp: mon.maxhp, status: mon.status };
      }),
      moves: [...new Set(team.flatMap(({ mon }) => mon.moves.map(move => move.id)))],
      ...(preview.activePerHalf > 1 ? { double: true } : {}),
    };
  } finally { preview.destroy(); }
}
export const preloadMons = (sim, spec, options) => previewBattle(sim, spec, options).mons;

const AI_NOTES_MAX = 20;

export { isWild };

export function battleMusicOptions(sim, spec, viewOptions = {}) {

  return { wild: isWild(spec), bgm: viewOptions.bgm ?? spec.bgm, victoryBgm: viewOptions.victoryBgm ?? spec.victoryBgm, biome: spec.biome,
    enemies: (spec.p2?.team ?? []).map(member => sim.Dex.species.get(member?.set?.species ?? '').id).filter(Boolean) };
}

export function createBattleSession({ sim, spec, options, createView, viewOptions = {}, onPrepared = () => {}, development = false, from, onTurn, commands, lang = DEFAULT_LANG }) {
  const names = battleNamesIn(lang, sim.Dex);
  const controller = new AbortController();
  const { signal } = controller;
  let view, started = false, paused = false, control = null;
  let speed = viewOptions.speed;
  const battleSpec = from?.spec ?? spec;
  const screen = [];
  const marks = {};
  const record = text => { if (typeof text === 'string') screen.push(text.replace(/\n/g, ' ')); };
  const turnStart = snapshot => {
    if (Number.isInteger(snapshot?.turn)) marks[snapshot.turn] = screen.length;
    return onTurn?.(snapshot);
  };

  const aiNotes = [];
  const onDecision = info => {
    if (info.kind !== 'error' && !info.problems) return;
    const note = `턴 ${control?.progress().turn ?? '-'} ${info.kind === 'error' ? `${info.stage}: ${info.error}` : JSON.stringify(info.problems)}`;
    if (aiNotes.length < AI_NOTES_MAX) aiNotes.push(note);
    if (development) console.warn('[enemy AI]', note);
  };
  const withNotes = error => {
    if (aiNotes.length && error instanceof Error) error.stack = `${error.stack ?? error.message}\n\n[상대 AI 진단]\n${aiNotes.join('\n')}`;
    return error;
  };
  const destroy = () => { const current = view; view = undefined; current?.destroy(); };
  const wait = work => {
    signal.throwIfAborted();
    return new Promise((resolve, reject) => {
      const abort = () => reject(signal.reason);
      signal.addEventListener('abort', abort, { once: true });
      Promise.resolve().then(() => { signal.throwIfAborted(); return work(); }).then(resolve, reject)
        .finally(() => signal.removeEventListener('abort', abort));
    });
  };
  return {
    close() {
      controller.abort(new DOMException('배틀을 닫았습니다.', 'AbortError'));
      destroy();
    },

    pause() { if (paused) return; paused = true; view?.suspend?.(); },

    // Reopen: continues from where it paused
    resume() { if (!paused) return; paused = false; view?.resume?.(); },
    get paused() { return paused; },

    setSpeed(next) { speed = next; view?.setSpeed(next); },

    progress() { return control?.progress() ?? null; },

    snapshot() { return control?.snapshot() ?? null; },

    position() { return control?.position() ?? null; },

    diagnostics() { return [...aiNotes]; },

    // Send to story: sentences shown on screen so far and turn start positions (copy)
    screen() { return { lines: [...screen], marks: { ...marks } }; },

    warmUp() { return wait(() => view.warmUp()); },

    pressKey(key) { return view?.pressKey?.(key) ?? false; },

    watchButtons(fn) { return view?.watchButtons?.(fn) ?? (() => {}); },

    async waitDismiss() {
      try {
        if (!view?.waitEnd) return false;
        await wait(() => view.waitEnd());
        view?.fadeOutMusic?.();
        return true;
      }
      catch (error) { if (signal.aborted) return false; throw error; }
    },
    async run() {
      if (started) throw new Error('이미 시작한 배틀입니다.');
      started = true;
      try {

        let preview;
        await wait(async () => {

          const booting = createView({ ...viewOptions, speed, ...battleMusicOptions(sim, battleSpec, viewOptions), signal, lang }).then(created => {

            if (signal.aborted) { created.destroy(); signal.throwIfAborted(); }
            view = created;
            if (paused) view.suspend?.();
          });
          const engine = Promise.resolve(options).then(ready => { options = ready; preview = previewBattle(sim, battleSpec, options, names); });

          for (const settled of await Promise.allSettled([booting, engine])) if (settled.status === 'rejected') throw settled.reason;
        });
        mark('pb:phaser');

        await wait(() => view.preload({ ...preview, biome: battleSpec.biome ?? 'plains',
          enemyTrainer: battleSpec.p2?.trainerSprite, enemyBlack: !!battleSpec.p2?.trainerSilhouette,
          playerTrainer: battleSpec.p1?.trainerSprite, playerBlack: !!battleSpec.p1?.trainerSilhouette }));
        mark('pb:preload');

        let menuShown = false, revealed = null;
        const art = { picture: who => view?.trainerPicture?.(who) ?? null, sound: path => view?.playSound?.(path) };
        const reveal = () => (revealed ??= wait(() => onPrepared(art)));

        const guarded = Object.fromEntries(Object.keys(view).filter(key => typeof view[key] === 'function')
          .map(key => [key, async (...args) => {
            await reveal();
            if (key === 'chooseAction' && !menuShown) { menuShown = true; mark('pb:menu'); }
            if (key === 'message') record(args[0]);
            return wait(() => view[key](...args));
          }]));

        const replayView = new Proxy({}, { get: (_, key) => (key === 'then' ? undefined
          : key === 'message' ? async text => { record(text); } : async () => undefined) });

        const result = await runBattle({ sim, spec: battleSpec, options, view: guarded, names, lang, development,

          enemyAI: createEnemyAI(sim, { trainer: !isWild(battleSpec), difficulty: battleSpec.difficulty ?? 'normal', boss: !!battleSpec.boss, onDecision }),
          from, onTurn: turnStart, replayView, commands, onBattle: c => { control = c; } });

        return result && { ...result, screen: [...screen] };
      } catch (error) {
        destroy();
        if (!signal.aborted) throw withNotes(error);
        return undefined;
      }
    },
  };
}
