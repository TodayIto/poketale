// from pokerogue src/ui/text.ts (getTextColor isLegacyTheme branch) @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/ui/ui-theme.ts (addWindow borders, legacy images) @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/scene-base.ts (loadImage: images/ui -> images/ui/legacy) @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-10-30. See view/LICENSE-NOTE.md.

export const THEMES = Object.freeze(['plugin', 'legacy', 'default']);
export const DEFAULT_THEME = 'plugin';

// Validates the theme creation option. Missing -> default, unknown value -> TypeError
export function checkTheme(theme) {
  if (theme === undefined || theme === null) return DEFAULT_THEME;
  if (!THEMES.includes(theme)) throw new TypeError(`Unknown theme: ${theme} (${THEMES.join(' | ')})`);
  return theme;
}

export const themeOf = scene => scene?.options?.theme ?? DEFAULT_THEME;

export const usesLegacyArt = theme => theme !== 'default';

const WHITE = '#f8fbfd', SKY = '#eaf4fb', SKY2 = '#dbe8f2', LINE = '#a9c2d4', LINE2 = '#789db7';
const BORDER = '#315a77', NAVY = '#23435f', SHADE = '#c8d8e4', ACCENT = '#d8434d', CURSOR = '#14304a';

const COLORS = {
  WINDOW: { plugin: [NAVY, SHADE], default: ['#f8f8f8', '#6b5a73'], legacy: ['#484848', '#d0d0c8'] },
  WINDOW_ALT: { plugin: [NAVY, SHADE] },
  MESSAGE: { plugin: [NAVY, SHADE], default: ['#f8f8f8', '#6b5a73'], legacy: ['#f8f8f8', '#6b5a73'] },

  MESSAGE_NOTE: { plugin: [LINE2, SKY2], default: ['#a0a0a0', '#636363'], legacy: ['#3a3a3a', '#8fb8b4'] },

  ABILITY_BAR: { plugin: ['#f8f8f8', NAVY], default: ['#f8f8f8', '#6b5a73'], legacy: ['#f8f8f8', '#6b5a73'] },
  BATTLE_INFO: { plugin: [NAVY, SHADE], default: ['#f8f8f8', '#6b5a73'], legacy: ['#404040', '#ded6b5'] },
  MOVE_PP_HALF_FULL: { plugin: ['#a68e17', '#ebd773'], default: ['#ccbe00', '#6e672c'], legacy: ['#a68e17', '#ebd773'] },
  MOVE_PP_NEAR_EMPTY: { plugin: ['#d64b00', '#f7b18b'], default: ['#d64b00', '#69402a'], legacy: ['#d64b00', '#f7b18b'] },
  MOVE_PP_EMPTY: { plugin: ['#e13d3d', '#fca2a2'], default: ['#e13d3d', '#632929'], legacy: ['#e13d3d', '#fca2a2'] },
  SUMMARY_ALT: { plugin: ['#f8f8f8', '#636363'], default: ['#484848', '#d0d0c8'], legacy: ['#f8f8f8', '#636363'] },
};

export function themeColors(scene, style) {
  return COLORS[style]?.[themeOf(scene)] ?? null;
}

export function applyTheme(text, scene, style) {
  const colors = themeColors(scene, style);
  if (!colors) return text;
  text.setColor(colors[0]);
  text.setShadow?.(text.style?.shadowOffsetX ?? 3, text.style?.shadowOffsetY ?? 3, colors[1]);
  return text;
}

export const windowBorder = scene => (usesLegacyArt(themeOf(scene)) ? 6 : 8);

