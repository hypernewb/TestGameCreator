// Content packages: move selected characters, locations and events between projects without copying the whole game.
// Pure functions; the caller supplies media bytes on export (`read`) and uploads them on import. The same walker
// drives review (empty maps → refs collected, records untouched) and apply (maps rewrite), so preview and apply agree.
// Unknown fields are never touched: validation after apply (validateProjectMedia + validatePack) is the safety net.
import {assert,safeKey} from '../core/engine.mjs';
import {validateImage} from '../assets/project-media.mjs';
import {slug} from './character-card.mjs';
import {createHash,randomUUID} from 'node:crypto';
import {openSync,closeSync,writeFileSync,readFileSync,renameSync,rmSync} from 'node:fs';

export const PACKAGE_FORMAT='story-framework-content-package',PACKAGE_VERSION=1;
const TYPES=['actors','locations','scriptedScenes','worldEvents'],DEST_TYPES=[...TYPES,'items','objects','quests','abilities'];
// Per-character module rows that travel with an exported character; a character without these is hollow.
const PROFILE_KEYS=['datingProfiles','actProfiles','romanceTempoProfiles','intimacyProfiles','jealousyProfiles','suspicionProfiles','characterSheets'];
const MATCH_ACTOR=['actor','target','character','a','b'],MATCH_LOCATION=['from','to','location'];
const unique=(base,taken)=>{let id=base,n=2;while(taken.has(id))id=`${base}-${n++}`;return id;};
const mintId=(record,taken)=>{const base=(slug(record.name||'')||record.id||'record').replaceAll('--','-').replace(/[^a-zA-Z0-9._-]/g,'');return unique(safeKey(base)?base:'record',taken);};
const one=v=>Array.isArray(v)?v:[v];
const ownerOf=(row,type)=>row[type==='characterSheets'?'actorId':'character'];

