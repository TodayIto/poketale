const Z_BUTTON = [
  '........OOO........',
  '......OOOWOOO......',
  '....OOOWLMLLOOO....',
  '..OOOLLMMRMMLLOOO..',
  'OOOLLMMRROKRMMLLOOO',
  'OLLMMRROOOOOKRMMLLO',
  'OKMRROOO...OOOKRMPO',
  'OKROOO.......OOOKRO',
  'OOOOOOOOOOOOOOOOOOO',
  '..OOWWWLLLLLLLLLLO.',
  '.OOLMMMMMMMMMMMMPO.',
  '.OLRRRRRRRRMMMMMPO.',
  '.OOOOOOOOOOKMMMRRO.',
  '.......OOWLMMMROOO.',
  '.....OOOLMMMRROO...',
  '...OOOLLMMRROOO....',
  '.OOOLLMMRROOO......',
  '.OLLMMMPOOOOOOOOOO.',
  '.OKMMMMMWWLLLLLLLO.',
  '.OKMMMMMMMMMMMMROO.',
  '.OKRRRRRRRRRRRROO..',
  '.OOOOOOOOOOOOOOO...',
];
const ULTRA_BUTTON = [
  '.........OOO.........',
  '.........OLO.........',
  '..OOOO...OKO...OOOO..',
  '..OLLOO.OOKOO.OOLLO..',
  '..OKMLOOOLMLOOOLMRO..',
  '..OOKMLOOKMPOOLMROO..',
  '...OOKMLOKMPOLMROO...',
  '....OOKMLMMMLMROO....',
  '...OOOOKLMMMMPOOOO...',
  'OOOOLLLMLWMMMMLLLOOOO',
  'OLLLMMMMMMMMMMMMMLLLO',
  'OOOOKRRMMMMMMMRRROOOO',
  '...OOOOKMMMMMPOOOO...',
  '....OOLMRMMMRMLOO....',
  '...OOLMROKMPOKMLOO...',
  '..OOLMROOKMPOOKMLOO..',
  '..OLMROOOKMROOOKMLO..',
  '..OKROO.OOKOO.OOKRO..',
  '..OOOO...OKO...OOOO..',
  '.........OKO.........',
  '.........OOO.........',
];
const GOLD = { O: '#202028', L: '#ffeec1', K: '#ffd977', M: '#ffc631', P: '#c18825', R: '#804618', W: '#ffffff' };

const CURSOR_Z = [
  '.....A.....',
  '...AAAAA...',
  '.AAA...AAA.',
  'AA.......AA',
  '...........',
  '.AAAAAAAAA.',
  '..AAAAAAAA.',
  '.......AAA.',
  '.....AAA...',
  '...AAA.....',
  '.AAA.......',
  '.AAAAAAAA..',
  '.AAAAAAAAA.',
];
const CURSOR_ULTRA = [ // the star alone, as the button
  '.....A.....',
  '.....A.....',
  '..A.AAA.A..',
  '...AAAAA...',
  '..AAAAAAA..',
  'AAAAAAAAAAA',
  '..AAAAAAA..',
  '...AAAAA...',
  '..A.AAA.A..',
  '.....A.....',
  '.....A.....',
];
const CURSOR = { A: '#ffc631', B: '#a86a1c' };

// the Ultra Burst emblem: white heart, pale gold body, gold rim
const STAR = [
  '...........P...........',
  '...........P...........',
  '...........P...........',
  '...P......PKP......P...',
  '....PP....PKP....PP....',
  '....PKP...PKP...PKP....',
  '.....PLK..KLK..KLP.....',
  '......KLKKLLLKKLK......',
  '.......KLLLLLLLK.......',
  '.......KLLLLLLLK.......',
  '...PPPKLLLWWWLLLKPPP...',
  'PPPKKKLLLLWWWLLLLKKKPPP',
  '...PPPKLLLWWWLLLKPPP...',
  '.......KLLLLLLLK.......',
  '.......KLLLLLLLK.......',
  '......KLKKLLLKKLK......',
  '.....PLK..KLK..KLP.....',
  '....PKP...PKP...PKP....',
  '....PP....PKP....PP....',
  '...P......PKP......P...',
  '...........P...........',
  '...........P...........',
  '...........P...........',
];
const STAR_COLORS = { W: '#ffffff', L: '#fff6d8', K: '#ffd977', P: '#f0b030' };
const SPARK = [
  '..L..',
  '.LWL.',
  'LWWWL',
  '.LWL.',
  '..L..',
];
const SPARK_COLORS = { W: '#ffffff', L: '#ffe9a0' };

const edged = rows => rows.map((row, y) => [...row].map((c, x) => (c === 'A' && row[x + 1] !== 'A' ? 'B' : c)).join(''));

const MEGA_BUTTON = [
  '........AAA........',
  '.....AAABBBAAA.....',
  '....ACCCCCCDCCA....',
  '...AEFFEEEEDDEEA...',
  '..AGFFGGGDDDDDDGA..',
  '.AHHFHHHDDHHDHHHHA.',
  '.AIIIIIIDDDIIDIIIA.',
  '.AJJJJJJDJJDDDJJJA.',
  'AKKKKKKKKDKKDDKKKKA',
  'ALLLLLDDDDDDDLLLLLA',
  'AMMMMDDMMDMMMMMMMMA',
  '.ANNNDDDNNDNNNNNNA.',
  '.AOOODOODDDOOOOOOA.',
  '.APPPPDPPDDPPPPPPA.',
  '..AQDDDDDDQQQQQQA..',
  '...ARRDDRRRRRRRA...',
  '....ASSDSSSSSSA....',
  '.....AAATTTAAA.....',
  '........AAA........',
];
const MEGA_COLORS = { A: '#202028', B: '#fca9de', C: '#faa5dc', D: '#1d3a9e', E: '#f8a1da', F: '#ffffff', G: '#f69cd9', H: '#d79de0', I: '#9ca2ee', J: '#60a7fe', K: '#5cb3ff', L: '#5dc0ff', M: '#5fcdff', N: '#61daff', O: '#62dee6', P: '#61d9b4', Q: '#60d581', R: '#5fd04f', S: '#8ed245', T: '#c3d43f' };

