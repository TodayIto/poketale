import { findBlocks, parseMonLine, stripForPrompt, lookupId, speciesName } from './blocks.mjs';
import { dropOocs } from './chat.mjs';
import { sceneLines } from './ai-names.mjs';
import { ruleNote } from './failure.mjs';
import { PARTY_MAX } from './rules.mjs';
import { compatFold } from './compat.mjs';
import { canHold } from './panel.mjs';
import { EXP_SHARE } from './items.mjs';

export const IMPORT_AI_RECENT = 16;
export const IMPORT_AI_RECENT_MIN = 1;
export const IMPORT_AI_RECENT_MAX = 100;

export const importAiRecent = value => (typeof value === 'number' && Number.isFinite(value)
  ? Math.min(IMPORT_AI_RECENT_MAX, Math.max(IMPORT_AI_RECENT_MIN, Math.round(value))) : IMPORT_AI_RECENT);

// Confirmed AI text - word for word
export const IMPORT_AI_INTRO = `You read a Pokémon story and write down the Pokémon {{user}} owns now. Write no story text.
Write only what the story shows. Do not invent Pokémon the story never mentioned.`;

export const IMPORT_AI_FORMAT = `\`\`\`
<pkb-change>
add: Species Lv{n} | nickname name | field value | …
add: Species Lv{n} | box
</pkb-change>
\`\`\`

- One add line per Pokémon {{user}} owns now: the party first, in order, up to 6.
- Add box only to a Pokémon the story clearly puts in storage (e.g., sent to a PC). Leave out storage that is unclear.
- Species and level are required. If the story gives no level, write one that fits the story so far.
- Optional fields, only when the story states them: nickname, gender, shiny, ability, moves, item, nature, hp (e.g., 60%), status (par, brn, slp, frz, psn, tox).
- Leave out Pokémon that were released, traded away, or belong to someone else.
- Use official English names for species, moves, items, abilities, and natures. Write nicknames in the story's language.
- If {{user}} has no Pokémon yet, output an empty Change Block.`;
export const IMPORT_AI_ASK = `Write exactly one Change Block listing the Pokémon {{user}} owns as of the latest message, and nothing else.`;

const storyText = text => stripForPrompt(dropOocs(text));

export function importAiScene(chat, recent = IMPORT_AI_RECENT) {
  return (chat?.message ?? []).slice(-importAiRecent(recent)).map(m => ({ role: m?.role, text: storyText(m?.data).trim() })).filter(m => m.text);
}

export function importAiMessages(chat, { recent = IMPORT_AI_RECENT } = {}) {
  const scene = importAiScene(chat, recent);
  if (!scene.length) return null;
  return [
    { role: 'system', content: [IMPORT_AI_INTRO, '## Change Block', IMPORT_AI_FORMAT].join('\n\n') },
    { role: 'user', content: `## Recent Story (oldest first)\n\n${sceneLines(scene)}\n\n${IMPORT_AI_ASK}` },
  ];
}

const AI_SOURCE = Object.freeze({ index: null, chatId: null, ai: true });
const note = (rule, values) => ruleNote(`import.${rule}`, values);

const LINE_RE = /^\s*(?:[-*]\s*)?add\s*[:：]\s*(.*?)\s*$/i;

function foundOf(set, sim, expShare = true) {
  const extra = {};
  if (set.ability) extra.ability = sim.Dex.abilities.get(set.ability).name;
  if (set.moves?.length) extra.moves = set.moves.map(m => sim.Dex.moves.get(m).id);

  if (set.item && (canHold(set.item, sim) || (set.item === EXP_SHARE && expShare))) extra.item = set.item;
  if (set.nature) extra.nature = set.nature;
  if (set.gender) extra.gender = set.gender;
  if (set.teraType) extra.teraType = set.teraType;
  // A nickname that only names the species is no nickname
  const own = set.name ? lookupId('species', set.name) : null;
  const nickname = set.name && !(compatFold(set.name) === compatFold(set.species) || (own && speciesName(own) === set.species)) ? set.name : undefined;
  return { species: set.species, nickname, level: set.level, hpPercent: set.hpPercent, status: set.status, ...(set.shiny ? { shiny: true } : {}), extra, from: 'ai', source: AI_SOURCE };
}

export function readAiParty(answer, { sim }, { owned = false } = {}) {
  if (answer?.type === 'multiline') return { why: 'aiMany' };
  if (answer?.type !== 'success' || typeof answer.result !== 'string') return { why: 'aiFail' };
  const block = findBlocks(answer.result).find(b => b.kind === 'change');
  const lines = String(block ? block.body : answer.result).split('\n').map(line => LINE_RE.exec(line)).filter(Boolean);
  if (!lines.length && !block) return { why: 'noBlock' };
  const party = [], box = [], warnings = [];

  let expShare = !owned;
  for (const [, value] of lines) {
    const read = parseMonLine(value);
    if (!read.set) continue;
    const found = foundOf(read.set, sim, expShare);
    if (found.extra.item === EXP_SHARE) expShare = false;
    (read.to === 'box' ? box : party).push(found);
  }
  if (lines.length && !party.length && !box.length) return { why: 'badBlock' };
  if (party.length > PARTY_MAX) warnings.push(note('recordPartyOver', { count: party.length, max: PARTY_MAX }));
  return { found: { party, box, warnings, source: 'ai' } };
}

export const aiFailedFound = () => ({ party: [], box: [], warnings: [note('aiFailed')], source: 'ai' });
