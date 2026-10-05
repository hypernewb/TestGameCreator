import test from 'node:test';import assert from 'node:assert/strict';
import {linesFor,reactionsFor,actionTurns} from '../public/turn-presentation.mjs';
// A non-campus pack: a lighthouse keeper and a ferry pilot.
const pack=(extra={})=>({playerId:'me',actors:[{id:'me',name:'You'},{id:'ines',name:'Ines'},{id:'olu',name:'Olu'}],locations:[{id:'quay',name:'Quay',description:'Wet stone.'}],scriptedScenes:[{id:'storm',opening:'Olu storms up the quay, soaked and furious.',pages:[{speaker:'olu',text:'Who moved my ropes?'}]}],gameProject:extra});
const ev=(type,payload)=>({type,payload});
const reply={id:'t1',command:{type:'story.respond',args:{}},sceneLines:[{speaker:'ines',text:'Mind the tide.'}],events:[ev('social.relationshipChanged',{actor:'ines',toward:'me',old:10,value:14,delta:4,text:'Ines: Trust 10 → 14'})]};
const priced={id:'t2',command:{type:'social.priceActs',args:{source:'t1'}},sceneLines:[{speaker:'',text:'Ines liked that.'}],events:[ev('social.actPriced',{character:'ines',points:2,verdict:'liked',entry:'listen',reason:'you asked about the lamp',text:'Ines liked that.'}),ev('social.chemistryChanged',{character:'ines',delta:2,text:'Ines: Chemistry 3 → 5'}),ev('social.likeClueAdded',{character:'ines',text:'She lit up when you mentioned the lamp.'}),ev('social.crushStarted',{character:'ines',text:'A romantic possibility has opened with Ines.'})]};
const state=(turns,pending)=>({actors:{me:{location:'quay'}},modules:{'story.scenes':{pending}},turns:Object.fromEntries(turns.map(t=>[t.id,t]))});
test('a sub-turn never hides the reply: the action spans its main turn and the sub-turns after it',()=>{
 const s=state([reply,priced]);assert.deepEqual(actionTurns(s).map(t=>t.id),['t1','t2']);
 const lines=linesFor({state:s,pack:pack()});
 assert.deepEqual(lines.map(l=>[l.kind||'',l.text]),[['','Mind the tide.'],['REACTION','Ines warmed to you. She lit up when you mentioned the lamp.'],['RESULT','A romantic possibility has opened with Ines.']]);
});
test('reactionDisplay: reasons shows the authored reason, numbers keeps every stat line',()=>{
 const events=[...reply.events,...priced.events];
 assert.equal(reactionsFor(events,pack({reactionDisplay:'reasons'}))[0].text,'Ines warmed to you: you asked about the lamp.');
 assert.deepEqual(reactionsFor(events,pack({reactionDisplay:'numbers'})).filter(l=>l.kind==='REACTION').map(l=>l.text),['Ines: Trust 10 → 14','Ines: Chemistry 3 → 5']);
 assert.equal(reactionsFor([ev('social.bondChanged',{actor:'olu',dimension:'respect',delta:-3})],pack())[0].text,'Olu cooled a little.');
});
test('a scene set off by the close plays after the goodbye, not instead of it',()=>{
 const bye={id:'t1',command:{type:'core.scene',args:{}},sceneLines:[{speaker:'ines',text:'See you at dusk.'}],events:[]},close={id:'t2',command:{type:'core.endScene',args:{}},events:[ev('core.sceneEnded',{reason:'player',text:'You head off.'}),ev('story.sceneStarted',{scene:'storm'})]};
 const lines=linesFor({state:state([bye,close],'storm'),pack:pack()});
 assert.deepEqual(lines.map(l=>l.text),['See you at dusk.','You head off.','Olu storms up the quay, soaked and furious.','Who moved my ropes?']);
});
test('reactionDisplay is a validated pack option',async()=>{const {validatePack}=await import('../packages/core/engine.mjs'),{registry}=await import('../packages/modules/index.mjs'),{readFileSync}=await import('node:fs');
 const p=JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)));p.gameProject={premise:'',setting:'',ai:{intent:'',scene:'',daypart:''},reactionDisplay:'reasons'};validatePack(p,registry);
 p.gameProject.reactionDisplay='loud';assert.throws(()=>validatePack(p,registry),/reactionDisplay/);});
test('act verdicts read as sentences: generic ones are plain, authored ones quote the reason',async()=>{const {pricedText}=await import('../packages/modules/acts.mjs'),t=(verdict,entry,reason)=>pricedText('Ines',{verdict,entry,reason,act:{target:'scarf'}});
 assert.equal(t('liked',null,'that landed'),'Ines liked that.');assert.equal(t('disliked',null,'that fell flat'),'Ines did not like that.');assert.equal(t('neutral',null,'that landed'),'Ines took that in stride.');
 assert.equal(t('liked','lamp','you asked about the lamp'),'Ines liked that you asked about the lamp.');assert.equal(t('neutral','tease','you teased her like a sister'),'Ines took it in stride: you teased her like a sister.');});
