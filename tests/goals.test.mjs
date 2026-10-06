import test from 'node:test';
import assert from 'node:assert/strict';
import {goals,goalProgress,goalHint,advanceGoal,revealGoal} from '../packages/modules/goals.mjs';
import {conditionReasons,validateConditions} from '../packages/modules/conditions.mjs';
import {progressionRequirements,progression} from '../packages/modules/progression.mjs';
import {createSheet,applyCharacterSheet,validateSheetGoal,saveSheets,loadSheets} from '../public/sheet-editor.mjs';
import {createWorld,execute,replay,mechanicsDigest} from '../packages/core/engine.mjs';
import {registry,moduleCatalog} from '../packages/modules/index.mjs';
import {sceneActs} from '../packages/ai/scene-acts.mjs';
import {scenePromptMessages} from '../vendor/venus/scenePrompt.mjs';
import {runtimePanel} from '../public/ui-runtime-panels.mjs';
import {goalRows} from '../public/goal-progress.mjs';
import {testGroups} from '../scripts/test.mjs';
import {advancedSpecs} from '../public/creator-advanced-contract.mjs';
import {Store} from '../packages/persistence/store.mjs';
import {GameService} from '../packages/ai/service.mjs';
import {MockProvider,narrativeMessages} from '../packages/ai/providers.mjs';
import {actionTurns} from '../public/turn-presentation.mjs';

function enginePack(){const p=pack();Object.assign(p,{schemaVersion:1,id:'harbor',version:'0.1.0',title:'Harbor',gameProject:{ai:{scene:'',intent:'',daypart:''},premise:'Help with a boat.',setting:'A harbor workshop.',conversationStyle:'continuous'}});p.locations[0].exits=[];delete p.modules['social.progression'];const add=id=>{p.modules[id]=registry[id].version;for(const dep of registry[id].requires||[])add(dep);};add('social.acts');for(const id of Object.keys(p.modules))add(id);p.datingProfiles=[];p.romanceTempoProfiles=[];p.actProfiles=[{character:'maker',entries:[]}];p.storyVariables.forEach(v=>v.initial=false);const s=createSheet('maker');s.personality.traits=['curious','practical'];s.goal=p.characterSheets[0].goal;p.characterSheets=[s];return p;}
const command=(s,p,type,args,id)=>execute(s,{id,actorId:p.playerId,expectedRevision:s.revision,type,args},p,registry).state;

test('one mocked narrator call renders goal prose, reveals a committed mention and keeps the player turn',async()=>{
 const p=enginePack(),store=new Store(':memory:');let calls=0,prompt;const provider=new MockProvider();provider.generateScene=async context=>{calls++;prompt=scenePromptMessages(context,p).map(m=>m.content).join('\n');return {lines:[{speaker:'maker',text:'Build a boat is what I want to do. Will you help gather the parts?'}],acts:[{kind:'listen',target:'Bring the parts'}]};};
 try{const start=createWorld(p,registry);store.insert(start);const service=new GameService(store,{[p.id]:p},registry,provider),result=await service.act(start.campaignId,{id:'chat',expectedRevision:0,command:{type:'core.scene',args:{characters:['maker'],location:'dock',activity:'talk',text:'What are you working on?'}}});
  assert.equal(calls,1);assert.match(prompt,/CHARACTER GOAL/);assert.match(prompt,/Build a boat; See the islands; next: Gather supplies/);assert.doesNotMatch(prompt,/"goalPrompt"|"characterGoals"/);assert.equal(result.state.modules.goals.maker.revealed,true);assert.deepEqual(result.state.modules.goals.maker.completed,[]);assert.equal(actionTurns(result.state)[0].id,'chat');assert.equal(result.state.scene.location,'dock');
 }finally{store.close();}
});

