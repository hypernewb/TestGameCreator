import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarFlags,decisionSpam,fallbackDecision,narrativeDupes,qualityGates,runMetrics,testerView} from '../scripts/ai-game-tester.mjs';

test('headless AI tester exposes only playable text state and picks a safe fallback',()=>{
 const pack={playerId:'player',daypart:{interval:4},locations:[{id:'room',name:'Room'}],actors:[{id:'player',name:'You'},{id:'mina',name:'Mina'}],scriptedScenes:[]},state={tick:0,actors:{player:{location:'room'},mina:{location:'room'}},scene:null,modules:{'story.scenes':{pending:null}}},offered=[{label:'Locked',type:'story.choose',enabled:false,reason:'No'},{label:'Talk',type:'social.speak',enabled:true,args:{target:'mina'}}];
 const view=testerView(state,pack,offered,[], '');assert.equal(view.location,'Room');assert.deepEqual(view.present,['Mina']);assert.equal(fallbackDecision(offered).actionIndex,1);assert.equal(JSON.stringify(view).includes('apiKey'),false);
});

test('headless AI tester metrics count typed play, authored choices, dead turns and repetition',()=>{
 const metrics=runMetrics([{kind:'input',command:'story.respond',from:0,to:0,seconds:2,fallback:false,clarification:false},{kind:'action',command:'story.choose',from:0,to:4,seconds:1,fallback:false,clarification:false},{kind:'action',command:'core.inspect',from:4,to:4,seconds:1,fallback:true,clarification:false}],0,4);
 assert.deepEqual({...metrics,averageSeconds:undefined},{turns:3,startTick:0,endTick:4,ticksPlayed:4,typed:1,authoredChoices:1,fallbacks:1,clarifications:0,deadTurns:1,maxConsecutiveSameDecision:3,commandCounts:{'story.respond':1,'story.choose':1,'core.inspect':1},nearDuplicates:[],calendarConflicts:0,averageSeconds:undefined});assert.equal(metrics.averageSeconds,1.33);
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
