// from pokerogue src/pipelines/glsl/sprite-frag-shader.frag @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/pipelines/sprite.ts @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/phases/tera-phase.ts @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/ui/battle-info/battle-info.ts @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/data/type.ts @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-10-28. See view/LICENSE-NOTE.md.

import Phaser from 'phaser';

export const MEGA_TERA_IMAGES = {
  button_tera: 'images/ui/button_tera.png', cursor_tera: 'images/ui/cursor_tera.png', icon_tera: 'images/ui/icon_tera.png',
  tera: 'images/effects/tera.png', mega_bracelet: 'images/items/mega_bracelet.png',
};

export const TYPE_RGB = {
  normal: [168, 168, 120], fighting: [192, 48, 40], flying: [168, 144, 240], poison: [160, 64, 160], ground: [224, 192, 104],
  rock: [184, 160, 56], bug: [168, 184, 32], ghost: [112, 88, 152], steel: [184, 184, 208], fire: [240, 128, 48],
  water: [104, 144, 240], grass: [120, 200, 80], electric: [248, 208, 48], psychic: [248, 88, 136], ice: [152, 216, 216],
  dragon: [112, 56, 248], dark: [112, 88, 72], fairy: [232, 136, 200], stellar: [255, 255, 255],
};
export const typeRgb = type => TYPE_RGB[String(type ?? '').toLowerCase()] ?? [0, 0, 0];

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uMainSampler;
uniform sampler2D uTeraSampler;
uniform vec2 uResolution;
uniform vec2 uOrigin;
uniform vec2 uAxisX;
uniform vec2 uAxisY;
uniform float fieldScale;
uniform float teraTime;
uniform vec3 teraColor;
varying vec2 outTexCoord;

