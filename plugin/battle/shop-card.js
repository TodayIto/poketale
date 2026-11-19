import { shopsIn, shopContext, shopStock, checkout, sellList, sellCheckout, shopAction } from '../../story/shop.mjs';
import { renderShopCard, renderShopInside, SHOP_MS, SPECIAL_TAB, cartMost } from '../../story/shop-card.mjs';
import { itemIcon, itemLabel, bagGroup, BAG_GROUPS, namesFor } from '../../story/panel.mjs';
import { WHAT, failureNote } from '../../story/failure.mjs';
import { limitedBought, shopBalance } from '../../story/acts.mjs';
import { rulesAt } from '../../story/setting-changes.mjs';

function shopUsable(chat, at, key) {
  const messages = chat?.message ?? [];
  return shopsIn(messages[at], at, rulesAt(chat)(at)).at(-1)?.key === key && !messages.slice(at + 1).some(m => m?.role === 'char');
}

function findShop(chat, key) {
  const messages = chat?.message ?? [];
  const readAt = rulesAt(chat);
  for (let at = messages.length - 1; at >= 0; at--) {
    const found = shopsIn(messages[at], at, readAt(at)).find(s => s.key === key);
    if (found) return { at, key, shop: found.shop };
  }
  return null;
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const withIndex = (html, at) => html.replaceAll('{{chat_index}}', String(at));

export function createShopCards(host) {

  const open = new Map();

  const drawn = new Map();
  const nameOf = (pass, key) => `${pass.id}:${key}`;

  async function counter(pass, { at, shop }, mem) {
    const state = await pass.state();

    const ctx = shopContext(state, pass.chat, at, { compat: host.compat(pass), balance: shopBalance(pass.chat, { survey: pass.survey }) });
    const options = { compatMoney: ctx.money === null, budget: ctx.budget };
    const cart = mem?.carts[mem.mode] ?? {};
    if (mem?.mode === 'sell') {
      const list = sellList(state);
      return { state, ctx, list, paid: sellCheckout(state, cart, list, options) };
    }

    const list = shopStock({ kind: shop.kind, region: ctx.region, period: ctx.period, badges: ctx.badges, town: ctx.town, bought: limitedBought(pass.chat, { survey: pass.survey }),
      foeGimmicks: host.foeGimmicks?.(), bag: state?.bag });
    return { state, ctx, list, paid: checkout(state, cart, list, options) };
  }
  async function viewOf(pass, found, { grow = false } = {}) {
    const { at, key, shop } = found;
    const base = { key, kind: shop.kind, ...(shop.name ? { name: shop.name } : {}), buttonsOff: host.doc() === null };
    if (!shopUsable(pass.chat, at, key)) { open.delete(nameOf(pass, key)); return { ...base, phase: 'past' }; }
    const mem = open.get(nameOf(pass, key));
    const { state, ctx, list, paid } = await counter(pass, found, mem);
    const placed = { ...base, region: ctx.region };
    if (!mem) return { ...placed, phase: 'closed' };
    const cart = mem.carts[mem.mode];
    const names = namesFor(host.lang(pass.chat), host.sim);

    const all = list.map(s => ({ ...s, name: itemLabel(state, s.id, names, { bag: true }), icon: itemIcon(s.id, host.sim), count: cart[s.id] ?? 0,
      tab: s.limited ? SPECIAL_TAB : bagGroup(s.id, host.sim) }));
    const tabs = [...BAG_GROUPS, SPECIAL_TAB].filter(tab => all.some(r => r.tab === tab)).map(tab => ({ id: tab, dot: all.some(r => r.tab === tab && r.count) }));
    const tab = tabs.some(t => t.id === mem.tab) ? mem.tab : tabs[0]?.id ?? null;
    return { ...placed, phase: 'open', grow, money: ctx.money ?? ctx.budget, mode: mem.mode, tabs, tab, rows: all.filter(r => r.tab === tab),
      fill: Math.max(0, ...tabs.map(t => all.filter(r => r.tab === t.id).length)), total: all.reduce((sum, r) => sum + r.price * r.count, 0),
      bonus: paid.error ? 0 : paid.bonus ?? 0, why: paid.error ?? null, paid: !!mem.paid, ...(mem.note ? { note: mem.note } : {}) };
  }
  const remember = (pass, view, at) => {
    const html = renderShopInside({ ...view, grow: false }, host.lang(pass.chat));
    drawn.set(nameOf(pass, view.key), { id: pass.id, key: view.key, at, html });
    return html;
  };

  async function draw(pass, at, piece) {
    const view = await viewOf(pass, { at, key: piece.key, shop: piece.shop });
    remember(pass, view, at);
    return renderShopCard(view, host.lang(pass.chat));
  }

  async function swap(pass, shop, extra) {
    const view = await viewOf(pass, shop, extra);
    const html = remember(pass, view, shop.at);
    const doc = host.doc();
    const element = doc && await doc.querySelector(`.x-risu-pkbsh-${view.key}`);
    if (!element) return;
    await element.setInnerHTML(withIndex(extra?.grow ? renderShopInside(view, host.lang(pass.chat)) : html, shop.at));
    await host.bindButtons();
  }

  async function fold(pass, shop, key) {
    const doc = host.doc();
    const body = doc && await doc.querySelector(`.x-risu-pkbsb-${key}`);
    if (body) { await body.addClass('x-risu-pkb-shgone'); await sleep(SHOP_MS.fold); }
    open.delete(nameOf(pass, key));
    await swap(pass, shop);
  }

  async function pay(pass, shop, key, mem) {
    const { paid } = await counter(pass, shop, mem);
    if (paid.error) return swap(pass, shop);
    try {
      await host.queue(shopAction(paid, key), pass.target);
    } catch (error) {
      if (!error?.why) console.error(error);
      mem.note = failureNote(WHAT.action, error, host.lang(pass.chat));
      return swap(pass, shop);
    }
    mem.carts[mem.mode] = {};
    mem.paid = true;
    const now = await host.actionPass() ?? pass;
    await swap(now, shop);
    await sleep(SHOP_MS.paid);
    mem.paid = false;
    await swap(await host.actionPass() ?? now, shop);
  }

  async function press({ key, action, item }) {
    const pass = await host.actionPass();
    if (!pass) return;
    const shop = findShop(pass.chat, key);
    if (!shop) return;
    const name = nameOf(pass, key);
    if (!shopUsable(pass.chat, shop.at, key)) { open.delete(name); await swap(pass, shop); return; }
    let mem = open.get(name);
    if (mem?.busy) return;
    if (action === 'shopin') {
      if (mem) return;
      open.set(name, { mode: 'buy', tab: null, carts: { buy: {}, sell: {} } });
      return swap(pass, shop, { grow: true });
    }
    if (!mem) return swap(pass, shop);
    mem.busy = true;
    try {
      delete mem.note;
      switch (action) {
      case 'shopout': return await fold(pass, shop, key);
      case 'shoppay': return await pay(pass, shop, key, mem);
      case 'shopbuy': case 'shopsell': mem.mode = action === 'shopbuy' ? 'buy' : 'sell'; mem.tab = null; break;
      case 'shoptab': mem.tab = item; break;
      case 'shopadd': case 'shopsub': {
        const cart = mem.carts[mem.mode];
        const row = mem.mode === 'sell' ? sellList(await pass.state()).find(s => s.id === item) : (await counter(pass, shop, mem)).list.find(s => s.id === item);
        const most = cartMost(mem.mode, row);
        const next = Math.min(most, Math.max(0, (cart[item] ?? 0) + (action === 'shopadd' ? 1 : -1)));
        if (next) cart[item] = next; else delete cart[item];
        break;
      }
      default: return;
      }
      return await swap(pass, shop);
    } finally {
      mem = open.get(name);
      if (mem) mem.busy = false;
    }
  }

  async function refresh(pass) {
    let swapped = false;
    for (const [name, card] of drawn) {
      const shop = card.id === pass.id ? findShop(pass.chat, card.key) : null;
      if (!shop) { drawn.delete(name); open.delete(name); continue; }
      if (open.get(name)?.busy) continue;
      const view = await viewOf(pass, shop);
      const html = renderShopInside(view, host.lang(pass.chat));
      if (html === card.html) continue;
      try {
        const doc = host.doc();
        const element = doc && await doc.querySelector(`.x-risu-pkbsh-${card.key}`);
        if (element) { await element.setInnerHTML(withIndex(html, shop.at)); swapped = true; }
        drawn.set(name, { ...card, at: shop.at, html });
      } catch (error) { console.warn('[poke-battle] 상점 카드를 바꿔 끼우지 못함', error); }
    }
    if (swapped) await host.bindButtons();
  }

  return { draw, press, refresh };
}

export const SHOP_ACTIONS = new Set(['shopin', 'shopout', 'shopadd', 'shopsub', 'shoppay', 'shopbuy', 'shopsell', 'shoptab']);
