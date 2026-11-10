// from pokerogue src/ui/text.ts @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-11-10. See view/LICENSE-NOTE.md.
// from pokerogue src/ui/handlers/summary-ui-handler.ts (getStatKey order) @ 7d7da4a8 (AGPL-3.0-only)

import { loadFont as loadEmbeddedFont } from '../fonts.js';
import { themeColors } from './theme.js';
import { STATS } from '../../engine/mon.mjs';
import { GENDER_MARK_BATTLE, markRuns, markSize } from '../gender-mark.js';

export const FONT_FAMILY = 'BattleViewEmerald, sans-serif';

export function addTextObject(scene, x, y, content, style = 'message', extra = {}) {
  const info = style === 'info';
  const [color, shadow] = themeColors(scene, info ? 'BATTLE_INFO' : 'MESSAGE');
  return scene.add.text(x, y, content, {
    fontFamily: FONT_FAMILY, fontSize: info ? 72 : 96,
    color, padding: { bottom: 6 }, ...extra,
  }).setScale(1 / 6).setShadow(info ? 3.5 : 4, info ? 3.5 : 5, shadow);
}

export const GENDER_COLORS = Object.freeze({ M: ['#40c8f8', '#006090'], F: ['#f89890', '#984038'] });

export const STATUS_FRAMES = Object.freeze({ brn: 'burn', par: 'paralysis', slp: 'sleep', frz: 'freeze', psn: 'poison', tox: 'toxic' });

const STAT_KEYS = Object.freeze({ hp: 'hp', atk: 'atk', def: 'def', spa: 'spatk', spd: 'spdef', spe: 'spd' });
export const STAT_ROWS = Object.freeze(STATS.map(stat => [stat, `pokemon-info.stat.${STAT_KEYS[stat]}`]));

const style = (color, shadow, sx, sy, more = {}) => ({ color, shadow, sx, sy, ...more });
const STYLES = {
  WINDOW: style('#f8f8f8', '#6b5a73', 3, 3), WINDOW_ALT: style('#484848', '#d0d0c8', 3, 3),

  WINDOW_WHITE: style('#f8f8f8', '#6b5a73', 3, 3, { theme: 'MESSAGE' }),
  SUMMARY: style('#f8f8f8', '#636363', 4, 5), SUMMARY_HEADER: style('#f8f8f8', '#636363', 4, 5), SUMMARY_DEX_NUM: style('#f8f8f8', '#636363', 5, 5),
  SUMMARY_ALT: style('#484848', '#d0d0c8', 3, 3), SUMMARY_PINK: style(...GENDER_COLORS.F, 3, 3), SUMMARY_BLUE: style(...GENDER_COLORS.M, 3, 3),

  SUMMARY_STATS: style('#f8f8f8', '#636363', 5, 5), SUMMARY_STATS_PINK: style(...GENDER_COLORS.F, 5, 5), SUMMARY_STATS_BLUE: style(...GENDER_COLORS.M, 5, 5),
  SUMMARY_STATS_GOLD: style('#e8e8a8', '#a0a060', 5, 5), SUMMARY_RED: style('#e70808', '#ffbd73', 3, 3), SUMMARY_DEX_NUM_GOLD: style('#e8e8a8', '#a0a060', 5, 5),
  GENDER_M: style(...GENDER_COLORS.M, 4, 5), GENDER_F: style(...GENDER_COLORS.F, 4, 5),

  MOVE_INFO_CONTENT: style('#f8f8f8', '#6b5a73', 3, 3, { size: 56, theme: 'WINDOW' }),

  PARTY: style('#f8f8f8', '#707070', 4, 5, { size: 48, padding: { top: 2, bottom: 16 }, lineSpacing: 0 }),

  TOOLTIP_CONTENT: style('#f8f8f8', '#6b5a73', 4, 5, { size: 64, theme: 'WINDOW', lineSpacing: 0 }),
  SETTINGS_LABEL: style('#f8b050', '#c07800', 3, 3, { size: 92, lineSpacing: 0 }),
};

export function styledText(scene, x, y, str, name, extra = {}) {
  const s = STYLES[name];
  if (!s) throw new Error(`Unknown text style: ${name}`);
  const [color, shadow] = (s.theme !== null && themeColors(scene, s.theme ?? name)) || [s.color, s.shadow];
  const { lineSpacing = s.lineSpacing ?? 5, ...rest } = extra;
  const text = scene.add.text(x, y, str, { fontFamily: FONT_FAMILY, fontSize: s.size ?? 96, color, padding: s.padding ?? { bottom: 6 }, ...rest })
    .setScale(1 / 6).setShadow(s.sx, s.sy, shadow);
  return lineSpacing ? text.setLineSpacing(lineSpacing) : text;
}

export const pad2 = n => (String(n).length < 2 ? `  ${n}` : String(n));

export const windowText = (scene, x, y, str, extra) => styledText(scene, x, y, str, 'WINDOW', extra);

export const loadFont = assetBase => loadEmbeddedFont('BattleViewEmerald', `${assetBase}fonts/pokemon-emerald-pro.ttf`);

const FONT_ASCENT = 0.75, FONT_LINE = 0.875, FONT_PIXELS = 16;

function styleOf(scene, name) {
  if (name === 'info' || name === 'message') {
    const info = name === 'info';
    const [color, shadow] = themeColors(scene, info ? 'BATTLE_INFO' : 'MESSAGE');
    return { size: info ? 72 : 96, padding: { bottom: 6 }, sx: info ? 3.5 : 4, sy: info ? 3.5 : 5, color, shadow };
  }
  const s = STYLES[name];
  if (!s) throw new Error(`Unknown text style: ${name}`);
  const [color, shadow] = (s.theme !== null && themeColors(scene, s.theme ?? name)) || [s.color, s.shadow];
  return { size: s.size ?? 96, padding: s.padding ?? { bottom: 6 }, sx: s.sx, sy: s.sy, color, shadow };
}

function markTexture(scene, gender) {
  const key = `gender-mark-${gender}`;
  if (scene.textures.exists(key)) return key;
  const { w, h } = markSize(gender, GENDER_MARK_BATTLE);
  const canvas = scene.textures.createCanvas(key, w, h);
  const ctx = canvas.getContext();
  ctx.fillStyle = '#ffffff';
  for (const run of markRuns(gender, GENDER_MARK_BATTLE)) ctx.fillRect(run.x, run.y, run.w, 1);
  canvas.refresh();
  return key;
}

const tintOf = color => parseInt(String(color).replace('#', ''), 16);

export function addGenderMark(scene, x, y, gender, name, { originY = 0, color, shadow } = {}) {
  if (!GENDER_MARK_BATTLE[gender]) return null;
  const st = styleOf(scene, name);
  const top = st.padding.top ?? 0, height = st.size * FONT_LINE + top + (st.padding.bottom ?? 0);
  const baseline = Math.floor(y) + (top + st.size * FONT_ASCENT - originY * height) / 6;
  const pixel = st.size / FONT_PIXELS / 6;
  const { w, h } = markSize(gender, GENDER_MARK_BATTLE), key = markTexture(scene, gender);
  const layer = (dx, dy, tint) => scene.add.container(dx, dy).add(scene.add.image(0, 0, key).setOrigin(0).setScale(pixel).setTint(tintOf(tint)));
  const mark = scene.add.container(Math.floor(x), baseline - h * pixel);
  mark.add([layer(st.sx / 6, st.sy / 6, shadow ?? st.shadow), layer(0, 0, color ?? st.color)]);
  return mark.setSize(w * pixel, h * pixel);
}
