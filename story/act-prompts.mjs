import { createNamer, STATUS_EN, nicknamed, sceneLines, trainerName, secondName, partnerName, battleKind } from './ai-names.mjs';
import { collidingPositions } from './blocks.mjs';

// Why the battle could not take a command (director/plan.js reasons) - after "But it failed!"
const WHY = {
  noMove: (c, n) => `${n.moves(c.move ?? '') || c.raw || 'that move'} is not one of its moves`,
  noPp: (c, n) => `${n.moves(c.move)} has no PP left`,
  disabled: (c, n) => `${n.moves(c.move)} can't be used right now`,
  noSwitch: () => 'no such Pokémon can come in',
  trapped: () => "it can't be switched out",
  noItem: (c, n) => `there is no ${c.item ? n.items(c.item) : 'such item'} in the bag`,
  cantUse: (c, n) => `${n.items(c.item)} would have no effect`,
  cantRun: () => "there's no running from this battle",

  noCommand: (c, n) => `${pokemonText(c.who, n)} is not on the field`,
};

const pokemonText = (who, n) => (who?.species ? n.species(who.species) : who?.name);

function commandText(c, n) {
  if (c.kind === 'move') return `${c.move ? n.moves(c.move) : c.raw ?? 'a move'}${c.gimmick === 'tera' ? ' (Terastallize)' : c.gimmick === 'mega' ? ' (Mega Evolve)' : ''}`;
  if (c.kind === 'switch') return `switch to ${c.target?.slot ? `party #${c.target.slot}` : pokemonText(c.target, n)}`;
  if (c.kind === 'item') return `use ${c.item ? n.items(c.item) : 'an item'}`;
  return 'run';
}

export function failedLines(rows, { lang = 'ko', en = null } = {}) {
  const n = createNamer({ lang, en });
  return rows.flatMap(row => row.turns.map((result, i) => ({ result, command: row.block.turns[i]?.[result.part ?? 'me'] }))
    .filter(({ result, command }) => result.state === 'rejected' && command)
    .map(({ result, command }) => `Command: ${commandText(command, n)}. But it failed! (${(WHY[result.reason] ?? (() => 'the battle could not take it'))(command, n)})`));
}

export const failedOoc = lines => `(OOC: No battle turn was played.\n${lines.join('\n')}\nNarrate the battle up to the failed command and no further.)`;

const hpOf = mon => (mon.maxhp ? Math.max(mon.hp > 0 ? 1 : 0, Math.round(mon.hp / mon.maxhp * 100)) : 0);

const monText = (mon, n) => `${nicknamed(mon.name !== mon.species && mon.name, n.species(mon.species))} Lv${mon.level} HP ${hpOf(mon)}%${mon.status ? ` ${STATUS_EN[mon.status]}` : ''}`;

const myMoves = (mon, n) => mon.moves.map(m => `${n.moves(m.id)} (${m.pp}/${m.maxpp})`).join(', ');
const foeMoves = (mon, n) => mon.moves.map(m => n.moves(m.id)).join(', ');
const POSITION_WORDS = ['left', 'right'];

export function battleStatusLines(result, n, battle = null) {
  const [mine, theirs] = ['p1', 'p2'].map(id => result?.sides?.find(side => side.id === id));
  if (!mine || !theirs) return [];
  if (battleKind(result) === 'single') {
    const out = [];
    const me = mine.team.find(m => m.active), foe = theirs.team.find(m => m.active);
    if (me) out.push(`[{{user}}'s Pokémon: ${monText(me, n)} | ${myMoves(me, n)}]`);
    if (foe) out.push(`[Opponent's Pokémon: ${monText(foe, n)} | ${foeMoves(foe, n)}]`);
    return out;
  }
  const trainers = battle?.foePartner ? [` (${trainerName(battle)})`, ` (${secondName(battle)})`] : ['', ''];

  const half = groups => {
    const at = [];
    for (const { team, line } of groups) for (const mon of team ?? []) if (mon.active) at[mon.position] = { mon, line };
    const named = collidingPositions(POSITION_WORDS.map((_, i) => at[i]?.mon ?? null));
    return at.flatMap((one, i) => (one ? [one.line(named.includes(i) ? ` ${POSITION_WORDS[i]}` : '', one.mon)] : []));
  };
  return [
    ...half([
      { team: mine.team, line: (pos, mon) => `[{{user}}'s Pokémon${pos}: ${monText(mon, n)} | ${myMoves(mon, n)}]` },
      { team: result.partner, line: (pos, mon) => `[${partnerName(battle)}'s Pokémon${pos}: ${monText(mon, n)}]` },
    ]),
    ...half([
      { team: theirs.team, line: (pos, mon) => `[Opponent's Pokémon${pos}${trainers[0]}: ${monText(mon, n)} | ${foeMoves(mon, n)}]` },
      { team: result.foePartner, line: (pos, mon) => `[Opponent's Pokémon${pos}${trainers[1]}: ${monText(mon, n)} | ${foeMoves(mon, n)}]` },
    ]),
  ];
}

