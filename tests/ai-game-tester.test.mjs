import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarFlags,decisionSpam,fallbackDecision,narrativeDupes,qualityGates,runMetrics,testerView,incompleteReasonOf,reviewRun,CRITIQUE_TOKENS} from '../scripts/ai-game-tester.mjs';

test('refused moves remain findings and partial runs still receive a model critique',async()=>{
 const history=Array.from({length:3},(_,i)=>({turn:i+1,clock:'Monday Morning',kind:'action',command:'REFUSED',refused:true,decision:'Change the agreement',narrative:'Give the current agreement time.',results:[],from:0,to:0,seconds:0,fallback:false}));
 let calls=0;const provider={async complete(messages){calls++;assert.match(messages[1].content,/COMMAND REFUSED/);return JSON.stringify({strengths:['Clear feedback.'],issues:[],prioritizedFixes:['Explain the cooldown.']});}};
 const metrics=runMetrics(history,0,0),review=await reviewRun(provider,{title:'Test'},history,metrics,4,[]);
 assert.equal(calls,1);assert.equal(incompleteReasonOf(history),'');assert.equal(metrics.refusals,3);assert.equal(metrics.fallbacks,0);
 assert.equal(review.issues.length,3);assert.match(review.issues[0].evidence,/Turn 1/);assert.deepEqual(review.prioritizedFixes,['Explain the cooldown.']);
 assert.equal(incompleteReasonOf([{testerError:true,failureReason:'Tester quota exhausted'}]),'Tester quota exhausted');
});

test('headless AI tester exposes only playable text state and picks a safe fallback',()=>{
 const pack={playerId:'player',daypart:{interval:4},locations:[{id:'room',name:'Room'}],actors:[{id:'player',name:'You'},{id:'mina',name:'Mina'}],scriptedScenes:[]},state={tick:0,actors:{player:{location:'room'},mina:{location:'room'}},scene:null,modules:{'story.scenes':{pending:null}}},offered=[{label:'Locked',type:'story.choose',enabled:false,reason:'No'},{label:'Talk',type:'social.speak',enabled:true,args:{target:'mina'}}];
 const view=testerView(state,pack,offered,[], '');assert.equal(view.location,'Room');assert.deepEqual(view.present,['Mina']);assert.equal(fallbackDecision(offered).actionIndex,1);assert.equal(JSON.stringify(view).includes('apiKey'),false);
});

test('headless AI tester metrics count typed play, authored choices, dead turns and repetition',()=>{
 const metrics=runMetrics([{kind:'input',command:'story.respond',from:0,to:0,seconds:2,fallback:false,clarification:false},{kind:'action',command:'story.choose',from:0,to:4,seconds:1,fallback:false,clarification:false},{kind:'action',command:'core.inspect',from:4,to:4,seconds:1,fallback:true,clarification:false}],0,4);
 assert.deepEqual({...metrics,averageSeconds:undefined},{turns:3,refusals:0,startTick:0,endTick:4,ticksPlayed:4,typed:1,authoredChoices:1,fallbacks:1,clarifications:0,deadTurns:1,maxConsecutiveSameDecision:3,maxConsecutiveSpeak:0,commandCounts:{'story.respond':1,'story.choose':1,'core.inspect':1},nearDuplicates:[],calendarConflicts:0,averageSeconds:undefined});assert.equal(metrics.averageSeconds,1.33);
});

test('conversation turns that stay in the scene are not dead turns',()=>{
 const metrics=runMetrics([{kind:'input',command:'core.scene',from:4,to:4,seconds:1,fallback:false},{kind:'action',command:'social.speak',from:4,to:4,seconds:1,fallback:false},{kind:'action',command:'core.wait',from:4,to:4,seconds:1,fallback:false}],0,4);
 assert.equal(metrics.deadTurns,1);
});

test('calendar flags catch weekday words that contradict the active day',()=>{
 assert.deepEqual(calendarFlags('I love a quiet Tuesday, you know?','Wednesday'),['mentions Tuesday but it is Wednesday']);
 assert.deepEqual(calendarFlags('Come back Tuesday.','Tuesday'),[]);
 assert.deepEqual(calendarFlags('They are scheduled to be at the bar from Wednesday Morning.','Monday'),[]);
 assert.deepEqual(calendarFlags('','Wednesday'),[]);
 assert.deepEqual(calendarFlags('I have a double feature on Saturday. Next Tuesday works too, see you Friday.','Thursday'),[],'plans are not slips');assert.deepEqual(calendarFlags('Tuesday afternoon light falls across the mat.','Thursday'),['mentions Tuesday but it is Thursday']);
});

test('narrative near-duplicate detection catches paraphrased loops but skips short templates',()=>{
 const long='She leans against the bar counter crossing her arms beneath her cropped top as she regards you with an amused glint in her eye before pushing off the bar and sauntering closer until she is standing right in front of you with her hips swaying slightly while golden eyes bore into yours.';
 assert.equal(narrativeDupes([{narrative:long},{narrative:long}]).length,1);
 assert.deepEqual(narrativeDupes([{narrative:long},{narrative:'A narrow flat above a launderette. The radiator ticks.'}]),[]);
 assert.deepEqual(narrativeDupes([{narrative:''},{narrative:''}]),[]);
});

test('quality gates fail spammy or passive runs and pass healthy ones',()=>{
 const spam=Array.from({length:5},()=>({kind:'action',command:'social.speak',decision:'Talk to Juno',from:1,to:2,seconds:1,narrative:'She says things are fine again.',results:[]}));
 const spamGates=qualityGates(spam,runMetrics(spam,0,10),4);
 assert.equal(spamGates.pass,false);assert.ok(spamGates.failures.some(failure=>failure.includes('times in a row')));assert.ok(spamGates.failures.some(failure=>failure.includes('free-text')));
 const good=[{kind:'input',command:'story.respond',decision:'say hi',from:0,to:1,seconds:1,narrative:'x',results:[]},{kind:'action',command:'story.choose',decision:'opt',from:1,to:2,seconds:1,narrative:'x',results:[]}];
 assert.deepEqual(qualityGates(good,runMetrics(good,0,8),1),{pass:true,failures:[]});
 assert.equal(decisionSpam(spam),5);
});
test('the critique gets its own output cap and the play cap is restored after it',async()=>{
 const seen=[],provider={maxTokens:1800,async complete(){seen.push(this.maxTokens);return JSON.stringify({strengths:[],issues:[],prioritizedFixes:[]});}};
 const history=[{turn:1,clock:'Monday Morning',kind:'input',command:'core.scene',decision:'Hi',narrative:'Hello.',results:[],from:0,to:0}];
 await reviewRun(provider,{title:'Test'},history,runMetrics(history,0,0),4,[]);
 assert.deepEqual(seen,[CRITIQUE_TOKENS]);assert.ok(CRITIQUE_TOKENS>1800);assert.equal(provider.maxTokens,1800);
});
test('a "she\'ll be back Friday" arrival note is not a calendar slip',()=>{assert.deepEqual(calendarFlags('Mina isn\'t at the library. She\'ll be back Wednesday morning.','Monday'),[]);});
