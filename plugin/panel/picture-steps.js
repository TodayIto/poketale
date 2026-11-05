// Ordered image sources for panel pictures.
import { POKEROGUE_BOXES } from 'embedded:pokerogue-boxes';
import { DEFAULT_ASSET_BASE } from '../../view/assets.js';
import { pokerogueReference } from '../../view/sprites/pokerogue-reference.js';
import { pokerogueSheetPath, pokerogueStillCanvas } from '../../view/sprites/pokerogue.js';
import { LoadError } from '../../view/retry.js';

function image(src, cors) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (cors) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new LoadError(`그림을 받지 못함: ${src}`));
    img.src = src;
  });
}

export const probeImage = url => image(url, false);

export async function pokerogueStillUrl(slot) {
  const mon = { spriteId: slot.spriteId, shiny: slot.shiny };
  const reference = pokerogueReference(mon, 'enemy', POKEROGUE_BOXES);
  if (!reference) throw new LoadError(`PokeRogue 그림 없음: ${slot.spriteId}`);
  const img = await image(DEFAULT_ASSET_BASE + pokerogueSheetPath(mon, false, reference), true);
  return pokerogueStillCanvas(img, mon, false, reference).toDataURL('image/png');
}
