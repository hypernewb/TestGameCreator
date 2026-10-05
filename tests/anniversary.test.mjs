import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {calendarFor} from '../public/calendar.mjs';
import {createWorld,execute,replay,mechanicsShape,mechanicsDigest} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {contextFor} from '../packages/ai/context.mjs';
import {setDatingPhase} from '../packages/modules/dating.mjs';
import {anniversary,anniversaryBrief} from '../packages/modules/anniversary.mjs';

const probe={id:'test.anniv',version:'0.1.0',coreApi:'0.1.0',requires:['social.dating','social.anniversary'],commands:{'test.kiss':tx=>tx.emit('social.firstCompleted',{first:'fk',character:'her',rung:'kiss',title:'First Kiss',verdicts:[]}),'test.night':tx=>tx.emit('social.firstCompleted',{first:'fn',character:'her',rung:'night',title:'First Night',verdicts:[]}),'test.break':tx=>setDatingPhase(tx,'her','broken','the test ended it')}};
const mods={...registry,[probe.id]:probe};

function pack(on=true,settings={}){
  const p={schemaVersion:1,id:'anniv',title:'Anniversary',version:'0.1.0',playerId:'player',modules:{'social.conversation':'0.1.0','social.relationships':'0.1.0','social.dating':'0.1.0','social.anniversary':'0.1.0','test.anniv':'0.1.0'},locations:[{id:'room',name:'Room',exits:[{to:'hall'}]},{id:'hall',name:'Hall',exits:[{to:'room'}]}],actors:[{id:'player',name:'Player',location:'room'},{id:'her',name:'Her',location:'room'}],initialRelationships:[{character:'her',trust:90}],datingProfiles:[{character:'her',initialChemistry:80,thresholds:{crush:15,date:35,exclusive:65},preferences:[],signals:[]}],relationshipStageSettings:{stages:['acquaintance','dating','exclusive'],strainTrustFloor:20,strainDays:2,scar:{trust:-10,chemistry:-10},repairDelayDays:2,repairTrustBar:35},durations:{}};
  if(on)p.anniversarySettings={interval:28,maxMoments:8,acknowledgeReward:{like:2},neglectPenalty:{like:-1},...settings};
  return p;
}

const run=(s,p,type,args={})=>execute(s,{id:`turn-${s.revision}`,actorId:p.playerId,expectedRevision:s.revision,type,args},p,mods);
const step=(s,p,type,args={})=>run(s,p,type,args).state;
const her=(s)=>s.modules['social.anniversary'].characters.her;
const like=(s)=>s.modules['social.dating'].characters.her.chemistry;
const day=(s,p)=>calendarFor(s.tick,p).day;
const tillDay=(s,p,n)=>{let guard=0;while(day(s,p)<n&&guard++<4000)s=step(s,p,'core.wait',s.scene?.characters?.length?{}:{until:'Morning'});assert.equal(day(s,p),n,`never reached day ${n}`);return s;};
// Wait to each next morning through the real engine; retain every day boundary and its penalty.
const days=(s,p,n)=>{const from=day(s,p);for(let i=from;i<from+n;i++)s=tillDay(s,p,i+1);return s;};
const date=(s,p)=>step(s,p,'social.askDate',{character:'her'});
const mark=(s,p)=>step(s,p,'social.acknowledgeAnniversary',{character:'her'});
const speak=(s,p)=>step(s,p,'social.speak',{target:'her',text:'I thought about earlier.'});
const move=(s,p,to)=>step(s,p,'core.move',{to});
test('daily waits match single-tick waits across two marks and their closing penalties',()=>{
 const p=pack(true,{interval:7}),dated=date(createWorld(p,mods,'wait-parity'),p);for(const initial of [dated,speak(dated,p)]){const target=day(initial,p)+15;let slow=initial;
 while(day(slow,p)<target)slow=step(slow,p,'core.wait');const fast=tillDay(initial,p,target);
 assert.equal(fast.tick,slow.tick);assert.deepEqual(fast.modules,slow.modules);assert.deepEqual(fast.actors,slow.actors);assert.deepEqual(fast.flags,slow.flags);assert.equal(like(fast),like(initial)-2);}
});

test('anniversarySettings is mechanics and edits invalidate existing worlds',()=>{
  const p=pack(),s=createWorld(p,mods),before=mechanicsDigest(p);
  assert.deepEqual(mechanicsShape(p).anniversarySettings,p.anniversarySettings);
  p.anniversarySettings.interval=30;
  assert.notEqual(mechanicsDigest(p),before);
  assert.throws(()=>step(s,p,'core.inspect'),/digest|rules|pack/i);
});

