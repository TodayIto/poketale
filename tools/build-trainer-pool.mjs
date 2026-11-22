import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = new URL('../', import.meta.url);
const OUTPUT = new URL('data/trainer-pool.json', ROOT);
const TRAINERS = new URL('vendor/pokerogue/assets/images/trainer/', ROOT);

export const STYLES = ['casual', 'formal', 'uniform', 'work', 'medical', 'sporty', 'outdoor', 'swimwear', 'winter', 'stage', 'punk', 'mystic'];
/** Styles of the "no style" pool */
export const DEFAULT_STYLES = ['casual', 'outdoor', 'sporty'];
export const LOOKS = ['boy', 'girl', 'young_man', 'young_woman', 'middle_aged_man', 'middle_aged_woman', 'old_man', 'old_woman', 'toddler'];

const STYLE_WORDS = {
  casual: ['casual', 'everyday', 'plain', 'street clothes', 't-shirt', 'tshirt', 'jeans', '평상복', '사복', '일상복', '캐주얼', '편한 옷', '티셔츠', '청바지'],
  formal: ['formal', 'suit', 'dress', 'elegant', 'fancy', 'business', 'rich', '정장', '양복', '수트', '드레스', '원피스', '나들이옷', '부잣집', '고급스러운'],
  uniform: ['uniform', 'school uniform', 'service uniform', 'staff uniform', '제복', '유니폼', '근무복', '교복', '경찰복', '승무원', '메이드복'],
  work: ['work', 'workwear', 'overalls', 'apron', 'coveralls', 'hard hat', '작업복', '앞치마', '멜빵', '안전모', '정비복'],
  medical: ['medical', 'lab coat', 'white coat', 'scrubs', 'doctor', 'scientist', '흰 가운', '가운', '의사 가운', '실험복', '수술복', '간호복'],
  sporty: ['sporty', 'sportswear', 'athletic', 'tracksuit', 'jersey', 'gym', 'dogi', '운동복', '스포츠웨어', '트레이닝복', '츄리닝', '체육복', '도복', '운동선수'],
  outdoor: ['outdoor', 'hiking', 'camping', 'explorer', 'safari', 'travel', 'backpack', '아웃도어', '등산복', '캠핑', '탐험복', '여행 차림', '배낭', '모자'],
  swimwear: ['swimwear', 'swimsuit', 'bikini', 'wetsuit', 'diving', 'beach', '수영복', '비키니', '해수욕', '잠수복', '다이빙'],
  winter: ['winter', 'coat', 'parka', 'snow gear', 'scarf', 'warm clothes', '겨울옷', '패딩', '외투', '코트', '방한복', '목도리'],
  stage: ['stage', 'performer', 'band', 'idol', 'showy', 'costume for a show', '무대 의상', '공연', '밴드', '가수', '댄서', '아이돌', '광대옷'],
  punk: ['punk', 'tough', 'leather', 'delinquent', 'thug', 'biker', 'villain', '불량', '거친 차림', '가죽', '양아치', '깡패', '폭주족', '악당'],
  mystic: ['mystic', 'cloak', 'robe', 'witch', 'occult', 'costume', 'cosplay', 'fantasy', '신비', '분장', '망토', '로브', '마녀', '오컬트', '코스튬', '코스프레', '동화', '판타지'],
};

