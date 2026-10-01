// M3 director library: code owns every beat shape (kind, roles, trust gates, tone, numbers, deadlines); a world only fills text.
// Owner calls (2026-09-30): roles are love interests only (no invented rivals); invites and goals arrive by phone, trouble lands
// in-scene; the director steps in after one quiet daypart. Text uses {lead}/{rival} literally and baking puts the names in.
import {readFileSync,existsSync} from 'node:fs';
import {join,dirname,basename} from 'node:path';
import {TONES} from './beat-library.mjs';
import {bakeDirectorTemplates} from './director-templates.mjs';

export const TONE_CEILINGS=['grounded','soap','melodrama'];
export const DIRECTOR_PROFILE={quietDayparts:1,jitter:12,maxPerDay:2,opportunitiesPerDay:2,firstTick:4};
// choices: tones per role in role order (null leaves that role alone). gate: minimum trust per role. Goals: deadline in ticks (12 = a day).
// phone: true texts from {lead}, or names the role that sends it. dayparts: when the beat may land (a late-night text waits for Evening).
// spent: roles the player must have spent real recent time with (the director's attention meter, 1–10) before the beat may claim it.
// maxUses/cooldownTicks count the beat across all its castings (one "spark" per run, not one per pair); minTick holds a beat back (12 = Day 2).
// maxUses/cooldownTicks: gentle beats may land more than once (the baked scene is repeatable), spaced by cooldown
// (12 ticks = a day); once the whole deck is spent, repeatable beats are what the director recycles. Climaxes stay one-shot.
// Incident beats always travel to the player — the text brings the cast to wherever the player already is, so it must never
// name a place or claim shared history; only phone beats may move the player, because the player chooses to go.
export const DIRECTOR_LIBRARY=[
 {id:'invite',kind:'event',tone:1,roles:['lead'],gate:{lead:15},phone:true,maxUses:3,cooldownTicks:24,choices:[['good'],['light']],about:'{lead} texts you an invitation to something she is doing today, and you go'},
 {id:'hand',kind:'event',tone:1,roles:['lead'],gate:{lead:10},phone:true,maxUses:3,cooldownTicks:24,choices:[['careful'],['flat']],about:'{lead} is stuck with a chore or small problem and asks for your help'},
 {id:'crowd',kind:'event',tone:2,roles:['lead','rival'],gate:{lead:20,rival:20},phone:true,choices:[['good','miss'],['light','light'],['miss','good']],about:'a party or gathering where {lead} and {rival} are both there and both want your time'},
 {id:'bad-day',kind:'obstacle',tone:1,roles:['lead'],focus:'lead',gate:{lead:20},maxUses:2,cooldownTicks:36,choices:[['careful'],['flat'],['miss']],about:'{lead} turns up still fuming from a bad day and snaps at you; it is not really about you'},
 {id:'saw-you',kind:'obstacle',tone:2,roles:['lead','rival'],focus:'lead',gate:{lead:20,rival:25},choices:[[null,'careful'],[null,'light'],[null,'miss']],about:'{rival} comes looking for you, saw you with {lead}, and is hurt, cool and short with you'},
 {id:'rumor',kind:'obstacle',tone:2,roles:['lead','rival'],focus:'lead',gate:{lead:25,rival:20},choices:[[null,'careful'],['miss','light'],['flat','flat']],about:'a rumor about you and {lead} is going round, and {rival} comes to ask you if it is true'},
 {id:'showdown',kind:'obstacle',tone:3,roles:['lead','rival'],focus:'lead',gate:{lead:30,rival:30},choices:[['good','miss'],['miss','good'],['light','light']],about:'{lead} and {rival} arrive already clashing over you, and both look at you'},
 {id:'promise',kind:'goal',tone:1,roles:['lead'],focus:'lead',gate:{lead:15},phone:true,choices:[['spark'],['flat']],goal:{deadlineTicks:12,cost:3},about:'{lead} asks you to come find her before this time tomorrow; the first choice says yes'},
 {id:'big-night',kind:'goal',tone:2,roles:['lead'],focus:'lead',gate:{lead:30},phone:true,choices:[['good'],['flat']],goal:{deadlineTicks:24,cost:6},about:'{lead} has something that matters to her in the next two days (a show, a result, a hard call) and asks you to be there; the first choice promises'},
 {id:'spark',kind:'temptation',tone:1,roles:['lead','rival'],focus:'lead',gate:{rival:15},minTick:12,spent:{lead:5},choices:[[null,'spark'],[null,'flat']],about:'you and {lead} have genuinely been close lately (the engine checks your recent time together), and {rival} seeks you out to flirt with you'},
 {id:'late-text',kind:'temptation',tone:2,roles:['lead','rival'],focus:'lead',gate:{rival:25},dayparts:['Evening'],phone:'rival',maxUses:2,cooldownTicks:36,choices:[[null,'spark'],[null,'careful']],about:'after dark {rival} texts you something that is more than friendly'},
 {id:'close-call',kind:'temptation',tone:3,roles:['lead','rival'],focus:'lead',gate:{rival:35},choices:[[null,'good'],[null,'careful']],about:'{rival} tracks you down, leans in to kiss you, and {lead} is not far away; stepping back is warm and costs nothing'},
];
export const libraryEntry=id=>DIRECTOR_LIBRARY.find(x=>x.id===id);

