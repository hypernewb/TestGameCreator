import test from 'node:test';
import assert from 'node:assert/strict';
import {readKey,routeOf,galleryOf,replayLines} from '../public/gallery.mjs';

const pack={id:'g',playerId:'me',actors:[{id:'me'},{id:'juno',name:'Juno'},{id:'theo',name:'Theo'}],datingProfiles:[{character:'juno'},{character:'theo'}],scriptedScenes:[
 {id:'kiss',title:'Chairs up',cg:'kiss.png',opening:'The bar is dark.',pages:[{speaker:'juno',text:'You stayed.'}],choices:[{id:'say',label:'Say it',result:'She comes closer.',next:'close',check:{stat:'nerve',target:8,fail:{result:'It comes out as a joke.'}}}],beats:[{id:'close',opening:'Very close.',choices:[{id:'k',label:'Kiss her',result:'She kisses you back.',effects:[{type:'chemistry',character:'juno',delta:10}]}]}]},
 {id:'song',title:'The song',opening:'Theo tunes up.',pages:[{speaker:'theo',text:'This one is new.'}],choices:[{id:'listen',label:'Listen',result:'You listen.'}]},
 {id:'quiz',title:'Pub quiz',opening:'Round three.',choices:[{id:'go',label:'Answer',result:'Wrong.'}]}]};
const played=history=>({modules:{'story.scenes':{completed:[...new Set(history.map(h=>h.scene))],history}}});
const hist=[{scene:'kiss',beat:'opening',choice:'say',tick:4,status:'resolved',passed:true},{scene:'kiss',beat:'close',choice:'k',tick:4,status:'resolved'},{scene:'song',beat:'opening',tick:6,status:'dismissed'}];

test('read keys follow the words, not the playthrough, so replays and repeat scenes skip',()=>{
 assert.equal(readKey('g',{speaker:'juno',text:'You stayed.'}),readKey('g',{speaker:'juno',text:'You stayed.',stage:['x']}));
 assert.notEqual(readKey('g',{speaker:'juno',text:'You stayed.'}),readKey('g',{speaker:'theo',text:'You stayed.'}));
 assert.notEqual(readKey('g',{text:'a'}),readKey('h',{text:'a'}),'packs do not share read state');
});

test('gallery groups scenes by route and only unlocks ones actually played through',()=>{
 assert.deepEqual(pack.scriptedScenes.map(x=>routeOf(x,pack)),['juno','theo','']);
 const g=galleryOf(played(hist),pack);
 assert.deepEqual(g.map(r=>[r.name,r.seen,r.scenes.length]),[['Juno',1,1],['Theo',0,1],['The city',0,1]]);
 assert.deepEqual(g[0].scenes[0],{id:'kiss',title:'Chairs up',cg:'kiss.png',unlocked:true,plays:1});
 assert.equal(g[1].scenes[0].unlocked,false,'dismissed without choosing is not a completed scene');
});

test('replay rebuilds the pages from committed history, including the branch taken, and never touches state',()=>{
 const s=played([...hist,{scene:'kiss',beat:'opening',choice:'say',tick:30,status:'resolved',passed:false}]),before=JSON.stringify(s);
 const first=replayLines(s,pack,'kiss',0).map(l=>l.text);
 assert.deepEqual(first,['The bar is dark.','You stayed.','▸ Say it','She comes closer.','Very close.','▸ Kiss her','She kisses you back.']);
 assert.equal(replayLines(s,pack,'kiss',0)[0].cg,'kiss.png');
 assert.deepEqual(replayLines(s,pack,'kiss').slice(-1)[0].text,'It comes out as a joke.','latest run, failed check shows the fail text');
 assert.equal(galleryOf(s,pack)[0].scenes[0].plays,2);
 assert.deepEqual(replayLines(s,pack,'song'),[],'nothing to replay for an unfinished scene');
 assert.equal(JSON.stringify(s),before);
});
