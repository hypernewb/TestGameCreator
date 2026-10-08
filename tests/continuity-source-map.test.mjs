import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,execute} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {prepareSceneRequest} from '../packages/ai/service.mjs';
import {memorySnapshot,applyMemoryEdit} from '../packages/ai/memory-controls.mjs';
import {capturedStatements,sceneMemoryId} from '../packages/ai/memory.mjs';
// GC7.1 continuity source map: one marker per source, asserted against the built scene prompt as it is today.
// Rows marked GAP are pinned to current behaviour; flip the assertion when the gap is fixed.
const pack=()=>({schemaVersion:1,id:'source-map',title:'Source map fixture',version:'0.1.0',playerId:'player',modules:{'social.conversation':'0.1.0','social.relationships':'0.1.0','story.facts':'0.1.0','story.scenes':'0.1.0'},locations:[{id:'room',name:'Room',exits:[{to:'away'}]},{id:'away',name:'Away',exits:[{to:'room'}]}],actors:[{id:'player',name:'Player',location:'room',description:'PLAYER-DESC-MARK wears a grey coat.'},{id:'owner',name:'Owner',location:'room',personality:'Patient and precise.',goal:'Organize the archive.'},{id:'bystander',name:'Bystander',location:'away'}],facts:[{id:'auth-owner',text:'Owner keeps the archive key in a blue tin.',knownBy:'public'},{id:'auth-cellar',text:'Lantern oil is stored in the cellar.',knownBy:'public'},{id:'auth-private',text:'AUTH-PRIVATE: Bystander hides a sealed letter.',knownBy:['bystander']}],lorebook:[{id:'lore-world',text:'LORE-MARK: Brass lamps are lit at dusk.',knownBy:'public',scope:'world'},{id:'lore-private',text:'LORE-PRIVATE: The bystander forged the seal.',knownBy:['bystander'],scope:'world'}],scriptedScenes:[]});
const say=(s,p,id,text,narrative)=>{const t=execute(s,{id,actorId:'player',expectedRevision:s.revision,type:'core.scene',args:{characters:['owner'],location:'room',activity:'talk',text}},p,registry);t.turn.status='complete';t.turn.narrative=narrative;return t.state;};
// core.scene opens a new scene; social.speak continues the open one, which is what the scene transcript reads.
const speak=(s,p,id,text,narrative)=>{const t=execute(s,{id,actorId:'player',expectedRevision:s.revision,type:'social.speak',args:{target:'owner',text}},p,registry);t.turn.status='complete';t.turn.narrative=narrative;return t.state;};
function world(){
 const p=pack();let s=createWorld(p,registry,'source-map');
 s=say(s,p,'old','My favorite color is amber','Owner checks the archive timetable.');
 s=speak(s,p,'old2','I promise to bring the blue ribbon tomorrow','Owner nods at the promise.');
 s.turns.old.generatedFacts=[{id:'old.fact-0',subject:'owner',text:'Owner opens the archive at sunset.',quote:'archive timetable',source:'old',knownBy:['player','owner']},{id:'old.fact-1',subject:'bystander',text:'The bystander hides a private archive receipt.',quote:'archive timetable',source:'old',knownBy:['bystander']}];
 s.turns.old.ledger=[{charKey:'owner',type:'liked',desc:'Player keeps promises about the archive.'},{charKey:'owner',type:'liked',desc:'enjoys sharing habits about tea.'}];
 s.modules['story.scenes'].memories=[{scene:'same',text:'Owner recalled SCENE-MARK message.',knownBy:'public'},{scene:'same',text:'SCENE-PRIVATE bystander kept a copy.',knownBy:['bystander']}];
 s.modules['story.scenes'].plans=[{id:'plan-1',character:'owner',plan:'Owner plans PLAN-MARK for the gate.',deadlineTick:s.tick+50,status:'pending',visibility:'public'}];
 return {p,s};
}
async function probe(s,p,text){
 const t=execute(s,{id:'probe',actorId:'player',expectedRevision:s.revision,type:'core.scene',args:{characters:['owner'],location:'room',activity:'talk',text}},p,registry);
 const a=await prepareSceneRequest(t.state,p,t.turn,{contextWindow:8192,maxTokens:512});
 return {a,prompt:a.messages.map(m=>m.content).join('\n')};
}

test('authored facts: public facts that name the cast reach KNOWN; private facts never do',async()=>{
 const {p,s}=world(),{a,prompt}=await probe(s,p,'Owner archive notes');
 assert.ok(prompt.includes('Owner keeps the archive key in a blue tin.'));
 assert.ok(!prompt.includes('AUTH-PRIVATE'));
 assert.ok(!a.context.facts.some(f=>f.id==='auth-private'));
});

