// Adapted from src/shared/llm/openaiAdapter.ts in Venus University.
// AGPL-3.0-only; see NOTICE.md and LICENSE.
export function textOf(content){
 if(typeof content==='string')return content;
 if(!Array.isArray(content))return '';
 return content.map(part=>typeof part?.text==='string'?part.text:'').join('');
}

export function completionOf(body){
 if(body?.error)throw Error(body.error.message||body.error.type||body.error.code||(typeof body.error==='string'?body.error:`Model server rejected the request (${JSON.stringify(body).slice(0,200)})`));
 const choice=body?.choices?.[0],reason=choice?.finish_reason;
 if(reason&&reason!=='stop'){
  if(reason==='length')throw Error('Model ran out of output tokens before finishing. Try a non-reasoning instruct model or increase its output limit.');
  if(reason==='content_filter')throw Error('Model server blocked this reply.');
  if(reason==='error')throw Error(choice.error?.message||'Model server reported an error while generating.');
  throw Error(`Model stopped early (${reason}).`);
 }
 if(choice?.message?.refusal)throw Error(`Model refused the request: ${String(choice.message.refusal).slice(0,160)}`);
 const text=textOf(choice?.message?.content);
 if(!text.trim())throw Error(choice?.message?.reasoning_content||choice?.message?.reasoning?'Model returned reasoning but no final answer. Try a non-reasoning instruct model.':'Model returned no answer text.');
 return {text,usage:body.usage||null};
}
// From modelIdsOf in src/shared/llm/openaiAdapter.ts. Listings without capability metadata remain usable.
export function modelIdsOf(body){
 if(!Array.isArray(body?.data))return [];
 const ids=new Set();for(const m of body.data){
  if(typeof m?.id!=='string'||!m.id)continue;
  const supported=m.supported_parameters;
  if(!Array.isArray(supported)||supported.includes('response_format')||supported.includes('structured_outputs'))ids.add(m.id);
 }
 return [...ids].sort();
}
