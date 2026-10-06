// ComfyUI client + Venus-style character pipeline. Adapted from Venus University's comfyService.ts and assets/workflows/*.json
// at snapshot 79301df55bc39a0996229ccc6f12ccce422a80b2 (AGPL-3.0-only; see vendor/venus/NOTICE.md). Workflows are patched by fixed node id.
import {readFileSync} from 'node:fs';
const dir=new URL('../../assets/comfy/',import.meta.url),wf=n=>JSON.parse(readFileSync(new URL(`workflows/${n}.json`,dir),'utf8'));
export const POSES=JSON.parse(readFileSync(new URL('pose/pose.json',dir),'utf8')),DEFAULT_POSE='arms_at_sides';
export const NODES={
 base:{file:'characterBase',seed:'14',pos:'4',neg:'5',pose:'39',save:'41'},
 cutout:{file:'characterCutout',source:'10',save:'41'},
 expression:{file:'characterExpression',seed:'14',pos:'4',neg:'5',source:'10',pose:'39',save:'9',face:'79',faceNodes:['70','79']},
 cg:{file:'characterCg',seed:'14',pos:'4',detailerPos:'50',neg:'5',pose:'39',save:'9'}
};
export const REQUIRED_MODELS=[['CheckpointLoaderSimple','ckpt_name'],['LoraLoader','lora_name'],['ControlNetLoader','control_net_name'],['UpscaleModelLoader','model_name'],['UltralyticsDetectorProvider','model_name']];
export class ComfyError extends Error{constructor(code,message,detail){super(message);this.code=code;this.detail=detail;}}
export const DEFAULT_HOST='127.0.0.1:8188';
const SETUP='Start ComfyUI (default 127.0.0.1:8188, or set COMFY_HOST) with the Venus-style workflow dependencies: custom nodes Impact Pack + Impact Subpack (FaceDetailer, Ultralytics), comfyui-inspyrenet-rembg and a SeedNode pack; models novaAnimeXL_ilV190 checkpoint, usnrStyle LoRA, illustriousOpenpose ControlNet, RealESRGAN_x4plus_anime_6B and the hand/face Ultralytics detectors. Run `node scripts/comfy-sprites.mjs --check` to list what is missing.';
export const setupHelp=()=>SETUP;

export function client({host=process.env.COMFY_HOST||DEFAULT_HOST,fetchImpl=globalThis.fetch,pollMs=1000,timeoutMs=600000,sleep=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 const base=/^https?:/.test(host)?host.replace(/\/$/,''):`http://${host}`;
 const call=async(path,init)=>{let r;try{r=await fetchImpl(base+path,init);}catch(e){throw new ComfyError('COMFY_UNREACHABLE',`ComfyUI is not reachable at ${base}. ${SETUP}`,e.message);}
  if(!r.ok){const t=await r.text().catch(()=>'');throw new ComfyError('COMFY_HTTP',`ComfyUI ${path.split('?')[0]} returned ${r.status}`,t.slice(0,2000));}return r;};
 return {base,
  objectInfo:async()=>(await call('/object_info')).json(),
  // Verifies the node classes and model files the workflows reference are installed; returns [] when ready.
  async check(workflows=Object.values(NODES).map(n=>wf(n.file))){
   const info=await this.objectInfo(),need=new Map();
   for(const w of workflows)for(const n of Object.values(w)){if(!n.class_type)continue;if(!info[n.class_type])need.set(`node:${n.class_type}`,`custom node ${n.class_type}`);
    for(const [cls,key] of REQUIRED_MODELS)if(n.class_type===cls&&typeof n.inputs?.[key]==='string'){const opts=info[cls]?.input?.required?.[key]?.[0];if(Array.isArray(opts)&&!opts.includes(n.inputs[key]))need.set(`${cls}:${n.inputs[key]}`,`${key} ${n.inputs[key]} (${cls})`);}}
   return [...need.values()];},
  async upload(name,bytes){const f=new FormData();f.append('image',new Blob([bytes],{type:'image/png'}),name);f.append('overwrite','true');const r=await (await call('/upload/image',{method:'POST',body:f})).json();return r.subfolder?`${r.subfolder}/${r.name}`:r.name;},
  async run(workflow,{signal,onProgress}={}){
   const sub=await (await call('/prompt',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({prompt:workflow})})).json();
   if(sub.node_errors&&Object.keys(sub.node_errors).length)throw new ComfyError('COMFY_NODE_ERRORS','ComfyUI rejected the workflow: '+Object.values(sub.node_errors).map(e=>e.class_type+': '+(e.errors||[]).map(x=>x.message).join('; ')).join(' | '),sub.node_errors);
   const id=sub.prompt_id;if(!id)throw new ComfyError('COMFY_NO_PROMPT_ID','ComfyUI did not return a prompt id',sub);
   const t0=Date.now();for(;;){if(signal?.aborted)throw new ComfyError('COMFY_CANCELLED','Cancelled');
    const h=(await (await call(`/history/${id}`)).json())[id];
    if(h?.status?.status_str==='error'){const m=(h.status.messages||[]).find(x=>x[0]==='execution_error')?.[1]||{};throw new ComfyError('COMFY_EXECUTION',`ComfyUI failed in node ${m.node_type||'?'}: ${m.exception_message||'unknown error'}`,m);}
    if(h?.outputs&&h.status?.completed!==false)return h;
    if(Date.now()-t0>timeoutMs)throw new ComfyError('COMFY_TIMEOUT','ComfyUI did not finish in time');onProgress?.('Rendering');await sleep(pollMs);}},
  async view(img){const q=new URLSearchParams({filename:img.filename,subfolder:img.subfolder||'',type:img.type||'output'});return Buffer.from(await (await call('/view?'+q)).arrayBuffer());}
 };
}