const T = 'toddler', B = 'boy', G = 'girl', YM = 'young_man', YW = 'young_woman', MM = 'middle_aged_man', MW = 'middle_aged_woman', OM = 'old_man', OW = 'old_woman';
const PICTURES = {

  preschooler_m: [[T], ['casual', 'uniform'], 'preschooler', { gender: 'M' }],
  school_kid_m: [[B], ['casual', 'uniform'], 'schoolkid'],
  youngster_m: [[B], ['casual'], 'youngster'],
  bug_catcher: [[B], ['outdoor'], 'bugcatcher'],
  camper_m: [[B], ['outdoor', 'casual'], 'camper'],
  preschooler_f: [[T], ['casual', 'uniform'], 'preschoolerf', { gender: 'F' }],
  school_kid_f: [[G], ['casual'], 'schoolkidf'],
  youngster_f: [[G], ['casual', 'uniform'], 'lass'],
  camper_f: [[G], ['outdoor', 'casual'], 'picnicker'],
  fairy_tale_girl: [[G], ['mystic', 'formal'], null],
  ace_trainer_m: [[YM], ['casual', 'sporty'], 'acetrainer'],
  player_m: [[YM], ['casual'], null],
  player_m_2: [[YM], ['casual'], null],
  player_m_alternate: [[YM], ['casual'], null],
  clerk_m: [[YM], ['formal'], 'clerk'],
  rich_kid_m: [[YM, B], ['formal'], 'richboy'],
  depot_agent: [[YM], ['uniform'], 'depotagent'],
  waiter_m: [[YM], ['uniform', 'formal'], 'waiter'],
  bird_keeper_m: [[YM], ['work'], 'birdkeeper'],
  breeder_m: [[YM], ['work'], 'pokemonbreeder'],
  doctor_m: [[YM], ['medical'], 'doctor'],
  black_belt_m: [[YM], ['sporty'], 'blackbelt'],
  cyclist_m: [[YM], ['sporty'], 'cyclist'],
  hoopster: [[YM], ['sporty'], 'hoopster'],
  infielder: [[YM], ['sporty'], 'infielder'],
  linebacker: [[YM], ['sporty'], 'linebacker'],
  striker: [[YM], ['sporty'], 'striker'],
  backpacker_m: [[YM], ['outdoor', 'casual'], 'backpacker'],
  ranger_m: [[YM], ['outdoor'], 'pokemonranger'],
  scuba_diver_m: [[YM], ['swimwear'], null],
  swimmer_m: [[YM], ['swimwear'], 'swimmer'],
  snow_ace_trainer_m: [[YM], ['winter'], 'acetrainersnow'],
  dancer: [[YM], ['stage', 'sporty'], 'dancer'],
  harlequin: [[YM], ['stage'], 'harlequin', { keywordOnly: true }],
  musician: [[YM], ['stage'], 'musician'],
  biker: [[YM], ['punk'], 'biker'],
  roughneck: [[YM], ['punk'], 'roughneck'],
  dragon_tamer: [[YM], ['mystic'], 'dragontamer'],
  halloween_rival_m: [[YM], ['mystic'], null],
  psychic_m: [[YM], ['mystic'], 'psychic'],
  ace_trainer_f: [[YW], ['casual', 'sporty'], 'acetrainerf'],
  aroma_lady: [[YW], ['casual'], 'aromalady'],
  beauty: [[YW], ['casual'], 'beauty'],
  player_f: [[YW], ['casual'], null],
  player_f_2: [[YW], ['casual'], null],
  player_f_alternate: [[YW], ['casual'], null],
  beauty_2: [[YW], ['formal', 'stage'], 'beauty-gen5bw2'],
  clerk_f: [[YW], ['formal'], 'clerkf'],
  parasol_lady: [[YW], ['formal'], 'parasollady'],
  rich_kid_f: [[YW, G], ['formal'], 'lady'],
  maid: [[YW], ['uniform'], 'maid'],
  waiter_f: [[YW], ['uniform'], 'waitress'],
  bird_keeper_f: [[YW], ['work'], null],
  nursery_aide: [[YW], ['work'], 'nurseryaide'],
  worker_f: [[YW], ['work'], null],
  doctor_f: [[YW], ['medical', 'uniform'], 'nurse'],
  scientist_f: [[YW], ['medical'], 'scientistf'],
  black_belt_f: [[YW], ['sporty'], 'battlegirl'],
  cyclist_f: [[YW], ['sporty'], 'cyclistf'],
  smasher: [[YW], ['sporty'], 'smasher'],
  backpacker_f: [[YW], ['outdoor', 'casual'], 'backpackerf'],
  breeder_f: [[YW], ['outdoor', 'casual'], 'pokemonbreederf'],
  ranger_f: [[YW], ['outdoor'], 'pokemonrangerf'],
  scuba_diver_f: [[YW], ['swimwear'], null],
  swimmer_f: [[YW], ['swimwear'], 'swimmerf'],
  snow_ace_trainer_f: [[YW], ['winter'], 'acetrainersnowf'],
  guitarist: [[YW], ['stage', 'punk'], 'guitarist'],
  halloween_rival_f: [[YW], ['mystic'], null],
  hex_maniac: [[YW], ['mystic'], null],
  psychic_f: [[YW], ['mystic'], 'psychicf'],
  collector: [[MM], ['casual'], 'collector'],
  pokefan_m: [[MM], ['casual'], 'pokefan'],
  clerk_m_2: [[MM, OM], ['formal'], 'clerk-boss'],
  veteran_m: [[MM, OM], ['formal', 'winter'], 'veteran'],
  officer: [[MM], ['uniform'], 'policeman'],
  pilot: [[MM], ['uniform'], 'pilot'],
  sailor: [[MM], ['uniform'], 'sailor'],
  artist: [[MM], ['work'], 'artist'],
  worker_m: [[MM], ['work'], 'worker'],
  scientist_m: [[MM], ['medical'], 'scientist'],
  fisherman: [[MM], ['outdoor'], 'fisherman'],
  hiker: [[MM], ['outdoor'], 'hiker'],
  ruin_maniac: [[MM], ['outdoor'], 'ruinmaniac'],
  snow_worker_m: [[MM], ['winter', 'work'], 'workerice'],
  firebreather: [[MM], ['stage'], 'firebreather'],
  pokefan_f: [[MW], ['casual'], 'pokefanf'],
  veteran_f: [[MW], ['formal'], 'veteranf'],
  baker: [[MW], ['work'], 'baker'],
  rich_m: [[OM], ['formal'], 'gentleman'],
  janitor: [[OM, MM], ['work'], 'janitor'],
  rich_f: [[OW], ['formal'], 'madame'],
};

