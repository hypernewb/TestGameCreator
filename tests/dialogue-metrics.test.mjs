import test from 'node:test';
import assert from 'node:assert/strict';
import {dialogueMetrics,dialogueLine} from '../packages/testing/dialogue-metrics.mjs';
import {tally,summaryLine} from '../packages/testing/prompt-ab.mjs';

const l=(speaker,text,kind)=>({speaker,text,...(kind?{kind}:{})});
const P='player',J='jana';

test('dialogue metrics: interview cadence, walls, rhythm and balance',()=>{
 const m=dialogueMetrics({lines:[
  l('','The kitchen still smells like last night.'),
  l(J,'Hey. You are up early. How did you sleep? Did you dream? Was I in it? Huh? Was I? Huh?'),
  l(P,'Fine. You?'),
  l(J,'I could not stop thinking about the argument we had yesterday afternoon on the porch while the rain came sideways over the roof and the gutters overflowed and the whole street smelled like wet asphalt and old leaves and neither of us would go inside first.')]},{playerId:P});
 assert.equal(m.questionRate,0.5); // one of Jana's two lines ends in a question
 assert.equal(m.walls,1);assert.equal(m.narrationWalls,0);
 assert.equal(m.medianWords,33); // two spoken lines: 20 words and the 46-word wall
 assert.equal(m.dialogueRatio,0.9,'spoken words dominate narration');
 assert.equal(m.glueDensity,0);assert.equal(m.echoViolations,0);
 assert.match(dialogueLine(m),/npc questions 50% · walls 1/);
});

test('dialogue metrics: a mannerism recycled across the conversation is counted, across speakers it is not excused',()=>{
 const tap='taps a finger against her chin and waits';
 const m=dialogueMetrics({lines:[l(J,`She ${tap}.`),l('nova',`She also ${tap}.`)]},{playerId:P});
 assert.ok(m.recycledGrams>=2,'a repeated 6-word phrase yields repeated 5-grams');
 const clean=dialogueMetrics({lines:[l(J,'She taps a finger against her chin.'),l('nova','He drums the table instead, bored.')]},{playerId:P});
 assert.equal(clean.recycledGrams,0);
});

test('dialogue metrics: echo-wrap failures are caught; a clean echo is not',()=>{
 const broken=dialogueMetrics({lines:[l(P,'You tell Jana: "I ask Jana, \\"Where were you?\\""')]},{playerId:P});
 assert.equal(broken.echoViolations,1,'the self-reference survives inside the wrapper');
 const unbalanced=dialogueMetrics({lines:[l(P,'You tell Jana: "Where were you?')]},{playerId:P});
 assert.equal(unbalanced.echoViolations,1,'odd quotes');
 const clean=dialogueMetrics({lines:[l(P,'You tell Jana: "Where were you?"'),l(P,'I head for the library.')]},{playerId:P});
 assert.equal(clean.echoViolations,0);
});

test('dialogue metrics: engine glue and empty scenes',()=>{
 const m=dialogueMetrics({lines:[l(J,'Hi.'),l(P,'Hey.'),l(J,'So.')],engine:[l('','RESULT','Trust 10 → 12')]},{playerId:P});
 assert.equal(m.glue,1);assert.equal(m.glueDensity,0.33);
 assert.deepEqual(dialogueMetrics({lines:[],engine:[]},{playerId:P}),{lines:0,spoken:0,narration:0,glue:0,characterLines:0,questionRate:null,walls:0,narrationWalls:0,medianWords:null,dialogueRatio:null,recycledGrams:0,echoViolations:0,glueDensity:null});
});

test('dialogue metrics: per-variant aggregate lands in the tally and the summary line',()=>{
 const names=['ours','venus'],good={questionRate:0.2,walls:0,narrationWalls:0,glueDensity:0.2,recycledGrams:0,echoViolations:0,medianWords:11,dialogueRatio:0.9},
       bad={questionRate:0.8,walls:2,narrationWalls:1,glueDensity:0.6,recycledGrams:4,echoViolations:1,medianWords:33,dialogueRatio:0.5};
 const rows=[{scenario:'s',turn:0,phase:'opening',input:'hi',ours:{text:'a',dialogue:good},venus:{text:'b',dialogue:bad},verdicts:[]}];
 const t=tally(rows,names);
 assert.deepEqual(t.dialogue.ours,{questionRate:0.2,walls:0,glueDensity:0.2,recycledGrams:0,echoViolations:0,medianWords:11,dialogueRatio:0.9});
 assert.deepEqual(t.dialogue.venus,{questionRate:0.8,walls:3,glueDensity:0.6,recycledGrams:4,echoViolations:1,medianWords:33,dialogueRatio:0.5});
 assert.match(summaryLine(t),/dialogue ours q0\.2 walls0 glue0\.2 recycled0 echo0 \/ venus q0\.8 walls3 glue0\.6 recycled4 echo1 /);
});
