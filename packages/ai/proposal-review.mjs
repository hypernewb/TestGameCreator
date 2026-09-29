// Studio review of an AI proposal (docs/GENERATOR-PLAN.md step 6): per-entry errors and warnings (Ren'Py lint), a route grid
// (Twine's story map for the dating ladder), a calendar heatmap from the bot playtest, and per-entry regenerate with an author note.
import {validatePack,digest} from '../core/engine.mjs';
import {registry} from '../modules/index.mjs';
import {KINDS,withProposal,playability,messagesFor,candidateSchema,normalizeCandidate,applyProposal} from './bulk-authoring.mjs';
import {playtestProposal} from './bulk-robustness.mjs';
import {RUNGS,draftRouteProse,routeCandidate,tastesOf} from '../cards/route-skeleton.mjs';
import {adultEntry,draftIntimacyProse,intimacyFrame,intimacyScenes} from '../cards/intimacy-skeleton.mjs';

const COUNT={locations:'locationCount',characters:'characterCount',scenes:'sceneCount',objects:'objectCount',items:'itemCount',activities:'activityCount',events:'eventCount',templates:'templateCount'};
const key=e=>`${e.kind}:${e.index}`,check=(pack,p)=>{try{validatePack(withProposal(pack,p),registry);return '';}catch(e){return e.message;}};
const skipping=(p,skip)=>({...p,...Object.fromEntries(KINDS.map(k=>[k,(p[k]||[]).map((e,i)=>skip.has(`${k}:${i}`)?{...e,status:'rejected'}:e)]))});
export const staleReason=(pack,p)=>p?.format!=='story-framework-ai-authoring-proposal'?'Not an AI authoring proposal':p.source?.packId!==pack.id?`Made for ${p.source?.packId||'an unknown pack'}, not ${pack.id}`:p.source?.digest!==digest(pack)?'The scenario changed after this proposal was made':'';
// Whose route rung a scene entry is: {x,rung} for `${x}-${rung}` in a route proposal.
const rungOf=(p,id)=>{const m=p.route&&/^(.+)-([a-z]+)$/.exec(id||'');return m&&p.route.route?.includes(m[1])&&RUNGS.includes(m[2])?{x:m[1],rung:m[2]}:null;};
// Whose encounter a scene entry is, in an intimacy proposal.
const encounterOf=(p,id)=>{const x=p.intimacy&&/^(.+)-intimate(?:-again)?$/.exec(id||'')?.[1];return x&&p.intimacy.characters?.includes(x)?x:null;};

export function reviewProposal(pack,proposal,{play=true,turns=120}={}){
 const stale=staleReason(pack,proposal);if(proposal?.format!=='story-framework-ai-authoring-proposal')throw Error(stale);
 const entries=KINDS.flatMap(kind=>(proposal[kind]||[]).map((e,index)=>({kind,index,id:e.value?.id||'',label:e.value?.title||e.value?.name||e.value?.id||`${kind} ${index+1}`,status:e.status,...(adultEntry(e.value)?{adult:true}:{}),errors:[],warnings:[]})));
 // Blame validation errors one entry at a time: the entry whose removal changes the error (one naming its id first), then again without it.
 const skip=new Set(entries.filter(e=>e.status==='rejected').map(key)),general=[];let err=check(pack,skipping(proposal,skip)),guard=entries.length;
 while(err&&guard--){const live=entries.filter(e=>!skip.has(key(e))),moves=e=>check(pack,skipping(proposal,new Set([...skip,key(e)])))!==err;
  const hit=live.find(e=>e.id&&err.includes(e.id)&&moves(e))||live.find(moves);if(!hit){general.push(err);break;}hit.errors.push(err);skip.add(key(hit));err=check(pack,skipping(proposal,skip));}
 let merged=null,warnings=[];try{merged=withProposal(pack,skipping(proposal,skip));const before=new Set(playability(pack));warnings=playability(merged).filter(w=>!before.has(w));}catch(e){general.push(e.message);}
 const ids=new Set(entries.map(e=>e.id).filter(Boolean));
 // Notes from normalizing (a dropped effect, a moved scene) name their scene the same way.
 for(const w of [...warnings,...(proposal.warnings||[])]){const own=/^(?:scene|event) ([^ :.]+)/.exec(w)?.[1],at=entries.filter(e=>own&&ids.has(own)?e.id===own:e.id&&new RegExp(`\\b${e.id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`).test(w));for(const e of at)e.warnings.push(w);}
 const playtest=play&&merged&&!general.length?playtestProposal(pack,skipping(proposal,skip),{turns}):null,playedIds=new Set(playtest?.playedIds||[]);
 const route=proposal.route?.route?.map(x=>({character:x,name:merged?.actors.find(a=>a.id===x)?.name||x,ending:proposal.route.endings?.[x]?.ending?.name||'',close:proposal.route.endings?.[x]?.close?.name||'',
  cells:RUNGS.map(rung=>{const e=entries.find(e=>e.kind==='scenes'&&e.id===`${x}-${rung}`);return e?{rung,index:e.index,id:e.id,label:e.label,status:e.status,errors:e.errors.length,warnings:e.warnings.length,played:playedIds.has(e.id)}:{rung};})}))||[];
 return {stale,entries,errors:general,warnings,route,calendar:playtest?.calendar||[],play:playtest&&{dead:playtest.dead,hand:playtest.hand,played:playtest.played,fresh:playtest.fresh,payoff:playtest.payoff,endings:playtest.endings,errors:playtest.errors}};
}

