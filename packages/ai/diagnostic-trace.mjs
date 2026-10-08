export function safeFailureTrace(value){
 if(typeof value==='string')return value.replace(/\b(?:Authorization\s*:\s*)?Bearer\s+[^\s"'<>]+/giu,'[redacted authorization]').replace(/\bsk-[\p{L}\p{N}_-]+/giu,'[redacted key]').replace(/https?:\/\/[^\s"'<>]+/giu,'[redacted URL]');
 if(Array.isArray(value))return value.map(safeFailureTrace);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,safeFailureTrace(v)]));return value;
}
