import { createFetchBytes } from './fetch-bytes.js';
import { mark } from './marks.js';
import { startStoryLink, openSettings, currentSettings, soundFeed, openLang, queueAction, storyNow, onStoryChange, showWindow, hideWindow, resumeHere, openHere, toggleAux, debugAdd, debugEdit, debugHeal, debugBadges, debugLock, fishCast, writeBotTravel, quickImport, importLater, battleFormat, watchReplies,
  panelShiftNow, setPanelShift, taleValues, setTale, voicePacks } from './story-link.js';
import { startPanel } from '../panel/panel.js'; // right panel
import { createPanelScreens } from '../panel/screens.js';
import { createPanelPictures } from '../panel/pictures.js'; // where party / box pictures come from
import { createRestSound } from '../panel/rest-sound.js'; // the short rest's heal sound (only with the sound effects above 0)
import { DEFAULT_ASSET_BASE } from '../../view/assets.js'; // the PokeRogue assets the heal sound comes from (the battle view's)
import { probeImage, pokerogueStillUrl } from '../panel/picture-steps.js';
import { defringeAddress } from '../panel/defringe.js'; // badge pictures' light edge off, for the badge case's dark stage
import { personaName } from './persona.js'; // OT = my persona
import { useMainDocument } from './stage.js'; // window placement = chat area
import { POKE_BALL_ICON } from './settings.js'; // menu icon = the Poke Ball in the settings window header
import { guardContextMenu } from './contextmenu.js';

mark('pb:script');
guardContextMenu(globalThis.document);

(async () => {
  const fetchBytes = createFetchBytes(risuai); // one for the error window, the panel screens and the panel pictures
  try {
    // plugin settings screen
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
      const screens = createPanelScreens({ fetchBytes, settings: currentSettings, volume: soundFeed, voicePacks: voicePacks.source, lang: openLang, battleFormat,
        show: showWindow, hide: hideWindow, replies: watchReplies, trainer: () => personaName(risuai).catch(() => null) });
      const pictures = createPanelPictures({ route: () => currentSettings().panelPicture, probe: probeImage, fetchBytes, still: pokerogueStillUrl,
        clean: (address, viaHost) => defringeAddress(address, viaHost ? fetchBytes : null) });
      await startPanel({ doc, read: storyNow, queueAction, screens, changes: onStoryChange, resume: resumeHere, toggleAux, debugAdd, debugEdit, debugHeal, debugBadges, debugLock, fish: fishCast, openBattle: openHere, botTravel: writeBotTravel, quickImport, importLater, pictures,
        place: () => currentSettings().outsideScreens, shift: panelShiftNow, open: () => currentSettings().panelOpen, trainer: () => personaName(risuai).catch(() => null),

        stay: () => currentSettings().panelStay, drag: () => currentSettings().panelDrag, moveShift: setPanelShift,
        // the settings tab's PokeTale rows and its button to the settings window
        tale: taleValues, setTale, openSettings,
        restSound: createRestSound({ assetBase: DEFAULT_ASSET_BASE, settings: currentSettings, fetchBytes }) });
    }
  } catch (error) { console.warn('[poke-battle] 오른쪽 패널을 끼우지 못함', error); }
})();
