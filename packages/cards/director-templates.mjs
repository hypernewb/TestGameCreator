import {assert,safeKey} from '../core/engine.mjs';
import {castings,fill} from './role-slots.mjs';

export const DIRECTOR_KINDS=['event','obstacle','goal','temptation'];
const deliveryOf=t=>t.delivery||(['event','goal'].includes(t.kind)?'offer':'incident');
export function expandDirectorTemplate(pack,template){
 assert(safeKey(template?.id)&&DIRECTOR_KINDS.includes(template.kind),'Director template needs a valid id and kind');
 assert(template.roles&&Object.keys(template.roles).length&&template.scene&&typeof template.scene==='object','Director template needs roles and a scene');
 const delivery=deliveryOf(template);assert(['incident','offer'].includes(delivery),'Director template delivery invalid');
 assert(Number.isInteger(template.tone??1)&&(template.tone??1)>=1&&(template.tone??1)<=3,'Director template tone must be 1–3');
 if(template.focusRole)assert(Object.hasOwn(template.roles,template.focusRole),'Director template focusRole is not a role');
 return castings(pack,template.roles).map(roles=>{
  const id=[template.id,...Object.values(roles)].join('.'),sceneId=`director.${id}`,scene={...fill(template.scene,roles,pack),id:sceneId,template:{id:template.id,roles,kind:template.kind,delivery,tone:template.tone??1}};
  assert(safeKey(id)&&safeKey(sceneId),'Director template instance ID is too long or invalid');
  if(delivery==='incident'){scene.trigger={event:'story.incident',match:{incident:id}};delete scene.offer;}else{scene.offer='director';scene.trigger={event:'story.opportunity'};}
  const common={id,scene:sceneId,kind:template.kind,tone:template.tone??1,weight:template.weight??10,maxUses:template.maxUses??1,...(template.focusRole?{focus:roles[template.focusRole]}:{}),template:template.id,roles};
  for(const key of ['when','minTick','cooldownTicks','text','tease','match'])if(template[key]!==undefined)common[key]=fill(template[key],roles,pack);
  let kept=null;if(template.kind==='goal'){
   const goal=template.goal||{},choice=(scene.choices||[]).find(x=>x.id===(goal.acceptChoice||scene.choices?.[0]?.id)),character=roles[template.focusRole||Object.keys(roles)[0]],planId=`m3.${id}`;
   assert(choice&&safeKey(planId)&&Number.isInteger(goal.deadlineTicks??12)&&(goal.deadlineTicks??12)>=1&&(goal.deadlineTicks??12)<=1000,'Director goal needs a choice and a deadline of 1–1000 ticks');
   const missed=goal.missed||{kind:pack.modules?.['social.relationships']||pack.modules?.['social.romance-tempo']&&(pack.romanceTempoProfiles||[]).some(x=>x.character===character)?'relationship':'opportunity',cost:3};
   assert(['relationship','opportunity'].includes(missed.kind)&&Number.isInteger(missed.cost)&&missed.cost>=1&&missed.cost<=20,'Director goal missed cost invalid');
   assert(missed.kind!=='relationship'||pack.modules?.['social.relationships']||pack.modules?.['social.romance-tempo']&&(pack.romanceTempoProfiles||[]).some(x=>x.character===character),'Director relationship cost needs a relationship module for the goal character');
   const plan=fill(goal.description||scene.title,roles,pack);choice.effects=[...(choice.effects||[]),{type:'plan',id:planId,character,plan,deadlineTicks:goal.deadlineTicks??12}];
   common.goal={planId,character,missed};
   // Optional follow-up: the next act with her while the plan is pending keeps it (M3 library goals).
   if(goal.kept){const k=fill(goal.kept,roles,pack);kept={...k,id:`${sceneId}.kept`,template:{id:template.id,roles,kind:template.kind,part:'kept'},trigger:{event:'social.actPriced',match:{character}},when:{plans:{[planId]:'pending'}},choices:(k.choices||[]).map(c=>({...c,effects:[...(c.effects||[]),{type:'planStatus',id:planId,character,plan,status:'kept'}]}))};}
  }
  const phone=template.phone?{...fill(template.phone,roles,pack),id:`${id}.message`,trigger:{event:delivery==='incident'?'story.incident':'story.directorDealt',match:delivery==='incident'?{incident:id}:{entry:id}}}:null;
  return {scene,entry:common,delivery,phone,kept};
 });
}
export function bakeDirectorTemplates(pack,templates){
 const ids=new Set(),made=[];for(const template of templates){assert(!ids.has(template.id),'Duplicate director template ID');ids.add(template.id);made.push(...expandDirectorTemplate(pack,template));}
 const oldScenes=(pack.scriptedScenes||[]).filter(x=>!x.template?.id),oldProfile=pack.directorProfile||{},oldComplications=(oldProfile.complications||[]).filter(x=>!x.template),oldOpportunities=(oldProfile.opportunities||[]).filter(x=>!x.template),oldMessages=(pack.phoneMessages||[]).filter(x=>!x.directorTemplate);
 const messages=made.filter(x=>x.phone).map(x=>({...x.phone,directorTemplate:x.entry.template}));
 if(messages.length)assert(pack.modules?.['social.phone'],'Director phone invitations require social.phone');
 return {...pack,scriptedScenes:[...oldScenes,...made.flatMap(x=>x.kept?[x.scene,x.kept]:[x.scene])],phoneMessages:[...oldMessages,...messages],directorProfile:{...oldProfile,...(templates.length?{adaptive:true}:{}),complications:[...oldComplications,...made.filter(x=>x.delivery==='incident').map(x=>x.entry)],opportunities:[...oldOpportunities,...made.filter(x=>x.delivery==='offer').map(x=>x.entry)]}};
}