export const answeredLine = played => (played
  ? 'The command in this message has already been handled above, so no <pkb-act> block is needed. Narrate the battle up to its result and no further.'
  : 'The command in this message is played out separately, so no <pkb-act> block is needed. Narrate the battle up to the command being given and no further.');

const SINGLE_ACTIONS = 'a move by its official English name from the [{{user}}\'s Pokémon] line, "switch <Pokémon>", "item <item>" or "run"';

export const ACT_RULES = `- While a battle is in progress, what {{user}} orders in battle is a command, not an outcome. When {{user}} gives a command, end the response with:
<pkb-act>
turn: player <action> | opponent <action>
</pkb-act>
  One line per turn: two moves in a row are two lines. "player" is required. Leave out "opponent" to let the opponent decide.
  Actions: ${SINGLE_ACTIONS}. The opponent uses only the moves on the [Opponent's Pokémon] line.
  In the story, show the command being given (e.g. Pikachu is told to use Thunderbolt), not its result. The result comes in a later message.`;

const DOUBLE_ACTIONS = 'a move by its official English name from that Pokémon\'s line, "switch <Pokémon>", "item <item> on <Pokémon>" or "run"';
const DOUBLE_TURN = 'turn: player <Pokémon> <action> > <target> | player <Pokémon> <action> > <target>';
const DOUBLE_TARGET = 'After a move aimed at one Pokémon, write its side and name after ">" (e.g. > opponent Pidgey), or "ally".';

export const DOUBLE_ACT_RULES = `- While a battle is in progress, what {{user}} orders in battle is a command, not an outcome. When {{user}} gives a command, end the response with:
<pkb-act>
${DOUBLE_TURN}
</pkb-act>
  One line per turn: one action for each of {{user}}'s Pokémon on the field, named as on its line. Add the opponent's the same way, or leave them out to let the opponent decide.
  ${DOUBLE_TARGET}
  Actions: ${DOUBLE_ACTIONS}. The opponent uses only the moves on its lines.
  In the story, show the command being given (e.g. Pikachu is told to use Thunderbolt), not its result. The result comes in a later message.`;

export const PARTNER_RULE = "  A partner's Pokémon act on their own.";

export const actRules = status => ({ single: ACT_RULES, double: DOUBLE_ACT_RULES, tag: `${DOUBLE_ACT_RULES}\n${PARTNER_RULE}` }[battleKind(status)]);

export function auxRequest({ status, recent, input, double = false }) {
  return [
    { role: 'system', content: "You turn {{user}}'s words in a Pokémon battle story into battle commands. Write no story text." },
    { role: 'user', content: `## Battle Now\n${status.join('\n')}\n\n## Recent Story\n${sceneLines(recent) || '(none)'}\n\n## {{user}}'s New Message\n${input}\n\n`
      + "If {{user}} gives their Pokémon a command, answer with only this block, one line per turn:\n"
      + `<pkb-act>\n${double ? DOUBLE_TURN : 'turn: player <action>'}\n</pkb-act>\n${double ? `${DOUBLE_TARGET}\n` : ''}`
      + `An action is ${double ? DOUBLE_ACTIONS : SINGLE_ACTIONS}.\n`
      + 'If {{user}} gives no command, or it is unclear which move they mean, answer with only: none' },
  ];
}
