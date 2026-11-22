import SHOP from '../data/shop.json' with { type: 'json' };
import { shopsIn, shopsInText, seededIndex } from './blocks.mjs';
import { latestStatus, statusPlacesIn, OWN_MONEY_SHOWN } from './compat.mjs';
import { badgeCount } from './badges.mjs';
import { isBall, BAG_ITEMS } from '../engine/bag.mjs';
import { OUTSIDE_ITEMS, isZCrystalId, Z_CRYSTALS, isTm } from './items.mjs';
import { norm, escapeRe } from './norm.mjs';
import { isCustomItem } from './custom-items.mjs';
import { regionGimmick, DEFAULT_FOE_GIMMICKS } from './gimmicks.mjs';
import { machinesOf } from './item-info.mjs';
import { machineUsedUp, parseMachineId, MACHINE_STANDARDS } from './machine-standards.mjs';
import { genHas } from '../engine/generation.mjs';

export { shopsIn, shopsInText };

export const PREMIER_EVERY = 10;
/** The bonus ball */
export const PREMIER = SHOP.premier;
const SHOP_KINDS = ['mart', 'department'];

const FORM_KEYS = ['gracidea', 'revealglass', 'prisonbottle', 'meteorite', 'dnasplicers', 'nsolarizer', 'nlunarizer', 'reinsofunity', 'rotomcatalog', 'zygardecube'];
const LEGEND_ITEMS = ['griseouscore', 'adamantcrystal', 'lustrousglobe', 'griseousorb', 'adamantorb', 'lustrousorb', 'redorb', 'blueorb', 'souldew', 'rustedsword',
  'rustedshield', 'cornerstonemask', 'hearthflamemask', 'wellspringmask', 'legendplate'];
export const ONE_PER_PLAYER = Object.freeze([...new Set(['teraorb', 'keystone', 'zring', 'dynamaxband', 'oldrod', 'goodrod', 'superrod', 'pokeflute', 'expshare',
  ...SHOP.gifts.map(g => g.id), ...LEGEND_ITEMS, ...FORM_KEYS, ...Z_CRYSTALS])]);

const packOf = id => (Object.hasOwn(SHOP.specials.packs ?? {}, id) ? SHOP.specials.packs[id] : 1);

const saleCache = new Map();
export function machineSale(std, shop) {
  const key = `${std}:${shop}`;
  if (!saleCache.has(key)) saleCache.set(key, machinesOf(std).filter(d => (shop === 'department' || d.kind !== 'tr') && Object.hasOwn(SHOP.specials.prices, d.id)).map(d => d.id));
  return saleCache.get(key);
}

const priceIn = (table, id) => (Object.hasOwn(table, id) ? table[id] : null);

export const shopPrice = (id, game = null) => (game && Object.hasOwn(SHOP.games, game) ? priceIn(SHOP.games[game].goods, id) ?? priceIn(SHOP.games[game].machines, id) : null)
  ?? priceIn(SHOP.prices, id);

export function itemInGen(id, gen) {
  if (!Number.isInteger(gen)) return true;
  const disc = parseMachineId(id);
  return (disc ? MACHINE_STANDARDS[disc.std].gen : priceIn(SHOP.since, id) ?? 1) <= gen;
}

const keepOf = gen => (Number.isInteger(gen) ? id => itemInGen(id, gen) : null);

export function premierRule({ gen = null, game = null } = {}) {
  if (game && Object.hasOwn(MACHINE_STANDARDS, game)) {
    const { gen: of } = MACHINE_STANDARDS[game];
    return of < 3 ? null : of < 8 ? { only: 'pokeball' } : {};
  }
  return itemInGen(SHOP.premier, gen) ? {} : null;
}

const DAY = 86400000;

function isoWeek(date) {
  const thursday = new Date(date.getTime() + (3 - ((date.getUTCDay() + 6) % 7)) * DAY);
  const jan1 = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  return { year: thursday.getUTCFullYear(), week: 1 + Math.floor((thursday.getTime() - jan1) / (7 * DAY)) };
}
const realDate = (y, m, d) => {
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date : null;
};

const NO_YEAR = 2001;

