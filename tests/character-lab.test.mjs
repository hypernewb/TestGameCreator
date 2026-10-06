import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createApp} from '../server.mjs';
import {registry} from '../packages/modules/index.mjs';
import {MockProvider} from '../packages/ai/providers.mjs';
import {createLab,labCast,stagesOf,stagePatch,parseLabScript,transcriptMarkdown} from '../packages/testing/character-lab.mjs';
import {importCharacterSheet} from '../public/sheet-editor.mjs';
import {runLabScript,loadScript,builtinScripts,providerFor} from '../scripts/character-lab.mjs';

const dir=mkdtempSync(join(tmpdir(),'sf-character-lab-'));
const app=createApp({dataPath:join(dir,'campaigns.sqlite'),scenarioDir:join(dir,'scenarios')});
const campus=app.packs['campus.ashford'],sample=app.packs['sample.living-world'];
const campusNpc=labCast(campus)[0].id,sampleNpc=labCast(sample)[0].id;
const npcOf=(pack,id)=>pack.actors.find(a=>a.id===id).name;

test('the lab builds for the campus pack and a non-campus pack, staged only with the chosen NPC',async()=>{
 for(const [pack,npc] of [[campus,campusNpc],[sample,sampleNpc]]){
  const lab=createLab({pack,registry,npcId:npc,provider:new MockProvider(),seed:42});
  assert.equal(lab.world.actors[lab.pack.playerId].location,lab.world.actors[npc].location,'player starts with the NPC');
  const row=await lab.turn('Hi — I don\'t think we\'ve met yet. I just started here.');
  assert.ok(row.text.length>10,'the mock pipeline produced a reply');
  assert.deepEqual(row.snapshot.scene.characters,[npc],'only the chosen NPC is in the scene');
  assert.equal(row.promptTokens,null,'mock turns report no token usage');
  assert.ok(row.ms>=0);
  const again=await lab.turn('What do you do when you\'re not working?');
  assert.deepEqual(again.snapshot.scene.characters,[npc],'the lab cast stays at one NPC');
  lab.store.close();
 }
});

test('mock lab output is deterministic across runs and stores no state in the real campaigns DB',async()=>{
 const dbFile=join(dir,'campaigns.sqlite'),before=app.store.list().length,bytes=readFileSync(dbFile);
 const texts=[];
 for(let run=0;run<2;run++){
  const lab=createLab({pack:sample,registry,npcId:sampleNpc,provider:new MockProvider(),seed:42});
  const rows=[];
  for(const line of ['Hello there.','Ask what she is working on.'])rows.push(await lab.turn(line));
  texts.push(rows.map(r=>r.text));lab.store.close();
 }
 assert.deepEqual(texts[0],texts[1],'same script and seed, same transcript');
 assert.equal(app.store.list().length,before,'no campaigns appeared in the app store');
 assert.ok(bytes.equals(readFileSync(dbFile)),'the real campaigns DB is byte-identical');
});

test('lab controls change state only through engine commands or labelled patches',async()=>{
 const lab=createLab({pack:campus,registry,npcId:campusNpc,provider:new MockProvider(),seed:42});
 await lab.turn('Hello there.');
 const modelCalls=lab.calls.length,tickBefore=lab.world.tick;
 const skip=await lab.skip('day');
 assert.ok(skip.ok&&lab.world.tick>tickBefore,'skipping a day advances the clock');
 assert.equal(lab.calls.length,modelCalls,'time skips never call the model');
 const snap=lab.snapshot();
 assert.ok(snap.daypart!==null&&snap.day>=1,'the snapshot shows the new day');
 const other=lab.world.modules['character.stats']?.values?.[`${lab.pack.playerId}--wit`];
 assert.ok(lab.setStat('charm',9));
 const after=lab.snapshot(),charm=after.stats.find(s=>s.character===lab.pack.playerId&&s.stat==='charm');
 assert.equal(charm.value,9);
 assert.equal(after.stats.find(s=>s.character===lab.pack.playerId&&s.stat==='wit')?.value,other,'other stats untouched');
 assert.equal(lab.world.modules['character.stats'].values[`${lab.pack.playerId}--charm`],9);
 await lab.turn('That was a long day.');
 lab.store.close();
});

test('jump-to-stage lands in the stage with its entry conditions shown as met',()=>{
 const npc=campusNpc,stages=stagesOf(campus,npc);
 assert.ok(stages.length>=2,'campus exposes authored stages for the lab');
 const lab=createLab({pack:campus,registry,npcId:npc,provider:new MockProvider(),seed:42});
 const target=stages.at(-1).id;
 assert.ok(lab.jumpToStage(target),'the jump applies');
 const snap=lab.snapshot();
 assert.equal(snap.stage.id,target,'the lab sits in the jumped-to stage');
 const entry=(campus.arcTracks||[]).find(t=>t.character===npc)?.stages?.find(s=>s.id===target)?.when||{};
 for(const [trait,min] of Object.entries(entry))assert.ok((snap.traits?.[trait]??0)>=(min??0),`entry condition ${trait} met`);
 assert.ok(lab.patches.length&&lab.patches.every(p=>p.label.startsWith('lab:')),'every stage patch is labelled as a lab patch');
 lab.store.close();
 // The pure progression path: stagePatch satisfies the incoming transition's requirements and sets the state.
 const fake={playerId:'player',modules:{'social.progression':'0.1.0'},relationshipStates:[{id:'stranger',name:'Stranger'},{id:'close',name:'Close'}],
  relationshipProgressions:[{character:'npc',initial:'stranger',transitions:[{from:'stranger',to:'close',event:'social.relationshipChanged',requires:{flags:{met:true},stats:[{character:'player',stat:'charm',min:6}]}}]}],
  statDefinitions:[{id:'charm',min:0,max:20}]};
 const patches=stagePatch(fake,'npc','close');
 assert.deepEqual(patches.map(p=>p.path.at(-1)),['met','player--charm','npc']);
 assert.equal(patches.find(p=>p.path.at(-1)==='player--charm').value,6);
 assert.equal(patches.find(p=>p.path.at(-1)==='npc').value,'close');
});

