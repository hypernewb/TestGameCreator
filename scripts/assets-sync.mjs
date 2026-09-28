// Pull ComfyUI-generated renders into public/assets/generated, additive-only (never touches the existing SVG placeholders). Run with --help for examples.
import {readdirSync,mkdirSync,copyFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {ASSET_MANIFEST} from '../packages/assets/manifest.mjs';
import {planSync} from '../packages/assets/sync.mjs';

const argv=process.argv.slice(2);
const arg=(name,fallback)=>{const i=argv.indexOf(`--${name}`);return i<0?fallback:argv[i+1];};
const help=()=>console.log(`Sync ComfyUI renders into the project\n\nDry run (reports matches, changes nothing):\n  node scripts/assets-sync.mjs --from <comfyui output dir>\n\nCopy matched renders into public/assets/generated/<id>.<ext>:\n  node scripts/assets-sync.mjs --from <comfyui output dir> --apply\n\nMatches the newest <id>_00001_.png-style file per manifest asset id (see scripts/assets-manifest.mjs list). Existing SVG placeholders are never modified.`);

export function syncAssets({sourceDir,outDir,apply=false,log=console.log}={}){
  const files=readdirSync(sourceDir);
  const {matched,missing}=planSync({ids:ASSET_MANIFEST.map(a=>a.id),files});
  if(matched.length){log(`Found ${matched.length} render(s):`);for(const m of matched)log(`  ${m.id} <- ${m.file}`);}
  if(missing.length){log(`No render found for: ${missing.join(', ')}`);}
  if(!apply){log('\nDry run only — nothing copied. Re-run with --apply to copy matched renders into public/assets/generated/.');return {matched,missing,copied:false};}
  mkdirSync(outDir,{recursive:true});
  for(const m of matched)copyFileSync(resolve(sourceDir,m.file),resolve(outDir,`${m.id}.${m.ext}`));
  log(`\nCopied ${matched.length} render(s) into ${outDir}.`);
  return {matched,missing,copied:true};
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  if(argv.includes('--help')||argv.includes('help')||!arg('from'))help();
  else syncAssets({sourceDir:resolve(arg('from')),outDir:fileURLToPath(new URL('../public/assets/generated',import.meta.url)),apply:argv.includes('--apply')});
}
