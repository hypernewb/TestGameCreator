// Venus-style character folders: one folder per character, prompt tag groups in character.json, sprites under expressions/ and outfits/{set}/.
// Layout (root = public/assets/characters): index.json, _style.json, {id}/character.json, {id}/expressions/{emotion}.png, {id}/outfits/{set}/{emotion}.png,
// {id}/room_{day|night}.png, {id}/expressions/profile.png, {id}/scenes/{scene}.png, {id}/renders/{stem}.json; extra takes (new seeds) add _v{n} before .png
export const CHARACTER_FILE='character.json',STYLE_FILE='_style.json',INDEX_FILE='index.json';
export const EMOTIONS=['neutral','smile','concerned','frustrated'],ROOM_VARIANTS=['day','night'];
export const expressionRel=emotion=>`expressions/${emotion}.png`,outfitRel=(set,emotion)=>`outfits/${set}/${emotion}.png`,roomRel=v=>`room_${v}.png`,profileRel=()=>'expressions/profile.png';
export const spriteRel=(set,emotion)=>!set||set==='default'?expressionRel(emotion):outfitRel(set,emotion);
// First matching outfit rule wins; an empty condition is any value. Falls back to the default outfit, so a rule never points at a missing set.
export const wornSetOf=(char,ctx={})=>(char?.outfitRules||[]).find(r=>(r.set==='default'||r.set in (char.outfitSets||{}))&&['daypart','location','stage'].every(k=>!r[k]||r[k]===ctx[k])&&(!r.undressed||r.undressed===(ctx.undressed?'yes':'no')))?.set||'default';
export const takeRel=(rel,n=1)=>n>1?rel.replace(/\.png$/,`_v${n}.png`):rel,sceneRel=(scene,n=1)=>takeRel(`scenes/${scene}.png`,n);
export const renderRel=rel=>`renders/${rel.replace(/\.png$/,'').replaceAll('/','_')}.json`;
const SAFE_ID=/^[a-z0-9][a-z0-9_-]*$/;
const tags=v=>(Array.isArray(v)?v:v?[v]:[]).filter(Boolean),group=g=>tags(g).join(', ');

// Venus groups: base (pose + style) | appearance, outfit, expression (the character caption). Groups join with ',\n\n', tags with ', '.
export function characterPrompt(style,char,emotion,set='default'){
 if(!SAFE_ID.test(char.id||''))throw new Error(`Bad character id ${char.id}`);
 const expr=char.expressionTags?.[emotion]??style.expressionTags?.[emotion];if(!expr)throw new Error(`${char.id}: no expression tags for ${emotion}`);
 const outfit=set==='default'?char.outfit:char.outfitSets?.[set];if(!outfit)throw new Error(`${char.id}: no outfit for set ${set}`);
 const s=style.sets?.[set]||{};
 return {base:[group(s.poseTags??char.poseTags??style.poseTags),style.style].filter(Boolean).join(',\n\n'),caption:[char.baseAppearance,outfit,expr].map(group).filter(Boolean).join(',\n\n'),negative:[style.negative,group(s.negativeTags),group(char.negativeTags)].filter(Boolean).join(', ')};
}

// Her room, no people: room style + room tags + the variant's lighting.
export function roomPrompt(style,char,variant){
 const r=style.room||{};if(!char.roomTags)throw new Error(`${char.id}: no roomTags`);
 return {base:[group(r.tags),group(char.roomTags),group(r.variants?.[variant]),r.style].filter(Boolean).join(',\n\n'),negative:[style.negative,group(r.negativeTags)].filter(Boolean).join(', ')};
}

// An explicit scene CG in her room: the scene's own negative (the sprite UC bans nudity), her appearance + optional outfit set + the scene's tags as her caption.
export function scenePrompt(style,char,scene){
 const s=style.scenes||{},d=s.list?.[scene];if(!SAFE_ID.test(char.id||''))throw new Error(`Bad character id ${char.id}`);if(!d)throw new Error(`no scene ${scene}`);
 const outfit=d.outfit?char.outfitSets?.[d.outfit]:null;if(d.outfit&&!outfit)throw new Error(`${char.id}: no outfit for set ${d.outfit}`);
 return {base:[group(s.tags),group(d.tags),group(char.roomTags),group(s.lighting),style.style].filter(Boolean).join(',\n\n'),caption:[char.baseAppearance,outfit,d.her].map(group).filter(Boolean).join(',\n\n'),negative:[s.negative,group(d.negativeTags),group(char.negativeTags)].filter(Boolean).join(', ')};
}

