import { ruleValues } from './setting-changes.mjs';
import { MACHINE_STANDARDS, regionStandard } from './machine-standards.mjs';
import { discWorld } from './compat-world.mjs';
import { earnedBadges, badgeById, recordOf } from './badges.mjs';
import { DEFAULT_GEN } from '../engine/rules.mjs';

const pastGen = gen => (Number.isInteger(gen) && gen >= 1 && gen < DEFAULT_GEN ? gen : null);
const genOrNull = gen => (Number.isInteger(gen) ? gen : null);

export const placeGen = (ctx, region) => gameGen(ctx, region) ?? genOrNull(ctx?.formGen);

const gameGen = (ctx, region) =>
  MACHINE_STANDARDS[regionStandard(region ?? null, discWorld(ctx?.world ?? null, genOrNull(ctx?.formGen) ?? DEFAULT_GEN, ctx?.battleRule ?? null))]?.gen ?? null;

const hereGen = ctx => placeGen(ctx, ctx?.status?.region ?? null);

export function badgeRegion(state) {
  const earned = earnedBadges(state).map((id, order) => ({ badge: badgeById(id), order, date: recordOf(state, id)?.date }));
  const dated = entry => (typeof entry.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(entry.date) ? entry.date : '');
  const latest = earned.sort((a, b) => dated(a).localeCompare(dated(b)) || a.order - b.order).at(-1);
  return latest ? latest.badge.region.replace(/\d+$/, '') : null;
}

function debutGen(ctx, species) {
  const gen = species ? ctx?.sim?.Dex.species.get(species)?.gen : null;
  return Number.isInteger(gen) && gen >= 1 ? gen : 1;
}

const unknownGen = (ctx, species) => pastGen(ctx?.formGen) ?? debutGen(ctx, species);

export function originGen(ctx, mon, state = null) {
  if (Number.isInteger(mon?.metGen)) return mon.metGen;
  const badges = state ? badgeRegion(state) : null, here = ctx?.status?.region ?? null;
  return (badges ? gameGen(ctx, badges) : null) ?? (here ? gameGen(ctx, here) : null) ?? unknownGen(ctx, mon?.set?.species);
}

export function learnGenOf(ctx, mon = null, state = null) {
  const by = ctx?.learnFrom;
  if (by !== 'origin' && by !== 'location') return null;
  const species = mon?.set?.species;
  const gen = by === 'origin' && mon ? originGen(ctx, mon, state) : gameGen(ctx, ctx?.status?.region ?? null) ?? unknownGen(ctx, species);
  return pastGen(Math.max(gen, debutGen(ctx, species)));
}

export const metGenAt = ctx => (ruleValues(ctx).metGen010 ? hereGen(ctx) : null);
