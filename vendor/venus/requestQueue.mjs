// Serial chaining adapted from Venus University renderer/stores/llmQueue.ts.
// Snapshot 79301df55bc39a0996229ccc6f12ccce422a80b2. AGPL-3.0-only; see LICENSE.
// The queue is per provider; queued cancellation is an addition for this framework.
export function createRequestQueue(){
 let tail=Promise.resolve();
 return (job,signal)=>{
  const run=()=>{if(signal?.aborted)throw new DOMException('Cancelled','AbortError');return job();};
  const result=tail.then(run,run);
  tail=result.catch(()=>undefined);
  if(!signal)return result;
  return new Promise((resolve,reject)=>{
   const cancel=()=>reject(new DOMException('Cancelled','AbortError'));
   if(signal.aborted)cancel();else signal.addEventListener('abort',cancel,{once:true});
   result.then(resolve,reject).finally(()=>signal.removeEventListener('abort',cancel));
  });
 };
}
