import { createNamer, STATUS_EN, nicknamed, sceneLines, trainerName, secondName, partnerName, battleKind } from './ai-names.mjs';
import { collidingPositions } from './blocks.mjs';
import { ITEM_EFFECTS_READY } from './item-effects.mjs';
import { genHas, ruleGen } from '../engine/generation.mjs';

// Why the battle could not take a command (director/plan.js reasons) - after "But it failed!"
const WHY = {
  noMove: (c, n) => `${n.moves(c.move ?? '') || c.raw || 'that move'} is not one of its moves`,
  noPp: (c, n) => `${n.moves(c.move)} has no PP left`,
  disabled: (c, n) => `${n.moves(c.move)} can't be used right now`,
  noSwitch: () => 'no such Pokémon can come in',
  trapped: () => "it can't be switched out",
  noItem: (c, n) => `there is no ${c.item ? itemText(c, n) : 'such item'} in the bag`,
  cantUse: (c, n) => `${itemText(c, n)} would have no effect`,
  cantRun: () => "there's no running from this battle",

  noCommand: (c, n) => `${pokemonText(c.who, n)} is not on the field`,
};

const itemText = (c, n) => c.raw ?? n.items(c.item);

const pokemonText = (who, n) => (who?.species ? n.species(who.species) : who?.name);

const GIMMICK_TEXT = { tera: ' (Terastallize)', mega: ' (Mega Evolve)', z: ' (Z-Move)', ultra: ' (Ultra Burst)', dynamax: ' (Dynamax)' };
/** One side's command as words for the AI */
function commandText(c, n) {
  if (c.kind === 'move') return `${c.move ? n.moves(c.move) : c.raw ?? 'a move'}${GIMMICK_TEXT[c.gimmick] ?? ''}`;
  if (c.kind === 'switch') return `switch to ${c.target?.slot ? `party #${c.target.slot}` : pokemonText(c.target, n)}`;
  if (c.kind === 'item') return `use ${c.item ? itemText(c, n) : 'an item'}`;
  return 'run';
}