const KEYWORDS = {
  clown: { M: 'harlequin', F: null, words: ['clown', 'harlequin', 'jester', 'pierrot', '광대', '어릿광대', '피에로'] },
  nurse: { M: null, F: 'doctor_f', words: ['nurse', 'nursing staff', '간호사', '간호원', '간호 선생님'] },
  police: { M: 'officer', F: null, words: ['police officer', 'police', 'cop', 'policeman', '경찰', '경찰관', '순경', '형사'] },
  maid: { M: null, F: 'maid', words: ['maid', 'housekeeper', '메이드', '가정부', '하녀', '메이드 카페'] },
  fisherman: { M: 'fisherman', F: null, words: ['fisherman', 'fisher', 'angler', '낚시꾼', '어부', '강태공'] },
  cyclist: { M: 'cyclist_m', F: 'cyclist_f', words: ['cyclist', 'bicycle', 'bike rider', '자전거', '사이클 선수', '자전거 선수'] },
  biker: { M: 'biker', F: null, words: ['biker', 'motorcyclist', '폭주족', '바이커', '오토바이족', '라이더'] },
};

const TEAMS = {
  rocket: ['rocket_grunt_m', 'rocket_grunt_f', 'rocketgrunt', 'rocketgruntf', ['team rocket', 'rocket grunt', 'rocket', '로켓단', '로켓단원', '로켓단 조직원']],
  aqua: ['aqua_grunt_m', 'aqua_grunt_f', null, null, ['team aqua', 'aqua grunt', 'aqua', '아쿠아단', '아쿠아단원', '아쿠아단 조직원']],
  magma: ['magma_grunt_m', 'magma_grunt_f', null, null, ['team magma', 'magma grunt', 'magma', '마그마단', '마그마단원', '마그마단 조직원']],
  galactic: ['galactic_grunt_m', 'galactic_grunt_f', 'galacticgrunt', 'galacticgruntf', ['team galactic', 'galactic grunt', 'galactic', '갤럭시단', '갤럭시단원', '갤럭시단 조직원']],
  plasma: ['plasma_grunt_m', 'plasma_grunt_f', 'plasmagrunt', 'plasmagruntf', ['team plasma', 'plasma grunt', 'plasma', '플라스마단', '플라즈마단', '플라스마단원', '플라즈마단원']],
  flare: ['flare_grunt_m', 'flare_grunt_f', null, null, ['team flare', 'flare grunt', 'flare', '플레어단', '플레어단원', '플레어단 조직원']],
  skull: ['skull_grunt_m', 'skull_grunt_f', null, null, ['team skull', 'skull grunt', 'skull', '스컬단', '스컬단원', '스컬단 조직원']],
  aether: ['aether_grunt_m', 'aether_grunt_f', null, null, ['aether foundation', 'aether employee', 'aether', '에테르재단', '에테르 재단', '에테르 재단 직원', '에테르 직원']],
  macro: ['macro_grunt_m', 'macro_grunt_f', null, null, ['macro cosmos', 'macrocosmos', 'macro cosmos staff', '매크로코스모스', '매크로 코스모스', '매크로코스모스 직원']],
  star: ['star_grunt_m', 'star_grunt_f', null, null, ['team star', 'star grunt', '스타단', '스타단원', '스타단 단원']],
};

