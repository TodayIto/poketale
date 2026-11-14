import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bagFixture, bagOf, bagState } from './helpers/bag.mjs';

const source = readFileSync(new URL('../view/ui/bag.js', import.meta.url), 'utf8');
function fixture(bag = bagOf(60)) {
  const f = bagFixture(source);
  Object.assign(f.menu, { bag, pocket: 0, cursor: 0, scroll: 0, prompt: '도구를 골라 주세요.', party: [], sub: false });
  return f;
}

test('all names, counts, tabs, and cancel text retain their measured geometry', () => {
  const bag = bagOf(0, 2);
  bag.pockets[0].items = [{ name: '상처약', count: 1 }, { name: '가나다😀 e\u0301', count: 999 }];
  bag.pockets[1].items = [{ name: 'Long item name', count: 10000 }, { name: '', count: 0 }];
  const { menu, scene } = fixture(bag);
  assert.deepEqual(menu.measureWidths(), { namesWidth: 104, countsWidth: 48, tabs: [48, 48], content: 156 });
  assert.equal(scene.measurementCreated, 1);
  assert.equal(scene.measurementDestroyed, 1);
});

test('scrolling and switching pockets reuse measurements for the entire open menu', () => {
  const { menu, scene } = fixture();
  menu.draw();
  assert.equal(scene.measurementCreated, 1);
  assert.equal(scene.measurementDestroyed, 1);
  assert.equal(scene.measurementWrites.length, 66, '60 names + one shared count + four tabs + cancel');
  const first = bagState(menu);
  for (let i = 0; i < 30; i++) menu.scrollBy(i % 2 ? -1 : 1);
  menu.setPocket(1); menu.setPocket(0);
  assert.deepEqual(bagState(menu), first);
  assert.equal(scene.measurementCreated, 1);
  assert.equal(scene.measurementWrites.length, 66);
});

test('changed names, counts, tab labels, and cancel labels are remeasured', () => {
  const { menu, scene } = fixture(bagOf(1));
  menu.measureWidths();
  menu.bag.pockets[0].items[0].name = 'A'.repeat(30);
  menu.bag.pockets[0].items[0].count = 1000000;
  menu.bag.pockets[1].name = 'B'.repeat(50);
  scene.cancel = 'C'.repeat(60);
  assert.deepEqual(menu.measureWidths(), { namesWidth: 240, countsWidth: 64, tabs: [48, 400, 48, 48], content: 554 });
  assert.equal(scene.measurementCreated, 2);
  assert.equal(scene.measurementDestroyed, 2);
  assert.equal(scene.measurementWrites.filter(text => text === '×1000000').length, 1);
});

test('adding and removing items recomputes maxima rather than retaining stale layout', () => {
  const { menu } = fixture(bagOf(1));
  const original = menu.measureWidths();
  menu.bag.pockets[1].items.push({ name: 'A'.repeat(50), count: 50000 });
  assert.equal(menu.measureWidths().namesWidth, 400);
  menu.bag.pockets[1].items.length = 0;
  assert.deepEqual(menu.measureWidths(), original);
});

test('empty strings cache zero width and measurement failure still destroys the probe', () => {
  const { menu, scene } = fixture(bagOf(0, 1));
  menu.bag.pockets[0].name = '';
  scene.cancel = '';
  assert.deepEqual(menu.measureWidths(), { namesWidth: 0, countsWidth: 0, tabs: [0], content: 64 });
  const written = scene.measurementWrites.length;
  menu.measureWidths();
  assert.equal(scene.measurementWrites.length, written);
  menu.bag.pockets[0].items.push({ name: 'fail', count: 1 });
  scene.failText = 'fail';
  assert.throws(() => menu.measureWidths(), /text measurement failed/);
  assert.equal(scene.measurementCreated, scene.measurementDestroyed);
  scene.failText = null;
  assert.equal(menu.measureWidths().namesWidth, 32);
});

test('closing and reopening clears widths, including when the same bag object changes', async () => {
  const { menu, scene } = fixture(bagOf(1));
  const bag = menu.bag;
  const pending = menu.choose({ bag });
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(menu.measuredWidths.size > 0);
  menu.finish(null);
  assert.equal(await pending, null);
  assert.equal(menu.measuredWidths.size, 0);
  const writes = scene.measurementWrites.length;
  bag.pockets[0].items[0].name = '다시 여는 가방';
  const reopened = menu.choose({ bag });
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(scene.measurementWrites.length > writes);
  assert.ok(menu.measuredWidths.has('다시 여는 가방'));
  menu.finish(null);
  await reopened;
  assert.equal(menu.measuredWidths.size, 0);
});
