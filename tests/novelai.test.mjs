import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {deflateRawSync} from 'node:zlib';
import {buildRequest,unzipFirst,generate} from '../packages/assets/novelai.mjs';
const sheet=JSON.parse(readFileSync(new URL('../art/cg/campus.json',import.meta.url)));
const zip=(name,data,method=8)=>{const body=method===8?deflateRawSync(data):data,n=Buffer.from(name),local=Buffer.alloc(30),cd=Buffer.alloc(46),end=Buffer.alloc(22);
 local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(method,8);local.writeUInt32LE(body.length,18);local.writeUInt16LE(n.length,26);
 cd.writeUInt32LE(0x02014b50,0);cd.writeUInt16LE(method,10);cd.writeUInt32LE(body.length,20);cd.writeUInt16LE(n.length,28);cd.writeUInt32LE(0,42);
 const at=30+n.length+body.length;end.writeUInt32LE(0x06054b50,0);end.writeUInt32LE(at,16);return Buffer.concat([local,n,body,cd,n,end]);};

test('CG requests put the style in the base caption and each cast member in their own character caption',()=>{
 for(const cg of sheet.cgs){const b=buildRequest(sheet,cg),p=b.parameters;assert.equal(b.model,'nai-diffusion-4-5-full');assert.ok(p.v4_prompt.caption.base_caption.includes(sheet.style));
  assert.equal(p.v4_prompt.caption.char_captions.length,cg.cast.length);for(const [i,c] of cg.cast.entries())assert.ok(p.v4_prompt.caption.char_captions[i].char_caption.startsWith(sheet.characters[c.id]));
  assert.match(p.negative_prompt,/underage/);assert.ok(p.width*p.height<=1024*1024&&p.steps<=28,'renders stay inside the free Opus allowance');assert.equal(p.seed,cg.seed);}
});

test('CG requests refuse to spend Anlas or draw unknown characters unless told to',()=>{
 const cg={id:'big',prompt:'x',cast:[],size:[1600,1200]};assert.throws(()=>buildRequest(sheet,cg),/costs Anlas/);assert.equal(buildRequest(sheet,cg,{allowAnlas:true}).parameters.width,1600);
 assert.throws(()=>buildRequest(sheet,{id:'who',prompt:'x',cast:[{id:'nobody'}]}),/unknown character nobody/);
 const two=buildRequest(sheet,{id:'two',prompt:'x',cast:[{id:'jana',at:[0.25,0.5]},{id:'monique',at:[0.75,0.5]}]}).parameters;assert.equal(two.use_coords,true);assert.deepEqual(two.v4_prompt.caption.char_captions.map(c=>c.centers[0].x),[0.3,0.7]);
});

test('sheets can pick the model, cfg rescale and UC preset (V5 sprite sheet)',()=>{
 const p=buildRequest({...sheet,model:'nai-diffusion-5-full',scale:9,cfgRescale:0.7,ucPreset:2,steps:18},{id:'s',prompt:'x',cast:[]});assert.equal(p.model,'nai-diffusion-5-full');assert.equal(p.parameters.cfg_rescale,0.7);assert.equal(p.parameters.ucPreset,2);assert.equal(p.parameters.scale,9);
 assert.equal(buildRequest(sheet,sheet.cgs[0]).parameters.cfg_rescale,0);
});

test('the zipped image comes back out whether stored or deflated, and API errors surface',async()=>{
 const png=Buffer.from('\x89PNG fake image bytes');for(const m of [0,8])assert.deepEqual(unzipFirst(zip('image_0.png',png,m)),{name:'image_0.png',data:png});
 assert.throws(()=>unzipFirst(Buffer.from('nope, not a zip at all')),/Not a zip/);
 const ok=async()=>({ok:true,arrayBuffer:async()=>zip('image_0.png',png)}),bad=async()=>({ok:false,status:402,arrayBuffer:async()=>Buffer.from('{"message":"not enough Anlas"}')});
 assert.deepEqual(await generate({},'k',{fetchImpl:ok}),png);await assert.rejects(generate({},'k',{fetchImpl:bad}),/402.*Anlas/);
});
