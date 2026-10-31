import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
if (args.some(arg => arg !== '--no-test')) {
  console.error('Usage: node tools/build-all.mjs [--no-test]');
  process.exit(2);
}
const steps = [
  "tools/build-bgm.mjs",
  "tools/build-levelup.mjs",
  "tools/build-exp.mjs",
  "tools/build-names.mjs",
  "tools/build-pokerogue-boxes.mjs",
  "tools/extract-director-text.mjs",
  "tools/build-catch-rates.mjs",
  "ai/build-pokerogue-moves.mjs",
  "tools/extract-effects-text.mjs",
  "tools/build-bag-data.mjs",
  "tools/extract-exp-text.mjs",
  "tools/extract-summary-text.mjs",
  "tools/extract-view-text.mjs",
  "tools/build-story-names.mjs",
  "tools/build-items-outside.mjs",
  "tools/build-named-trainers.mjs",
  "tools/build-font.mjs",
  "plugin/build-battle.mjs"
];
for (const [i, file] of steps.entries()) {
  console.log(`[${i + 1}/${steps.length}] ${file}`);
  const result = spawnSync(process.execPath, [file], { stdio: 'inherit' });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(1);
}
