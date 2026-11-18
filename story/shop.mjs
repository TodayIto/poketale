import SHOP from '../data/shop.json' with { type: 'json' };
import { shopsIn, shopsInText, seededIndex } from './blocks.mjs';
import { latestStatus, OWN_MONEY_SHOWN } from './compat.mjs';
import { badgeCount } from './badges.mjs';
import { isBall } from '../engine/bag.mjs';
import { OUTSIDE_ITEMS } from './items.mjs';
import { norm, escapeRe } from './norm.mjs';
import { isCustomItem } from './custom-items.mjs';
import { MACHINE_STANDARDS } from './machine-standards.mjs';

export { shopsIn, shopsInText };

export const PREMIER_EVERY = 10;

export const PREMIER = SHOP.premier;
const SHOP_KINDS = ['mart', 'department'];

const priceIn = (table, id) => (Object.hasOwn(table, id) ? table[id] : null);

// game: the game the shop's place belongs to (story/generation.mjs placeGameAt), whose prices it charges where they
// differ from today's (SHOP.games); null: today's prices
export const shopPrice = (id, game = null) => (game ? priceIn(SHOP.games?.[game] ?? {}, id) : null) ?? priceIn(SHOP.prices, id);

// Goods the place's era did not have yet (SHOP.since: the first generation an item appears in) are off the shelves while
// the "Gimmicks Not in the Generation" setting is Disable; with Enable they stay, at today's price. The era is the later
// of the game's generation and the story's world generation (world): Pewter Crunchies, first sold in Let's Go, are in a
// generation-7 world's Pewter City though Kanto's shops are HeartGold/SoulSilver's there. No game: every shelf as today.
const onShelf = (game, gimmicks, world = null) => {
  const gen = game ? Math.max(MACHINE_STANDARDS[game]?.gen ?? 0, Number.isInteger(world) ? world : 0) : 0;
  return !gen || gimmicks === 'enable' ? () => true : id => !(SHOP.since?.[id] > gen);
};

// The Premier Ball given for every ten Poké Balls, where the era has it
export const premierGiven = ({ game = null, world = null, gimmicks = null } = {}) => onShelf(game, gimmicks, world)(PREMIER);

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

function seededPick(items, k, seed) {
  const left = [...items], out = [];
  for (let i = 0; i < k && left.length; i++) out.push(...left.splice(seededIndex(`${seed}:${i}`, left.length), 1));
  return out;
}

const TOWN_SUFFIX = /(마을|시티|타운|시|town|city|village)$/;
const townCore = name => norm(name).replace(TOWN_SUFFIX, '');

const KO_TOWN_KINDS = [
  { kind: 'city', names: ['시티', '도시', '시'], long: ['시티', 'city'], short: ['도시', '시'] },
  { kind: 'village', names: ['마을', '타운', '빌리지', '촌'], long: ['마을', '타운', '빌리지', 'town', 'village'], short: ['촌'] },
];
const KO_PARTICLES = ['에서는', '에서', '에선', '에는', '으로', '까지', '부터', '의', '에', '로', '는', '은', '이', '가', '을', '를', '와', '과', '도', '쪽'];
const HANGUL = /\p{Script=Hangul}/u;

function koTown(town) {
  if (!HANGUL.test(town)) return null;
  const name = norm(town);
  for (const kind of KO_TOWN_KINDS) {
    const suffix = kind.names.find(s => name.endsWith(s) && name.length > s.length);
    if (suffix) return { kind, stem: name.slice(0, -suffix.length) };
  }
  return null;
}

function townMatcher(town) {
  const ko = koTown(town);
  if (ko) {
    const { kind, stem } = ko;
    if (stem.length < 2) return () => false;
    const named = new RegExp(`${escapeRe(stem)}\\s*(?:${kind.long.join('|')}|(?:${kind.short.join('|')})(?:${KO_PARTICLES.join('|')})?(?![\\p{L}\\p{N}]))`, 'u');
    return place => norm(place) === stem || named.test(String(place ?? '').normalize('NFKC').toLowerCase());
  }
  const core = townCore(town);
  return core.length >= 2 ? place => norm(place).includes(core) : () => false;
}
const TOWN_MATCHERS = new Map(SHOP.specialties.flatMap(s => s.towns).map(town => [town, townMatcher(town)]));

