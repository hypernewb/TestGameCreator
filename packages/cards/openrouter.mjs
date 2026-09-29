// M2 drafter transport: OpenRouter's OpenAI-compatible chat API (owner call 2026-09-29). The key stays server-side (.env OPENROUTER_API_KEY).
export const OPENROUTER_URL='https://openrouter.ai/api/v1/chat/completions',DRAFT_MODEL='deepseek/deepseek-v4.1-flash';

// Returns complete(messages) -> Promise<string>, the shape draftWorld expects. Retries 429/5xx, timeouts and network errors with a short backoff.
export function openRouterComplete({key=process.env.OPENROUTER_API_KEY,model=process.env.OPENROUTER_MODEL||DRAFT_MODEL,fetch=globalThis.fetch,tries=3,timeout=120000,backoff=1000,usage}={}){
 key=String(key||'').trim().replace(/^[<"'`]+|[>"'`]+$/g,'');if(!key)throw new Error('OPENROUTER_API_KEY is not set (put it in .env)');
 return async messages=>{
  for(let i=0;;i++){
   let r;try{r=await fetch(OPENROUTER_URL,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`,'X-Title':'story-framework creator'},
    body:JSON.stringify({model,messages,temperature:0.8,response_format:{type:'json_object'}}),signal:AbortSignal.timeout(timeout)});}catch(e){if(i+1<tries){await new Promise(ok=>setTimeout(ok,backoff*2**i));continue;}throw e;}
   if(r.ok){const j=await r.json();if(j.usage)usage?.(j.usage);const t=j.choices?.[0]?.message?.content;if(typeof t!=='string')throw new Error('OpenRouter: empty reply');return t;}
   if(i+1<tries&&(r.status===429||r.status>=500)){await new Promise(ok=>setTimeout(ok,backoff*2**i));continue;}
   throw new Error(`OpenRouter ${r.status}: ${(await r.text()).slice(0,200)}`);}
 };
}
