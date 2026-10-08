import {listsFor,tropesFor,blankFields,sexStyleText,splitPicks,tagOf,SEX_SLIDERS,TEXT_PICKS,TAG_PICKS,LOOK_GROUPS} from '../../public/card-presets.mjs';
import {CHARACTER_TRAITS} from '../../public/character-traits.mjs';

// "Fill blanks" for one card fold: the model writes only fields that are still empty, picks list fields from the
// project's pick lists (two custom extras allowed), and treats everything already on the card as authored canon.
const clean=v=>typeof v==='string'?v.replace(/\s+/g,' ').trim():'';
const STR={type:'string',minLength:1,maxLength:900},strs=(min,max)=>({type:'array',items:{type:'string',minLength:1,maxLength:120},minItems:min,maxItems:max});
const obj=properties=>({type:'object',additionalProperties:false,properties,required:Object.keys(properties)});
const BEHAVIOR={withStrangers:'strangers',withFriends:'friends',withCrush:'a crush',withLover:'a lover',withEnemy:'someone they dislike'};
const NEST={outfitSets:1,expressionTags:1};
// Model key for a card path: nested picks flatten to their last segment; behavior/sexStyle stay grouped.
// Free tag/list fields whose Studio checkbox lists steer the model without restricting it.
const SUGGEST={appearanceTags:LOOK_GROUPS.map(([k,l])=>['LOOK TAGS: '+l.toUpperCase(),k]),outfitTags:[['OUTFIT TAGS','outfit']],likes:[['LIKES','likes']],dislikes:[['DISLIKES','dislikes']]};
const keyOf=p=>p.includes('/')&&NEST[p.split('/')[0]]?p.split('/')[1]:p;
const GUIDE={
 personality:'One colourful paragraph starting "<Name> is a": how they present themselves, who they are when their guard drops, what they need, and the flaw in the way.',
 goal:'One concrete thing they are working toward right now that can pull the player into scenes.',
 major:'Their role in this world in two to four words (barmaid, second-year nursing student, dock captain).',
 appearanceTags:'5-10 Danbooru-style look tags (hair, eyes, build, face): long_hair, green_eyes, freckles.',
 description:'Two or three sentences on what they look like and usually wear. No personality.',
 outfitTags:'4-8 Danbooru-style tags for their everyday outfit, fitting the world.',
 traits:'Zero to three of the listed traits; most people have none or one.',
 backstory:'Something in their past that still affects the way they act, not already in the personality.',
 likes:'3-5 specific things they like.',dislikes:'3-5 specific things they dislike.',
 behavior:'For each listed relationship, one or two sentences in the third person with their name, naming the relationship ("Around friends, Mira..."). Make them differ.',
 datingHistory:'A sentence or two: exes, flings, crushes that went nowhere, or nobody at all. Consistent with Virgin.',
 datingPreference:'What they want romantically and sexually.',kinks:'What they fantasize about, giving or receiving.',
 turnOns:'What gets them going.',turnOffs:'What kills the mood.',afterSex:'What they want afterwards.',
 sexStyle:'Each listed slider is a whole number 0-100 between the two poles; commit to clear leanings (under 30 or over 70) where the character is clear, 40-60 only when genuinely in between.',
 inBed:'One or two sentences on anything about them in bed the picks and sliders do not already say: what they ask for, what they say, a habit.',
 bodyTags:'Danbooru-style body tags: chest, hips, build, skin, marks.',underwear:'Danbooru-style underwear tags.',sleep:'Danbooru-style sleepwear tags.',swim:'Danbooru-style swimwear tags.',aroused:'Danbooru-style tags for their aroused face.'
};
const listKey=k=>['turnOns','turnOffs',...TEXT_PICKS,...TAG_PICKS].includes(k);

