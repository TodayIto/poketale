export const GIMMICKS = Object.freeze(['mega', 'z', 'ultra', 'dynamax', 'tera']);

/** Generation (or 'champions') -> the gimmicks its games have */
export const GEN_GIMMICKS = Object.freeze({
	1: Object.freeze([]), 2: Object.freeze([]), 3: Object.freeze([]), 4: Object.freeze([]), 5: Object.freeze([]),
	6: Object.freeze(['mega']),
	7: Object.freeze(['mega', 'z', 'ultra']),
	8: Object.freeze(['dynamax']),
	9: Object.freeze(['tera']),
	champions: Object.freeze(['mega', 'tera']),
});

export const genHas = (gen, gimmick) => gen == null || (GEN_GIMMICKS[gen]?.includes(gimmick) ?? false);

export const formatGenOf = formatid => Number(/^gen(\d)/.exec(String(formatid ?? ''))?.[1] ?? 9);
/** Whether a format id is Champions' (gen9champions...) */
export const isChampions = formatid => /^gen\d+champions/.test(String(formatid ?? ''));

export function ruleGen(spec) {
	if (spec?.formGen != null) return spec.formGen;
	if (isChampions(spec?.formatid)) return 'champions';
	const gen = formatGenOf(spec?.formatid);
	return gen < 9 ? gen : null;
}

export const generationOf = rule => (Number.isInteger(rule) ? rule : null);

export const battleRuleGen = battle => battle?.storyRuleGen ?? null;
