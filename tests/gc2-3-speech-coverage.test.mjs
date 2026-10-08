import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute,clone} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {Store,validateImport} from '../packages/persistence/store.mjs';
import {GameService} from '../packages/ai/service.mjs';

// GC2.3: ordinary speech in scene openings and continuations reaches the existing social rules once per event.
// Todo entries are behaviour the spec asks for that production does not yet do; they stay visible, never weakened.
const neutral=JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)));
function pack(extra={}){const p=clone(neutral);delete p.modules['world.schedule'];delete p.schedules;p.actors.find(a=>a.id==='brin').location='hub';Object.assign(p,extra);return p;}
function harness(p){let s=createWorld(p,registry,'gc2-3');return {get state(){return s;},act(type,args={}){const r=execute(s,{id:`t${s.revision}`,actorId:p.playerId,type,args,expectedRevision:s.revision},p,registry);s=r.state;return r;}};}
const trust=(h,id='ada')=>h.state.modules['social.relationships'].edges[`${id}--player`]||0;
const scene=(h,args)=>h.act('core.scene',{location:'hub',activity:'talk',...args});
const spokeOf=r=>r.turn.events.filter(e=>e.type==='social.spoke');
const LATHE='I finally fixed the stubborn lathe in the workshop';

test('one-to-one opening speech is spoken once, pays Trust once and is visible only to the speaker and listener',()=>{
 const h=harness(pack()),ada=trust(h),brin=trust(h,'brin');
 const r=scene(h,{characters:['ada'],text:LATHE});
 const spoke=spokeOf(r);
 assert.equal(spoke.length,1);
 assert.equal(spoke[0].payload.source,'scene');
 assert.equal(spoke[0].payload.utterance,LATHE);
 assert.deepEqual(spoke[0].visibility,['player','ada']);
 assert.equal(trust(h)-ada,1,'one fresh substantive line pays one point');
 assert.equal(trust(h,'brin'),brin,'a bystander in the room is not touched');
 const memories=h.state.modules['social.conversation'].memories;
 assert.deepEqual(memories.at(-1).knownBy,['player','ada']);
 assert.equal(memories.filter(m=>m.knownBy.includes('brin')).length,0,'brin does not learn what was said to ada');
});

test('a greeting opening is recorded as what was said but pays no Trust, and a greeting follow-up does not pay either',()=>{
 const h=harness(pack());const r=scene(h,{characters:['ada'],text:'Hi'});
 assert.equal(spokeOf(r)[0].payload.utterance,'Hi');
 assert.equal(trust(h),0,'hi is generic talk');
 const again=h.act('core.scene',{location:'hub',activity:'continue',characters:['ada'],text:'Hi again'});
 assert.ok(!again.turn.events.some(e=>e.type==='social.relationshipChanged'),'a greeting continuation changes no Trust');
 assert.equal(trust(h),0);
});

test('re-opening with a line already said to the same person in an earlier scene pays nothing',()=>{
 const h=harness(pack());scene(h,{characters:['ada'],text:LATHE});const after=trust(h);
 scene(h,{characters:['ada'],text:LATHE});
 assert.equal(trust(h),after,'the same story again pays nothing, even in a new scene');
});

test('a non-talk activity that names a reaction phrase is not speech and pays no reaction',()=>{
 const p=pack({dialogueReactions:[{id:'pride',phrases:['proud of you'],trustDelta:3}]});const h=harness(p);const before=trust(h);
 const r=h.act('core.scene',{location:'hub',activity:'work',characters:['ada'],text:'I work while telling myself I am proud of you.'});
 assert.ok(!spokeOf(r).length,'no spoken line is recorded for work');
 assert.equal(trust(h),before);
 assert.equal(h.state.modules['social.relationships'].reactions['ada--pride'],undefined);
});