export function failedLines(rows, { lang = 'ko', en = null } = {}) {
  const n = createNamer({ lang, en });
  return rows.flatMap(row => row.turns.map((result, i) => ({ result, command: row.block.turns[i]?.[result.part ?? 'me'] })) // part: a double battle's other position, or a part naming its Pokemon
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

export const STORY_ITEM_RULE = 'Story items in the bag can be used in battle with "item <its emoji and name as in the bag> on <Pokémon>": food on any of {{user}}\'s Pokémon; cheer on the Pokémon it is for; taunt or distract on the opponent it is for, in trainer battles only, once per battle.';

export const STORY_FOOD_RULE = 'Story items in the bag can be used in battle with "item <its emoji and name as in the bag> on <Pokémon>": food on any of {{user}}\'s Pokémon.';

const storyItemRule = tools => (tools ? STORY_ITEM_RULE : STORY_FOOD_RULE);

const ITEM_RULE_LINE = ITEM_EFFECTS_READY ? `\n  ${STORY_ITEM_RULE}` : '';
const auxItemLine = tools => (ITEM_EFFECTS_READY ? `${storyItemRule(tools)}\n` : '');

const SINGLE_ACTIONS = 'a move by its official English name from the [{{user}}\'s Pokémon] line, "switch <Pokémon>", "item <item>" or "run"';

const GIMMICK_LINES = Object.freeze({
  'tera,mega,z,ultra,dynamax': 'To Terastallize, Mega Evolve, use a Z-Move, Ultra Burst or Dynamax, write tera, mega, z, ultra or dynamax after the move (e.g. player Thunderbolt tera).',
  mega: 'To Mega Evolve, write mega after the move (e.g. player Thunderbolt mega).',
  'mega,z,ultra': 'To Mega Evolve, use a Z-Move or Ultra Burst, write mega, z or ultra after the move (e.g. player Thunderbolt z).',
  dynamax: 'To Dynamax, write dynamax after the move (e.g. player Thunderbolt dynamax).',
  tera: 'To Terastallize, write tera after the move (e.g. player Thunderbolt tera).',
  '': null,
});
const GIMMICK_ORDER = Object.freeze(['tera', 'mega', 'z', 'ultra', 'dynamax']);

export const MAINLINE_GIMMICKS = GIMMICK_ORDER;

export function gimmickLine(gimmicks) {
  const key = GIMMICK_ORDER.filter(g => gimmicks.includes(g)).join(',');
  if (!Object.hasOwn(GIMMICK_LINES, key)) throw new Error(`No confirmed gimmick line for ${key}`);
  return GIMMICK_LINES[key];
}

const ENGINE_LACKS = Object.freeze({ champions: Object.freeze(['tera']) });
export const battleGimmicks = spec => {
  const rule = ruleGen(spec);
  return GIMMICK_ORDER.filter(g => genHas(rule, g) && !ENGINE_LACKS[rule]?.includes(g));
};
const MAINLINE_LINE = `  ${gimmickLine(MAINLINE_GIMMICKS)}`;

export const ACT_RULES = `- While a battle is in progress, what {{user}} orders in battle is a command, not an outcome. When {{user}} gives a command, end the response with:
<pkb-act>
turn: player <action> | opponent <action>
</pkb-act>
  One line per turn: two moves in a row are two lines. "player" is required. Leave out "opponent" to let the opponent decide.
  Actions: ${SINGLE_ACTIONS}. The opponent uses only the moves on the [Opponent's Pokémon] line.
${MAINLINE_LINE}${ITEM_RULE_LINE}
  In the story, show the command being given (e.g. Pikachu is told to use Thunderbolt), not its result. The result comes in a later message.`;

const DOUBLE_ACTIONS = 'a move by its official English name from that Pokémon\'s line, "switch <Pokémon>", "item <item> on <Pokémon>" or "run"';
const DOUBLE_TURN = 'turn: player <Pokémon> <action> > <target> | player <Pokémon> <action> > <target>';
const DOUBLE_TARGET = 'After a move aimed at one Pokémon, write its side and name after ">" (e.g. > opponent Pidgey), or "ally".';
/** The rule in a double battle (two out per side), instead of the single one */
export const DOUBLE_ACT_RULES = `- While a battle is in progress, what {{user}} orders in battle is a command, not an outcome. When {{user}} gives a command, end the response with:
<pkb-act>
${DOUBLE_TURN}
</pkb-act>
  One line per turn: one action for each of {{user}}'s Pokémon on the field, named as on its line. Add the opponent's the same way, or leave them out to let the opponent decide.
  ${DOUBLE_TARGET}
  Actions: ${DOUBLE_ACTIONS}. The opponent uses only the moves on its lines.
${MAINLINE_LINE}${ITEM_RULE_LINE}
  In the story, show the command being given (e.g. Pikachu is told to use Thunderbolt), not its result. The result comes in a later message.`;
/** Added at the end of the double rule in a tag battle */
export const PARTNER_RULE = "  A partner's Pokémon act on their own.";

export const actRules = (status, { tools = true, gimmicks = MAINLINE_GIMMICKS } = {}) => {
  const rules = { single: ACT_RULES, double: DOUBLE_ACT_RULES, tag: `${DOUBLE_ACT_RULES}\n${PARTNER_RULE}` }[battleKind(status)];
  const line = gimmickLine(gimmicks);
  const own = rules.replace(`\n${MAINLINE_LINE}`, () => (line ? `\n  ${line}` : ''));
  return ITEM_EFFECTS_READY ? own.replace(STORY_ITEM_RULE, storyItemRule(tools)) : own;
};

export function auxRequest({ status, recent, input, double = false, tools = true, gimmicks = MAINLINE_GIMMICKS }) {
  const line = gimmickLine(gimmicks);
  return [
    { role: 'system', content: "You turn {{user}}'s words in a Pokémon battle story into battle commands. Write no story text." },
    { role: 'user', content: `## Battle Now\n${status.join('\n')}\n\n## Recent Story\n${sceneLines(recent) || '(none)'}\n\n## {{user}}'s New Message\n${input}\n\n`
      + "If {{user}} gives their Pokémon a command, answer with only this block, one line per turn:\n"
      + `<pkb-act>\n${double ? DOUBLE_TURN : 'turn: player <action>'}\n</pkb-act>\n${double ? `${DOUBLE_TARGET}\n` : ''}`
      + `An action is ${double ? DOUBLE_ACTIONS : SINGLE_ACTIONS}.\n${line ? `${line}\n` : ''}${auxItemLine(tools)}`
      + 'If {{user}} gives no command, or it is unclear which move they mean, answer with only: none' },
  ];
}
