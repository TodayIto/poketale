import { checkLang, DEFAULT_LANG } from './lang.js';

const KO = {

  'own.itemObtained': '{{pokemonNameWithAffix}}[[는]]\n{{itemName}}[[를]] 손에 넣었다!',

  'own.airBalloon': '{{pokemonNameWithAffix}}[[는]]\n풍선 때문에 떠 있다!',
  'own.airBalloonPopped': '{{pokemonNameWithAffix}}의\n풍선이 터졌다!',
  'own.itemHeal': '{{pokemonNameWithAffix}}[[는]] {{itemName}}[[로]]\n조금 회복했다.',
  'own.lifeOrb': '{{pokemonNameWithAffix}}의\n생명이 조금 깎였다!',
  'own.itemDamage': '{{pokemonNameWithAffix}}[[는]]\n{{itemName}} 때문에 데미지를 입었다!',
  'own.itemDamageFrom': '{{pokemonNameWithAffix}}[[는]] {{sourceName}}의\n{{itemName}} 때문에 데미지를 입었다!',
  'own.itemSurvive': '{{pokemonNameWithAffix}}[[는]]\n{{itemName}}[[로]] 버텼다!',
  'own.itemWeaken': '{{pokemonNameWithAffix}}[[가]] 입는 데미지를\n{{itemName}}[[가]] 약하게 했다!',
  'own.gem': '{{itemName}}[[는]]\n{{moveName}}의 위력을 강하게 했다!',
  'own.powerHerb': '{{pokemonNameWithAffix}}[[는]] {{itemName}}[[로]]\n힘이 넘쳐흐른다!',
  'own.ejectItem': '{{pokemonNameWithAffix}}[[는]]\n{{itemName}} 때문에 돌아간다!',
  'own.redCard': '{{pokemonNameWithAffix}}[[는]] {{itemName}}[[를]]\n{{targetName}}에게 꺼내 들었다!',
  'own.mirrorHerb': '{{pokemonNameWithAffix}}[[는]] {{itemName}}[[를]] 써서\n상대의 능력 변화를 흉내 냈다!',
  'own.abilityShield': '{{pokemonNameWithAffix}}[[는]] {{itemName}}의 효과로\n특성을 보호받고 있다!',
  'own.clearAmulet': '{{pokemonNameWithAffix}}[[는]] {{itemName}}의 효과로\n능력이 떨어지지 않는다!',
  'own.safetyGoggles': '{{pokemonNameWithAffix}}[[는]] {{itemName}} 때문에\n{{moveName}}에 당하지 않는다!',
  'own.boosterEnergy': '{{pokemonNameWithAffix}}[[는]] {{itemName}}에 의해\n{{abilityName}}[[를]] 발동했다!',
  'own.statusFromItem.brn': '{{pokemonNameWithAffix}}[[는]]\n{{itemName}} 때문에 화상을 입었다!',
  'own.statusFromItem.tox': '{{pokemonNameWithAffix}}[[는]]\n{{itemName}} 때문에 맹독에 중독됐다!',
  'own.cureFromItem.brn': '{{pokemonNameWithAffix}}[[는]] {{itemName}}[[로]]\n화상이 나았다!',
  'own.cureFromItem.frz': '{{pokemonNameWithAffix}}[[는]] {{itemName}}[[로]]\n얼음 상태가 나았다!',
  'own.cureFromItem.par': '{{pokemonNameWithAffix}}[[는]] {{itemName}}[[로]]\n마비가 풀렸다!',
  'own.cureFromItem.psn': '{{pokemonNameWithAffix}}[[는]] {{itemName}}[[로]]\n독이 해독됐다!',
  'own.cureFromItem.slp': '{{pokemonNameWithAffix}}[[는]] {{itemName}}[[로]]\n눈을 떴다!',
  'own.cureFromItem.confusion': '{{pokemonNameWithAffix}}[[는]] {{itemName}}[[로]]\n혼란이 풀렸다!',
  'own.focusEnergyFromItem': '{{pokemonNameWithAffix}}[[는]] {{itemName}}[[를]] 써서\n의욕이 넘치기 시작했다!',
  'own.attractFromItem': '{{pokemonNameWithAffix}}[[는]]\n{{itemName}} 때문에 헤롱헤롱해졌다!',

  'own.itemBoost1': '{{pokemonNameWithAffix}}[[는]] {{itemName}}[[로]]\n{{stats}}[[가]] 올라갔다!',
  'own.itemBoost2': '{{pokemonNameWithAffix}}[[는]] {{itemName}}[[로]]\n{{stats}}[[가]] 크게 올라갔다!',
  'own.itemBoost3': '{{pokemonNameWithAffix}}[[는]] {{itemName}}[[로]]\n{{stats}}[[가]] 매우 크게 올라갔다!',
  'own.itemUnboost1': '{{pokemonNameWithAffix}}[[는]] {{itemName}}[[로]]\n{{stats}}[[가]] 떨어졌다!',
  'own.itemUnboost2': '{{pokemonNameWithAffix}}[[는]] {{itemName}}[[로]]\n{{stats}}[[가]] 크게 떨어졌다!',
  'own.itemUnboost3': '{{pokemonNameWithAffix}}[[는]] {{itemName}}[[로]]\n{{stats}}[[가]] 매우 크게 떨어졌다!',

  'own.itemUsed': '{{pokemonNameWithAffix}}[[는]]\n{{itemName}}[[를]] 사용했다!',

  'own.fling': '{{pokemonNameWithAffix}}[[는]]\n{{itemName}}[[를]] 내던졌다!',
  'own.recycle': '{{pokemonNameWithAffix}}[[는]]\n{{itemName}}[[를]] 주워 왔다!',
  'own.micleBerry': '{{pokemonNameWithAffix}}[[는]] {{itemName}}[[로]]\n다음 기술이 잘 맞게 되었다!',
  'own.switchedItems': '{{pokemonName}}[[는]]\n서로의 도구를 교체했다!',

  'own.moveDisabledTaunt': '{{pokemonNameWithAffix}}[[는]] 도발당해서\n{{moveName}}[[를]] 쓸 수 없다!',

  'own.zPower': '{{pokemonNameWithAffix}}[[는]]\nZ파워를 몸에 둘렀다!',
  'own.zBroken': '{{pokemonNameWithAffix}}[[는]]\n공격을 완전히 막아 내지 못했다!',
  'own.ultraBurst': '{{pokemonNameWithAffix}}[[는]]\n울트라버스트로 원래의 힘을 되찾았다!',

  'own.usedItem': '{{pokemonName}}에게\n{{itemName}}[[를]] 사용했다!',

  'own.trainerUsedItem': '{{trainerName}}[[는]]\n{{itemName}}[[를]] 사용했다!',
  'own.revived': '{{pokemonName}}[[는]]\n기운을 되찾았다!',
  'own.ppRestoredAll': '{{pokemonNameWithAffix}}[[는]] {{itemName}}[[로]]\n기술의 PP를 회복했다!',
  'own.ballNoTarget': '포켓몬의 모습이 보이지 않아\n볼을 던질 수 없다!',
  'own.bagLocked': '지금은 가방을\n사용할 수 없다!',

  'own.sentToBox': '{{pokemonName}}[[는]]\n박스로 전송되었다!',

  'own.expShare': '나머지 포켓몬들도\n경험치를 얻었다!',

  'own.mintNote': '{{itemName}}의 효과를 받고 있다.',

  'own.pocket.heal': '회복', 'own.pocket.status': '상태', 'own.pocket.battle': '배틀', 'own.pocket.ball': '볼',

  'own.forfeitQuestion': '정말로 도망칠까요?',
  'own.forfeitNote': '패배로 기록됩니다',

  'own.alreadyChosen': '{{pokemonName}}[[는]]\n이미 교체하기로 골랐다!',
  'own.partnerPokemon': '동료의 포켓몬은 고를 수 없다!',
  'own.swap': '{{pokemonNameWithAffix}}[[와]] {{targetName}}[[는]]\n자리를 바꿨다!',

  'own.partnerGo': '{{trainerName}}[[는]] {{pokemonName}}[[를]] 꺼냈다!',
  'own.partnerPokemonWithAffix': '{{trainerName}}의 {{pokemonName}}',
};

