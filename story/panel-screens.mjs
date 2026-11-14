import { outsideSummarySlot, learnModel, rememberModel } from '../director/outside.js';
import { expText } from '../director/steps-exp.js';
import { viewWords } from '../view/words.js';
import { STATS } from '../engine/mon.mjs';
import { say } from './screen-text.mjs';
import { namesFor, slotView, statModes, SUMMARY_PAGES, screenTab, ASKING } from './panel.mjs';
import { rememberableMoves, hatchedParty, stateFormat } from './state.mjs';
import { statName } from './diary.mjs';
import { MAX_IV, EV_STAT_MAX, EV_TOTAL_MAX } from './rules.mjs';

const KEEP = 12;
const kept = new Map();
function keep(key, make) {
  if (kept.has(key)) {
    const value = kept.get(key);
    kept.delete(key); kept.set(key, value);
    return value;
  }
  const value = make();
  kept.set(key, value);
  if (kept.size > KEEP) kept.delete(kept.keys().next().value);
  return value;
}

const outsideCtx = (ctx, state, lang, trainer) => ({ sim: ctx.sim, names: namesFor(lang, ctx.sim), lang, levelUp: ctx.levelUp, exp: ctx.exp, trainer,
  battleFormat: stateFormat(state), customItems: state.customItems });
const inputs = (kind, mon, lang, trainer, state, extra) => JSON.stringify([kind, mon, lang, trainer ?? null, stateFormat(state), state.customItems ?? null, extra ?? null]);
const summaryOf = (mon, env) => keep(inputs('summary', mon, env.lang, env.trainer, env.state), () => outsideSummarySlot(outsideCtx(env.ctx, env.state, env.lang, env.trainer), mon));

const moveRow = (move, extra = {}) => ({ id: move.id, name: move.name, type: move.type, pp: move.pp, maxpp: move.maxpp, ...extra });
const moveDetail = (move, t) => (move ? { name: move.name, type: move.type, category: move.category, power: move.power, accuracy: move.accuracy, description: move.description,
  labels: { power: t('panel.sc.power'), accuracy: t('panel.sc.accuracy'), none: '—' } } : null);

export function screenView(screen, env) {
  if (!screen) return null;
  const { state, lang } = env;
  const mon = state.party.find(m => m.uid === screen.uid) ?? state.box.find(m => m.uid === screen.uid);
  if (!mon) return null;
  const t = (key, values) => say(lang, key, values);
  const base = { kind: screen.kind, tab: screenTab(screen), back: true, backLabel: t('panel.sc.back'), navLabel: t('panel.sc.party'),
    right: '', nav: null, hero: null, band: null, hint: null, list: null, window: null };
  if (screen.kind === 'summary') return { ...base, ...summaryView(screen, mon, env, t) };
  if (screen.kind === 'remember') return { ...base, ...rememberView(screen, mon, env, t) };
  return { ...base, ...learnView(screen, mon, env, t) };
}

