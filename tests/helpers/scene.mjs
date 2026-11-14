import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Alpha = require('phaser/src/gameobjects/components/Alpha.js');
const Transform = require('phaser/src/gameobjects/components/Transform.js');

// Keep Phaser's real alpha clamping/render flags and position setter semantics.
export function sceneFixture() {
  const images = [], containers = [], textures = new Map(), removed = [];
  return {
    images, containers, removed,
    textures: {
      createCanvas(key, width, height) {
        const ctx = { setTransform() {}, translate() {}, fill() {}, save() {}, restore() {} };
        const canvas = { width, height, getContext: () => ctx, refresh() {} };
        textures.set(key, canvas);
        return canvas;
      },
      exists: key => textures.has(key),
      remove(key) { removed.push(key); textures.delete(key); },
    },
    add: {
      container(x, y) {
        const container = {
          x, y, visible: true, list: [], destroyed: false,
          add(image) { this.list.push(image); return this; },
          setVisible(on) { this.visible = on; return this; },
          destroy() { this.destroyed = true; },
        };
        containers.push(container);
        return container;
      },
      image(x, y, key) {
        const image = {
          x, y, z: 0, w: 0, key, renderFlags: 15,
          _alpha: 1, _alphaTL: 1, _alphaTR: 1, _alphaBL: 1, _alphaBR: 1,
          calls: { position: 0, alpha: 0 },
          setOrigin(value) { this.origin = value; return this; },
          setScale(value) { this.scale = value; return this; },
          setPosition(...args) { this.calls.position++; return Transform.setPosition.apply(this, args); },
          setAlpha(...args) { this.calls.alpha++; return Alpha.setAlpha.apply(this, args); },
        };
        Object.defineProperty(image, 'alpha', Alpha.alpha);
        images.push(image);
        return image;
      },
    },
  };
}

export const sceneState = scene => ({
  containers: scene.containers.map(c => ({ x: c.x, y: c.y, visible: c.visible, destroyed: c.destroyed, order: c.list.map(i => scene.images.indexOf(i)) })),
  images: scene.images.map(i => ({ x: i.x, y: i.y, z: i.z, w: i.w, alpha: i.alpha,
    corners: [i._alphaTL, i._alphaTR, i._alphaBL, i._alphaBR], renderFlags: i.renderFlags, origin: i.origin, scale: i.scale })),
});

export const resetCalls = scene => { for (const image of scene.images) image.calls.position = image.calls.alpha = 0; };
export const calls = scene => scene.images.reduce((sum, image) => sum + image.calls.position + image.calls.alpha, 0);