// Every reference the rewrite table knows. `r` returns the remapped id (or the id itself), collecting refs for review.
const refWalker=(maps,refs)=>{
 const r=(path,kind,id)=>{refs?.push({path:String(path).slice(0,160),kind,id});const to=kind==='holder'?(maps.actor?.[id]??maps.location?.[id]):maps[kind]?.[id];return to!==undefined?to:id;};
 const keys=(path,kind,object)=>Object.fromEntries(Object.entries(object||{}).map(([k,v])=>[r(`${path}.${k}`,kind,k),v]));
 const stage=(path,raw)=>{const at=raw.indexOf(':');if(at<1)return raw;const verb=raw.slice(0,at),rest=raw.slice(at+1);if(verb==='show'||verb==='hide')return `${verb}:${r(path,'actor',rest)}`;if(verb==='sprite'){const comma=rest.indexOf(',');if(comma<0)return raw;return `${verb}:${r(path,'actor',rest.slice(0,comma).trim())},${rest.slice(comma+1).trim()}`;}return raw;};
 const when=(path,w)=>{if(!w||typeof w!=='object')return w;if(w.location!==undefined)w.location=r(`${path}.location`,'location',w.location);if(w.charactersAt)w.charactersAt=Object.fromEntries(Object.entries(w.charactersAt).map(([k,v])=>[r(`${path}.charactersAt.${k}`,'actor',k),r(`${path}.charactersAt.${k}`,'location',v)]));if(w.present)w.present=w.present.map((x,i)=>r(`${path}.present.${i}`,'actor',x));if(w.attention)w.attention=keys(`${path}.attention`,'actor',w.attention);if(w.trust)w.trust=keys(`${path}.trust`,'actor',w.trust);if(w.completedScenes)w.completedScenes=w.completedScenes.map((x,i)=>r(`${path}.completedScenes.${i}`,'scene',x));if(w.flags)w.flags=keys(`${path}.flags`,'flag',w.flags);if(w.items)w.items=w.items.map((x,i)=>r(`${path}.items.${i}`,'item',x));if(w.equipped)w.equipped=w.equipped.map((x,i)=>r(`${path}.equipped.${i}`,'item',x));if(w.weather!==undefined)w.weather=r(`${path}.weather`,'weather',w.weather);for(const bond of w.bonds||[]){if(bond.character!==undefined)bond.character=r(`${path}.bonds.character`,'actor',bond.character);if(bond.dimension!==undefined)bond.dimension=r(`${path}.bonds.dimension`,'dimension',bond.dimension);}for(const s of w.stats||[]){if(s.character!==undefined)s.character=r(`${path}.stats.character`,'actor',s.character);if(s.stat!==undefined)s.stat=r(`${path}.stats.stat`,'stat',s.stat);}if(w.relationshipStates)w.relationshipStates=Object.fromEntries(Object.entries(w.relationshipStates).map(([k,v])=>[r(`${path}.relationshipStates.${k}`,'actor',k),r(`${path}.relationshipStates.${k}`,'state',v)]));if(w.datingPhases)w.datingPhases=keys(`${path}.datingPhases`,'actor',w.datingPhases);return w;};
 const match=(path,m)=>m?Object.fromEntries(Object.entries(m).map(([k,v])=>[k,MATCH_ACTOR.includes(k)?r(`${path}.${k}`,'actor',v):MATCH_LOCATION.includes(k)?r(`${path}.${k}`,'location',v):v])):m;
 const effects=(path,list)=>(list||[]).forEach((effect,i)=>{if(effect.character!==undefined)effect.character=r(`${path}.effects.${i}.character`,'actor',effect.character);const at=`${path}.effects.${i}`;if(effect.type==='flag'&&effect.id!==undefined)effect.id=r(`${at}.id`,'flag',effect.id);else if(effect.type==='item'){if(effect.id!==undefined)effect.id=r(`${at}.id`,'item',effect.id);if(effect.to!==undefined)effect.to=r(`${at}.to`,'holder',effect.to);}else if(effect.type==='stat'){if(effect.stat!==undefined)effect.stat=r(`${at}.stat`,'stat',effect.stat);}else if(effect.type==='npcAttraction'){effect.from=r(`${at}.from`,'actor',effect.from);effect.to=r(`${at}.to`,'actor',effect.to);}else if(effect.type==='npcRelationship'){effect.a=r(`${at}.a`,'actor',effect.a);effect.b=r(`${at}.b`,'actor',effect.b);}else if(['revealRivalry','resolveRivalry'].includes(effect.type)&&effect.id!==undefined)r(`${at}.id`,'free',effect.id);else if(effect.type==='bond'&&effect.dimension!==undefined)effect.dimension=r(`${at}.dimension`,'dimension',effect.dimension);else if(effect.type==='relationshipState'&&effect.to!==undefined)effect.to=r(`${at}.to`,'state',effect.to);else if(effect.type==='discoverPreference'&&effect.preference!==undefined)effect.preference=r(`${at}.preference`,'preference',effect.preference);else if(['intimacyConsent','completeIntimacy'].includes(effect.type)&&effect.category!==undefined)effect.category=r(`${at}.category`,'category',effect.category);else if(effect.type==='romanceRank'&&effect.to!==undefined)effect.to=r(`${at}.to`,'rank',effect.to);});
 const choice=(path,choice)=>{if(choice.when)when(`${path}.when`,choice.when);effects(`${path}`,choice.effects);if(choice.waitFor?.match)choice.waitFor.match=match(`${path}.waitFor.match`,choice.waitFor.match);if(choice.check){if(choice.check.stat!==undefined)choice.check.stat=r(`${path}.check.stat`,'stat',choice.check.stat);for(const m of choice.check.modifiers||[])if(m.when)when(`${path}.check.modifiers.when`,m.when);effects(`${path}.check.fail`,choice.check.fail?.effects);}};
 const pages=(path,pages)=>(pages||[]).forEach((page,i)=>{if(page.speaker!==undefined&&page.speaker!=='')page.speaker=r(`${path}.pages.${i}.speaker`,'actor',page.speaker);if(page.cg)page.cg=r(`${path}.pages.${i}.cg`,'media',page.cg);if(page.background)page.background=r(`${path}.pages.${i}.background`,'media',page.background);if(page.stage)page.stage=page.stage.map((raw,j)=>typeof raw==='string'?stage(`${path}.pages.${i}.stage.${j}`,raw):raw);});
 const segment=(path,segment)=>{pages(path,segment.pages);if(segment.cg)segment.cg=r(`${path}.cg`,'media',segment.cg);if(segment.background)segment.background=r(`${path}.background`,'media',segment.background);if(segment.stage)segment.stage=segment.stage.map((raw,j)=>typeof raw==='string'?stage(`${path}.stage.${j}`,raw):raw);for(const option of segment.choices||[])choice(`${path}.choices.${option.id}`,option);};
 const record=(type,record)=>{
  if(type==='actors'){if(record.location!==undefined)record.location=r(`${record.id}.location`,'location',record.location);for(const key of ['portrait','idleAnimation','idleStill'])if(record[key])record[key]=r(`${record.id}.${key}`,'media',record[key]);for(const pose of record.poses||[])if(pose.image!==undefined)pose.image=r(`${record.id}.poses.${pose.id}.image`,'media',pose.image);}
  else if(type==='locations'){if(record.background)record.background=r(`${record.id}.background`,'media',record.background);for(const [i,exit] of (record.exits||[]).entries()){exit.to=r(`${record.id}.exits.${i}.to`,'location',exit.to);if(exit.flag!==undefined)r(`${record.id}.exits.${i}.flag`,'flag',exit.flag);}}
  else if(type==='scriptedScenes'){if(record.trigger?.match)record.trigger.match=match(`${record.id}.trigger.match`,record.trigger.match);if(record.when)when(`${record.id}.when`,record.when);segment(`${record.id}`,record);for(const beat of record.beats||[])segment(`${record.id}.${beat.id}`,beat);}
  else if(type==='worldEvents'&&record.location!==undefined)record.location=r(`${record.id}.location`,'location',record.location);
 };
 return {r,record,profile:(type,row)=>{const at=`${type}.${ownerOf(row,type)}`,owner=type==='characterSheets'?'actorId':'character';if(row[owner]!==undefined)row[owner]=r(`${at}.${owner}`,'actor',row[owner]);
  if(type==='datingProfiles'){for(const flag of one(row.eligibility?.requiredFlags||[]))r(`${at}.requiredFlags`,'flag',flag);for(const flag of one(row.eligibility?.forbiddenFlags||[]))r(`${at}.forbiddenFlags`,'flag',flag);for(const [i,preference] of (row.preferences||[]).entries()){if(preference.stat!==undefined)preference.stat=r(`${at}.preferences.${i}.stat`,'stat',preference.stat);if(preference.bond!==undefined)preference.bond=r(`${at}.preferences.${i}.bond`,'dimension',preference.bond);if(preference.flag!==undefined)preference.flag=r(`${at}.preferences.${i}.flag`,'flag',preference.flag);}for(const [i,gate] of (row.agreementGates||[]).entries()){if(gate.minRank!==undefined)gate.minRank=r(`${at}.agreementGates.${i}.minRank`,'rank',gate.minRank);if(gate.requiredScene!==undefined)gate.requiredScene=r(`${at}.agreementGates.${i}.requiredScene`,'scene',gate.requiredScene);}}
  if(type==='romanceTempoProfiles')for(const [i,rank] of (row.ranks||[]).entries()){if(rank.scene!==undefined)rank.scene=r(`${at}.ranks.${i}.scene`,'scene',rank.scene);for(const gift of rank.gifts?.preferences||[])if(gift.item!==undefined)gift.item=r(`${at}.ranks.${i}.gifts.item`,'item',gift.item);}
  if(type==='intimacyProfiles'){for(const key of ['allowedCategories','blockedCategories'])row[key]=(row[key]||[]).map((x,i)=>r(`${at}.${key}.${i}`,'category',x));for(const [i,interest] of (row.interests||[]).entries())if(interest.category!==undefined)interest.category=r(`${at}.interests.${i}.category`,'category',interest.category);}
  if(type==='actProfiles')for(const [i,clue] of (row.likeClues||[]).entries())if(clue.character!==undefined)clue.character=r(`${at}.likeClues.${i}.character`,'actor',clue.character);
  if(type==='characterSheets'){for(const key of ['home','workplace'])if(row.identity?.[key])row.identity[key]=r(`${at}.identity.${key}`,'location',row.identity[key]);if(row.identity?.haunts)row.identity.haunts=row.identity.haunts.map((id,i)=>r(`${at}.identity.haunts.${i}`,'location',id));for(const key of ['weekly','exceptions'])for(const [i,slot] of (row.routine?.[key]||[]).entries())if(slot.location!==undefined)slot.location=r(`${at}.routine.${key}.${i}.location`,'location',slot.location);if(row.appearance?.portrait)row.appearance.portrait=r(`${at}.appearance.portrait`,'media',row.appearance.portrait);for(const [i,pose] of (row.appearance?.poses||[]).entries())if(pose.image)pose.image=r(`${at}.appearance.poses.${i}.image`,'media',pose.image);if(row.source?.actor){record('actors',row.source.actor);if(row.source.actor.id!==undefined)row.source.actor.id=r(`${at}.source.actor.id`,'actor',row.source.actor.id);}for(const key of ['schedules','scheduleExceptions'])for(const slot of row.source?.profiles?.[key]||[]){for(const field of ['actor','character'])if(slot[field]!==undefined)slot[field]=r(`${at}.source.profiles.${key}.${field}`,'actor',slot[field]);for(const part of key==='schedules'?slot.weekly||[]:[slot])if(part.location!==undefined)part.location=r(`${at}.source.profiles.${key}.location`,'location',part.location);}for(const item of row.tastes?.itemOverrides||[])if(item.item!==undefined)item.item=r(`${at}.tastes.itemOverrides.item`,'item',item.item);for(const key of ['tracks','payoffs'])for(const entry of row.arc?.[key]||[])if(entry.character!==undefined)entry.character=r(`${at}.arc.${key}.character`,'actor',entry.character);for(const entry of row.lore?.entries||[]){for(const key of ['character','location'])if(entry[key]!==undefined)entry[key]=r(`${at}.lore.entries.${key}`,key==='character'?'actor':'location',entry[key]);if(Array.isArray(entry.knownBy))entry.knownBy=entry.knownBy.map(id=>r(`${at}.lore.entries.knownBy`,'actor',id));if(entry.when)when(`${at}.lore.entries.when`,entry.when);}const nested=refWalker(maps,refs);for(const key of PROFILE_KEYS.filter(k=>k!=='characterSheets'))for(const profile of row.source?.profiles?.[key]||[])nested.profile(key,profile);for(const key of ['arcTracks','endings'])for(const entry of row.source?.profiles?.[key]||[])if(entry.character!==undefined)entry.character=r(`${at}.source.profiles.${key}.character`,'actor',entry.character);for(const entry of row.source?.profiles?.lorebook||[])nested.lore(entry);for(const link of row.social?.links||[])if(link.actorId)link.actorId=r(`${at}.links.actorId`,'actor',link.actorId);for(const rule of row.behavior?.rules||[]){for(const key of ['condition','effect'])for(const [field,kind] of [['stat','stat'],['flag','flag']])if(rule[key]?.[field]!==undefined)rule[key][field]=r(`${at}.behavior.${key}.${field}`,kind,rule[key][field]);if(rule.condition?.actorId!==undefined)rule.condition.actorId=r(`${at}.behavior.condition.actorId`,'actor',rule.condition.actorId);if(rule.effect?.actorId!==undefined)rule.effect.actorId=r(`${at}.behavior.effect.actorId`,'actor',rule.effect.actorId);}}
  return row;},lore:entry=>{if(entry.scope==='character'&&entry.character!==undefined)entry.character=r(`lore.${entry.id}.character`,'actor',entry.character);if(entry.scope==='location'&&entry.location!==undefined)entry.location=r(`lore.${entry.id}.location`,'location',entry.location);if(Array.isArray(entry.knownBy))entry.knownBy=entry.knownBy.map((x,i)=>r(`lore.${entry.id}.knownBy.${i}`,'actor',x));if(entry.when)when(`lore.${entry.id}.when`,entry.when);return entry;}};
};
const walkContent=(content,maps)=>{content=structuredClone(content);const refs=[],w=refWalker(maps,refs);for(const type of TYPES)for(const record of content[type]||[])w.record(type,record);for(const key of PROFILE_KEYS)for(const row of content[key]||[])w.profile(key,row);for(const entry of content.lorebook||[])w.lore(entry);return refs;};

