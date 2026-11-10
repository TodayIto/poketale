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
  return {

    openSummary: ({ parent, mon, customItems, theme, onRename }) => withView({ parent, theme }, (view, ctx) => showOutsideSummary({ view, ctx: { ...ctx, customItems }, mon, onRename })),

    openLearnMove: ({ parent, mon, move, party, theme }) => withView({ parent, theme }, (view, ctx) => learnMoveOutside({ view, ctx, mon, move, party })),

    openEvolution: ({ parent, mon, into, learn, theme }) => withView({ parent, theme }, (view, ctx) => evolveOutside({ view, ctx, mon, into, learn })),

    openRememberMove: ({ parent, mon, moves, party, theme }) => withView({ parent, theme }, (view, ctx) => rememberMoveOutside({ view, ctx, mon, moves, party })),

    openAmie: ({ parent, mon, state, party, debug, awake, trainWhy, lock, theme }) => withView({ parent, theme }, (view, ctx) => amieOutside({ view, ctx, mon, state, party, debug, awake, trainWhy, lock })),

    openHatch: ({ parent, mon, theme }) => withView({ parent, theme }, (view, ctx) => hatchOutside({ view, ctx, mon })),

    openTraining: ({ parent, mon, theme }) => withView({ parent, theme }, (view, ctx) => trainingOutside({ view, ctx, mon })),
  };
}
