// Time, weather and region parsed from story state.
export function installField(sim, battle, { weather, terrain }) {
	if (!weather && !terrain) return;
	const baseFormat = battle.format;
	battle.format = Object.create(baseFormat, {
		onBattleStart: {
			value() {
				baseFormat.onBattleStart?.call(this);
				const field = battle.field;
				if (weather) start(battle, field, 'weather', weather);
				if (terrain) start(battle, field, 'terrain', terrain);
			},
		},
	});
}

function start(battle, field, kind, id) {
	const status = battle.dex.conditions.get(id);
	if (!status.exists) throw new Error(`모르는 ${kind}: ${id}`);
	field[kind] = status.id;
	field[`${kind}State`] = battle.initEffectState({ id: status.id });
	battle.singleEvent('FieldStart', status, field[`${kind}State`], field);
	battle.eachEvent(kind === 'weather' ? 'WeatherChange' : 'TerrainChange');
}
