import test from 'node:test';
import assert from 'node:assert/strict';
import {openRouterComplete,OPENROUTER_URL,DRAFT_MODEL} from '../packages/cards/openrouter.mjs';

// M2 drafter transport: the key goes in a header only, 429/5xx retry, 4xx fails loudly, the default model is the owner's pick.
const reply=(status,body)=>({ok:status<300,status,json:async()=>body,text:async()=>JSON.stringify(body)});
const ok=t=>reply(200,{choices:[{message:{content:t}}],usage:{prompt_tokens:10,completion_tokens:5}});

test('openRouterComplete posts JSON mode to OpenRouter with the key as a bearer header and returns the content',async()=>{
 const seen=[],usage=[];const complete=openRouterComplete({key:'k-test',fetch:async(u,o)=>(seen.push([u,o]),ok('{"a":"b"}')),usage:u=>usage.push(u)});
 assert.equal(await complete([{role:'user',content:'hi'}]),'{"a":"b"}');
 const [u,o]=seen[0],body=JSON.parse(o.body);assert.equal(u,OPENROUTER_URL);assert.equal(o.headers.Authorization,'Bearer k-test');
 assert.equal(body.model,process.env.OPENROUTER_MODEL||DRAFT_MODEL);assert.equal(body.response_format.type,'json_object');assert.doesNotMatch(o.body,/k-test/,'the key never goes in the body');
 assert.deepEqual(usage,[{prompt_tokens:10,completion_tokens:5}]);
});

test('openRouterComplete retries rate limits and server errors, but not a bad request',async()=>{
 let n=0;const flaky=openRouterComplete({key:'k',tries:3,backoff:1,fetch:async()=>++n<3?reply(n===1?429:503,{}):ok('x')});
 assert.equal(await flaky([]),'x');assert.equal(n,3);
 n=0;const bad=openRouterComplete({key:'k',fetch:async()=>(n++,reply(401,{error:'no'}))});await assert.rejects(bad([]),/OpenRouter 401/);assert.equal(n,1);
 await assert.rejects(openRouterComplete({key:'k',fetch:async()=>reply(200,{choices:[]})})([]),/empty reply/);
});

test('openRouterComplete refuses to start without a key',()=>{assert.throws(()=>openRouterComplete({key:''}),/OPENROUTER_API_KEY/);});
test('a key pasted with its placeholder brackets or quotes still works',async()=>{
 for(const k of ['<k-test>','"k-test"',' k-test\n']){let h;await openRouterComplete({key:k,fetch:async(u,o)=>(h=o.headers.Authorization,reply(200,{choices:[{message:{content:'x'}}]}))})([]);assert.equal(h,'Bearer k-test',k);}
});
test('a timeout or network error is retried like a 5xx',async()=>{
 let n=0;assert.equal(await openRouterComplete({key:'k',backoff:1,fetch:async()=>{if(++n<2)throw new Error('timeout');return reply(200,{choices:[{message:{content:'y'}}]});}})([]),'y');assert.equal(n,2);
});