test('registered goal commands validate, cost no time, and replay on a non-campus pack',()=>{
 const p=enginePack(),start=createWorld(p,registry),s=command(start,p,'goals.reveal',{character:'maker'},'reveal');assert.equal(moduleCatalog.goals.title,'Character goals');assert.equal(s.tick,start.tick);
 assert.throws(()=>command(s,p,'goals.advance',{character:'maker',step:'supplies',act:{kind:'listen',target:'Bring the parts'}},'cheat'),/conditions/);
 assert.deepEqual(replay(start,s.events).modules.goals,s.modules.goals);
 const changed=structuredClone(p);changed.characterSheets[0].goal.steps[0].complete={minTick:2};assert.notEqual(mechanicsDigest(p),mechanicsDigest(changed));
});
test('service routes explicit goal commands without a model call or a suggestion button',async()=>{
 const p=enginePack(),store=new Store(':memory:'),provider=new MockProvider();provider.narrate=()=>{throw Error('Unexpected model call');};try{const s=createWorld(p,registry);s.flags.parts=true;store.insert(s);const service=new GameService(store,{[p.id]:p},registry,provider);let r=await service.act(s.campaignId,{id:'reveal',expectedRevision:0,command:{type:'goals.reveal',args:{character:'maker'}}});r=await service.act(s.campaignId,{id:'advance',expectedRevision:r.state.revision,command:{type:'goals.advance',args:{character:'maker',step:'supplies'}}});assert.deepEqual(r.state.modules.goals.maker.completed,['supplies']);assert.equal(r.state.tick,0);assert.equal(r.turn.provider,'Game rules');}finally{store.close();}
});
test('real model tag normalization and registered pricing advance only the current narrative step',()=>{
 const p=enginePack();p.characterSheets[0].goal.steps[0].complete='narrative';p.characterSheets[0].goal.steps[0].hint='boat design';let s=createWorld(p,registry);s=command(s,p,'goals.reveal',{character:'maker'},'reveal');
 const start=s;s=command(s,p,'social.priceActs',{character:'maker',sceneId:'talk',source:'line',acts:sceneActs([{kind:'listen',target:'boat design'}])},'priced');
 assert.deepEqual(s.modules.goals.maker.completed,['supplies']);assert.equal(s.flags.launch,true);assert.deepEqual(replay(start,s.events.slice(start.events.length)).modules.goals,s.modules.goals);
});
test('relationship marker and Studio reveal control are feature-detected and browser classification is serial',()=>{
 const tx=fixture(),data={state:tx.state,pack:tx.pack,characters:[{id:'maker',name:'Maker'}]};assert.equal(runtimePanel('relationship',data).lines.length,1);revealGoal(tx,'maker');assert.match(runtimePanel('relationship',data).lines[1],/Build a boat.*step 1\/2.*Bring the parts/);assert.equal(goalRows(tx.state,tx.pack,'maker').length,1);delete tx.pack.modules.goals;assert.deepEqual(goalRows(tx.state,tx.pack),[]);
 assert.equal(advancedSpecs(pack())['advanced/goalSettings'].fields.revealTrust.max,100);const names=['goals.test.mjs','goals-editor-browser.test.mjs'];assert.deepEqual(testGroups(names)[0].files,['tests/goals.test.mjs']);assert.deepEqual(testGroups(names,'browser')[0],{files:['tests/goals-editor-browser.test.mjs'],args:['--test-concurrency=1']});
 assert.deepEqual(testGroups([...names,'other-browser.test.mjs'],'browser',['goals-editor-browser.test.mjs'])[0].files,['tests/goals-editor-browser.test.mjs']);assert.throws(()=>testGroups(names,'unit',['goals-editor-browser.test.mjs']),/not in this group/);assert.throws(()=>testGroups(names,'browser',['missing.test.mjs']),/not in this group/);
});
test('legacy goal prompt is prose and a wider audience cannot expose scoped goal cues',()=>{
 const p=pack(),c={actor:{id:'maker',name:'Maker'},goalPrompt:'Build a boat; bring it up yourself when natural.',characterGoals:[{title:'Build a boat'}]};let text=narrativeMessages(c)[1].content;assert.match(text,/CHARACTER GOAL\nBuild a boat/);assert.doesNotMatch(text,/"goalPrompt"|"characterGoals"/);
 c.authoredKnowledge={viewer:'traveler',audience:['traveler','maker','guest'],knownBy:{}};c.contextKnowledge={fields:{goalPrompt:['maker'],characterGoals:['traveler','maker']}};assert.doesNotMatch(narrativeMessages(c)[1].content,/Build a boat/);assert.doesNotMatch(JSON.stringify(scenePromptMessages(c,p)),/Build a boat/);
});

