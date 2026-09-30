// Render Venus-style character sprites with NovelAI into {root}/{id}/expressions/{emotion}.png and refresh index.json. Free tier only.
// node scripts/novelai-sprites.mjs [--root public/assets/characters] [--only haruka,jiwoo] [--emotions neutral,smile] [--sets default,gym] [--no-rooms] [--no-sprites] [--scenes foreplay,oral] [--takes 3] [--force] [--dry]
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {buildRequest,generate} from '../packages/assets/novelai.mjs';
import {spriteSheet,spriteManifest,CHARACTER_FILE,STYLE_FILE,INDEX_FILE,renderRel} from '../packages/assets/character-sprites.mjs';

const arg=(name,fallback)=>{const i=process.argv.indexOf(`--${name}`);return i<0?fallback:process.argv[i+1];},flag=name=>process.argv.includes(`--${name}`);
const root=arg('root','public/assets/characters'),read=p=>JSON.parse(readFileSync(p,'utf8')),style=read(`${root}/${STYLE_FILE}`),only=arg('only')?.split(',');
const chars=readdirSync(root,{withFileTypes:true}).filter(d=>d.isDirectory()&&existsSync(`${root}/${d.name}/${CHARACTER_FILE}`)).map(d=>read(`${root}/${d.name}/${CHARACTER_FILE}`));
const sheet=spriteSheet(style,chars.filter(c=>!only||only.includes(c.id)),{emotions:arg('emotions')?.split(','),sets:arg('sets')?.split(','),rooms:!flag('no-rooms'),sprites:!flag('no-sprites'),scenes:arg('scenes')?.split(','),takes:arg('takes')?+arg('takes'):undefined});
if(!process.env.NOVELAI_API_KEY&&existsSync('.env'))process.loadEnvFile('.env');const key=process.env.NOVELAI_API_KEY;
if(!flag('dry')&&!key)throw new Error('Set NOVELAI_API_KEY (environment or .env)');
for(const cg of sheet.cgs){
 const out=`${root}/${cg.rel}`;if(existsSync(out)&&!flag('force')){console.log(`${cg.id} exists`);continue;}
 const body=buildRequest(sheet,cg);if(flag('dry')){console.log(cg.id,JSON.stringify(body.parameters.v4_prompt.caption.char_captions[0]?.char_caption??body.input));continue;}
 const png=await generate(body,key);const meta=`${root}/${cg.char}/${renderRel(cg.rel.slice(cg.char.length+1))}`;mkdirSync(dirname(out),{recursive:true});mkdirSync(dirname(meta),{recursive:true});
 writeFileSync(out,png);writeFileSync(meta,JSON.stringify({char:cg.char,set:cg.set,emotion:cg.emotion,room:cg.room,scene:cg.scene,take:cg.take,seed:cg.seed,request:body},null,1)+'\n');
 console.log(`${cg.rel} seed ${cg.seed} (${Math.round(png.length/1024)} KB)`);
}
writeFileSync(`${root}/${INDEX_FILE}`,JSON.stringify({characters:chars.map(c=>spriteManifest(c,rel=>existsSync(`${root}/${rel}`),style))},null,1)+'\n');
