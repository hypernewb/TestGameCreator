import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.mjs';

// M2 wizard API: propose -> edit proposal -> fill card by card -> edit / redraft a card -> save as a new, playable campaign.
const proposal={title:'Harbour Lights',premise:'You crew a ferry for one summer.',setting:'A harbour town.',player:{name:'Sam',age:23},
 places:[{name:'Crew Bunk',kind:'home'},{name:'The Quay',kind:'outdoors'},{name:'Salt Bar',kind:'bar'}],items:[{name:'Rum',at:'Salt Bar',price:'cheap',drink:true},{name:'Compass',at:'Salt Bar',price:'pricey'}],
 activities:[{name:'Bar shift',at:'Salt Bar',gives:'money'},{name:'Haul ropes',at:'The Quay',gives:'fitness',with:'Mara'}],weather:[{name:'Fog',text:'Grey.'}],
 heroines:[{name:'Mara',age:29,temperament:'guarded',pace:'slow',home:'The Quay',hangouts:['Salt Bar'],topic:'old maps',loved:'Compass',dislikes:['boasting']}]};
const asked=m=>[...m.at(-1).content.matchAll(/^"([^"]+)":/gm)].map(x=>x[1]);
let n=0;const drafter=async m=>m[1].content.startsWith('Premise:')?JSON.stringify(proposal):JSON.stringify(Object.fromEntries(asked(m).map(p=>[p,`v${n} ${p}`])));

test('the creator API takes a premise to a saved, playable campaign and reopens it',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'creator-')),app=createApp({dataPath:':memory:',scenarioDir:dir,drafter});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${app.server.address().port}`,call=async(path,body)=>{const r=await fetch(base+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});return {status:r.status,data:await r.json()};};
 try{
  const p=await call('/api/creator/propose',{premise:'A ferry summer',heroines:1});assert.equal(p.status,200);assert.equal(p.data.proposal.title,'Harbour Lights');assert.ok(p.data.missing.length>50);assert.equal(p.data.batches[0].id,'world');
  const edited={...p.data.proposal,heroines:[{...p.data.proposal.heroines[0],age:17}]};assert.match((await call('/api/creator/structure',{proposal:edited})).data.error,/18 or more/);
  let {data:{spec,batches}}=await call('/api/creator/structure',{proposal:{...p.data.proposal,title:'Harbour Nights'}});
  const rough=await call('/api/creator/save',{spec});assert.equal(rough.status,200,JSON.stringify(rough.data));assert.ok(rough.data.improvised>20,'blanks are saved for the AI to improvise');
  const roughPack=app.packs[rough.data.packId];assert.equal(roughPack.title,'Harbour Nights');assert.ok(roughPack.firsts.every(f=>f.title&&f.opening&&f.checkpoints.every(c=>c.cue)),'blank firsts play free with plain cues');
  assert.equal((await call('/api/load',{id:rough.data.campaignId})).status,200);
  for(const b of batches){const r=await call('/api/creator/fill',{spec,batch:b.id});assert.equal(r.status,200);spec=r.data.spec;}
  const done=await call('/api/creator/check',{spec});assert.deepEqual(done.data.missing,[]);
  spec.heroines[0].rungs.talk.opening='Owner edit.';n=1;const redo=(await call('/api/creator/fill',{spec,batch:'mara:talk',redo:true})).data;
  assert.equal(redo.spec.heroines[0].rungs.talk.opening,'v1 heroines.mara.rungs.talk.opening','Redraft rewrites the whole card');assert.ok(redo.filled.length>5);assert.deepEqual(redo.missing,[]);
  assert.equal(redo.spec.heroines[0].rungs.date.opening,spec.heroines[0].rungs.date.opening,'other cards are untouched');assert.equal(redo.spec.heroines[0].actor.name,'Mara');
  const saved=await call('/api/creator/save',{spec:redo.spec,proposal:p.data.proposal,from:rough.data.from});assert.equal(saved.status,200);assert.match(saved.data.packId,/^harbour-nights-/);assert.equal(saved.data.improvised,0);
  assert.ok(app.packs[saved.data.packId]);assert.ok(app.store.list().some(c=>c.id===saved.data.campaignId));assert.equal(readdirSync(join(dir,'published')).length,2);
  const offer=(await call(`/api/update?id=${rough.data.campaignId}`)).data.update;assert.equal(offer.packId,saved.data.packId,'the rough save is offered the finished world');
  const load=await call('/api/load',{id:saved.data.campaignId});assert.equal(load.status,200);
  const o=(await call('/api/creator/options')).data;assert.ok(o.temperaments.guarded);assert.deepEqual(o.paces,['slow','steady','easy','casual']);assert.equal(o.drafter,true);
  const worlds=(await call('/api/creator/worlds')).data.worlds;assert.equal(worlds[0].id,saved.data.packId);
  const back=(await call(`/api/creator/world?id=${saved.data.packId}`)).data;assert.equal(back.spec.heroines[0].rungs.talk.opening,'v1 heroines.mara.rungs.talk.opening');assert.equal(back.proposal.title,'Harbour Lights');
  assert.match((await call('/api/creator/world?id=../x')).data.error,/Invalid world id/);
 }finally{await new Promise(r=>app.server.close(r));app.store.close();rmSync(dir,{recursive:true,force:true});}
});

test('without a drafter key the creator says how to set one up',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'creator-')),key=process.env.OPENROUTER_API_KEY;delete process.env.OPENROUTER_API_KEY;const app=createApp({dataPath:':memory:',scenarioDir:dir});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 try{const r=await fetch(`http://127.0.0.1:${app.server.address().port}/api/creator/propose`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({premise:'x'})});assert.match((await r.json()).error,/OPENROUTER_API_KEY/);}
 finally{if(key)process.env.OPENROUTER_API_KEY=key;await new Promise(r=>app.server.close(r));app.store.close();rmSync(dir,{recursive:true,force:true});}
});

