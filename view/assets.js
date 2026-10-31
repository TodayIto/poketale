import { VIEW_ATLASES, VIEW_LEGACY_ATLASES, LEGACY_UI, POKEMON_ICONS } from 'embedded:view';
import { POKEROGUE_BOXES } from 'embedded:pokerogue-boxes';
import { pokerogueReference } from './sprites/pokerogue-reference.js';
import { loadShowdown, hasFemaleSprite } from './sprites/showdown.js';
import { pokerogueGeometry, loadPokerogueStill } from './sprites/pokerogue.js';
import { iconFrame, iconAtlas } from './ui/party-icons.js';
import { biomeImages, biomeKey, DEFAULT_BIOME } from './arena.js';
import { fieldAtlases, atlasJson } from './field-atlases.js';
import { withRetry, timeLimit, LoadError, TimeoutError } from './retry.js';
import { checkTheme, usesLegacyArt, artPalette, recolorPixels } from './ui/theme.js';
import { langPath, langAtlasKey } from './lang-images.js';
import { isPlayerSide } from './positions.js';

export const DEFAULT_ASSET_BASE = 'https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/37789817134f881da0a038af21991ccc93a66372/';
export const UI_IMAGES = {
  pbinfo_player: 'images/ui/pbinfo_player.png', pbinfo_enemy_mini: 'images/ui/pbinfo_enemy_mini.png',
  overlay_hp: 'images/ui/overlay_hp.png', numbers: 'images/ui/numbers.png',
  overlay_lv: 'images/ui/text_images/ko/battle_ui/overlay_lv_ko.png',
  overlay_hp_label: 'images/ui/text_images/ko/battle_ui/overlay_hp_label_ko.png',
  statuses: 'images/statuses_ko.png', bg: 'images/ui/bg.png', pb: 'images/pb.png',
  window_1: 'images/ui/windows/window_1.png', prompt: 'images/ui/prompt.png',
  cursor: 'images/ui/cursor.png', types: 'images/types_ko.png', categories: 'images/categories.png',

  party_bg: 'images/ui/party_bg.png', party_slot_main: 'images/ui/party_slot_main.png', party_slot: 'images/ui/party_slot.png',
  party_pb: 'images/ui/party_pb.png', party_cancel: 'images/ui/party_cancel.png', party_slot_hp_bar: 'images/ui/party_slot_hp_bar.png',
  party_slot_hp_overlay: 'images/ui/party_slot_hp_overlay.png',
  party_slot_overlay_lv: 'images/ui/text_images/ko/party_ui/party_slot_overlay_lv_ko.png',
  party_slot_overlay_hp: 'images/ui/text_images/ko/party_ui/party_slot_overlay_hp_ko.png',
  shiny_star_small: 'images/ui/shiny_small.png',
};

export const DOUBLE_IMAGES = {
  pbinfo_player_mini: 'images/ui/pbinfo_player_mini.png', pbinfo_player_mini_stats: 'images/ui/pbinfo_player_mini_stats.png',
  party_bg_double: 'images/ui/party_bg_double.png',
};
const PR_SPECIES = { pikachu: '25', gyarados: '130' };

export const SHOWDOWN_TIMEOUT_MS = 20000;

export function themedPath(theme, path, legacy = LEGACY_UI) {
  if (!usesLegacyArt(theme) || !path.startsWith('images/ui/')) return path;
  const rest = path.slice('images/ui/'.length);
  return legacy.includes(rest) ? `images/ui/legacy/${rest}` : path;
}

export function prefetchImages({ assetBase = DEFAULT_ASSET_BASE, theme, biome, lang }) {
  const base = assetBase.endsWith('/') ? assetBase : assetBase + '/', themed = checkTheme(theme);
  const arena = biomeKey(biome) ?? DEFAULT_BIOME;
  return [...Object.values(UI_IMAGES), ...biomeImages(arena).map(([key]) => `images/arenas/${key}.png`)].map(path => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = base + themedPath(themed, langPath(path, lang));
    return img;
  });
}

