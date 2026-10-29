import { battleNames } from './names.js';
import { showOutsideSummary, learnMoveOutside, evolveOutside } from '../../director/outside.js';

export function createOutsideScreens({ sim, createView, fetchBytes, levelUp, exp, names = battleNames, viewOptions = {}, trainer, formatid } = {}) {
  if (!sim?.Battle || typeof createView !== 'function') throw new TypeError('sim and createView are required');
  const context = async () => ({ sim, names, exp, formatid, trainer: typeof trainer === 'function' ? await trainer() : trainer,
    levelUp: typeof levelUp === 'function' ? await levelUp() : await levelUp });

  // Opens a view in parent, runs work(view, ctx), and closes it when done (even on error)
  async function withView({ parent, theme }, work) {
    if (!parent) throw new TypeError('parent is required');
    const ctx = await context();
    const view = await createView({ ...viewOptions, parent, fetchBytes, ...(theme !== undefined ? { theme } : {}) });
    try { return await work(view, ctx); } finally { view.destroy(); }
  }
  return {

    openSummary: ({ parent, mon, theme, onRename }) => withView({ parent, theme }, (view, ctx) => showOutsideSummary({ view, ctx, mon, onRename })),

    openLearnMove: ({ parent, mon, move, party, theme }) => withView({ parent, theme }, (view, ctx) => learnMoveOutside({ view, ctx, mon, move, party })),

    openEvolution: ({ parent, mon, into, learn, theme }) => withView({ parent, theme }, (view, ctx) => evolveOutside({ view, ctx, mon, into, learn })),
  };
}