const TYPE_OF={actor:'actors',location:'locations',scene:'scriptedScenes'};
const destIds=(pack,type)=>new Set((pack[type]||[]).map(x=>x.id));
const contentIds=(content,type)=>new Set((content[type]||[]).map(x=>x.id));
// Every non-record id the destination can satisfy, per reference kind.
const destUniverses=p=>({actor:destIds(p,'actors'),location:destIds(p,'locations'),scene:destIds(p,'scriptedScenes'),item:new Set((p.items||[]).map(x=>x.id)),flag:new Set((p.storyVariables||[]).map(x=>x.id)),stat:new Set((p.statDefinitions||[]).map(x=>x.id)),dimension:new Set((p.relationshipDimensions||[]).map(x=>x.id)),state:new Set((p.relationshipStates||[]).map(x=>x.id)),category:new Set((p.intimacyCategories||[]).map(x=>x.id)),preference:new Set((p.datingProfiles||[]).flatMap(x=>(x.preferences||[]).map(y=>y.id))),rank:new Set((p.romanceTempoProfiles||[]).flatMap(x=>(x.ranks||[]).map(y=>y.id).filter(Boolean))),weather:new Set((p.calendar?.weather||[]).map(x=>x.id))});
const CHECKED_KINDS=['actor','location','scene','holder','item','flag','weather','stat','dimension','state','category','preference','rank'];
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const mediaPath=x=>typeof x==='string'&&/^(?:scenario-media\/[a-f0-9-]{36}|assets\/[a-zA-Z0-9_./-]+)\.(png|jpg|webp)$/.test(x)&&!x.split('/').some(p=>!p||p==='.'||p==='..');
export const PACKAGE_LIMIT=4800000;
const jsonError=value=>{const pending=[[value,0]],seen=new Set();let count=0;while(pending.length){const [x,depth]=pending.pop();if(++count>50000||depth>40)return 'Package exceeds the record/depth limits.';if(x===null||['string','boolean','number'].includes(typeof x))continue;if(typeof x!=='object'||seen.has(x))return 'Package must contain only acyclic JSON data.';seen.add(x);for(const [k,v] of Object.entries(x)){if(['__proto__','prototype','constructor'].includes(k))return 'Package contains an unsafe object key.';pending.push([v,depth+1]);}}try{if(JSON.stringify(value).length>PACKAGE_LIMIT)return 'Package is too large (maximum 4.8 MB JSON).';}catch{return 'Package must contain valid JSON data.';}return null;};

