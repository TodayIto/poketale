import { BALLS, ballModifier, captureValues, rollCapture } from './capture.mjs';
import { awardCaptureExperience } from './exp.mjs';
import { PARTY_MAX, toID } from './mon.mjs';
import { itemId, customText } from '../story/custom-items.mjs';
import { TOOL_TURNS, CHEER_STATS, CHEER_COUNT, ownsPokemon, ownsTrainer, cheerOwns } from '../story/tools.mjs';
import { chooseEventAction, chooseParts, revive, sideLead } from './showdown-compat.mjs';
import { trainerOf } from './seats.mjs';

export const BAG_ITEMS = {

	potion: { name: 'Potion', heal: 20 },
	superpotion: { name: 'Super Potion', heal: 60 },
	hyperpotion: { name: 'Hyper Potion', heal: 120 },
	maxpotion: { name: 'Max Potion', heal: 'full' },

	fullrestore: { name: 'Full Restore', heal: 'full', cure: 'all', confusion: true },

	antidote: { name: 'Antidote', cure: ['psn', 'tox'] },
	burnheal: { name: 'Burn Heal', cure: ['brn'] },
	iceheal: { name: 'Ice Heal', cure: ['frz'] },
	awakening: { name: 'Awakening', cure: ['slp'] },
	paralyzeheal: { name: 'Paralyze Heal', cure: ['par'] },
	fullheal: { name: 'Full Heal', cure: 'all', confusion: true },

	revive: { name: 'Revive', revive: 'half' },
	maxrevive: { name: 'Max Revive', revive: 'full' },
	// PP (Ether: one move 10, Max Ether: one move full, Elixir: all moves 10, Max Elixir: all moves full)
	ether: { name: 'Ether', pp: 10, oneMove: true },
	maxether: { name: 'Max Ether', pp: 'full', oneMove: true },
	elixir: { name: 'Elixir', pp: 10 },
	maxelixir: { name: 'Max Elixir', pp: 'full' },

	xattack: { name: 'X Attack', boost: 'atk' },
	xdefense: { name: 'X Defense', boost: 'def' },
	xspatk: { name: 'X Sp. Atk', boost: 'spa' },
	xspdef: { name: 'X Sp. Def', boost: 'spd' },
	xspeed: { name: 'X Speed', boost: 'spe' },
	xaccuracy: { name: 'X Accuracy', boost: 'accuracy' },

	direhit: { name: 'Dire Hit', crit: true },
	// Mist for the user's side: generations 1-2 put it on the Pokémon out, later ones on the side for five turns
	guardspec: { name: 'Guard Spec.', guard: true },

	// Flutes are played, not used up (Bulbapedia "Flute", "Poké Flute"). The Poké Flute wakes every Pokémon out, foes
	// too, and takes the turn even when nobody sleeps; the others cure one Pokémon
	pokeflute: { name: 'Poké Flute', flute: 'field', keep: true },
	blueflute: { name: 'Blue Flute', cure: ['slp'], flute: 'one', keep: true },
	yellowflute: { name: 'Yellow Flute', confusion: true, flute: 'one', keep: true },
	redflute: { name: 'Red Flute', attract: true, flute: 'one', keep: true },

	freshwater: { name: 'Fresh Water', heal: 30 },
	sodapop: { name: 'Soda Pop', heal: 50 },
	lemonade: { name: 'Lemonade', heal: 70 },
	moomoomilk: { name: 'Moomoo Milk', heal: 100 },
	sweetheart: { name: 'Sweet Heart', heal: 20 },
	energypowder: { name: 'Energy Powder', heal: 60 },
	energyroot: { name: 'Energy Root', heal: 120 },
	healpowder: { name: 'Heal Powder', cure: 'all', confusion: true },
	revivalherb: { name: 'Revival Herb', revive: 'full' },
	lavacookie: { name: 'Lava Cookie', cure: 'all', confusion: true },
	oldgateau: { name: 'Old Gateau', cure: 'all', confusion: true },
	casteliacone: { name: 'Casteliacone', cure: 'all', confusion: true },
	ragecandybar: { name: 'Rage Candy Bar', cure: 'all', confusion: true },
	lumiosegalette: { name: 'Lumiose Galette', cure: 'all', confusion: true },
	shaloursable: { name: 'Shalour Sable', cure: 'all', confusion: true },
	bigmalasada: { name: 'Big Malasada', cure: 'all', confusion: true },
	pewtercrunchies: { name: 'Pewter Crunchies', cure: 'all', confusion: true },
};

