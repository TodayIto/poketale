import { buildEngine, replaySnapshot, applyInput, fingerprint, stateCheck, checkSnapshot, battlePoint, moveDeniedText, hiddenTrapText, partySlots, isReviving, SNAPSHOT_VERSION } from './index.js';
import { partyIndex } from './party-slot.js';
import { isBall } from '../engine/bag.mjs';
import { autoPick, forcedPicks, joinParts } from './double.js';
import { moveTargets } from './targets.js';
import { createSteps } from './steps.js';
import { arrange } from './order.js';
import { createProtocolReader } from './parse.js';
import { checkLang, DEFAULT_LANG } from './lang.js';
import { loadExpText } from './steps-exp.js';
import { gimmickOptions } from './steps-mega.js';
import { commitChoice } from '../ai/commit.js';
import { positionAt } from './read.js';
import { sameName, sideParts } from '../story/blocks.mjs';

const PLAN_MAX_TURNS = 6;

const plain = request => !!request && !request.wait && !request.forceSwitch && !!request.active;

function namedIn(list, who) {
  const byName = list.findIndex(p => p && who.name && sameName(p.name, who.name));
  if (byName >= 0) return byName;
  return list.findIndex(p => p && who.species && (p.species.id === who.species || p.baseSpecies.id === who.species
    || p.battle.dex.species.get(p.m?.start?.species ?? '').id === who.species));
}

function slotOf(side, who) {
  if (!who) return -1;
  if (Number.isInteger(who.slot)) return side.pokemon.findIndex(p => p.set === side.team[who.slot - 1]);
  return namedIn(side.pokemon, who);
}

function bagPick({ battle, bag, names, lang }, request, command, slot, ...more) {
  const target = battle.sides[0].pokemon[slot];
  const move = command.move ? target?.moveSlots.findIndex(s => s.id === command.move) : target?.moveSlots.findIndex(s => s.pp < s.maxpp);
  const party = partySlots(battle, names, lang, request);
  return bag.choice({ kind: 'item', item: command.item, slot: partyIndex(party, slot), move: Math.max(move ?? 0, 0) }, party, ...more);
}

function resolveMine(ctx, request, me) {
  const { battle, bag, run, names, lang, wild, gimmicks } = ctx;
  const side = battle.sides[0];
  if (!me) return { reason: 'noCommand' };
  if (request.forceSwitch) {
    // A faint (or a pivot move) left a slot to fill: only a switch can fill it
    if (me.kind !== 'switch') return { reason: 'noSwitch' };
  }
  if (me.kind === 'move') {
    const options = request.active[0].moves;

    if (options.length === 1 && options[0].pp === undefined && request.active[0].trapped && options[0].id !== 'struggle') return { choice: 'move 1' };
    const index = options.findIndex(option => option.id === me.move);
    if (index < 0) return { reason: 'noMove' };
    const option = options[index];
    if ((option.pp ?? 1) <= 0) return { reason: 'noPp', text: moveDeniedText(battle, names, option, lang) };
    if (option.disabled) return { reason: 'disabled', text: moveDeniedText(battle, names, option, lang) };

    const offered = gimmickOptions(request, gimmicks);
    const suffix = me.gimmick === 'mega' && offered.mega ? ' mega' : me.gimmick === 'tera' && offered.tera ? ' terastallize' : '';
    return { choice: `move ${index + 1}${suffix}` };
  }
  if (me.kind === 'switch') {
    const slot = slotOf(side, me.target);
    const pokemon = request.side.pokemon[slot];
    if (!pokemon || pokemon.active || / fnt$/.test(pokemon.condition)) return { reason: 'noSwitch' };
    if (!request.forceSwitch && request.active[0].trapped) return { reason: 'trapped', text: hiddenTrapText(battle, names, lang, wild) };
    return { choice: `switch ${slot + 1}` };
  }
  if (me.kind === 'item') {
    if (!bag || !(bag.counts.get(me.item) > 0)) return { reason: 'noItem' };
    const named = slotOf(side, me.target);
    const slot = named >= 0 ? named : side.pokemon.findIndex(p => p.isActive);
    try { return { choice: bagPick(ctx, request, me, slot) }; }
    catch { return { reason: 'cantUse' }; }
  }
  if (me.kind === 'run') {
    try { return { choice: run.choice() }; } catch { return { reason: 'cantRun' }; }
  }
  return { reason: 'noMove' };
}

