import SHOP from '../data/shop.json' with { type: 'json' };
import { shopsIn, shopsInText, seededIndex } from './blocks.mjs';
import { latestStatus, OWN_MONEY_SHOWN } from './compat.mjs';
import { badgeCount } from './badges.mjs';
import { isBall, BAG_ITEMS } from '../engine/bag.mjs';
import { OUTSIDE_ITEMS } from './items.mjs';
import { norm, escapeRe } from './norm.mjs';
import { isCustomItem } from './custom-items.mjs';
import { regionGimmick, DEFAULT_FOE_GIMMICKS } from './gimmicks.mjs';

export { shopsIn, shopsInText };

export const PREMIER_EVERY = 10;

export const PREMIER = SHOP.premier;
const SHOP_KINDS = ['mart', 'department'];

export const ONE_PER_PLAYER = Object.freeze(['teraorb', 'oldrod', 'goodrod', 'superrod', 'griseouscore', 'adamantcrystal', 'lustrousglobe', 'pokeflute']);

const priceIn = (table, id) => (Object.hasOwn(table, id) ? table[id] : null);

export const shopPrice = id => priceIn(SHOP.prices, id);

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

export const placeMatcher = townMatcher;
const ROUTE_RE = [/(\d{1,3})\s*번\s*(?:도로|수로)/u, /\broute\s*(\d{1,3})\b/i, /^(\d{1,3})\s*번$/u];

