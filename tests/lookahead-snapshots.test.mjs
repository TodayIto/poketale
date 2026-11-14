import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const currentSource = readFileSync(new URL('../ai/lookahead.js', import.meta.url), 'utf8');
const originalSource = execFileSync('git', ['show', '4178e2f:ai/lookahead.js'], {
  cwd: root, encoding: 'utf8', windowsHide: true,
});
const seed = [11, 22, 33, 44];
const entry = value => typeof value === 'number' ? { value } : value;
const moves = n => Array.from({ length: n }, (_, i) => ({ id: `move${i + 1}`, pp: 10 }));

// Execute the actual search source while replacing its engine/import boundary.
// No vendor battles, clocks, browser frames or timing assertions are involved.
function fixture(source, matrix, options = {}) {
  const metrics = { restores: 0, snapshots: [], seeds: [], created: 0, destroyed: 0, peak: 0, live: new Set() };
  const fault = new Error('injected search failure');
  function sides(config) {
    const pokemon = (hp, n) => ({ hp, maxhp: 1, fainted: false, status: '',
      boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, moveSlots: moves(n) });
    const mine = pokemon(0.5 + (config.value ?? 0), config.mineMoves ?? 2);
    const theirs = pokemon(0.5, config.foeMoves ?? 2);
    if (config.valueError) Object.defineProperty(mine, 'hp', { get() { throw fault; } });
    const make = (id, mon) => ({ id, pokemon: [mon], active: [mon], pokemonLeft: 1,
      requestState: config.capped ? 'switch' : '', isChoiceDone: () => false });
    const p1 = make('p1', theirs), p2 = make('p2', mine);
    p1.foe = p2; p2.foe = p1;
    if (config.ended === 'loss') p2.pokemonLeft = 0;
    if (config.ended === 'win') p1.pokemonLeft = 0;
    return [p1, p2];
  }
  const restore = (_, json, branchSeed) => {
    metrics.restores++;
    metrics.seeds.push([...branchSeed]);
    if (metrics.restores === options.failRestoreAt) throw fault;
    const deep = branchSeed[0] === 'look2';
    const meta = deep ? JSON.parse(json) : { i: branchSeed.at(-2), j: branchSeed.at(-1) };
    const config = deep ? entry(options.deep?.(meta, branchSeed) ?? 0.1) : entry(matrix[meta.i][meta.j]);
    const pair = sides(config);
    const copy = {
      meta, config, deep, sides: pair, ended: !!config.ended, format: {},
      getSide: id => pair[Number(id[1]) - 1], onEvent() {},
      choose() {
        if (config.choiceError) throw fault;
        return !config.rejected;
      },
      destroy() {
        assert.equal(metrics.live.delete(copy), true, 'each created copy is destroyed exactly once');
        metrics.destroyed++;
      },
    };
    metrics.created++;
    metrics.live.add(copy);
    metrics.peak = Math.max(metrics.peak, metrics.live.size);
    return copy;
  };
  const snapshot = copy => {
    assert.equal(metrics.live.has(copy), true, 'snapshot precedes destruction');
    assert.equal(Object.hasOwn(copy, 'randomizer'), false, 'copyJson removes the fixed-damage override');
    metrics.snapshots.push({ ...copy.meta });
    if (options.snapshotError?.(copy.meta)) throw fault;
    return JSON.stringify(copy.meta);
  };
  const sourceBody = source.replace(/^import .*;\r?\n/gm, '').replace(/\bexport\s+(?=function\b)/g, '');
  const lookahead = new Function('snapshot', 'restore', 'partyMatchupScores', 'sortScores', 'deriveSeed',
    `${sourceBody}\nreturn lookahead;`)(snapshot, restore, () => [], rows => rows, (...parts) => parts);
  const probeSides = sides({ foeMoves: matrix[0]?.length ?? 0 });
  const problems = [];
  return {
    metrics, fault, problems,
    run: () => lookahead({ sim: {}, json: 'root', seed, probe: { getSide: id => probeSides[Number(id[1]) - 1] },
      sideId: 'p2', mine: matrix.map((_, i) => `move ${i + 1}`), forcedSwitches: 2, problems }),
  };
}
function compare(matrix, options) {
  const original = fixture(originalSource, matrix, options), current = fixture(currentSource, matrix, options);
  const expected = original.run(), result = current.run();
  assert.deepEqual(result, expected, 'choice, first/deep values and simulation/rejection counts match 0.0.7.1');
  assert.deepEqual(current.problems, original.problems);
  assert.deepEqual(current.metrics.seeds, original.metrics.seeds, 'every simulation keeps its seed and traversal order');
  assert.equal(current.metrics.restores, original.metrics.restores);
  assert.equal(original.metrics.live.size, 0);
  assert.equal(current.metrics.live.size, 0);
  assert.equal(current.metrics.created, current.metrics.destroyed);
  return { original, current, result };
}

test('only four searched snapshots are made while all reply scores and restores are preserved', () => {
  const matrix = Array.from({ length: 8 }, (_, i) => Array.from({ length: 4 }, (_, j) => -0.3 + i * 0.06 + j * 0.01));
  const { original, current } = compare(matrix);
  assert.equal(original.metrics.snapshots.length, 32);
  assert.equal(current.metrics.snapshots.length, 4);
  assert.deepEqual(current.metrics.snapshots, [{ i: 7, j: 0 }, { i: 7, j: 1 }, { i: 6, j: 0 }, { i: 6, j: 1 }]);
  assert.ok(current.metrics.peak <= 7, `at most seven live copies, saw ${current.metrics.peak}`);
});

