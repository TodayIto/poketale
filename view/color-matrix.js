// from pokerogue src/pipelines/field-sprite.ts (onBind uniforms, flush per object) @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-11-05. See view/LICENSE-NOTE.md.
// Apply a color matrix per sprite without shared render targets.

import Phaser from 'phaser';

export const COLOR_MATRIX_PIPELINE = 'SpriteColorMatrix';

export const BLACK = Object.freeze([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0]);

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uMainSampler;
uniform float uColorMatrix[20];
varying vec2 outTexCoord;
varying float outTintEffect;
varying vec4 outTint;

void main() {
  vec4 texture = texture2D(uMainSampler, outTexCoord);
  vec4 texel = vec4(outTint.bgr * outTint.a, outTint.a);
  vec4 c = texture * texel;
  if (outTintEffect == 1.0) c.rgb = mix(texture.rgb, outTint.bgr * outTint.a, texture.a);
  else if (outTintEffect == 2.0) c = texel;

  if (c.a > 0.0) c.rgb /= c.a;
  vec4 result;
  result.r = (uColorMatrix[0] * c.r) + (uColorMatrix[1] * c.g) + (uColorMatrix[2] * c.b) + (uColorMatrix[3] * c.a) + uColorMatrix[4];
  result.g = (uColorMatrix[5] * c.r) + (uColorMatrix[6] * c.g) + (uColorMatrix[7] * c.b) + (uColorMatrix[8] * c.a) + uColorMatrix[9];
  result.b = (uColorMatrix[10] * c.r) + (uColorMatrix[11] * c.g) + (uColorMatrix[12] * c.b) + (uColorMatrix[13] * c.a) + uColorMatrix[14];
  result.a = (uColorMatrix[15] * c.r) + (uColorMatrix[16] * c.g) + (uColorMatrix[17] * c.b) + (uColorMatrix[18] * c.a) + uColorMatrix[19];
  gl_FragColor = vec4(result.rgb * result.a, result.a);
}`;

let ColorMatrixPipeline;

function pipelineClass() {
  return ColorMatrixPipeline ??= class extends Phaser.Renderer.WebGL.Pipelines.SinglePipeline {
    constructor(game) { super({ game, fragShader: FRAG }); }

    onBind(gameObject) { super.onBind(); this.set1fv('uColorMatrix', gameObject.pipelineData.colorMatrix); }
    onBatch(gameObject) { if (gameObject) this.flush(); }
  };
}

export function rendererConfig() {
  return { disablePreFX: true, pipeline: { [COLOR_MATRIX_PIPELINE]: pipelineClass() } };
}

export const matrixData = matrix => Float32Array.from(matrix, (v, i) => (i % 5 === 4 ? v / 255 : v));

export function setColorMatrix(sprite, matrix) {
  if (!matrix) { sprite.resetPipeline(true); return sprite; }
  return sprite.setPipeline(COLOR_MATRIX_PIPELINE, { colorMatrix: matrixData(matrix) });
}
