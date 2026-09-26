import {assert,safeKey} from '../core/engine.mjs';

export const statKey=(character,stat)=>`${character}--${stat}`;
export const statValue=(state,character,stat)=>state.modules['character.stats']?.values[statKey(character,stat)]??0;

export function changeStat(tx,character,stat,delta){
 const definition=tx.pack.statDefinitions.find(x=>x.id===stat),old=statValue(tx.state,character,stat),value=Math.max(definition.min,Math.min(definition.max,old+delta));
 tx.set(['modules','character.stats','values',statKey(character,stat)],value);
 const visibility=definition.visibility==='public'?'public':[character,...(definition.visibility==='player'?[tx.pack.playerId]:[])];
 tx.emit('character.statChanged',{character,stat,value,delta:value-old,text:`${tx.state.actors[character].name}'s ${definition.name} is now ${value}.`},visibility);
}

export const stats={id:'character.stats',version:'0.1.0',coreApi:'0.1.0',requires:[],
 validate(p){
  assert(Array.isArray(p.statDefinitions||[])&&(p.statDefinitions||[]).length<=30,'statDefinitions: expected up to 30 stats');const ids=new Set(),actors=new Set(p.actors.map(a=>a.id));assert(p.actors.every(a=>!a.id.includes('--')),'character.stats: actor IDs cannot contain --');
  for(const d of p.statDefinitions||[]){assert(safeKey(d.id)&&!d.id.includes('--')&&!ids.has(d.id),`stat definition invalid or duplicate: ${d.id}`);ids.add(d.id);assert(typeof d.name==='string'&&d.name.trim()&&d.name.length<=60,'stat name required');assert(Number.isInteger(d.min)&&Number.isInteger(d.max)&&d.min<d.max&&d.min>=-100000&&d.max<=100000,'stat range invalid');assert(['public','player','private'].includes(d.visibility),'stat visibility invalid');}
  const initial=new Set();for(const value of p.initialStats||[]){const key=statKey(value.character,value.stat),d=(p.statDefinitions||[]).find(x=>x.id===value.stat);assert(actors.has(value.character)&&d&&!initial.has(key)&&Number.isInteger(value.value)&&value.value>=d.min&&value.value<=d.max,'initialStats: invalid or duplicate');initial.add(key);}
 },
 init(p){const values={};for(const actor of p.actors)for(const definition of p.statDefinitions||[])values[statKey(actor.id,definition.id)]=Math.max(definition.min,Math.min(definition.max,0));for(const value of p.initialStats||[])values[statKey(value.character,value.stat)]=value.value;return {values};},
 panel(s,p){return {title:'Character stats',lines:Object.entries(s.modules['character.stats'].values).filter(([key])=>{const [character,stat]=key.split('--'),d=p.statDefinitions.find(x=>x.id===stat);return character===p.playerId||d?.visibility!=='private';}).map(([key,value])=>{const [character,stat]=key.split('--');return `${s.actors[character]?.name||character} · ${p.statDefinitions.find(x=>x.id===stat)?.name||stat}: ${value}`;})};}
};