// Records the selection references but did not select: characters and places travel as included dependencies.
function closureOf(source,selected){
 const included=Object.fromEntries(TYPES.map(t=>[t,new Set()])),byId=Object.fromEntries(TYPES.map(t=>[t,new Map((source[t]||[]).filter(x=>t!=='actors'||x.id!==source.playerId).map(x=>[x.id,x]))])),pending=TYPES.flatMap(t=>selected[t].map(id=>[t,id])),seen=new Set(),queued=new Set(pending.map(([t,id])=>t+':'+id)),lorebook=[];
 while(pending.length){const [type,id]=pending.shift(),key=type+':'+id;if(seen.has(key))continue;seen.add(key);const record=byId[type].get(id);assert(record,`Unknown ${type} ${id}`);const refs=[],w=refWalker({},refs);w.record(type,structuredClone(record));
  if(type==='actors')for(const key of PROFILE_KEYS)for(const row of source[key]||[])if(ownerOf(row,key)===id)w.profile(key,structuredClone(row));
  for(const entry of source.lorebook||[])if((type==='actors'&&entry.scope==='character'&&entry.character===id)||(type==='locations'&&entry.scope==='location'&&entry.location===id)){lorebook.push(entry);w.lore(structuredClone(entry));}
  for(const ref of refs){const target=TYPE_OF[ref.kind];if(target&&ref.id!==source.playerId&&byId[target].has(ref.id)&&!queued.has(target+':'+ref.id)){queued.add(target+':'+ref.id);if(!selected[target].includes(ref.id))included[target].add(ref.id);pending.push([target,ref.id]);}}
 }
 return {included:{...Object.fromEntries(TYPES.map(t=>[t,[...included[t]]])),lorebook},byId};
}