test('self-led clear speech ("I tell her: ...") speaks only the quoted words and pays once',()=>{
 const h=harness(pack());const before=trust(h);
 const r=scene(h,{characters:['ada'],text:'I tell her: "I finally fixed the stubborn lathe in the workshop."'});
 assert.equal(spokeOf(r)[0].payload.utterance,'I finally fixed the stubborn lathe in the workshop.');
 assert.equal(trust(h)-before,1);
});

test('a hypothetical opening is recorded as the words said, not stripped or narrated as a fact',()=>{
 const line='What if I told you I was proud of you?';const h=harness(pack());
 const r=scene(h,{characters:['ada'],text:line});
 assert.equal(spokeOf(r)[0].payload.utterance,line);
});

test('in a group continuation each NPC hears each matching rule once: a scoped rule reaches only its character',()=>{
 const p=pack({dialogueReactions:[{id:'pride',character:'ada',phrases:['proud of you'],trustDelta:3},{id:'thanks',phrases:['well done'],trustDelta:2}]});
 const h=harness(p);scene(h,{characters:['ada','brin'],text:'Hello both of you.'});
 const a0=trust(h,'ada'),b0=trust(h,'brin');
 const r=h.act('core.scene',{location:'hub',activity:'continue',characters:['ada','brin'],text:'I am proud of you. Well done.'});
 assert.equal(trust(h,'ada')-a0,5,'ada hears both rules, once each');
 assert.equal(trust(h,'brin')-b0,2,'brin hears only the shared rule');
 const changes=r.turn.events.filter(e=>e.type==='social.relationshipChanged').map(e=>`${e.payload.actor}:${e.payload.reaction}`).sort();
 assert.deepEqual(changes,['ada:pride','ada:thanks','brin:thanks']);
});

test('one opening line that matches a reaction phrase emits one reaction beside the talk gain',()=>{
 const p=pack({dialogueReactions:[{id:'pride',phrases:['proud of you'],trustDelta:3}]});const h=harness(p);const before=trust(h);
 const r=scene(h,{characters:['ada'],text:'I finally fixed the lathe and I am proud of you for helping.'});
 assert.equal(r.turn.events.filter(e=>e.type==='social.relationshipChanged'&&e.payload.reaction==='pride').length,1,'the scene opening and the spoken line share one reaction');
 assert.equal(trust(h)-before,4,'one talk gain (1) plus one reaction (3)');
 assert.equal(h.state.modules['social.relationships'].reactions['ada--pride'].count,1);
});

test('a button-chosen line that matches a reaction phrase pays the reaction once',()=>{
 const p=pack({dialogueReactions:[{id:'pride',phrases:['proud of you'],trustDelta:3}]});const h=harness(p);const before=trust(h);
 const r=h.act('social.speak',{target:'ada',text:`${LATHE} and I am proud of you.`});
 assert.equal(r.turn.events.filter(e=>e.type==='social.relationshipChanged'&&e.payload.reaction==='pride').length,1);
 assert.equal(trust(h)-before,4);
});

test('a typed follow-up with "her" resolves to the one person in a one-to-one conversation without asking who is meant',async()=>{
 const p=pack();const provider={name:'probe',async interpretScene(){return {characters:['ada'],location:'hub',activity:'talk'};},async generateScene(){return {lines:[{speaker:'ada',text:'Mm.'}]};}};
 const store=new Store();store.insert(createWorld(p,registry,'one'));const service=new GameService(store,{[p.id]:p},registry,provider);
 try{
  let r=await service.act('one',{id:'0',expectedRevision:0,input:'I walk over and greet Ada about her week.'});
  r=await service.act('one',{id:'1',expectedRevision:r.state.revision,input:'I tell her I finally fixed the stubborn lathe in the workshop.'});
  assert.ok(!r.clarification,r.clarification);
  assert.deepEqual(r.state.scene.characters,['ada']);
 }finally{store.close();}
});

