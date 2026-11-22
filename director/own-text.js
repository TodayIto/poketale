import { checkLang, DEFAULT_LANG } from './lang.js';

const KO = {

  'own.itemObtained': '{{pokemonNameWithAffix}}[[는]]\n{{itemName}}[[를]] 손에 넣었다!',

  'own.airBalloon': '{{pokemonNameWithAffix}}[[는]]\n풍선 때문에 떠 있다!', // items airballoon.start
  'own.airBalloonPopped': '{{pokemonNameWithAffix}}의\n풍선이 터졌다!', // items airballoon.end
  'own.itemHeal': '{{pokemonNameWithAffix}}[[는]] {{itemName}}[[로]]\n조금 회복했다.', // items leftovers/blacksludge/shellbell.heal
  'own.lifeOrb': '{{pokemonNameWithAffix}}의\n생명이 조금 깎였다!', // items lifeorb.damage
  'own.itemDamage': '{{pokemonNameWithAffix}}[[는]]\n{{itemName}} 때문에 데미지를 입었다!',
  'own.itemDamageFrom': '{{pokemonNameWithAffix}}[[는]] {{sourceName}}의\n{{itemName}} 때문에 데미지를 입었다!', // default damageFromPokemon (Jaboca / Rowap Berry)
  'own.itemSurvive': '{{pokemonNameWithAffix}}[[는]]\n{{itemName}}[[로]] 버텼다!',
  'own.itemWeaken': '{{pokemonNameWithAffix}}[[가]] 입는 데미지를\n{{itemName}}[[가]] 약하게 했다!', // default eatItemWeaken (resist berries)
  'own.gem': '{{itemName}}[[는]]\n{{moveName}}의 위력을 강하게 했다!', // default useGem
  'own.powerHerb': '{{pokemonNameWithAffix}}[[는]] {{itemName}}[[로]]\n힘이 넘쳐흐른다!', // items powerherb.end
  'own.ejectItem': '{{pokemonNameWithAffix}}[[는]]\n{{itemName}} 때문에 돌아간다!', // items ejectbutton/ejectpack.end
  'own.redCard': '{{pokemonNameWithAffix}}[[는]] {{itemName}}[[를]]\n{{targetName}}에게 꺼내 들었다!', // items redcard.end
  'own.mirrorHerb': '{{pokemonNameWithAffix}}[[는]] {{itemName}}[[를]] 써서\n상대의 능력 변화를 흉내 냈다!', // items mirrorherb.activate
  'own.abilityShield': '{{pokemonNameWithAffix}}[[는]] {{itemName}}의 효과로\n특성을 보호받고 있다!', // items abilityshield.block
  'own.clearAmulet': '{{pokemonNameWithAffix}}[[는]] {{itemName}}의 효과로\n능력이 떨어지지 않는다!', // items clearamulet.block
  'own.safetyGoggles': '{{pokemonNameWithAffix}}[[는]] {{itemName}} 때문에\n{{moveName}}에 당하지 않는다!', // items safetygoggles.block
  'own.boosterEnergy': '{{pokemonNameWithAffix}}[[는]] {{itemName}}에 의해\n{{abilityName}}[[를]] 발동했다!', // abilities protosynthesis/quarkdrive.activateFromItem
  'own.statusFromItem.brn': '{{pokemonNameWithAffix}}[[는]]\n{{itemName}} 때문에 화상을 입었다!', // default brn.startFromItem
  'own.statusFromItem.tox': '{{pokemonNameWithAffix}}[[는]]\n{{itemName}} 때문에 맹독에 중독됐다!', // default tox.startFromItem
  'own.cureFromItem.brn': '{{pokemonNameWithAffix}}[[는]] {{itemName}}[[로]]\n화상이 나았다!', // default brn.endFromItem
  'own.cureFromItem.frz': '{{pokemonNameWithAffix}}[[는]] {{itemName}}[[로]]\n얼음 상태가 나았다!', // default frz.endFromItem
  'own.cureFromItem.par': '{{pokemonNameWithAffix}}[[는]] {{itemName}}[[로]]\n마비가 풀렸다!', // default par.endFromItem
  'own.cureFromItem.psn': '{{pokemonNameWithAffix}}[[는]] {{itemName}}[[로]]\n독이 해독됐다!', // default psn.endFromItem (tox uses #psn)
  'own.cureFromItem.slp': '{{pokemonNameWithAffix}}[[는]] {{itemName}}[[로]]\n눈을 떴다!', // default slp.endFromItem
  'own.cureFromItem.confusion': '{{pokemonNameWithAffix}}[[는]] {{itemName}}[[로]]\n혼란이 풀렸다!', // default confusion.endFromItem
  'own.focusEnergyFromItem': '{{pokemonNameWithAffix}}[[는]] {{itemName}}[[를]] 써서\n의욕이 넘치기 시작했다!', // moves focusenergy.startFromItem (Lansat Berry)
  'own.attractFromItem': '{{pokemonNameWithAffix}}[[는]]\n{{itemName}} 때문에 헤롱헤롱해졌다!',

  'own.itemBoost1': '{{pokemonNameWithAffix}}[[는]] {{itemName}}[[로]]\n{{stats}}[[가]] 올라갔다!',
  'own.itemBoost2': '{{pokemonNameWithAffix}}[[는]] {{itemName}}[[로]]\n{{stats}}[[가]] 크게 올라갔다!',
  'own.itemBoost3': '{{pokemonNameWithAffix}}[[는]] {{itemName}}[[로]]\n{{stats}}[[가]] 매우 크게 올라갔다!',
  'own.itemUnboost1': '{{pokemonNameWithAffix}}[[는]] {{itemName}}[[로]]\n{{stats}}[[가]] 떨어졌다!',
  'own.itemUnboost2': '{{pokemonNameWithAffix}}[[는]] {{itemName}}[[로]]\n{{stats}}[[가]] 크게 떨어졌다!',
  'own.itemUnboost3': '{{pokemonNameWithAffix}}[[는]] {{itemName}}[[로]]\n{{stats}}[[가]] 매우 크게 떨어졌다!',

  'own.itemUsed': '{{pokemonNameWithAffix}}[[는]]\n{{itemName}}[[를]] 사용했다!',

  'own.fling': '{{pokemonNameWithAffix}}[[는]]\n{{itemName}}[[를]] 내던졌다!', // moves fling.removeItem
  'own.recycle': '{{pokemonNameWithAffix}}[[는]]\n{{itemName}}[[를]] 주워 왔다!', // moves recycle.addItem
  'own.micleBerry': '{{pokemonNameWithAffix}}[[는]] {{itemName}}[[로]]\n다음 기술이 잘 맞게 되었다!',
  'own.switchedItems': '{{pokemonName}}[[는]]\n서로의 도구를 교체했다!',

  'own.moveDisabledTaunt': '{{pokemonNameWithAffix}}[[는]] 도발당해서\n{{moveName}}[[를]] 쓸 수 없다!',

  'own.spikyShield': '{{pokemonNameWithAffix}}[[는]]\n{{moveName}}의 데미지를 입었다!',

  'own.zPower': '{{pokemonNameWithAffix}}[[은]]\nZ파워에 몸이 둘러싸였다!', // the games' sentence (Sun/Moon)
  'own.zEffect': '{{pokemonNameWithAffix}}[[가]] 뿜어내는\n전력의 Z기술!', // default zEffect
  'own.zBroken': '{{pokemonNameWithAffix}}[[는]]\n공격을 완전히 막아 내지 못했다!',
  'own.ultraBurst': '{{pokemonNameWithAffix}}[[는]]\n울트라버스트로 원래의 힘을 되찾았다!',

  'own.dynamaxBlock': '다이맥스의\n힘으로 튕겨 냈다!', // BTL_STRID_STD_RAID_WazaFailed (Showdown dynamax.block)
  'own.dynamaxFail': '{{pokemonNameWithAffix}}[[는]] 고개를 가로저었다.\n이 기술은 쓸 수 없는 것 같다...', // BTL_STRID_SET_WazaFail_TargetIsG
  'own.gmaxWildfirePlayer': '우리 편 포켓몬은\n불꽃에 휩싸였다!', // BTL_STRID_STD_GShockWave_SideEffect_Honoo
  'own.gmaxWildfireEnemy': '상대의 포켓몬은\n불꽃에 휩싸였다!', // ..._Honoo_E
  'own.gmaxCannonadePlayer': '우리 편 포켓몬은\n거친 물살에 휩싸였다!', // ..._Mizu
  'own.gmaxCannonadeEnemy': '상대의 포켓몬은\n거친 물살에 휩싸였다!', // ..._Mizu_E
  'own.gmaxVineLashPlayer': '우리 편 포켓몬은\n채찍의 맹타에 휩싸였다!', // ..._Kusa
  'own.gmaxVineLashEnemy': '상대의 포켓몬은\n채찍의 맹타에 휩싸였다!', // ..._Kusa_E
  'own.gmaxVolcalithPlayer': '우리 편 포켓몬은\n바위에 둘러싸였다!', // ..._Iwa
  'own.gmaxVolcalithEnemy': '상대의 포켓몬은\n바위에 둘러싸였다!', // ..._Iwa_E
  'own.gmaxSteelsurgePlayer': '우리 편 주변에\n뾰족한 강철이 떠다니기 시작했다!', // BTL_STRID_STD_StealthRock_Hagane
  'own.gmaxSteelsurgeEnemy': '상대의 주변에\n뾰족한 강철이 떠다니기 시작했다!', // ..._Hagane_E
  'own.gmaxSteelsurgeEndPlayer': '우리 편 주변의\n강철이 사라졌다!', // BTL_STRID_STD_StealthRockOff_Hagane
  'own.gmaxSteelsurgeEndEnemy': '상대 주변의\n강철이 사라졌다!', // ..._Hagane_E
  'own.gmaxWildfireDamage': '{{pokemonNameWithAffix}}[[는]]\n거다이옥염의 불꽃에 휩싸여서 뜨거워하고 있다!', // BTL_STRID_SET_GShockWave_SideEffect_Honoo_Damage
  'own.gmaxCannonadeDamage': '{{pokemonNameWithAffix}}[[는]]\n거다이포격의 물살에 삼켜져서 괴로워하고 있다!', // ..._Mizu_Damage
  'own.gmaxVineLashDamage': '{{pokemonNameWithAffix}}[[는]]\n거다이편달이 퍼붓는 맹타에 아파하고 있다!', // ..._Kusa_Damage
  'own.gmaxVolcalithDamage': '{{pokemonNameWithAffix}}[[는]]\n거다이분석으로 날아든 바위에 맞아서 아파하고 있다!', // ..._Iwa_Damage
  'own.gmaxSteelsurgeDamage': '{{pokemonNameWithAffix}}에게\n뾰족한 강철이 박혔다!', // BTL_STRID_SET_StealthRockDamage_Hagane
  'own.gmaxDepletionPlayer': '우리 편 포켓몬의\nPP가 줄었다!', // BTL_STRID_STD_GShockWave_PP_Reduce
  'own.gmaxDepletionEnemy': '상대 포켓몬의\nPP가 줄었다!',

  'own.usedItem': '{{pokemonName}}에게\n{{itemName}}[[를]] 사용했다!',

  'own.usedSideItem': '{{itemName}}[[를]] 사용했다!',

  'own.itemNoEffect': '그러나 효과가 없는 것 같다…',

  'own.pokeFluteTune': '아름다운 음색이 울려 퍼졌다!',

  'own.trainerUsedItem': '{{trainerName}}[[는]]\n{{itemName}}[[를]] 사용했다!',
  'own.revived': '{{pokemonName}}[[는]]\n기운을 되찾았다!',
  'own.ppRestoredAll': '{{pokemonNameWithAffix}}[[는]] {{itemName}}[[로]]\n기술의 PP를 회복했다!',
  'own.ballNoTarget': '포켓몬의 모습이 보이지 않아\n볼을 던질 수 없다!',

  'own.toolCheer': '{{pokemonNameWithAffix}}[[는]]\n힘이 솟아났다!',
  'own.toolTaunt': '{{pokemonNameWithAffix}}[[는]]\n도발에 넘어가 버렸다!', // moves taunt.start
  'own.toolTauntEnd': '{{pokemonNameWithAffix}}[[는]]\n도발의 효과가 풀렸다!', // moves taunt.end
  'own.toolDistract': '{{pokemonNameWithAffix}}[[는]]\n정신이 팔렸다!',
  'own.toolDistractEnd': '{{pokemonNameWithAffix}}[[는]]\n정신을 차렸다!',
  'own.bagLocked': '지금은 가방을\n사용할 수 없다!',

  'own.sentToBox': '{{pokemonName}}[[는]]\n박스로 전송되었다!',

  'own.expShare': '나머지 포켓몬들도\n경험치를 얻었다!',

  'own.learnMoveForgetConfirm': '정말로 {{moveName}}[[를]] 잊게 하겠습니까?',

  'own.mintNote': '{{itemName}}의 효과를 받고 있다.',

  'own.eraGimmickDisabled': '{{moveName}}[[는]]\n이 세대에서는 쓸 수 없다!',
  'own.attackMissed': '그러나 {{pokemonNameWithAffix}}의\n공격은 빗나갔다!', // default missNoPokemon (generations 1-2)
  'own.friskFound': '{{pokemonNameWithAffix}}[[는]]\n{{itemName}}[[를]] 통찰했다!', // abilities frisk.activateNoTarget (generations 4-5)
  'own.trappedCantMove': '{{pokemonNameWithAffix}}[[는]]\n몸이 묶여서 움직일 수 없다!',

  'own.pocket.heal': '회복', 'own.pocket.status': '상태', 'own.pocket.battle': '배틀', 'own.pocket.ball': '볼', 'own.pocket.food': '먹이',

  'own.forfeitQuestion': '정말로 도망치겠습니까?',
  'own.forfeitNote': '패배로 기록됩니다',

  'own.alreadyChosen': '{{pokemonName}}[[는]]\n이미 교체하기로 했다!',
  'own.swap': '{{pokemonNameWithAffix}}[[와]] {{targetName}}[[는]]\n자리를 바꿨다!',

  'own.partnerGo': '{{trainerName}}[[는]] {{pokemonName}}[[를]] 꺼냈다!',
  'own.partnerPokemonWithAffix': '{{trainerName}}의 {{pokemonName}}',

  'own.friendshipEndure': '{{pokemonNameWithAffix}}[[는]] 슬프게 하지 않으려고\n버텼다!',
  'own.friendshipCure.slp': '{{pokemonNameWithAffix}}[[는]] 걱정시키지 않으려고\n스스로 잠에서 깼다!',
  'own.friendshipCure.psn': '{{pokemonNameWithAffix}}[[는]] 걱정시키지 않으려고\n스스로 독을 이겨 냈다!',
  'own.friendshipCure.tox': '{{pokemonNameWithAffix}}[[는]] 걱정시키지 않으려고\n스스로 독을 이겨 냈다!',
  'own.friendshipCure.brn': '{{pokemonNameWithAffix}}[[는]] 걱정시키지 않으려고\n화상을 견뎌 냈다!',
  'own.friendshipCure.frz': '{{pokemonNameWithAffix}}[[는]] 걱정시키지 않으려고\n얼음을 녹였다!',
  'own.friendshipCure.par': '{{pokemonNameWithAffix}}[[는]] 걱정시키지 않으려고\n마비를 풀었다!',

  'ability-trigger.trace': '{{pokemonName}}[[는]] {{targetName}}의\n{{abilityName}}[[를]] 트레이스했다!',
};

