import { seededIndex, norm, LOOK_GENDER } from './blocks.mjs';
import { namedTrainer, namedGender, personalName, cardFace, cardSheet, plainTrainerSprite } from './named.mjs';
import { classKeyword, styleCell, defaultCell, poolCard, POOL } from './trainer-pool.mjs';
import { compatTrainerGender } from './compat.mjs';
import { coloredSprite, showsHair } from './trainer-colors.mjs';

export function opponentGender(battle, chat = null) {
  if (!battle || battle.wild) return null;
  if (battle.gender) return battle.gender;
  const named = namedTrainer(battle);
  return named ? namedGender(named) : compatTrainerGender(chat);
}

export const LOOK_PICTURES = Object.freeze({
  boy: [
    ['youngster_m', 'youngster', '반바지·모자 평상복의 동네 소년'],
    ['school_kid_m', 'schoolkid', '셔츠에 책가방 — 학교 다니는 소년 (직업이 아니라 나이대)'],
  ],
  girl: [
    ['youngster_f', 'lass', '치마 평상복의 소녀 (PokeRogue 꼬마 트레이너의 여자 그림)'],
    ['school_kid_f', 'schoolkidf', '원피스에 가방 — 어린 여자아이'],
  ],
  young_man: [
    ['ace_trainer_m', 'acetrainer', '모습 칸이 없을 때의 기본 그림과 같은 무난한 청년'],
    ['backpacker_m', 'backpacker', '배낭 멘 여행 차림 — 길에서 만나는 청년'],
    ['rich_kid_m', 'richboy', '흰 셔츠·바지의 단정한 청년'],
  ],
  young_woman: [
    ['ace_trainer_f', 'acetrainerf', '모습 칸이 없을 때의 기본 그림과 같은 무난한 젊은 여성'],
    ['aroma_lady', 'aromalady', '블라우스에 긴 치마 — 차분한 평상복'],
    ['rich_kid_f', 'lady', '원피스에 모자 — 나들이 차림'],
  ],
  middle_aged_man: [
    ['pokefan_m', 'pokefan', '티셔츠·청바지의 푸근한 아저씨'],
    ['veteran_m', 'veteran', '코트에 모자 — 나이 지긋한 장년 남성'],
    ['clerk_m_2', 'clerk-boss', '조끼 정장의 반백 아저씨 (회사원 상사)'],
  ],
  middle_aged_woman: [
    ['veteran_f', 'veteranf', '검은 원피스의 장년 여성'],
    ['pokefan_f', 'pokefanf', '평상복 여성 — PokeRogue 에 중년 여성 평상복 그림이 적어 둘만'],
  ],
  old_man: [['rich_m', 'gentleman', '지팡이 짚은 노신사 — PokeRogue 에 평상복 노인 그림은 이것뿐']],
  old_woman: [['rich_f', 'madame', '흰머리 노부인 — PokeRogue 에 평상복 할머니 그림은 이것뿐']],
});

export const SILHOUETTE_PICTURES = LOOK_PICTURES;

export const nameless = battle => !personalName(battle);

export function lookPicture({ look, name, trainerClass, colors } = {}, { key = null, table = LOOK_PICTURES } = {}) {
  const list = hairRows(table[look], colors);
  if (!list) return null;
  const seed = norm(personalName({ name, trainerClass })) || key || '';
  const [sprite, face] = list[seededIndex(seed, list.length)];
  return { sprite, face };
}

function hairRows(rows, colors) {
  if (!rows || !colors?.hair) return rows;
  const shown = rows.filter(([sprite]) => showsHair(sprite));
  return shown.length ? shown : rows;
}

const painted = (picture, colors, battle) => (colors && picture.sprite && !picture.silhouette && !picture.named
  ? { ...picture, sprite: coloredSprite(picture.sprite, colors, styled(battle)) } : picture);

const faceOf = sprite => Object.values(LOOK_PICTURES).flat().find(row => row[0] === sprite)?.[1] ?? null;

export function opponentPicture(battle, options = {}) {
  const picture = basePicture(battle, options);
  return picture.named ? withoutMark(picture) : painted(picture, battle?.colors, battle);
}

function basePicture(battle, { key = null, silhouette = false, chat = null, player = null } = {}) {
  if (!battle || battle.wild) return { sprite: null, face: null };
  const named = namedTrainer(battle);
  if (named) return { ...namedPicture(named), named: true };
  if (styled(battle)) return styledPicture(battle, { key, silhouette, chat, player });
  const picture = lookPicture(battle, { key, table: silhouette ? SILHOUETTE_PICTURES : LOOK_PICTURES });
  const sprite = picture?.sprite ?? plainTrainerSprite(opponentGender(battle, chat));
  return silhouette ? { sprite, face: picture?.face ?? faceOf(sprite), silhouette: true } : { sprite, face: picture?.face ?? null };
}

const withoutMark = ({ named, ...picture }) => picture;

function namedPicture(named) {
  const face = cardFace(named);
  return face ? { sprite: named, face } : { sprite: named, face: null, sheet: cardSheet(named) };
}