// Patch a workflow copy by node id; an unknown id fails loudly instead of silently rendering defaults.
export function patch(kind,{positive,negative,detailerPositive,seed,pose,source,keepFace=false}={}){
 const map=NODES[kind],w=wf(map.file),node=id=>{if(!w[id])throw new ComfyError('WORKFLOW_NODE_MISSING',`${map.file}.json has no node ${id}`);return w[id].inputs;};
 if(positive!=null&&map.pos)node(map.pos).text=positive;if(negative!=null&&map.neg)node(map.neg).text=negative;
 if(seed!=null&&map.seed)node(map.seed).seed=seed;if(detailerPositive!=null&&map.detailerPos)node(map.detailerPos).text=detailerPositive;
 if(pose&&map.pose)node(map.pose).image=pose;if(source&&map.source)node(map.source).image=source;
 if(map.faceNodes&&!keepFace)for(const id of map.faceNodes){node(id);delete w[id];}
 node(map.save);return w;
}
const imageOf=(h,id)=>h.outputs?.[id]?.images?.[0];
export async function render(c,kind,opts,{signal,onProgress,face=false}={}){
 const map=NODES[kind],h=await c.run(patch(kind,{...opts,keepFace:face}),{signal,onProgress}),img=imageOf(h,map.save);
 if(!img)throw new ComfyError('COMFY_NO_OUTPUT',`ComfyUI finished but node ${map.save} produced no image`,h.outputs);
 return {png:await c.view(img),face:face&&imageOf(h,map.face)?await c.view(imageOf(h,map.face)):undefined};
}
export const poseTags=pose=>POSES[pose]?.tags||[];
const skeleton=(c,pose,readFile)=>{if(!POSES[pose])throw new ComfyError('POSE_UNKNOWN',`Unknown pose ${pose}; choose one of ${Object.keys(POSES).join(', ')}`);return c.upload(`sf_pose_${pose}.png`,readFile(new URL(`pose/${pose}.png`,dir)));};
// Base frame (pose + prompt + seed, background cut) -> expression face pass over that frame. Returns {base,sprite,face?}.
export async function renderSprite(c,{positive,negative,seed,pose=DEFAULT_POSE,readFile=readFileSync},{neutral=false,baseFrame,signal,onProgress}={}){
 const sk=await skeleton(c,pose,readFile);
 const base=baseFrame||(await render(c,'base',{positive,negative,seed,pose:sk},{signal,onProgress})).png;
 const source=await c.upload(`sf_src_${seed}.png`,base),r=await render(c,'expression',{positive,negative,seed,pose:sk,source},{signal,onProgress,face:neutral});
 return {base,sprite:r.png,face:r.face};
}
export async function renderCg(c,{positive,negative,detailerPositive,seed,pose=DEFAULT_POSE,readFile=readFileSync},{signal,onProgress}={}){
 const sk=await skeleton(c,pose,readFile);
 return (await render(c,'cg',{positive,negative,detailerPositive,seed,pose:sk},{signal,onProgress})).png;
}
