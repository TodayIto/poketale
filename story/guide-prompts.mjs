export const GUIDE_AT = 'inside';

// First line of the guide
export const GUIDE_HEAD = 'Narration guide:';

export const GUIDE_CORE = [
  'Write one continuous battle scene, not a turn-by-turn list of moves.',
  'Make a few decisive moments, picked from across the whole battle, the most vivid. Keep the rest shorter.',
  'Match the force of each hit to the HP it took. Show super effective, not very effective and critical hits in how they land.',
  "Show each move through the Pokémon's own bodies and features: how one unleashes it and how the other takes it.",
  "Pokémon don't speak in words, only in their cries. Show their resolve and emotions through body language and cries.",
  'Add no moves, hits or faints beyond those above.',
  'Keep numbers such as HP percentages out of the story.',
  'Include every trainer in the battle, and let their feelings show at the key moments.',
  'When the surroundings or the weather affect the battle, show how.',
];

export const GUIDE_SUMMARY = [
  'Write one continuous battle scene that leads to these facts.',
  "Pokémon don't speak in words, only in their cries.",
];

export const GUIDE_ENDED = [
  'Even if you skip over parts, always show any capture, any evolution and the outcome of the battle.',
  'If it fits, an evolution can happen mid-battle instead, as an awakening at a knockout the evolving Pokémon landed. Only the timing changes: the moves, damage, knockouts and outcome stay the same. If the evolving Pokémon knocked out no one, show the evolution after the battle as a dramatic moment of its own, with the Pokémon glowing as it changes.',
];

export const GUIDE_ONGOING = [
  'Leave the tension hanging, without pushing toward a finish.',
];

export const GUIDE_AMOUNT = [
  { upTo: 3, text: 'Show every move in order, as it happens: the command, the move in action, the impact, and how the target and everyone watching react.' },
  { upTo: 10, text: 'In each face-off, pick the one or two moves that decided it and show them in full, from the command to the reactions. Keep the exchanges in between to a line or two. Give at least a sentence to each Pokémon that faints or comes out.' },
  { upTo: Infinity, text: 'Pick the two or three most dramatic moments or standout Pokémon and show only those in full. Cover the rest in order, a sentence or two per face-off. Let the highlights show the fatigue and wounds left by the other fights.' },
];
