import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {Store} from '../packages/persistence/store.mjs';
import {GameService} from '../packages/ai/service.mjs';
import {MockProvider,CompatibleProvider,narrativeMessages} from '../packages/ai/providers.mjs';
import {contextFor} from '../packages/ai/context.mjs';
import {estimateTokens,messageTokens} from '../packages/ai/budget.mjs';
import {scenePromptMessages,calendarLine,awayLine,STAY_RULE,ECHO_RULE,PROP_RULE} from '../vendor/venus/scenePrompt.mjs';
import {venusStyleMessages} from '../vendor/venus/venusStylePrompt.mjs';
// Round 2 of the typed-run slips T-041 left: the same action line settled twice, the example props the STAGING
// paragraph handed every scene, and the venus prompt variant that never got the five slip lines. Proven here on the
// campus pack with a mock provider; nothing calls a model.
const campus=()=>JSON.parse(readFileSync(new URL('../packs/campus.json',import.meta.url),'utf8'));
const captured=[];
const probe={name:'probe',contextWindow:8192,maxTokens:1800,async interpretScene(){throw Error('button turn only');},async generateScene(context){captured.push(structuredClone(context));return {lines:[{speaker:'',text:'Rain ticks on the window.'},{speaker:'jana',text:'You are late. Sit down.'}]};}};
// One committed campus scene, opened by command: the returned context is exactly what the prompt builders render.
async function scene(p,id,tick=0){
  captured.length=0;
  const store=new Store(),world=createWorld(p,registry,id);
  world.tick=tick;store.insert(world);
  const here=world.actors[p.playerId].location,service=new GameService(store,{[p.id]:p},registry,probe);
  try{const s=store.load(id);await service.act(id,{id:'open',expectedRevision:s.revision,command:{type:'core.scene',args:{text:'I want to talk about the term.',location:here,characters:['jana'],activity:'talk'}}});}
  finally{store.close();}
  return {context:captured.at(-1),world};
}
// The slip lines are charged for by their text, not by the line they sit on: a rule folded into an existing paragraph
// still costs tokens, and a budget that only removed whole lines would report nothing.
const cost=(messages,rules)=>messageTokens(messages)-messageTokens(messages.map(m=>({...m,content:rules.reduce((c,r)=>c.split(r).join(''),m.content)})));
const costByLine=(messages,rules)=>messageTokens(messages)-messageTokens(messages.map(m=>({...m,content:m.content.split('\n').filter(l=>!rules.includes(l)).join('\n')})));

test('a line one turn settled twice reaches the model once, in the order it happened',async()=>{
  const p=campus(),s=createWorld(p,registry,'slips2-actions'),base=s.events.length;
  const ev=(id,type,text,visibility=['player'])=>({id,tick:0,type,visibility,payload:{text}});
  s.events.push(ev('e1','world.activityCompleted','You get to work.'),ev('e2','story.choiceResolved','You get to work.'),
   ev('e3','world.itemDiscovered','You pocket the brass key.'),ev('e4','story.choiceResolved','You get to work.'),
   ev('e5','social.relationshipChanged','Jana: Trust 30 → 35'),ev('e6','world.explored','Nova is elsewhere.',['nova']));
  const context=contextFor(s,p,p.playerId,null,'term'),texts=context.recentActions.map(a=>a.text);
  assert.deepEqual(texts.slice(base),['You get to work.','You pocket the brass key.'],'the repeat collapses and the other line keeps its place');
  assert.equal(texts.filter(t=>t==='You get to work.').length,1,'the line is in the list once');
  assert.equal(context.recentActions.find(a=>a.text==='You get to work.').source,'e1','the first event of the pair is the one kept');
  assert.ok(!texts.includes('Jana: Trust 30 → 35'),'score events are still not actions');
  assert.ok(!texts.includes('Nova is elsewhere.'),'visibility is still filtered');
  // The provider receives the context verbatim, so the copy is gone from the request too.
  const sent=narrativeMessages(context)[1].content;
  assert.equal(sent.split('You get to work.').length-1,1,'one copy in the request the provider sends');
  const said=await new MockProvider().narrate({...context,outcomes:context.recentActions.slice(base).map(a=>({type:a.type,text:a.text})),actor:{name:'You'},present:[],location:p.locations[0],memories:[]});
  assert.deepEqual(said.split('\n'),['You get to work.','You pocket the brass key.'],'the mock narrator plays the action once');
});

