import {assert,safeKey} from '../core/engine.mjs';
// Optional extension: zero core changes are needed to add this module.
export const abilities={id:'powers.abilities',version:'0.1.0',coreApi:'0.1.0',requires:[],
  validate(p){assert(p.resource&&Number.isInteger(p.resource.max)&&p.resource.max>0,'resource.max: positive integer required');for(const a of p.abilities||[]){assert(Number.isInteger(a.cost)&&a.cost>0&&a.cost<=p.resource.max,'ability.cost: invalid');assert(safeKey(a.flag),'ability.flag: invalid');assert(p.locations.some(l=>l.id===a.location),'ability.location: unknown');}},
  init:p=>({energy:p.resource.max}),
  commands:{'powers.use'(tx,args){const {state:s,pack:p}=tx;const a=p.abilities.find(a=>a.id===args.ability);assert(a,'Unknown ability');assert(a.location===s.actors[p.playerId].location,'You cannot use that ability here');assert(!s.flags[a.flag],'This ability has already changed this location');assert(s.modules['powers.abilities'].energy>=a.cost,`Not enough ${p.resource.name}`);tx.set(['modules','powers.abilities','energy'],s.modules['powers.abilities'].energy-a.cost);tx.set(['flags',a.flag],true);tx.emit('powers.used',{ability:a.id,text:a.result},[p.playerId]);},
    'powers.rest'(tx){const {state:s,pack:p}=tx;assert(s.actors[p.playerId].location===p.resource.restAt,'You can only restore energy at the rest point');tx.set(['modules','powers.abilities','energy'],p.resource.max);tx.emit('powers.rested',{text:`Restored ${p.resource.name}.`},[p.playerId]);}},
  actions(s,p){return [...p.abilities.filter(a=>a.location===s.actors[p.playerId].location).map(a=>({label:`${a.name} (${a.cost} ${p.resource.name})`,type:'powers.use',args:{ability:a.id}})),{label:`Restore ${p.resource.name}`,type:'powers.rest',args:{}}];},
  panel(s,p){return {title:p.resource.name,lines:[`${s.modules['powers.abilities'].energy} / ${p.resource.max}`]};}
};
