// List persona-theme art assets, or write ComfyUI API-format workflows for them. Run with --help for examples.
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {ASSET_MANIFEST,workflowFor} from '../packages/assets/manifest.mjs';

const argv=process.argv.slice(2),command=argv.shift();
const arg=(name,fallback)=>{const i=argv.indexOf(`--${name}`);return i<0?fallback:argv[i+1];};
const help=()=>console.log(`Persona-theme asset manifest\n\nList assets and prompts:\n  node scripts/assets-manifest.mjs list\n\nWrite one ComfyUI API-format workflow JSON per asset:\n  node scripts/assets-manifest.mjs workflows --out generated/comfyui-workflows [--checkpoint sd_xl_base_1.0.safetensors] [--seed 0]\n\nLoad a workflow in ComfyUI with "Load" (Workflow menu), or POST its contents as {"prompt": <workflow>} to a running server's /prompt endpoint. Queued renders save as <asset-id>_00001_.png in ComfyUI's output folder — pull them into the project with:\n  node scripts/assets-sync.mjs --from <comfyui output dir>`);

if(!command||command==='--help'||command==='help')help();
else if(command==='list')for(const a of ASSET_MANIFEST)console.log(`${a.id}\t${a.kind}\t${a.width}x${a.height}\t${a.prompt}`);
else if(command==='workflows'){
  const outArg=arg('out');if(!outArg)throw Error('Missing --out');
  const out=resolve(outArg);mkdirSync(out,{recursive:true});
  const options={checkpoint:arg('checkpoint','sd_xl_base_1.0.safetensors'),seed:Number(arg('seed',0))};
  for(const entry of ASSET_MANIFEST){
    const file=resolve(out,`${entry.id}.json`);
    writeFileSync(file,JSON.stringify(workflowFor(entry,options),null,2)+'\n');
    console.log(`Wrote ${file}`);
  }
}else throw Error(`Unknown command: ${command}`);
