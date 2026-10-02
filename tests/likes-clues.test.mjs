import test from 'node:test';
import assert from 'node:assert/strict';
import {dating,datingContext} from '../packages/modules/dating.mjs';
import {gossip} from '../packages/modules/gossip.mjs';
import {journal} from '../public/campus.mjs';
import {readFileSync} from 'node:fs';

const fixture=(open=true)=>{
 const pack={playerId:'player',likesOpen:open,modules:{},actors:[{id:'player',name:'You'},{id:'heroine',name:'Ada'},{id:'friend',name:'Bea'}],locations:[{id:'here',name:'Here'},{id:'away',name:'Away'}],datingProfiles:[{character:'heroine',preferences:[],thresholds:{crush:100,date:100,exclusive:100}}],actProfiles:[{character:'heroine',entries:[{id:'secret-sea',kind:'listen',target:'ocean_tag',points:3,reason:'Enjoys ocean_tag',clue:'She brightened at stories of salt air.',softLabel:'Drawn to the coast'},{id:'secret-noise',kind:'boast',target:'noise_tag',points:-3,reason:'Avoids noise_tag',clue:'She went quiet as the room grew louder.',softLabel:'Prefers a quieter moment'}]}]};
 if(open==='legacy')delete pack.likesOpen;
 const state={tick:0,flags:{},actors:{player:{name:'You',location:'here'},heroine:{name:'Ada',location:'here'},friend:{name:'Bea',location:'here'}},modules:{'social.dating':dating.init(pack),'social.gossip':gossip.init(pack),'social.npc':{pairs:{'friend|heroine':{affinity:1}}},'social.acts':{characters:{heroine:{known:['secret-sea']}}}}},events=[];
 const tx={state,pack,set(path,value){let at=state;for(const key of path.slice(0,-1))at=at[key];at[path.at(-1)]=value;},emit(type,payload,visibility){events.push({type,payload,visibility});}};
 return {pack,state,tx,events};
};
const act=(f,source='one',entry='secret-sea',extras={})=>dating.react(f.tx,{id:source,type:'social.actPriced',payload:{character:'heroine',entry,source,sceneId:'scene',act:{kind:'listen',target:'ocean_tag',landed:true},points:entry==='secret-sea'?3:-3,verdict:entry==='secret-sea'?'liked':'disliked',...extras}});
const clean=f=>{const view=JSON.stringify([journal(f.state,f.pack),datingContext(f.state,f.pack,'player'),f.events.filter(e=>e.type==='social.likeClueAdded')]);for(const secret of ['secret-sea','secret-noise','ocean_tag','noise_tag'])assert.ok(!view.includes(secret),secret);};