export const foodHeal = maxhp => Math.max(1, Math.floor(maxhp / 4));

export function bagItem(battle, id) {
	if (Object.hasOwn(BAG_ITEMS, id)) return BAG_ITEMS[id];
	const { foods, tools } = battle.storyBag ?? {};
	if (foods && Object.hasOwn(foods, id)) return { name: customText({ customItems: foods }, id), heal: 'food' };

	return tools && Object.hasOwn(tools, id) ? { name: customText({ customItems: tools }, id), tool: tools[id].tag } : undefined;
}

export const FIELD_ITEMS = {
	rarecandy: { name: 'Rare Candy' },
	everstone: { name: 'Everstone' },
};
const X_STAGES = 2;

export function isBall(id) {
	return Object.hasOwn(BALLS, id);
}

export function installBag(sim, battle, options = {}) {
	if (battle.storyBag) throw new Error('가방이 이미 설치됐습니다');
	const state = {
		options: { ...options, env: { ...options.env } },
		catchRates: options.catchRates?.byNum ?? options.catchRates ?? null,
		caught: new Set(options.caughtSpecies || []),
		foods: options.foods ?? {},
		tools: options.tools ?? {},
		toolsUsed: new Set(),
		effects: [],
		pending: new Map(),
		itemsUsed: [],
		captured: null,
	};
	battle.storyBag = state;
	battle.onEvent('StoryBag', battle.format, function (user) {
		const choice = state.pending.get(user);
		state.pending.delete(user);
		if (!choice) throw new Error('가방 행동인데 선택이 없습니다');
		if (isBall(choice.item)) throwBall(sim, this, state, choice, user);
		else if (bagItem(this, choice.item).tool) useTool(this, state, choice);
		else useItem(sim, this, state, choice);
	});

	const endTurn = battle.endTurn;
	battle.endTurn = function (...args) {
		endTools(this, state);
		return endTurn.apply(this, args);
	};
	return state;
}

export function bagResult(battle) {
	const state = battle.storyBag;
	if (!state) return {};
	return {
		itemsUsed: state.itemsUsed.map(u => ({ ...u })),
		captured: state.captured ? { ...state.captured } : null,
	};
}

const fail = (reason, detail) => ({ ok: false, reason, ...(detail ? { detail } : {}) });

export function checkBagItem(battle, choice) {
	const state = battle.storyBag;
	if (!state) throw new Error('installBag 을 먼저 부르세요');
	if (battle.ended) return fail('ended');
	const side = battle.sides[0];
	if (side.requestState !== 'move' || side.choice.cantUndo) return fail('notyourturn');

	const user = isBall(toID(choice?.item)) ? sideLead(side) : side.active[choice?.position ?? 0];
	if (!user || user.fainted) return fail('notyourturn');

	if (user.getLockedMove()) return fail('locked');

	const id = itemId(choice?.item);
	if (isBall(id)) return checkBall(battle, state, id);
	const item = bagItem(battle, id);
	if (!item) return fail('unknownitem', choice?.item);
	if (item.tool) return checkTool(battle, state, id, item, choice);

	const target = side.pokemon.find(p => p.m.uid === choice.target);
	if (!target) return fail('notarget', choice.target);
	return targetCheck(battle, target, item, choice.move);
}