// Match field types follow emitted payload contracts, not the spelling of scalar values.
const REVEAL_MATCH={
 'social.spoke':{actor:'actor',target:'actor',location:'location',utterance:'literal',promise:'literal',repeat:'literal',source:'literal',text:'literal'},
 'core.moved':{actor:'actor',from:'location',to:'location',text:'literal'},'core.inspected':{location:'location',text:'literal'},'core.travelBlocked':{from:'location',to:'location',text:'literal'},
 'core.waited':{actor:'actor',location:'location',until:'literal',tick:'literal',text:'literal'},'core.timeAdvanced':{from:'literal',to:'literal',sceneCast:'array'},
 'core.sceneStarted':{location:'location',activity:'literal',characters:'array',text:'literal'},'core.sceneContinued':{location:'location',activity:'literal',characters:'array',text:'literal'},'core.sceneEnded':{character:'actor',characters:'array',reason:'literal',text:'literal'},
 'story.choiceResolved':{scene:'scene',beat:'local',choice:'local',passed:'literal',text:'literal'},'story.checkResolved':{scene:'scene',beat:'local',choice:'local',stat:'stat',target:'literal',base:'literal',value:'literal',passed:'literal',modifiers:'array',text:'literal'},
 'story.sceneStarted':{scene:'scene',beat:'local',title:'literal',text:'literal',cast:'array',incident:'local'},'story.sceneResumed':{scene:'scene',beat:'local',text:'literal'},'story.sceneSelected':{scene:'scene',title:'literal',text:'literal'},'story.sceneDismissed':{scene:'scene',beat:'local',text:'literal'},'story.sceneResponded':{scene:'scene',beat:'local',text:'literal'},'story.scenePaused':{scene:'scene',beat:'local',text:'literal'},'story.sceneQueued':{scene:'scene',beat:'local',firedTick:'literal',behind:'literal'},'story.sceneEvicted':{scene:'scene',beat:'local',firedTick:'literal',behind:'literal'},
 'story.memoryRecorded':{character:'actor',text:'literal'},'world.actorArrived':{actor:'actor',location:'location'},'world.meetingUnavailable':{character:'actor',location:'location',text:'literal'}
};
const knowledgeErrors=(source,content)=>{const own={actor:contentIds(content,'actors'),location:contentIds(content,'locations'),scene:contentIds(content,'scriptedScenes')},all={actor:destIds(source,'actors'),location:destIds(source,'locations'),scene:destIds(source,'scriptedScenes')},has=ref=>own[ref.kind]?.has(ref.id),errors=[];for(const f of source.facts||[])if(f.knownBy==='public'||Array.isArray(f.knownBy)&&f.knownBy.some(id=>own.actor.has(id)))errors.push(`Unsupported knowledge dependency: facts.${f.id}; authored truth cannot travel in this package.`);for(const rule of source.factReveals||[]){const schema=REVEAL_MATCH[rule.event],matchRefs=[],conditions=[],w=refWalker({},conditions);let classified=Boolean(schema),possible=true;for(const [field,id] of Object.entries(rule.match||{})){const kind=schema?.[field];if(!kind)classified=false;else if(kind==='array')possible=false;else if(!['literal','local'].includes(kind))matchRefs.push({kind,id});}w.record('scriptedScenes',{id:rule.id,when:structuredClone(rule.when)});const scoped=matchRefs.some(ref=>(ref.kind!=='actor'||ref.id!==source.playerId)&&all[ref.kind]?.has(ref.id));if(possible&&((rule.recipients||[]).some(id=>own.actor.has(id))||matchRefs.some(has)||conditions.some(has)||!classified||!scoped))errors.push(`Unsupported knowledge dependency: factReveals.${rule.id} -> facts.${rule.fact}; reveal behavior cannot travel in this package.`);}return errors;};

