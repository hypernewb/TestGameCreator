// F11: role-slot storylet templates (Wildermyth-style). Authoring-time only: a template names roles ("the rival", "the witness"),
// the expander fills them from the cast and writes one ordinary scripted scene per pairing. Nothing new runs in the engine.
// In a template: "@rival" (whole string or object key) -> actor id; "{rival}" / "{rival.name}" -> name; "{rival.they|them|their|theirs}"
// -> pronouns, "{Rival.they}" capitalised. Role criteria are plain `when` conditions written against "@role", so the right variant
// is simply the one whose conditions hold for today's cast. Variants share a "<id>.done" flag so a template plays once.
const PRONOUNS={she:{they:'she',them:'her',their:'her',theirs:'hers'},he:{they:'he',them:'him',their:'his',theirs:'his'},they:{they:'they',them:'them',their:'their',theirs:'theirs'}};
const cap=s=>s[0].toUpperCase()+s.slice(1),pronouns=a=>PRONOUNS[String(a?.pronouns||'they').split('/')[0].trim().toLowerCase()]||PRONOUNS.they;
export const poolOf=(p,pool='cast')=>Array.isArray(pool)?pool:pool==='dating'?(p.datingProfiles||[]).map(d=>d.character):(p.actors||[]).map(a=>a.id).filter(id=>id!==p.playerId);
// Every assignment of distinct actors to roles, in role order.
export function castings(p,roles){const names=Object.keys(roles||{});const go=(i,used)=>i===names.length?[{}]:poolOf(p,roles[names[i]].pool).filter(id=>!used.includes(id)&&p.actors?.some(a=>a.id===id)).flatMap(id=>go(i+1,[...used,id]).map(rest=>({[names[i]]:id,...rest})));return names.length?go(0,[]):[];}
export function fill(x,cast,p){const actor=id=>p.actors.find(a=>a.id===id);
 if(typeof x==='string'){if(x[0]==='@'&&cast[x.slice(1)])return cast[x.slice(1)];return x.replace(/\{([A-Za-z]\w*)(?:\.(\w+))?\}/g,(m,role,f='name')=>{const id=cast[role.toLowerCase()];if(!id)return m;const a=actor(id),v=f==='name'?a.name||id:pronouns(a)[f];return v===undefined?m:role[0]===role[0].toUpperCase()?cap(v):v;});}
 if(Array.isArray(x))return x.map(v=>fill(v,cast,p));
 if(x&&typeof x==='object')return Object.fromEntries(Object.entries(x).map(([k,v])=>[fill(k,cast,p),fill(v,cast,p)]));return x;}
const stampChoices=(seg,flag)=>({...seg,choices:(seg.choices||[]).map(c=>({...c,effects:[...(c.effects||[]),{type:'flag',id:flag,value:true}],...(c.check?{check:{...c.check,fail:{...c.check.fail,effects:[...(c.check.fail?.effects||[]),{type:'flag',id:flag,value:true}]}}}:{})}))});
export function expandTemplate(p,t){const {roles,once=true,...body}=t,done=`${t.id}.done`;
 return castings(p,roles).map(cast=>{let x={...fill(body,cast,p),id:[t.id,...Object.values(cast)].join('.'),template:{id:t.id,roles:cast}};
  if(once&&!x.repeatable){x={...stampChoices(x,done),beats:(x.beats||[]).map(b=>stampChoices(b,done)),when:{...x.when,flags:{...x.when?.flags,[done]:false}}};if(!x.beats.length)delete x.beats;}return x;});}
// Bake: the pack with every template expanded into scriptedScenes (replacing earlier variants of the same template).
export function bakeTemplates(p,templates){const ids=new Set(templates.map(t=>t.id)),scenes=(p.scriptedScenes||[]).filter(x=>!ids.has(x.template?.id)),made=templates.flatMap(t=>expandTemplate(p,t)),flags=templates.filter(t=>t.once!==false).map(t=>`${t.id}.done`);
 return {...p,scriptedScenes:[...scenes,...made],...(p.storyVariables?{storyVariables:[...p.storyVariables.filter(v=>!flags.includes(v.id)),...flags.map(id=>({id,name:`${id.slice(0,-5)} played`,initial:false}))]}:{})};}
