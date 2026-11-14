import { findBlocks, parseBattle, hashKey, messageId, stripForPrompt } from './blocks.mjs';
import { BATTLE_BLOCK_PART, varTexts, trainerLore } from './lore.mjs';
import { dropOocs } from './chat.mjs';
import { rulesAt } from './setting-changes.mjs';
import { PLAYER_NAME } from './rules.mjs';
import { sceneLines } from './ai-names.mjs';

export const FORGE_MODE = 'otherAx';

export const withUserName = (messages, name) =>
  messages.map(m => ({ ...m, content: String(m.content ?? '').replace(/\{\{user\}\}/gi, () => name || PLAYER_NAME) }));

export const SCENE_SIZE = 3;

export const FORGE_INTRO = `You write Battle Blocks for a Pokémon story. Write no story text.
Choose an opponent and levels that fit the scene and {{user}}'s party. Named characters keep their usual strength.`;

export const FORGE_ASK = {
  wild: `Write exactly one Battle Block for a wild Pokémon battle that could start in the latest scene, and nothing else. Use wild Pokémon that fit the surroundings, even if a Trainer is present.`,
  trainer: `Write exactly one Battle Block for a Trainer battle that could start in the latest scene, and nothing else. Use a Trainer from the scene; if none is present, bring in a Trainer who fits the place.`,
};

export const FORGE_KINDS = Object.keys(FORGE_ASK);

export const mayForge = message => message?.role === 'char';

export const forgeAt = (chat, { quiet = true } = {}) => (quiet ? (chat?.message ?? []).findLastIndex(mayForge) : -1);

export const forgeKey = id => hashKey(`forge\n${id}`);

export const sceneText = text => stripForPrompt(dropOocs(text));

export function sceneOf(chat, at) {
  return chat.message.slice(Math.max(0, at - SCENE_SIZE + 1), at + 1)
    .map(m => ({ role: m?.role, text: sceneText(m?.data) })).filter(s => s.text);
}

export function pastIn(entries, texts) {
  const all = texts.join('\n').toLowerCase();
  return entries.filter(e => e.key.split(',').map(k => k.trim().toLowerCase()).some(k => k && all.includes(k))).map(e => e.content);
}

function forgeMessages({ scene, party, past = [] }, kind) {
  const system = [FORGE_INTRO, '## Battle Block', BATTLE_BLOCK_PART, "## {{user}}'s Party", party,
    ...(past.length ? ['## Last Battles', past.join('\n')] : [])].join('\n\n');
  return [{ role: 'system', content: system }, { role: 'user', content: `## Recent Scene (oldest first)\n\n${sceneLines(scene)}\n\n${FORGE_ASK[kind]}` }];
}

function forgeBasis(chat, at, { state, sim, naming = {} }) {
  const scene = sceneOf(chat, at);
  return { scene, party: varTexts(state, { sim, ...naming }).party, past: pastIn(trainerLore(state, naming), scene.map(s => s.text)), reading: rulesAt(chat)(at) };
}

export function forgeRequest({ chat, key, quiet, state, sim, naming, kind }) {
  if (!quiet) return { why: 'replying' };
  const at = forgeAt(chat);
  const message = chat?.message?.[at];
  if (!message || forgeKey(messageId(message, at)) !== key) return { why: 'sceneMoved' };
  const basis = forgeBasis(chat, at, { state, sim, naming });
  return { id: messageId(message, at), basis, ...(Object.hasOwn(FORGE_ASK, kind ?? '') ? { messages: forgeMessages(basis, kind) } : {}) };
}

export function pickBlock(answer, reading) {
  if (answer?.type === 'multiline') return { why: 'aiMany' };
  if (answer?.type !== 'success' || typeof answer.result !== 'string') return { why: 'aiFail' };
  const block = findBlocks(answer.result).find(b => b.kind === 'battle');
  if (!block) return { why: 'noBlock' };
  if (!parseBattle(block.body, reading).spec) return { why: 'badBlock' };
  return { block: `<pkb-battle>\n${block.body.trim()}\n</pkb-battle>` };
}

export async function runForge(llm, messages, reading) {
  let answer;
  try { answer = await llm({ messages, mode: FORGE_MODE, allowPlugins: true }); } catch (error) { return { why: 'aiCall', error }; }
  return pickBlock(answer, reading);
}

export function appendBattle(chat, { id, basis }, block, now) {
  const at = forgeAt(chat);
  const message = chat?.message?.[at];
  if (!message || messageId(message, at) !== id) return false;
  if (JSON.stringify(forgeBasis(chat, at, now)) !== JSON.stringify(basis)) return false;
  message.data = `${String(message.data ?? '').replace(/\s+$/, '')}\n\n${block}`;
  return true;
}