function summaryView(screen, mon, env, t) {
  const { state, ctx, lang } = env;
  const words = viewWords(lang), names = namesFor(lang, ctx.sim);
  const slot = summaryOf(mon, env), { summary } = slot;
  const shown = slotView(mon, ctx, state, lang);
  const party = hatchedParty(state), at = party.findIndex(m => m.uid === mon.uid);
  const hero = { spriteId: shown.spriteId, shiny: shown.shiny, dex: summary.dexNumber, name: shown.name, gender: shown.gender, species: names.species(slot.speciesId),
    level: shown.level, types: summary.types, hp: shown.hp, maxhp: shown.maxhp, hpClass: shown.hpClass, status: shown.status, fainted: shown.fainted, rename: t('panel.rename') };
  const pages = SUMMARY_PAGES.map(id => ({ id, label: t(`panel.sc.page.${id}`) }));

  const strip = () => party.map(m => {
    const v = m.uid === mon.uid ? shown : slotView(m, ctx, state, lang);
    return { uid: m.uid, spriteId: v.spriteId, shiny: v.shiny, name: v.name, fainted: v.fainted };
  });
  const out = { title: t('panel.title.summary'), hero, pages, page: screen.page, nav: at >= 0 && party.length > 1 ? { at: at + 1, of: party.length, mons: strip() } : null };
  if (screen.page === 'profile') {
    const nature = summary.nature;
    const [before, after] = (nature?.text ?? '{{nature}}').split('{{nature}}');
    out.profile = {
      rows: [
        { key: 'ot', label: words('pokemon-summary.ot'), text: summary.trainer },
        { key: 'ball', label: t('panel.sc.ball'), ball: summary.ball, text: names.item(summary.ball) },
        { key: 'item', label: t('panel.sc.item'), text: summary.item ?? words('own.noItem'), none: !summary.item },
        ...(summary.teraType ? [{ key: 'tera', label: t('panel.sc.tera'), type: summary.teraType }] : []),
        ...(nature ? [{ key: 'nature', label: t('panel.sc.nature'), nature: { before, name: nature.name, after, plus: nature.plus && statName(nature.plus, lang),
          minus: nature.minus && statName(nature.minus, lang), mint: nature.mint ?? null } }] : []),
      ],
      ability: { label: t('panel.sc.ability'), name: summary.ability.name, description: summary.ability.description },
    };

    if (summary.bond) out.profile.friendship = summary.bond;
  } else if (screen.page === 'stats') {

    const modes = statModes(ctx).filter(mode => (mode === 'ivs' ? !!summary.ivs : mode === 'evs' ? !!summary.evs : true));
    const mode = modes.includes(screen.stat) ? screen.stat : modes[0];
    const cells = STATS.map(stat => {
      const cell = { stat, label: statName(stat, lang), up: mode === 'stats' && summary.nature?.plus === stat, down: mode === 'stats' && summary.nature?.minus === stat };
      if (mode === 'ivs') return { ...cell, value: summary.ivs[stat], of: MAX_IV, top: summary.ivs[stat] >= MAX_IV };
      if (mode === 'evs') return { ...cell, value: summary.evs[stat], of: EV_STAT_MAX, top: summary.evs[stat] >= EV_STAT_MAX };
      return { ...cell, value: stat === 'hp' ? `${summary.stats.hp}/${summary.stats.maxhp}` : summary.stats[stat] };
    });
    const total = mode === 'evs' ? STATS.reduce((sum, stat) => sum + summary.evs[stat], 0) : 0;
    const exp = summary.exp && { total: summary.exp.total.toLocaleString(lang), next: summary.exp.next.toLocaleString(lang), ratio: summary.exp.ratio,
      level: shown.level, nextLevel: summary.exp.next ? shown.level + 1 : null };
    out.stats = { title: t('panel.sc.page.stats'), modes: modes.map(id => ({ id, label: t(`panel.sc.mode.${id}`) })), mode, cells,
      note: mode === 'evs' ? { text: t('panel.sc.evNote', { n: total, max: EV_TOTAL_MAX }) } : null,
      exp: exp && { ...exp, title: t('panel.sc.exp'), labels: { total: words('pokemon-summary.expPoints'), next: words('pokemon-summary.nextLv') } } };
  } else {
    const moves = summary.moves;
    const at = Math.min(screen.move ?? 0, moves.length - 1);
    out.list = { rows: moves.map((move, i) => moveRow(move, { i })), selected: at, detail: moveDetail(moves[at], t) };
  }
  return out;
}

function rememberView(screen, mon, env, t) {
  const { ctx, lang, state } = env;
  const names = namesFor(lang, ctx.sim);
  const moves = rememberableMoves(ctx, mon);
  const list = keep(inputs('remember', mon, lang, null, state, moves), () => rememberModel(outsideCtx(ctx, state, lang, null), mon, moves));
  const at = Math.min(screen.move ?? 0, list.length - 1);
  const chosen = list[at];
  return {
    title: t('panel.title.remember'), right: slotView(mon, ctx, state, lang).name, hint: t('panel.sc.rememberHint', { n: list.length }),
    list: { rows: list.map((move, i) => moveRow(move, { i, chip: move.level === 0 ? { text: t('panel.sc.evolveMove'), evo: true } : { text: `Lv${move.level}` } })),
      selected: at, detail: moveDetail(chosen, t), newPp: true },
    window: { text: t('panel.sc.rememberAsk'), options: [
      { hit: { t: 'scRemember' }, label: t('panel.sc.remember', { move: names.move(chosen.id) }), red: true },
      { hit: { t: 'scBack' }, label: t('panel.menu.cancel') }] },
  };
}

