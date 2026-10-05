import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {Store} from '../packages/persistence/store.mjs';
import {GameService} from '../packages/ai/service.mjs';
import {CompatibleProvider} from '../packages/ai/providers.mjs';
import {scenePromptMessages} from '../vendor/venus/scenePrompt.mjs';
import {shortenSceneSoFar} from '../vendor/venus/scenePrompt.mjs';
import {exportCampaign,validateImport} from '../packages/persistence/store.mjs';
import {scenePlanForTurn} from '../packages/core/scene-plan.mjs';
const pack=()=>JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)));

test('a classifier location with a leading article still commits the requested move',async()=>{
 const p=pack();
 const provider=new CompatibleProvider({endpoint:'http://127.0.0.1:1234/v1/chat/completions',model:'stub',fetchImpl:async(_url,request)=>{
  const body=JSON.parse(request.body),content=body.response_format?.json_schema?.name==='scene_intent'?JSON.stringify({characters:[],mentionedOnly:[],sceneLocation:'the workshop',activity:'explore',activityId:'',itemAction:'',itemId:'',itemTarget:''}):JSON.stringify({lines:[{speaker:'',text:'You make your way to the workshop and look around.'}]});
  return {ok:true,json:async()=>({choices:[{message:{content},finish_reason:'stop'}]})};
 }});
 const store=new Store();store.insert(createWorld(p,registry,'article-test'));const service=new GameService(store,{[p.id]:p},registry,provider);
 try{const result=await service.act('article-test',{id:'go',expectedRevision:0,input:'Go to the Workshop'});assert.equal(result.state.actors.player.location,'workshop');assert.match(result.turn.narrative,/workshop/);assert.ok(result.turn.events.some(e=>e.type==='core.moved'&&e.payload.to==='workshop'));assert.equal(validateImport(exportCampaign(result.state),p,registry).actors.player.location,'workshop');}finally{store.close();}
});

test('authored location aliases override a model location guess',async()=>{
 const p=pack();p.locations.find(x=>x.id==='workshop').aliases=['studio','maker room'];
 const provider={name:'probe',async interpretScene(){return {characters:[],mentionedOnly:[],location:'meeting',activity:'explore',activityId:'',itemAction:'',itemId:'',itemTarget:''};},async generateScene(){return {lines:[{speaker:'',text:'You arrive at the studio.'}]};}};
 const store=new Store();store.insert(createWorld(p,registry,'alias-test'));const service=new GameService(store,{[p.id]:p},registry,provider);
 try{const result=await service.act('alias-test',{id:'go',expectedRevision:0,input:'Head to the studio.'});assert.equal(result.state.actors.player.location,'workshop');assert.ok(result.turn.events.some(e=>e.type==='core.moved'&&e.payload.to==='workshop'));}finally{store.close();}
});

test('a compatible scene call also records memory and facts without follow-up model calls',async()=>{
 const p=pack();p.modules['story.facts']='0.1.0';let calls=0;
 const provider=new CompatibleProvider({endpoint:'http://127.0.0.1:1234/v1/chat/completions',model:'stub'});
 provider.complete=async()=>{calls++;return JSON.stringify({lines:[{speaker:'ada',text:'The archive opens at sunset.'}],memories:[{charKey:'ada',type:'liked',desc:'The player asked Ada about the archive.'}],facts:[{subject:'ada',text:'The archive opens at sunset.',quote:'The archive opens at sunset.'}]});};
 provider.generateLedger=async()=>{throw Error('separate ledger request should not run');};provider.generateFacts=async()=>{throw Error('separate fact request should not run');};
 const store=new Store();store.insert(createWorld(p,registry,'bundled-metadata'));const service=new GameService(store,{[p.id]:p},registry,provider);
 try{const result=await service.act('bundled-metadata',{id:'talk',expectedRevision:0,command:{type:'social.speak',args:{target:'ada',text:'When does the archive open?'}}});assert.equal(calls,1);assert.equal(result.turn.ledger.length,1);assert.equal(result.turn.generatedFacts.length,1);}finally{store.close();}
});

test('unresolved travel asks for a destination without committing a turn',async()=>{
 const p=pack(),provider={name:'probe',async interpretScene(){return {characters:[],mentionedOnly:[],location:null,activity:'explore',activityId:'',itemAction:'',itemId:'',itemTarget:''};}};
 const store=new Store();store.insert(createWorld(p,registry,'unknown-place'));const service=new GameService(store,{[p.id]:p},registry,provider);
 try{const result=await service.act('unknown-place',{id:'go',expectedRevision:0,input:'Go somewhere completely different.'});assert.match(result.clarification,/Where do you want to go/);assert.equal(result.state.revision,0);assert.deepEqual(result.state.turns,{});}finally{store.close();}
});

