import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {galleryOf} from '../public/gallery.mjs';
import {intimacyEligibility} from '../packages/modules/intimacy.mjs';

// M0.6 ladder of firsts: talk -> date -> kiss -> night, per love interest, fired by the engine's own milestones.
const pack=()=>JSON.parse(readFileSync(new URL('../packs/campus.json',import.meta.url)));
const HEROINES=['jana','monique','nova','abigail'],RUNGS=['talk','date','kiss','night'],STRICT='monique';
// Both stand in the apartment, everyone else out of it, before every command: schedules move her, and these tests are about the ladder, not finding her.
const run=(p,c)=>{let state=createWorld(p,registry,`ladder-${c}`),n=0;const edit=f=>{state=structuredClone(state);f(state);};
 const act=(type,args={})=>{edit(s=>{for(const [id,a] of Object.entries(s.actors))a.location=id===p.playerId||id===c?'apartment':a.location==='apartment'?'langley':a.location;});const r=execute(state,{id:`${c}-${n++}`,actorId:p.playerId,type,args,expectedRevision:state.revision},p,registry);assert.ok(r.turn.events.length<120,`${type} emitted ${r.turn.events.length} events`);state=r.state;return r;};
 return {act,edit,get state(){return state;},get scenes(){return state.modules['story.scenes'];}};};
const liked=(p,c)=>p.actProfiles.find(x=>x.character===c).entries.filter(x=>x.points>0);
const chemistry=(g,c,v)=>g.edit(s=>{s.modules['social.dating'].characters[c].chemistry=v;});
const choose=(g,c,rung,choice)=>g.act('story.choose',{scene:`${c}-${rung}`,choice});
const bed=(g,c)=>{g.act('social.requestIntimacy',{character:c,category:'first-night'});return g.act('social.beginIntimacy',{character:c,category:'first-night'});};
// Scenes with a different liked act each (repeats are worth less) until the first tempo rank lands; returns how many scenes it took.
const warmUp=(g,p,c)=>{const es=liked(p,c);for(let i=1;i<=6;i++){const e=es[(i-1)%es.length];g.act('core.scene',{text:'Hey',location:'apartment',characters:[c],activity:'talk'});g.act('social.priceActs',{character:c,sceneId:g.state.scene.id,private:true,acts:[{kind:e.kind,target:e.target,size:'medium'}]});if(g.scenes.pending)return i;g.act('core.endScene');if(g.scenes.pending)return i;}return 0;};

test('each love interest has four firsts that climb in order and belong to her gallery route',()=>{
 const p=pack();for(const c of HEROINES){const ids=RUNGS.map(r=>`${c}-${r}`),scenes=ids.map(id=>p.scriptedScenes.find(x=>x.id===id));assert.ok(scenes.every(Boolean),c);
  assert.deepEqual(scenes.map(x=>x.trigger.event),['social.romanceRankChanged','social.dateAccepted','social.datingPhaseChanged','social.intimacyStarted']);
  const g=galleryOf(createWorld(p,registry,'g'),p).find(r=>r.route===c);assert.deepEqual(g.scenes.map(x=>x.id).filter(id=>ids.includes(id)),ids);assert.equal(g.seen,0);}
 assert.equal(p.intimacySettings.contentLevel,'explicit');assert.ok(p.modules['story.scenes']);
 for(const x of p.intimacyProfiles)assert.deepEqual(x.requirements.phases,x.character===STRICT?['exclusive']:['dating','exclusive'],`${x.character}: only ${STRICT} waits for the kiss`);
});

test('every first-night beat lets you stop, and stopping withdraws consent without burning the scene',()=>{
 const p=pack();for(const c of HEROINES){const x=p.scriptedScenes.find(s=>s.id===`${c}-night`);assert.ok(x.repeatable);
  for(const b of [x,...x.beats]){const stop=b.choices.find(ch=>ch.id==='stop');assert.ok(stop,`${c} ${b.id||'opening'}`);assert.ok(!stop.next,'stopping ends the scene');assert.ok(stop.effects.some(e=>e.type==='intimacyConsent'&&e.status==='withdrawn'));}}
});

