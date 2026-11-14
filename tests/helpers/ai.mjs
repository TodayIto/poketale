import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../../', import.meta.url));
export const sim = createRequire(import.meta.url)('../../vendor/pokemon-showdown/dist/sim/index.js');

export const roster = [
  ['Pikachu', ['thunderbolt', 'quickattack', 'grassknot', 'thunderwave']],
  ['Charizard', ['flamethrower', 'airslash', 'dragonclaw', 'roost']],
  ['Snorlax', ['bodyslam', 'crunch', 'earthquake', 'rest']],
  ['Gengar', ['shadowball', 'sludgebomb', 'energyball', 'hypnosis']],
  ['Garchomp', ['earthquake', 'dragonclaw', 'rockslide', 'swordsdance']],
  ['Scizor', ['bulletpunch', 'xscissor', 'closecombat', 'swordsdance']],
];

export const enemyRoster = [
  ['Blastoise', ['surf', 'icebeam', 'darkpulse', 'protect']],
  ['Venusaur', ['gigadrain', 'sludgebomb', 'sleeppowder', 'synthesis']],
  ['Dragonite', ['dragonclaw', 'extremespeed', 'firepunch', 'dragondance']],
  ['Alakazam', ['psychic', 'shadowball', 'focusblast', 'recover']],
  ['Metagross', ['meteormash', 'zenheadbutt', 'earthquake', 'bulletpunch']],
  ['Tyranitar', ['rockslide', 'crunch', 'earthquake', 'dragondance']],
];

export function specFor({ teamSize = 2, double = false, seed = [1, 2, 3, 4] } = {}) {
  const team = (members, side) => members.slice(0, teamSize).map(([species, moves], i) => ({
    uid: `${side}-${i}`,
    set: { species, moves: [...moves], level: 50, ability: '', nature: 'Serious' },
  }));
  return {
    seed: [...seed], double,
    p1: { name: 'Player', team: team(roster, 'p1') },
    p2: { name: 'Enemy', team: team(enemyRoster, 'p2') },
  };
}

const referenceFiles = new Set([
  'ai/index.js', 'ai/engine-copy.js', 'ai/lookahead.js', 'engine/showdown-compat.mjs',
]);
let referencePromise;

// Keep the four changed AI/restore modules at the exact 0.0.7.1 baseline.
// Bundling commitChoice with createEnemyAI preserves their shared pending WeakMap.
export function referenceAI() {
  return referencePromise ??= (async () => {
    const result = await build({
      absWorkingDir: root,
      stdin: {
        contents: [
          "export { createEnemyAI } from './ai/index.js';",
          "export { commitChoice } from './ai/commit.js';",
          "export { snapshot, restore } from './ai/engine-copy.js';",
        ].join('\n'),
        resolveDir: root, sourcefile: 'reference-ai-0071.mjs', loader: 'js',
      },
      bundle: true, write: false, platform: 'node', format: 'esm', target: 'node24', logLevel: 'silent',
      plugins: [{
        name: 'reference-ai-0071',
        setup(builder) {
          builder.onLoad({ filter: /\.(?:js|mjs)$/ }, ({ path: filename }) => {
            const relative = path.relative(root, filename).split(path.sep).join('/');
            if (!referenceFiles.has(relative)) return;
            return {
              contents: execFileSync('git', ['show', `4178e2f:${relative}`], {
                cwd: root, encoding: 'utf8', windowsHide: true,
              }),
              loader: 'js', resolveDir: path.dirname(filename),
            };
          });
        },
      }],
    });
    return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
  })();
}