const PLUGIN_ART = [

  [['windows/window_1.png', 'windows/window_1_thin.png', 'windows/window_1_xthin.png'], {
    '#f8f8f8': WHITE, '#d8d0d8': SKY2, '#a8b8a8': LINE, '#8888c8': LINE2, '#706880': BORDER, '#484868': NAVY, '#283030': NAVY,
  }],

  [['bg.png'], {
    '#68a0a0': WHITE, '#808888': SKY2, '#d04838': BORDER, '#a86860': LINE2, '#984860': BORDER, '#684058': NAVY, '#484050': NAVY,
  }],

  // HP windows (HP bar pixels #ffffff, #4a425a stay)
  [['pbinfo_player.png', 'pbinfo_player_stats.png', 'pbinfo_enemy_mini.png', 'pbinfo_enemy_mini_stats.png', 'pbinfo_player_mini.png', 'pbinfo_player_mini_stats.png'], {
    '#ffffde': WHITE, '#ded6b5': SKY2, '#d6cebd': SHADE, '#c6bd73': LINE, '#7b9484': LINE2, '#526b63': BORDER, '#526b5a': BORDER,
    '#395242': NAVY, '#213900': NAVY,
  }],

  [['numbers.png', 'numbers_red.png', 'pbinfo_stat_numbers.png', 'text_images/ko/battle_ui/overlay_lv_ko.png',
    'text_images/ko/battle_ui/pbinfo_stat_ko.png', 'text_images/ko/battle_ui/overlay_hp_label_ko.png',
    'text_images/ko/battle_ui/overlay_exp_label_ko.png'], {
    '#424242': NAVY, '#404040': NAVY, '#ded6b5': SHADE, '#d6cebd': SHADE, '#526b5a': BORDER, '#c6bd73': LINE,
  }],

  [['ability_bar_left.png', 'ability_bar_right.png', 'party_exp_bar.png'], {
    '#524a5a': BORDER, '#7b7383': LINE2, '#393141': NAVY, '#290841': NAVY, '#f8f8d8': WHITE, '#d8d0b0': SKY2,
  }],

  [['cursor.png', 'cursor_tera.png'], { '#484848': CURSOR, '#d0d0c8': SHADE }],
  [['prompt.png'], { '#e00808': ACCENT, '#606060': SHADE }],

  [['party_bg.png', 'party_bg_double.png'], {
    '#e0e888': WHITE, '#c8d078': SKY, '#b0b058': SKY2, '#889828': LINE2, '#605800': BORDER, '#484860': NAVY,
  }],
  [['party_slot.png', 'party_slot_main.png'], { '#484860': NAVY }],
  [['party_cancel.png'], { '#7058b0': BORDER, '#a070f0': LINE2, '#484860': NAVY }],

  [['summary_bg.png'], { '#006860': NAVY, '#484038': NAVY }],
  [['summary_profile.png', 'summary_stats.png', 'summary_moves.png', 'summary_moves_effect.png', 'summary_moves_overlay_row.png',
    'summary_status.png', 'text_images/ko/summary/summary_tabs_1_ko.png', 'text_images/ko/summary/summary_tabs_2_ko.png',
    'text_images/ko/summary/summary_tabs_3_ko.png'], {
    '#f0f8f8': WHITE, '#f0f8e8': WHITE, '#f0f8f0': WHITE, '#f7fff7': WHITE, '#484038': NAVY,
  }],
  [['text_images/ko/summary/summary_moves_overlay_pp_ko.png'], { '#484848': NAVY, '#d0d0c8': SHADE }],
];

const rgb = hex => parseInt(hex.slice(1), 16);
const ART_PALETTES = new Map();
for (const [files, map] of PLUGIN_ART) {
  for (const file of files) {
    const palette = ART_PALETTES.get(file) ?? new Map();
    for (const [from, to] of Object.entries(map)) if (!palette.has(rgb(from))) palette.set(rgb(from), rgb(to));
    ART_PALETTES.set(file, palette);
  }
}

export function artPalette(theme, path) {
  if (theme !== 'plugin' || !path.startsWith('images/ui/')) return null;
  return ART_PALETTES.get(path.slice('images/ui/'.length)) ?? null;
}

export function recolorPixels(data, palette) {
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] !== 255) continue;
    const to = palette.get((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
    if (to === undefined) continue;
    data[i] = to >> 16; data[i + 1] = (to >> 8) & 255; data[i + 2] = to & 255;
  }
  return data;
}
