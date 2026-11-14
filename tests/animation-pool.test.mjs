import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { animationFixture } from './helpers/animation.mjs';

const source = readFileSync(new URL('../view/anims/player.js', import.meta.url), 'utf8');
const effect = (graphicFrame, more = {}) => ({ target: 2, graphicFrame, x: 0, y: 0, zoomX: 100, zoomY: 100,
  opacity: 255, visible: true, locked: false, priority: 1, focus: 1, ...more });
const animation = frames => ({ graphic: 'test', frames });
const effectsAt = (result, frame) => result.frames[frame].filter(object => object.key?.startsWith('anim:'));

test('temporary effects are reused within one play and destroyed before the next play', async () => {
  const fixture = animationFixture(source);
  const anim = animation([[effect(0), effect(1)], [], [effect(2), effect(3)]]);
  const first = await fixture.run(anim);
  assert.equal(first.error, undefined);
  assert.equal(first.metrics.effects, 2);
  assert.deepEqual(first.waits, [50, 50, 50, 0]);
  assert.deepEqual(effectsAt(first, 1), []);
  assert.deepEqual(effectsAt(first, 2).map(o => o.frame), [2, 3]);
  assert.equal(first.leaks, 0);
  const second = await fixture.run(anim);
  assert.equal(second.metrics.effects, 4, 'no cross-animation pool');
  assert.equal(second.leaks, 0);
  assert.equal(second.running, false);
});

test('a reused priority-1 effect is appended just like a newly created effect', async () => {
  const result = await animationFixture(source).run(animation([[effect(0, { priority: 0 })], [], [effect(1)]]));
  assert.deepEqual(result.frames[0].map(o => o.actor ?? o.frame), [0, 'enemy', 'player']);
  assert.deepEqual(result.frames[2].map(o => o.actor ?? o.frame), ['enemy', 'player', 1]);
  assert.equal(result.metrics.effects, 1);
});

test('locked effects remain present while unlocked surplus effects are hidden', async () => {
  const result = await animationFixture(source).run(animation([
    [effect(0, { locked: true }), effect(1)], [], [effect(2)], [effect(3), effect(4)],
  ]));
  assert.deepEqual(effectsAt(result, 1).map(o => [o.frame, o.visible, o.locked]), [[0, true, true]]);
  assert.deepEqual(effectsAt(result, 3).map(o => [o.frame, o.visible, o.locked]), [[3, true, false], [4, true, false]]);
  assert.equal(result.metrics.effects, 2);
  assert.equal(result.leaks, 0);
});

test('reused effects do not retain tone, blend, scale, rotation, opacity, or lock state', async () => {
  const result = await animationFixture(source).run(animation([
    [effect(0, { tone: [120, -50, 80, 90], blendType: 1, zoomX: 200, zoomY: 50, angle: 45, opacity: 100 })],
    [], [effect(2, { tone: [0, 0, 0, 0] })],
  ]));
  const final = effectsAt(result, 2)[0];
  assert.deepEqual({ scaleX: final.scaleX, scaleY: final.scaleY, angle: final.angle, alpha: final.alpha,
    blend: final.blend, pipeline: final.pipeline, matrix: final.matrix, locked: final.locked, visible: final.visible },
  { scaleX: 1, scaleY: 1, angle: 0, alpha: 1, blend: 0, pipeline: 'default', matrix: null, locked: false, visible: true });
});

test('Pokemon duplicates retain the original create/destroy lifecycle', async () => {
  const user = effect(0, { target: 0 }), target = effect(0, { target: 1 });
  const result = await animationFixture(source).run(animation([[user, target, effect(0)], [], [user, target, effect(1)]]));
  assert.equal(result.metrics.actors, 4);
  assert.equal(result.metrics.effects, 1);
  assert.equal(result.leaks, 0);
});

test('aborting after effects enter the pool cleans up and restores original sprites', async () => {
  const fixture = animationFixture(source, { abortAt: 2 });
  const result = await fixture.run(animation([[effect(0), effect(1)], [], [effect(2)]]));
  assert.equal(result.error, 'test abort');
  assert.equal(result.leaks, 0);
  assert.equal(result.running, false);
  assert.ok(result.final.every(o => o.originalVisible));
});

test('missing graphic frames still fall back to frame 0 after reuse', async () => {
  const result = await animationFixture(source, { missingFrames: [999] }).run(animation([[effect(2)], [], [effect(999)]]));
  assert.equal(effectsAt(result, 2)[0].frame, 0);
  assert.equal(result.diagnostics.length, 1);
  assert.match(result.diagnostics[0], /Missing graphic frame 999/);
});

test('fast sweep and disabled animations retain their wait and cleanup behavior', async () => {
  const fixture = animationFixture(source);
  const result = await fixture.run(animation([[effect(0)], [], [effect(1)]]), { frameMs: 0 });
  assert.deepEqual(result.waits, [17]);
  assert.equal(result.metrics.effects, 1);
  assert.equal(result.leaks, 0);
  fixture.player.enabled = false;
  const disabled = await fixture.run(animation([[effect(0)]]));
  assert.deepEqual(disabled.waits, []);
  assert.equal(disabled.metrics.effects, 1, 'disabled play allocates nothing');
});