test('authored fact that names no cast member and shares fewer than two query words is not selected, so it never reaches KNOWN (G2: selection before budgeting)',async()=>{
 const {p,s}=world(),{a,prompt}=await probe(s,p,'Owner archive notes');
 assert.ok(!a.context.facts.some(f=>f.id==='auth-cellar'));
 assert.ok(!prompt.includes('Lantern oil is stored in the cellar.'));
});

test('generated facts: subject-known facts reach KNOWN; facts private to another character do not',async()=>{
 const {p,s}=world(),{prompt}=await probe(s,p,'Owner archive notes');
 assert.ok(prompt.includes('Owner opens the archive at sunset.'));
 assert.ok(!prompt.includes('private archive receipt'));
});

test('lore: public world entries reach LORE; entries private to another character do not',async()=>{
 const {p,s}=world(),{prompt}=await probe(s,p,'Owner archive notes');
 assert.ok(prompt.includes('LORE-MARK'));
 assert.ok(!prompt.includes('LORE-PRIVATE'));
});

test('player disclosures reach REMEMBERED; promises also reach LOOSE ENDS through openThreads',async()=>{
 const {p,s}=world(),{a,prompt}=await probe(s,p,'Owner archive notes');
 assert.ok(prompt.includes('amber'));
 assert.ok(prompt.includes('blue ribbon'));
 assert.ok(a.context.openThreads.some(t=>t.kind==='promise'&&/blue ribbon/.test(t.text)));
});

test('plans reach LOOSE ENDS through openThreads',async()=>{
 const {p,s}=world(),{a,prompt}=await probe(s,p,'Owner archive notes');
 assert.ok(a.context.openThreads.some(t=>t.kind==='plan'&&/PLAN-MARK/.test(t.text)));
 assert.ok(prompt.includes('PLAN-MARK'));
});

test('scene memories: public ones reach REMEMBERED; private ones never do',async()=>{
 const {p,s}=world(),{prompt}=await probe(s,p,'Owner archive notes');
 assert.ok(prompt.includes('SCENE-MARK'));
 assert.ok(!prompt.includes('SCENE-PRIVATE'));
});

test('impressions: only ones that name the player reach the prompt (intentional filter)',async()=>{
 const {p,s}=world(),{prompt}=await probe(s,p,'Owner archive notes');
 assert.ok(prompt.includes('keeps promises'));
 assert.ok(!prompt.includes('sharing habits'));
});

test('scene transcript: earlier turns of the same open scene reach SCENE SO FAR; a new scene starts it empty',async()=>{
 const {p,s}=world(),t=execute(s,{id:'probe',actorId:'player',expectedRevision:s.revision,type:'social.speak',args:{target:'owner',text:'Owner archive notes'}},p,registry);
 const a=await prepareSceneRequest(t.state,p,t.turn,{contextWindow:8192,maxTokens:512}),prompt=a.messages.map(m=>m.content).join('\n');
 assert.ok(a.context.sceneHistory.some(h=>h.source==='old2'));
 assert.ok(prompt.includes('Owner nods at the promise.'));
 const fresh=await probe(s,p,'Owner archive notes');
 assert.deepEqual(fresh.a.context.sceneHistory,[]);
});

test('GAP recentActions: computed from recent events but never rendered',async()=>{
 const {p,s}=world();s.events.push({id:'ev-recent',tick:s.tick,type:'story.note',visibility:'public',payload:{text:'RECENT-ACTION: the lantern grid moved.'}});
 const {a,prompt}=await probe(s,p,'Owner archive notes');
 assert.ok(a.context.recentActions.some(r=>/RECENT-ACTION/.test(r.text)));
 assert.ok(!prompt.includes('RECENT-ACTION'));
});

test('player block (G3): the player description is in the request context and in the scene prompt',async()=>{
 const {p,s}=world(),{a,prompt}=await probe(s,p,'Owner archive notes');
 assert.ok(a.context.player?.description.includes('PLAYER-DESC-MARK'));
 assert.ok(prompt.includes('PLAYER-DESC-MARK'));
});

test('corrections: a scene memory correction replaces the original and a statement retire removes it',async()=>{
 const {p,s}=world();let snap=memorySnapshot(s,p);
 applyMemoryEdit(s,p,{campaignId:s.campaignId,token:snap.token,type:'scene memory',recordId:sceneMemoryId(0),action:'correct',text:'Owner recalled CORRECTED-SCENE message.'});
 snap=memorySnapshot(s,p);applyMemoryEdit(s,p,{campaignId:s.campaignId,token:snap.token,type:'statement',recordId:capturedStatements(s,p).find(m=>/amber/.test(m.said)).id,action:'retire'});
 const {prompt}=await probe(s,p,'Owner archive notes');
 assert.ok(prompt.includes('CORRECTED-SCENE'));
 assert.ok(!prompt.includes('SCENE-MARK'));
 assert.ok(!prompt.includes('amber'));
});
