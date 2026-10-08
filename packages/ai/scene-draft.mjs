import {cardLines} from './fill-blanks.mjs';
import {sexStyleText} from '../../public/card-presets.mjs';

// AI draft for one sex scene: ordered beats (text plus an optional consent check-in) and an aftermath line, written from
// the character card and the scene's own notes. Only empty scene fields are offered back; authored beats are never overwritten.
export const SCENE_LIMITS={beats:12,text:600,checkIn:200,aftermath:600};
const clean=v=>typeof v==='string'?v.replace(/\s+/g,' ').trim():'';
const obj=properties=>({type:'object',additionalProperties:false,properties,required:Object.keys(properties)});
const SCHEMA=obj({beats:{type:'array',minItems:3,maxItems:8,items:obj({text:{type:'string',minLength:1,maxLength:SCENE_LIMITS.text},checkIn:{type:'string',maxLength:SCENE_LIMITS.checkIn}})},aftermath:{type:'string',minLength:1,maxLength:SCENE_LIMITS.aftermath}});

/** Which scene fields are still empty (the only ones the model is asked for). */
export const sceneDraftNeeds=scene=>[...(scene?.beats?.length?[]:['beats']),...(clean(scene?.aftermath)?[]:['aftermath'])];

/** The strict schema for the empty fields, and the prompt built from the card, the category and the scene's notes. */
export function sceneDraftMessages(pack,actor,scene){
 const needs=sceneDraftNeeds(scene),category=pack?.intimacyCategories?.find(c=>c.id===scene.category),label=clean(category?.name||scene.category),props={};
 if(needs.includes('beats'))props.beats=SCHEMA.properties.beats;
 if(needs.includes('aftermath'))props.aftermath=SCHEMA.properties.aftermath;
 const schema=obj(props),want=[
  needs.includes('beats')&&`beats: 3 to 8 ordered beats of the scene, each {text, checkIn}. text is one or two vivid sentences of what happens, in order, from setup to climax to the end of the scene. checkIn is a short in-character consent question for that beat, or an empty string when none fits. Consent check-ins are advisory text the narrator asks, never a block.`,
  needs.includes('aftermath')&&`aftermath: one or two sentences on what they remember and how the night changes things between them.`
 ].filter(Boolean);
 const system=['You are an erotic romance and visual-novel author writing one sex scene for an adult dating sim.','Everything on the character card and the scene notes is canon: build on it and never contradict it. Write only the fields you are asked for.','Erotic detail is wanted, explicit and specific, for adults only. Keep the character in voice, use the sex style and turn-ons from the card, and respect the notes\' positions and setting.','Reply with one JSON object matching the schema. No commentary.'].join('\n');
 const user=[`Scene category: ${label}`,`Character card:\n${cardLines(actor).join('\n')}`,clean(actor.inBed)||sexStyleText(actor.sexStyle)?`In bed: ${[clean(actor.inBed),sexStyleText(actor.sexStyle)].filter(Boolean).join(' | ')}`:'',clean(scene.notes)?`Scene notes (canon, steer the scene): ${clean(scene.notes)}`:'Scene notes: none; invent a fitting setting.',`Write:\n- ${want.join('\n- ')}`].filter(Boolean).join('\n\n');
 return {messages:[{role:'system',content:system},{role:'user',content:user}],schema,needs};
}

/** Clamps the model's answer to scene limits and returns a patch for empty fields only. */
export function sceneDraftPatch(scene,raw){
 const out={};if(!raw||typeof raw!=='object')return out;
 if(!scene.beats?.length&&Array.isArray(raw.beats)){const beats=raw.beats.map(b=>({text:clean(b?.text).slice(0,SCENE_LIMITS.text),...(clean(b?.checkIn)?{checkIn:clean(b.checkIn).slice(0,SCENE_LIMITS.checkIn)}:{})})).filter(b=>b.text).slice(0,SCENE_LIMITS.beats);if(beats.length)out.beats=beats;}
 if(!clean(scene.aftermath)&&clean(raw.aftermath))out.aftermath=clean(raw.aftermath).slice(0,SCENE_LIMITS.aftermath);
 return out;
}