test('an unaddressed activity cannot acquire a cast or conversation from the classifier',async()=>{
 const p=pack();p.gameProject=JSON.parse(readFileSync(new URL('../packs/crossed-plans.json',import.meta.url))).gameProject;const provider={name:'probe',async interpretScene(){return {characters:['ada'],mentionedOnly:[],location:'hub',activity:'talk',activityId:'',itemAction:'',itemId:'',itemTarget:''};},async generateScene(){return {lines:[{speaker:'',text:'You settle into a chair and read.'}]};}};
 const store=new Store();store.insert(createWorld(p,registry,'solo-grounding'));const service=new GameService(store,{[p.id]:p},registry,provider);
 try{const result=await service.act('solo-grounding',{id:'read',expectedRevision:0,input:'Go to the workshop and take a slow walk.'});assert.deepEqual(result.turn.scenePlan.cast,[]);assert.deepEqual(result.turn.command.args.characters,[]);assert.equal(result.turn.command.args.activity,'explore');assert.equal(result.state.scene,null);}finally{store.close();}
});

test('committed scene plan is the shared authority for cast, location and narrator actor',()=>{const p=pack(),initial=createWorld(p,registry,'plan'),result=execute(initial,{id:'talk',type:'social.speak',args:{target:'ada',text:'Hello'},actorId:p.playerId,expectedRevision:0},p,registry);const plan=scenePlanForTurn(result.state,p,result.turn);assert.deepEqual(plan.cast,['ada']);assert.equal(plan.location,'hub');assert.equal(plan.actor,'ada');assert.equal(plan.source,'social.spoke');});

test('multi-character scene continuation keeps player words, transcript and character profiles',async()=>{
 const p=pack();delete p.modules['world.schedule'];p.actors.find(a=>a.id==='brin').location='hub';p.actors.find(a=>a.id==='brin').voice='Dry and playful';
 const contexts=[],provider={name:'probe',async interpretScene(){throw Error('Continuation should not need a classifier');},async generateScene(context){contexts.push(structuredClone(context));return {lines:[{speaker:'ada',text:'The blue plan is ready. Shall we use it?'},{speaker:'brin',text:'I prefer the blue plan too.'}]};}};
 const store=new Store();store.insert(createWorld(p,registry,'scene-test'));const service=new GameService(store,{[p.id]:p},registry,provider);
 try{await service.act('scene-test',{id:'open',expectedRevision:0,command:{type:'core.scene',args:{text:'Discuss the plans together.',location:'hub',characters:['ada','brin'],activity:'talk'}}});const result=await service.act('scene-test',{id:'reply',expectedRevision:1,input:'I agree. The blue plan sounds good.'});assert.equal(contexts[1].scenePhase,'continuation');assert.equal(contexts[1].playerAction,'I agree. The blue plan sounds good.');assert.match(contexts[1].sceneHistory[0].text,/blue plan/);assert.ok(result.turn.contextSources.includes('open'));const messages=scenePromptMessages(contexts[1],p);assert.match(messages[1].content,/SCENE SO FAR/);assert.match(messages[1].content,/Dry and playful/);assert.match(messages[1].content,/PLAYER ACTION/);assert.ok(!messages[0].content.includes('Return plain text'));}finally{store.close();}
});

test('authored scenes and their choices do not generate hidden model prose or memories',async()=>{
 const p=pack();p.modules['story.scenes']='0.1.0';p.scriptedScenes=[{id:'intro',title:'Hello',opening:'Ada points to the map.',trigger:{event:'core.inspected',match:{}},pages:[{speaker:'ada',text:'We should start here.'}],choices:[{id:'yes',label:'Agree',result:'You agree to start here.',effects:[]}]}];let calls=0;const provider={name:'must-not-run',async generateScene(){calls++;throw Error('unexpected generation');},async generateLedger(){calls++;return [];}};
 const store=new Store();store.insert(createWorld(p,registry,'authored-test'));const service=new GameService(store,{[p.id]:p},registry,provider);
 try{const opening=await service.act('authored-test',{id:'open',expectedRevision:0,command:{type:'core.inspect',args:{}}});assert.equal(opening.turn.provider,'Authored scene');assert.match(opening.turn.narrative,/We should start here/);const result=await service.act('authored-test',{id:'choose',expectedRevision:1,command:{type:'story.choose',args:{scene:'intro',choice:'yes'}}});assert.equal(result.turn.narrative,'You agree to start here.');assert.equal(calls,0);}finally{store.close();}
});

