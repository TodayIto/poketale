import { MAX_LEVEL, STATUS_IDS } from './mon.mjs';
import { isCustomItem, customText } from '../story/custom-items.mjs';

export function engineMember(mon, customItems = null) {
	const known = values => Object.fromEntries(Object.entries(values ?? {}).filter(([id]) => mon.set.moves.includes(id)));
	const member = { uid: mon.uid, set: structuredClone(mon.set), status: mon.status === 'fnt' ? '' : mon.status || '', pp: known(mon.pp), exp: mon.exp };
	if (isCustomItem(member.set.item)) {
		const label = customText({ customItems }, member.set.item);
		if (label) member.heldCustom = label;
		member.set.item = '';
	}
	const ppUps = known(mon.ppUps);
	if (Object.keys(ppUps).length) member.ppUps = ppUps;
	if (mon.hp !== null && mon.hp !== undefined) member.hp = mon.hp;
	if (mon.ball) member.set.pokeball = mon.ball;
	if (mon.natureOrig) member.natureOrig = mon.natureOrig;
	if (mon.ot) member.ot = mon.ot;
	return member;
}

const isCount = value => Number.isFinite(value) && value >= 0;

export function checkSpec(dex, spec) {
	for (const key of ['p1', 'p2']) {
		const team = spec?.[key]?.team;
		if (!Array.isArray(team) || !team.length) throw new Error(`${key}: 팀이 비었습니다`);
		const uids = new Set();
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
			if (!STATUS_IDS.has(member.status || '')) fail('status', member.status, `${[...STATUS_IDS].filter(Boolean).join('·')} 중 하나`);
			if (member.sleepTurns !== undefined && !(Number.isInteger(member.sleepTurns) && member.sleepTurns >= 1)) fail('sleepTurns', member.sleepTurns, '1 이상 정수');
		});
	}
}
