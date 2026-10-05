import {parseModelObject} from './json.mjs';

// Adapted from Venus University's characterPrompt.ts at snapshot
// 79301df55bc39a0996229ccc6f12ccce422a80b2 (AGPL-3.0-only).
// Rendering-specific Danbooru tags, outfits, expressions and room generation are
// replaced by fields understood by Story Framework's setting-neutral actor schema.
export const CHARACTER_TRAITS=['Mood-swings','Disagreeable','Good-natured','Materialist','Terminally Online','Promiscuous','High Standards'];
const behaviorKeys=['withStrangers','withFriends','withCrush','withLover','withEnemy'];
const stringArray={type:'array',items:{type:'string'}};
const schema={type:'object',additionalProperties:false,required:['name','pronouns','age','description','personality','behavior','backstory','goal','traits','likes','dislikes','voice','style','examples','conversationStarters','flaws','routine','year','major','dorm'],properties:{
 name:{type:'string'},pronouns:{type:'string'},age:{type:'integer'},description:{type:'string'},personality:{type:'string'},
 behavior:{type:'object',additionalProperties:false,required:behaviorKeys,properties:Object.fromEntries(behaviorKeys.map(k=>[k,{type:'string'}]))},
 backstory:{type:'string'},goal:{type:'string'},traits:{type:'array',items:{type:'string',enum:CHARACTER_TRAITS}},likes:stringArray,dislikes:stringArray,voice:{type:'string'},style:{type:'string'},examples:stringArray,conversationStarters:stringArray,flaws:stringArray,routine:stringArray,year:{type:'string'},major:{type:'string'},dorm:{type:'string'}
}};
const clean=v=>typeof v==='string'?v.trim():'';
const list=(v,max=8)=>Array.isArray(v)?v.map(clean).filter(Boolean).slice(0,max):[];

export function characterMessages(pack,brief,{name='',pronouns='',age=21}={}){
 const cast=(pack?.actors||[]).filter(a=>a.id!==pack.playerId&&a.id!=='player').slice(0,12).map(a=>`${a.name}: ${clean(a.personality||a.description).slice(0,100)}`).filter(Boolean),setting=clean(pack?.gameProject?.setting),premise=clean(pack?.gameProject?.premise),fixed=clean(name);
 const system=['You design complex adult characters for an interactive story.','Return one complete JSON object matching the schema exactly.','Write vivid, concrete profiles, not generic archetype summaries. Characters must have contradictions, boundaries, needs, flaws, and an agenda independent of the player.','Be specific, not generic: banned filler includes "kind", "mysterious", "loves to read", "enjoys music", "hard on the outside, soft inside", and any trait that fits half the cast. Prefer the odd, checkable detail (a named object, brand, place, food, habit, or number) over an adjective. Make this person unlike the other characters already in the cast.'].join(' ');
 const user=[
  premise&&`STORY PREMISE\n${premise}`,cast.length&&`EXISTING CAST (differ from these in voice, flaws, tastes and routine)\n${cast.join('\n')}`,setting&&`SETTING\n${setting}`,'CHARACTER BRIEF',clean(brief)||'Invent a memorable supporting character who belongs in this setting.',
  fixed?`The character's name is fixed as ${fixed}. Do not change it.`:'Invent a fitting full name.',pronouns?`Use these pronouns: ${pronouns}.`:'Choose fitting pronouns.',`The character is an adult. Use age ${Math.max(18,Math.min(120,Number(age)||21))} unless the brief clearly requires another adult age.`,
  'PERSONALITY: Explain how they present themselves, who they are when their guard drops, what they need from people, and the flaw that pushes people away. Include a specific contradiction or quirk.',
  'LIKES AND DISLIKES: 3-6 each, as short concrete nouns or activities a player could literally mention or gift (e.g. "cheap gas-station coffee", "people who chew loudly"), never abstract values like "honesty". At least one dislike should be something a decent person might do innocently.',
  'FLAWS: 2-3 specific, scene-usable faults shown by behavior (e.g. "keeps score of favors and brings them up weeks later"), not labels like "stubborn". They should cost the character something.',
  'ROUTINE: 3-5 grounded habits tied to times or places in this setting (e.g. "eats lunch alone on the north stairwell to avoid the cafeteria"), usable as schedule and scene hooks.',
  'BEHAVIOR: Write one third-person sentence for each of withStrangers, withFriends, withCrush, withLover, and withEnemy. Real people behave differently in each relationship.',
  'BACKSTORY AND GOAL: Give one past influence not already repeated from the personality, then one concrete current goal that can drive scenes.',
  `TRAITS: Pick only genuinely fitting switches from: ${CHARACTER_TRAITS.join(', ')}. Most characters should receive zero or one.`,
  'VOICE AND STYLE: voice describes recognizable speaking habits. style is a compact instruction for dialogue generation. examples contains 2-4 exact sample lines with no speaker label.',
  'CONVERSATION STARTERS: Give 3-5 short lines a player might naturally say to this character.','DESCRIPTION: Describe visible appearance and everyday clothing in one concise paragraph; do not describe personality here.','year, major, and dorm are setting-neutral labels: use rank/occupation/home equivalents when this is not a university story.'
 ].filter(Boolean).join('\n\n');
 return {messages:[{role:'system',content:system},{role:'user',content:user}],schema};
}

export function normalizeCharacter(raw,pack,{name='',pronouns='',age=21,location}={}){
 const x=parseModelObject(raw),fullName=clean(name)||clean(x.name);if(!fullName)throw Error('Generated character needs a name');
 const base=(fullName.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'character').slice(0,48);let id=base,n=2;const used=new Set((pack.actors||[]).map(a=>a.id));while(used.has(id))id=`${base.slice(0,44)}-${n++}`;
 const behavior=Object.fromEntries(behaviorKeys.map(k=>[k,clean(x.behavior?.[k])]));for(const [k,v] of Object.entries(behavior))if(!v)throw Error(`Generated character is missing ${k} behavior`);
 const actor={id,name:fullName,location:location||(pack.locations||[])[0]?.id||'start',pronouns:clean(pronouns)||clean(x.pronouns)||'they/them',age:Math.max(18,Math.min(120,Number(x.age)||Number(age)||21)),description:clean(x.description),personality:clean(x.personality),behavior,backstory:clean(x.backstory),goal:clean(x.goal),traits:list(x.traits).filter(t=>CHARACTER_TRAITS.includes(t)),likes:list(x.likes),dislikes:list(x.dislikes),voice:clean(x.voice),style:clean(x.style),examples:list(x.examples,4),conversationStarters:list(x.conversationStarters,5),flaws:list(x.flaws,4),routine:list(x.routine,6),year:clean(x.year),major:clean(x.major),dorm:clean(x.dorm)};
 for(const key of ['description','personality','backstory','goal','voice','style'])if(!actor[key])throw Error(`Generated character is missing ${key}`);return actor;
}

export function characterResponseFormat(){return {type:'json_schema',json_schema:{name:'character',strict:true,schema}};}
