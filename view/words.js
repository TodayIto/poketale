import ko from './text-ko.json' with { type: 'json' };
import en from './text-en.json' with { type: 'json' };
import { checkLang } from '../director/lang.js';
import { interpolate } from '../director/text.js';

const OWN = {
  ko: {
    'own.onlyFightParty': '지금은 싸운다와 포켓몬만\n사용할 수 있습니다.',
    'own.onlyFight': '지금은 싸운다만\n사용할 수 있습니다.',
    'own.noMove': '기술 없음',
    'own.noPp': 'PP가 없습니다',
    'own.moveDisabled': '사용 불가',
    'own.back': '뒤로 (X)',
    'own.noItem': '없음',
    'own.bag': '가방',
    'own.win': '배틀에서 이겼다!',
    'own.lose': '배틀에서 졌다…',
    'own.tie': '무승부!',
    'own.openFailed': '화면을 열지 못했습니다.\n다시 시도해 주십시오.',
    'own.loadFailed': '그림을 불러오지 못했습니다.\n다시 시도해 주십시오.',
    'own.renameFailed': '닉네임을 바꾸지 못했습니다.\n다시 시도해 주십시오.',
    'own.partnerMon': '{{trainerName}}의 포켓몬',
  },
  en: {
    'own.onlyFightParty': 'Only Fight and Pokémon\ncan be used now.',
    'own.onlyFight': 'Only Fight\ncan be used now.',
    'own.noMove': 'No move',
    'own.noPp': 'No PP left',
    'own.moveDisabled': 'Disabled',
    'own.back': 'Back (X)',
    'own.noItem': 'None',
    'own.bag': 'Bag',
    'own.win': 'You won the battle!',
    'own.lose': 'You lost the battle…',
    'own.tie': 'It’s a draw!',
    'own.openFailed': 'Couldn’t open the screen.\nPlease try again.',
    'own.loadFailed': 'Couldn’t load the pictures.\nPlease try again.',
    'own.renameFailed': 'Couldn’t change the nickname.\nPlease try again.',
    'own.partnerMon': '{{trainerName}}’s Pokémon',
  },
};
export const VIEW_TEXT = Object.freeze({ ko: { ...ko, ...OWN.ko }, en: { ...en, ...OWN.en } });

// The view's words in lang: (key, values) -> text
export function viewWords(lang) {
  const table = VIEW_TEXT[checkLang(lang)];
  return (key, values = {}) => {
    if (key === '_source' || !Object.hasOwn(table, key)) throw new Error(`Unknown view text key: ${key}`);
    return interpolate(table[key], values, lang);
  };
}