test('landed clues are deterministic, hidden and promoted after two separate acts',()=>{
 const a=fixture(),b=fixture();act(a);act(b);assert.deepEqual(a.state,b.state);assert.deepEqual(a.events,b.events);assert.equal(journal(a.state,a.pack)[0].clues.length,1);assert.deepEqual(journal(a.state,a.pack)[0].likes,[]);clean(a);
 act(a);assert.equal(journal(a.state,a.pack)[0].clues.length,1);act(a,'two');assert.equal(journal(a.state,a.pack)[0].likes[0].reason,'Drawn to the coast');clean(a);
});
test('closed likes stay clues only, including dislikes and unsafe authored wording',()=>{
 const f=fixture(false);act(f);act(f,'two');act(f,'three','secret-noise');act(f,'four','secret-noise');const j=journal(f.state,f.pack)[0];assert.equal(j.clues.length,4);assert.deepEqual(j.likes,[]);assert.deepEqual(j.dislikes,[]);clean(f);
 const g=fixture();g.pack.actProfiles[0].entries[0].clue='secret-sea ocean_tag';g.pack.actProfiles[0].entries[0].softLabel='ocean_tag';act(g);act(g,'two');clean(g);
});
test('neutral, unpaid, capped and explicitly missed acts yield no clues; missing field is legacy',()=>{
 const f=fixture();for(const verdict of ['neutral','unpaid'])act(f,verdict,'secret-sea',{verdict,points:0});act(f,'cap','secret-sea',{capped:true});act(f,'miss','secret-sea',{act:{landed:false}});assert.equal(journal(f.state,f.pack)[0].clues.length,0);
 const legacy=fixture('legacy');act(legacy);assert.equal(journal(legacy.state,legacy.pack)[0].likes[0].reason,'Enjoys ocean_tag');
});
test('friends gossip about an absent heroine once per day, repeat clues promote labels',()=>{
 const f=fixture();f.state.actors.heroine.location='away';assert.ok(gossip.actions(f.state,f.pack).some(a=>a.type==='social.askLikeClue'));gossip.commands['social.askLikeClue'](f.tx,{target:'friend'});assert.equal(journal(f.state,f.pack)[0].clues.length,1);assert.throws(()=>gossip.commands['social.askLikeClue'](f.tx,{target:'friend'}));
 f.state.tick=12;gossip.commands['social.askGossip'](f.tx,{target:'friend'});f.state.tick=24;gossip.commands['social.askLikeClue'](f.tx,{target:'friend'});assert.equal(journal(f.state,f.pack)[0].likes.length,1);clean(f);
});
test('gossip requires a friend present and a heroine absent; cap is global',()=>{
 const f=fixture();assert.throws(()=>gossip.commands['social.askLikeClue'](f.tx,{target:'friend'}));f.state.actors.heroine.location='away';f.state.modules['social.npc'].pairs['friend|heroine'].affinity=0;assert.throws(()=>gossip.commands['social.askLikeClue'](f.tx,{target:'friend'}));f.state.modules['social.npc'].pairs['friend|heroine'].affinity=1;f.state.actors.friend.location='away';assert.throws(()=>gossip.commands['social.askLikeClue'](f.tx,{target:'friend'}));
 f.state.actors.friend.location='here';f.state.scene={characters:['heroine']};assert.throws(()=>gossip.commands['social.askLikeClue'](f.tx,{target:'friend'}));delete f.state.scene;gossip.commands['social.askLikeClue'](f.tx,{target:'friend'});f.pack.actors.push({id:'other',name:'Cora'});f.state.actors.other={name:'Cora',location:'here'};f.state.modules['social.npc'].pairs['heroine|other']={affinity:1};assert.throws(()=>gossip.commands['social.askLikeClue'](f.tx,{target:'other'}));assert.ok(!gossip.actions(f.state,f.pack).some(a=>a.type==='social.askLikeClue'));
});
test('clue bookkeeping never makes unrelated preferences noticed; player context hides public raw preferences',()=>{
 const f=fixture();f.pack.datingProfiles[0].preferences=[{id:'raw-preference',type:'flag',flag:'secret',weight:10,visibility:'public',label:'Secret answer'}];f.state.flags.secret=true;dating.react(f.tx,{id:'clue',type:'social.likeClueAdded',payload:{character:'heroine',text:'A hint'}});assert.deepEqual(f.state.modules['social.dating'].characters.heroine.noticed||[],[]);assert.deepEqual(datingContext(f.state,f.pack,'player')[0].preferences,[]);
});
test('clue patches rebuild the same journal without any model call',()=>{
 const f=fixture(),replayed=fixture();const set=f.tx.set;f.tx.set=(path,value)=>{set(path,value);replayed.tx.set(path,structuredClone(value));};act(f);act(f,'two');assert.deepEqual(journal(replayed.state,replayed.pack),journal(f.state,f.pack));
});

test('pack threshold, daily cap and varied authored clues preserve deterministic defaults',()=>{
 const f=fixture();f.pack.likeClueSettings={promotionThreshold:3,gossipDailyCap:2};f.pack.actProfiles[0].entries[0].clues=['She lingered over the salt-air story.','Her smile returned at the thought of a distant shore.'];act(f);act(f,'two');assert.notEqual(journal(f.state,f.pack)[0].clues[0].text,journal(f.state,f.pack)[0].clues[1].text);assert.equal(journal(f.state,f.pack)[0].likes.length,0);act(f,'three');assert.equal(journal(f.state,f.pack)[0].likes.length,1);clean(f);
 const g=fixture();g.pack.likeClueSettings={gossipDailyCap:2};g.state.actors.heroine.location='away';gossip.commands['social.askLikeClue'](g.tx,{target:'friend'});gossip.commands['social.askLikeClue'](g.tx,{target:'friend'});assert.equal(journal(g.state,g.pack)[0].clues.length,2);assert.throws(()=>gossip.commands['social.askLikeClue'](g.tx,{target:'friend'}));g.state.tick=12;gossip.commands['social.askLikeClue'](g.tx,{target:'friend'});g.pack.likeClueSettings.gossipDailyCap=0;assert.ok(!gossip.actions(g.state,g.pack).some(a=>a.type==='social.askLikeClue'));
});

