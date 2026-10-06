import test from 'node:test';
import assert from 'node:assert/strict';
import {conversationCue,exchangePolicy} from '../packages/ai/conversation.mjs';
import {beatDirection} from '../packages/ai/beats.mjs';
import {scenePromptMessages} from '../vendor/venus/scenePrompt.mjs';
const pack={playerId:'player',actors:[{id:'player',name:'You'},{id:'mina',name:'Mina',personality:'warm, playful and direct',backstory:'Started drawing during a long commute.',likes:['old cameras'],examples:['Try that again.']},{id:'ada',name:'Ada',personality:'warm'}]};
const ctx=(input,extra={})=>({stagedCast:['mina'],scenePhase:'continuation',sceneHistory:[{input:'How did you start drawing?',text:'Mina: On bus transfers, during my commute.'}],playerAction:input,actor:{id:'mina',relationshipToPlayer:45},...extra});
const dir=(input,extra={},seed='s1')=>beatDirection(ctx(input,extra),pack,seed);
const seeds=Array.from({length:40},(_,i)=>`s${i}`);
const move=s=>s.split(', then ')[1].split('. ')[0];

test('short inputs have distinct conversational meanings',()=>{
 for(const [input,cue] of [['Go on.','encourage'],['Tell me more.','encourage'],['No thanks.','refuse'],['Not now.','refuse'],["I'm scared.",'emotion'],['Okay.','ack'],['Nice try!','playful'],['I think coffee is overrated.','opinion'],['I grew up by the harbor.','disclosure'],['Nice frames.','neutral']])assert.equal(conversationCue(input),cue,input);
});

test('short refusals and emotional statements never introduce unrelated sheet topics',()=>{
 for(const input of ['No thanks.',"I'm scared.",'Not now.'])for(const seed of seeds)assert.doesNotMatch(dir(input,{},seed),/then bring up |ask the player one specific question back/,input);
 assert.match(dir('No thanks.'),/acknowledge what the player declined without pressure/);
 assert.match(dir("I'm scared."),/respond to how the player feels/);
 assert.match(dir('No thanks.'),/without repeating the offer/);
});

test('encouragement develops the existing topic; an empty conversation can still draw an authored topic',()=>{
 for(const input of ['Go on.','Tell me more.'])for(const seed of seeds){assert.match(dir(input,{},seed),/develop the last conversational point/);assert.doesNotMatch(dir(input,{},seed),/then bring up /);}
 assert.ok(seeds.some(seed=>/then bring up /.test(dir('Go on.',{sceneHistory:[]},seed))));
 assert.match(dir('Go on.'),/On bus transfers, during my commute/);assert.doesNotMatch(dir('Go on.'),/Sound like/);
});

test('fitting moves preserve personality, stage restrictions and seeded variation',()=>{
 const playful=seeds.map(seed=>move(dir('Nice try!',{},seed)));
 assert.ok(playful.every(s=>/tease the player|dodge with a dry aside/.test(s)));assert.ok(new Set(playful).size>1);
 for(const seed of seeds){assert.match(move(dir('I grew up by the harbor.',{},seed)),/ask the player one specific question back/);assert.match(move(dir('I think coffee is overrated.',{},seed)),/give their own opinion|disagree with something the player said/);}
 for(const phase of ['rejected','broken'])for(const seed of seeds)assert.doesNotMatch(dir('Nice try!',{dating:[{character:'mina',phase}]},seed),/flirt a little|admit one small/);
 const before=ctx('Nice try!');assert.equal(beatDirection(before,pack,'same'),beatDirection(before,pack,'same'));const saved=structuredClone(before);beatDirection(before,pack,'different');assert.deepEqual(before,saved);
});

test('a vulnerable reply is not treated as banter and answering a question does not force another interview question',()=>{
 for(const input of ['That joke hurt.',"I think I'm scared."]){assert.equal(conversationCue(input),'emotion');assert.match(dir(input),/respond to how the player feels/);assert.doesNotMatch(move(dir(input)),/tease the player|disagree/);}
 for(const seed of seeds){const d=dir('I grew up by the harbor.',{sceneHistory:[{input:'Hi.',text:'Mina: Where did you grow up?'}]},seed);assert.match(move(d),/give their own opinion/);assert.doesNotMatch(move(d),/ask the player/);assert.match(d,/about what the player just shared; use only the supplied profile and scene/);}
});

