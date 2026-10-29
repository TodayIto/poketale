export const MAX_A = 1044480;
const UB_MOD = 410;

export const BALLS = {
	pokeball: { name: 'Poke Ball', mod: 4096 },
	greatball: { name: 'Great Ball', mod: 6144 },
	ultraball: { name: 'Ultra Ball', mod: 8192 },
	masterball: { name: 'Master Ball', master: true },
	premierball: { name: 'Premier Ball', mod: 4096 },
	luxuryball: { name: 'Luxury Ball', mod: 4096 },
	healball: { name: 'Heal Ball', mod: 4096 },
	friendball: { name: 'Friend Ball', mod: 4096 },
	cherishball: { name: 'Cherish Ball', mod: 4096 },
	sportball: { name: 'Sport Ball', mod: 4096 },
	safariball: { name: 'Safari Ball', mod: 4096 },

	netball: { name: 'Net Ball', fn: ctx => ctx.target.types.some(t => t === 'Water' || t === 'Bug') ? 14336 : 4096 },

	diveball: { name: 'Dive Ball', fn: ctx => ctx.env.water ? 14336 : 4096 },

	lureball: { name: 'Lure Ball', fn: ctx => ctx.env.water ? 16384 : 4096 },

	nestball: { name: 'Nest Ball', fn: ctx => ctx.target.level >= 1 && ctx.target.level <= 29 ? Math.floor((41 - ctx.target.level) * 4096 / 10) : 4096 },

	repeatball: { name: 'Repeat Ball', fn: ctx => ctx.caught ? 14336 : 4096 },

	timerball: { name: 'Timer Ball', fn: ctx => Math.min(4096 + (ctx.turn - 1) * 1229, 16384) },

	quickball: { name: 'Quick Ball', fn: ctx => ctx.turn === 1 ? 20480 : 4096 },

	duskball: { name: 'Dusk Ball', fn: ctx => ctx.env.night || ctx.env.cave ? 12288 : 4096 },

	dreamball: { name: 'Dream Ball', fn: ctx => ctx.target.status === 'slp' ? 16384 : 4096 },

	fastball: { name: 'Fast Ball', fn: ctx => ctx.target.species.baseStats.spe >= 100 ? 16384 : 4096 },

	moonball: { name: 'Moon Ball', fn: ctx => evolvesByMoonStone(ctx) ? 16384 : 4096 },

	levelball: { name: 'Level Ball', fn: ctx => {
		const mine = ctx.user.level, wild = ctx.target.level;
		return mine >= wild * 4 ? 32768 : mine >= wild * 2 ? 16384 : mine > wild ? 8192 : 4096;
	} },

	loveball: { name: 'Love Ball', fn: ctx => ctx.user.species.num === ctx.target.species.num &&
		((ctx.user.gender === 'M' && ctx.target.gender === 'F') || (ctx.user.gender === 'F' && ctx.target.gender === 'M')) ? 32768 : 4096 },

	heavyball: { name: 'Heavy Ball', mod: 4096, rateAdd: ctx => heavyBallRate(ctx.target.species.weighthg) },

	beastball: { name: 'Beast Ball', fn: ctx => isUltraBeast(ctx.target.species) ? 20480 : UB_MOD },
};

function evolvesByMoonStone(ctx) {
	return (ctx.target.species.evos || []).some(name => ctx.dex.species.get(name).evoItem === 'Moon Stone');
}

export function isUltraBeast(species) {
	return (species.tags || []).includes('Ultra Beast');
}

export function heavyBallRate(weighthg) {
	if (weighthg < 1000) return -20;
	if (weighthg < 2000) return 0;
	if (weighthg < 3000) return 20;
	return 30;
}

// Ball modifier. { master } or { mod: multiplier in 1/4096 units, rateAdd }
export function ballModifier(ballId, ctx) {
	const ball = BALLS[ballId];
	if (!ball) throw new Error(`모르는 볼 "${ballId}"`);
	if (ball.master) return { master: true, mod: null, rateAdd: 0 };
	let mod = ball.fn ? ball.fn(ctx) : ball.mod;
	if (ballId !== 'beastball' && isUltraBeast(ctx.target.species)) mod = UB_MOD;
	return { master: false, mod, rateAdd: ball.rateAdd ? ball.rateAdd(ctx) : 0 };
}

// Status modifier (sleep/freeze 2.5, paralysis/poison/toxic/burn 1.5). [numerator, denominator]
export function statusBonus(status) {
	if (status === 'slp' || status === 'frz') return [5, 2];
	if (status === 'par' || status === 'psn' || status === 'tox' || status === 'brn') return [3, 2];
	return [1, 1];
}

export function levelBonus(level) {
	return level < 13 ? [Math.max(36 - 2 * level, 10), 10] : [1, 1];
}

export function captureValues({ maxhp, hp, rate, ballMod, rateAdd = 0, status = '', level, badgePenalty = 1, bonusMisc = 1 }) {
	if (!(maxhp > 0)) throw new Error('최대 HP 가 없습니다');
	const r = Math.max(1, Math.min(255, rate + rateAdd));
	const hp3 = 3 * maxhp;
	const x = Math.floor((hp3 - 2 * hp) * r * ballMod * badgePenalty / hp3);
	const [ln, ld] = levelBonus(level);
	const [sn, sd] = statusBonus(status);
	const a = Math.floor(x * ln * sn * bonusMisc / (ld * sd));
	const guaranteed = a >= MAX_A;
	const b = guaranteed ? 65536 : Math.floor(65536 * Math.pow(a / MAX_A, 0.1875));
	return { rate: r, a, b, guaranteed };
}

export function criticalMultiplier(dexCaught) {
	if (dexCaught > 600) return 2.5;
	if (dexCaught > 450) return 2;
	if (dexCaught > 300) return 1.5;
	if (dexCaught > 150) return 1;
	if (dexCaught > 30) return 0.5;
	return 0;
}

export function rollCapture(v, random, critical = null) {
	let isCritical = false;
	if (critical) {
		const c = Math.floor(v.a * criticalMultiplier(critical.dexCaught) * (critical.catchingCharm ? 2 : 1) / 6);
		isCritical = random(256) < c;
	}
	if (isCritical) {
		const caught = v.guaranteed || random(65536) < v.b;
		return { caught, shakes: 1, critical: true };
	}
	if (v.guaranteed) return { caught: true, shakes: 3, critical: false };
	for (let i = 0; i < 4; i++) {
		if (random(65536) >= v.b) return { caught: false, shakes: i, critical: false };
	}
	return { caught: true, shakes: 3, critical: false };
}
