import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createWorld} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {Store} from '../packages/persistence/store.mjs';
import {GameService} from '../packages/ai/service.mjs';
import {MockProvider,CompatibleProvider} from '../packages/ai/providers.mjs';
import {contextFor} from '../packages/ai/context.mjs';
import {lintScene} from '../packages/ai/narration-lint.mjs';
import {calendarFor} from '../public/calendar.mjs';
import {estimateTokens,messageTokens} from '../packages/ai/budget.mjs';
import {scenePromptMessages,calendarLine,awayLine,STAY_RULE,ECHO_RULE,PROP_RULE} from '../vendor/venus/scenePrompt.mjs';
// The slips a typed 5-day run showed the narrator making: wrong weekday, invented NPC whereabouts, the player's own
// words handed back, one prop every beat, and the same RESULTS line twice. Every item is proven here on the campus pack
// with a mock provider; nothing calls a model.
const campus=(edit=p=>p)=>edit(JSON.parse(readFileSync(new URL('../packs/campus.json',import.meta.url),'utf8')));
const REPLY=[{speaker:'',text:'Rain ticks on the window.'},{speaker:'jana',text:'You are late. Sit down before the tea goes cold.'}];
const captured=[];
const probe={name:'probe',contextWindow:8192,maxTokens:1800,async interpretScene(){throw Error('button turn only');},async generateScene(context){captured.push(structuredClone(context));return {lines:structuredClone(REPLY)};}};
// One committed campus scene, opened by command: the returned context is exactly what the prompt builder renders.
async function scene(p,id,tick=0){
  captured.length=0;
  const store=new Store(),world=createWorld(p,registry,id);
  world.tick=tick;store.insert(world);
  const here=world.actors[p.playerId].location,service=new GameService(store,{[p.id]:p},registry,probe);
  try{const s=store.load(id);await service.act(id,{id:'open',expectedRevision:s.revision,command:{type:'core.scene',args:{text:'I want to talk about the term.',location:here,characters:['jana'],activity:'talk'}}});}
  finally{store.close();}
  return {context:captured.at(-1),world};
}
const echoInput='I tell her the truth about why I came back to Ashford this autumn and stayed in her dorm';
const echoReply=[{speaker:'',text:'You begin badly. I tell her the truth about why I stayed, and she hears every word of it.'},{speaker:'jana',text:'Then say the rest. I am listening.'}];
// The same provider call the service makes, so the post-check runs exactly as it does in play.
function narrate(context,pack,lines){
  const provider=new CompatibleProvider({endpoint:'http://127.0.0.1:65535/v1/chat/completions',model:'mock',fetchImpl:async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({lines})}}]}),{status:200,headers:{'content-type':'application/json'}})});
  return provider.generateScene(context,pack);
}

test('the prompt states the day name and number once, from engine state',async()=>{
  const p=campus(),{context}=await scene(p,'slips-calendar',48),clock=calendarFor(48,p);
  assert.equal(clock.day,5);assert.equal(clock.weekday,'Friday');
  const [sys,user]=scenePromptMessages(context,p);
  assert.equal(user.content.match(/Day 5, Friday/g).length,1,'the day is stated once');
  assert.match(user.content,/^Day 5, Friday\.$/m);
  assert.ok(!/Tuesday/.test(sys+user),'no second, invented day');
  assert.equal(estimateTokens(calendarLine(context)),4,'four tokens for the calendar');
  assert.equal(calendarLine({}),'','no engine day, no line');
  assert.ok(!scenePromptMessages({...context,day:null,weekday:null},p)[1].content.includes('Day 5'),'a pack without a clock keeps the legacy prompt');
});

