import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute,validatePack} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {sceneVerdicts,knownActs} from '../packages/modules/acts.mjs';
import {stageOf,traitsOf} from '../packages/modules/arc.mjs';
import {calendarFor} from '../public/calendar.mjs';

const pack=()=>JSON.parse(readFileSync(new URL('../packs/campus.json',import.meta.url)));
const LI=['jana','monique','nova','abigail'];
const run=(p,id)=>{let state=createWorld(p,registry,id);const events=[];const act=(type,args={})=>{const r=execute(state,{id:`${id}-${state.revision}`,actorId:p.playerId,type,args,expectedRevision:state.revision},p,registry);state=r.state;events.push(...r.turn.events);return r;};return {act,events,get state(){return state;}};};
const doActivity=(g,p,id)=>{const a=p.activities.find(x=>x.id===id);return g.act('core.scene',{text:a.name,location:a.location,characters:a.character?[a.character]:[],activity:'other',activityId:a.id});};

test('Ashford validates, every actor is an adult, and each love interest has the full profile set',()=>{
 const p=pack();validatePack(p,registry);
 for(const a of p.actors){assert.ok(a.age>=18,`${a.id} age`);assert.ok(a.identityTags.includes('adult'),`${a.id} adult tag`);}
 for(const c of LI)for(const key of ['datingProfiles','romanceTempoProfiles','actProfiles','arcTracks','intimacyProfiles'])assert.ok(p[key].some(x=>x.character===c),`${c} ${key}`);
 for(const key of ['datingProfiles','romanceTempoProfiles','actProfiles','arcTracks','intimacyProfiles'])assert.ok(!p[key].some(x=>x.character==='kaylee'),`kaylee stays a friend: ${key}`);
 for(const prof of p.actProfiles){const prefs=prof.entries.filter(e=>!e.id.includes('-harp-'));assert.ok(prefs.length>=6&&prefs.length<=10,`${prof.character} act count`);assert.equal(prof.entries.length-prefs.length,p.actors.find(a=>a.id===prof.character).dislikes.length,`${prof.character}: one small "kept bringing it up" entry per dislike, listed last`);assert.ok(prof.entries.some(e=>e.points>0)&&prof.entries.some(e=>e.points<0));}
 for(const t of p.arcTracks){assert.equal(t.stages.length,3);assert.ok(t.stages.every(s=>s.voice));assert.ok(t.traits.length>=2&&t.traits.length<=3);}
});

test('every period of every weekday offers at least three activities the player can actually do',()=>{
 const p=pack(),week=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
 const at=(actor,slot)=>p.schedules.find(s=>s.actor===actor).stops.find(s=>s.at===slot*4).location;
 for(const day of week)for(const slot of [0,1,2]){
  const closed=new Set(p.calendar.closures.filter(c=>c.weekdays?.includes(day)).map(c=>c.location));
  const open=p.activities.filter(a=>!closed.has(a.location)&&(!a.character||at(a.character,slot)===a.location));
  assert.ok(open.length>=3,`${day} slot ${slot}: ${open.length}`);
 }
});

test('the term runs to its end and picks an ending, with every turn inside the event budget',()=>{
 const p=pack(),g=run(p,'term'),solo=p.activities.filter(a=>!a.character).map(a=>a.id);let n=0,done=0;
 const over=()=>g.events.some(e=>e.type==='story.endingChosen');while(!over()&&n<120){const id=solo[n++%solo.length];try{const r=doActivity(g,p,id);assert.ok(r.turn.events.length<120,`${id}: ${r.turn.events.length} events`);done++;}catch(e){if(!/closed today/.test(e.message))throw e;const loc=g.state.actors.player.location;g.act('core.scene',{text:'rest',location:loc,characters:[],activity:'rest'});}}
 assert.ok(over());assert.equal(g.state.tick,p.run.days*12);assert.ok(done>70);
 const chosen=g.events.find(e=>e.type==='story.endingChosen');assert.equal(chosen.payload.ending,'term-ends');
 assert.equal(calendarFor(0,p).date,'2026-09-07');
});

test('a priced act gives a reason for the end card, drifts the arc, and becomes a known preference',()=>{
 const p=pack(),g=run(p,'acts');
 g.act('core.scene',{text:'Hey, how was your call with Dominik?',location:'apartment',characters:['jana'],activity:'talk'});
 const sceneId=g.state.scene.id,before=traitsOf(g.state,p,'jana');assert.equal(stageOf(g.state,p,'jana').name,'Homesick');
 g.act('social.priceActs',{character:'jana',sceneId,private:true,acts:[{kind:'listen',target:'dominik',size:'medium'}]});
 const [v]=sceneVerdicts(g.state,sceneId);assert.equal(v.character,'jana');assert.equal(v.verdict,'liked');assert.match(v.reason,/without taking sides/);
 assert.ok(traitsOf(g.state,p,'jana').resolve>before.resolve);
 assert.ok(knownActs(g.state,p,'jana').some(k=>k.target==='dominik'&&k.liked));
 g.act('social.priceActs',{character:'jana',sceneId,private:true,acts:[{kind:'compliment',target:'looks',size:'small'}]});
 assert.ok(sceneVerdicts(g.state,sceneId).some(x=>x.verdict==='disliked'&&/Dominik/.test(x.reason)));
});

test('each heroine ending is reachable in principle: its flag is a final arc stage and its rank is her top tempo rank, or it only asks you to be exclusive',()=>{
 const p=pack();
 for(const e of p.endings.filter(x=>x.character)){if(e.requires.datingPhases){assert.deepEqual(e.requires,{datingPhases:{[e.character]:'exclusive'}});continue;}const t=p.arcTracks.find(x=>x.character===e.character),r=p.romanceTempoProfiles.find(x=>x.character===e.character);
  assert.equal(Object.keys(e.requires.flags)[0],t.stages.at(-1).flag);assert.equal(e.requires.romanceRanks[e.character],r.ranks.at(-1).id);}
});
