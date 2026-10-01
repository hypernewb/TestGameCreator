import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {Store} from '../packages/persistence/store.mjs';
import {GameService} from '../packages/ai/service.mjs';
import {sceneResponseFormat} from '../packages/ai/providers.mjs';
import {sceneActs,ACTS_RULE} from '../packages/ai/scene-acts.mjs';
import {scenePromptMessages} from '../vendor/venus/scenePrompt.mjs';

// Stands in for lane B's social.acts until it lands: records what it was asked to price.
const stub={id:'social.acts',version:'0.1.0',coreApi:'0.1.0',requires:[],commands:{'social.priceActs'(tx,args){tx.emit('social.actPriced',{character:args.character,sceneId:args.sceneId,source:args.source,acts:args.acts,private:args.private,text:'Ada liked that.',verdict:'liked',memory:'The player noticed her sketchbook.'},[tx.pack.playerId]);}}};
const reg={...registry,'social.acts':stub};
const pack=()=>{const p=JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)));p.gameProject={...JSON.parse(readFileSync(new URL('../packs/crossed-plans.json',import.meta.url))).gameProject,sceneBudget:2};delete p.schedules;p.modules={...p.modules,'social.acts':'0.1.0'};p.actProfiles=[{character:'ada',entries:[]}];return p;};
const talk=(text,activity='talk')=>({text,location:'hub',characters:['ada'],activity});

test('model act tags are filtered to the closed list, four at most, with short slug targets',()=>{
 assert.deepEqual(sceneActs(null),[]);assert.deepEqual(sceneActs('flirt'),[]);
 assert.deepEqual(sceneActs([{kind:'compliment',target:'Her Hair!',size:'huge'},{kind:'bribe',target:'x'},null,{kind:'compliment',target:'her hair'},{kind:'buy',target:'coffee',size:'medium',landed:'yes'}]),
  [{kind:'compliment',target:'her-hair',size:'small'},{kind:'buy',target:'coffee',size:'medium'}]);
 assert.equal(sceneActs(Array.from({length:10},(_,i)=>({kind:'flirt',target:`t${i}`}))).length,4);
 assert.equal(sceneActs([{kind:'tease',target:'x'.repeat(500),landed:false}])[0].target.length,40);
 assert.equal(sceneActs([{kind:'tease',target:'ex',landed:false}])[0].landed,false);
});

test('a scene with an act profile asks for tags and records them as a social.priceActs turn before the close',async()=>{
 const p=pack(),seen=[];let calls=0;
 const provider={name:'probe',async generateScene(context){calls++;seen.push({memories:context.memories.map(m=>m.text),tags:context.actTags,schema:sceneResponseFormat(context,p).json_schema.schema.properties.acts,prompt:scenePromptMessages(context,p)[0].content});return {lines:[{speaker:'',text:'You smile at her.'},{speaker:'ada',text:'Nice try.'}],acts:[{kind:'flirt',target:'Smile',size:'large'},{kind:'marry',target:'now'}],...(calls===2?{end_scene:true}:{})};}};
 const store=new Store();store.insert(createWorld(p,reg,'acts'));const service=new GameService(store,{[p.id]:p},reg,provider);
 try{
  await service.act('acts',{id:'open',expectedRevision:0,command:{type:'core.scene',args:talk('I smile at Ada.')}});
  assert.ok(seen[0].tags&&seen[0].schema);assert.match(seen[0].prompt,/In acts, tag what the player did/);
  const priced=store.load('acts').turns['open-acts'];assert.equal(priced.command.type,'social.priceActs');
  assert.deepEqual(priced.command.args,{character:'ada',sceneId:'open',source:'open',private:true,acts:[{kind:'flirt',target:'smile',size:'large'}]});
  assert.equal(priced.status,'complete');assert.match(priced.narrative,/Ada liked that/);
  const r=await service.act('acts',{id:'last',expectedRevision:store.load('acts').revision,command:{type:'core.scene',args:talk('Walk with me?','continue')}});
  const order=Object.keys(r.state.turns);assert.ok(order.indexOf('last-acts')<order.indexOf('last-end'));assert.equal(r.state.scene,null);
  assert.ok(seen[1].memories.includes('Ada liked: The player noticed her sketchbook.'),'an authored act memory reaches the next reply');assert.ok(!seen[0].memories.some(m=>/sketchbook/.test(m)));
  assert.equal(r.state.turns['last-acts'].events.find(e=>e.type==='social.actPriced').payload.sceneId,'open');
 }finally{store.close();}
});

test('without an act profile the prompt and schema stay unchanged',()=>{
 const p=pack();delete p.actProfiles;const ctx={stagedCast:['ada'],scenePhase:'opening',playerAction:'Hi.',actTags:''};
 assert.equal(sceneResponseFormat(ctx,p).json_schema.schema.properties.acts,undefined);assert.doesNotMatch(scenePromptMessages(ctx,p)[0].content,/In acts/);
});
test('the acts rule counts opening up as a small listen and keeps [] for lines that do nothing toward her',()=>{
 assert.match(ACTS_RULE,/Sharing something personal with her[^.]*is a small listen/);assert.match(ACTS_RULE,/Return \[\] only when the player does nothing toward her/);assert.doesNotMatch(ACTS_RULE,/\[\] for plain talk/);
});