test('typed replies continue an authored choice scene while keeping its options available',async()=>{
 const p=pack();delete p.modules['world.schedule'];p.modules['story.scenes']='0.1.0';p.scriptedScenes=[{id:'intro',title:'Hello',opening:'Ada studies the map.',trigger:{event:'core.inspected',match:{}},pages:[{speaker:'ada',text:'Which route sounds right to you?'}],choices:[{id:'short',label:'Take the short route',result:'You choose the short route.',effects:[]}]}];
 const contexts=[],provider={name:'probe',async generateScene(context){contexts.push(structuredClone(context));return {lines:[{speaker:'ada',text:'Tell me what matters to you, then.'}]};}};
 const store=new Store();store.insert(createWorld(p,registry,'authored-reply'));const service=new GameService(store,{[p.id]:p},registry,provider);
 try{await service.act('authored-reply',{id:'open',expectedRevision:0,command:{type:'core.inspect',args:{}}});const reply=await service.act('authored-reply',{id:'reply',expectedRevision:1,input:'I want the safer route, but I am listening.'});assert.equal(reply.turn.command.type,'story.respond');assert.deepEqual(reply.state.scene.characters,['ada']);assert.equal(reply.state.modules['story.scenes'].pending,'intro');assert.ok(registry['story.scenes'].actions(reply.state,p).some(action=>action.type==='story.choose'&&action.args.choice==='short'));assert.equal(contexts[0].playerAction,'I want the safer route, but I am listening.');assert.equal(reply.turn.sceneLines[0].speaker,'ada');}finally{store.close();}
});

test('authored scenes can explicitly disable free text',async()=>{
 const p=pack();p.modules['story.scenes']='0.1.0';p.scriptedScenes=[{id:'menu',title:'Menu',opening:'Choose one.',allowInput:false,trigger:{event:'core.inspected',match:{}},pages:[],choices:[{id:'a',label:'Option A',result:'A.',effects:[]}]}];
 let calls=0;const provider={name:'probe',async generateScene(){calls++;return {lines:[]};}};const store=new Store();store.insert(createWorld(p,registry,'blocked-reply'));const service=new GameService(store,{[p.id]:p},registry,provider);
 try{await service.act('blocked-reply',{id:'open',expectedRevision:0,command:{type:'core.inspect',args:{}}});const reply=await service.act('blocked-reply',{id:'reply',expectedRevision:1,input:'Something else'});assert.match(reply.clarification,/Choose one/);assert.equal(reply.state.revision,1);assert.equal(calls,0);}finally{store.close();}
});

test('scene JSON is repaired once and malformed structured data is never returned as prose',async()=>{
 const p=pack(),provider=new CompatibleProvider({endpoint:'http://localhost:1234/v1/chat/completions',model:'test'});let calls=0;provider.complete=async()=>++calls===1?'```json\n{"lines": broken}\n```':JSON.stringify({lines:[{speaker:'ada',text:'Let us try the blue plan.'}]});
 const context={stagedCast:['ada'],scenePhase:'continuation',sceneHistory:[],playerAction:'Yes',location:p.locations[0]};const output=await provider.generateScene(context,p);assert.equal(calls,2);assert.equal(output.lines[0].speaker,'ada');provider.complete=async()=>'{}';await assert.rejects(()=>provider.generateScene(context,p),/Scene format failed after repair/);
});

test('continuous conversation mode tells the model to use initiative and natural scene endings',()=>{const p=pack();p.gameProject={conversationStyle:'continuous'};const context={stagedCast:['ada'],scenePhase:'continuation',sceneHistory:[],playerAction:'I think we have said enough.',location:p.locations[0],gameProject:p.gameProject};const messages=scenePromptMessages(context,p);assert.match(messages[1].content,/character react with initiative and subtext/);assert.match(messages[1].content,/End the scene when its immediate purpose is complete/);});

