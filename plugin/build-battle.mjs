import { mkdirSync, writeFileSync } from 'node:fs';
import { buildBattle } from '../build/plugins.mjs';

const result = await buildBattle();
const code = `//@name poke_battle
//@display-name PokéTale
//@api 3.0
//@version 0.0.1
//@update-url https://raw.githubusercontent.com/TodayIto/poketale/main/dist/poke-battle.js
` + result.code;
mkdirSync('dist', { recursive: true });
writeFileSync('dist/poke-battle.js', code);
console.log(`dist/poke-battle.js ${Buffer.byteLength(code)} bytes (${(Buffer.byteLength(code) / 1e6).toFixed(2)} MB)`);
