// Studio ComfyUI jobs: generate takes for one image slot, or a whole character's sprite set + sex scene CGs.
// Jobs run in the background (renders take minutes); Studio polls and inserts what it picks through the normal asset upload.
import {randomUUID,randomInt} from 'node:crypto';
import {client as comfyClient,renderSprite,renderCg,setupHelp,ComfyError,DEFAULT_POSE,POSES} from './comfy.mjs';
import {artPrompt,ART_KINDS,BATCH_EMOTIONS,EMOTION_TAGS} from '../../public/art-prompt.mjs';
import {readFileSync} from 'node:fs';
const ckpt=JSON.parse(readFileSync(new URL('../../assets/comfy/workflows/characterCg.json',import.meta.url),'utf8'))['1'].inputs.ckpt_name;
// Backgrounds have no Venus workflow: a plain txt2img graph on the same checkpoint, widescreen.
export const backgroundWorkflow=({positive,negative,seed})=>({1:{class_type:'CheckpointLoaderSimple',inputs:{ckpt_name:ckpt}},4:{class_type:'CLIPTextEncode',inputs:{text:positive,clip:['1',1]}},5:{class_type:'CLIPTextEncode',inputs:{text:negative,clip:['1',1]}},15:{class_type:'EmptyLatentImage',inputs:{width:1344,height:768,batch_size:1}},7:{class_type:'KSampler',inputs:{model:['1',0],positive:['4',0],negative:['5',0],latent_image:['15',0],seed,steps:24,cfg:5,sampler_name:'dpmpp_2m_sde',scheduler:'karras',denoise:1}},8:{class_type:'VAEDecode',inputs:{samples:['7',0],vae:['1',2]}},9:{class_type:'SaveImage',inputs:{images:['8',0],filename_prefix:'story-framework/background'}}});
const png=b=>'data:image/png;base64,'+Buffer.from(b).toString('base64');
const need=(c,m)=>{if(!c)throw new ComfyError('BAD_REQUEST',m);};
export function comfyJobs({client=()=>comfyClient(),seed=()=>randomInt(1,2**31),keep=20}={}){
 const jobs=new Map(),view=j=>({id:j.id,status:j.status,done:j.done,total:j.total,results:j.results,error:j.error,prompt:j.prompt});
 const start=(total,work)=>{const j={id:randomUUID(),status:'running',done:0,total,results:[]};jobs.set(j.id,j);for(const id of [...jobs.keys()].slice(0,-keep))jobs.delete(id);
  (async()=>{try{await work(j);j.status='done';}catch(e){j.status='error';j.error=e instanceof ComfyError?`${e.message}`:String(e.message||e);}})();return view(j);};
 const one=async(c,kind,p,opts)=>{const s=seed();if(kind==='background'){const h=await c.run(backgroundWorkflow({...p,seed:s})),img=h.outputs?.['9']?.images?.[0];if(!img)throw new ComfyError('COMFY_NO_OUTPUT','ComfyUI produced no background');return {data:png(await c.view(img)),seed:s};}
  if(kind==='cg')return {data:png(await renderCg(c,{...p,seed:s,pose:opts.pose})),seed:s};const r=await renderSprite(c,{...p,seed:s,pose:opts.pose},{baseFrame:opts.baseFrame});return {data:png(r.sprite),seed:s,base:r.base};};
 return {
  async status(){const c=client();try{const missing=await c.check();return {ok:!missing.length,host:c.base,missing,help:missing.length?setupHelp():''};}catch(e){return {ok:false,host:c.base,missing:[],error:e.message,help:setupHelp()};}},
  // {kind,pack,actor,location,emotion,pose,outfit,scene,extra,takes}: n alternative takes of one slot.
  generate(b){need(ART_KINDS.includes(b?.kind),`kind must be one of ${ART_KINDS.join(', ')}`);need(b.kind==='background'?b.location:b.actor,b.kind==='background'?'location required':'actor required');const pose=POSES[b.pose]?b.pose:DEFAULT_POSE,takes=Math.min(4,Math.max(1,b.takes|0||1)),p=artPrompt(b.pack,{...b,pose});
   const j=start(takes,async j=>{const c=client();for(let i=0;i<takes;i++){const {data,seed}=await one(c,b.kind,p,{pose});j.results.push({data,seed});j.done++;}});jobs.get(j.id).prompt=p;return {...j,prompt:p};},
  // Whole character: one base frame, an expression sprite per emotion (neutral becomes the portrait, the rest pose variants), then one CG per allowed sex scene.
  batch(b){need(b?.actor,'actor required');const a=b.actor,emotions=(b.emotions||BATCH_EMOTIONS).filter(e=>EMOTION_TAGS[e]),scenes=(b.scenes||[]).slice(0,8),pose=POSES[b.pose]?b.pose:DEFAULT_POSE;
   return start(emotions.length+scenes.length,async j=>{const c=client();let baseFrame;
    for(const e of emotions){const r=await one(c,'character',artPrompt(b.pack,{kind:'character',actor:a,emotion:e,pose,extra:b.extra}),{pose,baseFrame});baseFrame??=r.base;j.results.push({slot:e==='neutral'?'portrait':`pose:${e}`,data:r.data,seed:r.seed});j.done++;}
    for(const s of scenes){const r=await one(c,'cg',artPrompt(b.pack,{kind:'cg',actor:a,scene:s,extra:b.extra}),{pose});j.results.push({slot:`cg:${s.id}`,data:r.data,seed:r.seed});j.done++;}});},
  job(id){const j=jobs.get(id);need(j,'Unknown ComfyUI job');return view(j);}
 };
}
