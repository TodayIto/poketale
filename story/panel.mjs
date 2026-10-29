import { BAG_ITEMS } from '../engine/bag.mjs';
import { BALLS } from '../engine/capture.mjs';
import { expForLevel, growthOf } from '../engine/exp.mjs';
import { STATS, evolutionTargets, holdsEverstone, displayName } from '../engine/mon.mjs';
import { applyOps, emptyState, maxHp, movePp, toID, clone } from './state.mjs';
import { PARTY_MAX, MAX_LEVEL, MAX_IV, EV_STAT_MAX, EV_TOTAL_MAX, BOX_SIZE } from './rules.mjs';
import { MAX_PP_UPS } from '../engine/pp.mjs';
import { OUTSIDE_ITEMS, VITAMIN_EVS, HYPER_TRAIN_LEVEL, isTm } from './items.mjs';
import { itemText, tmMove, canLearnTm } from './item-info.mjs';
import { josa, STAT_NAME, natureName } from './diary.mjs';
import { names } from '../names/index.js';
import bagIcons from '../data/bag-icons.json' with { type: 'json' };

export { PARTY_MAX, BOX_SIZE };
export const BOX_COLS = 6;
export const BOX_COUNT = 32;
export const TABS = Object.freeze(['party', 'box', 'bag']);

const refOf = mon => ({ uid: mon.uid });

export function itemName(id) {
  const key = toID(id);
  return names.entry('items', key)?.ko ?? names.items(key);
}

// Name shown in bag rows and menus: TMs include the move they teach ("TM024 Fire Spin")
export function bagItemName(id) {
  const key = toID(id), move = tmMove(key);
  return move ? `${itemName(key)} ${names.moves(move)}` : itemName(key);
}

export const monName = (mon, sim) => displayName(sim.Dex, names, mon.set.species, mon.set.name);

export const LOCK_FREE = new Set(['nickname', 'boxname']);

const evolutionItemCache = new WeakMap();

function evolutionItems(sim) {
  let set = evolutionItemCache.get(sim.Dex);
  if (!set) {
    set = new Set(sim.Dex.species.all().filter(s => s.evoType === 'useItem' && s.evoItem).map(s => toID(s.evoItem)));
    evolutionItemCache.set(sim.Dex, set);
  }
  return set;
}

export function itemKind(id, sim) {
  const key = toID(id);
  if (Object.hasOwn(BALLS, key)) return 'ball';
  const bag = BAG_ITEMS[key];
  if (bag) return bag.heal || bag.cure || bag.revive || bag.pp ? 'medicine' : 'battle';
  if (isTm(key)) return 'tm';
  if (Object.hasOwn(OUTSIDE_ITEMS, key)) return OUTSIDE_ITEMS[key].kind;
  if (key === 'rarecandy') return 'candy';
  if (evolutionItems(sim).has(key)) return 'stone';
  return 'held';
}
const USABLE = new Set(['medicine', 'candy', 'stone', 'train', 'tm', 'evolve']);
const DESCRIBED_ONLY = new Set(['ball', 'battle', 'field', 'key']);

const NOT_HOLDABLE = new Set([...DESCRIBED_ONLY, 'tm']);

const medicineOf = id => BAG_ITEMS[id] ?? (OUTSIDE_ITEMS[id]?.kind === 'medicine' ? OUTSIDE_ITEMS[id] : null);

export function stoneEvolution(sim, mon, id) {
  const key = toID(id);
  const ready = evolutionTargets(sim.Dex, mon.set, t => t.evoType === 'useItem' && toID(t.evoItem) === key);
  return ready.length >= 1 ? ready[0].name : null;
}

export function tradeEvolution(sim, mon) {
  const held = toID(mon.set.item);
  if (holdsEverstone(held)) return null;
  const ready = evolutionTargets(sim.Dex, mon.set, t => t.evoType === 'trade' && !t.evoCondition && t.isNonstandard !== 'CAP' && (!t.evoItem || toID(t.evoItem) === held));
  return ready.length ? { into: ready[0].name, consumeHeld: !!ready[0].evoItem } : null;
}

export function abilityChange(sim, mon, id) {
  const how = OUTSIDE_ITEMS[toID(id)]?.ability;
  if (!how) return null;
  const abilities = sim.Dex.species.get(mon.set.species).abilities;
  const now = toID(mon.set.ability);
  const slot = ['0', '1', 'H'].find(k => abilities[k] && toID(abilities[k]) === now);
  const to = how === 'capsule' ? (slot === '0' ? abilities['1'] : slot === '1' ? abilities['0'] : null)
    : slot === 'H' ? abilities['0'] : slot ? abilities.H : null;
  return to && toID(to) !== now ? to : null;
}

