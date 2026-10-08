import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createWorld,execute,validatePack} from '../packages/core/engine.mjs';
import {registry,moduleCatalog} from '../packages/modules/index.mjs';
import {ACT_KINDS} from '../packages/ai/scene-acts.mjs';

const source=readFileSync(new URL('../public/studio.mjs',import.meta.url),'utf8');
class Element{constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.value='';this._text='';}append(...xs){this.children.push(...xs);}replaceChildren(...xs){this.children=xs;}prepend(x){this.children.unshift(x);}get textContent(){return this.children.length?this.children.map(c=>c.textContent).join(''):this._text;}set textContent(v){this._text=v;this.children=[];}}
const all=(e,out=[])=>{out.push(e);for(const c of e.children||[])all(c,out);return out;};
const button=(root,label)=>all(root).find(x=>x.tag==='button'&&x.textContent===label);
const cardOf=(root,title,index=0)=>all(root).filter(x=>x.tag==='article'&&x.children[0]?.textContent===title)[index];
const sectionOf=(root,title)=>all(root).find(x=>x.tag==='details'&&x.children[0]?.textContent===title);
const setField=(root,label,value)=>{const wrap=all(root).find(x=>x.tag==='label'&&x.children[0]?.textContent===label);assert.ok(wrap,'missing field: '+label);const input=wrap.children[1];input.value=value;if(input.oninput)input.oninput();if(input.onchange)input.onchange();return input;};
const version=k=>moduleCatalog[k].version;
const base=(...mods)=>({schemaVersion:1,id:'test.mechanics',version:'0.1.0',title:'Mechanics fixture',playerId:'player',modules:Object.fromEntries(mods.map(k=>[k,version(k)])),locations:[{id:'room',name:'Room',exits:[]}],actors:[{id:'player',name:'You',location:'room'},{id:'mia',name:'Mia',location:'room',traits:['guarded']}],storyVariables:[{id:'conf-flag',name:'Confidence flag',initial:false}],gameProject:{premise:'p',setting:'s',ai:{intent:'i',scene:'s',daypart:'d'}}});
function studio(fixture){const ids=new Map(),document={createElement:tag=>new Element(tag),getElementById:id=>{if(!ids.has(id))ids.set(id,new Element('div'));return ids.get(id);}},context=vm.createContext({document,structuredClone,console});vm.runInContext(source.replace(/^import .*;$/gm,''),context);vm.runInContext(`moduleCatalog=${JSON.stringify(moduleCatalog)};`,context);vm.runInContext(`fixture={pack:${JSON.stringify(fixture)}};draft=fixture;render=()=>{};`,context);
 return {context,fields:()=>ids.get('fields'),status:()=>ids.get('studio-status').textContent,get pack(){return JSON.parse(vm.runInContext('JSON.stringify(draft.pack)',context));},run(editor){vm.runInContext(`$('fields').replaceChildren();${editor}(draft.pack);`,context);}};}

test('studio ACT_KINDS mirror matches packages/ai/scene-acts.mjs',()=>{
 const m=source.match(/const ACT_KINDS=\[([^\]]*)\]/);
 assert.deepEqual(m[1].match(/'([^']+)'/g).map(x=>x.slice(1,-1)),[...ACT_KINDS]);
});

test('dailyNeeds: pack validation rejects an empty hint and an empty need list while enabled',()=>{
 const f=base('social.conversation','social.relationships','social.acts','items.inventory','social.dating','social.romance-tempo','social.daily-need');
 f.dailyNeeds={needs:[{id:'vent',hint:'wants to vent about work',weight:1,matches:[{kind:'listen'}],against:[{kind:'flirt'}]}],reward:{like:2,trust:1},againstLike:-2};
 validatePack(f,registry);
 assert.throws(()=>validatePack({...f,dailyNeeds:{...f.dailyNeeds,needs:[{...f.dailyNeeds.needs[0],hint:''}]}},registry),/daily need hint/,'empty hint is rejected');
 assert.throws(()=>validatePack({...f,dailyNeeds:{...f.dailyNeeds,needs:[]}},registry),/daily needs required/,'needs list may not be empty while enabled');
});

