// ComfyUI prompts built from a character card's tag picks, world-neutral. Shared by the server (generation) and Studio (preview).
// pack.artStyle={style,negative} overrides the default anime look; extra tags typed beside a Generate button are appended.
export const ART_KINDS=['character','cg','background'];
export const EMOTION_TAGS={neutral:'neutral expression, closed mouth',smile:'smile, happy',flirty:'seductive smile, half-closed eyes, head tilt',embarrassed:'blush, embarrassed, looking away',smug:'smug, smirk',surprised:'surprised, open mouth, wide eyes',concerned:'worried, frown',aroused:'blush, heavy breathing, half-closed eyes, parted lips'};
export const BATCH_EMOTIONS=['neutral','smile','flirty','embarrassed','aroused'];
export const DEFAULT_ART={style:'masterpiece, best quality, very aesthetic, anime style',negative:'lowres, worst quality, bad quality, bad anatomy, bad hands, extra fingers, missing fingers, extra limbs, text, watermark, logo, signature, multiple views, character sheet, chibi, loli, child, underage',sceneNegative:'censored, mosaic censoring, bar censor, multiple girls, male focus, male face'};
const list=v=>(Array.isArray(v)?v:typeof v==='string'?v.split(','):[]).map(x=>String(x).trim()).filter(Boolean),tag=t=>t.replaceAll('_',' '),join=(...g)=>[...new Set(g.flatMap(list).map(tag))].join(', ');
const sexOf=a=>/^(she|her)\b/i.test(a?.pronouns||'')?'1girl':/^(he|him)\b/i.test(a?.pronouns||'')?'1boy':'1other';
export const artStyle=pack=>({...DEFAULT_ART,...Object.fromEntries(Object.entries(pack?.artStyle||{}).filter(([,v])=>typeof v==='string'&&v.trim()))});
// kind character: sprite on a plain background (the workflow cuts it out); cg: explicit POV scene with the player; background: an empty location.
export function artPrompt(pack,{kind,actor,location,emotion='neutral',pose='arms_at_sides',outfit,scene,extra}={}){const s=artStyle(pack);
 if(kind==='background'){const l=location||{};return {positive:join('scenery, no humans, detailed background',l.name,l.artTags,l.description?.slice(0,200),extra,s.style),negative:join(s.negative,'people, 1girl, 1boy, person')};}
 const a=actor||{},look=join(a.appearanceTags),wear=outfit?join(a.outfitSets?.[outfit]):join(a.outfitTags),face=join(EMOTION_TAGS[emotion]||emotion,emotion==='aroused'?a.expressionTags?.aroused:a.expressionTags?.[emotion]);
 if(kind==='cg'){const player=pack?.actors?.find(x=>x.id===pack.playerId),cast=[sexOf(a),sexOf(player)].sort().join(', ');const caption=join(look,a.bodyTags,'nude');
  return {positive:join('nsfw, explicit, sex',cast,'pov, solo focus',scene?.name,location?.name,extra,caption,EMOTION_TAGS.aroused,a.expressionTags?.aroused,s.style),negative:join(s.negative,s.sceneNegative),detailerPositive:join(look,EMOTION_TAGS.aroused)};}
 return {positive:join(sexOf(a),'solo, standing, facing viewer, looking at viewer, cowboy shot, simple background, white background',tag(pose),look,wear,face,extra,s.style),negative:join(s.negative,'nsfw, nude')};}
export function validateArtStyle(pack,fail){const v=pack.artStyle;if(v===undefined)return;if(!v||typeof v!=='object'||Array.isArray(v))return fail('artStyle: expected an object');for(const [k,x] of Object.entries(v))if(!['style','negative','sceneNegative'].includes(k))fail(`artStyle.${k}: unknown field`);else if(typeof x!=='string'||x.length>2000)fail(`artStyle.${k}: text up to 2000 characters`);}
