import {readFileSync,readdirSync} from 'node:fs';
import {validatePack} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
const files=process.argv.slice(2);if(!files.length)files.push(...readdirSync(new URL('../packs/',import.meta.url)).filter(f=>f.endsWith('.json')).map(f=>new URL('../packs/'+f,import.meta.url)));
for(const file of files){try{const p=JSON.parse(readFileSync(file,'utf8'));const mods=validatePack(p,registry);console.log(`PASS ${p.id}: ${mods.length} modules, ${p.locations.length} locations`);}catch(e){console.error(`${file}: ${e.message}`);process.exitCode=1;}}