const validateStructure=pkg=>{
 if(!object(pkg))return ['Package must be a JSON object.'];const bad=jsonError(pkg);if(bad)return [bad];
 const errors=[];
 if(pkg.format!==PACKAGE_FORMAT)errors.push(`Package format must be ${PACKAGE_FORMAT}.`);
 if(pkg.version!==PACKAGE_VERSION)errors.push(`Package version must be ${PACKAGE_VERSION}.`);
 if(!object(pkg.manifest)||!object(pkg.manifest.selected))errors.push('Package manifest with a selection is missing.');
 if(!object(pkg.content))errors.push('Package content is missing.');
 if(errors.length)return errors;
 const selected=pkg.manifest.selected;
 if(pkg.manifest.playerId!==undefined&&!safeKey(pkg.manifest.playerId))errors.push('manifest.playerId: invalid player ID');if(pkg.manifest.modules!==undefined&&(!Array.isArray(pkg.manifest.modules)||pkg.manifest.modules.some(id=>!safeKey(id))))errors.push('manifest.modules: expected module IDs');for(const key of Object.keys(pkg.content))if(![...TYPES,...PROFILE_KEYS,'lorebook'].includes(key))errors.push(`Unsupported package content type: ${key}`);
 if(pkg.media!==undefined&&!object(pkg.media))errors.push('Package media must be an object.');if(pkg.manifest.included!==undefined&&!object(pkg.manifest.included))errors.push('manifest.included must be an object.');
 for(const type of TYPES){if(Array.isArray(pkg.content[type])&&pkg.content[type].length>1000)errors.push(`content.${type}: too many records.`);if(!Array.isArray(pkg.content[type]))errors.push(`content.${type} must be an array.`);if(!Array.isArray(selected[type])){errors.push(`manifest.selected.${type} must be a list of IDs.`);continue;}if(new Set(selected[type]).size!==selected[type].length)errors.push(`manifest.selected.${type}: duplicate IDs.`);for(const id of selected[type])if(!safeKey(id))errors.push(`manifest.selected.${type}: invalid ID ${id}.`);}
 for(const type of TYPES)if(pkg.manifest.included?.[type]!==undefined&&(!Array.isArray(pkg.manifest.included[type])||pkg.manifest.included[type].some(id=>!safeKey(id))))errors.push(`manifest.included.${type}: invalid dependency list.`);
 for(const key of [...PROFILE_KEYS,'lorebook'])if(pkg.content[key]!==undefined&&!Array.isArray(pkg.content[key]))errors.push(`content.${key} must be an array.`);
 if(errors.length)return errors;
 const taken=new Set();
 for(const type of TYPES)for(const [i,record] of (pkg.content[type]||[]).entries()){if(!object(record)||!safeKey(record.id))errors.push(`content.${type}[${i}].id: invalid ID.`);else if(taken.has(record.id))errors.push(`content.${type}[${i}].id: duplicate ${record.id}`);else taken.add(record.id);}
 if(errors.length)return errors;if(!TYPES.some(t=>selected[t].length))errors.push('Package selection must not be empty.');
 const ids={};for(const type of TYPES)ids[type]=contentIds(pkg.content,type);
 for(const type of TYPES)for(const id of selected[type])if(!ids[type].has(id))errors.push(`Selected ${id} is not present in the package content.`);
 for(const type of TYPES)for(const id of ids[type])if(![...selected[type],...(pkg.manifest.included?.[type]||[])].includes(id))errors.push(`content.${type} contains ${id}, which the manifest does not declare.`);
 if(pkg.content.actors?.some(a=>a.id===pkg.manifest.playerId))errors.push('Packages never contain the player.');
 for(const key of PROFILE_KEYS)for(const row of pkg.content[key]||[])if(!object(row)||!safeKey(row[key==='characterSheets'?'actorId':'character'])||!ids.actors.has(ownerOf(row,key)))errors.push(`content.${key}: profile owner must be a packaged character`);
 for(const row of pkg.content.lorebook||[])if(!object(row)||!safeKey(row.id)||!['character','location'].includes(row.scope)||!(row.scope==='character'?ids.actors:ids.locations).has(row[row.scope]))errors.push('content.lorebook: expected lore owned by a packaged character or location');
 for(const type of TYPES)for(const id of pkg.manifest.included?.[type]||[])if(!ids[type].has(id))errors.push(`Declared dependency ${type}.${id} is not present in the package.`);
 for(const type of TYPES)for(const record of pkg.content[type]){const rows=type==='scriptedScenes'?[record,...(Array.isArray(record.beats)?record.beats:[])]:[record],keys=type==='actors'?['poses']:type==='locations'?['exits']:type==='scriptedScenes'?['pages','choices','beats','stage']:[];for(const row of rows){if(!object(row)){errors.push(`content.${type}: invalid record`);continue;}for(const key of keys)if(row[key]!==undefined&&!Array.isArray(row[key]))errors.push(`content.${type}.${record.id}.${key}: expected an array`);}}
 if(!errors.length)try{walkContent(structuredClone(pkg.content),{});}catch(e){errors.push(`Package records: ${String(e.message).slice(0,160)}`);}
 return errors;
};

export function buildContentPackage(pack,selection,{read,name='Content package'}={}){
 assert(object(selection),'Selection must be an object.');const selected={};for(const type of TYPES){assert(selection[type]===undefined||Array.isArray(selection[type]),`selection.${type}: expected a list of IDs`);selected[type]=[...new Set(selection[type]||[])];assert(selected[type].every(safeKey),`selection.${type}: invalid ID`);}
 assert(TYPES.some(t=>selected[t].length),'Select at least one character, location or event to export.');
 const {included,byId}=closureOf(pack,selected);
 const content={};for(const type of TYPES)content[type]=selected[type].map(id=>structuredClone(byId[type].get(id)));
 for(const type of TYPES)for(const id of included[type])content[type].push(structuredClone(byId[type].get(id)));
 for(const key of PROFILE_KEYS)content[key]=(pack[key]||[]).filter(row=>content.actors.some(a=>a.id===ownerOf(row,key))).map(row=>structuredClone(row));
 content.lorebook=included.lorebook.map(entry=>structuredClone(entry));
 const missing=knowledgeErrors(pack,content);assert(!missing.length,missing.join(" "));
 const refs=walkContent(content,{});
 const mediaPaths=[...new Set(refs.filter(x=>x.kind==='media').map(x=>x.id))];
 if(mediaPaths.length)assert(read,'Exporting a package with uploaded art requires access to project media.');
 const media={};for(const path of mediaPaths){assert(mediaPath(path),`Invalid package asset path: ${String(path).slice(0,120)}`);media[path]={mime:`image/${path.endsWith('.jpg')?'jpeg':path.split('.').pop()}`,data:Buffer.from(read(path)).toString('base64')};validateImage(`data:${media[path].mime};base64,${media[path].data}`);}
 const pkg={format:PACKAGE_FORMAT,version:PACKAGE_VERSION,manifest:{name,playerId:pack.playerId,created:new Date().toISOString(),source:{packId:pack.id,packVersion:pack.version,packSha256:createHash('sha256').update(JSON.stringify(pack)).digest('hex')},selected,included:{...Object.fromEntries(TYPES.map(t=>[t,included[t]])),lorebook:content.lorebook.length,profiles:PROFILE_KEYS.reduce((n,k)=>n+content[k].length,0)},unresolvedReferences:refs.filter(x=>x.kind==='free').map(({path,id})=>({path,id})),modules:[...(content.scriptedScenes.length?['story.scenes']:[]),...(content.worldEvents.length?['world.events']:[])]},content,media};const errors=validateStructure(pkg);assert(!errors.length,errors[0]);return pkg;
}

