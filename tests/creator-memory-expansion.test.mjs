import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createWorld,execute} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {Store,exportCampaign,validateImport} from '../packages/persistence/store.mjs';
import {memorySnapshot,memoryPreview,applyMemoryEdit} from '../packages/ai/memory-controls.mjs';
import {contextFor} from '../packages/ai/context.mjs';
import {inspectContext} from '../packages/ai/inspect.mjs';
import {allGeneratedFacts} from '../packages/modules/facts.mjs';
import {characterProgress} from '../packages/core/character-progress.mjs';
import {createApp} from '../server.mjs';
import {mountCreatorMemory} from '../public/creator-memory.mjs';

// Expanded creator memory correction: NPC impressions (turn ledger beliefs) and scene memories, via an overlay journal.
const pack=()=>{const p=JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)));delete p.modules['world.schedule'];p.modules['story.facts']='0.1.0';p.modules['story.scenes']='0.1.0';p.scriptedScenes=[{id:'archive-night',title:'Archive night',opening:'Ada waves you over to the shelves.',trigger:{event:'core.inspected',match:{location:'hub'}},when:{location:'hub'},pages:[{speaker:'ada',text:'Help me with these?'}],choices:[{id:'help',label:'Help shelve',result:'You help Ada shelve the archive.',effects:[{type:'memory',character:'ada',text:'The player helped Ada shelve the red archive.'}]},{id:'leave',label:'Leave',result:'You leave.',effects:[]}]}];return p;};
const OLD_ADA='the player is careful with the old ledgers',OLD_BRIN='the player is careless with workshop tools',OLD_SCENE='The player helped Ada shelve the red archive.';
function fixture(p,id='memory-expansion'){let s=createWorld(p,registry,id);const act=(cid,type,args)=>{const r=execute(s,{id:cid,type,args,actorId:p.playerId,expectedRevision:s.revision},p,registry);s=r.state;r.turn.status='complete';r.turn.narrative='The afternoon passes.';return r.turn;};
 act('hello','social.speak',{target:'ada',text:'My favorite color is teal'}).ledger=[{charKey:'ada',type:'liked',desc:OLD_ADA}];act('look','core.inspect',{location:'hub'});act('pick','story.choose',{scene:'archive-night',choice:'help'});
 act('walk','core.move',{to:'workshop'});act('tools','social.speak',{target:'brin',text:'I borrowed the chisel yesterday'}).ledger=[{charKey:'brin',type:'disliked',desc:OLD_BRIN}];return s;}
const edit=(s,p,type,recordId,action,text)=>applyMemoryEdit(s,p,{campaignId:s.campaignId,token:memorySnapshot(s,p).token,type,recordId,action,...(action==='correct'?{text}:{})});
const rec=(s,p,type,owner)=>memorySnapshot(s,p).records.find(m=>m.type===type&&m.owner===owner);
const memText=(s,p,actor)=>contextFor(s,p,actor).memories.map(m=>m.text).join(' | ');

