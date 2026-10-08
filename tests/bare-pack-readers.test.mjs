import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,validatePack} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {assemble,specFromPack} from '../packages/cards/world-assembly.mjs';
import {sceneDraftMessages} from '../packages/ai/scene-draft.mjs';
import {intimacyEligibility,categoriesOf,intimacyContext} from '../packages/modules/intimacy.mjs';
import {INTIMACY_CATEGORIES} from '../packages/cards/beat-library.mjs';

const campus=()=>JSON.parse(readFileSync(new URL('../packs/campus.json',import.meta.url)));
const CAST={jana:{temperament:'torn',pace:'steady'},monique:{temperament:'guarded',pace:'slow'},nova:{temperament:'prickly',pace:'casual'},abigail:{temperament:'practical',pace:'easy'}};
const neutralWithIntimacy=()=>{const p=JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)));p.modules['social.dating']='0.1.0';p.modules['social.intimacy']='0.1.0';p.actors.find(x=>x.id==='player').age=21;p.actors.find(x=>x.id==='ada').age=24;p.datingProfiles=[{character:'ada',initialChemistry:20,initialSatisfaction:10,initialPhase:'crush',agreements:['casual'],thresholds:{crush:10,date:30,exclusive:60},preferences:[],signals:[]}];p.intimacySettings={difficulty:'easy',contentLevel:'suggestive',privateLocations:[]};p.intimacyProfiles=[{character:'ada',openness:50,casual:true,consentPolicy:'ask',allowedCategories:['fling'],interests:[]}];return p;};

// Packs that omit intimacySettings/intimacyCategories: the spec read, the assembler and the scene draft must not throw.
test('bare intimacy keys do not throw in spec read, world assembly or scene draft',()=>{
 const p=campus();delete p.intimacySettings;delete p.intimacyCategories;
 const spec=specFromPack(p,{cast:CAST});
 assert.equal(spec.world.contentLevel,'fade');
 const pack=assemble(spec).pack;assert.deepEqual(pack.intimacyCategories,INTIMACY_CATEGORIES);
 const msgs=JSON.stringify(sceneDraftMessages(p,p.actors.find(a=>a.id==='jana'),{id:'s',category:'fling',beats:[],aftermath:''}));
 assert.match(msgs,/Fling/);
});

// Absent intimacyCategories means the shared beat-library set, at validation and at runtime; a profile naming an unknown category still fails.
test('a pack with no intimacyCategories gets the default set and rejects unknown profile categories',()=>{
 const p=neutralWithIntimacy();validatePack(p,registry);
 assert.deepEqual(categoriesOf(p).map(c=>c.id),['first-night','fling']);
 const w=createWorld(p,registry,'bare-readers');
 assert.ok(!intimacyEligibility(w,p,'ada','fling').reasons?.includes('unknown intimacy profile or category'));
 const bad=neutralWithIntimacy();bad.intimacyProfiles[0].allowedCategories=['nope'];
 assert.throws(()=>validatePack(bad,registry),/intimacy allowed categories invalid/);
});
test('an intimacy profile without interests validates, runs and shows no interests',()=>{
 const p=neutralWithIntimacy();delete p.intimacyProfiles[0].interests;validatePack(p,registry);
 const st=createWorld(p,registry,'no-interests');assert.deepEqual(intimacyContext(st,p,'player')[0].interests,[]);
});