for(const c of HEROINES)test(`${c}: talk and date, then kiss and first night in her order, and stopping replays the night`,()=>{
 const p=pack(),g=run(p,c);
 const took=warmUp(g,p,c);assert.ok(took&&took<=4,'the first real talk lands within four scenes');assert.equal(g.scenes.pending,`${c}-talk`);choose(g,c,'talk',p.scriptedScenes.find(x=>x.id===`${c}-talk`).choices[0].id);
 if(g.state.scene)g.act('core.endScene');assert.equal(g.scenes.pending,null);
 const notYet=()=>intimacyEligibility(g.state,p,c,'first-night').reasons;assert.ok(notYet().some(x=>/phase/.test(x)),'no first night before the kiss');
 chemistry(g,c,60);g.act('social.askDate',{character:c});assert.equal(g.scenes.pending,`${c}-date`);choose(g,c,'date',p.scriptedScenes.find(x=>x.id===`${c}-date`).choices[0].id);
 const kiss=()=>{chemistry(g,c,90);g.act('social.defineRelationship',{character:c,agreement:'monogamous'});assert.equal(g.scenes.pending,`${c}-kiss`);choose(g,c,'kiss',p.scriptedScenes.find(x=>x.id===`${c}-kiss`).choices[0].id);};
 if(c===STRICT){assert.ok(notYet().some(x=>/phase dating/.test(x)),'a date is not enough for her');assert.throws(()=>bed(g,c));kiss();}else assert.ok(!notYet().some(x=>/phase/.test(x)),'the open three are willing once you are dating');
 bed(g,c);assert.equal(g.scenes.pending,`${c}-night`);choose(g,c,'night',p.scriptedScenes.find(x=>x.id===`${c}-night`).choices[0].id);assert.equal(g.scenes.pendingBeat,'check-in');
 choose(g,c,'night','stop');assert.equal(g.scenes.pending,null);assert.equal(g.state.modules['social.intimacy'].characters[c].active,null);assert.ok(!g.state.flags[`${c}-first-night`]);
 g.edit(s=>{s.modules['social.intimacy'].characters[c].cooldownUntil=0;});g.act('core.wait');bed(g,c);assert.equal(g.scenes.pending,`${c}-night`,'a stopped first night can happen later');
 const night=p.scriptedScenes.find(x=>x.id===`${c}-night`);for(const ch of [night.choices[0].id,'yes',night.beats.find(b=>b.id==='peak').choices[0].id])choose(g,c,'night',ch);
 assert.equal(g.scenes.pending,null);assert.ok(g.state.flags[`${c}-first-night`]);assert.ok(g.state.modules['social.intimacy'].characters[c].encounters.length);
 if(c!==STRICT)kiss();
 const route=galleryOf(g.state,p).find(r=>r.route===c);assert.deepEqual(route.scenes.filter(x=>x.unlocked).map(x=>x.id),RUNGS.map(r=>`${c}-${r}`));
 g.edit(s=>{s.modules['social.intimacy'].characters[c].cooldownUntil=0;s.modules['social.intimacy'].characters[c].consent={};});bed(g,c);assert.equal(g.scenes.pending,null,'after the first time, nights are free text');
});

test('a drunk partner defers the first night instead of starting it',()=>{
 const p=pack(),g=run(p,'jana');chemistry(g,'jana',90);g.edit(s=>{s.modules['social.dating'].characters.jana.phase='exclusive';s.modules['social.dating'].characters.jana.agreement='monogamous';s.modules['social.dating'].characters.jana.satisfaction=20;s.modules['social.dating'].characters.jana.score=90;s.modules['character.sobriety']={...s.modules['character.sobriety'],characters:{...s.modules['character.sobriety']?.characters,jana:{drinks:5}}};});
 const r=g.act('social.requestIntimacy',{character:'jana',category:'first-night'});assert.ok(!r.turn.events.some(e=>e.type==='social.intimacyStarted'));assert.equal(g.scenes.pending,null);
});

// M0.7 goal line: the hub names her next first and what gates it, with no numbers, and follows her order up the ladder.
test('the goal line walks each heroine up her ladder in her order, never showing a number',async()=>{
 const {goals}=await import('../public/campus.mjs');const p=pack();
 for(const c of HEROINES){const g=run(p,c),line=()=>goals(g.state,p).find(x=>x.character===c),seen=[];const note=()=>{const l=line();assert.doesNotMatch(l.text,/\d/,l.text);seen.push(l.next);};
  note();assert.match(line().why,/trust/);warmUp(g,p,c);choose(g,c,'talk',p.scriptedScenes.find(x=>x.id===`${c}-talk`).choices[0].id);if(g.state.scene)g.act('core.endScene');
  note();assert.match(line().why,/more into you/);chemistry(g,c,60);g.act('core.wait');assert.match(line().why,/Ask her out/);
  g.act('social.askDate',{character:c});choose(g,c,'date',p.scriptedScenes.find(x=>x.id===`${c}-date`).choices[0].id);note();
  const kiss=()=>{chemistry(g,c,90);g.act('core.wait');assert.match(line().why,/official/);g.act('social.defineRelationship',{character:c,agreement:'monogamous'});choose(g,c,'kiss',p.scriptedScenes.find(x=>x.id===`${c}-kiss`).choices[0].id);note();};
  const night=()=>{assert.match(line().why,/moment/);bed(g,c);const n=p.scriptedScenes.find(x=>x.id===`${c}-night`);for(const ch of [n.choices[0].id,'yes',n.beats.find(b=>b.id==='peak').choices[0].id])choose(g,c,'night',ch);note();};
  if(c===STRICT){kiss();night();}else{night();kiss();}
  assert.deepEqual(seen,['a real talk','a date',...(c===STRICT?['a kiss','a night together']:['a night together','a kiss']),'You are together. Keep it that way.'],c);}
});