const BOOST_NAME = { ...STAT_NAME, accuracy: '명중률' };
const STATUS_KO = { par: '마비', brn: '화상', slp: '잠듦', frz: '얼음', psn: '독', tox: '맹독' };
export const statusName = status => STATUS_KO[status] ?? '';

export function itemDescription(id, sim) {
  const key = toID(id), kind = itemKind(key, sim), bag = BAG_ITEMS[key];
  if (kind === 'ball') return '야생 포켓몬에게 던져 잡는 볼. 배틀 안의 가방에서 쓴다.';
  if (kind === 'battle') {
    if (bag?.boost) return `나와 있는 포켓몬의 ${BOOST_NAME[bag.boost] ?? bag.boost}을(를) 크게 올린다. 배틀 안의 가방에서 쓴다.`;
    return '나와 있는 포켓몬의 급소율을 올린다. 배틀 안의 가방에서 쓴다.';
  }
  const text = itemText(key);
  if (text) return text;
  if (kind === 'tm') return `포켓몬에게 ${josa(names.moves(tmMove(key)), '을/를')} 가르친다. 배우면 기술머신은 없어진다.`;
  if (kind === 'medicine') {
    if (bag.revive) return `기절한 포켓몬 1마리의 HP를 ${bag.revive === 'full' ? '모두' : '절반'} 회복한다.`;
    if (bag.pp) return bag.oneMove ? `기술 1개의 PP를 ${bag.pp === 'full' ? '모두' : bag.pp} 회복한다.` : `모든 기술의 PP를 ${bag.pp === 'full' ? '모두' : bag.pp}씩 회복한다.`;
    if (bag.heal && bag.cure) return 'HP와 상태 이상을 모두 회복한다.';
    if (bag.heal) return bag.heal === 'full' ? '포켓몬 1마리의 HP를 모두 회복한다.' : `포켓몬 1마리의 HP를 ${bag.heal} 회복한다.`;
    if (bag.cure === 'all') return '포켓몬 1마리의 상태 이상을 모두 회복한다.';
    return `포켓몬 1마리의 ${bag.cure.map(statusName).filter((v, i, a) => v && a.indexOf(v) === i).join('·')} 상태를 회복한다.`;
  }
  if (kind === 'candy') return '포켓몬 1마리의 레벨이 1 오른다.';
  if (kind === 'stone') return '특정 포켓몬에게 쓰면 진화한다.';
  return '포켓몬에게 지니게 하는 도구.';
}

export const NO_EFFECT = '효과가 없는 것 같다...';

export const SELECT_MOVE = '기술을 선택해 주십시오';

export function useCheck(mon, itemId, { sim, exp }) {
  const id = toID(itemId), kind = itemKind(id, sim);
  const fainted = mon.hp === 0;
  const no = { ok: false, reason: NO_EFFECT };
  if (kind === 'medicine') {
    const item = medicineOf(id);
    if (item.revive) return fainted ? { ok: true } : no;
    if (fainted) return no;
    if (item.pp) {

      // Max PP per move follows its PP Up count (story/state.mjs movePp)
      const moves = mon.set.moves.map(m => { const { pp, maxpp } = movePp(sim, mon, m); return { id: m, pp, maxpp, disabled: pp >= maxpp }; });
      if (!moves.some(m => !m.disabled)) return no;
      return item.oneMove ? { ok: true, moves, prompt: SELECT_MOVE } : { ok: true };
    }
    let useful = false;
    if (item.heal) useful ||= mon.hp !== null && mon.hp < maxHp(sim, mon.set);
    if (item.cure) useful ||= !!mon.status && mon.status !== 'fnt' && (item.cure === 'all' || item.cure.includes(mon.status));
    return useful ? { ok: true } : no;
  }
  if (kind === 'candy') return mon.set.level < MAX_LEVEL ? { ok: true } : no;
  if (kind === 'stone') { const into = stoneEvolution(sim, mon, id); return into ? { ok: true, evolve: into } : no; }
  if (kind === 'evolve') { const trade = tradeEvolution(sim, mon); return trade ? { ok: true, evolve: trade.into, consumeHeld: trade.consumeHeld } : no; }
  if (kind === 'tm') {
    const move = tmMove(id);
    if (!move) return no;
    if (mon.set.moves.includes(move)) return { ok: false, reason: `${josa(monName(mon, sim), '은/는')} 이미 ${josa(names.moves(move), '을/를')} 알고 있다!` };
    if (!canLearnTm(sim, mon.set.species, id)) return { ok: false, reason: `${josa(monName(mon, sim), '은/는')} ${josa(names.moves(move), '을/를')} 배울 수 없다!` };
    return { ok: true, teach: move };
  }
  if (kind !== 'train') return no;
  const item = OUTSIDE_ITEMS[id];
  if (item.vitamin) {
    const evs = mon.set.evs ?? {};
    const total = STATS.reduce((sum, s) => sum + (evs[s] ?? 0), 0);
    return (evs[item.vitamin] ?? 0) < EV_STAT_MAX && total < EV_TOTAL_MAX ? { ok: true } : no;
  }

  if (item.ppUp) {
    const moves = mon.set.moves.map(m => {
      const { pp, maxpp, ppUps } = movePp(sim, mon, m);
      return { id: m, pp, maxpp, ppUps, disabled: ppUps >= MAX_PP_UPS || !!sim.Dex.moves.get(m).noPPBoosts };
    });
    return moves.some(m => !m.disabled) ? { ok: true, moves, prompt: SELECT_MOVE } : no;
  }
  if (item.exp) return mon.set.level < MAX_LEVEL && growthOf(exp, sim.Dex.species.get(mon.set.species)) ? { ok: true } : no;
  if (item.ability) {
    const to = abilityChange(sim, mon, id);
    return to ? { ok: true, confirm: `${monName(mon, sim)}의 특성을 ${josa(names.abilities(to), '으로/로')} 바꾸겠습니까?` } : no;
  }
  if (item.mint) return item.mint !== mon.set.nature ? { ok: true } : no;
  if (item.hyper) {
    if (mon.set.level < HYPER_TRAIN_LEVEL) return no;
    const stats = STATS.map(s => ({ id: s, iv: mon.set.ivs?.[s] ?? MAX_IV }));
    if (!stats.some(s => s.iv < MAX_IV)) return no;
    return item.hyper === 'one' ? { ok: true, stats } : { ok: true };
  }
  return no;
}

