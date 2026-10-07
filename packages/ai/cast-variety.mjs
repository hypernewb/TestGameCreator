import {listsFor,SEX_SLIDERS} from '../../public/card-presets.mjs';

// Cast variety for generated erotic-VN characters: a seeded erotic angle steers each new card away from the cast,
// and post-generation checks catch twins, slop names, contradictory tags and out-of-world items. Packs tune it with authoringVariety.
export const VARIETY_DEFAULTS=Object.freeze({
 bannedNames:['elara','elena','lyra','aria','seraphina','serenity','luna','nova','evelyn','isolde','vane','thorne','kaelen','kael','zephyr','raven','sable','blackwood','nightshade','silverleaf','ashford','sterling'],
 ages:[19,34],
 wounds:['abandoned by a parent','a betrayal by a best friend','grew up poor and is ashamed of it','a public humiliation that still burns','lost someone they loved and never grieved','was always the reliable one and never the wanted one','an ex who made them feel unlovable','raised to be perfect and terrified of failing','a talent they gave up for someone else','a family secret they carry alone','was the outsider wherever they lived','a reputation they did not earn and cannot shake'],
 anachronisms:[]
});
export const varietyOf=pack=>{const v=pack?.authoringVariety||{},arr=(x,d)=>Array.isArray(x)?x.map(s=>String(s).trim().toLowerCase()).filter(Boolean):d,ages=Array.isArray(v.ages)&&v.ages.length===2&&v.ages.every(Number.isFinite)?[Math.max(18,Math.min(...v.ages)),Math.min(120,Math.max(...v.ages))]:VARIETY_DEFAULTS.ages;return {bannedNames:[...new Set([...VARIETY_DEFAULTS.bannedNames,...arr(v.bannedNames,[])])],ages,wounds:arr(v.wounds,[]).length?arr(v.wounds,[]):VARIETY_DEFAULTS.wounds,anachronisms:arr(v.anachronisms,[])};};

const POLES=[['leads','a dominant who takes control','a submissive who wants to be taken','a switch who reads the partner and flips'],['exhibition','an exhibitionist who likes the risk of being seen','someone intensely private who only lets go behind a locked door','someone who acts shy but is secretly thrilled by almost being caught'],['intensity','playful and giggly in bed','intense, focused and almost solemn about it','tender and slow, then suddenly hungry']];
const rng=seed=>{let s=(Number(seed)>>>0)||0x9e3779b9;return ()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return (s>>>0)/4294967296;};};
const cast=pack=>(pack?.actors||[]).filter(a=>a&&a.id!==pack.playerId&&a.id!=='player');
const lc=v=>typeof v==='string'?v.toLowerCase():'';
const kinkText=a=>[a.kinks,...(a.turnOns||[]),a.inBed].map(lc).join(' ');

// One fresh erotic angle per new card: poles the cast lacks, a wound, 1-2 unused kinks, slider targets off the middle and an unused age.
export function eroticAngle(pack,seed=Date.now()){
 const r=rng(seed),pick=a=>a[Math.floor(r()*a.length)],v=varietyOf(pack),c=cast(pack),used=c.map(kinkText).join(' ');
 const lean=a=>{const l=a.sexStyle?.leads;return typeof l!=='number'?-1:l>=65?0:l<=35?1:2;},poles=POLES.map(([k,...opts],pi)=>{if(pi)return [k,pick(opts)];const counts=opts.map((_,i)=>c.filter(a=>lean(a)===i).length),min=Math.min(...counts);return [k,pick(opts.filter((_,i)=>counts[i]===min))];});
 const all=listsFor(pack).kinks.filter(k=>!/^(dominating|submitting|switch)$/i.test(k)),kinks=all.filter(k=>!used.includes(k.toLowerCase().replace(/\s*\(.*\)$/,''))),pool=kinks.length>=2?kinks:all,two=[pick(pool)];const second=pick(pool);if(second!==two[0]&&r()<.6)two.push(second);
 const wounds=v.wounds.filter(w=>!c.some(a=>lc(a.backstory).includes(w.split(' ').slice(-2).join(' ')))),wound=pick(wounds.length?wounds:v.wounds);
 const ages=[];for(let a=v.ages[0];a<=v.ages[1];a++)if(!c.some(x=>x.age===a))ages.push(a);const age=ages.length?pick(ages):v.ages[0]+Math.floor(r()*(v.ages[1]-v.ages[0]+1));
 const lead=poles[0][1],sliders=Object.fromEntries(SEX_SLIDERS.map(([k])=>[k,k==='leads'?(/dominant/.test(lead)?[75,95]:/submissive/.test(lead)?[5,25]:[40,60]):r()<.5?[5,28]:[72,95]]));
 return {seed:Number(seed)>>>0,leads:poles[0][1],exhibition:poles[1][1],intensity:poles[2][1],kinks:two,wound,age,sliders};
}
export const angleText=a=>`EROTIC ANGLE (follow it unless the brief says otherwise; it keeps the cast from blurring together)\n- In bed they are ${a.leads}; ${a.exhibition}; ${a.intensity}.\n- Their kinks centre on ${a.kinks.join(' and ')}.\n- Core wound behind the personality: ${a.wound}.\n- Age ${a.age}.\n- sexStyle targets: ${Object.entries(a.sliders).map(([k,[lo,hi]])=>`${k} ${lo}-${hi}`).join(', ')}. Avoid 30-70 on most sliders.`;

