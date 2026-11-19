import { toID } from './sources.mjs';

export const EN_FIXES = { necrozmaduskmane: 'Dusk Mane Necrozma', necrozmadawnwings: 'Dawn Wings Necrozma' };

export const API_FORM_ALIASES = {
  necrozmaduskmane: 'necrozma-dusk', necrozmadawnwings: 'necrozma-dawn', darmanitangalar: 'darmanitan-galar-standard',
  indeedeef: 'indeedee-female', meowsticf: 'meowstic-female', basculegionf: 'basculegion-female', oinkolognef: 'oinkologne-female',
  mausholdfour: 'maushold-family-of-four', squawkabillyblue: 'squawkabilly-blue-plumage', squawkabillyyellow: 'squawkabilly-yellow-plumage',
  squawkabillywhite: 'squawkabilly-white-plumage', taurospaldeacombat: 'tauros-paldea-combat-breed', taurospaldeablaze: 'tauros-paldea-blaze-breed',
  taurospaldeaaqua: 'tauros-paldea-aqua-breed', ogerponwellspring: 'ogerpon-wellspring-mask', ogerponhearthflame: 'ogerpon-hearthflame-mask',
  ogerponcornerstone: 'ogerpon-cornerstone-mask', toxtricitygmax: 'toxtricity-amped-gmax', urshifugmax: 'urshifu-single-strike-gmax',
  mimikyutotem: 'mimikyu-totem-disguised', mimikyubustedtotem: 'mimikyu-totem-busted', raticatealolatotem: 'raticate-totem-alola',
  marowakalolatotem: 'marowak-totem', greninjabond: 'greninja-battle-bond', miniormeteor: 'minior-red-meteor',
  meowsticmmega: 'meowstic-male-mega', meowsticfmega: 'meowstic-female-mega',
  pikachuoriginal: 'pikachu-original-cap', pikachuhoenn: 'pikachu-hoenn-cap', pikachusinnoh: 'pikachu-sinnoh-cap', pikachuunova: 'pikachu-unova-cap',
  pikachukalos: 'pikachu-kalos-cap', pikachualola: 'pikachu-alola-cap', pikachupartner: 'pikachu-partner-cap', pikachuworld: 'pikachu-world-cap',
};

const KEEP_DEFAULT_WORDS = new Set(['tatsugiricurlymega']);
const REGIONS_EN = { Alola: 'Alolan', Galar: 'Galarian', Hisui: 'Hisuian', Paldea: 'Paldean' };
const REGIONS_KO = ['알로라', '가라르', '히스이', '팔데아'];

const TYPE_FORMS = new Set(['Arceus', 'Silvally']);

const hasParen = text => /[()]/.test(text);

const cleanLabel = label => label.trim().replace(/(?:의|\s)\s*(?:모습|모양)$/, '').trim();

function derivedEn(s, baseEn) {
  const words = s.forme.split('-').filter(Boolean);
  const region = words.filter(w => REGIONS_EN[w]).map(w => REGIONS_EN[w]);
  const rest = words.filter(w => !REGIONS_EN[w]).map(w => (w === 'Gmax' ? 'Gigantamax' : w));
  return [...rest, ...region, baseEn].join(' ');
}

function withoutDefaultWords(en, baseForme) {
  if (!baseForme || /^[MF]$/.test(baseForme)) return null;
  const words = baseForme.split('-').map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const dropped = en.replace(new RegExp(`(^|\\s)${words.join('[\\s-]')}(?=\\s|$)`), '$1').replace(/\s+/g, ' ').trim();
  return dropped !== en ? dropped : null;
}

const unparenEn = text => { const m = /^(.*?)\s*\(([^()]+)\)$/.exec(text); return m ? `${m[2]} ${m[1]}` : null; };

function derivedKo(label, baseKo) {
  const parts = label.split('/').map(cleanLabel).filter(Boolean);
  const region = parts.filter(p => REGIONS_KO.includes(p)), rest = parts.filter(p => !REGIONS_KO.includes(p));

  rest.sort((a, b) => (b === '거다이맥스') - (a === '거다이맥스'));
  return [...rest, ...region, baseKo].join(' ');
}

