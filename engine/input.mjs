import { MAX_LEVEL, STATUS_IDS, DYNAMAX_LEVEL_MAX } from './mon.mjs';
import { isCustomItem, customText } from '../story/custom-items.mjs';
import { friendshipLocked } from './friendship.mjs';
import { ERA_GIMMICK_MODES } from './era-gimmicks.mjs';
import { GEN_GIMMICKS, formatGenOf, isChampions } from './generation.mjs';
import { isStatExpTable, STAT_EXP_MAX } from './stat-exp.mjs';

export function engineMember(mon, customItems = null) {
	const known = values => Object.fromEntries(Object.entries(values ?? {}).filter(([id]) => mon.set.moves.includes(id)));
	const member = { uid: mon.uid, set: structuredClone(mon.set), status: mon.status === 'fnt' ? '' : mon.status || '', pp: known(mon.pp), exp: mon.exp };
	if (isCustomItem(member.set.item)) {
		const label = customText({ customItems }, member.set.item);
		if (label) member.heldCustom = label;
		member.set.item = '';
	}
	const ppUps = known(mon.ppUps);
	if (Object.keys(ppUps).length) member.ppUps = ppUps; // PP Up count -> max PP of the engine move slot (engine/pp.mjs)
	if (mon.hp !== null && mon.hp !== undefined) member.hp = mon.hp;
	if (mon.ball) member.set.pokeball = mon.ball;
	if (mon.natureOrig) member.natureOrig = mon.natureOrig;
	if (mon.ot) member.ot = mon.ot;
	if (mon.friendship !== undefined) member.friendship = mon.friendship; // engine/friendship.mjs - missing = the species' base
	if (mon.friendshipCarry) member.friendshipCarry = mon.friendshipCarry;
	if (friendshipLocked(mon)) member.friendshipLocked = true;
	if (mon.evolveLocked === true) member.evolveLocked = true;
	if (mon.counts) member.counts = { ...mon.counts };

	if (mon.statExp) member.statExp = { ...mon.statExp };
	return member;
}

export function withLocksOf(state, spec) {
	if (!Array.isArray(spec?.p1?.team)) return spec;
	const mons = new Map([...state.party, ...state.box].map(mon => [mon.uid, mon]));
	let changed = false;
	const team = spec.p1.team.map(member => {
		const mon = mons.get(member?.uid);
		if (!mon || (mon.evolveLocked === true) === (member.evolveLocked === true)) return member;
		changed = true;
		const { evolveLocked: _, ...rest } = member;
		return mon.evolveLocked === true ? { ...rest, evolveLocked: true } : rest;
	});
	return changed ? { ...spec, p1: { ...spec.p1, team } } : spec;
}

const isCount = value => Number.isFinite(value) && value >= 0;

export function checkSpec(dex, spec) {

	const uidsOf = { p1: new Set(), p2: new Set() };
	for (const [key, half] of [['p1', 'p1'], ['p2', 'p2'], ['partner', 'p1'], ['foePartner', 'p2']]) {
		if (key.length > 2 && spec?.[key] === undefined) continue;
		const team = spec?.[key]?.team;
		if (!Array.isArray(team) || !team.length) throw new Error(`${key}: 팀이 비었습니다`);
		const uids = uidsOf[half];
		team.forEach((member, i) => {
			const where = `${key} ${i + 1}번째`;
			const { uid, set } = member ?? {};
			if (typeof uid !== 'string' || !uid) throw new Error(`${where}: uid 가 없습니다`);
			if (uids.has(uid)) throw new Error(`${where} (${uid}): uid 가 겹칩니다`);
			uids.add(uid);
			const fail = (field, value, rule) => { throw new Error(`${where} (${uid}) ${field}: ${rule}여야 합니다 (${JSON.stringify(value)})`); };
			if (!dex.species.get(set?.species ?? '').exists) throw new Error(`${where} (${uid}): 모르는 포켓몬 "${set?.species}"`);
			if (!Number.isInteger(set.level) || set.level < 1 || set.level > MAX_LEVEL) fail('level', set.level, `1~${MAX_LEVEL} 정수`);
			for (const field of ['hp', 'hpPercent', 'exp']) if (member[field] !== undefined && !isCount(member[field])) fail(field, member[field], '0 이상의 수');
			for (const [move, pp] of Object.entries(member.pp ?? {})) if (!isCount(pp)) fail(`pp.${move}`, pp, '0 이상의 수');
			for (const [move, n] of Object.entries(member.ppUps ?? {})) if (!Number.isInteger(n) || n < 0) fail(`ppUps.${move}`, n, '0 이상 정수');

			if (set.dynamaxLevel !== undefined && !(Number.isInteger(set.dynamaxLevel) && set.dynamaxLevel >= 0 && set.dynamaxLevel <= DYNAMAX_LEVEL_MAX)) {
				fail('set.dynamaxLevel', set.dynamaxLevel, `0~${DYNAMAX_LEVEL_MAX} 정수`);
			}
			if (set.gigantamax !== undefined && typeof set.gigantamax !== 'boolean') fail('set.gigantamax', set.gigantamax, 'true·false 중 하나');
			if (!STATUS_IDS.has(member.status || '')) fail('status', member.status, `${[...STATUS_IDS].filter(Boolean).join('·')} 중 하나`);

			if (member.statExp !== undefined && !isStatExpTable(member.statExp)) fail('statExp', member.statExp, `6 능력치 0~${STAT_EXP_MAX} 정수`);
			if (member.sleepTurns !== undefined && !(Number.isInteger(member.sleepTurns) && member.sleepTurns >= 1)) fail('sleepTurns', member.sleepTurns, '1 이상 정수');
		});
	}

	if (spec?.formGen != null) {
		const formatGen = formatGenOf(spec.formatid);
		if (!Number.isInteger(spec.formGen) || !Object.hasOwn(GEN_GIMMICKS, spec.formGen)) throw new Error(`formGen: 1~9 정수여야 합니다 (${JSON.stringify(spec.formGen)})`);
		if (isChampions(spec.formatid)) throw new Error(`formGen: 챔피언스 규칙에는 세대가 없습니다 (${spec.formGen})`);
		if (formatGen < 9 && spec.formGen !== formatGen) throw new Error(`formGen: ${formatGen}세대 형식에는 ${formatGen} 이어야 합니다 (${spec.formGen})`);
	}

	if (spec?.genEvolve != null && spec.genEvolve !== true) throw new Error(`genEvolve: true 이거나 없어야 합니다 (${JSON.stringify(spec.genEvolve)})`);
	if (spec?.expShareOwned != null && spec.expShareOwned !== true) throw new Error(`expShareOwned: true 이거나 없어야 합니다 (${JSON.stringify(spec.expShareOwned)})`);

	if (spec?.eraGimmicks != null && !ERA_GIMMICK_MODES.includes(spec.eraGimmicks)) {
		throw new Error(`eraGimmicks: ${ERA_GIMMICK_MODES.join('·')} 중 하나여야 합니다 (${JSON.stringify(spec.eraGimmicks)})`);
	}
}
