// Adapted from ledgerMemories in src/renderer/stores/sceneSanitizer.ts.
// AGPL-3.0-only; see NOTICE.md and LICENSE.
export function ledgerFormat(pack){return {type:'json_schema',json_schema:{name:'scene_ledger',strict:false,schema:{type:'object',properties:{memories:{type:'array',items:{type:'object',properties:{charKey:{type:'string'},type:{type:'string',enum:['liked','disliked','neutral']},desc:{type:'string'}},required:['charKey','type','desc']}}},required:['memories']}}};}
export function ledgerMemories(raw,pack,turn){
 const cast=new Set(turn.command.type==='core.scene'?turn.events?.find(e=>e.type==='core.sceneStarted'||e.type==='core.sceneContinued')?.payload.characters||[]:turn.command.type==='world.acceptHangout'&&turn.events?.some(e=>e.type==='world.hangoutStarted')?[turn.command.args.char]:turn.command.type==='social.speak'?[turn.command.args.target]:[]),out=[];
 for(const entry of Array.isArray(raw?.memories)?raw.memories:[]){
  if(!cast.has(entry?.charKey)||!['liked','disliked','neutral'].includes(entry.type)||typeof entry.desc!=='string')continue;
  const desc=entry.desc.trim();if(!desc||desc.length>240||out.some(m=>m.charKey===entry.charKey))continue;
  out.push({charKey:entry.charKey,type:entry.type,desc});if(out.length>=3)break;
 }
 return out;
}
