// from pokerogue src/battle.ts (getBgmOverride) @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/data/trainers/trainer-config.ts (battleBgm / victoryBgm defaults) @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-10-28. See view/LICENSE-NOTE.md.

import BGM from '../data/bgm.json' with { type: 'json' };
import { biomeKey } from './arena.js';

export const BGM_FILES = new Set(BGM.files);

export function bgmKey(name) {
  if (typeof name !== 'string') return null;
  const key = name.trim().replace(/\.mp3$/i, '');
  return BGM_FILES.has(key) ? key : null;
}

export function loopPoint(key) { return BGM.loopPoints[key] ?? 0; }

export function battleMusic({ wild = true, bgm, enemies = [], biome } = {}) {
  if (bgm != null) {
    const key = bgmKey(bgm);
    if (key) return { key };
  }
  const unknown = bgm != null ? String(bgm) : undefined;
  if (!wild) return { key: 'battle_trainer', unknown };
  for (const id of enemies) if (BGM.legendary[id]) return { key: BGM.legendary[id], unknown };
  const area = biomeKey(biome);
  if (area && area !== 'town' && BGM_FILES.has(area)) return { key: area, unknown };
  return { key: 'battle_wild', unknown };
}

export function victoryMusic({ wild = true, victoryBgm } = {}) {
  if (wild) return null;
  return bgmKey(victoryBgm) ?? 'bw/victory_trainer';
}
