// Prompt hygiene (T-114): state reaches the narrator as short prose, never as JSON, and the stable part of the
// prompt (system, premise, setting, cast profiles) comes before anything that changes turn to turn, so a local
// server can reuse its KV cache for that prefix.

const words=k=>String(k).replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_-]+/g,' ').toLowerCase();
const empty=v=>v==null||v===''||v===false||Array.isArray(v)&&!v.some(x=>!empty(x))||typeof v==='object'&&!Array.isArray(v)&&!Object.values(v).some(x=>!empty(x));
/** Flattens a state record into "key value; key: a, b" prose: empty and false fields drop, nesting stops at three levels. */
export function proseOf(v,depth=0){
 if(empty(v))return '';if(typeof v!=='object')return String(v);if(depth>2)return '';
 if(Array.isArray(v))return v.filter(x=>!empty(x)).map(x=>typeof x==='object'&&!Array.isArray(x)?Object.values(x).filter(y=>!empty(y)).map(y=>proseOf(y,depth+1)).join(' '):proseOf(x,depth+1)).filter(Boolean).join(', ');
 return Object.entries(v).filter(([,x])=>!empty(x)).map(([k,x])=>x===true?words(k):typeof x==='object'&&!Array.isArray(x)?`${words(k)} (${proseOf(x,depth+1)})`:`${words(k)} ${proseOf(x,depth+1)}`).join(depth?', ':'; ');
}
export const intimacyProse=x=>proseOf({...x,character:undefined});
export const npcProse=(r,nameOf=id=>id)=>`${r.characters.map(nameOf).join(' & ')}: ${proseOf({...r,characters:undefined})||'acquainted'}`;
export function firstProse(f){
 if(!f)return '';const head=[f.title||f.rung,f.step&&f.of?`step ${f.step} of ${f.of}`:'',f.checkpoint&&`at "${words(f.checkpoint)}"`,f.required&&'this step must land'].filter(Boolean).join(', ');
 const rest=proseOf({...f,first:undefined,character:undefined,title:undefined,rung:undefined,step:undefined,of:undefined,checkpoint:undefined,required:undefined,cue:undefined,waitingFor:undefined});
 return [`${head}.`,f.cue&&`Cue: ${f.cue}`,!empty(f.waitingFor)&&`Waiting for: ${proseOf(f.waitingFor)}.`,rest&&`${rest}.`].filter(Boolean).join(' ');
}
/** Absent characters who stand in the scene's own place keep their name but lose the place: "not here" and "AWAY: <this room>" contradict. */
export const awayFrom=(list,here)=>here&&list?.length?list.map(a=>a.where===here?{...a,where:''}:a):list;
/** The volatile scene header: when and where, from state. */
export const timeLine=c=>`${[c.weekday,c.date,c.daypart].filter(Boolean).join(', ')}. ${c.location?.name||''}${c.location?.description?`: ${c.location.description}`:''}${c.timeNote?` ${c.timeNote}`:''}`.replace(/^[,. ]+/,'').trim();
/** System plus user text up to the volatile header: the part a server can cache across turns of one scene. */
export function stablePrefix(messages,context){
 const [system,user]=messages,at=timeLine(context)?user.content.indexOf(timeLine(context)):-1;
 return `${system.content}\n${at<0?'':user.content.slice(0,at)}`;
}
