import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../packages/persistence/store.mjs';

test('named checkpoints are labeled and survive routine commit churn',()=>{
  const store=new Store();
  store.insert({campaignId:'a',revision:0,turns:{},tick:0});
  store.backup('a','checkpoint:manual:before the fight');
  for(let i=1;i<=25;i++)store.commit({campaignId:'a',revision:i,turns:{},tick:i},i-1);
  const backups=store.backups('a');
  assert.ok(backups.some(b=>b.reason==='checkpoint:manual:before the fight'),'named checkpoint should not be evicted by routine auto-backups');
  assert.ok(backups.filter(b=>b.reason==='before commit').length<=20,'auto backups stay capped at 20');
});

test('checkpoint pool is capped separately from the auto-backup pool',()=>{
  const store=new Store();
  store.insert({campaignId:'a',revision:0,turns:{},tick:0});
  for(let i=0;i<60;i++)store.backup('a',`checkpoint:manual:cp${i}`);
  const backups=store.backups('a');
  assert.equal(backups.filter(b=>b.reason.startsWith('checkpoint:')).length,50);
  assert.ok(backups.some(b=>b.reason==='checkpoint:manual:cp59'),'most recent checkpoint kept');
  assert.ok(!backups.some(b=>b.reason==='checkpoint:manual:cp0'),'oldest checkpoint evicted past the cap');
});

test('scene end and daypart turns create automatic checkpoints',()=>{
  const store=new Store();
  store.insert({campaignId:'a',revision:0,turns:{
    t1:{id:'t1',command:{id:'t1',type:'scene.act'},status:'pending',events:[]},
  },tick:0,scene:{id:'s1',summary:''}});
  store.narrative('a','t1','ok',{sceneId:'s1',sceneEnded:true});
  assert.ok(store.backups('a').some(b=>b.reason==='checkpoint:scene'));

  store.insert({campaignId:'b',revision:0,turns:{
    t1:{id:'t1',command:{id:'t1',type:'world.nextDaypart'},status:'pending',events:[]},
  },tick:0});
  store.narrative('b','t1','ok',{artifact:{lines:['ok']}});
  assert.ok(store.backups('b').some(b=>b.reason==='checkpoint:daypart'));
});

test('branch clones a checkpoint into a new campaign without touching the source',()=>{
  const store=new Store();
  store.insert({campaignId:'a',revision:0,turns:{t1:{id:'t1',command:{id:'t1',type:'x'},status:'complete',events:[]}},tick:5});
  const backupId=store.backup('a','checkpoint:manual:before the choice');
  store.commit({campaignId:'a',revision:1,turns:{t1:{id:'t1',command:{id:'t1',type:'x'},status:'complete',events:[]},t2:{id:'t2',command:{id:'t2',type:'x'},status:'complete',events:[]}},tick:6},0);

  const branched=store.branch('a',backupId,'branch-1');
  assert.equal(branched.campaignId,'branch-1');
  assert.equal(Object.keys(branched.turns).length,1,'branch reflects the checkpoint, not the live campaign');

  const live=store.load('a');
  assert.equal(Object.keys(live.turns).length,2,'source campaign history is untouched by branching');
  assert.equal(live.revision,1);

  assert.throws(()=>store.branch('a',backupId,'a'),/already exists/);
});

test('previewRestore reports what an in-place restore would discard without changing state',()=>{
  const store=new Store();
  store.insert({campaignId:'a',revision:0,turns:{t1:{id:'t1',command:{id:'t1',type:'x'},status:'complete',events:[]}},tick:1});
  const backupId=store.backup('a','checkpoint:manual:save point');
  store.commit({campaignId:'a',revision:1,turns:{t1:{id:'t1',command:{id:'t1',type:'x'},status:'complete',events:[]},t2:{id:'t2',command:{id:'t2',type:'x'},status:'complete',events:[]}},tick:3},0);

  const preview=store.previewRestore('a',backupId);
  assert.equal(preview.currentRevision,1);
  assert.equal(preview.targetRevision,0);
  assert.equal(preview.turnsDiscarded,1);
  assert.equal(preview.tickDiscarded,2);
  assert.equal(store.load('a').revision,1,'preview does not mutate the campaign');
});
