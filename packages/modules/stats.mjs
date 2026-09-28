import {assert,safeKey} from '../core/engine.mjs';

export const statKey=(character,stat)=>`${character}--${stat}`;
export const statValue=(state,character,stat)=>state.modules['character.stats']?.values[statKey(character,stat)]??0;

// Named ranks turn raw points into something a player can aim for ("Nerve: Bold"); the number stays in the creator view.
export const rankOf=(definition,value)=>(definition?.ranks||[]).filter(r=>value>=r.min).at(-1)||null;

export function changeStat(tx,character,stat,delta,reason){
 const definition=tx.pack.statDefinitions.find(x=>x.id===stat),old=statValue(tx.state,character,stat),value=Math.max(definition.min,Math.min(definition.max,old+delta));
 tx.set(['modules','character.stats','values',statKey(character,stat)],value);
 const visibility=definition.visibility==='public'?'public':[character,...(definition.visibility==='player'?[tx.pack.playerId]:[])],before=rankOf(definition,old),after=rankOf(definition,value),rankUp=after&&after!==before&&value>old;
 const who=character===tx.pack.playerId?'Your':`${tx.state.actors[character].name}'s`;
 tx.emit('character.statChanged',{character,stat,value,delta:value-old,...(after?{rank:after.name}:{}),...(rankUp?{rankUp:true}:{}),...(reason?{reason}:{}),text:rankUp?`${who} ${definition.name} rose to ${after.name}.`:after?`${definition.name} ${value>=old?'+':''}${value-old} · ${after.name}`:`${who} ${definition.name} is now ${value}.`},visibility);
}

export const stats={id:'character.stats',version:'0.1.0',coreApi:'0.1.0',requires:[],
 validate(p){
  assert(Array.isArray(p.statDefinitions||[])&&(p.statDefinitions||[]).length<=30,'statDefinitions: expected up to 30 stats');const ids=new Set(),actors=new Set(p.actors.map(a=>a.id));assert(p.actors.every(a=>!a.id.includes('--')),'character.stats: actor IDs cannot contain --');
  for(const d of p.statDefinitions||[]){assert(safeKey(d.id)&&!d.id.includes('--')&&!ids.has(d.id),`stat definition invalid or duplicate: ${d.id}`);ids.add(d.id);assert(typeof d.name==='string'&&d.name.trim()&&d.name.length<=60,'stat name required');assert(Number.isInteger(d.min)&&Number.isInteger(d.max)&&d.min<d.max&&d.min>=-100000&&d.max<=100000,'stat range invalid');assert(['public','player','private'].includes(d.visibility),'stat visibility invalid');assert(Array.isArray(d.ranks||[])&&(d.ranks||[]).length<=10&&(d.ranks||[]).every((r,i,a)=>Number.isInteger(r.min)&&r.min>=d.min&&r.min<=d.max&&(!i||r.min>a[i-1].min)&&typeof r.name==='string'&&r.name.trim()&&r.name.length<=40),`${d.id}.ranks: ascending {min,name} within range`);assert(d.learnFromFailure===undefined||Number.isInteger(d.learnFromFailure)&&d.learnFromFailure>=0&&d.learnFromFailure<=5,`${d.id}.learnFromFailure: 0–5`);}
  for(const item of p.items||[])if(item.statBonus){assert(item.slot&&p.modules['items.equipment'],`items.${item.id}.statBonus: only equippable items give stat bonuses`);for(const [stat,bonus] of Object.entries(item.statBonus))assert(ids.has(stat)&&Number.isInteger(bonus)&&Math.abs(bonus)<=5,`items.${item.id}.statBonus: invalid`);}
  const initial=new Set();for(const value of p.initialStats||[]){const key=statKey(value.character,value.stat),d=(p.statDefinitions||[]).find(x=>x.id===value.stat);assert(actors.has(value.character)&&d&&!initial.has(key)&&Number.isInteger(value.value)&&value.value>=d.min&&value.value<=d.max,'initialStats: invalid or duplicate');initial.add(key);}
 },
 init(p){const values={};for(const actor of p.actors)for(const definition of p.statDefinitions||[])values[statKey(actor.id,definition.id)]=Math.max(definition.min,Math.min(definition.max,0));for(const value of p.initialStats||[])values[statKey(value.character,value.stat)]=value.value;return {values};},
 panel(s,p){return {title:'Character stats',lines:Object.entries(s.modules['character.stats'].values).filter(([key,value])=>{const [character,stat]=key.split('--'),d=p.statDefinitions.find(x=>x.id===stat);return character===p.playerId||d?.visibility!=='private'&&(value||p.initialStats?.some(x=>x.character===character&&x.stat===stat));}).map(([key,value])=>{const [character,stat]=key.split('--');const d=p.statDefinitions.find(x=>x.id===stat),r=rankOf(d,value),next=(d?.ranks||[]).find(x=>x.min>value),raise=character===p.playerId?(p.activities||[]).filter(x=>x.effects?.some(e=>e.type==='stat'&&e.stat===stat&&e.delta>0)).map(x=>`${x.name} (${p.locations.find(l=>l.id===x.location)?.name||x.location})`):[];return `${s.actors[character]?.name||character} · ${d?.name||stat}: ${r?`${r.name} (${value})`:value}${next?` · ${next.name} at ${next.min}`:''}${raise.length?` · raise: ${raise.join(', ')}`:''}`;})};}
};
