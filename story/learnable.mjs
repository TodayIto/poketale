const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_';
const ESCAPE = '.';

export function encodeMoveSet(indexes) {
  let previous = -1, out = '';
  for (const i of [...indexes].sort((a, b) => a - b)) {
    const gap = i - previous - 1;
    previous = i;
    out += gap < DIGITS.length ? DIGITS[gap] : ESCAPE + DIGITS[Math.floor(gap / DIGITS.length)] + DIGITS[gap % DIGITS.length];
  }
  return out;
}

function decodeMoveSet(code, moves) {
  const out = new Set();
  let previous = -1;
  for (let at = 0; at < code.length; at++) {
    const gap = code[at] === ESCAPE ? DIGITS.indexOf(code[++at]) * DIGITS.length + DIGITS.indexOf(code[++at]) : DIGITS.indexOf(code[at]);
    previous += gap + 1;
    out.add(moves[previous]);
  }
  return out;
}

export function learnableReader(table) {
  const decoded = new Map();
  return speciesId => {
    const at = table.species[speciesId];
    if (at === undefined) return null;
    if (!decoded.has(at)) decoded.set(at, decodeMoveSet(table.sets[at], table.moves));
    return decoded.get(at);
  };
}