// A buildRequest sheet: one cg per character x (set, emotion) plus rooms; ids are the file stems (`{char}/{rel}`), a character's sprites share her seed, take n adds n-1.
export function spriteSheet(style,chars,{emotions,sets,rooms=true,sprites=true,takes=style.takes||1,scenes}={}){
 const characters={},cgs=[],setList=sets||['default',...Object.keys(style.sets||{}).filter(s=>s!=='default')];
 for(const c of chars){
  if(sprites)for(const set of setList){if(set!=='default'&&!c.outfitSets?.[set])continue;
   for(const e of emotions||style.sets?.[set]?.emotions||style.emotions||EMOTIONS){const p=characterPrompt(style,c,e,set);for(let n=1;n<=takes;n++){const rel=takeRel(spriteRel(set,e),n),key=`${c.id}/${rel}`;characters[key]=p.caption;
    cgs.push({id:key,char:c.id,set,emotion:e,take:n,rel:key,seed:c.seed+n-1,prompt:p.base,negative:[group(style.sets?.[set]?.negativeTags),group(c.negativeTags)].filter(Boolean).join(', ')||undefined,cast:[{id:key}]});}}}
  for(const sc of scenes??Object.keys(style.scenes?.list||{})){const p=scenePrompt(style,c,sc);for(let n=1;n<=(style.scenes.takes||1);n++){const key=`${c.id}/${sceneRel(sc,n)}`;characters[key]=p.caption;
   cgs.push({id:key,char:c.id,scene:sc,take:n,rel:key,seed:c.seed+n-1,size:style.scenes.size,prompt:p.base,uc:p.negative,cast:[{id:key}]});}}
  if(rooms&&c.roomTags)for(const v of ROOM_VARIANTS){const p=roomPrompt(style,c,v),rel=roomRel(v);cgs.push({id:`${c.id}/${rel}`,char:c.id,room:v,rel:`${c.id}/${rel}`,seed:c.seed,size:style.room?.size,prompt:p.base,negative:group(style.room?.negativeTags)||undefined,cast:[]});}
 }
 const {model,size,steps,scale,cfgRescale,ucPreset,negative}=style;return {model,size,steps,scale,cfgRescale,ucPreset,negative,characters,cgs};
}

// What the game reads: per character, the sprites that exist by set and emotion (extra takes as variants), her rooms, profile and scenes (every take), relative to the characters root.
export function spriteManifest(char,has=()=>true,style={}){
 const sets=['default',...Object.keys(style.sets||{}).filter(s=>s!=='default'&&char.outfitSets?.[s])],at=rel=>has(`${char.id}/${rel}`)?`${char.id}/${rel}`:null;
 const takes=(rel,t)=>Array.from({length:t},(_,i)=>at(takeRel(rel,i+1))).filter(Boolean);
 const poses=set=>(style.sets?.[set]?.emotions||style.emotions||EMOTIONS).map(e=>{const image=at(spriteRel(set,e)),variants=takes(spriteRel(set,e),style.takes||1).slice(1);return image&&{id:e,image,...variants.length?{variants}:{}};}).filter(Boolean);
 return {id:char.id,name:char.name,profile:at(profileRel()),poses:poses('default'),outfits:Object.fromEntries(sets.slice(1).map(s=>[s,poses(s)]).filter(([,p])=>p.length)),rooms:Object.fromEntries(ROOM_VARIANTS.map(v=>[v,at(roomRel(v))]).filter(([,r])=>r)),
  scenes:Object.fromEntries(Object.keys(style.scenes?.list||{}).map(sc=>[sc,takes(sceneRel(sc),style.scenes.takes||1)]).filter(([,t])=>t.length))};
}