export const partyWide = id => !!OUTSIDE_ITEMS[toID(id)]?.all;

export function useOps(mon, itemId, { sim }, { move, stat } = {}) {
  const id = toID(itemId), kind = itemKind(id, sim), ref = mon ? refOf(mon) : null;
  const ops = [];
  const outside = OUTSIDE_ITEMS[id];
  if (kind === 'medicine') {
    const item = medicineOf(id);
    if (item.all) ops.push({ op: 'heal', ref: 'all', revive: true });
    else if (item.revive) ops.push({ op: 'heal', ref, revive: true, ...(item.revive === 'half' ? { hpPercent: 50 } : {}) });
    else if (item.pp) ops.push({ op: 'pp', ref, amount: item.pp, ...(item.oneMove ? { move } : {}) });
    else {
      if (item.heal) ops.push(item.heal === 'full' ? { op: 'heal', ref, hpPercent: 100 } : { op: 'heal', ref, hpAdd: item.heal });
      if (item.cure) ops.push({ op: 'heal', ref, statusOnly: true });
    }
  } else if (kind === 'candy') ops.push({ op: 'level', ref, delta: 1, candy: true });
  else if (kind === 'train' && outside.vitamin) ops.push({ op: 'evs', ref, stat: outside.vitamin, amount: VITAMIN_EVS });
  else if (kind === 'train' && outside.exp) ops.push({ op: 'exp', ref, amount: outside.exp });
  else if (kind === 'train' && outside.ability) ops.push({ op: 'ability', ref, ability: abilityChange(sim, mon, id) });
  else if (kind === 'train' && outside.mint) ops.push({ op: 'nature', ref, nature: outside.mint });
  else if (kind === 'train' && outside.hyper) ops.push({ op: 'hypertrain', ref, stats: outside.hyper === 'all' ? 'all' : [stat] });
  else if (kind === 'train' && outside.ppUp) ops.push({ op: 'ppup', ref, move, amount: outside.ppUp });
  else throw new Error('지금은 쓸 수 없습니다.', { cause: `${itemName(id)}: 배틀 밖에서 바로 쓰는 도구가 아닙니다` });
  ops.push({ op: 'item', item: id, delta: -1, fromBag: true });
  return ops;
}

export function holdableItems(state, sim) {
  return Object.entries(state.bag ?? {}).filter(([id, n]) => n > 0 && !NOT_HOLDABLE.has(itemKind(id, sim))).map(([id]) => id);
}

export const actions = {
  order: (a, b) => ({ type: 'order', ops: [{ op: 'swap', a: refOf(a), b: refOf(b) }] }),
  deposit: mon => ({ type: 'box', ops: [{ op: 'deposit', ref: refOf(mon) }] }),
  withdraw: mon => ({ type: 'box', ops: [{ op: 'withdraw', ref: refOf(mon) }] }),

  swapIn: (boxMon, partyMon) => ({ type: 'box', ops: [{ op: 'swap', a: refOf(boxMon), b: refOf(partyMon) }] }),
  release: mon => ({ type: 'release', ops: [{ op: 'release', ref: refOf(mon) }] }),
  nickname: (mon, name) => ({ type: 'nickname', ops: [{ op: 'nickname', ref: refOf(mon), name: String(name ?? '').trim() }] }),
  give: (mon, item) => ({ type: 'hold', ops: [{ op: 'hold', ref: refOf(mon), item: toID(item), fromBag: true }] }),
  take: mon => ({ type: 'hold', ops: [{ op: 'hold', ref: refOf(mon), item: '', fromBag: true }] }),
  boxName: (box, name) => ({ type: 'boxname', ops: [{ op: 'boxname', box, name: String(name ?? '').trim() }] }),
  use: (mon, item, ctx, options) => ({ type: 'use', item: toID(item), ops: useOps(mon, item, ctx, options) }),
};

