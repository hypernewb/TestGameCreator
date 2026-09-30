import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {galleryOf} from '../public/gallery.mjs';
import {intimacyEligibility} from '../packages/modules/intimacy.mjs';
import {FIRST_CHECKPOINTS,STOP_LABEL} from '../packages/cards/beat-library.mjs';

// M0.6 ladder of firsts: talk -> date -> kiss -> night, per love interest, fired by the engine's own milestones. Since O1 they are free-typed firsts.
const pack=()=>JSON.parse(readFileSync(new URL('../packs/campus.json',import.meta.url)));
const HEROINES=['jana','monique','nova','abigail'],RUNGS=['talk','date','kiss','night'],STRICT='monique';
// Both stand in the apartment, everyone else out of it, before every command: schedules move her, and these tests are about the ladder, not finding her.
const run=(p,c)=>{let state=createWorld(p,registry,`ladder-${c}`),n=0;const edit=f=>{state=structuredClone(state);f(state);};
 const act=(type,args={})=>{edit(s=>{for(const [id,a] of Object.entries(s.actors))a.location=id===p.playerId||id===c?'apartment':a.location==='apartment'?'langley':a.location;});const r=execute(state,{id:`${c}-${n++}`,actorId:p.playerId,type,args,expectedRevision:state.revision},p,registry);assert.ok(r.turn.events.length<120,`${type} emitted ${r.turn.events.length} events`);state=r.state;return r;};
 return {act,edit,n:0,get state(){return state;},get firsts(){return state.modules['social.firsts'];}};};
const liked=(p,c)=>p.actProfiles.find(x=>x.character===c).entries.filter(x=>x.points>0);
const chemistry=(g,c,v)=>g.edit(s=>{s.modules['social.dating'].characters[c].chemistry=v;});
const live=g=>g.firsts.active?.first||null;
// Plays the live first to the end the plain way: nothing tagged, so each checkpoint half-lands after its typed turns, and the check-in takes a yes.
const through=(g,id)=>{assert.equal(live(g),id);for(let i=0;i<12&&live(g);i++)g.act('social.scoreFirst',{source:`t${g.n++}`,text:'Yes.'});assert.equal(live(g),null);assert.ok(g.firsts.completed.includes(id),id);};
const execActions=(g,p)=>registry['social.firsts'].actions(g.state,p).map(x=>x.label);
const bed=(g,c)=>{g.act('social.requestIntimacy',{character:c,category:'first-night'});return g.act('social.beginIntimacy',{character:c,category:'first-night'});};
// Scenes with a different liked act each (repeats are worth less) until the first tempo rank lands; returns how many scenes it took.
const warmUp=(g,p,c)=>{const es=liked(p,c);for(let i=1;i<=6;i++){const e=es[(i-1)%es.length];g.act('core.scene',{text:'Hey',location:'apartment',characters:[c],activity:'talk'});g.act('social.priceActs',{character:c,sceneId:g.state.scene.id,private:true,acts:[{kind:e.kind,target:e.target,size:'medium'}]});if(live(g))return i;g.act('core.endScene');if(live(g))return i;}return 0;};

test('each love interest has four free-typed firsts that climb in order and belong to her gallery route',()=>{
 const p=pack();assert.ok(p.modules['social.firsts']);assert.deepEqual(p.scriptedScenes,[]);
 for(const c of HEROINES){const ids=RUNGS.map(r=>`${c}-${r}`),fs=ids.map(id=>p.firsts.find(x=>x.id===id));assert.ok(fs.every(Boolean),c);
  assert.deepEqual(fs.map(x=>x.trigger.event),['social.romanceRankChanged','social.dateAccepted','social.datingPhaseChanged','social.intimacyStarted']);
  for(const x of fs)assert.deepEqual(x.checkpoints.map(y=>y.id),FIRST_CHECKPOINTS[x.rung].map(y=>y.id),x.id);assert.ok(fs[3].interest,`${c}: the night teaches what she's into`);
  const g=galleryOf(createWorld(p,registry,'g'),p).find(r=>r.route===c);assert.deepEqual(g.scenes.map(x=>x.id).filter(id=>ids.includes(id)),ids);assert.equal(g.seen,0);}
 assert.equal(p.intimacySettings.contentLevel,'explicit');
 for(const x of p.intimacyProfiles)assert.deepEqual(x.requirements.phases,x.character===STRICT?['exclusive']:['dating','exclusive'],`${x.character}: only ${STRICT} waits for the kiss`);
});

test('every first night asks before it goes on: the check-in is required and she is into something you learn there',()=>{
 const p=pack();for(const c of HEROINES){const x=p.firsts.find(s=>s.id===`${c}-night`);assert.equal(x.rung,'night');
  const prof=p.intimacyProfiles.find(y=>y.character===c);assert.ok([...(prof.interests||[]),...(prof.stylePreferences||[]),...(prof.aftercarePreferences||[])].some(y=>y.id===x.interest),c);}
 assert.ok(FIRST_CHECKPOINTS.night.find(x=>x.id==='check-in').required);
});