function recolored(img, palette) {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width; canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  recolorPixels(pixels.data, palette);
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

export class Assets {
  constructor(scene, life, { fetchBytes, assetBase = DEFAULT_ASSET_BASE, spriteSource = 'showdown-ani', theme, lang }) {
    if (!['showdown-ani', 'pokerogue'].includes(spriteSource)) throw new Error(`Unknown spriteSource: ${spriteSource}`);
    this.scene = scene; this.life = life;
    this.theme = checkTheme(theme);
    this.lang = lang;

    this.fetchBytes = url => withRetry(() => timeLimit(fetchBytes(url), SHOWDOWN_TIMEOUT_MS,
      `Showdown timeout ${SHOWDOWN_TIMEOUT_MS / 1000}s: ${url}`, life.signal), { signal: life.signal });
    this.base = assetBase.endsWith('/') ? assetBase : assetBase + '/';
    this.source = spriteSource; this.pending = new Map(); this.mons = new Map(); this.diagnostics = [];
  }
  url(path) { return this.base + path; }

  loadImage(src) { return withRetry(() => this.loadImageOnce(src), { signal: this.life.signal }); }
  loadImageOnce(src) {
    return new Promise((resolve, reject) => {
      this.life.check();
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const clean = () => { clearTimeout(timer); img.onload = img.onerror = null; this.life.signal.removeEventListener('abort', abort); };
      const abort = () => { clean(); img.src = ''; reject(this.life.signal.reason); };
      const timer = setTimeout(() => { clean(); img.src = ''; reject(new TimeoutError(`Image timeout: ${src}`)); }, 30000);
      img.onload = () => { clean(); resolve(img); };
      img.onerror = () => { clean(); reject(new LoadError(`Image load failed: ${src}`)); };
      this.life.signal.addEventListener('abort', abort, { once: true });
      img.src = src;
    });
  }
  image(key, path, atlas = VIEW_ATLASES[langAtlasKey(key, this.lang)] ?? VIEW_ATLASES[key]) {
    if (this.scene.textures.exists(key)) return Promise.resolve();

    const palette = artPalette(this.theme, path);
    path = langPath(path, this.lang);
    const themed = themedPath(this.theme, path);
    if (themed !== path) { path = themed; atlas = VIEW_LEGACY_ATLASES[langAtlasKey(key, this.lang)] ?? VIEW_LEGACY_ATLASES[key] ?? atlas; }
    if (!this.pending.has(key)) {
      const promise = this.loadImage(this.url(path)).then(loaded => {
        this.life.check();
        const img = palette ? recolored(loaded, palette) : loaded;
        if (atlas) this.scene.textures.addAtlas(key, img, atlas);
        else this.scene.textures.addImage(key, img);
      }).catch(e => { this.pending.delete(key); throw e; });
      this.pending.set(key, promise);
    }
    return this.pending.get(key);
  }

  monKey(mon, back) {
    const female = this.source === 'showdown-ani' && hasFemaleSprite(mon, back) ? '-f' : '';
    return `${this.source}:${mon.spriteId}${female}:${back ? 'back' : 'front'}:${!!mon.shiny}`;
  }
  mon(mon, back) {
    const key = this.monKey(mon, back);
    if (!this.mons.has(key)) {
      const promise = (async () => {
        if (this.source === 'showdown-ani') {
          const reference = pokerogueReference(mon, back ? 'player' : 'enemy', POKEROGUE_BOXES);
          try {
            return { ...await loadShowdown(this, mon, back, key), pokerogue: reference };
          } catch (error) {

            this.life.check();
            if (!(error instanceof LoadError) || !reference) throw error;
            this.diagnostics.push({ sprite: mon.spriteId, back, showdownFailed: error.message });
            return await loadPokerogueStill(this, mon, back, key, reference);
          }
        }
        const id = PR_SPECIES[mon.speciesId];
        if (!id) throw new Error(`PokeRogue atlas not embedded: ${mon.speciesId}`);
        const path = `images/pokemon/${back ? 'back/' : ''}${mon.shiny ? 'shiny/' : ''}${id}`;
        const atlas = VIEW_ATLASES[path];
        if (!atlas) throw new Error(`PokeRogue atlas not embedded: ${path}`);
        await this.image(key, path + '.png', atlas);
        this.life.check();
        const frames = this.scene.textures.get(key).getFrameNames().sort();
        this.scene.anims.create({ key, frames: frames.map(frame => ({ key, frame })), frameRate: 10, repeat: -1 });
        const geometry = pokerogueGeometry(this.scene.textures.get(key).getSourceImage(), atlas);
        this.diagnostics.push({ sprite: mon.spriteId, back, url: this.url(path + '.png'), frames: frames.length, ...geometry });
        return { key, frame: frames[0], ...geometry, source: 'pokerogue' };
      })().catch(e => { this.mons.delete(key); throw e; });
      this.mons.set(key, promise);
    }
    return this.mons.get(key);
  }

  async icon(mon) {
    const frame = iconFrame(mon, POKEMON_ICONS);
    const key = `pokemon_icons_${POKEMON_ICONS[frame][0]}`;
    await this.image(key, `images/${key}.png`, iconAtlas(POKEMON_ICONS[frame][0], POKEMON_ICONS));
    return { key, frame };
  }

  async preload(mons, biome, double = false) {
    if (!/^[a-z0-9_]+$/.test(biome)) throw new Error(`Invalid biome: ${biome}`);
    await Promise.all([
      ...Object.entries({ ...UI_IMAGES, ...(double ? DOUBLE_IMAGES : {}) }).map(([key, path]) => this.image(key, path)),

      ...biomeImages(biome).map(async ([key, animated]) => this.image(key, `images/arenas/${key}.png`, animated ? atlasJson((await fieldAtlases()).arenas[key]) : null)),
      ...mons.flatMap(mon => [...(mon.side ? [isPlayerSide(mon.side)] : [true, false]).map(back => this.mon(mon, back)), this.icon(mon)]),
    ]);
    this.life.check();
  }
}