const PAIRS = ['backers_f', 'backers_m', 'hooligans', 'interviewers', 'twins', 'young_couple'];
const EXCLUDED = ['benga', 'emmet', 'hugh', 'ingo', 'nate', 'rood', 'rosa', 'rocket_boss_giovanni_1', 'bug_type_superfan', 'expert_pokemon_breeder',
  'jacinthe_holo', 'mysterious_sisters', 'snow_worker', 'snow_worker_f', 'unknown_f', 'unknown_m'];

function handTable() {
  const pictures = {};
  for (const [sprite, [looks, styles, face, flags = {}]] of Object.entries(PICTURES)) pictures[sprite] = { looks, styles, face, ...flags };
  for (const [team, [m, f, faceM, faceF]] of Object.entries(TEAMS)) {
    pictures[m] = { looks: [YM], styles: [], face: faceM, keywordOnly: true, team };
    pictures[f] = { looks: [YW], styles: [], face: faceF, keywordOnly: true, team };
  }
  const keywords = { ...KEYWORDS, ...Object.fromEntries(Object.entries(TEAMS).map(([team, [m, f, , , words]]) => [team, { M: m, F: f, words, team: true }])) };
  return { styles: STYLES, defaultStyles: DEFAULT_STYLES, styleWords: STYLE_WORDS, pictures, keywords };
}

/** Problems with the hand table (empty = fine) */
export function checkHand(table) {
  const problems = [];
  const sprites = Object.keys(table.pictures);
  const files = new Set(readdirSync(TRAINERS).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)));
  for (const [sprite, p] of Object.entries(table.pictures)) {
    if (!files.has(sprite)) problems.push(`${sprite}: no PokeRogue picture`);
    if (!p.looks.length || p.looks.length > 2 || !p.looks.every(l => LOOKS.includes(l))) problems.push(`${sprite}: looks ${p.looks}`);
    if (p.styles.length > 2 || !p.styles.every(s => STYLES.includes(s)) || (!p.keywordOnly && !p.styles.length)) problems.push(`${sprite}: styles ${p.styles}`);
  }
  for (const [id, k] of Object.entries(table.keywords)) for (const g of ['M', 'F']) if (k[g] && !table.pictures[k[g]]) problems.push(`keyword ${id}: ${k[g]}`);
  for (const sprite of [...PAIRS, ...EXCLUDED]) if (!files.has(sprite)) problems.push(`${sprite}: no PokeRogue picture`);
  const all = [...sprites, ...PAIRS, ...EXCLUDED];
  if (new Set(all).size !== all.length) problems.push('a picture is listed twice');
  if (sprites.length !== 111) problems.push(`${sprites.length} pictures, not 111`);
  if (all.length !== 133) problems.push(`${all.length} mob pictures, not 133`);
  // a keyword-only picture is reached by its keyword
  for (const [sprite, p] of Object.entries(table.pictures)) {
    if (p.keywordOnly && !Object.values(table.keywords).some(k => k.M === sprite || k.F === sprite)) problems.push(`${sprite}: keyword only, no keyword`);
  }
  return problems;
}