test('fill drafts several cards in parallel; a failed card stays missing and says why',async()=>{
 const flaky=async m=>{if(m[1].content.startsWith('Premise:'))return JSON.stringify(proposal);if(asked(m).some(p=>p.includes('.rungs.kiss.')))throw new Error('rate limited');return drafter(m);};
 const dir=mkdtempSync(join(tmpdir(),'creator-')),app=createApp({dataPath:':memory:',scenarioDir:dir,drafter:flaky});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const post=async(path,body)=>(await fetch(`http://127.0.0.1:${app.server.address().port}${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})).json();
 try{const s=await post('/api/creator/structure',{proposal});assert.deepEqual(s.cards.map(c=>c.id),['world','mara:profile','mara:talk','mara:date','mara:kiss','mara:night','director:event','director:obstacle','director:goal']);assert.ok(s.cards[2].paths.includes('heroines.mara.rungs.talk.opening'));
  const r=await post('/api/creator/fill',{spec:s.spec,batches:s.cards.slice(0,6).map(c=>c.id)});assert.deepEqual(r.batches.map(b=>b.id),['mara:kiss','director:event','director:obstacle','director:goal'],'the director cards wait for the next round (6 per call)');assert.match(r.errors[0],/mara:kiss: rate limited/);assert.equal(r.cards.length,9);}
 finally{await new Promise(r=>app.server.close(r));app.store.close();rmSync(dir,{recursive:true,force:true});}
});

test('a character card seeds the premise and its heroine, keeps her voice in every draft, and refuses minors',async()=>{
 const seen=[],spy=async m=>{seen.push(m.map(x=>x.content).join('\n'));return drafter(m);};
 const dir=mkdtempSync(join(tmpdir(),'creator-')),app=createApp({dataPath:':memory:',scenarioDir:dir,drafter:spy});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const post=async(path,body)=>(await fetch(`http://127.0.0.1:${app.server.address().port}${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})).json();
 const card={spec:'chara_card_v2',data:{name:'Mara',description:'{{char}} captains the night ferry. Salt-cracked laugh, 29.',scenario:'A ferry summer on a cold coast.',first_mes:'{{char}} tosses {{user}} a rope.',tags:['romance']}};
 try{const seed=await post('/api/creator/card',{card:JSON.stringify(card)});assert.equal(seed.name,'Mara');assert.equal(seed.premise,'A ferry summer on a cold coast.');assert.match(seed.text,/Mara captains the night ferry[\s\S]*Opening: Mara tosses the player a rope/);
  assert.match((await post('/api/creator/card',{card:{...card,data:{...card.data,description:'She is 16 and new in town.'}}})).error,/under 18/);
  assert.match((await post('/api/creator/card',{card:{...card,data:{...card.data,tags:['Teen']}}})).error,/under 18/);
  assert.ok(!(await post('/api/creator/card',{card:{...card,data:{...card.data,description:'She is 29; her sister is 7 years younger.'}}})).error,'other numbers are fine');
  assert.ok(!(await post('/api/creator/card',{card:{...card,data:{...card.data,description:'Age 24, 165cm. Age 10 she ran away; age 15 she took her first job. She is 5 foot 4.'}}})).error,'backstory ages next to an adult age are fine');
  assert.match((await post('/api/creator/card',{card:{...card,data:{...card.data,description:'Age 10 she ran away. Age 15 she took her first job.'}}})).error,/under 18/,'only minor ages is refused');
  assert.equal((await post('/api/creator/card',{card:{...card,data:{...card.data,description:'![pic](https://x.io/a.png =100%)\n\n-----\n<span style="color:red">Keeper</span> of [the light](https://x.io).'}}})).text.split('\n')[0],'Keeper of the light.','markdown images, links, html and rules are stripped');
  const p=await post('/api/creator/propose',{premise:seed.premise,heroines:1,card:{name:seed.name,text:seed.text}});assert.match(seen[0],/first love interest is Mara from this character card[\s\S]*captains the night ferry/);
  assert.equal(p.proposal.card.name,'Mara');assert.equal(p.spec.source.card.heroine,'mara');assert.deepEqual(p.notes.filter(n=>/card/.test(n)),[]);
  const s=await post('/api/creator/structure',{proposal:p.proposal});assert.equal(s.spec.source.card.heroine,'mara','editing the proposal keeps the card');
  await post('/api/creator/fill',{spec:s.spec,batches:['world','mara:talk']});assert.ok(seen.slice(1).every(t=>/Mara's character card[\s\S]*night ferry/.test(t)),'world and scene drafts see the card');
  assert.match((await post('/api/creator/structure',{proposal:{...p.proposal,card:{name:'Zed',text:'x'}}})).notes.join(),/no love interest is named Zed/);}
 finally{await new Promise(r=>app.server.close(r));app.store.close();rmSync(dir,{recursive:true,force:true});}
});
