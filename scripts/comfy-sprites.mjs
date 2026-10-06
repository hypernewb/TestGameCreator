// Render Venus-style character sprites/CGs with a local ComfyUI (Venus workflows in assets/comfy) into {root}/{id}/... and refresh index.json.
// node scripts/comfy-sprites.mjs [--check] [--root public/assets/characters] [--only haruka] [--emotions neutral,smile] [--sets default,gym] [--no-sprites] [--scenes foreplay] [--pose arms_at_sides] [--takes 3] [--force] [--dry]
// Env: COMFY_HOST (default 127.0.0.1:8188). Rooms have no Venus workflow and are skipped.
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {client,renderSprite,renderCg,poseTags,setupHelp,ComfyError,DEFAULT_POSE} from '../packages/assets/comfy.mjs';
import {spriteSheet,spriteManifest,CHARACTER_FILE,STYLE_FILE,INDEX_FILE,renderRel} from '../packages/assets/character-sprites.mjs';

const arg=(name,fallback)=>{const i=process.argv.indexOf(`--${name}`);return i<0?fallback:process.argv[i+1];},flag=name=>process.argv.includes(`--${name}`);
const fail=e=>{console.error(e instanceof ComfyError?`${e.code}: ${e.message}${e.detail?'\n'+JSON.stringify(e.detail).slice(0,600):''}`:e);process.exit(1);};
try{
 const c=client();
 if(flag('check')){const miss=await c.check();if(miss.length){console.error(`ComfyUI at ${c.base} is missing:\n- ${miss.join('\n- ')}\n\n${setupHelp()}`);process.exit(1);}console.log(`ComfyUI at ${c.base} has everything the workflows need.`);process.exit(0);}
 const root=arg('root','public/assets/characters'),read=p=>JSON.parse(readFileSync(p,'utf8')),style=read(`${root}/${STYLE_FILE}`),only=arg('only')?.split(','),pose=arg('pose',DEFAULT_POSE);
 const chars=readdirSync(root,{withFileTypes:true}).filter(d=>d.isDirectory()&&existsSync(`${root}/${d.name}/${CHARACTER_FILE}`)).map(d=>read(`${root}/${d.name}/${CHARACTER_FILE}`));
 const sheet=spriteSheet(style,chars.filter(c=>!only||only.includes(c.id)),{emotions:arg('emotions')?.split(','),sets:arg('sets')?.split(','),rooms:false,sprites:!flag('no-sprites'),scenes:arg('scenes')?.split(','),takes:arg('takes')?+arg('takes'):undefined});
 if(!flag('dry')){const miss=await c.check();if(miss.length)throw new ComfyError('COMFY_SETUP_INCOMPLETE',`ComfyUI at ${c.base} is missing: ${miss.join(', ')}. ${setupHelp()}`);}
 const frames=new Map(),tags=poseTags(pose).join(', ');
 for(const cg of sheet.cgs){
  const out=`${root}/${cg.rel}`;if(existsSync(out)&&!flag('force')){console.log(`${cg.id} exists`);continue;}
  const cap=sheet.characters[cg.id],neg=cg.negative||cg.uc||sheet.negative,pos=cg.scene?[cg.prompt,cap].filter(Boolean).join(',\n\n'):[tags,cg.prompt,cap].filter(Boolean).join(',\n\n');
  if(flag('dry')){console.log(cg.id,pos.replace(/\s+/g,' ').slice(0,200));continue;}
  const key=`${cg.char}/${cg.set}/${cg.take}`;let png;
  if(cg.scene)png=await renderCg(c,{positive:pos,negative:neg,detailerPositive:cap,seed:cg.seed,pose});
  else{const r=await renderSprite(c,{positive:pos,negative:neg,seed:cg.seed,pose},{baseFrame:frames.get(key)});frames.set(key,r.base);png=r.sprite;}
  const meta=`${root}/${cg.char}/${renderRel(cg.rel.slice(cg.char.length+1))}`;mkdirSync(dirname(out),{recursive:true});mkdirSync(dirname(meta),{recursive:true});
  writeFileSync(out,png);writeFileSync(meta,JSON.stringify({char:cg.char,set:cg.set,emotion:cg.emotion,scene:cg.scene,take:cg.take,seed:cg.seed,pose,positive:pos,negative:neg,engine:'comfyui'},null,1)+'\n');
  console.log(`${cg.rel} seed ${cg.seed} (${Math.round(png.length/1024)} KB)`);
 }
 if(!flag('dry'))writeFileSync(`${root}/${INDEX_FILE}`,JSON.stringify({characters:chars.map(c=>spriteManifest(c,rel=>existsSync(`${root}/${rel}`),style))},null,1)+'\n');
}catch(e){fail(e);}