export function storyWeek(dateText) {
  const text = String(dateText ?? '').normalize('NFKC').trim();
  if (!text) return null;
  let m = /(\d{4})\s*(?:[-./]|년)\s*(\d{1,2})\s*(?:[-./]|월)\s*(\d{1,2})/.exec(text);
  if (m) {
    const date = realDate(Number(m[1]), Number(m[2]), Number(m[3]));
    if (!date) return null;
    const { year, week } = isoWeek(date);
    return year * 100 + week;
  }
  m = /^(?:day\s*)?(\d{1,5})(?:\s*일차)?$/i.exec(text);
  if (m) return Number(m[1]) >= 1 ? Math.floor((Number(m[1]) - 1) / 7) + 1 : null;
  m = /(\d{1,2})\s*(?:[-./]|월)\s*(\d{1,2})/.exec(text);
  if (m) {
    const date = realDate(NO_YEAR, Number(m[1]), Number(m[2]));
    return date ? isoWeek(date).week : null;
  }
  return null;
}

// -- What is on the shelves ---------------------------------

/** k of items in a seeded order (the same seed, the same picks) */
function seededPick(items, k, seed) {
  const left = [...items], out = [];
  for (let i = 0; i < k && left.length; i++) out.push(...left.splice(seededIndex(`${seed}:${i}`, left.length), 1));
  return out;
}

const KO_KINDS = [
  { kind: 'city', names: ['시티', '도시', '시'], long: ['시티', 'city'], short: ['도시', '시'] },
  { kind: 'village', names: ['마을', '타운', '빌리지', '촌'], long: ['마을', '타운', '빌리지', 'town', 'village'], short: ['촌'] },
  { kind: 'island', names: ['아일랜드', '섬'], long: ['아일랜드', 'island'], short: ['섬'] },
];
const KO_PARTICLES = ['에서는', '에서', '에선', '에는', '으로', '까지', '부터', '의', '에', '로', '는', '은', '이', '가', '을', '를', '와', '과', '도', '쪽'];

const EN_SUFFIXES = ['city', 'town', 'village'];

const EN_NOT_ALONE = ['pallet', 'viridian', 'pewter', 'cerulean', 'vermilion', 'vermillion', 'lavender', 'celadon', 'fuchsia', 'saffron', 'newbark',
  'violet', 'azalea', 'goldenrod', 'olivine', 'mahogany', 'black', 'seafolk', 'tapu'];

const EN_PLACE_WORDS = new Set(['forest', 'woods', 'wood', 'cave', 'caves', 'cavern', 'grotto', 'tunnel', 'road', 'path', 'trail', 'gate', 'tower', 'mountain',
  'mount', 'mt', 'peak', 'hill', 'hills', 'ridge', 'valley', 'canyon', 'lake', 'cape', 'sea', 'ocean', 'bay', 'beach', 'coast', 'shore', 'river',
  'riverbank', 'falls', 'bridge', 'drawbridge', 'desert', 'meadow', 'marsh', 'swamp', 'mine', 'ruins', 'sewers', 'wilds', 'glacier']);
// the towns' own names: the ones a place word after names another place
const TOWN_NAMES = new Set(SHOP.towns.flatMap(t => t.names));
const BARE_STEM = 4, FUZZY_KO = 3, EN_CORE = 4, FUZZY_EN = 7;
const HANGUL = /\p{Script=Hangul}/u, WORDY = /[\p{L}\p{N}]/u, DIGITS = /^\p{N}+$/u;
const SHORT_END = new RegExp(`^(?:${KO_PARTICLES.join('|')})?(?![\\p{L}\\p{N}])`, 'u');
const latin = s => s.normalize('NFD').replace(/\p{M}/gu, '');

function nameForm(name) {
  if (HANGUL.test(name)) {
    const flat = norm(name);
    for (const of of KO_KINDS) {
      const suffix = of.names.find(s => flat.endsWith(s) && flat.length > s.length);
      if (suffix) return { kind: 'ko', stem: flat.slice(0, -suffix.length), of };
    }
    if (!flat) return null;

    const numbered = /\p{N}/u.test(flat) ? new RegExp(`(?<![\\p{L}\\p{N}])${[...flat].map(escapeRe).join('[^\\p{L}\\p{N}]*')}(?!\\p{N})`, 'u') : null;
    return { kind: 'plain', flat, numbered };
  }
  const words = latin(String(name ?? '').normalize('NFKC').toLowerCase()).match(/[\p{L}\p{N}]+/gu) ?? [];
  if (!words.length) return null;
  const full = words.join('');
  const core = EN_SUFFIXES.includes(words.at(-1)) && words.length > 1 ? words.slice(0, -1) : null;
  const coreText = core?.join('') ?? '';
  const named = core && coreText.length >= EN_CORE && !DIGITS.test(coreText); // a core the name may be read by (with a suffix at least)
  const bare = named && !EN_NOT_ALONE.includes(coreText); // ... and alone
  const withSuffix = new Set(named ? EN_SUFFIXES.map(s => coreText + s) : core ? [full] : []); // the targets that carry their suffix
  const targets = new Set([full, ...withSuffix, ...(bare ? [coreText] : [])]);
  if (!core && full.length < EN_CORE) return null;
  const one = named ? (core.length === 1 ? coreText : null) : words.length === 1 ? full : null;
  return { kind: 'en', targets: [...targets], withSuffix, word: one && one.length >= FUZZY_EN && !DIGITS.test(one) ? one : null, suffixed: named && !bare };
}

