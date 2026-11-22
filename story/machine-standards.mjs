export const MACHINE_STANDARDS = Object.freeze({
  rb: Object.freeze({ vg: '1', versionGroup: 'red-blue', gen: 1, regions: Object.freeze(['kanto']) }),
  gs: Object.freeze({ vg: '3', versionGroup: 'gold-silver', gen: 2, regions: Object.freeze(['johto', 'kanto']) }),
  rs: Object.freeze({ vg: '5', versionGroup: 'ruby-sapphire', gen: 3, regions: Object.freeze(['hoenn']) }),
  frlg: Object.freeze({ vg: '7', versionGroup: 'firered-leafgreen', gen: 3, regions: Object.freeze(['kanto']), remake: 'rb' }),
  dp: Object.freeze({ vg: '8', versionGroup: 'diamond-pearl', gen: 4, regions: Object.freeze(['sinnoh']) }),
  hgss: Object.freeze({ vg: '10', versionGroup: 'heartgold-soulsilver', gen: 4, regions: Object.freeze(['johto', 'kanto']), remake: 'gs' }),
  bw: Object.freeze({ vg: '11', versionGroup: 'black-white', gen: 5, regions: Object.freeze(['unova']) }),
  xy: Object.freeze({ vg: '15', versionGroup: 'x-y', gen: 6, regions: Object.freeze(['kalos']) }),
  oras: Object.freeze({ vg: '16', versionGroup: 'omega-ruby-alpha-sapphire', gen: 6, regions: Object.freeze(['hoenn']), remake: 'rs' }),
  sm: Object.freeze({ vg: '17', versionGroup: 'sun-moon', gen: 7, regions: Object.freeze(['alola']) }),
  swsh: Object.freeze({ vg: '20', versionGroup: 'sword-shield', gen: 8, regions: Object.freeze(['galar']) }),
  sv: Object.freeze({ vg: '25', versionGroup: 'scarlet-violet', gen: 9, regions: Object.freeze(['paldea', 'kitakami']) }),
});
export const STANDARD_IDS = Object.freeze(Object.keys(MACHINE_STANDARDS));

export const DEFAULT_STANDARD = 'sv';
/** The standard of the TRs (the only one that has them) */
export const TR_STANDARD = 'swsh';
export const MACHINE_KINDS = Object.freeze(['tm', 'hm', 'tr']);

const SUFFIXED = STANDARD_IDS.filter(s => s !== DEFAULT_STANDARD).join('|');
const ID_RE = new RegExp(`^(?:tm(\\d{3})|tr(\\d{2})|(tm|hm)(\\d{3})(${SUFFIXED}))$`);

export function machineId(kind, number, std = DEFAULT_STANDARD) {
  if (kind === 'tr') return `tr${String(number).padStart(2, '0')}`;
  return `${kind}${String(number).padStart(3, '0')}${std === DEFAULT_STANDARD ? '' : std}`;
}

export function parseMachineId(id) {
  const m = ID_RE.exec(String(id ?? ''));
  if (!m) return null;
  if (m[1]) return { kind: 'tm', number: Number(m[1]), std: DEFAULT_STANDARD };
  if (m[2]) return { kind: 'tr', number: Number(m[2]), std: TR_STANDARD };
  return { kind: m[3], number: Number(m[4]), std: m[5] };
}
export const isMachineId = id => parseMachineId(id) !== null;

export const isRegionDisc = id => { const m = parseMachineId(id); return !!m && m.kind !== 'tr' && m.std !== DEFAULT_STANDARD; };

/** Generations whose TMs stay when they teach (each generation's rule) */
const REUSABLE_TM_GENS = Object.freeze({ from: 5, to: 8 });

export function machineUsedUp(id) {
  const m = parseMachineId(id);
  if (!m || m.kind === 'hm') return false;
  if (m.kind === 'tr') return true;
  const { gen } = MACHINE_STANDARDS[m.std];
  return gen < REUSABLE_TM_GENS.from || gen > REUSABLE_TM_GENS.to;
}

