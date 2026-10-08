import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {specFromPack} from '../packages/cards/world-assembly.mjs';

// Leaving a heroine out of the kept cast is a skip: refused by name while activities, schedules, phone contacts or messages still point at her.
const campus=()=>JSON.parse(readFileSync(new URL('../packs/campus.json',import.meta.url)));
const CAST={jana:{temperament:'torn',pace:'steady'},monique:{temperament:'guarded',pace:'slow'},nova:{temperament:'prickly',pace:'casual'},abigail:{temperament:'practical',pace:'easy'}};
const without=(cast,id)=>Object.fromEntries(Object.entries(cast).filter(([k])=>k!==id));

test('skipping a heroine that activities, schedules, contacts or messages reference is refused by name',()=>{
 assert.throws(()=>specFromPack(campus(),{cast:without(CAST,'jana')}),{message:/cannot skip heroine jana; referenced by activities: movie-night, beach-volleyball, darts-with-jana; schedules: jana; phoneContacts: jana; phoneMessages: jana-milk, jana-wants-answers$/});
});

test('skipping a heroine with no references still works and she is kept as a friend',()=>{
 const p=campus();
 p.activities=p.activities.filter(a=>a.character!=='abigail');p.schedules=p.schedules.filter(r=>r.actor!=='abigail');
 p.phoneContacts=p.phoneContacts.filter(x=>x!=='abigail');p.phoneMessages=p.phoneMessages.filter(m=>m.character!=='abigail');
 const spec=specFromPack(p,{cast:without(CAST,'abigail')});
 assert.ok(spec.friends.some(a=>a.id==='abigail'));assert.ok(!spec.heroines.some(h=>h.id==='abigail'));
});
