import { UI_IMAGES } from './assets.js';
import { loadFont } from './ui/text.js';
import { BattleMessage } from './ui/message.js';
import { SummaryScreen } from './ui/summary.js';
import { showPartyBackdrop } from './ui/party.js';

export async function prepareOutside(scene, { mons = [] } = {}) {
  await Promise.all([
    ...Object.entries(UI_IMAGES).map(([key, path]) => scene.assets.image(key, path)),
    loadFont(scene.assets.base), scene.audio.preload(mons), scene.levels.preload(),
    ...mons.map(mon => scene.assets.mon(mon, false)),
  ]);
  scene.life.check();
  scene.cameras?.main?.setBackgroundColor?.('#000000');
  if (!scene.messages) scene.messages = new BattleMessage(scene, scene.options.parent, scene.life);
  scene.messages.bg.setVisible(false); scene.messages.container.setVisible(false);
  scene.outside = true;
}

export function showSummary(scene, slot, { rename, onOpen } = {}) {
  if (!scene.messages) throw new Error('Call prepareOutside before showSummary');
  if (!slot?.summary) throw new Error('showSummary needs a slot with summary');
  const screen = scene.summaryScreen ??= new SummaryScreen(scene);
  return screen.show({ party: [slot], index: 0, rename, onOpen });
}

// Party screen backdrop (party = MonView[] 1-6, cursor = slot of the mon learning). Error if already shown
export async function startPartyScene(scene, { party, cursor = 0 } = {}) {
  if (!scene.messages) throw new Error('Call prepareOutside before startPartyScene');
  if (scene.partyBackdrop) throw new Error('Party scene already open');
  scene.partyBackdrop = true;
  try { scene.partyBackdrop = await showPartyBackdrop(scene, { party, cursor }); }
  catch (error) { scene.partyBackdrop = null; throw error; }
}

export async function endPartyScene(scene) {
  const backdrop = scene.partyBackdrop;
  scene.partyBackdrop = null;
  if (backdrop && backdrop !== true) await backdrop.close();
}
