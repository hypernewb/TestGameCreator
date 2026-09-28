import test from 'node:test';
import assert from 'node:assert/strict';
import {ASSET_MANIFEST,BACKGROUND_SIZE,PORTRAIT_SIZE,findAsset,workflowFor} from '../packages/assets/manifest.mjs';
import {planSync} from '../packages/assets/sync.mjs';

test('every asset has a unique id, kind-correct size, prompt, and placeholder',()=>{
  const ids=new Set();
  for(const a of ASSET_MANIFEST){
    assert.equal(ids.has(a.id),false,`duplicate id ${a.id}`);ids.add(a.id);
    assert.ok(['background','portrait'].includes(a.kind));
    const size=a.kind==='background'?BACKGROUND_SIZE:PORTRAIT_SIZE;
    assert.equal(a.width,size.width);assert.equal(a.height,size.height);
    assert.ok(a.prompt.length>0);assert.ok(a.negative.length>0);
    assert.equal(a.placeholder,`assets/${a.id}.svg`);
  }
});

test('findAsset looks up by id',()=>{
  assert.equal(findAsset('hub').kind,'background');
  assert.equal(findAsset('missing'),undefined);
});

test('workflowFor produces a ComfyUI API graph sized and prefixed for the asset',()=>{
  const entry=findAsset('ada-neutral'),workflow=workflowFor(entry,{seed:7,checkpoint:'test.safetensors'});
  assert.equal(workflow['4'].inputs.ckpt_name,'test.safetensors');
  assert.equal(workflow['5'].inputs.width,PORTRAIT_SIZE.width);
  assert.equal(workflow['5'].inputs.height,PORTRAIT_SIZE.height);
  assert.equal(workflow['6'].inputs.text,entry.prompt);
  assert.equal(workflow['7'].inputs.text,entry.negative);
  assert.equal(workflow['3'].inputs.seed,7);
  assert.equal(workflow['9'].inputs.filename_prefix,'ada-neutral');
});

test('planSync matches the newest numbered render per asset id and reports the rest as missing',()=>{
  const {matched,missing}=planSync({ids:['hub','workshop','meeting'],files:['hub_00001_.png','hub_00012_.png','hub_00002_.png','workshop_00001_.jpg','unrelated_00001_.png','not-a-render.png']});
  assert.deepEqual(matched.sort((a,b)=>a.id.localeCompare(b.id)),[{id:'hub',file:'hub_00012_.png',ext:'png'},{id:'workshop',file:'workshop_00001_.jpg',ext:'jpg'}]);
  assert.deepEqual(missing,['meeting']);
});