for(const c of HEROINES)test(`${c}: talk and date, then kiss and first night in her order, and stopping replays the night`,()=>{
 const p=pack(),g=run(p,c),say=text=>g.act('social.scoreFirst',{source:`t${g.n++}`,text});
 const took=warmUp(g,p,c);assert.ok(took&&took<=4,'the first real talk lands within four scenes');through(g,`${c}-talk`);
 if(g.state.scene)g.act('core.endScene');assert.equal(live(g),null);assert.ok(g.state.flags[`${c}-talked`]);
 const notYet=()=>intimacyEligibility(g.state,p,c,'first-night').reasons;assert.ok(notYet().some(x=>/phase/.test(x)),'no first night before the kiss');
 chemistry(g,c,60);g.act('social.askDate',{character:c});through(g,`${c}-date`);
 const kiss=()=>{chemistry(g,c,90);g.act('social.defineRelationship',{character:c,agreement:'monogamous'});through(g,`${c}-kiss`);};
 if(c===STRICT){assert.ok(notYet().some(x=>/phase dating/.test(x)),'a date is not enough for her');assert.throws(()=>bed(g,c));kiss();}else assert.ok(!notYet().some(x=>/phase/.test(x)),'the open three are willing once you are dating');
 bed(g,c);assert.equal(live(g),`${c}-night`);assert.deepEqual(execActions(g,p),[STOP_LABEL],'while it is live, Stop is the only button');
 say('Yes.');say('Mm.');assert.equal(g.firsts.active.checkpoint,1,'at the check-in');say('Uh huh.');say('Hm.');assert.equal(g.firsts.active.checkpoint,1,'the check-in waits for an answer');
 say('Wait, stop.');assert.equal(live(g),null);assert.equal(g.state.modules['social.intimacy'].characters[c].active,null);assert.ok(!g.state.flags[`${c}-first-night`]);
 g.edit(s=>{s.modules['social.intimacy'].characters[c].cooldownUntil=0;});g.act('core.wait');bed(g,c);through(g,`${c}-night`);
 assert.ok(g.state.flags[`${c}-first-night`]);assert.ok(g.state.modules['social.intimacy'].characters[c].encounters.length);
 if(c!==STRICT)kiss();
 const route=galleryOf(g.state,p).find(r=>r.route===c);assert.deepEqual(route.scenes.filter(x=>x.unlocked).map(x=>x.id),RUNGS.map(r=>`${c}-${r}`));
 g.edit(s=>{s.modules['social.intimacy'].characters[c].cooldownUntil=0;s.modules['social.intimacy'].characters[c].consent={};});bed(g,c);assert.equal(live(g),null,'after the first time, nights are free text');
});

test('a drunk partner defers the first night instead of starting it',()=>{
 const p=pack(),g=run(p,'jana');chemistry(g,'jana',90);g.edit(s=>{s.modules['social.dating'].characters.jana.phase='exclusive';s.modules['social.dating'].characters.jana.agreement='monogamous';s.modules['social.dating'].characters.jana.satisfaction=20;s.modules['social.dating'].characters.jana.score=90;s.modules['character.sobriety']={...s.modules['character.sobriety'],characters:{...s.modules['character.sobriety']?.characters,jana:{drinks:5}}};});
 const r=g.act('social.requestIntimacy',{character:'jana',category:'first-night'});assert.ok(!r.turn.events.some(e=>e.type==='social.intimacyStarted'));assert.equal(live(g),null);
});

// M0.7 goal line: the hub names her next first and what gates it, with no numbers, and follows her order up the ladder.
test('the goal line walks each heroine up her ladder in her order, never showing a number',async()=>{
 const {goals}=await import('../public/campus.mjs');const p=pack();
 for(const c of HEROINES){const g=run(p,c),line=()=>goals(g.state,p).find(x=>x.character===c),seen=[];const note=()=>{const l=line();assert.doesNotMatch(l.text,/\d/,l.text);seen.push(l.next);};
  note();assert.match(line().why,/trust/);warmUp(g,p,c);through(g,`${c}-talk`);if(g.state.scene)g.act('core.endScene');
  note();assert.match(line().why,/more into you/);chemistry(g,c,60);g.act('core.wait');assert.match(line().why,/Ask her out/);
  g.act('social.askDate',{character:c});through(g,`${c}-date`);note();
  const kiss=()=>{chemistry(g,c,90);g.act('core.wait');assert.match(line().why,/official/);g.act('social.defineRelationship',{character:c,agreement:'monogamous'});through(g,`${c}-kiss`);note();};
  const night=()=>{assert.match(line().why,/moment/);bed(g,c);through(g,`${c}-night`);note();};
  if(c===STRICT){kiss();night();}else{night();kiss();}
  assert.deepEqual(seen,['a real talk','a date',...(c===STRICT?['a kiss','a night together']:['a night together','a kiss']),'You are together. Keep it that way.'],c);}
});
