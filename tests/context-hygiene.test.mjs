import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createWorld} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {Store} from '../packages/persistence/store.mjs';
import {GameService} from '../packages/ai/service.mjs';
import {contextFor} from '../packages/ai/context.mjs';
import {classifyUtterance,memoryText,playerStatements} from '../packages/ai/memory.mjs';
import {proseOf,awayFrom,timeLine,stablePrefix,firstProse,npcProse} from '../packages/ai/prompt-sections.mjs';
import {scenePromptMessages,promptView} from '../vendor/venus/scenePrompt.mjs';
import {sceneTranscript} from '../packages/ai/context-budget.mjs';
// T-114: what reaches the narrator is prose from state, the scene line agrees with the scene, commands do not become
// remembered speech, and the stable head of the prompt is byte-identical across a scene's turns (local KV-cache reuse).
const campus=()=>JSON.parse(readFileSync(new URL('../packs/campus.json',import.meta.url),'utf8'));
const captured=[];
const probe={name:'probe',contextWindow:8192,maxTokens:1800,async interpretScene(){throw Error('button turn only');},async generateScene(context){captured.push(structuredClone(context));return {lines:[{speaker:'',text:'Rain ticks on the window.'},{speaker:'jana',text:'You are late. Sit down.'}]};}};
async function scene(p,id,texts,tick=48){
  captured.length=0;
  const store=new Store(),world=createWorld(p,registry,id);
  world.tick=tick;store.insert(world);
  const here=world.actors[p.playerId].location,service=new GameService(store,{[p.id]:p},registry,probe);
  try{for(const [i,text] of texts.entries()){const s=store.load(id);await service.act(id,{id:`t${i}`,expectedRevision:s.revision,command:{type:'core.scene',args:{text,location:here,characters:['jana'],activity:'talk'}}});}
   return {context:captured.at(-1),state:store.load(id)};}
  finally{store.close();}
}

test('a typed move is remembered as something the player did, and meta-commands are not remembered',async()=>{
  const names=['Selma Aydın','Selma'],opts={player:'Ari Kesler'};
  const c=classifyUtterance('Touch her hand while you flirt with her',names,opts);
  assert.equal(c.kind,'action');
  assert.equal(memoryText(c.kind,c.said,'Selma Aydın','Ari Kesler'),'With Selma Aydın, Ari Kesler touched her hand while flirting with her');
  assert.equal(classifyUtterance('Go talk to selma',names,opts).kind,'meta');
  assert.equal(classifyUtterance('Find Selma',names,opts).kind,'meta');
  assert.equal(classifyUtterance("Tell Ari Kesler more about Selma Aydın's worries",names,opts).kind,'question','asking the narrator for more is not a line said');
  assert.equal(classifyUtterance('Tell me more about the dorm',names,opts).kind,'question');
  for(const t of ['Hold on, I need a second','Wait, what?','I watch anime a lot','I love jazz'])assert.notEqual(classifyUtterance(t,names,opts).kind,'action',t);
  for(const [t,want] of [['Hug her tightly','hugged her tightly'],['Kiss her cheek','kissed her cheek'],['I lean closer to her','leaned closer to her'],['Pours tea for her','poured tea for her']]){
   const x=classifyUtterance(t,names,opts);assert.equal(x.kind,'action',t);assert.ok(memoryText(x.kind,x.said,'Selma','Ari').endsWith(want),t);}
  // End to end on the campus pack: the command turn reaches memory as an act, never as the raw imperative.
  const p=campus(),{state}=await scene(p,'hygiene-memory',['Touch her hand while you flirt with her','Go talk to jana']);
  const said=playerStatements(state,p,'jana').map(m=>m.text);
  assert.ok(said.some(t=>/^With Jana\b.* touched her hand while flirting with her; Rain ticks on the window\.$/.test(t)),said.join(' | '));
  assert.ok(!said.some(t=>/Touch her hand|Go talk/i.test(t)),'no raw imperative is remembered');
});

