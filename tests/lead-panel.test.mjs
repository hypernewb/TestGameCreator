import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute,validatePack,clone,actions} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {leadLines} from '../packages/core/character-progress.mjs';
const neutral=JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)));
function pack(){
 const p=clone(neutral);
 p.modules['social.phone']='0.1.0';p.modules['story.timed-events']='0.1.0';p.modules['story.scenes']='0.1.0';
 delete p.modules['world.schedule'];delete p.schedules;delete p.quests;delete p.modules['story.quests'];
 p.phoneContacts=['ada'];
 p.phoneMessages=[{id:'coffee',character:'ada',text:'Fancy a coffee later?',trigger:{event:'core.inspected'},replies:[],offer:{location:'workshop',expiresIn:8}}];
 p.timedEvents=[{id:'demo',name:'The demo',startTick:0,endTick:40,character:'brin'}];
 p.scriptedScenes=[{id:'late-night',title:'Late night cleanup',offer:'hand',opening:'The last patrons drift out.',trigger:{event:'core.inspected'},when:{location:'hub'},choices:[{id:'stay',label:'Stay a while',result:'You stay.'}]}];
 return p;
}
function harness(p){let s=createWorld(p,registry,'test');return {get state(){return s;},act(type,args={}){const r=execute(s,{id:`t${s.revision}`,actorId:p.playerId,type,args,expectedRevision:s.revision},p,registry);s=r.state;return r;}};}

test('leadLines name the hooks a player could pursue, and hide away-locations by default',()=>{
 const h=harness(pack());
 h.act('core.inspect');
 const leads=leadLines(h.state,pack(),[]);
 const ada=leads.find(x=>x.startsWith('Ada —')),brin=leads.find(x=>x.startsWith('Brin —'));
 assert.ok(ada,'Ada has a lead line');
 assert.ok(ada.includes('asked to meet you'),"Ada's pending phone offer is surfaced");
 assert.ok(brin.includes('event happening now'),"Brin's live timed event is surfaced");
 assert.ok(!ada.includes('hub')&&!brin.includes('meeting'),'away locations stay hidden unless the pack opts in');
});

test('offered hand cards appear as leads with their cast and place',()=>{
 const h=harness(pack());
 h.act('core.inspect');
 const leads=leadLines(h.state,pack(),actions(h.state,pack(),registry));
 assert.ok(leads.some(x=>x.startsWith('Late night cleanup —')),'the hand card is a lead');
});