const learnOp = (mon, move, result) => (result?.learned
  ? { op: 'learn', ref: refOf(mon), move, ...(result.forgot ? { forget: result.forgot } : {}) }
  : { op: 'learn', ref: refOf(mon), move, skip: true });

export const pendingCount = mon => (mon?.pending?.moves?.length ?? 0) + (mon?.pending?.evolve ? 1 : 0);

export const levelBadge = mon => (pendingCount(mon) ? Math.max(1, mon.pending.levels || pendingCount(mon)) : 0);

// Order of finishing a level-up: moves to learn -> evolution
export function levelUpPlan(mon) {
  return { moves: [...(mon?.pending?.moves ?? [])], evolve: mon?.pending?.evolve ?? null };
}

export function evolutionMoves(ctx, mon, into) {
  const probe = { ...emptyState(), party: [{ ...clone(mon), pending: { levels: 0, moves: [], evolve: null } }] };
  const { state, errors } = applyOps(probe, [{ op: 'evolve', ref: refOf(mon), species: into }], ctx, 'panel:evolve', null);
  return errors.length ? [] : state.party[0].pending.moves;
}

export function levelUpAction(mon, { moves = [], evolution = null } = {}) {
  const ops = moves.map(({ move, result }) => learnOp(mon, move, result));
  if (evolution) {
    if (evolution.evolved) {
      ops.push({ op: 'evolve', ref: refOf(mon), species: evolution.into });
      for (const learned of evolution.learned ?? []) ops.push(learnOp(mon, learned.move, learned));
    } else ops.push({ op: 'noevolve', ref: refOf(mon) });
  }
  return ops.length ? { type: evolution?.evolved ? 'evolve' : 'learn', ops } : null;
}

export function stoneAction(mon, item, { into, evolved, learned = [] }, { consumeHeld = false } = {}) {
  if (!evolved) return null;
  const ops = [{ op: 'evolve', ref: refOf(mon), species: into }, ...(consumeHeld ? [{ op: 'hold', ref: refOf(mon), item: '' }] : []),
    ...learned.map(l => learnOp(mon, l.move, l)), { op: 'item', item: toID(item), delta: -1, fromBag: true }];
  return { type: 'use', item: toID(item), ops };
}

export function teachAction(mon, item, move, result) {
  if (!result?.learned) return null;
  return { type: 'use', item: toID(item), ops: [learnOp(mon, move, result), { op: 'item', item: toID(item), delta: -1, fromBag: true }] };
}

const opt = (id, label, disabled = false, extra = {}) => ({ id, label, disabled: !!disabled, ...extra });

export function partyMenu(mon, { state, locked = false, sim }) {
  const list = [opt('summary', '능력치 보기')];
  if (pendingCount(mon)) list.push(opt('levelup', `레벨업 마무리 ▲${levelBadge(mon)}`, locked));
  list.push(opt('order', '순서 바꾸기', locked || state.party.length < 2));
  list.push(opt('give', '도구 주기', locked || !holdableItems(state, sim).length));
  if (mon.set.item) list.push(opt('take', '도구 빼기', locked));

  list.push(opt('deposit', '박스로 보내기', locked || state.party.length <= 1));
  list.push(opt('cancel', '그만두기'));
  return list;
}

export function boxMenu(mon, { locked = false }) {
  return [opt('withdraw', '파티로', locked), opt('summary', '능력치 보기'), opt('release', '놓아주기', locked), opt('cancel', '그만두기')];
}

export function bagMenu(id, { locked = false, sim, state }) {
  const kind = itemKind(id, sim);
  if (DESCRIBED_ONLY.has(kind)) return null;
  const list = [];
  if (USABLE.has(kind)) list.push(opt('use', '쓰기', locked || !state.party.length));
  if (!NOT_HOLDABLE.has(kind)) list.push(opt('give', '지니게 하기', locked || !state.party.length));
  list.push(opt('cancel', '그만두기'));
  return list;
}

export const boxCount = state => Math.max(BOX_COUNT, Math.ceil((state.box?.length ?? 0) / BOX_SIZE));
export const boxName = (state, index) => state.boxNames?.[index] || `박스 ${index + 1}`;