// One entry again: ask(messages,schema) → raw reply. A route rung redraws that love interest's whole ladder (one prose request keeps the
// voice consistent) and replaces their scenes, endings and tastes; anything else is one entry of its kind written against the rest.
export async function regenerateEntry(ask,pack,proposal,{kind,index,note=''}){
 const e=proposal[kind]?.[index];if(!e)throw Error(`No ${kind} entry ${index+1} in this proposal`);
 const brief=[proposal.request?.brief,note&&`AUTHOR NOTE\n${String(note).slice(0,600)}`].filter(Boolean).join('\n\n'),r=kind==='scenes'&&rungOf(proposal,e.value?.id),x=kind==='scenes'&&encounterOf(proposal,e.value?.id);
 // An encounter redraws both of that love interest's scenes from one prose request; the frame and boundaries stay the author's.
 if(x){const framed=intimacyFrame(withProposal(pack,{...proposal,scenes:[]}),proposal.intimacy),{prose,missing}=await draftIntimacyProse(ask,framed,x,{brief}),fresh=new Map(intimacyScenes(framed,x,{prose}).map(s=>[s.id,s]));
  const warnings=[...(proposal.warnings||[]).filter(w=>!w.startsWith(`${x}: placeholder intimacy prose`)),...(missing.length?[`${x}: placeholder intimacy prose for ${missing.join(', ')}`]:[])];
  return {proposal:{...proposal,warnings,scenes:proposal.scenes.map(s=>fresh.has(s.value?.id)?{status:'pending',value:fresh.get(s.value.id)}:s)},replaced:[...fresh.keys()],missing};}
 if(r){const {prose,missing}=await draftRouteProse(ask,pack,r.x,{brief}),c=routeCandidate(pack,{route:[r.x],days:proposal.route.days||14,prose:{[r.x]:prose}}),fresh=new Map(c.scenes.map(s=>[s.id,s])),t=tastesOf(prose),tastes={...proposal.route.tastes};
  if(t.likes.length||t.dislikes.length)tastes[r.x]=t;else delete tastes[r.x];const route={...proposal.route,endings:{...proposal.route.endings,[r.x]:c.route.endings[r.x]},tastes};if(!Object.keys(tastes).length)delete route.tastes;
  const warnings=[...(proposal.warnings||[]).filter(w=>!w.startsWith(`${r.x}: placeholder prose`)),...(missing.length?[`${r.x}: placeholder prose for ${missing.join(', ')}`]:[])];
  return {proposal:{...proposal,route,warnings,scenes:proposal.scenes.map(s=>fresh.has(s.value?.id)?{status:'pending',value:fresh.get(s.value.id)}:s)},replaced:[...fresh.keys()],missing};}
 const counts={[COUNT[kind]]:1},base=withProposal(pack,{...proposal,[kind]:proposal[kind].filter((_,i)=>i!==index)}),schema=candidateSchema(base,counts);
 const ask2=error=>ask(messagesFor(base,`${brief}\n\nREPLACE THIS ONE (write a better one${note?' following the author note':''}; keep its id):\n${JSON.stringify(e.value)}`,counts,error),schema);
 let got;try{got=normalizeCandidate(await ask2(''),base,counts,{strict:true});}catch(first){got=normalizeCandidate(await ask2(first.message),base,counts);}
 const value=got[kind]?.[0];if(!value)throw Error(`The model wrote no replacement${got.dropped?.length?`: ${got.dropped.join('; ')}`:''}`);
 return {proposal:{...proposal,[kind]:proposal[kind].map((x,i)=>i===index?{status:'pending',value}:x)},replaced:[value.id],missing:[]};
}

// Apply the approved entries. force re-stamps a proposal whose scenario changed since (same pack id only); validation still decides.
export const applyReviewed=(pack,proposal,{force=false}={})=>applyProposal(pack,force&&proposal?.source?.packId===pack.id?{...proposal,source:{...proposal.source,digest:digest(pack)}}:proposal);
