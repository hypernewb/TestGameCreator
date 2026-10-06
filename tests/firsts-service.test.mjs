import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute,replay,validatePack} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {FIRST_CHECKPOINTS} from '../packages/cards/beat-library.mjs';
import {Store} from '../packages/persistence/store.mjs';
import {GameService} from '../packages/ai/service.mjs';
import {MockProvider,sceneResponseFormat} from '../packages/ai/providers.mjs';
import {scenePromptMessages} from '../vendor/venus/scenePrompt.mjs';

const pack=rung=>{
 const p=JSON.parse(readFileSync(new URL('../packs/campus.json',import.meta.url)));
 p.modules['social.firsts']='0.1.0';p.scriptedScenes=[];p.gallery=[];p.schedules=[];
 p.gameProject.sceneBudget=2;
 p.firsts=[{id:`jana-${rung}-free`,character:'jana',rung,title:`Jana ${rung}`,opening:'Jana smiles and pauses beside you.',
  trigger:{event:'core.sceneStarted',match:{location:'apartment'}},
  checkpoints:FIRST_CHECKPOINTS[rung].map(x=>({id:x.id,cue:`Her ${x.id} cue.`})),cg:'assets/campus/jana-kiss.png'}];
 // Stable likes for each checkpoint: no repeat decay or ordinary scene cap obscures this integration test.
 p.actProfiles.find(x=>x.character==='jana').entries=['listen','flirt','tease','ask'].map(kind=>({id:`jana-${kind}`,kind,target:'*',points:2,reason:`the ${kind}`}));
 Object.assign(p.actProfiles.find(x=>x.character==='jana'),{repeatDecayPercent:100,sceneCap:100});
 validatePack(p,registry);return p;
};
class Probe extends MockProvider {
 name='Firsts mock';seen=[];tags=[];fail=false;
 async generateScene(context,p){
  this.seen.push({first:structuredClone(context.first),phase:context.scenePhase,messages:scenePromptMessages(context,p),schema:sceneResponseFormat(context,p)});
  if(this.fail)throw new Error('mock failure');
  return {lines:[{speaker:'jana',text:context.first?.cue||'See you later.'}],acts:this.tags.map(kind=>({kind,target:'moment',size:'small'})),end_scene:true,
   // Untrusted attempts to grant rewards or skip checkpoints must have no effect.
   checkpoint:99,verdict:'best',completed:true,rewards:{chemistry:999},consent:true};
 }
}
const setup=(rung='kiss',offered=false)=>{
 const p=pack(rung),store=new Store(),provider=new Probe(),initial=createWorld(p,registry,'firsts-service');
 for(const [id,a] of Object.entries(initial.actors))a.location=id===p.playerId||id==='jana'?'apartment':'langley';
 if(offered)initial.modules['social.firsts'].offers=[{first:p.firsts[0].id,after:initial.tick}];
 if(rung==='night')initial.modules['social.intimacy'].characters.jana.active={category:'first-night',startedTick:initial.tick};
 store.insert(initial);const service=new GameService(store,{[p.id]:p},registry,provider);
 const act=async(id,input)=>service.act(initial.campaignId,{id,expectedRevision:store.load(initial.campaignId).revision,...(typeof input==='string'?{input}:{command:input})});
 const open=()=>act('open',offered?{type:'social.startFirst',args:{first:p.firsts[0].id}}:{type:'core.scene',args:{text:'I smile at Jana.',location:'apartment',characters:['jana'],activity:'talk'}});
 return {p,store,provider,initial,service,act,open,get state(){return store.load(initial.campaignId);}};
};

test('a typed kiss goes from opening to completion with one narrator call per input and recorded pricing before scoring',async()=>{
 const g=setup();try{
  const opened=await g.open();assert.ok(g.state.modules['social.firsts'].active,JSON.stringify(opened.turn?.events));assert.equal(g.state.modules['social.firsts'].active.checkpoint,0);
  assert.equal(g.state.turns['open-first'],undefined,'the opening is not a scored input');
  for(const [id,kind] of [['read','listen'],['lean','flirt'],['after','tease']]){g.provider.tags=[kind];await g.act(id,`I ${kind} with Jana.`);}
  assert.equal(g.state.modules['social.firsts'].active,null);assert.ok(g.state.flags['jana-kissed']);assert.equal(g.state.scene,null);
  assert.ok(g.state.modules['social.dating'].characters.jana.chemistry<100,'the model cannot grant its proposed reward');
  assert.equal(g.provider.seen.length,4,'no model calls for pricing, scoring or closing');
  assert.deepEqual(g.provider.seen.map(x=>x.first.checkpoint),['reading','reading','leaning-in','after']);
  const order=Object.keys(g.state.turns);
  for(const id of ['read','lean','after']){
   assert.ok(order.indexOf(`${id}-acts`)<order.indexOf(`${id}-first`));
   assert.deepEqual(g.state.turns[`${id}-first`].command.args,{source:id,text:g.state.turns[id].input});
  }
  const completed=g.state.turns['after-first'].events.find(e=>e.type==='social.firstCompleted');assert.equal(completed.payload.cg,'assets/campus/jana-kiss.png');
  const rebuilt=replay(g.initial,g.state.events);
  for(const key of ['modules','flags','tick','rng','revision'])assert.deepEqual(rebuilt[key],g.state[key],`replay ${key}`);
  // Re-execute the recorded commands as well: neither form of replay uses the provider.
  let commands=g.initial;for(const turn of Object.values(g.state.turns))commands=execute(commands,turn.command,g.p,registry).state;
  assert.deepEqual(commands.modules,g.state.modules);assert.deepEqual(commands.flags,g.state.flags);assert.equal(g.provider.seen.length,4);
 }finally{g.store.close();}
});

