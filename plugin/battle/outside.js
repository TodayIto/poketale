import { battleNamesIn } from './names.js';
import { DEFAULT_LANG } from '../../director/lang.js';
import { showOutsideSummary, learnMoveOutside, evolveOutside, rememberMoveOutside, amieOutside, hatchOutside, trainingOutside } from '../../director/outside.js';

export function createOutsideScreens({ sim, createView, fetchBytes, levelUp, exp, lang = DEFAULT_LANG, viewOptions = {}, trainer, battleFormat } = {}) {
  if (!sim?.Battle || typeof createView !== 'function') throw new TypeError('sim and createView are required');
  const names = battleNamesIn(lang, sim.Dex);
  const context = async () => ({ sim, names, lang, exp, battleFormat: typeof battleFormat === 'function' ? await battleFormat() : battleFormat, trainer: typeof trainer === 'function' ? await trainer() : trainer,
    levelUp: typeof levelUp === 'function' ? await levelUp() : await levelUp });

  async function withView({ parent, theme }, work) {
    if (!parent) throw new TypeError('parent is required');
    const ctx = await context();
    const view = await createView({ ...viewOptions, parent, fetchBytes, lang, ...(theme !== undefined ? { theme } : {}) });
    try { return await work(view, ctx); } finally { view.destroy(); }
  }
  const withGen = (ctx, battleGen) => (Number.isInteger(battleGen) ? { ...ctx, battleGen } : ctx);
  return {

    openSummary: ({ parent, mon, customItems, dynamaxShown = false, battleGen = null, theme, onRename, onEvolveLock }) => withView({ parent, theme }, (view, ctx) =>
      showOutsideSummary({ view, ctx: { ...withGen(ctx, battleGen), customItems, dynamaxShown }, mon, onRename, onEvolveLock })),

    openLearnMove: ({ parent, mon, move, party, battleGen = null, theme }) => withView({ parent, theme }, (view, ctx) => learnMoveOutside({ view, ctx: withGen(ctx, battleGen), mon, move, party })),

    openEvolution: ({ parent, mon, into, learn, battleGen = null, theme }) => withView({ parent, theme }, (view, ctx) => evolveOutside({ view, ctx: withGen(ctx, battleGen), mon, into, learn })),

    openRememberMove: ({ parent, mon, moves, party, battleGen = null, theme }) => withView({ parent, theme }, (view, ctx) => rememberMoveOutside({ view, ctx: withGen(ctx, battleGen), mon, moves, party })),

    openAmie: ({ parent, mon, state, party, debug, awake, trainWhy, lock, scene, theme }) => withView({ parent, theme }, (view, ctx) => amieOutside({ view, ctx, mon, state, party, debug, awake, trainWhy, lock, scene })),

    openHatch: ({ parent, mon, theme }) => withView({ parent, theme }, (view, ctx) => hatchOutside({ view, ctx, mon })),

    openTraining: ({ parent, mon, scene, theme }) => withView({ parent, theme }, (view, ctx) => trainingOutside({ view, ctx, mon, scene })),
  };
}
