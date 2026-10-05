import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {deflateSync} from 'node:zlib';
import {buildContentPackage,reviewContentPackage,applyContentPackage,PACKAGE_FORMAT} from '../packages/cards/content-package.mjs';
import {validatePack} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';

// A structural 1024×1536 transparent PNG (all-zero pixels); passes validateImage's character-art structure.
const png=()=>{const chunk=(name,data)=>{const out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);out.write(name,4);data.copy(out,8);let c=0xffffffff;for(const b of out.subarray(4,-4)){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}out.writeUInt32BE((c^0xffffffff)>>>0,out.length-4);return out;},header=Buffer.alloc(13);header.writeUInt32BE(1024);header.writeUInt32BE(1536,4);header[8]=8;header[9]=6;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(Buffer.alloc((1024*4+1)*1536))),chunk('IEND',Buffer.alloc(0))]);};
const MEDIA=`scenario-media/${randomUUID()}.png`,copy=x=>structuredClone(x);
const basePack=over=>({schemaVersion:1,id:'t.'+(over?.id||'src'),version:'0.1.0',title:'Test world',playerId:'player',modules:{'social.conversation':'0.1.0','story.scenes':'0.1.0','social.relationships':'0.1.0','social.dating':'0.1.0'},storyVariables:[{id:'met-ada',name:'Met Ada',initial:false}],locations:[{id:'room',name:'Room',exits:[{to:'cafe'}]},{id:'cafe',name:'Café',exits:[{to:'room'}],futureField:{kept:true}}],actors:[{id:'player',name:'You',location:'room'},{id:'ada',name:'Ada',location:'cafe',portrait:MEDIA,customExtra:{unknown:true}}],datingProfiles:[{character:'ada',thresholds:{crush:20,date:40,exclusive:60},preferences:[{id:'ada-likes-tea',type:'flag',flag:'met-ada',weight:10,visibility:'discoverable'}],eligibility:{requiredFlags:['met-ada']}}],scriptedScenes:[{id:'meet-ada',title:'Meet Ada',opening:'Ada waves.',trigger:{event:'core.moved',match:{to:'cafe'}},when:{present:['ada'],location:'cafe'},pages:[{text:'Hi',speaker:'ada',stage:['show:ada']}],choices:[{id:'chat',label:'Chat',when:{charactersAt:{ada:'cafe'}},effects:[{type:'trust',character:'ada',delta:5},{type:'flag',id:'met-ada',value:true}]},{id:'leave',label:'Leave'}]}],lorebook:[{id:'ada-tea',text:'Ada loves tea.',scope:'character',character:'ada',knownBy:['ada']}],...over});
const destPack=over=>({...basePack({id:'dst',scriptedScenes:[],lorebook:[],datingProfiles:[]}),title:'Destination',actors:[{id:'player',name:'You',location:'room'}],locations:[{id:'start',name:'Start',exits:[]}],...over});
const SELECTION={actors:['ada'],locations:['cafe'],scriptedScenes:['meet-ada'],worldEvents:[]};
const mediaMap=()=>({[MEDIA]:{mime:'image/png',data:png().toString('base64')}});
const review=(pkg,dest)=>reviewContentPackage(pkg,dest);
const applied=(pkg,dest,opts)=>applyContentPackage(pkg,dest,opts);

test('round trip: export, review, apply into an empty project validates and preserves records, refs, media and unknown fields',()=>{
 const src=basePack(),pkg=buildContentPackage(src,SELECTION,{read:()=>png(),name:'Ada pack'});
 assert.equal(pkg.format,PACKAGE_FORMAT);assert.equal(pkg.manifest.selected.actors[0],'ada');
 const dest=destPack(),topLevel={destCustom:{keep:1}};Object.assign(dest,topLevel);
 const result=applied(pkg,dest,{mediaRemap:{[MEDIA]:'scenario-media/11111111-1111-4111-8111-111111111111.png'}});
 assert.ok(result.applied.actors.includes('ada')&&result.applied.locations.includes('cafe')&&result.applied.scriptedScenes.includes('meet-ada'));
 assert.equal(result.applied.profiles,1);assert.equal(result.applied.lorebook,1);
 const pack=result.pack;assert.equal(pack.actors.find(a=>a.id==='ada').portrait,'scenario-media/11111111-1111-4111-8111-111111111111.png');
 assert.deepEqual(pack.destCustom,topLevel.destCustom);assert.deepEqual(pack.actors.find(a=>a.id==='ada').customExtra,{unknown:true});
 assert.deepEqual(pack.locations.find(l=>l.id==='cafe').futureField,{kept:true});
 assert.equal(pack.datingProfiles[0].character,'ada');assert.equal(pack.lorebook[0].character,'ada');
 assert.deepEqual(pack.actors.find(a=>a.id==='player'),{id:'player',name:'You',location:'room'});
 validatePack(pack,registry);
});

