import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute,validatePack,mechanicsDigest} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {addPoints} from '../packages/modules/romance-tempo.mjs';
import {changeTrust} from '../packages/modules/romance-stats.mjs';
import {exportCampaign,validateImport} from '../packages/persistence/store.mjs';
import {withProgression,RULES_MARKER} from '../packages/core/progression.mjs';

// Same probe as the romance-stats tests: real changeTrust/addPoints, so the cap is exercised exactly as the modules use it.
const probe={id:'test.romance-probe',version:'0.1.0',coreApi:'0.1.0',requires:[],commands:{'test.like'(tx,a){addPoints(tx,a.character,a.amount,'test');},'test.trust'(tx,a){changeTrust(tx,a.character,a.amount);}}};
const mods={...registry,[probe.id]:probe};
const campus=(edit=()=>{})=>{const p=JSON.parse(readFileSync(new URL('../packs/campus.json',import.meta.url),'utf8'));p.modules[probe.id]='0.1.0';edit(p);return p;};
const flagged=p=>({...p,progression:{version:1}});
const legacy=()=>JSON.parse(readFileSync(new URL('./fixtures/progression/legacy-save.json',import.meta.url),'utf8'));
const edge=(s,c,p)=>s.modules['social.relationships'].edges[`${c}--${p.playerId}`];
const like=(s,c)=>s.modules['social.romance-tempo'].characters[c].points;
const stamped=t=>t.events.some(e=>e.type==='core.patch'&&e.payload.path[0]==='progression');
let seq=0;
const act=(s,p,type,args,id=`u${++seq}`)=>execute(s,{id,actorId:p.playerId,type,args,expectedRevision:s.revision},p,mods).state;

test('campus and campus-trio keep their explicit 6-per-day Like/Trust cap',()=>{
 for(const f of ['campus.json','campus-trio.json'])assert.equal(JSON.parse(readFileSync(new URL(`../packs/${f}`,import.meta.url),'utf8')).romanceStats.dailyGain,6,f);
});

test('an old unstamped save replays unchanged under the pack with and without the flag',()=>{
 const fx=legacy();
 for(const p of [fx.pack,flagged(fx.pack)]){
  const s=validateImport(structuredClone(fx.portable),p,mods);
  assert.equal(s.progression,undefined,'legacy save stays unstamped');
  assert.equal(edge(s,'jana',p),fx.expected.trust.jana);
  assert.equal(edge(s,'kaylee',p),fx.expected.trust.kaylee);
  assert.equal(like(s,'jana'),fx.expected.like.jana);
 }
});

test('a new flagged save stamps on its first turn, writes capped-gain markers, and replays',()=>{
 const p=flagged(campus());let s=createWorld(p,mods,'flag-new',42);
 assert.equal(s.progression,undefined,'createWorld does not stamp');
 const t0=edge(s,'jana',p);
 s=act(s,p,'test.trust',{character:'jana',amount:4},'new-1');
 assert.equal(s.progression.cutover.turn,'new-1');
 assert.equal(s.progression.version,1);
 assert.ok(stamped(s.turns['new-1']),'the stamp is a recorded patch on the first turn');
 assert.equal(s.turns['new-1'].events.filter(e=>e.type===RULES_MARKER).length,1);
 s=act(s,p,'test.trust',{character:'jana',amount:4},'new-2');
 s=act(s,p,'test.trust',{character:'jana',amount:4},'new-3');
 assert.equal(edge(s,'jana',p),t0+6,'same-day Trust gain is capped at 6');
 const r=validateImport(exportCampaign(s),p,mods);
 assert.deepEqual(r.progression,s.progression);
 assert.equal(edge(r,'jana',p),t0+6);
});

test('a later edit to the daily cap does not rewrite a saved turn',()=>{
 const p=flagged(campus());let s=createWorld(p,mods,'flag-pin',42);
 s=act(s,p,'test.trust',{character:'jana',amount:10},'pin-1');
 const v=edge(s,'jana',p),edited={...p,romanceStats:{dailyGain:2}};
 assert.equal(edge(validateImport(exportCampaign(s),edited,mods),'jana',p),v,'the marker pins the cap the turn used');
});

test('a flagged save without a romanceStats block gets the default 6 cap; an unflagged one does not',()=>{
 const base=campus(p=>{delete p.romanceStats;delete p.progression;}),pf=flagged(base);
 const sf=act(createWorld(pf,mods,'flag-default',42),pf,'test.trust',{character:'jana',amount:20},'def-1');
 const su=act(createWorld(base,mods,'legacy-default',42),base,'test.trust',{character:'jana',amount:20},'def-1');
 const t0=edge(createWorld(base,mods,'legacy-default',42),'jana',base);
 assert.equal(edge(sf,'jana',pf)-t0,6);
 assert.equal(edge(su,'jana',base)-t0,20);
});

