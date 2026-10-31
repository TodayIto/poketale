// Display-only settlement tags. The bot's own display rules render its buttons and its Lua handles clicks.
import { battlesIn, parseBattle } from './blocks.mjs';
import { SETTLEMENT_BOT } from './compat.mjs';
import { opponentGender } from './trainer-look.mjs';

const V = SETTLEMENT_BOT.vars;

const alternativeAllowed = (vars, mine, opponent) => {
  if (String(vars[V.winInstruction]) !== '1') return false;
  const mode = Number(vars[V.mode]);
  if (mode === 2) return true;
  if (!mine) return false;

  if ((mode === 8 && mine === 'F') || (mode === 9 && mine === 'M')) return true;
  if (!opponent) return false;
  switch (mode) {
    case 3: return mine === 'M' && opponent === 'M';
    case 4: return mine === 'F' && opponent === 'F';
    case 5: return mine !== opponent;
    case 6: return mine === 'M' && opponent === 'F';
    case 7: return mine === 'F' && opponent === 'M';
    case 8: return mine !== 'M' || opponent !== 'M';
    case 9: return mine !== 'F' || opponent !== 'F';
    default: return false;
  }
};

async function playerGender(vars, myGender) {
  const value = String(vars[V.gender] ?? '').trim();
  if (value) return { 1: 'M', 2: 'F' }[Number(value)] ?? null;
  return (await myGender?.()) ?? null;
}

export async function victoryChoices({ bot, chat, index, survey, myGender = null }) {
  if (String(bot ?? '').normalize('NFC').trim().toLowerCase() !== SETTLEMENT_BOT.name) return '';
  const info = survey?.battles.get(survey.lastBattleKey);
  if (info?.phase !== 'done' || info.result?.outcome !== 'win' || info.result.index !== index) return '';
  const messages = chat?.message ?? [];
  if (index < messages.length - 2) return '';
  const tail = messages.slice(index).map(m => String(m?.data ?? '')).join('\n');
  if (/\[(?:Settlement (?:Choice|Outcome)\s*\||Select (?:Money|Sexual Forfeit)(?:\s*\||\]))/.test(tail)) return '';
  const block = battlesIn(messages[info.index], info.index).find(b => b.key === info.key);
  const battle = block && parseBattle(block.body).spec;
  if (!battle || battle.wild) return '';
  const vars = chat.scriptstate ?? {};
  const choices = ['Money'];
  if (alternativeAllowed(vars, await playerGender(vars, myGender), opponentGender(battle, chat))) choices.push('Sexual Forfeit');
  return '\n\n' + choices.map(type => `[Settlement Choice | Type: ${type}]`).join('\n') + '\n\n';
}