function expRatio(ctx, mon) {
  const { sim, exp } = ctx;
  const growth = growthOf(exp, sim.Dex.species.get(mon.set.species));
  if (!growth) return null;
  const level = mon.set.level;
  if (level >= MAX_LEVEL) return 1;
  const low = expForLevel(growth, level), high = expForLevel(growth, level + 1);
  return Math.max(0, Math.min(1, ((mon.exp ?? low) - low) / (high - low)));
}

// One party/box slot (drawn by story/panel-html.mjs)
export function slotView(mon, ctx) {
  const { sim } = ctx;
  const species = sim.Dex.species.get(mon.set.species);
  const max = maxHp(sim, mon.set);
  const hp = mon.hp === null || mon.hp === undefined ? max : Math.max(0, mon.hp);
  const ratio = max ? hp / max : 0;
  return {
    uid: mon.uid, name: monName(mon, sim), speciesId: species.id, spriteId: species.spriteid || species.id, shiny: !!mon.set.shiny,
    gender: mon.set.gender || '', level: mon.set.level, hp, maxhp: max, hpClass: ratio > 0.5 ? 'high' : ratio > 0.2 ? 'mid' : 'low',
    status: hp === 0 ? '' : mon.status && mon.status !== 'fnt' ? mon.status : '', fainted: hp === 0,
    exp: expRatio(ctx, mon), item: mon.set.item || '', badge: levelBadge(mon),
  };
}

const BAG_FRAMES = new Map(bagIcons.items.textures[0].frames.map(f => [f.filename, f]));
export function itemIcon(id, sim) {
  const key = toID(id);
  const move = tmMove(key);
  const frame = BAG_FRAMES.get(move ? `tm_${toID(sim.Dex.moves.get(move).type)}` : key);
  if (frame) return { sheet: 'pokerogue', x: frame.frame.x, y: frame.frame.y, w: frame.frame.w, h: frame.frame.h, ox: frame.spriteSourceSize.x, oy: frame.spriteSourceSize.y };
  const item = sim.Dex.items.get(key);
  return item?.exists && Number.isInteger(item.spritenum) ? { sheet: 'showdown', num: item.spritenum } : null;
}

const GROUPS = [['medicine', '회복'], ['ball', '볼'], ['battle', '배틀 도구'], ['train', '기르기'], ['tm', '기술머신'], ['evolve', '진화 도구'],
  ['other', '지니는 도구·그 밖'], ['treasure', '보물'], ['field', '들판 도구'], ['key', '중요한 도구']];
const GROUP_OF = { candy: 'train', stone: 'evolve', held: 'other' };
const ORDER = [...Object.keys(BAG_ITEMS), ...Object.keys(BALLS), 'rarecandy', ...Object.keys(OUTSIDE_ITEMS)];
export function bagView(state, sim) {
  const rank = id => (ORDER.includes(id) ? ORDER.indexOf(id) : ORDER.length);
  const rows = Object.entries(state.bag ?? {}).filter(([, n]) => n > 0).map(([id, count]) => {
    const kind = itemKind(id, sim);
    return { id, count, name: bagItemName(id), kind, icon: itemIcon(id, sim), group: GROUP_OF[kind] ?? kind };
  }).sort((a, b) => rank(a.id) - rank(b.id) || (a.kind === 'tm' && b.kind === 'tm' ? a.id.localeCompare(b.id) : a.name.localeCompare(b.name, 'ko')));
  return GROUPS.map(([group, label]) => ({ group, label, items: rows.filter(r => r.group === group) })).filter(g => g.items.length);
}

export function panelModel({ state, ctx, locked = false, resume = false, ui }) {
  const { sim } = ctx;
  const party = Array.from({ length: PARTY_MAX }, (_, i) => (state.party[i] ? slotView(state.party[i], ctx) : null));
  const count = boxCount(state);
  const index = Math.max(0, Math.min(count - 1, ui.box ?? 0));
  const cells = Array.from({ length: BOX_SIZE }, (_, i) => {
    const mon = state.box[index * BOX_SIZE + i];
    return mon ? slotView(mon, ctx) : null;
  });
  return {
    open: !!ui.open, tab: TABS.includes(ui.tab) ? ui.tab : 'party', locked, resume: !!resume,
    alerts: { party: state.party.some(m => pendingCount(m) > 0), box: false, bag: false },
    party, box: { index, count, name: boxName(state, index), cells },
    bag: { money: state.money === null ? null : state.money ?? 0, groups: bagView(state, sim) },
    picked: ui.ask?.uid ?? ui.menu?.uid ?? ui.select?.uid ?? ui.menu?.item ?? ui.select?.item ?? null,
    window: windowOf(ui),
  };
}

