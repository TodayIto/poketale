import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DOT, P, rowsPath, seeded } from '../view/amie-scenes.js';

const sourceUrl = new URL('../view/amie-scenes-games.js', import.meta.url);
const source = readFileSync(sourceUrl, 'utf8').replace(/from '(\.[^']+)'/g,
  (_, path) => `from '${new URL(path, sourceUrl).href}'`);
const { waterNet } = await import(
  `data:text/javascript;base64,${Buffer.from(`${source}\nexport { waterNet };`).toString('base64')}`);

// Original 0.0.7.1 reference: calculate every distance with hypot before ranking.
function reference(c, y0, y1, line) {
  const pts = [];
  for (let y = y0, row = 0; y < y1; row++) {
    const s = 6 + 8 * (y - y0) / (y1 - y0);
    for (let x = -8 + (row % 2) * s * 0.8; x < c.w + 8; x += s * 1.6) {
      pts.push([x + (c.rnd() - 0.5) * s, y + c.rnd() * s * 0.3]);
    }
    y += s * 0.6;
  }
  const rows = [];
  for (let y = y0 + 2; y < y1 - 2; y += DOT) {
    let start = null;
    for (let x = -4; x <= c.w + 4; x += DOT) {
      let d1 = 1e9, d2 = 1e9;
      for (const [px, py] of pts) {
        const d = Math.hypot(px - x - 1, (py - y - 1) * 2);
        if (d < d1) { d2 = d1; d1 = d; }
        else if (d < d2) d2 = d;
      }
      const on = x <= c.w + 2 && d2 - d1 < 1.8;
      if (on && start === null) start = x;
      else if (!on && start !== null) { rows.push([y, start, x]); start = null; }
    }
  }
  return P(line, rowsPath(rows));
}

function context(w, seed) {
  const random = seeded(String(seed));
  const c = { w, calls: 0, rnd: () => { c.calls++; return random(); } };
  return c;
}

test('water paths and random consumption match 0.0.7.1 across seeds and sizes', () => {
  for (let seed = 0; seed < 32; seed++) {
    for (const [w, y0, y1] of [[168, 202, 256], [384, 86, 108], [164, 200, 252], [380, 84, 106], [64, 0, 18], [400, 0, 60]]) {
      const before = context(w, seed), after = context(w, seed);
      assert.equal(waterNet(after, y0, y1, '#8fb4d8'), reference(before, y0, y1, '#8fb4d8'), `seed ${seed}, ${w}/${y0}/${y1}`);
      assert.equal(after.calls, before.calls, 'later art must see the same random sequence');
      assert.equal(after.rnd(), before.rnd());
    }
  }
});

test('empty, short, and fractional ranges retain the original boundary behavior', () => {
  for (const [w, y0, y1] of [[0, 0, 0], [168, 10, 0], [168, 0, 4], [1, 0, 6], [167.5, 20.5, 50.5]]) {
    const before = context(w, 'edge'), after = context(w, 'edge');
    assert.equal(waterNet(after, y0, y1, '#ffffff'), reference(before, y0, y1, '#ffffff'));
    assert.equal(after.calls, before.calls);
  }
});

test('hypot calls are limited to the nearest two points per sample', t => {
  const original = Math.hypot;
  let count = 0;
  t.mock.method(Math, 'hypot', (...args) => { count++; return original(...args); });
  const expected = reference(context(168, 'count'), 202, 256, '#ffffff');
  const before = count;
  count = 0;
  assert.equal(waterNet(context(168, 'count'), 202, 256, '#ffffff'), expected);
  const samples = 25 * 89;
  assert.equal(count, samples * 2);
  assert.ok(count < before * 0.02, 'more than 98% of full distance evaluations should be removed');
});
