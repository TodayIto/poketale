import { createFetchBytes } from './fetch-bytes.js';
import { mark } from './marks.js';
import { startStoryLink, openSettings, currentSettings, openLang, queueAction, storyNow, onStoryChange, showWindow, hideWindow, resumeHere, toggleAux, debugAdd, debugEdit, debugHeal, debugBadges, debugLock, writeBotTravel, quickImport, importLater, battleFormat, watchReplies } from './story-link.js';
import { startPanel } from '../panel/panel.js';
import { createPanelScreens } from '../panel/screens.js';
import { createPanelPictures } from '../panel/pictures.js';
import { createRestSound } from '../panel/rest-sound.js';
import { DEFAULT_ASSET_BASE } from '../../view/assets.js';
import { probeImage, pokerogueStillUrl } from '../panel/picture-steps.js';
import { defringeAddress } from '../panel/defringe.js';
import { personaName } from './persona.js';
import { useMainDocument } from './stage.js';
import { POKE_BALL_ICON } from './settings.js';

mark('pb:script');

(async () => {
  const fetchBytes = createFetchBytes(risuai);
  try {

    await risuai.registerSetting('PokéTale', () => openSettings().catch(console.error), POKE_BALL_ICON, 'html', 'poke-battle-setting');
  } catch (error) {
    const owner = {};
    const { mountBattle } = await import('./runtime.js');
    const app = mountBattle({ fetchBytes, onClose: () => hideWindow(owner), lang: await openLang() });
    app.showError(error);
    try { await showWindow(owner); } catch (showError) { app.showError(showError); }
  }

  try {
    await risuai.registerButton({ name: 'PokéTale', icon: POKE_BALL_ICON, iconType: 'html', location: 'chat', id: 'poke-battle-menu' },
      () => openSettings().catch(console.error));
  } catch (error) { console.warn('[poke-battle] 입력창 메뉴 단추를 달지 못함', error); }
  // Story link: cards and buttons in messages (story-link.js).
  try { await startStoryLink(); } catch (error) { console.warn('[poke-battle] 이야기 연결을 켜지 못함', error); }

  try {
    const doc = await risuai.getRootDocument();
    if (doc) {
      useMainDocument(doc, () => currentSettings().aboveOthers, () => currentSettings().debug);
      const screens = createPanelScreens({ fetchBytes, settings: currentSettings, lang: openLang, battleFormat,
        show: showWindow, hide: hideWindow, replies: watchReplies, trainer: () => personaName(risuai).catch(() => null) });
      const pictures = createPanelPictures({ route: () => currentSettings().panelPicture, probe: probeImage, fetchBytes, still: pokerogueStillUrl,
        clean: (address, viaHost) => defringeAddress(address, viaHost ? fetchBytes : null) });
      await startPanel({ doc, read: storyNow, queueAction, screens, changes: onStoryChange, resume: resumeHere, toggleAux, debugAdd, debugEdit, debugHeal, debugBadges, debugLock, botTravel: writeBotTravel, quickImport, importLater, pictures,
        place: () => currentSettings().outsideScreens, shift: () => currentSettings().panelShift, trainer: () => personaName(risuai).catch(() => null),
        restSound: createRestSound({ assetBase: DEFAULT_ASSET_BASE, settings: currentSettings, fetchBytes }) });
    }
  } catch (error) { console.warn('[poke-battle] 오른쪽 패널을 끼우지 못함', error); }
})();