const EN = {
  'own.itemObtained': '{{pokemonNameWithAffix}} obtained\n{{itemName}}.', // default addItem
  'own.airBalloon': '{{pokemonNameWithAffix}} floats in the air\nwith its Air Balloon!', // items airballoon.start
  'own.airBalloonPopped': '{{pokemonNameWithAffix}}\'s\nAir Balloon popped!', // items airballoon.end
  'own.itemHeal': '{{pokemonNameWithAffix}} restored a little HP\nusing its {{itemName}}!', // items leftovers.heal
  'own.lifeOrb': '{{pokemonNameWithAffix}}\nlost some of its HP!', // items lifeorb.damage
  'own.itemDamage': '{{pokemonNameWithAffix}} was hurt\nby its {{itemName}}!', // default damageFromItem
  'own.itemDamageFrom': '{{pokemonNameWithAffix}} was hurt by\n{{sourceName}}\'s {{itemName}}!', // default damageFromPokemon
  'own.itemSurvive': '{{pokemonNameWithAffix}} hung on\nusing its {{itemName}}!', // items focusband.activate
  'own.itemWeaken': '{{pokemonNameWithAffix}}\'s {{itemName}}\nlessened the damage it took!', // default eatItemWeaken
  'own.gem': '{{itemName}} strengthened\n{{moveName}}\'s power!', // default useGem
  'own.powerHerb': '{{pokemonNameWithAffix}} became fully charged\ndue to its {{itemName}}!', // items powerherb.end
  'own.ejectItem': '{{pokemonNameWithAffix}} is switched out\nwith the {{itemName}}!', // items ejectbutton.end
  'own.redCard': '{{pokemonNameWithAffix}} held up its {{itemName}}\nagainst {{targetName}}!', // items redcard.end
  'own.mirrorHerb': '{{pokemonNameWithAffix}} used its {{itemName}} to mirror\nits opponent\'s stat changes!', // items mirrorherb.activate
  'own.abilityShield': '{{pokemonNameWithAffix}}\'s Ability is protected\nby the effects of its {{itemName}}!', // items abilityshield.block
  'own.clearAmulet': 'The effects of {{pokemonNameWithAffix}}\'s {{itemName}}\nprevent its stats from being lowered!', // items clearamulet.block
  'own.safetyGoggles': '{{pokemonNameWithAffix}} is not affected by {{moveName}}\nthanks to its {{itemName}}!', // items safetygoggles.block
  'own.boosterEnergy': '{{pokemonNameWithAffix}} used its {{itemName}}\nto activate {{abilityName}}!', // abilities protosynthesis.activateFromItem
  'own.statusFromItem.brn': '{{pokemonNameWithAffix}} was burned\nby the {{itemName}}!', // default brn.startFromItem
  'own.statusFromItem.tox': '{{pokemonNameWithAffix}} was badly poisoned\nby the {{itemName}}!', // default tox.startFromItem
  'own.cureFromItem.brn': '{{pokemonNameWithAffix}}\'s {{itemName}}\nhealed its burn!', // default brn.endFromItem
  'own.cureFromItem.frz': '{{pokemonNameWithAffix}}\'s {{itemName}}\ndefrosted it!', // default frz.endFromItem
  'own.cureFromItem.par': '{{pokemonNameWithAffix}}\'s {{itemName}}\ncured its paralysis!', // default par.endFromItem
  'own.cureFromItem.psn': '{{pokemonNameWithAffix}}\'s {{itemName}}\ncured its poison!', // default psn.endFromItem
  'own.cureFromItem.slp': '{{pokemonNameWithAffix}}\'s {{itemName}}\nwoke it up!', // default slp.endFromItem
  'own.cureFromItem.confusion': '{{pokemonNameWithAffix}}\'s {{itemName}}\nsnapped it out of its confusion!', // default confusion.endFromItem
  'own.focusEnergyFromItem': '{{pokemonNameWithAffix}} used the {{itemName}}\nto get pumped!', // moves focusenergy.startFromItem
  'own.attractFromItem': '{{pokemonNameWithAffix}} fell in love\nbecause of the {{itemName}}!', // moves attract.startFromItem
  'own.itemBoost1': 'The {{itemName}} raised\n{{pokemonNameWithAffix}}\'s {{stats}}!', // default boostFromItem
  'own.itemBoost2': 'The {{itemName}} sharply raised\n{{pokemonNameWithAffix}}\'s {{stats}}!',
  'own.itemBoost3': 'The {{itemName}} drastically raised\n{{pokemonNameWithAffix}}\'s {{stats}}!',
  'own.itemUnboost1': 'The {{itemName}} lowered\n{{pokemonNameWithAffix}}\'s {{stats}}!',
  'own.itemUnboost2': 'The {{itemName}} harshly lowered\n{{pokemonNameWithAffix}}\'s {{stats}}!',
  'own.itemUnboost3': 'The {{itemName}} severely lowered\n{{pokemonNameWithAffix}}\'s {{stats}}!',
  'own.itemUsed': '{{pokemonNameWithAffix}} used its\n{{itemName}}!', // default activateItem
  'own.fling': '{{pokemonNameWithAffix}} flung its\n{{itemName}}!', // moves fling.removeItem
  'own.recycle': '{{pokemonNameWithAffix}} found one\n{{itemName}}!', // moves recycle.addItem
  'own.micleBerry': '{{pokemonNameWithAffix}} boosted the accuracy of\nits next move using its {{itemName}}!',
  'own.switchedItems': '{{pokemonName}} switched items\nwith its target!', // moves trick.activate
  'own.moveDisabledTaunt': '{{pokemonNameWithAffix}} can\u2019t use {{moveName}} after the taunt!', // PokeRogue battle.moveDisabledTaunt
  'own.spikyShield': '{{pokemonNameWithAffix}} was hurt\nby {{moveName}}!',
  'own.zPower': '{{pokemonNameWithAffix}} surrounded itself\nwith its Z-Power!', // default zPower
  'own.zEffect': '{{pokemonNameWithAffix}} unleashes its\nfull-force Z-Move!', // default zEffect
  'own.zBroken': '{{pokemonNameWithAffix}} couldn\'t fully protect\nitself and got hurt!', // default zBroken
  'own.ultraBurst': '{{pokemonNameWithAffix}} regained its true power\nthrough Ultra Burst!',

  'own.dynamaxBlock': 'The move was blocked by\nthe power of Dynamax!',
  'own.dynamaxFail': '{{pokemonNameWithAffix}} shook its head.\nIt seems like it can’t use this move...',
  'own.gmaxWildfirePlayer': 'Your ally Pokémon were\nsurrounded by fire!',
  'own.gmaxWildfireEnemy': 'The opposing Pokémon were\nsurrounded by fire!',
  'own.gmaxCannonadePlayer': 'Your ally Pokémon got caught\nin the vortex of water!',
  'own.gmaxCannonadeEnemy': 'The opposing Pokémon got caught\nin the vortex of water!',
  'own.gmaxVineLashPlayer': 'Your ally Pokémon got\ntrapped with vines!',
  'own.gmaxVineLashEnemy': 'The opposing Pokémon got\ntrapped with vines!',
  'own.gmaxVolcalithPlayer': 'Your ally Pokémon became\nsurrounded by rocks!',
  'own.gmaxVolcalithEnemy': 'The opposing Pokémon became\nsurrounded by rocks!',
  'own.gmaxSteelsurgePlayer': 'Sharp-pointed pieces of steel started\nfloating around your ally Pokémon!',
  'own.gmaxSteelsurgeEnemy': 'Sharp-pointed pieces of steel started\nfloating around the opposing Pokémon!',
  'own.gmaxSteelsurgeEndPlayer': 'The pieces of steel surrounding\nyour ally Pokémon disappeared!',
  'own.gmaxSteelsurgeEndEnemy': 'The pieces of steel surrounding\nthe opposing Pokémon disappeared!',
  'own.gmaxWildfireDamage': '{{pokemonNameWithAffix}} is burning up within\nG-Max Wildfire’s flames!',
  'own.gmaxCannonadeDamage': '{{pokemonNameWithAffix}} is hurt by\nG-Max Cannonade’s vortex!', // Showdown gmaxcannonade.damage (the dump line not seen)
  'own.gmaxVineLashDamage': '{{pokemonNameWithAffix}} is hurt by G-Max Vine Lash’s\nferocious beating!',
  'own.gmaxVolcalithDamage': '{{pokemonNameWithAffix}} is hurt by the rocks thrown out\nby G-Max Volcalith!',
  'own.gmaxSteelsurgeDamage': 'The sharp steel bit into\n{{pokemonNameWithAffix}}!',
  'own.gmaxDepletionPlayer': 'Your ally Pokémon’s PP was reduced!',
  'own.gmaxDepletionEnemy': 'The opposing Pokémon’s PP was reduced!',
  'own.usedItem': 'You used {{itemName}}\non {{pokemonName}}!',
  'own.usedSideItem': 'You used {{itemName}}!',
  'own.itemNoEffect': "But it seems there's no effect...",
  'own.pokeFluteTune': "Now, that's a catchy tune!", // confirmed (the same - Gen 1 / Gen 3)
  'own.trainerUsedItem': '{{trainerName}} used\n{{itemName}}!',
  'own.revived': '{{pokemonName}} was revived!',
  'own.ppRestoredAll': '{{pokemonNameWithAffix}}\'s PP was restored\nby the {{itemName}}!',
  'own.ballNoTarget': 'The Pok\u00e9mon can\'t be seen,\nso you can\'t throw a Ball!',
  'own.toolCheer': '{{pokemonNameWithAffix}} is fired up!',
  'own.toolTaunt': '{{pokemonNameWithAffix}} fell for the taunt!', // moves taunt.start
  'own.toolTauntEnd': '{{pokemonNameWithAffix}} shook off the taunt!', // moves taunt.end
  'own.toolDistract': '{{pokemonNameWithAffix}} got distracted!',
  'own.toolDistractEnd': '{{pokemonNameWithAffix}} regained its focus!',
  'own.bagLocked': 'You can\'t use\nthe Bag right now!',
  'own.sentToBox': '{{pokemonName}} was sent\nto the Box!',
  'own.expShare': 'The rest of your team\ngained Exp. Points!',
  'own.learnMoveForgetConfirm': 'Forget {{moveName}}?',
  'own.mintNote': 'Under the effect of the {{itemName}}.',
  'own.eraGimmickDisabled': 'You can\u2019t use {{moveName}}\nin this generation!',
  'own.attackMissed': '{{pokemonNameWithAffix}}\u2019s\nattack missed!', // default missNoPokemon
  'own.friskFound': '{{pokemonNameWithAffix}} frisked its target and\nfound one {{itemName}}!', // abilities frisk.activateNoTarget
  'own.trappedCantMove': '{{pokemonNameWithAffix}}\ncan\u2019t move!',

  'own.pocket.heal': 'HP/PP', 'own.pocket.status': 'Status', 'own.pocket.battle': 'Battle', 'own.pocket.ball': 'Pok\u00e9 Balls', 'own.pocket.food': 'Food',
  'own.forfeitQuestion': 'Do you really want to run away?',
  'own.forfeitNote': 'It will count as a loss.',
  'own.alreadyChosen': '{{pokemonName}} is already\ngoing in!',
  'own.swap': '{{pokemonNameWithAffix}} and {{targetName}}\nswitched places!', // default swap
  'own.partnerGo': '{{trainerName}} sent out {{pokemonName}}!',
  'own.partnerPokemonWithAffix': '{{trainerName}}\'s {{pokemonName}}',
  'own.friendshipEndure': '{{pokemonNameWithAffix}} toughed it out\nso you wouldn\'t feel sad!',
  'own.friendshipCure.slp': '{{pokemonNameWithAffix}} shook itself awake\nso you wouldn\'t worry!',
  'own.friendshipCure.psn': '{{pokemonNameWithAffix}} managed to expel\nthe poison so you wouldn\'t worry!',
  'own.friendshipCure.tox': '{{pokemonNameWithAffix}} managed to expel\nthe poison so you wouldn\'t worry!',
  'own.friendshipCure.brn': '{{pokemonNameWithAffix}} blew on its burn\nso you wouldn\'t worry!',
  'own.friendshipCure.frz': '{{pokemonNameWithAffix}} melted the ice\nso you wouldn\'t worry!',
  'own.friendshipCure.par': '{{pokemonNameWithAffix}} broke through its paralysis\nso you wouldn\'t worry!',

  'ability-trigger.trace': '{{pokemonName}} copied {{targetName}}’s\n{{abilityName}}!', // PokeRogue ability-trigger.trace
};

/** Own text per language, same keys */
export const OWN = Object.freeze({ ko: KO, en: EN });

export const ownTemplate = (key, lang = DEFAULT_LANG) => (Object.hasOwn(OWN[checkLang(lang)], key) ? OWN[lang][key] : undefined);
