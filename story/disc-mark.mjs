import { pixelSvg } from '../view/amie-art.js';

/** The digits, 5 x 7 ('#' lit) */
const DIGITS = Object.freeze({
  1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  3: ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
});

const NAVY = Object.freeze({ K: '#1b2740', H: '#6d90c8', F: '#3a5f9f', S: '#283f6c', W: '#ffffff' });
const DISC_MARK_COLORS = Object.freeze({
  frlg: Object.freeze({ K: '#4a1806', H: '#ff9c5e', F: '#de5a1e', S: '#a83d0e', W: '#ffffff' }),
  hgss: Object.freeze({ K: '#4a3400', H: '#fff0a0', F: '#e8b923', S: '#b8860f', W: '#3a2800' }),
  oras: Object.freeze({ K: '#3c0612', H: '#e8607a', F: '#b5203d', S: '#7e1028', W: '#ffffff' }),
});

/** The badge's rows for a generation 1-9 */
function markRows(gen) {
  const digit = DIGITS[gen];
  const inner = (row, fill) => `K${fill}${row.replace(/#/g, 'W').replace(/\./g, 'F')}${fill}K`;
  return ['.KKKKKKK.', 'KHHHHHHHK', ...digit.map(row => inner(row, 'F')), 'KSSSSSSSK', '.KKKKKKK.'];
}
const cache = new Map();

export function discMarkSvg(mark) {
  if (!mark || !DIGITS[mark.gen]) return '';
  const key = `${mark.gen}:${mark.remake ? mark.game : ''}`;
  if (!cache.has(key)) cache.set(key, pixelSvg(markRows(mark.gen), (mark.remake && DISC_MARK_COLORS[mark.game]) || NAVY));
  return cache.get(key);
}
