import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {characterMessages,characterResponseFormat,normalizeCharacter} from '../packages/ai/character-authoring.mjs';
import {createWorld,execute,validatePack,clone} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {intimacyContext} from '../packages/modules/intimacy.mjs';
import {linesFor} from '../public/turn-presentation.mjs';
import {listsFor,SEX_SLIDERS} from '../public/card-presets.mjs';
const fantasy=JSON.parse(readFileSync(new URL('../packs/template-fantasy-town.json',import.meta.url),'utf8'));
const neutral=JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url),'utf8'));

test('character generation is erotic in any world, with no module gating',()=>{
 const p=clone(fantasy);p.modules={};const {messages,schema}=characterMessages(p,'a barmaid with a sharp tongue'),text=messages.map(m=>m.content).join('\n');
 for(const k of ['datingHistory','datingPreference','kinks','isVirgin','turnOns','turnOffs','inBed','afterSex','bodyTags','outfitSets','arousedTags'])assert.ok(schema.required.includes(k),k);
 assert.deepEqual(characterResponseFormat().json_schema.schema,schema);assert.deepEqual(schema.properties.outfitSets.required,['swim','sleep','underwear']);
 assert.match(text,/erotic dating sim/);assert.match(text,/LOVE LIFE/);assert.match(text,/IN BED/);assert.doesNotMatch(text,/no romance system/i);assert.ok(schema.properties.traits.items.enum.includes('Promiscuous'));
});

test('generated erotic fields normalize onto the card; the aroused face feeds the sprite expressions',()=>{
 const raw={name:'Wren Ash',pronouns:'she/her',age:24,appearance:'Freckled, red braid, apron.',personality:'Wren is blunt.',backstory:'Ran from a convent.',goal:'Buy the inn.',behavior:Object.fromEntries(['withStrangers','withFriends','withCrush','withLover','withEnemy'].map(k=>[k,'Wren grins.'])),turnOns:['being pinned','praise'],turnOffs:['cruelty'],inBed:'Loud, bossy.',afterSex:'Wants ale and talk.',bodyTags:['Wide Hips','freckles'],outfitSets:{swim:['shift'],sleep:[],underwear:['corset']},arousedTags:['blush','parted_lips']};
 const a=normalizeCharacter(raw,fantasy);
 assert.deepEqual([a.turnOns,a.turnOffs,a.inBed,a.afterSex],[['being pinned','praise'],['cruelty'],'Loud, bossy.','Wants ale and talk.']);
 assert.deepEqual(a.bodyTags,['wide_hips','freckles']);assert.deepEqual(a.outfitSets,{swim:['shift'],underwear:['corset']});assert.deepEqual(a.expressionTags,{aroused:['blush','parted_lips']});assert.equal(a.arousedTags,undefined);
});

const sexPack=scenes=>{const p=clone(neutral);Object.assign(p.modules,{'social.dating':'0.1.0','social.intimacy':'0.1.0','story.scenes':'0.1.0'});p.actors.find(x=>x.id==='player').age=22;p.actors.find(x=>x.id==='ada').age=25;
 p.datingProfiles=[{character:'ada',initialChemistry:55,initialPhase:'dating',initialAgreement:'casual',agreements:['casual'],thresholds:{crush:10,date:30,exclusive:60},preferences:[],signals:[]}];p.intimacySettings={difficulty:'normal',contentLevel:'explicit',privateLocations:['hub']};
 p.intimacyCategories=[{id:'fling',name:'Fling',privacy:'private',casual:true,requiresAgreement:['casual']}];p.intimacyProfiles=[{character:'ada',openness:75,casual:true,consentPolicy:'threshold',allowedCategories:['fling'],blockedCategories:[],cooldown:2,interests:[],scenes}];
 p.scriptedScenes=[{id:'ada-sex',title:'Ada',opening:'Ada pulls you down.',trigger:{event:'social.intimacyStarted',match:{character:'ada',category:'fling'}},choices:[{id:'go',label:'Go on',result:'Afterwards.',effects:[{type:'completeIntimacy',character:'ada',category:'fling',outcome:'positive'}]}]}];return p;};