test('direct conversation pins attendance across schedule boundary and pronoun follow-up',async()=>{
 const p=pack();p.schedules=[{actor:'ada',period:12,stops:[{at:1,location:'meeting'}]}];const contexts=[];
 const provider={name:'probe',async interpretScene(){throw Error('Must keep current partner');},async generateScene(c){contexts.push(c);return {lines:[{speaker:'ada',text:'I am still here.'}]};}};
 const store=new Store();store.insert(createWorld(p,registry,'pin'));const service=new GameService(store,{[p.id]:p},registry,provider);
 try{let r=await service.act('pin',{id:'hello',expectedRevision:0,command:{type:'social.speak',args:{target:'ada',text:'Hello Ada'}}});assert.equal(r.state.actors.ada.location,'hub');assert.deepEqual(r.state.scene.characters,['ada']);r=await service.act('pin',{id:'follow',expectedRevision:1,input:'Flirt with her and ask how she is doing'});assert.equal(r.state.actors.ada.location,r.state.actors.player.location);assert.deepEqual(contexts[1].stagedCast,['ada']);assert.equal(contexts[1].scenePhase,'continuation');}finally{store.close();}
});

test('conversation cannot accept a classifier-invented destination or substitute another actor',async()=>{
 const p=pack();const provider={name:'probe',async interpretScene(){return {characters:['brin'],location:'workshop',activity:'meet'};},async generateScene(c){assert.equal(c.location.id,'hub');assert.deepEqual(c.stagedCast,['ada']);return {lines:[{speaker:'ada',text:'Hello.'}]};}};
 const store=new Store();store.insert(createWorld(p,registry,'destination'));const service=new GameService(store,{[p.id]:p},registry,provider);
 try{const r=await service.act('destination',{id:'talk',expectedRevision:0,input:'Flirt with Ada and ask how she is doing'});assert.equal(r.state.actors.player.location,'hub');assert.deepEqual(r.state.scene.characters,['ada']);}finally{store.close();}
});