const STEP_LINES = {
  ask: ['battle.learnMovePrompt', 'battle.learnMoveLimitReached', 'battle.learnMoveReplaceQuestion'],
  pick: ['battle.learnMoveForgetQuestion'],
  giveup: ['battle.learnMoveStopTeaching'],
  done: ['battle.countdownPoof', 'battle.learnMoveForgetSuccess', 'battle.learnMoveAnd', 'battle.learnMove'],
  learned: ['battle.learnMove'],
  skipped: ['battle.learnMoveNotLearned'],
};
function learnView(screen, mon, env, t) {
  const { state, ctx, lang } = env;
  const names = namesFor(lang, ctx.sim);
  const asking = ASKING.has(screen.step);
  const who = slotView(mon, ctx, state, lang).name, moveName = names.move(screen.move);
  let list;
  if (asking) {

    const plan = keep(inputs('learn', mon, lang, null, state, screen.move), () => learnModel(outsideCtx(ctx, state, lang, null), mon, screen.move));
    const rows = [moveRow(plan.newMove, { i: 0, mark: t('panel.sc.newMove'), fresh: true }), ...plan.moves.map((move, i) => moveRow(move, { i: i + 1, pick: screen.step === 'pick' }))];
    const at = Math.min(screen.show ?? 0, rows.length - 1);
    list = { rows, selected: at, detail: moveDetail(at ? plan.moves[at - 1] : plan.newMove, t), picking: screen.step === 'pick' };
  } else {

    const moves = summaryOf(mon, env).summary.moves;
    const at = Math.max(0, moves.findIndex(m => m.id === screen.move));
    list = { rows: moves.map((move, i) => moveRow(move, { i: -1, ...(move.id === screen.move ? { mark: t('panel.sc.newMove'), fresh: true } : {}) })), selected: at, detail: moveDetail(moves[at], t), still: true };
  }
  const values = { pokemonName: who, moveName };
  const line = key => expText(key, key === 'battle.learnMoveForgetSuccess' ? { pokemonName: who, moveName: names.move(screen.forgot) } : values, { lang }).replace(/\n/g, ' ');
  const yesNo = [{ hit: { t: 'scYes' }, label: t('panel.yes') }, { hit: { t: 'scNo' }, label: t('panel.no') }];

  const forget = screen.step === 'pick' && screen.show > 0 ? mon.set.moves[screen.show - 1] : null;
  const picking = [...(forget ? [{ hit: { t: 'scForget' }, label: t('panel.sc.forget', { move: names.move(forget) }), red: true }] : []), { hit: { t: 'scNo' }, label: t('panel.menu.cancel') }];
  const options = asking ? (screen.step === 'pick' ? picking : yesNo) : [{ hit: { t: 'scOk' }, label: t('panel.ok') }];
  const levelUp = screen.source.kind === 'levelup';
  const left = levelUp ? (mon.pending?.moves ?? []).filter(m => m !== screen.move).length : 0;
  return {
    title: t(levelUp ? 'panel.levelUp' : screen.source.kind === 'remember' ? 'panel.title.remember' : 'panel.sc.learn'), right: who, list,
    band: levelUp ? { chips: [...(left ? [t('panel.sc.movesLeft', { n: left })] : []), ...(mon.pending?.evolve ? [t('panel.sc.thenEvolve')] : [])],
      step: t('panel.sc.learning', { move: moveName }) } : null,
    hint: asking ? t(screen.step === 'pick' ? 'panel.sc.pickHint' : 'panel.sc.rowHint') : null,
    window: { text: STEP_LINES[screen.step].map(line).join('\n'), options },
  };
}