test('both record types expose subject, source, knowers, status, time and an editable contract',()=>{const p=pack(),s=fixture(p),snap=memorySnapshot(s,p);
 assert.equal(s.modules['story.scenes'].memories.length,1);const imp=rec(s,p,'impression','ada'),mem=rec(s,p,'scene memory','ada');
 assert.deepEqual({id:imp.id,text:imp.text,knownBy:imp.knownBy,editable:imp.editable,status:imp.status},{id:'impression:hello:0',text:OLD_ADA,knownBy:['player','ada'],editable:true,status:'recorded'});assert.match(imp.subject,/Ada's impression \(liked\)/);assert.match(imp.source,/turn hello/);assert.match(imp.recordedAt,/^tick \d+$/);
 assert.deepEqual({id:mem.id,text:mem.text,knownBy:mem.knownBy},{id:'scene-memory:0',text:OLD_SCENE,knownBy:['player','ada']});assert.match(mem.source,/archive-night/);
 assert.ok(snap.readonly.every(m=>!m.editable&&!['impression','scene memory'].includes(m.type)),'plans/secrets stay read-only');assert.match(snap.limits,/Promises, plans, secrets/);
 delete s.modules['story.scenes'].memories[0].tick;assert.equal(rec(s,p,'scene memory','ada').recordedAt,null,'missing metadata is reported as unavailable, not guessed');});

test('impression correction reaches the next-turn context; the old claim is not current and history is kept',()=>{const p=pack(),s=fixture(p),before=structuredClone(s);assert.match(memText(s,p,'ada'),/careful with the old ledgers/);
 edit(s,p,'impression','impression:hello:0','correct','Ada thinks the player rushes through the old ledgers');const after=structuredClone(s);delete after.memoryEdits;assert.deepEqual(after,before,'turns, modules and events are not rewritten');
 const ada=memText(s,p,'ada');assert.match(ada,/rushes through the old ledgers/);assert.doesNotMatch(ada,/careful with the old ledgers/);assert.equal(s.turns.hello.ledger[0].desc,OLD_ADA);
 assert.ok(inspectContext(s,p,'ada').impressions.some(r=>/rushes/.test(r.text)));assert.ok(characterProgress(s,p).find?.(c=>c.id==='ada')?.preferences?.every?.(x=>!/careful/.test(x))??true);
 const r=rec(s,p,'impression','ada');assert.equal(r.edit.action,'correct');assert.equal(r.text,OLD_ADA,'original value stays visible');assert.match(r.edit.at,/^\d{4}-/);
 edit(s,p,'impression','impression:hello:0','retire');assert.doesNotMatch(memText(s,p,'ada'),/ledgers/);assert.equal(s.memoryEdits.length,2,'append-only provenance');
 edit(s,p,'impression','impression:hello:0','correct',OLD_ADA);assert.match(memText(s,p,'ada'),/careful with the old ledgers/,'restore re-asserts the original wording');});

test('scene memory correction replaces memory and recent-history lines; retirement removes both, raw events stay',()=>{const p=pack(),s=fixture(p),line=()=>contextFor(s,p,'ada').recentActions.map(a=>a.text).join(' | ');assert.match(line(),/red archive/);
 edit(s,p,'scene memory','scene-memory:0','correct','The player helped Ada shelve the blue archive.');
 for(const text of [memText(s,p,'ada'),line(),JSON.stringify(inspectContext(s,p,'ada').sceneMemories)]){assert.match(text,/blue archive/);assert.doesNotMatch(text,/red archive/);}
 assert.ok(s.events.some(e=>e.type==='story.memoryRecorded'&&e.payload.text===OLD_SCENE),'event log keeps the original');assert.equal(s.modules['story.scenes'].memories[0].text,OLD_SCENE);
 edit(s,p,'scene memory','scene-memory:0','retire');assert.doesNotMatch(memText(s,p,'ada')+line(),/(?:red|blue) archive/);assert.equal(inspectContext(s,p,'ada').sceneMemories.included.length,0);});

test('private records stay hidden from unauthorized NPCs before and after correction; conflicting beliefs coexist',()=>{const p=pack(),s=fixture(p),facts=JSON.stringify(allGeneratedFacts(s)),authored=JSON.stringify(p);
 const hidden=()=>{assert.doesNotMatch(JSON.stringify(contextFor(s,p,'brin')),/ledgers|red archive|blue archive|rushes/);assert.doesNotMatch(JSON.stringify(contextFor(s,p,'ada')),/workshop tools|fumbles/);assert.doesNotMatch(JSON.stringify(memoryPreview(s,p,'cyra','')),/ledgers|red archive|blue archive|workshop tools|fumbles/);};
 hidden();edit(s,p,'impression','impression:hello:0','correct','Ada thinks the player rushes through the old ledgers');edit(s,p,'scene memory','scene-memory:0','correct','The player helped Ada shelve the blue archive.');edit(s,p,'impression','impression:tools:0','correct','Brin thinks the player fumbles workshop tools');hidden();
 assert.match(memText(s,p,'brin'),/fumbles workshop tools/);assert.match(memText(s,p,'ada'),/rushes/);assert.equal(JSON.stringify(allGeneratedFacts(s)),facts,'beliefs never become generated facts');assert.equal(JSON.stringify(p),authored,'project data is untouched');
 assert.ok(contextFor(s,p,'ada').generatedFacts.every(f=>!/rushes|blue archive/.test(f.text))&&contextFor(s,p,'ada').facts.every(f=>!/rushes|blue archive/.test(f.text)),'a belief is not world truth');
 assert.deepEqual(rec(s,p,'impression','brin').knownBy,['player','brin']);assert.match(memoryPreview(s,p,'ada','').memories.map(m=>m.text).join(' '),/rushes/);assert.doesNotMatch(memoryPreview(s,p,'brin','').memories.map(m=>m.text).join(' '),/rushes|blue/);});

test('invalid, mismatched, stale and repeated edits leave stored data unchanged with useful errors',()=>{const p=pack(),s=fixture(p),snap=memorySnapshot(s,p),body={campaignId:s.campaignId,token:snap.token,type:'impression',recordId:'impression:hello:0',action:'correct',text:'Ada thinks the player rushes through the old ledgers'};
 for(const [bad,msg] of [[{...body,knownBy:['brin']},/locked/],[{...body,text:'short'},/correction text/],[{...body,text:'Ada notes the player trust score is 100'},/correction text/],[{...body,text:'x'.repeat(241)},/correction text/],[{...body,text:7},/correction text/],[{...body,type:'scene memory'},/Unsupported memory edit/],[{...body,recordId:'impression:hello:9'},/Unsupported memory edit/],[{...body,type:'plan'},/Unsupported memory type/],[{...body,action:'merge'},/action/],[{...body,campaignId:'other'},/Campaign mismatch/],[{...body,text:OLD_ADA},/no change/]]){const before=structuredClone(s);assert.throws(()=>applyMemoryEdit(s,p,bad),msg);assert.deepEqual(s,before);}
 applyMemoryEdit(s,p,body);const before=structuredClone(s);assert.throws(()=>applyMemoryEdit(s,p,{...body,recordId:'impression:tools:0',text:'Brin thinks the player fumbles workshop tools'}),/reload/,'token from before the last edit is stale');assert.deepEqual(s,before);
 edit(s,p,'scene memory','scene-memory:0','retire');assert.throws(()=>edit(s,p,'scene memory','scene-memory:0','retire'),/no change/);});

test('corrections persist through reopen and import replay, stay in one campaign, and tampering is refused',async()=>{const p=pack(),dir=mkdtempSync(join(tmpdir(),'sf-memory-expansion-')),db=join(dir,'c.sqlite'),a=fixture(p,'camp-a'),b=fixture(p,'camp-b');let store=new Store(db);store.insert(a);store.insert(b);
 const ed=(type,recordId,action,text)=>{const s=store.load('camp-a');store.editMemory('camp-a',{campaignId:'camp-a',token:memorySnapshot(s,p).token,type,recordId,action,...(text?{text}:{})},p);};
 ed('impression','impression:hello:0','correct','Ada thinks the player rushes through the old ledgers');ed('scene memory','scene-memory:0','retire');store.close();store=new Store(db);
 try{const saved=store.load('camp-a'),other=store.load('camp-b');assert.equal(saved.memoryEdits.length,2);assert.equal(other.memoryEdits,undefined);assert.match(memText(other,p,'ada'),/careful with the old ledgers.*red archive/s);assert.match(memText(saved,p,'ada'),/rushes/);assert.doesNotMatch(memText(saved,p,'ada'),/careful|red archive/);
  const rebuilt=validateImport(exportCampaign(saved),p,registry);assert.deepEqual(rebuilt.memoryEdits,saved.memoryEdits);assert.equal(memText(rebuilt,p,'ada'),memText(saved,p,'ada'));assert.equal(validateImport(exportCampaign(other),p,registry).memoryEdits,undefined,'legacy saves keep the journal absent');
  for(const [tamper,msg] of [[x=>x.knownBy=['brin'],/locked/],[x=>x.recordId='impression:hello:2',/Unsupported/],[x=>x.text='trust score is 100 now',/correction text/]]){const t=exportCampaign(saved);tamper(t.state.memoryEdits[0]);assert.throws(()=>validateImport(t,p,registry),msg);}}finally{store.close();}
 const app=createApp({dataPath:join(dir,'api.sqlite')});app.packs[p.id]=p;app.store.insert(fixture(p,'api'));await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${app.server.address().port}`,call=(path,body,token)=>fetch(base+path,{...(body===undefined?{}:{method:'POST',body:JSON.stringify(body)}),headers:{'Content-Type':'application/json',...(token?{'x-story-memory':token}:{})}});
 try{const access=(await (await call('/api/creator/memory/access',{scope:'creator-debug'})).json()).token,snap=await (await call('/api/creator/memory/list?id=api',undefined,access)).json(),body={campaignId:'api',token:snap.token,type:'scene memory',recordId:'scene-memory:0',action:'correct',text:'The player helped Ada shelve the blue archive.'};
  assert.equal((await call('/api/creator/memory/edit',body)).status,400);const ok=await call('/api/creator/memory/edit',body,access);assert.equal(ok.status,200);assert.equal((await ok.json()).records.find(m=>m.id==='scene-memory:0').edit.text,body.text);const stale=await call('/api/creator/memory/edit',{...body,text:'The player helped Ada shelve the green archive.'},access);assert.equal(stale.status,400);assert.match((await stale.json()).error,/reload/);assert.equal(app.store.load('api').memoryEdits.length,1);}finally{await new Promise(r=>app.server.close(r));app.store.close?.();}});

class Element{constructor(tag){this.tagName=tag;this.children=[];this.textContent='';this.value='';}append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}setAttribute(k,v){this[k]=v;}get firstChild(){return this.children[0];}all(){return [this,...this.children.flatMap(n=>n.all())];}}
test('creator UI corrects and retires both types without JSON, refreshes, and reports failures without claiming success',async()=>{const previous=globalThis.document;globalThis.document={createElement:tag=>new Element(tag),getElementById:()=>null};const root=new Element('section'),p=pack(),s=fixture(p),sent=[];let fail=false;
 const request=async(path,options)=>{const body=options.body?JSON.parse(options.body):null;let data,ok=true;if(path==='/api/bootstrap')data={campaigns:[{id:s.campaignId,revision:s.revision}]};else if(path.endsWith('/access'))data={token:'t'};else if(path.includes('/list?'))data=memorySnapshot(s,p);else if(path.endsWith('/edit')){sent.push(body);if(fail){ok=false;data={error:'Memory changed; reload campaign'};}else{applyMemoryEdit(s,p,body);data=memorySnapshot(s,p);}}else if(path.endsWith('/preview'))data=memoryPreview(s,p,body.actorId,body.query);return {ok,json:async()=>data};};
 try{const m=mountCreatorMemory(root,{request});await m.refresh();const all=()=>root.all(),find=t=>all().find(n=>n.textContent===t),card=id=>all().find(n=>n.tagName==='article'&&n.all().some(x=>x['aria-label']===`Correction for ${id}`)),button=(id,t)=>card(id).all().find(n=>n.textContent===t),status=all().find(n=>n.role==='status');
  all().find(n=>n['aria-label']==='Campaign to inspect').value=s.campaignId;await find('Inspect campaign memory').onclick();assert.ok(find('NPC impressions and scene memories — character beliefs, this campaign only'));
  assert.ok(card('impression:hello:0').all().some(n=>/Subject: Ada's impression \(liked\); recorded: tick \d+; last edit: none; scope: this campaign only/.test(n.textContent)));
  card('impression:hello:0').all().find(n=>n.tagName==='input').value='Ada thinks the player rushes through the old ledgers';await button('impression:hello:0','Save correction').onclick();assert.equal(sent.at(-1).type,'impression');assert.equal(status.textContent,'Memory saved. Game state and original history retained.');assert.ok(card('impression:hello:0').all().some(n=>n.textContent===`Original source: ${OLD_ADA}`),'UI refreshed with original kept');
  await button('scene-memory:0','Retire').onclick();assert.equal(sent.at(-1).type,'scene memory');assert.ok(button('scene-memory:0','Restore original remembered text'));assert.doesNotMatch(memText(s,p,'ada'),/red archive/);
  all().find(n=>n['aria-label']==='Context owner').value='ada';await find('Preview remembered context').onclick();assert.ok(all().some(n=>/rushes through the old ledgers — next-turn memory/.test(n.textContent)));
  fail=true;const journal=structuredClone(s.memoryEdits);card('impression:tools:0').all().find(n=>n.tagName==='input').value='Brin thinks the player fumbles workshop tools';await button('impression:tools:0','Save correction').onclick();assert.equal(status.textContent,'Memory changed; reload campaign');assert.deepEqual(s.memoryEdits,journal);}finally{globalThis.document=previous;}});