// What the item would do to this Pokémon now: checked when it is chosen, and again when it is used, since another
// action of the turn may have done it already (both slots of a double battle on the same Pokémon)
function targetCheck(battle, target, item, move) {
	if (target.isActive && target.volatiles['embargo']) return fail('embargo');
	if (item.revive) return target.fainted ? { ok: true } : fail('notfainted');
	if (item.pp) {

		const slots = ppSlots(target, item, move);
		if (!slots) return fail('nomove', move);
		return slots.some(s => s.pp < s.maxpp) ? { ok: true } : fail('noeffect');
	}
	if (target.fainted) return fail('fainted');
	if (item.flute === 'field') return { ok: true };
	if (item.guard) {
		if (!target.isActive) return fail('notactive');
		return guarded(battle, target) ? fail('noeffect') : { ok: true };
	}
	if (item.boost || item.crit) {
		if (!target.isActive) return fail('notactive');
		if (item.crit) return target.volatiles['focusenergy'] || target.volatiles['dragoncheer'] ? fail('noeffect') : { ok: true };
		const stage = target.boosts[item.boost];
		const capped = target.hasAbility('contrary') ? stage <= -6 : stage >= 6;
		return capped ? fail('noeffect') : { ok: true };
	}
	return itemHasEffect(target, item) ? { ok: true } : fail('noeffect');
}

function itemHasEffect(target, item) {
	if (item.heal && target.hp < target.maxhp) return true;
	if (item.cure && target.status && (item.cure === 'all' || item.cure.includes(target.status))) return true;
	if (item.confusion && target.isActive && target.volatiles['confusion']) return true;
	if (item.attract && target.isActive && target.volatiles['attract']) return true;
	return false;
}

const guarded = (battle, pokemon) => (battle.gen <= 2 ? !!pokemon.volatiles['mist'] : !!pokemon.side.sideConditions['mist']);

// The Poké Flute wakes every sleeping Pokémon out, foes too; Soundproof keeps one asleep from generation 3, when
// abilities came in
function playFlute(battle, user) {
	const woken = battle.getAllActive().filter(p => !p.fainted && p.status === 'slp' && !(battle.gen >= 3 && p.hasAbility('soundproof')));
	for (const pokemon of woken) {
		battle.add('-curestatus', pokemon, 'slp', '[msg]');
		pokemon.clearStatus();
	}
	if (!woken.length) battle.add('-story-flute', user, user.m.uid, '[none]');
}

function ppSlots(target, item, move) {
	if (!item.oneMove) return target.moveSlots;
	const slot = target.moveSlots.find(s => s.id === toID(move));
	return slot ? [slot] : null;
}

const realSpecies = pokemon => pokemon.battle.dex.species.get(pokemon.m.start.species);

const foesOut = battle => battle.sides.filter(side => side.n % 2).flatMap(side => side.active).filter(p => p && !p.fainted);

function checkBall(battle, state, id) {
	const foes = foesOut(battle);
	if (!foes.length) return fail('nofoe');
	if (state.options.wild && foes.length > 1) return fail('twofoes');
	const foe = foes[0];
	if (!state.options.wild) return { ok: true };

	if (foe.isSemiInvulnerable()) return fail('semiinvulnerable');
	if (!BALLS[id].master && !catchRateOf(state, realSpecies(foe))) return fail('norate', realSpecies(foe).name);
	return { ok: true };
}

function catchRateOf(state, species) {
	return state.catchRates?.[species.num] || 0;
}

const trainerName = pokemon => trainerOf(pokemon) ?? pokemon.side.name;
const isFoe = pokemon => pokemon.side.n % 2 === 1;

const cheerStats = pokemon => CHEER_STATS.filter(stat => (pokemon.hasAbility('contrary') ? pokemon.boosts[stat] > -6 : pokemon.boosts[stat] < 6));

const toolOwner = (state, id) => state.tools[id].owner ?? '';

function toolTarget(battle, owner) {
	const foes = foesOut(battle);
	const pokemon = foes.find(foe => ownsPokemon(owner, foe));
	if (pokemon) return { pokemon };
	const trainer = [...new Set(foes.map(trainerName))].find(t => ownsTrainer(owner, t));
	return trainer ? { trainer, pokemon: foes.find(foe => trainerName(foe) === trainer) } : null;
}
const sameTarget = (effect, bound) => (bound.trainer ? effect.trainer === bound.trainer : effect.uid === bound.pokemon.m.uid);

