import { entry, names, toID } from '../names/index.js';
import aiForms from '../data/names/ai-forms.json' with { type: 'json' };

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
  const englishOf = (kind, value) => (en && en(kind, value)) || tableEn(kind, value) || String(value ?? '');

  const write = (kind, key, english, local) => {
    if (seen(kind, key)) return english;
    if (lang !== 'ko') return english;
    return local && /[가-힣]/.test(local) && local !== english ? `${english}(${local})` : english;
  };
  const name = kind => value => write(kind, value, englishOf(kind, value), ko(kind, value));

  const species = value => {
    const form = formNames(value);
    if (!form) return name('species')(value);
    return form.en ? write('species', form.id, form.en, form.ko) : name('species')(form.id);
  };

  const zStatus = move => {
    const local = ko('moves', move);
    return write('moves', `Z-${englishOf('moves', move)}`, `Z-${englishOf('moves', move)}`, local ? `Z${local}` : null);
  };
  // The English species name without counting a mention, for comparing names
  const plainSpecies = value => {
    const form = formNames(value);
    return form?.en ?? englishOf('species', form ? form.id : value);
  };
  return { species, moves: name('moves'), items: name('items'), abilities: name('abilities'), zStatus, seen, plainSpecies };
}

function formNames(value) {
  let id = toID(typeof value === 'object' && value !== null ? value.id ?? value.name : value);
  if (!Object.hasOwn(aiForms, id)) return null;

  for (let hops = 0; typeof aiForms[id] === 'string' && hops < 4; hops++) id = aiForms[id];
  const row = Object.hasOwn(aiForms, id) ? aiForms[id] : null;
  return Array.isArray(row) ? { id, en: row[0], ko: row[1] } : { id };
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