export const opponentPictureWithGender = (battle, options = {}) => ({ ...opponentPicture(battle, options), gender: opponentGender(battle, options.chat) });

export function foePartnerPicture(battle, options = {}) {
  const second = battle.foePartner;
  if (battle.wild) return { sprite: null, face: null, gender: null };
  const named = namedTrainer(nameIn(battle, second.name));
  if (named) return { ...namedPicture(named), gender: namedGender(named) };

  const first = { ...withoutMark(basePicture(battle, options)), gender: opponentGender(battle, options.chat) };
  const firstNamed = !!namedTrainer(battle);

  const secondName = norm(personalName(nameIn(battle, second.name))), firstName = norm(personalName(battle));

  const sameName = !!secondName && secondName === firstName && (!second.look || second.look === battle.look);
  const sameLook = !secondName && !!second.look && second.look === battle.look;
  if (!firstNamed && (sameName || sameLook)) return painted(first, second.colors ?? battle.colors, battle);
  const { key = null, silhouette = false } = options;
  const table = silhouette ? SILHOUETTE_PICTURES : LOOK_PICTURES;
  const firstLook = firstNamed ? null : battle.look;
  const look = second.look
    ?? (second.gender ? (firstLook && LOOK_GENDER[firstLook] === second.gender ? firstLook : YOUNG[second.gender]) : firstLook);
  if (styled(battle)) {
    const list = poolList({ look, style: second.style, colors: second.colors, gender: second.gender }, options.player);
    if (list.length) {
      const sprite = secondPick(battle, key, list, s => s === first.sprite);
      if (sprite) return painted({ sprite, ...poolCard(sprite), ...(silhouette ? { silhouette: true } : {}), gender: second.gender ?? LOOK_GENDER[look] }, second.colors, battle);
    }
  }
  const rows = styled(battle) ? [] : hairRows((look && table[look]) || [], second.colors);
  if (rows.length) {
    const [sprite, face] = secondPick(battle, key, rows, row => row[0] === first.sprite) ?? [];
    if (sprite) return painted({ sprite, face, ...(silhouette ? { silhouette: true } : {}), gender: second.gender ?? LOOK_GENDER[look] }, second.colors, battle);
  }
  const own = second.gender && plainTrainerSprite(second.gender) !== first.sprite ? second.gender : (first.gender === 'F' ? 'M' : 'F');
  const sprite = plainTrainerSprite(own);
  return silhouette ? { sprite, face: faceOf(sprite), silhouette: true, gender: own } : painted({ sprite, face: null, gender: own }, second.colors, battle);
}

const secondPick = (battle, key, list, first) => {
  const at = seededIndex(norm(personalName(nameIn(battle, battle.foePartner.name))) || `${key ?? ''}:2`, list.length);
  return [list[at], list[(at + 1) % list.length]].find(item => !first(item));
};

const nameIn = (battle, name) => ({ name, oldTitles: !!battle.oldTitles, oldJapanese: !!battle.oldJapanese });

const YOUNG = Object.freeze({ M: 'young_man', F: 'young_woman' });

export function partnerPicture(battle) {
  const named = namedTrainer(nameIn(battle, battle.partner.name));
  return named ? { ...namedPicture(named), gender: namedGender(named) } : { sprite: null, face: null, gender: null };
}

// -- The mob picture table (rule mobStyles) --------------------------------

const styled = battle => Array.isArray(battle?.style);

const PLAYER_PICTURES = Object.freeze({ m: Object.freeze(['player_m', 'player_m_alternate']), f: Object.freeze(['player_f', 'player_f_alternate']) });
const playerPictures = player => PLAYER_PICTURES[player === 'f' ? 'f' : 'm'];

export function poolList({ look, style = [], colors, gender = null } = {}, player = null) {
  if (!look) return [];
  const own = playerPictures(player);
  const ofGender = list => {
    const some = gender ? list.filter(sprite => !POOL[sprite].gender || POOL[sprite].gender === gender) : list;
    return some.length ? some : list;
  };
  const usable = list => {
    const free = ofGender(list).filter(sprite => !own.includes(sprite));
    const shown = colors?.hair ? free.filter(sprite => showsHair(sprite, true)) : free;
    return shown.length ? shown : free;
  };
  for (const one of style ?? []) {
    const list = usable(styleCell(look, one));
    if (list.length) return list;
  }
  return usable(defaultCell(look));
}

function styledPicture(battle, { key, silhouette, chat, player }) {
  const gender = opponentGender(battle, chat);
  const keyword = classKeyword(battle.trainerClass);
  let sprite = keyword ? (gender ? keyword[gender] : keyword.M ?? keyword.F) : null;
  if (!sprite) {
    const list = poolList({ ...battle, gender }, player);
    if (list.length) sprite = list[seededIndex(norm(personalName(battle)) || key || '', list.length)];
  }
  const mark = silhouette ? { silhouette: true } : {};
  if (sprite) return { sprite, ...poolCard(sprite), ...mark };
  const plain = plainTrainerSprite(gender);
  return { sprite: plain, face: silhouette ? poolCard(plain).face : null, ...mark };
}