test('a save that starts unflagged and turns flagged later replays unchanged',()=>{
 const fx=legacy();
 let s=validateImport(structuredClone(fx.portable),fx.pack,mods);
 const p=flagged(fx.pack);
 s=act(s,p,'test.trust',{character:'jana',amount:20},'mix-1');
 s=act(s,p,'test.like',{character:'jana',amount:9},'mix-2');
 assert.equal(s.progression.cutover.turn,'mix-1');
 for(const id of Object.keys(fx.portable.state.turns))assert.deepEqual(s.turns[id].events,fx.portable.state.turns[id].events,`${id} unchanged`);
 assert.equal(stamped(s.turns['mix-1']),true);
 const r=validateImport(exportCampaign(s),p,mods);
 assert.deepEqual(r.progression,s.progression);
});

test('tampering with a flagged save is rejected',()=>{
 const p=flagged(campus());let s=createWorld(p,mods,'tamper',42);
 s=act(s,p,'test.trust',{character:'jana',amount:4},'tp-1');
 s=act(s,p,'test.trust',{character:'jana',amount:4},'tp-2');
 const base=exportCampaign(s),copy=()=>structuredClone(base);
 const d1=copy();delete d1.state.progression;
 assert.throws(()=>validateImport(d1,p,mods),/Progression stamp does not match/,'stamp removed');
 const d2=copy();d2.state.progression.cutover.turn='tp-2';
 assert.throws(()=>validateImport(d2,p,mods),/Progression stamp does not match/,'stamp moved');
 const d3=copy();d3.state.turns['tp-2'].events=d3.state.turns['tp-2'].events.filter(e=>e.type!==RULES_MARKER);
 assert.throws(()=>validateImport(d3,p,mods),/Event history is inconsistent/,'marker removed');
 const d4=copy();d4.state.turns['tp-1'].events.find(e=>e.type===RULES_MARKER).payload.version=2;
 assert.throws(()=>validateImport(d4,p,mods),/Unsupported progression rules/,'marker version');
 const d5=copy();const m=d5.state.turns['tp-1'].events.find(e=>e.type===RULES_MARKER);d5.state.turns['tp-1'].events.push(structuredClone(m));
 assert.throws(()=>validateImport(d5,p,mods),/Duplicate progression rules marker/,'duplicate marker');
});

test('a stamp added to an old unstamped save is rejected',()=>{
 const fx=legacy(),d=structuredClone(fx.portable);
 d.state.progression={version:1,cutover:{turn:'legacy-1',revision:0,tick:0}};
 assert.throws(()=>validateImport(d,fx.pack,mods),/Save state mismatch: progression/);
});

test('an unknown progression version is refused by validation and by execute',()=>{
 for(const v of [0,1.5,'1',null])assert.throws(()=>validatePack(campus(p=>{p.progression={version:v};}),mods),/progression\.version/,String(v));
 const p2=campus(p=>{p.progression={version:2};});
 validatePack(p2,mods);
 const s=createWorld(p2,mods,'v2',42);
 assert.throws(()=>execute(s,{id:'v2-1',actorId:p2.playerId,type:'test.trust',args:{character:'jana',amount:4},expectedRevision:s.revision},p2,mods),/Progression version 2 is not supported/);
});

test('shipped packs keep their pre-change digests; only bridge packs carry the flag',()=>{
 const table=JSON.parse(readFileSync(new URL('./fixtures/progression/pre-change-digests.json',import.meta.url),'utf8'));
 for(const [f,row] of Object.entries(table)){
  const p=JSON.parse(readFileSync(new URL(`../packs/${f}`,import.meta.url),'utf8'));
  assert.equal(p.id,row.id,f);
  assert.equal(mechanicsDigest(p),row.digest,f);
  assert.equal(p.progression?.version===1,row.social,f);
 }
});

test('generated and published packs get the flag only when they use the relationship bridge',()=>{
 assert.deepEqual(withProgression({modules:{'social.relationships':'0.1.0'}}).progression,{version:1});
 assert.equal(withProgression({modules:{'social.conversation':'0.1.0'}}).progression,undefined);
 const kept={modules:{'social.relationships':'0.1.0'},progression:{version:1}};
 assert.equal(withProgression(kept),kept);
});
