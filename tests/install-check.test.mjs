import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {doctor} from '../scripts/doctor.mjs';

const run=async opts=>{const out=[];const result=await doctor({log:l=>out.push(l),port:0,...opts});return {...result,text:out.join('\n')}};
const fake=(root,dataDir,over={})=>({root,dataDir,nodeVersion:'24.9.0',checkPort:async()=> 'free',...over});
const env=()=>{const root=mkdtempSync(resolve(tmpdir(),'sf-doctor-'));return {root,dataDir:resolve(root,'data')}};
const status=(r,part)=>r.checks.find(c=>c.label.includes(part))?.status;

test('a good install passes every check and says how to start',async()=>{
  const {root,dataDir}=env();mkdirSync(resolve(root,'node_modules/electron'),{recursive:true});writeFileSync(resolve(root,'node_modules/electron/cli.js'),'');
  const r=await run(fake(root,dataDir));
  assert.equal(r.ok,true);
  assert.deepEqual(r.checks.map(c=>c.status),['ok','ok','ok','ok']);
  assert.match(r.text,/Story Framework install check/);
  assert.match(r.text,/Double-click Start-Windows\.cmd/);
  assert.match(r.text,/AI settings: not set yet/);
  rmSync(root,{recursive:true,force:true});
});
test('an old Node version fails with the download link',async()=>{
  const {root,dataDir}=env();
  const r=await run(fake(root,dataDir,{nodeVersion:'20.11.1'}));
  assert.equal(r.ok,false);
  assert.equal(status(r,'Node.js'),'fail');
  assert.match(r.text,/https:\/\/nodejs\.org\/en\/download/);
  assert.match(r.text,/1 problem\(s\) found/);
  rmSync(root,{recursive:true,force:true});
});
test('missing node_modules warns instead of failing, and names the npm fix',async()=>{
  const {root,dataDir}=env();
  const r=await run(fake(root,dataDir));
  assert.equal(status(r,'Dependencies'),'warn');
  assert.match(r.text,/npm install/);
  assert.equal(r.ok,true);
  rmSync(root,{recursive:true,force:true});
});
test('a folder that is not writable fails with a move-it fix',async()=>{
  const {root,dataDir}=env(),blocker=resolve(root,'blocker');writeFileSync(blocker,'not a folder');
  const r=await run(fake(root,blocker));
  assert.equal(r.ok,false);
  assert.equal(status(r,'not writable'),'fail');
  assert.match(r.text,/Move the whole game folder to a writable place/);
  rmSync(root,{recursive:true,force:true});
});
test('a port already in use fails and says to close the other window',async()=>{
  const {root,dataDir}=env();
  const r=await run(fake(root,dataDir,{port:4317,checkPort:async()=> 'busy'}));
  assert.equal(r.ok,false);
  assert.equal(status(r,'4317'),'fail');
  assert.match(r.text,/Close the other Story Framework window/);
  assert.equal((await run(fake(root,dataDir,{port:4317}))).ok,true);
  rmSync(root,{recursive:true,force:true});
});
test('the data folder is created and AI settings are only checked for existence',async()=>{
  const {root,dataDir}=env();
  await run(fake(root,dataDir));
  assert.equal(existsSync(dataDir),true);
  const settings=resolve(dataDir,'ai-settings.json');writeFileSync(settings,JSON.stringify({key:'test-key-123'}));
  const r=await run(fake(root,dataDir));
  assert.equal(status(r,'Data folder'),'ok');
  assert.match(r.text,/AI settings: already saved \(left untouched\)/);
  assert.equal(readFileSync(settings,'utf8'),JSON.stringify({key:'test-key-123'}));
  rmSync(root,{recursive:true,force:true});
});

const cmd=readFileSync(new URL('../Start-Windows.cmd',import.meta.url),'utf8');
const desktop=readFileSync(new URL('../Start-Desktop-Windows.cmd',import.meta.url),'utf8');
const labelBlock=(source,label)=>{const i=source.indexOf(`\n${label}`);assert.ok(i>0,`missing ${label}`);const rest=source.slice(i+label.length),j=rest.search(/^:[a-z]+$/m);return j<0?rest:rest.slice(0,j)};
test('both Windows launchers check the Node version, print the download link, and pause',()=>{
  for(const source of [cmd,desktop]){
    assert.match(source,/where node >nul 2>nul\s*\r?\nif errorlevel 1 goto nonode/);
    assert.match(source,/process\.versions\.node\.split\('\.'\)\[0\]\) >= 24/);
    assert.match(source,/if errorlevel 1 goto oldnode/);
    for(const label of [':nonode',':oldnode']){
      const block=labelBlock(source,label);
      assert.match(block,/https:\/\/nodejs\.org\/en\/download/,label);
      assert.match(block,/echo/i,label);
      assert.match(block,/pause/,label);
      assert.match(block,/exit \/b 1/,label);
    }
  }
});
test('both launchers run npm install once when node_modules is missing',()=>{
  assert.match(cmd,/if not exist node_modules \(\s*\r?\n\s*echo[^\n]*\r?\n\s*call npm install --omit=dev --no-audit --no-fund/);
  assert.match(desktop,/if not exist node_modules\\electron\\cli\.js \(\s*\r?\n\s*echo[^\n]*\r?\n\s*call npm install/);
  assert.match(cmd,/start "Story Framework server" cmd \/k node server\.mjs\s*\r?\n\s*timeout \/t \d+ \/nobreak >nul\s*\r?\n\s*start "" http:\/\/127\.0\.0\.1:4317/);
  assert.match(desktop,/call npm run desktop/);
});
test('README points a new player at Play it with a free key and 5 steps',()=>{
  const readme=readFileSync(new URL('../README.md',import.meta.url),'utf8'),start=readme.indexOf('## Play it');
  assert.ok(start>0&&start<readme.indexOf('## Multi-step events'));
  const section=readme.slice(start,readme.indexOf('\n## ',start+3));
  assert.equal((section.match(/^\d+\. /gm)||[]).length,5);
  assert.match(section,/https:\/\/aistudio\.google\.com\/apikey/);
  assert.match(section,/https:\/\/openrouter\.ai\/settings\/keys/);
  assert.match(section,/Start-Windows\.cmd/);
  assert.match(readFileSync(new URL('../package.json',import.meta.url),'utf8'),/"doctor": "node scripts\/doctor\.mjs"/);
});
