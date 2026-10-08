import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute,validatePack} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {bakeDirectorTemplates} from '../packages/cards/director-templates.mjs';
import {validateImport} from '../packages/persistence/store.mjs';

// The director's missed-goal relationship write is the one trust write outside changeTrust. It now goes through changeTrust
// in flagged packs only (GC2.2); unflagged saves keep the legacy write, and old flagged saves must replay identical events.
const probe={id:'test.director-signals',version:'0.1.0',coreApi:'0.1.0',requires:[],commands:{'test.miss'(tx,args){tx.emit('story.planBroken',{id:args.id,character:'ada',plan:'Meet Ada',status:'broken'});}}};
const mods={...registry,[probe.id]:probe};
const template=(id,kind,delivery,tone=1,extra={})=>({id,kind,delivery,tone,roles:{lead:{pool:['ada']}},focusRole:'lead',scene:{title:`${kind} for {lead}`,opening:`{lead} brings a ${kind}.`,choices:[{id:'answer',label:'Respond',result:'You respond.'}]},...extra});
const base=()=>{const p=JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url),'utf8'));delete p.modules['world.schedule'];p.modules['story.scenes']='0.1.0';p.modules['story.director']='0.1.0';p.modules[probe.id]='0.1.0';p.scriptedScenes=[];p.directorProfile={firstTick:0,quietDayparts:1,jitter:0,decayPerTick:20,maxPerDay:3,opportunityChancePercent:0,interruptionChancePercent:0};return p;};
// A hand-edited pack can carry a non-positive missed cost; the template path only ever bakes costs of 1-20.
function goalPack({flagged=true,trust=10,cost=3}={}){
 const p=base();if(!flagged)delete p.progression;
 p.initialRelationships=[{character:'ada',trust}];p.romanceTempoProfiles=[{character:'ada'}];
 const baked=bakeDirectorTemplates(p,[template('deadline','goal','offer')]);
 baked.directorProfile.opportunities[0].goal.missed.cost=cost;
 return baked;
}
const missed=(p)=>{validatePack(p,mods);const s=createWorld(p,mods,'director-trust',42);const planId=p.directorProfile.opportunities[0].goal.planId;return execute(s,{id:'m1',actorId:p.playerId,type:'test.miss',args:{id:planId},expectedRevision:s.revision},p,mods);};
const edgeOf=s=>s.modules['social.relationships'].edges['ada--player'];

test('a flagged director goal gain is capped like any Trust gain (daily cap, shared writer)',()=>{
 const r=missed(goalPack({trust:10,cost:-20}));
 assert.equal(edgeOf(r.state),16,'the director write must not bypass the 6-per-day gain cap');
 const ev=r.turn.events.find(e=>e.type==='social.relationshipChanged');
 assert.equal(ev.payload.delta,6);assert.equal(ev.payload.capped,true);
});

test('a flagged director goal gain cannot push Trust past 100',()=>{
 const r=missed(goalPack({trust:98,cost:-20}));
 assert.equal(edgeOf(r.state),100);
});

test('an unflagged save keeps the legacy director write (no progression rules; GC2.2)',()=>{
 const r=missed(goalPack({flagged:false,trust:10,cost:-20}));
 assert.equal(edgeOf(r.state),30);
 assert.equal(r.state.progression,undefined);
});

const fx=JSON.parse(readFileSync(new URL('./fixtures/progression/director-miss-save.json',import.meta.url),'utf8'));
test('an old flagged save with director misses (including at the trust floor) replays with identical events',()=>{
 const s=validateImport(structuredClone(fx.flagged.portable),fx.flagged.pack,mods);
 assert.equal(edgeOf(s),fx.flagged.expected.trust.ada.at(-1));
 assert.deepEqual(Object.values(s.turns).at(-1).events.filter(e=>e.type==='social.relationshipChanged').map(e=>Object.keys(e.payload)),[['actor','toward','old','value','delta','reaction','text']]);
});

test('an old unflagged save with director misses replays with identical events',()=>{
 const s=validateImport(structuredClone(fx.unflagged.portable),fx.unflagged.pack,mods);
 assert.equal(edgeOf(s),fx.unflagged.expected.trust.ada.at(-1));
 assert.equal(s.progression,undefined);
});
