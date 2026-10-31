import ko from './text-effects-ko.json' with { type: 'json' };
import en from './text-effects-en.json' with { type: 'json' };
import { phrase, text, nameWithAffix, statusNames, commonNames } from './text.js';
import { DEFAULT_LANG } from './lang.js';
import { megaFormName } from './steps-mega.js';
import { positionOf, isIdent, uidOf, teamOf, fieldPositions } from './read.js';
import { ownTemplate } from './own-text.js';
import { toID } from '../engine/mon.mjs';

const PHRASES = { ko, en };
export const effectText = (key, values = {}, lang = DEFAULT_LANG) => phrase(PHRASES, key, values, lang, 'effect text');

// Type and stat names of a language (pokemon-info.json). Unknown ones stay as given
export const typeNameIn = (lang, type) => PHRASES[lang][`pokemon-info.type.${toID(type)}`] ?? type;

const other = position => (teamOf(position) === 'player' ? position.replace('player', 'enemy') : position.replace('enemy', 'player'));

const effectOf = value => {
  const match = /^(move|ability|item|pokemon):\s*(.*)$/.exec(String(value ?? ''));
  const name = match ? match[2] : String(value ?? '');
  return { prefix: match?.[1] ?? '', name, id: toID(name) };
};

const STAT_KEY = { atk: 'atk', def: 'def', spa: 'spatk', spd: 'spdef', spe: 'spd', accuracy: 'acc', evasion: 'eva',
  attack: 'atk', defense: 'def', spatk: 'spatk', spdef: 'spdef', speed: 'spd' };
const BOOSTS = ['atk', 'def', 'spa', 'spd', 'spe', 'accuracy', 'evasion'];

const WEATHER = {
  sunnyday: ['sunny', 'sunny'], raindance: ['rain', 'rain'], sandstorm: ['sandstorm', 'sandstorm'], hail: ['hail', 'hail'],
  snowscape: ['snow', 'snow'], snow: ['snow', 'snow'], desolateland: ['harsh-sun', 'harshSun'],
  primordialsea: ['heavy-rain', 'heavyRain'], deltastream: ['strong-winds', 'strongWinds'],
};

const TERRAIN = { electricterrain: 'electric', grassyterrain: 'grassy', mistyterrain: 'misty', psychicterrain: 'psychic' };

const FIELD = { trickroom: 'trickRoom', gravity: 'gravity', wonderroom: 'wonderRoom', mudsport: 'mudSport', watersport: 'waterSport' };

// Side conditions (arena-tag.json <key>OnAdd{Player,Enemy} / OnRemove{Player,Enemy})
const SIDE = {
  reflect: 'reflect', lightscreen: 'lightScreen', auroraveil: 'auroraVeil', mist: 'mist', safeguard: 'safeguard', tailwind: 'tailwind',
  luckychant: 'noCrit', spikes: 'spikes', toxicspikes: 'toxicSpikes', stealthrock: 'stealthRock', stickyweb: 'stickyWeb',
  firepledge: 'fireGrassPledge', waterpledge: 'waterFirePledge', grasspledge: 'grassWaterPledge',
};

const TRAP = { bind: 'bind', wrap: 'wrap', firespin: 'fireSpin', whirlpool: 'whirlpool', clamp: 'clamp', sandtomb: 'sandTomb',
  magmastorm: 'magmaStorm', snaptrap: 'snapTrap', thundercage: 'thunderCage', infestation: 'infestation' };
const TRAP_ANIM = { firespin: 'fire-spin', sandtomb: 'sand-tomb', magmastorm: 'magma-storm', snaptrap: 'snap-trap', thundercage: 'thunder-cage' };

const VOLATILE = {
  confusion: ['confusedOnAdd', 'confusedOnRemove'], healblock: ['healBlockOnAdd', 'healBlockOnRemove'],
  encore: ['encoreOnAdd', 'encoreOnRemove'], taunt: ['tauntOnAdd', 'tauntOnRemove'], leechseed: ['seededOnAdd', null],
  slowstart: ['slowStartOnAdd', 'slowStartOnRemove'], yawn: ['drowsyOnAdd', null], saltcure: ['saltCuredOnAdd', null],
  attract: ['infatuatedOnAdd', 'infatuatedOnRemove'], nightmare: ['nightmareOnAdd', null], ingrain: ['ingrainOnAdd', null],
  aquaring: ['aquaRingOnAdd', null], focusenergy: ['critBoostOnAdd', 'critBoostOnRemove'], magnetrise: ['magnetRisenOnAdd', 'magnetRisenOnRemove'],
  torment: ['tormentOnAdd', null], laserfocus: ['laserFocusOnAdd', null], tarshot: ['tarShotOnAdd', null],
  telekinesis: ['telekinesisOnAdd', 'telekinesisOnRemove'], powder: ['powderOnAdd', null], imprison: ['imprisonOnAdd', null],
  autotomize: ['autotomizeOnAdd', null], electrify: ['electrifiedOnAdd', null], noretreat: ['noRetreatOnAdd', null],
  octolock: ['octolockOnAdd', null], syrupbomb: ['syrupBombOnAdd', null], grudge: ['grudgeOnAdd', null],
  magiccoat: ['magicCoatOnAdd', null], helpinghand: ['helpingHandOnAdd', null],
};

const QUIET_VOLATILE = new Set(['throatchop', 'charge', 'mustrecharge', 'roost', 'uproar', 'stockpile', 'smackdown', 'rage', 'protosynthesis',
  'quarkdrive', 'flashfire', 'bide', 'lockon', 'mindreader', 'dynamax', 'glaiverush', 'snatch', 'instruct', 'leechseed', 'yawn', 'perishsong',
  'ingrain', 'aquaring', 'octolock', 'saltcure', 'nightmare', 'curse', 'imprison', 'torment', 'powder', 'tarshot', 'electrify', 'laserfocus']);

const CHARGE = {
  solarbeam: 'tookInSunlight', solarblade: 'tookInSunlight', meteorbeam: 'isOverflowingWithSpacePower', skyattack: 'isGlowing',
  fly: 'flewUpHigh', dig: 'dugAHole', dive: 'hidUnderwater', bounce: 'sprangUp', skullbash: 'loweredItsHead', razorwind: 'whippedUpAWhirlwind',
  phantomforce: 'vanishedInstantly', shadowforce: 'vanishedInstantly', geomancy: 'isChargingPower', freezeshock: 'becameCloakedInFreezingLight',
  iceburn: 'becameCloakedInFreezingAir', electroshot: 'absorbedElectricity', skydrop: 'tookTargetIntoSky',
};

