/** Parse a JSON object even when a model adds a code fence or a short preamble. */
export function parseModelObject(raw){
 if(raw&&typeof raw==='object'&&!Array.isArray(raw))return raw;
 if(typeof raw!=='string')throw Error('Model did not return a JSON object');
 const text=raw.trim();
 for(let start=text.indexOf('{');start!==-1;start=text.indexOf('{',start+1)){
  let depth=0,inString=false,escaped=false;
  for(let i=start;i<text.length;i++){
   const c=text[i];if(escaped){escaped=false;continue;}if(c==='\\'&&inString){escaped=true;continue;}if(c==='"'){inString=!inString;continue;}if(inString)continue;
   if(c==='{')depth++;else if(c==='}'&&--depth===0){try{const value=JSON.parse(text.slice(start,i+1));if(value&&typeof value==='object'&&!Array.isArray(value))return value;}catch{}break;}
  }
 }
 throw Error(`Model did not return a parseable JSON object. Reply began: ${text.slice(0,180).replace(/\s+/g,' ')}`);
}