test('dailyNeeds: consumed by the runtime once authored (like reward and against penalty)',()=>{
 const f=base('social.conversation','social.relationships','social.acts','items.inventory','social.dating','social.romance-tempo','social.daily-need');f.dailyNeeds={needs:[{id:'vent',hint:'wants to vent',weight:1,matches:[{kind:'listen'}],against:[{kind:'pushy',target:'attention'}]}],reward:{like:2,trust:1},againstLike:-2};
 f.actors[1].traits=['guarded'];f.datingProfiles=[{character:'mia',thresholds:{crush:0,date:10,exclusive:20}}];f.romanceTempoProfiles=[{character:'mia',initialPoints:10,ranks:[{id:'start',name:'Start',points:0,ceiling:100}]}];f.actProfiles=[{character:'mia',entries:[],fallback:{landed:0,missed:0}}];f.romanceStats={dailyGain:6};f.durations={'social.priceActs':0};
 validatePack(f,registry);
 const state=createWorld(structuredClone(f),registry,'need',19);let rev=0;
 const cmd=(world,type,args,id)=>execute(world,{id,actorId:'player',type,expectedRevision:rev++,args},f,registry,true);
 const hit=cmd(state,'social.priceActs',{character:'mia',sceneId:'scene',source:'s0',acts:[{kind:'listen',target:'troubles'}]},'t1');
 assert.equal(hit.state.modules['social.romance-tempo'].characters.mia.points,12,'need reward paid once');
 const rude=cmd(hit.state,'social.priceActs',{character:'mia',sceneId:'scene',source:'push',acts:[{kind:'pushy',target:'attention'}]},'t2');
 assert.equal(rude.state.modules['social.romance-tempo'].characters.mia.points,10,'against rule costs Like');
});

test('statMilestones: unique IDs enforced, flag set by the runtime',()=>{
 const f=base('social.conversation','character.stats');
 f.statDefinitions=[{id:'confidence',name:'Confidence',min:0,max:100,visibility:'public'}];
 f.initialStats=[{character:'player',stat:'confidence',value:1}];
 f.activities=[{id:'train',name:'Train',description:'done',location:'room',duration:1,phrases:[],effects:[{type:'stat',stat:'confidence',delta:2}]}];
 f.statMilestones=[{id:'confident',character:'',stat:'confidence',min:3,flag:'conf-flag',text:'You feel sure of yourself.'}];
 validatePack(f,registry);
 assert.throws(()=>validatePack({...f,statMilestones:[f.statMilestones[0],{...f.statMilestones[0]}]},registry),/duplicate/,'duplicate milestone ID rejected');
 const pack=structuredClone(f);
 const r=execute(createWorld(pack,registry,'mile',42),{id:'t1',actorId:'player',type:'core.scene',expectedRevision:0,args:{text:'Train',location:'room',characters:[],activity:'other',activityId:'train'}},pack,registry,true);
 assert.equal(r.state.flags['conf-flag'],true,'milestone flag set');
 assert.ok(r.turn.events.some(e=>e.type==='character.statMilestone'&&e.payload.milestone==='confident'&&/sure of yourself/.test(e.payload.text)));
});

test('dialogueReactions: form authors a rule; runtime pays Trust on a spoken match',()=>{
 const f=base('social.conversation','social.relationships');
 const s=studio(f);s.run('dialogueReactionsEditor');
 button(s.fields(),'+ Add dialogue reaction').onclick();
 s.run('dialogueReactionsEditor');
 const card=cardOf(s.fields(),'Dialogue reaction 1');
 setField(card,'Reaction ID (unique)','proud');
 setField(card,'Character (blank = any character)','mia');
 setField(card,'Phrases to match (comma separated, 1–30)','I am proud of you');
 setField(card,'Trust change (-10 to 10)','3');
 setField(card,'Cooldown ticks (blank = 3)','5');
 validatePack(s.pack,registry);
 const pack=structuredClone(s.pack);
 const r=execute(createWorld(pack,registry,'react',42),{id:'t1',actorId:'player',type:'core.scene',expectedRevision:0,args:{text:'I am proud of you',location:'room',characters:['mia'],activity:'talk'}},pack,registry,true);
 assert.equal(r.state.modules['social.relationships'].edges['mia--player'],3,'reaction trust paid');
});