test('an explicit refusal answers a hanging offer without re-asking it',()=>{
 const c=ctx('No thanks.',{hangingAsk:{by:'Mina',text:'Would you like to go out?'}});c.direction=beatDirection(c,pack,'s1');
 assert.match(c.direction,/acknowledge what the player declined without pressure/);assert.doesNotMatch(c.direction,/call back their own unanswered question/);assert.equal(exchangePolicy(c).quick,true);
 assert.doesNotMatch(scenePromptMessages(c,pack)[0].content,/INITIATIVE:|End with a specific question or offer/);
});

test('brief exchanges have matching length instructions in both writers and keep player agency',()=>{
 for(const sceneWriter of ['framework','venus'])for(const input of ['Okay.','Nice try!','No thanks.']){
  const c=ctx(input,{sceneWriter}),p=exchangePolicy(c);assert.equal(p.quick,true);assert.equal(p.range,'2–3');c.direction=beatDirection(c,pack,'s1');
  const [sys,user]=scenePromptMessages(c,pack);assert.match(sys.content,/2–3 visual-novel entries/);assert.match(user.content,/2–3 visual-novel entries/);
  assert.doesNotMatch(sys.content,/5–7 visual-novel entries|6–9 visual-novel entries|at least four entries NPC dialogue|never a bare one-liner|End with a specific question or offer|INITIATIVE:/);
  assert.match(sys.content,/one short narrator beat/);assert.match(sys.content,/Never add player intent, promises, consent, gestures or movement/);assert.match(sys.content,/This JSON contract takes priority/);
  assert.match(sys.content,/never announce plans to leave.*never walk out mid-beat/);
 }
});

test('groups get room for every staged NPC even on a brief exchange',()=>{
 const c=ctx('Okay.',{stagedCast:['mina','ada']});assert.equal(exchangePolicy(c).range,'3–4');const [sys]=scenePromptMessages(c,pack);assert.match(sys.content,/3–4 visual-novel entries/);assert.match(sys.content,/Every present character gets at least one spoken line or visible beat/);
});

test('questions, encouragement, feelings, openings and engine-controlled beats keep full replies',()=>{
 for(const input of ['What made you start drawing?','Go on.',"I'm scared."]){assert.equal(exchangePolicy(ctx(input)).quick,false);assert.match(scenePromptMessages(ctx(input),pack)[0].content,/5–7 visual-novel entries/);}
 for(const extra of [{scenePhase:'opening'},{scenePhase:'closing'},{scenePhase:'solo',stagedCast:[]},{scriptedScene:{id:'authored'}},{first:{checkpoint:0}},{repeatAsk:'Mina'},{hangingAsk:{by:'Mina',text:'What do you think?'}}])assert.equal(exchangePolicy(ctx('Okay.',extra)).quick,false);
 assert.equal(exchangePolicy(ctx('Bye.')).quick,false);
 for(const extra of [{scriptedScene:{id:'authored'}},{first:{checkpoint:0}}])assert.doesNotMatch(dir('No thanks.',extra),/acknowledge what the player declined without pressure/);
});

test('question endings and a new agenda stay optional for brief continuations',()=>{
 for(const sceneWriter of ['framework','venus'])for(const conversationStyle of ['continuous','bounded']){
  const c=ctx('Okay.',{sceneWriter,gameProject:{conversationStyle}}),[sys,user]=scenePromptMessages(c,pack);assert.doesNotMatch(user.content,/Let the character react with initiative/);
  // Continuous free conversation uses the connected live-reply contract instead of the brief-exchange entry quota.
  if(conversationStyle==='continuous'){assert.match(sys.content,/a question is optional, not a required ending/);assert.doesNotMatch(sys.content,/INITIATIVE:|End with a specific question/);assert.match(user.content,/Stay with their subject/);}
  else{assert.match(sys.content,/no new question or agenda is required/);assert.match(user.content,/brief reaction on this same subject/);}
 }
});