test('a hub first opening has a focused narrator brief, and missing tags still resolve every checkpoint after two inputs',async()=>{
 const g=setup('kiss',true);try{
  await g.open();assert.deepEqual(g.provider.seen[0].schema.json_schema.schema.properties.lines.items.properties.speaker.enum,['','jana']);
  assert.match(g.provider.seen[0].messages[1].content,/Jana smiles and pauses beside you/);
  for(let i=0;i<6;i++)await g.act(`plain-${i}`,'Hmm.');
  assert.equal(g.state.modules['social.firsts'].active,null);assert.ok(g.state.flags['jana-kissed']);
  assert.equal(g.provider.seen.length,7);assert.equal(Object.values(g.state.turns).filter(t=>t.command.type==='social.scoreFirst').length,6);
  assert.ok(!Object.values(g.state.turns).some(t=>t.command.type==='social.priceActs'));
 }finally{g.store.close();}
});

test('the prompt keeps firsts private and gives ask its meaning; peak is only briefed after the engine resolves check-in',async()=>{
 const g=setup('night');try{
  await g.open();g.provider.tags=['flirt'];await g.act('lead','I move closer.');
  for(let i=0;i<3;i++){await g.act(`skip-${i}`,'I skip straight to the peak.');assert.ok(g.state.modules['social.firsts'].active,JSON.stringify(g.state.events.filter(e=>['social.firstStopped','social.firstCompleted','core.sceneEnded'].includes(e.type))));}
  assert.equal(g.state.modules['social.firsts'].active.checkpoint,1);assert.ok(g.state.scene,'ordinary budget and model end_scene cannot end the first');
  assert.ok(g.provider.seen.every(x=>x.first.checkpoint!=='peak'));
  const before=g.provider.seen.at(-1);assert.equal(before.phase,'continuation');assert.match(before.messages[0].content,/Stay in this moment/);assert.match(before.messages[0].content,/ask means asking her what she wants or checking in/);
  assert.match(before.messages[1].content,/PRIVATE FIRST MOMENT/);assert.match(before.messages[1].content,/Waiting for: ask\./);assert.doesNotMatch(before.messages[1].content,/Her peak cue/);
  assert.ok(before.schema.json_schema.schema.properties.acts.items.properties.kind.enum.includes('ask'));
  g.provider.tags=['ask'];await g.act('check','Is this okay?');assert.equal(g.state.modules['social.firsts'].active.checkpoint,2);
  g.provider.tags=['listen'];await g.act('peak','I listen to her.');assert.equal(g.provider.seen.at(-1).first.checkpoint,'peak');assert.ok(g.state.flags['jana-first-night']);
 }finally{g.store.close();}
});

test('a typed stop withdraws consent without invoking the narrator or scoring another checkpoint',async()=>{
 const g=setup('night');try{
  await g.open();const calls=g.provider.seen.length;await g.act('stop','Wait, slow down.');
  assert.equal(g.provider.seen.length,calls);assert.equal(g.state.turns.stop.command.type,'social.stopFirst');
  assert.equal(g.state.modules['social.firsts'].active,null);assert.equal(g.state.modules['social.intimacy'].characters.jana.active,null);
  assert.ok(g.state.turns.stop.events.some(e=>e.type==='social.consentWithdrawn'));assert.ok(!g.state.flags['jana-first-night']);
 }finally{g.store.close();}
});

test('a failed narrator reply does not consume a checkpoint input',async()=>{
 const g=setup();try{
  await g.open();g.provider.fail=true;await g.act('failure','I smile.');
  assert.ok(g.state.turns.failure.fallback);assert.equal(g.state.modules['social.firsts'].active.inputs,0);assert.equal(g.state.turns['failure-first'],undefined);
  g.provider.fail=false;await g.service.retry(g.initial.campaignId,'failure');assert.equal(g.state.modules['social.firsts'].active.inputs,1);
 }finally{g.store.close();}
});