/** The fold's blank fields, the strict schema for exactly those, and the prompt. */
export function fillBlanksMessages(pack,actor,section){
 const blanks=blankFields(actor,section),lists=listsFor(pack),props={},want=[];
 for(const p of blanks){const k=keyOf(p);
  if(p.startsWith('sexStyle/')){props.sexStyle||=obj({});props.sexStyle.properties[k.split('/')[1]]={type:'integer',minimum:0,maximum:100};props.sexStyle.required=Object.keys(props.sexStyle.properties);continue;}
  if(p.startsWith('behavior/')){props.behavior||=obj({});props.behavior.properties[k.split('/')[1]]=STR;props.behavior.required=Object.keys(props.behavior.properties);continue;}
  if(listKey(k)){props[k]={type:'array',items:{type:'string',enum:[...new Set(lists[k])]},minItems:k==='datingPreference'?1:2,maxItems:k==='datingPreference'?2:6};props[k+'Extra']=strs(0,2);continue;}
  props[k]=k==='traits'?{type:'array',items:{type:'string',enum:CHARACTER_TRAITS},minItems:0,maxItems:3}:['appearanceTags','outfitTags'].includes(k)?strs(4,10):['likes','dislikes'].includes(k)?strs(3,5):STR;}
 for(const k of Object.keys(props))if(!k.endsWith('Extra'))want.push(k==='sexStyle'?`sexStyle (${Object.keys(props.sexStyle.properties).map(s=>{const [,lo,hi]=SEX_SLIDERS.find(x=>x[0]===s);return `${s}: 0 ${lo} … 100 ${hi}`;}).join('; ')}): ${GUIDE.sexStyle}`:k==='behavior'?`behavior (${Object.keys(props.behavior.properties).map(b=>`${b}: with ${BEHAVIOR[b]}`).join('; ')}): ${GUIDE.behavior}`:`${k}: ${GUIDE[k]||''}${listKey(k)?` Pick from the list; put anything essential that is missing in ${k}Extra (at most two, short).`:''}`);
 const schema=obj(props),trope=actor.trope&&tropesFor(pack).find(t=>t.id===actor.trope);
 const card=cardLines(actor),others=castLines(pack,actor),world=[clean(pack?.title),clean(pack?.subtitle)].filter(Boolean).join(': '),premise=clean(pack?.gameProject?.premise),setting=clean(pack?.gameProject?.setting);
 const system=['You are an erotic romance and visual-novel author finishing a character card for an adult dating sim.','The creator already wrote part of this card. Everything on it is canon: build on it, match it and never contradict it. Fill ONLY the blank fields you are asked for.','Characters are attractive, sexy or cute in their own specific way. Erotic detail is wanted, explicit and specific, for adults only.','Pick list fields from the given lists: choose what fits this exact person, not the most generic options, and keep each pick consistent with the rest of the card (a shy virgin does not lead; a domme does not list submitting).','Write prose like a person describing a friend: warm, specific and flowing. No semicolons, no em dashes, no lists of adjectives, no clipped telegraph sentences.','Match the genre, era and tone of the world: clothes, jobs and slang belong to it.','Return only the JSON object.'].join('\n');
 const user=[world&&`WORLD\n${world}`,premise&&`STORY PREMISE\n${premise}`,setting&&`SETTING\n${setting}`,trope&&`TROPE\n${trope.name}: ${trope.blurb||''}`,`THE CARD SO FAR (authored, keep it)\n${card.join('\n')}`,others.length&&`OTHER CAST (already in the game: make this character clearly different from each of them in look, role, temperament and wants)\n${others.join('\n')}`,
  `FILL THESE BLANKS\n${want.map(w=>'- '+w).join('\n')}`,
  ...Object.keys(props).flatMap(k=>(SUGGEST[k]||[]).map(([l,lk])=>`${l} (prefer these, add your own when nothing fits)
${[...new Set(lists[lk])].join(', ')}`)),
  ...Object.keys(props).filter(listKey).map(k=>`${k.toUpperCase()} LIST\n${[...new Set(lists[k])].join(', ')}`)].filter(Boolean).join('\n\n');
 return {messages:[{role:'system',content:system},{role:'user',content:user}],schema,blanks};
}
export const fillBlanksResponseFormat=schema=>({type:'json_schema',json_schema:{name:'blanks',strict:true,schema}});

