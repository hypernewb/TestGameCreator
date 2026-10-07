import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,mkdtempSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {artPrompt,artStyle,validateArtStyle,DEFAULT_ART} from '../public/art-prompt.mjs';
import {comfyJobs,backgroundWorkflow} from '../packages/assets/comfy-studio.mjs';
import {client} from '../packages/assets/comfy.mjs';
import {comfyGen,comfyBatch,applyBatch,takes} from '../public/studio-comfy.mjs';
import {validatePack,clone} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {createApp} from '../server.mjs';
const fantasy=JSON.parse(readFileSync(new URL('../packs/template-fantasy-town.json',import.meta.url),'utf8'));
const json=v=>new Response(JSON.stringify(v),{headers:{'Content-Type':'application/json'}});
// A fake ComfyUI (as in comfy.test.mjs): one image per SaveImage node, or nothing reachable.
function fake(){const log={prompts:[]};let n=0;
 const f=async(url,init)=>{const p=new URL(url).pathname;if(p==='/object_info')return json({});if(p==='/upload/image')return json({name:init.body.get('image').name});
  if(p==='/prompt'){log.prompts.push(JSON.parse(init.body).prompt);return json({prompt_id:'p'+(++n)});}
  if(p.startsWith('/history/')){const w=log.prompts[Number(p.slice(10))-1],outputs={};for(const [id,x] of Object.entries(w))if(x.class_type==='SaveImage')outputs[id]={images:[{filename:id+'.png',subfolder:'',type:'output'}]};return json({[p.slice(9)]:{status:{status_str:'success',completed:true},outputs}});}
  if(p==='/view')return new Response(new Uint8Array([137,80,78,71]));throw Error('unexpected '+p);};return {f,log};}
const town=()=>{const p=clone(fantasy),ryn=p.actors.find(a=>a.id==='ryn');Object.assign(ryn,{pronouns:'she/her',appearanceTags:['silver_hair','green eyes'],outfitTags:['apron'],bodyTags:['slim'],outfitSets:{swim:['bikini']},expressionTags:{aroused:['tongue out']}});p.actors.find(a=>a.id===p.playerId).pronouns='he/him';return p;};
const until=async(jobs,id)=>{for(let i=0;i<200;i++){const j=jobs.job(id);if(j.status!=='running')return j;await new Promise(r=>setTimeout(r,5));}throw Error('job hung');};

test('art prompts come from the card tags, world-neutral, with a project style override',()=>{
 const p=town(),ryn=p.actors.find(a=>a.id==='ryn'),tavern=p.locations[0];
 let a=artPrompt(p,{kind:'character',actor:ryn,emotion:'flirty',pose:'hand_on_hip'});assert.match(a.positive,/^1girl, solo/);for(const t of ['silver hair','green eyes','apron','seductive smile','hand on hip',DEFAULT_ART.style])assert.ok(a.positive.includes(t),t);assert.match(a.negative,/nsfw, nude$/);
 assert.match(artPrompt(p,{kind:'character',actor:ryn,outfit:'swim'}).positive,/bikini/);assert.doesNotMatch(artPrompt(p,{kind:'character',actor:ryn,outfit:'swim'}).positive,/apron/);
 a=artPrompt(p,{kind:'cg',actor:ryn,scene:{id:'oral',name:'Oral'},extra:'on the bar'});for(const t of ['nsfw, explicit, sex','1boy, 1girl','pov','Oral','on the bar','slim','nude','tongue out'])assert.ok(a.positive.includes(t),t);assert.match(a.negative,/censored/);assert.match(a.detailerPositive,/silver hair/);
 a=artPrompt(p,{kind:'background',location:tavern});assert.match(a.positive,/^scenery, no humans/);assert.ok(a.positive.includes(tavern.name));assert.match(a.negative,/1girl/);
 p.artStyle={style:'oil painting, fantasy'};assert.equal(artStyle(p).style,'oil painting, fantasy');assert.equal(artStyle(p).negative,DEFAULT_ART.negative);assert.match(artPrompt(p,{kind:'background',location:tavern}).positive,/oil painting, fantasy$/);
 assert.doesNotThrow(()=>validatePack(p,registry));const errs=[];validateArtStyle({artStyle:{style:1,mood:'x'}},m=>errs.push(m));assert.deepEqual(errs,['artStyle.style: text up to 2000 characters','artStyle.mood: unknown field']);
 const bad=clone(p);bad.artStyle=[];assert.throws(()=>validatePack(bad,registry),/artStyle: expected an object/);
});

