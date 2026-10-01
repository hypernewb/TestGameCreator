import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {beatDirection} from '../packages/ai/beats.mjs';
import {scenePromptMessages,calmContinuationMessages} from '../vendor/venus/scenePrompt.mjs';
import {SUSTAINED_SCENARIOS,repeatedScenarios,blindReview,sustainedMetrics} from '../packages/testing/sustained-conversations.mjs';
import {Store} from '../packages/persistence/store.mjs';
import {GameService} from '../packages/ai/service.mjs';
import {MockProvider} from '../packages/ai/providers.mjs';
import {registry} from '../packages/modules/index.mjs';
import {runPromptAB} from '../packages/testing/prompt-ab-runner.mjs';
import {CRITERIA} from '../packages/testing/prompt-ab.mjs';

test('calm changes continuation policy while preserving length, openings, closing and checkpoint prompts',()=>{
 const pack=JSON.parse(readFileSync(new URL('../packs/campus.json',import.meta.url))),context={stagedCast:['jana'],scenePhase:'continuation',playerAction:'Ask Jana what she misses about home.',sceneHistory:[],actor:{id:'jana',relationshipToPlayer:30},gameProject:{conversationStyle:'continuous'}};
 context.baseDirection=beatDirection(context,pack,'same-seed');context.direction=context.baseDirection;
 context.calmDirection=beatDirection({...context,continuationStyle:'calm'},pack,'same-seed');
 const plain=scenePromptMessages(context,pack),calm=calmContinuationMessages(context,pack);
 assert.notDeepEqual(calm,plain);assert.match(plain[0].content,/INITIATIVE:/);assert.doesNotMatch(calm[0].content,/INITIATIVE:/);
 assert.match(calm[0].content,/6–9/);assert.match(calm[0].content,/At least four/);assert.match(calm[1].content,/same subject/);
 for(const override of [{scenePhase:'opening'},{scenePhase:'closing'},{first:{rung:'kiss'}},{scriptedScene:'authored'},{direction:'Engine-controlled closure'}])assert.deepEqual(calmContinuationMessages({...context,...override},pack),scenePromptMessages({...context,...override},pack));
});

test('whole conversation judging sees complete final displays, independent initial trust and no early termination',async()=>{
 const pack=JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)));delete pack.schedules;
 pack.gameProject={...JSON.parse(readFileSync(new URL('../packs/crossed-plans.json',import.meta.url))).gameProject,conversationStyle:'continuous'};
 const store=new Store(),variants={ours:new MockProvider(),calm:new MockProvider()},service=new GameService(store,{[pack.id]:pack},registry,variants.ours),judged=[];
 const score=Object.fromEntries(Object.keys(CRITERIA).map(k=>[k,7]));
 try{
  const rows=await runPromptAB({service,store,pack,registry,view:state=>({state,pack:service.packs[pack.id]}),variants,scenarios:{close:{initialTrust:{ada:80},inputs:['Go find Ada','Tell her my favorite color is teal','Ask what my favorite color is']}},judgeScope:'conversation',mode:'trajectory',judgeProvider:{async complete(messages){judged.push(messages);return JSON.stringify({A:score,B:score,winner:'tie',why:'Similar.'});}}});
  assert.equal(judged.length,2);assert.match(judged[0][1].content,/TURN 1/);assert.match(judged[0][1].content,/TURN 3/);
  assert.equal(rows[0].verdicts.length,0);assert.equal(rows[2].verdicts.length,1);
  assert.equal(rows[0].ours.before.relationships.edges['ada--player'],80);assert.deepEqual(rows[0].ours.before,rows[0].calm.before);
  assert.equal(service.packs[pack.id],pack);assert.ok(!pack.initialRelationships?.some(r=>r.trust===80));
  const blind=blindReview(rows,['ours','calm'],42);assert.doesNotMatch(blind.markdown,/Transcript ours|Transcript calm|winner|verdict/);assert.equal(Object.keys(blind.key).length,1);
  assert.equal(sustainedMetrics(rows,['ours','calm']).ours.turns,3);
 }finally{store.close();}
});

test('three sustained fixtures have ten steps, callbacks, explicit exit and independent repeats',()=>{
 const copies=repeatedScenarios(SUSTAINED_SCENARIOS,2);assert.equal(Object.keys(copies).length,6);
 assert.ok(Object.values(copies).every(f=>f.inputs.length===10&&f.inputs.at(-1).plannedExit));
 copies['affection-r1'].initialTrust.jana=1;assert.equal(copies['affection-r2'].initialTrust.jana,80);
 assert.throws(()=>repeatedScenarios(SUSTAINED_SCENARIOS,0));
});

test('a refused action stays in the sustained transcript and the final critique still runs',async()=>{
 const pack=JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url))),store=new Store(),variants={ours:new MockProvider(),calm:new MockProvider()},service=new GameService(store,{[pack.id]:pack},registry,variants.ours);
 const score=Object.fromEntries(Object.keys(CRITERIA).map(k=>[k,7]));let calls=0;
 try{
  const rows=await runPromptAB({service,store,pack,registry,view:state=>({state,pack}),variants,scenarios:{refused:['Go find Ada',{input:'Impossible action',command:{type:'missing.command',args:{}}},'Ask Ada how she is doing']},mode:'trajectory',judgeScope:'conversation',judgeProvider:{async complete(messages){calls++;assert.match(messages[1].content,/Impossible action/);assert.match(messages[1].content,/\[ERROR\]/);return JSON.stringify({A:score,B:score,winner:'tie',why:'Observed refusal included.'});}}});
  assert.equal(rows.length,3);assert.ok(rows[1].ours.error);assert.ok(rows[1].calm.error);assert.equal(calls,2);assert.equal(rows[2].verdicts.length,1);
 }finally{store.close();}
});
