import { hashKey, norm } from './blocks.mjs';
import { namedTrainer, personalName, cardFace, cardSheet, plainTrainerSprite } from './named.mjs';

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

export function lookPicture({ look, name, trainerClass } = {}, { key = null, table = LOOK_PICTURES } = {}) {
  const list = table[look];
  if (!list) return null;
  const seed = norm(personalName({ name, trainerClass })) || key || '';
  const [sprite, face] = list[parseInt(hashKey(seed), 36) % list.length];
  return { sprite, face };
}

const faceOf = sprite => Object.values(LOOK_PICTURES).flat().find(row => row[0] === sprite)?.[1] ?? null;

export function opponentPicture(battle, { key = null, silhouette = false } = {}) {
  if (!battle || battle.wild) return { sprite: null, face: null };
  const named = namedTrainer(battle);
  if (named) {
    const face = cardFace(named);
    return face ? { sprite: named, face } : { sprite: named, face: null, sheet: cardSheet(named) };
  }
  const picture = lookPicture(battle, { key, table: silhouette ? SILHOUETTE_PICTURES : LOOK_PICTURES });
  const sprite = picture?.sprite ?? plainTrainerSprite(battle.gender);
  return silhouette ? { sprite, face: picture?.face ?? faceOf(sprite), silhouette: true } : { sprite, face: picture?.face ?? null };
}
