import { createImageRoute, audioType } from '../../view/image-route.js';
import { viewPictureWays } from '../battle/picture-route.js';

const SOUND = 'audio/battle_anims/PRSFX- Health Up.wav';
const VOLUME = 0.6;

const LATE_MS = 1500;

function loadSound(url, route, fetchBytes) {
  const ways = createImageRoute({ ways: viewPictureWays(route), fetchBytes });
  const left = ways.order(url);
  const audio = new Audio();
  audio.crossOrigin = 'anonymous'; audio.preload = 'auto'; audio.volume = VOLUME;
  return new Promise(resolve => {
    const next = () => {
      const way = left.shift();
      if (way === 'direct') { audio.src = url; return; }
      if (way === 'host') { ways.objectUrl(url, () => audioType(url)).then(src => { audio.src = src; }, next); return; }
      audio.onerror = audio.oncanplaythrough = null;
      resolve(null);
    };
    audio.oncanplaythrough = () => resolve(audio);
    audio.onerror = next;
    next();
  });
}

export function createRestSound({ assetBase, settings, fetchBytes }) {
  const url = assetBase + SOUND;
  let made = null;
  return () => {
    const { sound, panelPicture } = settings();
    if (!sound) return;
    if (!made || made.route !== panelPicture) made = { route: panelPicture, ready: loadSound(url, panelPicture, fetchBytes) };
    const asked = Date.now();
    made.ready.then(audio => {
      if (!audio || Date.now() - asked > LATE_MS) return;
      audio.currentTime = 0;
      audio.play().catch(() => {});
    });
  };
}
