import * as sim from '../../engine/browser-engine.mjs';
import { planTurns } from '../../director/plan.js';
import { isWild } from '../../director/index.js';
import { createEnemyAI } from '../../ai/index.js';
import { battleNamesIn } from './names.js';

// The same opposing AI as the battle window for this battle (flow.js createBattleSession)
const enemyFor = spec => createEnemyAI(sim, { trainer: !isWild(spec), difficulty: spec.difficulty ?? 'normal', boss: !!spec.boss });

export const workOut = (snapshot, turns, { options, lang }) => planTurns(sim, snapshot, turns, { options, enemyAI: enemyFor(snapshot.spec), names: battleNamesIn(lang, sim.Dex), lang });

export const readAt = (snapshot, options) => workOut(snapshot, [], options);

export { commandQueue } from '../../director/plan.js';
