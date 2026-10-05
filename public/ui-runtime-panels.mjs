export const panelActions={shop:'status',map:'locations',board:'journal',calendar:'calendar',tool_dossier:'journal',tool_inventory:'status',tool_location:'locations'};
export function runtimePanel(id,data){
 const p=data.pack,s=data.state;
 if(panelActions[id])return {label:{shop:'Shop',map:'Map',board:'Board',calendar:'Calendar',tool_dossier:'Dossier',tool_inventory:'Inventory',tool_location:'Location'}[id],action:panelActions[id],lines:[]};
 if(id==='balance'){const money=s.modules?.['world.economy']?.balance,line=data.panels?.find(x=>x.title==='Money')?.lines?.[0];return {label:'Wallet',lines:Number.isFinite(money)?[line||'Balance: '+money]:['Economy is not enabled.']};}
 if(id==='radar'){const values=s.modules?.['character.stats']?.values||{},stats=(p.statDefinitions||[]).filter(d=>d.visibility==='public'||Array.isArray(d.visibility)&&d.visibility.includes(p.playerId)).filter(d=>Number.isFinite(values[p.playerId+'--'+d.id]));return {label:'Player stats',lines:stats.length?stats.map(d=>d.name+': '+values[p.playerId+'--'+d.id]):['Connect a public stat in Game UI.']};}
 if(id==='relationship'){const cs=data.characters||[];return {label:'Profiles',lines:cs.length?cs.map(c=>c.name+(c.stage?' · '+c.stage:'')+(c.availability?' · '+c.availability:'')):['No character profiles available.']};}
 if(id==='panel')return {label:'Panel',lines:['Connect dialogue or feedback in Game UI.']};
 if(id==='tool_planner')return p.gameProject?.timeMode==='planner'?{label:'Planner',action:'calendar',lines:[]}:{label:'Planner',placeholder:true,lines:['Use planner time mode to enable this tool.']};
 return null;
}