test('absent anniversary settings preserve digest and record no moments',()=>{
  const p=pack(false);let s=createWorld(p,mods);const before=mechanicsDigest(p);
  assert.equal(Object.hasOwn(mechanicsShape(p),'anniversarySettings'),false);
  p.anniversarySettings={};
  assert.notEqual(mechanicsDigest(p),before);
  delete p.anniversarySettings;
  assert.equal(mechanicsDigest(p),before);
  s=date(s,p);s=speak(s,p);
  assert.deepEqual(s.modules['social.anniversary'].characters,{},'a legacy pack keeps no ledger at all');
  assert.equal(anniversaryBrief(s,p,'player'),null);
  assert.deepEqual(anniversary.actions(s,p),[]);
});

test('malformed settings are rejected and a missing pack field stays legacy',()=>{
  for(const bad of [{interval:0},{interval:3650},{interval:1.5},{maxMoments:0},{maxMoments:21},{acknowledgeReward:{like:-1}},{neglectPenalty:{like:1}}])assert.throws(()=>createWorld(pack(true,bad),/anniversary/),JSON.stringify(bad));
});

test('first meeting and first date are stamped with day and place',()=>{
  const p=pack();let s=createWorld(p,mods);
  s=speak(s,p);
  assert.equal(her(s).firstMeetingDay,day(s,p));
  assert.deepEqual(her(s).history.map(m=>[m.kind,m.place]),[['firstMeeting','Room']]);
  s=date(s,p);
  assert.equal(her(s).datingStartDay,day(s,p));
  assert.ok(her(s).history.some(m=>m.kind==='firstDate'&&m.place==='Room'));
});

test('intimate firsts, stage change, breakup and reunion are stamped in order',()=>{
  const p=pack();let s=date(createWorld(p,mods),p);
  // The date itself is the move into dating, so that is the first stage change.
  assert.deepEqual(her(s).history.map(m=>m.kind),['firstMeeting','firstDate','stageChange']);
  assert.equal(her(s).history.at(-1).from,'available');
  assert.equal(her(s).history.at(-1).to,'dating');
  s=step(s,p,'test.kiss');
  s=step(s,p,'test.night');
  assert.deepEqual(her(s).history.map(m=>m.kind),['firstMeeting','firstDate','stageChange','firstKiss','firstNight']);
  s=step(s,p,'social.defineRelationship',{character:'her',agreement:'monogamous'});
  assert.ok(her(s).history.some(m=>m.kind==='stageChange'&&m.to==='exclusive'));
  s=step(s,p,'test.break');
  assert.ok(her(s).history.some(m=>m.kind==='breakup'&&m.from==='exclusive'),'the breakup remembers the stage it ended');
});

test('the ledger keeps at most maxMoments and never drops a first',()=>{
  const p=pack(true,{maxMoments:4});let s=date(createWorld(p,mods),p);
  s=step(s,p,'test.kiss');s=step(s,p,'test.night');
  for(let i=0;i<3;i++){s=days(s,p,1);s=step(s,p,'test.break');s=days(s,p,2);s=step(s,p,'social.reconcile',{character:'her'});}
  const kinds=her(s).history.map(m=>m.kind);
  // Two pinned anchors plus the newest two recency moments; the first kiss and night are the ones that fall off.
  assert.deepEqual(her(s).history.map(m=>m.kind),['firstMeeting','firstDate','breakup','reunion']);
  assert.equal(her(s).history.length,4);
  assert.deepEqual(kinds.slice(0,2),['firstMeeting','firstDate'],'the anchors stay');
  assert.ok(!kinds.includes('firstKiss'),'the oldest non-first moments went first');
});

test('marks fall every interval days from the dating start',()=>{
  const p=pack();let s=date(createWorld(p,mods),p);
  const start=her(s).datingStartDay;
  for(let n=1;n<=3;n++){s=days(s,p,28);assert.equal(her(s).mark,n);assert.equal(her(s).months,n);assert.equal(day(s,p)-start,n*28);}
  s=days(s,p,27);
  assert.equal(her(s).mark,0,'no mark off the interval');
});

test('the prompt gets the N-month mark plus up to two shared moments on the day',()=>{
  const p=pack();let s=date(createWorld(p,mods),p);
  s=step(s,p,'test.kiss');
  s=days(s,p,28);
  const brief=anniversaryBrief(s,p,'player');
  assert.equal(brief.anniversary,'Today is your 1-month mark with Her.');
  // The two most recent moments, newest last, capped at two however long the ledger is.
  assert.deepEqual(her(s).history.slice(-2).map(m=>m.kind),['stageChange','firstKiss']);
  assert.deepEqual(brief.sharedHistory.split('. '),['1 month ago at Room you changed labels','1 month ago at Room your first kiss.']);
  assert.ok(brief.sharedHistory.length<200,'one short block');
  const injected=contextFor(s,p,'player',null,'');
  assert.equal(injected.anniversary,brief.anniversary,'injected, not replaced');
  assert.ok(injected.dating.length,'the scene prompt still carries its own context');
});