export function aiFormNames({ species, Dex, csv, dexKo, speciesWithCosmeticFormes }) {
  const formNames = new Map();
  for (const r of csv('pokemon_form_names.csv')) {
    if (r.local_language_id !== '3' && r.local_language_id !== '9') continue;
    const o = formNames.get(r.pokemon_form_id) ?? {};
    o[r.local_language_id === '3' ? 'ko' : 'en'] = { form: r.form_name, full: r.pokemon_name };
    formNames.set(r.pokemon_form_id, o);
  }
  const speciesOf = new Map(csv('pokemon.csv').map(r => [r.id, Number(r.species_id)]));
  const apiForms = new Map(csv('pokemon_forms.csv').map(r => [r.identifier, r]));
  const apiFormOf = s => {
    const form = apiForms.get(API_FORM_ALIASES[s.id] ?? '') ?? [...apiForms.values()].find(r => toID(r.identifier) === s.id);

    return form && speciesOf.get(form.pokemon_id) === s.num ? formNames.get(form.id) ?? null : null;
  };
  const dexById = new Map(dexKo.filter(e => e.id).map(e => [e.id, e]));

  const unmatchedMega = num => {
    const megas = [...new Set(dexKo.filter(e => !e.id && e.num === num && /^메가/.test(e.name)).map(e => e.name))];
    return megas.length === 1 ? megas[0] : null;
  };

  const table = {}, report = { cosmetic: [], en: {}, ko: {} };
  const cosmeticOf = new Map();
  for (const s of speciesWithCosmeticFormes(Dex)) {
    const base = Dex.species.get(s.baseSpecies);
    if (s.id !== base.id && (base.cosmeticFormes ?? []).includes(s.name)) cosmeticOf.set(s.id, { s, base: base.id });
  }
  const tableLabel = record => /\(([^()]+)\)$/.exec(record?.ko ?? '')?.[1] ?? null;

  const koName = (s, record, baseKo) => {
    if (!baseKo) return { ko: null, src: 'none' };
    if (s.forme.endsWith('Totem') && s.forme !== 'Totem') {
      const of = Dex.species.get(s.name.replace(/-Totem$/, ''));
      if (of.exists && species[of.id]?.base) return koName(of, species[of.id], baseKo);
    }
    if (TYPE_FORMS.has(s.baseSpecies)) return { ko: baseKo, src: 'base' };
    const dex = dexById.get(s.id), api = apiFormOf(s)?.ko?.form || null, rogue = tableLabel(record);
    const megaName = /Mega|Primal/.test(s.forme) ? (dex?.name !== baseKo ? dex?.name : null) ?? unmatchedMega(s.num) : null;
    if (megaName) return { ko: megaName, src: 'dex-ko' };
    if (dex?.form?.includes(baseKo)) return { ko: dex.form, src: 'dex-ko' };
    if (api?.includes(baseKo)) return { ko: api, src: 'pokeapi' };
    if (rogue?.includes(baseKo)) return { ko: rogue, src: 'pokerogue' };
    const label = dex?.form || api || rogue;
    return label ? { ko: derivedKo(label, baseKo), src: `derived:${dex?.form ? 'dex-ko' : api ? 'pokeapi' : 'pokerogue'}` } : { ko: baseKo, src: 'base' };
  };

  for (const [id, record] of Object.entries(species)) {
    if (!record.base) continue;
    if (cosmeticOf.has(id)) { table[id] = { as: record.base }; report.cosmetic.push(id); continue; }
    const s = Dex.species.get(id), base = species[record.base];
    if (/-Tera$/.test(s.forme)) {
      const before = toID(s.name.replace(/-(Teal-)?Tera$/, ''));
      table[id] = { as: species[before]?.base ? before : record.base };
      report.tera = [...(report.tera ?? []), id];
      continue;
    }
    const full = apiFormOf(s)?.en?.full || null;
    const en = EN_FIXES[id] ? { en: EN_FIXES[id], src: 'fix' }
      : full && !hasParen(full) ? { en: full, src: 'pokeapi' }
      : full ? { en: unparenEn(full), src: 'pokeapi-unparen' }
      : { en: derivedEn(s, base.en), src: 'derived' };
    const plain = en.src === 'fix' || KEEP_DEFAULT_WORDS.has(id) ? null : withoutDefaultWords(en.en, Dex.species.get(s.baseSpecies).baseForme);
    if (plain) { en.old = [en.en]; en.en = plain; (report.defaultDropped ??= []).push(id); }
    const ko = koName(s, record, base.ko);
    if (hasParen(en.en) || hasParen(ko.ko ?? '')) throw new Error(`AI 폼 이름에 괄호: ${id} ${en.en} / ${ko.ko}`);
    table[id] = { en: en.en, ko: ko.ko, enSrc: en.src, koSrc: ko.src, ...(en.old && { old: en.old }) };
    (report.en[en.src] ??= []).push(id);
    (report.ko[ko.src] ??= []).push(id);
  }

  for (const [id, { base }] of cosmeticOf) if (!species[id] && species[base]) { table[id] = { as: base }; report.cosmetic.push(id); }
  return { table, report };
}
