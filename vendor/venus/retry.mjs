// Adapted from src/renderer/stores/silentRetry.ts and src/shared/llm/httpStatus.ts.
// AGPL-3.0-only; see NOTICE.md and LICENSE.
export const RETRYABLE_STATUSES=new Set([408,429,500,502,503,504]);
export function htmlGist(body){
 const title=/<title[^>]*>([\s\S]*?)<\/title>/i.exec(body),heading=/<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(body);
 return (title?.[1]||heading?.[1]||body).replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim().slice(0,200);
}
export async function backoff(attempt,signal,delay=[250,500]){
 if(attempt>=delay.length)return false;
 await new Promise((resolve,reject)=>{
  const timer=setTimeout(done,delay[attempt]);function done(){signal?.removeEventListener('abort',abort);resolve();}
  function abort(){clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(signal.reason||Error('Cancelled'));}
  signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
 });
 return true;
}