test('dependency closure: an unselected character referenced by an imported scene is included, not unresolved',()=>{
 const src=basePack({actors:[{id:'player',name:'You',location:'room'},{id:'ada',name:'Ada',location:'cafe'},{id:'bea',name:'Bea',location:'room'}],scriptedScenes:[{id:'party',title:'Party',opening:'All here.',trigger:{event:'core.inspected'},pages:[{text:'Both',speaker:'ada'},{text:'Bea too',speaker:'bea'}],choices:[{id:'end',label:'End'}]}]});
 const pkg=buildContentPackage(src,{actors:['ada'],locations:[],scriptedScenes:['party'],worldEvents:[]},{read:()=>png()});
 assert.deepEqual(pkg.manifest.selected,{actors:['ada'],locations:[],scriptedScenes:['party'],worldEvents:[]});
 assert.ok(pkg.manifest.included.actors.includes('bea')&&pkg.content.actors.some(a=>a.id==='bea'));
 const r=review(pkg,destPack());
 assert.equal(r.ok,true);assert.ok(r.included.actors.includes('bea'));
});

test('collisions: remap mints ada-2 and rewrites every supported reference; skip keeps the destination character untouched',()=>{
 const src=basePack(),pkg=buildContentPackage(src,SELECTION,{read:()=>png()});
 const dest=destPack({actors:[{id:'player',name:'You',location:'start'},{id:'ada',name:'The other Ada',location:'start',portrait:MEDIA}],datingProfiles:[{character:'ada',thresholds:{crush:20,date:40,exclusive:60},preferences:[{id:'other',type:'trait',trait:'quiet',weight:5,visibility:'public'}]}],lorebook:[{id:'dst-lore',text:'Destination lore',scope:'character',character:'ada',knownBy:['ada']}]}),before=copy(dest);
 const r=review(pkg,dest);assert.equal(r.collisions.actors.ada,'remap');assert.equal(r.collisions.locations.cafe,undefined);
 const {pack,remap,applied:stats}=applied(pkg,dest,{mediaRemap:{[MEDIA]:'scenario-media/22222222-2222-4222-8222-222222222222.png'}});
 assert.equal(remap.actors.ada,'ada-2');assert.deepEqual(stats.actors,['ada-2']);assert.deepEqual(stats.locations,['cafe','room']);
 const fresh=pack.actors.find(a=>a.id==='ada-2');
 assert.equal(fresh.name,'Ada');assert.equal(fresh.location,'cafe');
 assert.equal(pack.scriptedScenes.find(s=>s.id==='meet-ada').choices[0].effects.find(e=>e.type==='trust').character,'ada-2');
 assert.deepEqual(pack.scriptedScenes.find(s=>s.id==='meet-ada').when.present,['ada-2']);
 assert.deepEqual(pack.scriptedScenes.find(s=>s.id==='meet-ada').choices[0].when.charactersAt,{'ada-2':'cafe'});
 assert.equal(pack.datingProfiles.at(-1).character,'ada-2');assert.equal(pack.lorebook.at(-1).character,'ada-2');assert.deepEqual(pack.lorebook.at(-1).knownBy,['ada-2']);
 assert.equal(pack.actors.find(a=>a.id==='ada').name,'The other Ada');assert.deepEqual(pack.datingProfiles[0].character,'ada');
 validatePack(pack,registry);
 const skipped=applied(pkg,before,{choices:{actors:{ada:'skip'}},mediaRemap:{[MEDIA]:'scenario-media/22222222-2222-4222-8222-222222222222.png'}});
 assert.equal(skipped.applied.actors.includes('ada-2'),false);assert.deepEqual(skipped.pack.actors.find(a=>a.id==='ada'),before.actors.find(a=>a.id==='ada'));
 assert.equal(skipped.pack.scriptedScenes.find(s=>s.id==='meet-ada').choices[0].effects.find(e=>e.type==='trust').character,'ada');
 assert.equal(skipped.applied.profiles,0);validatePack(skipped.pack,registry);
});