function koAt(f, s, i) {
  const rest = s.slice(i + f.stem.length).replace(/^\s+/, '');
  if (f.of.long.some(l => rest.startsWith(l))) return true;
  if (f.stem.length < 2 && !DIGITS.test(f.stem)) return false;
  const short = f.of.short.find(sh => rest.startsWith(sh));
  return !!short && SHORT_END.test(rest.slice(short.length));
}
/** Whether a place read (readPlace) has this form, exactly */
function formIn(f, place) {
  if (f.kind === 'plain') return f.numbered ? f.numbered.test(place.s) : place.flat.includes(f.flat);
  if (f.kind === 'ko') {
    if (f.stem.length >= BARE_STEM && place.flat === f.stem) return true;
    for (let i = place.s.indexOf(f.stem); i >= 0; i = place.s.indexOf(f.stem, i + 1)) {
      if ((i === 0 || !WORDY.test(place.s[i - 1])) && koAt(f, place.s, i)) return true;
    }
    return false;
  }

  const { words } = place;
  for (let i = 0; i < words.length; i++) {
    for (const target of f.targets) {
      let run = '';
      for (let j = i; j < words.length && run.length < target.length; j++) {
        run += words[j];
        if (!target.startsWith(run)) break;
        if (run === target && !(f.town && !f.withSuffix.has(target) && placeAfter(words, j))) return true;
      }
    }
  }
  return false;
}

const placeAfter = (words, j) => EN_PLACE_WORDS.has(words[j + 1]);

function oneEdit(a, b) {
  if (a === b || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1) || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2));
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