const SINGLE_TURN = {
  protect: 'battler-tags.protectedOnAdd', detect: 'battler-tags.protectedOnAdd', kingsshield: 'battler-tags.protectedOnAdd',
  spikyshield: 'battler-tags.protectedOnAdd', banefulbunker: 'battler-tags.protectedOnAdd', silktrap: 'battler-tags.protectedOnAdd',
  burningbulwark: 'battler-tags.protectedOnAdd', obstruct: 'battler-tags.protectedOnAdd', maxguard: 'battler-tags.protectedOnAdd',
  endure: 'battler-tags.enduringOnAdd', beakblast: 'move-trigger.startedHeatingUpBeak', focuspunch: 'move-trigger.isTighteningFocus',
  shelltrap: 'move-trigger.setUpShellTrap', magiccoat: 'battler-tags.magicCoatOnAdd', followme: 'battler-tags.centerOfAttentionOnAdd',
  ragepowder: 'battler-tags.centerOfAttentionOnAdd', spotlight: 'battler-tags.centerOfAttentionOnAdd', electrify: 'battler-tags.electrifiedOnAdd',
  powder: 'battler-tags.powderOnAdd', matblock: 'arena-tag.matBlockOnAdd',
};
const GUARD = new Set(['quickguard', 'wideguard', 'craftyshield']);

const ABILITY_LINE = {
  pressure: 'postSummonPressure', moldbreaker: 'postSummonMoldBreaker', turboblaze: 'postSummonTurboblaze', teravolt: 'postSummonTeravolt',
  darkaura: 'postSummonDarkAura', fairyaura: 'postSummonFairyAura', aurabreak: 'postSummonAuraBreak', neutralizinggas: 'postSummonNeutralizingGas',
  asoneglastrier: 'postSummonAsOneGlastrier', asonespectrier: 'postSummonAsOneSpectrier', zerotohero: 'postSummonZeroToHero',
  anticipation: 'postSummonAnticipation', airlock: 'weatherEffectDisappeared', cloudnine: 'weatherEffectDisappeared',
};
const RUIN = { vesselofruin: ['postSummonVesselOfRuin', 'spatk'], swordofruin: ['postSummonSwordOfRuin', 'def'],
  tabletsofruin: ['postSummonTabletsOfRuin', 'atk'], beadsofruin: ['postSummonBeadsOfRuin', 'spdef'] };

const ITEM_THEN_EFFECT = new Set(['weaknesspolicy', 'throatspray', 'absorbbulb', 'cellbattery', 'luminousmoss', 'snowball', 'electricseed',
  'grassyseed', 'mistyseed', 'psychicseed', 'roomservice', 'adrenalineorb', 'blunderpolicy', 'boosterenergy']);

const SILENT = new Set(['debug', '-hint', '-mustrecharge', '-center', '-waiting', '-fieldactivate', '-cureteam']);

// Lines this module handles (steps.js dispatch table)
export const EFFECT_KINDS = ['-damage', '-heal', '-sethp', '-status', '-curestatus', 'cant', '-boost', '-unboost', '-setboost', '-clearallboost',
  '-clearboost', '-clearnegativeboost', '-clearpositiveboost', '-invertboost', '-copyboost', '-swapboost', '-transform', '-formechange', 'detailschange',
  '-fail', '-block', '-nothing', '-notarget', '-ability', '-endability', '-item', '-enditem', '-activate', '-start', '-end', '-singleturn',
  '-singlemove', '-weather', '-fieldstart', '-fieldend', '-sidestart', '-sideend', '-swapsideconditions', '-prepare', '-anim', '-hitcount', ...SILENT];

export const EFFECT_TABLES = { WEATHER, TERRAIN, FIELD, SIDE, TRAP, VOLATILE, CHARGE, SINGLE_TURN, ABILITY_LINE, RUIN };