test('missing media and unresolved references block the import with exact diagnostics and no mutation',()=>{
 const src=basePack(),pkg=buildContentPackage(src,SELECTION,{read:()=>png()});
 const noMedia={...pkg,media:{}},r=review(noMedia,destPack());
 assert.equal(r.ok,false);assert.match(r.errors[0],/media is missing for: scenario-media\//);
 assert.throws(()=>applied(noMedia,destPack(),{}),/media is missing/);
 const broken=copy(pkg);broken.content.scriptedScenes[0].choices[0].check={stat:'charm',target:5,fail:{result:'No.'}};
 const rb=review(broken,destPack());
 assert.equal(rb.ok,false);assert.match(rb.errors.join('\n'),/references stat 'charm'/);
 assert.throws(()=>applied(broken,destPack(),{}),/references stat 'charm'/);
 const unresolvedItem=copy(pkg);unresolvedItem.content.scriptedScenes[0].choices[0].effects.push({type:'item',id:'necklace',to:'player'});
 assert.match(review(unresolvedItem,destPack()).errors.join('\n'),/references item 'necklace'/);
 const dest=destPack();const snapshot=copy(dest);
 assert.throws(()=>applied(broken,dest,{}));
 assert.deepEqual(dest,snapshot);
});

test('malformed manifests are rejected: format, version, selection/content mismatch and undeclared records',()=>{
 const pkg=buildContentPackage(basePack(),SELECTION,{read:()=>png()});
 assert.match(reviewContentPackage({...pkg,format:'other'},destPack()).errors[0],/format/);
 assert.match(reviewContentPackage({...pkg,version:2},destPack()).errors[0],/version/);
 const missing=copy(pkg);missing.manifest.selected.scriptedScenes=['ghost'];
 assert.match(reviewContentPackage(missing,destPack()).errors.join('\n'),/ghost/);
 const extra=copy(pkg);extra.content.actors.push({id:'sneaky',name:'S',location:'cafe'});
 assert.match(reviewContentPackage(extra,destPack()).errors.join('\n'),/manifest does not declare/);
 assert.match(reviewContentPackage({...pkg,manifest:{...pkg.manifest,selected:{...pkg.manifest.selected,actors:['nope']}}},destPack()).errors.join('\n'),/nope/);
});

test('repeated imports remap again and never overwrite previously imported or destination content',()=>{
 const pkg=buildContentPackage(basePack(),SELECTION,{read:()=>png()}),dest=destPack();
 const first=applied(pkg,dest,{mediaRemap:{[MEDIA]:'scenario-media/33333333-3333-4333-8333-333333333333.png'}});
 assert.deepEqual(first.applied.actors,['ada']);
 const second=applied(pkg,first.pack,{mediaRemap:{[MEDIA]:'scenario-media/44444444-4444-4444-8444-444444444444.png'}});
 assert.equal(second.applied.actors[0],'ada-2'); // ada already exists; nothing was overwritten
 assert.equal(second.pack.actors.filter(a=>a.name==='Ada').length,2);
 assert.ok(second.pack.actors.find(a=>a.id==='ada')&&second.pack.actors.find(a=>a.id==='ada-2'));
 validatePack(second.pack,registry);
});

test('extension fields and unrelated destination data survive export and import untouched',()=>{
 const src=basePack({items:[{id:'ring',name:'Ring',shop:'cafe'}],vendorCustom:'untouched'}),pkg=buildContentPackage(src,SELECTION,{read:()=>png()});
 assert.equal(pkg.content.actors.find(a=>a.id==='ada').customExtra.customExtra,undefined);
 const dest=destPack({items:[{id:'key',name:'Key',shop:'start'}],vendorCustom:'untouched',worldEvents:[{id:'dst-event',name:'Local event',description:'Stays',startDay:1,endDay:2}]});
 const {pack}=applied(pkg,dest,{mediaRemap:{[MEDIA]:'scenario-media/55555555-5555-4555-8555-555555555555.png'}});
 assert.equal(pack.vendorCustom,'untouched');assert.deepEqual(pack.items,dest.items);
 assert.deepEqual(pack.worldEvents,dest.worldEvents);
 assert.equal(pack.actors.find(a=>a.id==='ada').customExtra&&typeof pack.actors.find(a=>a.id==='ada').customExtra,'object');
 validatePack(pack,registry);
});

test('scenes cannot be imported while story.scenes is disabled in the destination',()=>{
 const pkg=buildContentPackage(basePack(),SELECTION,{read:()=>png()}),dest=destPack();
 delete dest.modules['story.scenes'];
 const r=review(pkg,dest);assert.equal(r.ok,false);assert.match(r.errors[0],/Scripted scenes disabled/);
 assert.throws(()=>applied(pkg,dest,{}),/Scripted scenes disabled/);
});
