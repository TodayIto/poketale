const freeze = value => {
  for (const inner of Object.values(value)) if (inner && typeof inner === 'object') freeze(inner);
  return Object.freeze(value);
};

export const DEFAULT_POLICY = freeze({

  bossHeal: {
    /** Used when the active Pokemon's HP ratio is at or below this */
    hpBelow: 0.25,

    byTopLevel: [
      { below: 30, item: 'superpotion', count: 1 },
      { below: 50, item: 'hyperpotion', count: 2 },
      { below: Infinity, item: 'fullrestore', count: 2 },
    ],
  },

  megaAsap: true,

  tera: { bossTrainer: 'ace', trainer: 'never' },

  zMove: { use: true, spare: ['hard', 'max', 'hidden'] },

  dynamax: { use: false, hold: ['hard', 'max'] },

  aceSlot: teamSize => teamSize - 1,

  forcedSwitches: 4,

  partner: { difficulty: 'hard' },
});

export function bossHealItems(levels, policy = DEFAULT_POLICY) {
  const top = Math.max(0, ...levels);
  const { item, count } = policy.bossHeal.byTopLevel.find(row => top < row.below);
  return { item, count };
}