const pack=()=>({playerId:'traveler',actors:[{id:'traveler',name:'Traveler',location:'dock'},{id:'maker',name:'Maker',location:'dock'}],locations:[{id:'dock',name:'Dock'}],modules:{goals:'0.1.0','social.relationships':'0.1.0','social.progression':'0.1.0'},goalSettings:{revealTrust:30},storyVariables:[{id:'parts',name:'Parts'},{id:'launch',name:'Launch'}],characterSheets:[{actorId:'maker',goal:{id:'boat',title:'Build a boat',why:'See the islands',steps:[{id:'supplies',title:'Gather supplies',hint:'Bring the parts',complete:{flags:{parts:true}},reward:[{type:'flag',id:'launch',value:true}]},{id:'design',title:'Discuss the design',hint:'boat design',complete:'narrative'}]}}]});
function fixture(p=pack()){
 const state={tick:0,actors:Object.fromEntries(p.actors.map(a=>[a.id,{...a}])),flags:{},modules:{goals:goals.init(p),'social.relationships':{edges:{}}},events:[]},tx={state,pack:p,events:[],set(path,value){let at=state;for(const k of path.slice(0,-1))at=at[k]??={};at[path.at(-1)]=structuredClone(value);},emit(type,payload,visibility){const e={type,payload,visibility};this.events.push(e);return e;}};return tx;
}
test('non-campus goals stay hidden, reveal, advance once and gate a creator stage',()=>{
 const tx=fixture(),{state:s,pack:p}=tx;goals.validate(p);assert.deepEqual(goalProgress(s,p),[]);assert.match(goalHint(s,p,'maker'),/bring it up yourself when natural/);
 const when={goalStep:{maker:'supplies'}};validateConditions(when,p,'gate');assert.equal(conditionReasons(when,s,p).length,1);assert.equal(progressionRequirements(when,s,p,'maker').length,1);
 revealGoal(tx,'maker');assert.equal(goalProgress(s,p)[0].title,'Build a boat');assert.throws(()=>advanceGoal(tx,'maker','supplies'),/condition/i);
 s.flags.parts=true;advanceGoal(tx,'maker','supplies');assert.equal(s.flags.launch,true);assert.equal(goalProgress(s,p)[0].step,2);assert.deepEqual(conditionReasons(when,s,p),[]);assert.deepEqual(progressionRequirements(when,s,p,'maker'),[]);assert.throws(()=>advanceGoal(tx,'maker','supplies'),/current/i);
});
test('model proposals cannot bypass a condition or supply their own reward',()=>{
 const tx=fixture();revealGoal(tx,'maker');assert.throws(()=>advanceGoal(tx,'maker','supplies',{kind:'listen',target:'Bring the parts',reward:[{type:'flag',id:'parts',value:true}]}),/condition/i);assert.deepEqual(tx.state.flags,{});
});
test('narrative steps need a committed matching paid act; mismatches and unpaid acts do nothing',()=>{
 const tx=fixture();revealGoal(tx,'maker');tx.state.flags.parts=true;advanceGoal(tx,'maker','supplies');const act={kind:'listen',target:'boat design'};
 assert.throws(()=>advanceGoal(tx,'maker','design',act),/act/i);
 goals.react(tx,{type:'social.actPriced',payload:{character:'maker',act:{...act,target:'weather'},verdict:'neutral'}});assert.equal(goalProgress(tx.state,tx.pack)[0].done,false);
 goals.react(tx,{type:'social.actPriced',payload:{character:'maker',act,verdict:'unpaid'}});assert.equal(goalProgress(tx.state,tx.pack)[0].done,false);
 const event={type:'social.actPriced',payload:{character:'maker',act,verdict:'neutral'}};tx.events.push(event);goals.react(tx,event);assert.equal(goalProgress(tx.state,tx.pack)[0].done,true);
});
test('Trust reveal is configurable and secret goals require an explicit mention',()=>{
 const tx=fixture();tx.state.modules['social.relationships'].edges['maker--traveler']=30;goals.react(tx,{type:'social.relationshipChanged',payload:{actor:'maker'}});assert.equal(goalProgress(tx.state,tx.pack).length,1);
 const p=pack();p.characterSheets[0].goal.secret=true;const hidden=fixture(p);hidden.state.modules['social.relationships'].edges['maker--traveler']=100;goals.react(hidden,{type:'social.relationshipChanged',payload:{actor:'maker'}});assert.deepEqual(goalProgress(hidden.state,p),[]);revealGoal(hidden,'maker');assert.equal(goalProgress(hidden.state,p).length,1);
});
test('invalid goal references, reward types and empty conditions fail closed',()=>{
 for(const edit of [p=>p.characterSheets[0].goal.steps[0].complete={},p=>p.characterSheets[0].goal.steps[0].complete={flags:{}},p=>p.characterSheets[0].goal.steps[0].reward=[{type:'arbitrary',path:'flags'}],p=>p.characterSheets[0].goal.steps[1].id='supplies']){const p=pack();edit(p);assert.throws(()=>goals.validate(p));}
 assert.throws(()=>validateConditions({goalStep:{maker:'missing'}},pack(),'gate'),/goalStep/);
});
test('creator progression waits for its goal step and then changes stage',()=>{
 const tx=fixture();tx.pack.relationshipStates=[{id:'known',name:'Known'},{id:'trusted',name:'Trusted'}];tx.pack.relationshipProgressions=[{character:'maker',initial:'known',transitions:[{from:'known',to:'trusted',event:'goals.advanced',requires:{goalStep:{maker:'supplies'}}}]}];progression.validate(tx.pack);tx.state.modules['social.progression']=progression.init(tx.pack);
 const event={type:'goals.advanced',payload:{character:'maker'}};progression.react(tx,event);assert.equal(tx.state.modules['social.progression'].states.maker,'known');revealGoal(tx,'maker');tx.state.flags.parts=true;goals.react(tx,{type:'core.waited',payload:{}});progression.react(tx,event);assert.equal(tx.state.modules['social.progression'].states.maker,'trusted');
});
test('goal sheets preserve unrelated data and roundtrip conditions, rewards and weekly tags',()=>{
 const p=pack(),g=p.characterSheets[0].goal,s=createSheet('maker');s.personality.traits=['curious','practical'];s.source.actor.custom='preserved';p.characterSheets=[s];const draft=structuredClone(s);draft.goal=g;draft.wants=[{id:'talk',text:'talk about the boat',keys:['listen'],goalStep:'design'}];applyCharacterSheet(p,draft);const saved=saveSheets(p),loaded=loadSheets(saved);assert.deepEqual(loaded.characterSheets[0].goal,g);assert.equal(loaded.characterSheets[0].wants[0].goalStep,'design');assert.equal(loaded.characterSheets[0].source.actor.custom,'preserved');assert.equal(saveSheets(loaded),saved);goals.validate(loaded);
 const bad=structuredClone(draft);bad.goal.title='';assert.throws(()=>applyCharacterSheet(p,bad));assert.equal(saveSheets(p),saved);assert.throws(()=>validateSheetGoal({...g,steps:[]},p));
});
test('disabled and absent goals do not expose a prompt or player progress',()=>{
 const tx=fixture();revealGoal(tx,'maker');delete tx.pack.modules.goals;assert.deepEqual(goalProgress(tx.state,tx.pack),[]);assert.equal(goalHint(tx.state,tx.pack,'maker'),'');tx.pack.modules.goals='0.1.0';tx.state.actors.maker.location='away';assert.equal(goalHint(tx.state,tx.pack,'maker'),'');
});
