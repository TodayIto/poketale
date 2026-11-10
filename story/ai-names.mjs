import { entry, names, toID } from '../names/index.js';

export const KINDS = ['species', 'moves', 'items', 'abilities'];
const tableEn = (kind, value) => entry(kind, value)?.en ?? null;
const tableKo = (kind, value) => (entry(kind, value)?.ko ? names[kind](value) : null);

export function createNamer({ lang = 'ko', en = null, ko = tableKo } = {}) {
  const seenKeys = new Set();
  const seen = (kind, key) => {
    const k = `${kind}:${toID(key) || key}`;
    if (seenKeys.has(k)) return true;
    seenKeys.add(k);
    return false;
  };
  const name = kind => value => {
    const english = (en && en(kind, value)) || tableEn(kind, value) || String(value ?? '');
    if (seen(kind, value)) return english;
    if (lang !== 'ko') return english;
    const local = ko(kind, value);
    return local && /[가-힣]/.test(local) && local !== english ? `${english}(${local})` : english;
  };
  return { species: name('species'), moves: name('moves'), items: name('items'), abilities: name('abilities'), seen };
}

export const STATUS_EN = { '': 'Normal', par: 'Paralyzed', brn: 'Burned', slp: 'Asleep', frz: 'Frozen', psn: 'Poisoned', tox: 'Badly Poisoned', fnt: 'Fainted' };

export const nicknamed = (nick, species) => (nick ? `${nick} the ${species}` : species);

export const ownLabel = slot => `Own Pokémon ${slot}`;

const SPEAKER = { user: '{{user}}', char: 'Story' };
export const sceneLines = messages => messages.map(m => `[${SPEAKER[m.role] ?? SPEAKER.char}]\n${m.text}`).join('\n\n');

export const trainerName = battle => battle?.name || battle?.trainerClass || 'Trainer';
export const secondName = battle => battle?.foePartner?.name || 'Trainer';
export const partnerName = battle => battle?.partner?.name || 'Partner';

export const stageTrainer = (battle, stage = 1) => (stage > 1 ? secondName(battle) : trainerName(battle));

export const battleKind = result => (!result?.double ? 'single' : result.partner?.length ? 'tag' : 'double');
