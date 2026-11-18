import { battleOnlyBase, toID } from '../engine/mon.mjs';
import { rayquazaMega } from '../engine/showdown-compat.mjs';
import { namedTrainer } from './named.mjs';
import { seededIndex } from './blocks.mjs';

export const FOE_GIMMICK_MODES = Object.freeze(['region', 'pokerogue']);
export const DEFAULT_FOE_GIMMICKS = 'region';

const REGION_GIMMICKS = Object.freeze({ paldea: 'tera', kanto: 'mega', hoenn: 'mega', kalos: 'mega' });

export const regionGimmick = region => REGION_GIMMICKS[region] ?? 'none';

// The generation a gimmick starts in; a foe is given only what the story's generation has
const GIMMICK_GENS = Object.freeze({ mega: 6, tera: 9 });
const eraGimmick = (gimmick, gen) => (gen >= (GIMMICK_GENS[gimmick] ?? 0) ? gimmick : 'none');

export const MEGA_LEVEL = 40;

export const SIGNATURE_MEGAS = Object.freeze({
  steven: 'metagross', maxie: 'camerupt', archie: 'sharpedo', diantha: 'gardevoir', lysandre: 'gyarados', korrina: 'lucario',
  sabrina: 'alakazam', agatha: 'gengar', wattson: 'manectric', winona: 'altaria', sidney: 'absol', drake: 'salamence',
});

const stoneTables = new WeakMap();
function stoneTable(dex) {
  if (!stoneTables.has(dex)) {
    const table = new Map();
    for (const item of dex.items.all()) {
      if (!item.megaStone || item.isNonstandard === 'CAP') continue;
      for (const [species, mega] of Object.entries(item.megaStone)) table.set(species, [...(table.get(species) ?? []), { id: item.id, mega }]);
    }
    stoneTables.set(dex, table);
  }
  return stoneTables.get(dex);
}

function stonesOf(dex, set) {
  const written = dex.species.get(set.species);
  const base = written.battleOnly ? battleOnlyBase(dex, written) : written;
  const stones = stoneTable(dex).get(base.name) ?? [];
  return written.isMega ? stones.filter(stone => stone.mega === written.name) : stones;
}

function megaReady(dex, set) {
  if (set.item && stonesOf(dex, set).some(stone => stone.id === toID(set.item))) return true;
  return !!rayquazaMega(dex, battleOnlyBase(dex, dex.species.get(set.species)), (set.moves ?? []).map(toID), dex.items.get(set.item ?? ''));
}

function seeded(seed, uid, n) {
  return seededIndex(`${seed ?? ''}|${uid}`, n);
}

export function megaGift(dex, team, { named = null, seed } = {}) {
  if (team.some(member => megaReady(dex, member.set))) return null;
  const top = Math.max(0, ...team.map(member => member.set.level));
  const open = team.filter(member => !member.set.item && stonesOf(dex, member.set).length)
    .sort((a, b) => b.set.level - a.set.level || team.indexOf(a) - team.indexOf(b));
  const signature = SIGNATURE_MEGAS[named];
  const pick = (signature && top >= MEGA_LEVEL && open.find(member => toID(battleOnlyBase(dex, dex.species.get(member.set.species)).baseSpecies) === signature))
    || (top > MEGA_LEVEL ? open[0] : null);
  if (!pick) return null;
  const stones = stonesOf(dex, pick.set);
  return { uid: pick.uid, item: stones[seeded(seed, pick.uid, stones.length)].id };
}

export function foeGimmicks(dex, mode, { battle, region, seed, p2, partner = null, foePartner = null, gen = 9 }) {
  if (mode !== 'region') return {};
  const gimmick = battle.wild ? 'none' : eraGimmick(regionGimmick(region), gen);
  const p2Named = namedTrainer(battle), secondNamed = battle.foePartner ? namedTrainer({ name: battle.foePartner.name }) : null;

  const strong = !battle.wild && (!!battle.boss || !!p2Named || !!secondNamed);
  const tera = gimmick === 'tera' && strong;

  const marked = (team, aceToo) => team.map((member, i) => (aceToo && i === team.length - 1 ? member : { ...member, noTera: true }));
  const given = (team, named) => {
    const gift = gimmick === 'mega' && strong ? megaGift(dex, team, { named, seed }) : null;
    return gift ? team.map(member => (member.uid === gift.uid ? { ...member, set: { ...member.set, item: gift.item } } : member)) : team;
  };
  return {
    foeGimmick: tera ? 'tera' : gimmick === 'mega' ? 'mega' : 'none',
    p2: marked(given(p2, p2Named), tera),
    ...(partner ? { partner: marked(partner, false) } : {}),
    ...(foePartner ? { foePartner: marked(given(foePartner, secondNamed), tera) } : {}),
  };
}