function checkTool(battle, state, id, item, choice) {
	if (state.toolsUsed.has(id)) return fail('toolused');
	if (item.tool === 'cheer') {
		const target = battle.sides[0].pokemon.find(p => p.m.uid === choice.target);
		if (!target) return fail('notarget', choice.target);
		if (!cheerOwns(state.tools[id], target)) return fail('notbound');
		if (target.fainted) return fail('fainted');
		if (!target.isActive) return fail('notactive');
		if (target.volatiles['embargo']) return fail('embargo');
		return cheerStats(target).length ? { ok: true } : fail('noeffect');
	}
	if (state.options.wild) return fail('wild');
	const bound = toolTarget(battle, toolOwner(state, id));
	if (!bound) return fail('notbound');
	return state.effects.some(e => e.tag === item.tool && sameTarget(e, bound) && e.until >= battle.turn) ? fail('noeffect') : { ok: true };
}

function toolEffect(item, id) {
	return { ...itemEffect(item, id), fullname: item.name, effectType: 'Condition', kind: 'Condition' };
}

function useTool(battle, state, choice) {
	const item = bagItem(battle, choice.item), tag = item.tool;
	state.toolsUsed.add(choice.item);
	const line = (pokemon, ...more) => battle.add('-story-tool', pokemon, pokemon.m.uid, choice.item, item.name, tag, ...more);
	if (tag === 'cheer') {
		const target = battle.sides[0].pokemon.find(p => p.m.uid === choice.target);

		if (!target?.isActive || target.fainted) { if (target) line(target, '[fail]'); return; }
		line(target);
		const stats = cheerStats(target), picked = [];
		while (picked.length < CHEER_COUNT && stats.length) picked.push(stats.splice(battle.random(stats.length), 1)[0]);
		battle.boost(Object.fromEntries(CHEER_STATS.filter(stat => picked.includes(stat)).map(stat => [stat, 1])), target, target, toolEffect(item, choice.item));
		return;
	}
	const bound = toolTarget(battle, toolOwner(state, choice.item));

	if (!bound) { const user = battle.sides[0].active.find(p => p && !p.fainted); if (user) line(user, '[fail]'); return; }
	state.effects = state.effects.filter(e => !(e.tag === tag && sameTarget(e, bound)));
	state.effects.push({ tag, item: choice.item, until: battle.turn + TOOL_TURNS, ...(bound.trainer ? { trainer: bound.trainer } : { uid: bound.pokemon.m.uid }) });
	line(bound.pokemon, ...(bound.trainer ? [`[trainer] ${bound.trainer}`] : []));
}

function endTools(battle, state) {
	const over = state.effects.filter(e => e.until <= battle.turn);
	if (!over.length) return;
	state.effects = state.effects.filter(e => e.until > battle.turn);
	for (const e of over) {
		const pokemon = foesOut(battle).find(foe => (e.trainer ? trainerName(foe) === e.trainer : foe.m.uid === e.uid));
		if (pokemon) battle.add('-story-toolend', pokemon, pokemon.m.uid, e.tag, ...(e.trainer ? [`[trainer] ${e.trainer}`] : []));
	}
}

export function toolsOn(battle, pokemon) {
	const state = battle.storyBag;
	if (!state?.effects?.length || !pokemon || !isFoe(pokemon)) return [];
	return [...new Set(state.effects.filter(e => battle.turn <= e.until && (e.trainer ? e.trainer === trainerName(pokemon) : e.uid === pokemon.m.uid))
		.map(e => e.tag))];
}

export function chooseBagItem(battle, choice) {
	const check = checkBagItem(battle, choice);
	if (!check.ok) return check;
	const side = battle.sides[0];
	const position = isBall(toID(choice.item)) ? side.active.indexOf(sideLead(side)) : choice.position ?? 0;
	battle.storyBag.pending.clear();
	battle.storyBag.pending.set(battle.sides[0].active[position], pendingOf(choice));
	chooseEventAction(battle, battle.sides[0], 'StoryBag', position);
	return { ok: true };
}

const pendingOf = choice => ({ item: itemId(choice.item), target: choice.target ?? null, move: choice.move ? toID(choice.move) : null });