const HAIR=/^(black|blonde|brown|red|white|grey|silver|pink|blue|green|purple|orange|aqua|light_brown|dark_brown|auburn|dark_auburn|platinum_blonde|strawberry_blonde|copper|ginger|chestnut|honey_blonde|ash_blonde|teal|lavender|two-tone|multicolored|streaked)_hair$/;
const first=n=>lc(n).trim().split(/\s+/)[0]||'',last=n=>{const p=lc(n).trim().split(/\s+/);return p.length>1?p.at(-1):'';};
const STOP=new Set('the a an and or but of to in on at for with is are was be their them they his her she he who what when that this into from as by it its your you our not than then just like more most very only about over'.split(' '));
const grams=t=>{const w=lc(t).replace(/[^a-z' ]+/g,' ').split(/\s+/).filter(x=>x&&!STOP.has(x)),g=new Set();for(let i=0;i+1<w.length;i++)g.add(w[i]+' '+w[i+1]);return g;};

// Twins and slop: problems the model must fix on a retry. `fixedName` skips name checks when the creator chose the name.
export function castClashes(actor,pack,{fixedName=false}={}){
 const v=varietyOf(pack),others=cast(pack).filter(a=>a.id!==actor.id),out=[],nm=lc(actor.name).split(/\s+/);
 if(!fixedName){const bad=nm.filter(p=>v.bannedNames.includes(p));if(bad.length)out.push(`name ${actor.name} uses an overused fantasy-slop name (${bad.join(', ')}); pick a fresher name that fits the world`);
  for(const o of others){if(first(o.name)&&first(o.name)===first(actor.name))out.push(`first name ${first(actor.name)} is already used by ${o.name}`);if(last(actor.name)&&last(actor.name)===last(o.name))out.push(`surname ${last(actor.name)} is already used by ${o.name}; give them their own family`);}}
 const hair=(actor.appearanceTags||[]).filter(t=>HAIR.test(t));
 for(const o of others){const n=o.name||o.id;
  const shared=hair.filter(h=>(o.appearanceTags||[]).includes(h));if(shared.length)out.push(`hair colour ${shared.join(', ')} is the same as ${n}; choose a different colour`);
  if(actor.traits?.length&&o.traits?.length&&actor.traits.length===o.traits.length&&actor.traits.every(t=>o.traits.includes(t)))out.push(`traits ${actor.traits.join(', ')} are identical to ${n}'s`);
  if(lc(actor.major).trim()&&lc(actor.major).trim()===lc(o.major).trim())out.push(`role "${actor.major}" is the same as ${n}'s; give them a different place in the world`);
  if(Number.isFinite(actor.age)&&actor.age===o.age&&others.filter(x=>x.age===actor.age).length>=2)out.push(`age ${actor.age} is already shared by several cast members; choose another adult age`);
  const g=grams(actor.personality),h=grams(o.personality),same=[...g].filter(x=>h.has(x));if(same.length>=3)out.push(`personality repeats ${n}'s phrasing (${same.slice(0,3).join('; ')}); describe a different person`);
  const s=actor.sexStyle,t=o.sexStyle;if(s&&t&&SEX_SLIDERS.every(([k])=>typeof s[k]==='number'&&typeof t[k]==='number'&&Math.abs(s[k]-t[k])<=12))out.push(`sexStyle is nearly identical to ${n}'s; move several sliders`);
  if(lc(actor.kinks).trim()&&lc(actor.kinks).trim()===lc(o.kinks).trim())out.push(`kinks are identical to ${n}'s`);}
 const s=actor.sexStyle;if(s&&SEX_SLIDERS.filter(([k])=>typeof s[k]==='number').length>=4&&SEX_SLIDERS.every(([k])=>typeof s[k]!=='number'||(s[k]>=30&&s[k]<=70)))out.push('every sexStyle slider sits in the bland 30-70 middle; commit to clear leanings');
 return [...new Set(out)];
}

const GROUPS=[['build',[/^(petite|slim|skinny|slender|thin)$/,/^(plump|chubby|curvy|voluptuous|fat|thick_thighs)$/,/^(muscular|muscular_female|toned|athletic)$/]],['breasts',[/^(flat_chest|small_breasts|medium_breasts|large_breasts|huge_breasts|gigantic_breasts)$/]],['hair length',[/^(very_short_hair|short_hair|medium_hair|long_hair|very_long_hair|absurdly_long_hair)$/]],['hair colour',[HAIR]],['eye colour',[/^[a-z_]+_eyes$/]]];
const BOTTOM=[/(^|_)(skirt|dress)(_|$)/,/(^|_)(pants|trousers|jeans|shorts|leggings)(_|$)/];
const SINGLE=new Set(['breasts','hair length']);
const MULTI_OK=/^(heterochromia|multicolored_hair|two-tone_hair|streaked_hair|closed_eyes|half-closed_eyes|empty_eyes|glowing_eyes|rolling_eyes|crazy_eyes)$/;

// Contradictory danbooru tags on one card (and tags repeated between the look and the body lists).
export function tagContradictions(actor){
 const look=[...(actor.appearanceTags||[]),...(actor.bodyTags||[])],out=[];
 for(const [name,res] of GROUPS){const hits=res.map(re=>look.filter(t=>re.test(t)&&!MULTI_OK.test(t)));if(res.length>1){const used=hits.filter(h=>h.length);if(used.length>1)out.push(`${name} tags contradict: ${used.map(h=>h.join('/')).join(' vs ')}`);}else{const u=[...new Set(hits[0])];if(u.length>1&&(SINGLE.has(name)||!look.some(t=>MULTI_OK.test(t))))out.push(`${name} tags contradict: ${u.join(', ')}`);}}
 const outfit=actor.outfitTags||[],b=BOTTOM.map(re=>outfit.filter(t=>re.test(t)));if(b.every(x=>x.length)&&!outfit.some(t=>/skirt_over|under_skirt|pantyhose|leggings_under/.test(t)))out.push(`outfit mixes ${b[0].join('/')} with ${b[1].join('/')}; pick one bottom`);
 const dup=(actor.appearanceTags||[]).filter(t=>(actor.bodyTags||[]).includes(t));if(dup.length)out.push(`tags repeated in both appearanceTags and bodyTags: ${dup.join(', ')}`);
 return out;
}

// Out-of-world items a pack declares (e.g. phone, coffee, jeans in a medieval town); matched against tags and the appearance text.
export function anachronisms(actor,pack){
 const bad=varietyOf(pack).anachronisms;if(!bad.length)return [];
 const tags=[...(actor.appearanceTags||[]),...(actor.outfitTags||[]),...(actor.bodyTags||[]),...Object.values(actor.outfitSets||{}).flat()],text=[actor.description,...(actor.likes||[]),...(actor.dislikes||[]),actor.major,actor.dorm].map(lc).join(' ');
 const hit=bad.filter(w=>tags.some(t=>t===w.replace(/\s+/g,'_')||t.split('_').includes(w.replace(/\s+/g,'_')))||new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}s?\\b`).test(text));
 return hit.length?[`out of place in this world: ${hit.join(', ')}; replace them with something that belongs here`]:[];
}
export const characterProblems=(actor,pack,o)=>[...castClashes(actor,pack,o),...tagContradictions(actor),...anachronisms(actor,pack)];

// Last resort after the retry: drop the contradicting/out-of-world tags so the card is usable; returns what still needs a human look.
export function repairCharacter(actor,pack){
 const a=structuredClone(actor),bad=varietyOf(pack).anachronisms.map(w=>w.replace(/\s+/g,'_')),off=t=>bad.some(w=>t===w||t.split('_').includes(w)),K=['appearanceTags','bodyTags'];
 for(const k of ['appearanceTags','outfitTags','bodyTags'])if(Array.isArray(a[k]))a[k]=a[k].filter(t=>!off(t));for(const k of Object.keys(a.outfitSets||{}))if(Array.isArray(a.outfitSets[k]))a.outfitSets[k]=a.outfitSets[k].filter(t=>!off(t));
 for(const k of K)a[k]=Array.isArray(a[k])?a[k]:[];a.bodyTags=a.bodyTags.filter(t=>!a.appearanceTags.includes(t));
 const multi=()=>[...a.appearanceTags,...a.bodyTags].some(t=>MULTI_OK.test(t));
 for(const [name,res] of GROUPS){if(res.length>1){const firstRe=res.find(re=>K.some(k=>a[k].some(t=>re.test(t))));if(firstRe)for(const re of res)if(re!==firstRe)for(const k of K)a[k]=a[k].filter(t=>!re.test(t));continue;}
  if(!SINGLE.has(name)&&multi())continue;let seen=false;for(const k of K)a[k]=a[k].filter(t=>{if(!res[0].test(t)||MULTI_OK.test(t))return true;if(seen)return false;return seen=true;});}
 const o=a.outfitTags||[];if(BOTTOM.every(re=>o.some(t=>re.test(t))))a.outfitTags=o.filter(t=>!BOTTOM[1].test(t));
 return {actor:a,warnings:characterProblems(a,pack)};
}