export function townSpecialties(places, region = null) {
  const text = (places ?? []).filter(place => norm(place));
  if (!text.length) return [];
  return SHOP.specialties.filter(s => (!region || s.region === region) && s.towns.some(town => text.some(TOWN_MATCHERS.get(town)))).map(s => s.item);
}

const salePrice = (price, off) => Math.max(SHOP.sale.round, Math.round((price * (100 - off)) / 100 / SHOP.sale.round) * SHOP.sale.round);

export const saleCount = (n, share) => (share > 0 && n > 0 ? Math.max(1, Math.round((n * share) / 100)) : 0);

function weighted(list, seed) {
  let roll = seededIndex(seed, list.reduce((sum, [, weight]) => sum + weight, 0));
  for (const [value, weight] of list) { if (roll < weight) return value; roll -= weight; }
  return list.at(-1)[0];
}

// A tier the era has nothing of gives its share to the other common tiers; the rare ones (the Master Ball) keep theirs,
// so a Department Store left with only the Master Ball stocks it no more often than today, and the rest of its rolls
// stock nothing. With every tier there, today's weights (and rolls) as they are.
const RARE_TIERS = new Set(['master']);
const sumOf = list => list.reduce((sum, t) => sum + t.weight, 0);
function tierWeights(tiers, keep) {
  const left = tiers.filter(t => t.items.some(keep));
  if (left.length === tiers.length) return tiers.map(t => [t.tier, t.weight]);
  const rare = left.filter(t => RARE_TIERS.has(t.tier)), common = left.filter(t => !RARE_TIERS.has(t.tier));
  const total = sumOf(tiers), rareShare = sumOf(rare), commonSum = sumOf(common);
  if (!commonSum) return [...rare.map(t => [t.tier, t.weight]), ...(total > rareShare ? [[null, total - rareShare]] : [])];
  return [...rare.map(t => [t.tier, t.weight * commonSum]), ...common.map(t => [t.tier, t.weight * (total - rareShare)])];
}

function specialGoods(shop, seed, keep = () => true, game = null) {
  const { count, tiers } = SHOP.specials[shop];
  const weights = tierWeights(tiers, keep);
  const out = [];
  for (let i = 0, n = weighted(count, `${seed}:sp`); i < n && weights.length; i++) {
    const tier = tiers.find(t => t.tier === weighted(weights, `${seed}:sp:${i}:tier`));
    const left = tier?.items.filter(id => keep(id) && !out.some(o => o.id === id)) ?? [];
    if (!left.length) continue;
    const id = left[seededIndex(`${seed}:sp:${i}:item`, left.length)];
    // A Vitamin costs what the game charges for it on the shelves
    out.push({ id, price: (game ? priceIn(SHOP.games?.[game] ?? {}, id) : null) ?? SHOP.specials.prices[id], special: true, limited: seed });
  }
  return out;
}

export const limitedKey = (seed, id) => `${seed}|${id}`;