export function learnGens(kind, std) {
  const { gen } = MACHINE_STANDARDS[std];
  return kind === 'tr' ? Array.from({ length: 10 - gen }, (_, i) => gen + i) : [gen];
}
export const learnKey = (kind, std) => learnGens(kind, std).join('-');

export const ANIME_STANDARDS = Object.freeze({ journeys: 'swsh', horizons: 'sv' });
const animeStandard = world => (world?.anime && Object.hasOwn(ANIME_STANDARDS, world.anime) ? ANIME_STANDARDS[world.anime] : null);

export const regionGames = region => STANDARD_IDS.filter(std => MACHINE_STANDARDS[std].regions.includes(region));

export function regionStandard(region, world) {
  const anime = animeStandard(world);
  if (anime) return anime;
  const games = regionGames(region);
  if (!games.length) return null;
  const gen = worldGen(world);
  return (gen ? games.filter(std => MACHINE_STANDARDS[std].gen <= gen).at(-1) : null) ?? games[0];
}

const worldGen = world => (Number.isInteger(world?.gen) ? world.gen : null);

export function withMachineStandard(reading, region, world) {
  if (reading?.regionMachines === false) return { ...reading, machineStd: DEFAULT_STANDARD, machineRegion: null };
  const gen = worldGen(world);
  return { ...reading, machineStd: regionStandard(region, world) ?? DEFAULT_STANDARD, machineRegion: animeStandard(world) ? null : region ?? null,
    ...(gen ? { machineGen: gen } : {}) };
}

export function nearestStandards(std) {
  const gen = MACHINE_STANDARDS[std]?.gen ?? MACHINE_STANDARDS[DEFAULT_STANDARD].gen;
  const distance = s => (s === std ? -1 : Math.abs(MACHINE_STANDARDS[s].gen - gen));
  return [...STANDARD_IDS].sort((a, b) => distance(a) - distance(b) || MACHINE_STANDARDS[b].gen - MACHINE_STANDARDS[a].gen);
}

export function lookupStandards(std, region = null, gen = null) {
  const near = nearestStandards(std);
  const home = new Set(regionGames(region));
  const order = [...near.filter(s => s === std || home.has(s)), ...near.filter(s => s !== std && !home.has(s))];
  if (!Number.isInteger(gen)) return order;
  const out = s => s !== std && MACHINE_STANDARDS[s].gen > gen;
  return [...order.filter(s => !out(s)), ...order.filter(out)];
}

/** The latest generation with discs (Scarlet / Violet's) */
export const LATEST_GEN = MACHINE_STANDARDS[DEFAULT_STANDARD].gen;

export const genOrder = from => [from, ...Array.from({ length: from - 1 }, (_, i) => from - 1 - i), ...Array.from({ length: LATEST_GEN - from }, (_, i) => from + 1 + i)];

export const standardsByGen = from => genOrder(from).flatMap(g => STANDARD_IDS.filter(s => MACHINE_STANDARDS[s].gen === g));

export const unknownRegionFrom = gen => gen ?? LATEST_GEN;

const ORDER = new Map(STANDARD_IDS.map((s, i) => [s, i]));

export function machineOrder(a, b) {
  const x = parseMachineId(a), y = parseMachineId(b);
  if (!x || !y) return x ? -1 : y ? 1 : 0;
  return ORDER.get(x.std) - ORDER.get(y.std) || MACHINE_KINDS.indexOf(x.kind) - MACHINE_KINDS.indexOf(y.kind) || x.number - y.number;
}

export function machineMark(id) {
  const m = parseMachineId(id);
  return m ? { gen: MACHINE_STANDARDS[m.std].gen, remake: !!MACHINE_STANDARDS[m.std].remake, game: m.std } : null;
}
/** The generation a disc was printed in, null for none */
export const machineGen = id => machineMark(id)?.gen ?? null;
