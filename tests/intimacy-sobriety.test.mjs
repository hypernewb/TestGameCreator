import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute,validatePack,actions} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {intimacyEligibility,sobrietyLevel} from '../packages/modules/intimacy.mjs';

const make=(allowTipsy)=>{const p=JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)));p.modules['social.dating']='0.1.0';p.modules['social.intimacy']='0.1.0';p.actors.find(x=>x.id==='player').age=21;p.actors.find(x=>x.id==='ada').age=24;p.datingProfiles=[{character:'ada',initialChemistry:20,initialSatisfaction:10,initialPhase:'crush',agreements:['casual'],thresholds:{crush:10,date:30,exclusive:60},preferences:[],signals:[]}];p.intimacySettings={difficulty:'easy',contentLevel:'suggestive',privateLocations:['hub']};p.intimacyCategories=[{id:'casual',name:'Casual encounter',privacy:'private',casual:true,requiresAgreement:[],...(allowTipsy===undefined?{}:{allowTipsy})}];p.intimacyProfiles=[{character:'ada',openness:90,casual:true,consentPolicy:'threshold',allowedCategories:['casual'],blockedCategories:[],interests:[]}];p.sobriety={drinkItems:['beer'],tipsyAt:2,drunkAt:3,soberPerDaypart:1};return p;};
// character.sobriety's runtime shape (M0-CONTRACT §3), set directly so the gate is tested without that module.
const drinks=(state,n)=>{const s=structuredClone(state);s.modules['character.sobriety']={characters:{ada:{drinks:n}}};return s;};
const act=(state,p,type)=>execute(state,{id:`t${state.revision}`,actorId:p.playerId,type,args:{character:'ada',category:'casual'},expectedRevision:state.revision},p,registry);

test('sobriety level follows the pack thresholds and is sober with no sobriety state',()=>{
 const p=make(),w=createWorld(p,registry,'s');validatePack(p,registry);
 assert.deepEqual([w,drinks(w,1),drinks(w,2),drinks(w,3)].map(s=>sobrietyLevel(s,p,'ada')),['sober','sober','tipsy','drunk']);
 assert.throws(()=>validatePack((q=>{q.intimacyCategories[0].allowTipsy='yes';return q;})(make()),registry),/allowTipsy/);
});

test('a drunk partner defers instead of consenting, and the hook is the only thing the narrator gets',()=>{
 const p=make(true),w=drinks(createWorld(p,registry,'d'),3);
 assert.deepEqual(intimacyEligibility(w,p,'ada','casual').reasons,['ada is drunk']);
 assert.ok(actions(w,p,registry).some(a=>a.type==='social.requestIntimacy'),'asking stays possible so the player hears why');
 const r=act(w,p,'social.requestIntimacy'),types=r.turn.events.map(e=>e.type);
 assert.ok(types.includes('social.intimacyDeferred'));assert.ok(!types.includes('social.consentGranted'));
 assert.match(r.turn.events.find(e=>e.type==='social.intimacyDeferred').payload.text,/when I'm sober/);
 assert.equal(r.state.modules['social.intimacy'].characters.ada.consent.casual.status,'declined');
});

test('tipsy blocks unless the category allows it; sober consent does not carry into drunk',()=>{
 const blocked=make(),tipsy=drinks(createWorld(blocked,registry,'t'),2);
 assert.ok(act(tipsy,blocked,'social.requestIntimacy').turn.events.some(e=>e.type==='social.intimacyDeferred'));
 const allowed=make(true);assert.ok(act(drinks(createWorld(allowed,registry,'a'),2),allowed,'social.requestIntimacy').turn.events.some(e=>e.type==='social.consentGranted'));
 const asked=act(createWorld(allowed,registry,'c'),allowed,'social.requestIntimacy').state;assert.equal(asked.modules['social.intimacy'].characters.ada.consent.casual.status,'granted');
 const begin=act(drinks(asked,3),allowed,'social.beginIntimacy');
 assert.ok(begin.turn.events.some(e=>e.type==='social.intimacyDeferred'));assert.ok(!begin.turn.events.some(e=>e.type==='social.intimacyStarted'));
});