test('failed conversation attempt cannot generate a fictional arrival; unresolved pronoun does not commit',async()=>{
 const p=pack();let calls=0;const provider={name:'probe',async interpretScene(){return {characters:['brin'],location:'workshop',activity:'talk'};},async generateScene(c){calls++;assert.deepEqual(c.stagedCast,[]);assert.match(c.direction,/Brin isn't at Hub[^]*nobody moves/);return {lines:[{speaker:'',text:'The hub is quiet.'}]};}};
 const store=new Store();store.insert(createWorld(p,registry,'absent'));const service=new GameService(store,{[p.id]:p},registry,provider);
 try{let r=await service.act('absent',{id:'talk',expectedRevision:0,input:'Ask Brin how she is doing'});assert.equal(r.state.actors.player.location,'hub');assert.equal(r.state.scene,null);assert.equal(calls,1);r=await service.act('absent',{id:'pronoun',expectedRevision:1,input:'Flirt with her'});assert.ok(r.clarification);assert.equal(r.state.revision,1);assert.equal(calls,1);}finally{store.close();}
});

test('naming an absent character redirects for free instead of taxing a failed meeting',()=>{
 const p=pack(),w=createWorld(p,registry,'redirect');
 const r=execute(w,{id:'seek',type:'core.scene',args:{text:'Look for Brin here.',location:null,characters:['brin'],activity:'meet'},actorId:p.playerId,expectedRevision:w.revision},p,registry);
 const redirect=r.turn.events.find(e=>e.type==='world.meetingRedirect');
 assert.ok(redirect,'expected a meetingRedirect event');
 assert.match(redirect.payload.text,/Brin isn't at Hub/);assert.match(redirect.payload.text,/at Workshop right now/);
 assert.equal(r.state.actors.player.location,w.actors.player.location);
 assert.equal(r.state.tick,w.tick);
 assert.equal(r.state.scene,null);
});

test('a cloud model gets style lints as warnings without a repair call; a local model still repairs',async()=>{
 const p=pack(),draft=n=>n===1?'It is Sunday morning and the room is quiet.':'The room is quiet.',c={stagedCast:[],absentCharacters:[],sceneHistory:[],location:p.locations[0],weekday:'Monday'};
 const run=async endpoint=>{const provider=new CompatibleProvider({endpoint,model:'test'});let calls=0;provider.complete=async()=>JSON.stringify({lines:[{speaker:'',text:draft(++calls)}]});return {r:await provider.generateScene(c,p),calls,remote:provider.remote};};
 const cloud=await run('https://example.com/v1/chat/completions');assert.equal(cloud.remote,true);assert.equal(cloud.calls,1);assert.match(cloud.r.lines[0].text,/Sunday/);assert.equal(cloud.r.lintTrace[0].check,'calendar');assert.equal(cloud.r.lintTrace[0].warned,true);
 const local=await run('http://localhost:1234/v1/chat/completions');assert.equal(local.remote,false);assert.equal(local.calls,2);assert.equal(local.r.lines[0].text,'The room is quiet.');assert.equal(local.r.lintTrace[0].check,'calendar');
});

test('a cloud model is still repaired for an off-stage entrance',async()=>{
 const p=pack(),provider=new CompatibleProvider({endpoint:'https://example.com/v1/chat/completions',model:'test'});let calls=0;provider.complete=async()=>JSON.stringify({lines:[{speaker:'',text:++calls===1?'Brin peeks in, smiling.':'The room remains quiet.'}]});
 const r=await provider.generateScene({stagedCast:[],absentCharacters:[{id:'brin',name:'Brin'}],sceneHistory:[],location:p.locations[0]},p);assert.equal(calls,2);assert.equal(r.lintTrace[0].check,'attendance');assert.equal(r.lintTrace[0].resolved,true);
});

test('narrator repairs an explicit off-stage entrance even when hidden in narration',async()=>{
 const p=pack(),provider=new CompatibleProvider({endpoint:'http://localhost:1234/v1/chat/completions',model:'test'});let calls=0;provider.complete=async()=>JSON.stringify({lines:[{speaker:'',text:++calls===1?'Brin peeks in, smiling.':'The room remains quiet.'}]});
 const c={stagedCast:[],absentCharacters:[{id:'brin',name:'Brin'}],sceneHistory:[],location:p.locations[0]};const r=await provider.generateScene(c,p);assert.equal(calls,2);assert.equal(r.lines[0].text,'The room remains quiet.');assert.equal(r.lintTrace[0].check,'attendance');assert.equal(r.lintTrace[0].resolved,true);
});

test('narrator repairs a line that leaks a fact outside its knownBy',async()=>{
 const p=pack(),provider=new CompatibleProvider({endpoint:'http://localhost:1234/v1/chat/completions',model:'test'});let calls=0;
 provider.complete=async()=>++calls===1?JSON.stringify({lines:[{speaker:'brin',text:'The vault code is 4471, easy.'}]}):JSON.stringify({lines:[{speaker:'brin',text:'I have no idea what the code is.'}]});
 const c={stagedCast:['ada','brin'],knownFacts:[{id:'f1',subject:'ada',text:'Ada knows the vault code',quote:'The vault code is 4471',knownBy:['player','ada']}],sceneHistory:[],location:p.locations[0]};
 const r=await provider.generateScene(c,p);assert.equal(calls,2);assert.equal(r.lines[0].text,'I have no idea what the code is.');assert.equal(r.lintTrace[0].check,'knowledge');assert.equal(r.lintTrace[0].resolved,true);
});

test('explicit prose is not rewritten by a word filter, even at the fade level',async()=>{
 const p=pack();p.intimacySettings={contentLevel:'fade'};const provider=new CompatibleProvider({endpoint:'http://localhost:1234/v1/chat/completions',model:'test'});let calls=0;
 provider.complete=async()=>++calls===1?JSON.stringify({lines:[{speaker:'',text:'She thrusts closer, breathless.'},{speaker:'ada',text:'Closer.'}]}):JSON.stringify({lines:[{speaker:'ada',text:'The scene fades to morning.'}]});
 const c={stagedCast:['ada'],sceneHistory:[],location:p.locations[0]};
 const r=await provider.generateScene(c,p);assert.equal(calls,1);assert.equal(r.lines[0].text,'She thrusts closer, breathless.');assert.ok(!r.lintTrace?.some(t=>t.check==='content'));
});

test('scene summary persists and a natural ending settles without a second writing call',async()=>{
 const p=pack();const seen=[];let ledgerCalls=0;const provider={name:'probe',async interpretScene(){throw Error('Continuation should not call classifier');},async generateScene(c){seen.push(structuredClone(c));if(c.scenePhase==='closing')return {lines:[{speaker:'ada',text:'See you later.'}],summary:'The reader and Ada agreed to meet again.'};if(seen.length===1)return {lines:[{speaker:'ada',text:'We can talk now.'}],summary:'The reader met Ada.'};return {lines:[{speaker:'ada',text:'Let us meet again.'}],summary:'The reader and Ada agreed on a later meeting.',end_scene:true};},async generateLedger(){ledgerCalls++;return [];}};
 const store=new Store();store.insert(createWorld(p,registry,'ending'));const service=new GameService(store,{[p.id]:p},registry,provider);
 try{
  let r=await service.act('ending',{id:'start',expectedRevision:0,command:{type:'core.scene',args:{text:'Meet Ada.',location:'hub',characters:['ada'],activity:'talk'}}});
  assert.equal(r.state.scene.summary,'The reader met Ada.');assert.equal(r.state.scene.id,'start');
  r=await service.act('ending',{id:'follow',expectedRevision:1,input:'That sounds good.'});
  assert.equal(seen[1].sceneSummary,'The reader met Ada.');assert.equal(seen.length,2);assert.equal(r.state.scene,null);assert.equal(r.turn.sceneEnded,true);assert.match(r.turn.narrative,/Let us meet again/);assert.equal(r.turn.sceneSummary,'The reader and Ada agreed on a later meeting.');assert.equal(ledgerCalls,2);
  const restored=validateImport(exportCampaign(r.state),p,registry);assert.equal(restored.scene,null);assert.equal(restored.turns.follow.sceneSummary,r.turn.sceneSummary);
 }finally{store.close();}
});

test('a rejected long transcript can be shortened to its final stub',()=>{
 const prompt="STORY SO FAR\nEarlier events\nSCENE SO FAR\n'''\nFirst turn\nSecond turn\n'''\nYOUR TURN";
 assert.equal(shortenSceneSoFar(prompt),"STORY SO FAR\nEarlier events\nSCENE SO FAR\n'''\nSecond turn\n'''\nYOUR TURN");
});

test('ending a pinned conversation applies its missed schedule and replays',async()=>{
 const p=pack();p.schedules=[{actor:'ada',period:12,stops:[{at:1,location:'meeting'}]}];let calls=0;
 const provider={name:'probe',async generateScene(c){calls++;return c.scenePhase==='closing'?{lines:[{speaker:'ada',text:'I should go to the meeting now.'}],summary:'The reader talked to Ada before she left.'}:{lines:[{speaker:'ada',text:'I will leave shortly.'}],summary:'The reader talked to Ada.',end_scene:true};}};
 const store=new Store();store.insert(createWorld(p,registry,'scheduled-ending'));const service=new GameService(store,{[p.id]:p},registry,provider);
 try{const r=await service.act('scheduled-ending',{id:'hello',expectedRevision:0,command:{type:'social.speak',args:{target:'ada',text:'Hello Ada'}}});assert.equal(r.state.scene,null);assert.equal(r.state.actors.ada.location,'meeting');assert.equal(calls,1);assert.equal(validateImport(exportCampaign(r.state),p,registry).actors.ada.location,'meeting');}finally{store.close();}
});

test('leaving a conversation releases a cast member to a missed schedule stop',async()=>{
 const p=pack();p.schedules=[{actor:'ada',period:12,stops:[{at:1,location:'meeting'}]}];const provider={name:'probe',async generateScene(){return {lines:[{speaker:'ada',text:'We can keep talking.'}]};}};
 const store=new Store();store.insert(createWorld(p,registry,'leave'));const service=new GameService(store,{[p.id]:p},registry,provider);
 try{const first=await service.act('leave',{id:'talk',expectedRevision:0,command:{type:'social.speak',args:{target:'ada',text:'Hello'}}});assert.equal(first.state.actors.ada.location,'hub');const next=await service.act('leave',{id:'move',expectedRevision:1,command:{type:'core.move',args:{to:'workshop'}}});assert.equal(next.state.scene,null);assert.equal(next.state.actors.ada.location,'meeting');assert.equal(validateImport(exportCampaign(next.state),p,registry).actors.ada.location,'meeting');}finally{store.close();}
});

test('Goodbye ends the conversation deterministically without another model call',async()=>{
 const p=pack();let calls=0;const provider={name:'probe',async generateScene(){calls++;return {lines:[{speaker:'ada',text:'We should catch up later.'}]};}};
 const store=new Store();store.insert(createWorld(p,registry,'goodbye'));const service=new GameService(store,{[p.id]:p},registry,provider);
 try{await service.act('goodbye',{id:'talk',expectedRevision:0,command:{type:'social.speak',args:{target:'ada',text:'Hello'}}});const r=await service.act('goodbye',{id:'bye',expectedRevision:1,input:'Goodbye'});assert.equal(r.state.scene,null);assert.equal(r.turn.command.type,'core.endScene');assert.equal(calls,1);assert.equal(validateImport(exportCampaign(r.state),p,registry).scene,null);}finally{store.close();}
});
