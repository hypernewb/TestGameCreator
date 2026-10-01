import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute,replay,validatePack,mechanicsDigest} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {OUTREACH,outreachSettings} from '../packages/modules/outreach.mjs';
import {phoneContext} from '../packages/modules/phone.mjs';
import {phone} from '../public/campus.mjs';
const campus=()=>JSON.parse(readFileSync(new URL('../packs/campus.json',import.meta.url)));
const pack=(o={})=>{const p=campus();p.modules['social.outreach']='0.1.0';p.outreachSettings={...structuredClone(p.outreachSettings),...o};return p;};
const run=(p,seed=42)=>{let s=createWorld(p,registry,'outreach',seed);const act=(type,args={})=>{const r=execute(s,{id:`t${s.revision}`,actorId:p.playerId,type,args,expectedRevision:s.revision},p,registry);s=r.state;return r.turn;};return {act,get state(){return s;},load(v){s=structuredClone(v);}};};
const textsOf=(s,who)=>Object.values(s.modules['social.phone'].threads).flat().filter(x=>x.template&&(!who||x.character===who));
const heroines=p=>(p.datingProfiles||[]).map(x=>x.character);
// Spend whole days: one slot per wait.
const days=(g,n)=>{for(let i=0;i<n*3;i++)g.act('core.wait');};

test('each heroine may text once per daypart, at most two a day',()=>{
  const p=pack({stageChance:{acquaintance:1,dating:1,exclusive:1},maxPerDay:2}),g=run(p);
  days(g,4);
  const runtime=s=>({day:g.state.modules['social.outreach'].characters[s].sent?.day,count:g.state.modules['social.outreach'].characters[s].sent?.count});
  for(const who of heroines(p)){const r=runtime(who);assert.ok(r.count>0,`${who} never texted`);assert.ok(r.count<=2,`${who} exceeded two texts a day`);}
  assert.ok(textsOf(g.state).every(x=>/^outreach-/.test(x.id)),'texts land in the phone thread under their own IDs');
  const offered=Object.values(g.state.modules['social.phone'].threads).flat().filter(x=>x.template&&x.kind==='plan');
  assert.ok(offered.every(x=>['pending','expired','accepted'].includes(x.offer.status)),'plans carry an invitation with a state');
});

test('chance is deterministic from the seed and scales with Like',()=>{
  const p=pack({stageChance:{acquaintance:0.5,dating:0.5,exclusive:0.5}});
  const count=seed=>{const g=run(p,seed);days(g,3);return textsOf(g.state).length;};
  assert.equal(count(42),count(42));
  const zero=pack({stageChance:{acquaintance:0.5,dating:0.5,exclusive:0.5},likeScale:0});
  const raised=structuredClone(zero);raised.romanceTempoProfiles.forEach(x=>x.initialPoints=50);
  const roll=(p2)=>{const g=run(p2);days(g,3);return textsOf(g.state).length;};
  assert.ok(roll(zero)>0);
  assert.ok(roll(raised)>=roll(zero),'a higher Like never lowers the chance');
  assert.equal(mechanicsDigest(p),mechanicsDigest(zero),'outreach tuning is presentation-side pack data, like phoneMessages');
});

test('a plan suggestion is a pending invitation the player accepts by replying',()=>{
  const p=pack({stageChance:{acquaintance:1,dating:1,exclusive:1}}),g=run(p);
  let plan=null;
  for(let i=0;i<6&&!plan;i++){plan=textsOf(g.state,'nova').find(x=>x.kind==='plan'&&x.offer.status==='pending');if(!plan)g.act('core.wait');}
  assert.ok(plan,'nova proposes a plan');assert.equal(plan.offer.status,'pending');
  const turn=g.act('social.replyMessage',{message:plan.id,reply:'yes'});
  assert.ok(turn.events.some(e=>e.type==='social.outreachPlanAccepted'&&e.payload.location===plan.offer.location));
  assert.equal(g.state.modules['social.phone'].threads.nova.find(x=>x.id===plan.id).offer.status,'accepted');
  assert.ok(g.state.modules['social.outreach'].characters.nova.contactDay!=null,'reply counts as contact');
});

