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

test('venus-style prompt uses persona, prose blocks and the reader action last',()=>{
 const [sys,user]=venusStyleMessages(ctx({scenePhase:'continuation',sceneHistory:[{input:'Hi Jana',text:'Jana: Hey you.'},{input:'How was summer?',text:'Jana: Too short.'}]}),pack);
 assert.match(sys.content,/^You are RITA/);assert.match(sys.content,/JSON RULES[\s\S]*Character keys that may speak: jana\./);assert.match(sys.content,/SETTING\nAshford\. First term\./);
 for(const block of ['READER','CAST','NOW','WHAT THEY REMEMBER','SCENE SO FAR','OPENING LINE','CONTINUING THE SCENE'])assert.ok(user.content.includes(block),block);
 assert.match(user.content,/Jana \(jana, she\/her\): Your roommate\. Personality: warm, stubborn\./);
 assert.match(user.content,/NOT HERE .*Nova/);assert.match(user.content,/Reader: How was summer\?\nJana: Too short\./);
 assert.match(user.content,/Reader's action: Ask what she studies\nThis is the reader's 3rd action in the scene\.$/);
 assert.doesNotMatch(user.content,/CURRENT STATE|\{"reader"/);
});
test('venus-style opening has no scene transcript; a solo action has no cast',()=>{
 const open=venusStyleMessages(ctx({scenePhase:'opening'}),pack)[1].content;assert.doesNotMatch(open,/SCENE SO FAR/);assert.match(open,/rewording what the reader decided/);
 const solo=venusStyleMessages(ctx({stagedCast:[],speakers:[],castProfiles:[],playerAction:'Lift weights'}),pack);assert.match(solo[0].content,/none \(narration only\)/);assert.doesNotMatch(solo[1].content,/\nCAST\n/);
});
test('a provider scenePrompt override replaces the scene prompt builder',async()=>{
 let body;const p=new CompatibleProvider({endpoint:'https://example.test/v1/chat/completions',model:'m',fetchImpl:async(_,init)=>{body=JSON.parse(init.body);return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({lines:[{speaker:'jana',text:'Lit, mostly. You?'}]})}}]}),{status:200,headers:{'content-type':'application/json'}});}});
 p.scenePrompt=venusStyleMessages;const value=await p.generateScene(ctx({scenePhase:'continuation',sceneHistory:[]}),pack);
 assert.match(body.messages[0].content,/^You are RITA/);assert.equal(value.lines[0].text,'Lit, mostly. You?');
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
test('the hybrid style is the default: a persona, staging and hooks, ending on a character move instead of a question',()=>{
 const two=ctx({stagedCast:['jana','nova'],speakers:['jana','nova'],castProfiles:[jana,{id:'nova',name:'Nova'}],scenePhase:'continuation',sceneHistory:[]});
 const [plain]=scenePromptMessages({...two,sceneStyle:'plain'},pack),[hy]=scenePromptMessages(two,pack);
 assert.doesNotMatch(plain.content,/romance novelist|STAGING/);assert.match(plain.content,/not every reply needs a question/);assert.match(scenePromptMessages({...two,scenePhase:'opening',sceneStyle:'plain'},pack)[0].content,/End with a specific question or offer/);assert.doesNotMatch(scenePromptMessages({...two,sceneWriter:'venus'},pack)[0].content,/romance novelist|STAGING/);
 assert.match(hy.content,/^You are a romance novelist/);assert.match(hy.content,/STAGING: Give each present character one physical object[\s\S]*Every present character gets at least one spoken line/);
 assert.match(hy.content,/never write the player’s words, feelings or backstory/);assert.match(hy.content,/end on a character’s move/);assert.doesNotMatch(hy.content,/End with a specific question or offer/);
 assert.doesNotMatch(scenePromptMessages({...ctx(),sceneStyle:'hybrid'},pack)[0].content,/Every present character gets/,'a one-on-one scene skips the ensemble rule');
 const solo={...ctx({stagedCast:[],speakers:[],castProfiles:[]}),sceneStyle:'hybrid'};assert.match(scenePromptMessages(solo,pack)[0].content,/one small discovery or hook/);assert.doesNotMatch(scenePromptMessages(solo,pack)[0].content,/STAGING/);
});
test('a group reply that leaves someone silent is a warning, never a repair',()=>{
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
test('hybrid scenes ask for initiative without departures and forbid invented history between characters',()=>{
 const two=ctx({stagedCast:['jana','nova'],speakers:['jana','nova'],castProfiles:[jana,{id:'nova',name:'Nova'}],scenePhase:'continuation',sceneHistory:[]}),sys=scenePromptMessages(two,pack)[0].content;
 assert.match(sys,/INITIATIVE: at least one character acts on their own plan[\s\S]*while staying in the scene/);assert.doesNotMatch(sys.match(/INITIATIVE:[^\n]*/)[0],/\bleave|walk away|depart/);
 assert.match(sys,/never invent shared history between characters/);assert.match(sys,/closed attendance list/);
 assert.doesNotMatch(scenePromptMessages({...two,sceneStyle:'plain'},pack)[0].content,/INITIATIVE/);
});
test('a typed goodbye gets a send-off with a hook instead of another question',()=>{
 for(const s of ['Say I should get to class, see you tonight','Say I have to run, nice meeting you','Tell them I will see them around','bye!'])assert.ok(LEAVING.test(s),s);
 for(const s of ['Ask what she is reading','I want to see her paintings','Tell her we should go get coffee','Help her take off her jacket'])assert.ok(!LEAVING.test(s),s);
 const c=ctx({scenePhase:'continuation',sceneHistory:[],playerAction:'Say I have to run, nice meeting you'}),sys=scenePromptMessages(c,pack)[0].content;
 assert.match(sys,/The player is leaving: let them go in character without a new question[\s\S]*main moment[\s\S]*one concrete hook/);assert.doesNotMatch(sys,/end on a character’s move|INITIATIVE/);
 assert.doesNotMatch(scenePromptMessages({...c,playerAction:'Ask what she is reading'},pack)[0].content,/The player is leaving/);
 assert.doesNotMatch(scenePromptMessages({...c,scenePhase:'closing'},pack)[0].content,/The player is leaving/,'the closing phase keeps its own goodbye');
 assert.doesNotMatch(scenePromptMessages({...c,sceneStyle:'plain'},pack)[0].content,/The player is leaving/);
});
test('a character repeating their own question this scene is a warning, never a repair',()=>{
 const before=[{speaker:'jana',text:'So what are you studying this year?'},{speaker:'nova',text:'Do you surf?'}];
 assert.deepEqual(repeatedQuestions([{speaker:'jana',text:'Wait, so what are you studying this year? Tell me.'}],before),['Wait, so what are you studying this year?']);
 assert.deepEqual(repeatedQuestions([{speaker:'jana',text:'Do you surf?'},{speaker:'nova',text:'What are you studying?'},{speaker:'',text:'What are you studying this year?'}],before),[],'other speakers and narration do not count');
 assert.deepEqual(repeatedQuestions([{speaker:'jana',text:'Want to grab dinner tonight?'}],before),[]);
 const w=lintScene({lines:[{speaker:'',text:'Jana caps her highlighter.'},{speaker:'jana',text:'Okay, real talk. What are you studying this year?'}]},{stagedCast:['jana'],sceneHistory:[],spokenBefore:before},pack);
 assert.deepEqual(w.map(x=>x.check),['repeat-question']);
});
