// Independent, deterministic campaigns; every arm goes through GameService and the shared play presentation.
import {createWorld} from '../core/engine.mjs';
import {sceneText,shownTurn,presentationFor,judgeMessages,readVerdict,pairs,CRITERIA,judgeResponseFormat} from './prompt-ab.mjs';
import {parseModelObject} from '../ai/json.mjs';
import {createHash} from 'node:crypto';
import {scenePromptMessages} from '../../vendor/venus/scenePrompt.mjs';

const truth=state=>({tick:state.tick,scene:state.scene,locations:Object.fromEntries(Object.entries(state.actors).map(([id,a])=>[id,a.location])),relationships:state.modules['social.relationships'],flags:state.flags});
export async function runPromptAB({service,store,pack,registry,view,variants,scenarios,seed=42,maxTurns=99,judgeProvider,judgeOrders=2,mode='paired',reference=Object.keys(variants)[0],onRow=()=>{}}){
 if(!['paired','trajectory'].includes(mode)||!variants[reference]||![1,2].includes(judgeOrders))throw Error('Invalid evaluation mode, reference or judge orders');
 const names=Object.keys(variants),rows=[];
 for(const [scenario,inputs] of Object.entries(scenarios)){
  const states={};for(const name of names){const s=createWorld(pack,registry,`ab-${scenario}-${name}`,seed);store.insert(s);states[name]=s;}
  for(const [turn,input] of inputs.slice(0,maxTurns).entries()){
   const row={scenario,turn,input,phase:'engine',verdicts:[]};
   // In paired mode, each arm replays the same reference save for this action. Its final display is still
   // processed independently. Trajectory mode instead lets every arm carry its own consequences forward.
   const referenceBefore=structuredClone(states[reference]);
   for(const name of names){
    if(mode==='paired'&&turn>0&&name!==reference){const old=states[name],restored={...structuredClone(referenceBefore),campaignId:old.campaignId};store.commit(restored,old.revision);states[name]=restored;}
    const p=variants[name],previous=states[name],from=p.usage?.length||0,requestsFrom=p.requests||0,start=Date.now(),contexts=[],drafts=[],promptHashes=[];
    service.provider=new Proxy(p,{get(target,k){const v=target[k];if(k==='generateScene')return async(...args)=>{contexts.push(structuredClone(args[0]));promptHashes.push(createHash('sha256').update(JSON.stringify((p.scenePrompt||scenePromptMessages)(args[0],args[1]))).digest('hex'));const value=await v.apply(target,args);drafts.push(structuredClone(value));return value;};return typeof v==='function'?v.bind(target):v;}});
    let result,error;try{result=await service.act(previous.campaignId,{id:`ab-${scenario}-${turn}`,expectedRevision:previous.revision,input});}catch(e){error=String(e.message).slice(0,200);}
    const state=store.load(previous.campaignId),data=view(state),changed=Object.keys(state.turns).some(id=>!previous.turns[id]),shown=changed?shownTurn(previous,state,pack,data.diagnostics?.highlights||[],data.diagnostics):presentationFor(data);
    states[name]=state;
    const fresh=Object.values(state.turns).filter(t=>!previous.turns[t.id]),failed=fresh.find(t=>t.fallback),notice=error||result?.clarification||failed?.failureReason;
    const text=[shown.text,notice&&`[${result?.clarification?'CLARIFICATION':'ERROR'}] ${notice}`].filter(Boolean).join('\n');
    const context=contexts.at(-1),usage=(p.usage||[]).slice(from),source=fresh.find(t=>t.id===`ab-${scenario}-${turn}`),dropped=Math.max(0,drafts.reduce((s,d)=>s+(d.lines?.length||0),0)-(source?.sceneLines?.length||0));
    row[name]={text,shown,ms:Date.now()-start,tokens:usage.reduce((s,u)=>s+(u.tokens?.prompt_tokens||0),0)||null,modelCalls:Number.isFinite(p.requests)?p.requests-requestsFrom:null,sceneCalls:contexts.length,promptHashes,phase:context?.scenePhase||'engine',cast:context?.stagedCast||[],context,
     before:truth(previous),after:truth(state),events:fresh.flatMap(t=>t.events||[]).filter(e=>e.type!=='core.patch'),
     drafts:drafts.map(d=>sceneText(d.lines,pack)),dropped,warnings:drafts.flatMap(d=>(d.lintTrace||[]).filter(w=>w.warned)),...(notice?{error:notice}:{}),...(result?.clarification?{clarification:true}:{})};
   }
   row.phase=[...new Set(names.map(n=>row[n].phase))].join('/');
   row.contextMismatch=new Set(names.map(n=>JSON.stringify({phase:row[n].phase,cast:row[n].cast}))).size>1;
   for(const pair of pairs(names)){
    // Alternate the initial order reproducibly; a second order exposes positional preference.
    const ordered=(seed+rows.length)%2?pair:[...pair].reverse(),votes=[];
    try{
     for(let i=0;i<judgeOrders;i++){
      const order=i?[...ordered].reverse():ordered,a=row[order[0]],b=row[order[1]],context=a.context||{playerAction:input};
      const evidence=order.map(n=>({before:row[n].before,after:row[n].after,events:row[n].events,cast:row[n].context?.castProfiles||[],memories:row[n].context?.memories||[],pastScenes:row[n].context?.pastScenes||[],time:{date:row[n].context?.date,weekday:row[n].context?.weekday,daypart:row[n].context?.daypart},history:row[n].context?.sceneHistory||[]}));
      const raw=await judgeProvider.complete(judgeMessages(context,pack,a.text,b.text,evidence),undefined,judgeResponseFormat);
      (row.judgeAttempts||=[]).push({pair,order,raw});
      votes.push(readVerdict(parseModelObject(raw),order));
     }
     const disagreement=votes.some(v=>v.winner!==votes[0].winner),scores=Object.fromEntries(pair.map(n=>[n,Object.fromEntries(Object.keys(CRITERIA).map(c=>[c,votes.reduce((s,v)=>s+v.scores[n][c],0)/votes.length]))]));
     row.verdicts.push({pair,winner:disagreement?'tie':votes[0].winner,scores,why:disagreement?'Judge changed its choice when reply order was reversed.':votes[0].why,orderDisagreement:disagreement,votes});
    }catch(e){(row.judgeErrors||=[]).push({pair,error:String(e.message).slice(0,200)});}
   }
   rows.push(row);await onRow(row);
  }
 }
 return rows;
}
