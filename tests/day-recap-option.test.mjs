import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {recap,dayRecap,recapContext} from '../packages/modules/recap.mjs';
import {contextFor} from '../packages/ai/context.mjs';
import {dayCard,recapCard} from '../public/campus.mjs';
const campus=JSON.parse(readFileSync(new URL('../packs/campus.json',import.meta.url),'utf8'));
const pack=mode=>({...campus,modules:{},daypart:{interval:2},dayRecap:{max:6,keep:7,...(mode?{mode}:{})}});
const state=()=>({tick:6,campaignId:'recap-test',actors:Object.fromEntries(campus.actors.map(a=>[a.id,{...a}])),modules:{'story.recap':{days:[]}},turns:{},events:[],flags:{}});
const event=(type,payload,tick=2)=>({type,payload,tick,visibility:[campus.playerId]});
function close(s,p){recap.react({state:s,pack:p,set:(_,v)=>{s.modules['story.recap'].days=v;},emit:(type,payload,visibility)=>s.events.push({type,payload,visibility,tick:s.tick})},{type:'core.timeAdvanced',payload:{from:5,to:6}});return s.modules['story.recap'].days.at(-1);}
for(const mode of ['card','prompt','both'])test(`${mode}: popup and one bounded narrator line follow the creator option; journal persists`,()=>{
 const p=pack(mode),s=state();s.events=[event('social.relationshipChanged',{actor:'jana',toward:p.playerId,delta:6}),event('social.planMade',{character:'jana'}),event('social.likeClueAdded',{character:'jana',text:'Enjoys walks by the bay.'})];
 s.events.push(event('social.planKept',{character:'abigail'}));s.modules['story.scenes']={history:[],plans:[{character:'jana',status:'pending',deadlineTick:5},{character:'nova',status:'pending',deadlineTick:6}]};
 const r=close(s,p);assert.equal(r.day,1);assert.match(r.lines.join(' '),/Jana.*warmer/);assert.match(r.lines.join(' '),/made a plan/);assert.match(r.lines.join(' '),/Enjoys walks/);assert.match(r.lines.join(' '),/kept your word to Abigail/);assert.match(r.lines.join(' '),/date has passed.*Jana.*waiting/);assert.match(r.lines.join(' '),/plan with Nova is still open/);
 assert.equal(Boolean(recapCard(s,p)),mode!=='prompt');assert.deepEqual(recap.panel(s,p).lines,[`${r.weekday}${r.date?` ${r.date}`:''}: ${r.lines.join(' ')}`]);
 const c=contextFor(s,p),notes=c.recentActions.filter(a=>a.type==='story.dayClosed');assert.equal(notes.length,mode==='card'?0:1);assert.equal(Boolean(recapContext(s,p)),mode!=='card');if(notes.length){assert.equal(notes[0].text,recapContext(s,p));assert.ok(notes[0].text.length<=240);assert.ok(!notes[0].text.includes('\n'));}
 assert.ok(!contextFor(s,p,p.playerId,{events:s.events}).outcomes.some(e=>e.type==='story.dayClosed'));
});
test('missing mode preserves the legacy popup and raw recap context',()=>{const p=pack(),s=state(),r=close(s,p);assert.deepEqual(recapCard(s,p),r);assert.equal(recapContext(s,p),null);assert.equal(contextFor(s,p).recentActions.find(e=>e.type==='story.dayClosed').text,r.lines.join(' '));});
test('stale pending plans name who is waiting and retain tomorrow on a busy day',()=>{const p=pack('both'),s=state();s.modules['story.scenes']={history:[],plans:[{character:'jana',status:'pending',deadlineTick:5},{character:'nova',status:'pending',deadlineTick:6},{character:'abigail',status:'kept',deadlineTick:1}]};s.events=Array.from({length:12},(_,i)=>event('social.likeClueAdded',{character:'jana',text:`Clue ${String.fromCharCode(65+i)}.`}));const r=close(s,p),text=r.lines.join(' ');assert.match(text,/date has passed.*Jana.*waiting/);assert.match(text,/plan with Nova is still open/);assert.ok(!text.includes('Abigail'));assert.ok(r.lines.length<=6);});
test('non-default daypart interval selects yesterday and tonight correctly',()=>{const p=pack('card'),s=state();s.events=[event('core.sceneEnded',{characters:['nova']},1),event('core.sceneEnded',{characters:['jana']},5)];p.schedules=[{actor:'jana',period:6,stops:[{at:0,location:'missing'},{at:4,location:p.locations[0].id}]}];p.actProfiles=[{character:'jana'}];const d=dayCard(s,p);assert.equal(d.day,2);assert.match(d.yesterday,/Jana/);assert.match(d.rumor,new RegExp(p.locations[0].name));});
test('mode validation rejects unknown options',()=>{for(const mode of ['card','prompt','both'])assert.doesNotThrow(()=>recap.validate(pack(mode)));for(const mode of ['off','',null,3])assert.throws(()=>recap.validate({...pack(),dayRecap:{mode}}),/dayRecap.mode/);});
test('popup displays all stored lines together and queues only once across a day boundary',()=>{
 const source=readFileSync(new URL('../public/play.mjs',import.meta.url),'utf8'),queue=source.slice(source.indexOf('function queueCards('),source.indexOf('function nextCard(')),s=state(),p=pack('card'),shown=[];close(s,p);
 const ctx={seen:{campaign:s.campaignId,tick:5,end:'',recap:undefined},cards:[],isCampus:()=>true,endCard:()=>null,recapCard,newDay:(_s,_p,t)=>t<6,dayCard,showRecapCard:r=>shown.push(r),showDayCard:()=>{},document:{querySelector:()=>true},nextCard:()=>{}};vm.createContext(ctx);vm.runInContext(queue,ctx);ctx.queueCards({state:s,pack:p});ctx.queueCards({state:s,pack:p});assert.equal(ctx.cards.length,2);ctx.cards[0]();assert.deepEqual(shown,[s.modules['story.recap'].days[0]]);
 assert.match(source,/replaceChildren\(\.\.\.r.lines.map/);assert.match(source,/\['recap-card','day-card','end-card','messages'\].*'close'/);
});
test('prompt recap is bounded even with long saved lines',()=>{const p=pack('prompt'),s=state();s.modules['story.recap'].days=[{day:1,lines:['Long memory. '.repeat(100)]}];assert.ok(recapContext(s,p).length<=240);});
