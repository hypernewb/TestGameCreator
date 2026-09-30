// Cut sprite backgrounds with the local ComfyUI (InspyrenetRembg) in place, then crop each character's expressions/profile.png from her neutral.
// node scripts/comfy-cutout.mjs [--root public/assets/characters] [--only haruka,jiwoo] [--comfy http://127.0.0.1:8188] [--force]
import {readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {decodePng,encodePng,isCutout,profileBox,cropImage} from '../packages/assets/png.mjs';
import {expressionRel,profileRel,CHARACTER_FILE} from '../packages/assets/character-sprites.mjs';

const arg=(name,fallback)=>{const i=process.argv.indexOf(`--${name}`);return i<0?fallback:process.argv[i+1];},flag=name=>process.argv.includes(`--${name}`);
const root=arg('root','public/assets/characters'),comfy=arg('comfy','http://127.0.0.1:8188'),only=arg('only')?.split(','),wait=ms=>new Promise(r=>setTimeout(r,ms));
const json=async(r)=>{if(!r.ok)throw new Error(`ComfyUI ${r.status}: ${(await r.text()).slice(0,300)}`);return r.json();};
async function cut(png,name){
 const form=new FormData();form.append('image',new Blob([png],{type:'image/png'}),name);form.append('overwrite','true');const up=await json(await fetch(`${comfy}/upload/image`,{method:'POST',body:form}));
 const prompt={1:{class_type:'LoadImage',inputs:{image:up.name}},2:{class_type:'InspyrenetRembg',inputs:{image:['1',0],torchscript_jit:'default'}},3:{class_type:'SaveImage',inputs:{images:['2',0],filename_prefix:'sprite-cutout'}}};
 const {prompt_id}=await json(await fetch(`${comfy}/prompt`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt})}));
 for(let i=0;i<600;i++){const h=(await json(await fetch(`${comfy}/history/${prompt_id}`)))[prompt_id];
  if(h?.status?.status_str==='error')throw new Error(`${name}: ComfyUI error`);const img=h?.outputs?.['3']?.images?.[0];
  if(img){const r=await fetch(`${comfy}/view?${new URLSearchParams({filename:img.filename,subfolder:img.subfolder,type:img.type})}`);if(!r.ok)throw new Error(`${name}: view ${r.status}`);return Buffer.from(await r.arrayBuffer());}await wait(500);}
 throw new Error(`${name}: timed out`);
}
const ids=readdirSync(root,{withFileTypes:true}).filter(d=>d.isDirectory()&&existsSync(`${root}/${d.name}/${CHARACTER_FILE}`)&&(!only||only.includes(d.name))).map(d=>d.name);
for(const id of ids){
 const dir=`${root}/${id}`,sprites=[...(existsSync(`${dir}/expressions`)?readdirSync(`${dir}/expressions`).filter(f=>f.endsWith('.png')&&f!=='profile.png').map(f=>`expressions/${f}`):[]),
  ...(existsSync(`${dir}/outfits`)?readdirSync(`${dir}/outfits`).flatMap(s=>readdirSync(`${dir}/outfits/${s}`).filter(f=>f.endsWith('.png')).map(f=>`outfits/${s}/${f}`)):[])];
 for(const rel of sprites){const path=`${dir}/${rel}`,png=readFileSync(path);if(!flag('force')&&isCutout(decodePng(png)))continue;
  writeFileSync(path,await cut(png,`${id}-${rel.replaceAll('/','-')}`));console.log(`${id}/${rel} cut`);}
 const neutral=`${dir}/${expressionRel('neutral')}`;if(existsSync(neutral)&&(flag('force')||!existsSync(`${dir}/${profileRel()}`))){const img=decodePng(readFileSync(neutral));
  if(isCutout(img)){writeFileSync(`${dir}/${profileRel()}`,encodePng(cropImage(img,profileBox(img))));console.log(`${id}/${profileRel()} cropped`);}}
}