async function firstFrame(sprite) {
  const atlas = JSON.parse(readFileSync(new URL(`${sprite}.json`, TRAINERS), 'utf8'));
  const texture = atlas.textures?.[0] ?? atlas;
  const frames = Array.isArray(texture.frames) ? texture.frames : Object.entries(texture.frames).map(([filename, f]) => ({ filename, ...f }));
  const first = frames.filter(f => /^\d{4}\.png$/.test(f.filename)).sort((a, b) => a.filename.localeCompare(b.filename))[0];
  if (!first || first.rotated) throw new Error(`${sprite}: first frame unreadable`);
  const size = texture.size ?? atlas.meta?.size, SCENE = 80;
  const W = Math.max(SCENE, first.sourceSize.w), H = Math.max(SCENE, first.sourceSize.h);
  const at = [first.spriteSourceSize.x + Math.floor((W - first.sourceSize.w) / 2), first.spriteSourceSize.y + (H - first.sourceSize.h)];
  const [x, y, w, h] = await imageBounds(readFileSync(new URL(`${sprite}.png`, TRAINERS)), { left: first.frame.x, top: first.frame.y, width: first.frame.w, height: first.frame.h });
  return [x, y, w, h, size.w, size.h, at[0] + x - first.frame.x, at[1] + y - first.frame.y, W, H];
}

async function imageBounds(bytes, region = null) {
  const image = sharp(bytes);
  if (region) image.extract(region);
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width, top = info.height, right = 0, bottom = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (!data[(y * info.width + x) * info.channels + info.channels - 1]) continue;
    left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
  }
  if (right <= left || bottom <= top) throw new Error('empty picture');
  return [left + (region?.left ?? 0), top + (region?.top ?? 0), right - left, bottom - top, info.width, info.height];
}

async function buildTable(previous, { fetchFaces }) {
  const table = handTable();
  const problems = checkHand(table);
  if (problems.length) throw new Error(problems.join('\n'));
  for (const [sprite, p] of Object.entries(table.pictures)) if (!p.face) p.sheet = await firstFrame(sprite);
  const faces = [...new Set(Object.values(table.pictures).map(p => p.face).filter(Boolean))].sort();
  const faceBounds = {};
  const cache = new URL('cache/trainer-faces/', ROOT);
  for (const face of faces) {
    const cached = new URL(`${face}.png`, cache);
    if (previous?.faceBounds?.[face] && !existsSync(cached)) { faceBounds[face] = previous.faceBounds[face]; continue; }
    let bytes;
    if (existsSync(cached)) bytes = readFileSync(cached);
    else if (fetchFaces) {
      const response = await fetch(`https://play.pokemonshowdown.com/sprites/trainers/${face}.png`, { signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error(`${face}: HTTP ${response.status}`);
      bytes = Buffer.from(await response.arrayBuffer());
      mkdirSync(cache, { recursive: true });
      writeFileSync(cached, bytes);
    } else throw new Error(`${face}: no face bounds`);
    faceBounds[face] = await imageBounds(bytes);
  }
  return { ...table, faceBounds };
}

export async function checkTable(stored) {
  const want = await buildTable(stored, { fetchFaces: false }).catch(error => ({ error: error.message }));
  if (want.error) return [want.error];
  return JSON.stringify(want) === JSON.stringify(stored) ? [] : ['data/trainer-pool.json is not what tools/build-trainer-pool.mjs writes - run it'];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const previous = existsSync(OUTPUT) ? JSON.parse(readFileSync(OUTPUT, 'utf8')) : null;
  if (process.argv.includes('--check')) {
    const problems = await checkTable(previous);
    if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
    console.log(`ok: ${Object.keys(previous.pictures).length} pictures`);
  } else {
    const table = await buildTable(previous, { fetchFaces: true });
    writeFileSync(OUTPUT, `${JSON.stringify(table)}\n`);
    const n = Object.values(table.pictures);
    console.log(`data/trainer-pool.json: ${n.length} pictures (${n.filter(p => !p.keywordOnly).length} at random, ${n.filter(p => p.keywordOnly).length} keyword only), `
      + `${Object.keys(table.faceBounds).length} card faces, ${n.filter(p => p.sheet).length} first-frame cards, ${Buffer.byteLength(JSON.stringify(table))} bytes`);
  }
}