test('the prompt lists where the NPCs who are not in this scene are, and holds them there',async()=>{
  const p=campus(),{context,world}=await scene(p,'slips-away');
  assert.deepEqual(context.stagedCast,['jana']);
  for(const a of context.absentCharacters)assert.equal(a.where,p.locations.find(l=>l.id===world.actors[a.id].location).name,`${a.name} is at ${a.where}`);
  const [sys,user]=scenePromptMessages(context,p);
  assert.match(user.content,/^AWAY: /m);
  assert.ok(awayLine(context.absentCharacters).includes('Nova')&&awayLine(context.absentCharacters).includes('Langley Hall'),'a place and the people in it');
  assert.ok(!awayLine(context.absentCharacters).includes('Jana'),'the staged cast is not on the away list');
  assert.ok(sys.content.includes(STAY_RULE),'one rule line holds the absent NPCs');
  assert.equal(awayLine([]),'');
  assert.equal(awayLine([{name:'Nova',rule:'x'}]),'','no known place, no invented one');
  // The list follows the world, not the pack: move Nova and the line moves with her.
  const moved=campus(q=>{q.actors.find(a=>a.id==='nova').location='murphys';return q;});
  const after=awayLine((await scene(moved,'slips-moved')).context.absentCharacters);
  assert.match(after,/Murphy's: Nova\.$/,'the moved NPC is listed where the world put her');
  assert.ok(!awayLine(context.absentCharacters).includes('Murphy'),'and not where the pack had her');
});

test('identical result lines from one turn reach the prompt once, in order',async()=>{
  const p=campus(),s=createWorld(p,registry,'slips-results');
  const turn={events:[
   {type:'world.activityCompleted',visibility:['player'],payload:{text:'You get to work.'}},
   {type:'story.choiceResolved',visibility:['player'],payload:{text:'You get to work.'}},
   {type:'social.relationshipChanged',visibility:['player'],payload:{text:'Jana: Trust 30 → 35'}},
   {type:'social.relationshipChanged',visibility:['player'],payload:{text:'You get to work.'}},
   {type:'social.spoke',visibility:['nova'],payload:{text:'Nova is elsewhere.'}}]};
  const context=contextFor(s,p,p.playerId,turn,'get to work');
  assert.deepEqual(context.outcomes.map(o=>o.text),['You get to work.','Jana: Trust 30 → 35'],'the repeat merges, the other line and the order stay');
  assert.deepEqual(context.outcomes.map(o=>o.type),['world.activityCompleted','social.relationshipChanged']);
  assert.ok(!JSON.stringify(context.outcomes).includes('Nova is elsewhere'),'visibility is still filtered');
  const text=await new MockProvider().narrate({...context,actor:{name:'You'},present:[],location:p.locations[0],memories:[]});
  assert.deepEqual(text.split('\n'),['You get to work.','Jana: Trust 30 → 35'],'the mock narrator plays the result once');
});

test('the prompt gains one short style line each against echo and prop fixation',async()=>{
  const p=campus(),{context}=await scene(p,'slips-style'),sys=scenePromptMessages(context,p)[0].content;
  assert.ok(sys.includes(ECHO_RULE),ECHO_RULE);
  assert.ok(sys.includes(PROP_RULE),PROP_RULE);
  assert.ok(estimateTokens(ECHO_RULE)+estimateTokens(PROP_RULE)<=11,'both lines together cost about ten tokens');
});

test('a reply that repeats the player word for word is logged, never blocked',async()=>{
  const p=campus(),{context}=await scene(p,'slips-echo');
  assert.equal(p.slipGuard.echoWords,8);
  const turn={...context,playerAction:echoInput,spokenBefore:[]};
  const flagged=await narrate(turn,p,echoReply);
  const echo=flagged.lintTrace?.filter(t=>t.check==='echo')||[];
  assert.equal(echo.length,1,'the echo is flagged once');
  assert.equal(echo[0].warned,true,'flagged, not a repair');
  assert.match(echo[0].message,/i tell her the truth about why i/);
  assert.deepEqual(flagged.lines.map(l=>l.text),echoReply.map(l=>l.text),'the reply still reaches the player');
  assert.ok(flagged.lines.some(l=>l.speaker),'a scene where nobody speaks is not an echo');
  // Legacy behaviour: no pack field, no post-check.
  const legacy=await narrate(turn,{...p,slipGuard:undefined},echoReply);
  assert.ok(!legacy.lintTrace?.some(t=>t.check==='echo'));
  // Seven words of the player coming back is phrasing, not an echo.
  const seven='You begin badly. I tell her the truth about why, and she hears it.';
  const short=await narrate(turn,p,[{speaker:'jana',text:seven}]);
  assert.ok(!short.lintTrace?.some(t=>t.check==='echo'));
  assert.deepEqual(lintScene({lines:echoReply},turn,{...p,slipGuard:undefined}).map(w=>w.check),[]);
});

test('the Studio gives the echo threshold its own section and writes it back to the pack',()=>{
  const snippet=readFileSync(new URL('../public/studio.mjs',import.meta.url),'utf8').match(/function slipGuardEditor.*\n/)[0];
  assert.ok(snippet,'the editor has its own section');
  let title='',numbered=false;
  const studio={section:(name)=>{title=name;return {append(){}};},field:(parent,obj,key,label,kind)=>{assert.equal(kind,'number');numbered=true;assert.equal(obj.echoWords,8);return {value:obj.echoWords};},node:()=>({}),message:()=>{}};
  runInNewContext(`${snippet}\nslipGuardEditor(p);`,{...studio,p:{slipGuard:{echoWords:8}}});
  assert.equal(title,'Narrator slips');assert.ok(numbered,'the pack number is editable');
  numbered=false;runInNewContext(`${snippet}\nslipGuardEditor(p);`,{...studio,p:{}});
  assert.equal(title,'Narrator slips');assert.equal(numbered,false,'legacy packs get no number');
});

test('the whole slip pass costs at most 40 prompt tokens',async()=>{
  const p=campus(),{context}=await scene(p,'slips-budget',48),messages=scenePromptMessages(context,p);
  const slip=[calendarLine(context),awayLine(context.absentCharacters),STAY_RULE,ECHO_RULE,PROP_RULE].filter(Boolean);
  const without=messages.map(m=>({...m,content:m.content.split('\n').filter(line=>!slip.includes(line)).join('\n')}));
  assert.ok(without.every((m,i)=>m.content.length<messages[i].content.length),'every added line is found in the prompt');
  const growth=messageTokens(messages)-messageTokens(without);
  assert.ok(growth<=40,`prompt grew ${growth} tokens: ${slip.join(' | ')}`);
});