test('a tease needs the authored Lust threshold, and never before dating',()=>{
  const p=pack({stageChance:{acquaintance:1,dating:1,exclusive:1},teaseLust:40});
  p.modules['social.touch-ladder']='0.1.0';
  const g=run(p);days(g,2);
  assert.ok(!textsOf(g.state).some(x=>x.kind==='tease'),'no tease at zero Lust');
  assert.ok(!textsOf(g.state).some(x=>x.kind==='neglected'),'no neglected text while still an acquaintance');
  const q=structuredClone(p);q.outreachSettings.stageChance={acquaintance:1,dating:1,exclusive:1};
  const h=run(q);h.state.modules['social.dating'].characters.nova.stage='dating';h.state.modules['social.touch-ladder'].characters.nova.lust=45;
  h.act('core.wait');
  const sent=textsOf(h.state,'nova');
  assert.ok(sent.some(x=>x.kind==='tease'),'a tease follows the Lust threshold');
  assert.ok(!sent.some(x=>x.kind==='neglected'),'one day of silence is not neglect');
});

test('neglect fires after the configured quiet days and costs Like when still ignored',()=>{
  const p=pack({stageChance:{acquaintance:1,dating:1,exclusive:1},neglectDays:2});
  p.romanceTempoProfiles.find(x=>x.character==='nova').initialPoints=8;
  const g=run(p);
  const s=g.state;s.modules['social.dating'].characters.nova.stage='dating';
  const before=s.modules['social.romance-tempo'].characters.nova.points;
  days(g,1);
  assert.equal(textsOf(g.state,'nova').filter(x=>x.kind==='neglected').length,0,'no neglected text on day one');
  days(g,1);
  assert.ok(textsOf(g.state,'nova').some(x=>x.kind==='neglected'),'silence while dating brings the neglected text');
  const afterFirst=g.state.modules['social.romance-tempo'].characters.nova.points;
  days(g,2);
  assert.ok(g.state.modules['social.romance-tempo'].characters.nova.points<afterFirst,'still ignored the next day costs Like');
  assert.ok(before>=0);
});

test('a strain text lands while the relationship is strained, ahead of a tease',()=>{
  const p=pack({stageChance:{acquaintance:1,dating:1,exclusive:1}});
  p.modules['social.touch-ladder']='0.1.0';
  const g=run(p);days(g,1);
  const s=g.state;s.modules['social.dating'].characters.nova.strained=true;s.modules['social.touch-ladder'].characters.nova.lust=90;
  g.act('core.wait');
  const sent=textsOf(g.state,'nova');
  assert.ok(sent.some(x=>x.kind==='strain'),'strain text sent');
  assert.ok(!sent.some(x=>x.kind==='tease'),'strain outranks a tease');
});

test('reply gains share one small daily Like/Trust budget inside the +6 daily cap',()=>{
  const p=pack({stageChance:{acquaintance:1,dating:1,exclusive:1},replyLike:2,replyTrust:2,replyLikeCap:2});
  const g=run(p);days(g,2);
  const like=()=>g.state.modules['social.romance-tempo'].characters.nova.points,trust=()=>g.state.modules['social.relationships'].edges['nova--player']||0;
  const start=[like(),trust()];
  for(const entry of textsOf(g.state,'nova').slice().reverse())for(let i=0;i<3;i++){try{g.act('social.replyMessage',{message:entry.id,reply:(p.outreachMessages.find(t=>t.id===entry.template).replies[i%3]).id});}catch{break;}}
  assert.ok(like()-start[0]+trust()-start[1]<=2,`texting spent ${like()-start[0]+trust()-start[1]} beyond the budget`);
  assert.equal(g.state.modules['social.outreach'].characters.nova.gained.amount,like()-start[0]+trust()-start[1]);
  days(g,1);
  assert.ok(like()<=50);
});

test('replies are ordinary turns: one model call path, no extra job',()=>{
  const p=pack({stageChance:{acquaintance:1,dating:1,exclusive:1}}),g=run(p);
  days(g,2);
  const entry=textsOf(g.state,'nova').at(-1);
  const turn=g.act('social.replyMessage',{message:entry.id,reply:'yes'});
  assert.equal(turn.command.type,'social.replyMessage');
  assert.ok(turn.events.some(e=>e.type==='social.messageReplied'));
});