function resolveFoe(battle, request, foe, i = 0, side = battle.sides[1]) {
  if (!foe || !plain(request)) return null;
  const pokemon = side.active[i];
  if (!request.active[i] || !pokemon || pokemon.fainted) return null;
  if (foe.kind === 'move') {
    const index = request.active[i].moves.findIndex(option => option.id === foe.move && !option.disabled && (option.pp ?? 1) > 0);
    return index < 0 ? null : `move ${index + 1}${targetLoc(battle, pokemon, request.active[i].moves[index], foe.at)}`;
  }
  if (foe.kind === 'switch') {
    const slot = slotOf(side, foe.target);
    const member = request.side.pokemon[slot];
    return !member || member.active || / fnt$/.test(member.condition) || request.active[i].trapped ? null : `switch ${slot + 1}`;
  }

  if (foe.kind === 'item' && battle.activePerHalf === 1) return `item ${foe.item}`;
  return null;
}

const MINE = ['me', 'me2'], FOES = ['foe', 'foe2'];
const POSITION_KEYS = { player: MINE[0], player2: MINE[1], enemy: FOES[0], enemy2: FOES[1] };

function placeTurn(battle, turn) {
  const field = new Map();
  battle.sides.forEach((side, n) => side.active.forEach((pokemon, slot) => field.set(POSITION_KEYS[positionAt(n, slot)], { pokemon: pokemon && !pokemon.fainted ? pokemon : null, side })));
  const keysOf = (half, commanded) => [...field].filter(([key, at]) => key.replace(/2$/, '') === half && (!commanded || half === 'foe' || at.side === battle.sides[0])).map(([key]) => key);
  const standing = (keys, who) => keys[namedIn(keys.map(key => field.get(key).pokemon), who)];
  const aimed = (command, user) => {
    const { at } = command;
    if (!at || typeof at === 'string') return command;
    const key = at.rel === 'self' ? user : at.rel === 'ally' ? keysOf(user.replace(/2$/, '')).find(k => k !== user) : standing(keysOf(at.side), at.who);
    const out = { ...command };
    if (key) out.at = key; else delete out.at;
    return out;
  };
  const placed = {}, from = {};
  for (const half of ['me', 'foe']) {
    const parts = sideParts(turn, half);
    for (const [key, command] of parts) if (!command.who) placed[key] = aimed(command, key);
    for (const [key, command] of parts) {
      const at = command.who && standing(keysOf(half, true), command.who);
      if (!at || placed[at]) continue;
      placed[at] = aimed(command, at);
      from[at] = key;
    }
  }

  const [away] = sideParts(turn, 'me').filter(([, command]) => command.who && !standing(keysOf('me'), command.who)).map(([key]) => key);
  if (away) for (const key of keysOf('me', true)) if (!placed[key]) from[key] = away;
  return { turn: placed, from };
}

function targetLoc(battle, user, option, at) {
  if (battle.activePerHalf === 1) return '';
  const where = moveTargets(battle, user, option.target ?? battle.dex.moves.get(option.id).target);
  if (!where.choose) return '';
  const wanted = at ? (at.startsWith(user.side.n % 2 ? 'foe' : 'me') ? -1 : 1) * (at.endsWith('2') ? 2 : 1) : null;
  const target = where.targets.find(t => t.loc === wanted) ?? where.targets.find(t => !t.ally) ?? where.targets[0];
  return target ? ` ${target.loc}` : '';
}

function commandAt(turn, i, alone) {
  const key = MINE[i];
  if (turn[key] || !alone) return { key, command: turn[key] ?? null };
  const given = MINE.filter(k => turn[k] && !turn[k].who);
  return given.length === 1 ? { key: given[0], command: turn[given[0]] } : { key, command: null };
}