test('the STAGING paragraph asks for a prop without naming one, and the prompt gets smaller',async()=>{
  const p=campus(),{context}=await scene(p,'slips2-staging',48),messages=scenePromptMessages(context,p);
  const staging=messages[0].content.match(/STAGING:[^\n]*/)[0];
  assert.match(staging,/^STAGING: Give each present character one physical object or task in their hands and let it carry their mood\./,'the instruction stays');
  assert.doesNotMatch(messages[0].content+messages[1].content,/a cup, a phone, a book|cup, a phone/,'no example prop is named anywhere');
  assert.ok(messages[0].content.includes(PROP_RULE),'the one-prop rule is the only prop the prompt gives');
  // Net prompt change: the only edit from the shipped wording is the three examples, and they cost tokens.
  const old=messages.map(m=>({...m,content:m.content.split('one physical object or task in their hands and let').join('one physical object or task in their hands (a cup, a phone, a book) and let')}));
  assert.ok(old[0].content.length>messages[0].content.length,'the shipped wording is measured on this same prompt');
  assert.deepEqual(old.slice(1),messages.slice(1),'and changes nothing else');
  assert.ok(messageTokens(messages)<messageTokens(old),'the prompt shrank');
  assert.equal(estimateTokens(' (a cup, a phone, a book)'),7,'the seven tokens the examples cost are gone');
});

test('the venus variant carries the same five slip lines, and invents none without engine state',async()=>{
  const p=campus(),{context}=await scene(p,'slips2-venus',48),[sys,user]=venusStyleMessages(context,p);
  assert.equal(calendarLine(context),'Day 5, Friday.');
  assert.match(user.content,/^Day 5, Friday\.$/m,'the day is stated once, on its own line');
  assert.equal(user.content.match(/Day 5, Friday/g).length,1);
  assert.match(user.content,/^AWAY: .*\.$/m,'the absent NPCs are listed where they are');
  assert.ok(awayLine(context.absentCharacters).includes('Langley Hall'),'a place and the people in it');
  for(const rule of [STAY_RULE,ECHO_RULE,PROP_RULE])assert.ok(sys.content.includes(rule),rule);
  // A pack without a clock, and a scene nobody is missing from, keep the legacy prompt.
  const legacy=venusStyleMessages({...context,day:null,weekday:null,absentCharacters:[]},p),all=legacy[0].content+legacy[1].content;
  assert.ok(!all.includes('Day 5')&&!/Tuesday/.test(all),'no invented day');
  assert.ok(!all.includes('AWAY:'),'no invented whereabouts');
  assert.ok(!/a cup, a phone, a book/.test(all),'and no example prop');
  // The three rules ride on a cast, exactly as in the SFW prompt: a solo scene gets none of them.
  const solo=venusStyleMessages({...context,stagedCast:[],speakers:[],castProfiles:[],absentCharacters:[]},p);
  for(const rule of [STAY_RULE,ECHO_RULE,PROP_RULE])assert.ok(!solo[0].content.includes(rule),`a solo scene keeps no ${rule}`);
  // And they are what a provider with the venus override actually sends.
  let body;
  const provider=new CompatibleProvider({endpoint:'https://example.test/v1/chat/completions',model:'m',fetchImpl:async(_,init)=>{body=JSON.parse(init.body);return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({lines:[{speaker:'jana',text:'Sit down, then.'}]})}}]}),{status:200,headers:{'content-type':'application/json'}});}});
  provider.scenePrompt=venusStyleMessages;
  const reply=await provider.generateScene(context,p),sent=body.messages.map(m=>m.content).join('\n');
  assert.match(sent,/^You are RITA/,'the venus persona went over the wire');
  for(const r of [calendarLine(context),awayLine(context.absentCharacters),STAY_RULE,ECHO_RULE,PROP_RULE])assert.ok(sent.includes(r),`sent: ${r}`);
  assert.deepEqual(reply.lines.map(l=>l.text),['Sit down, then.'],'and the reply still comes back');
});

test('the venus slip lines fit the budget, and a rule moved into a paragraph is still charged',async()=>{
  const p=campus(),{context}=await scene(p,'slips2-budget',48),messages=venusStyleMessages(context,p);
  const rules=[calendarLine(context),awayLine(context.absentCharacters),STAY_RULE,ECHO_RULE,PROP_RULE];
  for(const r of rules)assert.ok(messages.some(m=>m.content.includes(r)),`the prompt carries: ${r}`);
  const growth=cost(messages,rules);
  assert.ok(growth<=40,`the venus prompt grew ${growth} tokens: ${rules.join(' | ')}`);
  // Fold the three system rules into the line above them: a line-based budget reports nothing here, this one does.
  const moved=[STAY_RULE,ECHO_RULE,PROP_RULE].join(' '),kept=messages[0].content.split('\n').filter(l=>![STAY_RULE,ECHO_RULE,PROP_RULE].includes(l));
  const folded=[{...messages[0],content:kept.map(l=>l.startsWith('Character keys')?`${l} ${moved}`:l).join('\n')},...messages.slice(1)];
  assert.equal(kept.length+3,messages[0].content.split('\n').length,'the three rule lines left their place');
  assert.ok(!folded[0].content.split('\n').some(l=>rules.includes(l)),'the rules are no longer lines of their own');
  assert.equal(cost(folded,rules),growth,'the text budget charges every one of them anyway');
  const blind=costByLine(folded,rules);
  // +2: each side of both budgets rounds once, so unrelated prompt text can shift either by a token.
  assert.ok(blind<=growth-estimateTokens(moved)+2,`a whole-line budget would under-count it by ${growth-blind} tokens`);
});