// One short line per other cast member so a filled card does not come out as a twin of someone already there.
function castLines(pack,a){return (pack?.actors||[]).filter(x=>x&&x.id!==a.id&&x.id!==pack.playerId).slice(0,8).map(x=>'- '+[clean(x.name||x.id),clean(x.major),(Array.isArray(x.appearanceTags)?x.appearanceTags:[]).slice(0,6).join(' '),clean(x.personality).split(/(?<=[.!?])\s/)[0].slice(0,200)].filter(Boolean).join(' | '));}
export function cardLines(a){const out=[],add=(label,v)=>{const s=Array.isArray(v)?v.filter(Boolean).join(', '):typeof v==='boolean'?(v?'yes':''):clean(String(v??''));if(s)out.push(`${label}: ${s}`);};
 add('Name',a.name);add('Pronouns',a.pronouns);add('Age',a.age);add('Role',a.major);add('Personality',a.personality);add('Goal',a.goal);add('Look tags',a.appearanceTags);add('Appearance',a.description);add('Outfit tags',a.outfitTags);add('Traits',a.traits);add('Backstory',a.backstory);add('Likes',a.likes);add('Dislikes',a.dislikes);
 for(const [k,who] of Object.entries(BEHAVIOR))add(`With ${who}`,a.behavior?.[k]);add('Dating history',a.datingHistory);add('Dating preference',a.datingPreference);add('Kinks',a.kinks);add('Virgin',a.isVirgin);add('Turn-ons',a.turnOns);add('Turn-offs',a.turnOffs);add('In bed (sliders)',sexStyleText(a.sexStyle));add('In bed',a.inBed);add('After sex',a.afterSex);add('Body tags',a.bodyTags);
 for(const k of ['underwear','sleep','swim'])add(`${k[0].toUpperCase()+k.slice(1)} tags`,a.outfitSets?.[k]);add('Aroused face tags',a.expressionTags?.aroused);return out.length?out:['(empty apart from what is asked)'];}

/** Turns the model's answer into a {path: value} patch for blank paths only; list fields keep on-list picks plus two extras. */
export function blanksPatch(actor,raw,section,pack){const lists=listsFor(pack),out={};if(!raw||typeof raw!=='object')return out;
 for(const p of blankFields(actor,section)){const k=keyOf(p);let v;
  if(p.startsWith('sexStyle/')||p.startsWith('behavior/')){const [g,s]=p.split('/');v=raw[g]?.[s];if(g==='sexStyle'){if(typeof v!=='number'||!Number.isFinite(v))continue;v=Math.max(0,Math.min(100,Math.round(v)));}else{v=clean(v);if(!v)continue;}out[p]=v;continue;}
  if(listKey(k)){const tag=TAG_PICKS.includes(k),norm=x=>tag?tagOf(x):clean(x),allowed=new Set(lists[k].map(norm));const picks=[...new Set([...(Array.isArray(raw[k])?raw[k]:[]).map(norm).filter(x=>allowed.has(x)),...(Array.isArray(raw[k+'Extra'])?raw[k+'Extra']:[]).map(norm).filter(x=>x&&x.length<=60).slice(0,2)])];if(!picks.length)continue;out[p]=TEXT_PICKS.includes(k)?picks.join(', '):picks;continue;}
  v=raw[k];if(k==='traits'){if(Array.isArray(v))out[p]=CHARACTER_TRAITS.filter(t=>v.includes(t));continue;}
  if(Array.isArray(v)){const tags=['appearanceTags','outfitTags'].includes(k);v=[...new Set(v.map(x=>tags?tagOf(x):clean(x)).filter(Boolean))];if(v.length)out[p]=v;}else if(clean(v))out[p]=clean(v);}
 return out;}
export {splitPicks};