test('jobs: takes for one slot, a whole character batch, and setup help when ComfyUI is down',async()=>{
 const {f,log}=fake(),seeds=[11,12,13,14,15,16,17,18,19],jobs=comfyJobs({client:()=>client({fetchImpl:f,sleep:async()=>{}}),seed:()=>seeds.shift()}),p=town(),ryn=p.actors.find(a=>a.id==='ryn');
 let j=jobs.generate({kind:'background',pack:p,location:p.locations[0],takes:2});assert.equal(j.total,2);assert.match(j.prompt.positive,/no humans/);j=await until(jobs,j.id);
 assert.equal(j.status,'done');assert.deepEqual(j.results.map(r=>r.seed),[11,12]);assert.match(j.results[0].data,/^data:image\/png;base64,/);assert.equal(log.prompts[0][4].inputs.text,j.prompt.positive);assert.deepEqual(log.prompts[0],backgroundWorkflow({...j.prompt,seed:11}));
 j=await until(jobs,jobs.batch({pack:p,actor:ryn,emotions:['neutral','flirty'],scenes:[{id:'oral',name:'Oral'}]}).id);assert.equal(j.status,'done',j.error);assert.deepEqual(j.results.map(r=>r.slot),['portrait','pose:flirty','cg:oral']);
 assert.throws(()=>jobs.generate({kind:'cg'}),/actor required/);assert.throws(()=>jobs.generate({kind:'video',actor:ryn}),/kind must be one of/);assert.throws(()=>jobs.job('nope'),/Unknown ComfyUI job/);
 const down=comfyJobs({client:()=>client({fetchImpl:async()=>{throw Error('ECONNREFUSED');}})}),s=await down.status();assert.equal(s.ok,false);assert.ok(s.help.length>20);
 j=await until(down,down.generate({kind:'cg',pack:p,actor:ryn}).id);assert.equal(j.status,'error');assert.match(j.error,/not reachable/);
});

test('server routes: status, generate, batch and job polling go through the injected jobs',async t=>{
 const {f}=fake(),app=createApp({dataPath:':memory:',scenarioDir:mkdtempSync(join(tmpdir(),'sf-comfy-')),comfy:comfyJobs({client:()=>client({fetchImpl:f,sleep:async()=>{}})})});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>app.server.close(r));app.store?.close?.();});
 const base=`http://127.0.0.1:${app.server.address().port}`,call=async(path,body)=>{const r=await fetch(base+path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};};
 {const s=(await call('/api/studio/comfy')).body;assert.ok(Array.isArray(s.missing)&&s.missing.length,'empty fake object_info: required nodes listed as missing');assert.match(s.help,/ComfyUI/);}const p=town(),ryn=p.actors.find(a=>a.id==='ryn');
 let r=await call('/api/studio/comfy/generate',{kind:'character',pack:{playerId:p.playerId,actors:[]},actor:ryn,takes:1});assert.equal(r.status,200);let j;for(let i=0;i<100&&(j=(await call('/api/studio/comfy/job?id='+r.body.id)).body).status==='running';i++);assert.equal(j.status,'done');assert.equal(j.results.length,1);
 r=await call('/api/studio/comfy/batch',{pack:{},actor:ryn,emotions:['neutral']});assert.equal(r.status,200);assert.equal(r.body.total,1);
 assert.equal((await call('/api/studio/comfy/generate',{kind:'cg'})).status,400);
});

// Studio panel against a tiny DOM: Generate polls, shows takes, and "use this" prepares + uploads + sets the slot; the batch fills portrait, poses and CGs.
const node=(tag,text)=>{const n={tag,children:[],dataset:{},className:'',textContent:text||'',value:'',append(...k){n.children.push(...k);}};return n;};
const all=n=>[n,...(n.children||[]).flatMap(all)];
const deps=(calls,jobView)=>({node,render(){},message(){},sleep:async()=>{},url:d=>'blob:'+d.length,preparedImage:async(file,kind)=>`prepared:${kind}:${file.type}:${file.size}`,
 api:async(path,body)=>{calls.push([path,body]);if(path==='/api/studio/comfy/generate'||path==='/api/studio/comfy/batch')return {id:'j1',status:'running'};if(path.startsWith('/api/studio/comfy/job'))return jobView;if(path==='/api/studio/asset')return {path:`scenario-media/${calls.filter(c=>c[0]==='/api/studio/asset').length}.png`};throw Error(path);}});
