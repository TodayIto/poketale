import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mountScene } from '../view/scene-bake.js';
import { sceneFixture, sceneState, resetCalls, calls } from './helpers/scene.mjs';

const oldPath = globalThis.Path2D;
globalThis.Path2D = class {};
after(() => { if (oldPath === undefined) delete globalThis.Path2D; else globalThis.Path2D = oldPath; });

const path = '<path fill="#ffffff" d="M2 4h4v4h-4z"/>';
const svg = inner => `<svg viewBox="0 0 20 20">${inner}</svg>`;
function mount(t, inner) {
  t.mock.method(performance, 'now', () => 0);
  const scene = sceneFixture();
  const handle = mountScene(scene, svg(inner));
  resetCalls(scene);
  return { scene, handle, image: scene.images[0] };
}

test('unchanged stepped frames perform no redundant position or alpha writes', t => {
  const { scene, handle, image } = mount(t, `<g style="animation:pkbX 2s steps(4) infinite alternate;--dx:8px;">${path}</g>`);
  for (let i = 0; i < 1000; i++) handle.update(0.1);
  assert.equal(calls(scene), 0);
  for (const [time, x] of [[0, 2], [0.49, 2], [0.5, 4], [0.99, 4], [1, 6], [1.5, 8], [1.999, 8], [2, 10], [2.5, 8], [4, 2]]) {
    handle.update(time);
    assert.deepEqual([image.x, image.y, image.alpha], [x, 4, 1]);
  }
  assert.equal(image.calls.position, 6);
  assert.equal(image.calls.alpha, 0);
});

test('opacity changes preserve inherited alpha, all corners, and Phaser render flags', t => {
  const { handle, image } = mount(t, `<g style="opacity:0.5"><g style="opacity:0.8;animation:pkbA 2s steps(1) infinite">${path}</g></g>`);
  for (const [time, alpha] of [[0, 0.4], [0.9, 0.4], [1, 0], [1.9, 0], [2, 0.4]]) {
    handle.update(time);
    assert.equal(image.alpha, alpha);
    assert.deepEqual([image._alphaTL, image._alphaTR, image._alphaBL, image._alphaBR], [alpha, alpha, alpha, alpha]);
    assert.equal(image.renderFlags & 2, alpha ? 2 : 0);
  }
  assert.equal(image.calls.position, 0);
  assert.equal(image.calls.alpha, 2);
});

test('continuous fading and backward time retain the original interpolation', t => {
  const { handle, image } = mount(t, `<g style="animation:pkbF 1s infinite alternate">${path}</g>`);
  for (const [time, alpha] of [[0, 0.3], [0.5, 0.575], [1, 0.85], [1.5, 0.575], [2, 0.3], [0.5, 0.575]]) {
    handle.update(time);
    assert.ok(Math.abs(image.alpha - alpha) < 1e-12);
  }
  assert.equal(image.calls.position, 0);
  assert.equal(image.calls.alpha, 5);
});

test('nested movement preserves the base offset, delays, and repeated timestamps', t => {
  const { scene, handle, image } = mount(t, `<g transform="translate(4 6)" style="animation:pkbX 2s steps(4) infinite;--dx:8px;">`
    + `<g style="animation:pkbY 2s 1s steps(4) infinite;--a:2px;--b:10px;">${path}</g></g>`);
  handle.update(1);
  assert.deepEqual([image.x, image.y], [10, 12]);
  resetCalls(scene);
  handle.update(1);
  assert.equal(calls(scene), 0);
  handle.update(1.5);
  assert.deepEqual([image.x, image.y], [12, 14]);
});

test('comparing live values repairs externally changed position and alpha', t => {
  const { handle, image } = mount(t, `<g style="animation:pkbX 2s steps(4) infinite;--dx:8px;">${path}</g>`);
  image.x = -100;
  image.y = -100;
  image.setAlpha(0);
  handle.update(0);
  assert.deepEqual([image.x, image.y, image.alpha, image.renderFlags & 2], [2, 4, 1, 2]);
});

test('visibility changes retain animation phase and texture cleanup stays idempotent', t => {
  const { scene, handle, image } = mount(t, `<g style="animation:pkbX 2s steps(4) infinite;--dx:8px;">${path}</g>`);
  handle.setVisible(false);
  handle.update(1);
  assert.equal(image.x, 6);
  assert.equal(handle.back.visible, false);
  handle.setVisible(true);
  assert.equal(handle.back.visible, true);
  assert.equal(image.x, 6);
  const count = handle.keys.length;
  handle.destroy();
  const state = sceneState(scene), written = calls(scene);
  handle.update(1.5);
  handle.setVisible(false);
  handle.destroy();
  assert.deepEqual(sceneState(scene), state);
  assert.equal(calls(scene), written);
  assert.equal(scene.removed.length, count);
});

test('static scenes allocate no animated updates', t => {
  const { scene, handle } = mount(t, path);
  const state = sceneState(scene);
  for (let i = 0; i < 60; i++) handle.update(i);
  assert.deepEqual(sceneState(scene), state);
  assert.equal(calls(scene), 0);
});
