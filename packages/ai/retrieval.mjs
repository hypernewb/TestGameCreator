// Okapi BM25 over short documents (lore entries). Dependency-free and deterministic; ranks by how specific the
// player's words are, where plain keyword matching treats "the library" and "the" alike.
const STOP=new Set('the and for are but not you your yours with this that from have has had was were will would can could should into onto about there their them they then than what when where which who whom why how its it\'s our out off too very just also some any all each more most other such only own same over under again once here she her him his hers himself herself myself yourself been being does did doing done let lets get got'.split(' '));
const DENSE=/^[぀-ヿ㐀-䶿一-鿿가-힯豈-﫿]+$/u;
const stem=w=>w.length>4&&w.endsWith('ies')?w.slice(0,-3)+'y':w.length>3&&w.endsWith('s')&&!w.endsWith('ss')?w.slice(0,-1):w;
/** Lowercased word stems; runs of CJK/kana/hangul become character bigrams since they have no spaces. */
export function terms(text){
 const out=[];
 for(const word of String(text||'').toLowerCase().match(/[\p{L}\p{N}]+/gu)||[]){
  if(DENSE.test(word)){if(word.length===1)out.push(word);for(let i=0;i<word.length-1;i++)out.push(word.slice(i,i+2));continue;}
  if(word.length<3||STOP.has(word))continue;out.push(stem(word));
 }
 return out;
}
export function bm25Index(docs,{k1=1.2,b=0.75}={}){
 const entries=docs.map(d=>{const tf=new Map();const words=terms(d.text);for(const w of words)tf.set(w,(tf.get(w)||0)+1);return {id:d.id,tf,length:words.length};});
 const df=new Map();for(const e of entries)for(const w of e.tf.keys())df.set(w,(df.get(w)||0)+1);
 const avg=entries.reduce((n,e)=>n+e.length,0)/Math.max(1,entries.length)||1,n=entries.length;
 return {k1,b,avg,n,df,entries:new Map(entries.map(e=>[e.id,e]))};
}
/** Returns {score, matched:[terms]} for one document; score is 0 when no query term occurs in it. */
export function bm25Score(index,id,query){
 const doc=index.entries.get(id);if(!doc)return {score:0,matched:[]};
 let score=0;const matched=[];
 for(const w of new Set(terms(query))){const f=doc.tf.get(w);if(!f)continue;const df=index.df.get(w),idf=Math.log(1+(index.n-df+0.5)/(df+0.5));score+=idf*f*(index.k1+1)/(f+index.k1*(1-index.b+index.b*doc.length/index.avg));matched.push(w);}
 return {score:Math.round(score*100)/100,matched};
}
const cache=new WeakMap();
/** Index a pack's lorebook once per pack object (tags count as text, so authored keys stay strong signals). */
export function loreIndex(pack){
 const book=pack.lorebook||[];if(!cache.has(book))cache.set(book,bm25Index(book.map(e=>({id:e.id,text:`${(e.tags||[]).join(' ')} ${(e.tags||[]).join(' ')} ${e.title||e.name||''} ${e.text}`}))));
 return cache.get(book);
}