export function chooseBagParts(battle, parts) {
	const state = battle.storyBag;
	const tools = new Set();
	for (const [position, part] of parts.entries()) {
		if (typeof part === 'string') continue;
		if (isBall(toID(part?.item))) return { ...fail('ball'), position };
		const check = checkBagItem(battle, { ...part, position });
		if (!check.ok) return { ...check, position };

		const id = itemId(part.item);
		if (bagItem(battle, id).tool) { if (tools.has(id)) return { ...fail('toolused'), position }; tools.add(id); }
	}
	const side = battle.sides[0];
	if (!chooseParts(battle, side, parts.map(part => (typeof part === 'string' ? part : { event: 'StoryBag' })))) return fail('rejected');
	state.pending.clear();
	parts.forEach((part, position) => { if (typeof part !== 'string') state.pending.set(side.active[position], pendingOf(part)); });
	return { ok: true };
}

const isEnemyItem = item => !!item && !item.revive && !item.pp && !item.boost && !item.crit && !item.flute && !!(item.heal || item.cure);

export function checkEnemyItem(battle, choice) {
	if (battle.ended) return fail('ended');
	const side = battle.getSide(choice?.side ?? 'p2');
	if (side.requestState !== 'move' || side.choice.cantUndo) return fail('notyourturn');
	const user = side.active[choice?.position ?? 0];
	if (!user || user.fainted) return fail('notyourturn');
	if (user.getLockedMove()) return fail('locked');
	const item = BAG_ITEMS[toID(choice?.item)];
	if (!isEnemyItem(item)) return fail('unknownitem', choice?.item);
	if (user.volatiles['embargo']) return fail('embargo');
	return itemHasEffect(user, item) ? { ok: true } : fail('noeffect');
}

export const enemyItemOf = part => /^item (\S+)$/.exec(String(part).trim())?.[1];

export const hasEnemyItem = choice => String(choice).split(',').some(part => enemyItemOf(part));

export function chooseEnemyParts(battle, choice, sideId = 'p2') {
	const parts = String(choice).split(',').map(part => part.trim());
	for (const [position, part] of parts.entries()) {
		const item = enemyItemOf(part);
		if (!item) continue;
		const check = checkEnemyItem(battle, { item, position, side: sideId });
		if (!check.ok) return { ...check, position };
	}
	if (!battle.storyEnemyItem) {
		const state = battle.storyEnemyItem = { pending: new Map() };
		battle.onEvent('StoryEnemyItem', battle.format, function (user) {
			const picked = state.pending.get(user);
			state.pending.delete(user);
			if (!picked) throw new Error('상대 도구 행동인데 선택이 없습니다');
			useItem(null, this, null, picked, user.side);
		});
	}

	const side = battle.getSide(sideId), { pending } = battle.storyEnemyItem;
	const drop = () => { for (const user of pending.keys()) if (user.side === side) pending.delete(user); };
	drop();
	parts.forEach((part, position) => {
		const item = enemyItemOf(part);
		if (item) pending.set(side.active[position], { item: toID(item), target: side.active[position].m.uid, move: null });
	});
	if (chooseParts(battle, side, parts.map(part => (enemyItemOf(part) ? { event: 'StoryEnemyItem' } : part)))) return { ok: true };
	drop();
	return fail('rejected');
}

function itemEffect(item, id) {

	return { id, name: item.name, fullname: `item: ${item.name}`, effectType: 'Item', kind: 'Item', exists: true, num: 0, gen: 9, flags: {} };
}

const healOf = (item, target) => (item.heal === 'full' ? target.maxhp : item.heal === 'food' ? foodHeal(target.maxhp) : item.heal);