const PNG='data:image/png;base64,iVBORw==';
test('Studio: Generate shows takes and inserts the picked one; batch fills the card; wiring sits beside each image slot',async()=>{
 takes.clear();const p=town(),ryn=p.actors.find(a=>a.id==='ryn'),calls=[];let d=deps(calls,{status:'done',done:2,total:2,results:[{data:PNG,seed:1},{data:PNG,seed:2}]});
 const slot={id:'portrait:ryn',kind:'character',obj:ryn,key:'portrait',assetKind:'character',actor:ryn};let box=comfyGen(node('div'),p,slot,d);all(box).find(n=>n.tag==='input').value='waving';all(box).find(n=>n.tag==='input').oninput();
 await all(box).find(n=>n.dataset.action==='comfy-generate').onclick();const sent=calls[0][1];assert.equal(sent.kind,'character');assert.equal(sent.extra,'waving');assert.equal(sent.actor,ryn);assert.deepEqual(sent.pack.actors,[{id:p.playerId,pronouns:'he/him'}],'only the player goes along, keeping the request small');
 box=comfyGen(node('div'),p,slot,d);const picks=all(box).filter(n=>n.dataset.action==='comfy-pick');assert.equal(picks.length,2);await picks[1].onclick();
 assert.deepEqual(calls.at(-1),['/api/studio/asset',{data:'prepared:character:image/png:4',kind:'character'}]);assert.equal(ryn.portrait,'scenario-media/1.png');assert.ok(!all(comfyGen(node('div'),p,slot,d)).some(n=>n.dataset.action==='comfy-pick'),'takes clear after insert');
 // batch: neutral -> portrait, flirty -> existing pose replaced, aroused -> new pose, oral -> scene CG
 p.intimacyCategories=[{id:'oral',name:'Oral'},{id:'anal',name:'Anal'}];p.intimacyProfiles=[{character:'ryn',allowedCategories:['oral'],scenes:[]}];ryn.poses=[{id:'flirty',image:'old.png'}];
 const results=[{slot:'portrait',data:PNG},{slot:'pose:flirty',data:PNG},{slot:'pose:aroused',data:PNG},{slot:'cg:oral',data:PNG}];calls.length=0;d=deps(calls,{status:'done',done:4,total:4,results});
 box=comfyBatch(node('div'),p,ryn,d);assert.match(all(box).find(n=>n.dataset.action==='comfy-batch').textContent,/\+ CGs/);await all(box).find(n=>n.dataset.action==='comfy-batch').onclick();
 assert.deepEqual(calls[0][1].scenes,[{id:'oral',name:'Oral'}]);assert.deepEqual(calls.filter(c=>c[0]==='/api/studio/asset').map(c=>c[1].kind),['character','character','character','background']);
 assert.equal(ryn.portrait,'scenario-media/1.png');assert.deepEqual(ryn.poses,[{id:'flirty',image:'scenario-media/2.png'},{id:'aroused',image:'scenario-media/3.png'}]);assert.deepEqual(p.intimacyProfiles[0].scenes,[{category:'oral',cg:'scenario-media/4.png'}]);
 applyBatch(p,{id:'nobody'},[{slot:'cg:oral'}],['x.png']);
 // project art style lives in the batch panel; clearing it removes the override
 const style=all(comfyBatch(node('div'),p,ryn,d)).find(n=>n.dataset.artStyle==='style');style.value='watercolor';style.oninput();assert.deepEqual(p.artStyle,{style:'watercolor'});style.value='';style.oninput();assert.equal(p.artStyle,undefined);
 const src=readFileSync(new URL('../public/studio.mjs',import.meta.url),'utf8');for(const re of [/'Sex scene image \(CG\)','background'\);comfyGen\(card,p,\{id:`cg:/,/'Pose image','character'\);comfyGen\(row,/,/'Scene background','background'\);comfyGen\(g,p,/,/'Character sprite art','character'\);comfyGen\(g,p,/,/poseEditor\(looks,o\);comfyBatch\(looks,p,o,/,/'idleStill'.*comfyGen\(looks,p,/])assert.match(src,re);
 assert.doesNotMatch(readFileSync(new URL('../public/studio-comfy.mjs',import.meta.url),'utf8')+readFileSync(new URL('../public/art-prompt.mjs',import.meta.url),'utf8'),/campus|dorm|student/i,'world-neutral');
});