test('fork continues from turn N and reset rebuilds the world',async()=>{
 const lab=createLab({pack:sample,registry,npcId:sampleNpc,provider:new MockProvider(),seed:42});
 await lab.turn('Hello there.');await lab.turn('How is your day?');
 const forkAt=lab.rows[0].state,campaignBefore=lab.campaignId;
 const id=lab.fork(0);
 assert.notEqual(id,campaignBefore,'the fork is a new isolated campaign');
 assert.equal(lab.rows.length,1);
 assert.equal(JSON.stringify(lab.snapshot()),JSON.stringify(lab.rows[0].snapshot),'the forked lab sits at turn 0 state');
 const row=await lab.turn('Hello there again.');
 assert.equal(row.turn,1);
 lab.reset();
 assert.equal(lab.rows.length,0);
 await lab.turn('Hello there.');
 assert.ok(lab.rows[0].text.length>0,'a reset lab chats again');
 lab.store.close();
});

test('headless runs of both builtin scripts produce transcripts and metrics on mock',async()=>{
 assert.deepEqual(builtinScripts().sort(),['slow-player','stranger-to-close']);
 for(const name of ['stranger-to-close','slow-player']){
  const steps=parseLabScript(loadScript(name));
  assert.ok(steps.filter(s=>s.kind==='say').length>=8,`${name} has a real arc`);
  const lab=createLab({pack:campus,registry,npcId:campusNpc,provider:new MockProvider(),seed:42});
  const out=await runLabScript(lab,steps);
  assert.equal(out.steps.length,steps.length,'every scripted step ran');
  assert.equal(out.metrics.turns,steps.filter(s=>s.kind==='say').length,'metrics count conversation turns');
  assert.ok(out.metrics.dialogue.medianWords!==null,'dialogue metrics computed');
  assert.ok(out.metrics.stagePath.length>=1,'the stage path is tracked');
  assert.ok(out.metrics.latency.msAvg!==null,'per-turn latency recorded');
  assert.ok(out.markdown.includes('## Transcript')&&out.markdown.includes('Turn 1'),'the transcript exports as markdown');
  assert.ok(lab.patches.some(p=>p.label.includes('stage'))===false||out.summary.labPatches.length===lab.patches.length,'summary lists lab patches');
  const twice=createLab({pack:campus,registry,npcId:campusNpc,provider:new MockProvider(),seed:42});
  const again=await runLabScript(twice,steps);
  assert.deepEqual(again.steps.map(r=>r.text),out.steps.map(r=>r.text),`${name} is deterministic on mock`);
  lab.store.close();twice.store.close();
 }
});

test('lab goals are feature-detected: hidden on stock packs, shown with progress when the pack enables them',async()=>{
 for(const [pack,npc] of [[campus,campusNpc],[sample,sampleNpc]]){
  const lab=createLab({pack,registry,npcId:npc,provider:new MockProvider(),seed:42});
  await lab.turn('Hello there.');
  assert.deepEqual(lab.snapshot().goals,[],`${pack.id} enables no goals`);
  lab.store.close();
 }
 const p=structuredClone(sample),npc=sampleNpc;
 p.modules.goals='0.1.0';p.goalSettings={revealTrust:0};
 const sheet=importCharacterSheet(p,npc);sheet.personality.traits=['curious','practical'];sheet.goal={id:'song',title:'Write the song',why:'Finish the set',steps:[{id:'verse',title:'Write the verse',hint:'First verse',complete:{minTick:99999}},{id:'chorus',title:'Finish the chorus',hint:'The hook',complete:'narrative'}]};
 p.characterSheets=[...(p.characterSheets||[]).filter(s=>s.actorId!==npc),sheet];
 const lab=createLab({pack:p,registry,npcId:npc,provider:new MockProvider(),seed:42});
 await lab.turn('Hello there.');
 const goals=lab.snapshot().goals;
 assert.equal(goals.length,1,'revealTrust 0 reveals the goal on the first lab turn');
 assert.deepEqual(goals.map(g=>[g.title,g.step,g.total,g.hint,g.done]),[['Write the song',1,2,'First verse',false]]);
 const md=transcriptMarkdown(lab);
 assert.match(md,/- goal: ◆ Write the song · step 1\/2 · First verse/,'the summary lists the goal');
 assert.match(md,/> goal ◆ Write the song · step 1\/2 · First verse/,'the turn that revealed it is marked');
 lab.store.close();
});

test('lab turn ids stay unique across a forked second run of the same script',async()=>{
 const lab=createLab({pack:sample,registry,npcId:sampleNpc,provider:new MockProvider(),seed:42});
 await lab.turn('Hello there.');
 lab.fork(0);
 await lab.turn('Hello there.');
 const ids=Object.keys(lab.world.turns);
 assert.equal(new Set(ids).size,ids.length,'no duplicate turn ids after a fork');
 lab.store.close();
});

test('headless script commands parse and fail loudly',()=>{
 const steps=parseLabScript('Hello there.\n/skip day\n/stat charm 9\n/stage crush');
 assert.deepEqual(steps.map(s=>s.kind),['say','skip','stat','stage']);
 assert.equal(steps[1].unit,'day');assert.equal(steps[2].stat,'charm');assert.equal(steps[3].stage,'crush');
 assert.throws(()=>parseLabScript('/dance'));
 assert.throws(()=>providerFor('carrier'),/mock, local or cloud/);
});
