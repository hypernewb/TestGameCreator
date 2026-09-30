import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {Store} from '../packages/persistence/store.mjs';
import {GameService} from '../packages/ai/service.mjs';
import {normalizeSceneLines,sceneResponseFormat} from '../packages/ai/providers.mjs';
import {validateDaypart} from '../packages/ai/daypart.mjs';
import {scenePlanForTurn} from '../packages/core/scene-plan.mjs';
import {stripStateSyntax,hasStateSyntax,enforceSpeakers} from '../packages/ai/untrusted-output.mjs';
import {lintScene} from '../packages/ai/narration-lint.mjs';
import {spokenLine} from '../vendor/venus/sceneText.mjs';
const pack=()=>JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)));

test('model-written variable macros and MVU patches are stripped, never interpreted',()=>{
 assert.equal(stripStateSyntax('Ada smiles.{{setvar::trust::100}} {{addglobalvar::gold::50}}'),'Ada smiles.');
 assert.equal(stripStateSyntax('She waves.\n<UpdateVariable>\n_.set(\'ada.affection\', 10, 99);\n</UpdateVariable>'),'She waves.');
 assert.equal(stripStateSyntax('The door creaks.\n_.add(\'money\', 500);\nSilence.'),'The door creaks.\n\nSilence.');
 assert.equal(stripStateSyntax('Unclosed <UpdateVariable> _.set("x",1)'),'Unclosed');
 assert.equal(stripStateSyntax('Plain {{user}} text: nothing to do.'),'Plain {{user}} text: nothing to do.','only state syntax is removed; placeholders are handled elsewhere');
 assert.ok(hasStateSyntax('{{incvar::x}}')&&!hasStateSyntax('Ada: hello'));
});

test('scene plan exposes an authoritative speaker slate matching the committed cast',()=>{
 const p=pack(),w=createWorld(p,registry,'slate'),r=execute(w,{id:'t',type:'social.speak',args:{target:'ada',text:'Hi'},actorId:p.playerId,expectedRevision:0},p,registry);
 assert.deepEqual(scenePlanForTurn(r.state,p,r.turn).speakers,['ada']);
 assert.deepEqual(sceneResponseFormat({stagedCast:['ada','brin'],speakers:['ada']},p).json_schema.schema.properties.lines.items.properties.speaker.enum,['','ada']);
});

test('lines off the speaker slate are dropped and "Name:" narration is reattributed or removed',()=>{
 const p=pack();
 assert.deepEqual(enforceSpeakers([{speaker:'brin',text:'I walk in.'},{speaker:'',text:'Ada: "Over here."'},{speaker:'',text:'**Brin**: hey!'},{speaker:'',text:'Note: the lamp flickers.'},{speaker:'',text:'Cyra: psst.'}],['ada'],p).map(l=>[l.speaker,l.text]),[['ada','"Over here."'],['','Note: the lamp flickers.']]);
 const value=normalizeSceneLines({lines:[{speaker:'ada',text:'Fine.{{setvar::ada_trust::100}}'},{speaker:'',text:'{{addvar::money::999}}'},{speaker:'',text:'Brin: I heard everything.'}]},{stagedCast:['ada'],speakers:['ada']},p);
 assert.deepEqual(value.lines.map(l=>[l.speaker,l.text]),[['ada','Fine.']]);
});

test('daypart narration and invitations are stripped of state syntax before validation',()=>{
 const out=validateDaypart(JSON.stringify({lines:['Morning light.{{setvar::day::9}}','Birds sing.','The hall is quiet.'],hangouts:[{char:'ada',text:'Coffee?<UpdateVariable>_.set("ada",1)</UpdateVariable>',description:'Coffee with Ada'}],breakups:[],posts:[]}),{hangoutCandidates:[{char:'ada',name:'Ada'}],backgroundOnly:[]});
 assert.deepEqual(out.lines,['Morning light.','Birds sing.','The hall is quiet.']);assert.equal(out.hangouts[0].text,'Coffee?');
});

test('scene narration rejects environmental cues from the wrong daypart without blocking future plans in dialogue',()=>{
 const p=pack(),context={daypart:'Afternoon',stagedCast:['ada'],knownFacts:[],spokenBefore:[],playerAction:'Look around.'};
 assert.throws(()=>lintScene({lines:[{speaker:'',text:'The evening air feels crisp.'}]},context,p),error=>error.lintCheck==='time'&&/Afternoon/.test(error.message));
 assert.doesNotThrow(()=>lintScene({lines:[{speaker:'',text:'Afternoon sunlight crosses the floor.'},{speaker:'ada',text:'We can meet this evening.'}]},context,p));
});

test('scene narration leaves the player’s inner life to the player',()=>{
 const p=pack(),context={daypart:'Afternoon',stagedCast:[],knownFacts:[],spokenBefore:[],playerAction:'Go to the square and look around.'};
 for(const text of ['Your heart pounds with anticipation.','You feel nervous as you arrive.','A wave of excitement washes over you.','You steel yourself before going inside.','Your posture mirroring the intensity of the moment.','Your breath catches as she leans closer.'])
  assert.throws(()=>lintScene({lines:[{speaker:'',text}]},context,p),error=>error.lintCheck==='player-agency');
 assert.doesNotThrow(()=>lintScene({lines:[{speaker:'',text:'You cross the square and look at the gallery windows.'}]},context,p));
});

