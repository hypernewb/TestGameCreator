// F11: expand role-slot storylet templates into a pack. Dry run by default (prints every variant for review); --write saves the pack.
// node scripts/bake-templates.mjs packs/after-hours.json packs/templates/after-hours.json [--write]
import {readFileSync,writeFileSync} from 'node:fs';
import {validatePack} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {bakeTemplates} from '../packages/cards/role-slots.mjs';
const [packFile,tplFile]=process.argv.slice(2).filter(a=>!a.startsWith('--')),write=process.argv.includes('--write');
if(!packFile||!tplFile){console.error('usage: bake-templates.mjs <pack.json> <templates.json> [--write]');process.exit(1);}
const read=f=>JSON.parse(readFileSync(f,'utf8')),templates=read(tplFile),pack=bakeTemplates(read(packFile),templates);validatePack(pack,registry);
for(const x of pack.scriptedScenes.filter(x=>templates.some(t=>t.id===x.template?.id)))console.log(`${x.id}  "${x.title}"  ${Object.entries(x.template.roles).map(([r,id])=>`${r}=${id}`).join(' ')}\n  ${x.opening}\n${(x.pages||[]).map(pg=>`  ${pg.speaker}: ${pg.text}`).join('\n')}`);
if(write){writeFileSync(packFile,JSON.stringify(pack,null,1)+'\n');console.log(`wrote ${packFile}`);}else console.log('dry run: pass --write to save');
