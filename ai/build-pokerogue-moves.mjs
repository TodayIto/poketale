import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sim = require('../vendor/pokemon-showdown/dist/sim/index.js');
const ROOT = new URL('../vendor/pokerogue/', import.meta.url);
const read = path => readFileSync(new URL(path, ROOT), 'utf8');
const src = read('src/data/moves/move.ts');
const lineOf = index => src.slice(0, index).split('\n').length;

const parent = {};
const classAt = [];
for (const m of src.matchAll(/^export (?:abstract )?class (\w+)(?:<[^>]*>)?(?: extends (\w+))?/gm)) {
  if (m[2]) parent[m[1]] = m[2];
  classAt.push([m.index, m[1]]);
}
const scored = new Set();
for (const m of src.matchAll(/get(?:User|Target)BenefitScore\(/g)) {
  let owner;
  for (const [i, name] of classAt) if (i < m.index) owner = name;
  scored.add(owner);
}
for (const name of ['Move', 'AttackMove', 'MoveAttr']) scored.delete(name);
const scoredAncestor = name => { for (let c = name; c; c = parent[c]) if (scored.has(c)) return c; return null; };

const tag = (t, self = false) => ['Tag', t, !!self];
const SUBCLASSES = {
  FlinchAttr: ['super(BattlerTagType.FLINCHED, false)', () => tag('FLINCHED')],
  ConfuseAttr: ['super(BattlerTagType.CONFUSED, selfTarget, false, 2, 5)', a => tag('CONFUSED', a[0])],
  TrapAttr: ['super(tagType, false, false, 4, 5)', a => tag(a[0])],
  RechargeAttr: ['super(BattlerTagType.RECHARGING, true, false, 1, 1, true)', () => tag('RECHARGING', true)],
  ProtectAttr: ['constructor(tagType: BattlerTagType = BattlerTagType.PROTECTED) {\n    super(tagType, true)', a => tag(a[0] ?? 'PROTECTED', true)],
  LeechSeedAttr: ['super(BattlerTagType.SEEDED)', () => tag('SEEDED')],
  ExposedMoveAttr: ['super(tagType, false, true)', a => tag(a[0])],
  FallDownAttr: ['super(BattlerTagType.IGNORE_FLYING, false, false, 0, 0, true)', () => tag('IGNORE_FLYING')],
  JawLockAttr: ['super(BattlerTagType.TRAPPED)', () => tag('TRAPPED')],
  AddBattlerTagIfBoostedAttr: ['super(tag, false, false, 2, 5)', a => tag(a[0])],
  AddBattlerTagAttr: ['selfTarget = false,\n    failOnOverlap = false,', a => tag(a[0], a[1])],
  HealAttr: ['constructor(healRatio: number, showAnim = false, selfTarget = true, failOnFullHp = true)', a => ['Heal', a[0], a[2] ?? true]],
  VariableHealAttr: ['super(1, showAnim, selfTarget, failOnFullHp)', a => ['Heal', 1, a[2] ?? true]],
  RestAttr: ['constructor(duration: number) {\n    super(1, true)', () => ['Heal', 1, true]],
  HealOnAllyAttr: ['export class HealOnAllyAttr extends HealAttr', a => ['Heal', a[0], a[2] ?? true]],
  StatStageChangeAttr: ['selfTarget?: boolean,', a => ['Stat', a[0], a[1], !!a[2]]],
  CutHpStatStageBoostAttr: ['super(stat, levels, true, options)', a => ['Stat', a[0], a[1], true]],
  GrowthStatStageChangeAttr: ['super([Stat.ATK, Stat.SPATK], 1, true)', () => ['Stat', ['atk', 'spa'], 1, true, 'growth']],
  PartingShotAttr: ['super([Stat.ATK, Stat.SPATK], -1, false, { trigger: MoveEffectTrigger.PRE_APPLY })', () => ['Stat', ['atk', 'spa'], -1, false, 'partingshot']],
  StatusEffectAttr: ['constructor(effect: StatusEffect, selfTarget = false)', a => ['Status', a[0], !!a[1]]],
  MultiStatusEffectAttr: ['super(effects[0], selfTarget)', a => ['MultiStatus', a[0], !!a[1]]],
  HitsTagAttr: ['export class HitsTagAttr extends MoveAttr', a => ['HitsTag', a[0], false]],
  HitsTagForDoubleDamageAttr: ['this.doubleDamage = true', a => ['HitsTag', a[0], true]],
  ForceSwitchOutAttr: ['constructor(selfSwitch = false, switchType: SwitchType = SwitchType.SWITCH)', a => ['ForceSwitch', !!a[0], a[1] === 'BATON_PASS']],
  ChillyReceptionAttr: ['export class ChillyReceptionAttr extends ForceSwitchOutAttr', a => ['ForceSwitch', !!a[0], a[1] === 'BATON_PASS']],
  HitHealAttr: ['constructor(healRatio?: number | null, healStat?: EffectiveStat)', a => ['HitHeal', a[1] ?? null]],
  ReducePpMoveAttr: ['export class ReducePpMoveAttr extends MoveEffectAttr', () => ['ReducePp']],
  AttackReducePpMoveAttr: ['export class AttackReducePpMoveAttr extends ReducePpMoveAttr', () => ['ReducePp']],
  ShiftStatAttr: ['constructor(statToSwitch: EffectiveStat, statToSwitchWith: EffectiveStat)', a => ['ShiftStat', a[0], a[1]]],
  SacrificialAttrOnHit: ['export class SacrificialAttrOnHit extends MoveEffectAttr', () => ['Sacrificial']],
  SacrificialFullRestoreAttr: ['export class SacrificialFullRestoreAttr extends SacrificialAttr', () => ['SacrificialFullRestore']],
  MatchHpAttr: ['/*getUserBenefitScore(user: Pokemon, target: Pokemon, move: Move): number {', () => null],
};

// Decided by name alone, no arguments
const SIMPLE = {
  HighCritAttr: 'HighCrit', CritOnlyAttr: 'CritOnly', TargetHalfHpDamageAttr: 'TargetHalfHp', SurviveDamageAttr: 'SurviveDamage',
  RecoilAttr: 'Recoil', SacrificialAttr: 'Sacrificial', HalfSacrificialAttr: 'HalfSacrificial', AddSubstituteAttr: 'Substitute',
  FlameBurstAttr: 'FlameBurst', MultiHitAttr: 'MultiHit', PsychoShiftEffectAttr: 'PsychoShift', StealHeldItemChanceAttr: 'StealItem',
  RemoveHeldItemAttr: 'RemoveItem', HealStatusEffectAttr: 'HealStatus', BypassSleepAttr: 'BypassSleep', TerrainChangeAttr: 'Terrain',
  GulpMissileTagAttr: 'GulpMissile', RevivalBlessingAttr: 'RevivalBlessing', RepeatMoveAttr: 'RepeatMove',
};
for (const [name, [needle]] of Object.entries(SUBCLASSES)) {
  const start = src.search(new RegExp(`^export (?:abstract )?class ${name}\\b`, 'm'));
  const end = src.slice(start + 1).search(/^export /m) + start + 1;
  if (start < 0 || !src.slice(start, end).includes(needle)) throw new Error(`원본 변경: ${name} 에서 "${needle}" 를 찾지 못함 — SUBCLASSES 를 다시 대조할 것`);
}

function closeParen(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === '"' || c === "'" || c === '`') { i = skipString(text, i); continue; }
    if (c === '/' && text[i + 1] === '/') { i = text.indexOf('\n', i); continue; }
    if (c === '/' && text[i + 1] === '*') { i = text.indexOf('*/', i) + 1; continue; }
    if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c) && --depth === 0) return i;
  }
  throw new Error('괄호 짝이 맞지 않음');
}
function skipString(text, i) {
  const q = text[i];
  for (i++; i < text.length; i++) { if (text[i] === '\\') i++; else if (text[i] === q) return i; }
  return i;
}
function splitArgs(text) {
  const out = [];
  let depth = 0, cur = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' || c === "'" || c === '`') { const j = skipString(text, i); cur += text.slice(i, j + 1); i = j; continue; }
    if ('([{'.includes(c)) depth++;
    if (')]}'.includes(c)) depth--;
    if (c === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
const STAT = { ATK: 'atk', DEF: 'def', SPATK: 'spa', SPDEF: 'spd', SPD: 'spe', ACC: 'accuracy', EVA: 'evasion' };
const STAT_SETS = { BATTLE_STATS: ['atk', 'def', 'spa', 'spd', 'spe', 'accuracy', 'evasion'], EFFECTIVE_STATS: ['atk', 'def', 'spa', 'spd', 'spe'] };
const STATUS = { POISON: 'psn', TOXIC: 'tox', PARALYSIS: 'par', SLEEP: 'slp', FREEZE: 'frz', BURN: 'brn' };
function value(token) {
  let m;
  if (token === undefined) return undefined;
  if (token === 'true' || token === 'false') return token === 'true';
  if (token === 'null' || token === 'undefined') return null;
  if (/^-?[\d.]+$/.test(token)) return Number(token);
  if ((m = /^(-?[\d.]+)\s*\/\s*([\d.]+)$/.exec(token))) return Number(m[1]) / Number(m[2]);
  if ((m = /^Stat\.(\w+)$/.exec(token))) return STAT[m[1]];
  if (STAT_SETS[token]) return STAT_SETS[token];
  if ((m = /^StatusEffect\.(\w+)$/.exec(token))) return STATUS[m[1]];
  if ((m = /^(?:BattlerTagType|SwitchType)\.(\w+)$/.exec(token))) return m[1];
  if (token.startsWith('[') && token.endsWith(']')) return splitArgs(token.slice(1, -1)).map(value);
  return { raw: token.slice(0, 40) };
}

const init = src.indexOf('export function initMoves');
const startRe = /new (AttackMove|ChargingAttackMove|StatusMove|SelfStatusMove|ChargingSelfStatusMove)\(MoveId\.([A-Z0-9_]+),/g;
startRe.lastIndex = init;
const starts = [...src.matchAll(startRe)].filter(m => m.index > init);
const moves = {};
const unmatched = [];
const unscoredKinds = new Set();
const matched = new Set();
for (const [k, m] of starts.entries()) {
  const [, klass, name] = m;
  if (name === 'NONE') continue;
  const chunkEnd = k + 1 < starts.length ? starts[k + 1].index : src.indexOf('\n  );', m.index);
  const ctorClose = closeParen(src, src.indexOf('(', m.index));
  const ctor = splitArgs(src.slice(src.indexOf('(', m.index) + 1, ctorClose));
  const attack = klass === 'AttackMove' || klass === 'ChargingAttackMove';

  const chance = value(ctor[attack ? 6 : 4]);
  const power = attack ? value(ctor[3]) : -1;
  const attrs = [];

  if (attack && ctor[1] === 'PokemonType.FIRE') attrs.push(['HealStatus']);
  let firstMove = false;
  const chain = src.slice(ctorClose + 1, chunkEnd);
  const callRe = /\.(attr|condition)\(/g;
  for (let c; (c = callRe.exec(chain));) {
    const o = c.index + c[0].length - 1;
    const close = closeParen(chain, o);
    const args = splitArgs(chain.slice(o + 1, close));
    callRe.lastIndex = close;
    if (c[1] === 'condition') { if (/^new FirstMoveCondition\b/.test(args[0])) firstMove = true; continue; }
    const attrName = args[0];
    const base = scoredAncestor(attrName);
    if (!base) continue;
    const params = args.slice(1).map(value);
    let entry;
    if (SIMPLE[attrName]) entry = [SIMPLE[attrName]];
    else if (SUBCLASSES[attrName]) entry = SUBCLASSES[attrName][1](params);
    else throw new Error(`점수가 있는 새 속성 ${attrName} (${base} 계통, move.ts ${lineOf(m.index)}행 ${name}) — SUBCLASSES 에 추가할 것`);
    if (entry) attrs.push(entry);
    else unscoredKinds.add(attrName);
  }
  const id = name.toLowerCase().replace(/_/g, '');
  const dexMove = sim.Dex.moves.get(id);
  if (!dexMove.exists) { unmatched.push(name); continue; }
  matched.add(dexMove.id);
  if (!attrs.length && !firstMove) continue;
  moves[dexMove.id] = { chance, power, ...(firstMove ? { firstMove } : {}), attrs };
}

const legendary = [];
const speciesDir = new URL('src/data/balance/species/', ROOT);
for (const file of readdirSync(speciesDir).filter(f => f.endsWith('.ts')).sort()) {
  const text = readFileSync(new URL(file, speciesDir), 'utf8');
  const blocks = [...text.matchAll(/\[SpeciesId\.([A-Z0-9_]+)\] = \{/g)];
  for (const [k, b] of blocks.entries()) {
    const body = text.slice(b.index, k + 1 < blocks.length ? blocks[k + 1].index : undefined);
    if (!/^\s*legendary: true,/m.test(body)) continue;
    const species = sim.Dex.species.get(b[1].toLowerCase().replace(/_/g, ''));
    if (!species.exists) throw new Error(`전설 포켓몬 ${b[1]} 를 Showdown 에서 찾지 못함`);
    legendary.push(species.id);
  }
}

const showdownOnly = sim.Dex.moves.all().filter(m => !m.isNonstandard && m.num > 0 && !matched.has(m.id)).map(m => m.id);
const out = {
  moves, legendary: legendary.sort(),
  pokerogueOnly: unmatched,
  showdownOnly,
};
writeFileSync(new URL('./pokerogue-moves.json', import.meta.url), JSON.stringify(out, null, 0).replace(/\],"/g, '],\n"').replace(/\},"/g, '},\n"') + '\n');
console.log(`기술 ${starts.length - 1}개 중 점수 속성 있는 기술 ${Object.keys(moves).length}개 → ai/pokerogue-moves.json`);
console.log(`전설 ${legendary.length}종: ${legendary.join(' ')}`);
console.log(`Showdown 에 없는 PokeRogue 기술 ${unmatched.length}개: ${unmatched.join(' ') || '-'}`);
console.log(`점수 0 으로 확인한 속성: ${[...unscoredKinds].join(' ') || '-'}`);
console.log(`PokeRogue 에 없는 Showdown 표준 기술 ${showdownOnly.length}개 (기본 공격 점수만): ${showdownOnly.join(' ') || '-'}`);