function windowOf(ui) {
  if (ui.ask) return { text: ui.ask.text, options: [{ hit: { t: 'yes' }, label: '예' }, { hit: { t: 'no' }, label: '아니오' }] };
  if (ui.moves) {

    return { text: ui.moves.prompt ?? SELECT_MOVE, options: [...ui.moves.list.map(m => ({ hit: { t: 'move', move: m.id }, label: `${names.moves(m.id)} ${m.pp}/${m.maxpp}`, disabled: !!m.disabled })),
      { hit: { t: 'opt', id: 'cancel' }, label: '그만두기' }] };
  }
  if (ui.stats) {

    // Silver Bottle Cap: stat to train (greyed out when the IV is already 31)
    return { text: '어느 능력을 단련할까요?', options: [...ui.stats.list.map(s => ({ hit: { t: 'stat', stat: s.id }, label: `${STAT_NAME[s.id]} ${s.iv}`, disabled: s.iv >= MAX_IV })),
      { hit: { t: 'opt', id: 'cancel' }, label: '그만두기' }] };
  }
  if (ui.menu) return { text: ui.menu.text, options: ui.menu.options.map(o => ({ hit: { t: 'opt', id: o.id, ...(o.item ? { item: o.item } : {}) }, label: o.label, disabled: o.disabled })) };
  if (ui.message) return { text: ui.message.text, error: !!ui.message.error, options: [{ hit: { t: 'msg' }, label: '확인' }] };
  if (ui.select) return { text: ui.select.text, options: [{ hit: { t: 'opt', id: 'cancel' }, label: '그만두기' }] };
  return null;
}

export const initialUi = () => ({ open: false, tab: 'party', box: 0, menu: null, select: null, ask: null, moves: null, stats: null, message: null });
const calm = ui => ({ ...ui, menu: null, select: null, ask: null, moves: null, stats: null, message: null });
const findIn = (list, uid) => list.find(m => m.uid === uid) ?? null;

export function reduce(ui, hit, { state, ctx, locked = false }) {
  const out = reduceRaw(ui, hit, { state, ctx, locked });

  if (locked && out.effect && !['summary', 'renameBox', 'resume'].includes(out.effect.kind)) return { ui: out.ui, effect: null };
  return out;
}

function reduceRaw(ui, hit, { state, ctx, locked }) {
  const { sim } = ctx;
  const same = { ui, effect: null };
  const party = state.party, box = state.box;
  switch (hit?.t) {
    case 'tab':
      if (ui.open && ui.tab === hit.tab) return { ui: { ...calm(ui), open: false }, effect: null };
      return { ui: { ...calm(ui), open: true, tab: hit.tab }, effect: null };
    case 'fold': return { ui: { ...calm(ui), open: false }, effect: null };
    case 'resume': return { ui: { ...calm(ui), open: false }, effect: { kind: 'resume' } };
    case 'msg': return { ui: { ...ui, message: null }, effect: null };
    case 'no': return { ui: { ...ui, ask: null }, effect: null };
    case 'boxnav': {
      const count = boxCount(state);
      return { ui: { ...calm(ui), box: ((ui.box ?? 0) + hit.d + count) % count }, effect: null };
    }
    case 'boxname':
      return { ui: calm(ui), effect: { kind: 'renameBox', box: Math.max(0, Math.min(boxCount(state) - 1, ui.box ?? 0)) } };
    case 'badge': {
      const mon = findIn(party, hit.uid);
      if (locked || !mon || !pendingCount(mon)) return same;
      return { ui: calm(ui), effect: { kind: 'levelup', uid: mon.uid } };
    }
    case 'yes': {
      const ask = ui.ask;
      if (!ask) return same;
      const mon = findIn(box, ask.uid) ?? findIn(party, ask.uid);
      if (!mon) return { ui: { ...ui, ask: null }, effect: null };

      // Ability Capsule / Patch: "change it?" -> yes
      if (ask.kind === 'use') return { ui: calm(ui), effect: useEffect(mon, ask.item, ctx) };
      if (ask.kind !== 'release') return { ui: { ...ui, ask: null }, effect: null };
      return { ui: { ...ui, ask: null }, effect: { kind: 'queue', action: actions.release(mon), after: `잘 가, ${monName(mon, sim)}!` } };
    }
    case 'stat': {
      const pick = ui.stats;
      const mon = pick && findIn(party, pick.uid);
      if (!mon) return { ui: { ...ui, stats: null }, effect: null };
      const stat = pick.list.find(s => s.id === hit.stat);
      if (!stat || stat.iv >= MAX_IV) return same;
      return { ui: calm(ui), effect: useEffect(mon, pick.item, ctx, { stat: stat.id }) };
    }
    case 'move': {
      const pick = ui.moves;
      const mon = pick && findIn(party, pick.uid);
      if (!mon) return { ui: { ...ui, moves: null }, effect: null };
      const move = pick.list.find(m => m.id === hit.move);
      if (!move || move.disabled) return same;
      return { ui: calm(ui), effect: useEffect(mon, pick.item, ctx, { move: move.id }) };
    }
    case 'item': {
      const menu = bagMenu(hit.item, { locked, sim, state });
      const text = `${bagItemName(hit.item)}\n${itemDescription(hit.item, sim)}`;
      if (!menu) return { ui: { ...calm(ui), message: { text } }, effect: null };
      return { ui: { ...calm(ui), menu: { where: 'bag', item: hit.item, text, options: menu } }, effect: null };
    }
    case 'slot': return slotPress(ui, hit, { state, ctx, locked });
    case 'opt': return optionPress(ui, hit, { state, ctx, locked });
    default: return same;
  }
}