async function resolveDouble(ctx, request, turn) {
  const { battle, names, lang, wild, gimmicks, bag } = ctx;
  const side = battle.sides[0];
  if (request.forceSwitch) {
    const party = partySlots(battle, names, lang, request, { reviving: isReviving(request) });
    const alone = request.forceSwitch.filter(Boolean).length === 1;
    let failed = null;
    const choice = await forcedPicks(request, party, (i, chosen, candidates) => {
      const { key, command } = commandAt(turn, i, alone);
      const index = command?.kind === 'switch' ? slotOf(side, command.target) : -1;
      const slot = index < 0 ? -1 : partyIndex(party, index);
      if (candidates.includes(slot)) return { text: `switch ${index + 1}`, slot };
      failed = { reason: command ? 'noSwitch' : 'noCommand', part: key };
      return null;
    });
    return choice ? { choice } : failed;
  }
  const autos = request.active.map((_, i) => autoPick(battle, request, i));
  const alone = autos.filter(auto => auto === null).length === 1;
  const picks = [], chosen = new Set(), taken = new Map();
  let gimmickUsed = false;
  for (const [i, auto] of autos.entries()) {
    if (auto !== null) { picks.push(auto); continue; }
    const { key, command } = commandAt(turn, i, alone);
    const active = request.active[i], pokemon = side.active[i];
    const no = (reason, text) => ({ reason, ...(text ? { text } : {}), part: key });
    if (!command) return no('noCommand');
    if (command.kind === 'run') {
      try { return { choice: ctx.run.choice() }; } catch { return no('cantRun'); }
    }
    if (command.kind === 'item') {

      if (!bag || !((bag.counts.get(command.item) ?? 0) - (taken.get(command.item) ?? 0) > 0)) return no('noItem');
      const named = slotOf(side, command.target);
      const slot = named >= 0 ? named : side.pokemon.indexOf(pokemon);
      let pick;
      try { pick = bagPick(ctx, request, command, slot, i, taken); }
      catch { return no('cantUse'); }
      if (isBall(command.item)) return { choice: pick };
      taken.set(command.item, (taken.get(command.item) ?? 0) + 1);
      picks.push(pick);
      continue;
    }
    if (command.kind === 'switch') {
      const slot = slotOf(side, command.target);
      const member = request.side.pokemon[slot];
      if (!member || member.active || / fnt$/.test(member.condition) || chosen.has(slot)) return no('noSwitch');
      if (active.trapped) return no('trapped', hiddenTrapText(battle, names, lang, wild));
      picks.push(`switch ${slot + 1}`);
      chosen.add(slot);
      continue;
    }
    const index = active.moves.findIndex(option => option.id === command.move);
    if (index < 0) return no('noMove');
    const option = active.moves[index];
    if ((option.pp ?? 1) <= 0) return no('noPp', moveDeniedText(battle, names, option, lang, pokemon));
    if (option.disabled) return no('disabled', moveDeniedText(battle, names, option, lang, pokemon));
    const offered = gimmickUsed ? {} : gimmickOptions(request, gimmicks, i);
    const suffix = command.gimmick === 'mega' && offered.mega ? ' mega' : command.gimmick === 'tera' && offered.tera ? ' terastallize' : '';
    gimmickUsed ||= !!suffix;
    picks.push(`move ${index + 1}${targetLoc(battle, pokemon, option, command.at)}${suffix}`);
  }
  return { choice: joinParts(picks) };
}

async function foeDouble(battle, side, turn, enemy, keys) {
  const request = side.activeRequest;
  const parts = keys.slice(0, request.active?.length ?? 0).map((key, i) => resolveFoe(battle, request, turn[key], i, side));
  if (!parts.some(Boolean)) return null;
  const ai = (await enemy(parts)).split(', ');
  return parts.map((part, i) => part ?? ai[i]).join(', ');
}

const breaks = (battle, from) => battle.ended || battle.log.slice(from).some(line => line.startsWith('|faint|'))
  || battle.sides.some(side => side.activeRequest?.forceSwitch);

