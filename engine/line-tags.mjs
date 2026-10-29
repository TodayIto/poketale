const IDENT = /^p[1-4][a-z]?: /;
const isPokemon = part => !!part && typeof part === 'object' && typeof part.getSlot === 'function' && !!part.side;

export function attachLineTags(battle) {
	const meta = battle.storyLogMeta = battle.log.map(() => null);
	let depth = 0, switchCause = null;

	const outer = [];
	const holderOf = (effect, state) => (effect?.id && isPokemon(state?.target) ? { id: effect.id, type: effect.effectType, uid: state.target.m.uid } : null);
	for (const name of ['singleEvent', 'runEvent']) {
		const original = battle[name];
		battle[name] = function (...args) {
			outer.push(holderOf(this.effect, this.effectState));
			try { return original.apply(this, args); } finally { outer.pop(); }
		};
	}

	const ref = (pokemon, text) => ({ uid: pokemon.m.uid, slot: pokemon.isActive ? pokemon.getSlot() : null, text });

	const lookup = text => battle.sides.find(side => side && text.startsWith(side.id))?.pokemon.find(p => String(p) === text);
	function collect(part, refs) {
		if (Array.isArray(part)) { for (const item of part) collect(item, refs); return; }
		if (isPokemon(part)) { refs.push(ref(part, String(part))); return; }
		if (typeof part !== 'string') return;
		for (const segment of part.split('|')) {
			const text = segment.replace(/^\[[^\]]+\]\s*/, '');
			if (!IDENT.test(text)) continue;
			const pokemon = lookup(text);
			if (pokemon) refs.push(ref(pokemon, text));
		}
	}
	function tagOf(parts) {
		const refs = [];
		collect(parts, refs);
		const kind = Array.isArray(parts[1]) ? parts[1][0] : parts[0];
		const cause = (kind === 'switch' || kind === 'drag') && switchCause ? { cause: switchCause } : {};
		const effects = [...outer, holderOf(battle.effect, battle.effectState)].filter(Boolean);
		return refs.length || effects.length ? { refs, ...cause, ...(effects.length ? { effects } : {}) } : null;
	}

	// Every line written by one outer call gets that call's tag (once, even if add -> addSplit -> add recurses)
	for (const name of ['add', 'addSplit', 'addMove']) {
		const original = battle[name];
		battle[name] = function (...parts) {
			if (depth) return original.apply(this, parts);
			const from = this.log.length, tag = tagOf(parts);
			depth++;
			try { return original.apply(this, parts); } finally {
				depth--;
				for (let i = from; i < this.log.length; i++) meta[i] = tag;
			}
		};
	}

	const attrLastMove = battle.attrLastMove;
	battle.attrLastMove = function (...args) {
		const at = this.lastMoveLine, length = this.log.length;
		const result = attrLastMove.apply(this, args);
		if (this.log.length < length) meta.splice(at, 1);
		return result;
	};

	const retargetLastMove = battle.retargetLastMove;
	battle.retargetLastMove = function (target) {
		const at = this.lastMoveLine;
		const result = retargetLastMove.call(this, target);
		if (at >= 0 && meta[at]) meta[at] = { ...meta[at], refs: [meta[at].refs[0], ref(target, String(target))] };
		return result;
	};
	const switchIn = battle.actions.switchIn;
	battle.actions.switchIn = function (pokemon, pos, sourceEffect = null, isDrag) {
		const old = pokemon?.side.active[pos];
		const copy = typeof sourceEffect?.selfSwitch === 'string' ? sourceEffect.selfSwitch : null;
		const outer = switchCause;
		switchCause = isDrag ? 'drag' : old && !old.hp ? 'faint' : old && copy ? copy : 'normal';
		try { return switchIn.call(this, pokemon, pos, sourceEffect, isDrag); } finally { switchCause = outer; }
	};
}