// game, world: the shop's place (story/generation.mjs placeEraAt); gimmicks: the "Gimmicks Not in the Generation" setting
export function shopStock({ kind, region = null, period = null, badges = 0, town = [], bought = new Set(), game = null, world = null, gimmicks = null } = {}) {
  const shop = SHOP_KINDS.includes(kind) ? kind : 'mart';
  const seed = shelvesSeed({ kind: shop, region, period });
  const keep = onShelf(game, gimmicks, world);
  const basics = SHOP.mart.basics.filter(row => shop === 'department' || (badges ?? 0) >= row.badges).flatMap(row => row.items).filter(keep);
  const have = new Set(basics);
  const fresh = list => list.filter(id => !have.has(id) && (have.add(id), true));
  const { min, max, items } = shop === 'mart' ? SHOP.mart.picks : { ...SHOP.department.picks, items: SHOP.department.pools.flatMap(p => p.items) };
  const picks = fresh(seededPick([...new Set(items)].filter(id => keep(id) && !have.has(id)), min + seededIndex(`${seed}:count`, max - min + 1), seed));
  picks.push(...fresh(townSpecialties(town, region).filter(keep)));
  const row = special => id => ({ id, price: shopPrice(id, game), special });
  let stock = [...basics.map(row(false)), ...picks.map(row(true))];
  const sale = SHOP.sale;
  const share = sale.shareMin + seededIndex(`${seed}:share`, sale.shareMax - sale.shareMin + 1);
  const onSale = new Set(seededPick(stock.map(entry => entry.id), saleCount(stock.length, share), `${seed}:sale`));
  stock = stock.map(entry => {
    if (!onSale.has(entry.id)) return entry;
    const price = salePrice(entry.price, sale.offMin + seededIndex(`${seed}:off:${entry.id}`, sale.offMax - sale.offMin + 1));
    return price < entry.price ? { ...entry, price, was: entry.price } : entry;
  });
  const specials = specialGoods(shop, seed, keep, game).filter(entry => !have.has(entry.id))
    .map(entry => (bought.has(limitedKey(seed, entry.id)) ? { ...entry, soldOut: true } : entry));
  return [...stock, ...specials];
}

export const shelvesSeed = ({ kind, region = null, period = null }) => `shop:${kind}:${region ?? ''}:${period ?? ''}`;

const PERIOD_MESSAGES = 10;

export const shopPeriod = (week, at) => (week ?? `m${Math.floor(Math.max(0, at ?? 0) / PERIOD_MESSAGES)}`);

export function shopContext(state, chat, at, { compat = false, balance = null } = {}) {
  const status = latestStatus(chat, at ?? Infinity);
  const week = storyWeek(status?.date);
  return { region: status?.region ?? null, week, period: shopPeriod(week, at), badges: badgeCount(state), town: [status?.location, status?.site].filter(Boolean),
    money: !compat && OWN_MONEY_SHOWN && Number.isFinite(state?.money) ? state.money : null,
    budget: compat && Number.isFinite(balance) ? balance : null };
}

// premier: whether the era has the Premier Ball given for every ten Poké Balls (premierGiven)
export function checkout(state, cart, stock, { compatMoney = false, budget = null, premier = true } = {}) {
  const lines = Object.entries(cart ?? {}).filter(([, count]) => count !== 0);
  if (!lines.length) return { error: 'empty' };
  const shelf = new Map((stock ?? []).map(entry => [entry.id, entry]));
  if (lines.some(([id, count]) => !shelf.has(id) || !Number.isSafeInteger(count) || count < 1 || (shelf.get(id).limited && (count > 1 || shelf.get(id).soldOut)))) return { error: 'changed' };
  const total = lines.reduce((sum, [id, count]) => sum + shelf.get(id).price * count, 0);
  const tracked = !compatMoney && Number.isFinite(state?.money);
  if (tracked ? total > state.money : Number.isFinite(budget) && total > budget) return { error: 'notEnough' };
  const balls = lines.reduce((sum, [id, count]) => sum + (isBall(id) ? count : 0), 0);
  const bonus = premier ? Math.floor(balls / PREMIER_EVERY) : 0;
  const ops = [
    ...(tracked && total ? [{ op: 'money', delta: -total }] : []),
    ...lines.map(([id, count]) => ({ op: 'item', item: id, delta: count, price: shelf.get(id).price, ...(shelf.get(id).limited ? { limited: shelf.get(id).limited } : {}) })),
    ...(bonus ? [{ op: 'item', item: PREMIER, delta: bonus, bonus: true }] : []),
  ];
  return { ops, total, bonus };
}

export function sellPrice(id, game = null) {

  if (isCustomItem(id) || (OUTSIDE_ITEMS[id]?.kind === 'key' && !Object.hasOwn(SHOP.sellPrices ?? {}, id))) return null;
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

export function compatMoneyWrite(                 ) {
  return false;
}
