import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
export function testGroups(names,mode='unit',only=[]){
 if(!['unit','browser','all'].includes(mode))throw Error('Use unit, browser or all.');
 for(const name of only)if(!names.includes(name)||!name.endsWith('.test.mjs')||mode!=='all'&&name.endsWith('-browser.test.mjs')!==(mode==='browser'))throw Error('Test is not in this group: '+name);
 const files=names.filter(f=>f.endsWith('.test.mjs')&&(!only.length||only.includes(f))).sort(),group=browser=>({files:files.filter(f=>f.endsWith('-browser.test.mjs')===browser).map(f=>'tests/'+f),args:browser?['--test-concurrency=1']:[]});
 return (mode==='all'?[group(false),group(true)]:[group(mode==='browser')]).filter(g=>g.files.length);
}
if(resolve(process.argv[1]||'')===fileURLToPath(import.meta.url)){
 try{for(const g of testGroups(readdirSync('tests'),process.argv[2],process.argv.slice(3))){const r=spawnSync(process.execPath,['--test',...g.args,...g.files],{stdio:'inherit'});if(r.error)throw r.error;if(r.status!==0)process.exit(r.status??1);}}catch(e){console.error(e.message);process.exit(1);}
}
