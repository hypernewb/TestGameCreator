import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
export function testGroups(names,mode='unit'){
 if(!['unit','browser','all'].includes(mode))throw Error('Use unit, browser or all.');
 const files=names.filter(f=>f.endsWith('.test.mjs')).sort(),group=browser=>({files:files.filter(f=>f.endsWith('-browser.test.mjs')===browser).map(f=>'tests/'+f),args:browser?['--test-concurrency=1']:[]});
 return (mode==='all'?[group(false),group(true)]:[group(mode==='browser')]).filter(g=>g.files.length);
}
if(resolve(process.argv[1]||'')===fileURLToPath(import.meta.url)){
 try{for(const g of testGroups(readdirSync('tests'),process.argv[2])){const r=spawnSync(process.execPath,['--test',...g.args,...g.files],{stdio:'inherit'});if(r.error)throw r.error;if(r.status!==0)process.exit(r.status??1);}}catch(e){console.error(e.message);process.exit(1);}
}
