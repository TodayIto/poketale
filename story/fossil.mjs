import { norm } from './norm.mjs';
import { placeMatcher, routeOf } from './shop.mjs';

export const LAB_TIME = 10;

export const FOSSILS = Object.freeze({
  helixfossil: { species: 'Omanyte', level: 30 },
  domefossil: { species: 'Kabuto', level: 30 },
  oldamber: { species: 'Aerodactyl', level: 30 },
  rootfossil: { species: 'Lileep', level: 20 },
  clawfossil: { species: 'Anorith', level: 20 },
  skullfossil: { species: 'Cranidos', level: 20 },
  armorfossil: { species: 'Shieldon', level: 20 },
  coverfossil: { species: 'Tirtouga', level: 25 },
  plumefossil: { species: 'Archen', level: 25 },
  jawfossil: { species: 'Tyrunt', level: 20 },
  sailfossil: { species: 'Amaura', level: 20 },
});

const FOSSIL_TOPS = Object.freeze(['fossilizedbird', 'fossilizedfish']);
const FOSSIL_BOTTOMS = Object.freeze(['fossilizeddrake', 'fossilizeddino']);
const COMBOS = Object.freeze({
  'fossilizedbird+fossilizeddrake': 'Dracozolt', 'fossilizedbird+fossilizeddino': 'Arctozolt',
  'fossilizedfish+fossilizeddrake': 'Dracovish', 'fossilizedfish+fossilizeddino': 'Arctovish',
});
export const COMBO_LEVEL = 10;

export const COMBO_PERFECT_IVS = 3;

export const isFossil = id => Object.hasOwn(FOSSILS, id) || FOSSIL_TOPS.includes(id) || FOSSIL_BOTTOMS.includes(id);

export const isHalf = id => FOSSIL_TOPS.includes(id) || FOSSIL_BOTTOMS.includes(id);

export const halvesFor = id => (FOSSIL_TOPS.includes(id) ? FOSSIL_BOTTOMS : FOSSIL_BOTTOMS.includes(id) ? FOSSIL_TOPS : []);

export function revivalOf(items) {
  if (!Array.isArray(items)) return null;
  if (items.length === 1) return Object.hasOwn(FOSSILS, items[0]) ? { ...FOSSILS[items[0]] } : null;
  if (items.length !== 2) return null;
  const top = items.find(id => FOSSIL_TOPS.includes(id)), bottom = items.find(id => FOSSIL_BOTTOMS.includes(id));
  return top && bottom ? { species: COMBOS[`${top}+${bottom}`], level: COMBO_LEVEL, perfectIvs: COMBO_PERFECT_IVS } : null;
}

export const bagFossils = bag => Object.keys(bag ?? {}).filter(id => bag[id] > 0 && isFossil(id));

export const labFossils = bag => bagFossils(bag).filter(id => !isHalf(id) || halvesFor(id).some(other => bag[other] > 0));

export const LABS = Object.freeze([
  { id: 'cinnabar', regions: ['kanto'], ko: '홍련섬', en: 'Cinnabar Island', names: ['홍련섬', '홍련마을', 'Cinnabar Island'] },
  { id: 'pewter', regions: ['kanto'], ko: '회색시티', en: 'Pewter City', names: ['회색시티', 'Pewter City'] },
  { id: 'sevii', regions: ['kanto'], ko: '1의 섬', en: 'One Island', names: ['1의 섬', 'One Island'] },
  { id: 'alph', regions: ['johto'], ko: '알프의 유적', en: 'Ruins of Alph', names: ['알프의 유적', 'Ruins of Alph'] },
  { id: 'goldenrod', regions: ['johto'], ko: '금빛시티', en: 'Goldenrod City', names: ['금빛시티', 'Goldenrod City'] },
  { id: 'rustboro', regions: ['hoenn'], ko: '금탄도시', en: 'Rustboro City', names: ['금탄도시', 'Rustboro City', '데봉코퍼레이션', 'Devon Corporation'] },
  { id: 'oreburgh', regions: ['sinnoh'], ko: '무쇠시티', en: 'Oreburgh City', names: ['무쇠시티', 'Oreburgh City', '탄갱박물관', 'Mining Museum'] },
  { id: 'nacrene', regions: ['unova'], ko: '칠보시티', en: 'Nacrene City', names: ['칠보시티', 'Nacrene City'] },
  { id: 'ambrette', regions: ['kalos'], ko: '가라마을', en: 'Ambrette Town', names: ['가라마을', 'Ambrette Town'] },
  { id: 'route8', regions: ['alola'], ko: '8번도로', en: 'Route 8', route: 8 },
  { id: 'route6', regions: ['galar'], ko: '6번도로', en: 'Route 6', route: 6 },
  { id: 'dojo', regions: ['galar'], ko: '마스터 도장', en: 'Master Dojo', names: ['마스터 도장', 'Master Dojo'] },
  { id: 'freezington', regions: ['galar'], ko: '프리즈마을', en: 'Freezington', names: ['프리즈마을', 'Freezington'] },
  { id: 'mesagoza', regions: ['paldea'], ko: '테이블시티', en: 'Mesagoza', names: ['테이블시티', 'Mesagoza'] },
  { id: 'kitakamihall', regions: ['kitakami', 'paldea'], ko: '북신센터', en: 'Kitakami Hall', names: ['북신센터', 'Kitakami Hall'] },
  { id: 'blueberry', regions: ['paldea', 'unova'], ko: '블루베리 아카데미', en: 'Blueberry Academy',
    names: ['블루베리 아카데미', '블루베리 학원', 'Blueberry Academy', '테라리움', 'Terarium'] },
  { id: 'jubilife', regions: ['hisui'], ko: '축복마을', en: 'Jubilife Village', names: ['축복마을', 'Jubilife Village'] },
].map(lab => Object.freeze(lab)));
const LAB_BY_ID = new Map(LABS.map(lab => [lab.id, lab]));
const MATCHERS = new Map(LABS.map(lab => [lab.id, lab.route ? [place => routeOf(place) === lab.route] : lab.names.map(placeMatcher)]));
const isLab = (lab, places) => MATCHERS.get(lab.id).some(match => places.some(match));

export function labAt(status) {
  const region = status?.region ?? null;
  const places = [status?.location, status?.site].filter(place => norm(place));
  if (!places.length) return { open: true, lab: null };
  if (!region) return { open: true, lab: LABS.find(lab => isLab(lab, places)) ?? null };
  const lab = LABS.find(one => one.regions.includes(region) && isLab(one, places)) ?? null;
  return { open: !!lab, lab };
}

export const labHere = status => labAt(status).open;

export const labName = (id, lang) => { const lab = LAB_BY_ID.get(id); return lab ? (lang === 'ko' ? lab.ko : lab.en) : ''; };

export const isLabId = id => LAB_BY_ID.has(id);

export const labOf = state => (Array.isArray(state?.lab) ? state.lab : []);
