import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,validatePack} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {assemble} from '../packages/cards/world-assembly.mjs';
import {draftWorld} from '../packages/cards/world-draft.mjs';
import {proposalMessages,structureFromProposal,proposeWorld} from '../packages/cards/world-structure.mjs';

// M2 structure pass: the model proposes names and enum picks, code turns them into ids, exits, prices, yields and schedules.
const proposal=()=>({title:'Harbour Lights',premise:'You crew a ferry for one summer.',setting:'A small harbour town.',player:{name:'Sam',age:23},
 places:[{name:'Crew Bunk',kind:'home',about:'Your bunk.'},{name:'The Quay',kind:'outdoors',about:'Ropes and gulls.'},{name:'Salt Bar',kind:'bar',about:'Loud.'},{name:'Chandlery',kind:'shop',about:'Everything nautical.'},{name:'Lighthouse',kind:'public',about:'Tall.'}],
 items:[{name:'Rum',at:'Salt Bar',price:'cheap',drink:true},{name:'Brass Compass',at:'Chandlery',price:'pricey'},{name:'Tide Tables',at:'Chandlery',price:'mid'},{name:'Fish Paste',at:'Chandlery',price:'cheap'}],
 activities:[{name:'Haul ropes',at:'The Quay',gives:'fitness'},{name:'Bar shift',at:'Salt Bar',gives:'money'},{name:'Chart reading',at:'Lighthouse',gives:'focus',with:'Mara'},{name:'Card night',at:'Salt Bar',gives:'wit'}],
 weather:[{name:'Clear',text:'Blue sky.'},{name:'Fog',text:'You can barely see the bow.'},{name:'Squall',text:'Rain sideways.'}],
 heroines:[{name:'Mara',age:29,temperament:'guarded',pace:'slow',home:'Lighthouse',hangouts:['The Quay','Chandlery'],topic:'old maps',quirk:'ink stains',looks:'her eyes',loved:'Brass Compass',liked:'Tide Tables',disliked:'Fish Paste',buy:'Tide Tables',likes:['charts'],dislikes:['boasting','lateness'],wants:[{stat:'focus',level:'lots'}]},
  {name:'Zoë',age:24,temperament:'prickly',pace:'casual',home:'Crew Bunk',hangouts:['Salt Bar','Nowhere'],topic:'sea shanties',loved:'Silver Whistle',disliked:'Rum',wants:[{stat:'wit',level:'some'},{stat:'luck',level:'lots'}]}]});

test('a proposal becomes a spec the assembler accepts: code-owned ids, exits, prices, yields and schedules',()=>{
 const {spec,notes}=structureFromProposal(proposal()),{pack,missing}=assemble(spec);validatePack(pack,registry);assert.ok(createWorld(pack,registry,'s').actors.mara);
 assert.deepEqual(spec.heroines.map(h=>h.id),['mara','zoe']);assert.equal(spec.player.location,'crew-bunk');assert.ok(missing.includes('heroines.mara.rungs.talk.title'));assert.ok(!missing.includes('project.premise'));
 const it=Object.fromEntries(spec.world.items.map(i=>[i.id,i]));assert.equal(it.rum.price,5);assert.equal(it['brass-compass'].price,40);assert.equal(it['brass-compass'].owner,'chandlery');assert.deepEqual(spec.world.sobriety.drinkItems,['rum']);
 const a=Object.fromEntries(spec.world.activities.map(x=>[x.id,x]));assert.deepEqual(a['chart-reading'].effects,[{type:'stat',stat:'focus',delta:1},{type:'trust',character:'mara',delta:2}]);assert.equal(a['chart-reading'].perDay,1);
 assert.deepEqual(a['bar-shift'].effects,[{type:'money',delta:30}]);assert.deepEqual(a['haul-ropes'].effects,[{type:'stat',stat:'fitness',delta:2}]);assert.deepEqual(spec.heroines[0].activities,['chart-reading']);
 assert.deepEqual(spec.world.schedules[0].stops,[{at:0,location:'lighthouse'},{at:4,location:'the-quay'},{at:8,location:'chandlery'}]);
 const ids=new Set(spec.world.locations.map(l=>l.id));for(const l of spec.world.locations){assert.ok(l.exits.length);assert.ok(l.exits.every(e=>ids.has(e.to)&&e.to!==l.id));}
 const back=l=>spec.world.locations.find(x=>x.id===l);for(const l of spec.world.locations)for(const e of l.exits)assert.ok(back(e.to).exits.some(x=>x.to===l.id),`${l.id}->${e.to} is two-way`);
 assert.deepEqual(spec.heroines[0].wants,[{id:'focus',stat:'focus',min:8}]);assert.deepEqual(spec.heroines[1].wants,[{id:'wit',stat:'wit',min:5}],'unknown stats are dropped');
 assert.ok(notes.some(n=>/Silver Whistle/.test(n)));assert.ok(it['silver-whistle']);assert.ok(notes.some(n=>/Nowhere/.test(n)));
 const colon=structureFromProposal({...proposal(),title:'Jale: The Mana Cull',places:[{name:'Gate @ Dusk: North',kind:'home'},...proposal().places.slice(1)]}).spec;
 assert.equal(colon.id,'jale-the-mana-cull','titles with a colon still give a valid pack id');assert.equal(colon.world.locations[0].id,'gate-dusk-north');validatePack(assemble(colon).pack,registry);
});