test('per-character sex scenes: notes steer the narrator while active, the image shows on completion',()=>{
 const p=sexPack([{category:'fling',notes:'Against the bar after closing; she bites.',cg:'assets/cg/ada-fling.png'}]);validatePack(p,registry);
 let s=createWorld(p,registry,'test');const act=(type,args)=>{const r=execute(s,{id:`t${s.revision}`,actorId:p.playerId,type,args,expectedRevision:s.revision},p,registry);s=r.state;return r;};
 act('social.requestIntimacy',{character:'ada',category:'fling'});act('social.beginIntimacy',{character:'ada',category:'fling'});
 assert.equal(intimacyContext(s,p,'player')[0].sceneNotes,'Against the bar after closing; she bites.');assert.equal(intimacyContext(s,p,'bo')[0]?.sceneNotes,undefined);
 const r=act('story.choose',{scene:'ada-sex',choice:'go'}),done=r.turn.events.find(e=>e.type==='social.intimacyCompleted');assert.equal(done.payload.cg,'assets/cg/ada-fling.png');assert.equal(intimacyContext(s,p,'player')[0].sceneNotes,undefined);
 const lines=linesFor({state:{actors:{player:{location:'hub'}},modules:{'story.scenes':{}},turns:{t1:{id:'t1',command:{type:'story.choose',args:{}},sceneLines:[{speaker:'',text:'Afterwards.'}],events:[done]}}},pack:p});
 assert.deepEqual(lines.find(l=>l.cg),{speaker:'',text:done.payload.text,cg:'assets/cg/ada-fling.png'});
 for(const bad of [[{category:'nope'}],[{category:'fling',cg:'http://x/y.png'}],[{category:'fling',notes:'x'.repeat(2001)}]])assert.throws(()=>validatePack(sexPack(bad),registry),/sex scene/);
});

const source=readFileSync(new URL('../public/studio.mjs',import.meta.url),'utf8'),fn=name=>{const a=source.indexOf(`function ${name}(`),first=source.slice(a,source.indexOf('\n',a));return first.endsWith('}')?first:source.slice(a,source.indexOf('\n}\n',a)+2);};
test('Studio "Sex & body" fold: picker chips, sex-style sliders, body and wardrobe tags, aroused face, AI fill blanks; one click makes a character romanceable with sex scenes and images',()=>{
 const seen=[],box=()=>({children:[],dataset:{},append(...c){this.children.push(...c);}}),node=(tag,text)=>Object.assign(box(),{tag,textContent:text});let renders=0;
 const track=kind=>(parent,obj,key,label)=>{seen.push([kind,key,label,obj]);return {placeholder:''};};
 const blanks=[],f=new Function('node','fold','lines','field','hint','tagChips','imageUpload','render','message','openFolds','moduleCatalog','listsFor','pickChips','sliderRow','SEX_SLIDERS','fillBlanksButton','picks','comfyGen','comfyDeps',`${fn('enableRomanceFor')}\n${fn('eroticFold')}\nconst SEX_CATEGORIES=${source.match(/const SEX_CATEGORIES=(\[.*?\]);/)[1]};return {enableRomanceFor,eroticFold};`);
 const {enableRomanceFor,eroticFold}=f(node,(g,o,title)=>{seen.push(['fold',title]);return box();},track('lines'),track('field'),(i)=>i,track('tags'),track('image'),()=>renders++,()=>{},new Set(),{'social.dating':{version:'0.2.0'}},listsFor,(parent,obj,key,label,options,mode)=>{seen.push(['pick',key,label,obj,options,mode]);},(parent,obj,[key])=>{seen.push(['slider',key,'',obj]);},SEX_SLIDERS,(parent,p,o,part)=>blanks.push(part),(parent,p,obj,key,label,k,mode='list')=>{seen.push(['pick',key,label,obj,listsFor(p)[k],mode]);},(parent,p,slot)=>seen.push(['comfy',slot.key,slot.id,slot.obj]),()=>({}));
 const p={modules:{},actors:[{id:'wren'}]},o=p.actors[0];eroticFold(box(),p,o);
 assert.deepEqual(seen.filter(x=>x[0]!=='fold').map(x=>x[1]),['turnOns','turnOffs','leads','loud','rough','drive','experience','adventurous','inBed','afterSex','bodyTags','underwear','sleep','swim','aroused']);assert.equal(seen.find(x=>x[1]==='aroused')[3],o.expressionTags);assert.deepEqual(blanks,['sex']);
 assert.equal(seen.find(x=>x[1]==='leads')[3],o.sexStyle);assert.deepEqual(seen.filter(x=>x[0]==='pick').map(x=>x[5]),['list','list','text','tag','tag','tag','tag','tag']);assert.ok(seen.find(x=>x[1]==='turnOns')[4].length>=10);
 enableRomanceFor(p,'wren');enableRomanceFor(p,'wren');assert.equal(p.modules['social.dating'],'0.2.0');assert.equal(p.datingProfiles.length,1);assert.deepEqual(p.intimacyProfiles[0].allowedCategories,['first-night','fling']);assert.equal(p.intimacySettings.contentLevel,'explicit');
 seen.length=0;eroticFold(box(),p,o);const keys=seen.map(x=>x[1]);
 for(const k of ['initialChemistry','crush','date','exclusive','openness'])assert.ok(keys.includes(k),k);
 assert.deepEqual(seen.filter(x=>x[0]==='image').map(x=>[x[1],x[3].category]),[['cg','first-night'],['cg','fling']]);assert.deepEqual(p.intimacyProfiles[0].scenes.map(x=>x.category),['first-night','fling']);
});
