import test from 'node:test';
import assert from 'node:assert/strict';
import {mechanicsDigest} from '../packages/core/engine.mjs';

const pack=()=>({schemaVersion:1,id:'digest-test',version:'1.0.0',modules:{},playerId:'player',locations:[{id:'home',name:'Home',description:'A room.',exits:[]}],actors:[{id:'player',name:'Player',location:'home'}]});

test('absent creator options preserve the legacy mechanics digest',()=>{
 const p=pack();assert.equal(mechanicsDigest(p),'e675bae4');
 p.gameProject={};assert.equal(mechanicsDigest(p),'e675bae4');
 p.socialPacing=undefined;p.sceneFeedback=undefined;p.gameProject.timeMode=undefined;assert.equal(mechanicsDigest(p),'e675bae4');
});

for(const [field,a,b] of [['socialPacing','slow','fast'],['sceneFeedback',false,true],['gameProject.timeMode','clock','planner']])test(`${field} changes invalidate the mechanics digest`,()=>{
 const p=pack(),before=mechanicsDigest(p),set=value=>{if(field==='gameProject.timeMode')p.gameProject={timeMode:value};else p[field]=value;};
 set(a);const first=mechanicsDigest(p);assert.notEqual(first,before);
 set(b);assert.notEqual(mechanicsDigest(p),first);assert.notEqual(mechanicsDigest(p),before);
 if(field==='gameProject.timeMode')delete p.gameProject.timeMode;else delete p[field];assert.equal(mechanicsDigest(p),before);
});

test('prose-only edits preserve the mechanics digest with creator options',()=>{
 const p=pack();p.socialPacing='slow';p.sceneFeedback=false;p.gameProject={timeMode:'clock'};const before=mechanicsDigest(p);
 p.title='New title';p.description='New story';p.locations[0].name='New home';p.locations[0].description='New room';p.actors[0].name='New player';p.actors[0].description='New biography';p.gameProject.description='New project prose';assert.equal(mechanicsDigest(p),before);
});