test('endings: dating, rank and intimacy gates editable; false flag requirements preserved',()=>{
 const f=base('social.conversation','social.relationships','social.dating','items.inventory','social.romance-tempo','social.intimacy','story.endings');
 f.actors[0].age=21;f.actors[1].age=21;f.intimacyCategories=[{id:'affectionate',name:'Affectionate intimacy',privacy:'private',casual:false}];f.intimacyProfiles=[{character:'mia',openness:50,casual:false,consentPolicy:'ask',allowedCategories:['affectionate'],blockedCategories:[],cooldown:2,interests:[]}];
 f.datingProfiles=[{character:'mia',thresholds:{crush:25,date:40,exclusive:70}}];
 f.romanceTempoProfiles=[{character:'mia',advancement:'automatic',ranks:[{id:'start',name:'Start',points:0,ceiling:10},{id:'spark',name:'Spark',points:10,ceiling:20}]}];
 f.intimacySettings={difficulty:'normal',contentLevel:'suggestive',privateLocations:[],aftercareWindow:2,aftercareOptions:[],disclosureDefaults:{}};
 f.intimacyCategories=[{id:'affectionate',name:'Affectionate intimacy',privacy:'private',casual:false}];
 f.storyVariables=[{id:'conf-flag',name:'A',initial:false},{id:'secret',name:'B',initial:false}];
 f.endings=[{id:'true-love',name:'True love',character:'',text:'',requires:{flags:{secret:false},completedScenes:[]}}];
 const s=studio(f);s.run('endingEditor');
 let card=cardOf(s.fields(),'Route ending 1');
 setField(card,'Add dating phase requirement','mia');
 setField(card,'Add romance rank requirement','mia');
 setField(card,'Add intimacy count requirement','mia');
 s.run('endingEditor');
 card=cardOf(s.fields(),'Route ending 1');
 setField(card,'Must be dating phase','dating');
 setField(card,'Romance rank must be','spark');
 setField(card,'At least this many encounters','2');
 setField(card,'Required true flags','conf-flag');
 const requires=s.pack.endings[0].requires;
 assert.equal(requires.flags.secret,false,'false flag requirement survives editing the true-flag list');
 assert.equal(requires.flags['conf-flag'],true);
 assert.deepEqual(requires.datingPhases,{mia:'dating'});
 assert.deepEqual(requires.romanceRanks,{mia:'spark'});
 assert.deepEqual(requires.intimacyCounts,{mia:2});
 validatePack(s.pack,registry);
});

test('scripted scenes: presence condition editable and validated',()=>{
 const f=base('social.conversation','story.scenes');
 f.scriptedScenes=[{id:'scene-1',title:'Surprise',opening:'Hi',trigger:{event:'core.inspected',match:{}},when:{present:['mia'],mysteryField:{keep:true}},choices:[{id:'continue',label:'Continue',result:'',effects:[]}]}];
 const s=studio(f);vm.runInContext('mountScenePreview=()=>{};',s.context);s.run('sceneEditor');
 const card=cardOf(s.fields(),'Surprise');
 const presence=card&&all(card).find(x=>x.tag==='label'&&x.children[0]?.textContent==='Must be present in the scene');
 assert.ok(presence,'existing present condition rendered');
 button(card,'+ Require character in scene').onclick();
 assert.deepEqual(s.pack.scriptedScenes[0].when.present,['mia','mia']);
 validatePack(s.pack,registry);
 assert.equal(s.pack.scriptedScenes[0].when.mysteryField.keep,true,'advanced fields untouched');
});

test('save, reopen and publish keep every authored value (real API)',async()=>{
 const {createApp}=await import('../server.mjs');
 const {mkdtempSync,rmSync,readFileSync,readdirSync}=await import('node:fs');
 const {tmpdir}=await import('node:os');
 const {join}=await import('node:path');
 const dir=mkdtempSync(join(tmpdir(),'creator-mechanics-'));let app;
 try{
  app=createApp({dataPath:':memory:',scenarioDir:dir});
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
  const root=`http://127.0.0.1:${app.server.address().port}`;
  const api=async(path,body)=>{const r=await fetch(root+path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,200,path);return r.json();};
  const f=base('social.conversation');
  f.dailyNeeds={needs:[{id:'vent',hint:'wants to vent about work',weight:1,matches:[{kind:'listen'}],against:[{kind:'pushy',target:'attention'}]}],reward:{like:2,trust:1},againstLike:-2};
  f.modules['character.stats']=version('character.stats');
  f.statDefinitions=[{id:'confidence',name:'Confidence',min:0,max:100,visibility:'public'}];
  f.statMilestones=[{id:'confident',character:'',stat:'confidence',min:3,flag:'conf-flag',text:'You feel sure of yourself.'}];
  f.modules['social.relationships']=version('social.relationships');
  f.dialogueReactions=[{id:'proud',character:'mia',phrases:['I am proud of you'],trustDelta:3,cooldownTicks:5}];
  const created=await api('/api/studio/create',{});
  const saved=await api('/api/studio/save',{id:created.id,pack:f,revision:created.updated});
  assert.deepEqual(saved.pack,f,'save keeps the authored configuration');
  const reopened=(await api('/api/studio/get?id='+encodeURIComponent(created.id))).pack;
  assert.deepEqual(reopened,f,'reopen keeps the authored configuration');
  const published=await api('/api/studio/publish',{id:created.id});
  const file=readdirSync(join(dir,'published')).find(x=>published.id.startsWith('created.')&&x.endsWith('.json'));
  const pack=JSON.parse(readFileSync(join(dir,'published',file),'utf8'));
  assert.deepEqual(pack.dailyNeeds,f.dailyNeeds);
  assert.deepEqual(pack.statMilestones,f.statMilestones);
  assert.deepEqual(pack.dialogueReactions,f.dialogueReactions);
  assert.equal(pack.publishedFrom,created.id);
 }finally{if(app){if(app.server.listening)await new Promise(r=>app.server.close(r));app.store.close();}rmSync(dir,{recursive:true,force:true});}
});
