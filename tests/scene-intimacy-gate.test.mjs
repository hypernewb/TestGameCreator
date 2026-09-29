import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {Store} from '../packages/persistence/store.mjs';
import {GameService} from '../packages/ai/service.mjs';
import {lintScene} from '../packages/ai/narration-lint.mjs';
import {scenePromptMessages} from '../vendor/venus/scenePrompt.mjs';

// An explicit pack must still not reach explicit prose unless state holds a consented, active encounter.
const pack=()=>{const p=JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)));p.modules['social.dating']='0.1.0';p.modules['social.intimacy']='0.1.0';p.actors.find(x=>x.id==='player').age=21;p.actors.find(x=>x.id==='ada').age=24;p.datingProfiles=[{character:'ada',initialChemistry:20,initialSatisfaction:10,initialPhase:'crush',agreements:['casual'],thresholds:{crush:10,date:30,exclusive:60},preferences:[],signals:[]}];p.intimacySettings={difficulty:'easy',contentLevel:'explicit',privateLocations:['hub']};p.intimacyCategories=[{id:'casual',name:'Casual encounter',privacy:'private',casual:true,requiresAgreement:[]}];p.intimacyProfiles=[{character:'ada',openness:90,casual:true,consentPolicy:'threshold',allowedCategories:['casual'],blockedCategories:[],interests:[]}];p.sobriety={drinkItems:['beer'],tipsyAt:2,drunkAt:3};delete p.schedules;return p;};
const hot={lines:[{speaker:'ada',text:'Stay.'},{speaker:'',text:'Ada moans in pleasure.'}]};
const probe=async(state,p,id)=>{const seen=[];const provider={name:'probe',async generateScene(context){seen.push(context);return {lines:[{speaker:'ada',text:'Not tonight.'}]};}};
 const store=new Store();store.insert(state);const service=new GameService(store,{[p.id]:p},registry,provider);
 try{await service.act(id,{id:'t',expectedRevision:state.revision,command:{type:'core.scene',args:{text:'I kiss Ada and pull her closer.',location:'hub',characters:['ada'],activity:'talk'}}});}finally{store.close();}return seen[0];};

test('an explicit pack without an active encounter gets the boundary line and a hard lint',async()=>{
 const p=pack(),ctx=await probe(createWorld(p,registry,'gate'),p,'gate');
 assert.deepEqual(ctx.intimacyGate,{open:false});assert.match(scenePromptMessages(ctx,p)[1].content,/BOUNDARY: Nothing sexual happens/);assert.doesNotMatch(ctx.intimacyRule,/sober/);
 assert.throws(()=>lintScene(hot,ctx,p),e=>e.lintCheck==='content'&&!e.soft&&/No consented intimate encounter/.test(e.message));
});

test('an active consented encounter opens the gate; a drunk partner gets the sober line',async()=>{
 const p=pack(),w=createWorld(p,registry,'open'),active=structuredClone(w);active.modules['social.intimacy'].characters.ada.active={category:'casual'};
 const ctx=await probe(active,p,'open');assert.deepEqual(ctx.intimacyGate,{open:true});assert.equal(ctx.intimacyRule,undefined);assert.doesNotThrow(()=>lintScene(hot,ctx,p));
 const drunk=structuredClone(w);drunk.modules['character.sobriety']={characters:{ada:{drinks:3}}};
 assert.match((await probe(drunk,p,'open')).intimacyRule,/Ada has been drinking.*ask me again when I'm sober/);
});

test('packs without the intimacy module keep the old content check',()=>{
 const p=pack();delete p.modules['social.intimacy'];assert.doesNotThrow(()=>lintScene(hot,{},p));
 p.intimacySettings.contentLevel='suggestive';assert.throws(()=>lintScene(hot,{},p),/Content level is "suggestive"/);
});
