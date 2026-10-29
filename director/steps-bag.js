import { BAG_ITEMS } from '../engine/bag.mjs';
import { statusNames } from './text.js';
import { bagText } from './bag.js';
import { sideOf } from './read.js';
import { toID } from '../engine/mon.mjs';

const BY_NAME = new Map(Object.entries(BAG_ITEMS).map(([id, item]) => [`item: ${item.name}`, id]));

// Lines this module handles (steps.js dispatch table). Plus -heal,-curestatus from bag items (usesBagItem)
export const BAG_KINDS = ['-story-item', '-story-pp', '-story-ball'];

export function createBagSteps({ battle, view, names, ledger, bag }) {
  const say = (key, values, options = {}) => view.message(bagText(key, values), options);

  let using = null, captured = null;

  async function present(event) {
    const { kind, args: a, kwArgs: kw } = event;
    switch (kind) {
    case '-story-item': {
      const [ident, uid, item] = a;
      if (sideOf(ident) === 'enemy') {

        using = null;
        await say('own.trainerUsedItem', { trainerName: battle.sides[1].name, itemName: names.item(item) });
        return;
      }
      using = { item, name: ledger.get(ident).name, ppShown: false };
      bag?.spend(item);
      await say('own.usedItem', { pokemonName: using.name, itemName: names.item(item) });
      return;
    }
    case '-story-pp': {

      // One line per restored move - text only once (PP values reach the move menu with the next request)
      if (!using || using.ppShown) return;
      using.ppShown = true;
      const values = { pokemonNameWithAffix: using.name, itemName: names.item(using.item) };
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
      const { hp, maxhp } = ledger.get(a[0]), item = BY_NAME.get(String(kw.from)), name = ledger.get(a[0]).name;
      if (sideOf(a[0]) === 'enemy') {

        if (!ledger.onField(a[0])) return;
        await view.playCommon('health-up', 'enemy');
        await view.hpChange('enemy', hp, maxhp, { cause: 'other', effectiveness: 'normal' });
        return;
      }

      if (!ledger.onField(a[0])) { await say(BAG_ITEMS[item].revive ? 'own.revived' : 'battle.regainHealth', { pokemonName: name }); return; }

      await view.playCommon('health-up', 'player');
      await view.hpChange('player', hp, maxhp, { cause: 'other', effectiveness: 'normal' });
      await say('battle.regainHealth', { pokemonName: name });
      return;
    }
    case '-curestatus': {
      const status = statusNames[a[1]], name = ledger.get(a[0]).name;

      if (!ledger.onField(a[0])) { if (status) await say(`status-effect.${status}.heal`, { pokemonNameWithAffix: name }); return; }
      await view.setStatus(sideOf(a[0]), '');
      await say(`own.cureFromItem.${a[1] === 'tox' ? 'psn' : a[1]}`, { pokemonNameWithAffix: name, pokemonName: name, itemName: names.item(BY_NAME.get(String(kw.from))) });
      return;
    }
    }
  }

  return {
    present,

    usesBagItem: ({ kind, kwArgs: kw }) => (kind === '-heal' || kind === '-curestatus') && BY_NAME.has(String(kw.from)),

    caught: () => captured,
    say,

    wildAppeared: mon => say('battle.singleWildAppeared', { pokemonName: mon.name }),
  };
}