test('state reaches the narrator as prose: no JSON object before the output contract',async()=>{
  assert.equal(proseOf({stage:'dating',kissed:true,blocked:false,notes:'',since:{day:3}}),'stage dating; kissed; since (day 3)');
  assert.equal(npcProse({characters:['a','b'],kind:'rivals',trust:12},id=>id.toUpperCase()),'A & B: kind rivals; trust 12');
  assert.match(firstProse({title:'First kiss',step:2,of:3,checkpoint:'lean_in',required:true,cue:'She looks at your mouth.'}),/^First kiss, step 2 of 3, at "lean in", this step must land\. Cue: She looks at your mouth\.$/);
  const p=campus(),{context}=await scene(p,'hygiene-json',['Hi Jana.']);
  const rich={...context,intimacy:[{character:'jana',stage:'flirting',kissed:false}],npcRelationships:[{characters:['jana','nova'],kind:'friends',trust:40}],first:{title:'First touch',step:1,of:2,cue:'Hands brush.'}};
  const [sys,user]=scenePromptMessages(rich,p),head=user.content.split('ALLOWED PRESENTATION')[0];
  // The system message's speaker-ID example is output contract, like ALLOWED PRESENTATION; every other line is state or rules.
  const text=sys.content.split('\n').filter(l=>!l.includes('Speaker-ID example')).join('\n')+head;
  assert.ok(!/\{"/.test(text),text.match(/.{0,60}\{".{0,60}/)?.[0]);
  assert.ok(text.includes('stage flirting'),'the intimacy record rendered, as prose');
  assert.ok(/First touch, step 1 of 2\. Cue: Hands brush\./.test(text),'the private first moment rendered, as prose');
});

test('the scene line comes from the scene, and nobody is away in the room the scene is in',()=>{
  const p=campus(),s=createWorld(p,registry,'hygiene-place'),home=s.actors[p.playerId].location,there=p.locations.find(l=>l.id!==home).id;
  s.scene={id:'x',location:there,characters:['jana'],activity:'talk',startedTick:0};
  const context=contextFor(s,p,p.playerId,null,'');
  assert.equal(context.location.id,there,'a stale actor record does not move the scene');
  assert.ok(timeLine(context).includes(p.locations.find(l=>l.id===there).name));
  assert.ok(scenePromptMessages(context,p)[1].content.includes(timeLine(context)),'the prompt carries that line');
  assert.equal(contextFor(s,p,'nova',null,'').location.id,s.actors.nova.location,'someone outside the scene stays where they are');
  const name=context.location.name;
  assert.deepEqual(awayFrom([{name:'Dilek',where:name},{name:'Nova',where:'Library'}],name),[{name:'Dilek',where:''},{name:'Nova',where:'Library'}]);
});

test('scene history from an earlier daypart is relabelled so the scene does not re-anchor to it',()=>{
 const p=campus(),line=(id,tick,narrative)=>({id,status:'complete',command:{type:'core.scene',args:{text:id}},input:id,narrative,sceneLines:[{speaker:'',text:narrative}],events:[{type:'core.sceneContinued',payload:{characters:['jana']},tick}]});
 const world={scene:{id:'s1'},tick:41,turns:{t1:line('t1',36,'The quad is loud with morning students.'),t2:line('t2',40,'She packs up her sketches.')}};
 const history=sceneTranscript(world,{id:'t3',events:[]},['jana'],120,null,p);
 assert.deepEqual(history.map(h=>h.daypart),['Morning',undefined],'only the turn from an earlier daypart is marked');
 const [,user]=scenePromptMessages({stagedCast:['jana'],scenePhase:'continuation',sceneHistory:history,memories:[],playerAction:'Ask about the sketches.'},p);
 assert.ok(user.content.includes('(earlier, Morning) The quad is loud with morning students.'),'the old-daypart line carries its label');
 assert.ok(user.content.includes('Player: t2\nShe packs up her sketches.'),'same-daypart lines render exactly as before');
 assert.equal(promptView.sceneHistory({input:'Hi',text:'She smiles.'}),'Player: Hi\nShe smiles.','no daypart: rendering is unchanged');
 assert.equal(promptView.sceneHistory({compact:true,text:'Player: Hi → sketching.'}),'(earlier) Player: Hi → sketching.','no daypart: digests are unchanged');
});

test('the stable prompt head is byte-identical across turns of one scene',async()=>{
  const p=campus(),{context}=await scene(p,'hygiene-cache',['Hi Jana.','How was class?']);
  const base={...context,scenePhase:'continuation'};
  const a={...base,daypart:'morning',playerAction:'Ask about class.',outcomes:[{type:'x',text:'You sit.'}],sceneHistory:[]};
  const b={...base,daypart:'evening',playerAction:'Offer her a coffee.',outcomes:[{type:'y',text:'She laughs.'}],sceneHistory:[{scene:'s',beat:'opening',tick:1}]};
  const ma=scenePromptMessages(a,p),mb=scenePromptMessages(b,p);
  assert.ok(ma[1].content.includes(timeLine(a)),'the volatile header is found, so the prefix is not the whole system text alone');
  assert.notEqual(ma[1].content,mb[1].content,'the turns differ');
  const hash=m=>createHash('sha256').update(m).digest('hex');
  assert.ok(stablePrefix(ma,a).length>ma[0].content.length+1,'premise and setting are in the cached head');
  assert.equal(hash(stablePrefix(ma,a)),hash(stablePrefix(mb,b)));
});
