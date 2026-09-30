// NovelAI image generation for CGs. Pure request building and zip reading; the network call is one fetch.
import {inflateRawSync} from 'node:zlib';

export const NOVELAI_URL='https://image.novelai.net/ai/generate-image';
// Opus subscriptions generate free up to ~1 megapixel, 28 steps, one image. Stay inside that unless told otherwise.
export const FREE_LIMIT={pixels:1024*1024,steps:28};
const grid=v=>Math.min(0.9,Math.max(0.1,(Math.round((v-0.1)/0.2)*2+1)/10));

// sheet: {style, negative, characters:{id:caption}, size:[w,h], steps, scale, cfgRescale, ucPreset, model}; cg: {id, prompt, cast:[{id, action, at:[x,y]}], seed, negative, uc (replaces sheet.negative)}
export function buildRequest(sheet,cg,{seed=cg.seed,allowAnlas=false}={}){
 const [width,height]=cg.size||sheet.size||[1216,832],steps=cg.steps||sheet.steps||28,cast=cg.cast||[];
 if(!allowAnlas&&(width*height>FREE_LIMIT.pixels||steps>FREE_LIMIT.steps))throw new Error(`${cg.id}: ${width}x${height} at ${steps} steps costs Anlas; pass allowAnlas to spend it`);
 for(const c of cast)if(!sheet.characters?.[c.id])throw new Error(`${cg.id}: unknown character ${c.id}`);
 const base=[cg.prompt,sheet.style].filter(Boolean).join(', '),negative=[cg.uc??sheet.negative,cg.negative].filter(Boolean).join(', '),useCoords=cast.length>1;
 const chars=cast.map(c=>({text:[sheet.characters[c.id],c.action].filter(Boolean).join(', '),center:{x:grid(c.at?.[0]??0.5),y:grid(c.at?.[1]??0.5)}}));
 return {input:base,model:sheet.model||'nai-diffusion-4-5-full',action:'generate',parameters:{params_version:3,width,height,scale:cg.scale||sheet.scale||5,sampler:'k_euler_ancestral',steps,n_samples:1,ucPreset:sheet.ucPreset??0,qualityToggle:true,dynamic_thresholding:false,cfg_rescale:cg.cfgRescale??sheet.cfgRescale??0,noise_schedule:'karras',legacy:false,legacy_v3_extend:false,legacy_uc:false,use_coords:useCoords,prefer_brownian:true,deliberate_euler_ancestral_bug:false,seed,negative_prompt:negative,
  characterPrompts:chars.map(c=>({prompt:c.text,uc:'',center:c.center,enabled:true})),
  v4_prompt:{caption:{base_caption:base,char_captions:chars.map(c=>({char_caption:c.text,centers:[c.center]}))},use_coords:useCoords,use_order:true},
  v4_negative_prompt:{caption:{base_caption:negative,char_captions:chars.map(c=>({char_caption:'',centers:[c.center]}))},legacy_uc:false}}};
}

// First file in a zip, read through the central directory (stored or deflated).
export function unzipFirst(buf){
 let eocd=buf.length-22;while(eocd>=0&&buf.readUInt32LE(eocd)!==0x06054b50)eocd--;if(eocd<0)throw new Error('Not a zip response');
 const cd=buf.readUInt32LE(eocd+16);if(buf.readUInt32LE(cd)!==0x02014b50)throw new Error('Bad zip directory');
 const method=buf.readUInt16LE(cd+10),size=buf.readUInt32LE(cd+20),name=buf.toString('utf8',cd+46,cd+46+buf.readUInt16LE(cd+28)),local=buf.readUInt32LE(cd+42);
 const start=local+30+buf.readUInt16LE(local+26)+buf.readUInt16LE(local+28),data=buf.subarray(start,start+size);
 if(method===0)return {name,data:Buffer.from(data)};if(method===8)return {name,data:inflateRawSync(data)};throw new Error(`Unsupported zip method ${method}`);
}

export async function generate(body,key,{fetchImpl=fetch}={}){
 const r=await fetchImpl(NOVELAI_URL,{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json',Accept:'application/x-zip-compressed'},body:JSON.stringify(body)});
 const buf=Buffer.from(await r.arrayBuffer());if(!r.ok)throw new Error(`NovelAI ${r.status}: ${buf.toString('utf8').slice(0,300)}`);return unzipFirst(buf).data;
}
