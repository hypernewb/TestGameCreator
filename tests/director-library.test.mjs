import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createWorld,execute,validatePack} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {DIRECTOR_LIBRARY,directorHint,directorTemplates,withDirector,readPack} from '../packages/cards/director-library.mjs';

// M3: the code-owned director library baked over campus's four love interests with placeholder text.
const probe={id:'test.court',version:'0.1.0',coreApi:'0.1.0',requires:[],commands:{'test.court'(tx,a){tx.emit('social.actPriced',{character:a.character,act:{kind:'listen',target:'plans'},points:1});}}},mods={...registry,[probe.id]:probe};
const campus=()=>{const p=JSON.parse(readFileSync(new URL('../packs/campus.json',import.meta.url)));p.modules[probe.id]='0.1.0';return p;};
const text=(v,p)=>v??`[${p}] {lead}`,baked=(tone='soap',pack=campus())=>withDirector(pack,{tone,text});
const run=(p,seed)=>{let s=createWorld(p,mods,'m3',seed);return {get s(){return s;},act(type,args={}){const r=execute(s,{id:`t${s.revision}`,actorId:p.playerId,type,args,expectedRevision:s.revision},p,mods);s=r.state;return r.turn.events;}};};
const beats=s=>s.events.filter(e=>['story.incident','story.directorDealt'].includes(e.type));
// Take any pending director scene (first choice) and any offered one, so the director is never blocked by an open scene.
const settle=(g,pick=()=>0)=>{for(let i=0;i<4;i++){const sc=g.s.modules['story.scenes']?.pending,offer=g.s.modules['story.director']?.offers?.find(o=>!o.accepted&&!g.s.modules['story.scenes'].completed.includes(o.scene));if(sc){const scene=g.p.scriptedScenes.find(x=>x.id===sc);g.act('story.choose',{scene:sc,choice:scene.choices[Math.min(pick(scene),scene.choices.length-1)].id});}else if(offer)g.act('story.startOfferedScene',{scene:offer.scene});else return;}};