function useItem(sim, battle, state, choice, side = battle.sides[0]) {
	const item = bagItem(battle, choice.item);
	const target = side.pokemon.find(p => p.m.uid === choice.target);
	if (!target) return;
	const effect = itemEffect(item, choice.item);
	const from = `[from] ${effect.fullname}`;
	const label = Object.hasOwn(BAG_ITEMS, choice.item) ? [] : [item.name];
	// Nothing left for it to do: it has no effect and stays in the bag
	if (!targetCheck(battle, target, item, choice.move).ok) {
		battle.add('-story-item', target, target.m.uid, choice.item, ...label, '[fail]');
		return;
	}

	battle.add('-story-item', target, target.m.uid, choice.item, ...label);

	if (item.revive) {

		revive(battle, target, item.revive === 'full' ? target.maxhp : Math.max(1, Math.floor(target.maxhp / 2)));
		battle.add('-heal', target, target.getHealth, from);
	}
	if (item.heal) {
		if (target.heal(healOf(item, target))) battle.add('-heal', target, target.getHealth, from);
	}
	if (item.cure && target.status && (item.cure === 'all' || item.cure.includes(target.status))) {
		battle.add('-curestatus', target, target.status, from);
		target.clearStatus();
	}
	if (item.confusion && target.isActive && target.volatiles['confusion']) target.removeVolatile('confusion');
	if (item.pp) {
		for (const slot of ppSlots(target, item, choice.move)) {
			if (slot.pp >= slot.maxpp) continue;
			slot.pp = item.pp === 'full' ? slot.maxpp : Math.min(slot.maxpp, slot.pp + item.pp);
			battle.add('-story-pp', target, target.m.uid, battle.dex.moves.get(slot.id).name, slot.pp, slot.maxpp);
		}
	}
	if (item.boost) battle.boost({ [item.boost]: X_STAGES }, target, target, effect);
	if (item.crit) target.addVolatile('focusenergy', target, effect);
	if (item.flute === 'field') playFlute(battle, target);
	if (item.attract && target.isActive && target.volatiles['attract']) {
		target.removeVolatile('attract');
		battle.add('-end', target, 'Attract', from);
	}
	if (item.guard) {
		if (battle.gen <= 2) target.addVolatile('mist', target, effect);
		else target.side.addSideCondition('mist', target, effect);
	}

	// A flute stays in the bag
	if (!item.keep) state?.itemsUsed.push({ turn: battle.turn, item: choice.item, target: choice.target, ...(choice.move && item.oneMove ? { move: choice.move } : {}) });
}

function throwBall(sim, battle, state, choice, user) {
	const foe = foesOut(battle)[0] ?? battle.sides[1].active[0];
	if (!state.options.wild) {
		// Trainer battle: the opponent blocks the ball. The turn is used and the ball is not consumed
		battle.add('-story-ball', foe, foe.m.uid, choice.item, 0, 'blocked');
		return;
	}
	const ctx = ballContext(sim, battle, state, user, foe);
	const mod = ballModifier(choice.item, ctx);
	let roll;
	if (mod.master) {
		roll = { caught: true, shakes: 3, critical: false };
	} else {
		const values = captureValues({
			maxhp: foe.maxhp, hp: foe.hp, rate: catchRateOf(state, realSpecies(foe)), ballMod: mod.mod, rateAdd: mod.rateAdd,
			status: foe.status, level: foe.level, badgePenalty: state.options.badgePenalty ?? 1, bonusMisc: state.options.bonusMisc ?? 1,
		});
		roll = rollCapture(values, n => battle.random(n), state.options.critical || null);
	}

	const toBox = roll.caught && battle.sides[0].pokemon.length >= PARTY_MAX;
	battle.add('-story-ball', foe, foe.m.uid, choice.item, roll.shakes, roll.caught ? 'caught' : 'broke',
		...(roll.critical ? ['[critical]'] : []), ...(toBox ? ['[tobox]'] : []));
	state.itemsUsed.push({ turn: battle.turn, item: choice.item, target: foe.m.uid });
	if (!roll.caught) return;
	state.captured = {
		uid: foe.m.uid, species: realSpecies(foe).name, level: foe.level, ball: choice.item,
		turn: battle.turn, shakes: roll.shakes, critical: roll.critical, toBox,
	};

	awardCaptureExperience(battle, foe);
	battle.win(battle.sides[0]);
}

export function ballContext(sim, battle, state, user, foe) {
	const view = p => ({ species: p.species, level: p.level, gender: p.gender, status: p.status, types: p.getTypes() });
	const caught = state.caught.has(realSpecies(foe).id) || state.caught.has(toID(realSpecies(foe).baseSpecies));
	return { target: view(foe), user: view(user), turn: battle.turn, env: state.options.env, caught, dex: battle.dex };
}