// Library + text → director templates (the director-templates.mjs input). `text(value,path)` is the assembler's slot filler.
// cast: how many love interests there are; beats needing more roles than that are left out (no blank text for them).
export function directorTemplates(beats={},text=v=>v,cast=4){
 return DIRECTOR_LIBRARY.filter(L=>L.roles.length<=cast).map(L=>{const x=beats[L.id]||{},at=`director.beats.${L.id}`;
  const effects=ts=>ts.flatMap((t,i)=>{if(!t)return [];const [chem,trust]=TONES[t],c=`@${L.roles[i]}`;return [{type:'chemistry',character:c,delta:chem,reason:'how the moment went'},...(trust?[{type:'trust',character:c,delta:trust}]:[])];});
  const choice=(ts,i,p,src)=>({id:`choice-${i+1}`,label:text(src?.[i]?.label,`${p}.choices.${i}.label`),result:text(src?.[i]?.result,`${p}.choices.${i}.result`),effects:effects(ts)});
  const t={id:L.id,kind:L.kind,tone:L.tone,roles:Object.fromEntries(L.roles.map(r=>[r,{pool:'dating'}])),...(L.focus?{focusRole:L.focus}:{}),
   ...(L.maxUses?{maxUses:L.maxUses}:{}),...(L.cooldownTicks?{cooldownTicks:L.cooldownTicks}:{}),...(L.minTick?{minTick:L.minTick}:{}),
   when:{trust:Object.fromEntries(Object.entries(L.gate).map(([r,v])=>[`@${r}`,v])),
    ...(L.spent?{attention:Object.fromEntries(Object.entries(L.spent).map(([r,v])=>[`@${r}`,v]))}:{}),
    ...(L.dayparts?{dayparts:L.dayparts}:{})},
   scene:{title:text(x.title,`${at}.title`),opening:text(x.opening,`${at}.opening`),choices:L.choices.map((ts,i)=>choice(ts,i,at,x.choices))}};
  if(L.phone){const from=L.phone===true?'lead':L.phone,ph=text(x.phone,`${at}.phone`);t.phone={character:`@${from}`,text:typeof ph==='string'?ph.replace(/^\{(lead|rival)\}\s*:\s*/,''):ph};}// the phone shows the sender: drop a drafted "{lead}:" prefix
  if(L.goal)t.goal={deadlineTicks:L.goal.deadlineTicks,missed:{kind:'relationship',cost:L.goal.cost},kept:{title:text(x.kept?.title,`${at}.kept.title`),opening:text(x.kept?.opening,`${at}.kept.opening`),choices:[choice(['best'],0,`${at}.kept`,x.kept?.choices)]}};
  return t;});
}

// Put the director into a pack: library templates baked over its love interests, every one of them a phone contact.
export function withDirector(pack,{beats,tone='soap',text}={}){
 if(!TONE_CEILINGS.includes(tone))throw new Error(`director tone must be one of ${TONE_CEILINGS}`);
 const heroines=(pack.datingProfiles||[]).map(d=>d.character),contacts=[...new Set([...(pack.phoneContacts||[]),...heroines])];
 const p={...pack,modules:{...pack.modules,'social.phone':pack.modules['social.phone']||'0.1.0','story.director':'0.1.0'},phoneContacts:contacts,phoneMessages:pack.phoneMessages||[],directorProfile:{...DIRECTOR_PROFILE,...pack.directorProfile,toneCeiling:tone}};
 return bakeDirectorTemplates(p,directorTemplates(beats,text,heroines.length));
}
// Pack files: a drafted packs/director/<file> ({tone,beats}, from scripts/draft-world.mjs --director) is baked in at load time.
export const readPack=file=>{const p=JSON.parse(readFileSync(file,'utf8')),o=join(dirname(file),'director',basename(file));return existsSync(o)?withDirector(p,JSON.parse(readFileSync(o,'utf8'))):p;};
export const DIRECTOR_NOTE='Director beats are shared by every love interest: write {lead} and {rival} literally (code puts in names and pronouns), keep them to what any of them could say, and never name one. Incident beats happen wherever the player already is: the cast comes to the player inside the scene, so never name a place (no "by the library steps"), never claim shared history ("we spent all week together" — beats gated on real time together are the only exception), and never narrate the player travelling. Only phone beats may move the player, because the player chooses to go.';
// Drafting help: what a director slot is for, for the cloud drafter.
export function directorHint(path){
 const m=path.match(/^director\.beats\.([\w-]+)\.(.+)$/),L=m&&libraryEntry(m[1]);if(!L)return null;
 const f=m[2];
 const c=f.match(/^(kept\.)?choices\.(\d+)\.(label|result)$/),tones=c&&(c[1]?['best']:L.choices[c[2]]);
 const toneTxt=tones&&tones.map((t,i)=>t&&`for {${L.roles[i]}} ${t==='miss'?'it lands badly':t==='flat'?'it changes little':'it lands'}`).filter(Boolean).join(', ');
 const what=f==='title'?'scene title, 2–5 words':f==='opening'?`what happens right here, right now, 2–3 sentences, present tense; the scene happens wherever the player already is, so never name a place, never claim shared history, and never move the player — the cast comes to them`:f==='phone'?'her text message that starts it, 1 sentence, in her voice, no name prefix (this beat may move the player — she is calling them to her)':f==='kept.title'?'title of the scene where you keep the promise':f==='kept.opening'?'you show up as promised; 1–2 sentences':c?.[3]==='label'?'the player\'s choice, first person, under 10 words':'what happens after that choice, 1–2 sentences';
 return `${L.kind} beat: ${L.about}. ${what}${toneTxt?` (${toneTxt})`:''}`;
}
