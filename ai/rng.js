export function liveSeedText(battle) {
  const prng = battle.prng;
  return String(typeof prng.getSeed === 'function' ? prng.getSeed() : prng.seed);
}

// Strings -> Gen5-style seed [16 bits x 4]. Mixes FNV-1a four different ways.
export function deriveSeed(...parts) {
  const text = parts.join('|');
  const seed = [];
  for (let k = 1; k <= 4; k++) {
    let h = (0x811c9dc5 ^ Math.imul(k, 0x9e3779b9)) >>> 0;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    seed.push((h ^ (h >>> 16)) & 0xffff || k);
  }
  return seed;
}

export function createRng(seed) {
  let a = (seed[0] << 16 | seed[1]) ^ (seed[2] << 16 | seed[3]);
  const next = () => {
    a = a + 0x6d2b79f5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  return { int: n => Math.floor(next() * n) };
}
