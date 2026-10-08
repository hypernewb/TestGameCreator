import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {sceneDraftNeeds,sceneDraftMessages,sceneDraftPatch,SCENE_LIMITS} from '../packages/ai/scene-draft.mjs';
import {sceneCoverage} from '../public/scene-coverage.mjs';
import {clone} from '../packages/core/engine.mjs';
const fantasy=JSON.parse(readFileSync(new URL('../packs/template-fantasy-town.json',import.meta.url),'utf8'));
const source=readFileSync(new URL('../public/studio.mjs',import.meta.url),'utf8');
const ada={id:'ada',name:'Ada',personality:'Ada is a blunt cartographer.',inBed:'Bossy, quick to laugh.',sexStyle:{}};
const pack=()=>{const p=clone(fantasy);p.intimacyCategories=[{id:'fling',name:'Fling'}];return p;};

test('scene draft asks only for empty fields and keeps authored beats and aftermath',()=>{
 assert.deepEqual(sceneDraftNeeds({category:'fling'}),['beats','aftermath']);
 assert.deepEqual(sceneDraftNeeds({category:'fling',beats:[{text:'Kiss.'}]}),['aftermath']);
 assert.deepEqual(sceneDraftNeeds({category:'fling',beats:[{text:'Kiss.'}],aftermath:'Done.'}),[]);
 const req=sceneDraftMessages(pack(),ada,{category:'fling',notes:'On the cliff at dusk.',beats:[{text:'Kiss.'}]});
 assert.deepEqual(Object.keys(req.schema.properties),['aftermath']);
 const text=req.messages.map(m=>m.content).join('\n');assert.match(text,/Scene category: Fling/);assert.match(text,/On the cliff at dusk/);assert.match(text,/Ada is a blunt cartographer/);
});

test('scene draft patch clamps to limits, drops empty check-ins, and never overwrites written fields',()=>{
 const raw={beats:[{text:'  Ada  leans in. ',checkIn:' Okay? '},{text:'Pulled close.',checkIn:''},{text:'   ',checkIn:'x'},...Array.from({length:14},(_,i)=>({text:'b'+i,checkIn:''}))],aftermath:'  She laughs about it later. '};
 const p=sceneDraftPatch({category:'fling'},raw);
 assert.deepEqual(p.beats[0],{text:'Ada leans in.',checkIn:'Okay?'});assert.deepEqual(p.beats[1],{text:'Pulled close.'});
 assert.equal(p.beats.length,SCENE_LIMITS.beats);assert.equal(p.aftermath,'She laughs about it later.');
 assert.equal(sceneDraftPatch({category:'fling',beats:[{text:'Kiss.'}]},raw).beats,undefined);
 assert.equal(sceneDraftPatch({category:'fling',aftermath:'Done.'},raw).aftermath,undefined);
 assert.deepEqual(sceneDraftPatch({category:'fling'},{beats:[{text:'x'.repeat(900)}]}).beats[0].text.length,SCENE_LIMITS.text);
 assert.deepEqual(sceneDraftPatch({category:'fling'},null),{});
});

test('scene draft endpoint retries once when the first answer has no usable beats',async()=>{
 const {mkdtempSync,rmSync}=await import('node:fs'),{tmpdir}=await import('node:os'),{join}=await import('node:path'),{createApp}=await import('../server.mjs'),{CompatibleProvider}=await import('../packages/ai/providers.mjs');
 const dir=mkdtempSync(join(tmpdir(),'scene-retry-')),bodies=[];
 const fetchImpl=async(url,init)=>{bodies.push(init.body);const value=bodies.length===1?{beats:[],aftermath:''}:{beats:[{text:'Ada pulls him onto the dock.',checkIn:'Still good?'},{text:'Slow, then not.',checkIn:''},{text:'Sitting on the boards, laughing.',checkIn:''}],aftermath:'They walk back slowly.'};return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(value)},finish_reason:'stop'}]}),{status:200,headers:{'Content-Type':'application/json'}});};
 const provider=new CompatibleProvider({endpoint:'http://127.0.0.1:1234/v1/chat/completions',model:'stub',fetchImpl,maxTokens:2048}),app=createApp({dataPath:':memory:',scenarioDir:dir,provider});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 try{const r=await fetch(`http://127.0.0.1:${app.server.address().port}/api/studio/ai-scene-draft`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pack:pack(),actor:ada,scene:{category:'fling',notes:'Dock at night.'}})}),j=await r.json();
  assert.equal(r.status,200);assert.equal(bodies.length,2);assert.match(bodies[1],/Nothing usable came back/);assert.deepEqual(j.filled.sort(),['aftermath','beats']);assert.equal(j.patch.beats.length,3);assert.equal(j.patch.aftermath,'They walk back slowly.');
 }finally{await new Promise(r=>app.server.close(r));app.store.close();rmSync(dir,{recursive:true,force:true});}
});

test('scene art coverage counts scene images and beat images per character',()=>{
 const p={modules:{'social.intimacy':'0.1.0'},actors:[{id:'ada',name:'Ada'},{id:'bo',name:'Bo'}],intimacyProfiles:[{character:'ada',scenes:[
  {category:'fling',cg:'assets/cg/a.png',beats:[{text:'a',cg:'assets/cg/a1.png'},{text:'b'}]},
  {category:'first-night',beats:[{text:'c',cg:'assets/cg/c.png'}]}]},{character:'bo',scenes:[]}]};
 const {rows,summary}=sceneCoverage(p);
 assert.deepEqual(rows.map(r=>[r.character,r.category,r.scene,r.beats,r.beatsWithCg,r.complete]),[['ada','fling',true,2,1,false],['ada','first-night',false,1,1,false]]);
 assert.deepEqual(summary,{scenes:2,withSceneCg:1,beats:3,beatsWithCg:2,complete:0});
 assert.deepEqual(sceneCoverage({modules:{},actors:[],intimacyProfiles:[]}).summary,{scenes:0,withSceneCg:0,beats:0,beatsWithCg:0,complete:0});
});

test('Studio wires the scene draft button and the coverage panel into each sex scene',()=>{
 assert.match(source,/sceneDraftButton\(card,p,o,scene\);beatsEditor\(card,scene\)/);assert.match(source,/coveragePanel\(ero,p,o\);sex\.scenes/);
 assert.match(source,/api\('\/api\/studio\/ai-scene-draft'/);assert.match(source,/import \{sceneCoverage\} from '\.\/scene-coverage\.mjs'/);
});
