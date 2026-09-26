import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,validatePack} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {Store} from '../packages/persistence/store.mjs';
import {GameService,sceneFallback} from '../packages/ai/service.mjs';
import {normalizeSceneLines} from '../packages/ai/providers.mjs';
import {messageTokens} from '../packages/ai/budget.mjs';
import {budgetSceneContext} from '../packages/ai/context-budget.mjs';
import {classifyUtterance,memoryText,mentionsPlayer,stripPlaceholders,disclosedName,playerStatements} from '../packages/ai/memory.mjs';
import {scenePromptMessages,absentView} from '../vendor/venus/scenePrompt.mjs';
const pack=()=>JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)));
const said=(input,names=['Ada'])=>{const c=classifyUtterance(input,names);return {kind:c.kind,text:memoryText(c.kind,c.said,'Ada')};};

test('player utterances are classified so questions are dropped and disclosures keep their speaker',()=>{
 assert.deepEqual(said('Tell Ada my name is Mara and I grew up by the harbor'),{kind:'disclosure',text:'the player told Ada: the player’s name is Mara and the player grew up by the harbor'});
 assert.equal(said('Tell Ada I am nervous and I love your lathe').text,'the player told Ada: the player is nervous and the player loves Ada’s lathe');
 assert.equal(said('Ask Ada what she is building').kind,'question');
 assert.equal(said('Where did you put the notebook?').kind,'question');
 assert.equal(said('Ask Ada to repeat what I promised').kind,'question');
 assert.deepEqual(said('Thank Ada and promise to bring her coffee tomorrow'),{kind:'promise',text:'the player promised Ada to bring her coffee tomorrow'});
 assert.deepEqual(said('Tell Ada about the storm that sank my father’s boat'),{kind:'disclosure',text:'the player told Ada about the storm that sank the player’s father’s boat'});
 assert.equal(said('Tell Ada a joke about a clockmaker').kind,'statement');
 assert.equal(said('Talk to Ada: I love this place').text,'the player told Ada: the player loves this place');
});

test('a name the player gives is used in that character’s later memories',()=>{
 assert.equal(disclosedName('my name is mara and I sail'),'Mara');
 assert.equal(disclosedName('call me Jo'),'Jo');
 assert.equal(disclosedName('my name is not important'),'');
 const p=pack(),mem=(source,tick,text,knownBy=['player','ada'])=>({source,tick,text,knownBy});
 const state={turns:{},modules:{'social.conversation':{memories:[mem('a',1,'Tell Ada I love the harbor'),mem('b',2,'Tell Ada my name is Mara'),mem('c',3,'Tell Ada I am nervous'),mem('d',4,'Tell Brin I am tired',['player','brin'])]}}};
 p.actors.find(a=>a.id===p.playerId).name='You';
 assert.deepEqual(playerStatements(state,p,'ada').map(m=>m.text),['the player told Ada: the player loves the harbor','the player told Ada: the player’s name is Mara','Mara told Ada: Mara is nervous']);
 // Brin never heard the name.
 assert.deepEqual(playerStatements(state,p,'brin').map(m=>m.text),['the player told Brin: the player is tired']);
});

test('actor pronouns are validated and reach the cast profile',()=>{
 const p=pack(),ada=p.actors.find(a=>a.id==='ada');ada.pronouns='she/her';
 assert.ok(validatePack(p,registry).length);
 const context={stagedCast:['ada'],sceneHistory:[],memories:[],playerAction:'Wave'};
 assert.ok(/she\/her/.test(scenePromptMessages(context,p)[1].content));
 ada.pronouns=7;assert.throws(()=>validatePack(p,registry),/pronouns/);
});

test('model impressions must be about the player, and role-play placeholders are replaced',()=>{
 assert.equal(mentionsPlayer('Brin likes sharing details about his habits'),false);
 assert.equal(mentionsPlayer('Brin was touched that the player shared a story'),true);
 assert.equal(mentionsPlayer('Mara kept her word','Mara'),true);
 assert.equal(stripPlaceholders('Thanks, {{user}}. {{char}} smiles.','you','Brin'),'Thanks, you. Brin smiles.');
});