float blendOverlay(float base, float blend) {
  return base<0.5?(2.0*base*blend):(1.0-2.0*(1.0-base)*(1.0-blend));
}
vec3 blendOverlay(vec3 base, vec3 blend) {
  return vec3(blendOverlay(base.r,blend.r),blendOverlay(base.g,blend.g),blendOverlay(base.b,blend.b));
}
float hue2rgb(float f1, float f2, float hue) {
  if (hue < 0.0) hue += 1.0;
  else if (hue > 1.0) hue -= 1.0;
  float res;
  if ((6.0 * hue) < 1.0) res = f1 + (f2 - f1) * 6.0 * hue;
  else if ((2.0 * hue) < 1.0) res = f2;
  else if ((3.0 * hue) < 2.0) res = f1 + (f2 - f1) * ((2.0 / 3.0) - hue) * 6.0;
  else res = f1;
  return res;
}
vec3 rgb2hsl(vec3 color) {
  vec3 hsl;
  float fmin = min(min(color.r, color.g), color.b);
  float fmax = max(max(color.r, color.g), color.b);
  float delta = fmax - fmin;
  hsl.z = (fmax + fmin) / 2.0;
  if (delta == 0.0) {
    hsl.x = 0.0;
    hsl.y = 0.0;
  } else {
    if (hsl.z < 0.5) hsl.y = delta / (fmax + fmin);
    else hsl.y = delta / (2.0 - fmax - fmin);
    float deltaR = (((fmax - color.r) / 6.0) + (delta / 2.0)) / delta;
    float deltaG = (((fmax - color.g) / 6.0) + (delta / 2.0)) / delta;
    float deltaB = (((fmax - color.b) / 6.0) + (delta / 2.0)) / delta;
    if (color.r == fmax) hsl.x = deltaB - deltaG;
    else if (color.g == fmax) hsl.x = (1.0 / 3.0) + deltaR - deltaB;
    else if (color.b == fmax) hsl.x = (2.0 / 3.0) + deltaG - deltaR;
    if (hsl.x < 0.0) hsl.x += 1.0;
    else if (hsl.x > 1.0) hsl.x -= 1.0;
  }
  return hsl;
}
vec3 hsl2rgb(vec3 hsl) {
  vec3 rgb;
  if (hsl.y == 0.0) rgb = vec3(hsl.z);
  else {
    float f2;
    if (hsl.z < 0.5) f2 = hsl.z * (1.0 + hsl.y);
    else f2 = (hsl.z + hsl.y) - (hsl.y * hsl.z);
    float f1 = 2.0 * hsl.z - f2;
    rgb.r = hue2rgb(f1, f2, hsl.x + (1.0/3.0));
    rgb.g = hue2rgb(f1, f2, hsl.x);
    rgb.b = hue2rgb(f1, f2, hsl.x - (1.0/3.0));
  }
  return rgb;
}
vec3 blendHue(vec3 base, vec3 blend) {
  vec3 baseHSL = rgb2hsl(base);
  return hsl2rgb(vec3(rgb2hsl(blend).r, baseHSL.g, baseHSL.b));
}
vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  vec4 color = texture2D(uMainSampler, outTexCoord);
  if (color.a > 0.0 && all(lessThan(vec3(0.0), teraColor))) {
    // render target coordinates (0 at the bottom) → screen pixels → picture pixels (the source's relUv × size)
    vec2 screen = vec2(outTexCoord.x * uResolution.x, (1.0 - outTexCoord.y) * uResolution.y) - uOrigin;
    vec2 local = vec2(dot(screen, uAxisX), dot(screen, uAxisY));
    vec2 teraTexCoord = vec2(local.x / 200.0, local.y / 120.0);
    vec4 teraCol = texture2D(uTeraSampler, fract(teraTexCoord));
    color.rgb /= color.a;
    float floorValue = 86.0 / 255.0;
    vec3 teraPatternHsv = rgb2hsv(teraCol.rgb);
    teraCol.rgb = hsv2rgb(vec3((teraPatternHsv.b - floorValue) * 4.0 + teraTexCoord.x * fieldScale / 2.0 + teraTexCoord.y * fieldScale / 2.0 + teraTime * 255.0, teraPatternHsv.b, teraPatternHsv.b));

    color.rgb = mix(color.rgb, blendHue(color.rgb, teraColor), 0.625);
    teraCol.rgb = mix(teraCol.rgb, teraColor, 0.5);
    color.rgb = blendOverlay(color.rgb, teraCol.rgb);

    if (any(lessThan(teraColor.rgb, vec3(1.0)))) {
      vec3 teraColHsv = rgb2hsv(teraColor);
      color.rgb = mix(color.rgb, teraColor, (1.0 - teraColHsv.g) / 2.0);
    }
    color.rgb *= color.a;
  }
  gl_FragColor = color;
}`;

const PIPELINE = 'TeraFX';
let TeraFX;

function teraPipelineClass() {
  const Base = Phaser?.Renderer?.WebGL?.Pipelines?.PostFXPipeline;
  if (!Base) return null;
  return TeraFX ??= class extends Base {
    constructor(game) { super({ game, fragShader: FRAG }); this.teraColor = [0, 0, 0]; }
    onDraw(renderTarget) {
      const object = this.gameObject, texture = this.game.textures.get('tera');
      if (!object || !texture?.source?.[0]?.glTexture) { this.bindAndDraw(renderTarget); return; }

      const m = object.getWorldTransformMatrix();
      const origin = m.transformPoint(-object.displayOriginX, -object.displayOriginY);
      const det = m.a * m.d - m.b * m.c || 1;
      this.bind();
      this.set1i('uMainSampler', 0);
      this.set1i('uTeraSampler', 1);
      this.set2f('uResolution', renderTarget.width, renderTarget.height);
      this.set2f('uOrigin', origin.x, origin.y);
      this.set2f('uAxisX', m.d / det, -m.c / det);
      this.set2f('uAxisY', -m.b / det, m.a / det);
      this.set1f('fieldScale', 6);
      this.set1f('teraTime', (this.game.getTime() % 500000) / 500000);
      this.set3f('teraColor', ...this.teraColor.map(c => c / 255));
      this.bindTexture(texture.source[0].glTexture, 1);
      this.bindAndDraw(renderTarget);
    }
  };
}

export class TeraView {
  constructor(scene) { this.scene = scene; }
  preload() {
    return Promise.all(Object.entries(MEGA_TERA_IMAGES).map(([key, path]) => this.scene.assets.image(key, path)));
  }

  glow(object, type) {
    if (!object?.setPostPipeline) return;
    const pipelines = this.scene.renderer?.pipelines;
    const Class = teraPipelineClass();
    if (!pipelines || !Class) return;
    pipelines.addPostPipeline(PIPELINE, Class);
    object.removePostPipeline?.(PIPELINE);
    if (!type) return;
    object.setPostPipeline(PIPELINE);
    const instance = object.getPostPipeline(PIPELINE);
    for (const fx of [instance].flat()) fx.teraColor = typeRgb(type);
  }

  // When a PokemonSprite is created (appearance, form change) - glow if MonView.tera is set
  applySprite(pokemon) { if (pokemon.mon?.tera) this.glow(pokemon.getSprite(), pokemon.mon.tera); }

  applyInfo(info, type) {
    const scene = this.scene;
    if (!type) { info.teraIcon?.setVisible(false); return; }
    if (!info.teraIcon) {
      info.teraIcon = scene.add.sprite(0, 0, 'icon_tera').setOrigin(0).setScale(0.5);
      info.container.add(info.teraIcon);
    }
    const [r, g, b] = typeRgb(type);
    info.teraIcon.setVisible(true).setTintFill(Phaser.Display.Color.GetColor(r, g, b))
      .setPosition(info.nameText.x + info.nameText.displayWidth + info.genderText.displayWidth + 1, info.nameText.y + 2);
  }

  async terastallize(side, type) {
    const scene = this.scene;
    if (!TYPE_RGB[String(type ?? '').toLowerCase()]) throw new Error(`Invalid tera type: ${type}`);
    const pokemon = scene.requireMon(side);
    await scene.animations.playCommon('terastallize', side);
    const current = scene.pokemon[side] ?? pokemon;
    current.mon.tera = type;
    this.glow(current.getSprite(), type);
    const info = scene.info[side];
    if (info) { info.mon.tera = type; this.applyInfo(info, type); }
  }
}
