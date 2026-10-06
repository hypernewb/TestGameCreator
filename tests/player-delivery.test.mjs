import test from 'node:test';
import assert from 'node:assert/strict';
import {scenePromptMessages} from '../vendor/venus/scenePrompt.mjs';
import {CompatibleProvider} from '../packages/ai/providers.mjs';
import {beatDirection} from '../packages/ai/beats.mjs';

const pack={playerId:'player',actors:[{id:'player',name:'You'},{id:'jana',name:'Jana',personality:'warm and playful'}],locations:[],statDefinitions:[{id:'charm',name:'Charm',min:0,max:20,ranks:[{min:0,name:'Awkward'},{min:8,name:'Magnetic'}]}]};
const context=(charm=0)=>({stagedCast:['jana'],scenePhase:'continuation',playerAction:'You make it surprisingly difficult to play it cool.',sceneHistory:[{input:'Hi Jana.',text:'Jana: Hello again.'}],characterStats:[{character:'player',values:{charm}}]});

test('both writers recast the current speech on openings and continuations with slight ranked delivery',()=>{
 for(const sceneWriter of ['framework','venus'])for(const scenePhase of ['opening','continuation'])for(const [charm,rank] of [[0,'Awkward'],[8,'Magnetic']]){
  const c={...context(charm),sceneWriter,scenePhase},before=structuredClone(c),[sys,user]=scenePromptMessages(c,pack);
  assert.match(sys.content,/PLAYER DELIVERY:.*one short narrator beat.*recasting the submitted speech or action in indirect form: one clause/);
  assert.match(sys.content,/do not start every beat with "You"/);assert.doesNotMatch(sys.content,/"You" narrator beat/);
  assert.match(sys.content,/only on a bold move.*Ordinary talk gets plain delivery/);
  assert.match(sys.content,/Preserve meaning; recount the actual compliment, question or offer and who it concerns/);
  assert.match(sys.content,/Supplied stat ranks only slightly color delivery, and only on a bold move/);
  assert.match(sys.content,/Show audible timing or wording only, never hidden motives/);
  assert.match(sys.content,/low Charm adds awkward timing or a small hesitation; high Charm sounds easy, never guaranteed success/);
  assert.match(sys.content,/leave accepting, promises, consent, travel and spending to player decisions and committed outcomes/);
  assert.match(sys.content,/NPC replies never restate or paraphrase the player action/);
  assert.doesNotMatch(sys.content,/on a continuation never restate|Never restate or paraphrase the player action \(the reader/);
  assert.ok(user.content.includes(`Charm: ${rank} (${charm})`));assert.deepEqual(c,before);
 }
});

test('the late beat direction limits its no-echo instruction to NPC speech',()=>{
 const direction=beatDirection(context(),pack,'42');
 assert.match(direction,/That no-echo rule is for NPC speech: start with one short narration clause briefly recasting what the player actually said/);
 assert.match(direction,/slight stat-ranked delivery flavor, preserving meaning/);
});

test('missing stats keep neutral delivery and solo or authored scenes get no typed delivery instruction',()=>{
 const c=context();delete c.characterStats;
 assert.match(scenePromptMessages(c,pack)[0].content,/no relevant stat means neutral delivery/);
 assert.doesNotMatch(scenePromptMessages(c,pack)[1].content,/YOU —/);
 for(const extra of [{stagedCast:[],scenePhase:'solo'},{playerAction:''},{scriptedScene:true},{first:{checkpoint:0}}])assert.doesNotMatch(scenePromptMessages({...c,...extra},pack)[0].content,/PLAYER DELIVERY:/);
});

test('provider sends ranked delivery instructions and preserves indirect narration followed by the NPC reply',async()=>{
 const lines=[{speaker:'',text:'You tell Jana she makes playing it cool difficult, your teasing admission arriving a beat too quickly.'},{speaker:'jana',text:'That sounded almost rehearsed. Almost.'}],c=context();let sent;
 const p=new CompatibleProvider({endpoint:'https://example.test/v1/chat/completions',model:'mock',fetchImpl:async(_,init)=>{sent=JSON.parse(init.body);return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({lines})}}]}),{status:200,headers:{'content-type':'application/json'}});}});
 const result=await p.generateScene(c,pack);
 assert.match(sent.messages[0].content,/briefly recasting the submitted speech/);assert.match(sent.messages[1].content,/Charm: Awkward \(0\)/);
 assert.deepEqual(result.lines,lines);assert.equal(p.requests,1);assert.deepEqual(result.lintTrace||[],[]);
});
