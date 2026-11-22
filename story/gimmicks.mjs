import { battleOnlyBase, completeSet, toID } from '../engine/mon.mjs';
import { rayquazaMega } from '../engine/showdown-compat.mjs';
import { genHas } from '../engine/generation.mjs';
import { namedTrainer, namedIn } from './named.mjs';
import { norm } from './norm.mjs';
import { seededIndex } from './blocks.mjs';
import BADGES from '../data/badges.json' with { type: 'json' };
import LEADER_NAMES from '../data/leader-names.json' with { type: 'json' };

/** Setting values (list order = settings row order) and the default */
export const FOE_GIMMICK_MODES = Object.freeze(['region', 'pokerogue']);
export const DEFAULT_FOE_GIMMICKS = 'region';

const REGION_GIMMICKS = Object.freeze({ paldea: 'tera', kanto: 'mega', hoenn: 'mega', kalos: 'mega', alola: 'z', galar: 'dynamax' });

export const regionGimmick = (region, gen = null) => {
  const gimmick = REGION_GIMMICKS[region] ?? 'none';
  return gimmick !== 'none' && genHas(gen, gimmick) ? gimmick : 'none';
};

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

export const SIGNATURE_Z = Object.freeze({
  hala: 'fightiniumz', olivia: 'rockiumz', nanu: 'darkiniumz', hapu: 'groundiumz',
  ilima: 'normaliumz', lana: 'wateriumz', kiawe: 'firiumz', mallow: 'grassiumz', sophocles: 'electriumz', acerola: 'ghostiumz', mina: 'fairiumz',
  kahili: 'flyiniumz', molayne: 'steeliumz', plumeria: 'poisoniumz',
});

const SIGNATURE_NAMES = Object.freeze({
  nanu: ['나리', 'Nanu'], hapu: ['하플루', 'Hapu'], ilima: ['일리마', 'Ilima'], lana: ['수련', 'Lana'], kiawe: ['키아웨', 'Kiawe'], mallow: ['마오', 'Mallow'],
  sophocles: ['마마네', 'Sophocles'], mina: ['말리화', 'Mina'],
});
const SIGNATURE_TABLE = Object.freeze(Object.fromEntries(Object.entries(SIGNATURE_NAMES).flatMap(([key, names]) => names.map(name => [norm(name), key]))));

const SIGNATURE_JA = Object.freeze(Object.fromEntries(Object.entries(SIGNATURE_NAMES).map(([key, [, english]]) => {
  const badge = BADGES.badges.find(b => b.leaders?.some(([, name]) => name === english));
  const name = badge && LEADER_NAMES.ja[badge.id]?.[badge.leaders.findIndex(([, n]) => n === english)];
  if (!name) throw new Error(`${english}: no Japanese name in data/leader-names.json`);
  return [norm(name), key];
})));

export function signatureZ(battle) {
  const named = namedTrainer(battle);
  if (named) return Object.hasOwn(SIGNATURE_Z, named) ? named : null;
  return namedIn(battle, SIGNATURE_TABLE, SIGNATURE_JA);
}

const crystalTables = new WeakMap();
function crystalOf(dex, type) {
  if (!crystalTables.has(dex)) crystalTables.set(dex, new Map(dex.items.all().filter(item => item.zMove === true && item.zMoveType).map(item => [item.zMoveType, item.id])));
  return crystalTables.get(dex).get(type);
}

const NO_DRAW = { random: () => 0 };

function movesOf(dex, set, levelUp) {
  if (set.moves?.length) return set.moves;
  try { return completeSet(dex, set, NO_DRAW, { levelUp }).moves; } catch { return []; }
}

// The forms Ultranecrozium Z lets Ultra Burst (Showdown canUltraBurst)
const ULTRA_BURST = new Set(['Necrozma-Dawn-Wings', 'Necrozma-Dusk-Mane']);

function zReady(dex, set, levelUp) {
  const item = dex.items.get(set.item ?? '');
  if (!item.zMove) return false;
  const species = dex.species.get(set.species).name;
  if (item.id === 'ultranecroziumz' && ULTRA_BURST.has(species)) return true;
  if (item.itemUser && !item.itemUser.includes(species)) return false;
  const moves = movesOf(dex, set, levelUp).map(id => dex.moves.get(id)).filter(move => move.exists);
  return item.zMoveFrom ? moves.some(move => move.name === item.zMoveFrom) : moves.some(move => move.type === item.zMoveType);
}

export function zGift(dex, team, { seed, levelUp, signature = null } = {}) {
  if (team.some(member => zReady(dex, member.set, levelUp))) return null;
  const open = team.filter(member => !member.set.item).sort((a, b) => b.set.level - a.set.level || team.indexOf(a) - team.indexOf(b));
  const movesOfPick = pick => movesOf(dex, pick.set, levelUp).map(id => dex.moves.get(id)).filter(move => move.exists);
  if (signature) {
    const type = dex.items.get(signature).zMoveType;
    const has = (pick, attack) => movesOfPick(pick).some(move => move.type === type && (!attack || move.category !== 'Status'));
    const holder = open.find(pick => has(pick, true)) ?? open.find(pick => has(pick, false));
    if (holder) return { uid: holder.uid, item: signature };
  }
  for (const pick of open) {
    const moves = movesOfPick(pick);
    const attacks = moves.filter(move => move.category !== 'Status');
    const types = [...new Set((attacks.length ? attacks : moves).map(move => move.type))].filter(type => crystalOf(dex, type));
    if (types.length) return { uid: pick.uid, item: crystalOf(dex, types[seeded(seed, pick.uid, types.length)]) };
  }
  return null;
}

