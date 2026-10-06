import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {scenePromptMessages,calmContinuationMessages} from '../vendor/venus/scenePrompt.mjs';
import {lintScene} from '../packages/ai/narration-lint.mjs';
import {dropStock} from '../packages/ai/untrusted-output.mjs';
import {createSheet,validateCharacterSheets,speechWarnings,saveSheets,loadSheets} from '../public/sheet-editor.mjs';
import {creatorTemplate} from '../packages/cards/creator-template.mjs';
import {validatePack,replay,createWorld} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {createLab} from '../packages/testing/character-lab.mjs';
import {MockProvider,CompatibleProvider} from '../packages/ai/providers.mjs';
const fixture=()=>{const p=JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)));p.narratorPersona='lush';p.gameProject={premise:'A workshop project.',setting:'An adult maker cooperative.',ai:{intent:'',scene:'',daypart:''},conversationStyle:'continuous'};p.schedules=[];p.characterSheets=['ada','brin'].map(id=>{const s=createSheet(id);s.personality.traits=['curious','practical'];s.speech={tics:[id==='ada'?'Precisely':'Fair winds'],fillers:['well'],rhythm:id==='ada'?'measured clauses':'short and warm',petPhrases:[],avoid:['whatever'],sample:id==='ada'?'Precisely. There is a better way.':'Fair winds. We can fix it.'};return s;});return p;};
const context=p=>({gameProject:p.gameProject,stagedCast:['ada'],scenePhase:'continuation',sceneHistory:[],playerAction:'Tell me about the project.',location:p.locations[0],allowPlayerReactions:true});
test('persona is pack-owned, social defaults lush, blank preserves the supplied pack',()=>{
 const p=fixture();delete p.narratorPersona;assert.equal(creatorTemplate(p,'social').narratorPersona,'lush');assert.equal(creatorTemplate(p,'blank').narratorPersona,undefined);
 for(const [option,pattern] of [['lush',/rich sensory texture, body language and a beat of her inner thoughts/],['lean',/Lean: concise visible action/],['Write as a dry travel diarist.',/NARRATOR PERSONA: Write as a dry travel diarist\./]]){p.narratorPersona=option;assert.match(scenePromptMessages(context(p),p)[0].content,pattern);validatePack(p,registry);}
 p.narratorPersona={};assert.throws(()=>validatePack(p,registry),/narratorPersona/);
});
test('speech is compact, on-stage only, round-trips, and stays before the changing time header',()=>{
 const p=fixture(),c=context(p);c.castProfiles=p.actors;const user=scenePromptMessages({...c,day:1,weekday:'Monday',daypart:'Morning'},p)[1].content;
 assert.match(user,/tics: Precisely.*rhythm: measured clauses.*sample: Precisely/);assert.doesNotMatch(user,/Fair winds/);
 assert.ok(user.indexOf('Speech:')<user.indexOf('Day 1, Monday'));
 const loaded=loadSheets(saveSheets(p));assert.deepEqual(loaded.characterSheets[0].speech,p.characterSheets[0].speech);validatePack(loaded,registry);
 for(const speech of [{...p.characterSheets[0].speech,tics:'wrong'},{...p.characterSheets[0].speech,sample:4}]){const bad=structuredClone(p);bad.characterSheets[0].speech=speech;assert.throws(()=>validateCharacterSheets(bad),/speech/);}
});
test('duplicates warn across tics and pet phrases, case-insensitively; distinct profiles do not warn',()=>{
 const p=fixture();assert.deepEqual(speechWarnings(p),[]);p.characterSheets[1].speech.petPhrases=[' PRECISELY '];assert.match(speechWarnings(p)[0],/Ada and Brin/);validatePack(p,registry);
});
test('another character using an owned tic warns, without substring false positives',()=>{
 const p=fixture(),c=context(p);assert.ok(lintScene({lines:[{speaker:'ada',text:'Fair winds. I have the plan.'}]},c,p).some(w=>w.check==='speech-owner'));
 for(const text of ['Precisely. I have the plan.','Unfair windstorm.'])assert.ok(!lintScene({lines:[{speaker:'ada',text}]},c,p).some(w=>w.check==='speech-owner'));
});
test('question cadence counts reply endings, warns on cloud, and repairs once locally; check-ins remain possible',()=>{
 const p=fixture(),c={...context(p),sceneHistory:[{text:'Ada: Which project?\nShe opens the folder.'},{text:'Ada: I have the plans.'}]},value={lines:[{speaker:'ada',text:'Where do you want to start?'},{speaker:'',text:'She points at the plans.'}]};
 assert.ok(lintScene(value,c,p,{lenient:true}).some(w=>w.check==='question-ending'));assert.throws(()=>lintScene(value,c,p),e=>e.lintCheck==='question-ending'&&e.soft);
 assert.ok(!lintScene(value,{...c,first:{required:true}},p).some(w=>w.check==='question-ending'));
 assert.ok(!lintScene({lines:[{speaker:'ada',text:'Want a look? I have a new plan.'}]},c,p).some(w=>w.check==='question-ending'));
});
test('every writer and mode supplies hooks instead of interviewing and preserves first conversation modes',()=>{
 const p=fixture();for(const sceneWriter of ['framework','venus'])for(const conversationStyle of ['continuous','authored'])for(const scenePhase of ['opening','continuation']){
  const c={...context(p),gameProject:{conversationStyle},sceneWriter,scenePhase,first:{title:'A moment',checkpoint:'reading',cue:'She pauses.'}},[sys]=scenePromptMessages(c,p);
  assert.doesNotMatch(sys.content,/End with a specific question or offer|never announce plans to leave|never walk out mid-beat|no entrances, departures|Do not invent player dialogue/);assert.match(sys.content,/question at most one reply in three/);assert.match(sys.content,/reason or a next-time/);assert.match(sys.content,/opportunity within the ongoing conversation/);assert.match(sys.content,/consent, promises, travel and spending require/);
  if(conversationStyle==='continuous')assert.match(sys.content,/Write one connected reply/);
 }
 const c={...context(p),first:{checkpoint:'reading'},baseDirection:'Old direction.',direction:'Old direction. Authored tail.',calmDirection:'Calm direction.'};assert.match(calmContinuationMessages(c,p)[1].content,/Calm direction\. Authored tail\./);
});
test('runtime allows reactions and requested action while unchosen decisions stay guarded',async()=>{
 const p=fixture(),lines=[{speaker:'',text:'Your heart pounds as you smile at the plans.'},{speaker:'ada',text:'Precisely. That is the part I wanted to show you.'}],c=context(p);
 assert.deepEqual(dropStock(lines,[],{allowPlayerReactions:true}),lines);assert.deepEqual(lintScene({lines},c,p),[]);
 for(const text of ['You accept the invitation.','You consent to go further.','You promise to return.','You buy the notebook.','You travel to the meeting.'])assert.throws(()=>lintScene({lines:[{speaker:'',text}]},c,p,{lenient:true}),e=>e.lintCheck==='player-decisions');
 const provider=new CompatibleProvider({endpoint:'https://example.test/v1/chat/completions',model:'mock',fetchImpl:async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({lines})}}]}))}),lab=createLab({pack:p,registry,npcId:'ada',provider});
 try{const row=await lab.turn('I smile at the plans.');assert.ok(row.lines.some(l=>/Your heart pounds/.test(l.text)));assert.equal(row.refusal,null);assert.equal(provider.requests,1);}finally{lab.store.close();}
});
test('NPC exit with a hook produces a normal replayable scene-end event in both conversation modes',async()=>{
 for(const mode of ['continuous','authored']){const p=fixture();p.gameProject.conversationStyle=mode;class Exit extends MockProvider{async generateScene(){return {lines:[{speaker:'ada',text:'I need to get back to work. Bring your sketches next time.'}],end_scene:true,summary:'Ada returned to work after inviting another conversation.'};}}
  const lab=createLab({pack:p,registry,npcId:'ada',provider:new Exit(),seed:42});const initial=structuredClone(lab.world);
  try{const row=await lab.turn('Tell me about your project.');assert.equal(lab.world.scene,null);assert.ok(row.events.some(e=>e.type==='core.sceneEnded'));assert.equal(row.refusal,null);assert.deepEqual(replay(initial,lab.world.events).modules,lab.world.modules);assert.equal(lab.world.actors.player.location,initial.actors.player.location);}finally{lab.store.close();}
 }
});
test('an active first retains calm service direction and connected conversation',async()=>{
 const p=JSON.parse(readFileSync(new URL('../packs/campus.json',import.meta.url)));p.modules['social.firsts']='0.1.0';p.gameProject.conversationStyle='continuous';p.scriptedScenes=[];p.gallery=[];p.schedules=[];p.firsts=[{id:'jana-kiss',character:'jana',rung:'kiss',title:'A moment',opening:'She pauses.',trigger:{event:'core.sceneStarted',match:{location:'apartment'}},checkpoints:['reading','leaning-in','after'].map(id=>({id,cue:'She pauses beside you.'}))}];
 const seen=[];class First extends MockProvider{async generateScene(c){seen.push(structuredClone(c));return {lines:[{speaker:'jana',text:seen.length===1?'I have something on my mind.':'I was thinking about the project.'}]};}}
 const lab=createLab({pack:p,registry,npcId:'jana',provider:new First(),seed:42});
 try{await lab.turn('Hello Jana.');assert.ok(lab.world.modules['social.firsts'].active);await lab.turn('Tell me more.');assert.ok(seen[1].first);assert.equal(seen[1].continuationStyle,'calm');assert.match(scenePromptMessages(seen[1],p)[0].content,/Write one connected reply/);assert.match(seen[1].direction,/one connected reply mostly in direct dialogue/);assert.ok(!lab.world.flags['jana-kissed']);}finally{lab.store.close();}
});