// Closure recomputed from the package itself (an import never sees the source project).

export function reviewContentPackage(pkg,destPack,{choices={}}={}){
 const out={ok:false,errors:validateStructure(pkg),selected:{},collisions:{actors:{},locations:{},scriptedScenes:{},worldEvents:{}},included:{},unresolved:[],notes:[],media:[],modulesRequired:[],skipAllowed:Object.fromEntries(TYPES.map(t=>[t,{}]))};
 if(!out.errors.length){
  const selected=pkg.manifest.selected,globalDest=new Set(DEST_TYPES.flatMap(t=>[...destIds(destPack,t)]));
  if(!object(choices))out.errors.push('Conflict choices must be an object.');else for(const [type,rows] of Object.entries(choices)){if(!TYPES.includes(type)||!object(rows)){out.errors.push('Invalid conflict choices');continue;}for(const [id,policy] of Object.entries(rows))if(!contentIds(pkg.content,type).has(id)||!globalDest.has(id)||!['skip','remap'].includes(policy)||policy==='skip'&&!destIds(destPack,type).has(id))out.errors.push(`Invalid conflict choice for ${type}.${id}`);}if(out.errors.length)return out;
  const effective=structuredClone(pkg.content);for(const type of TYPES)effective[type]=effective[type].filter(row=>choices[type]?.[row.id]!=='skip');for(const key of PROFILE_KEYS)effective[key]=(effective[key]||[]).filter(row=>effective.actors.some(a=>a.id===ownerOf(row,key)));effective.lorebook=(effective.lorebook||[]).filter(row=>row.scope==='character'?effective.actors.some(a=>a.id===row.character):effective.locations.some(l=>l.id===row.location));
  if(pkg.content.actors?.some(a=>a.id===destPack.playerId))out.errors.push('Packages never contain the player.');
  for(const type of TYPES){out.selected[type]=selected[type];for(const id of contentIds(pkg.content,type))if(globalDest.has(id)){out.collisions[type][id]='remap';out.skipAllowed[type][id]=destIds(destPack,type).has(id);}}
  out.included={...Object.fromEntries(TYPES.map(t=>[t,[...contentIds(pkg.content,t)].filter(id=>!selected[t].includes(id))])),lorebook:(pkg.content.lorebook||[]).length,profiles:PROFILE_KEYS.reduce((n,k)=>n+(pkg.content[k]||[]).length,0)};
  out.modulesRequired=pkg.manifest.modules||[];
  const universes=destUniverses(destPack),own={actor:contentIds(pkg.content,'actors'),location:contentIds(pkg.content,'locations'),scene:contentIds(pkg.content,'scriptedScenes'),preference:new Set((pkg.content.datingProfiles||[]).flatMap(p=>(p.preferences||[]).map(x=>x.id))),rank:new Set((pkg.content.romanceTempoProfiles||[]).flatMap(p=>(p.ranks||[]).map(x=>x.id)))};universes.holder=new Set([...universes.actor,...universes.location]);own.holder=new Set([...own.actor,...own.location]);if(pkg.manifest.playerId){own.actor.add(pkg.manifest.playerId);own.holder.add(pkg.manifest.playerId);}
  for(const {path,kind,id} of walkContent(effective,{})){
   if(kind==='media'){if(mediaPath(id))out.media.push(id);else out.errors.push(`${path}: invalid package asset path '${String(id).slice(0,120)}'.`);continue;}
   if(kind==='free'){out.notes.push(`${path}: '${id}' is a free identifier, not a package record; it only has meaning if the destination defines it.`);continue;}
   if(CHECKED_KINDS.includes(kind)&&!(own[kind]?.has(id)||universes[kind].has(id)||kind==='flag'&&!universes.flag.size))out.unresolved.push({path,kind,id});
  }
  out.unresolved=out.unresolved.filter((x,i,a)=>a.findIndex(y=>y.path===x.path&&y.id===x.id)===i);
  out.media=[...new Set(out.media)];
  if(!destPack.modules?.['story.scenes']&&effective.scriptedScenes.length)out.errors.push('This project has Scripted scenes disabled; enable story.scenes before importing scenes.');
  if(!destPack.modules?.['world.events']&&effective.worldEvents.length)out.errors.push('This project has World events disabled; enable world.events before importing events.');
  if(out.unresolved.length)out.errors.push(...out.unresolved.map(x=>`${x.path}: references ${x.kind} '${x.id}', which is not in the package and not in this project.`));
  const missing=out.media.filter(path=>!Object.hasOwn(pkg.media||{},path));
  if(missing.length)out.errors.push(`Package media is missing for: ${missing.join(', ')}`);
  const allMedia=walkContent(pkg.content,{}).filter(r=>r.kind==='media').map(r=>r.id);
  for(const [path,asset] of Object.entries(pkg.media||{})){try{assert(mediaPath(path),'Invalid package asset path');assert(allMedia.includes(path),'Embedded media is not referenced by package content');assert(asset&&typeof asset.mime==='string'&&typeof asset.data==='string','Embedded media requires mime and data');const expected=path.endsWith('.jpg')?'image/jpeg':path.endsWith('.png')?'image/png':'image/webp';assert(asset.mime===expected,'Embedded image MIME does not match its path');validateImage(`data:${asset.mime};base64,${asset.data}`);}catch(e){out.errors.push(`media.${String(path).slice(0,120)}: ${e.message}`);}}
 }
 out.errors=out.errors.map(x=>String(x).slice(0,300));
 out.ok=!out.errors.length;
 return out;
}

