#!/usr/bin/env node
// Character Card V1/V2/V3 ⇄ scenario pack.
//   node scripts/card.mjs import <pack.json> <card.png|card.json> [--id x] [--location y] [--out pack.json]
//   node scripts/card.mjs export <pack.json> <actorId> [--v2] [--png base.png] --out card.json|card.png
import {readFileSync,writeFileSync} from 'node:fs';
import {validatePack} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {importCard,actorToCard,embedCard} from '../packages/cards/character-card.mjs';

const [cmd,packFile,arg,...rest]=process.argv.slice(2),opt=k=>{const i=rest.indexOf(`--${k}`);return i<0?undefined:rest[i+1]??true;};
if(!['import','export'].includes(cmd)||!packFile||!arg){console.error(readFileSync(new URL(import.meta.url),'utf8').split('\n').slice(1,4).join('\n'));process.exit(2);}
const pack=JSON.parse(readFileSync(packFile,'utf8'));
if(cmd==='import'){
 const {pack:next,actorId}=importCard(pack,readFileSync(arg),{id:opt('id'),location:opt('location')});validatePack(next,registry);
 const out=opt('out')||packFile;writeFileSync(out,JSON.stringify(next,null,2)+'\n');
 console.log(`Imported ${actorId} (+${next.lorebook.length-(pack.lorebook||[]).length} lore) → ${out}`);
}else{
 const out=opt('out');if(!out||out===true){console.error('--out is required');process.exit(2);}
 const card=actorToCard(pack,arg,{version:opt('v2')?2:3}),base=opt('png');
 writeFileSync(out,base?embedCard(readFileSync(base),card):JSON.stringify(card,null,2)+'\n');console.log(`Exported ${arg} as ${card.spec} → ${out}`);
}