test('equal rows and replies retain stable original ordering including deep seeds', () => {
  const { current, result } = compare(Array.from({ length: 4 }, () => [0, 0, 0, 0]));
  assert.equal(result.choice, 'move 1');
  assert.deepEqual(result.rows.map(row => row.choice), ['move 1', 'move 2', 'move 3', 'move 4']);
  assert.deepEqual(current.metrics.snapshots, [{ i: 0, j: 0 }, { i: 0, j: 1 }, { i: 1, j: 0 }, { i: 1, j: 1 }]);
  assert.deepEqual([...new Set(current.metrics.seeds.filter(s => s[0] === 'look2').map(s => `${s[5]}:${s[6]}`))], ['0:0', '0:1', '1:0', '1:1']);
});

test('each deep simulation uses its selected snapshot payload and original move/reply seed', () => {
  const matrix = Array.from({ length: 4 }, (_, i) => Array.from({ length: 4 }, (_, j) => i * 0.04 + j * 0.01));
  const { current, result } = compare(matrix, {
    deep: ({ i, j }, branchSeed) => -0.2 + i * 0.04 + j * 0.01 + branchSeed.at(-2) * 0.025 - branchSeed.at(-1) * 0.015,
  });
  assert.deepEqual(current.metrics.snapshots, [{ i: 3, j: 0 }, { i: 3, j: 1 }, { i: 2, j: 0 }, { i: 2, j: 1 }]);
  assert.equal(result.choice, 'move 4');
  assert.ok(result.rows[0].deep > result.rows[1].deep, 'deep scores distinguish both snapshot payloads');
});

test('an ended worst reply still consumes its rank and deep-seed position', () => {
  const { current } = compare([
    [{ ended: 'loss' }, 0.1, 0.2, 0.3],
    [{ ended: 'loss' }, 0.1, 0.2, 0.3],
  ]);
  assert.deepEqual(current.metrics.snapshots, [{ i: 0, j: 1 }, { i: 1, j: 1 }]);
  assert.ok(current.metrics.seeds.filter(s => s[0] === 'look2').every(s => s[6] === 1));
});

test('one valid row skips snapshots and deep search and releases its retained copies', () => {
  const { original, current, result } = compare([[0.1, 0.2, 0.3, 0.4]]);
  assert.equal(result.rows.length, 1);
  assert.equal(Object.hasOwn(result.rows[0], 'deep'), false);
  assert.equal(original.metrics.snapshots.length, 4);
  assert.equal(current.metrics.snapshots.length, 0);
  assert.equal(current.metrics.seeds.some(s => s[0] === 'look2'), false);
});

test('empty searches and rejected, capped and failed branches retain original reporting', () => {
  const { current, result } = compare([
    [{ rejected: true }, { capped: true }, { choiceError: true }, 0.1],
    [0.2, 0.1, 0.3, 0.4],
  ]);
  assert.equal(result.rejected, 1);
  assert.deepEqual(current.problems.map(p => p.type), ['capped', 'degraded']);
  const empty = compare([[{ rejected: true }, { rejected: true }]]);
  assert.equal(empty.result, null);
  assert.equal(empty.current.metrics.snapshots.length, 0);
});

test('a worst reply without subsequent legal moves keeps its fallback value without a snapshot', () => {
  const { current } = compare([
    [{ value: -0.2, mineMoves: 0 }, 0, 0.1, 0.2],
    [{ value: -0.2, foeMoves: 0 }, 0, 0.1, 0.2],
  ]);
  assert.deepEqual(current.metrics.snapshots, [{ i: 0, j: 1 }, { i: 1, j: 1 }]);
});

test('all rejected deep branches preserve the first-ply fallback and destruction counts', () => {
  const { current } = compare([[0, 0.1], [0, 0.1]], { deep: () => ({ rejected: true }) });
  assert.equal(current.metrics.snapshots.length, 4);
});

test('selected snapshot errors propagate and release every retained copy', () => {
  const current = fixture(currentSource, [[0, 0.1, 0.2], [0, 0.1, 0.2], [0, 0.1, 0.2]], {
    snapshotError: ({ i, j }) => i === 0 && j === 0,
  });
  assert.throws(current.run, error => error === current.fault);
  assert.equal(current.metrics.live.size, 0);
  assert.equal(current.metrics.created, current.metrics.destroyed);
});

test('later restore errors release copies retained from earlier rows', () => {
  const current = fixture(currentSource, [[0, 0.1, 0.2], [0, 0.1, 0.2], [0, 0.1, 0.2]], { failRestoreAt: 8 });
  assert.throws(current.run, error => error === current.fault);
  assert.equal(current.metrics.live.size, 0);
  assert.equal(current.metrics.created, current.metrics.destroyed);
});

test('first and second-ply evaluation errors propagate with no leaked copies', () => {
  for (const deep of [false, true]) {
    const matrix = [[0, 0.1], [0, 0.1]];
    if (!deep) matrix[1][0] = { valueError: true };
    const current = fixture(currentSource, matrix, deep ? { deep: () => ({ valueError: true }) } : {});
    assert.throws(current.run, error => error === current.fault);
    assert.equal(current.metrics.live.size, 0);
    assert.equal(current.metrics.created, current.metrics.destroyed);
  }
});