const CURSOR_MEGA = [
  '....AAA....',
  '..AABBCAA..',
  '.ADEDCDDDA.',
  '.AEFFCFFCA.',
  'AGGGGCCCGGA',
  'AHHHCCCHHHA',
  'AIICCCIIIIA',
  '.ACJJCJJJA.',
  '.AKKKCKKKA.',
  '..AACLLAA..',
  '....AAA....',
];
const CURSOR_MEGA_COLORS = { A: '#202028', B: '#faa4dc', C: '#1d3a9e', D: '#f69cd9', E: '#ffffff', F: '#a4a1ec', G: '#5bafff', H: '#5ec7ff', I: '#62deff', J: '#61d9ad', K: '#5fd151', L: '#b7d440' };

const DMAX_BUTTON = [
  '..OOOO................OOOO..',
  '..OLLOOO....OOO.....OOOLLO..',
  '..OOPLLOOO..OLOO..OOOLLPOO..',
  '...OOOPLLOOOOMLOOOOLLPOOO...',
  '.....OOPMLLOOMMOOLLMPOO.....',
  '......OOPMMLLMMLLMMPOO......',
  '.......OOPMMMMMMMMPOO.......',
  '........OOPMMMMMMMOO........',
  '.........OOMMMMMMMO.........',
  '.........OOPMMM..MO.........',
  '........OOLOPM..MMO.........',
  '.......OOLMLO..MM.OOO.......',
  '......OOLMMML.MM..LLO.......',
  '.....OOLMMMMMMM..MM.OOO.....',
  '....OOLMMMMMPP..MM..LLO.....',
  '....OLMMMMMMOOOOM..MMMOO....',
  '...OOMMMMMMPO..O..MMMMLOO...',
  '..OOLMMMMMMOO..OOOMMMMMLOO..',
  '.OOLMMMMMMPO....OLMMMMMMLOO.',
  '.OLMMMPMMPOO....OOMMMMMMMLO.',
  'OOPPPPOPPOO......OPPPPPPPMOO',
  'OLOOOOOOOO.......OOOOOOOOPLO',
  'OOO.....................OOOO',
];
const DMAX_CURSOR = [
  'M....M....M',
  '.M...M...M.',
  '..MMMMMMM..',
  '...MMMMM...',
  '....MMM....',
  '..MM...MM..',
  '.MMM...RMM.',
  'MMMM...MRMM',
  'MM.......MM',
];
const GMAX_MARK = [
  'M...M...M',
  '.MMMMMMM.',
  '..MMMMM..',
  '...MMM...',
  '.MM...RM.',
  'MMM...MRM',
  'M.......M',
];

const DMAX_RED = { O: '#3a0a18', L: '#ff9cb0', K: '#ff6488', M: '#e8003c', P: '#b00030', R: '#78001e', W: '#ffffff' };

const LEVEL_STOPS = [[64, 224, 240], [64, 112, 240], [160, 80, 224], [240, 64, 160]];
export const DMAX_LEVEL_EMPTY = '#cfd8df';
/** The colour of Dynamax Level cell i (0-9) when filled, as '#rrggbb' */
export function dmaxLevelColor(i, count = 10) {
  const t = (i / (count - 1)) * (LEVEL_STOPS.length - 1), k = Math.min(LEVEL_STOPS.length - 2, Math.floor(t)), f = t - k;
  return '#' + LEVEL_STOPS[k].map((v, c) => Math.round(v + (LEVEL_STOPS[k + 1][c] - v) * f).toString(16).padStart(2, '0')).join('');
}

export const Z_ART = {
  z_button: { rows: Z_BUTTON, colors: GOLD },
  mega_button: { rows: MEGA_BUTTON, colors: MEGA_COLORS },
  cursor_mega: { rows: CURSOR_MEGA, colors: CURSOR_MEGA_COLORS },
  ultra_button: { rows: ULTRA_BUTTON, colors: GOLD },
  cursor_z: { rows: edged(CURSOR_Z), colors: CURSOR },
  cursor_ultra: { rows: edged(CURSOR_ULTRA), colors: CURSOR },
  ultra_star: { rows: STAR, colors: STAR_COLORS },
  ultra_spark: { rows: SPARK, colors: SPARK_COLORS },
  dmax_button: { rows: DMAX_BUTTON, colors: DMAX_RED },
  cursor_dmax: { rows: DMAX_CURSOR, colors: DMAX_RED },
  gmax_mark: { rows: GMAX_MARK, colors: DMAX_RED },
};

export function artPixels({ rows, colors }) {
  const pixels = [];
  rows.forEach((row, y) => [...row].forEach((c, x) => { if (c !== '.') pixels.push([x, y, colors[c]]); }));
  return pixels;
}
export const artSize = ({ rows }) => [rows[0].length, rows.length];

export function zTextures(scene) {
  const textures = scene.textures;
  if (!textures?.createCanvas) return;
  for (const [key, art] of Object.entries(Z_ART)) {
    if (textures.exists(key)) continue;
    const canvas = textures.createCanvas(key, ...artSize(art));
    const ctx = canvas.getContext();
    for (const [x, y, color] of artPixels(art)) { ctx.fillStyle = color; ctx.fillRect(x, y, 1, 1); }
    canvas.refresh();
  }
}
