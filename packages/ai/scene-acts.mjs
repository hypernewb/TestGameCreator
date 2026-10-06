// The model tags what the player did; the engine (social.acts) prices it. Tags are untrusted text: a closed kind list,
// short slug targets, at most four per reply. See docs/handoffs/M0-CONTRACT.md §1.
import {mapTouchText,touchTextRegion,touchRegion} from '../modules/touch-ladder.mjs';
import {REGIONS} from '../core/character-sheet.mjs';
export const ACT_KINDS=['flirt','compliment','gift','touch','insult','buy','invite','tease','listen','boast','pushy','ask'];
// Only explicit performance requests are graded; questions and descriptions of preferences are ordinary talk.
export function deliveryAct(text,pack){
 const clauses=String(text||'').toLowerCase().split(/\b(?:and|then|while)\b|[.!;]/),patterns={touch:'touch|hold|hug|kiss|caress',physical:'lift|carry|dance',flirt:'flirt',compliment:'compliment',joke:'joke|tell (?:her |him |them )?a joke',tease:'tease','help-study':'help (?:her |him |them )?study',boast:'boast'};
 for(const [kind,verbs] of Object.entries(patterns)){const clause=pack.deliveryStats?.[kind]&&clauses.find(c=>new RegExp(`^\\s*(?:(?:i|you)\\s+)?(?:${verbs})\\b`).test(c));if(clause){const target=kind==='touch'?mapTouchText(clause)||kind:kind;return {kind,target,size:'small',...(kind==='touch'?{region:touchTextRegion(clause)||touchRegion(target)}:{})};}}
 return null;
}
const SIZES=['small','medium','large'];
export const actsEnabled=(context,pack)=>Boolean(pack.modules?.['social.acts']&&context.sceneBudget?.focus&&(pack.actProfiles||[]).some(p=>p.character===context.sceneBudget.focus));
export function sceneActs(raw){
 if(!Array.isArray(raw))return [];const out=[],seen=new Set();
 for(const a of raw){if(!a||typeof a!=='object'||!ACT_KINDS.includes(a.kind))continue;
  const target=String(a.target??'').toLowerCase().trim().replace(/\s+/g,'-').replace(/[^a-z0-9@:_-]/g,'').slice(0,40),key=`${a.kind}:${target}`;if(seen.has(key))continue;seen.add(key);
  out.push({kind:a.kind,target,size:SIZES.includes(a.size)?a.size:'small',...(typeof a.landed==='boolean'?{landed:a.landed}:{}),...(REGIONS.includes(a.region)?{region:a.region}:{})});if(out.length>=4)break;}
 return out;
}
export const actsSchema={type:'array',maxItems:4,items:{type:'object',properties:{kind:{type:'string',enum:ACT_KINDS},target:{type:'string'},size:{type:'string',enum:SIZES},landed:{type:'boolean'},region:{type:'string',enum:REGIONS}},required:['kind','target']}};
export const ACTS_RULE='In acts, tag what the player did to the focus character this turn, at most four: {kind,target,size,landed,region?}. Optional region names the touched sheet body region (face, lips, neck, arms_hands, chest, back, belly_waist, hips_butt, thighs_legs, intimate); it never supplies permission. kind is one of '+ACT_KINDS.join(', ')+'; ask means asking her what she wants or checking in (for example, "Is this okay?"). target is one or two words (looks, coffee); an invite to meet later is day-part@place (saturday-afternoon@cafe, tonight@bar); size is small, medium or large; landed is your read of whether it went over well. Tag only what the player action did, never the NPC. Do not supply scores, rewards, checkpoint verdicts, completion, or consent. Sharing something personal with her or picking up on what she just said is a small listen. Return [] only when the player does nothing toward her (travel, waiting, looking around).';
// Deterministic floor (owner call 2026-09-29): a typed question that names one of her likes is a small listen even when a small model tags it as plain talk. Repeat decay in social.acts stops farming.
const STOP=new Set(['the','and','for','old','being','about','asked','taken','seriously','good','with','that','your','their','her','back','people','who','anyone','dominik','told','what','she','wants','called']);
const slug=x=>String(x).toLowerCase().trim().replace(/\s+/g,'-').replace(/[^a-z0-9@:_-]/g,'').slice(0,40);
// A topic is named by any content word; one made only of filler ("being taken seriously") needs its phrase minus a leading "being".
export const names=(line,topic)=>{const t=String(topic).toLowerCase(),key=(t.match(/\p{L}{3,}/gu)||[]).filter(w=>!STOP.has(w)),phrase=t.replace(/^being\s+/,'').trim();return key.length?key.some(w=>new RegExp(`(?<!\\p{L})${w}`,'u').test(line)):Boolean(phrase)&&line.includes(phrase);};
export function typedListen(acts,text,actor){
 const line=String(text||'').toLowerCase();if(!line.includes('?')||acts.some(a=>a.kind==='listen'))return acts;
 const like=[].concat(actor?.likes||[]).find(x=>names(line,x));
 return like&&acts.length<4?[...acts,{kind:'listen',target:slug(like),size:'small'}]:acts;
}
// Risky (owner call 2026-09-29): a question about something she can't stand is neutral once; asking again prices the pack's exact
// pushy:<dislike> entry. Only when the pack has that entry, so no pack falls through to a big pushy:* wildcard. `before` = earlier player lines to her.
export function typedDislike(acts,text,actor,profile,before=[]){
 const line=String(text||'').toLowerCase();if(!line.includes('?')||acts.length>=4)return acts;
 const hit=[].concat(actor?.dislikes||[]).find(x=>names(line,x)&&(profile?.entries||[]).some(e=>e.kind==='pushy'&&e.target===slug(x)));
 return hit&&before.some(b=>names(String(b||'').toLowerCase(),hit))&&!acts.some(a=>a.kind==='pushy'&&a.target===slug(hit))?[...acts,{kind:'pushy',target:slug(hit),size:'small'}]:acts;
}
// Confrontation claims (M4): the model classifies the player's answer to an accusation; the engine (social.secrecy) prices it.
export const CLAIM_STANCES=['admit','deny','deflect','apologize'];
export const claimsSchema={type:'array',maxItems:1,items:{type:'object',properties:{stance:{type:'string',enum:CLAIM_STANCES}},required:['stance']}};
export const CLAIMS_RULE='In claims, when the player action this turn is an answer to her demand, classify it as exactly one {stance}: admit (owns what she saw), deny (says it did not happen), deflect (dodges or changes the subject), apologize (sorry without owning it). If the action is not an answer to her, return [].';
export const sceneClaims=raw=>Array.isArray(raw)&&raw[0]&&CLAIM_STANCES.includes(raw[0].stance)?raw[0].stance:null;
