import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
export function frameworkStatus(provenance=JSON.parse(fs.readFileSync('artifacts/venus-framework-comparison/framework-provenance.json')),read=path=>fs.readFileSync(path)){
 const files=provenance.workingTreeFiles.map(f=>{try{const actual=createHash('sha256').update(read(f.path)).digest('hex');return {...f,actual,matches:actual===f.sha256};}catch(e){return {...f,actual:null,matches:false,error:e.code||'read failed'};}});return {fresh:files.every(f=>f.matches),files,changed:files.filter(f=>!f.matches).map(f=>f.path)};
}
export function assertFrameworkFresh(status=frameworkStatus()){assert.ok(status.fresh,'Prepared framework source has changed; create a separate fresh comparison before materializing: '+status.changed.join(', '));return status;}