const readPlace = text => {
  const nfkc = String(text ?? '').normalize('NFKC'), s = nfkc.toLowerCase();
  return { s, flat: norm(text), words: latin(nfkc.replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2')).toLowerCase().match(/[\p{Script=Latin}\p{N}]+/gu) ?? [] };
};

const FORMS = new Map();

const BY_FIRST = new Map(), FUZZY = { ko: [], en: [] };
const HITS = new Map(), HITS_MAX = 20000;
function addName(name, fixed = false) {
  if (FORMS.has(name)) return;
  const form = nameForm(name);
  if (form?.kind === 'en' && TOWN_NAMES.has(name)) form.town = true;
  FORMS.set(name, { form, fixed });
  HITS.clear();
  if (!form) return;
  const first = form.kind === 'ko' ? form.stem[0] : form.kind === 'plain' ? form.flat[0] : form.targets[0][0];
  if (!BY_FIRST.has(first)) BY_FIRST.set(first, []);
  BY_FIRST.get(first).push(name);
  if (fixed && form.kind === 'en' && form.word) FUZZY.en.push([name, form]);
  if (fixed && form.kind === 'ko' && form.stem.length >= FUZZY_KO && !/[^\p{Script=Hangul}]/u.test(form.stem)) FUZZY.ko.push([name, form]);
}

function placeHits(text) {
  const key = String(text ?? '');
  let hits = HITS.get(key);
  if (hits) return hits;
  const place = readPlace(key);
  hits = new Set();
  if (place.flat) {
    const names = new Set([...new Set([...place.flat, ...place.words.map(w => w[0])])].flatMap(c => BY_FIRST.get(c) ?? []));
    for (const name of names) if (formIn(FORMS.get(name).form, place)) hits.add(name);
    if (![...hits].some(name => FORMS.get(name).fixed)) for (const name of fuzzyHits(place)) hits.add(name);
  }
  if (HITS.size >= HITS_MAX) HITS.clear();
  HITS.set(key, hits);
  return hits;
}
const KO_LONG = [...new Set(KO_KINDS.flatMap(of => of.long))];

function fuzzyHits(place) {
  const near = new Map(); // the stem or word -> its names
  const add = (key, name) => { if (!near.has(key)) near.set(key, new Set()); near.get(key).add(name); };

  const { words } = place;
  const slip = (f, k) => words[k].length >= FUZZY_EN - 1 && oneEdit(words[k], f.word) && (EN_SUFFIXES.includes(words[k + 1])
    || (!f.suffixed && !(f.town && placeAfter(words, k))));
  if (words.some(w => w.length >= FUZZY_EN - 1)) for (const [name, f] of FUZZY.en) if (words.some((_, k) => slip(f, k))) add(f.word, name);

  const runs = [];
  for (const long of KO_LONG) {
    for (let at = place.s.indexOf(long); at > 0; at = place.s.indexOf(long, at + 1)) {
      const head = place.s.slice(0, at), before = /(\p{Script=Hangul}+)\s?$/u.exec(head)?.[1] ?? '';
      const start = at - before.length - (/\s$/u.test(head) ? 1 : 0);
      if (before.length >= FUZZY_KO && (start === 0 || !WORDY.test(place.s[start - 1]))) runs.push([before, long]);
    }
  }
  for (const [run, long] of runs) {
    for (const [name, f] of FUZZY.ko) {
      if (f.stem.length === run.length && f.of.long.includes(long) && [...run].filter((c, k) => c !== f.stem[k]).length === 1) add(f.stem, name);
    }
  }
  return near.size === 1 ? [...near.values()][0] : new Set();
}

export function placeMatcher(name) {
  addName(name);
  return place => placeHits(place).has(name);
}
const ROUTE_RE = [/(\d{1,3})\s*번\s*(?:도로|수로)/u, /\broute\s*(\d{1,3})\b/i, /^(\d{1,3})\s*번$/u];

export function routeOf(text) {
  const s = String(text ?? '').normalize('NFKC');
  for (const re of ROUTE_RE) { const m = re.exec(s); if (m) return Number(m[1]); }
  return null;
}
for (const name of [...SHOP.specialties.flatMap(s => s.towns), ...SHOP.towns.flatMap(t => t.names)]) addName(name, true);

const TOWNS = [...SHOP.towns].map(t => ({ ...t, length: Math.max(...t.names.map(n => norm(n).length)) })).sort((a, b) => b.length - a.length);
// each town name -> the places of its towns in TOWNS (the lower, the longer)
const TOWN_RANKS = new Map();
TOWNS.forEach((t, rank) => { for (const name of t.names) TOWN_RANKS.set(name, [...(TOWN_RANKS.get(name) ?? []), rank]); });

export function townOf(places, region = null) {
  let best = null;
  for (const place of places ?? []) {
    for (const name of placeHits(place)) {
      for (const rank of TOWN_RANKS.get(name) ?? []) if ((best === null || rank < best) && (!region || TOWNS[rank].regions.includes(region))) best = rank;
    }
  }
  return best === null ? null : TOWNS[best].id;
}

export function townSpecialties(places, region = null) {
  const hits = (places ?? []).map(placeHits);
  return SHOP.specialties.filter(s => (!region || s.region === region) && s.towns.some(town => hits.some(h => h.has(town)))).map(s => s.item);
}

const shopPlaces = (status, name, region) => (name && (townOf([name], region) || townSpecialties([name], region).length)
  ? [name] : [status?.location, status?.site].filter(Boolean));

/** A sale price: `off` percent less, rounded to the table's step (never 0) */
const salePrice = (price, off) => Math.max(SHOP.sale.round, Math.round((price * (100 - off)) / 100 / SHOP.sale.round) * SHOP.sale.round);

export const saleCount = (n, share) => (share > 0 && n > 0 ? Math.max(1, Math.round((n * share) / 100)) : 0);

const WEIGHT_SCALE = 10000;

function weighted(list, seed) {
  const scaled = list.map(([value, weight]) => [value, Math.round(weight * WEIGHT_SCALE)]);
  let roll = seededIndex(seed, scaled.reduce((sum, [, weight]) => sum + weight, 0));
  for (const [value, weight] of scaled) { if (roll < weight) return value; roll -= weight; }
  return scaled.at(-1)[0];
}

const ticketOf = (category, id) => (typeof category.tickets === 'object' ? category.tickets[id] ?? 0 : category.tickets);

const categoryWeight = (category, items) => Math.min(items.reduce((sum, id) => sum + ticketOf(category, id), 0), category.cap ?? Infinity);

const gimmickSold = (gimmick, region, foeGimmicks, gen = null) => (foeGimmicks === 'pokerogue' ? genHas(gen, gimmick) : gimmick === regionGimmick(region, gen));

function familyItems(shop, category, region, foeGimmicks, machines = null, gen = null) {
  if (category.gimmick && !gimmickSold(category.gimmick, region, foeGimmicks, gen)) return [];
  const keep = keepOf(gen);
  return keep ? familyIn(shop, category, region, machines).filter(keep) : familyIn(shop, category, region, machines);
}
function familyIn(shop, category, region, machines) {
  if (machines && category.key === 'tm') return machineSale(machines, shop);
  const trs = SHOP.specials.trs;
  if (category.key !== trs.category || region !== trs.region) return category.items;
  return [...category.items.filter(id => !Object.hasOwn(trs.replaces, id)), ...(shop === trs.shop ? trs.items : [])];
}

function specialGoods(shop, seed, region, foeGimmicks, owned = new Set(), machines = null, gen = null) {
  const { count } = SHOP.specials[shop];
  const families = SHOP.specials[shop].categories.map(c => { const items = familyItems(shop, c, region, foeGimmicks, machines, gen); return { ...c, items, weight: categoryWeight(c, items) }; })
    .filter(f => f.items.length && f.weight > 0);
  const pickFamily = (list, at) => list.find(f => f.key === weighted(list.map(f => [f.key, f.weight]), at));
  const pickItem = (family, items, at) => weighted(items.map(id => [id, ticketOf(family, id) || 1]), at);
  const draws = [];
  for (let i = 0, n = families.length ? weighted(count, `${seed}:sp`) : 0; i < n; i++) {
    const leftIn = f => f.items.filter(id => !draws.some(d => d.id === id));
    let family = pickFamily(families, `${seed}:sp:${i}:tier`);
    let left = leftIn(family);
    if (!left.length) {
      const open = families.filter(f => leftIn(f).length);
      if (!open.length) continue;
      family = pickFamily(open, `${seed}:sp:${i}:again:tier`);
      left = leftIn(family);
    }
    draws.push({ i, family, id: pickItem(family, left, `${seed}:sp:${i}:item`) });
  }

  const ids = new Set(draws.map(d => d.id));
  const free = family => family.items.filter(id => !ids.has(id) && !owned.has(id));
  const out = [];
  for (const { i, family, id } of draws) {
    let pick = id;
    if (owned.has(id)) {
      const open = families.filter(f => free(f).length);
      if (!open.length) continue;
      const again = free(family).length ? family : pickFamily(open, `${seed}:sp:${i}:owned:tier`);
      pick = pickItem(again, free(again), `${seed}:sp:${i}:owned:item`);
      ids.add(pick);
    }
    const pack = packOf(pick);
    out.push({ id: pick, price: SHOP.specials.prices[pick] * pack, ...(pack > 1 ? { pack } : {}), special: true, limited: seed });
  }
  return out;
}

export const limitedKey = (seed, id) => `${seed}|${id}`;

const poolOf = keep => SHOP.department.categories.flatMap(c => {
  const items = keep ? c.items.filter(keep) : c.items;
  const share = Math.min(1, (c.cap ?? Infinity) / categoryWeight({ ...c, cap: undefined }, items));
  return items.map(id => [id, ticketOf(c, id) * share]);
});
const POOLS = new Map();
const departmentPool = gen => { const key = Number.isInteger(gen) ? gen : null; if (!POOLS.has(key)) POOLS.set(key, poolOf(keepOf(key))); return POOLS.get(key); };

function seededWeightedPick(list, k, seed) {
  const left = [...list], out = [];
  for (let i = 0; i < k && left.length; i++) {
    const id = weighted(left, `${seed}:${i}`);
    out.push(id);
    left.splice(left.findIndex(([value]) => value === id), 1);
  }
  return out;
}

const giftRows = (shop, badges, region, foeGimmicks, bag, owned, gen) => SHOP.gifts.filter(g => g.shops.includes(shop) && (badges ?? 0) >= g.badges
  && (!g.gimmick || gimmickSold(g.gimmick, region, foeGimmicks, gen)) && itemInGen(g.id, gen) && !(bag?.[g.id] > 0) && !owned.includes(g.id)).map(g => g.id);

export function shopStock({ kind, region = null, townId = null, period = null, badges = 0, town = [], bought = new Set(), foeGimmicks = DEFAULT_FOE_GIMMICKS, bag = {}, owned = [], machines = null,
  gen = null, game = null } = {}) {
  const shop = SHOP_KINDS.includes(kind) ? kind : 'mart';
  const seed = shelvesSeed({ kind: shop, region, town: townId, period });
  if (game && Object.hasOwn(SHOP.games, game)) return gameShelf({ shop, seed, game, badges, town, region, bag });
  const keep = keepOf(gen);
  const inGen = list => (keep ? list.filter(keep) : list);
  const basics = inGen(SHOP.mart.basics.filter(row => shop === 'department' || (badges ?? 0) >= row.badges).flatMap(row => row.items));
  const gifts = giftRows(shop, badges, region, foeGimmicks, bag, owned, gen).filter(id => !basics.includes(id));
  const have = new Set([...basics, ...gifts]);
  const fresh = list => list.filter(id => !have.has(id) && (have.add(id), true));
  const { picks: martPicks } = SHOP.mart, { picks: deptPicks } = SHOP.department;
  const picks = shop === 'mart'
    ? fresh(seededPick(inGen(martPicks.items).filter(id => !have.has(id)), martPicks.min + seededIndex(`${seed}:count`, martPicks.max - martPicks.min + 1), seed))
    : fresh(seededWeightedPick(departmentPool(gen).filter(([id]) => !have.has(id)), deptPicks.min + seededIndex(`${seed}:count`, deptPicks.max - deptPicks.min + 1), seed));
  picks.push(...fresh(inGen(townSpecialties(town, region))));
  const row = special => id => ({ id, price: SHOP.prices[id], special });

  let stock = [...basics.map(row(false)), ...gifts.map(id => ({ ...row(false)(id), one: true })), ...picks.map(row(true))];
  const sale = SHOP.sale;
  const share = sale.shareMin + seededIndex(`${seed}:share`, sale.shareMax - sale.shareMin + 1);
  const onSale = new Set(seededPick(stock.map(entry => entry.id), saleCount(stock.length, share), `${seed}:sale`));
  stock = stock.map(entry => {
    if (!onSale.has(entry.id)) return entry;
    const price = salePrice(entry.price, sale.offMin + seededIndex(`${seed}:off:${entry.id}`, sale.offMax - sale.offMin + 1));
    return price < entry.price ? { ...entry, price, was: entry.price } : entry;
  });

  const kept = Object.keys(bag ?? {}).filter(id => bag[id] > 0 && isTm(id) && !machineUsedUp(id));
  const had = new Set([...ONE_PER_PLAYER, ...kept].filter(id => (bag?.[id] > 0 || owned.includes(id)) && !bought.has(limitedKey(seed, id))));
  const specials = specialGoods(shop, seed, region, foeGimmicks, had, machines, gen).filter(entry => !have.has(entry.id))
    .map(entry => (bought.has(limitedKey(seed, entry.id)) ? { ...entry, soldOut: true } : entry));
  return [...stock, ...specials];
}

function gameShelf({ shop, seed, game, badges, town, region, bag }) {
  const { goods, machines, machineShops } = SHOP.games[game];
  const sold = id => Object.hasOwn(goods, id);
  const specialty = new Set(SHOP.specialties.map(s => s.item));
  const basics = SHOP.mart.basics.filter(row => shop === 'department' || (badges ?? 0) >= row.badges).flatMap(row => row.items).filter(sold);
  const have = new Set(basics);
  const fresh = list => list.filter(id => !have.has(id) && (have.add(id), true));
  const { picks: martPicks } = SHOP.mart;
  const picks = shop === 'mart'
    ? fresh(seededPick(martPicks.items.filter(id => sold(id) && !have.has(id)), martPicks.min + seededIndex(`${seed}:count`, martPicks.max - martPicks.min + 1), seed))
    : fresh(Object.keys(goods).filter(id => !specialty.has(id)));
  picks.push(...fresh(townSpecialties(town, region).filter(sold)));
  const discs = machineShops.includes(shop) ? Object.keys(machines).filter(id => machineUsedUp(id) || !(bag?.[id] > 0)) : [];
  return [...basics.map(id => ({ id, price: goods[id], special: false })), ...picks.map(id => ({ id, price: goods[id], special: true })),
    ...discs.map(id => ({ id, price: machines[id], special: true, ...(machineUsedUp(id) ? {} : { one: true }) }))];
}

export const shelvesSeed = ({ kind, region = null, town = null, period = null }) => (town
  ? `shop:${kind}:${region ?? ''}:${town}:${period ?? ''}` : `shop:${kind}:${region ?? ''}:${period ?? ''}`);

export function shopTownAt(chat, at, { region = null, name = null } = {}) {
  const messages = chat?.message ?? [];
  const status = latestStatus(chat, at ?? Infinity);
  const here = (name ? townOf([name], region) : null) ?? townOf([status?.location, status?.site].filter(Boolean), region);
  if (here) return here;
  const looked = lookedOf(chat);
  for (let i = Math.min(at ?? Infinity, messages.length - 1); i >= 0; i--) {
    const town = messageTown(looked, messages[i], i, region);
    if (town) return town;
  }
  return null;
}

const LOOKED = new Map(), LOOKED_CHATS = 2;
function lookedOf(chat) {
  const key = String(chat?.id ?? '');
  const looked = LOOKED.get(key) ?? new Map();
  LOOKED.delete(key);
  LOOKED.set(key, looked); // the latest last
  while (LOOKED.size > LOOKED_CHATS) LOOKED.delete(LOOKED.keys().next().value);
  return looked;
}

function messageTown(looked, message, i, region) {
  if (message?.role !== 'char') return null;
  const data = String(message.data ?? '');
  let entry = looked.get(i);
  if (!entry || entry.data !== data) looked.set(i, entry = { data, towns: new Map() });
  const r = region ?? '';
  if (!entry.towns.has(r)) {
    let town = null;
    for (const window of statusPlacesIn(message)) if ((town = townOf([window.location, window.site].filter(Boolean), region))) break;
    entry.towns.set(r, town);
  }
  return entry.towns.get(r);
}

const PERIOD_MESSAGES = 10;

export const shopPeriod = (week, at) => (week ?? `m${Math.floor(Math.max(0, at ?? 0) / PERIOD_MESSAGES)}`);

export function shopContext(state, chat, at, { compat = false, balance = null, machinesAt = () => null, genAt = () => null, gameAt = () => null, rulesAt = () => null, name = null } = {}) {
  const status = latestStatus(chat, at ?? Infinity);
  const week = storyWeek(status?.date);
  const region = status?.region ?? null;
  const i = Number.isInteger(at) ? at : (chat?.message ?? []).length;
  const gen = genAt(i) ?? null;
  const game = gameAt(chat, i, region) ?? null;
  const townId = rulesAt(i)?.shopTown010 ? shopTownAt(chat, at, { region, name }) : null;
  return { region, ...(townId ? { townId } : {}), machines: machinesAt(chat, i, region), ...(gen ? { gen } : {}), ...(game ? { game } : {}), week, period: shopPeriod(week, at), badges: badgeCount(state),
    town: shopPlaces(status, name, region),
    money: !compat && OWN_MONEY_SHOWN && Number.isFinite(state?.money) ? state.money : null,
    budget: compat && Number.isFinite(balance) ? balance : null };
}

// -- Paying ---------------------------------

export function checkout(state, cart, stock, { compatMoney = false, budget = null, premier = {} } = {}) {
  const lines = Object.entries(cart ?? {}).filter(([, count]) => count !== 0);
  if (!lines.length) return { error: 'empty' };
  const shelf = new Map((stock ?? []).map(entry => [entry.id, entry]));
  if (lines.some(([id, count]) => !shelf.has(id) || !Number.isSafeInteger(count) || count < 1 || ((shelf.get(id).limited || shelf.get(id).one) && count > 1)
    || shelf.get(id).soldOut)) return { error: 'changed' };
  const total = lines.reduce((sum, [id, count]) => sum + shelf.get(id).price * count, 0);
  const tracked = !compatMoney && Number.isFinite(state?.money);
  if (tracked ? total > state.money : Number.isFinite(budget) && total > budget) return { error: 'notEnough' };
  const balls = premier ? lines.reduce((sum, [id, count]) => sum + ((premier.only ? id === premier.only : isBall(id)) ? count : 0), 0) : 0;
  const bonus = Math.floor(balls / PREMIER_EVERY);
  const ops = [
    ...(tracked && total ? [{ op: 'money', delta: -total }] : []),
    ...lines.map(([id, count]) => {
      const { price, limited, pack = 1 } = shelf.get(id);
      return { op: 'item', item: id, delta: count * pack, price: price / pack, ...(limited ? { limited } : {}) };
    }),
    ...(bonus ? [{ op: 'item', item: PREMIER, delta: bonus, bonus: true }] : []),
  ];
  return { ops, total, bonus };
}

// -- Selling ---------------------------------

export function sellPrice(id, game = null) {

  const key = OUTSIDE_ITEMS[id]?.kind === 'key' || !!BAG_ITEMS[id]?.key;
  if (isCustomItem(id) || isZCrystalId(id) || (key && !Object.hasOwn(SHOP.sellPrices ?? {}, id))) return null;
  const price = shopPrice(id, game) ?? priceIn(SHOP.specials.prices, id) ?? priceIn(SHOP.sellPrices, id);
  return Number.isFinite(price) && price > 0 ? Math.floor(price / 2) : null;
}

export const sellList = (state, game = null) => Object.entries(state?.bag ?? {}).filter(([id, n]) => n > 0 && sellPrice(id, game))
  .map(([id, owned]) => ({ id, price: sellPrice(id, game), owned }));

export function sellCheckout(state, cart, list, { compatMoney = false } = {}) {
  const lines = Object.entries(cart ?? {}).filter(([, count]) => count !== 0);
  if (!lines.length) return { error: 'empty' };
  const bag = new Map((list ?? []).map(entry => [entry.id, entry]));
  if (lines.some(([id, count]) => !bag.has(id) || !Number.isSafeInteger(count) || count < 1 || count > bag.get(id).owned)) return { error: 'fewer' };
  const total = lines.reduce((sum, [id, count]) => sum + bag.get(id).price * count, 0);
  const tracked = !compatMoney && Number.isFinite(state?.money);
  const ops = [...lines.map(([id, count]) => ({ op: 'item', item: id, delta: -count, price: bag.get(id).price, fromBag: true })),
    ...(tracked && total ? [{ op: 'money', delta: total }] : [])];
  return { ops, total };
}

export function tradeList(stock, state, game = null) {
  const bag = state?.bag ?? {};
  const shelf = (stock ?? []).map(entry => ({ ...entry, sell: sellPrice(entry.id, game), owned: bag[entry.id] > 0 ? bag[entry.id] : 0 }));
  const onShelf = new Set(shelf.map(entry => entry.id));
  return [...shelf, ...sellList(state, game).filter(entry => !onShelf.has(entry.id)).map(({ id, price, owned }) => ({ id, price: null, sell: price, owned }))];
}

export function tradeCheckout(state, cart, stock, list, { compatMoney = false, budget = null, premier = {} } = {}) {
  const lines = Object.entries(cart ?? {}).filter(([, count]) => count !== 0);
  if (!lines.length) return { error: 'empty' };
  const buying = lines.filter(([, count]) => count > 0), selling = lines.filter(([, count]) => !(count > 0)).map(([id, count]) => [id, -count]);
  const sold = selling.length ? sellCheckout(state, Object.fromEntries(selling), list, { compatMoney }) : { ops: [], total: 0 };
  if (sold.error) return sold;
  const got = sold.total;
  if (!buying.length) return { ops: sold.ops, spent: 0, got, bonus: 0 };
  const after = Number.isFinite(state?.money) ? { ...state, money: state.money + got } : state;
  const bought = checkout(after, Object.fromEntries(buying), stock, { compatMoney, budget: Number.isFinite(budget) ? budget + got : budget, premier });
  if (bought.error) return bought;
  return { ops: [...sold.ops, ...bought.ops], spent: bought.total, got, bonus: bought.bonus };
}

// -- The shop's one action ---------------------------------

export const shopAction = ({ ops }, shop) => ({ type: 'shop', ops, shop });

export function shopEvent(ops) {
  const event = { kind: 'shop', buy: [], bonus: [], sell: [], spent: 0, got: 0 };
  for (const op of ops ?? []) {
    if (op.op !== 'item') continue;
    const list = op.bonus ? event.bonus : op.delta > 0 ? event.buy : event.sell;
    const count = Math.abs(op.delta);
    const line = list.find(l => l.item === op.item);
    if (line) line.count += count; else list.push({ item: op.item, count });
    if (!op.bonus) event[op.delta > 0 ? 'spent' : 'got'] += (op.price ?? 0) * count;
  }
  return event;
}

export function compatMoneyWrite(/* chat, total */) {
  return false;
}