export function routeOf(text) {
  const s = String(text ?? '').normalize('NFKC');
  for (const re of ROUTE_RE) { const m = re.exec(s); if (m) return Number(m[1]); }
  return null;
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

function tierItems(shop, tier, region, foeGimmicks) {
  if (tier.gimmick) {
    const sold = foeGimmicks === 'pokerogue' ? () => true : gimmick => gimmick === regionGimmick(region);
    return SHOP.specials.gimmickGoods.filter(g => g.tier === tier.tier && sold(g.gimmick)).flatMap(g => g.items);
  }
  const trs = SHOP.specials.trs;
  if (tier.tier !== trs.tier || region !== trs.region) return tier.items;
  return [...tier.items.filter(id => !Object.hasOwn(trs.replaces, id)), ...(shop === trs.shop ? trs.items : [])];
}

function specialGoods(shop, seed, region, foeGimmicks, owned = new Set()) {
  const { count } = SHOP.specials[shop];
  const tiers = SHOP.specials[shop].tiers.map(t => ({ ...t, items: tierItems(shop, t, region, foeGimmicks) })).filter(t => t.items.length);
  const draws = [];
  for (let i = 0, n = weighted(count, `${seed}:sp`); i < n; i++) {
    const tier = tiers.find(t => t.tier === weighted(tiers.map(t => [t.tier, t.weight]), `${seed}:sp:${i}:tier`));
    const left = tier.items.filter(id => !draws.some(d => d.id === id));
    if (left.length) draws.push({ i, tier, id: left[seededIndex(`${seed}:sp:${i}:item`, left.length)] });
  }

  const ids = new Set(draws.map(d => d.id));
  const free = tier => tier.items.filter(id => !ids.has(id) && !owned.has(id));
  const out = [];
  for (const { i, tier, id } of draws) {
    let pick = id;
    if (owned.has(id)) {
      const open = tiers.filter(t => free(t).length);
      if (!open.length) continue;
      const again = free(tier).length ? tier : open.find(t => t.tier === weighted(open.map(t => [t.tier, t.weight]), `${seed}:sp:${i}:owned:tier`));
      const items = free(again);
      pick = items[seededIndex(`${seed}:sp:${i}:owned:item`, items.length)];
      ids.add(pick);
    }
    out.push({ id: pick, price: SHOP.specials.prices[pick], special: true, limited: seed });
  }
  return out;
}

export const limitedKey = (seed, id) => `${seed}|${id}`;

export function shopStock({ kind, region = null, period = null, badges = 0, town = [], bought = new Set(), foeGimmicks = DEFAULT_FOE_GIMMICKS, bag = {} } = {}) {
  const shop = SHOP_KINDS.includes(kind) ? kind : 'mart';
  const seed = shelvesSeed({ kind: shop, region, period });
  const basics = SHOP.mart.basics.filter(row => shop === 'department' || (badges ?? 0) >= row.badges).flatMap(row => row.items);
  const have = new Set(basics);
  const fresh = list => list.filter(id => !have.has(id) && (have.add(id), true));
  const { min, max, items } = shop === 'mart' ? SHOP.mart.picks : { ...SHOP.department.picks, items: SHOP.department.pools.flatMap(p => p.items) };
  const picks = fresh(seededPick([...new Set(items)].filter(id => !have.has(id)), min + seededIndex(`${seed}:count`, max - min + 1), seed));
  picks.push(...fresh(townSpecialties(town, region)));
  const row = special => id => ({ id, price: SHOP.prices[id], special });

  const one = entry => (ONE_PER_PLAYER.includes(entry.id) ? { ...entry, one: true } : entry);
  let stock = [...basics.filter(id => !(ONE_PER_PLAYER.includes(id) && bag?.[id] > 0)).map(row(false)).map(one), ...picks.map(row(true))];
  const sale = SHOP.sale;
  const share = sale.shareMin + seededIndex(`${seed}:share`, sale.shareMax - sale.shareMin + 1);
  const onSale = new Set(seededPick(stock.map(entry => entry.id), saleCount(stock.length, share), `${seed}:sale`));
  stock = stock.map(entry => {
    if (!onSale.has(entry.id)) return entry;
    const price = salePrice(entry.price, sale.offMin + seededIndex(`${seed}:off:${entry.id}`, sale.offMax - sale.offMin + 1));
    return price < entry.price ? { ...entry, price, was: entry.price } : entry;
  });
  const owned = new Set(ONE_PER_PLAYER.filter(id => bag?.[id] > 0 && !bought.has(limitedKey(seed, id))));
  const specials = specialGoods(shop, seed, region, foeGimmicks, owned).filter(entry => !have.has(entry.id))
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

export function checkout(state, cart, stock, { compatMoney = false, budget = null } = {}) {
  const lines = Object.entries(cart ?? {}).filter(([, count]) => count !== 0);
  if (!lines.length) return { error: 'empty' };
  const shelf = new Map((stock ?? []).map(entry => [entry.id, entry]));
  if (lines.some(([id, count]) => !shelf.has(id) || !Number.isSafeInteger(count) || count < 1 || ((shelf.get(id).limited || shelf.get(id).one) && count > 1)
    || shelf.get(id).soldOut)) return { error: 'changed' };
  const total = lines.reduce((sum, [id, count]) => sum + shelf.get(id).price * count, 0);
  const tracked = !compatMoney && Number.isFinite(state?.money);
  if (tracked ? total > state.money : Number.isFinite(budget) && total > budget) return { error: 'notEnough' };
  const balls = lines.reduce((sum, [id, count]) => sum + (isBall(id) ? count : 0), 0);
  const bonus = Math.floor(balls / PREMIER_EVERY);
  const ops = [
    ...(tracked && total ? [{ op: 'money', delta: -total }] : []),
    ...lines.map(([id, count]) => ({ op: 'item', item: id, delta: count, price: shelf.get(id).price, ...(shelf.get(id).limited ? { limited: shelf.get(id).limited } : {}) })),
    ...(bonus ? [{ op: 'item', item: PREMIER, delta: bonus, bonus: true }] : []),
  ];
  return { ops, total, bonus };
}

export function sellPrice(id) {

  const key = OUTSIDE_ITEMS[id]?.kind === 'key' || !!BAG_ITEMS[id]?.key;
  if (isCustomItem(id) || (key && !Object.hasOwn(SHOP.sellPrices ?? {}, id))) return null;
  const price = shopPrice(id) ?? priceIn(SHOP.specials.prices, id) ?? priceIn(SHOP.sellPrices, id);
  return Number.isFinite(price) && price > 0 ? Math.floor(price / 2) : null;
}

export const sellList = state => Object.entries(state?.bag ?? {}).filter(([id, n]) => n > 0 && sellPrice(id))
  .map(([id, owned]) => ({ id, price: sellPrice(id), owned }));

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