export async function planTurns(sim, snapshot, turns, { options = {}, enemyAI, names, lang = DEFAULT_LANG } = {}) {
  checkSnapshot(snapshot);
  checkLang(lang);
  await loadExpText(lang);
  const { battle, wild, bag, run } = buildEngine(sim, snapshot.spec, options, names, lang);
  try {
    const inputs = [];
    const input = entry => { inputs.push(structuredClone(entry)); return applyInput({ battle, bag, run }, entry); };
    const fp = fingerprint(battle);
    replaySnapshot(battle, snapshot, fp, input);
    enemyAI.loadState?.(battle, snapshot.ai);
    const reseeds = snapshot.reseeds ?? [];

    const lines = [], marks = {};
    const view = new Proxy({}, { get: (_, key) => (key === 'then' ? undefined
      : key === 'message' ? async message => { if (typeof message === 'string') lines.push(message.replace(/\n/g, ' ')); } : async () => undefined) });
    const step = createSteps({ battle, view, names, warn: () => {}, bag, options, run, mode: { silent: true }, wild, lang, onInput: () => {} });
    const reader = createProtocolReader();
    const readOn = async () => {
      for (const item of arrange(reader.read(battle.log, battle.storyLogMeta))) {
        await step(item);
        if (item.kind === 'turn') marks[Number(item.args[0])] = lines.length;
      }
      await step.flush();
    };
    await readOn();
    const logFrom = battle.log.length;
    const ctx = { battle, bag, run, names, lang, wild, gimmicks: { teraOrb: snapshot.spec.teraOrb !== false } };
    const double = battle.activePerHalf > 1;
    const entries = [], results = [];

    const ai = async (id, given) => enemyAI(battle, id, given);
    const others = () => battle.sides.slice(1).filter(side => side.activeRequest && !side.activeRequest.wait);
    const keysOf = side => (side.n === 3 ? ['foe2'] : battle.sides.length > 2 ? ['foe'] : FOES);
    const p1 = () => battle.sides[0].activeRequest;

    if (turns.length && !battle.ended && p1()?.wait && others().some(side => side.activeRequest.forceSwitch)) {
      for (const side of others()) {
        const choice = await ai(side.id);
        if (!input([side.id, choice])) throw new Error(`Engine rejected ${side.id} choice: ${choice}`);
        commitChoice(battle, side.id, choice);
      }
      await readOn();
    }
    let stop = false;
    for (const written of turns.slice(0, PLAN_MAX_TURNS)) {
      const request = p1();
      if (stop || battle.ended || !request || request.wait || (request.forceSwitch && results.length)) { results.push({ state: 'dropped' }); stop = true; continue; }
      const from = battlePoint(battle);

      const { turn: command, from: writtenAs } = placeTurn(battle, written);
      const partOf = key => { const part = writtenAs[key] ?? key; return part === 'me' ? {} : { part }; };
      const mine = double ? await resolveDouble(ctx, request, command) : resolveMine(ctx, request, command.me);
      if (!mine.choice) {
        results.push({ state: 'rejected', reason: mine.reason, ...(mine.text ? { text: mine.text } : {}), ...partOf(mine.part ?? 'me') });
        stop = true;
        continue;
      }
      const logFrom = battle.log.length, turn = battle.turn, given = inputs.length;

      const theirs = [];
      for (const side of others()) {
        const enemy = given => ai(side.id, given);
        let choice = side.id === 'p3' ? null : double ? await foeDouble(battle, side, command, enemy, keysOf(side)) : resolveFoe(battle, side.activeRequest, command.foe);
        if (!choice) choice = await enemy();
        theirs.push([side.id, choice]);
      }
      if (!input(['p1', mine.choice])) {

        const retried = p1()?.active ?? [];
        const parts = typeof mine.choice === 'string' ? mine.choice.split(', ') : (mine.choice.parts ?? []).map(part => (typeof part === 'string' ? part : ''));
        const trapped = parts.findIndex((part, i) => part.startsWith('switch') && retried[i]?.trapped);
        const blocked = parts.findIndex((part, i) => retried[i]?.moves?.[(/^move (\d+)/.exec(part)?.[1] ?? 0) - 1]?.disabled);
        const at = trapped >= 0 ? trapped : blocked;
        const option = blocked >= 0 ? retried[blocked].moves[/^move (\d+)/.exec(parts[blocked])[1] - 1] : null;
        const text = trapped >= 0 ? hiddenTrapText(battle, names, lang, wild)
          : option ? moveDeniedText(battle, names, option, lang, battle.sides[0].active[blocked]) : undefined;
        inputs.length = given;
        results.push({ state: 'rejected', reason: trapped >= 0 || (at < 0 && /^switch/.test(parts[0] ?? '')) ? 'trapped' : 'disabled',
          ...(text ? { text } : {}), ...partOf(double && at >= 0 ? MINE[at] : 'me') });
        stop = true;
        continue;
      }
      commitChoice(battle, 'p1', mine.choice);
      if (!run.ends(mine.choice)) {
        for (let [id, choice] of theirs) {
          let accepted = input([id, choice]);
          if (!accepted) { choice = await ai(id); accepted = input([id, choice]); }
          if (!accepted) throw new Error(`Engine rejected ${id} choice: ${choice}`);
          commitChoice(battle, id, choice);
        }
      }
      entries.push({ from, inputs: inputs.slice(given), ai: enemyAI.saveState?.(battle) ?? null });
      results.push({ state: 'done', turn });
      await readOn();
      if (breaks(battle, logFrom)) stop = true;
    }
    const to = { v: SNAPSHOT_VERSION, spec: snapshot.spec, inputs: structuredClone(inputs), ai: enemyAI.saveState?.(battle) ?? null,
      turn: battle.turn, fp, check: stateCheck(battle), ...(reseeds.length ? { reseeds: structuredClone(reseeds) } : {}) };
    return { entries, turns: results, to, lines, marks, log: [...battle.log], logFrom };
  } finally {
    battle.destroy();
  }
}

export function commandQueue(entries) {
  const queue = [...entries ?? []];
  return {
    take(point) {
      const next = queue[0];
      if (!next || next.from.turn !== point.turn || next.from.check !== point.check) return null;
      return queue.shift();
    },
    get left() { return queue.length; },
  };
}