function useEffect(mon, item, ctx, options = {}) {
  const id = toID(item), outside = OUTSIDE_ITEMS[id] ?? {};

  const levels = itemKind(id, ctx.sim) === 'candy' || !!outside.exp;
  return { kind: 'queue', action: actions.use(mon, id, ctx, options), after: useAfter(mon, id, ctx, options), followLevelUp: levels ? mon.uid : undefined };
}

function useAfter(mon, id, { sim }, { stat, move } = {}) {
  const outside = OUTSIDE_ITEMS[id] ?? {}, who = mon ? monName(mon, sim) : '';
  if (outside.all) return '기절한 포켓몬이 모두 기운을 되찾았다!';
  if (outside.vitamin) return `${who}의 ${STAT_NAME[outside.vitamin]} 기초포인트가 올랐다!`;
  if (outside.exp) return `${josa(who, '은/는')} 경험치를 ${outside.exp.toLocaleString('ko-KR')} 얻었다!`;
  if (outside.ability) return `${who}의 특성이 ${josa(names.abilities(abilityChange(sim, mon, id)), '으로/로')} 바뀌었다!`;
  if (outside.mint) return `${who}의 능력이 ${natureName(outside.mint)} 성격처럼 자라게 되었다!`;
  if (outside.hyper) return `${josa(who, '은/는')} 대단한 특훈으로 ${outside.hyper === 'all' ? '모든 능력' : STAT_NAME[stat]}의 개체값이 최고가 되었다!`;

  if (outside.ppUp) return `${names.moves(move)}의 PP가 올라갔다!`;
  return `${who}에게 ${josa(itemName(id), '을/를')} 썼다.`;
}

function slotPress(ui, hit, { state, ctx, locked }) {
  const { sim } = ctx;
  if (hit.where === 'box') {
    const mon = findIn(state.box, hit.uid);
    if (!mon) return { ui, effect: null };
    return { ui: { ...calm(ui), menu: { where: 'box', uid: mon.uid, text: `${josa(monName(mon, sim), '을/를')} 어떻게 하겠습니까?`, options: boxMenu(mon, { locked }) } }, effect: null };
  }
  const mon = findIn(state.party, hit.uid);
  if (!mon) return { ui, effect: null };
  const select = ui.select;
  if (select) {
    if (locked) return { ui: calm(ui), effect: null };
    switch (select.mode) {
      case 'order': {
        const from = findIn(state.party, select.uid);
        if (!from || from.uid === mon.uid) return { ui: calm(ui), effect: null };
        return { ui: calm(ui), effect: { kind: 'queue', action: actions.order(from, mon) } };
      }
      case 'swapin': {
        const incoming = findIn(state.box, select.uid);
        if (!incoming) return { ui: calm(ui), effect: null };
        return { ui: { ...calm(ui), tab: 'box' }, effect: { kind: 'queue', action: actions.swapIn(incoming, mon) } };
      }
      case 'give': {
        if (!(state.bag?.[select.item] > 0)) return { ui: calm(ui), effect: null };
        return { ui: calm(ui), effect: { kind: 'queue', action: actions.give(mon, select.item), after: `${monName(mon, sim)}에게 ${josa(itemName(select.item), '을/를')} 지니게 했다.` } };
      }
      case 'use': {
        if (!(state.bag?.[select.item] > 0)) return { ui: calm(ui), effect: null };
        const check = useCheck(mon, select.item, ctx);

        if (!check.ok) return { ui: { ...ui, message: { text: check.reason } }, effect: null };
        if (check.evolve) {
          return { ui: calm(ui), effect: { kind: 'evolveItem', uid: mon.uid, item: select.item, into: check.evolve, ...(check.consumeHeld ? { consumeHeld: true } : {}) } };
        }
        if (check.teach) return { ui: calm(ui), effect: { kind: 'teachTm', uid: mon.uid, item: select.item, move: check.teach } };
        if (check.moves) return { ui: { ...calm(ui), moves: { uid: mon.uid, item: select.item, list: check.moves, prompt: check.prompt } }, effect: null };
        if (check.stats) return { ui: { ...calm(ui), stats: { uid: mon.uid, item: select.item, list: check.stats } }, effect: null };
        if (check.confirm) return { ui: { ...calm(ui), ask: { kind: 'use', uid: mon.uid, item: select.item, text: check.confirm } }, effect: null };
        return { ui: calm(ui), effect: useEffect(mon, select.item, ctx) };
      }
      default: return { ui: calm(ui), effect: null };
    }
  }
  return { ui: { ...calm(ui), menu: { where: 'party', uid: mon.uid, text: '포켓몬을 어떻게 하겠습니까?', options: partyMenu(mon, { state, locked, sim }) } }, effect: null };
}

