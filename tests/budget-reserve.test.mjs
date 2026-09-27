import test from 'node:test';
import assert from 'node:assert/strict';
import {replyReserve,messageTokens} from '../packages/ai/budget.mjs';
import {CompatibleProvider} from '../packages/ai/providers.mjs';

const u=n=>({tokens:{completion_tokens:n}});
test('cold-start reply reserve scales with the window instead of holding the full ceiling',()=>{
 assert.equal(replyReserve([],1800,512,5,4096),820,'a fifth of a 4k window');
 assert.equal(replyReserve([],1800,512,5,2048),512,'never below the floor');
 assert.equal(replyReserve([],1800,512,5,32768),1800,'never above max_tokens');
 assert.equal(replyReserve([],1800),1800,'no window keeps the old behaviour');
 assert.equal(replyReserve([u(900),u(60),u(110),u(50),u(70)],1800,512,5,4096),1350,'observed replies win once calibrated');
});
test('max_tokens is capped to what the window leaves after the prompt',async()=>{
 let sent;const fetchImpl=async(url,init)=>{sent=JSON.parse(init.body);return {ok:true,json:async()=>({choices:[{message:{content:'ok'},finish_reason:'stop'}],usage:{prompt_tokens:10,completion_tokens:1}})};};
 const messages=[{role:'system',content:'x'.repeat(12000)},{role:'user',content:'hi'}];
 const p=new CompatibleProvider({endpoint:'http://localhost:1234/v1/chat/completions',model:'m',maxTokens:1800,contextWindow:4096,fetchImpl});
 await p.complete(messages);
 const prompt=messageTokens(messages);assert.ok(sent.max_tokens<1800&&sent.max_tokens+prompt<=4096,`prompt ${prompt} + max_tokens ${sent.max_tokens} fits 4096`);
 p.contextWindow=null;await p.complete([{role:'user',content:'hi'}]);assert.equal(sent.max_tokens,1800,'unknown window sends the configured ceiling');
 p.contextWindow=4096;await p.complete([{role:'system',content:'x'.repeat(20000)}]);assert.equal(sent.max_tokens,256,'an over-long prompt still leaves room for a short reply');
});