export function createEffects({ battle, view, names, warn, ledger, lang = DEFAULT_LANG, affix = nameWithAffix(lang) }) {
  const id = value => battle.dex?.toID ? battle.dex.toID(value) : toID(value);
  const plainName = ident => ledger.get(ident).name;
  const label = side => affix(ledger.atField(side)?.name, side);
  const nameOf = ident => affix(plainName(ident), positionOf(ident));
  const nv = ident => ({ pokemonName: nameOf(ident), pokemonNameWithAffix: nameOf(ident) });
  const say = (key, values = {}) => view.message(effectText(key, values, lang), {});
  const show = (key, values) => view.message(text(key, values, lang), {});

  const sourceSay = (ident, effect) => show('battle.useMove', { ...nv(ident),
    moveName: effect.prefix === 'item' ? names.item(effect.id) : effect.prefix === 'ability' ? names.ability(effect.id) : effect.prefix === 'move' ? names.move(effect.id) : effect.name });
  const typeName = type => typeNameIn(lang, id(type));
  const statName = stat => PHRASES[lang][`pokemon-info.stat.${STAT_KEY[id(stat)]}`] ?? stat;
  const sideKey = position => teamOf(position) === 'player' ? 'Player' : 'Enemy';

  let weather = null;

  let bar = null;

  const dollOut = new WeakSet();

  const itemFrom = ({ kwArgs: kw, item }, { eaten } = {}) => {
    const from = kw.from ? effectOf(kw.from) : null;
    if (from?.prefix === 'item') return from.id;
    if (from || !item) return null;
    return eaten === undefined || item.eaten === eaten ? item.id : null;
  };

  const fieldSide = () => fieldPositions(battle).find(side => ledger.atField(side) && !ledger.atField(side).fainted);
  const common = async (name, side, targetSide = side) => { if (side && ledger.atField(side)) await view.playCommon(name, side, targetSide); };
  const showStages = side => ledger.atField(side) ? view.setStatStages(side, { ...ledger.atField(side).boosts }) : undefined;

  async function hp(ident, cause = 'other', effectiveness = 'normal') {
    if (!ledger.onField(ident)) return;
    const { hp: value, maxhp } = ledger.get(ident);
    await view.hpChange(positionOf(ident), value, maxhp, { cause, effectiveness });
  }
  const sourceLabel = source => {
    const match = /^(ability|item|move):\s*(.*)$/.exec(source);
    return match ? names[match[1]](id(match[2])) : source;
  };

  // Text for sourced HP changes that have no specific entry
  async function sourceMessage(ident, source, heal) {
    if (statusNames[source] && !heal) {

      if (ledger.onField(ident)) await view.playCommon(commonNames[source], positionOf(ident));
      return show(`status-effect.${statusNames[source]}.activation`, nv(ident));
    }
    if (source === 'recoil') return show('move-trigger.hitWithRecoil', nv(ident));

    await show('battle.useMove', { ...nv(ident), moveName: sourceLabel(source) });
    if (heal) await show('battle.regainHealth', nv(ident));
  }

  const heals = event => event.before?.hp === undefined || ledger.get(event.args[0]).hp > event.before.hp;

  function abilityTrigger({ kind, args: a, kwArgs: kw }) {
    if (kind.startsWith('-story-')) return null;
    const from = kw.from ? effectOf(kw.from) : null;
    if (kind === '-ability') {
      if (from && from.prefix !== 'ability') return null;
      return { ident: a[0], name: from?.name ?? a[1] };
    }
    if (from?.prefix === 'ability') {
      const ofHolder = kw.of && !['-heal', '-item', '-enditem', '-transform', '-immune'].includes(kind) || (kind === '-item' && from.id === 'frisk');
      const ident = ofHolder && typeof kw.of === 'string' ? kw.of : a[0];
      return isIdent(ident) ? { ident, name: from.name } : null;
    }
    if (['-activate', '-start', '-end', '-block'].includes(kind) && /^ability:/.test(a[1] ?? '') && !kw.silent) {
      const ident = kind === '-block' && typeof kw.of === 'string' ? kw.of : a[0];
      return { ident, name: effectOf(a[1]).name };
    }
    if (kind === 'cant' && /^ability:/.test(a[1] ?? '')) return { ident: typeof kw.of === 'string' ? kw.of : a[0], name: effectOf(a[1]).name };
    return null;
  }
  async function hideBar() {
    if (!bar) return;
    bar = null;
    await view.hideAbility();
  }

  const writer = (event, uid, abilityId) => event.tag?.effects?.findLast(e => e.type === 'Ability' && e.uid === uid) ?? { id: abilityId, uid };
  async function manageBar(event) {
    const trigger = abilityTrigger(event);
    if (trigger) {
      const uid = uidOf(event, trigger.ident), abilityId = id(trigger.name);
      if (bar?.uid === uid && bar.id === abilityId) return;
      await hideBar();
      await view.showAbility(positionOf(trigger.ident), plainName(trigger.ident), names.ability(abilityId));
      bar = { uid, id: abilityId, by: writer(event, uid, abilityId) };
      return;
    }
    if (bar && !event.tag?.effects?.some(e => e.id === bar.by.id && e.uid === bar.by.uid)) await hideBar();
  }

  async function cue({ cue: kind, move, event }) {
    if (kind === 'survive') return surviveMessage(event);
    const user = ledger.pokemon.get(uidOf(move, move.args[0])), side = positionOf(move.args[0]);
    if (kind === 'doll-out' && user?.substitute && !move.kwArgs.still) { dollOut.add(move); await view.substitute(side, 'pre'); }
    if (kind === 'doll-back' && dollOut.has(move) && ledger.atField(side)?.substitute) await view.substitute(side, 'post');
  }

  function surviveMessage({ kind, args: a }) {
    const v = nv(a[0]);
    if (kind === '-ability') return say('battler-tags.sturdyLapse', v);
    if (kind === '-enditem') return say('own.itemSurvive', { ...v, itemName: names.item(id(a[1])) });
    const effect = effectOf(a[1]);
    if (effect.id === 'endure') return say('battler-tags.enduringLapse', v);
    return say('own.itemSurvive', { ...v, itemName: names.item(effect.id) });
  }

  async function onDamage(event) {
    const { args: a, kwArgs: kw } = event;

    if (!kw.from) return hp(a[0], 'move', event.hit?.effectiveness);
    const from = effectOf(kw.from), side = positionOf(a[0]);
    const holder = typeof kw.of === 'string' ? kw.of : a[0];
    if (from.prefix === 'item') {

      await hp(a[0]);
      const itemName = names.item(from.id);
      if (from.id === 'lifeorb') await say('own.lifeOrb', nv(a[0]));
      else if (holder !== a[0] && from.id !== 'rockyhelmet') await say('own.itemDamageFrom', { ...nv(a[0]), sourceName: nameOf(holder), itemName });
      else await say('own.itemDamage', { ...nv(a[0]), itemName });
      return;
    }
    if (from.prefix === 'ability') {
      await hp(a[0]);
      const abilityName = names.ability(from.id);
      if (['roughskin', 'ironbarbs'].includes(from.id)) await say('ability-trigger.postDefendContactDamage', { ...nv(holder), abilityName });
      else if (from.id === 'aftermath') await say('ability-trigger.postFaintContactDamage', { ...nv(holder), abilityName });
      else if (from.id === 'innardsout') await say('ability-trigger.postFaintHpDamage', { ...nv(holder), abilityName });
      else if (from.id === 'liquidooze') await say('ability-trigger.reverseDrain', nv(a[0]));
      else if (from.id === 'baddreams') await say('ability-trigger.badDreams', nv(a[0]));
      else if (['solarpower', 'dryskin'].includes(from.id)) await say('ability-trigger.postWeatherLapseDamage', { ...nv(a[0]), abilityName });
      return;
    }
    if (from.prefix === 'pokemon') { await hp(a[0]); return; }
    if (from.prefix === 'move' && (TRAP[from.id] || kw.partiallytrapped)) {
      await common(TRAP_ANIM[from.id] ?? from.id, side);
      await hp(a[0]);
      await say('battler-tags.damagingTrapLapse', { ...nv(a[0]), moveName: names.move(from.id) });
      return;
    }
    switch (from.id) {
    case 'recoil': await hp(a[0]); await say('move-trigger.hitWithRecoil', nv(a[0])); return;
    case 'stealthrock': await hp(a[0]); await say('arena-tag.stealthRockActivateTrap', nv(a[0])); return;
    case 'spikes': await hp(a[0]); await say('arena-tag.spikesActivateTrap', nv(a[0])); return;

    case 'sandstorm': await say('weather.sandstormDamageMessage', nv(a[0])); await hp(a[0]); return;
    case 'hail': await say('weather.hailDamageMessage', nv(a[0])); await hp(a[0]); return;
    case 'confusion':
      await say('battler-tags.confusedLapseHurtItself');
      await hp(a[0], 'move');
      return;
    case 'leechseed': {

      const source = typeof kw.of === 'string' ? positionOf(kw.of) : other(side);
      await common('leech-seed', source, side);
      await hp(a[0]);
      await say('battler-tags.seededLapse', nv(a[0]));
      return;
    }
    case 'saltcure': await common('salt-cure', side); await hp(a[0]); await say('battler-tags.saltCuredLapse', nv(a[0])); return;
    case 'curse': await common('curse', side); await hp(a[0]); await say('battler-tags.cursedLapse', nv(a[0])); return;
    case 'nightmare': await common('curse', side); await hp(a[0]); await say('battler-tags.nightmareLapse', nv(a[0])); return;
    case 'highjumpkick': case 'jumpkick': case 'supercellslam': case 'axekick':
      await hp(a[0]); await say('move-trigger.keptGoingAndCrashed', nv(a[0])); return;
    case 'firepledge': await hp(a[0]); await say('arena-tag.fireGrassPledgeLapse', nv(a[0])); return;
    default: await hp(a[0]); await sourceMessage(a[0], String(kw.from), false);
    }
  }

  async function onHeal(event) {
    const { args: a, kwArgs: kw } = event;
    const side = positionOf(a[0]);
    if (kw.silent && !kw.from) { await hp(a[0]); return; }
    if (!kw.from) { await hp(a[0]); await show('battle.regainHealth', nv(a[0])); return; }
    const from = effectOf(kw.from);
    if (kw.silent) { await hp(a[0]); return; }
    if (from.id === 'revivalblessing') {

      await hp(a[0]);
      await view.message(effectText('move-trigger.revivalBlessing', { pokemonName: nameOf(a[0]) }, lang), { wait: true });
      return;
    }

    const healed = async () => { if (heals(event) && ledger.onField(a[0])) await common('health-up', side); await hp(a[0]); };
    if (from.prefix === 'item') {
      await healed();
      const itemName = names.item(from.id);
      if (from.id.endsWith('berry')) await say('battle.hpHealBerry', { ...nv(a[0]), berryName: itemName });
      else await say('own.itemHeal', { ...nv(a[0]), itemName });
      return;
    }
    if (from.prefix === 'ability') {
      await healed();
      const abilityName = names.ability(from.id), values = { ...nv(a[0]), abilityName };
      if (from.id === 'poisonheal') await say('ability-trigger.poisonHeal', values);
      else if (['voltabsorb', 'waterabsorb', 'eartheater'].includes(from.id) || (from.id === 'dryskin' && kw.of)) await say('ability-trigger.typeImmunityHeal', values);
      else if (['raindish', 'icebody', 'dryskin'].includes(from.id)) await say('ability-trigger.postWeatherLapseHeal', values);
      else if (from.id === 'cheekpouch') await say('ability-trigger.healFromBerryUse', values);
      else await say('ability-trigger.postTurnHeal', values);
      return;
    }
    switch (from.id) {
    case 'drain':
      await healed();
      await say('battle.drainMessage', { pokemonName: typeof kw.of === 'string' ? nameOf(kw.of) : label(other(side)) });
      return;
    case 'wish':
      await healed();

      await say('arena-tag.wishTagOnAdd', { pokemonNameWithAffix: typeof kw.wisher === 'string' ? affix(names.species(kw.wisher), positionOf(a[0])) : nameOf(a[0]) });
      return;
    case 'grassyterrain': await healed(); await say('battle.turnEndHpRestore', nv(a[0])); return;
    case 'ingrain': await healed(); await say('battler-tags.ingrainLapse', nv(a[0])); return;
    case 'aquaring': await healed(); await say('battler-tags.aquaRingLapse', { ...nv(a[0]), moveName: names.move('aquaring') }); return;
    case 'lunardance': await healed(); await say('move-trigger.lunarDanceRestore', nv(a[0])); return;
    case 'healingwish': await healed(); await say('move-trigger.sacrificialFullRestore', nv(a[0])); return;
    default: await hp(a[0]); await sourceMessage(a[0], String(kw.from), true);
    }
  }

  async function onStart(event) {
    const { args: a, kwArgs: kw } = event;
    if (kw.silent) return true;
    const side = positionOf(a[0]), effect = effectOf(a[1]), from = kw.from ? effectOf(kw.from) : null;
    const v = nv(a[0]);
    if (effect.id === 'substitute') {
      await view.substitute(side, 'add');
      await say(from?.id === 'shedtail' ? 'battler-tags.shedTailOnAdd' : 'battler-tags.substituteOnAdd', v);
      return true;
    }
    if (effect.id === 'confusion') {

      await common('confusion', side);
      await say('battler-tags.confusedOnAdd', v);
      return true;
    }
    if (effect.id === 'disable') {
      await say('battler-tags.disabledOnAdd', { ...v, moveName: names.move(id(a[2])) });
      return true;
    }
    if (effect.id === 'typechange') {
      const types = String(a[2] ?? '').split('/').filter(t => t && t !== '???');
      if (!types.length) {
        if (from?.id === 'burnup') await say('move-trigger.burnedItselfOut', v);
        else if (from?.id === 'doubleshock') await say('move-trigger.usedUpAllElectricity', v);
        return true;
      }
      const typeNames = types.map(typeName).join('/');
      if (from?.prefix === 'ability') await say('ability-trigger.pokemonTypeChange', { ...v, moveType: typeNames });
      else if (from?.id === 'reflecttype' && typeof kw.of === 'string') await say('move-trigger.copyType', { ...v, targetPokemonName: nameOf(kw.of) });
      else await say('move-trigger.transformedIntoType', { ...v, typeName: typeNames });
      return true;
    }

    const item = itemFrom(event);
    if (item && effect.id === 'focusenergy') { await say('own.focusEnergyFromItem', { ...v, itemName: names.item(item) }); return true; }
    if (item && effect.id === 'attract' && from?.prefix === 'item') { await say('own.attractFromItem', { ...v, itemName: names.item(item) }); return true; }
    if (effect.id === 'typeadd') { await say('move-trigger.addType', { ...v, typeName: typeName(a[2]) }); return true; }
    if (effect.id === 'curse') {
      const source = typeof kw.of === 'string' ? kw.of : a[0];
      await say('battler-tags.cursedOnAdd', { pokemonNameWithAffix: nameOf(source), pokemonName: nameOf(a[0]) });
      return true;
    }
    if (/^perish\d$/.test(effect.id)) {
      const turnCount = Number(effect.id.slice(-1));
      if (turnCount === 3) await say('move-trigger.faintCountdown', { ...v, turnCount });
      else await say('battler-tags.perishSongLapse', { ...v, turnCount });
      return true;
    }
    if (/^stockpile\d$/.test(effect.id)) { await say('battler-tags.stockpilingOnAdd', { ...v, stockpiledCount: Number(effect.id.slice(-1)) }); return true; }
    if (/^(quarkdrive|protosynthesis)(atk|def|spa|spd|spe)$/.test(effect.id)) {
      await say('battler-tags.highestStatBoostOnAdd', { ...v, statName: statName(effect.id.slice(-3)) });
      return true;
    }
    if (effect.id === 'flashfire') { await say('ability-trigger.typeImmunityPowerBoost', { ...v, typeName: typeName('fire') }); return true; }
    if (effect.id === 'charge' && from?.prefix === 'ability') {
      await say('ability-trigger.windPowerCharged', { pokemonName: v.pokemonName, moveName: names.move(id(a[2])) });
      return true;
    }
    if (effect.id === 'charge') { await say('move-trigger.isChargingPower', v); return true; }
    if (effect.id === 'futuresight') { await say('move-trigger.foresawAnAttack', v); return true; }
    if (effect.id === 'doomdesire') { await say('move-trigger.choseDoomDesireAsDestiny', v); return true; }
    if (effect.id === 'smackdown') { await say('move-trigger.fallDown', { targetPokemonName: v.pokemonName }); return true; }
    if (VOLATILE[effect.id]?.[0]) { await say(`battler-tags.${VOLATILE[effect.id][0]}`, { ...v, sourcePokemonName: label(other(side)) }); return true; }
    if (QUIET_VOLATILE.has(effect.id)) return true;
    warn(`-start:${effect.id}`);
    return true;
  }

  async function onEnd(event) {
    const { args: a, kwArgs: kw } = event;
    const side = positionOf(a[0]), effect = effectOf(a[1]);
    if (effect.id === 'substitute') {
      await view.substitute(side, 'remove');
      if (!kw.silent) await say('battler-tags.substituteOnRemove', nv(a[0]));
      return true;
    }
    if (kw.silent) return true;
    const v = nv(a[0]);
    if (effect.id === 'confusion' && itemFrom(event)) {
      await say('own.cureFromItem.confusion', { ...v, itemName: names.item(itemFrom(event)) });
      return true;
    }
    if (effect.id === 'illusion') {

      await hideBar();
      await view.showAbility(side, ledger.atField(side)?.name ?? plainName(a[0]), names.ability('illusion'));
      bar = { uid: uidOf(event, a[0]), id: 'illusion', by: writer(event, uidOf(event, a[0]), 'illusion') };
      await say('ability-trigger.illusionBreak', v);
      return true;
    }
    if (kw.partiallytrapped || TRAP[effect.id]) { await say('battler-tags.trappedOnRemove', { ...v, moveName: names.move(effect.id) }); return true; }
    if (effect.id === 'disable') {
      const move = event.before?.disabled;
      if (move) await say('battler-tags.disabledOnRemove', { ...v, moveName: names.move(id(move)) });
      return true;
    }
    if (['futuresight', 'doomdesire'].includes(effect.id)) { await say('move-trigger.tookMoveAttack', { ...v, moveName: names.move(effect.id) }); return true; }
    if (['quarkdrive', 'protosynthesis'].includes(effect.id)) {
      await say('battler-tags.highestStatBoostOnRemove', { ...v, abilityName: names.ability(effect.id) });
      return true;
    }
    if (VOLATILE[effect.id]?.[1]) { await say(`battler-tags.${VOLATILE[effect.id][1]}`, v); return true; }
    if (VOLATILE[effect.id] || QUIET_VOLATILE.has(effect.id)) return true;
    warn(`-end:${effect.id}`);
    return true;
  }

  async function onActivate(a, kw) {
    const side = positionOf(a[0]), effect = effectOf(a[1]), v = nv(a[0]);
    if (effect.prefix === 'ability') {
      const abilityName = names.ability(effect.id);
      if (effect.id === 'disguise') await say('ability-trigger.disguiseAvoidedDamage', v);
      else if (effect.id === 'iceface') await say('ability-trigger.iceFaceAvoidedDamage', { ...v, abilityName });
      else if (effect.id === 'terashell') await say('ability-trigger.fullHpResistType', v);
      else if (effect.id === 'forewarn' && a[2]) await say('ability-trigger.forewarn', { ...v, moveName: names.move(id(a[2])) });
      else if (effect.id === 'anticipation') await say('ability-trigger.postSummonAnticipation', v);

      // Items: Protosynthesis / Quark Drive via Booster Energy (the preceding -enditem is anim only)
      else if (kw.fromitem) await say('own.boosterEnergy', { ...v, itemName: names.item('boosterenergy'), abilityName });
      return true;
    }
    if (TRAP[effect.id]) {
      const source = typeof kw.of === 'string' ? nameOf(kw.of) : label(other(side));
      await say(`battler-tags.${TRAP[effect.id]}OnAdd`, { ...v, sourcePokemonName: source, moveName: names.move(effect.id) });
      return true;
    }
    switch (effect.id) {
    case 'confusion':

      await say('battler-tags.confusedLapse', v);
      await common('confusion', side);
      return true;
    case 'attract':
      await say('battler-tags.infatuatedLapse', { ...v, sourcePokemonName: typeof kw.of === 'string' ? nameOf(kw.of) : label(other(side)) });
      await common('attract', side);
      return true;
    case 'protect': case 'kingsshield': case 'spikyshield': case 'banefulbunker': case 'silktrap': case 'burningbulwark': case 'obstruct': case 'detect': case 'maxguard':

      await common('protect', side);
      await say('battler-tags.protectedLapse', v);
      return true;
    case 'substitute': if (kw.damage) await say('battler-tags.substituteOnHit', v); return true;
    case 'endure': return true;

    case 'trapped': await say('battler-tags.trappedOnAdd', v); return true;
    case 'destinybond':
      await say('battler-tags.destinyBondLapse', { pokemonNameWithAffix: v.pokemonName, pokemonNameWithAffix2: label(other(side)) });
      return true;
    case 'struggle': await say('move-trigger.struggle', v); return true;
    case 'trick': case 'switcheroo': await say('own.switchedItems', v); return true;
    case 'poltergeist': await say('move-trigger.attackedByItem', { pokemonName: v.pokemonName, itemName: names.item(id(a[2])) }); return true;
    case 'healbell': await say('move-trigger.bellChimed'); return true;
    case 'aromatherapy': await say('move-trigger.soothingAromaWaftedThroughArea'); return true;
    case 'ficklebeam': await say('move-trigger.goingAllOutForAttack', v); return true;
    case 'stickyweb': await say('arena-tag.stickyWebActivateTrap', v); return true;
    case 'mist': await say('arena-tag.mistApply', v); return true;
    case 'safeguard': await say('move-trigger.safeguard', { targetName: v.pokemonName }); return true;
    case 'mistyterrain': await say('terrain.mistyBlockMessage', v); return true;
    case 'psychicterrain': case 'electricterrain': case 'grassyterrain':
      await say('terrain.defaultBlockMessage', { ...v, terrainName: effectText(`terrain.${TERRAIN[effect.id]}`, {}, lang) });
      return true;
    case 'custapberry': case 'quickclaw':
      await say('modifier.bypassSpeedChanceApply', { pokemonName: v.pokemonName, itemName: names.item(effect.id) }); return true;
    case 'focusband': return true;

    case 'leppaberry':
      await say('battle.ppHealBerry', { ...v, berryName: names.item(effect.id), moveName: names.move(id(a[2])) }); return true;
    case 'safetygoggles': await say('own.safetyGoggles', { ...v, itemName: names.item(effect.id), moveName: names.move(id(a[2])) }); return true;
    case 'skillswap': await say('move-trigger.swappedAbilitiesWithTarget', v); return true;
    case 'orichalcumpulse': case 'hadronengine': return true;
    case 'magnitude': if (a[2]) await say('move-trigger.magnitudeMessage', { magnitude: a[2] }); return true;
    case 'spite': if (a[2]) await say('battle.ppReduced', { targetName: v.pokemonName, moveName: names.move(id(a[2])), reduction: a[3] ?? '' }); return true;
    default:
      warn(`-activate:${effect.id}`);
      await sourceSay(a[0], effect);
      return true;
    }
  }

  async function onItem(a, kw) {
    const from = kw.from ? effectOf(kw.from) : null, itemName = names.item(id(a[1])), v = nv(a[0]);
    if (from?.prefix === 'ability') {
      if (from.id === 'frisk' && typeof kw.of === 'string') await say('ability-trigger.frisk', { ...nv(kw.of), opponentName: v.pokemonName, opponentAbilityName: itemName });
      else if (from.id === 'harvest') await say('ability-trigger.postTurnLootCreateEatenBerry', { ...v, berryName: itemName });
      else if (from.id === 'pickup') await say('ability-trigger.postBattleLoot', { ...v, itemName });
      else if (['magician', 'pickpocket'].includes(from.id) && typeof kw.of === 'string') {
        await say(from.id === 'magician' ? 'ability-trigger.postAttackStealHeldItem' : 'ability-trigger.postDefendStealHeldItem',
          { ...v, defenderName: nameOf(kw.of), attackerName: nameOf(kw.of), stolenItemType: itemName });
      }
      return true;
    }
    if (from?.prefix === 'move') {
      if (['thief', 'covet'].includes(from.id) && typeof kw.of === 'string') await say('move-trigger.stoleItem', { pokemonName: v.pokemonName, targetName: nameOf(kw.of), itemName });
      else if (from.id === 'recycle') await say('own.recycle', { ...v, itemName });
      else await say('own.itemObtained', { ...v, itemName });
      return true;
    }

    await say(id(a[1]) === 'airballoon' ? 'own.airBalloon' : 'own.itemObtained', { ...v, itemName });
    return true;
  }

  async function onEndItem(a, kw) {
    const side = positionOf(a[0]), item = id(a[1]), itemName = names.item(item), v = nv(a[0]);
    const from = kw.from ? effectOf(kw.from) : null;
    if (kw.eat) {

      await common('use-item', side);
      if (item === 'micleberry') await say('own.micleBerry', { ...v, itemName });
      return true;
    }

    if (kw.weaken) { await say('own.itemWeaken', { ...v, itemName }); return true; }
    if (from?.id === 'stealeat' && typeof kw.of === 'string') {
      await say('battle.stealEatBerry', { pokemonName: nameOf(kw.of), targetName: v.pokemonName, berryName: itemName });
      return true;
    }
    if (kw.silent) return true;
    if (from?.prefix === 'move') {
      const attacker = typeof kw.of === 'string' ? nameOf(kw.of) : label(other(side));
      const key = { knockoff: 'knockedOffItem', incinerate: 'incineratedItem', corrosivegas: 'corrosiveGasItem' }[from.id];
      if (key) await say(`move-trigger.${key}`, { pokemonName: attacker, targetName: v.pokemonName, itemName });
      else if (from.id === 'fling') await say('own.fling', { ...v, itemName });
      return true;
    }
    if (from?.id === 'gem') {
      await common('use-item', side);
      await say('own.gem', { itemName, moveName: names.move(id(kw.move)) });
      return true;
    }
    switch (item) {
    case 'focussash': return true;
    case 'airballoon': await say('own.airBalloonPopped', v); return true;
    case 'micleberry': return true;
    }
    await common('use-item', side);
    switch (item) {
    case 'whiteherb': await say('modifier.resetNegativeStatStageApply', { ...v, typeName: itemName }); return true;
    case 'mirrorherb': await say('own.mirrorHerb', { ...v, itemName }); return true;
    case 'powerherb': await say('own.powerHerb', { ...v, itemName }); return true;
    case 'ejectbutton': case 'ejectpack': await say('own.ejectItem', { ...v, itemName }); return true;
    case 'redcard':
      await say('own.redCard', { ...v, itemName, targetName: typeof kw.of === 'string' ? nameOf(kw.of) : label(other(side)) ?? '' });
      return true;
    }
    if (!ITEM_THEN_EFFECT.has(item)) await say('own.itemUsed', { ...v, itemName });
    return true;
  }

  async function onAbility(a, kw) {
    const ability = id(a[1]), from = kw.from ? effectOf(kw.from) : null, v = nv(a[0]);
    if (from?.prefix === 'move') {
      if (from.id !== 'skillswap') await say('move-trigger.acquiredAbility', { pokemonName: v.pokemonName, abilityName: names.ability(ability) });
      return true;
    }
    if (from?.id === 'trace' && typeof kw.of === 'string') {
      await say('ability-trigger.trace', { pokemonName: v.pokemonName, targetName: nameOf(kw.of), abilityName: names.ability(ability) });
      return true;
    }
    if (ABILITY_LINE[ability]) await say(`ability-trigger.${ABILITY_LINE[ability]}`, v);
    else if (RUIN[ability]) await say(`ability-trigger.${RUIN[ability][0]}`, { ...v, statName: PHRASES[lang][`pokemon-info.stat.${RUIN[ability][1]}`] });

    else if (ability === 'sturdy') return true;

    else if (ability === 'unnerve' && label(other(positionOf(a[0])))) {
      const foe = label(other(positionOf(a[0])));
      await say('ability-trigger.preventBerryUse', { pokemonName: foe, pokemonNameWithAffix: foe });
    }
    return true;
  }

  async function onWeather(a, kw) {
    const weatherId = id(a[0]);
    if (!weatherId || weatherId === 'none') {
      if (weather && WEATHER[weather]) await say(`weather.${WEATHER[weather][1]}ClearMessage`);
      weather = null;
      return true;
    }
    const entry = WEATHER[weatherId];
    if (!entry) { warn(`-weather:${weatherId}`); weather = weatherId; return true; }
    const [anim, key] = entry;
    if (kw.upkeep) {

      await view.message(effectText(`weather.${key}LapseMessage`, {}, lang), { hold: 0 });
      await common(anim, fieldSide());
    } else {

      await common(anim, fieldSide());
      await say(`weather.${key}StartMessage`);
    }
    weather = weatherId;
    return true;
  }

  async function onField(kind, a, kw) {
    const effect = effectOf(a[0]);
    const terrain = TERRAIN[effect.id];
    if (terrain) {
      if (kind === '-fieldstart') { await common(`${terrain}-terrain`, fieldSide()); await say(`terrain.${terrain}StartMessage`); }
      else await say(`terrain.${terrain}ClearMessage`);
      return true;
    }
    const field = FIELD[effect.id];
    if (field) {
      const ident = typeof kw.of === 'string' ? kw.of : null;
      await say(`arena-tag.${field}${kind === '-fieldstart' ? 'OnAdd' : 'OnRemove'}`, ident ? nv(ident) : {});
      return true;
    }
    warn(`${kind}:${effect.id}`);
    return true;
  }

  async function onSide(kind, a) {
    const side = positionOf(a[0]), effect = effectOf(a[1]);
    if (GUARD.has(effect.id)) {
      if (kind === '-sidestart') await say(`arena-tag.conditionalProtectOnAdd${sideKey(side)}`, { moveName: names.move(effect.id) });
      return true;
    }
    const key = SIDE[effect.id];
    if (!key) { warn(`${kind}:${effect.id}`); return true; }
    await say(`arena-tag.${key}${kind === '-sidestart' ? 'OnAdd' : 'OnRemove'}${sideKey(side)}`);
    return true;
  }

  async function changeForm(ident, speciesName, { instant = false, message = true, from = null } = {}) {
    const side = positionOf(ident), mon = ledger.get(ident);
    const species = battle.dex.species.get(speciesName);
    if (!species?.exists) { warn(`form:${id(speciesName)}`); return; }
    const preName = affix(mon.name, side);
    const { speciesId, spriteId, shiny, gender } = mon;
    if (ledger.onField(ident)) await view.changeForm(side, { speciesId, spriteId, shiny, gender }, { instant });
    if (!message) return;

    if (/^Mega/.test(species.forme)) await say('pokemon-form-battle.megaChange', { preName, pokemonName: megaFormName(names, species) });
    else if (from?.id === 'disguise' || species.id === 'mimikyubusted') await say('pokemon-form-battle.disguiseChange');
    else if (!species.forme) await say('pokemon-form-battle.revertChange', { pokemonName: preName });
    else await say('pokemon-form-battle.formChange', { preName });
  }

  async function statusChange({ kind, args: a }) {
    const side = positionOf(a[0]), status = a[1], name = statusNames[status];
    if (!name) { warn(`${kind}:${status}`); return; }
    if (ledger.onField(a[0])) {
      await view.setStatus(side, kind === '-status' ? status : '');
      if (kind === '-status') await view.playCommon(commonNames[status], side);
    }
    await show(`status-effect.${name}.${kind === '-status' ? 'obtain' : 'heal'}`, nv(a[0]));
  }

  // Can't-move reasons with no specific entry: status; flinch; recharge; Truant
  async function cantDefault(a) {
    const reason = a[1];
    if (statusNames[reason]) {
      await show(`status-effect.${statusNames[reason]}.activation`, nv(a[0]));
      await view.playCommon(commonNames[reason], positionOf(a[0]));
    } else if (['flinch', 'recharge', 'truant'].includes(reason)) {
      const key = { flinch: 'flinchedLapse', recharge: 'rechargingLapse', truant: 'truantLapse' }[reason];
      await show(`battler-tags.${key}`, nv(a[0]));
    } else {
      warn(`cant:${reason}`);
      await show('move-trigger.cannotUseMove', { ...nv(a[0]), moveName: names.move(id(a[2] || reason.replace(/^move: /, ''))) });
    }
  }

  async function boostMessage(ident, stat, delta) {
    const keys = delta > 0 ? ['statRose_one', 'statSharplyRose_one', 'statRoseDrastically_one'] : ['statFell_one', 'statHarshlyFell_one', 'statSeverelyFell_one'];
    await say(`battle.${keys[Math.min(Math.abs(delta), 3) - 1]}`, { ...nv(ident), stats: statName(stat) });
  }

  async function present(event) {
    const { kind, args: a, kwArgs: kw } = event;
    switch (kind) {
    case 'cant': {
      const reason = effectOf(a[1]), v = nv(a[0]);
      if (reason.prefix === 'ability' && reason.id === 'truant') { await say('battler-tags.truantLapse', v); return true; }
      if (reason.prefix === 'ability') return true;
      const move = a[2] ? names.move(id(a[2])) : '';
      switch (reason.id) {
      case 'healblock': await say('battle.moveDisabledHealBlock', { ...v, moveName: move }); return true;
      case 'disable': await say('battle.disableInterruptedMove', { ...v, moveName: move || names.move(id(ledger.get(a[0]).disabled)) }); return true;
      case 'throatchop': await say('battle.throatChopInterruptedMove', v); return true;
      case 'imprison': await say('battle.moveDisabledImprison', { ...v, moveName: move }); return true;
      case 'taunt': await say('own.moveDisabledTaunt', { ...v, moveName: move }); return true;
      case 'gravity': await say('battle.moveDisabledGravity', { ...v, moveName: move }); return true;
      case 'attract': await say('battler-tags.infatuatedLapseImmobilize', v); return true;
      case 'nopp': await say('battle.moveNoPp'); return true;
      case 'focuspunch': await say('move-trigger.lostFocus', v); return true;
      default: return cantDefault(a);
      }
    }
    case '-damage': return onDamage(event);
    case '-heal': return onHeal(event);
    case '-sethp': await hp(a[0]); return true;
    case '-ability': return onAbility(a, kw);
    case '-endability': await say('move-trigger.suppressAbilities', nv(a[0])); return true;
    case '-item': return onItem(a, kw);
    case '-enditem': return onEndItem(a, kw);
    case '-activate': return onActivate(a, kw);
    case '-start': return onStart(event);
    case '-end': return onEnd(event);
    case '-singleturn': {
      const effect = effectOf(a[1]);

      if (effect.id === 'helpinghand') await say('battler-tags.helpingHandOnAdd', { pokemonNameWithAffix: nameOf(kw.of ?? a[0]), pokemonName: nameOf(a[0]) });
      else if (GUARD.has(effect.id)) await say(`arena-tag.conditionalProtectOnAdd${sideKey(positionOf(a[0]))}`, { moveName: names.move(effect.id) });
      else if (SINGLE_TURN[effect.id]) await say(SINGLE_TURN[effect.id], { ...nv(a[0]), pokemonName: label(other(positionOf(a[0]))) ?? '' });
      else if (!QUIET_VOLATILE.has(effect.id) && effect.id !== 'snatch') warn(`-singleturn:${effect.id}`);
      return true;
    }
    case '-singlemove': {
      const effect = effectOf(a[1]), v = nv(a[0]);

      if (kw.silent) return true;
      if (effect.id === 'destinybond') await say('move-trigger.tryingToTakeFoeDown', v);
      else if (effect.id === 'grudge') await say('battler-tags.grudgeOnAdd', v);
      else if (effect.id === 'rage') await say('move-trigger.rageIsBuilding', v);
      else warn(`-singlemove:${effect.id}`);
      return true;
    }
    case '-weather': return onWeather(a, kw);
    case '-fieldstart': case '-fieldend': return onField(kind, a, kw);
    case '-sidestart': case '-sideend': return onSide(kind, a);
    case '-swapsideconditions': {
      const mover = event.move && ledger.pokemon.get(uidOf(event.move, event.move.args[0]));
      await say('move-trigger.swapArenaTags', { pokemonName: mover?.name ?? '' });
      return true;
    }
    case '-prepare': {
      const move = id(a[1]), side = positionOf(a[0]);
      await view.playCharge(move, side, isIdent(a[2]) ? positionOf(a[2]) : other(side));

      for (const ident of [a[0], a[2]]) if (isIdent(ident) && ledger.get(ident).semiInvulnerable) await view.setHidden(positionOf(ident), true);
      if (CHARGE[move]) await say(`move-trigger.${CHARGE[move]}`, { pokemonName: nameOf(a[0]), targetName: label(other(side)) ?? '' });
      return true;
    }
    case '-anim': {
      const side = positionOf(a[0]);
      await view.playMove(id(a[1]), side, isIdent(a[2]) ? positionOf(a[2]) : side);
      return true;
    }
    case '-hitcount': await say('battle.attackHitsCount', { count: Number(a[1]) }); return true;
    case '-boost': case '-unboost': {
      if (Number(a[2]) === 0) {
        await say(kind === '-boost' ? 'battle.statWontGoAnyHigher_one' : 'battle.statWontGoAnyLower_one', { ...nv(a[0]), stats: statName(a[1]) });
        return true;
      }

      const item = itemFrom(event, { eaten: kw.from ? undefined : false });
      const delta = Number(a[2]) * (kind === '-boost' ? 1 : -1);
      await view.statStage(positionOf(a[0]), a[1], delta);
      if (item && item !== 'mirrorherb') {
        await say(`own.item${delta > 0 ? 'Boost' : 'Unboost'}${Math.min(Math.abs(delta), 3)}`, { ...nv(a[0]), itemName: names.item(item), stats: statName(a[1]) });
      } else {
        const keys = delta > 0 ? ['statRose_one', 'statSharplyRose_one', 'statRoseDrastically_one'] : ['statFell_one', 'statHarshlyFell_one', 'statSeverelyFell_one'];
        await show(`battle.${keys[Math.min(Math.abs(delta), 3) - 1]}`, { ...nv(a[0]), stats: statName(a[1]) });
      }
      return showStages(positionOf(a[0]));
    }
    case '-status': {
      const from = kw.from ? effectOf(kw.from) : null, key = `own.statusFromItem.${a[1]}`, side = positionOf(a[0]);
      if (from?.prefix !== 'item' || !ownTemplate(key)) return statusChange(event);
      await view.setStatus(side, a[1]);
      await view.playCommon(commonNames[a[1]], side);
      await say(key, { ...nv(a[0]), itemName: names.item(from.id) });
      return true;
    }
    case '-curestatus': {
      const item = itemFrom(event, { eaten: true }), key = `own.cureFromItem.${a[1] === 'tox' ? 'psn' : a[1]}`, side = positionOf(a[0]);
      if (!item || !ownTemplate(key) || !ledger.onField(a[0])) return statusChange(event);
      await view.setStatus(side, '');
      await say(key, { ...nv(a[0]), itemName: names.item(item) });
      return true;
    }
    case '-setboost': {
      const side = positionOf(a[0]), stat = a[1], delta = Number(a[2]) - (event.before.boosts[stat] || 0);
      if (delta) await view.statStage(side, stat, delta);
      await showStages(side);
      const from = kw.from ? effectOf(kw.from) : null;
      if (from?.id === 'bellydrum') await say('move-trigger.cutOwnHpAndMaximizedStat', { pokemonName: nameOf(a[0]), statName: statName(stat) });
      else if (delta) await boostMessage(a[0], stat, delta);
      return true;
    }
    case '-clearallboost':
      for (const side of fieldPositions(battle)) await showStages(side);
      if (!kw.silent) await say('move-trigger.statEliminated');
      return true;
    case '-clearboost': {
      await showStages(positionOf(a[0]));
      if (!kw.silent) await say('move-trigger.resetStats', { pokemonName: nameOf(a[0]) });
      return true;
    }
    case '-clearnegativeboost':
      await showStages(positionOf(a[0]));
      return true;
    case '-clearpositiveboost': {
      await showStages(positionOf(a[0]));
      if (isIdent(a[1])) await say('move-trigger.stealPositiveStats', { pokemonName: nameOf(a[1]), targetName: nameOf(a[0]) });
      return true;
    }
    case '-invertboost': {
      await showStages(positionOf(a[0]));
      await say('move-trigger.invertStats', { pokemonName: nameOf(a[0]) });
      return true;
    }
    case '-copyboost': {
      await showStages(positionOf(a[0]));
      await say('move-trigger.copiedStatChanges', { pokemonName: nameOf(a[0]), targetName: nameOf(a[1]) });
      return true;
    }
    case '-swapboost': {
      const list = a[2] ? a[2].split(/,\s*/).filter(Boolean) : BOOSTS;
      await showStages(positionOf(a[0])); await showStages(positionOf(a[1]));
      if (a[2] && list.length === 2) await say('move-trigger.switchedTwoStatChanges', { pokemonName: nameOf(a[0]), firstStat: statName(list[0]), secondStat: statName(list[1]) });
      else await say('move-trigger.switchedStatChanges', { pokemonName: nameOf(a[0]) });
      return true;
    }
    case '-transform': {
      const side = positionOf(a[0]), target = ledger.get(a[1]);
      if (target.speciesId) await view.changeForm(side, { speciesId: target.speciesId, spriteId: target.spriteId, shiny: target.shiny, gender: target.gender }, { instant: true });
      await showStages(side);
      const from = kw.from ? effectOf(kw.from) : null;
      if (from?.prefix === 'ability') await say('ability-trigger.postSummonTransform', { ...nv(a[0]), targetName: nameOf(a[1]) });
      else await say('move-trigger.transformedIntoTarget', { pokemonName: nameOf(a[0]), targetName: nameOf(a[1]) });
      return true;
    }
    case '-formechange':
      await changeForm(a[0], a[1], { instant: !!kw.silent, message: !kw.silent, from: kw.from ? effectOf(kw.from) : null });
      return true;
    case 'detailschange':
      await changeForm(a[0], a[1].split(', ')[0], { message: !kw.silent });
      return true;
    case '-fail': {
      const effect = effectOf(a[1]), from = kw.from ? effectOf(kw.from) : null, v = nv(a[0]);
      if (from?.prefix === 'ability' && effect.id === 'unboost') {
        if (a[2]) await say('ability-trigger.protectStat', { ...v, abilityName: names.ability(from.id), statName: statName(a[2]) });
        else await say('ability-trigger.intimidateImmunity', { ...v, abilityName: names.ability(from.id) });
        return true;
      }
      if (effect.id === 'substitute') {
        await say(kw.weak ? 'move-trigger.substituteNotEnoughHp' : 'move-trigger.substituteOnOverlap', { pokemonName: v.pokemonName });
        return true;
      }
      if (effect.id === 'heal') { await say('battle.hpIsFull', { pokemonName: v.pokemonName }); return true; }

      if (from?.prefix === 'item' && effect.id === 'unboost') { await say('own.clearAmulet', { ...v, itemName: names.item(from.id) }); return true; }
      if (statusNames[effect.id] && !from) { await say(`status-effect.${statusNames[effect.id]}.overlap`, v); return true; }
      return show('battle.attackFailed');
    }
    case '-block': {
      const effect = effectOf(a[1]);
      if (effect.prefix !== 'item') return true;

      if (effect.id === 'abilityshield') await say('own.abilityShield', { ...nv(a[0]), itemName: names.item(effect.id) });
      else { warn(`-block:${effect.id}`); await sourceSay(a[0], effect); }
      return true;
    }
    case '-nothing': await say('move-trigger.splash'); return true;
    case '-notarget': await show('battle.attackFailed'); return true;
    default:
    }
  }

  return { present, bar: manageBar, cue, flush: hideBar };
}
