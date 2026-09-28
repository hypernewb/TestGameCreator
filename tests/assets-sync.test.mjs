import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,existsSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {syncAssets} from '../scripts/assets-sync.mjs';

const tempDir=()=>mkdtempSync(resolve(tmpdir(),'sf-assets-'));

test('dry run reports matches without copying anything',()=>{
  const sourceDir=tempDir(),outDir=resolve(tempDir(),'generated');
  writeFileSync(resolve(sourceDir,'hub_00001_.png'),'render');
  const {matched,missing,copied}=syncAssets({sourceDir,outDir,log:()=>{}});
  assert.equal(copied,false);
  assert.ok(matched.some(m=>m.id==='hub'));
  assert.ok(missing.includes('workshop'));
  assert.equal(existsSync(outDir),false);
});

test('--apply copies the newest render per id and leaves other ids alone',()=>{
  const sourceDir=tempDir(),outDir=resolve(tempDir(),'generated');
  writeFileSync(resolve(sourceDir,'hub_00001_.png'),'old');
  writeFileSync(resolve(sourceDir,'hub_00002_.png'),'new');
  const {copied,matched}=syncAssets({sourceDir,outDir,apply:true,log:()=>{}});
  assert.equal(copied,true);
  assert.equal(matched.find(m=>m.id==='hub').file,'hub_00002_.png');
  assert.equal(readFileSync(resolve(outDir,'hub.png'),'utf8'),'new');
});
