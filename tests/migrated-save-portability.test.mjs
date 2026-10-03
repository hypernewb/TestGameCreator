import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute,migratePack,clone} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {Store,exportCampaign,validateImport} from '../packages/persistence/store.mjs';
const pack=()=>JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url))),changed=p=>{const q=clone(p);q.actors.find(a=>a.id==='ada').location='workshop';return q;},envelope=s=>({format:'story-framework',version:2,migrations:[],state:clone(s)}),blocked=/Portable saves after a mechanics migration are not supported yet.*original compatible pack.*save.*backup/i;

test('recorded mechanics migration fails at export/import boundary while stripped records still fail replay',()=>{
 const p=pack(),q=changed(p),s=migratePack(createWorld(p,registry,'migration-repro'),p,q,registry),before=clone(s);
 assert.throws(()=>exportCampaign(s),blocked);assert.deepEqual(s,before);
 for(const version of [1,2]){const data=envelope(s);data.version=version;const original=clone(data);assert.throws(()=>validateImport(data,q,registry),blocked);assert.deepEqual(data,original);}
 const stripped=envelope(s);delete stripped.state.migrations;assert.throws(()=>validateImport(stripped,q,registry),/Save state mismatch: actors/);
});

test('export refusal preserves stored campaign/backups and local continuation; compatible checkpoint remains portable',()=>{
 const p=pack(),q=changed(p),store=new Store();try{
  const original=createWorld(p,registry,'migration-store'),oldExport=exportCampaign(original);store.insert(original);const checkpoint=store.backup(original.campaignId,'checkpoint:manual:before migration');store.migratePack(original.campaignId,p,q,registry);
  const s=store.load(original.campaignId),before=clone(s),backups=store.db.prepare('SELECT * FROM recovery_backups ORDER BY id').all();assert.throws(()=>exportCampaign(s),blocked);assert.deepEqual(s,before);assert.deepEqual(store.load(s.campaignId),before);assert.deepEqual(store.db.prepare('SELECT * FROM recovery_backups ORDER BY id').all(),backups);
  const next=execute(s,{id:'after-migration',actorId:q.playerId,type:'core.wait',args:{},expectedRevision:s.revision},q,registry).state;store.commit(next,s.revision);assert.equal(store.load(s.campaignId).tick,1);assert.throws(()=>exportCampaign(store.load(s.campaignId)),blocked);
  assert.equal(validateImport(oldExport,p,registry).revision,0);const branch=store.branch(s.campaignId,checkpoint,'original-compatible');assert.equal(validateImport(exportCampaign(branch),p,registry).revision,0);assert.equal(store.load(s.campaignId).revision,next.revision);
 }finally{store.close();}
});

test('unmigrated and content-only campaigns still export/import without mutation or trusted patches',()=>{
 const p=pack(),s=execute(createWorld(p,registry,'portable'),{id:'wait',actorId:p.playerId,type:'core.wait',args:{},expectedRevision:0},p,registry).state,q=clone(p);q.title='New title';q.actors.find(a=>a.id==='ada').name='Renamed';
 for(const state of [s,{...clone(s),migrations:[]}]){const before=clone(state),data=exportCampaign(state);assert.equal(validateImport(data,p,registry).revision,1);assert.equal(validateImport(data,q,registry).revision,1);assert.deepEqual(state,before);data.state.tick=999;assert.throws(()=>validateImport(data,p,registry),/Save state mismatch: tick/);}
});

test('save-envelope v1 migration remains portable and is separate from mechanics migration records',()=>{
 const p=pack(),s=createWorld(p,registry,'envelope-v1'),data={format:'story-framework',version:1,state:s},before=clone(data),imported=validateImport(data,p,registry);assert.deepEqual(data,before);assert.deepEqual(imported.saveMigrations,[{from:1,to:2,id:'export-envelope-v2'}]);const next=exportCampaign(imported);assert.equal(next.version,2);assert.deepEqual(next.migrations,imported.saveMigrations);assert.equal(validateImport(next,p,registry).revision,0);
});