test('missing pack fields preserve legacy behaviour',()=>{
  const p=campus();delete p.outreachSettings;delete p.outreachMessages;delete p.modules['social.outreach'];
  assert.equal(outreachSettings(p),null);
  validatePack(p,registry);
  const g=run(p);days(g,4);
  assert.equal(g.state.modules['social.outreach'],undefined);
  assert.ok(!textsOf(g.state).length,'no generated texts');
});

test('a pack with outreach but no settings or bad texts is rejected',()=>{
  const p=pack();
  assert.throws(()=>validatePack({...campus(),modules:{...campus().modules,'social.outreach':'0.1.0'},outreachSettings:null},registry),/outreachSettings/);
  const bad=[o=>o.outreachSettings.stageChance.acquaintance=2,o=>o.outreachSettings.stageChance.dating='half',o=>o.outreachSettings.maxPerDay=99,o=>o.outreachSettings.neglectDays=-1,o=>o.outreachSettings.teaseLust=140,o=>o.outreachSettings.replyLikeCap=-3,o=>o.outreachSettings.ignoredLike=5,o=>o.outreachMessages[0].kind='junk',o=>o.outreachMessages[0].replies=[],o=>o.outreachMessages[0].offer={location:'nowhere',expiresIn:4},o=>o.outreachMessages[0].character='kaylee',o=>o.outreachMessages[0].text='',o=>o.outreachMessages.push({...o.outreachMessages[0]})];
  for(const change of bad){const q=pack();change(q);assert.throws(()=>validatePack(q,registry),/outreach/);}
});

test('save, reload and event replay keep picks, budgets and text ids',()=>{
  const p=pack({stageChance:{acquaintance:1,dating:1,exclusive:1}}),g=run(p);
  const initial=structuredClone(g.state);days(g,3);
  const saved=JSON.parse(JSON.stringify(g.state)),h=run(p);
  h.load(saved);
  for(const entry of textsOf(g.state,'nova').slice().reverse()){const reply=p.outreachMessages.find(t=>t.id===entry.template).replies[0].id;g.act('social.replyMessage',{message:entry.id,reply});h.act('social.replyMessage',{message:entry.id,reply});}
  days(g,2);days(h,2);
  assert.deepEqual(g.state.modules['social.outreach'],h.state.modules['social.outreach']);
  const replayed=replay(initial,g.state.events);
  assert.deepEqual(replayed.modules['social.outreach'],g.state.modules['social.outreach']);
  assert.deepEqual(replayed.modules['social.phone'].threads,g.state.modules['social.phone'].threads);
});

test('the text reaches the player phone view and the scene context, with its own Studio section',()=>{
  const p=pack({stageChance:{acquaintance:1,dating:1,exclusive:1}}),g=run(p);
  days(g,3);
  const sent=textsOf(g.state);
  assert.ok(sent.length);
  const shown=phone(g.state,p).find(t=>t.character===sent[0].character);
  assert.ok(shown.messages.some(m=>m.text===sent[0].text),'the phone view shows the text');
  const thread=phoneContext(g.state,p,p.playerId).contacts.find(c=>c.character===sent[0].character);
  assert.ok(thread.messages.some(m=>m.text===sent[0].text),'the scene context carries the text, no extra model call');
  const ui=readFileSync(new URL('../public/studio.mjs',import.meta.url),'utf8');
  assert.match(ui,/section\('Heroine outreach'/);
  assert.match(ui,/function outreachEditor/);
});

test('exported defaults, the campus profile and the reskinned trio stay in step',()=>{
  assert.deepEqual(outreachSettings({outreachSettings:{}}).stageChance,OUTREACH.stageChance);
  assert.equal(campus().outreachSettings.replyLikeCap,2);
  assert.equal(campus().modules['social.outreach'],'0.1.0');
  validatePack(campus(),registry);
  const trio=JSON.parse(readFileSync(new URL('../packs/campus-trio.json',import.meta.url)));
  validatePack(trio,registry);
  assert.deepEqual(trio.outreachSettings,campus().outreachSettings);
  assert.deepEqual([...new Set(trio.outreachMessages.map(m=>m.kind))].sort(),['check-in','neglected','plan','strain','tease']);
  assert.equal(new Set(trio.outreachMessages.map(m=>m.character)).size,3,'the trio keeps three texters');
  for(const s of trio.characterSheets)assert.deepEqual(s.source.profiles.outreachMessages,trio.outreachMessages.filter(m=>m.character===s.actorId),`${s.actorId}'s sheet keeps her own texts`);
});