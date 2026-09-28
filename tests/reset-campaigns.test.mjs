import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {Store} from '../packages/persistence/store.mjs';
import {resetCampaigns} from '../scripts/reset-campaigns.mjs';

const tempDb=()=>resolve(mkdtempSync(resolve(tmpdir(),'sf-reset-')),'campaigns.sqlite');

test('dry run reports campaigns without deleting',()=>{
  const path=tempDb(),seed=new Store(path);seed.insert({campaignId:'a',revision:0,events:[]});seed.close();
  const {campaigns,deleted}=resetCampaigns({dbPath:path,log:()=>{}});
  assert.equal(deleted,false);assert.equal(campaigns.length,1);assert.equal(campaigns[0].id,'a');
  assert.equal(new DatabaseSync(path).prepare('SELECT COUNT(*) c FROM campaigns').get().c,1);
});
test('--apply deletes all campaigns, backups, and recovery backups',()=>{
  const path=tempDb(),store=new Store(path);
  store.insert({campaignId:'a',revision:0,events:[]});store.insert({campaignId:'b',revision:0,events:[]});store.backup('a');store.close();
  const {deleted,campaigns}=resetCampaigns({dbPath:path,apply:true,log:()=>{}});
  assert.equal(deleted,true);assert.equal(campaigns.length,2);
  const db=new DatabaseSync(path);
  assert.equal(db.prepare('SELECT COUNT(*) c FROM campaigns').get().c,0);
  assert.equal(db.prepare('SELECT COUNT(*) c FROM backups').get().c,0);
  assert.equal(db.prepare('SELECT COUNT(*) c FROM recovery_backups').get().c,0);
});
test('reports no campaigns cleanly on an empty database',()=>{
  const {campaigns,deleted}=resetCampaigns({dbPath:tempDb(),log:()=>{}});
  assert.equal(campaigns.length,0);assert.equal(deleted,false);
});