test('GC2.3: a typed follow-up in an open scene earns the one fresh-talk Trust point and a social.spoke line',async()=>{
 // The opening is a gesture ("I walk over...") so it pays nothing and the day's talk point is still free for the follow-up.
 const p=pack();const provider={name:'probe',async interpretScene(){return {characters:['ada'],location:'hub',activity:'talk'};},async generateScene(){return {lines:[{speaker:'ada',text:'Mm.'}]};}};
 const store=new Store();store.insert(createWorld(p,registry,'follow'));const service=new GameService(store,{[p.id]:p},registry,provider);
 try{
  let r=await service.act('follow',{id:'0',expectedRevision:0,input:'I walk over and greet Ada about her week.'});
  const before=r.state.modules['social.relationships'].edges['ada--player']||0;
  r=await service.act('follow',{id:'1',expectedRevision:r.state.revision,input:'I tell her I finally fixed the stubborn lathe in the workshop.'});
  assert.equal((r.state.modules['social.relationships'].edges['ada--player']||0)-before,1,'a fresh substantive follow-up pays one point, the same as a fresh opening');
  assert.equal(Object.values(r.state.turns).at(-1).events.filter(e=>e.type==='social.spoke').length,1);
 }finally{store.close();}
});

test('GC2.3: an action-only continuation that narrates a reaction phrase pays nothing',()=>{
 const p=pack({dialogueReactions:[{id:'thanks',phrases:['thank you'],trustDelta:3}]});const h=harness(p);
 scene(h,{characters:['ada'],text:'Hello there friend'});const before=trust(h);
 h.act('core.scene',{location:'hub',activity:'continue',characters:['ada'],text:'*I quietly nod and mouth thank you to her.*'});
 assert.equal(trust(h)-before,0,'a gesture is not speech');
});

test('GC2.3: a group opening with a shared reaction phrase reaches each NPC present, as a group continuation does',()=>{
 const p=pack({dialogueReactions:[{id:'thanks',phrases:['thank you'],trustDelta:3}]});const h=harness(p);
 const a0=trust(h,'ada'),b0=trust(h,'brin');
 scene(h,{characters:['ada','brin'],text:'Thank you both for coming.'});
 assert.equal(trust(h,'ada')-a0,3);
 assert.equal(trust(h,'brin')-b0,3);
});

test('GC2.3: a repeated opening line is flagged as a repeat on the scene path, as the button path flags it',()=>{
 const h=harness(pack());scene(h,{characters:['ada'],text:LATHE});
 const r=scene(h,{characters:['ada'],text:LATHE});
 assert.equal(spokeOf(r)[0].payload.repeat,true);
});

test('GC2.3: a hypothetical wish pays the reaction for the praise it names, as the speech rule does for any spoken line',()=>{
 // Owner decision 2: a hypothetical wish SHOULD pay; sincere speech behaviour is unchanged.
 const p=pack({dialogueReactions:[{id:'pride',phrases:['proud of you'],trustDelta:3}]});const h=harness(p);const before=trust(h);
 scene(h,{characters:['ada'],text:'What if I told you I was proud of you?'});
 assert.equal(h.state.modules['social.relationships'].reactions['ada--pride'].count,1);
 assert.equal(trust(h)-before,3,'the reaction (3) only: the wish has too few content words to count as a substantive talk point');
});

test('GC2.3: a pre-v3 save (no marker on openings, v2 markers on continuations) replays with identical events under its own rules',()=>{
 const fx=JSON.parse(readFileSync(new URL('./fixtures/gc2-3-speech-v2-save.json',import.meta.url)));
 const old=validateImport(structuredClone(fx.portable),fx.pack,registry);
 assert.deepEqual(old.events,fx.portable.state.events);
 assert.equal(old.events.filter(e=>e.type==='social.sceneDialogueRules'&&e.payload.version===2).length,fx.portable.state.events.filter(e=>e.type==='social.sceneDialogueRules').length);
});

test('GC2.3: a v3 opening writes the sceneDialogueRules marker at version 3, which replays under the v3 rules',()=>{
 const h=harness(pack());const r=scene(h,{characters:['ada'],text:LATHE});
 const marker=r.turn.events.find(e=>e.type==='social.sceneDialogueRules');
 assert.equal(marker.payload.version,3);
});
