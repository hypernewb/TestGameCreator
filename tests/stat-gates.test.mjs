import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {interestGate,interestCue,desireReveal,gateText,validateStatGates} from '../public/stat-gates.mjs';
import {dating,datingEvaluation,changeChemistry} from '../packages/modules/dating.mjs';
import {changeTrust} from '../packages/modules/romance-stats.mjs';
import {journal} from '../public/campus.mjs';
import {validatePack,clone} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
const read=f=>JSON.parse(readFileSync(new URL(f,import.meta.url),'utf8')),campus=read('../packs/campus.json'),fantasy=read('../packs/template-fantasy-town.json');
const errs=p=>{const out=[];validateStatGates(p,m=>out.push(m));return out;};
const stats=(p,v)=>({modules:{'character.stats':{values:Object.fromEntries(Object.entries(v).map(([k,x])=>[`${p.playerId}--${k}`,x]))}}});
// A non-campus pack: one player stat, one NPC with a VN gate and discoverable turn-ons/offs.
const town=()=>{const p=clone(fantasy);p.modules['character.stats']='0.1.0';p.statDefinitions=[{id:'charm',name:'Charm',min:0,max:100,visibility:'player'}];p.initialStats=[{character:p.playerId,stat:'charm',value:0}];
 const ryn=p.actors.find(a=>a.id==='ryn');Object.assign(ryn,{interestGate:[{stat:'charm',min:30}],turnOns:['praise','moonlight','confidence'],turnOffs:['rudeness','cowardice'],desireReveal:{stat:'charm',hint:10,reveal:40}});return p;};

