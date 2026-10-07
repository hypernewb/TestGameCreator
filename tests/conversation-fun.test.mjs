import test from 'node:test';
import assert from 'node:assert/strict';
import {conversationCue,exchangePolicy,conversationProse} from '../packages/ai/conversation.mjs';
import {beatDirection} from '../packages/ai/beats.mjs';
import {scenePromptMessages} from '../vendor/venus/scenePrompt.mjs';
const pack={playerId:'player',actors:[{id:'player',name:'You'},{id:'mina',name:'Mina',personality:'warm, playful and direct',backstory:'Started drawing during a long commute.',likes:['old cameras'],examples:['Try that again.']},{id:'ada',name:'Ada',personality:'warm'}]};
const ctx=(input,extra={})=>({stagedCast:['mina'],scenePhase:'continuation',sceneHistory:[{input:'How did you start drawing?',text:'Mina: On bus transfers, during my commute.'}],playerAction:input,actor:{id:'mina',relationshipToPlayer:45},...extra});
const dir=(input,extra={},seed='s1')=>beatDirection(ctx(input,extra),pack,seed);
const seeds=Array.from({length:40},(_,i)=>`s${i}`);

test('short inputs have distinct conversational meanings',()=>{
 for(const [input,cue] of [['Go on.','encourage'],['Tell me more.','encourage'],['No thanks.','refuse'],['Not now.','refuse'],["I'm scared.",'emotion'],['Okay.','ack'],['Nice try!','playful'],['I think coffee is overrated.','opinion'],['I grew up by the harbor.','disclosure'],['Nice frames.','neutral']])assert.equal(conversationCue(input),cue,input);
});

test('short refusals and emotional statements never introduce unrelated sheet topics',()=>{
 for(const input of ['No thanks.',"I'm scared.",'Not now.'])for(const seed of seeds)assert.doesNotMatch(dir(input,{},seed),/bring up |ask the player one specific question back/,input);
 assert.match(dir('No thanks.'),/acknowledge what the player declined without pressure/);
 assert.match(dir("I'm scared."),/respond to how the player feels/);
 assert.match(dir('No thanks.'),/without pressure or repeating the offer/);
});

test('encouragement develops the supplied thread without forced sheet-topic drift',()=>{
 for(const input of ['Go on.','Tell me more.'])for(const seed of seeds){assert.match(dir(input,{},seed),/develop the last conversational point/);assert.doesNotMatch(dir(input,{},seed),/bring up /);}
 assert.ok(seeds.every(seed=>!/bring up /.test(dir('Go on.',{sceneHistory:[]},seed))));
 const c=ctx('Go on.');c.direction=beatDirection(c,pack);assert.match(scenePromptMessages(c,pack)[1].content,/On bus transfers, during my commute/);assert.doesNotMatch(c.direction,/Sound like/);
});

test('ordinary meaning and stage boundaries replace seeded personality moves without mutating context',()=>{
 for(const input of ['Nice try!','I grew up by the harbor.','I think coffee is overrated.']){const directions=seeds.map(seed=>dir(input,{},seed));assert.equal(new Set(directions).size,1);assert.doesNotMatch(directions[0],/flirt a little|tease the player lightly|dodge with a dry aside|show curiosity through a specific observation/);}
 for(const phase of ['rejected','broken'])for(const seed of seeds){const d=dir('Nice try!',{dating:[{character:'mina',phase}]},seed);assert.doesNotMatch(d,/flirt a little|admit one small/);assert.match(d,/no romantic or physical escalation/);}
 const before=ctx('Nice try!'),saved=structuredClone(before);assert.equal(beatDirection(before,pack,'same'),beatDirection(before,pack,'different'));assert.deepEqual(before,saved);
});

test('vulnerable replies stay on the feeling and disclosures do not force an interview or stock opinion',()=>{
 for(const input of ['That joke hurt.',"I think I'm scared."]){assert.equal(conversationCue(input),'emotion');assert.match(dir(input),/respond to how the player feels/);assert.doesNotMatch(dir(input),/tease the player|disagree/);}
 for(const seed of seeds){const c=ctx('I grew up by the harbor.',{sceneHistory:[{input:'Hi.',text:'Mina: Where did you grow up?'}]});c.direction=beatDirection(c,pack,seed);assert.match(c.direction,/respond to what the player means/);assert.doesNotMatch(c.direction,/give their own opinion|ask the player/);const [sys,user]=scenePromptMessages(c,pack);assert.match(sys.content,/Stay with the current subject/);assert.ok(user.content.includes(c.sceneHistory[0].text));assert.ok(user.content.includes(c.playerAction));}
});

