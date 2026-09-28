// Render CGs from an art sheet with NovelAI. Key: NOVELAI_API_KEY in the environment or the gitignored .env.
// node scripts/novelai-cg.mjs [--sheet art/cg/after-hours.json] [--only id,id] [--seed n] [--dry] [--allow-anlas]
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {buildRequest,generate} from '../packages/assets/novelai.mjs';

const arg=(name,fallback)=>{const i=process.argv.indexOf(`--${name}`);return i<0?fallback:process.argv[i+1];},flag=name=>process.argv.includes(`--${name}`);
const sheetPath=arg('sheet','art/cg/after-hours.json'),sheet=JSON.parse(readFileSync(sheetPath,'utf8')),only=arg('only')?.split(','),out=arg('out','public/assets/generated/cg'),meta='art/cg/renders';
const cgs=sheet.cgs.filter(c=>!only||only.includes(c.id));if(only)for(const id of only)if(!cgs.some(c=>c.id===id))throw new Error(`Unknown CG ${id}`);
if(!process.env.NOVELAI_API_KEY&&existsSync('.env'))process.loadEnvFile('.env');const key=process.env.NOVELAI_API_KEY;
if(!flag('dry')&&!key)throw new Error('Set NOVELAI_API_KEY (environment or .env)');
mkdirSync(out,{recursive:true});mkdirSync(meta,{recursive:true});
for(const cg of cgs){
 const seed=Number(arg('seed',cg.seed??Math.floor(Math.random()*2**32))),body=buildRequest(sheet,cg,{seed,allowAnlas:flag('allow-anlas')});
 if(flag('dry')){console.log(cg.id,JSON.stringify(body.parameters.v4_prompt.caption));continue;}
 let v=1;while(existsSync(`${out}/${cg.id}_v${String(v).padStart(2,'0')}.png`))v++;const name=`${cg.id}_v${String(v).padStart(2,'0')}`;
 const png=await generate(body,key);writeFileSync(`${out}/${name}.png`,png);writeFileSync(`${meta}/${name}.json`,JSON.stringify({sheet:sheetPath,cg:cg.id,scene:cg.scene,seed,request:body},null,2)+'\n');
 console.log(`${name}.png seed ${seed} (${Math.round(png.length/1024)} KB)`);
}