test('on a 4K window, what the player disclosed 25 turns ago is still in the prompt when they ask about it',async()=>{
 const p=pack();delete p.modules['world.schedule'];
 const contexts=[],page=n=>`Ada turns page ${n} of the plans toward the lamp and traces each line of the design with a careful finger while she thinks it over. `.repeat(3);
 const provider={name:'probe',contextWindow:4096,maxTokens:600,async interpretScene(){throw Error('a conversation must continue without reclassifying');},
  async generateScene(context){contexts.push(structuredClone(context));return {lines:Array.from({length:6},(_,i)=>({speaker:i%2?'ada':'',text:page(contexts.length*10+i)}))};},
  async generateLedger(){return [{charKey:'ada',type:'liked',desc:'Ada likes her own tidy desk.'}];}};
 const store=new Store();store.insert(createWorld(p,registry,'recall'));const service=new GameService(store,{[p.id]:p},registry,provider);
 try{
  let result=await service.act('recall',{id:'open',expectedRevision:0,command:{type:'core.scene',args:{text:'Sit down with Ada.',location:'hub',characters:['ada'],activity:'talk'}}});
  const say=async(id,input)=>{result=await service.act('recall',{id,expectedRevision:result.state.revision,input});return result;};
  await say('disclose','Tell Ada my name is Mara and I grew up by the harbor');
  await say('absent','Tell Ada I am nervous about seeing Brin later');
  for(let i=0;i<24;i++)await say(`q${i}`,`Ask Ada what page ${i} of the plans shows`);
  await say('recall','Ask Ada where I grew up');
  const last=contexts.at(-1),report=result.turn.contextReport,prompt=scenePromptMessages(last,p);
  // One continuous scene: talking about an absent character did not restart it, so the transcript survived.
  assert.equal(result.state.scene.id,'open');
  assert.ok(messageTokens(prompt)<=report.budget,`prompt over budget: ${JSON.stringify(report).slice(0,300)}`);
  assert.equal(report.overBudget,false);
  const memories=last.memories.map(m=>m.text);
  assert.ok(memories.some(t=>t==='the player told Ada: the player’s name is Mara and the player grew up by the harbor'),JSON.stringify(memories));
  // The memory the player is asking about is moved next to the action, where a small model reads.
  assert.ok(prompt[1].content.includes('PLAYER ACTION\nAsk Ada where I grew up\nRELEVANT MEMORY\n- the player told Ada: the player’s name is Mara and the player grew up by the harbor'));
  assert.ok(memories.some(t=>/nervous about seeing Brin/.test(t)));
  assert.ok(!memories.some(t=>/what page/.test(t)),'questions are not memories');
  assert.ok(!memories.some(t=>/tidy desk/.test(t)),'impressions not about the player are dropped');
  // The rendered prompt carries text, not bookkeeping IDs.
  assert.ok(!/"source"/.test(prompt[1].content));
  assert.ok(report.included.some(([key,level])=>key.startsWith('history:')&&level==='digest'),'the old transcript was compacted to make room');
 }finally{store.close();}
});

test('a scene answer with a name for a speaker, a player line and a stranger is repaired, not rejected',()=>{
 const p=pack(),context={stagedCast:['ada']};
 const value=normalizeSceneLines({lines:[{speaker:'Ada',text:'Hello, {{user}}.'},{speaker:'You',text:'You nod.'},{speaker:'brin',text:'I walk in.'},{speaker:'ada',text:'  '},{speaker:'Narrator',text:'{{char}} waits.'}]},context,p);
 assert.deepEqual(value.lines.map(l=>[l.speaker,l.text]),[['ada','Hello, you.'],['','You nod.'],['','they waits.']]);
});

test('a failed scene reply does not echo the player’s words back as the story',()=>{
 const turn={command:{actorId:'player',type:'core.scene'},events:[{type:'core.sceneContinued',visibility:['player'],payload:{text:'Ask Ada where I grew up'}},{type:'core.moved',visibility:['player'],payload:{text:'You go to Hub.'}}]};
 assert.equal(sceneFallback(turn),'You go to Hub.\n(The model’s reply could not be used. Retry this turn.)');
});

test('absent characters share one rule instead of one copy each',()=>{
 const rule='Not in this scene.';
 assert.deepEqual(absentView([{id:'a',name:'Ada',rule},{id:'b',name:'Brin',rule}]),{names:['Ada','Brin'],rule});
 assert.equal(absentView([]),undefined);
});

test('the minimal preset keeps only the newest turns word for word, even when more would fit',()=>{
 const p=pack(),history=Array.from({length:12},(_,i)=>({source:`h${i}`,input:`Line ${i}`,text:`Ada answers ${i}.`}));
 const context={stagedCast:['ada'],sceneHistory:history,memories:[],playerAction:'Go on'};
 const {context:out}=budgetSceneContext(context,p,{turns:{}},'now',{window:32768,reply:500,verbatim:6,render:c=>scenePromptMessages(c,p)});
 assert.deepEqual(out.sceneHistory.map(h=>Boolean(h.compact)),[...Array(6).fill(true),...Array(6).fill(false)]);
});
