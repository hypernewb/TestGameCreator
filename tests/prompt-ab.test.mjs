import test from 'node:test';
import assert from 'node:assert/strict';
import {venusStyleMessages} from '../vendor/venus/venusStylePrompt.mjs';
import {CompatibleProvider} from '../packages/ai/providers.mjs';
import {scenePromptMessages,LEAVING} from '../vendor/venus/scenePrompt.mjs';
import {lintScene,repeatedQuestions} from '../packages/ai/narration-lint.mjs';
import {judgeMessages,readVerdict,pairs,tally,summaryLine,sceneText,reportMarkdown,composeLines,shownTurn,CRITERIA} from '../packages/testing/prompt-ab.mjs';
const pack={playerId:'player',locations:[],items:[],objects:[],actors:[{id:'player',name:'You',description:'A third-year.'},{id:'jana',name:'Jana',pronouns:'she/her'},{id:'nova',name:'Nova'}]};
const jana={id:'jana',name:'Jana',pronouns:'she/her',description:'Your roommate.',traits:['warm','stubborn'],voice:'Easy and warm.',goal:'Decide about Dominik.',likes:['the sea']};
const ctx=(o={})=>({stagedCast:['jana'],speakers:['jana'],castProfiles:[jana],absentCharacters:[{id:'nova',name:'Nova',rule:'x'}],weekday:'Monday',date:'2026-09-07',daypart:'Morning',location:{name:'Your apartment',description:'Mismatched mugs.'},memories:[{text:'The player said they grew up by a lake.'}],direction:'Answer, then tease.',playerAction:'Ask what she studies',gameProject:{setting:'Ashford.',premise:'First term.'},...o});