test('the age rule, temperament and pace are enforced; the player defaults to an adult',()=>{
 const p=proposal();p.heroines[0].age=17;assert.throws(()=>structureFromProposal(p),/18 or more/);
 const q=proposal();delete q.heroines[1].age;assert.throws(()=>structureFromProposal(q),/18 or more/);
 const r=proposal();r.heroines[0].temperament='sultry';assert.throws(()=>structureFromProposal(r),/temperament/);
 const s=proposal();s.player.age=16;const {spec,notes}=structureFromProposal(s);assert.equal(spec.player.age,21);assert.ok(notes.length);
 const t=proposal();t.activities=t.activities.filter(x=>x.gives!=='money');assert.ok(structureFromProposal(t).spec.world.activities.some(a=>a.effects.some(e=>e.type==='money')),'there is always a paid job');
});

test('proposeWorld prompts for the shape, then the draft pass finishes a playable world',async()=>{
 const m=proposalMessages('A ferry crew summer',{heroines:2});assert.match(m[0].content,/18\+/);assert.match(m[1].content,/torn:/);assert.match(m[1].content,/2 love interests/);
 const r=await proposeWorld('A ferry crew summer',{complete:async()=>'Here you go: '+JSON.stringify(proposal())});assert.equal(r.proposal.title,'Harbour Lights');
 const asked=x=>[...x.at(-1).content.matchAll(/^"([^"]+)":/gm)].map(y=>y[1]);
 const prompts=[],{pack,missing}=await draftWorld(r.spec,{complete:async x=>{prompts.push(x.at(-1).content);return JSON.stringify(Object.fromEntries(asked(x).map(p=>[p,`text ${p}`])));}});
 assert.deepEqual(missing,[]);validatePack(pack,registry);assert.equal(pack.scriptedScenes.length,assemble(r.spec).pack.scriptedScenes.length);
 // M3: every new world gets the director library; its text is drafted in director:<kind> batches, after the heroines, with {lead}/{rival} kept literal.
 assert.equal(r.spec.director.tone,'soap');assert.equal(pack.directorProfile.toneCeiling,'soap');assert.ok(pack.scriptedScenes.some(s=>s.template?.id==='saw-you'),'two heroines cast the rival beats');
 const d=prompts.filter(p=>/"director\.beats\./.test(p));assert.ok(d.length>=4&&d.every(p=>/write \{lead\} and \{rival\} literally/.test(p)));assert.ok(prompts.indexOf(d[0])>prompts.findLastIndex(p=>/"heroines\./.test(p)));
 assert.ok(!pack.scriptedScenes.some(s=>/\{(lead|rival)\}/.test(JSON.stringify(s))),'names are baked in');
});

test('M5 creator mapping: every drafted activity gets the widget of the stat it trains, and each heroine has four reaction slots to draft',async()=>{
 const {gameOf,GAMES}=await import('../packages/modules/minigames.mjs'),{spec}=structureFromProposal(proposal()),{pack,missing}=assemble(spec);
 const want=a=>GAMES[(a.effects||[]).find(e=>e.type==='stat'&&GAMES[e.stat])?.stat];
 for(const a of pack.activities){assert.ok(Object.values(GAMES).includes(gameOf(a)),a.id);if(want(a))assert.equal(gameOf(a),want(a),a.id);}
 const byName=n=>pack.activities.find(a=>a.name===n);assert.equal(gameOf(byName('Haul ropes')),'timing');assert.equal(gameOf(byName('Chart reading')),'memory');assert.equal(gameOf(byName('Card night')),'quiz');
 for(const h of ['mara','zoe'])for(const r of ['skip','ok','good','great'])assert.ok(missing.includes(`heroines.${h}.actor.reactions.${r}`),`${h} ${r}`);
 assert.equal(gameOf(byName('Bar shift')),'rhythm');const q=proposal();q.activities=q.activities.filter(a=>a.gives!=='money');assert.equal(gameOf(assemble(structureFromProposal(q).spec).pack.activities.find(a=>a.name==='Odd job')),'rhythm');
});

test('a blank love interest names itself in the error and says how to fix it',()=>{
 const p=proposal();p.heroines.push({name:'',age:21,temperament:'torn',pace:'steady',topic:'',wants:[]});
 assert.throws(()=>structureFromProposal(p),/A love interest: needs a topic \(or remove this blank love interest\)/);
});
