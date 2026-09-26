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
export function validateLocalModel(model){assert(typeof model==='string'&&model.trim()&&model.length<=200&&!/[\r\n]/.test(model),'Select a local model');return model.trim();}
