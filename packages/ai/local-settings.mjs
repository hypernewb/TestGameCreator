import {assert} from '../core/engine.mjs';

export const LOCAL_PRESETS={
  lmstudio:'http://127.0.0.1:1234/v1/chat/completions',
  ollama:'http://127.0.0.1:11434/v1/chat/completions'
};

/** This UI deliberately connects only to an inference server on this computer. */
export function normalizeLocalEndpoint(input){
  assert(typeof input==='string'&&input.length<250,'Enter a local AI endpoint');
  let url;try{url=new URL(input.trim());}catch{throw Error('Enter a valid local AI URL');}
  assert(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname),'Use a local HTTP server on this computer');
  assert(url.port&&Number(url.port)>0&&Number(url.port)<=65535,'Include the local server port');
  assert(!url.username&&!url.password&&!url.search&&!url.hash,'Remove credentials, query, or fragment from the URL');
  assert(['','/','/v1','/v1/','/v1/chat/completions'].includes(url.pathname),'Use the server base URL or /v1/chat/completions');
  url.pathname='/v1/chat/completions';return url.href;
}

export function localModelsUrl(endpoint){const url=new URL(normalizeLocalEndpoint(endpoint));url.pathname='/v1/models';return url.href;}
// Ollama's OpenAI-compatible route runs at its own num_ctx, not the model's maximum, and drops the start of an
// over-long prompt (the system rules), so an unconfigured Ollama model is budgeted at its conservative default.
const OLLAMA_DEFAULT_CTX=4096;
const positive=n=>Number.isInteger(Number(n))&&Number(n)>0?Number(n):null;
/**
 * Asks the inference server how large the loaded model's window is. Probes, in order: llama.cpp /props,
 * LM Studio /api/v0/models, Ollama /api/show, then OpenAI-style /v1/models metadata (vLLM, OpenRouter).
 * Returns {window, source} or null when the server does not say.
 */
export async function detectContextWindow(endpoint,model,fetchImpl=fetch,timeout=3000){
 const origin=new URL(endpoint).origin,get=async(path,init)=>{try{const r=await fetchImpl(origin+path,{...init,signal:AbortSignal.timeout(timeout)});return r.ok?await r.json():null;}catch{return null;}};
 const props=await get('/props');
 const llama=positive(props?.default_generation_settings?.n_ctx??props?.n_ctx);if(llama)return {window:llama,source:'llama.cpp /props'};
 const studio=await get(`/api/v0/models/${encodeURIComponent(model)}`);
 // An unloaded LM Studio model reports its trained maximum; the window it will load with (just-in-time) is unknown
 // until the first request, so the caller re-detects after a reply instead of trusting max_context_length.
 if(studio?.state&&studio.state!=='loaded')return null;
 const loaded=positive(studio?.loaded_context_length??studio?.max_context_length);if(loaded)return {window:loaded,source:'LM Studio /api/v0/models'};
 const show=await get('/api/show',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model})});
 if(show){const configured=positive(String(show.parameters||'').match(/num_ctx\s+(\d+)/)?.[1]),trained=positive(Object.entries(show.model_info||{}).find(([k])=>k.endsWith('.context_length'))?.[1]);return {window:configured||Math.min(trained||OLLAMA_DEFAULT_CTX,OLLAMA_DEFAULT_CTX),source:configured?'Ollama num_ctx':'Ollama default num_ctx'};}
 const listing=await get('/v1/models'),entry=(listing?.data||[]).find(m=>m.id===model);
 const listed=positive(entry?.context_length??entry?.max_model_len??entry?.context_window);if(listed)return {window:listed,source:'/v1/models'};
 return null;
}
// Context size presets cap how much of the model's window each turn may use. Smaller prompts answer faster on local
// hardware; larger ones keep more of the scene verbatim. No preset can exceed the window the server reports.
// `verbatim` caps how many recent scene turns stay word for word: small windows usually mean small models, which follow
// a short transcript plus one-line digests better than 25 full turns.
export const CONTEXT_SIZES={
  minimal:{cap:4096,verbatim:6,label:'Minimal',hint:'Fastest replies; older turns shrink to one-line digests soonest'},
  default:{cap:16384,verbatim:16,label:'Default',hint:'Balanced speed and memory'},
  max:{cap:Infinity,verbatim:Infinity,label:'Maximum',hint:'The model’s full window; slowest on local hardware'}
};
// Used when the server does not report its window: small enough that no common local model silently truncates.
export const FALLBACK_WINDOW=8192;
export function validateContextSize(size){assert(Object.hasOwn(CONTEXT_SIZES,size),'Choose a minimal, default, or max context size');return size;}
// A cloud model (any non-loopback endpoint) is strong and has a large window, so an undetected one is budgeted at
// CLOUD_WINDOW and its 'default' size means the full window with no digesting: the whole scene stays word for word.
// 'minimal' stays an explicit opt-in cap. STORY_CONTEXT_WINDOW still overrides the detected size.
export const CLOUD_WINDOW=65536;
export const isLoopback=endpoint=>{try{return ['localhost','127.0.0.1','[::1]'].includes(new URL(endpoint).hostname);}catch{return false;}};
export const contextPreset=(size,remote=false)=>remote&&size==='default'?CONTEXT_SIZES.max:CONTEXT_SIZES[size]||CONTEXT_SIZES.default;
export function effectiveWindow(detected,size='default',remote=false){return Math.min(detected>0?detected:remote?CLOUD_WINDOW:FALLBACK_WINDOW,contextPreset(size,remote).cap);}
export function validateLocalModel(model){assert(typeof model==='string'&&model.trim()&&model.length<=200&&!/[\r\n]/.test(model),'Select a local model');return model.trim();}
