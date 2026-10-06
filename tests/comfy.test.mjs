import test from 'node:test';
import assert from 'node:assert/strict';
import {client,patch,renderSprite,renderCg,ComfyError,NODES,POSES} from '../packages/assets/comfy.mjs';

const json=(o,s=200)=>({ok:s<400,status:s,json:async()=>o,text:async()=>JSON.stringify(o),arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer});
// A fake ComfyUI: records prompts, completes immediately with one image per SaveImage node.
function fake({info={},fail}={}){const log={prompts:[],uploads:[]};let n=0;
 const f=async(url,init)=>{const p=new URL(url).pathname;
  if(p==='/object_info')return json(info);
  if(p==='/upload/image'){const name=init.body.get('image').name;log.uploads.push(name);return json({name});}
  if(p==='/prompt'){const w=JSON.parse(init.body).prompt;log.prompts.push(w);return json({prompt_id:'p'+(++n)});}
  if(p.startsWith('/history/')){const w=log.prompts[Number(p.slice(10))-1],outputs={};for(const [id,x] of Object.entries(w))if(x.class_type==='SaveImage')outputs[id]={images:[{filename:id+'.png',subfolder:'',type:'output'}]};
   return json({[p.slice(9)]:fail?{status:{status_str:'error',messages:[['execution_error',{node_type:'FaceDetailer',exception_message:'boom'}]]}}:{status:{status_str:'success',completed:true},outputs}});}
  if(p==='/view')return json({});throw Error('unexpected '+p);};
 return {f,log};}

test('patch fills nodes by id and drops the face branch unless kept',()=>{
 const w=patch('expression',{positive:'P',negative:'N',seed:7,pose:'a.png',source:'b.png'});
 assert.equal(w[NODES.expression.pos].inputs.text,'P');assert.equal(w[NODES.expression.seed].inputs.seed,7);assert.equal(w[NODES.expression.source].inputs.image,'b.png');
 assert.ok(!w['70']&&!w['79']);assert.ok(patch('expression',{keepFace:true})['79']);
});

test('unreachable ComfyUI reports setup instructions',async()=>{
 const c=client({fetchImpl:async()=>{throw Error('ECONNREFUSED');}});
 await assert.rejects(c.objectInfo(),e=>e instanceof ComfyError&&e.code==='COMFY_UNREACHABLE'&&/ComfyUI/.test(e.message)&&/Impact/.test(e.message));
});

test('check lists missing nodes and models',async()=>{
 const {f}=fake({info:{CheckpointLoaderSimple:{input:{required:{ckpt_name:[['other.safetensors']]}}}}}),miss=await client({fetchImpl:f}).check();
 assert.ok(miss.some(m=>/novaAnimeXL/.test(m)));assert.ok(miss.some(m=>/custom node FaceDetailer/.test(m)));
});

test('renderSprite runs base then expression with shared seed and uploaded pose/source',async()=>{
 const {f,log}=fake(),c=client({fetchImpl:f,pollMs:0,sleep:async()=>{}});
 const r=await renderSprite(c,{positive:'1girl',negative:'bad',seed:42,readFile:()=>Buffer.from('png')});
 assert.equal(log.prompts.length,2);assert.equal(log.prompts[0][NODES.base.pos].inputs.text,'1girl');assert.equal(log.prompts[1][NODES.expression.seed].inputs.seed,42);
 assert.equal(log.prompts[1][NODES.expression.source].inputs.image,'sf_src_42.png');assert.ok(log.uploads.includes('sf_pose_arms_at_sides.png'));assert.ok(r.sprite.length);
 const again=await renderSprite(c,{positive:'1girl',negative:'bad',seed:42,readFile:()=>Buffer.from('png')},{baseFrame:r.base});assert.equal(log.prompts.length,3);assert.ok(again.sprite);
});

test('renderCg patches detailer prompt; execution errors surface node and message; unknown pose rejected',async()=>{
 const ok=fake(),c=client({fetchImpl:ok.f,sleep:async()=>{}});await renderCg(c,{positive:'p',negative:'n',detailerPositive:'d',seed:1,readFile:()=>Buffer.from('x')});
 assert.equal(ok.log.prompts[0][NODES.cg.detailerPos].inputs.text,'d');
 const bad=fake({fail:true});await assert.rejects(renderCg(client({fetchImpl:bad.f,sleep:async()=>{}}),{positive:'p',seed:1,readFile:()=>Buffer.from('x')}),e=>e.code==='COMFY_EXECUTION'&&/FaceDetailer: boom|FaceDetailer.*boom/.test(e.message));
 await assert.rejects(renderCg(client({fetchImpl:ok.f}),{positive:'p',seed:1,pose:'nope'}),e=>e.code==='POSE_UNKNOWN');
 assert.ok(POSES.arms_at_sides);
});
