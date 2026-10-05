import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validatePack} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {scenePromptMessages} from '../vendor/venus/scenePrompt.mjs';
import {venusStyleMessages} from '../vendor/venus/venusStylePrompt.mjs';
import {dropStock} from '../packages/ai/untrusted-output.mjs';
import {AVOID_PHRASES,avoidList} from '../public/avoid-phrases.mjs';
// gameProject.avoidPhrases on a non-campus pack: a harbor with a ferry pilot.
const pack={playerId:'me',actors:[{id:'me',name:'You'},{id:'olu',name:'Olu',personality:'gruff'}],locations:[]};
const ctx=gameProject=>({stagedCast:['olu'],scenePhase:'continuation',playerAction:'I ask about the storm.',sceneHistory:[{input:'Hi.',text:'Olu: Back again.'}],gameProject});
test('the narrator is told the default stock phrases, a project list replaces them and an empty list drops the line',()=>{
 for(const build of [scenePromptMessages,venusStyleMessages]){
  assert.match(build(ctx({premise:'',setting:''}),pack)[0].content,/AVOID STOCK PHRASES \(and close variants\): dust motes; eyes crinkling at the corners;/);
  const own=build(ctx({premise:'',setting:'',avoidPhrases:['salt-crusted grin']}),pack)[0].content;assert.match(own,/AVOID STOCK PHRASES \(and close variants\): salt-crusted grin\./);assert.doesNotMatch(own,/dust motes/);
  assert.doesNotMatch(build(ctx({premise:'',setting:'',avoidPhrases:[]}),pack)[0].content,/AVOID STOCK PHRASES/);
 }
 assert.equal(avoidList(undefined),AVOID_PHRASES);
});
test('narration that uses a listed phrase is cut while someone speaks; dialogue and solo narration are kept',()=>{
 const lines=[{speaker:'',text:'Dust motes drift through the wheelhouse. Olu taps the barometer.'},{speaker:'olu',text:'Eyes crinkling at the corners, that’s me.'}];
 assert.deepEqual(dropStock(lines,AVOID_PHRASES).map(l=>l.text),['Olu taps the barometer.','Eyes crinkling at the corners, that’s me.']);
 const solo=[{speaker:'',text:'Dust motes drift through the wheelhouse.'}];assert.deepEqual(dropStock(solo,AVOID_PHRASES),solo);
 assert.deepEqual(dropStock(lines,[]),lines);
});
test('validation accepts a phrase list and rejects non-strings or blanks',()=>{
 const p=JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)));p.gameProject={premise:'A harbor town.',setting:'Docks.',ai:{intent:'',scene:'',daypart:''},calendar:{startDate:'2026-06-01'},avoidPhrases:['salt-crusted grin']};
 validatePack(p,registry);
 for(const bad of [['  '],[3],'dust motes'])assert.throws(()=>validatePack({...p,gameProject:{...p.gameProject,avoidPhrases:bad}},registry),/avoidPhrases/);
});