export const SIGNATURE_DMAX = Object.freeze({
  milo: ['flapple', 'appletun', 'eldegoss'], nessa: ['drednaw'], kabu: ['centiskorch'], bea: ['machamp'], allister: ['gengar'], opal: ['alcremie'],
  gordie: ['coalossal'], melony: ['lapras'], raihan: ['duraludon'], leon: ['charizard'], marnie: ['grimmsnarl'], bede: ['hatterene'],
  'showdown:hop': ['inteleon', 'cinderace', 'rillaboom', 'drizzile', 'raboot', 'thwackey', 'sobble', 'scorbunny', 'grookey'],
});

const PLAIN_DMAX = Object.freeze(['showdown:hop']);

export const NEVER_DYNAMAX = Object.freeze(['piers']);

const NO_POWER_SPOT = Object.freeze(['piers']);

const noPowerSpot = ({ p2Named, secondNamed }) => NO_POWER_SPOT.includes(p2Named) || NO_POWER_SPOT.includes(secondNamed);

const gmaxBase = (dex, species) => (species.forme?.endsWith('Gmax') && species.changesFrom ? dex.species.get(species.changesFrom) : species);
const writtenGmax = (dex, set) => set.gigantamax === true || !!dex.species.get(set.species).forme?.endsWith('Gmax');

function canDynamax(dex, set) {
  if (gmaxBase(dex, dex.species.get(set.species)).cannotDynamax) return false;
  const item = dex.items.get(set.item ?? '');
  return !item.megaStone && !item.zMove;
}

export function dmaxGift(dex, team, { named = null } = {}) {
  const able = team.filter(member => canDynamax(dex, member.set));
  if (!able.length) return null;
  const baseId = member => toID(gmaxBase(dex, dex.species.get(member.set.species)).baseSpecies);
  const signature = SIGNATURE_DMAX[named] ?? [];
  const own = signature.map(id => able.find(member => baseId(member) === id)).find(Boolean);
  const ace = own ?? able.find(member => writtenGmax(dex, member.set)) ?? able.at(-1);
  const species = dex.species.get(ace.set.species);

  if (own && PLAIN_DMAX.includes(named)) return { uid: ace.uid, gigantamax: false };
  return { uid: ace.uid, gigantamax: !species.forme?.endsWith('Gmax') && !!gmaxBase(dex, species).canGigantamax };
}

function namedOf(battle) {
  const second = battle.foePartner ? { name: battle.foePartner.name, oldTitles: !!battle.oldTitles, oldJapanese: !!battle.oldJapanese } : null;
  return { second, p2Named: namedTrainer(battle), secondNamed: second ? namedTrainer(second) : null };
}

export function dynamaxHere(battle, region) {
  if (region !== 'galar' || battle.wild) return false;
  const named = namedOf(battle);
  if (noPowerSpot(named)) return false;
  return !!battle.boss || !!named.p2Named || !!named.secondNamed;
}

export function foeGimmicks(dex, mode, { battle, region, seed, levelUp, p2, partner = null, foePartner = null, unknownRogue = false, gen = null }) {
  if (mode !== 'region' || (unknownRogue && !region)) return {};
  const gimmick = battle.wild ? 'none' : regionGimmick(region, gen);

  const named = namedOf(battle);
  const { second, p2Named, secondNamed } = named;

  const p2Sig = gimmick === 'z' && !battle.wild ? signatureZ(battle) : null, secondSig = gimmick === 'z' && second ? signatureZ(second) : null;

  const strong = !battle.wild && (!!battle.boss || !!p2Named || !!secondNamed || !!p2Sig || !!secondSig);
  const tera = gimmick === 'tera' && strong;

  const marked = (team, aceToo) => team.map((member, i) => (aceToo && i === team.length - 1 ? member : { ...member, noTera: true }));

  let dynamaxed = false;
  const powerSpot = !noPowerSpot(named);
  const dynamax = (team, who) => {
    const gift = strong && powerSpot && !NEVER_DYNAMAX.includes(who) ? dmaxGift(dex, team, { named: who }) : null;
    if (!gift) return team;
    dynamaxed = true;
    return team.map(member => (member.uid !== gift.uid ? member
      : { ...member, dynamaxAce: true, ...(gift.gigantamax ? { set: { ...member.set, gigantamax: true } } : {}) }));
  };
  const given = (team, named, sig) => {
    if (gimmick === 'dynamax') return dynamax(team, named);
    const gift = !strong ? null : gimmick === 'mega' ? megaGift(dex, team, { named, seed })
      : gimmick === 'z' ? zGift(dex, team, { seed, levelUp, signature: sig ? SIGNATURE_Z[sig] : null }) : null;
    return gift ? team.map(member => (member.uid === gift.uid ? { ...member, set: { ...member.set, item: gift.item } } : member)) : team;
  };
  const p2Team = marked(given(p2, p2Named, p2Sig), tera);
  const secondTeam = foePartner ? marked(given(foePartner, secondNamed, secondSig), tera) : null;
  return {
    foeGimmick: tera ? 'tera' : gimmick === 'mega' || gimmick === 'z' ? gimmick : gimmick === 'dynamax' && dynamaxed ? 'dynamax' : 'none',
    p2: p2Team,
    ...(partner ? { partner: marked(partner, false) } : {}),
    ...(secondTeam ? { foePartner: secondTeam } : {}),
  };
}
