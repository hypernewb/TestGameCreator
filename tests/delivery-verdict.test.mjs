import test from 'node:test';
import assert from 'node:assert/strict';
import {verdictOf} from '../packages/modules/delivery.mjs';
import {deliveryAct} from '../packages/ai/scene-acts.mjs';
import {stats} from '../packages/modules/stats.mjs';
import {readFileSync} from 'node:fs';
import {createLab} from '../packages/testing/character-lab.mjs';
import {MockProvider} from '../packages/ai/providers.mjs';
import {registry} from '../packages/modules/index.mjs';
import {scenePromptMessages} from '../vendor/venus/scenePrompt.mjs';
import {execute,replay} from '../packages/core/engine.mjs';
const pack={playerId:'player',actors:[{id:'player'}],deliveryStats:{flirt:'presence',touch:'grace'},deliveryExamples:{fumbled:'The compliment trails into a correction.',plain:'You offer a simple compliment.',smooth:'You find the right words without rushing.',great:'Your playful callback makes the compliment personal.'},statDefinitions:[{id:'presence',name:'Presence',min:0,max:20,visibility:'public',ranks:[0,4,8,13].map((min,i)=>({min,name:String(i)}))},{id:'grace',name:'Grace',min:0,max:20,visibility:'public'}]};
const state=(value,turn=0)=>({id:'campaign',seed:42,revision:turn,modules:{'character.stats':{values:{'player--presence':value}}}});
test('verdict is repeatable, uses custom stats, and higher ranks shift the distribution',()=>{
 const act={kind:'flirt'},v=verdictOf(pack,state(9),act);assert.deepEqual(v,verdictOf(pack,state(9),act));assert.equal(v.stat,'presence');assert.match(v.line,/Presence 9/);
 const tiers=['fumbled','plain','smooth','great'],sum=value=>Array.from({length:400},(_,i)=>tiers.indexOf(verdictOf(pack,state(value,i),act).tier)).reduce((a,b)=>a+b,0);assert.ok(sum(13)>sum(8));assert.ok(sum(8)>sum(0));
});
test('plain conversation is ungraded and mixed moves have one dominant act',()=>{
 for(const text of ['Hello.','Tell me more about your work.','Do you like to flirt?','I do not touch her.'])assert.equal(deliveryAct(text,pack),null,text);
 assert.equal(verdictOf({...pack,deliveryStats:{listen:'presence'}},state(2),{kind:'listen'}),null);assert.equal(verdictOf({...pack,deliveryStats:{flirt:'unknown'}},state(2),{kind:'flirt'}),null);assert.equal(deliveryAct('Touch her hand while you flirt with her',pack).kind,'touch');assert.equal(deliveryAct('Touch her hand',pack).region,'arms_hands');
});
test('starting modes support floor, spread and chosen with derived stats recomputed',()=>{
 const p={...pack,statDefinitions:[...pack.statDefinitions,{id:'poise',name:'Poise',min:0,max:40,visibility:'public',derived:{parts:[{stat:'presence'},{stat:'grace'}]}}],initialStats:[{character:'player',stat:'presence',value:2}]};
 assert.equal(stats.init({...p,startingStats:{mode:'floor'}}).values['player--presence'],0);
 const spread=stats.init({...p,startingStats:{mode:'spread'}}).values;assert.ok(spread['player--presence']>spread['player--grace']);
 assert.equal(stats.init({...p,startingStats:{mode:'chosen',values:{presence:7,grace:3}}}).values['player--presence'],7);
 assert.equal(stats.init({...p,startingStats:{mode:'chosen',values:{presence:7,grace:3}}}).values['player--poise'],10);
 assert.equal(stats.init(p).values['player--presence'],2);
 assert.throws(()=>stats.validate({...p,startingStats:{mode:'chosen',values:{presence:21}}}),/startingStats/);
});
test('mock Chat Lab records one pre-call verdict, prices it, grows failures and replays without a model',async()=>{
 const p=JSON.parse(readFileSync(new URL('../packs/campus.json',import.meta.url),'utf8'));p.romanceStats={...p.romanceStats,dailyGain:100};p.deliveryStats={flirt:'charm',touch:'fitness'};p.deliveryExamples=pack.deliveryExamples;p.schedules=[];p.scriptedScenes=[];p.gallery=[];p.firsts=[];p.socialPacing={flirt:{mode:'off'}};p.gameProject.conversationStyle='continuous';p.statDefinitions.find(d=>d.id==='charm').learnFromFailure=1;
 const profile=p.actProfiles.find(x=>x.character==='jana');profile.entries=[{id:'flirt',kind:'flirt',target:'*',points:4,reason:'playful words'}];profile.sceneCap=100;profile.repeatDecayPercent=100;
 const seen=[];class Probe extends MockProvider{async generateScene(c){seen.push(structuredClone(c));return {lines:[{speaker:'jana',text:'I had a thought about the project.'}],acts:[{kind:'flirt',target:'words',landed:true}]};}}
 const lab=createLab({pack:p,registry,npcId:'jana',provider:new Probe(),seed:42}),initial=structuredClone(lab.world);
 try{for(const input of ['Flirt with her.','Flirt with her again.','Tell me about the project.']){const row=await lab.turn(input),c=seen.at(-1),turn=Object.values(lab.world.turns).findLast(t=>t.sceneRequest?.playerAction===input);assert.ok(turn);
   const delivery=turn.delivery;assert.deepEqual(turn.sceneRequest.delivery,delivery);const prompt=scenePromptMessages(c,p).map(m=>m.content).join('\n');assert.doesNotMatch(prompt,/only slightly color delivery|slight stat-ranked delivery flavor/);
   if(input.startsWith('Flirt')){assert.ok(delivery);assert.equal(prompt.split('Your delivery this turn:').length-1,1);const event=row.events.find(e=>e.type==='social.actPriced'&&e.payload.delivery);assert.ok(event);assert.equal(event.payload.points,Math.trunc(4*delivery.mult));assert.match(event.payload.text,new RegExp(`landed ${delivery.tier}`));assert.deepEqual(event.payload.delivery,delivery);
    const growth=row.events.filter(e=>e.type==='character.statChanged'&&e.payload.reason==='learning from delivery');assert.equal(growth.length,delivery.tier==='fumbled'?1:0);
    const duplicate=execute(lab.world,{id:`duplicate-${turn.id}`,actorId:p.playerId,expectedRevision:lab.world.revision,type:'social.priceActs',args:{source:turn.id,character:'jana',sceneId:turn.sceneId,acts:[{kind:'flirt',target:'words',landed:true}]}},p,registry);assert.ok(!duplicate.turn.events.some(e=>e.type==='social.actPriced'));
   }else{assert.equal(delivery,null);assert.ok(!prompt.includes('Your delivery this turn:'));}
  }assert.deepEqual(replay(initial,lab.world.events).modules,lab.world.modules);
  let rebuilt=initial;for(const turn of Object.values(lab.world.turns))rebuilt=execute(rebuilt,turn.command,p,registry).state;
  assert.deepEqual(rebuilt.modules,lab.world.modules,'recorded commands reproduce delivery growth and pricing');
  const deliveryEvents=s=>s.events.filter(e=>['social.deliveryVerdict','social.actPriced'].includes(e.type)).map(e=>e.payload);
  assert.deepEqual(deliveryEvents(rebuilt),deliveryEvents(lab.world));
  assert.ok(lab.world.events.some(e=>e.type==='social.deliveryVerdict'&&e.payload.delivery.tier==='fumbled'),'the replay covers failure growth');
  const plain=Object.values(lab.world.turns).find(t=>t.command.type==='social.priceActs'&&t.command.args.delivery===null);assert.ok(plain,'ungraded model-tagged acts record an explicit null verdict');assert.ok(!plain.events.some(e=>e.type==='social.deliveryVerdict'));
  for(const event of lab.world.events.filter(e=>e.payload.delivery)){assert.doesNotMatch(event.payload.text,/\d/);assert.equal(typeof event.payload.delivery.value,'number');}
 }finally{lab.store.close();}
});