test('Campus and its reskin author two hidden lines and a soft label for every trio taste',()=>{
 for(const name of ['campus','campus-trio']){const p=JSON.parse(readFileSync(new URL(`../packs/${name}.json`,import.meta.url)));assert.equal(p.likesOpen,true);assert.deepEqual(p.likeClueSettings,{promotionThreshold:2,gossipDailyCap:1});dating.validate(p);gossip.validate(p);
 for(const c of name==='campus'?['jana','nova','abigail']:['yuna','haruka','minji']){const s=p.characterSheets.find(x=>x.actorId===c);for(const [kind,liked] of [['likes',true],['dislikes',false]])for(const tag of s.tastes[kind]){const row=p.actProfiles.find(x=>x.character===c).likeClues.find(x=>x.character===c&&x.tag===tag&&x.liked===liked);assert.ok(row,`${c}: ${tag}`);assert.ok(row.clues.length>=2);assert.equal(new Set(row.clues).size,row.clues.length);for(const line of [...row.clues,row.softLabel])assert.ok(!line.toLowerCase().includes(tag.toLowerCase()),`${c}: leaked ${tag}`);assert.ok(row.entries.length);}}
 }
});

test('authored taste table is used for landed acts and friend gossip without exposing tags',()=>{
 const f=fixture();f.pack.actProfiles[0].likeClues=[{id:'shore',character:'heroine',tag:'ocean_tag',liked:true,entries:['secret-sea'],clues:['She lingered over the salt-air story.','Her smile returned at the thought of a distant shore.'],softLabel:'Drawn to the coast'}];act(f);act(f,'two');assert.equal(journal(f.state,f.pack)[0].likes[0].reason,'Drawn to the coast');assert.notEqual(journal(f.state,f.pack)[0].clues[0].text,journal(f.state,f.pack)[0].clues[1].text);clean(f);
 const g=fixture();g.pack.actProfiles[0].likeClues=f.pack.actProfiles[0].likeClues;g.state.actors.heroine.location='away';gossip.commands['social.askLikeClue'](g.tx,{target:'friend'});assert.equal(journal(g.state,g.pack)[0].clues[0].text,f.pack.actProfiles[0].likeClues[0].clues[0]);clean(g);
});

test('clue tuning and authoring reject invalid values',()=>{
 for(const settings of [{promotionThreshold:0},{promotionThreshold:1.5},{gossipDailyCap:-1},{gossipDailyCap:1.5}]){const f=fixture();f.pack.likeClueSettings=settings;assert.throws(()=>settings.promotionThreshold!==undefined?dating.validate(f.pack):gossip.validate(f.pack));}
 const f=fixture();f.pack.actProfiles[0].likeClues=[{id:'bad',character:'heroine',tag:'ocean_tag',liked:true,entries:['invalid reference'],clues:['A hint','Another hint'],softLabel:'Coast'}];assert.throws(()=>dating.validate(f.pack));
});

test('authored gossip topics survive replacing the landed act rules',()=>{
 const f=fixture();f.pack.actProfiles[0].likeClues=[{id:'shore',character:'heroine',tag:'ocean_tag',liked:true,entries:['old-sea'],clues:['Salt air lingered in her story.','She smiled at the thought of a distant shore.'],softLabel:'Drawn to the coast'}];dating.validate(f.pack);f.state.actors.heroine.location='away';gossip.commands['social.askLikeClue'](f.tx,{target:'friend'});assert.equal(journal(f.state,f.pack)[0].clues[0].text,'Salt air lingered in her story.');clean(f);
});
