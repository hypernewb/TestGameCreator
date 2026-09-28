// Adapted from src/shared/classifier.ts in Venus University.
// The roster/location verdict is normalized against authored IDs, never trusted verbatim.
// AGPL-3.0-only; see NOTICE.md and LICENSE.
import {keyPattern} from './lorebook.mjs';

// Compatible models commonly return an authored location with an article, whitespace, or
// inside a short phrase. Resolve that wording only when it identifies exactly one authored
// location; ambiguous and invented destinations remain null so the engine never guesses.
export function resolveSceneLocation(pack,raw){
 const text=String(raw||'').trim().replace(/\s+/g,' ');
 if(!text)return null;
 const stripped=text.replace(/^(?:the|a|an)\s+/i,'');
 for(const candidate of [text,stripped]){
  const exact=pack.locations.find(l=>l.id===candidate||l.name.toLowerCase()===candidate.toLowerCase()||(l.aliases||[]).some(alias=>alias.toLowerCase()===candidate.toLowerCase()));
  if(exact)return exact.id;
 }
 const matches=pack.locations.filter(l=>[l.name,...l.aliases||[]].some(name=>new RegExp(keyPattern(name,false),'iu').test(text)));
 return matches.length===1?matches[0].id:null;
}
export function sceneFormat(pack){
 return {type:'json_schema',json_schema:{name:'scene_intent',strict:false,schema:{type:'object',properties:{
  characters:{type:'array',items:{type:'string',enum:pack.actors.filter(a=>a.id!==pack.playerId).map(a=>a.id)}},
  mentionedOnly:{type:'array',items:{type:'string'}},sceneLocation:{type:'string'},
  activity:{type:'string',enum:['rest','meet','explore','work','talk','other']},activityId:{type:'string',enum:['',...(pack.activities||[]).map(a=>a.id)]},
  itemAction:{type:'string',enum:['','take','place','give']},itemId:{type:'string',enum:['',...(pack.items||[]).map(i=>i.id)]},itemTarget:{type:'string',enum:['',...pack.actors.filter(a=>a.id!==pack.playerId).map(a=>a.id)]}
 },required:['characters','mentionedOnly','sceneLocation','activity','activityId']}}};
}
export function sceneMessages(input,pack,world){
 const roster=pack.actors.filter(a=>a.id!==pack.playerId).map(a=>`${a.id} — ${a.name}`).join('\n');
 const locations=pack.locations.map(l=>`${l.id} — ${l.name}${l.aliases?.length?` (also: ${l.aliases.join(', ')})`:''}: ${l.description||''}`).join('\n');
 const previous=Object.values(world.turns).at(-1);
 return [{role:'system',content:[
  'Read the player’s proposed next scene. Identify who is actually in that scene, who is merely mentioned, its destination, and the activity. Do not invent IDs. A request to go meet a named person puts that person in characters. Buying a present for them puts them in mentionedOnly. Return one JSON object.',
  'A location may be chosen from the authored list by its name or a described activity. Use an empty sceneLocation if unspecified. Do not infer travel from flirting, conversation, a pronoun, or a location mentioned as background. Resolve pronouns only against the current scene cast; never substitute another character from the roster. A location outside the authored list must be returned in plain words; the game will then keep its current location.',
  'Choose activityId only when the sentence actually asks to perform one of the authored activities. Otherwise use an empty string. A named character required by that activity must be placed in characters. Use itemAction and itemId only for an explicit request to take, place, or give a known item. For give, specify itemTarget. The engine will validate ownership and presence.',pack.gameProject?.setting||'',`ROSTER\n${roster}`,`LOCATION IDS\n${locations}`,`AUTHORED ACTIVITIES\n${(pack.activities||[]).map(a=>`${a.id} — ${a.name} at ${a.location}: ${a.description}`).join('\n')||'(none)'}`,`ITEM IDS\n${(pack.items||[]).map(i=>`${i.id} — ${i.name}`).join('\n')||'(none)'}`
 ].filter(Boolean).join('\n\n')},{role:'user',content:JSON.stringify({sentence:input,currentLocation:world.actors[pack.playerId].location,currentScene:world.scene||null,present:pack.actors.filter(a=>a.id!==pack.playerId&&world.actors[a.id].location===world.actors[pack.playerId].location).map(a=>a.id),recentPlayerAction:previous?.input||previous?.command.args.text||'',lastConversationTarget:previous?.command.type==='social.speak'?previous.command.args.target:null,recentScene:previous?.fallback?'':previous?.narrative?.slice(-2000)||''})}];
}
function pickFiledId(list,value){if(value==null)return null;const v=String(value).trim().toLowerCase();if(!v)return null;for(const x of list){const id=(x.id||'').toLowerCase(),name=(x.name||'').toLowerCase(),first=name.split(' ')[0];if(id===v||name===v||(first&&first===v))return x.id;}return null;}
export function normalizeSceneVerdict(raw,pack){
 if(!raw||!Array.isArray(raw.characters)||typeof raw.sceneLocation!=='string'||typeof raw.activity!=='string')throw Error('Scene classification must include characters, sceneLocation and activity');
 const roster=pack.actors.filter(a=>a.id!==pack.playerId);
 const resolveChar=v=>pickFiledId(roster,v);
 const characters=[...new Set((raw.characters||[]).map(v=>resolveChar(v)).filter(Boolean))];
 const mentionedRaw=new Set((raw.mentionedOnly||[]).map(v=>resolveChar(v)).filter(Boolean));
 const mentionedOnly=[...mentionedRaw].filter(id=>!characters.includes(id));
 const location=resolveSceneLocation(pack,raw.sceneLocation);
 const activityId=(pack.activities||[]).some(a=>a.id===raw.activityId)?raw.activityId:'';
 const item=(pack.items||[]).find(i=>i.id===raw.itemId)||(pack.items||[]).find(i=>i.id===pickFiledId(pack.items,raw.itemId))||null;
 const itemAction=item&&['take','place','give'].includes(raw.itemAction)?raw.itemAction:'';
 const itemTarget=itemAction==='give'&&raw.itemTarget&&characters.includes(resolveChar(raw.itemTarget))?resolveChar(raw.itemTarget):'';
 return {characters,mentionedOnly,location,activity:['rest','meet','explore','work','talk','other'].includes(raw.activity)?raw.activity:'other',activityId,itemAction,itemId:itemAction?item.id:'',itemTarget};
}
