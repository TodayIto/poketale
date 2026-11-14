import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createStoryBattle} from '../engine/core.mjs';
import {createEnemyAI} from '../ai/index.js';
import {snapshot} from '../ai/engine-copy.js';
import {commitChoice} from '../ai/commit.js';
import {hasEnemyItem,chooseEnemyParts} from '../engine/bag.mjs';
import {sim,specFor,referenceAI} from './helpers/ai.mjs';

function state(battle) {
  const saved=JSON.parse(snapshot(battle));
  saved.log=saved.log.filter(line=>!line.startsWith('|t:|'));
  return saved;
}
const reportState=({ms,...report})=>JSON.parse(JSON.stringify(report));

async function compare(spec,options,limit=6,prepare=()=>{}) {
  const reference=await referenceAI();
  const modes=[{factory:reference.createEnemyAI,commit:reference.commitChoice},{factory:createEnemyAI,commit:commitChoice}];
  const battles=modes.map(()=>createStoryBattle(sim,structuredClone(spec)));
  battles.forEach(prepare);
  const ais=modes.map((mode,i)=>mode.factory(sim,{...options,onDecision:report=>{mode.report=report;}}));
  const observed={decisions:0,forced:0,items:0,mega:0,tera:0};
  try {
    for(let step=0;step<limit&&!battles[0].ended;step++) {
      assert.deepEqual(state(battles[0]),state(battles[1]));
      const choices=[];
      for(const side of battles[0].sides.slice(1)) {
        if(!side.activeRequest||side.activeRequest.wait)continue;
        const results=[];
        for(let i=0;i<modes.length;i++) {
          const before=snapshot(battles[i]);let copies=0;
          const fromJSON=sim.Battle.fromJSON;
          sim.Battle.fromJSON=function(...args){copies++;return fromJSON.apply(this,args);};
          let choice;
          try {choice=ais[i](battles[i],side.id);}finally{sim.Battle.fromJSON=fromJSON;}
          assert.equal(snapshot(battles[i]),before,'AI does not mutate the live battle');
          const info=reportState(modes[i].report);
          assert.notEqual(info.kind,'error',JSON.stringify(info));
          assert.equal(info.problems,undefined,JSON.stringify(info));
          results.push({choice,copies,info});
        }
        assert.deepEqual(results[1],results[0],'choices, full score report and restoration/search counts match');
        choices.push([side.id,results[0].choice]);observed.decisions++;
        if(side.activeRequest.forceSwitch?.some(Boolean))observed.forced++;
        if(results[0].choice.startsWith('item '))observed.items++;
        if(results[0].choice.includes(' mega'))observed.mega++;
        if(results[0].choice.includes(' terastallize'))observed.tera++;
      }
      for(let i=0;i<modes.length;i++) {
        const battle=battles[i];
        const request=battle.sides[0].activeRequest;
        if(request&&!request.wait)assert.notEqual(battle.choose('p1','default'),false);
        for(const [id,choice] of choices){
          const accepted=hasEnemyItem(choice)?chooseEnemyParts(battle,choice,id).ok:battle.choose(id,choice);
          assert.notEqual(accepted,false);modes[i].commit(battle,id,choice);
        }
      }
      assert.deepEqual(state(battles[1]),state(battles[0]),'result, PRNG, HP, PP, statuses, protocol and requests match');
      assert.deepEqual(ais[1].saveState(battles[1]),ais[0].saveState(battles[0]),'committed AI state matches');
      if(!choices.length&&battles[0].sides[0].activeRequest?.wait)throw new Error('Fixture cannot progress');
    }
    assert.ok(observed.decisions>0);
    return observed;
  } finally {battles.forEach(b=>b.destroy());}
}

for(const double of [false,true])for(const teamSize of [2,6])for(const boss of [false,true]) {
  test(`AI retains full decisions and later battle states: ${double?'double':'single'} ${teamSize} ${boss?'max boss':'normal'}`,async()=>{
    for(const seed of [[1,2,3,4],[31,41,59,26],[53,58,97,93]])
      await compare(specFor({teamSize,double,seed}),{difficulty:boss?'max':'normal',boss,healItems:false});
  });
}

test('lookahead preserves over-limit IV/EV, nested metadata, poisoned and sleeping positions',async()=>{
  const spec=specFor({teamSize:6});
  for(const side of [spec.p1,spec.p2]) {
    side.team[0].set.ivs={hp:63,atk:127,def:63,spa:127,spd:63,spe:63};
    side.team[0].set.evs={hp:300,atk:600,def:300,spa:600,spd:300,spe:300};
    side.team[0].hpPercent=70;
  }
  spec.p1.team[0].status='tox';spec.p2.team[0].status='slp';spec.p2.team[0].sleepTurns=2;
  await compare(spec,{difficulty:'max',boss:true,healItems:false},6,battle=>{
    for(const side of battle.sides)for(const pokemon of side.pokemon)
      pokemon.m.opt7Metadata={nested:[null,{text:'한글🙂',numbers:[1,2,3]}]};
  });
});

test('boss healing and committed item count retain the original decision path',async()=>{
  const spec=specFor({teamSize:6});spec.p2.team[0].hpPercent=20;
  spec.p1.team[0].set.species='Blissey';spec.p1.team[0].set.moves=['splash'];
  const result=await compare(spec,{difficulty:'max',boss:true,healItems:{item:'fullrestore',count:2}});
  assert.ok(result.items>0,'fixture actually uses a healing item');
});

test('mega and tera choices retain original gimmick and later-turn state',async()=>{
  for(const mega of [false,true]) {
    const spec=specFor({teamSize:6});
    if(mega)spec.p2.team[0].set.item='Blastoisinite';
    else spec.p2.team[0].set.teraType='Dragon';
    const result=await compare(spec,{difficulty:'max',boss:true,healItems:false,mega:true,tera:'first'});
    assert.ok(mega?result.mega>0:result.tera>0,'fixture actually uses the requested gimmick');
  }
});

test('multi-seat doubles retain partner decisions and committed state',async()=>{
  const spec=specFor({teamSize:6,double:true});
  spec.partner={name:'Partner',team:spec.p1.team.splice(3).map(m=>({...m,uid:'ally-'+m.uid}))};
  spec.foePartner={name:'Foe partner',team:spec.p2.team.splice(3).map(m=>({...m,uid:'foe-'+m.uid}))};
  await compare(spec,{difficulty:'max',boss:true,healItems:false},8);
});

test('forced replacement choices retain original state and decision counts',async()=>{
  const spec=specFor({teamSize:2});
  spec.p1.team[0].set={species:'Dugtrio',moves:['earthquake'],ability:'Arena Trap',level:50,nature:'Serious'};
  spec.p2.team[0].hp=1;
  const result=await compare(spec,{difficulty:'max',boss:true,healItems:false});
  assert.ok(result.forced>0,'fixture actually reaches a forced replacement');
});