// Returns a new destination pack; never mutates the input. Choices: {<type>:{<id>:'skip'|'remap'}}, default remap.
// mediaRemap: {oldScenarioMediaPath:newPath} supplied by the caller after uploading the package media.
export function applyContentPackage(pkg,destPack,{choices={},mediaRemap={}}={}){
 const review=reviewContentPackage(pkg,destPack,{choices});
 assert(review.ok,review.errors[0]||'Package review failed');
 assert(object(choices),'Conflict choices must be an object.');for(const [type,rows] of Object.entries(choices)){assert(TYPES.includes(type)&&object(rows),'Invalid conflict choices');for(const [id,policy] of Object.entries(rows))assert(Object.hasOwn(review.collisions[type],id)&&['skip','remap'].includes(policy),`Invalid conflict choice for ${type}.${id}`);}
 const globalDest=new Set(DEST_TYPES.flatMap(t=>[...destIds(destPack,t)])),taken=new Set([...DEST_TYPES.flatMap(t=>[...destIds(destPack,t)]),...TYPES.flatMap(t=>[...contentIds(pkg.content,t)])]),remap={...Object.fromEntries(TYPES.map(t=>[t,Object.create(null)])),media:{...mediaRemap}},maps={actor:remap.actors,location:remap.locations,scene:remap.scriptedScenes,media:remap.media},applied={...Object.fromEntries(TYPES.map(t=>[t,[]])),lorebook:0,profiles:0},added={actors:new Set(),locations:new Set()},planned={};
 if(pkg.manifest.playerId&&pkg.manifest.playerId!==destPack.playerId)maps.actor[pkg.manifest.playerId]=destPack.playerId;
 for(const type of TYPES){planned[type]=[];const dest=destIds(destPack,type);for(const record of pkg.content[type]){if(dest.has(record.id)&&choices[type]?.[record.id]==='skip')continue;const add=structuredClone(record);if(globalDest.has(record.id)){add.id=mintId(add,taken);taken.add(add.id);remap[type][record.id]=add.id;}planned[type].push(add);}}
 const pack=structuredClone(destPack),w=refWalker(maps,null),locNames=new Set((pack.locations||[]).map(l=>String(l.name||'').trim().toLowerCase()));
 for(const type of TYPES)for(const add of planned[type]){if(type==='locations'&&add.name!==undefined){const key=String(add.name).trim().toLowerCase();if(locNames.has(key)){let n=2;while(locNames.has(`${add.name} (${n})`.toLowerCase()))n++;add.name=`${add.name} (${n})`;}locNames.add(String(add.name).trim().toLowerCase());}w.record(type,add);pack[type]=[...(pack[type]||[]),add];applied[type].push(add.id);if(added[type])added[type].add(add.id);}
 const resolveActor=id=>remap.actors[id]??(added.actors.has(id)?id:null);
 for(const key of PROFILE_KEYS)for(const row of pkg.content[key]||[]){
  const owner=ownerOf(row,key),fresh=resolveActor(owner);
  if(!fresh||!added.actors.has(fresh))continue; // profiles travel only with characters that were actually added
  if((pack[key]||[]).some(existing=>ownerOf(existing,key)===fresh))continue; // the destination's own configuration for a character always wins
  const add=structuredClone(row);w.profile(key,add);pack[key]=[...(pack[key]||[]),add];applied.profiles++;
 }
 for(const entry of pkg.content.lorebook||[]){
  const owner=entry.scope==='character'?entry.character:entry.location,fresh=owner===undefined?null:entry.scope==='character'?resolveActor(owner):(remap.locations[owner]??(added.locations.has(owner)?owner:null));
  if(!fresh||!(entry.scope==='character'?added.actors:added.locations).has(fresh))continue;
  const add=structuredClone(entry);const loreIds=new Set((pack.lorebook||[]).map(x=>x.id));if(loreIds.has(add.id))add.id=unique(add.id,loreIds);w.lore(add);pack.lorebook=[...(pack.lorebook||[]),add];applied.lorebook++;
 }
 return {pack,remap,applied,review};
}

export function commitContentPackage({draft,file,expected,assets=[]},io={openSync,closeSync,writeFileSync,readFileSync,renameSync,rmSync}){
 const created=[],stage=file+'.'+randomUUID()+'.tmp',write=(target,bytes)=>{const fd=io.openSync(target,'wx');created.push(target);try{io.writeFileSync(fd,bytes);}finally{io.closeSync(fd);}};
 try{write(stage,JSON.stringify(draft,null,2));for(const asset of assets)write(asset.file,asset.bytes);assert(io.readFileSync(file).equals(expected),'Draft changed during package import; preview again');io.renameSync(stage,file);}catch(e){const failures=[];for(const target of created.reverse())try{io.rmSync(target,{force:true});}catch(error){failures.push(error);}if(failures.length)throw new AggregateError([e,...failures],'Package import failed and rollback was incomplete');throw e;}
}