test('ordinary Venus adapter shares the current contribution and prose policy',()=>{const c=ctx({scenePhase:'continuation',sceneHistory:[{input:'Hi Jana',text:'Jana: Hey you.'},{input:'How was summer?',text:'Jana: Too short.'}]}),[sys,user]=venusStyleMessages(c,pack);assert.deepEqual(venusStyleMessages(c,pack),scenePromptMessages({...c,sceneWriter:'venus'},pack));assert.match(sys.content,/NARRATOR PERSONA/);assert.match(sys.content,/one connected reply with dialogue and meaningful action/);assert.match(user.content,/PLAYER CONTRIBUTION:/);assert.match(user.content,/How was summer\?\nJana: Too short/);assert.ok(user.content.includes(c.playerAction));assert.doesNotMatch(sys.content,/make the women play hard to get/);});test('ordinary openings retain supplied history while the solo Venus route has no cast',()=>{const c=ctx({scenePhase:'opening',sceneHistory:[{text:'Jana puts down her notes.'}]}),open=venusStyleMessages(c,pack);assert.match(open[1].content,/Jana puts down her notes/);assert.match(open[1].content,/PLAYER CONTRIBUTION:/);const solo=venusStyleMessages(ctx({stagedCast:[],speakers:[],castProfiles:[],playerAction:'Lift weights'}),pack);assert.match(solo[0].content,/^You are RITA/);assert.match(solo[0].content,/none \(narration only\)/);assert.doesNotMatch(solo[1].content,/\nCAST\n/);});test('a provider scenePrompt override replaces the scene prompt builder',async()=>{
 let body;const p=new CompatibleProvider({endpoint:'https://example.test/v1/chat/completions',model:'m',fetchImpl:async(_,init)=>{body=JSON.parse(init.body);return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({lines:[{speaker:'',type:'playerSpeech',source:'Ask what she studies',text:'Ask what she studies'},{speaker:'jana',text:'Lit, mostly. You?'}]})}}]}),{status:200,headers:{'content-type':'application/json'}});}});
 p.scenePrompt=venusStyleMessages;const value=await p.generateScene(ctx({scenePhase:'continuation',sceneHistory:[]}),pack);
 assert.deepEqual(body.messages,venusStyleMessages(ctx({scenePhase:'continuation',sceneHistory:[]}),pack));assert.equal(value.lines[1].text,'Lit, mostly. You?');
});
test('the judge sees A/B only, and the verdict maps back through the swap',()=>{
 const m=judgeMessages(ctx({sceneHistory:[{input:'Hi',text:'Jana: Hey.'}]}),pack,'first reply','second reply');
 assert.match(m[1].content,/REPLY A\nfirst reply\n\nREPLY B\nsecond reply/);assert.doesNotMatch(m[0].content+m[1].content,/venus|ours|hybrid/i);
 const score=n=>Object.fromEntries(Object.keys(CRITERIA).map(c=>[c,n]));const raw={A:{...score(8),voice:7},B:score(5),winner:'A',why:'A teases.'};
 assert.equal(readVerdict(raw,['ours','venus']).winner,'ours');assert.equal(readVerdict(raw,['venus','ours']).winner,'venus');assert.equal(readVerdict(raw,['venus','ours']).scores.venus.fun,8);
 assert.throws(()=>readVerdict({...raw,winner:'both'},['ours','hybrid']),/Invalid judge winner/);assert.throws(()=>readVerdict({...raw,A:{fun:8}},['ours','venus']),/Invalid judge score/);
 assert.deepEqual(pairs(['ours','venus','hybrid']),[['ours','venus'],['ours','hybrid'],['venus','hybrid']]);
});
test('tally and report count pairwise wins, failures and words for every variant',()=>{
 const names=['ours','venus','hybrid'],v=(pair,w,fun)=>({pair,winner:w,scores:{[pair[0]]:{fun:fun[0]},[pair[1]]:{fun:fun[1]}},why:''});
 const rows=[{scenario:'s',turn:0,phase:'opening',input:'hi',ours:{text:'a b',ms:1000},venus:{text:'a b c d',ms:3000},hybrid:{text:'a b c',ms:2000},verdicts:[v(['venus','ours'],'venus',[8,4]),v(['hybrid','venus'],'hybrid',[9,6]),v(['ours','hybrid'],'tie',[5,5])]},{scenario:'s',turn:1,phase:'continuation',input:'yo',ours:{error:'x'},venus:{text:'a b',ms:1000},hybrid:{text:'a',ms:1000},verdicts:[]}];
 const t=tally(rows,names);assert.deepEqual(t.versus,{'ours vs venus':{ours:0,venus:1,tie:0},'ours vs hybrid':{ours:0,hybrid:0,tie:1},'venus vs hybrid':{venus:0,hybrid:1,tie:0}});
 assert.equal(t.failed.ours,1);assert.equal(t.words.venus,3);assert.equal(t.mean.venus.fun,7);assert.equal(t.mean.hybrid.fun,7);
 assert.match(summaryLine(t),/^ours 0–1 venus \(tie 0, p≈1, 1 decisive\) \| ours 0–0 hybrid \(tie 1\) \| venus 0–1 hybrid \(tie 0, p≈1, 1 decisive\) \| fun ours 4\.5 \/ venus 7 \/ hybrid 7/);
 assert.deepEqual(t.significance,{'ours vs venus':{wins:0,losses:1,ties:0,decisive:1,p:1},'ours vs hybrid':{wins:0,losses:0,ties:1,decisive:0,p:null},'venus vs hybrid':{wins:0,losses:1,ties:0,decisive:1,p:1}});
 assert.equal(sceneText([{speaker:'',text:'She waves.'},{speaker:'jana',text:'Hi.'}],pack),'She waves.\nJana: Hi.');
 assert.match(reportMarkdown(rows,{model:'m',judge:'j',drive:'ours',date:'d',names}),/\| criterion \| ours \| venus \| hybrid \|[\s\S]*venus vs hybrid: \*\*hybrid\*\*[\s\S]*_failed: x_/);
});
test('ordinary scene styles share flexible prose without forced staging or hooks',()=>{const c=ctx({stagedCast:['jana','nova'],speakers:['jana','nova'],castProfiles:[jana,{id:'nova',name:'Nova'}],scenePhase:'continuation',sceneHistory:[]});for(const extra of [{},{sceneStyle:'plain'},{sceneWriter:'venus'}]){const [sys,user]=scenePromptMessages({...c,...extra},pack);assert.match(sys.content,/^NARRATOR PERSONA: Lean/);assert.match(sys.content,/a question is optional/);assert.match(sys.content,/no minimum or fixed balance/);assert.doesNotMatch(sys.content,/STAGING:|INITIATIVE:|end on a character’s move/);assert.match(user.content,/PLAYER CONTRIBUTION:/);}const solo=scenePromptMessages(ctx({stagedCast:[],speakers:[],castProfiles:[]}),pack);assert.match(solo[0].content,/one small discovery or hook/);assert.doesNotMatch(solo[0].content,/STAGING:/);});test('a group reply that leaves someone silent is a warning, never a repair',()=>{
 const p={...pack,actors:[...pack.actors,{id:'kay',name:'Kaylee'}]},c={stagedCast:['jana','kay'],sceneHistory:[]};
 assert.deepEqual(lintScene({lines:[{speaker:'jana',text:'Hey.'}]},c,p).map(w=>w.check),['ensemble']);
 assert.deepEqual(lintScene({lines:[{speaker:'',text:'Kaylee waves from the couch.'},{speaker:'jana',text:'Hey.'}]},c,p),[]);
 assert.deepEqual(lintScene({lines:[{speaker:'jana',text:'Hey.'}]},{...c,stagedCast:['jana']},p),[]);
});
test('the judge reads a variant after the service filter: off-cast speakers and repeated lines are gone',()=>{
 const c=ctx({spokenBefore:[{speaker:'jana',text:'I told you, the wax is for my board.'}],playerAction:'Tease her about the wax'});
 const lines=[{speaker:'',text:'She laughs.'},{speaker:'jana',text:'I told you, the wax is for my board.'},{speaker:'nova',text:'Hi there.'},{speaker:'jana',text:'Fine, it is a candle.'}];
 assert.equal(sceneText(composeLines(lines,c,pack),pack),'She laughs.\nJana: Fine, it is a candle.');
});
test('the shown turn adds the engine text around the drive reply, and the report and summary count it',()=>{
 const prev={turns:{a:{command:{type:'core.scene'},sceneLines:[{speaker:'',text:'old'}]}}};
 const state={modules:{},turns:{...prev.turns,b:{command:{type:'core.scene'},sceneLines:[{speaker:'jana',text:'See you tonight.'}]},c:{command:{type:'social.priceActs'},events:[{type:'social.relationshipChanged',payload:{actor:'jana',toward:'player',old:10,value:12}},{type:'social.relationshipChanged',payload:{actor:'jana',toward:'player',old:12,value:14}}]},d:{command:{type:'core.endScene'},events:[{type:'core.sceneEnded',payload:{reason:'budget',text:'You head to class.'}}]}}};
 const shown=shownTurn(prev,state,pack,[{text:'See you tonight.'},{text:'Jana remembers the lake.'}]);
 assert.equal(shown.text,'Jana: See you tonight.\n[REACTION] Jana warmed to you.\n[RESULT] Jana remembers the lake.\n[SCENE END] You head to class.');
 assert.deepEqual(shownTurn(state,state,pack),{lines:[],engine:[],text:''});
 const rows=[{scenario:'s',turn:0,phase:'continuation',input:'bye',ours:{text:'Jana: See you tonight.',ms:1000,dropped:2},verdicts:[],shown},{scenario:'s',turn:1,phase:'engine',input:'go',verdicts:[],shown:{lines:[],engine:[],text:'A beat.'}}];
 const t=tally(rows,['ours']);assert.equal(t.dropped.ours,2);assert.match(summaryLine(t),/filtered lines ours 2 \| engine text on 1\/2 turns$/);
 const md=reportMarkdown(rows,{model:'m',judge:'j',drive:'ours',date:'d',names:['ours']});
 assert.match(md,/2 line\(s\) filtered[\s\S]*shown to the player[\s\S]*\[SCENE END\] You head to class[\s\S]*turn 1 \(engine\)[\s\S]*shown to the player[\s\S]*A beat\./);
});
test('ordinary scenes preserve attendance and history without mandatory initiative',()=>{const c=ctx({stagedCast:['jana','nova'],speakers:['jana','nova'],castProfiles:[jana,{id:'nova',name:'Nova'}],scenePhase:'continuation',sceneHistory:[]});for(const sceneStyle of ['hybrid','plain']){const sys=scenePromptMessages({...c,sceneStyle},pack)[0].content;assert.doesNotMatch(sys,/INITIATIVE:/);assert.match(sys,/Never invent news, letters, secrets, relationships or past events/);assert.match(sys,/closed attendance list/);assert.match(sys,/An NPC may end the encounter with a reason or a next-time line/);}});test('a typed goodbye permits an ending without a manufactured hook or new question',()=>{for(const input of ['Say I should get to class, see you tonight','Say I have to run, nice meeting you','Tell them I will see them around','bye!'])assert.ok(LEAVING.test(input),input);for(const input of ['Ask what she is reading','I want to see her paintings','Tell her we should go get coffee','Help her take off her jacket'])assert.ok(!LEAVING.test(input),input);for(const sceneStyle of ['hybrid','plain'])for(const scenePhase of ['opening','continuation','closing']){const sys=scenePromptMessages(ctx({sceneStyle,scenePhase,sceneHistory:[],playerAction:'Say I have to run, nice meeting you'}),pack)[0].content;assert.match(sys,/If the player says goodbye, let them go without a new question or manufactured hook and set end_scene true/);assert.doesNotMatch(sys,/one concrete hook|INITIATIVE:/);}});test('a character repeating their own question this scene is a warning, never a repair',()=>{
 const before=[{speaker:'jana',text:'So what are you studying this year?'},{speaker:'nova',text:'Do you surf?'}];
 assert.deepEqual(repeatedQuestions([{speaker:'jana',text:'Wait, so what are you studying this year? Tell me.'}],before),['Wait, so what are you studying this year?']);
 assert.deepEqual(repeatedQuestions([{speaker:'jana',text:'Do you surf?'},{speaker:'nova',text:'What are you studying?'},{speaker:'',text:'What are you studying this year?'}],before),[],'other speakers and narration do not count');
 assert.deepEqual(repeatedQuestions([{speaker:'jana',text:'Want to grab dinner tonight?'}],before),[]);
 const w=lintScene({lines:[{speaker:'',text:'Jana caps her highlighter.'},{speaker:'jana',text:'Okay, real talk. What are you studying this year?'}]},{stagedCast:['jana'],sceneHistory:[],spokenBefore:before},pack);
 assert.deepEqual(w.map(x=>x.check),['repeat-question']);
});
