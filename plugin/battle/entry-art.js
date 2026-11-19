import { DEFAULT_ASSET_BASE } from '../../view/assets.js';
import { fieldAtlases, atlasJson, animFrames } from '../../view/field-atlases.js';
import { DEFAULT_TRAINER, SHOWDOWN_TRAINER_URL, showdownTrainerId, trainerKey, isEnemyTrainer } from '../../view/encounter.js';
import { createImageRoute, audioType } from '../../view/image-route.js';
import { LoadError } from '../../view/retry.js';
import { clearEdges } from './my-picture.js';
import { parseRecolorKey, recoloredCanvas, wholeFrame } from '../../view/sprites/recolor.js';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new LoadError(`그림을 받지 못함: ${src}`));
    img.src = src;
  });
}

const entryRoute = ({ fetchBytes, pictureWays }) => createImageRoute({ ways: pictureWays, fetchBytes });
const canvasOf = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });

async function pokerogueFrame(key, route) {
  const { trainers } = await fieldAtlases();
  const json = atlasJson(trainers[key]);
  const name = animFrames(json)[0] ?? json.frames[0].filename;
  const { frame, spriteSourceSize: at, sourceSize } = json.frames.find(f => f.filename === name);
  const img = await route.image(`${DEFAULT_ASSET_BASE}images/trainer/${key}.png`, loadImage);
  const full = canvasOf(sourceSize.w, sourceSize.h);
  full.getContext('2d').drawImage(img, frame.x, frame.y, frame.w, frame.h, at.x, at.y, frame.w, frame.h);
  const box = canvasOf(frame.w, frame.h);
  box.getContext('2d').drawImage(img, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);
  return { full, box };
}

async function showdownFrame(id, fetchBytes) {
  const url = URL.createObjectURL(new Blob([await fetchBytes(SHOWDOWN_TRAINER_URL(id))], { type: 'image/png' }));
  try {
    const img = await loadImage(url);
    const full = canvasOf(80, 80);
    full.getContext('2d').drawImage(img, Math.round((80 - img.width) / 2), 80 - img.height);
    const { data } = full.getContext('2d').getImageData(0, 0, 80, 80);
    let left = 80, top = 80, right = -1, bottom = -1;
    for (let y = 0; y < 80; y++) for (let x = 0; x < 80; x++) {
      if (!data[(y * 80 + x) * 4 + 3]) continue;
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    if (right < 0) return { full, box: full };
    const box = canvasOf(right - left + 1, bottom - top + 1);
    box.getContext('2d').drawImage(full, left, top, box.width, box.height, 0, 0, box.width, box.height);
    return { full, box };
  } finally { URL.revokeObjectURL(url); }
}

async function foeFrame(name, fetchBytes, route) {
  const id = showdownTrainerId(name);
  if (id) {
    try { return await showdownFrame(id, fetchBytes); } catch { return pokerogueFrame(DEFAULT_TRAINER, route); }
  }
  const { trainers } = await fieldAtlases();
  const { sprite, combo } = parseRecolorKey(name);
  if (combo && isEnemyTrainer(trainers, sprite)) {
    const { full, box } = await pokerogueFrame(sprite, route);
    return { full: recoloredCanvas(full, sprite, combo, wholeFrame(full.width, full.height)), box };
  }
  const key = trainerKey(name);
  return pokerogueFrame(isEnemyTrainer(trainers, key) ? key : DEFAULT_TRAINER, route);
}

async function playerFrame(name, route) {
  const key = trainerKey(name);
  const { full: figure } = await pokerogueFrame(key === 'f' || key.startsWith('trainer_f') ? 'player_f' : 'player_m', route);
  const full = canvasOf(Math.max(80, figure.width), Math.max(80, figure.height));
  full.getContext('2d').drawImage(figure, Math.round((full.width - figure.width) / 2), full.height - figure.height);
  return { full };
}

async function pictureFrame(image) {
  const img = await loadImage(image);
  const full = canvasOf(img.naturalWidth, img.naturalHeight);
  const g = full.getContext('2d');
  g.drawImage(img, 0, 0);
  full.className = clearEdges(g.getImageData(0, 0, full.width, full.height)) ? 'pic' : 'pic framed';
  return { full };
}

export function entryPictures(spec, { fetchBytes, wild = false, named = false, image = null, pictureWays, second = null } = {}) {
  if (wild) return Promise.resolve({ me: null, foe: null, foe2: null, named: null });
  const route = entryRoute({ fetchBytes, pictureWays });
  const foe = foeFrame(spec?.p2?.trainerSprite, fetchBytes, route).catch(() => null);
  const foe2 = second && !named ? foeFrame(second, fetchBytes, route).catch(() => null) : Promise.resolve(null);
  const me = named ? Promise.resolve(null) : (image ? pictureFrame(image) : playerFrame(spec?.p1?.trainerSprite, route)).catch(() => null);
  return Promise.all([me, foe, foe2]).then(([mine, theirs, beside]) => ({ me: mine?.full ?? null, foe: named ? null : theirs?.full ?? null,
    foe2: beside?.full ?? null, named: named ? theirs?.box ?? null : null }));
}

export function entryLevel({ volume, sound } = {}) {
  if (typeof volume?.levels === 'function') return () => volume.levels()?.sfx ?? 0;
  const fixed = sound === false ? 0 : volume?.sfx ?? 1;
  return () => fixed;
}

export function entrySound(path, { fetchBytes, pictureWays, level = () => 1 } = {}) {
  const audio = new Audio();
  audio.crossOrigin = 'anonymous'; audio.preload = 'auto';
  const url = `${DEFAULT_ASSET_BASE}audio/${path}`, route = entryRoute({ fetchBytes, pictureWays }), left = route.order(url);
  const next = () => {
    const way = left.shift();
    if (way === 'direct') audio.src = url;
    else if (way === 'host') route.objectUrl(url, () => audioType(url)).then(src => { audio.src = src; }, next);
  };
  audio.onerror = next;
  next();
  return () => {
    const now = Math.max(0, Math.min(1, level()));
    if (!now) return;
    audio.volume = 0.6 * now;
    audio.play().catch(() => {});
  };
}