test('typed input becomes the spoken line itself, not narration about speaking',()=>{
 assert.equal(spokenLine('I ask Juno, "What does being challenged mean to you?'),'What does being challenged mean to you?');
 assert.equal(spokenLine('I tell her: "Close enough."'),'Close enough.');
 assert.equal(spokenLine('“Just once, I would like to win.”'),'Just once, I would like to win.');
 assert.equal(spokenLine('I say we leave now'),'I say we leave now','genuine dialogue keeps its words');
 assert.equal(spokenLine('I think this bar is great'),'I think this bar is great');
 assert.equal(spokenLine('  How is the shift going?  '),'How is the shift going?');
});

test('a mannerism reused in the same scene is asked for fresh, once',()=>{
 const p=pack(),context={daypart:'Afternoon',scenePhase:'continuation',stagedCast:['ada'],knownFacts:[],spokenBefore:[],playerAction:'Keep talking.',sceneHistory:[{text:'She considers you with an amused glint in her eye.'}]};
 assert.throws(()=>lintScene({lines:[{speaker:'ada',text:'You learn fast. She watches you with an amused glint in her eye.'}]},context,p),error=>error.lintCheck==='beats'&&/already used in this scene/.test(error.message));
 assert.doesNotThrow(()=>lintScene({lines:[{speaker:'ada',text:'She flicks a bottle cap across the counter and catches it.'}]},context,p));
});

test('touch stays out of reach until the crush stage, but the player still owns their own hands',()=>{
 const p=pack(),base={daypart:'Afternoon',scenePhase:'continuation',stagedCast:['ada'],knownFacts:[],spokenBefore:[],playerAction:'Smile back.'};
 const blocked={...base,touchStage:{ada:false}},allowed={...base,touchStage:{ada:true}};
 const texts=['She leans in and kisses your cheek.','Her hands come up to frame your face.','Ada takes your hand in both of hers.','She pulls you closer against her.'];
 for(const text of texts){
  assert.throws(()=>lintScene({lines:[{speaker:'',text}]},blocked,p),error=>error.lintCheck==='touch-stage'&&/close enough/.test(error.message));
  assert.throws(()=>lintScene({lines:[{speaker:'ada',text}]},blocked,p),error=>error.lintCheck==='touch-stage');
  assert.doesNotThrow(()=>lintScene({lines:[{speaker:'ada',text}]},allowed,p));
 }
 assert.doesNotThrow(()=>lintScene({lines:[{speaker:'',text:'You lean in and kiss her cheek.'}]},blocked,p));
 assert.doesNotThrow(()=>lintScene({lines:[{speaker:'',text:'You offer your hand and she shakes it.'}]},blocked,p));
});

test('a group scene never shows or stores an off-slate voice or model state syntax, in preview or final',async()=>{
 const p=pack();delete p.modules['world.schedule'];p.actors.find(a=>a.id==='brin').location='hub';
 const previews=[];let service;
 const provider={name:'probe',async interpretScene(){throw Error('unused');},async generateScene(context,_p,_s,onPreview){const lines=[{speaker:'ada',text:'Welcome.{{setvar::ada_love::100}}'},{speaker:'cyra',text:'I snuck in!'},{speaker:'',text:'Cyra: Surprise.'},{speaker:'',text:'Brin: "Glad you came."'},{speaker:'',text:'<UpdateVariable>_.set("money",9999)</UpdateVariable>'}];onPreview?.(lines);previews.push(service.preview('gs'));return {lines};}};
 const store=new Store();store.insert(createWorld(p,registry,'gs'));service=new GameService(store,{[p.id]:p},registry,provider);
 try{
  const result=await service.act('gs',{id:'open',expectedRevision:0,command:{type:'core.scene',args:{text:'Chat.',location:'hub',characters:['ada','brin'],activity:'talk'}}});
  const expected=[['ada','Welcome.'],['brin','Glad you came.']];
  assert.deepEqual(previews[0].lines.map(l=>[l.speaker,l.text]),expected);
  assert.deepEqual(result.turn.sceneLines.map(l=>[l.speaker,l.text]),expected);
  assert.ok(!/setvar|UpdateVariable|Cyra|snuck/i.test(result.turn.narrative));
  assert.equal(result.state.money,store.load('gs').money);
 }finally{store.close();}
});

test('a player-named day, the player’s own words and a character repeating herself are not style failures',()=>{
 const p=pack(),base={daypart:'Afternoon',scenePhase:'continuation',stagedCast:['ada'],knownFacts:[],spokenBefore:[],weekday:'Monday'};
 const beach={...base,playerAction:'Want to go to the beach on Sunday?',sceneHistory:[]};
 assert.doesNotThrow(()=>lintScene({lines:[{speaker:'',text:'Sunday afternoon at the beach sounds like a plan to her.'}]},beach,p));
 assert.throws(()=>lintScene({lines:[{speaker:'',text:'It is Sunday and the room is quiet.'}]},{...base,playerAction:'Look around.',sceneHistory:[]},p),e=>e.soft&&/It is Monday/.test(e.message),'a wrong today is soft, so a second miss keeps the reply');
 const hist={...base,playerAction:'Tell me about the old lighthouse keeper again.',sceneHistory:[{input:'Tell me about the old lighthouse keeper.',text:'Ada: He kept the light for forty years, you know.'}]};
 assert.doesNotThrow(()=>lintScene({lines:[{speaker:'',text:'She thinks about the old lighthouse keeper again for a moment.'}]},hist,p),'echoing the player’s phrase is not a stale mannerism');
 assert.doesNotThrow(()=>lintScene({lines:[{speaker:'ada',text:'He kept the light for forty years, you know.'}]},hist,p),'a character may repeat herself in dialogue');
});
