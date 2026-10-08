import test from 'node:test';import assert from 'node:assert/strict';
import {scenePromptMessages,usedBeats} from '../vendor/venus/scenePrompt.mjs';
import {dropRepeats} from '../packages/ai/untrusted-output.mjs';
// A non-campus pack: a ferry pilot on a harbor.
const pack={playerId:'me',actors:[{id:'me',name:'You'},{id:'olu',name:'Olu',personality:'gruff'}],locations:[]};
const earlier=[{speaker:'',text:'Olu coils a wet rope around his forearm, slow and deliberate. The tide slaps the hull.'},{speaker:'olu',text:'You came back, then.'}];
const ctx=(scenePhase='continuation')=>({stagedCast:['olu'],scenePhase,playerAction:'I ask about the storm.',sceneHistory:[{input:'Hi.',text:'Olu: You came back, then.'}],usedBeats:usedBeats(earlier)});
test('ordinary continuation retains history without a forced used-gesture list or repeated offers',()=>{
 const [sys,user]=scenePromptMessages(ctx(),pack);
 assert.doesNotMatch(user.content,/ALREADY USED THIS SCENE/);assert.match(sys.content,/carry forward unfinished tasks, established objects, positions and interruptions/);
 assert.ok(user.content.includes('Olu: You came back, then.'));
 assert.match(sys.content,/Stay with the current subject unless a clear connection motivates a change/);
 const [os,ou]=scenePromptMessages(ctx('opening'),pack);assert.doesNotMatch(ou.content,/ALREADY USED/);assert.doesNotMatch(os.content,/let pass/);
});
test('a narration beat already used this scene is cut while someone still speaks',()=>{
 const lines=[{speaker:'',text:'Olu coils a wet rope around his forearm, slow and deliberate. He squints at the clouds.'},{speaker:'olu',text:'Storm’s three hours out, maybe less.'}];
 assert.deepEqual(dropRepeats(lines,earlier,'I ask about the storm.').map(l=>l.text),['He squints at the clouds.','Storm’s three hours out, maybe less.']);
 const solo=[{speaker:'',text:'Olu coils a wet rope around his forearm, slow and deliberate.'}];
 assert.deepEqual(dropRepeats(solo,earlier,''),solo);
});
test('formatting glitches are tidied: own-name labels, inline labels, dangling endings and straight quotes',async()=>{
 const {guardSceneLines}=await import('../packages/ai/untrusted-output.mjs');
 const out=guardSceneLines([{speaker:'olu',text:'**Olu:** Rope’s wet,'},{speaker:'',text:'The tide turns. Olu: Tie it off'},{speaker:'',text:'A sign says "No mooring".'}],['olu'],pack,{});
 assert.deepEqual(out.map(l=>[l.speaker,l.text]),[['olu','Rope’s wet.'],['','The tide turns.'],['olu','Tie it off.'],['','A sign says “No mooring”.']]);
});
test('narration that invents the player’s feelings is cut on every model, never the whole reply',async()=>{
 const {dropStock}=await import('../packages/ai/untrusted-output.mjs');
 const lines=[{speaker:'',text:'Olu hands you the rope. Your heart pounds as the hull lurches.'},{speaker:'olu',text:'Hold that tight.'}];
 assert.deepEqual(dropStock(lines).map(l=>l.text),['Olu hands you the rope.','Hold that tight.']);
 const only=[{speaker:'',text:'You feel the deck tilt.'}];assert.deepEqual(dropStock(only),only,'nothing left: the reply is kept for the lint');
});
test('narration that only says a line landed is cut while someone speaks',async()=>{
 const {dropStock}=await import('../packages/ai/untrusted-output.mjs');
 assert.deepEqual(dropStock([{speaker:'',text:'The question lands. Olu sets down the rope.'},{speaker:'olu',text:'Ask me later.'}]).map(l=>l.text),['Olu sets down the rope.','Ask me later.']);
});