function optionPress(ui, hit, { state, ctx, locked }) {
  const { sim } = ctx;
  if (hit.id === 'cancel') {

    return { ui: { ...calm(ui), tab: ui.select?.mode === 'swapin' ? 'box' : ui.tab }, effect: null };
  }
  const menu = ui.menu;
  if (!menu) return { ui, effect: null };
  const chosen = menu.options.find(o => o.id === hit.id && (o.item ?? null) === (hit.item ?? null));
  if (!chosen || chosen.disabled) return { ui, effect: null };
  if (menu.where === 'party') {
    const mon = findIn(state.party, menu.uid);
    if (!mon) return { ui: calm(ui), effect: null };
    switch (hit.id) {
      case 'summary': return { ui: calm(ui), effect: { kind: 'summary', uid: mon.uid } };
      case 'levelup': return { ui: calm(ui), effect: { kind: 'levelup', uid: mon.uid } };
      case 'order': return { ui: { ...calm(ui), select: { mode: 'order', uid: mon.uid, text: '어디로 옮길까요?' } }, effect: null };
      case 'give': {
        const options = [...holdableItems(state, sim).map(id => opt('pick', `${itemName(id)} ×${state.bag[id]}`, false, { item: id })), opt('cancel', '그만두기')];
        return { ui: { ...calm(ui), menu: { where: 'give', uid: mon.uid, text: `${monName(mon, sim)}에게 무엇을 지니게 할까요?`, options } }, effect: null };
      }
      case 'take': return { ui: calm(ui), effect: { kind: 'queue', action: actions.take(mon), after: `${monName(mon, sim)}의 ${josa(itemName(mon.set.item), '을/를')} 가방에 넣었다.` } };
      case 'deposit': return { ui: calm(ui), effect: { kind: 'queue', action: actions.deposit(mon), after: `${josa(monName(mon, sim), '을/를')} 박스로 보냈다.` } };
      default: return { ui: calm(ui), effect: null };
    }
  }
  if (menu.where === 'give') {
    const mon = findIn(state.party, menu.uid);
    if (!mon || hit.id !== 'pick') return { ui: calm(ui), effect: null };
    return { ui: calm(ui), effect: { kind: 'queue', action: actions.give(mon, hit.item), after: `${monName(mon, sim)}에게 ${josa(itemName(hit.item), '을/를')} 지니게 했다.` } };
  }
  if (menu.where === 'box') {
    const mon = findIn(state.box, menu.uid);
    if (!mon) return { ui: calm(ui), effect: null };
    switch (hit.id) {
      case 'summary': return { ui: calm(ui), effect: { kind: 'summary', uid: mon.uid } };
      case 'withdraw':
        if (state.party.length < PARTY_MAX) return { ui: calm(ui), effect: { kind: 'queue', action: actions.withdraw(mon), after: `${josa(monName(mon, sim), '을/를')} 파티로 데려왔다.` } };

        return { ui: { ...calm(ui), tab: 'party', select: { mode: 'swapin', uid: mon.uid, text: `${josa(monName(mon, sim), '과/와')} 바꿀 포켓몬을 골라 주십시오.` } }, effect: null };
      case 'release': return { ui: { ...calm(ui), ask: { kind: 'release', uid: mon.uid, text: `${josa(monName(mon, sim), '을/를')} 정말로 놓아줄까요?` } }, effect: null };
      default: return { ui: calm(ui), effect: null };
    }
  }
  if (menu.where === 'bag') {
    const item = menu.item;
    if (hit.id === 'use' && partyWide(item)) {

      if (!state.party.some(m => m.hp === 0)) return { ui: { ...calm(ui), message: { text: NO_EFFECT } }, effect: null };
      return { ui: calm(ui), effect: { kind: 'queue', action: { type: 'use', item: toID(item), ops: useOps(null, item, ctx) }, after: useAfter(null, toID(item), ctx) } };
    }
    if (hit.id === 'use') return { ui: { ...calm(ui), tab: 'party', select: { mode: 'use', item, text: `${josa(itemName(item), '을/를')} 누구에게 쓸까요?` } }, effect: null };
    if (hit.id === 'give') return { ui: { ...calm(ui), tab: 'party', select: { mode: 'give', item, text: `${josa(itemName(item), '을/를')} 누구에게 지니게 할까요?` } }, effect: null };
  }
  return { ui: calm(ui), effect: null };
}
