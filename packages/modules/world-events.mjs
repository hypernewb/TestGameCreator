import {assert,safeKey} from '../core/engine.mjs';

export const worldEvents={
  id:'world.events',version:'0.1.0',coreApi:'0.1.0',requires:[],
  validate(pack){
    for(const [i,event] of (pack.worldEvents||[]).entries()){
      assert(safeKey(event.id),`worldEvents[${i}].id: invalid`);
      assert(typeof event.name==='string'&&event.name.trim(),`worldEvents[${i}].name: required`);
      assert(typeof event.description==='string'&&event.description.trim(),`worldEvents[${i}].description: required`);
      assert(Number.isInteger(event.startDay)&&event.startDay>0&&Number.isInteger(event.endDay)&&event.endDay>=event.startDay,`worldEvents[${i}]: invalid day window`);
      if(event.location)assert(pack.locations.some(l=>l.id===event.location),`worldEvents.${event.id}.location: unknown`);
    }
  }
};
