import test from 'node:test';
import assert from 'node:assert/strict';
import {replayCorpus,replayRun,humanAgreement} from '../packages/testing/dialogue-replay.mjs';
import {dialogueLine} from '../packages/testing/dialogue-metrics.mjs';
import {CRITERIA,judgeResponseFormat,judgeMessages} from '../packages/testing/prompt-ab.mjs';

test('dialogue replay: every planted fault is caught and the clean scene stays clean',()=>{
 for(const r of replayCorpus())assert.ok(r.caught,`${r.id} missed (${r.why}): ${dialogueLine(r.metrics)}`);
});

test('dialogue replay: a recorded run aggregates per variant and reports breaches and echo locations',()=>{
 const row=(turn,dialogue)=>({scenario:'warmth',turn,verdicts:[],ours:{dialogue},venus:{dialogue}});
 const q={questionRate:0.9,walls:0,narrationWalls:0,glueDensity:0.1,recycledGrams:0,echoViolations:0,medianWords:8,dialogueRatio:0.9,spoken:3,narration:1,lines:4,characterLines:4,glue:0};
 const broken={...q,echoViolations:1};
 const record={meta:{names:['ours','venus']},rows:[row(0,{...q}),row(1,broken),row(2,{...q,glueDensity:0.9})]};
 const rep=replayRun(record,{playerId:'player'});
 assert.equal(rep.variants.ours.turns,3);assert.equal(rep.variants.ours.walls,0);
 assert.equal(rep.variants.ours.echoViolations,1);assert.equal(rep.echoHits[0].where,'warmth turn 2');
 assert.ok(rep.failures.some(f=>f.includes('echo break')));
 assert.ok(rep.failures.some(f=>f.includes('NPC questions')));
 assert.ok(rep.failures.some(f=>f.includes('glue density')));
 const clean=replayRun({meta:{names:['ours']},rows:[row(0,{...q,questionRate:0.3})]});
 assert.deepEqual(clean.failures,[]);
});

test('dialogue replay: human agreement scores the judge against the blind review sheet',()=>{
 const record={meta:{names:['ours','venus']},rows:[{scenario:'warmth',turn:2,verdicts:[{pair:['ours','venus'],winner:'ours',scores:{ours:{fun:8},venus:{fun:4}}}]}]};
 const key={'Case 1':{scenario:'warmth',A:'ours',B:'venus'}};
 const csv=['case,transcript,topic_changes,correct_callbacks,wrong_callbacks,missed_callbacks,reciprocal_care_1_to_5,want_to_answer_1_to_5,premature_ending_turns,pair_preference,evidence',
  'Case 1,A,,,,,4,4,,A,','Case 1,B,,,,,2,2,,B,'].join('\n');
 const a=humanAgreement(record,csv,key);
 assert.deepEqual(a,{compared:1,agreement:1,meanFunGap:0}); // judge and human both prefer A; fun 8/2=4 matches want 4
 const flippedCsv=['case,transcript,topic_changes,correct_callbacks,wrong_callbacks,missed_callbacks,reciprocal_care_1_to_5,want_to_answer_1_to_5,premature_ending_turns,pair_preference,evidence',
  'Case 1,A,,,,,4,4,,B,','Case 1,B,,,,,2,2,,A,'].join('\n');
 const flipped=humanAgreement(record,flippedCsv,key);
 assert.deepEqual(flipped,{compared:1,agreement:0,meanFunGap:0}); // human prefers B, judge picked ours
 const empty=humanAgreement(record,'case,transcript\n',key);
 assert.deepEqual(empty,{compared:0,agreement:null,meanFunGap:null});
});

test('dialogue layer 3: the rhythm criterion reaches the judge prompt and the strict schema',()=>{
 assert.ok(CRITERIA.rhythm);
 const required=judgeResponseFormat.json_schema.schema.properties.A.required;
 assert.ok(required.includes('rhythm'));
 const [system]=judgeMessages({playerAction:'Say hi'},{actors:[]},'A text','B text');
 assert.match(system.content,/rhythm: short, speakable lines/);
});