test('the library bakes into a valid campus pack: every director scene carries template provenance, heroines become phone contacts',()=>{
 const p=baked();validatePack(p,mods);assert.ok(!p.directorTemplates);
 assert.deepEqual(new Set(DIRECTOR_LIBRARY.map(x=>x.kind)),new Set(['event','obstacle','goal','temptation']));
 assert.ok(['jana','monique','nova','abigail','kaylee'].every(c=>p.phoneContacts.includes(c)));
 const ds=p.scriptedScenes.filter(x=>x.id.startsWith('director.'));assert.ok(ds.length>=12*4);
 for(const s of ds){assert.ok(s.template?.id&&s.template.roles.lead,s.id);assert.ok(!/\{lead|\{rival|@lead|@rival/.test(JSON.stringify(s)),`${s.id} has an unfilled role`);}
 assert.ok(ds.every(s=>s.choices.every(c=>c.effects.every(e=>!e.character||Object.values(s.template.roles).includes(e.character)))),'effects only touch cast roles');
 assert.ok(p.phoneMessages.filter(m=>m.directorTemplate).every(m=>p.phoneContacts.includes(m.character)));
 assert.equal(p.directorProfile.quietDayparts,1);assert.equal(p.directorProfile.toneCeiling,'soap');
 assert.throws(()=>withDirector(campus(),{tone:'opera'}),/tone/);
 const blank=directorTemplates();assert.ok(blank.every(t=>t.scene.title===undefined));
 assert.match(directorHint('director.beats.saw-you.choices.2.result'),/\{rival\} it lands badly/);assert.equal(directorHint('heroines.jana.voice'),null);
});

test('a library goal: keeping it pays off on the next act with her, missing it costs trust',()=>{
 const p=baked(),goal=p.directorProfile.opportunities.find(x=>x.template==='promise'&&x.roles.lead==='jana'),scene=p.scriptedScenes.find(x=>x.id===goal.scene),kept=p.scriptedScenes.find(x=>x.id===`${goal.scene}.kept`);
 assert.equal(kept.template.part,'kept');assert.deepEqual(kept.trigger,{event:'social.actPriced',match:{character:'jana'}});assert.ok(kept.choices[0].effects.some(e=>e.type==='planStatus'&&e.status==='kept'));
 assert.ok(scene.choices[0].effects.some(e=>e.type==='plan'&&e.deadlineTicks===12));assert.equal(goal.goal.missed.cost,3);
 // The offer is put in hand directly here; dealing it is covered by the seeded runs below.
 const promise=keep=>{const g=run(p,1);g.p=p;g.s.modules['story.director'].offers=[{id:goal.id,scene:goal.scene}];g.act('story.startOfferedScene',{scene:goal.scene});g.act('story.choose',{scene:goal.scene,choice:scene.choices[0].id});const plan=()=>g.s.modules['story.scenes'].plans.find(x=>x.id===goal.goal.planId);assert.equal(plan().status,'pending');
  if(keep){g.act('test.court',{character:'jana'});assert.equal(g.s.modules['story.scenes'].pending,kept.id,'the next act with her opens the kept scene');g.act('story.choose',{scene:kept.id,choice:kept.choices[0].id});}
  else for(let i=0;i<16;i++){g.act('core.wait');const sc=g.s.modules['story.scenes'].pending;if(sc)g.act('story.choose',{scene:sc,choice:p.scriptedScenes.find(x=>x.id===sc).choices[0].id});}return {g,status:plan().status};};
 const trust=g=>g.s.modules['social.relationships'].edges['jana--player'];
 const yes=promise(true),no=promise(false);assert.equal(yes.status,'kept');assert.equal(no.status,'broken');
 assert.ok(no.g.s.events.some(e=>e.type==='story.goalMissed'&&e.payload.template==='promise'));assert.ok(trust(no.g)<30,`missing the promise costs trust (${trust(no.g)})`);
});

// One daypart = 4 ticks; a beat lands in a slot if it was committed during that slot (count-based: multi-tick
// scene choices overshoot the window edge). A slot only violates the guarantee when the director itself counted
// it quiet (its quiet counter is still up at slot end) and dealt nothing — eventful dayparts owe no beat. Silence
// is also honest when the deck is genuinely spent or gated: once the director has announced story.starved since
// the last beat, further quiet dayparts are the honest empty deck, not a dead director (attention-gated beats
// like spark stay locked until the player has actually spent time with someone).
const slots=(g,n,each=()=>{})=>{const quiet=[];let streak=0,worst=0,seen=beats(g.s).length,lastBeatTick=g.s.tick;for(let slot=0;slot<n;slot++){const from=g.s.tick;each(g);while(g.s.tick<from+4){g.act('core.wait');settle(g);}const hit=beats(g.s).length>seen;seen=beats(g.s).length;if(hit)lastBeatTick=g.s.tick;const starved=g.s.events.some(e=>e.type==='story.starved'&&e.tick>lastBeatTick);const violation=!hit&&!starved&&g.s.modules['story.director'].quiet>0&&from>=g.p.directorProfile.firstTick;streak=violation?streak+1:0;worst=Math.max(worst,streak);quiet.push(!violation);}return worst;};
test('seeded campus runs never leave more than one quiet daypart without a director beat',()=>{
 for(const seed of [3,11,29]){const p=baked(),g=run(p,seed);g.p=p;const worst=slots(g,18);assert.ok(worst<=1,`seed ${seed}: ${worst} quiet dayparts in a row`);
  const got=beats(g.s);assert.ok(got.length>=8,`seed ${seed}: only ${got.length} beats`);assert.ok(got.every(e=>e.payload.template),'every beat is a template instance');}
});

test('play style changes what the director deals: courting one heroine draws rivals and temptations around her',()=>{
 const deal=court=>{const c=campus();c.initialRelationships=c.initialRelationships.map(r=>({...r,trust:Math.max(r.trust,30)}));const p=baked('soap',c),g=run(p,5);g.p=p;slots(g,12,court?x=>{for(let i=0;i<2;i++){x.act('test.court',{character:'jana'});settle(x);}}:()=>{});return beats(g.s);};
 const plain=deal(false),courted=deal(true),focused=b=>b.filter(e=>e.payload.mode==='focus');
 assert.equal(focused(plain).length,0);assert.ok(focused(courted).length>=3,`only ${focused(courted).length} focus beats`);
 const around=b=>b.filter(e=>['obstacle','temptation'].includes(e.payload.kind)&&e.payload.roles.lead==='jana'&&e.payload.roles.rival).length;
 assert.ok(around(courted)>around(plain)+1,`courting drew ${around(courted)} rival beats around her vs ${around(plain)}`);
 assert.ok(new Set(plain.map(e=>e.payload.roles.lead)).size>=3,'unfocused play spreads beats across heroines');
 assert.ok(focused(courted).some(e=>['temptation','obstacle'].includes(e.payload.kind)&&e.payload.roles.rival),'a rival enters');
 assert.notDeepEqual(plain.map(e=>e.payload.template),courted.map(e=>e.payload.template));
});

test('campus loads with its drafted director text: packs/director/campus.json is baked in at load, names and pronouns filled',()=>{
 const p=readPack(fileURLToPath(new URL('../packs/campus.json',import.meta.url)));validatePack(p,registry);assert.equal(p.directorProfile.toneCeiling,'soap');
 const ds=p.scriptedScenes.filter(x=>x.template?.kind);assert.ok(ds.length>=48);for(const s of ds)assert.ok(s.title&&s.opening&&!/\[\[|\{lead|\{rival|@lead|@rival/.test(JSON.stringify(s)),s.id);
 const ms=p.phoneMessages.filter(m=>m.directorTemplate);assert.ok(ms.length);for(const m of ms)assert.ok(m.text&&!/^\w+\s*:/.test(m.text),`${m.id} has no sender prefix`);
 assert.ok(!campus().scriptedScenes.some(x=>x.template?.kind),'the pack file itself stays untouched');
});

test('taking a phone invite walks you out of a conversation with someone else, and never back into it',()=>{const p=baked(),inv=p.directorProfile.opportunities.find(c=>c.template==='invite'&&c.roles.lead==='nova'),g=run(p,1),jana=p.actors.find(a=>a.id==='jana');
 g.act('core.scene',{text:'Hi Jana.',location:jana.location,characters:['jana'],activity:'talk'});assert.deepEqual(g.s.scene?.characters,['jana']);
 g.s.modules['story.director'].offers=[{id:inv.id,scene:inv.scene,template:'invite',roles:inv.roles}];const ev=g.act('story.startOfferedScene',{scene:inv.scene});
 assert(ev.some(e=>e.type==='core.sceneEnded'&&e.payload.reason==='player'),'Jana\'s scene ends');assert(!g.s.scene?.characters?.includes('jana'),'no Jana scene to continue');assert.equal(g.s.modules['story.scenes'].pending,inv.scene);});