test('an explicit refusal answers a hanging offer without re-asking it',()=>{
 const c=ctx('No thanks.',{hangingAsk:{by:'Mina',text:'Would you like to go out?'}});c.direction=beatDirection(c,pack,'s1');
 assert.match(c.direction,/acknowledge what the player declined without pressure/);assert.doesNotMatch(c.direction,/call back their own unanswered question/);assert.equal(exchangePolicy(c).ordinary,true);assert.equal(exchangePolicy(c).min,undefined);
 assert.doesNotMatch(scenePromptMessages(c,pack)[0].content,/INITIATIVE:|End with a specific question or offer/);
});

test('ordinary exchanges share one capped length policy in both writers and keep agency and JSON safeguards',()=>{
 for(const sceneWriter of ['framework','venus'])for(const input of ['Okay.','Nice try!','No thanks.']){
  const c=ctx(input,{sceneWriter}),p=exchangePolicy(c);assert.equal(p.ordinary,true);assert.equal(p.max,12);assert.equal(p.min,undefined);assert.equal(p.range,undefined);c.direction=beatDirection(c,pack,'s1');
  const [sys,user]=scenePromptMessages(c,pack);assert.ok(sys.content.includes(conversationProse));assert.doesNotMatch(sys.content+user.content,/2-3 visual-novel entries|5-7 visual-novel entries|6-9 visual-novel entries|at least four entries NPC dialogue|never a bare one-liner|End with a specific question or offer|INITIATIVE:|one short narrator beat/);
  assert.match(sys.content,/Accepting invitations, consent, promises, travel and spending require the player/);assert.match(sys.content,/Never invent player reactions/);assert.match(sys.content,/This JSON contract takes priority/);assert.match(sys.content,/Committed outcomes are authoritative/);assert.match(sys.content,/set end_scene true/);
 }
});

test('ordinary groups keep the closed cast and profiles without forced participation quotas',()=>{
 const c=ctx('Okay.',{stagedCast:['mina','ada']}),p=exchangePolicy(c);assert.equal(p.min,undefined);assert.equal(p.max,12);const [sys,user]=scenePromptMessages(c,pack);assert.doesNotMatch(sys.content,/Every present character gets at least one spoken line|3-4 visual-novel entries/);assert.match(sys.content,/cast is a closed attendance list/);assert.match(sys.content,/Only allowed cast IDs may speak/);assert.match(user.content,/Mina \(mina/);assert.match(user.content,/Ada \(ada/);assert.match(user.content,/"cast":\["mina","ada"\]/);
});

test('ordinary substantial replies have room to develop while authored checkpoints closing and solo retain their contracts',()=>{
 for(const input of ['What made you start drawing?','Go on.',"I'm scared."]){assert.equal(exchangePolicy(ctx(input)).min,undefined);assert.match(scenePromptMessages(ctx(input),pack)[0].content,/Let characters finish connected thoughts/);}
 for(const extra of [{scenePhase:'opening'},{repeatAsk:'Mina'},{hangingAsk:{by:'Mina',text:'What do you think?'}}])assert.equal(exchangePolicy(ctx('Okay.',extra)).ordinary,true);
 for(const extra of [{scenePhase:'closing'},{scenePhase:'solo',stagedCast:[]},{scriptedScene:{id:'authored'}},{first:{checkpoint:0}}]){const c=ctx('Okay.',extra);assert.equal(exchangePolicy(c).ordinary,undefined);assert.equal(exchangePolicy(c).quick,false);if(extra.scriptedScene||extra.scenePhase==='solo')assert.doesNotMatch(scenePromptMessages(c,pack)[0].content,/one connected reply with dialogue and meaningful action/);else assert.match(scenePromptMessages(c,pack)[0].content,/one connected reply with dialogue and meaningful action/);}
 assert.match(scenePromptMessages(ctx('Bye.',{scenePhase:'closing'}),pack)[1].content,/set end_scene true/);assert.match(scenePromptMessages(ctx('Okay.',{first:{checkpoint:0}}),pack)[0].content,/engine supplies that checkpoint/);
 assert.doesNotMatch(dir('No thanks.',{scriptedScene:{id:'authored'}}),/acknowledge what the player declined without pressure/);
});

test('question endings and agendas stay optional across ordinary project styles',()=>{
 for(const sceneWriter of ['framework','venus'])for(const conversationStyle of ['continuous','bounded']){
  const c=ctx('Okay.',{sceneWriter,gameProject:{conversationStyle}}),[sys,user]=scenePromptMessages(c,pack);assert.doesNotMatch(user.content,/Let the character react with initiative/);assert.ok(sys.content.includes(conversationProse));assert.match(sys.content,/a question is optional, not a required ending/);assert.doesNotMatch(sys.content,/INITIATIVE:|End with a specific question/);assert.match(sys.content,/Stay with the current subject/);assert.match(user.content,/conversation prose policy above/);
 }
});