test('interest gate: closed below the stat, open at it; plain-language reason and narrator cue',()=>{
 const p=town();let g=interestGate(stats(p,{charm:12}),p,'ryn');assert.equal(g.open,false);assert.deepEqual(g.missing.map(m=>[m.label,m.min,m.value]),[['Charm',30,12]]);
 assert.equal(gateText(g.missing[0]),'your Charm reaches 30');assert.match(interestCue(stats(p,{charm:12}),p,'ryn'),/Not romantically interested in the player yet \(until the player's Charm reaches 30\).*turns down romantic or sexual advances/);
 assert.equal(interestGate(stats(p,{charm:30}),p,'ryn').open,true);assert.equal(interestCue(stats(p,{charm:30}),p,'ryn'),'');assert.equal(interestGate({},p,'player').open,true,'no rules, no gate');
 p.modules['social.bonds']='0.1.0';p.relationshipDimensions=[{id:'affection',name:'Affection'}];p.actors.find(a=>a.id==='ryn').interestGate.push({bond:'affection',min:5});
 const s=stats(p,{charm:40});s.modules['social.bonds']={values:{'ryn--affection--player':2}};g=interestGate(s,p,'ryn');assert.deepEqual(g.missing.map(m=>gateText(m)),['Affection reaches 5']);
});

test('desire reveal: hidden, then the first turn-on and turn-off, then everything',()=>{
 const p=town(),at=v=>desireReveal(stats(p,{charm:v}),p,'ryn');
 assert.deepEqual(at(0),{stage:'hidden',turnOns:[],turnOffs:[],hidden:5,next:{label:'Charm',min:10,value:0}});
 assert.deepEqual(at(15),{stage:'hint',turnOns:['praise'],turnOffs:['rudeness'],hidden:3,next:{label:'Charm',min:40,value:15}});
 assert.deepEqual(at(40),{stage:'revealed',turnOns:['praise','moonlight','confidence'],turnOffs:['rudeness','cowardice'],hidden:0,next:null});
 const q=town();delete q.actors.find(a=>a.id==='ryn').desireReveal;assert.equal(desireReveal({},q,'ryn'),null,'no setting: journal shows nothing new');
});

test('validation: one source, known stat or bond, enabled module, whole numbers, no player gate',()=>{
 const p=town();assert.deepEqual(errs(p),[]);assert.doesNotThrow(()=>validatePack(p,registry));
 const bad=town(),ryn=bad.actors.find(a=>a.id==='ryn');ryn.interestGate=[{stat:'charm',bond:'x',min:1},{stat:'nope',min:1},{stat:'charm',min:-1},{stat:'charm',min:1.5},{stat:'charm',min:1}];ryn.desireReveal={stat:'charm',hint:50,reveal:10};
 bad.actors.find(a=>a.id===bad.playerId).interestGate=[{stat:'charm',min:1}];const e=errs(bad).join('\n');
 for(const m of [/expected up to 4 rules/,/the player has no interest gate/,/hint <= reveal/])assert.match(e,m);
 ryn.interestGate=[{stat:'charm',bond:'x',min:1},{stat:'nope',min:1},{stat:'charm',min:-1}];assert.match(errs(bad).join('\n'),/exactly one of stat or bond[\s\S]*unknown stat nope[\s\S]*whole number 0-1000/);
 const off=town();delete off.modules['character.stats'];assert.match(errs(off).join('\n'),/need the character.stats module/);assert.throws(()=>validatePack(off,registry));
});

test('dating: a gated character is not eligible and says why until the stat is reached',()=>{
 const pack=clone(campus),c=pack.datingProfiles[0].character;pack.actors.find(a=>a.id===c).interestGate=[{stat:'charm',min:30}];
 const state={tick:0,flags:{},events:[],turns:{},actors:Object.fromEntries(pack.actors.map(a=>[a.id,{...a}])),modules:{[dating.id]:dating.init(pack),'social.relationships':{edges:{},rewarded:{}},'character.stats':{values:{}}}};
 const tx={state,pack,set(path,value){let o=state;for(const k of path.slice(0,-1))o=o[k]??={};o[path.at(-1)]=structuredClone(value);},emit(){}};changeChemistry(tx,c,100,'test');changeTrust(tx,c,100);
 let ev=datingEvaluation(state,pack,c);assert.ok(ev.reasons.includes('not interested until your Charm reaches 30'),ev.reasons.join('; '));assert.equal(ev.eligible,false);
 state.modules['character.stats'].values[`${pack.playerId}--charm`]=30;ev=datingEvaluation(state,pack,c);assert.ok(!ev.reasons.some(r=>/not interested until/.test(r)));
});

test('journal: gated cast get entries with what still blocks them and discovered turn-ons/offs',()=>{
 const p=town(),j=journal(stats(p,{charm:15}),p).find(x=>x.id==='ryn');assert.ok(j,'ryn has a journal entry without an act profile');
 assert.deepEqual(j.interest,['until your Charm reaches 30']);assert.equal(j.desires.stage,'hint');assert.ok(!journal(stats(p,{charm:15}),p).some(x=>x.id===p.playerId));
 const play=readFileSync(new URL('../public/play.mjs',import.meta.url),'utf8');assert.match(play,/Not interested in you yet/);assert.match(play,/more to discover/);
 assert.match(readFileSync(new URL('../packages/ai/context-budget.mjs',import.meta.url),'utf8'),/behaviorCue:\[behaviorCueOf\(a,phase\),interestCue\(world,pack,a\)\]/);
});

// Studio: the player card owns stats; NPC Love life folds own gates. Functions are pulled out of studio.mjs and run against a tiny DOM.
const source=readFileSync(new URL('../public/studio.mjs',import.meta.url),'utf8').split(String.fromCharCode(13,10)).join(String.fromCharCode(10)),fn=n=>{const i=source.indexOf(`function ${n}(`);assert.ok(i>=0,n);return source.slice(i,source.indexOf('\n',i));};
const node=(tag,text)=>{const n={tag,children:[],dataset:{},className:'',textContent:text||'',value:'',append(...k){n.children.push(...k);},closest:()=>null};return n;};
const all=n=>[n,...(n.children||[]).flatMap(all)];
test('Studio: player Stats fold adds stats; NPC gate rows and reveal setting edit the card',()=>{
 const msgs=[],mods=[],p=clone(fantasy),ryn=p.actors.find(a=>a.id==='ryn'),you=p.actors.find(a=>a.id===p.playerId);
 const field=(parent,obj,key,label,kind,choices)=>{const n=node(choices?'select':'input');n.dataset.key=key;n.choices=choices;n.value=obj[key]??'';n.oninput=()=>{obj[key]=kind==='number'?Number(n.value):n.value;};parent.append(n);return n;};
 const fold=(parent,obj,title)=>{const g=node('div');g.dataset.fold=title;parent.append(g);return g;};
 const names=['gateSources','addPlayerStat','removePlayerStat','statAdder','playerStats','gateSelect','interestGateEditor'],src=`const gateSources=${source.match(/const gateSources=(.*);\n/)[1]};\n${names.slice(1).map(fn).join('\n')}\nreturn {${names}};`;
 const S=new Function('node','field','fold','message','render','setModule',src)(node,field,fold,m=>msgs.push(m),()=>{},(id,on)=>{mods.push([id,on]);p.modules[id]='0.1.0';});
 // No stats yet: the NPC gate box offers to add one; adding enables character.stats with a player starting value
 let box=S.interestGateEditor(node('div'),p,ryn);assert.ok(all(box).some(n=>n.dataset.action==='add-stat'));assert.ok(!all(box).some(n=>n.dataset.action==='add-gate'));
 const st=S.playerStats(node('div'),p,you),inp=all(st).find(n=>n.tag==='input'&&!n.dataset.key);inp.value='Charm';all(st).find(n=>n.dataset.action==='add-stat').onclick();
 assert.deepEqual(mods,[['character.stats',true]]);assert.deepEqual(p.statDefinitions,[{id:'charm',name:'Charm',min:0,max:100,visibility:'player'}]);assert.deepEqual(p.initialStats,[{character:'player',stat:'charm',value:0}]);
 assert.equal(S.addPlayerStat(p,'Charm'),'charm-2');S.removePlayerStat(p,'charm-2');
 const rows=S.playerStats(node('div'),p,you),start=all(rows).find(n=>n.dataset.key==='value');start.value='25';start.oninput();assert.equal(p.initialStats[0].value,25);
 box=S.interestGateEditor(node('div'),p,ryn);all(box).find(n=>n.dataset.action==='add-gate').onclick();assert.deepEqual(ryn.interestGate,[{stat:'charm',min:20}]);
 box=S.interestGateEditor(node('div'),p,ryn);const sel=all(box).find(n=>n.dataset.key==='v');assert.deepEqual(sel.choices,[['stat:charm','Your Charm']]);
 const min=all(box).find(n=>n.dataset.key==='min');min.value='35';min.oninput();assert.equal(ryn.interestGate[0].min,35);
 const reveal=all(box).find(n=>n.dataset.field==='desireReveal');reveal.checked=true;reveal.onchange();assert.deepEqual(ryn.desireReveal,{stat:'charm',hint:10,reveal:30});
 assert.deepEqual(errs(p),[]);S.removePlayerStat(p,'charm');assert.equal(ryn.interestGate,undefined);assert.equal(ryn.desireReveal,undefined);
 // Wiring: player card shows Stats, NPC Love life shows gates
 assert.match(source,/fillBlanksButton\(g,p,o,'basics'\);if\(o\.id===p\.playerId\)playerStats\(g,p,o\);/);assert.match(source,/if\(o\.id!==p\.playerId\)interestGateEditor\(love,p,o\);/);
});
