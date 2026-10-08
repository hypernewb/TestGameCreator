import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute,validatePack,mechanicsDigest} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {changeTrust} from '../packages/modules/romance-stats.mjs';
import {addPoints} from '../packages/modules/romance-tempo.mjs';
import {exportCampaign,validateImport} from '../packages/persistence/store.mjs';
import {RULES_MARKER} from '../packages/core/progression.mjs';

// Contract: docs/research/gc22-compat-contract-2026-10-08.md. Flag = pack.progression.version; marker = social.progressionRules; stamp = state.progression.
const probe={id:'test.romance-probe',version:'0.1.0',coreApi:'0.1.0',requires:[],commands:{'test.trust'(tx,a){changeTrust(tx,a.character,a.amount);},'test.like'(tx,a){addPoints(tx,a.character,a.amount,'test');}}};
const mods={...registry,[probe.id]:probe};
const pack=(edit=()=>{})=>{const p=JSON.parse(readFileSync(new URL('../packs/campus.json',import.meta.url),'utf8'));p.modules[probe.id]='0.1.0';delete p.progression;edit(p);return p;};
const flagged=p=>({...p,progression:{version:1}});
const legacy=()=>JSON.parse(readFileSync(new URL('./fixtures/progression/legacy-save.json',import.meta.url),'utf8'));
const edge=(s,p)=>s.modules['social.relationships'].edges[`jana--${p.playerId}`];
const markers=(s,id)=>s.turns[id].events.filter(e=>e.type===RULES_MARKER).length;
const stamped=t=>t.events.some(e=>e.type==='core.patch'&&e.payload.path[0]==='progression');
let seq=0;
const act=(s,p,amount,id=`g${++seq}`)=>execute(s,{id,actorId:p.playerId,type:'test.trust',args:{character:'jana',amount},expectedRevision:s.revision},p,mods).state;

test('R1 the flag is pack.progression.version: absent or 1 validates, 0 and 1.5 do not, and it is outside mechanicsDigest',()=>{
 assert.doesNotThrow(()=>validatePack(pack(),mods));
 assert.doesNotThrow(()=>validatePack(flagged(pack()),mods));
 for(const v of [0,1.5])assert.throws(()=>validatePack(pack(p=>{p.progression={version:v};}),mods),/progression\.version/,String(v));
 assert.equal(mechanicsDigest(flagged(pack())),mechanicsDigest(pack()));
});

test('R2 an old save with no stamp and no marker imports unchanged with the flag off or on',()=>{
 const fx=legacy();
 for(const p of [fx.pack,flagged(fx.pack)]){
  const s=validateImport(structuredClone(fx.portable),p,mods);
  assert.equal(s.progression,undefined,'stays unstamped');
  assert.equal(s.modules['social.relationships'].edges[`jana--${p.playerId}`],fx.expected.trust.jana);
  for(const id of Object.keys(fx.portable.state.turns))assert.equal(markers(s,id),0,`${id} has no marker`);
 }
});

test('R3 flag off: a new save writes no stamp or marker, and an explicit romanceStats cap still applies',()=>{
 let s=createWorld(pack(),mods,'gc22-off',42);const t0=edge(s,pack());
 s=act(s,pack(),10,'off-1');
 assert.equal(s.progression,undefined);
 assert.equal(markers(s,'off-1'),0);
 assert.equal(edge(s,pack())-t0,6);
});

test('R4 flag on: the first turn stamps and writes exactly one marker per capped-gain turn',()=>{
 const p=flagged(pack());let s=createWorld(p,mods,'gc22-on',42);
 s=act(s,p,4,'on-1');
 assert.equal(s.progression.cutover.turn,'on-1');
 assert.ok(stamped(s.turns['on-1']));
 s=act(s,p,4,'on-2');
 assert.equal(markers(s,'on-1'),1);
 assert.equal(markers(s,'on-2'),1);
 assert.equal(s.progression.cutover.turn,'on-1','stamp stays on the first turn');
});

test('R5 mixed: an old save that gets the flag keeps its earlier turns byte-identical and stamps only from the next turn',()=>{
 const fx=legacy();let s=validateImport(structuredClone(fx.portable),fx.pack,mods);
 const p=flagged(fx.pack);
 s=act(s,p,20,'mix-1');s=act(s,p,9,'mix-2');
 assert.equal(s.progression.cutover.turn,'mix-1');
 for(const id of Object.keys(fx.portable.state.turns))assert.deepEqual(s.turns[id].events,fx.portable.state.turns[id].events,`${id} unchanged`);
 assert.equal(validateImport(exportCampaign(s),p,mods).progression.version,1);
});

test('R6 the marker pins the cap a saved turn used; a later cap edit does not rewrite it',()=>{
 const p=flagged(pack());let s=createWorld(p,mods,'gc22-pin',42);
 s=act(s,p,10,'pin-1');
 const v=edge(s,p),edited=flagged(pack(q=>{q.romanceStats={dailyGain:2};}));
 assert.equal(edge(validateImport(exportCampaign(s),edited,mods),p),v);
});

test('R7 a stamped save whose capped-gain turn lost its marker is rejected by event history',()=>{
 const p=flagged(pack());let s=createWorld(p,mods,'gc22-miss',42);
 s=act(s,p,4,'miss-1');s=act(s,p,4,'miss-2');
 const d=structuredClone(exportCampaign(s));d.state.turns['miss-2'].events=d.state.turns['miss-2'].events.filter(e=>e.type!==RULES_MARKER);
 assert.throws(()=>validateImport(d,p,mods),/Event history is inconsistent/);
});

test('R8 a stamp that is removed or moved is rejected; a version-2 marker is rejected',()=>{
 const p=flagged(pack());let s=createWorld(p,mods,'gc22-tamper',42);
 s=act(s,p,4,'tp-1');s=act(s,p,4,'tp-2');
 const base=exportCampaign(s),copy=()=>structuredClone(base);
 const d1=copy();delete d1.state.progression;
 assert.throws(()=>validateImport(d1,p,mods),/Progression stamp does not match/);
 const d2=copy();d2.state.progression.cutover.turn='tp-2';
 assert.throws(()=>validateImport(d2,p,mods),/Progression stamp does not match/);
 const d3=copy();d3.state.turns['tp-1'].events.find(e=>e.type===RULES_MARKER).payload.version=2;
 assert.throws(()=>validateImport(d3,p,mods),/Unsupported progression rules/);
});

test('R9 an unknown progression version (2) is refused by execute and by import of a version-1 save',()=>{
 const v2=pack(q=>{q.progression={version:2};});
 assert.throws(()=>execute(createWorld(v2,mods,'gc22-v2',42),{id:'v2-1',actorId:v2.playerId,type:'test.trust',args:{character:'jana',amount:4},expectedRevision:0},v2,mods),/Progression version 2 is not supported/);
 const p=flagged(pack());const s=act(createWorld(p,mods,'gc22-v2import',42),p,4,'v2i-1');
 assert.throws(()=>validateImport(exportCampaign(s),{...p,progression:{version:2}},mods),/Progression version 2 is not supported/);
});
