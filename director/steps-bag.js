import { BAG_ITEMS } from '../engine/bag.mjs';
import { statusNames, nameWithAffix, hpLog } from './text.js';
import { DEFAULT_LANG } from './lang.js';
import { bagText } from './bag.js';
import { sideOf, positionOf } from './read.js';
import { toID } from '../engine/mon.mjs';
import { splitEmoji } from '../story/custom-items.mjs';

const BY_NAME = new Map(Object.entries(BAG_ITEMS).map(([id, item]) => [`item: ${item.name}`, id]));

export const BAG_KINDS = ['-story-item', '-story-pp', '-story-ball', '-story-tool', '-story-toolend'];

const TOOL_START = { cheer: 'own.toolCheer', taunt: 'own.toolTaunt', distract: 'own.toolDistract' };
const TOOL_END = { taunt: 'own.toolTauntEnd', distract: 'own.toolDistractEnd' };

export function createBagSteps({ battle, view, names, ledger, bag, lang = DEFAULT_LANG, affix = nameWithAffix(lang) }) {
  const say = (key, values, options = {}) => view.message(bagText(key, values, lang), options);

  const itemName = id => bag?.itemName(id) ?? names.item(id);

  const sourceItem = from => BY_NAME.get(String(from)) ?? bag?.foodOf(from);

  let using = null, captured = null;

  async function present(event) {
    const { kind, args: a, kwArgs: kw } = event;
    switch (kind) {
    case '-story-item': {
      const [ident, uid, item] = a;
      if (sideOf(ident) === 'enemy') {

        using = null;
        await say('own.trainerUsedItem', { trainerName: battle.getSide(ident.slice(0, 2)).name, itemName: names.item(item) });
        return;
      }
      using = { item, name: ledger.get(ident).name, ppShown: false };
      bag?.spend(item);
      await say('own.usedItem', { pokemonName: using.name, itemName: itemName(item) });
      return;
    }
    case '-story-tool': {

      using = null;
      const [ident, , item, label, tag] = a;
      const side = sideOf(ident), target = kw.trainer || affix(ledger.get(ident).name, side);
      await say('own.usedItem', { pokemonName: target, itemName: bag ? itemName(item) : splitEmoji(label).rest });
      if (kw.fail) await say('party-ui-handler.anyEffect');
      else if (TOOL_START[tag]) await say(TOOL_START[tag], { pokemonNameWithAffix: target });
      return;
    }
    case '-story-toolend': {
      const [ident, , tag] = a;
      if (TOOL_END[tag]) await say(TOOL_END[tag], { pokemonNameWithAffix: kw.trainer || affix(ledger.get(ident).name, sideOf(ident)) });
      return;
    }
    case '-story-pp': {
      // One line per restored move - text only once (PP values reach the move menu with the next request)
      if (!using || using.ppShown) return;
      using.ppShown = true;
      const values = { pokemonNameWithAffix: affix(using.name, 'player'), itemName: itemName(using.item) };
      if (BAG_ITEMS[using.item]?.oneMove) await say('battle.ppHealBerry', { ...values, berryName: values.itemName, moveName: names.move(toID(a[2])) });
      else await say('own.ppRestoredAll', values);
      return;
    }
    case '-story-ball': {
      using = null;
      const [, , ball, shakes, result] = a;
      if (result !== 'blocked') bag?.spend(ball);

      await view.message('', {});
      await view.throwBall(ball, { shakes: Number(shakes), result, critical: !!kw.critical });
      if (result === 'blocked') await say('battle.noPokeballTrainer');
      else if (result === 'broke') await say('battle.pokemonBrokeFree');
      else {

        const pokemonName = ledger.get(a[0]).name;
        captured = { pokemonName, toBox: !!kw.tobox };
        await say('battle.pokemonCaught', { pokemonName }, { wait: true });

        await view.hideInfo?.('enemy');
      }
      return;
    }
    case '-heal': {
      const { hp, maxhp } = ledger.get(a[0]), item = sourceItem(kw.from), name = ledger.get(a[0]).name;
      const log = hpLog(affix(name, positionOf(a[0])), event.before, hp, maxhp);
      if (sideOf(a[0]) === 'enemy') {

        if (!ledger.onField(a[0])) return;
        await view.playCommon('health-up', positionOf(a[0]));
        await view.hpChange(positionOf(a[0]), hp, maxhp, { cause: 'other', effectiveness: 'normal', log });
        return;
      }

      if (!ledger.onField(a[0])) { await say(BAG_ITEMS[item]?.revive ? 'own.revived' : 'battle.regainHealth', { pokemonName: name }); return; }

      await view.playCommon('health-up', positionOf(a[0]));
      await view.hpChange(positionOf(a[0]), hp, maxhp, { cause: 'other', effectiveness: 'normal', log });
      await say('battle.regainHealth', { pokemonName: name });
      return;
    }
    case '-curestatus': {
      const status = statusNames[a[1]], name = ledger.get(a[0]).name;

      if (!ledger.onField(a[0])) { if (status) await say(`status-effect.${status}.heal`, { pokemonNameWithAffix: affix(name, sideOf(a[0])) }); return; }
      await view.setStatus(positionOf(a[0]), '');
      const named = affix(name, positionOf(a[0]));
      await say(`own.cureFromItem.${a[1] === 'tox' ? 'psn' : a[1]}`, { pokemonNameWithAffix: named, pokemonName: named, itemName: itemName(sourceItem(kw.from)) });
      return;
    }
    }
  }

  return {
    present,

    usesBagItem: ({ kind, kwArgs: kw }) => (kind === '-heal' || kind === '-curestatus') && sourceItem(kw.from) !== undefined,

    caught: () => captured,
    say,

    wildAppeared: mon => say('battle.singleWildAppeared', { pokemonName: mon.name }),
  };
}