test('on an ordinary day one moment appears only where the place or topic matches',()=>{
  const p=pack();let s=date(createWorld(p,mods),p);
  s=step(s,p,'test.kiss');
  s=days(s,p,1);
  assert.match(anniversaryBrief(s,p,'player').sharedHistory,/your first kiss/,'same place');
  s=move(s,p,'hall');
  assert.equal(anniversaryBrief(s,p,'player'),null,'neither place nor topic fits');
  assert.match(anniversaryBrief(s,p,'player','I keep thinking about that kiss').sharedHistory,/your first kiss/,'the topic fits');
});

test('marking it together pays Like once per mark',()=>{
  const p=pack();let s=date(createWorld(p,mods),p);
  s=days(s,p,28);
  assert.ok(anniversary.actions(s,p).some(a=>a.type==='social.acknowledgeAnniversary'));
  const before=like(s);
  s=mark(s,p);
  assert.equal(like(s)-before,2);
  assert.deepEqual(anniversary.actions(s,p),[],'the offer is spent');
  assert.throws(()=>mark(s,p),/already marked/);
  const after=like(s);s=days(s,p,28);
  assert.equal(her(s).mark,2,'the next mark arrives');
  assert.equal(like(s),after,'no reward without marking it');
});

test('marking needs her there, and the pack decides the numbers',()=>{
  const p=pack(true,{acknowledgeReward:{like:5}});let s=date(createWorld(p,mods),p);
  s=days(s,p,28);
  s=move(s,p,'hall');
  assert.deepEqual(anniversary.actions(s,p),[],'no offer while apart');
  assert.throws(()=>mark(s,p),/need to be with/);
  s=move(s,p,'room');
  const before=like(s);
  s=mark(s,p);
  assert.equal(like(s)-before,5);
});

test('the mark day closing without contact costs Like once, not per wait',()=>{
  const p=pack();let s=date(createWorld(p,mods),p);
  s=days(s,p,28);
  const before=like(s);
  s=step(s,p,'core.wait');
  assert.equal(like(s),before,'the day has not closed yet');
  s=days(s,p,1);
  assert.equal(like(s)-before,-1);
  s=days(s,p,13);
  assert.equal(like(s)-before,-1,'one penalty for the mark, not one per tick');
});

test('contact or a marked day spares the neglect penalty',()=>{
  const p=pack();let s=date(createWorld(p,mods),p);
  s=tillDay(s,p,her(s).datingStartDay+28);          // the first mark day
  s=speak(s,p);
  const before=like(s);
  s=tillDay(s,p,day(s,p)+1);
  assert.equal(like(s),before,'a word on the day is enough');
  s=tillDay(s,p,her(s).datingStartDay+56);          // the second mark day
  assert.equal(her(s).mark,2);
  s=mark(s,p);
  const after=like(s);
  s=tillDay(s,p,day(s,p)+1);
  assert.equal(like(s),after,'marking it together is contact');
});

test('breakups silence the marks and a reunion re-anchors the count',()=>{
  const p=pack();let s=date(createWorld(p,mods),p);
  s=days(s,p,14);
  s=step(s,p,'test.break');
  assert.equal(anniversaryBrief(s,p,'player'),null,'a broken bond celebrates nothing');
  s=days(s,p,14);
  assert.equal(her(s).mark,0,'the old anchor is spent, not inherited');
  s=days(s,p,2);
  s=step(s,p,'social.reconcile',{character:'her'});
  assert.equal(her(s).datingStartDay,day(s,p),'the reunion is the new anchor');
  s=days(s,p,28);
  assert.equal(her(s).mark,1,'counting restarts from the reunion');
  assert.match(anniversaryBrief(s,p,'player').anniversary,/1-month mark/);
});

test('the ledger survives save/load, breakups and replay',()=>{
  const p=pack();let s=date(createWorld(p,mods),p);
  s=step(s,p,'test.kiss');
  s=days(s,p,28);
  s=mark(s,p);
  const dir=mkdtempSync(join(tmpdir(),'anniv-'));
  try{
    const file=join(dir,'save.json');
    writeFileSync(file,JSON.stringify(s));
    const loaded=JSON.parse(readFileSync(file));
    assert.deepEqual(her(loaded),her(s));
    assert.equal(anniversaryBrief(loaded,p,'player').anniversary,anniversaryBrief(s,p,'player').anniversary);
    const rebuilt=replay(createWorld(p,mods),s.events);
    assert.deepEqual(rebuilt.modules['social.anniversary'],s.modules['social.anniversary']);
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('the panel reads as shared history',()=>{
  const p=pack();let s=date(createWorld(p,mods),p);
  s=step(s,p,'test.kiss');
  const lines=anniversary.panel(s,p).lines;
  assert.match(lines[0],/Her: 0 months together/);
  assert.match(lines.join('\n'),/your first kiss/);
  assert.deepEqual(anniversary.panel(s,pack(false)).lines,[]);
});