const EN = {
  'own.itemObtained': '{{pokemonNameWithAffix}} obtained\n{{itemName}}.',
  'own.airBalloon': '{{pokemonNameWithAffix}} floats in the air\nwith its Air Balloon!',
  'own.airBalloonPopped': '{{pokemonNameWithAffix}}\'s\nAir Balloon popped!',
  'own.itemHeal': '{{pokemonNameWithAffix}} restored a little HP\nusing its {{itemName}}!',
  'own.lifeOrb': '{{pokemonNameWithAffix}}\nlost some of its HP!',
  'own.itemDamage': '{{pokemonNameWithAffix}} was hurt\nby its {{itemName}}!',
  'own.itemDamageFrom': '{{pokemonNameWithAffix}} was hurt by\n{{sourceName}}\'s {{itemName}}!',
  'own.itemSurvive': '{{pokemonNameWithAffix}} hung on\nusing its {{itemName}}!',
  'own.itemWeaken': '{{pokemonNameWithAffix}}\'s {{itemName}}\nlessened the damage it took!',
  'own.gem': '{{itemName}} strengthened\n{{moveName}}\'s power!',
  'own.powerHerb': '{{pokemonNameWithAffix}} became fully charged\ndue to its {{itemName}}!',
  'own.ejectItem': '{{pokemonNameWithAffix}} is switched out\nwith the {{itemName}}!',
  'own.redCard': '{{pokemonNameWithAffix}} held up its {{itemName}}\nagainst {{targetName}}!',
  'own.mirrorHerb': '{{pokemonNameWithAffix}} used its {{itemName}} to mirror\nits opponent\'s stat changes!',
  'own.abilityShield': '{{pokemonNameWithAffix}}\'s Ability is protected\nby the effects of its {{itemName}}!',
  'own.clearAmulet': 'The effects of {{pokemonNameWithAffix}}\'s {{itemName}}\nprevent its stats from being lowered!',
  'own.safetyGoggles': '{{pokemonNameWithAffix}} is not affected by {{moveName}}\nthanks to its {{itemName}}!',
  'own.boosterEnergy': '{{pokemonNameWithAffix}} used its {{itemName}}\nto activate {{abilityName}}!',
  'own.statusFromItem.brn': '{{pokemonNameWithAffix}} was burned\nby the {{itemName}}!',
  'own.statusFromItem.tox': '{{pokemonNameWithAffix}} was badly poisoned\nby the {{itemName}}!',
  'own.cureFromItem.brn': '{{pokemonNameWithAffix}}\'s {{itemName}}\nhealed its burn!',
  'own.cureFromItem.frz': '{{pokemonNameWithAffix}}\'s {{itemName}}\ndefrosted it!',
  'own.cureFromItem.par': '{{pokemonNameWithAffix}}\'s {{itemName}}\ncured its paralysis!',
  'own.cureFromItem.psn': '{{pokemonNameWithAffix}}\'s {{itemName}}\ncured its poison!',
  'own.cureFromItem.slp': '{{pokemonNameWithAffix}}\'s {{itemName}}\nwoke it up!',
  'own.cureFromItem.confusion': '{{pokemonNameWithAffix}}\'s {{itemName}}\nsnapped it out of its confusion!',
  'own.focusEnergyFromItem': '{{pokemonNameWithAffix}} used the {{itemName}}\nto get pumped!',
  'own.attractFromItem': '{{pokemonNameWithAffix}} fell in love\nbecause of the {{itemName}}!',
  'own.itemBoost1': 'The {{itemName}} raised\n{{pokemonNameWithAffix}}\'s {{stats}}!',
  'own.itemBoost2': 'The {{itemName}} sharply raised\n{{pokemonNameWithAffix}}\'s {{stats}}!',
  'own.itemBoost3': 'The {{itemName}} drastically raised\n{{pokemonNameWithAffix}}\'s {{stats}}!',
  'own.itemUnboost1': 'The {{itemName}} lowered\n{{pokemonNameWithAffix}}\'s {{stats}}!',
  'own.itemUnboost2': 'The {{itemName}} harshly lowered\n{{pokemonNameWithAffix}}\'s {{stats}}!',
  'own.itemUnboost3': 'The {{itemName}} severely lowered\n{{pokemonNameWithAffix}}\'s {{stats}}!',
  'own.itemUsed': '{{pokemonNameWithAffix}} used its\n{{itemName}}!',
  'own.fling': '{{pokemonNameWithAffix}} flung its\n{{itemName}}!',
  'own.recycle': '{{pokemonNameWithAffix}} found one\n{{itemName}}!',
  'own.micleBerry': '{{pokemonNameWithAffix}} boosted the accuracy of\nits next move using its {{itemName}}!',
  'own.switchedItems': '{{pokemonName}} switched items\nwith its target!',
  'own.moveDisabledTaunt': '{{pokemonNameWithAffix}} can\u2019t use {{moveName}} after the taunt!',
  'own.zPower': '{{pokemonNameWithAffix}} surrounded itself\nwith its Z-Power!',
  'own.zBroken': '{{pokemonNameWithAffix}} couldn\'t fully protect\nitself and got hurt!',
  'own.ultraBurst': '{{pokemonNameWithAffix}} regained its true power\nthrough Ultra Burst!',
  'own.usedItem': 'You used {{itemName}}\non {{pokemonName}}!',
  'own.trainerUsedItem': '{{trainerName}} used\n{{itemName}}!',
  'own.revived': '{{pokemonName}} was revived!',
  'own.ppRestoredAll': '{{pokemonNameWithAffix}}\'s PP was restored\nby the {{itemName}}!',
  'own.ballNoTarget': 'The Pok\u00e9mon can\'t be seen,\nso you can\'t throw a Ball!',
  'own.bagLocked': 'You can\'t use\nthe Bag right now!',
  'own.sentToBox': '{{pokemonName}} was sent\nto the Box!',
  'own.expShare': 'The rest of your team\ngained Exp. Points!',
  'own.mintNote': 'Under the effect of the {{itemName}}.',
  'own.pocket.heal': 'HP/PP Restore', 'own.pocket.status': 'Status Restore', 'own.pocket.battle': 'Battle Items', 'own.pocket.ball': 'Pok\u00e9 Balls',
  'own.forfeitQuestion': 'Do you really want to run away?',
  'own.forfeitNote': 'It will count as a loss.',
  'own.alreadyChosen': '{{pokemonName}} is already\ngoing in!',
  'own.partnerPokemon': 'You can\'t choose your partner\'s Pok\u00e9mon!',
  'own.swap': '{{pokemonNameWithAffix}} and {{targetName}}\nswitched places!',
  'own.partnerGo': '{{trainerName}} sent out {{pokemonName}}!',
  'own.partnerPokemonWithAffix': '{{trainerName}}\'s {{pokemonName}}',
};

// Own text per language, same keys
export const OWN = Object.freeze({ ko: KO, en: EN });

// Template of an own text in a language (undefined if not an own.* key or missing)
export const ownTemplate = (key, lang = DEFAULT_LANG) => (Object.hasOwn(OWN[checkLang(lang)], key) ? OWN[lang][key] : undefined);
